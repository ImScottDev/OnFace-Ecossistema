import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  inet,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";

// ─── ORGANIZACOES (TENANTS) ──────────────────────────────────
export const organizacoes = pgTable("organizacoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: text("nome").notNull(),
  slug: text("slug").unique().notNull(), // URL-friendly identifier
  dominio: text("dominio"), // custom domain (e.g. ever.murtech.com.br)
  logoUrl: text("logo_url"),
  corPrimaria: text("cor_primaria").default("#1E3A5F"),
  // Integration API keys per tenant
  apolloApiKey: text("apollo_api_key"), // Apollo.io API key (null = disabled)
  // WhatsApp config per tenant
  whatsappEnabled: boolean("whatsapp_enabled").default(false).notNull(),
  // Pipeline config
  pipelineConfig: jsonb("pipeline_config"), // custom stages per tenant
  // Settings — ICP, tracking, handover, notificacoes, enriquecimento (Callface)
  settings: jsonb("settings"),
  // Limits
  maxUsuarios: integer("max_usuarios").default(10),
  maxLeads: integer("max_leads").default(5000),
  // Status
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── USUARIOS ───────────────────────────────────────────────
export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  email: text("email").unique().notNull(),
  senhaHash: text("senha_hash").notNull(),
  role: text("role").default("vendedor").notNull(), // admin | gerente | closer | sdr | leitor
  avatarUrl: text("avatar_url"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_usuarios_org").on(table.organizacaoId),
]);

// ─── METAS (por usuário/mês) ─────────────────────────────────
// Metas mensais por pessoa. north-star: SDR = reunioes_agendadas, Closer = mrr_fechado.
export const metas = pgTable(
  "metas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id).notNull(),
    periodo: date("periodo").notNull(), // primeiro dia do mês (ex 2026-06-01)
    tipo: text("tipo").notNull(), // reunioes_agendadas | mrr_fechado | leads_qualificados | contratos_fechados
    valorAlvo: decimal("valor_alvo", { precision: 12, scale: 2 }).notNull(),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_metas_org_user_periodo_tipo").on(
      table.organizacaoId,
      table.usuarioId,
      table.periodo,
      table.tipo,
    ),
    index("idx_metas_org_periodo").on(table.organizacaoId, table.periodo),
  ]
);

// ─── AUTH TOKENS (convite / redefinição de senha) ────────────
// Token de uso único, com expiração. Guardamos só o HASH (sha256) do token;
// o token cru vai no link do email. tipo: 'convite' (primeiro acesso) | 'reset'.
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id).notNull(),
    tipo: text("tipo").notNull(), // convite | reset
    tokenHash: text("token_hash").notNull(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    usadoEm: timestamp("usado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_auth_tokens_hash").on(table.tokenHash),
    index("idx_auth_tokens_usuario").on(table.usuarioId),
  ]
);

// ─── EMPRESAS (COMPANIES) ───────────────────────────────────
export const empresas = pgTable(
  "empresas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    cnpj: text("cnpj"),
    setor: text("setor"),
    porte: text("porte"), // pequena, media, grande
    cidade: text("cidade"),
    estado: text("estado"),
    website: text("website"),
    instagram: text("instagram"),
    linkedin: text("linkedin"),
    tiktok: text("tiktok"),
    telefone: text("telefone"),
    pipedriveId: text("pipedrive_id"),
    numUsuariosTi: integer("num_usuarios_ti"),
    numFiliais: integer("num_filiais").default(1),
    observacoes: text("observacoes"),
    camposCustom: jsonb("campos_custom").default({}),
    // Apollo enrichment
    apolloId: text("apollo_id"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    enrichStatus: text("enrich_status").default("pending"),
    industry: text("industry"),
    employeeCount: integer("employee_count"),
    annualRevenue: text("annual_revenue"),
    foundedYear: integer("founded_year"),
    apolloDescription: text("apollo_description"),
    logoUrl: text("logo_url"),
    endereco: text("endereco"),
    cep: text("cep"),
    pais: text("pais"),
    totalFunding: text("total_funding"),
    fundingStage: text("funding_stage"),
    growth6m: decimal("growth_6m", { precision: 5, scale: 4 }),
    growth12m: decimal("growth_12m", { precision: 5, scale: 4 }),
    twitter: text("twitter"),
    facebook: text("facebook"),
    techStack: text("tech_stack").array(),
    apolloKeywords: text("apollo_keywords").array(),
    // IDs externos (unificação Zoho/Stripe/PABX)
    zohoId: text("zoho_id"),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_empresas_org").on(table.organizacaoId),
    index("idx_empresas_nome").on(table.nome),
  ]
);

