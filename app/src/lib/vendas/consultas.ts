/**
 * Leitura do Módulo Vendas.
 *
 * As telas não montam SQL: elas pedem o que precisam aqui. Isso mantém a
 * tradução do legado num lugar só e garante que board, detalhe e relatório
 * contem a mesma história.
 *
 * Duas regras que se repetem em todas as consultas:
 *   - **Empresa-first** (Bloco 01 §5, Bloco 04 §4): o card mostra a Empresa
 *     como protagonista e a Pessoa como o contato através do qual se trabalha.
 *   - **Contador de resumo nunca sai de lista truncada**: os totais vêm de
 *     `count()` sobre a tabela inteira, não do array que a página carregou.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ROTULO_ETAPA_PIPELINE, ROTULO_ETAPA_PRE_VENDAS, ROTULO_FAMILIA,
  ROTULO_ESTADO_PROSPECCAO, ROTULO_RELACIONAMENTO,
  ETAPAS_PIPELINE, ETAPAS_PRE_VENDAS, ESTADOS_PROSPECCAO,
  type EstadoProspeccao, type EstagioPreVendas, type EtapaPipeline,
  type RelacionamentoEmpresa,
} from "./dominio";

const LIMITE_PADRAO = 400;

/**
 * Lista de chaves como literal de array do Postgres.
 *
 * `= ANY(${array})` não funciona: o template do Drizzle espalha o array em um
 * parâmetro por item, e o Postgres recebe `ANY($2, $3, ...)`, que não é array.
 * Passar o literal como UM parâmetro de texto e deixar o Postgres fazer o cast
 * resolve. As chaves vêm sempre de constantes do domínio, nunca do usuário.
 */
function literalDeArray(valores: readonly string[]): string {
  return `{${valores.join(",")}}`;
}

/* ── Pré-vendas ────────────────────────────────────────────────────────── */

export interface CardPreVendas {
  leadId: string;
  /** Protagonista do card. */
  empresa: string;
  empresaId: string | null;
  /** Contato através do qual se trabalha a empresa. */
  pessoa: string | null;
  cargo: string | null;
  etapa: EstagioPreVendas;
  origem: string | null;
  campanha: string | null;
  servicos: string[] | null;
  responsavel: string | null;
  responsavelIniciais: string | null;
  /** Fato histórico, não posição no board (Bloco 01 §10). */
  qualificado: boolean;
  preQualificado: boolean;
  temWhatsapp: boolean;
  temEmail: boolean;
  temTelefone: boolean;
  /** Horas desde a última interação: é daqui que sai o sinal de SLA. */
  horasSemInteracao: number | null;
  horasNaEtapa: number | null;
  criadoEm: string;
  nutricaoRetomarEm: string | null;
  desqualificacaoMotivo: string | null;
  /** Quando o lead já concluiu o handoff, para onde ele leva. */
  oportunidadeId: string | null;
}

export interface FiltrosPreVendas {
  busca?: string | null;
  responsavelId?: string | null;
  origem?: string | null;
  campanha?: string | null;
  servico?: string | null;
  /** "ativos" | "nutricao" | "desqualificados" (Bloco 01 §22). */
  aba?: "ativos" | "nutricao" | "desqualificados";
  desde?: string | null;
}

export interface BoardPreVendas {
  colunas: Array<{ chave: EstagioPreVendas; rotulo: string; total: number; cards: CardPreVendas[] }>;
  resumo: { ativos: number; nutricao: number; desqualificados: number; semResponsavel: number; semPrimeiroContato: number };
  filtros: { responsaveis: Array<{ id: string; nome: string }>; origens: string[]; campanhas: string[] };
}

