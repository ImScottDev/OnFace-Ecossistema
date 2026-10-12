/**
 * Prova das três consultas novas do NEXO (entradas, horarios_entrada,
 * nao_respondidas) com um usuário real de gestão: executa a ferramenta pela
 * mesma porta que o runtime usa e chama as rotas com o cookie de sessão.
 *
 * BASE=http://localhost:3000 API_BASE=http://localhost:3012 npx tsx --env-file=.env src/scripts/provar-nexo-consultas.ts
 */
import { sessaoDeSmoke } from "./_sessao-de-smoke";
import { permissoesEfetivas } from "@/lib/auth/permissoes";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";
import "@/lib/nexo/ferramentas";

const BASE = process.env.BASE ?? "http://localhost:3000";
const API = process.env.API_BASE ?? "http://localhost:3012";

async function main() {
  const s = await sessaoDeSmoke({ role: "admin" });
  const permissoesDelegadas = await permissoesEfetivas({ usuarioId: s.usuarioId, organizacaoId: s.organizacaoId, role: s.role });
  const ctx = { organizacaoId: s.organizacaoId, usuarioId: s.usuarioId, usuarioPapel: s.role, agentId: "00000000-0000-4000-8000-000000000000", runId: "00000000-0000-4000-8000-000000000001", mode: "test", autonomy: "suggest", permissoesDelegadas } as never;

  const hoje = new Date().toISOString().slice(0, 10);
  const de = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const r1 = await executeRegisteredTool("nexo_entradas", ctx, { de, ate: hoje, limite: 3 });
  const r2 = await executeRegisteredTool("nexo_horarios_entrada", ctx, { dia_semana: 4 });
  const r3 = await executeRegisteredTool("nexo_nao_respondidas", ctx, { limite: 3 });
  for (const [n, r] of [["entradas", r1], ["horarios_entrada", r2], ["nao_respondidas", r3]] as const) {
    if (!r.ok) throw new Error(`${n} falhou: ${r.error}`);
    const d = r.data as Record<string, unknown>;
    console.log(`\n== ${n}`, JSON.stringify({ ...d, leads: undefined, horarios: undefined, conversas: undefined }));
    const lista = (d.leads ?? d.horarios ?? d.conversas) as unknown[];
    console.log(`   ${lista.length} itens; primeiro:`, JSON.stringify(lista[0] ?? null).slice(0, 300));
  }

  const h = { cookie: s.cookie };
  for (const p of ["/inicio", "/atividades", "/clientes", "/automacoes/agentes"]) {
    const r = await fetch(`${BASE}${p}`, { headers: h, redirect: "manual" });
    const html = await r.text();
    const extra = p === "/automacoes/agentes" ? ` | lista 'NEXO Copiloto' na tela: ${/NEXO Copiloto/.test(html)}` : "";
    console.log(`GET ${p} -> ${r.status}${extra}`);
  }
  const api = await fetch(`${API}/api/nexo/perguntar`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ conversaId: null, pergunta: "quantos leads entraram ontem?", rota: "/inicio", area: "inicio" }) });
  const j = await api.json().catch(() => null) as Record<string, unknown> | null;
  console.log(`POST /api/nexo/perguntar -> ${api.status} configurada=${j?.configurada} falhou=${j?.falhou} texto=${JSON.stringify((j?.mensagem as { texto?: string })?.texto ?? j).slice(0, 200)}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
