/**
 * Métricas de CS.
 *
 * Cada métrica declara se é calculável com o dado que existe. As que não são
 * voltam com `disponivel: false` e o motivo — nunca com um número aproximado,
 * porque métrica de retenção errada é pior que métrica ausente: alguém decide
 * com ela.
 *
 * Auditado em 08/09/2026 na base real:
 *   `mrr_movimentos` tem 558 linhas classificadas (novo 237, churn 145,
 *   expansao 103, reativacao 41, contracao 32) com datas de 2023 a 2026 —
 *   então MRR Churn, Expansion, Contraction, GRR e NRR SÃO calculáveis.
 *   `cs_renovacoes` tem 1 linha (só 20 de 545 contratos ativos têm
 *   vencimento) — Renewal Rate NÃO é.
 *   `fulfillments.completed_at` está vazio nas 415 entregas — Time to Value
 *   NÃO é.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { medir } from "@/lib/metricas/catalogo";

export interface Metrica {
  chave: string;
  rotulo: string;
  disponivel: boolean;
  valor: number | null;
  unidade: "moeda" | "percentual" | "dias" | "quantidade";
  /** Como o número foi obtido — o CS precisa poder discordar com base. */
  base?: string;
  /** Por que não dá pra calcular, quando não dá. */
  motivoIndisponivel?: string;
}

const JANELA_PADRAO_DIAS = 90;