// ─── LEADS ──────────────────────────────────────────────────
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    // Dados pessoais
    nome: text("nome").notNull(),
    sobrenome: text("sobrenome"),
    email: text("email"),
    telefone: text("telefone"),
    cargo: text("cargo"),
    linkedin: text("linkedin"),
    avatarUrl: text("avatar_url"),
    // Dados empresa
    empresaId: uuid("empresa_id").references(() => empresas.id),
    empresa: text("empresa"), // legacy text field, prefer empresaId
    empresaCnpj: text("empresa_cnpj"),
    empresaSetor: text("empresa_setor"),
    empresaPorte: text("empresa_porte"),
    empresaCidade: text("empresa_cidade"),
    empresaEstado: text("empresa_estado").default("SP"),
    numUsuariosTi: integer("num_usuarios_ti"),
    numFiliais: integer("num_filiais").default(1),
    // Servicos
    servicosInteresse: text("servicos_interesse").array(),
    modeloPreferido: text("modelo_preferido"),
    // Tracking
    origem: text("origem"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    // IDs reais da Meta (ad_id/adset_id/campaign_id) — populados pelo webhook
    // meta-lead-ids (n8n Meta Lead Ads), quando disponível. utm_term/utm_content
    // acima continuam sendo o nome (fallback pra leads sem esse dado ainda).
    metaAdId: text("meta_ad_id"),
    metaAdsetId: text("meta_adset_id"),
    metaCampaignId: text("meta_campaign_id"),
    gclid: text("gclid"),
    gbraid: text("gbraid"),
    wbraid: text("wbraid"),
    fbclid: text("fbclid"),
    fbc: text("fbc"),
    fbp: text("fbp"),
    eventId: text("event_id"),
    landingPage: text("landing_page"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    // Comercial
    leadScore: integer("lead_score").default(0).notNull(),
    status: text("status").default("novo").notNull(),
    motivoPerda: text("motivo_perda"),
    motivoPerdaDetalhe: text("motivo_perda_detalhe"),
    // Receita
    valorTotal: decimal("valor_total", { precision: 12, scale: 2 }),
    tipoReceita: text("tipo_receita").default("recorrente"),
    mrrEstimado: decimal("mrr_estimado", { precision: 12, scale: 2 }), // legacy
    mrrFechado: decimal("mrr_fechado", { precision: 12, scale: 2 }), // legacy
    valorSetup: decimal("valor_setup", { precision: 12, scale: 2 }), // legacy
    valorProjeto: decimal("valor_projeto", { precision: 12, scale: 2 }), // legacy
    // Pipedrive
    pipedriveId: text("pipedrive_id"),
    // Apollo enrichment
    apolloId: text("apollo_id"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    enrichStatus: text("enrich_status").default("pending"),
    apolloSeniority: text("apollo_seniority"),
    apolloHeadline: text("apollo_headline"),
    apolloPhotoUrl: text("apollo_photo_url"),
    apolloCity: text("apollo_city"),
    apolloState: text("apollo_state"),
    apolloCountry: text("apollo_country"),
    apolloDepartments: text("apollo_departments").array(),
    apolloEmploymentHistory: jsonb("apollo_employment_history").default([]),
    twitter: text("twitter"),
    github: text("github"),
    facebook: text("facebook"),
    apolloLikelyEngage: boolean("apollo_likely_engage"),
    // Contexto
    comoConheceu: text("como_conheceu"),
    indicadoPor: text("indicado_por"),
    indicadoPorLeadId: uuid("indicado_por_lead_id"),
    concorrenteAtual: text("concorrente_atual"),
    contratoVenceEm: date("contrato_vence_em"),
    // Atribuicao
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    // Timestamps
    zohoId: text("zoho_id"),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    primeiroContatoAt: timestamp("primeiro_contato_at", { withTimezone: true }),
    // Quando o lead entrou (a última vez) na etapa "Em Contato" do board pré-vendas.
    // Base do relógio de escalação automática (6h em Em Contato → Follow up).
    contatoDesdeAt: timestamp("contato_desde_at", { withTimezone: true }),
    convertidoAt: timestamp("convertido_at", { withTimezone: true }),
    // Pos-venda
    clienteDesde: timestamp("cliente_desde", { withTimezone: true }),
    proximoNps: timestamp("proximo_nps", { withTimezone: true }),
    npsScore: integer("nps_score"),
    contratoTipo: text("contrato_tipo"),
    contratoVencimento: date("contrato_vencimento"),
    renovacaoAlertada: boolean("renovacao_alertada").default(false),
    // Tipo do contato
    tipo: text("tipo").default("contato").notNull(), // contato | lead | cliente
    // WhatsApp
    whatsappUltimaMsg: text("whatsapp_ultima_msg"),
    whatsappNaoLidas: integer("whatsapp_nao_lidas").default(0),
    whatsappUltimaMsgAt: timestamp("whatsapp_ultima_msg_at", { withTimezone: true }),
    // Email
    emailNaoLidos: integer("email_nao_lidos").default(0),
    emailUltimoAssunto: text("email_ultimo_assunto"),
    emailUltimaMsgAt: timestamp("email_ultima_msg_at", { withTimezone: true }),
    // Negócio ativo (em negociação)
    negocioAtivoId: uuid("negocio_ativo_id"),
    // Custom fields
    camposCustom: jsonb("campos_custom").default({}),
    // ─── Scott Studio: CIPA + SDR ─────────────────
    lpUrl: text("lp_url"),
    instagram: text("instagram"),
    whatsapp: text("whatsapp"),
    // CIPA Analysis (Groq + heuristics)
    cipaScore: integer("cipa_score"),
    cipaDiagnostico: jsonb("cipa_diagnostico"), // { problemas, categorias, score, resumo }
    cipaPagespeed: jsonb("cipa_pagespeed"),
    screenshotUrl: text("screenshot_url"),
    pagespeedReportUrl: text("pagespeed_report_url"),
    analysisNotes: text("analysis_notes"), // Groq resumo
    // InsumoComercial (Groq Llama 3.3 70b output)
    insumoComercial: jsonb("insumo_comercial"), // { abertura_recomendada, angulo_de_ataque, objecao_provavel, argumento_scott_studio, closer_c, closer_l, dor_principal, bottleneck }
    // SDR Agent
    sdrStatus: text("sdr_status").default("pending"), // pending, contacted, qualifying, scheduled, disqualified
    outreachChannel: text("outreach_channel"), // whatsapp, email, instagram
    outreachStartedAt: timestamp("outreach_started_at", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
    // Closer oferecido pro lead durante o agendamento (round-robin fixado por lead,
    // não recalculado a cada turno — evita trocar de closer no meio da conversa
    // se outro lead fechar reunião nesse intervalo).
    agendaCloserId: uuid("agenda_closer_id").references(() => usuarios.id),
  },
  (table) => [
    index("idx_leads_org").on(table.organizacaoId),
    index("idx_leads_org_status").on(table.organizacaoId, table.status),
    index("idx_leads_status").on(table.status),
    index("idx_leads_origem").on(table.origem),
    index("idx_leads_utm_campaign").on(table.utmCampaign),
    index("idx_leads_created_at").on(table.createdAt),
    index("idx_leads_gclid").on(table.gclid),
    index("idx_leads_responsavel").on(table.responsavelId),
    index("idx_leads_empresa_setor").on(table.empresaSetor),
    index("idx_leads_telefone").on(table.telefone),
    index("idx_leads_tipo").on(table.tipo),
  ]
);

// ─── STAGING: IDs reais da Meta (ad_id/adset_id/campaign_id) por Lead Ads ─────
// Alimentada pelo webhook /api/webhooks/meta-lead-ids (n8n, direto da Graph API).
// Existe porque a chegada do lead em si (via RD Station, fluxo assíncrono à parte)
// pode acontecer ANTES ou DEPOIS desse webhook — este staging casa os dois lados
// não importa a ordem (ver rd-lead/route.ts e meta-lead-ids/route.ts).
export const metaLeadStaging = pgTable(
  "meta_lead_staging",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fbLeadId: text("fb_lead_id"),
    email: text("email"),
    telefone: text("telefone"),
    adId: text("ad_id"),
    adsetId: text("adset_id"),
    campaignId: text("campaign_id"),
    adName: text("ad_name"),
    adsetName: text("adset_name"),
    campaignName: text("campaign_name"),
    usado: boolean("usado").default(false).notNull(), // já casado com um lead
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_meta_lead_staging_email").on(table.email),
    index("idx_meta_lead_staging_telefone").on(table.telefone),
    index("idx_meta_lead_staging_created_at").on(table.createdAt),
  ]
);

// ─── LIGACOES (telefonia Callface — webhook de saída) ─────────
// Uma linha POR LIGAÇÃO finalizada. A série histórica do deal_closure_percentage
// (tendência de fechamento) vem daqui — nunca sobrescrever em campo único.
// Cada ligação casada com lead também espelha uma linha em `atividades`
// (tipo='ligacao') pra timeline funcionar sem mudança de UI.
export const ligacoes = pgTable("ligacoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  leadId: uuid("lead_id").references(() => leads.id), // null = ligação órfã (sem lead casado)
  negocioId: uuid("negocio_id").references(() => negocios.id),
  usuarioId: uuid("usuario_id").references(() => usuarios.id), // vendedor (match por user_email)
  // Idempotência: call_id extraído do call_link; fallback hash(numero|data|email).
  idempotencyKey: text("idempotency_key").notNull(),
  callfaceCallId: text("callface_call_id"),
  callfaceContactId: text("callface_contact_id"),
  callfaceDealId: text("callface_deal_id"),
  userEmail: text("user_email"),
  userName: text("user_name"),
  destinationNumber: text("destination_number"),
  callDate: timestamp("call_date", { withTimezone: true }),
  duracaoSegundos: integer("duracao_segundos"),
  callStatus: text("call_status"), // ex: FINISHED (valores reais a aprender do payload_raw)
  resumo: text("resumo"), // summarization (markdown)
  transcricao: jsonb("transcricao"), // array no payload da Callface
  callLink: text("call_link"),
  audioUrl: text("audio_url"),
  closurePercentage: integer("closure_percentage"), // deal_closure_percentage 0-100 (IA)
  scheduling: jsonb("scheduling"), // {has_scheduling, items:[{category, communication_type, date, status}]}
  payloadRaw: jsonb("payload_raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ligacoes_idempotency").on(table.idempotencyKey),
  index("idx_ligacoes_org").on(table.organizacaoId),
  index("idx_ligacoes_lead").on(table.leadId),
  index("idx_ligacoes_negocio").on(table.negocioId),
  index("idx_ligacoes_call_date").on(table.callDate),
]);

// ─── PIPELINES ───────────────────────────────────────────────
export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    slug: text("slug").notNull(),
    ordem: integer("ordem").default(0).notNull(),
    stages: jsonb("stages").notNull().default([]),
    closedStages: jsonb("closed_stages").notNull().default([]),
    isDefault: boolean("is_default").default(false).notNull(),
    ativo: boolean("ativo").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_pipelines_org").on(table.organizacaoId),
    uniqueIndex("idx_pipelines_org_slug").on(table.organizacaoId, table.slug),
  ]
);

