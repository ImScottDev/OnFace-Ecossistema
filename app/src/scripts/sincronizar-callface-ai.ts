/**
 * Roda o sync do SaaS Callface AI para o modelo local.
 *
 *     pnpm tsx --env-file=.env src/scripts/sincronizar-callface-ai.ts
 *     pnpm tsx --env-file=.env src/scripts/sincronizar-callface-ai.ts --so-identidade
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { sincronizarCallfaceAi } from "@/lib/integrations/callface-ai/sincronizar";
import { resolverIdentidades } from "@/lib/integrations/callface-ai/identidade";
import { fecharConexao } from "@onface/integrations-callface-ai";

const SO_IDENTIDADE = process.argv.includes("--so-identidade");

async function main() {
  const orgs = await db.execute<{ id: string; slug: string }>(sql`SELECT id::text, slug FROM organizacoes`);
  for (const org of orgs) {
    console.log(`\n═══ ${org.slug} ═══`);
    if (SO_IDENTIDADE) {
      const r = await resolverIdentidades(org.id);
      // O `ok` é checado ANTES dos números, e não só o `erro`.
      //
      // Quando o banco do SaaS não responde, a resolução volta com ok:false e
      // todos os contadores zerados, mas `avaliadas` preenchido. O script só
      // imprimia `erro`, que nesse caminho pode vir vazio — e a saída ficava
      // "avaliadas 174 · vinculadas 0 · sem sinal 0 · disputadas 0", que soa
      // como trabalho feito e não soma: 174 avaliadas têm de cair em ALGUMA
      // categoria. Medido em 23/09 com o túnel da porta 55432 fechado.
      if (!r.ok) {
        console.log(`  ✘ NÃO SINCRONIZOU — o banco do Callface AI não respondeu.`);
        console.log(`    ${r.naoConfigurado ? "CALLFACE_AI_DATABASE_URL não configurada neste ambiente." : (r.erro || "sem mensagem do driver; confira se o túnel/porta está de pé.")}`);
        console.log(`    (${r.avaliadas} empresa(s) seriam avaliadas quando a conexão voltar)`);
        continue;
      }
      console.log(`  avaliadas ${r.avaliadas} · vinculadas ${r.vinculadas} · já tinham ${r.jaVinculadas}`);
      console.log(`  sem sinal ${r.semSinal} · disputadas ${r.disputadas} · contradições ${r.contradicoes} · com pendência ${r.pendentes}`);
      if (r.erro) console.log(`  erro: ${r.erro}`);
      continue;
    }
    const r = await sincronizarCallfaceAi(org.id);
    console.log(`  status ${r.status} em ${r.duracaoMs}ms`);
    console.log(`  tenants ${r.tenants} · snapshots ${r.snapshots} · detalhes ${r.detalhes} · dias de uso ${r.diasDeUso} · identidades novas ${r.identidadesNovas}`);
    if (r.ambiguidade) {
      const a = r.ambiguidade;
      const pct = (n: number) => a.chamadasTotal ? ((n / a.chamadasTotal) * 100).toFixed(2) : "0";
      console.log(`  chamadas na janela ${a.chamadasTotal.toLocaleString("pt-BR")}`);
      console.log(`    ambíguas         ${a.chamadasAmbiguas.toLocaleString("pt-BR")} (${pct(a.chamadasAmbiguas)}%)`);
      console.log(`    sem atribuição   ${a.chamadasSemAtribuicao.toLocaleString("pt-BR")} (${pct(a.chamadasSemAtribuicao)}%)`);
    }
    if (r.erro) console.log(`  erro: ${r.erro}`);
  }
}

main()
  .then(async () => { await fecharConexao(); process.exit(0); })
  .catch(async (e) => { console.error(e); await fecharConexao(); process.exit(1); });
