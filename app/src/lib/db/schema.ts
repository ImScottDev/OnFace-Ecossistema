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
  type AnyPgColumn,
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
  role: text("role").default("vendedor").notNull(), // admin | gerente | closer | sdr | leitor | director | coordinator | operations
  // F0/RBAC v2 (blueprint bloco 26/55): time do usuário, opcional — nem toda org usa.
  teamId: uuid("team_id").references((): AnyPgColumn => teams.id),
  avatarUrl: text("avatar_url"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_usuarios_org").on(table.organizacaoId),
  index("idx_usuarios_team").on(table.teamId),
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
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
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
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
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
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
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
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
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
    // Achado real (09/08): sem essa constraint, o onConflictDoNothing() em
    // negocios.ts (auto-tag "No-show") era um no-op — mesmo bug da spam de
    // notificações de SLA, escala bem menor aqui (1 duplicata real achada).
    uniqueIndex("idx_lead_labels_dedup").on(table.leadId, table.labelId),
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
    // Mesmo achado do lead_labels — onConflictDoNothing() em
    // contatos-unified.ts (add em lote pra lista) era no-op sem isso.
    uniqueIndex("idx_lead_listas_dedup").on(table.leadId, table.listaId),
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
  // F3 (09/08): formaliza o Human Handoff do blueprint (AI_HANDLING ->
  // HUMAN_REQUIRED -> HUMAN_ASSIGNED) — antes só existia aiAtivo (binário),
  // sem distinguir "handoff disparado, ninguém olhou ainda" de "humano já
  // assumiu de verdade". Mantido em sincronia com aiAtivo (aiAtivo=false
  // <=> status != 'ai_handling') pra não quebrar leitura de código legado.
  handoffStatus: text("handoff_status").default("ai_handling").notNull(), // ai_handling | human_required | human_assigned
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
// CRM 2.0 — FASE 2 (Communication Intelligence): communications, ai_analysis
// Schema V2 em paralelo (ADR-EXEC-003) — ligacoes/whatsapp_mensagens/emails
// continuam vivos, dual-write igual ao padrão de F1.
// ═══════════════════════════════════════════════════════════════

// ─── COMMUNICATIONS (unifica Call/WhatsApp/Email — distinta de Activity) ──
// Hoje são 3 tabelas paralelas sem abstração comum. `pessoaId` é o anchor
// (F1), não `leadIdLegado` direto — mesma disciplina de Attribution/Deal.
export const communications = pgTable("communications", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id),
  canal: text("canal").notNull(), // ligacao | whatsapp | email
  direcao: text("direcao"), // entrada | saida (null p/ ligacao, que não é bidirecional do mesmo jeito)
  conteudo: text("conteudo"), // corpo/mensagem, ou resumo no caso de ligação
  duracaoSegundos: integer("duracao_segundos"), // só ligação
  status: text("status"), // delivery status (whatsapp), sent/read (email), call_status (ligação)
  externalId: text("external_id"), // idempotency_key | uazapi_message_id | provider_message_id
  usuarioId: uuid("usuario_id").references(() => usuarios.id), // quem enviou/atendeu, quando aplicável
  ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull(),
  // Bridge de migração — canal já diz qual tabela legada, id aponta pra lá.
  origemLegadoId: uuid("origem_legado_id"),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_communications_org").on(table.organizacaoId),
  index("idx_communications_pessoa").on(table.pessoaId),
  index("idx_communications_canal").on(table.canal),
  index("idx_communications_ocorrido").on(table.ocorridoEm),
  uniqueIndex("idx_communications_external_id").on(table.canal, table.externalId),
]);

