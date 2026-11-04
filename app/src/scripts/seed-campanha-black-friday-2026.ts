/**
 * Semeia a campanha promocional Black Friday 2026 (migration 0142).
 *
 * Idempotente: roda quantas vezes quiser. A campanha é resolvida por `codigo`
 * e cada oferta por (campanha, price, condição) — repetir ATUALIZA o valor em
 * vez de duplicar a oferta.
 *
 * Os prices são resolvidos por `stripe_price_id`, não por UUID do banco: o id
 * do catálogo muda entre ambientes, o id do Stripe não. Price que não existir
 * no catálogo do ambiente é REPORTADO e pulado — semear uma oferta apontando
 * para o price errado é pior do que não semear.
 *
 *   npx tsx --env-file=.env src/scripts/seed-campanha-black-friday-2026.ts --dry-run
 *   npx tsx --env-file=.env src/scripts/seed-campanha-black-friday-2026.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const DRY = process.argv.includes("--dry-run");

const CODIGO = "black-friday-2026";
const NOME = "Black Friday Callface 2026";
const INICIO = "2026-11-03T00:00:00-03:00";
const FIM = "2026-11-30T23:59:59-03:00";

/** O bônus do Full: liberação manual, feita pelo time depois do pagamento. */
const BONUS_FULL = "agente_ia_30d_100min";
const BONUS_FULL_DESC = "30 dias de Agente IA com 100 minutos para 1 usuário";

interface Oferta {
  stripePriceId: string;
  rotulo: string;
  condicao: string;
  valorPromocional: number;
  /** "de" a exibir quando difere do preço de tabela vigente. */
  valorAncora?: number;
  bonus?: string;
  bonusDescricao?: string;
  ativo?: boolean;
  motivoDesativada?: string;
  ordem: number;
}

/* Tabela de 03/11/2026 (documento-mestre) com a correção de 04/11: o Full de
   tabela é R$ 179,90 hoje e passa a R$ 199,90 em 01/12, então a Black anuncia
   "de 199,90" enquanto o catálogo ainda está em 179,90. Só o Full tem âncora;
   nos outros o "de" é o próprio preço de tabela. */
const OFERTAS: Oferta[] = [
  { stripePriceId: "price_1UB5xsEd4dqxpSBfYsB95fMF", rotulo: "Callface AI - Full mensal", condicao: "sem fidelidade",
    valorPromocional: 149.9, valorAncora: 199.9, bonus: BONUS_FULL, bonusDescricao: BONUS_FULL_DESC, ordem: 1 },
  { stripePriceId: "price_1UB5xsEd4dqxpSBfYsB95fMF", rotulo: "Callface AI - Full mensal", condicao: "contrato de 12 meses",
    valorPromocional: 119.9, valorAncora: 199.9, bonus: BONUS_FULL, bonusDescricao: BONUS_FULL_DESC, ordem: 2 },
  { stripePriceId: "price_1UFgaxEd4dqxpSBfVqJaASVg", rotulo: "Callface AI - Pro mensal", condicao: "",
    valorPromocional: 559.9, ordem: 3 },
  { stripePriceId: "price_1TH7JZEd4dqxpSBfw2pBKJdI", rotulo: "Callface AI - Starter mensal", condicao: "",
    valorPromocional: 69.9, ordem: 4 },
  { stripePriceId: "price_1UB62mEd4dqxpSBfh65vEx1F", rotulo: "Callface AI - Agente IA mensal", condicao: "",
    valorPromocional: 400, ordem: 5 },

  /* White Label a R$ 99,90 por licença em qualquer faixa está no
     documento-mestre, mas o HUB da campanha registra "condições White Label de
     Black não definidas". Entram DESATIVADAS: ligar é um UPDATE de uma linha,
     e uma oferta ativa que o comercial não combinou é desconto vazando. */
  { stripePriceId: "price_1UB650Ed4dqxpSBf1ncqkJxA", rotulo: "White Label Licença faixa 1 (1 a 99)", condicao: "black",
    valorPromocional: 99.9, ativo: false, motivoDesativada: "condições White Label da Black não confirmadas", ordem: 6 },
  { stripePriceId: "price_1UB66XEd4dqxpSBfP2vhN7pw", rotulo: "White Label Licença faixa 2 (100 a 199)", condicao: "black",
    valorPromocional: 99.9, ativo: false, motivoDesativada: "condições White Label da Black não confirmadas", ordem: 7 },
  { stripePriceId: "price_1UB66rEd4dqxpSBfvocBsrTR", rotulo: "White Label Licença faixa 3 (200 a 499)", condicao: "black",
    valorPromocional: 99.9, ativo: false, motivoDesativada: "condições White Label da Black não confirmadas", ordem: 8 },
];

