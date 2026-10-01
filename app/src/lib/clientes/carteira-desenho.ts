import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ROTULO_ETAPA_PIPELINE, type EtapaPipeline } from "@/lib/vendas/dominio";

/* ─────────────────────────────────────────────────────────────────────────
 * A carteira na forma que o desenho de Clientes consome.
 *
 * Arquivo próprio da tela: as CTEs vêm da rota Hono GET /clientes-crm2
 * (api-server/routes/clientes-crm2.ts) — mesma régua de universo, cliente
 * atual, MRR e fatura atrasada — mas sem encostar nela nem em
 * lib/vendas/consultas.ts, que outras frentes editam em paralelo.
 * ───────────────────────────────────────────────────────────────────────── */

export type Produto = "CALLFACE_AI" | "WHITE_LABEL" | "PABX";

export interface ClienteDoDesenho {
  id: string;
  nome: string;
  segmento: string;
  produto: Produto;
  mrr: number;
  saude: number;
  status: string;
  resp: string;
  /** "YYYY-MM", ou "" quando nenhuma fonte tem a data (ver `inicio_fontes`). */
  inicio: string;
  fim: null;
  ultima: string;
}

export interface AtividadeDoDesenho {
  id: string;
  titulo: string;
  tipo: string;
  empresa: string;
  situacao: string;
  resp: string;
  /** "+N HH:MM" / "-N" relativo a hoje, como o desenho parseia; undefined sem prazo. */
  fim?: string;
}

/** Oportunidade aberta ou proposta não final de uma empresa da carteira. */
export interface RelacaoDoDesenho {
  k: "opp" | "proposta";
  empresa: string;
  titulo: string;
  sub: string;
  status: string;
  href: string;
}

/** Reunião agendada de uma empresa da carteira (o drawer ignora as fechadas). */
export interface ReuniaoDoDesenho {
  id: string;
  empresa: string;
  titulo: string;
  /** ISO; o adaptador converte em Date no cliente. */
  data: string;
  pessoa: string;
  resp: string;
  negocioId: string | null;
}

export interface CarteiraDoDesenho {
  clientes: ClienteDoDesenho[];
  atividades: AtividadeDoDesenho[];
  relacoes: RelacaoDoDesenho[];
  agenda: ReuniaoDoDesenho[];
  /** Quantos têm data de início conhecida — vai para as legendas das séries. */
  comInicio: number;
  /** Quantos têm ao menos uma atividade registrada — vai para "sem contato". */
  comAtividade: number;
}

/** O desenho parseia `ultima` com /Há (\d+) dias/ e /^Hoje/ /^Ontem/. */
function ultimaNoFormatoDoDesenho(dias: number | null, hora: string | null): string {
  // Sem atividade registrada fica VAZIO, não "Sem registro": o tile do drawer
  // mostra `ultima || "—"`, e um texto qualquer ali passaria por data.
  if (dias == null) return "";
  if (dias <= 0) return `Hoje, ${hora}`;
  if (dias === 1) return `Ontem, ${hora}`;
  return `Há ${dias} dias`;
}

const TIPO_TAREFA: Record<string, string> = {
  follow_up: "Follow up",
  renovacao: "Renovação",
  onboarding_agendar_reuniao: "Reunião",
  ligacao: "Ligação",
  reuniao: "Reunião",
  email: "E-mail",
  whatsapp: "Mensagem",
};