export async function metricasCs(organizacaoId: string, janelaDias = JANELA_PADRAO_DIAS): Promise<Metrica[]> {
  const metricas: Metrica[] = [];

  // ─── Movimentos de MRR na janela ───
  const [mov] = await db.execute<Record<string, string>>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'churn'      THEN ABS(delta) END), 0)::text AS churn,
      COALESCE(SUM(CASE WHEN tipo = 'contracao'  THEN ABS(delta) END), 0)::text AS contracao,
      COALESCE(SUM(CASE WHEN tipo = 'expansao'   THEN delta END), 0)::text      AS expansao,
      COALESCE(SUM(CASE WHEN tipo = 'reativacao' THEN delta END), 0)::text      AS reativacao,
      COALESCE(SUM(CASE WHEN tipo = 'novo'       THEN delta END), 0)::text      AS novo,
      COUNT(*)::text AS linhas
    FROM mrr_movimentos
   WHERE organizacao_id = ${organizacaoId}
     AND ocorrido_em >= now() - (${janelaDias} || ' days')::interval`);

  const churn = Number(mov?.churn ?? 0);
  const contracao = Number(mov?.contracao ?? 0);
  const expansao = Number(mov?.expansao ?? 0);
  const reativacao = Number(mov?.reativacao ?? 0);
  const temMovimento = Number(mov?.linhas ?? 0) > 0;

  // MRR base do início da janela: o atual menos tudo que se moveu nela.
  // O MRR global vem do Metric Catalog (Módulo 12): uma métrica, uma
  // definição. Esta era uma das oito expressões de MRR do repositório.
  const mrrAtual = (await medir(organizacaoId, "mrr_atual")).valor;
  const mrrInicial = mrrAtual - (Number(mov?.novo ?? 0) + expansao + reativacao - churn - contracao);

  const baseValida = temMovimento && mrrInicial > 0;
  const baseTexto = `janela de ${janelaDias} dias · MRR inicial estimado R$ ${mrrInicial.toFixed(2)} a partir de mrr_movimentos`;
  const semBase = "Sem movimentos de MRR na janela ou MRR inicial não reconstituível";

  metricas.push(
    { chave: "mrr_churn", rotulo: "MRR Churn", disponivel: temMovimento, valor: temMovimento ? churn : null, unidade: "moeda", base: "soma de mrr_movimentos tipo churn", motivoIndisponivel: temMovimento ? undefined : semBase },
    { chave: "mrr_contraction", rotulo: "Contraction MRR", disponivel: temMovimento, valor: temMovimento ? contracao : null, unidade: "moeda", base: "soma de mrr_movimentos tipo contracao", motivoIndisponivel: temMovimento ? undefined : semBase },
    { chave: "mrr_expansion", rotulo: "Expansion MRR", disponivel: temMovimento, valor: temMovimento ? expansao : null, unidade: "moeda", base: "soma de mrr_movimentos tipo expansao", motivoIndisponivel: temMovimento ? undefined : semBase },
    {
      chave: "grr", rotulo: "GRR", disponivel: baseValida, unidade: "percentual",
      // GRR não considera expansão de propósito: mede só o que foi retido.
      valor: baseValida ? ((mrrInicial - churn - contracao) / mrrInicial) * 100 : null,
      base: baseTexto, motivoIndisponivel: baseValida ? undefined : semBase,
    },
    {
      chave: "nrr", rotulo: "NRR", disponivel: baseValida, unidade: "percentual",
      valor: baseValida ? ((mrrInicial - churn - contracao + expansao) / mrrInicial) * 100 : null,
      base: baseTexto, motivoIndisponivel: baseValida ? undefined : semBase,
    },
  );

  // ─── Logo churn ───
  const [logo] = await db.execute<Record<string, string>>(sql`
    SELECT
      (SELECT COUNT(DISTINCT sc.empresa_id) FROM servicos_canonicos sc
        WHERE sc.organizacao_id = ${organizacaoId} AND sc.commercial_lifecycle = 'CHURNED'
          AND sc.updated_at >= now() - (${janelaDias} || ' days')::interval
          AND NOT EXISTS (SELECT 1 FROM servicos_canonicos s2
                           WHERE s2.empresa_id = sc.empresa_id AND s2.portfolio_included = true))::text AS perdidos,
      (SELECT COUNT(*) FROM clientes WHERE organizacao_id = ${organizacaoId} AND empresa_id IS NOT NULL)::text AS base`);
  const perdidos = Number(logo?.perdidos ?? 0);
  const baseClientes = Number(logo?.base ?? 0);
  metricas.push({
    chave: "logo_churn", rotulo: "Logo Churn", disponivel: baseClientes > 0, unidade: "percentual",
    valor: baseClientes > 0 ? (perdidos / baseClientes) * 100 : null,
    base: `${perdidos} clientes sem nenhum serviço ativo na janela, sobre ${baseClientes} contas`,
    motivoIndisponivel: baseClientes > 0 ? undefined : "Carteira vazia",
  });

  // ─── Saúde da operação de CS (dado 100% nosso) ───
  const [op] = await db.execute<Record<string, string>>(sql`
    SELECT
      (SELECT COUNT(*) FROM clientes WHERE organizacao_id = ${organizacaoId} AND empresa_id IS NOT NULL)::text AS contas,
      (SELECT COUNT(*) FROM clientes WHERE organizacao_id = ${organizacaoId} AND empresa_id IS NOT NULL AND responsavel_id IS NOT NULL)::text AS com_owner,
      (SELECT COUNT(DISTINCT t.empresa_id) FROM tarefas t
        WHERE t.organizacao_id = ${organizacaoId} AND t.concluida = false AND t.vence_em > now())::text AS com_proxima_acao,
      (SELECT COUNT(*) FROM cs_marcos WHERE organizacao_id = ${organizacaoId} AND status = 'CONCLUIDO'
        AND concluido_em::date <= due_date + 7)::text AS checkpoints_no_prazo,
      (SELECT COUNT(*) FROM cs_marcos WHERE organizacao_id = ${organizacaoId} AND status = 'CONCLUIDO')::text AS checkpoints_concluidos,
      (SELECT COUNT(DISTINCT empresa_id) FROM cs_riscos WHERE organizacao_id = ${organizacaoId}
        AND status = 'ABERTO' AND severidade IN ('CRITICO','EM_RISCO'))::text AS em_risco,
      (SELECT COUNT(DISTINCT empresa_id) FROM cs_riscos WHERE organizacao_id = ${organizacaoId}
        AND status = 'ABERTO' AND tipo IN ('FATURA_ATRASADA','PAGAMENTO_FALHOU','ASSINATURA_INADIMPLENTE'))::text AS inadimplentes`);

  const contas = Number(op?.contas ?? 0);
  const concluidos = Number(op?.checkpoints_concluidos ?? 0);
  metricas.push(
    { chave: "cobertura_owner", rotulo: "Cobertura de owner", disponivel: contas > 0, unidade: "percentual",
      valor: contas > 0 ? (Number(op?.com_owner ?? 0) / contas) * 100 : null,
      base: `${op?.com_owner ?? 0} de ${contas} contas com CS responsável` },
    { chave: "cobertura_proxima_acao", rotulo: "Cobertura de próxima ação", disponivel: contas > 0, unidade: "percentual",
      valor: contas > 0 ? (Number(op?.com_proxima_acao ?? 0) / contas) * 100 : null,
      base: `${op?.com_proxima_acao ?? 0} de ${contas} contas com tarefa futura agendada` },
    { chave: "checkpoints_no_prazo", rotulo: "Checkpoints no prazo", disponivel: concluidos > 0, unidade: "percentual",
      valor: concluidos > 0 ? (Number(op?.checkpoints_no_prazo ?? 0) / concluidos) * 100 : null,
      base: `${op?.checkpoints_no_prazo ?? 0} de ${concluidos} concluídos até 7 dias após a data prevista`,
      motivoIndisponivel: concluidos > 0 ? undefined : "Nenhum checkpoint concluído ainda" },
    { chave: "clientes_em_risco", rotulo: "Clientes em risco", disponivel: true, unidade: "quantidade",
      valor: Number(op?.em_risco ?? 0), base: "sinais abertos de severidade EM_RISCO ou CRITICO" },
    { chave: "inadimplencia", rotulo: "Clientes inadimplentes", disponivel: true, unidade: "quantidade",
      valor: Number(op?.inadimplentes ?? 0), base: "sinais abertos de cobrança" },
  );

  // ─── Indisponíveis, com o motivo ───
  const [cobertura] = await db.execute<Record<string, string>>(sql`
    SELECT
      (SELECT COUNT(*) FROM contratos WHERE status = 'ativo')::text AS contratos_ativos,
      (SELECT COUNT(*) FROM contratos WHERE status = 'ativo' AND vencimento IS NOT NULL)::text AS com_vencimento,
      (SELECT COUNT(*) FROM fulfillments WHERE completed_at IS NOT NULL)::text AS entregas_concluidas,
      (SELECT COUNT(*) FROM fulfillments)::text AS entregas`);

  metricas.push(
    {
      chave: "renewal_rate", rotulo: "Renewal Rate", disponivel: false, valor: null, unidade: "percentual",
      motivoIndisponivel: `Só ${cobertura?.com_vencimento ?? 0} de ${cobertura?.contratos_ativos ?? 0} contratos ativos têm data de vencimento — sem vigência não há renovação para medir`,
    },
    {
      chave: "time_to_value", rotulo: "Time to Value", disponivel: false, valor: null, unidade: "dias",
      motivoIndisponivel: `Nenhuma das ${cobertura?.entregas ?? 0} entregas tem data de conclusão registrada (completed_at)`,
    },
  );

  return metricas;
}
