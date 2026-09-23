/**
 * Backfill 06b — traduz o estado operacional do funil legado para o canônico.
 *
 * O PROBLEMA QUE ISTO RESOLVE, medido no ensaio com dump fresco de 23/09:
 *
 * O backfill 06 deriva o estado da aquisição de `leads.qualificado`,
 * `leads.qualificado_em`, `leads.desqualificado_em` e `leads.nutricao_*`.
 * Nenhuma dessas colunas existe no banco de produção — elas nascem vazias aqui,
 * criadas pela cadeia de migrations. `SELECT l.*` devolve `undefined` para elas
 * sem lançar erro, então as 4.012 linhas viram aquisição "aberta, não
 * qualificada, não desqualificada" e o funil inteiro colapsa em Novo:
 *
 *     etapa            canônico   legado (board real)
 *     novo                 2757        59
 *     em_contato            536       490
 *     qualificacao            0       211
 *     qualificado             0       162
 *     nutricao                0        54
 *     desqualificado          0       644
 *
 * A verdade operacional do funil em produção mora em `leads.sdr_status`
 * combinado com o estado do negócio — é o que `sdrBoardColumn()` lê para montar
 * o board legado, e nenhum backfill do canônico a lia.
 *
 * O De/Para é o aprovado pelo Kauã em 17/08 (ver `scripts/migrate-pre-vendas-crm2.ts`),
 * reaplicado sobre as sete etapas canônicas.
 *
 * Escreve em DOIS lugares de propósito:
 *   - `aquisicoes.etapa_id`, a casa canônica da etapa (SPEC §8.2). Tem
 *     precedência sobre a derivação: a leitura é `COALESCE(pe.codigo, CASE…)`.
 *   - os fatos (`qualificado`, `qualificado_em`, `desqualificado_em`,
 *     `nutricao_status`), para que a derivação chegue à mesma conclusão que a
 *     etapa gravada. Gravar só a etapa deixaria duas verdades na mesma tela,
 *     que é o bug que este modelo existe para acabar.
 *
 * Roda DEPOIS do 06 (precisa das aquisições criadas) e ANTES do 16 (que só
 * preenche etapa ainda NULL, então encontra este trabalho pronto e não o
 * reescreve).
 *
 * IDEMPOTENTE: recalcula sempre a partir do legado, que não é alterado aqui.
 * Rodar duas vezes chega ao mesmo resultado.
 *
 *   pnpm tsx --env-file=.env src/scripts/backfill/06b-estado-pre-vendas-legado.ts
 *   pnpm tsx --env-file=.env src/scripts/backfill/06b-estado-pre-vendas-legado.ts --aplicar
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { negocioStatusToSdrMirror } from "@/lib/crm/pipeline";

const APLICAR = process.argv.includes("--aplicar");

/** Mesma definição de `qualificacao-colunas.ts`: origem exatamente "outbound". */
function ehOutbound(origem: string | null): boolean {
  return (origem ?? "").trim().toLowerCase() === "outbound";
}

/**
 * Cópia fiel de `sdrBoardColumn()` (`src/lib/crm/qualificacao-colunas.ts:137`).
 *
 * Não é importada porque aquela assina sobre o tipo `Lead` da UI, que carrega
 * campos que este script não tem motivo para montar. A lógica é a mesma, linha
 * a linha, e `scripts/audit-pre-vendas-board.ts` mantém a terceira cópia que
 * confere as duas contra o banco.
 */
function colunaDoBoardLegado(l: {
  sdrStatus: string | null;
  negocioPrincipal: { status: string } | null;
  negocioCount: number;
  origem: string | null;
}): string {
  const s = l.sdrStatus || "pending";
  if (s === "disqualified") return "disqualified";
  if (l.negocioPrincipal?.status === "no_show") return s;
  if (l.negocioPrincipal) return negocioStatusToSdrMirror(l.negocioPrincipal.status);
  if (l.negocioCount > 0) return "m_qualified";
  if (s === "pending" && ehOutbound(l.origem)) return "outbound";
  return s;
}

/**
 * De/Para para as sete etapas canônicas.
 *
 * `sdr_sem_retorno` mapeava para a etapa `sem_resposta` do CRM2, que não existe
 * no canônico. Vai para `nutricao` por ser estagnação e não descarte — são 46
 * leads, e a alternativa (`desqualificado`) é uma decisão de negócio que está
 * registrada em docs/sync-dev-20260923/DIAGNOSTICO.md aguardando o Kauã.
 */