// ─── NEGOCIOS (DEALS) ──────────────────────────────────────
export const negocios = pgTable(
  "negocios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    leadId: uuid("lead_id").references(() => leads.id), // primary lead (legacy, nullable)
    empresaId: uuid("empresa_id").references(() => empresas.id),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    status: text("status").default("reuniao_agendada").notNull(),
    temperatura: text("temperatura").default("indefinido"), // quente | morno | frio | indefinido
    valorTotal: decimal("valor_total", { precision: 12, scale: 2 }),
    tipoReceita: text("tipo_receita").default("recorrente"), // legacy
    mrrEstimado: decimal("mrr_estimado", { precision: 12, scale: 2 }), // legacy
    valorProjeto: decimal("valor_projeto", { precision: 12, scale: 2 }), // legacy
    mrrFechado: decimal("mrr_fechado", { precision: 12, scale: 2 }), // legacy
    valorSetup: decimal("valor_setup", { precision: 12, scale: 2 }), // legacy
    moeda: text("moeda").default("BRL").notNull(), // BRL, USD, EUR, CAD
    previsaoFechamento: date("previsao_fechamento"),
    pipelineOrigem: text("pipeline_origem"), // pipeline source (e.g. Pipedrive pipeline name)
    pipedriveId: text("pipedrive_id"),
    motivoPerda: text("motivo_perda"),
    motivoPerdaDetalhe: text("motivo_perda_detalhe"),
    origemNegocio: text("origem_negocio").default("novo").notNull(), // 'novo' | 'carteira'
    // Como o negócio nasceu na qualificação: 'reuniao' (fluxo com agendamento) |
    // 'direta' (closer atuando como SDR qualificou sem reunião). Null = anterior à captura.
    origemQualificacao: text("origem_qualificacao"),
    servicosInteresse: text("servicos_interesse").array(),
    necessidadesConstatadas: text("necessidades_constatadas").array(), // what was identified in pre-analysis (BM form checkboxes)
    concorrenteAtual: text("concorrente_atual"),
    contratoVenceEm: date("contrato_vence_em"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    pipelineId: uuid("pipeline_id").references(() => pipelines.id),
    contratoTipo: text("contrato_tipo"),
    negocioOrigemId: uuid("negocio_origem_id"), // link to the original "ganho" deal
    camposCustom: jsonb("campos_custom").default({}),
    // ─── CIPA Analysis (Scott Studio) ───
    lpUrl: text("lp_url"),
    cipaScore: integer("cipa_score"),
    cipaDiagnostico: jsonb("cipa_diagnostico"), // {problemas: [], categorias: [], score, resumo}
    cipaPagespeed: jsonb("cipa_pagespeed"),
    screenshotUrl: text("screenshot_url"),
    pagespeedReportUrl: text("pagespeed_report_url"),
    analysisNotes: text("analysis_notes"),
    insumoComercial: jsonb("insumo_comercial"), // {abertura_recomendada, angulo_de_ataque, objecao_provavel, argumento_scott_studio, closer_c, closer_l, dor_principal, bottleneck}
    cipaAnalyzedAt: timestamp("cipa_analyzed_at", { withTimezone: true }),
    // ─── Apresentação Comercial ───
    apresentacaoConfig: jsonb("apresentacao_config"), // {secoes, depoimentos, cases, notas, observacoes}
    apresentacaoGeradaAt: timestamp("apresentacao_gerada_at", { withTimezone: true }),
    zohoId: text("zoho_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    convertidoAt: timestamp("convertido_at", { withTimezone: true }),
    ganhoAt: timestamp("ganho_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_negocios_org").on(table.organizacaoId),
    index("idx_negocios_lead").on(table.leadId),
    index("idx_negocios_status").on(table.status),
    index("idx_negocios_org_status").on(table.organizacaoId, table.status),
    index("idx_negocios_origem").on(table.origemNegocio),
    index("idx_negocios_empresa").on(table.empresaId),
    index("idx_negocios_responsavel").on(table.responsavelId),
  ]
);

// ─── NEGOCIO LEADS (N:N JUNCTION) ──────────────────────────
export const negocioLeads = pgTable(
  "negocio_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "cascade" }).notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
    papel: text("papel").default("contato"), // contato, decisor, influenciador, tecnico
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_negocio_leads_negocio").on(table.negocioId),
    index("idx_negocio_leads_lead").on(table.leadId),
  ]
);

// ─── EVENTOS DE TRACKING ────────────────────────────────────
export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id").references(() => leads.id),
    sessionId: text("session_id"),
    tipo: text("tipo").notNull(),
    pagina: text("pagina"),
    referrer: text("referrer"),
    dados: jsonb("dados"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_eventos_lead_id").on(table.leadId),
    index("idx_eventos_session_id").on(table.sessionId),
    index("idx_eventos_tipo").on(table.tipo),
  ]
);

// ─── ATIVIDADES DO CRM ─────────────────────────────────────
export const atividades = pgTable(
  "atividades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    leadId: uuid("lead_id")
      .references(() => leads.id)
      .notNull(),
    negocioId: uuid("negocio_id").references(() => negocios.id),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    tipo: text("tipo").notNull(),
    titulo: text("titulo"),
    descricao: text("descricao"),
    dados: jsonb("dados"),
    duracaoSegundos: integer("duracao_segundos"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_atividades_lead_id").on(table.leadId),
    index("idx_atividades_org").on(table.organizacaoId),
  ]
);