// ─── AI ANALYSIS (genérico — atachável a qualquer entidade) ───────
// Hoje extração de IA é silo por feature (SDR extrai só pra si, ligação tem
// resumo só pra si). Esta tabela é o destino comum, começando pelo padrão de
// qualidade já validado na integração Callface (resumo/sentimento real).
export const aiAnalysis = pgTable("ai_analysis", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  entityType: text("entity_type").notNull(), // communication | negocio | lead | proposta
  entityId: uuid("entity_id").notNull(),
  resumo: text("resumo"),
  sentimento: text("sentimento"), // positivo | negativo | neutro
  intencao: text("intencao"),
  objecoes: jsonb("objecoes"), // array de string
  necessidades: jsonb("necessidades"),
  proximosPassos: text("proximos_passos"),
  score: decimal("score", { precision: 4, scale: 2 }),
  risco: text("risco"),
  oportunidade: text("oportunidade"),
  modeloUsado: text("modelo_usado"),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_analysis_org").on(table.organizacaoId),
  index("idx_ai_analysis_entity").on(table.entityType, table.entityId),
]);

// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 5 (Automation): automacao_execucoes
// A tabela `automacoes` já existe (gatilho/condicao/acao/acaoConfig) mas
// nunca teve executor (achado confirmado: CRUD sem motor, UI já admite
// "em breve"). Esta tabela é o histórico de execução (blueprint bloco 31)
// que o motor novo (lib/crm/automacao-engine.ts) grava a cada disparo.
// ═══════════════════════════════════════════════════════════════
export const automacaoExecucoes = pgTable("automacao_execucoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  automacaoId: uuid("automacao_id").references(() => automacoes.id, { onDelete: "cascade" }).notNull(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  entityType: text("entity_type").notNull(), // lead | negocio | contato
  entityId: uuid("entity_id").notNull(),
  status: text("status").notNull(), // sucesso | erro | condicao_nao_atendida
  resultado: jsonb("resultado"),
  erro: text("erro"),
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_automacao_execucoes_automacao").on(table.automacaoId),
  index("idx_automacao_execucoes_org").on(table.organizacaoId),
  index("idx_automacao_execucoes_executed").on(table.executedAt),
]);

// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 0 (Foundation): teams, audit_log, event_outbox
// Ver docs/reconstruction/ARCHITECTURE_DECISIONS.md (ADR-EXEC-001, 005)
// ═══════════════════════════════════════════════════════════════

// ─── TEAMS (RBAC v2 — usuarios.teamId aponta pra aqui, F0/RBAC) ────
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  managerId: uuid("manager_id").references((): AnyPgColumn => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_teams_org").on(table.organizacaoId),
]);

// ─── AUDIT LOG (genérico — before/after, actor, qualquer entidade) ─
// Fecha o achado de segurança confirmado na auditoria: zero log de
// impersonation/org-switch hoje. Toda escrita crítica passa a gravar aqui.
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  actorId: uuid("actor_id").references(() => usuarios.id), // null = sistema/job/worker
  action: text("action").notNull(), // ex: "impersonate", "org_switch", "deal.win", "lead.enrich_bulk"
  entityType: text("entity_type").notNull(), // ex: "negocio", "usuario", "organizacao"
  entityId: uuid("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  source: text("source").notNull().default("api"), // api | worker | admin | webhook
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_audit_log_org").on(table.organizacaoId),
  index("idx_audit_log_actor").on(table.actorId),
  index("idx_audit_log_entity").on(table.entityType, table.entityId),
  index("idx_audit_log_created").on(table.createdAt),
]);

// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 1 (Domain Model): pessoas, oportunidades, clientes,
// pontos_contato. Schema V2 em paralelo ao legado (ADR-EXEC-003) —
// `leads`/`negocios`/`contatos` continuam vivos e são a fonte de verdade
// em produção durante a transição (dual-write, cutover só na F8).
// Nomes deliberadamente diferentes do legado pra nunca precisar renomear
// tabela depois: quando o legado for descomissionado (F8), estas já têm
// o nome final.
// ═══════════════════════════════════════════════════════════════

