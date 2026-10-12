/**
 * Chat do NEXO com o modelo REAL, pela rota que a casca usa, com sessão válida.
 * Pergunta o que foi passado em PERGUNTA (ou uma padrão) e imprime texto,
 * ações executadas e confirmações pendentes.
 *
 * API_BASE=http://localhost:3012 PERGUNTA="..." npx tsx --env-file=.env src/scripts/provar-nexo-chat.ts
 */
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const API = process.env.API_BASE ?? "http://localhost:3012";
async function main() {
  const s = await sessaoDeSmoke({ role: process.env.PAPEL || "admin" });
  const perguntas = (process.env.PERGUNTA ?? "Quais conversas de WhatsApp estão sem resposta? E quantos leads entraram nos últimos 7 dias, por campanha?").split("||");
  let conversaId: string | null = null;
  for (const pergunta of perguntas) {
    const t0 = Date.now();
    const r = await fetch(`${API}/api/nexo/perguntar`, { method: "POST", headers: { cookie: s.cookie, "content-type": "application/json" }, body: JSON.stringify({ conversaId, pergunta, rota: "/inicio", area: "inicio" }) });
    const j = await r.json() as { conversaId: string; configurada: boolean; falhou?: boolean; mensagem: { texto: string }; executadas?: unknown[]; confirmacoes?: unknown[] };
    conversaId = j.conversaId;
    console.log(`\n>> ${pergunta}\n[${r.status}, ${((Date.now() - t0) / 1000).toFixed(1)}s, configurada=${j.configurada}, falhou=${j.falhou ?? false}]`);
    console.log(j.mensagem?.texto);
    if (j.executadas?.length) console.log("executadas:", JSON.stringify(j.executadas));
    if (j.confirmacoes?.length) console.log("confirmacoes:", JSON.stringify(j.confirmacoes));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