export async function boardPreVendas(organizacaoId: string, filtros: FiltrosPreVendas = {}): Promise<BoardPreVendas> {
  const aba = filtros.aba ?? "ativos";
  const etapasDaAba: EstagioPreVendas[] = aba === "ativos"
    ? [...ETAPAS_PRE_VENDAS]
    : aba === "nutricao" ? ["nutricao"] : ["desqualificado"];

  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<{
    lead_id: string; empresa: string | null; empresa_id: string | null;
    pessoa: string | null; cargo: string | null; etapa: string;
    origem: string | null; campanha: string | null; servicos: string[] | null;
    responsavel: string | null; qualificado: boolean; pre_qualificado: boolean;
    whatsapp: string | null; email: string | null; telefone: string | null;
    ultima_interacao: string | null; etapa_desde: string | null; criado_em: string;
    nutricao_retomar_em: string | null; desqualificacao_motivo: string | null;
    oportunidade_id: string | null;
  }>(sql`
    SELECT l.id::text AS lead_id,
           COALESCE(e.nome, l.empresa) AS empresa,
           l.empresa_id::text,
           NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS pessoa,
           l.cargo, l.estagio_pre_vendas AS etapa,
           l.origem, l.utm_campaign AS campanha, l.servicos_interesse AS servicos,
           u.nome AS responsavel, l.qualificado, l.pre_qualificado,
           l.whatsapp, l.email, l.telefone,
           GREATEST(COALESCE(l.last_contact_at, l.created_at), l.created_at)::text AS ultima_interacao,
           COALESCE(l.contato_desde_at, l.created_at)::text AS etapa_desde,
           l.created_at::text AS criado_em,
           l.nutricao_retomar_em::text,
           l.desqualificacao_motivo,
           l.negocio_ativo_id::text AS oportunidade_id
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
      LEFT JOIN usuarios u ON u.id = l.responsavel_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND l.estagio_pre_vendas = ANY(${literalDeArray(etapasDaAba)}::text[])
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR l.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.origem ?? null}::text IS NULL OR l.origem = ${filtros.origem ?? null})
       AND (${filtros.campanha ?? null}::text IS NULL OR l.utm_campaign = ${filtros.campanha ?? null})
       AND (${filtros.servico ?? null}::text IS NULL OR ${filtros.servico ?? null} = ANY(l.servicos_interesse))
       AND (${filtros.desde ?? null}::date IS NULL OR l.created_at >= ${filtros.desde ?? null}::date)
       AND (${busca}::text IS NULL OR
            lower(COALESCE(e.nome, l.empresa, '')) LIKE ${busca} OR
            lower(concat_ws(' ', l.nome, l.sobrenome)) LIKE ${busca} OR
            lower(COALESCE(l.email, '')) LIKE ${busca})
     ORDER BY l.updated_at DESC
     LIMIT ${LIMITE_PADRAO}
  `);

  const agora = Date.now();
  const horasDesde = (iso: string | null) =>
    iso ? Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 3_600_000)) : null;

  const cards: CardPreVendas[] = linhas.map((l) => ({
    leadId: l.lead_id,
    empresa: l.empresa?.trim() || "Empresa não informada",
    empresaId: l.empresa_id,
    pessoa: l.pessoa,
    cargo: l.cargo,
    etapa: l.etapa as EstagioPreVendas,
    origem: l.origem,
    campanha: l.campanha,
    servicos: l.servicos,
    responsavel: l.responsavel,
    responsavelIniciais: iniciais(l.responsavel),
    qualificado: l.qualificado,
    preQualificado: l.pre_qualificado,
    temWhatsapp: Boolean(l.whatsapp || l.telefone),
    temEmail: Boolean(l.email),
    temTelefone: Boolean(l.telefone),
    horasSemInteracao: horasDesde(l.ultima_interacao),
    horasNaEtapa: horasDesde(l.etapa_desde),
    criadoEm: l.criado_em,
    nutricaoRetomarEm: l.nutricao_retomar_em,
    desqualificacaoMotivo: l.desqualificacao_motivo,
    oportunidadeId: l.oportunidade_id,
  }));

  // O total de cada coluna vem do banco, não do array carregado: com o limite
  // de 400 cards, contar a página faria a coluna dizer 17 onde há 200.
  const totaisPorEtapa = await db.execute<{ etapa: string; n: number }>(sql`
    SELECT estagio_pre_vendas AS etapa, count(*)::int AS n FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND l.estagio_pre_vendas = ANY(${literalDeArray(etapasDaAba)}::text[])
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR l.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.origem ?? null}::text IS NULL OR l.origem = ${filtros.origem ?? null})
       AND (${filtros.campanha ?? null}::text IS NULL OR l.utm_campaign = ${filtros.campanha ?? null})
       AND (${filtros.servico ?? null}::text IS NULL OR ${filtros.servico ?? null} = ANY(l.servicos_interesse))
       AND (${filtros.desde ?? null}::date IS NULL OR l.created_at >= ${filtros.desde ?? null}::date)
       AND (${busca}::text IS NULL OR
            lower(COALESCE(e.nome, l.empresa, '')) LIKE ${busca} OR
            lower(concat_ws(' ', l.nome, l.sobrenome)) LIKE ${busca} OR
            lower(COALESCE(l.email, '')) LIKE ${busca})
     GROUP BY 1
  `);
  const totalDaEtapa = new Map(totaisPorEtapa.map((t) => [t.etapa, t.n]));

  const colunas = (aba === "ativos" ? [...ETAPAS_PRE_VENDAS] : etapasDaAba).map((chave) => {
    const daColuna = cards.filter((c) => c.etapa === chave);
    return {
      chave, rotulo: ROTULO_ETAPA_PRE_VENDAS[chave],
      total: totalDaEtapa.get(chave) ?? daColuna.length,
      cards: daColuna,
    };
  });

  // Resumo sobre a tabela inteira: um contador calculado da página carregada
  // mente assim que a lista passa do limite.
  const [resumo] = await db.execute<{
    ativos: number; nutricao: number; desqualificados: number;
    sem_responsavel: number; sem_primeiro_contato: number;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado','oportunidade'))::int AS ativos,
      count(*) FILTER (WHERE estagio_pre_vendas = 'nutricao')::int AS nutricao,
      count(*) FILTER (WHERE estagio_pre_vendas = 'desqualificado')::int AS desqualificados,
      count(*) FILTER (WHERE estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado') AND responsavel_id IS NULL)::int AS sem_responsavel,
      count(*) FILTER (WHERE estagio_pre_vendas IN ('novo','em_contato') AND primeiro_contato_at IS NULL)::int AS sem_primeiro_contato
      FROM leads WHERE organizacao_id = ${organizacaoId}::uuid AND estagio_pre_vendas IS NOT NULL
  `);

  const responsaveis = await db.execute<{ id: string; nome: string }>(sql`
    SELECT DISTINCT u.id::text, u.nome FROM usuarios u
     WHERE u.organizacao_id = ${organizacaoId}::uuid AND u.ativo = true ORDER BY u.nome
  `);
  const origens = await db.execute<{ origem: string }>(sql`
    SELECT DISTINCT origem FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid AND estagio_pre_vendas IS NOT NULL AND origem IS NOT NULL
     ORDER BY origem LIMIT 40
  `);
  const campanhas = await db.execute<{ campanha: string }>(sql`
    SELECT DISTINCT utm_campaign AS campanha FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid AND estagio_pre_vendas IS NOT NULL AND utm_campaign IS NOT NULL
     ORDER BY utm_campaign LIMIT 40
  `);

  return {
    colunas,
    resumo: {
      ativos: resumo?.ativos ?? 0,
      nutricao: resumo?.nutricao ?? 0,
      desqualificados: resumo?.desqualificados ?? 0,
      semResponsavel: resumo?.sem_responsavel ?? 0,
      semPrimeiroContato: resumo?.sem_primeiro_contato ?? 0,
    },
    filtros: {
      responsaveis: responsaveis.map((r) => ({ id: r.id, nome: r.nome })),
      origens: origens.map((o) => o.origem),
      campanhas: campanhas.map((c) => c.campanha),
    },
  };
}

/* ── Pipeline ──────────────────────────────────────────────────────────── */

export interface CardPipeline {
  id: string;
  empresa: string;
  empresaId: string | null;
  titulo: string;
  familia: string | null;
  familiaRotulo: string;
  etapa: EtapaPipeline;
  /** Bloco 02 §14: o card mostra VALOR, não MRR. */
  valor: number | null;
  responsavel: string | null;
  responsavelIniciais: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  diasNaEtapa: number | null;
  /** Badges contextuais (Bloco 02 §26). Badge nunca vira coluna. */
  badges: string[];
  leadId: string | null;
  bundleId: string | null;
  propostas: number;
  motivoPerda: string | null;
}

export interface FiltrosPipeline {
  busca?: string | null;
  responsavelId?: string | null;
  familia?: string | null;
  aba?: "abertas" | "ganhas" | "perdidas";
  motion?: string | null;
}

export interface BoardPipeline {
  colunas: Array<{ chave: EtapaPipeline; rotulo: string; total: number; valorTotal: number; cards: CardPipeline[] }>;
  resumo: { abertas: number; ganhas: number; perdidas: number; semProximaAcao: number; valorEmAberto: number };
  filtros: { responsaveis: Array<{ id: string; nome: string }>; familias: string[] };
}

export async function boardPipeline(organizacaoId: string, filtros: FiltrosPipeline = {}): Promise<BoardPipeline> {
  const aba = filtros.aba ?? "abertas";
  const etapas: EtapaPipeline[] = aba === "abertas" ? [...ETAPAS_PIPELINE] : aba === "ganhas" ? ["ganho"] : ["perdido"];
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<{
    id: string; empresa: string | null; empresa_id: string | null; titulo: string;
    familia: string | null; etapa: string; valor: string | null;
    responsavel: string | null; proxima_acao: string | null; proxima_acao_em: string | null;
    etapa_desde: string | null; no_show_em: string | null; trial_iniciado_em: string | null;
    trial_encerrado_em: string | null; motivo_estagnacao: string | null;
    lead_id: string | null; bundle_id: string | null; propostas: number;
    proposta_aberta: number; proposta_aceita: number; motivo_perda: string | null;
  }>(sql`
    SELECT n.id::text, COALESCE(e.nome, l.empresa) AS empresa, n.empresa_id::text,
           n.titulo, n.service_family AS familia, n.etapa,
           n.valor_total::text AS valor, u.nome AS responsavel,
           n.proxima_acao, n.proxima_acao_em::text, n.etapa_desde::text,
           n.no_show_em::text, n.trial_iniciado_em::text, n.trial_encerrado_em::text,
           n.motivo_estagnacao, n.lead_id::text, n.bundle_id::text,
           (SELECT count(*)::int FROM propostas p WHERE p.negocio_id = n.id) AS propostas,
           (SELECT count(*)::int FROM propostas p WHERE p.negocio_id = n.id
             AND p.status IN ('enviada','visualizada','ajuste_solicitado')) AS proposta_aberta,
           (SELECT count(*)::int FROM propostas p WHERE p.negocio_id = n.id AND p.status = 'aceita') AS proposta_aceita,
           n.motivo_perda_chave AS motivo_perda
      FROM negocios n
      LEFT JOIN empresas e ON e.id = n.empresa_id
      LEFT JOIN leads l ON l.id = n.lead_id
      LEFT JOIN usuarios u ON u.id = n.responsavel_id
     WHERE n.organizacao_id = ${organizacaoId}::uuid
       AND n.etapa = ANY(${literalDeArray(etapas)}::text[])
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR n.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.familia ?? null}::text IS NULL OR n.service_family = ${filtros.familia ?? null})
       AND (${filtros.motion ?? null}::text IS NULL OR n.commercial_motion = ${filtros.motion ?? null})
       AND (${busca}::text IS NULL OR lower(n.titulo) LIKE ${busca} OR lower(COALESCE(e.nome, '')) LIKE ${busca})
     ORDER BY n.etapa_desde DESC NULLS LAST
     LIMIT ${LIMITE_PADRAO}
  `);

  const agora = Date.now();
  const cards: CardPipeline[] = linhas.map((l) => {
    const badges: string[] = [];
    if (l.no_show_em) badges.push("No-show");
    if (l.trial_iniciado_em && !l.trial_encerrado_em) badges.push("Trial ativo");
    if (l.proposta_aceita > 0) badges.push("Proposta aceita");
    else if (l.proposta_aberta > 0) badges.push("Proposta aberta");
    if (l.motivo_estagnacao) badges.push(rotuloEstagnacao(l.motivo_estagnacao));
    if (!l.proxima_acao && l.etapa !== "ganho" && l.etapa !== "perdido") badges.push("Sem próxima ação");
    else if (l.proxima_acao_em && new Date(l.proxima_acao_em).getTime() < agora) badges.push("Atrasado");

    return {
      id: l.id,
      empresa: l.empresa?.trim() || "Empresa não informada",
      empresaId: l.empresa_id,
      titulo: l.titulo,
      familia: l.familia,
      familiaRotulo: ROTULO_FAMILIA[(l.familia ?? "UNKNOWN") as keyof typeof ROTULO_FAMILIA] ?? l.familia ?? "Não classificada",
      etapa: l.etapa as EtapaPipeline,
      valor: l.valor === null ? null : Number(l.valor),
      responsavel: l.responsavel,
      responsavelIniciais: iniciais(l.responsavel),
      proximaAcao: l.proxima_acao,
      proximaAcaoEm: l.proxima_acao_em,
      diasNaEtapa: l.etapa_desde
        ? Math.max(0, Math.floor((agora - new Date(l.etapa_desde).getTime()) / 86_400_000))
        : null,
      badges,
      leadId: l.lead_id,
      bundleId: l.bundle_id,
      propostas: l.propostas,
      motivoPerda: l.motivo_perda,
    };
  });

  // Mesma regra do board de Pré-vendas: total e valor da coluna vêm do banco.
  // Somar só os cards carregados subestimaria o pipeline inteiro.
  const totaisPorEtapa = await db.execute<{ etapa: string; n: number; valor: string | null }>(sql`
    SELECT n.etapa, count(*)::int AS n, COALESCE(SUM(n.valor_total), 0)::text AS valor
      FROM negocios n
      LEFT JOIN empresas e ON e.id = n.empresa_id
     WHERE n.organizacao_id = ${organizacaoId}::uuid
       AND n.etapa = ANY(${literalDeArray(etapas)}::text[])
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR n.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.familia ?? null}::text IS NULL OR n.service_family = ${filtros.familia ?? null})
       AND (${filtros.motion ?? null}::text IS NULL OR n.commercial_motion = ${filtros.motion ?? null})
       AND (${busca}::text IS NULL OR lower(n.titulo) LIKE ${busca} OR lower(COALESCE(e.nome, '')) LIKE ${busca})
     GROUP BY 1
  `);
  const totalDaEtapa = new Map(totaisPorEtapa.map((t) => [t.etapa, { n: t.n, valor: Number(t.valor ?? 0) }]));

  const colunas = etapas.map((chave) => {
    const daColuna = cards.filter((c) => c.etapa === chave);
    const agregado = totalDaEtapa.get(chave);
    return {
      chave, rotulo: ROTULO_ETAPA_PIPELINE[chave],
      total: agregado?.n ?? daColuna.length,
      valorTotal: agregado?.valor ?? daColuna.reduce((soma, c) => soma + (c.valor ?? 0), 0),
      cards: daColuna,
    };
  });

  const [resumo] = await db.execute<{
    abertas: number; ganhas: number; perdidas: number; sem_proxima: number; valor_aberto: string | null;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE etapa IN ('entrada','diagnostico','proposta','negociacao'))::int AS abertas,
      count(*) FILTER (WHERE etapa = 'ganho')::int AS ganhas,
      count(*) FILTER (WHERE etapa = 'perdido')::int AS perdidas,
      count(*) FILTER (WHERE etapa IN ('entrada','diagnostico','proposta','negociacao') AND proxima_acao IS NULL)::int AS sem_proxima,
      COALESCE(SUM(valor_total) FILTER (WHERE etapa IN ('entrada','diagnostico','proposta','negociacao')), 0)::text AS valor_aberto
      FROM negocios WHERE organizacao_id = ${organizacaoId}::uuid
  `);

  const responsaveis = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true ORDER BY nome
  `);
  const familias = await db.execute<{ familia: string }>(sql`
    SELECT DISTINCT service_family AS familia FROM negocios
     WHERE organizacao_id = ${organizacaoId}::uuid AND service_family IS NOT NULL ORDER BY 1
  `);

  return {
    colunas,
    resumo: {
      abertas: resumo?.abertas ?? 0,
      ganhas: resumo?.ganhas ?? 0,
      perdidas: resumo?.perdidas ?? 0,
      semProximaAcao: resumo?.sem_proxima ?? 0,
      valorEmAberto: Number(resumo?.valor_aberto ?? 0),
    },
    filtros: {
      responsaveis: responsaveis.map((r) => ({ id: r.id, nome: r.nome })),
      familias: familias.map((f) => f.familia),
    },
  };
}

function rotuloEstagnacao(chave: string): string {
  switch (chave) {
    case "sem_retorno": return "Sem retorno";
    case "trava_negociacao": return "Trava na negociação";
    case "trava_assinatura": return "Trava na assinatura";
    case "outra_data": return "Outra data";
    default: return chave;
  }
}

/* ── Prospecção ────────────────────────────────────────────────────────── */

export interface LinhaProspeccao {
  leadId: string;
  empresa: string;
  empresaId: string | null;
  pessoa: string | null;
  cargo: string | null;
  setor: string | null;
  porte: string | null;
  estado: EstadoProspeccao;
  estadoRotulo: string;
  responsavel: string | null;
  lista: string | null;
  cadencia: string | null;
  passoAtual: number | null;
  totalPassos: number | null;
  proximaAcaoEm: string | null;
  preQualificado: boolean;
  descarteMotivo: string | null;
  criadoEm: string;
}

export interface FiltrosProspeccao {
  busca?: string | null;
  responsavelId?: string | null;
  estado?: EstadoProspeccao | null;
  lista?: string | null;
}

export async function listaProspeccao(organizacaoId: string, filtros: FiltrosProspeccao = {}): Promise<{
  linhas: LinhaProspeccao[];
  resumo: Record<EstadoProspeccao, number>;
  filtros: { responsaveis: Array<{ id: string; nome: string }>; listas: string[] };
}> {
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<{
    lead_id: string; empresa: string | null; empresa_id: string | null;
    pessoa: string | null; cargo: string | null; setor: string | null; porte: string | null;
    estado: string; responsavel: string | null; lista: string | null;
    cadencia: string | null; passo: string | null; total_passos: number | null;
    proxima_acao_em: string | null; pre_qualificado: boolean;
    descarte_motivo: string | null; criado_em: string;
  }>(sql`
    SELECT l.id::text AS lead_id, COALESCE(e.nome, l.empresa) AS empresa, l.empresa_id::text,
           NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS pessoa, l.cargo,
           e.setor, e.porte, l.prospeccao_estado AS estado, u.nome AS responsavel,
           (SELECT lb.nome FROM lead_labels ll JOIN labels lb ON lb.id = ll.label_id
             WHERE ll.lead_id = l.id ORDER BY lb.nome LIMIT 1) AS lista,
           cd.nome AS cadencia, ce.current_step_id AS passo,
           jsonb_array_length(COALESCE(cv.compiled_steps, cd.steps)) AS total_passos,
           ce.scheduled_at::text AS proxima_acao_em,
           l.pre_qualificado, l.prospeccao_descarte_motivo AS descarte_motivo,
           l.created_at::text AS criado_em
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
      LEFT JOIN usuarios u ON u.id = l.responsavel_id
      LEFT JOIN LATERAL (
        SELECT * FROM cadence_enrollments x
         WHERE x.entity_type = 'lead' AND x.entity_id = l.id
         ORDER BY x.started_at DESC LIMIT 1
      ) ce ON true
      LEFT JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
      LEFT JOIN cadence_versions cv ON cv.id = ce.cadence_version_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND l.prospeccao_estado IS NOT NULL
       AND (${filtros.estado ?? null}::text IS NULL OR l.prospeccao_estado = ${filtros.estado ?? null})
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR l.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.lista ?? null}::text IS NULL OR EXISTS (
         SELECT 1
           FROM lead_labels ll_lista
           JOIN labels lb_lista ON lb_lista.id = ll_lista.label_id
          WHERE ll_lista.lead_id = l.id
            AND lb_lista.organizacao_id = l.organizacao_id
            AND lb_lista.nome = ${filtros.lista ?? null}
       ))
       AND (${busca}::text IS NULL OR lower(COALESCE(e.nome, l.empresa, '')) LIKE ${busca}
            OR lower(concat_ws(' ', l.nome, l.sobrenome)) LIKE ${busca})
     ORDER BY l.updated_at DESC
     LIMIT ${LIMITE_PADRAO}
  `);

  const resumoLinhas = await db.execute<{ estado: string; n: number }>(sql`
    SELECT prospeccao_estado AS estado, count(*)::int AS n FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid AND prospeccao_estado IS NOT NULL
     GROUP BY 1
  `);
  const resumo = Object.fromEntries(ESTADOS_PROSPECCAO.map((e) => [e, 0])) as Record<EstadoProspeccao, number>;
  for (const r of resumoLinhas) resumo[r.estado as EstadoProspeccao] = r.n;

  const responsaveis = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true ORDER BY nome
  `);
  const listas = await db.execute<{ nome: string }>(sql`
    SELECT DISTINCT lb.nome FROM labels lb
      JOIN lead_labels ll ON ll.label_id = lb.id
      JOIN leads l ON l.id = ll.lead_id
     WHERE lb.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL
     ORDER BY 1 LIMIT 40
  `);

  return {
    linhas: linhas.map((l) => ({
      leadId: l.lead_id,
      empresa: l.empresa?.trim() || "Empresa não informada",
      empresaId: l.empresa_id,
      pessoa: l.pessoa,
      cargo: l.cargo,
      setor: l.setor,
      porte: l.porte,
      estado: l.estado as EstadoProspeccao,
      estadoRotulo: ROTULO_ESTADO_PROSPECCAO[l.estado as EstadoProspeccao] ?? l.estado,
      responsavel: l.responsavel,
      lista: l.lista,
      cadencia: l.cadencia,
      // O passo é identificado por id no motor; a posição numérica só existe
      // quando ela pode ser derivada, e nesse caso fica null em vez de virar 0.
      passoAtual: null,
      totalPassos: l.total_passos,
      proximaAcaoEm: l.proxima_acao_em,
      preQualificado: l.pre_qualificado,
      descarteMotivo: l.descarte_motivo,
      criadoEm: l.criado_em,
    })),
    resumo,
    filtros: {
      responsaveis: responsaveis.map((r) => ({ id: r.id, nome: r.nome })),
      listas: listas.map((l) => l.nome),
    },
  };
}