// ─── PESSOAS (identidade persistente — Contact do blueprint) ──────
// Resolve os 2 conceitos de "Contato" hoje desconectados (leads.tipo vs
// tabela `contatos` de canal). Pessoa é o registro permanente; Lead é só
// o estágio transitório de qualificação — uma Pessoa pode ter tido
// múltiplos Leads ao longo do tempo (reengajamento), todos apontando
// pra essa mesma identidade via Attribution (ver `pontosContato`).
export const pessoas = pgTable("pessoas", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id),
  nome: text("nome").notNull(),
  sobrenome: text("sobrenome"),
  email: text("email"),
  telefone: text("telefone"),
  whatsapp: text("whatsapp"),
  cargo: text("cargo"),
  // Bridge de migração/dual-write — NÃO é FK operacional (Deal não depende
  // disso pra existir, ver pontosContato pra atribuição real). Só ajuda o
  // backfill/reconciliação a rastrear de qual Lead legado esta Pessoa veio.
  leadIdLegado: uuid("lead_id_legado").references(() => leads.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_pessoas_org").on(table.organizacaoId),
  index("idx_pessoas_empresa").on(table.empresaId),
  index("idx_pessoas_email").on(table.email),
  index("idx_pessoas_lead_legado").on(table.leadIdLegado),
]);

// ─── PONTOS DE CONTATO (Attribution/Touchpoints — camada própria) ──
// Decisão fechada com o Kauã (08/08): atribuição de origem/campanha NUNCA
// depende de lead_id no Deal. Touchpoints conectam a Pessoa/Empresa
// (identidade persistente), sobrevivendo à conversão/expiração do Lead.
// Não confundir origem do LEAD com origem do DEAL — um mesmo relaciona-
// mento pode ter vários touchpoints (Google → Meta → WhatsApp → venda).
export const pontosContato = pgTable("pontos_contato", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id),
  empresaId: uuid("empresa_id").references(() => empresas.id),
  source: text("source"), // google | meta | rd_station | site | manual | indicacao | sdr | importacao
  medium: text("medium"),
  campaign: text("campaign"),
  term: text("term"),
  content: text("content"),
  landingPage: text("landing_page"),
  referrer: text("referrer"),
  campaignId: text("campaign_id"), // ID real na plataforma de origem (ex: Meta campaign_id)
  sourceId: text("source_id"),
  tipoOrigem: text("tipo_origem").notNull(), // manual | organica | indicacao | sdr | importacao | campanha
  // Mantidos explícitos (não só deriváveis por query) pra sustentar
  // analytics de funil por campanha sem depender de agregação pesada.
  isFirstTouch: boolean("is_first_touch").default(false).notNull(),
  isLastTouch: boolean("is_last_touch").default(false).notNull(),
  ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).defaultNow().notNull(),
  raw: jsonb("raw"), // payload cru da integração de origem, auditoria
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_pontos_contato_org").on(table.organizacaoId),
  index("idx_pontos_contato_pessoa").on(table.pessoaId),
  index("idx_pontos_contato_empresa").on(table.empresaId),
  index("idx_pontos_contato_pessoa_first").on(table.pessoaId, table.isFirstTouch),
  index("idx_pontos_contato_pessoa_last").on(table.pessoaId, table.isLastTouch),
]);

// ─── OPORTUNIDADES (Deal v2 — referencia Pessoa+Empresa, NÃO Lead) ──
// Decisão fechada: Deal não depende de lead_id. Atribuição de origem
// vive em `pontosContato`, não aqui — "de onde veio" se responde
// atravessando Pessoa/Empresa → pontosContato, nunca por FK direta pro Lead.
export const oportunidades = pgTable("oportunidades", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id),
  empresaId: uuid("empresa_id").references(() => empresas.id),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id),
  stage: text("stage").notNull(),
  responsavelId: uuid("responsavel_id").references(() => usuarios.id),
  valor: decimal("valor", { precision: 12, scale: 2 }),
  mrr: decimal("mrr", { precision: 12, scale: 2 }),
  probabilidade: integer("probabilidade"),
  previsaoFechamento: date("previsao_fechamento"),
  ganhoAt: timestamp("ganho_at", { withTimezone: true }),
  perdidoAt: timestamp("perdido_at", { withTimezone: true }),
  motivoPerda: text("motivo_perda"),
  // Bridge de migração/dual-write — mesma lógica de pessoas.leadIdLegado.
  negocioIdLegado: uuid("negocio_id_legado").references(() => negocios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_oportunidades_org").on(table.organizacaoId),
  index("idx_oportunidades_pessoa").on(table.pessoaId),
  index("idx_oportunidades_empresa").on(table.empresaId),
  index("idx_oportunidades_stage").on(table.stage),
  index("idx_oportunidades_responsavel").on(table.responsavelId),
  index("idx_oportunidades_negocio_legado").on(table.negocioIdLegado),
]);