// ─── MUDANCAS DE STATUS ─────────────────────────────────────
export const statusChanges = pgTable("status_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .references(() => leads.id),
  negocioId: uuid("negocio_id").references(() => negocios.id),
  deStatus: text("de_status"),
  paraStatus: text("para_status").notNull(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id),
  motivo: text("motivo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── CONTRATOS ──────────────────────────────────────────────
export const contratos = pgTable(
  "contratos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    leadId: uuid("lead_id")
      .references(() => leads.id)
      .notNull(),
    negocioId: uuid("negocio_id").references(() => negocios.id),
    tipo: text("tipo").notNull(),
    descricao: text("descricao"),
    moeda: text("moeda").default("BRL").notNull(), // BRL, USD, EUR, CAD
    mrr: decimal("mrr", { precision: 12, scale: 2 }),
    valorSetup: decimal("valor_setup", { precision: 12, scale: 2 }),
    servicos: text("servicos").array(),
    inicio: date("inicio"),
    vencimento: date("vencimento"),
    renovacaoAuto: boolean("renovacao_auto").default(true),
    status: text("status").default("ativo").notNull(), // ativo | pausado | concluido | churned | cancelado | renovado
    notas: text("notas"),
    motivoChurn: text("motivo_churn"),
    finalizadoAt: timestamp("finalizado_at", { withTimezone: true }),
    zohoId: text("zoho_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    produto: text("produto"), // ai | pabx
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_contratos_lead_id").on(table.leadId),
    index("idx_contratos_status").on(table.status),
    index("idx_contratos_vencimento").on(table.vencimento),
    index("idx_contratos_org").on(table.organizacaoId),
  ]
);


// ─── ASSINATURAS (espelho Stripe — fonte da verdade de billing AI) ─────────
export const assinaturas = pgTable(
  "assinaturas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    leadId: uuid("lead_id").references(() => leads.id),
    empresaId: uuid("empresa_id").references(() => empresas.id),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    produto: text("produto"), // nome do produto no Stripe
    stripePriceId: text("stripe_price_id"),
    quantidade: integer("quantidade").default(1),
    mrr: decimal("mrr", { precision: 12, scale: 2 }),
    moeda: text("moeda").default("BRL").notNull(),
    status: text("status").notNull(), // active | past_due | canceled | trialing | incomplete_expired
    iniciadaEm: timestamp("iniciada_em", { withTimezone: true }),
    canceladaEm: timestamp("cancelada_em", { withTimezone: true }),
    motivoCancelamento: text("motivo_cancelamento"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_assinaturas_stripe_id").on(table.stripeSubscriptionId),
    index("idx_assinaturas_org").on(table.organizacaoId),
    index("idx_assinaturas_status").on(table.status),
    index("idx_assinaturas_empresa").on(table.empresaId),
  ]
);

// ─── FATURAS (cobranças: Stripe invoices + faturamento PABX/Wevy) ─────────
export const faturas = pgTable(
  "faturas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    leadId: uuid("lead_id").references(() => leads.id),
    empresaId: uuid("empresa_id").references(() => empresas.id),
    assinaturaId: uuid("assinatura_id").references(() => assinaturas.id),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    origem: text("origem").notNull(), // stripe | pabx
    externalId: text("external_id"), // stripe invoice id | chave planilha Wevy
    valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
    moeda: text("moeda").default("BRL").notNull(),
    status: text("status").notNull(), // paga | aberta | falhou | void | uncollectible
    competencia: date("competencia"), // mês de referência
    emitidaEm: timestamp("emitida_em", { withTimezone: true }),
    // Vencimento real (due_date do Stripe p/ boleto/manual; cobrança automática não tem
    // due_date — aging usa COALESCE(vencimento, emitida_em)). Dias em atraso é DERIVADO
    // na query, nunca coluna.
    vencimento: timestamp("vencimento", { withTimezone: true }),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    pagaEm: timestamp("paga_em", { withTimezone: true }),
    tentativas: integer("tentativas").default(0),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    // Acionamento manual da fila de cobrança: quem está trabalhando a fila marca
    // o que já contatou, pra não perder o fio nem cobrar o mesmo cliente 2x.
    acionadoCobranca: boolean("acionado_cobranca").default(false).notNull(),
    acionadoEm: timestamp("acionado_em", { withTimezone: true }),
    acionadoPor: uuid("acionado_por").references(() => usuarios.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_faturas_org").on(table.organizacaoId),
    index("idx_faturas_empresa").on(table.empresaId),
    index("idx_faturas_status").on(table.status),
    index("idx_faturas_competencia").on(table.competencia),
    uniqueIndex("idx_faturas_origem_ext").on(table.origem, table.externalId),
  ]
);

// ─── MOVIMENTOS DE MRR (novo/expansão/contração/churn/reativação) ─────────
// Alimentada pelo diff do stripe-sync (e futuramente pela importação PABX).
// Soma dos deltas reconstrói o MRR ativo — base das métricas de SaaS.
export const mrrMovimentos = pgTable(
  "mrr_movimentos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    leadId: uuid("lead_id").references(() => leads.id),
    assinaturaId: uuid("assinatura_id").references(() => assinaturas.id),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    produto: text("produto").notNull(), // ai | pabx
    tipo: text("tipo").notNull(), // novo | expansao | contracao | churn | reativacao
    delta: decimal("delta", { precision: 12, scale: 2 }).notNull(), // negativo p/ contração/churn
    mrrAntes: decimal("mrr_antes", { precision: 12, scale: 2 }).notNull(),
    mrrDepois: decimal("mrr_depois", { precision: 12, scale: 2 }).notNull(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull(),
    origem: text("origem").notNull(), // stripe_sync | backfill | pabx_import
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_mrr_mov_ocorrido").on(table.ocorridoEm),
    index("idx_mrr_mov_assinatura").on(table.assinaturaId),
    index("idx_mrr_mov_tipo").on(table.tipo),
    index("idx_mrr_mov_org").on(table.organizacaoId),
  ]
);

// ─── NPS RESPOSTAS ──────────────────────────────────────────
export const npsRespostas = pgTable(
  "nps_respostas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    leadId: uuid("lead_id")
      .references(() => leads.id)
      .notNull(),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    score: integer("score"),
    comentario: text("comentario"),
    tipo: text("tipo").notNull(),
    token: text("token").unique(),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    respondidoEm: timestamp("respondido_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_nps_lead_id").on(table.leadId),
    index("idx_nps_token").on(table.token),
    index("idx_nps_org").on(table.organizacaoId),
  ]
);

// ─── TAREFAS ────────────────────────────────────────────────
export const tarefas = pgTable(
  "tarefas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    leadId: uuid("lead_id").references(() => leads.id),
    negocioId: uuid("negocio_id").references(() => negocios.id),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    tipo: text("tipo").notNull(),
    prioridade: text("prioridade").default("media").notNull(),
    dataVencimento: date("data_vencimento"),
    venceEm: timestamp("vence_em", { withTimezone: true }),
    concluida: boolean("concluida").default(false).notNull(),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_tarefas_lead_id").on(table.leadId),
    index("idx_tarefas_negocio_id").on(table.negocioId),
    index("idx_tarefas_usuario_id").on(table.usuarioId),
    index("idx_tarefas_vencimento").on(table.dataVencimento),
    index("idx_tarefas_concluida").on(table.concluida),
    index("idx_tarefas_org").on(table.organizacaoId),
    index("idx_tarefas_org_vencimento").on(table.organizacaoId, table.dataVencimento),
  ]
);

// ─── NOTIFICACOES ───────────────────────────────────────────
export const notificacoes = pgTable(
  "notificacoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    titulo: text("titulo").notNull(),
    mensagem: text("mensagem"),
    tipo: text("tipo").notNull(),
    lida: boolean("lida").default(false).notNull(),
    link: text("link"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notificacoes_usuario").on(table.usuarioId),
    index("idx_notificacoes_lida").on(table.lida),
  ]
);

// ─── CAMPANHAS ──────────────────────────────────────────────
export const campanhas = pgTable("campanhas", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  plataforma: text("plataforma").notNull(),
  nome: text("nome").notNull(),
  utmCampaign: text("utm_campaign"),
  investimentoMensal: decimal("investimento_mensal", { precision: 12, scale: 2 }),
  status: text("status").default("ativa").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── AUTOMACOES ─────────────────────────────────────────────
export const automacoes = pgTable("automacoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  gatilho: text("gatilho").notNull(),
  condicao: jsonb("condicao"),
  acao: text("acao").notNull(),
  acaoConfig: jsonb("acao_config"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── WHATSAPP MENSAGENS ────────────────────────────────────
export const whatsappMensagens = pgTable(
  "whatsapp_mensagens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contatoId: uuid("contato_id"),
    leadId: uuid("lead_id").references(() => leads.id), // legacy, nullable
    sessaoId: uuid("sessao_id").references(() => whatsappSessao.id),
    telefone: text("telefone").notNull(),
    direcao: text("direcao").notNull(),
    tipo: text("tipo").default("text").notNull(),
    conteudo: text("conteudo"),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    mediaFilename: text("media_filename"),
    uazapiMessageId: text("uazapi_message_id").unique(),
    status: text("status").default("pending").notNull(),
    statusAt: timestamp("status_at", { withTimezone: true }),
    replyToId: uuid("reply_to_id"),
    templateNome: text("template_nome"),
    enviadoPorId: uuid("enviado_por_id").references(() => usuarios.id),
    dados: jsonb("dados"),
    reactions: jsonb("reactions").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_wa_msg_contato").on(table.contatoId),
    index("idx_wa_msg_lead_id").on(table.leadId),
    index("idx_wa_msg_telefone").on(table.telefone),
    index("idx_wa_msg_uazapi_id").on(table.uazapiMessageId),
    index("idx_wa_msg_created_at").on(table.createdAt),
    index("idx_wa_msg_enviado_por").on(table.enviadoPorId),
  ]
);

// ─── WHATSAPP TEMPLATES ────────────────────────────────────
export const whatsappTemplates = pgTable(
  "whatsapp_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    categoria: text("categoria").notNull(),
    conteudo: text("conteudo").notNull(),
    botoes: jsonb("botoes"),
    ativo: boolean("ativo").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_wa_templates_org").on(table.organizacaoId),
  ]
);

// ─── WHATSAPP SESSAO ───────────────────────────────────────
export const whatsappSessao = pgTable("whatsapp_sessao", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id), // nullable for shared sessions
  sessionName: text("session_name").notNull().unique(),
  label: text("label"), // human-readable e.g. "Vendas", "Suporte"
  isDefault: boolean("is_default").default(false).notNull(),
  apiToken: text("api_token"), // per-session wuzapi token (falls back to env)
  tipo: text("tipo").default("pessoal").notNull(), // 'pessoal' | 'compartilhada'
  assignStrategy: text("assign_strategy").default("manual"), // 'manual' | 'round_robin' | 'carga'
  status: text("status").default("disconnected").notNull(),
  phoneNumber: text("phone_number"),
  qrCode: text("qr_code"),
  lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_wa_sessao_org").on(table.organizacaoId),
  index("idx_wa_sessao_user").on(table.usuarioId),
]);

