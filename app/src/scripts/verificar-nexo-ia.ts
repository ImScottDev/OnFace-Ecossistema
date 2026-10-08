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
    const perguntar = async (headers: Record<string, string>, pergunta: string, conversaId?: string) =>
      (await fetch(`${BASE}/api/nexo/perguntar`, { method: "POST", headers, body: JSON.stringify({ conversaId, pergunta, rota: "/tarefas", area: "Atividades" }) })).json();
    const passosDe = (runId: string) => db.execute<{ name: string; output: any }>(sql`SELECT name, output FROM ai_agent_run_steps WHERE run_id=${runId}::uuid AND kind='tool_call' ORDER BY sequence`);
    ok(p.mensagem.texto.length > 10, "pergunta aberta: NEXO respondeu texto");
    const [run] = await db.execute<{ status: string; steps: number }>(sql`SELECT r.status, (SELECT count(*)::int FROM ai_agent_run_steps s WHERE s.run_id=r.id) steps FROM ai_agent_runs r WHERE r.id=${p.runId}::uuid`);
    ok(run?.status === "completed" && run.steps > 0, `run ${p.runId} registrado com trace (${run?.steps} passos)`);
    ok(aj.ok !== false && (aj.resumo || aj.tom), "resumo da conversa veio do modelo");

    // Criar atividade de verdade (modo live) e limpar depois.
    const c = await perguntar(h, "Crie uma atividade para amanhã às 10h: [QA nexo] ligar para teste de verificação", p.conversaId);
    console.log("   criar:", JSON.stringify(c).slice(0, 400));
    const [t] = await db.execute<{ id: string; origem: string; usuario_id: string }>(sql`SELECT id::text, origem, usuario_id::text FROM tarefas WHERE titulo ILIKE '[QA nexo]%' ORDER BY created_at DESC LIMIT 1`);
    ok(t && t.origem === "NEXO" && t.usuario_id === adm!.id && c.executadas?.length > 0, "criar atividade: tarefa gravada (origem NEXO, dono = usuário) e devolvida como executada");
    const [ev] = t ? await db.execute<{ source: string }>(sql`SELECT source FROM domain_events WHERE aggregate_id=${t.id}::uuid AND event_type='TaskCreated'`) : [];
    ok(ev?.source === "nexo", "evento TaskCreated com source nexo");

    // Cards do pipeline com escopo: o closer só vê as dele.
    const tokC = await encode({ token: { id: sdr!.id, name: sdr!.nome, email: "verificacao-closer@onface.local", role: sdr!.role, organizacaoId: ORG, organizacaoSlug: "scott-studio" }, secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "", salt: "authjs.session-token" });
    const hC = { cookie: `authjs.session-token=${tokC}`, "content-type": "application/json" };
    const pc = await perguntar(hC, "Liste as minhas oportunidades abertas do pipeline");
    const ps = await passosDe(pc.runId);
    const pip = ps.find((x) => x.name === "nexo_pipeline");
    const ids: string[] = (pip?.output?.data?.oportunidades ?? []).map((o: any) => o.id);
    const [alheias] = ids.length ? await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM negocios WHERE id = ANY(${sql.raw(`ARRAY['${ids.join("','")}']::uuid[]`)}) AND responsavel_id IS DISTINCT FROM ${sdr!.id}::uuid`) : [{ n: 0 }];
    ok(!!pip && alheias!.n === 0, `pipeline como ${sdr!.role}: ${ids.length} cards, nenhum de outra pessoa`);

    // Recusa por permissão: confirmar a ação de outra pessoa.
    const del = await perguntar(h, "Exclua a atividade [QA nexo] ligar para teste de verificação");
    ok(del.confirmacoes?.length > 0, "excluir: fica aguardando Confirmar (não apagou)");
    if (del.confirmacoes?.length) {
      const r = await (await fetch(`${BASE}/api/nexo/acoes/confirmar`, { method: "POST", headers: hC, body: JSON.stringify({ runId: del.confirmacoes[0].runId, passo: del.confirmacoes[0].passo }) })).json();
      ok(r.ok === false, "confirmação por outro usuário é recusada");
    }
    const painel = await (await fetch(`${BASE}/api/nexo/painel`, { headers: h })).json();
    ok(painel.conversas?.some((x: any) => x.id === p.conversaId), "conversa aparece em Conversas recentes");
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_type='tarefa' AND aggregate_id IN (SELECT id FROM tarefas WHERE titulo ILIKE '[QA nexo]%')`);
    await db.execute(sql`DELETE FROM tarefas WHERE titulo ILIKE '[QA nexo]%'`);
  }
  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo ok");
  process.exit(falhas ? 1 : 0);
}
main();
