/**
 * Backfill: consolida o HISTÓRICO de entregas (pós-venda) na regra "uma entrega por venda e família"
 * (migration 0125 / commit 1508bb3). A regra nova só vale para o que nasce depois.
 *
 * O que faz, por (venda, família, tipo, ciclo):
 *  - grava `oportunidade_id` na entrega que sobra (venda = oportunidade_itens do serviço principal, ou
 *    `oportunidade_origem_id`, a MESMA resolução de `criarFulfillmentsParaServicos`);
 *  - preenche `fulfillment_servicos` com todos os serviços que ela passa a cobrir;
 *  - apaga as entregas duplicadas SOMENTE se estiverem virgens (NOT_STARTED, etapas todas pendentes e
 *    sem formulário, ramal ou portabilidade). Entrega com trabalho nunca é apagada nem alterada além
 *    do `oportunidade_id`; se há duas com trabalho na mesma venda, uma fica e a outra é reportada.
 *
 * Não toca: entrega sem venda resolvível (legado sem vínculo), venda ambígua (serviço em mais de uma
 * oportunidade), entrega cancelada. Preserva o relógio (`updated_at = updated_at`).
 * Idempotente: depois de aplicado, um novo dry-run planeja zero mudanças.
 *
 * Dry-run por padrão. `--aplicar` grava, uma transação por grupo.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { planejarConsolidacao, type EntregaDoHistorico } from "@/lib/crm/entrega-da-venda";

type Linha = {
  id: string; oportunidade_id: string | null; service_family: string; tipo: string | null; cycle_number: number;
  status: string; criada: string; ops: string | null; virgem: boolean; progresso: string; servicos: string | null;
};

const lista = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

// Entrega "virgem" = nada de trabalho registrado. Mesma definição no DELETE (guarda dentro da transação).
const VIRGEM = (f: string) => sql`(
  ${sql.raw(f)}.status = 'NOT_STARTED' AND ${sql.raw(f)}.completed_at IS NULL AND ${sql.raw(f)}.etapas_herdadas IS NULL
  AND NOT EXISTS (SELECT 1 FROM fulfillment_itens fi WHERE fi.fulfillment_id = ${sql.raw(f)}.id
                   AND (fi.status <> 'PENDING' OR fi.blocker_type IS NOT NULL OR fi.responsavel_id IS NOT NULL OR fi.completed_at IS NOT NULL))
  AND NOT EXISTS (SELECT 1 FROM fulfillment_formularios x WHERE x.fulfillment_id = ${sql.raw(f)}.id)
  AND NOT EXISTS (SELECT 1 FROM fulfillment_ramais x WHERE x.fulfillment_id = ${sql.raw(f)}.id)
  AND NOT EXISTS (SELECT 1 FROM fulfillment_linhas_portabilidade x WHERE x.fulfillment_id = ${sql.raw(f)}.id)
  AND NOT EXISTS (SELECT 1 FROM fulfillments p WHERE p.fulfillment_anterior_id = ${sql.raw(f)}.id)
)`;

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const orgs = await db.execute<{ organizacao_id: string }>(sql`SELECT DISTINCT organizacao_id::text AS organizacao_id FROM fulfillments`);
  let t = { entregas: 0, grupos: 0, mudam: 0, gravarOp: 0, absorvidas: 0, vinculos: 0, conflitos: 0, semVenda: 0, ambiguas: 0, feitos: 0 };

  for (const { organizacao_id: org } of orgs) {
    const linhas = await db.execute<Linha>(sql`
      SELECT f.id::text AS id, f.oportunidade_id::text AS oportunidade_id, f.service_family, f.tipo, f.cycle_number, f.status,
             (extract(epoch FROM f.created_at) * 1000)::text AS criada,
             (SELECT string_agg(DISTINCT o, ',') FROM (
                SELECT oi.oportunidade_id::text || ':' || COALESCE(op.service_family, '') AS o
                  FROM oportunidade_itens oi JOIN oportunidades op ON op.id = oi.oportunidade_id
                 WHERE oi.servico_canonico_id = f.servico_canonico_id
                UNION SELECT s.oportunidade_origem_id::text || ':' || COALESCE(op.service_family, '')
                  FROM servicos_canonicos s JOIN oportunidades op ON op.id = s.oportunidade_origem_id
                 WHERE s.id = f.servico_canonico_id
              ) x) AS ops,
             ${VIRGEM("f")} AS virgem,
             (SELECT count(*) FROM fulfillment_itens fi WHERE fi.fulfillment_id = f.id AND fi.status <> 'PENDING')::text AS progresso,
             (SELECT string_agg(DISTINCT sv, ',') FROM (
                SELECT f.servico_canonico_id::text AS sv
                UNION SELECT fs.servico_canonico_id::text FROM fulfillment_servicos fs WHERE fs.fulfillment_id = f.id) y) AS servicos
        FROM fulfillments f
       WHERE f.organizacao_id = ${org}::uuid AND f.cancelled_at IS NULL`);

    const entregas: EntregaDoHistorico[] = linhas.map((l) => {
      // Serviço ligado a mais de uma oportunidade (assinatura reaproveitada em vendas de famílias diferentes):
      // vale a venda da MESMA família da entrega; só continua ambíguo se ainda sobrar mais de uma.
      const todas = lista(l.ops).map((x) => ({ id: x.split(":")[0], familia: x.split(":")[1] }));
      const mesmaFamilia = todas.filter((x) => x.familia === l.service_family);
      const ops = [...new Set((todas.length > 1 && mesmaFamilia.length > 0 ? mesmaFamilia : todas).map((x) => x.id))];
      return {
        id: l.id,
        oportunidadeId: l.oportunidade_id ?? (ops.length === 1 ? ops[0] : null),
        vendaAmbigua: !l.oportunidade_id && ops.length > 1,
        jaConsolidada: !!l.oportunidade_id,
        serviceFamily: l.service_family, tipo: l.tipo, cycleNumber: Number(l.cycle_number), status: l.status,
        virgem: l.virgem === true, progresso: Number(l.progresso), criadaEm: Number(l.criada), servicoIds: lista(l.servicos),
      };
    });
    const porId = new Map(entregas.map((e) => [e.id, e]));
    const { grupos, semVenda, ambiguas } = planejarConsolidacao(entregas);

    // O que de fato muda (para o segundo dry-run sair zerado).
    const plano = grupos.map((g) => {
      const meus = new Set(porId.get(g.sobrevivente)!.servicoIds);
      const vincular = g.servicoIds.filter((s) => !meus.has(s));
      return { g, vincular, muda: g.gravarOportunidade || g.absorvidas.length > 0 || vincular.length > 0 };
    });
    const mudam = plano.filter((p) => p.muda);

    t.entregas += entregas.length; t.grupos += grupos.length; t.mudam += mudam.length;
    t.gravarOp += mudam.filter((p) => p.g.gravarOportunidade).length;
    t.absorvidas += mudam.reduce((s, p) => s + p.g.absorvidas.length, 0);
    t.vinculos += mudam.reduce((s, p) => s + p.vincular.length, 0);
    t.conflitos += plano.reduce((s, p) => s + p.g.conflitos.length, 0);
    t.semVenda += semVenda.length; t.ambiguas += ambiguas.length;

    console.log(`\n── organização ${org}: ${entregas.length} entregas ativas, ${grupos.length} vendas/famílias ──`);
    for (const p of mudam.filter((x) => x.g.absorvidas.length > 0)) {
      const e = porId.get(p.g.sobrevivente)!;
      console.log(`  venda ${p.g.oportunidadeId.slice(0, 8)} ${e.serviceFamily}/${e.tipo}: fica ${p.g.sobrevivente.slice(0, 8)} (${e.status}), absorve ${p.g.absorvidas.length} virgem(ns), passa a cobrir ${p.g.servicoIds.length} serviço(s)`);
    }
    for (const p of plano.filter((x) => x.g.conflitos.length > 0)) {
      console.log(`  CONFLITO venda ${p.g.oportunidadeId.slice(0, 8)}: ${p.g.conflitos.length} entrega(s) com trabalho ficam como estão (decisão humana)`);
    }

    if (!aplicar) continue;
    for (const { g, muda } of plano) {
      if (!muda) continue;
      try {
        await db.transaction(async (tx) => {
          if (g.gravarOportunidade) {
            const r = await tx.execute(sql`
              UPDATE fulfillments SET oportunidade_id = ${g.oportunidadeId}::uuid, updated_at = updated_at
               WHERE id = ${g.sobrevivente}::uuid AND organizacao_id = ${org}::uuid AND oportunidade_id IS NULL AND cancelled_at IS NULL
               RETURNING id`);
            if (r.length !== 1) throw new Error(`entrega ${g.sobrevivente} mudou durante a execução`);
          }
          for (const s of g.servicoIds) {
            await tx.execute(sql`
              INSERT INTO fulfillment_servicos (fulfillment_id, servico_canonico_id, organizacao_id)
              VALUES (${g.sobrevivente}::uuid, ${s}::uuid, ${org}::uuid) ON CONFLICT DO NOTHING`);
          }
          for (const a of g.absorvidas) {
            // A guarda de "virgem" é refeita DENTRO da transação: se alguém começou a trabalhar, não apaga e desfaz o grupo.
            const r = await tx.execute(sql`
              DELETE FROM fulfillments f WHERE f.id = ${a}::uuid AND f.organizacao_id = ${org}::uuid AND ${VIRGEM("f")} RETURNING f.id`);
            if (r.length !== 1) throw new Error(`entrega ${a} deixou de ser virgem; grupo desfeito`);
          }
        });
        t.feitos++;
      } catch (err) {
        console.error(`  FALHA no grupo da venda ${g.oportunidadeId} (nada gravado nele):`, err);
        process.exitCode = 1;
      }
    }
  }

  console.log(`\nresumo: ${t.entregas} entregas ativas; ${t.mudam} vendas/famílias mudam (${t.gravarOp} recebem oportunidade_id, ${t.absorvidas} duplicadas virgens absorvidas, ${t.vinculos} vínculos de serviço novos).`);
  console.log(`não tocadas: ${t.semVenda} sem venda resolvível (legado), ${t.ambiguas} com venda ambígua, ${t.conflitos} em conflito (duas com trabalho na mesma venda).`);
  console.log(aplicar ? `aplicado: ${t.feitos} grupos.\n` : "\nSimulação. Rode com --aplicar pra gravar.\n");
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