// ─── CADENCIA SDR (execuções por lead+toque) ───────────────
// Estado de cada toque da cadência SDR inbound (13 toques) por lead.
// Unique (lead_id, ordem): reenviar sobrescreve (upsert).
export const cadenciaExecucoes = pgTable(
  "cadencia_execucoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    leadId: uuid("lead_id").references(() => leads.id).notNull(),
    ordem: integer("ordem").notNull(), // número do toque (1..13)
    canal: text("canal").notNull(), // whatsapp | email | ligacao
    status: text("status").default("enviado").notNull(), // enviado | ligacao_feita
    enviadoPorId: uuid("enviado_por_id").references(() => usuarios.id), // quem clicou
    sessaoId: uuid("sessao_id").references(() => whatsappSessao.id), // sessão WhatsApp usada
    conteudoEnviado: text("conteudo_enviado"), // texto final (já editado) enviado
    enviadoEm: timestamp("enviado_em", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_cadencia_lead_ordem").on(table.leadId, table.ordem),
    index("idx_cadencia_org").on(table.organizacaoId),
    index("idx_cadencia_lead").on(table.leadId),
  ]
);

// ─── EMAIL CONTAS (CONNECTED ACCOUNTS) ────────────────────────
export const emailContas = pgTable(
  "email_contas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id).notNull(),
    tipo: text("tipo").notNull(), // google | microsoft | imap
    email: text("email").notNull(),
    nome: text("nome"),
    // OAuth tokens (encrypted)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
    // IMAP/SMTP config (for tipo=imap)
    imapHost: text("imap_host"),
    imapPort: integer("imap_port"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    imapUser: text("imap_user"),
    smtpUser: text("smtp_user"),
    imapPass: text("imap_pass"), // encrypted
    smtpPass: text("smtp_pass"), // encrypted
    // Sync state
    syncStatus: text("sync_status").default("active").notNull(), // active | paused | error
    syncMode: text("sync_mode").default("sync_all").notNull(), // sync_all | leads_only | label
    syncFiltroLabel: text("sync_filtro_label"), // Gmail label / MS folder ID / IMAP folder
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    deltaCursor: text("delta_cursor"), // for incremental sync (Graph delta, Gmail historyId)
    backfillStatus: text("backfill_status"), // null | running | completed | error
    backfillProgress: integer("backfill_progress"), // 0-100
    assinatura: text("assinatura"), // HTML signature appended to outgoing emails
    envioComo: text("envio_como"), // alias used as "From:" header when sending (e.g. contato@ as alias of scott@)
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_email_contas_org").on(table.organizacaoId),
    index("idx_email_contas_user").on(table.usuarioId),
  ]
);

// ─── EMAILS ───────────────────────────────────────────────────
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    contatoId: uuid("contato_id"),
    leadId: uuid("lead_id").references(() => leads.id), // legacy, nullable
    contaId: uuid("conta_id").references(() => emailContas.id),
    de: text("de").notNull(), // sender email
    para: text("para").notNull(), // recipient email
    cc: text("cc"),
    bcc: text("bcc"),
    assunto: text("assunto").notNull(),
    corpo: text("corpo").notNull(), // HTML body
    corpoTexto: text("corpo_texto"), // plain text fallback
    direcao: text("direcao").notNull(), // "in" | "out"
    status: text("status").default("sent").notNull(), // sent, failed, draft, queued
    lido: boolean("lido").default(true).notNull(),
    enviadoPorId: uuid("enviado_por_id").references(() => usuarios.id),
    messageId: text("message_id"), // SMTP Message-ID for threading
    inReplyTo: text("in_reply_to"), // threading reference
    threadId: text("thread_id"), // provider thread/conversation ID
    providerMessageId: text("provider_message_id"), // provider-specific message ID
    labels: jsonb("labels"), // provider labels/categories
    anexos: jsonb("anexos"), // [{name, url, size, mime}]
    sequenciaExecucaoId: uuid("sequencia_execucao_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_emails_contato").on(table.contatoId),
    index("idx_emails_lead_id").on(table.leadId),
    index("idx_emails_org").on(table.organizacaoId),
    index("idx_emails_created_at").on(table.createdAt),
    index("idx_emails_conta_id").on(table.contaId),
    index("idx_emails_thread_id").on(table.threadId),
    index("idx_emails_provider_msg_id").on(table.providerMessageId),
  ]
);

// ─── LEAD USER UNREAD (per-user unread counters) ──────────
export const leadUserUnread = pgTable("lead_user_unread", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "cascade" }).notNull(),
  whatsappNaoLidas: integer("whatsapp_nao_lidas").default(0).notNull(),
  emailNaoLidos: integer("email_nao_lidos").default(0).notNull(),
}, (table) => [
  index("idx_lead_user_unread_user").on(table.usuarioId),
  uniqueIndex("idx_lead_user_unread_unique").on(table.leadId, table.usuarioId),
]);

// ─── SERVICOS CATALOGO ─────────────────────────────────────
export const servicosCatalogo = pgTable(
  "servicos_catalogo",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    tipo: text("tipo").notNull(), // recorrente, avulso, setup
    moeda: text("moeda").default("BRL").notNull(), // BRL, USD, EUR, CAD
    valorSugerido: decimal("valor_sugerido", { precision: 12, scale: 2 }),
    unidade: text("unidade").default("mensal").notNull(), // mensal, hora, unidade, projeto
    stripeProductId: text("stripe_product_id"), // associação ao Produto do Stripe (checkout usa o produto real + preço da proposta)
    ativo: boolean("ativo").default(true).notNull(),
    ordem: integer("ordem").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_servicos_catalogo_org").on(table.organizacaoId),
    index("idx_servicos_catalogo_ativo").on(table.organizacaoId, table.ativo),
  ]
);

// ─── PROPOSTAS ─────────────────────────────────────────────
export const propostas = pgTable(
  "propostas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    leadId: uuid("lead_id").references(() => leads.id).notNull(),
    negocioId: uuid("negocio_id").references(() => negocios.id),
    numero: integer("numero").notNull(),
    versao: integer("versao").default(1).notNull(),
    propostaOriginalId: uuid("proposta_original_id"),
    moeda: text("moeda").default("BRL").notNull(), // BRL, USD, EUR, CAD
    status: text("status").default("rascunho").notNull(), // rascunho, enviada, aceita, recusada, expirada
    dataEmissao: date("data_emissao"),
    dataValidade: date("data_validade"),
    observacoes: text("observacoes"),
    condicoesPagamento: text("condicoes_pagamento"),
    totalRecorrente: decimal("total_recorrente", { precision: 12, scale: 2 }).default("0"),
    totalAvulso: decimal("total_avulso", { precision: 12, scale: 2 }).default("0"),
    totalGeral: decimal("total_geral", { precision: 12, scale: 2 }).default("0"),
    criadoPorId: uuid("criado_por_id").references(() => usuarios.id),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    // Checkout Stripe (assinatura) gerado a partir da proposta
    checkoutUrl: text("checkout_url"),
    stripeSessionId: text("stripe_session_id"),
    enviadaEm: timestamp("enviada_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_propostas_org").on(table.organizacaoId),
    index("idx_propostas_lead").on(table.leadId),
    index("idx_propostas_status").on(table.organizacaoId, table.status),
    index("idx_propostas_numero").on(table.organizacaoId, table.numero),
  ]
);