/* Business fica de fora de propósito: o documento-mestre registra 1.799 x
   2.799 em conflito e "sem preço público até o financeiro validar". */

async function main() {
  const orgs = await db.execute<{ id: string; nome: string }>(sql`
    SELECT o.id::text, o.nome FROM organizacoes o
     WHERE EXISTS (SELECT 1 FROM catalogo_precos cp WHERE cp.organizacao_id = o.id)`);
  if (orgs.length === 0) {
    console.error("Nenhuma organização com catálogo de preços. Rode a sincronização do catálogo Stripe antes.");
    process.exit(1);
  }

  for (const org of orgs) {
    console.log(`\n── ${org.nome} (${org.id})`);
    let campanhaId: string;
    if (DRY) {
      const [ja] = await db.execute<{ id: string }>(sql`
        SELECT id::text FROM campanhas_promocionais WHERE organizacao_id = ${org.id}::uuid AND codigo = ${CODIGO}`);
      campanhaId = ja?.id ?? "(seria criada)";
      console.log(`  campanha ${CODIGO}: ${ja ? "já existe" : "seria criada"}`);
    } else {
      const [c] = await db.execute<{ id: string }>(sql`
        INSERT INTO campanhas_promocionais (organizacao_id, codigo, nome, inicio, fim, ativo, observacao)
        VALUES (${org.id}::uuid, ${CODIGO}, ${NOME}, ${INICIO}::timestamptz, ${FIM}::timestamptz, true,
                ${"Tabela do documento-mestre de 03/11/2026, com a âncora do Full corrigida em 04/11 (tabela 179,90 hoje, 199,90 a partir de 01/12)."})
        ON CONFLICT (organizacao_id, codigo) DO UPDATE
           SET nome = EXCLUDED.nome, inicio = EXCLUDED.inicio, fim = EXCLUDED.fim,
               observacao = EXCLUDED.observacao, updated_at = now()
        RETURNING id::text`);
      campanhaId = c.id;
      console.log(`  campanha ${CODIGO}: ${campanhaId}`);
    }

    for (const o of OFERTAS) {
      const [preco] = await db.execute<{ id: string; valor: string; produto: string; variacao: string }>(sql`
        SELECT cp.id::text, cp.valor, sc.nome AS produto, cp.variacao
          FROM catalogo_precos cp JOIN servicos_catalogo sc ON sc.id = cp.servico_catalogo_id
         WHERE cp.organizacao_id = ${org.id}::uuid AND cp.stripe_price_id = ${o.stripePriceId}`);
      if (!preco) {
        console.warn(`  ! ${o.rotulo}: price ${o.stripePriceId} não está no catálogo desta organização — PULADO`);
        continue;
      }
      const tabela = Number(preco.valor);
      if (o.valorPromocional > tabela) {
        console.error(`  ! ${o.rotulo}: oferta ${o.valorPromocional} acima da tabela ${tabela} — PULADO`);
        continue;
      }
      const ancora = o.valorAncora ?? null;
      const marca = o.ativo === false ? " [DESATIVADA: " + o.motivoDesativada + "]" : "";
      const de = ancora && ancora > tabela ? ancora : tabela;
      console.log(`  ${o.rotulo}${o.condicao ? ` · ${o.condicao}` : ""}: de ${de.toFixed(2)} por ${o.valorPromocional.toFixed(2)} (tabela ${tabela.toFixed(2)})${marca}`);
      if (DRY) continue;
      await db.execute(sql`
        INSERT INTO campanhas_promocionais_precos
          (campanha_id, catalogo_preco_id, condicao, valor_promocional, valor_ancora, bonus, bonus_descricao, ativo, ordem)
        VALUES (${campanhaId}::uuid, ${preco.id}::uuid, ${o.condicao}, ${o.valorPromocional}, ${ancora},
                ${o.bonus ?? null}, ${o.bonusDescricao ?? null}, ${o.ativo ?? true}, ${o.ordem})
        ON CONFLICT (campanha_id, catalogo_preco_id, condicao) DO UPDATE
           SET valor_promocional = EXCLUDED.valor_promocional, valor_ancora = EXCLUDED.valor_ancora,
               bonus = EXCLUDED.bonus, bonus_descricao = EXCLUDED.bonus_descricao,
               ativo = EXCLUDED.ativo, ordem = EXCLUDED.ordem, updated_at = now()`);
    }
  }
  console.log(DRY ? "\nDry-run: nada foi gravado." : "\nPronto.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
