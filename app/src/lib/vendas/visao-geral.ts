import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { monthRange, PAPEIS_QUE_SOMAM_NA_META } from "@/lib/metas-shared";
import { isAdminView, isReader } from "@/lib/auth/roles";

/**
 * Leituras próprias da visão geral de Vendas (/vendas).
 *
 * O funil e a lista de risco reaproveitam boardPreVendas/boardPipeline; aqui
 * fica só o que nenhuma consulta existente devolve no recorte de um mês:
 * ganhos do mês (total e por dia), ranking de closer e propostas.
 *
 * Regra de valor única (memória "Meta comercial é faturamento"): faturamento
 * fechado = mrr_fechado + valor_setup. Nunca valor_total (diverge da composição
 * em metade dos ganhos) nem valor_projeto (cópia do setup).
 *
 * Fonte dos ganhos é `negocios` com `ganho_at` na janela — a MESMA de
 * getMetaComercialAgregada/getRealizadoMeta. Assim o realizado do ranking soma
 * exatamente o realizado da meta da Home, sem segunda verdade.
 */

const FATURAMENTO = sql`COALESCE(n.mrr_fechado,0)::numeric + COALESCE(n.valor_setup,0)::numeric`;

export interface LinhaRanking {
  id: string;
  nome: string;
  /** Posição no time inteiro, mesmo quando só a própria linha é devolvida. */
  posicao: number;
  ganhos: number;
  faturamento: number;
  meta: number;
  abertas: number;
  valorAberto: number;
}

/**
 * Quem vê o quê em /vendas:
 * - gestao  : papéis de gestão (isAdminView) veem a meta do time e o ranking todo.
 * - pessoal : closer/sdr veem só a própria meta e a própria linha do ranking.
 * - leitor  : agregado da org, sem ranking (dado individual não é dele).
 * Papel desconhecido cai em "pessoal": na dúvida, mostra menos.
 */
export type EscopoVendas = "gestao" | "pessoal" | "leitor";

export function escopoVendas(role: string | null | undefined): EscopoVendas {
  if (isAdminView(role)) return "gestao";
  if (isReader(role)) return "leitor";
  return "pessoal";
}

export interface VisaoGeralVendasMes {
  /** YYYY-MM do recorte. */
  mes: string;
  ganhosOrg: number;
  faturamentoOrg: number;
  /** Faturamento acumulado dia a dia das closers — ou só do usuário, no escopo
   * pessoal (último ponto = realizado da meta exibida). */
  acumuladoPorDia: number[];
  /** Ganhos por trás do acumulado (closers, ou só os do usuário). */
  ganhosEscopo: number;
  diasNoMes: number;
  ranking: LinhaRanking[];
  propostas: { vigentes: number; valorVigente: number; enviadasNoMes: number; aceitasNoMes: number | null };
}