// ─── PROPOSTA ITENS ────────────────────────────────────────
export const propostaItens = pgTable(
  "proposta_itens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propostaId: uuid("proposta_id").references(() => propostas.id, { onDelete: "cascade" }).notNull(),
    servicoCatalogoId: uuid("servico_catalogo_id").references(() => servicosCatalogo.id),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    tipo: text("tipo").notNull(), // recorrente, avulso, setup
    moeda: text("moeda").default("BRL").notNull(), // BRL, USD, EUR, CAD (herda da proposta)
    quantidade: decimal("quantidade", { precision: 10, scale: 2 }).default("1").notNull(),
    valorUnitario: decimal("valor_unitario", { precision: 12, scale: 2 }).default("0").notNull(),
    desconto: decimal("desconto", { precision: 5, scale: 2 }).default("0"),
    descontoTipo: text("desconto_tipo").default("percentual").notNull(), // percentual | valor
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
    ordem: integer("ordem").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_proposta_itens_proposta").on(table.propostaId),
  ]
);

// ─── LABELS (TAGS) ──────────────────────────────────────────
export const labels = pgTable(
  "labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nome: text("nome").notNull(),
    cor: text("cor").notNull().default("#e23752"),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_labels_org").on(table.organizacaoId),
  ]
);

// ─── LEAD LABELS (JUNCTION) ─────────────────────────────────
export const leadLabels = pgTable(
  "lead_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    labelId: uuid("label_id").references(() => labels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_lead_labels_lead").on(table.leadId),
    index("idx_lead_labels_label").on(table.labelId),
  ]
);

// ─── CONTATO LISTAS (CATEGORIAS) ────────────────────────────
export const contatoListas = pgTable(
  "contato_listas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    cor: text("cor").notNull().default("#e23752"),
    descricao: text("descricao"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_contato_listas_org").on(table.organizacaoId),
  ]
);

// ─── LEAD LISTAS (JUNCTION) ─────────────────────────────────
export const leadListas = pgTable(
  "lead_listas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    listaId: uuid("lista_id").references(() => contatoListas.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_lead_listas_lead").on(table.leadId),
    index("idx_lead_listas_lista").on(table.listaId),
  ]
);

// ─── BUSCAS SALVAS (APOLLO SEARCHES) ────────────────────────
export const buscasSalvas = pgTable(
  "buscas_salvas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    filtros: jsonb("filtros").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_buscas_salvas_org").on(table.organizacaoId),
  ]
);

// ─── NEGOCIO LABELS (JUNCTION) ──────────────────────────────
export const negocioLabels = pgTable(
  "negocio_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "cascade" }).notNull(),
    labelId: uuid("label_id").references(() => labels.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_negocio_labels_negocio").on(table.negocioId),
    index("idx_negocio_labels_label").on(table.labelId),
    uniqueIndex("idx_negocio_labels_unique").on(table.negocioId, table.labelId),
  ]
);

// ─── CUSTOM FIELDS (DEFINITIONS) ─────────────────────────────
export const customFields = pgTable(
  "custom_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    entidade: text("entidade").notNull(), // 'lead' | 'empresa' | 'negocio'
    nome: text("nome").notNull(), // slug
    label: text("label").notNull(),
    tipo: text("tipo").notNull(), // 'text' | 'number' | 'date' | 'daterange' | 'enum' | 'boolean' | 'url'
    opcoes: jsonb("opcoes"), // for enum: ["opt1", "opt2"]
    obrigatorio: boolean("obrigatorio").default(false),
    ordem: integer("ordem").default(0),
    ativo: boolean("ativo").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_custom_fields_org").on(table.organizacaoId),
    index("idx_custom_fields_org_entity").on(table.organizacaoId, table.entidade),
  ]
);

// ─── NOTAS ───────────────────────────────────────────────────
export const notas = pgTable(
  "notas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    conteudo: text("conteudo").notNull(),
    autorId: uuid("autor_id").references(() => usuarios.id),
    pipedriveId: text("pipedrive_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notas_lead").on(table.leadId),
    index("idx_notas_negocio").on(table.negocioId),
    index("idx_notas_empresa").on(table.empresaId),
    index("idx_notas_org").on(table.organizacaoId),
  ]
);

// ─── REUNIÕES ──────────────────────────────────────────────
export const reunioes = pgTable(
  "reunioes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    negocioId: uuid("negocio_id").references(() => negocios.id),
    leadId: uuid("lead_id").references(() => leads.id),
    titulo: text("titulo").notNull(),
    data: timestamp("data", { withTimezone: true }).notNull(),
    duracao: integer("duracao"), // minutos
    tipo: text("tipo").default("call"), // call, presencial, video
    status: text("status").default("agendada"), // agendada, realizada, cancelada, no_show
    participantes: text("participantes").array(),
    link: text("link"), // URL da reunião (Outlook/Meet/Zoom) — colada pela SDR, ou o joinUrl/webLink devolvido ao criar o evento de verdade no Outlook do closer
    outlookEventId: text("outlook_event_id"), // id do evento no Outlook do closer (Graph), pra permitir cancelar/atualizar depois
    notas: text("notas"),
    transcript: text("transcript"),
    resumoTranscript: text("resumo_transcript"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_reunioes_negocio").on(table.negocioId),
    index("idx_reunioes_org").on(table.organizacaoId),
    index("idx_reunioes_lead").on(table.leadId),
  ]
);

// ─── DISPONIBILIDADE DE CLOSERS (agenda nativa, sem Calendly/Outlook) ──────
// Uma linha por closer: horário de trabalho recorrente + pausa de almoço.
// Usado pelo Agente SDR pra calcular slots livres (horário - reuniões - bloqueios).
export const closerDisponibilidade = pgTable(
  "closer_disponibilidade",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id).notNull(),
    // { inicio: "09:00", fim: "18:00", diasSemana: [1,2,3,4,5], timezone: "America/Sao_Paulo" }
    horarioTrabalho: jsonb("horario_trabalho").notNull(),
    // { inicio: "12:00", fim: "13:00" } — bloqueio diário recorrente. null = sem pausa fixa.
    pausaAlmoco: jsonb("pausa_almoco"),
    ativo: boolean("ativo").default(true).notNull(),
    // Fora do rodízio temporariamente (férias/folga) SEM sair da rotação permanente.
    // Pausada não recebe lead novo pela fila, mas continua agendável manualmente.
    pausadoRodizio: boolean("pausado_rodizio").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_closer_disponibilidade_usuario").on(table.usuarioId),
    index("idx_closer_disponibilidade_org").on(table.organizacaoId),
  ]
);

// Bloqueios pontuais (folga, compromisso externo, férias) — não recorrentes.
export const closerBloqueios = pgTable(
  "closer_bloqueios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id).notNull(),
    inicio: timestamp("inicio", { withTimezone: true }).notNull(),
    fim: timestamp("fim", { withTimezone: true }).notNull(),
    motivo: text("motivo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_closer_bloqueios_usuario").on(table.usuarioId),
    index("idx_closer_bloqueios_org").on(table.organizacaoId),
  ]
);

// ─── NEGOCIO SERVICOS (LEGACY - migrado para propostas/proposta_itens) ───
// Tabela mantida no banco para histórico, mas não mais usada no código.
// Dados foram migrados para propostas + proposta_itens em 2026-03-10.