// ─── CLIENTES (Customer — entidade agregadora, não existe hoje) ────
// Hoje "cliente" é só `leads.tipo = 'cliente'` no mesmo registro do Lead.
// Cliente passa a ser entidade própria: empresa + pessoa principal +
// status financeiro (cacheado pra leitura rápida, fonte real continua
// sendo contratos/assinaturas — ver Data Governance, ADR-EXEC-007).
export const clientes = pgTable("clientes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id),
  pessoaPrincipalId: uuid("pessoa_principal_id").references(() => pessoas.id),
  oportunidadeOrigemId: uuid("oportunidade_origem_id").references(() => oportunidades.id),
  clienteDesde: timestamp("cliente_desde", { withTimezone: true }),
  statusFinanceiro: text("status_financeiro"), // ativo | inadimplente | churned — cache de leitura, nunca fonte de escrita
  leadIdLegado: uuid("lead_id_legado").references(() => leads.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_clientes_org").on(table.organizacaoId),
  index("idx_clientes_empresa").on(table.empresaId),
]);

// ─── EVENT OUTBOX (espinha dorsal de eventos — Postgres + BullMQ) ──
// ADR-EXEC-001: outbox Postgres + worker BullMQ existente, sem broker novo.
// Escrito na MESMA transação da mudança de domínio; consumido por job
// dedicado que publica pros interessados (ex: DealWon -> CS/Finance/Analytics).
// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 5 (Automação): Cadence Engine — genérico, desacoplado de
// canal/provider de IA. Ver docs/reconstruction/ARCHITECTURE_DECISIONS.md
// (ADR-EXEC-013) e lib/cadencia/cadence-engine.ts.
// ═══════════════════════════════════════════════════════════════

export const cadenceDefinitions = pgTable("cadence_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  entityType: text("entity_type").notNull(), // lead | negocio | contato
  // CadenceStep[] — ver tipo em cadence-engine.ts. Cada step: {id, tipo (wait|action|condition),
  // adapter (nome registrado, ex: "whatsapp_message"|"ai_agent_message"), config, branches, retry}
  steps: jsonb("steps").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cadenceEnrollments = pgTable("cadence_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  cadenceDefinitionId: uuid("cadence_definition_id").references(() => cadenceDefinitions.id, { onDelete: "cascade" }).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  currentStepId: text("current_step_id"), // null antes do 1º step
  status: text("status").notNull().default("active"), // active | waiting | completed | cancelled | failed
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }), // próxima execução devida
  vars: jsonb("vars").default({}), // contexto acumulado (resolvido pelo caller: nome, empresa, telefone, etc)
  attempt: integer("attempt").default(0).notNull(), // tentativas do step ATUAL (retry)
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_cadence_enrollments_scheduled").on(table.status, table.scheduledAt),
  index("idx_cadence_enrollments_entity").on(table.entityType, table.entityId),
  index("idx_cadence_enrollments_org").on(table.organizacaoId),
]);

export const cadenceEnrollmentEvents = pgTable("cadence_enrollment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id").references(() => cadenceEnrollments.id, { onDelete: "cascade" }).notNull(),
  stepId: text("step_id").notNull(),
  status: text("status").notNull(), // executado | erro | condicao_nao_atendida | retry_agendado | cancelado
  resultado: jsonb("resultado"),
  attempt: integer("attempt").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_cadence_enrollment_events_enrollment").on(table.enrollmentId),
]);

// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 4 (Commercial): Commercial Evidence — Won não pode ficar
// acoplado só ao Stripe (achado real: PBX/venda manual fatura fora do
// Stripe). Ver docs/reconstruction/ARCHITECTURE_DECISIONS.md (ADR-EXEC-012).
// ═══════════════════════════════════════════════════════════════

