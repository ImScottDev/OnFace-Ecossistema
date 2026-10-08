/**
 * Prova do NEXO ligado ao agente de IA. Roda no ambiente alvo (dev remoto ou local):
 *
 *   npx tsx --env-file=.env src/scripts/verificar-nexo-ia.ts
 *   BASE=https://dev.crm.callface.io USER_ID=... npx tsx --env-file=.env src/scripts/verificar-nexo-ia.ts
 *
 * Sem CLAUDE_CODE_OAUTH_TOKEN (dev local) prova até o limite: ferramentas com o
 * escopo do usuário, rota, gate e o erro honesto. Com o token (dev remoto) o
 * bloco final exige resposta real do modelo e run registrado com trace.
 * Cria 1 conversa de teste no NEXO (runs reais, canal nexo_painel) quando há IA.
 */
import { encode } from "@auth/core/jwt";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";

const BASE = process.env.BASE || "http://localhost:3000";
const ORG = process.env.ORG_ID || "320a9052-dd43-4edb-9b74-34be53c5c419";
let falhas = 0;
const ok = (c: unknown, m: string) => { console.log(`  ${c ? "ok   " : "FALHA"} ${m}`); if (!c) falhas++; };

const ctxTool = (usuarioId: string) => ({ organizacaoId: ORG, agentId: "verificacao", runId: "verificacao", usuarioId, mode: "test" as const, autonomy: "suggest" as const });

async function main() {
  console.log("1. Ferramentas de leitura respeitam o escopo do usuário");
  const [adm] = await db.execute<{ id: string; nome: string; role: string }>(sql`SELECT id::text, nome, role FROM usuarios WHERE organizacao_id=${ORG}::uuid AND ativo AND role IN ('admin','super_admin') LIMIT 1`);
  const [sdr] = await db.execute<{ id: string; nome: string; role: string }>(sql`SELECT u.id::text, u.nome, u.role FROM usuarios u WHERE u.organizacao_id=${ORG}::uuid AND u.ativo AND u.role IN ('sdr','closer','vendedor') ORDER BY (SELECT count(*) FROM tarefas t WHERE t.usuario_id=u.id AND NOT t.concluida) DESC LIMIT 1`);
  const [{ n: totalOrg }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM tarefas WHERE organizacao_id=${ORG}::uuid AND NOT concluida`);
  const [{ n: totalSdr }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM tarefas WHERE organizacao_id=${ORG}::uuid AND NOT concluida AND usuario_id=${sdr!.id}::uuid`);
  const rAdm = await executeRegisteredTool("nexo_atividades", ctxTool(adm!.id), { filtro: "abertas", escopo: "equipe" });
  const rSdr = await executeRegisteredTool("nexo_atividades", ctxTool(sdr!.id), { filtro: "abertas" });
  ok((rAdm.data as any)?.total === totalOrg, `${adm!.role} vê a organização inteira (${totalOrg})`);
  ok((rSdr.data as any)?.total === totalSdr && totalSdr < totalOrg, `${sdr!.role} ${sdr!.nome} vê só as dele (${totalSdr} de ${totalOrg})`);
  ok(!(await executeRegisteredTool("nexo_atividades", ctxTool(adm!.id) && { ...ctxTool(adm!.id), usuarioId: null }, { filtro: "abertas" })).ok, "sem usuário a ferramenta recusa");
  const prop = await executeRegisteredTool("nexo_propor_acao", ctxTool(adm!.id), { kind: "abrir_tela", rotulo: "x", href: ["/", "/evil.com"].join("") });
  ok(!prop.ok, "proposta com href externo é recusada");
  const mut = await executeRegisteredTool("task_create", { ...ctxTool(adm!.id), permissoesDelegadas: new Set() }, { titulo: "x" });
  ok(!mut.ok && /permissão/.test(mut.error ?? ""), "ferramenta que muda estado segue barrada sem permissão delegada");

  console.log("2. Rotas (gate + erro honesto)");
  const token = await encode({
    token: { id: adm!.id, name: adm!.nome, email: "verificacao@onface.local", role: adm!.role, organizacaoId: ORG, organizacaoSlug: "scott-studio" },
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "", salt: "authjs.session-token",
  });
  const h = { cookie: `authjs.session-token=${token}`, "content-type": "application/json" };
  const sem = await fetch(`${BASE}/api/nexo/perguntar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pergunta: "oi" }) });
  ok(sem.status === 401 || sem.status === 403, `sem sessão recusa (${sem.status})`);
  const p = await (await fetch(`${BASE}/api/nexo/perguntar`, { method: "POST", headers: h, body: JSON.stringify({ pergunta: "Quantas atividades atrasadas eu tenho?", rota: "/tarefas", area: "Atividades" }) })).json();
  console.log("   resposta:", JSON.stringify(p).slice(0, 400));
  const comIA = p.configurada === true && !p.falhou;
  if (!comIA) ok(p.falhou === true && /IA não configurada|não conseguiu/.test(p.mensagem?.texto ?? ""), "sem IA: erro honesto, não resposta fabricada");
  const [contato] = await db.execute<{ id: string }>(sql`SELECT contato_id::text id FROM whatsapp_mensagens WHERE contato_id IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`);
  const a = await fetch(`${BASE}/api/nexo/conversa/analisar`, { method: "POST", headers: h, body: JSON.stringify({ contatoId: contato!.id, tipo: "resumo" }) });
  const aj = await a.json();
  console.log("   analisar:", a.status, JSON.stringify(aj).slice(0, 400));
  if (!comIA) ok(a.status === 503 && /IA não configurada/.test(aj.error ?? ""), "sem IA: análise devolve 503 com o motivo");
  const inv = await fetch(`${BASE}/api/nexo/conversa/analisar`, { method: "POST", headers: h, body: JSON.stringify({ contatoId: "00000000-0000-4000-8000-000000000000", tipo: "resumo" }) });
  ok(inv.status === 404, "contato de outra org/inexistente: 404");

  if (comIA) {
    console.log("3. IA real (só com CLAUDE_CODE_OAUTH_TOKEN no servidor)");
    ok(p.mensagem.texto.length > 10, "NEXO respondeu texto");
    const [run] = await db.execute<{ status: string; steps: number }>(sql`SELECT r.status, (SELECT count(*)::int FROM ai_agent_run_steps s WHERE s.run_id=r.id) steps FROM ai_agent_runs r WHERE r.id=${p.runId}::uuid`);
    ok(run?.status === "completed" && run.steps > 0, `run ${p.runId} registrado com trace (${run?.steps} passos)`);
    ok(aj.ok !== false && (aj.resumo || aj.tom), "resumo da conversa veio do modelo");
    const outra = await (await fetch(`${BASE}/api/nexo/perguntar`, { method: "POST", headers: h, body: JSON.stringify({ conversaId: p.conversaId, pergunta: "Cria uma tarefa para ligar para a empresa mais esquecida amanhã", rota: "/tarefas", area: "Atividades" }) })).json();
    console.log("   ação:", JSON.stringify(outra).slice(0, 500));
    ok(Array.isArray(outra.propostas) && outra.propostas.length > 0, "ação veio como proposta (nada executado sem confirmar)");
    const painel = await (await fetch(`${BASE}/api/nexo/painel`, { headers: h })).json();
    ok(painel.conversas?.some((c: any) => c.id === p.conversaId), "conversa aparece em Conversas recentes");
  }
  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo ok");
  process.exit(falhas ? 1 : 0);
}
main();