/** Normaliza ?mes=YYYY-MM; qualquer outra coisa cai no mês corrente. */
export function mesDoParametro(mes: string | undefined | null, agora = new Date()): string {
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return mes;
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

export async function visaoGeralVendasMes(
  organizacaoId: string,
  mes: string,
  escopo: EscopoVendas,
  usuarioId: string,
): Promise<VisaoGeralVendasMes> {
  const pessoal = escopo === "pessoal" ? usuarioId : null;
  const { primeiroDia, inicio, fim } = monthRange(`${mes}-01`);
  const ini = inicio.toISOString();
  const fi = fim.toISOString();
  const diasNoMes = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000);
  const papeis = sql.join(PAPEIS_QUE_SOMAM_NA_META.map((p) => sql`${p}`), sql`, `);

  const [org] = await db.execute<{ ganhos: number; faturamento: string }>(sql`
    SELECT count(*)::int AS ganhos, COALESCE(SUM(${FATURAMENTO}),0)::text AS faturamento
      FROM negocios n
     WHERE n.organizacao_id = ${organizacaoId}::uuid AND n.status = 'ganho'
       AND n.ganho_at >= ${ini}::timestamptz AND n.ganho_at < ${fi}::timestamptz
  `);

  // Ranking: mesmo universo de getMetaComercialAgregada (closer/vendedor
  // ativos). Meta do tipo novo vence; mês antigo só tem `mrr_fechado`, e sem o
  // fallback o histórico apareceria "sem meta" (mesma regra de lib/metas.ts).
  const ranking = await db.execute<{
    id: string; nome: string; ganhos: number; faturamento: string;
    meta: string | null; abertas: number; valor_aberto: string; posicao: number;
  }>(sql`
    WITH closers AS (
      SELECT id, nome FROM usuarios
       WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true
         AND role IN (${papeis})
    ), ganhos AS (
      SELECT n.responsavel_id AS id, count(*)::int AS ganhos, SUM(${FATURAMENTO}) AS faturamento
        FROM negocios n
       WHERE n.organizacao_id = ${organizacaoId}::uuid AND n.status = 'ganho'
         AND n.ganho_at >= ${ini}::timestamptz AND n.ganho_at < ${fi}::timestamptz
       GROUP BY 1
    ), metas_mes AS (
      -- Mesma regra tudo-ou-nada de getMetaComercialAgregada (lib/metas.ts):
      -- se QUALQUER closer tem meta do tipo novo no mês, só esse tipo conta para
      -- todas; senão vale o antigo. Fallback por closer faria a soma do ranking
      -- passar a meta do hero num mês misto. SUM, como lá (várias linhas somam).
      SELECT usuario_id AS id, SUM(valor_alvo) AS meta
        FROM metas
       WHERE organizacao_id = ${organizacaoId}::uuid AND periodo = ${primeiroDia}
         AND usuario_id IN (SELECT id FROM closers)
         AND tipo = CASE WHEN EXISTS (
               SELECT 1 FROM metas
                WHERE organizacao_id = ${organizacaoId}::uuid AND periodo = ${primeiroDia}
                  AND tipo = 'faturamento_fechado' AND usuario_id IN (SELECT id FROM closers)
             ) THEN 'faturamento_fechado' ELSE 'mrr_fechado' END
       GROUP BY 1
    ), abertas AS (
      -- Pipeline aberto é snapshot de agora, no canônico (o mesmo do board).
      SELECT responsavel_id AS id, count(*)::int AS abertas, COALESCE(SUM(valor),0) AS valor
        FROM oportunidades
       WHERE organizacao_id = ${organizacaoId}::uuid
         AND etapa IN ('entrada','diagnostico','proposta','negociacao')
       GROUP BY 1
    ), linhas AS (
      SELECT c.id, c.nome,
             COALESCE(g.ganhos,0) AS ganhos, COALESCE(g.faturamento,0) AS faturamento,
             m.meta, COALESCE(a.abertas,0) AS abertas, COALESCE(a.valor,0) AS valor_aberto,
             row_number() OVER (ORDER BY COALESCE(g.faturamento,0) DESC, c.nome)::int AS posicao
        FROM closers c
        LEFT JOIN ganhos g ON g.id = c.id
        LEFT JOIN metas_mes m ON m.id = c.id
        LEFT JOIN abertas a ON a.id = c.id
    )
    -- Escopo pessoal: posição e regra de meta são calculadas sobre o time
    -- inteiro (senão a linha divergiria da que o gestor vê); só a saída é
    -- filtrada. Leitor não recebe linha nenhuma.
    SELECT id::text, nome, ganhos, faturamento::text, meta::text, abertas,
           valor_aberto::text, posicao
      FROM linhas
     WHERE ${pessoal ? sql`id = ${pessoal}::uuid` : escopo === "leitor" ? sql`false` : sql`true`}
     ORDER BY posicao
  `);

  // Pessoal: os ganhos do próprio usuário, qualquer papel — a mesma leitura
  // de getRealizadoMeta("faturamento_fechado"), que alimenta a meta dele.
  const porDia = await db.execute<{ dia: number; ganhos: number; faturamento: string }>(sql`
    SELECT extract(day FROM n.ganho_at AT TIME ZONE 'America/Sao_Paulo')::int AS dia,
           count(*)::int AS ganhos, SUM(${FATURAMENTO})::text AS faturamento
      FROM negocios n
      JOIN usuarios u ON u.id = n.responsavel_id
     WHERE n.organizacao_id = ${organizacaoId}::uuid AND n.status = 'ganho'
       AND ${pessoal ? sql`n.responsavel_id = ${pessoal}::uuid` : sql`u.ativo = true AND u.role IN (${papeis})`}
       AND n.ganho_at >= ${ini}::timestamptz AND n.ganho_at < ${fi}::timestamptz
     GROUP BY 1
  `);
  const acumuladoPorDia: number[] = [];
  const mapaDia = new Map(porDia.map((d) => [d.dia, Number(d.faturamento)]));
  let soma = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    soma += mapaDia.get(d) ?? 0;
    acumuladoPorDia.push(soma);
  }

  // Vigente = o que o cliente tem em mãos agora (mesmo recorte de /propostas).
  const [prop] = await db.execute<{ vigentes: number; valor: string; enviadas: number; aceitas: number; com_data: number }>(sql`
    SELECT count(*) FILTER (WHERE status IN ('enviada','visualizada','ajuste_solicitado'))::int AS vigentes,
           COALESCE(SUM(total_geral) FILTER (WHERE status IN ('enviada','visualizada','ajuste_solicitado')),0)::text AS valor,
           count(*) FILTER (WHERE enviada_em >= ${ini}::timestamptz AND enviada_em < ${fi}::timestamptz)::int AS enviadas,
           count(*) FILTER (WHERE aceita_em >= ${ini}::timestamptz AND aceita_em < ${fi}::timestamptz)::int AS aceitas,
           -- aceita_em nunca foi preenchido (0 de 428 aceitas em 01/10): sem
           -- cobertura, "0 aceitas" seria mentira. Vira null e a tela mostra "—".
           count(*) FILTER (WHERE aceita_em IS NOT NULL)::int AS com_data
      FROM propostas
     WHERE organizacao_id = ${organizacaoId}::uuid
  `);

  return {
    mes,
    ganhosOrg: org?.ganhos ?? 0,
    faturamentoOrg: Number(org?.faturamento ?? 0),
    acumuladoPorDia,
    ganhosEscopo: porDia.reduce((s, d) => s + d.ganhos, 0),
    diasNoMes,
    ranking: ranking.map((r) => ({
      id: r.id, nome: r.nome, posicao: r.posicao, ganhos: r.ganhos, faturamento: Number(r.faturamento),
      meta: Number(r.meta ?? 0), abertas: r.abertas, valorAberto: Number(r.valor_aberto),
    })),
    propostas: {
      vigentes: prop?.vigentes ?? 0, valorVigente: Number(prop?.valor ?? 0),
      enviadasNoMes: prop?.enviadas ?? 0, aceitasNoMes: prop?.com_data ? prop.aceitas : null,
    },
  };
}