// ─── CONTATOS (CHANNEL CONTACTS) ─────────────────────────────
export const contatos = pgTable(
  "contatos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    // Canal
    canal: text("canal").notNull(), // 'whatsapp' | 'email'
    nome: text("nome").notNull(),
    telefone: text("telefone"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    // Origem do canal
    sessaoId: uuid("sessao_id").references(() => whatsappSessao.id), // se canal=whatsapp
    contaId: uuid("conta_id").references(() => emailContas.id), // se canal=email
    // Atribuição
    responsavelId: uuid("responsavel_id").references(() => usuarios.id), // nullable = não atribuído
    // Vínculo CRM
    leadId: uuid("lead_id").references(() => leads.id),
    // Preview (denorm para lista de conversas)
    ultimaMsg: text("ultima_msg"),
    ultimaMsgAt: timestamp("ultima_msg_at", { withTimezone: true }),
    naoLidas: integer("nao_lidas").default(0).notNull(),
    // Meta
    zohoId: text("zoho_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Dedup: 1 contato WA por telefone por sessão
    uniqueIndex("idx_contatos_sessao_phone").on(table.sessaoId, table.telefone),
    // Dedup: 1 contato email por endereço por conta
    uniqueIndex("idx_contatos_conta_email").on(table.contaId, table.email),
    // Max 1 contato por lead por responsável
    uniqueIndex("idx_contatos_lead_responsavel").on(table.leadId, table.responsavelId),
    // Queries
    index("idx_contatos_org").on(table.organizacaoId),
    index("idx_contatos_responsavel").on(table.responsavelId),
    index("idx_contatos_lead").on(table.leadId),
    index("idx_contatos_ultima_msg").on(table.responsavelId, table.ultimaMsgAt),
  ]
);

// ─── EMAIL TEMPLATES ──────────────────────────────────────────
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    assunto: text("assunto").notNull(),
    corpo: text("corpo").notNull(), // HTML with {{variable}} placeholders
    variaveis: jsonb("variaveis"), // ["nome", "empresa", "cargo", ...]
    categoria: text("categoria"), // e.g. "prospecção", "follow-up", "onboarding"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_email_templates_org").on(table.organizacaoId),
  ]
);

// ─── EMAIL SEQUENCIAS ─────────────────────────────────────────
export const emailSequencias = pgTable(
  "email_sequencias",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    ativo: boolean("ativo").default(true).notNull(),
    gatilho: text("gatilho").default("manual").notNull(), // manual | novo_lead | mudanca_status
    gatilhoConfig: jsonb("gatilho_config"), // e.g. { status: "contatado" }
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_email_sequencias_org").on(table.organizacaoId),
  ]
);

// ─── EMAIL SEQUENCIA PASSOS ───────────────────────────────────
export const emailSequenciaPassos = pgTable(
  "email_sequencia_passos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequenciaId: uuid("sequencia_id").references(() => emailSequencias.id, { onDelete: "cascade" }).notNull(),
    ordem: integer("ordem").notNull(),
    tipo: text("tipo").notNull(), // email | espera | condicao
    templateId: uuid("template_id").references(() => emailTemplates.id),
    delayMinutos: integer("delay_minutos").default(0), // wait time before this step
    condicao: jsonb("condicao"), // e.g. { tipo: "respondeu", acao: "parar" }
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_email_seq_passos_seq").on(table.sequenciaId),
  ]
);

// ─── EMAIL SEQUENCIA EXECUCOES ────────────────────────────────
export const emailSequenciaExecucoes = pgTable(
  "email_sequencia_execucoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequenciaId: uuid("sequencia_id").references(() => emailSequencias.id, { onDelete: "cascade" }).notNull(),
    leadId: uuid("lead_id").references(() => leads.id).notNull(),
    contaId: uuid("conta_id").references(() => emailContas.id).notNull(),
    passoAtual: integer("passo_atual").default(0).notNull(),
    status: text("status").default("ativo").notNull(), // ativo | pausado | concluido | cancelado | erro
    proximaExecucaoAt: timestamp("proxima_execucao_at", { withTimezone: true }),
    iniciadoAt: timestamp("iniciado_at", { withTimezone: true }).defaultNow().notNull(),
    concluidoAt: timestamp("concluido_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_email_seq_exec_seq").on(table.sequenciaId),
    index("idx_email_seq_exec_lead").on(table.leadId),
    index("idx_email_seq_exec_status").on(table.status),
    index("idx_email_seq_exec_next").on(table.proximaExecucaoAt),
  ]
);

// ─── SDR MEMORY (replaces Supabase sdr_memory) ─────────────────
export const sdrMemory = pgTable(
  "sdr_memory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    phone: text("phone").notNull(),
    role: text("role").notNull(), // user | assistant | system
    content: text("content").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_sdr_memory_phone").on(table.phone, table.createdAt),
    index("idx_sdr_memory_org").on(table.organizacaoId),
  ]
);

// ─── AI SDR CONFIG (per-org) ────────────────────────────────────
export const aiSdrConfig = pgTable("ai_sdr_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  ativo: boolean("ativo").default(false).notNull(),
  groqApiKey: text("groq_api_key"), // encrypted
  modelo: text("modelo").default("llama-3.3-70b-versatile").notNull(),
  systemPrompt: text("system_prompt"),
  nomeAssistente: text("nome_assistente").default("Assistente").notNull(),
  idiomaResposta: text("idioma_resposta").default("pt-BR").notNull(),
  horarioComercial: jsonb("horario_comercial"), // { inicio, fim, diasSemana[], timezone }
  foraHorarioMsg: text("fora_horario_msg"),
  maxTokensResposta: integer("max_tokens_resposta").default(1024).notNull(),
  temperaturaModelo: text("temperatura_modelo").default("0.3").notNull(),
  handoffTriggers: jsonb("handoff_triggers"), // { keywords[], sentimentoNegativo, valorAlto }
  stageConfig: jsonb("stage_config"), // { [stage]: { ativo, prompt, objetivo, criterioConcluso, acaoAoConcluir } }
  styleGuide: text("style_guide"),
  knowledgeBase: text("knowledge_base"),
  rateLimitMsgs: integer("rate_limit_msgs").default(10).notNull(),
  rateLimitWindowMin: integer("rate_limit_window_min").default(60).notNull(),
  delayMinMs: integer("delay_min_ms").default(2000).notNull(),
  delayMaxMs: integer("delay_max_ms").default(5000).notNull(),
  debounceMs: integer("debounce_ms").default(5000).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_ai_sdr_config_org").on(table.organizacaoId),
]);

// ─── AI SDR CONTATO STATE (per-contact AI state) ────────────────
export const aiSdrContatoState = pgTable("ai_sdr_contato_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "cascade" }).notNull(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  aiAtivo: boolean("ai_ativo").default(true).notNull(),
  handoffAt: timestamp("handoff_at", { withTimezone: true }),
  handoffMotivo: text("handoff_motivo"),
  handoffUsuarioId: uuid("handoff_usuario_id").references(() => usuarios.id),
  ultimaAiMsgAt: timestamp("ultima_ai_msg_at", { withTimezone: true }),
  aiMsgsNaJanela: integer("ai_msgs_na_janela").default(0).notNull(),
  janelaResetAt: timestamp("janela_reset_at", { withTimezone: true }),
  qualificacaoExtraida: jsonb("qualificacao_extraida"),
  conversationSummary: text("conversation_summary"),
  intentDetectado: text("intent_detectado"),
  confianca: decimal("confianca", { precision: 3, scale: 2 }),
  totalTokensUsados: integer("total_tokens_usados").default(0).notNull(),
  totalMsgsAi: integer("total_msgs_ai").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_ai_sdr_contato_state_contato").on(table.contatoId),
  index("idx_ai_sdr_contato_state_org").on(table.organizacaoId),
]);

// ─── AI SDR LOGS (audit trail) ──────────────────────────────────
export const aiSdrLogs = pgTable("ai_sdr_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  contatoId: uuid("contato_id"),
  leadId: uuid("lead_id"),
  tipo: text("tipo").notNull(), // resposta, handoff, qualify, advance, erro
  inputContent: text("input_content"),
  outputContent: text("output_content"),
  intentDetectado: text("intent_detectado"),
  confianca: decimal("confianca", { precision: 3, scale: 2 }),
  dadosExtraidos: jsonb("dados_extraidos"),
  decisao: text("decisao"),
  motivo: text("motivo"),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  latenciaMs: integer("latencia_ms"),
  modeloUsado: text("modelo_usado"),
  erro: text("erro"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_sdr_logs_org").on(table.organizacaoId),
  index("idx_ai_sdr_logs_contato").on(table.contatoId),
  index("idx_ai_sdr_logs_tipo").on(table.tipo),
  index("idx_ai_sdr_logs_created").on(table.createdAt),
]);