/* ── Contatos & Empresas (Bloco 05) ────────────────────────────────────── */

export interface LinhaEmpresa {
  id: string;
  nome: string;
  cnpj: string | null;
  setor: string | null;
  cidade: string | null;
  relacionamento: RelacionamentoEmpresa;
  relacionamentoRotulo: string;
  pessoas: number;
  oportunidadesAbertas: number;
  servicosAtivos: number;
  responsavel: string | null;
  ultimaAtividade: string | null;
}

/**
 * Diretório de empresas.
 *
 * O relacionamento é DERIVADO na consulta (Bloco 05 §7), na mesma ordem de
 * precedência de `derivarRelacionamento`: serviço ativo ganha de oportunidade
 * aberta, que ganha de lead ativo. Não existe coluna de status editável, e é
 * de propósito — a spec proíbe "Cliente" como campo que alguém troca à mão.
 */
export async function diretorioEmpresas(organizacaoId: string, filtros: {
  busca?: string | null; relacionamento?: RelacionamentoEmpresa | null; limite?: number;
} = {}): Promise<{ linhas: LinhaEmpresa[]; total: number; porRelacionamento: Record<RelacionamentoEmpresa, number> }> {
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<{
    id: string; nome: string; cnpj: string | null; setor: string | null; cidade: string | null;
    pessoas: number; oportunidades_abertas: number; servicos_ativos: number;
    servicos_historicos: number; leads_ativos: number;
    responsavel: string | null; ultima_atividade: string | null;
  }>(sql`
    WITH base AS (
      SELECT e.id, e.nome, e.cnpj, e.setor, e.cidade,
        (SELECT count(*)::int FROM pessoas p WHERE p.empresa_id = e.id)
          + (SELECT count(*)::int FROM leads l WHERE l.empresa_id = e.id AND NOT EXISTS (
               SELECT 1 FROM pessoas p2 WHERE p2.lead_id_legado = l.id)) AS pessoas,
        (SELECT count(*)::int FROM negocios n WHERE n.empresa_id = e.id
          AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')) AS oportunidades_abertas,
        (SELECT count(*)::int FROM servicos_canonicos s WHERE s.empresa_id = e.id
          AND s.commercial_lifecycle = 'ACTIVE') AS servicos_ativos,
        (SELECT count(*)::int FROM servicos_canonicos s WHERE s.empresa_id = e.id) AS servicos_historicos,
        (SELECT count(*)::int FROM leads l WHERE l.empresa_id = e.id
          AND l.estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado')) AS leads_ativos,
        (SELECT u.nome FROM clientes c JOIN usuarios u ON u.id = c.responsavel_id
          WHERE c.empresa_id = e.id LIMIT 1) AS responsavel,
        (SELECT max(a.created_at)::text FROM atividades a WHERE a.empresa_id = e.id) AS ultima_atividade
        FROM empresas e
       WHERE e.organizacao_id = ${organizacaoId}::uuid
         AND (${busca}::text IS NULL OR lower(e.nome) LIKE ${busca}
              OR lower(COALESCE(e.cnpj, '')) LIKE ${busca}
              OR lower(COALESCE(e.dominio, '')) LIKE ${busca})
    )
    SELECT * FROM base
     -- O relacionamento é derivado, então filtrar por ele também precisa ser.
     -- Filtrar depois, sobre a lista já truncada, devolveria um punhado de
     -- linhas e daria a impressão de que quase não existe empresa naquele estado.
     WHERE ${filtros.relacionamento ?? null}::text IS NULL OR
       CASE
         WHEN servicos_ativos > 0 THEN 'cliente'
         WHEN oportunidades_abertas > 0 THEN 'em_oportunidade'
         WHEN leads_ativos > 0 THEN 'em_pre_vendas'
         WHEN servicos_historicos > 0 THEN 'ex_cliente'
         ELSE 'cadastrada'
       END = ${filtros.relacionamento ?? null}
     ORDER BY servicos_ativos DESC, oportunidades_abertas DESC, nome
     LIMIT ${filtros.limite ?? 200}
  `);

  const [total] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid
  `);

  // Contagem por relacionamento sobre a base INTEIRA. Contar as linhas
  // carregadas daria o número da página, não o da empresa — e a página está
  // ordenada por serviço ativo, então diria "todas são clientes".
  const [agregado] = await db.execute<{
    cliente: number; em_oportunidade: number; em_pre_vendas: number; ex_cliente: number; cadastrada: number;
  }>(sql`
    WITH fatos AS (
      SELECT e.id,
        EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id AND s.commercial_lifecycle = 'ACTIVE') AS tem_ativo,
        EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id) AS teve_servico,
        EXISTS (SELECT 1 FROM negocios n WHERE n.empresa_id = e.id
                 AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')) AS tem_oportunidade,
        EXISTS (SELECT 1 FROM leads l WHERE l.empresa_id = e.id
                 AND l.estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado')) AS tem_lead
        FROM empresas e WHERE e.organizacao_id = ${organizacaoId}::uuid
    )
    SELECT
      count(*) FILTER (WHERE tem_ativo)::int AS cliente,
      count(*) FILTER (WHERE NOT tem_ativo AND tem_oportunidade)::int AS em_oportunidade,
      count(*) FILTER (WHERE NOT tem_ativo AND NOT tem_oportunidade AND tem_lead)::int AS em_pre_vendas,
      count(*) FILTER (WHERE NOT tem_ativo AND NOT tem_oportunidade AND NOT tem_lead AND teve_servico)::int AS ex_cliente,
      count(*) FILTER (WHERE NOT tem_ativo AND NOT tem_oportunidade AND NOT tem_lead AND NOT teve_servico)::int AS cadastrada
      FROM fatos
  `);

  const mapeadas = linhas.map((l) => {
    const relacionamento: RelacionamentoEmpresa =
      l.servicos_ativos > 0 ? "cliente"
      : l.oportunidades_abertas > 0 ? "em_oportunidade"
      : l.leads_ativos > 0 ? "em_pre_vendas"
      : l.servicos_historicos > 0 ? "ex_cliente"
      : "cadastrada";

    return {
      id: l.id, nome: l.nome, cnpj: l.cnpj, setor: l.setor, cidade: l.cidade,
      relacionamento, relacionamentoRotulo: ROTULO_RELACIONAMENTO[relacionamento],
      pessoas: l.pessoas, oportunidadesAbertas: l.oportunidades_abertas,
      servicosAtivos: l.servicos_ativos, responsavel: l.responsavel,
      ultimaAtividade: l.ultima_atividade,
    };
  });

  return {
    linhas: mapeadas,
    total: total?.n ?? 0,
    porRelacionamento: {
      cliente: agregado?.cliente ?? 0,
      em_oportunidade: agregado?.em_oportunidade ?? 0,
      em_pre_vendas: agregado?.em_pre_vendas ?? 0,
      ex_cliente: agregado?.ex_cliente ?? 0,
      cadastrada: agregado?.cadastrada ?? 0,
    },
  };
}

export interface LinhaPessoa {
  id: string;
  /** `pessoas` para o modelo novo, `leads` para a identidade legada. */
  fonte: "pessoa" | "lead";
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  empresaId: string | null;
  empresa: string | null;
}

type LinhaPessoaDb = {
  id: string; fonte: string; nome: string | null; cargo: string | null;
  email: string | null; telefone: string | null; whatsapp: string | null;
  empresa_id: string | null; empresa: string | null;
};

function mapearLinhaPessoa(linha: LinhaPessoaDb): LinhaPessoa {
  return {
    id: linha.id,
    fonte: linha.fonte as "pessoa" | "lead",
    nome: linha.nome ?? "Sem nome",
    cargo: linha.cargo,
    email: linha.email,
    telefone: linha.telefone,
    whatsapp: linha.whatsapp,
    empresaId: linha.empresa_id,
    empresa: linha.empresa,
  };
}

/**
 * Diretório de pessoas.
 *
 * Lê `pessoas` (modelo novo) **e** `leads` (onde a identidade das pessoas
 * ainda mora no legado), sem duplicar: o lead que já foi materializado em
 * `pessoas` aparece uma vez só. É a "compatibilidade de leitura" que a spec
 * autoriza em Bloco 05 §26, enquanto entradas novas nascem nos dois lados.
 *
 * Bloco 05 §3: Pessoa pode existir sem Empresa, e isso não é erro.
 */
export async function diretorioPessoas(organizacaoId: string, filtros: {
  busca?: string | null; empresaId?: string | null; semEmpresa?: boolean; limite?: number;
} = {}): Promise<LinhaPessoa[]> {
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<LinhaPessoaDb>(sql`
    SELECT p.id::text, 'pessoa' AS fonte,
           NULLIF(trim(concat_ws(' ', p.nome, p.sobrenome)), '') AS nome,
           p.cargo, p.email, p.telefone, p.whatsapp,
           p.empresa_id::text, e.nome AS empresa
      FROM pessoas p
      LEFT JOIN empresas e ON e.id = p.empresa_id
     WHERE p.organizacao_id = ${organizacaoId}::uuid
       AND (${filtros.empresaId ?? null}::uuid IS NULL OR p.empresa_id = ${filtros.empresaId ?? null}::uuid)
       AND (${filtros.semEmpresa ?? false} = false OR p.empresa_id IS NULL)
       AND (${busca}::text IS NULL OR lower(concat_ws(' ', p.nome, p.sobrenome)) LIKE ${busca}
            OR lower(COALESCE(p.email, '')) LIKE ${busca})

    UNION ALL

    SELECT l.id::text, 'lead' AS fonte,
           NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS nome,
           l.cargo, l.email, l.telefone, l.whatsapp,
           l.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
       AND (${filtros.empresaId ?? null}::uuid IS NULL OR l.empresa_id = ${filtros.empresaId ?? null}::uuid)
       AND (${filtros.semEmpresa ?? false} = false OR l.empresa_id IS NULL)
       AND (${busca}::text IS NULL OR lower(concat_ws(' ', l.nome, l.sobrenome)) LIKE ${busca}
            OR lower(COALESCE(l.email, '')) LIKE ${busca})

     ORDER BY nome
     LIMIT ${filtros.limite ?? 200}
  `);

  return linhas.map(mapearLinhaPessoa);
}

/** Carrega uma identidade sem depender do limite da listagem do diretório. */
export async function pessoaPorId(organizacaoId: string, pessoaId: string): Promise<LinhaPessoa | null> {
  const [linha] = await db.execute<LinhaPessoaDb>(sql`
    SELECT p.id::text, 'pessoa' AS fonte,
           NULLIF(trim(concat_ws(' ', p.nome, p.sobrenome)), '') AS nome,
           p.cargo, p.email, p.telefone, p.whatsapp,
           p.empresa_id::text, e.nome AS empresa
      FROM pessoas p
      LEFT JOIN empresas e ON e.id = p.empresa_id
     WHERE p.id = ${pessoaId}::uuid AND p.organizacao_id = ${organizacaoId}::uuid

    UNION ALL

    SELECT l.id::text, 'lead' AS fonte,
           NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS nome,
           l.cargo, l.email, l.telefone, l.whatsapp,
           l.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE l.id = ${pessoaId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid
       AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
     LIMIT 1
  `);
  return linha ? mapearLinhaPessoa(linha) : null;
}

/* ── Empresa 360 comercial (Bloco 05 §8) ───────────────────────────────── */

export interface Empresa360 {
  id: string;
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  setor: string | null;
  porte: string | null;
  cidade: string | null;
  estado: string | null;
  website: string | null;
  dominio: string | null;
  endereco: { logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cep: string | null };
  relacionamento: RelacionamentoEmpresa;
  relacionamentoRotulo: string;
  dadosJuridicosCompletos: boolean;
  /** Rótulos dos campos que faltam, na mesma ordem do formulário. Existe para
   *  a tela dizer o que falta em vez de só dizer que falta alguma coisa. */
  dadosJuridicosFaltando: string[];
  pessoas: Array<{ id: string; fonte: "pessoa" | "lead"; nome: string; cargo: string | null; papel: string | null; email: string | null; telefone: string | null }>;
  leads: Array<{ id: string; etapa: string; etapaRotulo: string; origem: string | null; criadoEm: string }>;
  oportunidades: Array<{ id: string; titulo: string; etapa: string; etapaRotulo: string; familia: string | null; valor: number | null; responsavel: string | null }>;
  propostas: Array<{ id: string; numero: number; versao: number; status: string; total: number | null; enviadaEm: string | null }>;
  servicos: Array<{ id: string; familia: string; produto: string | null; valor: number; ativo: boolean }>;
}

export async function empresa360(organizacaoId: string, empresaId: string): Promise<Empresa360 | null> {
  const [e] = await db.execute<{
    id: string; nome: string; razao_social: string | null; cnpj: string | null;
    setor: string | null; porte: string | null; cidade: string | null; estado: string | null;
    website: string | null; dominio: string | null; logradouro: string | null;
    numero: string | null; complemento: string | null; bairro: string | null; cep: string | null;
  }>(sql`
    SELECT id::text, nome, razao_social, cnpj, setor, porte, cidade, estado, website, dominio,
           logradouro, numero, complemento, bairro, cep
      FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  if (!e) return null;

  const { derivarRelacionamento } = await import("./identidade");
  const relacionamento = await derivarRelacionamento(organizacaoId, empresaId);

  const pessoas = await db.execute<{
    id: string; fonte: string; nome: string; cargo: string | null; papel: string | null;
    email: string | null; telefone: string | null;
  }>(sql`
    SELECT p.id::text, 'pessoa' AS fonte, NULLIF(trim(concat_ws(' ', p.nome, p.sobrenome)), '') AS nome,
           p.cargo, v.papel, p.email, p.telefone
      FROM pessoas p
      LEFT JOIN pessoa_empresa_vinculos v ON v.pessoa_id = p.id AND v.empresa_id = p.empresa_id AND v.encerrado_em IS NULL
     WHERE p.empresa_id = ${empresaId}::uuid
    UNION ALL
    SELECT l.id::text, 'lead' AS fonte, NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS nome,
           l.cargo, NULL AS papel, l.email, l.telefone
      FROM leads l
     WHERE l.empresa_id = ${empresaId}::uuid
       AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
     ORDER BY nome
  `);

  const leads = await db.execute<{ id: string; etapa: string | null; origem: string | null; criado_em: string }>(sql`
    SELECT id::text, estagio_pre_vendas AS etapa, origem, created_at::text AS criado_em
      FROM leads WHERE empresa_id = ${empresaId}::uuid AND estagio_pre_vendas IS NOT NULL
     ORDER BY created_at DESC LIMIT 20
  `);

  const oportunidades = await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
    valor: string | null; responsavel: string | null;
  }>(sql`
    SELECT n.id::text, n.titulo, n.etapa, n.service_family AS familia,
           n.valor_total::text AS valor, u.nome AS responsavel
      FROM negocios n LEFT JOIN usuarios u ON u.id = n.responsavel_id
     WHERE n.empresa_id = ${empresaId}::uuid
     ORDER BY n.created_at DESC LIMIT 20
  `);

  const propostas = await db.execute<{
    id: string; numero: number; versao: number; status: string; total: string | null; enviada_em: string | null;
  }>(sql`
    SELECT p.id::text, p.numero, p.versao, p.status, p.total_geral::text AS total, p.enviada_em::text
      FROM propostas p JOIN negocios n ON n.id = p.negocio_id
     WHERE n.empresa_id = ${empresaId}::uuid
     ORDER BY p.created_at DESC LIMIT 20
  `);

  const servicos = await db.execute<{
    id: string; familia: string; produto: string | null; valor: string; ciclo: string;
  }>(sql`
    SELECT id::text, service_family AS familia, canonical_product AS produto,
           current_recurring_value::text AS valor, commercial_lifecycle AS ciclo
      FROM servicos_canonicos WHERE empresa_id = ${empresaId}::uuid
     ORDER BY current_recurring_value DESC LIMIT 20
  `);

  // Mesma fonte de verdade do gate de envio da proposta: se a lista mudar lá,
  // a Empresa 360 acompanha sozinha.
  const { CAMPOS_JURIDICOS } = await import("./propostas");
  const valorJuridico: Record<string, string | null> = {
    razao_social: e.razao_social, cnpj: e.cnpj, logradouro: e.logradouro,
    numero: e.numero, bairro: e.bairro, cidade: e.cidade, estado: e.estado, cep: e.cep,
  };
  const juridicosFaltando = CAMPOS_JURIDICOS
    .filter(({ coluna }) => !valorJuridico[coluna]?.toString().trim())
    .map(({ rotulo }) => rotulo);

  return {
    id: e.id, nome: e.nome, razaoSocial: e.razao_social, cnpj: e.cnpj,
    setor: e.setor, porte: e.porte, cidade: e.cidade, estado: e.estado,
    website: e.website, dominio: e.dominio,
    endereco: { logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cep: e.cep },
    relacionamento, relacionamentoRotulo: ROTULO_RELACIONAMENTO[relacionamento],
    dadosJuridicosCompletos: juridicosFaltando.length === 0,
    dadosJuridicosFaltando: juridicosFaltando,
    pessoas: pessoas.map((p) => ({
      id: p.id, fonte: p.fonte as "pessoa" | "lead", nome: p.nome ?? "Sem nome",
      cargo: p.cargo, papel: p.papel, email: p.email, telefone: p.telefone,
    })),
    leads: leads.map((l) => ({
      id: l.id, etapa: l.etapa ?? "novo",
      etapaRotulo: ROTULO_ETAPA_PRE_VENDAS[(l.etapa ?? "novo") as EstagioPreVendas] ?? l.etapa ?? "",
      origem: l.origem, criadoEm: l.criado_em,
    })),
    oportunidades: oportunidades.map((o) => ({
      id: o.id, titulo: o.titulo, etapa: o.etapa ?? "entrada",
      etapaRotulo: ROTULO_ETAPA_PIPELINE[(o.etapa ?? "entrada") as EtapaPipeline] ?? o.etapa ?? "",
      familia: o.familia, valor: o.valor === null ? null : Number(o.valor), responsavel: o.responsavel,
    })),
    propostas: propostas.map((p) => ({
      id: p.id, numero: p.numero, versao: p.versao, status: p.status,
      total: p.total === null ? null : Number(p.total), enviadaEm: p.enviada_em,
    })),
    servicos: servicos.map((s) => ({
      id: s.id, familia: s.familia, produto: s.produto,
      valor: Number(s.valor), ativo: s.ciclo === "ACTIVE",
    })),
  };
}