export const comercialEvidencia = pgTable("comercial_evidencia", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "cascade" }).notNull(),
  // stripe_payment | stripe_subscription | signed_contract | manual_contract | admin_approval
  tipo: text("tipo").notNull(),
  sourceRef: text("source_ref"), // id do contrato/assinatura/subscription que originou a evidência
  metadata: jsonb("metadata"),
  verificadoPor: uuid("verificado_por").references(() => usuarios.id), // null = registrado automaticamente pelo sistema
  verificadoEm: timestamp("verificado_em", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_comercial_evidencia_negocio").on(table.negocioId),
  index("idx_comercial_evidencia_org").on(table.organizacaoId),
  uniqueIndex("idx_comercial_evidencia_dedup").on(table.negocioId, table.tipo, table.sourceRef),
]);

export const wonEvidencePolicies = pgTable("won_evidence_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  produto: text("produto"), // null = política catch-all (aplica a qualquer produto sem política específica)
  tiposAceitos: jsonb("tipos_aceitos").notNull(), // string[] de TipoEvidenciaComercial
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_won_evidence_policies_org").on(table.organizacaoId),
]);

// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 6 (Analytics): metricas_diarias — snapshot pré-computado
// dos agregados de empresa (meta/pipeline/fechado/MRR Stripe), pra sair da
// OLTP no caminho de leitura do dashboard. Os valores são calculados
// chamando as MESMAS funções canônicas já usadas pelo dashboard
// (getMetaComercialAgregada/getPipelineAtual/getFechadoPeriodo) — nunca
// reimplementados, pra não arriscar reintroduzir bug de contagem duplicada
// (ver comentário em dashboard/page.tsx sobre o achado de 22/07).
// Ver docs/reconstruction/ARCHITECTURE_DECISIONS.md (ADR-EXEC-011).
// ═══════════════════════════════════════════════════════════════

export const metricasDiarias = pgTable("metricas_diarias", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  data: date("data").notNull(),
  metaValorAlvo: decimal("meta_valor_alvo", { precision: 12, scale: 2 }).notNull(),
  metaRealizado: decimal("meta_realizado", { precision: 12, scale: 2 }).notNull(),
  metaClosers: integer("meta_closers").notNull(),
  pipelineTotal: decimal("pipeline_total", { precision: 14, scale: 2 }).notNull(),
  pipelinePonderado: decimal("pipeline_ponderado", { precision: 14, scale: 2 }).notNull(),
  pipelineNegociosAbertos: integer("pipeline_negocios_abertos").notNull(),
  fechadoMesGanhos: integer("fechado_mes_ganhos").notNull(),
  fechadoMesReceita: decimal("fechado_mes_receita", { precision: 14, scale: 2 }).notNull(),
  fechadoMesRecorrente: decimal("fechado_mes_recorrente", { precision: 14, scale: 2 }).notNull(),
  fechadoMesAvulso: decimal("fechado_mes_avulso", { precision: 14, scale: 2 }).notNull(),
  mrrStripe: decimal("mrr_stripe", { precision: 14, scale: 2 }).notNull(),
  mrrStripeClientes: integer("mrr_stripe_clientes").notNull(),
  mrrRisco: decimal("mrr_risco", { precision: 14, scale: 2 }).notNull(),
  mrrRiscoQtd: integer("mrr_risco_qtd").notNull(),
  calculadoEm: timestamp("calculado_em", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_metricas_diarias_org_data").on(table.organizacaoId, table.data),
]);

export const eventOutbox = pgTable("event_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  eventType: text("event_type").notNull(), // ex: "DealWon", "LeadCreated", "ContractSigned"
  aggregateType: text("aggregate_type").notNull(), // ex: "negocio", "lead", "contrato"
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").notNull(),
  correlationId: uuid("correlation_id"),
  idempotencyKey: text("idempotency_key"),
  status: text("status").notNull().default("pending"), // pending | processing | processed | failed
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_event_outbox_idempotency").on(table.idempotencyKey),
  index("idx_event_outbox_status").on(table.status),
  index("idx_event_outbox_org").on(table.organizacaoId),
  index("idx_event_outbox_aggregate").on(table.aggregateType, table.aggregateId),
]);