// ─── Campanhas de Outreach (cold email / WhatsApp) — Callface ─────
export const outreachCampanhas = pgTable("outreach_campanhas", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  canal: text("canal").notNull().default("email"), // email | whatsapp
  assunto: text("assunto"),
  corpoHtml: text("corpo_html"),
  audiencia: jsonb("audiencia"), // { listas: [], contatoIds: [] }
  remetente: text("remetente"),
  status: text("status").notNull().default("rascunho"), // rascunho | agendada | enviando | concluida
  totalDestinatarios: integer("total_destinatarios").default(0),
  totalEnviados: integer("total_enviados").default(0),
  createdBy: uuid("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_outreach_campanhas_org").on(table.organizacaoId),
]);

// ═══════════════════════════════════════════════════════════════
// PÓS-VENDA CANÔNICO (08/09) — Won → Serviço → Onboarding/Implantação.
//
// Definições portadas sem renomear nada do CRM 2.0 (branch dev), pra que a
// subida do CRM2 completo encontre estas tabelas já povoadas em produção em
// vez de precisar migrar de novo. Ver lib/crm/pos-venda.ts.
//
// `servicos_canonicos` JÁ EXISTIA no banco de produção (413 linhas da
// reconciliação de agosto/2026) mas nunca esteve no schema.ts — a declaração
// abaixo apenas expõe ao Drizzle o que já está lá, sem alterar a tabela.
// ═══════════════════════════════════════════════════════════════

export const servicosCanonicos = pgTable(
  "servicos_canonicos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    contratoId: uuid("contrato_id").references(() => contratos.id, { onDelete: "set null" }),
    canonicalKey: text("canonical_key").notNull(),
    serviceFamily: text("service_family").notNull(), // PABX | CALLFACE_AI | WHITE_LABEL | UNKNOWN
    canonicalProduct: text("canonical_product"),
    revenueNature: text("revenue_nature").notNull(), // MRR | SETUP | PROJECT | ONE_TIME | USAGE | HARDWARE | UNKNOWN
    billingSource: text("billing_source").notNull(),
    commercialLifecycle: text("commercial_lifecycle").notNull(), // ACTIVE | CHURNED | SUPERSEDED
    billingStatus: text("billing_status").notNull(),
    // Fonte da verdade do current MRR — nunca recalcular por SUM(contratos.mrr).
    currentRecurringValue: decimal("current_recurring_value", { precision: 14, scale: 2 }).default("0").notNull(),
    currentSubscriptionId: text("current_subscription_id"),
    asOfDate: date("as_of_date"),
    portfolioIncluded: boolean("portfolio_included").default(false).notNull(),
    confidence: text("confidence").notNull(), // CONFIRMED | PROBABLE | AMBIGUOUS | UNRESOLVED
    evidence: jsonb("evidence").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_servicos_canonicos_org_key").on(table.organizacaoId, table.canonicalKey),
    index("idx_servicos_canonicos_portfolio").on(table.organizacaoId, table.portfolioIncluded, table.serviceFamily),
  ],
);

export const fulfillments = pgTable(
  "fulfillments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "cascade" }).notNull(),
    serviceFamily: text("service_family").notNull(), // denormalizado, pra filtrar sem join
    // Estado MACRO — nunca 1 status por etapa do checklist (isso vive em
    // fulfillment_itens). NOT_STARTED|IN_PROGRESS|WAITING_CUSTOMER|
    // BLOCKED_CUSTOMER|BLOCKED_INTERNAL|BLOCKED_PROVIDER|
    // READY_FOR_VALIDATION|COMPLETED|CANCELED
    status: text("status").default("NOT_STARTED").notNull(),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    targetAt: timestamp("target_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    escopoVendidoSnapshot: jsonb("escopo_vendido_snapshot"),
    // Token opaco pra página pública de coleta de informações do cliente
    // (formulário de implantação PABX) — nunca ID sequencial/previsível.
    publicToken: uuid("public_token").defaultRandom().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_fulfillments_servico").on(table.servicoCanonicoId),
    uniqueIndex("idx_fulfillments_public_token").on(table.publicToken),
    index("idx_fulfillments_org").on(table.organizacaoId),
    index("idx_fulfillments_status").on(table.organizacaoId, table.status),
  ],
);

export const fulfillmentItens = pgTable(
  "fulfillment_itens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    fulfillmentId: uuid("fulfillment_id").references(() => fulfillments.id, { onDelete: "cascade" }).notNull(),
    // Workstream é texto livre, não enum de banco — cresce conforme o
    // processo real. Nunca decidir a lista definitiva em código.
    workstream: text("workstream").notNull(),
    titulo: text("titulo").notNull(),
    // PENDING|IN_PROGRESS|BLOCKED|VALIDATION|DONE
    status: text("status").default("PENDING").notNull(),
    blockerType: text("blocker_type"), // CUSTOMER | INTERNAL | PROVIDER
    blockerReason: text("blocker_reason"),
    ordem: integer("ordem").default(0).notNull(),
    metadata: jsonb("metadata"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => usuarios.id),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    dueDate: timestamp("due_date", { withTimezone: true }),
    priority: text("priority"), // alta | media | baixa
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    blockerImpact: text("blocker_impact"), // alto | medio | baixo
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_fulfillment_itens_fulfillment").on(table.fulfillmentId),
    index("idx_fulfillment_itens_org").on(table.organizacaoId),
  ],
);

export const fulfillmentFormularios = pgTable(
  "fulfillment_formularios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    fulfillmentId: uuid("fulfillment_id").references(() => fulfillments.id, { onDelete: "cascade" }).notNull(),
    status: text("status").default("NOT_SENT").notNull(), // NOT_SENT|SENT|IN_PROGRESS|SUBMITTED|IN_REVIEW|CORRECTION_REQUIRED|APPROVED
    respostas: jsonb("respostas").default({}).notNull(),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    submetidoEm: timestamp("submetido_em", { withTimezone: true }),
    revisadoPor: uuid("revisado_por").references(() => usuarios.id),
    revisadoEm: timestamp("revisado_em", { withTimezone: true }),
    notaRevisao: text("nota_revisao"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_fulfillment_formularios_fulfillment").on(table.fulfillmentId),
    index("idx_fulfillment_formularios_org").on(table.organizacaoId),
  ],
);

export const fulfillmentRamais = pgTable(
  "fulfillment_ramais",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    fulfillmentId: uuid("fulfillment_id").references(() => fulfillments.id, { onDelete: "cascade" }).notNull(),
    departamento: text("departamento"),
    numeroExterno: text("numero_externo"),
    ramal: text("ramal"),
    usuario: text("usuario"),
    email: text("email"),
    celular: text("celular"),
    modeloAparelho: text("modelo_aparelho"),
    usaAparelhoFisico: boolean("usa_aparelho_fisico").default(false).notNull(),
    gravacao: boolean("gravacao").default(false).notNull(),
    ligacoesInternacionais: boolean("ligacoes_internacionais").default(false).notNull(),
    paisesPermitidos: text("paises_permitidos").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_fulfillment_ramais_fulfillment").on(table.fulfillmentId),
    index("idx_fulfillment_ramais_org").on(table.organizacaoId),
  ],
);

export const fulfillmentLinhasPortabilidade = pgTable(
  "fulfillment_linhas_portabilidade",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    fulfillmentId: uuid("fulfillment_id").references(() => fulfillments.id, { onDelete: "cascade" }).notNull(),
    ddd: text("ddd"),
    numero: text("numero"),
    tipo: text("tipo").notNull(), // portabilidade | nova_linha
    operadoraAtual: text("operadora_atual"),
    titular: text("titular"),
    anexoUrl: text("anexo_url"),
    anexoId: text("anexo_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_fulfillment_linhas_portabilidade_fulfillment").on(table.fulfillmentId),
    index("idx_fulfillment_linhas_portabilidade_org").on(table.organizacaoId),
  ],
);