/* ── Utilitário ────────────────────────────────────────────────────────── */

function iniciais(nome: string | null): string | null {
  if (!nome) return null;
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/* ── Detalhe do Lead (Bloco 01 §23) ────────────────────────────────────── */

export interface DetalheLead {
  id: string;
  empresa: { id: string | null; nome: string; setor: string | null; porte: string | null; cidade: string | null; website: string | null; cnpj: string | null };
  pessoa: { nome: string; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null };
  etapa: EstagioPreVendas;
  etapaRotulo: string;
  qualificado: boolean;
  qualificadoEm: string | null;
  qualificadoPor: string | null;
  qualificadoPorTipo: string | null;
  preQualificado: boolean;
  qualificacao: Record<string, unknown> | null;
  atribuicao: {
    origem: string | null; campanha: string | null; medium: string | null;
    conteudo: string | null; termo: string | null; landingPage: string | null;
    primeiroToque: string | null; ultimoToque: string | null;
  };
  responsavel: { id: string | null; nome: string | null };
  servicos: string[] | null;
  primeiroContatoEm: string | null;
  criadoEm: string;
  nutricao: { motivo: string | null; retomarEm: string | null; observacao: string | null };
  desqualificacao: { motivo: string | null; detalhe: string | null; deEtapa: string | null };
  oportunidades: Array<{ id: string; titulo: string; etapa: string; etapaRotulo: string; familia: string | null }>;
  proximaAcao: { titulo: string; venceEm: string | null } | null;
}

export async function detalheLead(organizacaoId: string, leadId: string): Promise<DetalheLead | null> {
  const [l] = await db.execute<{
    id: string; empresa_id: string | null; empresa_nome: string | null; setor: string | null;
    porte: string | null; cidade: string | null; website: string | null; cnpj: string | null;
    nome: string; sobrenome: string | null; cargo: string | null; email: string | null;
    telefone: string | null; whatsapp: string | null; etapa: string | null;
    qualificado: boolean; qualificado_em: string | null; qualificado_por: string | null;
    qualificado_por_tipo: string | null; pre_qualificado: boolean;
    qualificacao: Record<string, unknown> | null; origem: string | null;
    utm_campaign: string | null; utm_medium: string | null; utm_content: string | null;
    utm_term: string | null; landing_page: string | null; servicos: string[] | null;
    responsavel_id: string | null; responsavel: string | null;
    primeiro_contato_at: string | null; criado_em: string;
    nutricao_motivo: string | null; nutricao_retomar_em: string | null; nutricao_observacao: string | null;
    desq_motivo: string | null; desq_detalhe: string | null; desq_de_etapa: string | null;
  }>(sql`
    SELECT l.id::text, l.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa_nome,
           COALESCE(e.setor, l.empresa_setor) AS setor, COALESCE(e.porte, l.empresa_porte) AS porte,
           COALESCE(e.cidade, l.empresa_cidade) AS cidade, e.website, COALESCE(e.cnpj, l.empresa_cnpj) AS cnpj,
           l.nome, l.sobrenome, l.cargo, l.email, l.telefone, l.whatsapp,
           l.estagio_pre_vendas AS etapa, l.qualificado, l.qualificado_em::text,
           qu.nome AS qualificado_por, l.qualificado_por_tipo, l.pre_qualificado,
           l.qualificacao, l.origem, l.utm_campaign, l.utm_medium, l.utm_content, l.utm_term,
           l.landing_page, l.servicos_interesse AS servicos,
           l.responsavel_id::text, u.nome AS responsavel,
           l.primeiro_contato_at::text, l.created_at::text AS criado_em,
           l.nutricao_motivo, l.nutricao_retomar_em::text, l.nutricao_observacao,
           l.desqualificacao_motivo AS desq_motivo, l.desqualificacao_detalhe AS desq_detalhe,
           l.desqualificado_de_etapa AS desq_de_etapa
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
      LEFT JOIN usuarios u ON u.id = l.responsavel_id
      LEFT JOIN usuarios qu ON qu.id = l.qualificado_por
     WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!l) return null;

  const [toques] = await db.execute<{ primeiro: string | null; ultimo: string | null }>(sql`
    SELECT
      max(CASE WHEN is_first_touch THEN COALESCE(source, tipo_origem) END) AS primeiro,
      max(CASE WHEN is_last_touch THEN COALESCE(source, tipo_origem) END) AS ultimo
      FROM pontos_contato
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND (lead_id_legado = ${leadId}::uuid
            OR (${l.empresa_id ?? null}::uuid IS NOT NULL AND empresa_id = ${l.empresa_id ?? null}::uuid))
  `);

  const oportunidades = await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
  }>(sql`
    SELECT id::text, titulo, etapa, service_family AS familia
      FROM negocios WHERE lead_id = ${leadId}::uuid ORDER BY created_at DESC
  `);

  const [tarefa] = await db.execute<{ titulo: string; vence_em: string | null }>(sql`
    SELECT titulo, vence_em::text FROM tarefas
     WHERE lead_id = ${leadId}::uuid AND status IN ('a_fazer','em_andamento','aguardando')
     ORDER BY vence_em NULLS LAST LIMIT 1
  `);

  const etapa = (l.etapa ?? "novo") as EstagioPreVendas;

  return {
    id: l.id,
    empresa: {
      id: l.empresa_id, nome: l.empresa_nome?.trim() || "Empresa não informada",
      setor: l.setor, porte: l.porte, cidade: l.cidade, website: l.website, cnpj: l.cnpj,
    },
    pessoa: {
      nome: [l.nome, l.sobrenome].filter(Boolean).join(" ").trim() || "Sem contato",
      cargo: l.cargo, email: l.email, telefone: l.telefone, whatsapp: l.whatsapp,
    },
    etapa,
    etapaRotulo: ROTULO_ETAPA_PRE_VENDAS[etapa] ?? etapa,
    qualificado: l.qualificado,
    qualificadoEm: l.qualificado_em,
    qualificadoPor: l.qualificado_por,
    qualificadoPorTipo: l.qualificado_por_tipo,
    preQualificado: l.pre_qualificado,
    qualificacao: l.qualificacao,
    atribuicao: {
      origem: l.origem, campanha: l.utm_campaign, medium: l.utm_medium,
      conteudo: l.utm_content, termo: l.utm_term, landingPage: l.landing_page,
      primeiroToque: toques?.primeiro ?? null, ultimoToque: toques?.ultimo ?? null,
    },
    responsavel: { id: l.responsavel_id, nome: l.responsavel },
    servicos: l.servicos,
    primeiroContatoEm: l.primeiro_contato_at,
    criadoEm: l.criado_em,
    nutricao: { motivo: l.nutricao_motivo, retomarEm: l.nutricao_retomar_em, observacao: l.nutricao_observacao },
    desqualificacao: { motivo: l.desq_motivo, detalhe: l.desq_detalhe, deEtapa: l.desq_de_etapa },
    oportunidades: oportunidades.map((o) => ({
      id: o.id, titulo: o.titulo, etapa: o.etapa ?? "entrada",
      etapaRotulo: ROTULO_ETAPA_PIPELINE[(o.etapa ?? "entrada") as EtapaPipeline] ?? o.etapa ?? "",
      familia: o.familia,
    })),
    proximaAcao: tarefa ? { titulo: tarefa.titulo, venceEm: tarefa.vence_em } : null,
  };
}

/* ── Detalhe da Oportunidade (Bloco 02 §25) ────────────────────────────── */

export interface DetalheOportunidade {
  id: string;
  titulo: string;
  etapa: EtapaPipeline;
  etapaRotulo: string;
  familia: string | null;
  familiaRotulo: string;
  motion: string | null;
  sourceProcess: string | null;
  valor: number | null;
  previsaoFechamento: string | null;
  responsavel: { id: string | null; nome: string | null };
  empresa: { id: string | null; nome: string };
  contato: { id: string; fonte: "pessoa" | "lead"; nome: string; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null } | null;
  leadId: string | null;
  /** Qualificação herdada de Pré-vendas (Bloco 02 §25). */
  qualificacaoHerdada: Record<string, unknown> | null;
  proximaAcao: { descricao: string | null; quando: string | null };
  badges: string[];
  motivoEstagnacao: string | null;
  motivoPerda: string | null;
  noShow: { em: string | null; contagem: number };
  trial: { iniciadoEm: string | null; encerradoEm: string | null };
  propostas: Array<{ id: string; numero: number; versao: number; status: string; total: number | null; enviadaEm: string | null; modoFechamento: string | null }>;
  reunioes: Array<{ id: string; titulo: string; data: string; status: string }>;
  irmas: Array<{ id: string; titulo: string; etapa: string; familia: string | null }>;
  evidencias: Array<{ tipo: string; em: string }>;
}

export async function detalheOportunidade(organizacaoId: string, negocioId: string): Promise<DetalheOportunidade | null> {
  const [n] = await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
    motion: string | null; source_process: string | null; valor: string | null;
    previsao: string | null; responsavel_id: string | null; responsavel: string | null;
    empresa_id: string | null; empresa: string | null; lead_id: string | null;
    lead_nome: string | null; lead_cargo: string | null; lead_email: string | null; lead_telefone: string | null; lead_whatsapp: string | null;
    qualificacao: Record<string, unknown> | null; proxima_acao: string | null;
    proxima_acao_em: string | null; motivo_estagnacao: string | null;
    motivo_perda: string | null; no_show_em: string | null; no_show_contagem: number;
    trial_iniciado_em: string | null; trial_encerrado_em: string | null; bundle_id: string | null;
  }>(sql`
    SELECT n.id::text, n.titulo, n.etapa, n.service_family AS familia,
           n.commercial_motion AS motion, n.source_process, n.valor_total::text AS valor,
           n.previsao_fechamento::text AS previsao, n.responsavel_id::text, u.nome AS responsavel,
           n.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa, n.lead_id::text,
           NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS lead_nome,
           l.cargo AS lead_cargo, l.email AS lead_email, l.telefone AS lead_telefone, l.whatsapp AS lead_whatsapp,
           l.qualificacao, n.proxima_acao, n.proxima_acao_em::text,
           n.motivo_estagnacao, n.motivo_perda_chave AS motivo_perda,
           n.no_show_em::text, n.no_show_contagem, n.trial_iniciado_em::text,
           n.trial_encerrado_em::text, n.bundle_id::text
      FROM negocios n
      LEFT JOIN empresas e ON e.id = n.empresa_id
      LEFT JOIN leads l ON l.id = n.lead_id
      LEFT JOIN usuarios u ON u.id = n.responsavel_id
     WHERE n.id = ${negocioId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!n) return null;

  const [pessoaContato] = await db.execute<{
    id: string; nome: string | null; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null;
  }>(sql`
    SELECT p.id::text, NULLIF(trim(concat_ws(' ', p.nome, p.sobrenome)), '') AS nome,
           p.cargo, p.email, p.telefone, p.whatsapp
      FROM pessoas p
     WHERE p.organizacao_id = ${organizacaoId}::uuid
       AND (p.lead_id_legado = ${n.lead_id}::uuid OR (p.empresa_id = ${n.empresa_id}::uuid AND ${n.empresa_id}::uuid IS NOT NULL))
     ORDER BY CASE WHEN p.lead_id_legado = ${n.lead_id}::uuid THEN 0 ELSE 1 END, p.created_at ASC
     LIMIT 1
  `);

  const propostas = await db.execute<{
    id: string; numero: number; versao: number; status: string;
    total: string | null; enviada_em: string | null; modo: string | null;
  }>(sql`
    SELECT id::text, numero, versao, status, total_geral::text AS total,
           enviada_em::text, modo_fechamento AS modo
      FROM propostas WHERE negocio_id = ${negocioId}::uuid ORDER BY versao DESC, created_at DESC
  `);

  const reunioes = await db.execute<{ id: string; titulo: string; data: string; status: string }>(sql`
    SELECT id::text, titulo, data::text, status FROM reunioes
     WHERE negocio_id = ${negocioId}::uuid ORDER BY data DESC LIMIT 10
  `);

  const irmas = n.bundle_id ? await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
  }>(sql`
    SELECT id::text, titulo, etapa, service_family AS familia FROM negocios
     WHERE bundle_id = ${n.bundle_id}::uuid AND id <> ${negocioId}::uuid
  `) : [];

  const evidencias = await db.execute<{ tipo: string; em: string }>(sql`
    SELECT tipo, verificado_em::text AS em FROM comercial_evidencia
     WHERE negocio_id = ${negocioId}::uuid ORDER BY verificado_em DESC
  `);

  const etapa = (n.etapa ?? "entrada") as EtapaPipeline;
  const badges: string[] = [];
  if (n.no_show_em) badges.push("No-show");
  if (n.trial_iniciado_em && !n.trial_encerrado_em) badges.push("Trial ativo");
  if (propostas.some((p) => p.status === "aceita")) badges.push("Proposta aceita");
  if (!n.proxima_acao && etapa !== "ganho" && etapa !== "perdido") badges.push("Sem próxima ação");

  return {
    id: n.id, titulo: n.titulo, etapa,
    etapaRotulo: ROTULO_ETAPA_PIPELINE[etapa] ?? etapa,
    familia: n.familia,
    familiaRotulo: ROTULO_FAMILIA[(n.familia ?? "UNKNOWN") as keyof typeof ROTULO_FAMILIA] ?? n.familia ?? "Não classificada",
    motion: n.motion, sourceProcess: n.source_process,
    valor: n.valor === null ? null : Number(n.valor),
    previsaoFechamento: n.previsao,
    responsavel: { id: n.responsavel_id, nome: n.responsavel },
    empresa: { id: n.empresa_id, nome: n.empresa?.trim() || "Empresa não informada" },
    contato: pessoaContato ? {
      id: pessoaContato.id, fonte: "pessoa", nome: pessoaContato.nome ?? "Sem nome", cargo: pessoaContato.cargo,
      email: pessoaContato.email, telefone: pessoaContato.telefone, whatsapp: pessoaContato.whatsapp,
    } : n.lead_id && n.lead_nome ? {
      id: n.lead_id, fonte: "lead", nome: n.lead_nome, cargo: n.lead_cargo,
      email: n.lead_email, telefone: n.lead_telefone, whatsapp: n.lead_whatsapp,
    } : null,
    leadId: n.lead_id,
    qualificacaoHerdada: n.qualificacao,
    proximaAcao: { descricao: n.proxima_acao, quando: n.proxima_acao_em },
    badges,
    motivoEstagnacao: n.motivo_estagnacao,
    motivoPerda: n.motivo_perda,
    noShow: { em: n.no_show_em, contagem: n.no_show_contagem },
    trial: { iniciadoEm: n.trial_iniciado_em, encerradoEm: n.trial_encerrado_em },
    propostas: propostas.map((p) => ({
      id: p.id, numero: p.numero, versao: p.versao, status: p.status,
      total: p.total === null ? null : Number(p.total), enviadaEm: p.enviada_em,
      modoFechamento: p.modo,
    })),
    reunioes: reunioes.map((r) => ({ id: r.id, titulo: r.titulo, data: r.data, status: r.status })),
    irmas: irmas.map((i) => ({ id: i.id, titulo: i.titulo, etapa: i.etapa ?? "entrada", familia: i.familia })),
    evidencias: evidencias.map((e) => ({ tipo: e.tipo, em: e.em })),
  };
}
