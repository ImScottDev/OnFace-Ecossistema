import { sql } from "drizzle-orm";
import { nomeEmpresaSql } from "@/lib/vendas/texto";
import { db } from "@/lib/db";
import { faturamentoMensal, type FaturamentoMes } from "@/lib/financeiro/faturamento-mensal";
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
  /** Faturamento mensal por natureza (cliente_receita_mensal), 12 meses até a última competência. */
  faturamento: FaturamentoMes[];
  /** Usuários ativos da org: destino da reatribuição em massa (E3). */
  equipe: { id: string; nome: string }[];
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
    saude: number | null; faturas_atrasadas: number; resp: string | null; cancelado: boolean | null;
    inicio: string | null; ult_dias: number | null; ult_hora: string | null;
  }>(sql`
    WITH universo AS (
      SELECT e.id AS empresa_id FROM empresas e
      WHERE e.organizacao_id = ${organizacaoId}
        -- Entra na carteira quem TEM serviço no portfólio OU quem FATUROU no
        -- último mês. Antes era só a primeira condição, e por isso cliente que
        -- paga todo mês mas não tem serviço canônico não aparecia em lugar
        -- nenhum — em setembro/2026 eram 38 empresas, R$ 20.813. Quem paga é
        -- cliente, independentemente de o cadastro canônico ter sido feito.
        AND (
          -- E14: cancelado (clientes.status_financeiro = 'churned') entra para
          -- a aba Cancelados do desenho voltar; antes sumia da carteira.
          EXISTS (SELECT 1 FROM clientes cc WHERE cc.empresa_id = e.id
                   AND cc.organizacao_id = ${organizacaoId} AND cc.status_financeiro = 'churned')
          OR EXISTS (SELECT 1 FROM servicos_canonicos sc
                   WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)
          OR EXISTS (SELECT 1 FROM cliente_receita_mensal r
                      WHERE r.empresa_id = e.id
                        AND r.organizacao_id = ${organizacaoId}
                        AND r.competencia = (SELECT max(competencia) FROM cliente_receita_mensal
                                              WHERE organizacao_id = ${organizacaoId}))
        )
    ),
    -- clientes não tem unique em empresa_id: 1 linha por empresa, a mais recente.
    cliente_atual AS (
      SELECT DISTINCT ON (empresa_id) * FROM clientes WHERE empresa_id IS NOT NULL
      ORDER BY empresa_id, updated_at DESC NULLS LAST, id DESC
    ),
    -- RECEITA = o que foi REALMENTE faturado no último mês fechado, de
    -- cliente_receita_mensal.
    --
    -- Era SUM(servicos_canonicos.current_recurring_value), que é MRR
    -- contratado, não faturamento. Os dois números não batem e a diferença não
    -- é arredondamento: em setembro/2026 o canônico somava R$ 426.619,39 contra
    -- R$ 512.404,49 efetivamente faturados. R$ 20.813 são 38 clientes que
    -- faturam e não têm serviço canônico; os outros R$ 64.972 são clientes COM
    -- serviço cujo current_recurring_value ficou defasado em relação ao que a
    -- Callface cobrou — o campo veio do legado e nunca foi reconciliado.
    --
    -- Decisão do Scott (05/10): a carteira mostra o FATURADO, não o MRR. O
    -- número da tela tem que ser o mesmo que ele confere na planilha do mês.
    -- MRR contratado continua existindo em servicos_canonicos para quem
    -- precisar da leitura de recorrência; só deixa de ser o número da carteira.
    ultima_competencia AS (
      SELECT max(competencia) AS competencia FROM cliente_receita_mensal
       WHERE organizacao_id = ${organizacaoId}
    ),
    servicos_agg AS (
      SELECT r.empresa_id, SUM(r.valor) AS mrr
        FROM cliente_receita_mensal r, ultima_competencia uc
       WHERE r.organizacao_id = ${organizacaoId}
         AND r.competencia = uc.competencia
         AND r.empresa_id IS NOT NULL
         -- Só natureza MRR: é a mesma regra do MRR do topo da tela. Somar tudo
         -- (setup 29.990 + débito recuperado 6.000) fazia "Por produto" fechar
         -- em R$ 503,1 mil contra R$ 476,4 mil de MRR no topo, e jogava o setup
         -- White Label da Helbor na conta de Callface AI.
         AND r.revenue_nature = 'MRR'
       GROUP BY 1
      UNION ALL
      -- Regra do Scott (06/10): cliente = faturado no fechamento + venda nova
      -- DEPOIS dele. Quem assinou depois do fechamento ainda não tem linha no
      -- faturamento e aparecia na carteira com MRR R$ 0 (5 clientes, R$ 1.599
      -- no dia da virada). Até a próxima competência fechar, o MRR dele é o da
      -- assinatura ativa. A mesma regra está em mrr_atual (lib/metricas/catalogo.ts).
      SELECT a.empresa_id, SUM(a.mrr)
        FROM assinaturas a
       WHERE a.organizacao_id = ${organizacaoId}
         AND a.status = 'active' AND a.empresa_id IS NOT NULL
         AND a.empresa_id IN (SELECT empresa_id FROM clientes WHERE organizacao_id = ${organizacaoId})
         AND NOT EXISTS (
           SELECT 1 FROM cliente_receita_mensal r2, ultima_competencia uc2
            WHERE r2.organizacao_id = ${organizacaoId} AND r2.empresa_id = a.empresa_id
              AND r2.competencia = uc2.competencia AND r2.revenue_nature = 'MRR')
       GROUP BY 1
    ),
    -- O desenho tem UM produto por cliente; a família de maior MRR. Só 2
    -- empresas têm mais de uma família, então o modelo não distorce.
    --
    -- SEM filtro de portfólio aqui: a CTE só serve para dar NOME ao produto,
    -- e filtrar por portfolio_included fazia esta consulta decidir QUEM é
    -- cliente — anulando o OR de universo (ver o JOIN la embaixo). Os 70
    -- clientes que faturam sem serviço no portfólio têm serviço canônico
    -- fora dele, e é de lá que sai a família. UNKNOWN fica de fora porque
    -- não é família: é ausência de classificação, e o desenho a mostraria
    -- como produto. Medido em 05/10: 342 de 342 ficam com família real.
    familia_dominante AS (
      SELECT DISTINCT ON (empresa_id) empresa_id, service_family FROM (
        -- 1) família do que foi FATURADO como MRR no último mês: é a mesma
        --    fonte do número, então Matte e G30 (MRR White Label) contam como
        --    White Label mesmo com serviço canônico de valor 0. prio 1 vence.
        SELECT r.empresa_id, r.service_family, SUM(r.valor) AS v, 1 AS prio
          FROM cliente_receita_mensal r, ultima_competencia uc
         WHERE r.organizacao_id = ${organizacaoId} AND r.competencia = uc.competencia
           AND r.revenue_nature = 'MRR' AND r.empresa_id IS NOT NULL
           AND r.service_family <> 'UNKNOWN' GROUP BY 1, 2
        UNION ALL
        -- 2) sem MRR classificado no mês: cai no serviço canônico (regra antiga).
        SELECT sc.empresa_id, sc.service_family, SUM(sc.current_recurring_value) AS v, 2 AS prio FROM servicos_canonicos sc
        WHERE sc.empresa_id IS NOT NULL AND sc.service_family IS NOT NULL
          AND sc.service_family <> 'UNKNOWN' GROUP BY 1, 2) x
      ORDER BY empresa_id, prio, v DESC, service_family
    ),
    -- Relação empresa↔fatura resolvida aqui (COALESCE), nunca com OR no JOIN.
    faturas_agg AS (
      SELECT COALESCE(f.empresa_id, a.empresa_id) AS empresa_id,
        COUNT(*) FILTER (WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now())::int AS n_atrasadas,
        MIN(COALESCE(f.vencimento, f.emitida_em)) AS primeira
      FROM faturas f LEFT JOIN assinaturas a ON a.id = f.assinatura_id GROUP BY 1
    ),
    ultima_atividade_agg AS (
      -- Mesma regra do CS (lib/cs/tela-cs.ts): atividade da EMPRESA ou do lead dela. Só pelo lead,
      -- a atividade registrada direto na conta (ex.: "Nova atividade" do Cliente 360) não contava
      -- e a Carteira e o CS discordavam de quem está "sem contato".
      SELECT COALESCE(at.empresa_id, l.empresa_id) AS empresa_id, MAX(at.created_at) AS ultima
        FROM atividades at LEFT JOIN leads l ON l.id = at.lead_id
       WHERE COALESCE(at.empresa_id, l.empresa_id) IS NOT NULL GROUP BY 1
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
    -- Os dois JOINs abaixo eram INNER e desfaziam o universo acima em
    -- silêncio. Medido no banco do ensaio (05/10, competência 2026-09):
    --   universo declarado .................... 342 empresas
    --   render com os INNER ................... 216 empresas · R$ 393.546,53
    --   faturam e não têm serviço de portfólio . 70 empresas · R$  98.044,96
    --     (caíam no INNER de familia_dominante, que filtrava portfólio)
    --   têm portfólio e não faturaram no mês ... 56 empresas · R$       0,00
    --     (caíam no INNER de servicos_agg)
    -- A carteira mostrava R$ 118.857,96 a menos que a planilha de setembro
    -- (R$ 512.404,49) — e a decisão registrada neste arquivo é justamente
    -- que o número da tela tem que ser o que o Scott confere na planilha.
    -- LEFT em ambos: cliente sem receita no mês aparece com R$ 0 (que é o
    -- fato), e cliente sem família aparece sem produto, em vez de sumir.
    -- O que resta fora é o que NÃO tem dono: 38 linhas / R$ 20.813,00 com
    -- empresa_id nulo em cliente_receita_mensal — receita não atribuída a
    -- empresa nenhuma, que não dá para pôr em cliente nenhum sem inventar.
    SELECT e.id, ${nomeEmpresaSql("e.nome")} AS nome, COALESCE(e.setor, '') AS segmento,
      COALESCE(sa.mrr, 0)::float8 AS mrr, fd.service_family AS produto,
      h.score AS saude, COALESCE(fat.n_atrasadas, 0) AS faturas_atrasadas, uo.nome AS resp,
      (cli.status_financeiro = 'churned') AS cancelado,
      to_char(ia.inicio AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS inicio,
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date - (ua.ultima AT TIME ZONE 'America/Sao_Paulo')::date) AS ult_dias,
      to_char(ua.ultima AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS ult_hora
    FROM universo u JOIN empresas e ON e.id = u.empresa_id
    LEFT JOIN servicos_agg sa ON sa.empresa_id = e.id
    LEFT JOIN familia_dominante fd ON fd.empresa_id = e.id
    LEFT JOIN faturas_agg fat ON fat.empresa_id = e.id
    LEFT JOIN cliente_atual cli ON cli.empresa_id = e.id
    LEFT JOIN usuarios uo ON uo.id = cli.responsavel_id
    LEFT JOIN ultima_atividade_agg ua ON ua.empresa_id = e.id
    LEFT JOIN health h ON h.empresa_id = e.id
    LEFT JOIN inicio_agg ia ON ia.empresa_id = e.id
    ORDER BY COALESCE(sa.mrr, 0) DESC, e.nome
  `);

  const clientes: ClienteDoDesenho[] = linhas.map((r) => ({
    id: r.id,
    nome: r.nome,
    segmento: r.segmento,
    produto: r.produto,
    mrr: Number(r.mrr),
    /* Sem snapshot de saúde, 0 empurraria o cliente para "Em risco" — que
       seria afirmar algo que o dado não diz. O fallback 70 (limite de
       "Saudável") é o mais neutro possível.
       ATENÇÃO (medido 05/10 no banco da virada): `cs_health_snapshots` está
       VAZIA — 0 linhas. Então TODA a carteira cai no fallback e a coluna
       Saúde não diz nada hoje. Não é bug desta consulta: o health engine
       nunca rodou sobre a base carregada. Enquanto não rodar, 70 é o único
       valor honesto; quando rodar, esta linha volta a ser exceção. */
    saude: r.saude ?? 70,
    /* 'Inativo' e 'Em implantação' são comparados literalmente pelo desenho.
       Nenhum dos dois ocorre (0 fulfillments ativos; churned fora do
       universo). O único sinal de risco real é a fatura vencida: vai no
       texto do status, sem mexer na nota de saúde. */
    // 'Inativo' é o rótulo que o desenho usa na aba Cancelados (E14).
    status: r.cancelado ? "Inativo" : r.faturas_atrasadas > 0 ? "Ativo · fatura vencida" : "Ativo",
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
    SELECT t.id, t.titulo, t.tipo, ${nomeEmpresaSql("e.nome")} AS empresa, u.nome AS resp,
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
    SELECT 'opp' AS k, ${nomeEmpresaSql("e.nome")} AS empresa, o.titulo, o.etapa, u.nome AS resp, NULL AS status,
      NULL::int AS numero, NULL::int AS versao, NULL AS total,
      COALESCE(o.negocio_id_legado, o.id)::text AS id
    FROM oportunidades o JOIN universo un ON un.empresa_id = o.empresa_id
    JOIN empresas e ON e.id = o.empresa_id LEFT JOIN usuarios u ON u.id = o.responsavel_id
    WHERE COALESCE(o.etapa, 'entrada') NOT IN ('ganho', 'perdido')
      AND COALESCE(o.stage, '') <> 'ativo' -- E4: cópia de carteira não é oportunidade aberta
    UNION ALL
    SELECT 'proposta', ${nomeEmpresaSql("e.nome")}, NULL, NULL, NULL, p.status, p.numero, p.versao, p.total_geral::text, p.id::text
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
    SELECT r.id::text, ${nomeEmpresaSql("e.nome")} AS empresa, r.titulo, to_char(r.data AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS data,
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
    faturamento: await faturamentoMensal(organizacaoId),
    equipe: [...await db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${organizacaoId}::uuid AND ativo ORDER BY nome`)],
  };
}
