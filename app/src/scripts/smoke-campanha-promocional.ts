/**
 * Smoke da campanha promocional contra um banco de verdade (migration 0142).
 *
 * O teste unitário de `politica-campanha.ts` cobre a REGRA; aqui se prova o
 * que só o banco responde: a oferta é encontrada, a vigência é checada no
 * servidor, e a oferta de um produto não consegue entrar na linha de outro.
 *
 *   DATABASE_URL=... npx tsx src/scripts/smoke-campanha-promocional.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ofertasVigentesParaPrecos, aplicarOferta } from "@/lib/catalogo/campanha";

let falhas = 0;
function checa(nome: string, condicao: boolean, detalhe = "") {
  console.log(`${condicao ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!condicao) falhas++;
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT organizacao_id::text AS id FROM campanhas_promocionais WHERE codigo = 'black-friday-2026' LIMIT 1`);
  if (!org) { console.error("Campanha black-friday-2026 não semeada neste banco."); process.exit(1); }

  const [full] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM catalogo_precos WHERE stripe_price_id = 'price_1UB5xsEd4dqxpSBfYsB95fMF' AND organizacao_id = ${org.id}::uuid`);
  const [starter] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM catalogo_precos WHERE stripe_price_id = 'price_1TH7JZEd4dqxpSBfw2pBKJdI' AND organizacao_id = ${org.id}::uuid`);

  const dentro = new Date("2026-11-10T12:00:00-03:00");
  const depois = new Date("2026-12-01T00:00:01-03:00");

  const porPreco = await ofertasVigentesParaPrecos(org.id, [full.id, starter.id], dentro);
  const doFull = porPreco.get(full.id) ?? [];
  checa("Full tem as duas condições da Black", doFull.length === 2, `${doFull.length} oferta(s)`);
  checa("Starter tem uma oferta", (porPreco.get(starter.id) ?? []).length === 1);

  const semFidelidade = doFull.find((o) => o.oferta.condicao === "sem fidelidade");
  checa("a condição 'sem fidelidade' existe", !!semFidelidade);
  if (!semFidelidade) { process.exit(1); }

  const aplicada = await aplicarOferta({ organizacaoId: org.id, ofertaId: semFidelidade.oferta.id, catalogoPrecoId: full.id, agora: dentro });
  checa("a oferta do Full é aplicável dentro da janela", aplicada.ok);
  if (aplicada.ok) {
    checa("cobra 149,90", aplicada.preco.valorUnitario === 149.9, String(aplicada.preco.valorUnitario));
    checa("valor_tabela continua 179,90 (preço oficial, não a âncora)", aplicada.preco.valorTabela === 179.9, String(aplicada.preco.valorTabela));
    checa("exibe 'de 199,90'", aplicada.preco.valorExibidoComoDe === 199.9, String(aplicada.preco.valorExibidoComoDe));
    checa("desconto anunciado é 25,01%", aplicada.preco.descontoPercentual === 25.01, String(aplicada.preco.descontoPercentual));
    checa("o bônus do Full viaja junto", aplicada.preco.bonus === "agente_ia_30d_100min", String(aplicada.preco.bonus));
  }

  const foraDaJanela = await aplicarOferta({ organizacaoId: org.id, ofertaId: semFidelidade.oferta.id, catalogoPrecoId: full.id, agora: depois });
  checa("em 01/12 a Black não vale mais", !foraDaJanela.ok, foraDaJanela.ok ? "" : foraDaJanela.motivo);

  const trocado = await aplicarOferta({ organizacaoId: org.id, ofertaId: semFidelidade.oferta.id, catalogoPrecoId: starter.id, agora: dentro });
  checa("a oferta do Full não entra na linha do Starter", !trocado.ok, trocado.ok ? "" : trocado.motivo);

  const outraOrg = await aplicarOferta({ organizacaoId: "00000000-0000-0000-0000-000000000000", ofertaId: semFidelidade.oferta.id, catalogoPrecoId: full.id, agora: dentro });
  checa("a oferta não atravessa para outra organização", !outraOrg.ok);

  const nenhuma = await ofertasVigentesParaPrecos(org.id, [full.id], depois);
  checa("fora da janela o catálogo não oferece nada", (nenhuma.get(full.id) ?? []).length === 0);

  console.log(falhas === 0 ? "\nTudo verde." : `\n${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