export async function carteiraParaODesenho(organizacaoId: string): Promise<CarteiraDoDesenho> {
  /* Universo = empresa com serviço no portfólio. As 3 empresas 100% CHURNED
     que a rota Hono inclui para a aba "Cancelados" ficam FORA: a única data
     delas é a da reconciliação (2026-08-16, igual nas três), e o desenho põe
     cliente com `fim` na série temporal — sem data real de saída, entrariam
     num mês falso. */
  const linhas = await db.execute<{
    id: string; nome: string; segmento: string; mrr: number; produto: Produto;
    saude: number | null; faturas_atrasadas: number; resp: string | null;
    inicio: string | null; ult_dias: number | null; ult_hora: string | null;
  }>(sql`
    WITH universo AS (
      SELECT e.id AS empresa_id FROM empresas e
      WHERE e.organizacao_id = ${organizacaoId}
        AND EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)
    ),
    -- clientes não tem unique em empresa_id: 1 linha por empresa, a mais recente.
    cliente_atual AS (
      SELECT DISTINCT ON (empresa_id) * FROM clientes WHERE empresa_id IS NOT NULL
      ORDER BY empresa_id, updated_at DESC NULLS LAST, id DESC
    ),
    -- MRR = servicos_canonicos. Nunca contratos.mrr nem mrr_movimentos: são
    -- outras duas fontes que não batem com esta (a soma de mrr_movimentos dá
    -- 81 mil contra 425 mil daqui).
    servicos_agg AS (
      SELECT sc.empresa_id, SUM(sc.current_recurring_value) AS mrr FROM servicos_canonicos sc
      WHERE sc.portfolio_included = true GROUP BY 1
    ),
    -- O desenho tem UM produto por cliente; a família de maior MRR. Só 2
    -- empresas têm mais de uma família, então o modelo não distorce.
    familia_dominante AS (
      SELECT DISTINCT ON (empresa_id) empresa_id, service_family FROM (
        SELECT sc.empresa_id, sc.service_family, SUM(sc.current_recurring_value) AS v FROM servicos_canonicos sc
        WHERE sc.portfolio_included = true GROUP BY 1, 2) x
      ORDER BY empresa_id, v DESC, service_family
    ),
    -- Relação empresa↔fatura resolvida aqui (COALESCE), nunca com OR no JOIN.
    faturas_agg AS (
      SELECT COALESCE(f.empresa_id, a.empresa_id) AS empresa_id,
        COUNT(*) FILTER (WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now())::int AS n_atrasadas,
        MIN(COALESCE(f.vencimento, f.emitida_em)) AS primeira
      FROM faturas f LEFT JOIN assinaturas a ON a.id = f.assinatura_id GROUP BY 1
    ),
    ultima_atividade_agg AS (
      SELECT l.empresa_id, MAX(at.created_at) AS ultima FROM atividades at JOIN leads l ON l.id = at.lead_id
      WHERE l.empresa_id IS NOT NULL GROUP BY 1
    ),
    health AS (
      SELECT DISTINCT ON (empresa_id) empresa_id, score FROM cs_health_snapshots
      WHERE organizacao_id = ${organizacaoId}
      ORDER BY empresa_id, calculated_at DESC
    ),
    -- "Cliente desde" = a data mais antiga entre as quatro fontes que marcam
    -- começo de relação comercial. servicos_canonicos.created_at e
    -- empresas.created_at ficam de fora de propósito: são data de
    -- reconciliação/import (as 328 linhas de servicos_canonicos têm o mesmo
    -- carimbo de 2026-08-16), não data de cliente.
    inicio_fontes AS (
      SELECT empresa_id, ganho_at AS d FROM negocios WHERE ganho_at IS NOT NULL AND empresa_id IS NOT NULL
      UNION ALL SELECT empresa_id, iniciada_em FROM assinaturas WHERE iniciada_em IS NOT NULL AND empresa_id IS NOT NULL
      UNION ALL SELECT COALESCE(c.empresa_id, l.empresa_id), c.inicio::timestamptz
        FROM contratos c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.inicio IS NOT NULL
      UNION ALL SELECT empresa_id, primeira FROM faturas_agg WHERE primeira IS NOT NULL
    ),
    inicio_agg AS (SELECT empresa_id, MIN(d) AS inicio FROM inicio_fontes WHERE empresa_id IS NOT NULL GROUP BY 1)
    SELECT e.id, e.nome, COALESCE(e.setor, '') AS segmento, sa.mrr::float8 AS mrr, fd.service_family AS produto,
      h.score AS saude, COALESCE(fat.n_atrasadas, 0) AS faturas_atrasadas, uo.nome AS resp,
      to_char(ia.inicio AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS inicio,
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date - (ua.ultima AT TIME ZONE 'America/Sao_Paulo')::date) AS ult_dias,
      to_char(ua.ultima AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS ult_hora
    FROM universo u JOIN empresas e ON e.id = u.empresa_id
    JOIN servicos_agg sa ON sa.empresa_id = e.id
    JOIN familia_dominante fd ON fd.empresa_id = e.id
    LEFT JOIN faturas_agg fat ON fat.empresa_id = e.id
    LEFT JOIN cliente_atual cli ON cli.empresa_id = e.id
    LEFT JOIN usuarios uo ON uo.id = cli.responsavel_id
    LEFT JOIN ultima_atividade_agg ua ON ua.empresa_id = e.id
    LEFT JOIN health h ON h.empresa_id = e.id
    LEFT JOIN inicio_agg ia ON ia.empresa_id = e.id
    ORDER BY sa.mrr DESC
  `);

  const clientes: ClienteDoDesenho[] = linhas.map((r) => ({
    id: r.id,
    nome: r.nome,
    segmento: r.segmento,
    produto: r.produto,
    mrr: Number(r.mrr),
    /* Sem snapshot de saúde, 0 empurraria o cliente para "Em risco" — que
       seria afirmar algo que o dado não diz. Hoje todas as 272 têm snapshot;
       o fallback 70 (limite de "Saudável") é o mais neutro possível e só
       existe para empresa nova ainda não avaliada pelo health engine. */
    saude: r.saude ?? 70,
    /* 'Inativo' e 'Em implantação' são comparados literalmente pelo desenho.
       Nenhum dos dois ocorre (0 fulfillments ativos; churned fora do
       universo). O único sinal de risco real é a fatura vencida: vai no
       texto do status, sem mexer na nota de saúde. */
    status: r.faturas_atrasadas > 0 ? "Ativo · fatura vencida" : "Ativo",
    // clientes.responsavel_id nunca foi populado (0 de 275): fica vazio.
    resp: r.resp ?? "",
    inicio: r.inicio ?? "",
    fim: null,
    ultima: ultimaNoFormatoDoDesenho(r.ult_dias == null ? null : Number(r.ult_dias), r.ult_hora),
  }));

  /* Próximas atividades: tarefa aberta de empresa da carteira. O prazo vem de
     vence_em ou, na falta, de data_vencimento (41 das 42 só têm este). */
  const tarefas = await db.execute<{
    id: string; titulo: string; tipo: string; empresa: string; resp: string | null;
    dias: number | null; hora: string | null;
  }>(sql`
    SELECT t.id, t.titulo, t.tipo, e.nome AS empresa, u.nome AS resp,
      (COALESCE((t.vence_em AT TIME ZONE 'America/Sao_Paulo')::date, t.data_vencimento)
        - (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS dias,
      to_char(t.vence_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS hora
    FROM tarefas t
    LEFT JOIN leads l ON l.id = t.lead_id
    JOIN empresas e ON e.id = COALESCE(t.empresa_id, l.empresa_id)
    LEFT JOIN usuarios u ON u.id = t.usuario_id
    WHERE t.organizacao_id = ${organizacaoId}
      AND t.concluida = false AND t.status NOT IN ('concluida', 'declinada')
      AND EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)
  `);

  const atividades: AtividadeDoDesenho[] = tarefas.map((t) => {
    const d = t.dias == null ? null : Number(t.dias);
    return {
      id: t.id,
      titulo: t.titulo,
      tipo: TIPO_TAREFA[t.tipo] ?? "Tarefa",
      empresa: t.empresa,
      situacao: "A fazer",
      resp: t.resp ?? "",
      fim: d == null ? undefined : `${d >= 0 ? "+" : ""}${d}${t.hora ? ` ${t.hora}` : ""}`,
    };
  });

  /* Relações = mesma régua do Cliente 360 (ClienteProto): oportunidade fora
     de ganho/perdido + proposta fora dos status finais. A proposta chega à
     empresa pela oportunidade. Ficam FORA as 87 propostas sem oportunidade
     (rota aquisicoes.lead_legado_id): todas 'rascunho', de 2024 a jun/2026 —
     rascunho antigo sem processo comercial não é relação aberta. */
  const rel = await db.execute<{
    k: "opp" | "proposta"; empresa: string; titulo: string; etapa: string | null; resp: string | null;
    status: string; numero: number | null; versao: number | null; total: string | null; id: string;
  }>(sql`
    WITH universo AS (
      SELECT DISTINCT sc.empresa_id FROM servicos_canonicos sc JOIN empresas e ON e.id = sc.empresa_id
      WHERE sc.portfolio_included = true AND e.organizacao_id = ${organizacaoId}
    )
    SELECT 'opp' AS k, e.nome AS empresa, o.titulo, o.etapa, u.nome AS resp, NULL AS status,
      NULL::int AS numero, NULL::int AS versao, NULL AS total,
      COALESCE(o.negocio_id_legado, o.id)::text AS id
    FROM oportunidades o JOIN universo un ON un.empresa_id = o.empresa_id
    JOIN empresas e ON e.id = o.empresa_id LEFT JOIN usuarios u ON u.id = o.responsavel_id
    WHERE COALESCE(o.etapa, 'entrada') NOT IN ('ganho', 'perdido')
    UNION ALL
    SELECT 'proposta', e.nome, NULL, NULL, NULL, p.status, p.numero, p.versao, p.total_geral::text, p.id::text
    FROM propostas p JOIN oportunidades o ON o.id = p.oportunidade_id
    JOIN universo un ON un.empresa_id = o.empresa_id JOIN empresas e ON e.id = o.empresa_id
    WHERE p.status NOT IN ('aceita', 'recusada', 'expirada', 'substituida', 'Proposta Ganha')
    ORDER BY 2, 1
  `);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const relacoes: RelacaoDoDesenho[] = rel.map((r) => {
    if (r.k === "opp") {
      const etapa = ROTULO_ETAPA_PIPELINE[(r.etapa ?? "entrada") as EtapaPipeline] ?? r.etapa ?? "";
      return { k: "opp", empresa: r.empresa, titulo: r.titulo ?? "", sub: [etapa, r.resp].filter(Boolean).join(" · "), status: etapa, href: "/pipeline/" + r.id };
    }
    return { k: "proposta", empresa: r.empresa, titulo: "#" + r.numero + " v" + r.versao, sub: r.total != null ? brl(Number(r.total)) : "sem valor", status: r.status, href: "/propostas/" + r.id };
  });

  /* Agenda = reuniões agendadas. Empresa pela mesma cadeia do calendário
     (lead → negócio → lead do negócio), mas só pelo id cadastrado: o drawer
     casa por nome e texto livre de lead não identifica cliente. Data passada
     vira "Atrasada" no próprio desenho (diaDe). */
  const reu = await db.execute<{
    id: string; empresa: string; titulo: string; data: string; pessoa: string | null; resp: string | null; negocio_id: string | null;
  }>(sql`
    SELECT r.id::text, e.nome AS empresa, r.titulo, to_char(r.data AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS data,
      COALESCE(l.nome, ln.nome) AS pessoa, u.nome AS resp, r.negocio_id::text
    FROM reunioes r
    LEFT JOIN leads l ON l.id = r.lead_id
    LEFT JOIN negocios n ON n.id = r.negocio_id
    LEFT JOIN leads ln ON ln.id = n.lead_id
    JOIN empresas e ON e.id = COALESCE(l.empresa_id, n.empresa_id, ln.empresa_id)
    LEFT JOIN usuarios u ON u.id = r.responsavel_id
    WHERE r.organizacao_id = ${organizacaoId} AND r.status = 'agendada'
      AND EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)
    ORDER BY r.data
  `);
  const agenda: ReuniaoDoDesenho[] = reu.map((r) => ({
    id: r.id, empresa: r.empresa, titulo: r.titulo, data: r.data,
    pessoa: r.pessoa ?? "", resp: r.resp ?? "", negocioId: r.negocio_id,
  }));

  return {
    clientes,
    atividades,
    relacoes,
    agenda,
    comInicio: clientes.filter((c) => c.inicio).length,
    comAtividade: clientes.filter((c) => c.ultima).length,
  };
}