const PARA_ETAPA_CANONICA: Record<string, string> = {
  pending: "novo",
  outbound: "novo",
  contacted: "em_contato",
  qualifying: "qualificacao",
  qualified: "qualificado",
  m_qualified: "qualificado",
  m_reuniao: "qualificado",
  m_convertido: "qualificado",
  disqualified: "desqualificado",
  sdr_sem_retorno: "nutricao",
  sdr_sem_interesse: "nutricao",
  sdr_retomar_depois: "nutricao",
};

type LinhaLead = {
  lead_id: string;
  aquisicao_id: string;
  organizacao_id: string;
  sdr_status: string | null;
  origem: string | null;
  updated_at: string | null;
  created_at: string | null;
  last_contact_at: string | null;
};

async function main() {
  console.log(`\n  BACKFILL 06b — estado do pré-vendas legado ${APLICAR ? "(APLICANDO)" : "(dry-run)"}\n`);

  // Só leads de verdade. `tipo='contato'|'cliente'|'ex-cliente'` tem aquisição
  // (SPEC §41), mas não tem funil de pré-vendas: o board legado recorta
  // `tipo='lead'` (src/api-server/routes/leads.ts:252). Mexer no estado dos
  // outros seria inventar um funil que nunca existiu.
  const linhas = await db.execute<LinhaLead>(sql`
    SELECT l.id::text AS lead_id, a.id::text AS aquisicao_id,
           a.organizacao_id::text, l.sdr_status, l.origem,
           l.updated_at::text, l.created_at::text, l.last_contact_at::text
      FROM leads l
      -- A ponte e backfill_provenance, nao aquisicoes.lead_legado_id.
      --
      -- Numa base virgem o vínculo direto ainda não existe quando este passo
      -- roda: quem o preenche é o bloco 0 do passo 16, e o 16 é o último da
      -- cadeia. Casar por ele devolvia ZERO linhas e o backfill dizia "0
      -- aquisições" sem errar — medido no refresh do dev remoto em 23/09.
      --
      -- A provenance é gravada pelo próprio 06, então existe sempre que a
      -- aquisição existe. O COALESCE mantém o caminho direto para bases que já
      -- têm o vínculo (dev, homolog), onde a provenance pode ter sido podada.
      LEFT JOIN backfill_provenance bp
        ON bp.entidade_canonica = 'aquisicao' AND bp.tabela_origem = 'leads'
       AND bp.id_origem = l.id::text
      JOIN aquisicoes a
        ON a.id = COALESCE(bp.id_canonico, (SELECT a2.id FROM aquisicoes a2 WHERE a2.lead_legado_id = l.id LIMIT 1))
     WHERE l.tipo = 'lead'`);

  // Negócios por lead, uma consulta só. A escolha do principal é a mesma de
  // routes/leads.ts:386-406: vivo e não-no_show primeiro, depois vivo, depois
  // qualquer um.
  const negocios = await db.execute<{ lead_id: string; status: string }>(sql`
    SELECT nl.lead_id::text, n.status
      FROM negocio_leads nl
      JOIN negocios n ON n.id = nl.negocio_id`);

  const porLead = new Map<string, { status: string }[]>();
  for (const n of negocios) {
    if (!n.lead_id) continue;
    const lista = porLead.get(n.lead_id) ?? [];
    lista.push({ status: n.status });
    porLead.set(n.lead_id, lista);
  }

  const contagem = new Map<string, number>();
  const planos: { aquisicaoId: string; etapa: string; quando: string | null }[] = [];

  for (const l of linhas) {
    const negs = porLead.get(l.lead_id) ?? [];
    const vivos = negs.filter((n) => !["perdido", "churned"].includes(n.status));
    const emPe = vivos.filter((n) => n.status !== "no_show");
    const principal = emPe[0] ?? vivos[0] ?? negs[0] ?? null;

    const coluna = colunaDoBoardLegado({
      sdrStatus: l.sdr_status,
      negocioPrincipal: principal,
      negocioCount: negs.length,
      origem: l.origem,
    });

    // Precedência do modelo canônico: oportunidade aberta vence qualificação.
    //
    // É a mesma ordem que a expressão de etapa do board já declara
    // (board-pre-vendas.ts) e que o De/Para de 17/08 não tinha como expressar,
    // porque o board legado não tem coluna Oportunidade: lá m_qualified e
    // m_reuniao moram em "Qualificado (SQL)" e "Agenda Confirmada". O Kanban
    // único do Documento Mestre v0.13 tem as sete colunas, e mandar tudo para
    // qualificado deixava Oportunidade permanentemente em zero.
    //
    // A soma não muda: 162 viram 141 em oportunidade e 21 em qualificado, que
    // são exatamente os SQL sem negócio no closer.
    const temNegocioAberto = negs.some(
      (n) => !["perdido", "churned", "ganho"].includes(n.status));
    const etapa = temNegocioAberto && PARA_ETAPA_CANONICA[coluna] === "qualificado"
      ? "oportunidade"
      : PARA_ETAPA_CANONICA[coluna];
    // Chave nova no legado é erro a relatar, nunca a adivinhar: cair em "novo"
    // em silêncio é como 644 desqualificados viraram Novo da primeira vez.
    if (!etapa) {
      console.error(`  ✘ sdrBoardColumn devolveu "${coluna}", que não está no De/Para.`);
      console.error(`    lead ${l.lead_id}. Nada foi escrito.`);
      process.exit(1);
    }

    contagem.set(etapa, (contagem.get(etapa) ?? 0) + 1);
    planos.push({ aquisicaoId: l.aquisicao_id, etapa, quando: l.last_contact_at ?? l.updated_at ?? l.created_at });
  }

  console.log(`  leads tipo='lead' com aquisição: ${linhas.length}\n`);
  console.log("  distribuição resultante:");
  for (const [etapa, n] of [...contagem.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${etapa.padEnd(16)} ${String(n).padStart(5)}`);
  }

  if (!APLICAR) {
    console.log("\n  dry-run — nada escrito. Use --aplicar.\n");
    return;
  }

  // Uma consulta por etapa, não uma por linha: são 7 etapas e 1.620 linhas.
  let escritas = 0;
  for (const [etapa] of contagem) {
    const ids = planos.filter((p) => p.etapa === etapa).map((p) => p.aquisicaoId);
    const datas = planos.filter((p) => p.etapa === etapa).map((p) => p.quando);

    const r = await db.execute<{ n: number }>(sql`
      WITH alvo AS (
        SELECT unnest(${sql.raw(`ARRAY[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]`)}) AS id,
               unnest(${sql.raw(`ARRAY[${datas.map((d) => (d ? `'${d}'` : "NULL")).join(",")}]::timestamptz[]`)}) AS quando
      ), alvo_etapa AS (
        SELECT pe.id AS etapa_id, pe.pipeline_id
          FROM pipeline_etapas pe
          JOIN pipelines p ON p.id = pe.pipeline_id AND p.slug = 'aquisicao'
         WHERE pe.codigo = ${etapa}
         LIMIT 1
      ), aplicado AS (
        UPDATE aquisicoes a
           SET etapa_id   = ae.etapa_id,
               pipeline_id = ae.pipeline_id,
               qualificado = ${etapa === "qualificado"},
               qualificado_em = CASE WHEN ${etapa === "qualificado"} THEN COALESCE(a.qualificado_em, alvo.quando) ELSE a.qualificado_em END,
               desqualificado_em = CASE WHEN ${etapa === "desqualificado"} THEN COALESCE(a.desqualificado_em, alvo.quando) ELSE a.desqualificado_em END,
               nutricao_status = CASE WHEN ${etapa === "nutricao"} THEN COALESCE(NULLIF(a.nutricao_status, ''), 'estagnado_legado') ELSE a.nutricao_status END,
               -- updated_at preservado: backfill não é toque do operador, e
               -- bumpar a coluna faz o board inteiro dizer "agora mesmo".
               updated_at = a.updated_at
          FROM alvo
          JOIN alvo_etapa ae ON TRUE
         WHERE a.id = alvo.id
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM aplicado`);
    escritas += Number(r[0]?.n ?? 0);
  }

  console.log(`\n  ✓ ${escritas} aquisições com etapa e estado vindos do funil legado\n`);

  // Recorte do funil: o que nunca foi lead sai do board ativo.
  //
  // O 06 passou a nascer com este recorte, mas ele é idempotente por
  // backfill_provenance — numa base onde as aquisições já existem ele não
  // reprocessa. Este bloco fecha as que ficaram abertas.
  //
  // closed_at recebe a data do próprio registro, nunca now(): encerrar no
  // backfill não é um evento de hoje.
  const fechadas = await db.execute<{ n: number }>(sql`
    WITH aplicado AS (
      UPDATE aquisicoes a
         SET closed_at = COALESCE(a.desqualificado_em, l.updated_at, l.created_at, a.created_at),
             updated_at = a.updated_at
        FROM leads l
       WHERE l.id = a.lead_legado_id
         AND a.closed_at IS NULL
         AND l.tipo IS NOT NULL
         AND l.tipo <> 'lead'
      RETURNING 1
    )
    SELECT count(*)::int AS n FROM aplicado`);
  console.log(`  ${Number(fechadas[0]?.n ?? 0)} aquisicoes fora do funil encerradas (tipo <> 'lead')`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
