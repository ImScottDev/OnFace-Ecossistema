import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  decimal,
  jsonb,
  inet,
  index,
  uniqueIndex,
  primaryKey,
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
  /** 'humano' | 'agente'. Agente = usuário sem login, ligado a `ai_agents` (migration 0097). */
  tipo: text("tipo").default("humano").notNull(),
  agenteId: uuid("agente_id"),
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
    // Módulo Vendas (SpecDrive Bloco 03 §17 / Bloco 05 §9) — dados jurídicos e
    // de endereço estruturados. Proposta contratual não pode ser enviada sem
    // eles, e o que o usuário preenche no bloqueio atualiza a EMPRESA, não
    // fica preso dentro da proposta.
    razaoSocial: text("razao_social"),
    logradouro: text("logradouro"),
    numero: text("numero"),
    complemento: text("complemento"),
    bairro: text("bairro"),
    // Identificador de deduplicação (Bloco 05 §18): coluna própria porque é
    // usada para casar duas empresas, não para exibir.
    dominio: text("dominio"),
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
    // Identidade canônica (reconciliação v1.1) — resolve duplicidade de
    // empresa (mesmo CNPJ importado 2x do Zoho). alias.canonicalEmpresaId
    // aponta pra empresa "de verdade"; nunca merge destrutivo.
    canonicalEmpresaId: uuid("canonical_empresa_id").references((): AnyPgColumn => empresas.id),
    identityConfidence: text("identity_confidence"), // CONFIRMED | PROBABLE | AMBIGUOUS | UNRESOLVED
    identityEvidence: jsonb("identity_evidence"),
    // Tags livres do Cliente 360 (mockup 20/08) — campo novo, aditivo.
    // Nasce vazio pra toda empresa; nunca populado automaticamente/em
    // massa, só via ação manual do usuário (PATCH /clientes-crm2/:id/tags).
    tags: text("tags").array().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_empresas_org").on(table.organizacaoId),
    index("idx_empresas_nome").on(table.nome),
    index("idx_empresas_canonical").on(table.canonicalEmpresaId),
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
    // Taxonomia nova de Pré-vendas do CRM2 (17/08) — ADITIVO, nunca substitui
    // sdrStatus. novo/em_contato/qualificacao/qualificado/agenda_confirmada
    // (fluxo principal) ou sem_resposta/nutricao_retomar/desqualificado
    // (buckets auxiliares). Populado 1x via backfill (scripts/migrate-pre-
    // vendas-crm2.ts) a partir da coluna REAL do board legado (sdrBoardColumn),
    // não do sdrStatus bruto — ver crm2PreVendasStageFonte pra rastreabilidade.
    crm2PreVendasStage: text("crm2_pre_vendas_stage"),
    // Coluna derivada do board legado que originou o crm2PreVendasStage acima
    // (pending/contacted/qualifying/m_qualified/m_reuniao/m_convertido/
    // disqualified/sdr_sem_retorno/sdr_sem_interesse/sdr_retomar_depois/
    // qualified_orfao/outbound) — preserva o rastro pra auditoria.
    crm2PreVendasStageFonte: text("crm2_pre_vendas_stage_fonte"),
    // Fatos históricos que o De/Para exige preservar mesmo quando não são
    // mais a etapa operacional atual (ex: lead que já teve reunião realizada
    // mas hoje está Qualificado). Fonte: status_changes (negócios vinculados
    // ao lead via negocio_leads), primeira ocorrência de cada transição.
    crm2ReuniaoRealizadaEm: timestamp("crm2_reuniao_realizada_em", { withTimezone: true }),
    crm2ClienteConvertidoEm: timestamp("crm2_cliente_convertido_em", { withTimezone: true }),
    crm2NoShowEm: timestamp("crm2_no_show_em", { withTimezone: true }),
    crm2MigradoEm: timestamp("crm2_migrado_em", { withTimezone: true }),
    outreachChannel: text("outreach_channel"), // whatsapp, email, instagram
    outreachStartedAt: timestamp("outreach_started_at", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
    // Closer oferecido pro lead durante o agendamento (round-robin fixado por lead,
    // não recalculado a cada turno — evita trocar de closer no meio da conversa
    // se outro lead fechar reunião nesse intervalo).
    agendaCloserId: uuid("agenda_closer_id").references(() => usuarios.id),
    // Identidade canônica (reconciliação v1.1) — mesma lógica de
    // empresas.canonicalEmpresaId, pro lead legado.
    canonicalLeadId: uuid("canonical_lead_id").references((): AnyPgColumn => leads.id),
    identityConfidence: text("identity_confidence"),
    identityEvidence: jsonb("identity_evidence"),

    // ─── Módulo 01 — Vendas (SpecDrive, 16/09) ─────────────────────────
    /** Etapa canônica de Pré-vendas. `crm2PreVendasStage` continua intacto
     *  como rastro do De/Para do board legado. */
    estagioPreVendas: text("estagio_pre_vendas"), // novo | em_contato | qualificacao | qualificado | oportunidade | nutricao | desqualificado
    /** Bloco 01 §10: o fato sobrevive à etapa. Um lead em Oportunidade
     *  continua tendo sido qualificado, e isso não depende de tag removível. */
    qualificado: boolean("qualificado").default(false).notNull(),
    qualificadoEm: timestamp("qualificado_em", { withTimezone: true }),
    qualificadoPor: uuid("qualificado_por").references(() => usuarios.id),
    qualificadoPorTipo: text("qualificado_por_tipo"), // HUMAN | AI_AGENT | AUTOMATION
    /** Qualificação estruturada (Bloco 01 §8). jsonb porque a spec prevê que a
     *  organização configure critérios mais rígidos depois. */
    qualificacao: jsonb("qualificacao"),
    qualificacaoIniciadaEm: timestamp("qualificacao_iniciada_em", { withTimezone: true }),
    nutricaoMotivo: text("nutricao_motivo"),
    nutricaoRetomarEm: date("nutricao_retomar_em"),
    nutricaoObservacao: text("nutricao_observacao"),
    nutridoEm: timestamp("nutrido_em", { withTimezone: true }),
    nutridoPor: uuid("nutrido_por").references(() => usuarios.id),
    desqualificacaoMotivo: text("desqualificacao_motivo"),
    desqualificacaoDetalhe: text("desqualificacao_detalhe"),
    desqualificadoEm: timestamp("desqualificado_em", { withTimezone: true }),
    desqualificadoPor: uuid("desqualificado_por").references(() => usuarios.id),
    desqualificadoDeEtapa: text("desqualificado_de_etapa"),
    /** Bloco 04 §11: fato do outbound, e NÃO o Qualificado de Pré-vendas. */
    preQualificado: boolean("pre_qualificado").default(false).notNull(),
    preQualificadoEm: timestamp("pre_qualificado_em", { withTimezone: true }),
    preQualificadoPor: uuid("pre_qualificado_por").references(() => usuarios.id),
    /** Estado operacional na workspace de Prospecção (Bloco 04 §3). */
    prospeccaoEstado: text("prospeccao_estado"), // novo | em_cadencia | respondeu | pre_qualificado | oportunidade | sem_resposta | descartado
    prospeccaoDescarteMotivo: text("prospeccao_descarte_motivo"),
    prospeccaoDescartadoEm: timestamp("prospeccao_descartado_em", { withTimezone: true }),
    prospeccaoDescartadoPor: uuid("prospeccao_descartado_por").references(() => usuarios.id),
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
    // Idempotência da reentrega da Meta (migration 0090). Parcial porque
    // `fb_lead_id` é nullable: o único que interessa é o id real do lead.
    uniqueIndex("idx_meta_lead_staging_fb_lead_id")
      .on(table.fbLeadId)
      .where(sql`fb_lead_id IS NOT NULL`),
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
    /** ACQUISITION | SALES (SPEC §8.2). O de aquisição é o board de pré-vendas. */
    tipo: text("tipo").default("SALES").notNull(),
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
    // Commercial motion (item 4 do gap de carteira, 20/08): NEW_BUSINESS |
    // EXPANSION | RENEWAL | REACTIVATION. Backfill real na migração: só
    // origemNegocio='carteira' virou REACTIVATION (sinal real de que o
    // negócio nasceu de uma empresa já cliente saindo do portfólio); todo o
    // resto ficou NEW_BUSINESS. EXPANSION/RENEWAL não têm sinal retroativo
    // real na base — não foram adivinhados, só passam a existir daqui pra
    // frente (ex: EXPANSION setado pelo fluxo "Nova oportunidade" a partir
    // do Cliente 360).
    commercialMotion: text("commercial_motion").default("NEW_BUSINESS").notNull(), // NEW_BUSINESS | EXPANSION | RENEWAL | REACTIVATION
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
    /** Expansão nasceu de qual serviço (commercialMotion = 'EXPANSION'). */
    servicoOrigemId: uuid("servico_origem_id").references((): AnyPgColumn => servicosCanonicos.id, { onDelete: "set null" }),
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
    // Classificação de recuperação legado (reconciliação v1.1). Vive aqui
    // (negócio LEGADO), não em `oportunidades` — ver ADR-EXEC-019: no domain
    // model novo, família/natureza são propriedade do item (oportunidadeItens),
    // não do container. Estes campos são snapshot/provenance histórico do
    // negócio legado, acessível via oportunidades.negocioIdLegado -> aqui.
    serviceFamily: text("service_family"), // PABX | CALLFACE_AI | WHITE_LABEL | UNKNOWN
    revenueNature: text("revenue_nature"),
    semanticConfidence: text("semantic_confidence"),
    semanticEvidence: jsonb("semantic_evidence"),
    semanticProvenance: text("semantic_provenance"),
    semanticAsOfDate: date("semantic_as_of_date"),
    // Commercial Core v3 (ADR-EXEC-022): quando esta venda nasceu de uma
    // composição multi-linha (ex: Callface AI + PABX), este negócio é UMA
    // das oportunidades irmãs — relacionadas via bundle, cada uma com
    // resultado (ganho/perdido) próprio e independente. Null = negócio
    // avulso, não faz parte de nenhuma composição multi-linha.
    bundleId: uuid("bundle_id").references((): AnyPgColumn => oportunidadeBundle.id),

    // ─── Módulo 01 — Vendas (SpecDrive, 16/09) ─────────────────────────
    /** Etapa canônica do Pipeline novo. `status` continua sendo o que o CRM
     *  legado, o financeiro e os relatórios leem; os dois são mantidos
     *  coerentes por `lib/vendas/pipeline.ts`, não por trigger, porque a
     *  tradução depende de contexto (no-show é evento, não etapa). */
    etapa: text("etapa"), // entrada | diagnostico | proposta | negociacao | ganho | perdido
    etapaDesde: timestamp("etapa_desde", { withTimezone: true }),
    /** Bloco 04 §13: não fingir que a oportunidade passou por Pré-vendas. */
    sourceProcess: text("source_process"), // PRE_SALES | OUTBOUND_DIRECT | MANUAL | EXPANSION
    proximaAcao: text("proxima_acao"),
    proximaAcaoEm: timestamp("proxima_acao_em", { withTimezone: true }),
    proximaAcaoResponsavelId: uuid("proxima_acao_responsavel_id").references(() => usuarios.id),
    /** Bloco 02 §12: no-show é evento; a oportunidade é preservada. */
    noShowEm: timestamp("no_show_em", { withTimezone: true }),
    noShowContagem: integer("no_show_contagem").default(0).notNull(),
    /** Bloco 02 §10: trial é estado contextual, não etapa. */
    trialIniciadoEm: timestamp("trial_iniciado_em", { withTimezone: true }),
    trialEncerradoEm: timestamp("trial_encerrado_em", { withTimezone: true }),
    motivoPerdaChave: text("motivo_perda_chave"),
    /** Bloco 02 §17: motivo de estagnação deixa de ser status. */
    motivoEstagnacao: text("motivo_estagnacao"), // sem_retorno | trava_negociacao | trava_assinatura | outra_data
    estagnadoEm: timestamp("estagnado_em", { withTimezone: true }),
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
    // Nullable desde 08/09: interação de CS acontece com a EMPRESA. Todo
    // registro antigo continua tendo lead — só deixou de ser obrigatório.
    leadId: uuid("lead_id").references(() => leads.id),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    negocioId: uuid("negocio_id").references(() => negocios.id),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    tipo: text("tipo").notNull(),
    titulo: text("titulo"),
    descricao: text("descricao"),
    dados: jsonb("dados"),
    duracaoSegundos: integer("duracao_segundos"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Recuperação legado Zoho (reconciliação v1.1).
    descricaoRaw: text("descricao_raw"),
    supersededByNoteId: uuid("superseded_by_note_id"),
    timelineVisible: boolean("timeline_visible").default(true).notNull(),
    usuarioDisplayName: text("usuario_display_name"),
    usuarioSourceId: text("usuario_source_id"),
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
  // Recuperação legado Zoho (reconciliação v1.1).
  confianca: text("confianca").default("confirmado").notNull(),
  evidencia: jsonb("evidencia"),
  zohoId: text("zoho_id"),
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
    status: text("status").default("ativo").notNull(), // ativo | pausado | concluido | churned | cancelado | renovado | pendente_assinatura
    notas: text("notas"),
    motivoChurn: text("motivo_churn"),
    finalizadoAt: timestamp("finalizado_at", { withTimezone: true }),
    zohoId: text("zoho_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    produto: text("produto"), // ai | pabx
    // Aceite eletrônico simples (não é assinatura digital qualificada — não
    // existe integração real ainda, ex: DocuSign/Clicksign; ver
    // crm2-decisoes-pendentes.md). Guarda nome/IP/timestamp de quem clicou
    // "concordo com os termos" na página pública, pra dar rastreabilidade
    // honesta enquanto a integração de verdade não é decidida.
    assinaturaStatus: text("assinatura_status").default("nao_aplicavel").notNull(), // nao_aplicavel | pendente | aceite_simples
    assinadoEm: timestamp("assinado_em", { withTimezone: true }),
    assinadoNome: text("assinado_nome"),
    assinadoIp: text("assinado_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Recuperação legado Zoho (reconciliação v1.1).
    assinaturaLegadoZoho: jsonb("assinatura_legado_zoho"),
    codigoLegado: text("codigo_legado"),
    commercialLifecycle: text("commercial_lifecycle"),
    currentRecurringValue: decimal("current_recurring_value", { precision: 14, scale: 2 }),
    multaPercentual: decimal("multa_percentual", { precision: 5, scale: 2 }),
    prazoMeses: integer("prazo_meses"),
    semanticConfidence: text("semantic_confidence"),
    semanticEvidence: jsonb("semantic_evidence"),
    serviceFamily: text("service_family"),
    // Commercial Core v2 (ADR-EXEC-021) — contrato passa a pertencer a um
    // GRUPO comercial da proposta (não à proposta inteira): numa venda mista,
    // o contrato do PABX não precisa esperar/travar o Callface AI sem
    // fidelidade da mesma proposta.
    grupoComercialId: uuid("grupo_comercial_id").references((): AnyPgColumn => propostaGrupoComercial.id),
    templateId: uuid("template_id").references(() => contratoTemplates.id),
    templateVersao: integer("template_versao"),
    variaveisPreenchidas: jsonb("variaveis_preenchidas"),
    // Texto já renderizado (template + variáveis) ANTES da assinatura — o
    // que o cliente lê na página pública. documentoFinalUrl é o documento
    // FINAL assinado (futuro, quando um provider real existir).
    corpoGerado: text("corpo_gerado"),
    documentoFinalUrl: text("documento_final_url"),
    // SignatureProvider (ADR-EXEC-021) — status normalizado, provider-agnóstico.
    // assinatura_status/assinado_* continuam sendo o armazenamento concreto
    // do provider atual (aceite eletrônico simples); signature_status é o
    // que qualquer provider futuro (DocuSign/Clicksign) também preenche.
    signatureProviderRef: text("signature_provider_ref"),
    // Frente 2C.1 — preparo pro provider externo (Autentique/Documenso, 2C.3).
    // Nenhuma integração nova é ligada aqui; é só onde o dado vai morar.
    signatureProvider: text("signature_provider"), // simple_electronic | documenso | autentique
    signatureEnviadoEm: timestamp("signature_enviado_em", { withTimezone: true }),
    signaturePublicUrl: text("signature_public_url"),
    signatureStatus: text("signature_status"), // contract_created|sent_for_signature|opened|signed|declined|expired|canceled
    // Lista estruturada congelada no momento da geração. O provider externo
    // pode ter sua própria tabela de recipients, mas o CRM preserva a cópia
    // que originou o envelope para auditoria e Cliente 360.
    signatarios: jsonb("signatarios"),
    // Estado do envio da cópia final por e-mail. Resend é apenas transporte;
    // o CRM precisa saber se enviou, falhou ou ficou pendente para retry.
    emailEntrega: jsonb("email_entrega"),
    // O link público do PDF guarda somente o hash do bearer token. O token cru
    // nunca é persistido e expira, permitindo reenvio seguro da cópia final.
    documentoPublicoTokenHash: text("documento_publico_token_hash"),
    documentoPublicoExpiraEm: timestamp("documento_publico_expira_em", { withTimezone: true }),
    // Vínculo canônico (migrations 0063 a 0066). Declarado aqui porque
    // coluna que existe no banco e não no Drizzle é invisível para o código.
    ofertaComercialId: uuid("oferta_comercial_id"),
    oportunidadeId: uuid("oportunidade_id"),
    empresaId: uuid("empresa_id"),
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
    // Reconciliação v1.1: carteira canônica / current MRR.
    servicoId: uuid("servico_id").references((): AnyPgColumn => servicosCanonicos.id),
    revenueNature: text("revenue_nature"),
    billingStatus: text("billing_status"),
    commercialLifecycle: text("commercial_lifecycle"),
    semanticConfidence: text("semantic_confidence"),
    semanticEvidence: jsonb("semantic_evidence"),
  },
  (table) => [
    uniqueIndex("idx_assinaturas_stripe_id").on(table.stripeSubscriptionId),
    index("idx_assinaturas_org").on(table.organizacaoId),
    index("idx_assinaturas_status").on(table.status),
    index("idx_assinaturas_empresa").on(table.empresaId),
  ]
);

// ─── ASSINATURA_ITENS (Subscription Items — 19/08, correção de escopo) ────
// Gap real confirmado por investigação: `assinaturas` é 1 linha por
// subscription do Stripe — multi-item (ex: White Label licença MRR + setup
// + adicional na MESMA subscription) hoje é resumido ("price do item0 +
// quantidade somada"), perde granularidade real de produto/preço por item.
// O sync e o webhook materializam os itens nesta tabela. A granularidade
// operacional de preço/quantidade vem daqui; `assinaturas.raw` continua
// guardado como evidência do payload da Stripe.
export const assinaturaItens = pgTable(
  "assinatura_itens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    assinaturaId: uuid("assinatura_id").references(() => assinaturas.id, { onDelete: "cascade" }).notNull(),
    stripeSubscriptionItemId: text("stripe_subscription_item_id"),
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    produto: text("produto"),
    quantidade: integer("quantidade").default(1).notNull(),
    precoUnitario: decimal("preco_unitario", { precision: 12, scale: 2 }),
    moeda: text("moeda").default("BRL").notNull(),
    recurringInterval: text("recurring_interval"), // month | year | null (item avulso/one-time dentro da subscription)
    serviceFamily: text("service_family").default("UNKNOWN").notNull(),
    revenueNature: text("revenue_nature"),
    servicoCanonicoId: uuid("servico_canonico_id").references((): AnyPgColumn => servicosCanonicos.id),
    descontoPercentual: decimal("desconto_percentual", { precision: 5, scale: 2 }),
    // Comportamento declarado do item (o que o Stripe reportar), não decisão
    // de política — quem decide QUANDO aplicar proração é a policy comercial,
    // não este campo.
    prorationBehavior: text("proration_behavior"), // create_prorations | none | always_invoice
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    status: text("status"), // null = herda o status da assinatura pai
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_assinatura_itens_stripe_id").on(table.stripeSubscriptionItemId),
    index("idx_assinatura_itens_assinatura").on(table.assinaturaId),
    index("idx_assinatura_itens_org").on(table.organizacaoId),
  ]
);

// ─── BILLING IDENTITIES (customer Stripe canônico + aliases históricos) ────
// Uma empresa pode ter Customers Stripe legados sem que isso autorize mesclar
// cobranças. O vínculo é CRM-only e preserva cada ID histórico para auditoria.
//
// CONVERGIDA no merge de 20/09: os dois lados guardavam o ID do evento Stripe
// em colunas diferentes — `stripe_event_id` (produção) e `event_id` (dev). O
// PLANO-DE-CARGA já decidiu e o script de carga já executou: `event_id` é a
// canônica, e `status` é minúsculo. O banco carregado de produção confirma:
// existe só `event_id`, default 'pending', sem CHECK de maiúsculas.
// `lib/integrations/stripe-webhook-events.ts` foi ajustado junto.
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: text("event_id").notNull(),
    // ── só no dev ──
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    apiVersion: text("api_version"),
    livemode: boolean("livemode"),
    // ── comuns aos dois lados ──
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").default("pending").notNull(), // pending|processing|processed|failed|unresolved
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    // ── só em produção ──
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    // ── só no dev ──
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_stripe_webhook_events_event_id").on(table.eventId),
    // Mantido o índice de produção: (status, receivedAt). O do dev tinha o
    // MESMO nome cobrindo só (status) — prefixo desta composta, então é
    // coberto por ela; não dá pra declarar os dois com o mesmo nome.
    index("idx_stripe_webhook_events_status").on(table.status, table.receivedAt),
    index("idx_stripe_webhook_events_org").on(table.organizacaoId),
    index("idx_stripe_webhook_events_received").on(table.receivedAt),
  ],
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
    // Frente 2C.1 — de onde a pendência nasceu. Reusar `faturas` pra
    // pendência de pagamento pós-contrato faz o recebível aparecer no
    // Financeiro e na Carteira sem tela nova; faltava só a rastreabilidade
    // de volta pro negócio/grupo que a originou.
    negocioId: uuid("negocio_id").references(() => negocios.id),
    grupoComercialId: uuid("grupo_comercial_id").references((): AnyPgColumn => propostaGrupoComercial.id),
    servicoCanonicoId: uuid("servico_canonico_id").references((): AnyPgColumn => servicosCanonicos.id),
    origem: text("origem").notNull(), // stripe | pabx | crm2_comercial
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
    // Recuperação legado Zoho (reconciliação v1.1).
    receivableState: text("receivable_state"),
    semanticConfidence: text("semantic_confidence"),
    semanticEvidence: jsonb("semantic_evidence"),
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
    /* O dono comercial do movimento. Sem ele, expansão feita no Stripe entrava
       no MRR e sumia da atribuição — nenhum closer creditado. Ver 0094. */
    negocioId: uuid("negocio_id").references((): AnyPgColumn => negocios.id, { onDelete: "set null" }),
    /** `true` quando a alteração veio de fora do CRM (alguém mexeu no Stripe). */
    detectadoForaDoCrm: boolean("detectado_fora_do_crm").default(false).notNull(),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    produto: text("produto").notNull(), // ai | pabx
    tipo: text("tipo").notNull(), // novo | expansao | contracao | churn | reativacao
    delta: decimal("delta", { precision: 12, scale: 2 }).notNull(), // negativo p/ contração/churn
    mrrAntes: decimal("mrr_antes", { precision: 12, scale: 2 }).notNull(),
    mrrDepois: decimal("mrr_depois", { precision: 12, scale: 2 }).notNull(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull(),
    origem: text("origem").notNull(), // stripe_sync | backfill | pabx_import
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Idempotency key do backfill de recuperação legado (evento_comercial ->
    // mrr_movimento, só quando financeiramente determinístico — ver
    // ADR-EXEC-019). Sem isso, reexecutar o backfill duplicava o movimento.
    eventoComercialId: uuid("evento_comercial_id").references(() => eventosComerciais.id),
  },
  (table) => [
    index("idx_mrr_mov_ocorrido").on(table.ocorridoEm),
    index("idx_mrr_mov_assinatura").on(table.assinaturaId),
    index("idx_mrr_mov_tipo").on(table.tipo),
    index("idx_mrr_mov_org").on(table.organizacaoId),
    uniqueIndex("idx_mrr_movimentos_evento_comercial").on(table.eventoComercialId).where(sql`evento_comercial_id IS NOT NULL`),
  ]
);

// ─── NPS RESPOSTAS ──────────────────────────────────────────
export const npsRespostas = pgTable(
  "nps_respostas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id),
    // Nullable desde 08/09: health check pertence à EMPRESA — cliente sem
    // lead cadastrado também responde.
    leadId: uuid("lead_id").references(() => leads.id),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    score: integer("score"),
    comentario: text("comentario"),
    /** Questionário completo do health check — ver QUESTIONARIO_HEALTH_CHECK. */
    respostas: jsonb("respostas"),
    /** Checkpoint em que o health check foi colhido, quando veio de um. */
    marcoId: uuid("marco_id"),
    registradoPor: uuid("registrado_por").references(() => usuarios.id),
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
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
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
    // Estado operacional (migration 0046): a_fazer | em_andamento |
    // aguardando | concluida | declinada. `concluida` continua existindo para
    // as rotinas antigas; um trigger mantém os dois em sincronia.
    status: text("status").default("a_fazer").notNull(),
    // Eixo pós-venda (08/09) — lead/negócio são objetos de aquisição; o CS
    // trabalha por empresa e, quando faz sentido, por serviço.
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "set null" }),
    // MANUAL | PLAYBOOK | BILLING | ONBOARDING | IMPLANTACAO | RENOVACAO | RISCO | EXPANSAO | AUTOMACAO
    origem: text("origem").default("MANUAL").notNull(),
    motivo: text("motivo"),
    /** Trava das tarefas automáticas: o sweep pode rodar N vezes, a tarefa nasce uma. */
    chaveIdempotencia: text("chave_idempotencia"),
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

/** Subtarefa da atividade (migration 0111): o checklist da gaveta de atividade. */
export const tarefaSubtarefas = pgTable(
  "tarefa_subtarefas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    tarefaId: uuid("tarefa_id").references(() => tarefas.id, { onDelete: "cascade" }).notNull(),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    concluida: boolean("concluida").default(false).notNull(),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    ordem: integer("ordem").default(0).notNull(),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
    venceEm: date("vence_em"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => usuarios.id, { onDelete: "set null" }),
  },
  (table) => [
    index("idx_tarefa_subtarefas_tarefa").on(table.tarefaId, table.ordem),
    index("idx_tarefa_subtarefas_org").on(table.organizacaoId),
  ]
);

/** Comentário da atividade (migration 0111). `mencoes` = ids dos usuários citados com @. */
export const tarefaComentarios = pgTable(
  "tarefa_comentarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    tarefaId: uuid("tarefa_id").references(() => tarefas.id, { onDelete: "cascade" }).notNull(),
    autorId: uuid("autor_id").references(() => usuarios.id, { onDelete: "set null" }),
    corpo: text("corpo").notNull(),
    mencoes: jsonb("mencoes").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    editadoEm: timestamp("editado_em", { withTimezone: true }),
  },
  (table) => [
    index("idx_tarefa_comentarios_tarefa").on(table.tarefaId, table.createdAt),
    index("idx_tarefa_comentarios_org").on(table.organizacaoId),
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
  tipo: text("tipo"),
  currentVersionId: uuid("current_version_id"),
  createdById: uuid("created_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Construtor de Automações (0092): rascunho { grafo, config } sobrescrito pelo
  // autosave; cada Publicar vira linha imutável em automacao_versoes.
  rascunho: jsonb("rascunho"),
  rascunhoSalvoEm: timestamp("rascunho_salvo_em", { withTimezone: true }),
  pasta: text("pasta"),
  webhookToken: text("webhook_token"),
  proximaExecucaoEm: timestamp("proxima_execucao_em", { withTimezone: true }),
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

// ─── SCRIPTS DE ATENDIMENTO (19/08, correção de escopo — P0.6) ───────────
// Roteiro humano pra ligação/conversa (não confundir com whatsapp_templates,
// que é mensagem pronta pra enviar). Versionado (integer simples, mesmo
// padrão de contrato_templates) — script pode mudar, mas não reescreve a
// versão que o vendedor usou numa ligação passada (auditoria/performance
// futura). Categoria é texto livre por área operacional (pre_vendas |
// comercial | entrega | cs | geral), nunca enum travado — cresce conforme
// o time cria.
export const scriptsAtendimento = pgTable(
  "scripts_atendimento",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    titulo: text("titulo").notNull(),
    categoria: text("categoria").notNull(), // pre_vendas | comercial_b2b | implantacao_entrega | onboarding | cs | cobranca_financeiro | geral
    conteudo: text("conteudo").notNull(),
    versao: integer("versao").default(1).notNull(),
    ativo: boolean("ativo").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_scripts_atendimento_org").on(table.organizacaoId),
  ]
);

// ─── DOCUMENTOS DE ATENDIMENTO (19/08, P0.6) — biblioteca de material pra
// enviar durante a conversa (apresentação/deck/PDF), diferente de
// anexos_legado (histórico Zoho, read-only) e de contratos/propostas
// (documento transacional). Taxonomia livre (categoria: texto), arquivo
// vive fora do banco (URL), versão simples pra não perder o antigo quando
// trocar o material.
export const documentosAtendimento = pgTable(
  "documentos_atendimento",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    titulo: text("titulo").notNull(),
    categoria: text("categoria").notNull(), // apresentacao | tecnico | comercial | manual | outro
    familia: text("familia"), // CALLFACE_AI | PABX | WHITE_LABEL | null (genérico, qualquer família)
    arquivoUrl: text("arquivo_url").notNull(),
    descricao: text("descricao"),
    ativo: boolean("ativo").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_documentos_atendimento_org").on(table.organizacaoId),
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
  /** Para que serve o número: comercial | atendimento | suporte | sdr | cs | outro (migration 0102). */
  finalidade: text("finalidade"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_wa_sessao_org").on(table.organizacaoId),
  index("idx_wa_sessao_user").on(table.usuarioId),
]);

/** Quem pode usar um número além do dono (número compartilhado). Migration 0102. */
export const whatsappSessaoAcesso = pgTable("whatsapp_sessao_acesso", {
  sessaoId: uuid("sessao_id").references(() => whatsappSessao.id, { onDelete: "cascade" }).notNull(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "cascade" }).notNull(),
  concedidoPor: uuid("concedido_por").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.sessaoId, table.usuarioId] }),
  index("idx_wa_sessao_acesso_usuario").on(table.usuarioId),
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
    descricao: text("descricao"), // description do Stripe (a sincronização sobrescreve)
    // Texto de venda do ONFACE (migration 0109): ganha da description do Stripe
    // em toda tela; a sincronização nunca o toca. Ver lib/catalogo/rotulos.ts.
    descricaoComercial: text("descricao_comercial"),
    tipo: text("tipo").notNull(), // recorrente, avulso, setup
    moeda: text("moeda").default("BRL").notNull(), // BRL, USD, EUR, CAD
    valorSugerido: decimal("valor_sugerido", { precision: 12, scale: 2 }),
    unidade: text("unidade").default("mensal").notNull(), // mensal, hora, unidade, projeto
    stripeProductId: text("stripe_product_id"), // associação ao Produto do Stripe (checkout usa o produto real + preço da proposta)
    // Categoria comercial real (ex: "callface_ai", "pabx") — livre, não enum de
    // banco: nasce só com o que existe de fato no catálogo, cresce conforme
    // produtos novos entram. Usada pra agrupar o builder de proposta por
    // categoria E pra derivar o próximo passo comercial (ver requerContrato).
    categoria: text("categoria"),
    // Família comercial declarada no catálogo (ADR-EXEC-020) — nunca inferida
    // por nome/categoria em runtime. Todo item novo precisa declarar a sua;
    // é o que permite oportunidade_itens carregar família real sem
    // string-match. PABX | CALLFACE_AI | WHITE_LABEL | UNKNOWN.
    serviceFamily: text("service_family").notNull().default("UNKNOWN"),
    // Natureza de receita do item (19/08) — mesma semântica de
    // oportunidade_itens/contrato_itens/proposta_itens, agora também na
    // origem (catálogo), pra não nascer UNKNOWN em item novo.
    // MRR | SETUP | PROJECT | ONE_TIME | USAGE | HARDWARE | UNKNOWN
    revenueNature: text("revenue_nature").notNull().default("UNKNOWN"),
    // Regra comercial explícita, não inferida do nome/categoria: alguns itens
    // exigem formalização contratual (assinatura) antes do pagamento (ex:
    // PABX), outros vão direto pro pagamento (ex: Callface AI). Fica no
    // catálogo pra ser extensível sem tocar em código — ver
    // lib/crm/proposta-fluxo.ts (determinarProximoPasso).
    // Legado — mantido por compat (dashboards/queries antigas), mas não é
    // mais a fonte de verdade do fluxo pós-aceite. Ver commercialModelPadrao.
    requerContrato: boolean("requer_contrato").default(false).notNull(),
    // Campos semânticos do item (19/08, correção de escopo) — descrevem
    // COMPORTAMENTO comercial declarado no catálogo, nunca inferido por nome
    // em runtime. Servem pro Proposal Builder/Won-gate/Billing decidirem sem
    // if-by-name. Default conservador: false/UNIT até existir evidência real
    // pra marcar diferente (não presumir capacidade que não foi validada).
    quantityBehavior: text("quantity_behavior").default("UNIT").notNull(), // UNIT | CAPACITY | LICENSE_SEATS
    requiresSignature: boolean("requires_signature").default(false).notNull(),
    requiresPaymentBeforeWon: boolean("requires_payment_before_won").default(false).notNull(),
    createsCanonicalService: boolean("creates_canonical_service").default(true).notNull(),
    createsFulfillment: boolean("creates_fulfillment").default(false).notNull(),
    supportsUpgrade: boolean("supports_upgrade").default(false).notNull(),
    supportsDowngrade: boolean("supports_downgrade").default(false).notNull(),
    supportsProration: boolean("supports_proration").default(false).notNull(),
    // Commercial Core v2 (ADR-EXEC-021): DEFAULT do modelo comercial pro
    // item — não é mais propriedade fixa/única da família. A mesma família
    // (ex: Callface AI) pode ser vendida sob modelos diferentes conforme a
    // negociação (com ou sem fidelidade) — o vendedor pode sobrescrever isso
    // por item na proposta (proposta_itens.commercial_model). Este campo é só
    // a sugestão/default do catálogo.
    // PAGAMENTO_DIRETO | CONTRATO_OBRIGATORIO | CONTRATO_FIDELIDADE_OPCIONAL
    commercialModelPadrao: text("commercial_model_padrao").default("PAGAMENTO_DIRETO").notNull(),
    // Catálogo Oficial Stripe (02/09) — separa o catálogo oficial das 218
    // linhas históricas do Zoho sem tocar em nenhuma delas: o default
    // 'legado' já descreve corretamente o que estava no banco.
    origemCatalogo: text("origem_catalogo").default("legado").notNull(), // oficial_stripe | legado
    skuProduto: text("sku_produto"),
    descricaoExtrato: text("descricao_extrato"), // como aparece na fatura do cartão
    etiquetaUnidade: text("etiqueta_unidade"), // "usuário", "licença ativa", "ramal"
    destinoPosVenda: text("destino_pos_venda"), // onboarding_callface_ai | implantacao_pabx | implantacao_white_label
    observacaoOperacional: text("observacao_operacional"),
    catalogoSincronizadoEm: timestamp("catalogo_sincronizado_em", { withTimezone: true }),
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
/**
 * Catálogo Oficial Stripe (02/09) — PRICE / VARIAÇÃO de um produto.
 *
 * Um produto tem N prices de verdade: Callface AI Starter é mensal + anual,
 * PABX Hardware tem 45 variações, White Label Setup e Licença têm 4 faixas
 * cada. Espremer isso em `servicos_catalogo.valor_sugerido` obrigaria a criar
 * 213 "produtos" no CRM — exatamente o que a regra do catálogo proíbe (um
 * produto Stripe = um produto CRM).
 *
 * `revenueNature` vive AQUI, não só no produto, porque varia entre prices do
 * MESMO produto: PABX Hardware tem 11 prices avulsos e 34 recorrentes.
 */
export const catalogoPrecos = pgTable("catalogo_precos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  servicoCatalogoId: uuid("servico_catalogo_id").references(() => servicosCatalogo.id, { onDelete: "cascade" }).notNull(),

  stripePriceId: text("stripe_price_id").notNull(),
  sku: text("sku"),
  lookupKey: text("lookup_key"), // CHAVE_DE_PESQUISA_PRICE — busca no builder e no Stripe

  variacao: text("variacao").notNull(), // "Mensal", "Faixa 1 — 1 a 99 licenças", "Telefone Fanvil X3"
  descricao: text("descricao"),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  moeda: text("moeda").default("BRL").notNull(),

  tipo: text("tipo").notNull(), // recorrente | avulso | setup (mesmo enum de proposta_itens)
  recorrente: boolean("recorrente").default(false).notNull(),
  periodo: text("periodo"), // mensal | anual | unico
  revenueNature: text("revenue_nature").notNull(), // MRR | SETUP | ONE_TIME | USAGE | HARDWARE
  modeloCobranca: text("modelo_cobranca"), // recorrencia_mensal | recorrencia_anual | avulso | avulso_ou_parcelavel
  modeloPrecoStripe: text("modelo_preco_stripe"), // Tarifa fixa | Tarifa fixa por unidade

  // Exigência de contrato POR PRICE. Regra explícita do briefing: White Label
  // Licença vendida isoladamente pra quem já é White Label NÃO exige
  // contrato; o Setup exige. A planilha declara os dois.
  exigeContrato: boolean("exige_contrato").default(false).notNull(),

  observacao: text("observacao"),
  ativo: boolean("ativo").default(true).notNull(),
  ordem: integer("ordem").default(0).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ofertaComercialId: uuid("oferta_comercial_id"),
}, (table) => [
  uniqueIndex("idx_catalogo_precos_stripe_price").on(table.organizacaoId, table.stripePriceId),
  index("idx_catalogo_precos_produto").on(table.servicoCatalogoId, table.ordem),
  index("idx_catalogo_precos_lookup").on(table.organizacaoId, table.lookupKey),
]);

/** Contador de número de proposta por organização (migration 0107). Só `lib/crm/proposta-criacao.ts` escreve aqui. */
export const propostaSequencias = pgTable("proposta_sequencias", {
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).primaryKey(),
  ultimoNumero: integer("ultimo_numero").notNull(),
});

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
    // Condição de pagamento ESTRUTURADA (25/08, pedido do Kauã — billing
    // avançado). `condicoesPagamento` (texto livre acima) continua existindo
    // pra observação extra; estes 3 campos é o que o checkout Stripe de fato
    // usa pra decidir payment_method_types e o vencimento do boleto (ver
    // stripe-checkout.ts). null/undefined preserva o comportamento atual
    // (Stripe decide pelos métodos habilitados na conta, boleto com os 3
    // dias padrão) — zero regressão em proposta que não usa o campo novo.
    condicaoPagamentoTipo: text("condicao_pagamento_tipo"), // cartao | boleto | boleto_parcelado | outro
    parcelas: integer("parcelas").default(1),
    vencimentoDias: integer("vencimento_dias"),
    // Prazo informado pelo vendedor antes do envio quando a composição exige
    // contrato. Não existe default: prazo jurídico precisa ser explícito.
    prazoContratoMeses: integer("prazo_contrato_meses"),
    /** Dias de teste antes da primeira cobrança. NULL ou 0 = sem teste, que é
     *  o padrão: quem decide é o vendedor em cada proposta. Ver 0095. */
    trialDias: integer("trial_dias"),
    // Signatários informados pelo vendedor antes do envio quando a composição
    // usa contrato. Mantido na proposta para ser copiado ao contrato gerado
    // automaticamente no aceite, sem acoplar o domínio a um provider externo.
    signatarios: jsonb("signatarios"),
    /** Estado do editor (condições do contrato, dados congelados no envio). Ver 0099. */
    editor: jsonb("editor"),
    totalRecorrente: decimal("total_recorrente", { precision: 12, scale: 2 }).default("0"),
    totalAvulso: decimal("total_avulso", { precision: 12, scale: 2 }).default("0"),
    totalGeral: decimal("total_geral", { precision: 12, scale: 2 }).default("0"),
    criadoPorId: uuid("criado_por_id").references(() => usuarios.id),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    // Checkout Stripe (assinatura) gerado a partir da proposta
    checkoutUrl: text("checkout_url"),
    stripeSessionId: text("stripe_session_id"),
    enviadaEm: timestamp("enviada_em", { withTimezone: true }),
    // Próximo passo comercial real, derivado dos itens no envio (ver
    // determinarProximoPasso) — não recalculado na UI, decide o que a página
    // pública mostra depois do aceite: ir pro checkout Stripe (pagamento) ou
    // pro fluxo de contrato/assinatura (contrato).
    proximoPasso: text("proximo_passo"), // pagamento | contrato
    visualizacoes: integer("visualizacoes").default(0).notNull(),
    primeiraVisualizacaoEm: timestamp("primeira_visualizacao_em", { withTimezone: true }),
    ultimaVisualizacaoEm: timestamp("ultima_visualizacao_em", { withTimezone: true }),
    // Momento em que o cliente respondeu na página pública (aceitar/recusar/
    // ajuste) — distinto de "aceita" no status: pro fluxo de pagamento, o
    // aceite comercial de verdade só vira Won quando o pagamento confirma
    // (ADR-EXEC-007); isso aqui é só "o cliente reagiu à proposta".
    clienteRespondeuEm: timestamp("cliente_respondeu_em", { withTimezone: true }),
    motivoRecusa: text("motivo_recusa"),

    // ─── Módulo 01 — Vendas (SpecDrive Bloco 03, 16/09) ────────────────
    /** Bloco 03 §7: escolhido ANTES do envio, porque muda regra, dado
     *  obrigatório e gate de Won. `proximoPasso` continua sendo o derivado
     *  dos itens; este é a escolha explícita do vendedor. */
    modoFechamento: text("modo_fechamento"), // PREPAID | CONTRACT
    validadeDias: integer("validade_dias"),
    /** Bloco 03 §12: o pedido de ajuste não altera a proposta; fica
     *  registrado e o comercial cria uma versão nova. */
    ajusteSolicitadoEm: timestamp("ajuste_solicitado_em", { withTimezone: true }),
    ajusteSolicitadoDescricao: text("ajuste_solicitado_descricao"),
    substituidaEm: timestamp("substituida_em", { withTimezone: true }),
    substituidaPorId: uuid("substituida_por_id").references((): AnyPgColumn => propostas.id),
    aceitaEm: timestamp("aceita_em", { withTimezone: true }),
    recusadaEm: timestamp("recusada_em", { withTimezone: true }),
    expiradaEm: timestamp("expirada_em", { withTimezone: true }),
    /** Bloco 03 §21: cliente existente pode estar comprando aditivo/upgrade,
     *  e o vínculo com o contrato base não pode se perder. */
    tipoContratual: text("tipo_contratual"), // NOVO_CONTRATO | ADITIVO | UPGRADE | DOWNGRADE
    contratoBaseId: uuid("contrato_base_id").references(() => contratos.id),
    serviceFamily: text("service_family"),
    /** Duplicata anterior à numeração atômica (migration 0107): fica fora do índice único. */
    numeroDuplicadoLegado: boolean("numero_duplicado_legado").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Vínculo canônico (migrations 0063 a 0066). Declarado aqui porque
    // coluna que existe no banco e não no Drizzle é invisível para o código.
    ofertaComercialId: uuid("oferta_comercial_id"),
    oportunidadeId: uuid("oportunidade_id"),
    empresaId: uuid("empresa_id"),
  },
  (table) => [
    index("idx_propostas_org").on(table.organizacaoId),
    index("idx_propostas_lead").on(table.leadId),
    index("idx_propostas_status").on(table.organizacaoId, table.status),
    index("idx_propostas_numero").on(table.organizacaoId, table.numero),
    uniqueIndex("uq_propostas_org_numero_versao").on(table.organizacaoId, table.numero, table.versao).where(sql`NOT numero_duplicado_legado`),
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
    // Recuperação legado Zoho (reconciliação v1.1).
    billingSource: text("billing_source"),
    nonRecurringValue: decimal("non_recurring_value", { precision: 14, scale: 2 }),
    provenance: text("provenance"),
    recurringValue: decimal("recurring_value", { precision: 14, scale: 2 }),
    revenueNature: text("revenue_nature"),
    semanticConfidence: text("semantic_confidence"),
    semanticEvidence: jsonb("semantic_evidence"),
    serviceFamily: text("service_family"),
    zohoId: text("zoho_id"),
    // Commercial Core v2 (ADR-EXEC-021): modelo comercial resolvido no
    // momento da criação/edição do item (default do catálogo, sobrescrevível
    // pelo vendedor) — nunca inferido de novo depois. É o que permite a
    // MESMA família (ex: Callface AI) ter itens com modelos diferentes na
    // mesma proposta.
    commercialModel: text("commercial_model").notNull().default("PAGAMENTO_DIRETO"),
    // Catálogo Oficial Stripe (02/09) — o item guarda AO MESMO TEMPO a
    // referência oficial (imutável) e o que foi negociado. Desconto/valor
    // negociado nunca cria produto nem price novo: mexe em `valorUnitario`
    // e `desconto`, e `valorTabela` preserva o preço oficial do momento da
    // venda pra auditar o desconto concedido depois.
    catalogoPrecoId: uuid("catalogo_preco_id").references((): AnyPgColumn => catalogoPrecos.id),
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    skuPreco: text("sku_preco"),
    variacao: text("variacao"),
    valorTabela: decimal("valor_tabela", { precision: 12, scale: 2 }),
  },
  (table) => [
    index("idx_proposta_itens_proposta").on(table.propostaId),
  ]
);

// ─── LABELS (TAGS) ──────────────────────────────────────────
/** Visões salvas das listas (migration 0096): busca, filtros, aba e visão de cada usuário por tela. */
export const visoesSalvas = pgTable(
  "visoes_salvas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "cascade" }).notNull(),
    tela: text("tela").notNull(),
    nome: text("nome").notNull(),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_visoes_salvas_usuario_tela").on(table.organizacaoId, table.usuarioId, table.tela),
  ]
);

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

// Tags can also belong to the other CRM2 entities. `lead_labels` and
// `contato_labels` stay as compatibility bridges while screens migrate.
export const entityLabels = pgTable(
  "entity_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
    entityType: text("entity_type").notNull(), // lead | negocio | oportunidade | cliente | empresa | contato
    entityId: uuid("entity_id").notNull(),
    labelId: uuid("label_id").references(() => labels.id, { onDelete: "cascade" }).notNull(),
    createdById: uuid("created_by_id").references(() => usuarios.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_entity_labels_entity_label").on(table.organizacaoId, table.entityType, table.entityId, table.labelId),
    index("idx_entity_labels_entity").on(table.organizacaoId, table.entityType, table.entityId),
    index("idx_entity_labels_label").on(table.labelId),
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
    // Centralização de notas (Kauã, 10/08): reunião e cliente entram no mesmo
    // lugar que lead/negócio/empresa já usavam — "toda nota, independente de
    // onde foi colocada, precisa ser centralizada".
    reuniaoId: uuid("reuniao_id").references(() => reunioes.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "cascade" }),
    conteudo: text("conteudo").notNull(),
    autorId: uuid("autor_id").references(() => usuarios.id),
    pipedriveId: text("pipedrive_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Recuperação legado Zoho (reconciliação v1.1).
    autorDisplayName: text("autor_display_name"),
    autorSourceId: text("autor_source_id"),
    conteudoRaw: text("conteudo_raw"),
  },
  (table) => [
    index("idx_notas_lead").on(table.leadId),
    index("idx_notas_negocio").on(table.negocioId),
    index("idx_notas_empresa").on(table.empresaId),
    index("idx_notas_reuniao").on(table.reuniaoId),
    index("idx_notas_cliente").on(table.clienteId),
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
    outlookEventId: text("outlook_event_id"),
    /** CalendarProvider (migration 0089): microsoft | google. */
    calendarProvider: text("calendar_provider"),
    calendarEventId: text("calendar_event_id"),
    /** pendente | ok | falhou | sem_provedor — falha visível e reprocessável. */
    calendarSyncStatus: text("calendar_sync_status"),
    calendarSyncErro: text("calendar_sync_erro"),
    /** Conta (email_contas) em que o evento vive: atualizar/cancelar usam esta (migration 0110). */
    calendarContaId: uuid("calendar_conta_id"),
    /** Evento que sobrou no calendário antigo após trocar o responsável: {provider, contaId, eventId, desde} (migration 0114). */
    calendarRemocaoPendente: jsonb("calendar_remocao_pendente").$type<{ provider: string; contaId: string; eventId: string; desde: string }>(),
    /** Resposta de cada convidado lida do Outlook: {email: accepted|declined|tentativelyAccepted|none}. */
    participantesRespostas: jsonb("participantes_respostas").$type<Record<string, string>>().notNull().default({}),
    calendarSyncEm: timestamp("calendar_sync_em", { withTimezone: true }), // id do evento no Outlook do closer (Graph), pra permitir cancelar/atualizar depois
    notas: text("notas"),
    transcript: text("transcript"),
    resumoTranscript: text("resumo_transcript"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    // Lembrete automático 30min antes (automação real, não hardcoded na UI —
    // ver lib/crm/lembrete-reuniao.ts). Timestamp em vez de boolean pra dar
    // rastreabilidade de quando foi enviado, e evitar reenvio se o sweep
    // rodar 2x na mesma janela.
    lembrete30minEnviadoEm: timestamp("lembrete_30min_enviado_em", { withTimezone: true }),
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
    // Bloqueio também vira evento real no Outlook do closer, se conectado
    // (Kauã, 10/08) — guarda o id pra poder cancelar quando o bloqueio for removido.
    outlookEventId: text("outlook_event_id"),
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
    // Estado operacional da conversa. O contato continua sendo a entidade
    // canônica do canal; estes campos evitam criar uma tabela paralela de inbox.
    status: text("status").default("open").notNull(), // open | closed
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    botSilencedUntil: timestamp("bot_silenced_until", { withTimezone: true }),
    activeAiAgentId: uuid("active_ai_agent_id").references((): AnyPgColumn => aiAgents.id, { onDelete: "set null" }),
    activeAiIntent: text("active_ai_intent"),
    activeAiAgentSetAt: timestamp("active_ai_agent_set_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedById: uuid("closed_by_id").references(() => usuarios.id),
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
    index("idx_contatos_status_snooze").on(table.organizacaoId, table.status, table.snoozedUntil),
    index("idx_contatos_lead").on(table.leadId),
    index("idx_contatos_ultima_msg").on(table.responsavelId, table.ultimaMsgAt),
  ]
);

// Tags operacionais da conversa. Diferentes de leadLabels: uma tag de inbox
// pode disparar automação de atendimento sem alterar a classificação comercial.
export const contatoLabels = pgTable(
  "contato_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "cascade" }).notNull(),
    labelId: uuid("label_id").references(() => labels.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_contato_labels_dedup").on(table.contatoId, table.labelId),
    index("idx_contato_labels_contato").on(table.contatoId),
    index("idx_contato_labels_label").on(table.labelId),
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

// Catalogo de agentes versionados. O AI SDR legado permanece em ai_sdr_config
// durante a migracao; estas tabelas sao o contrato novo para multiplos agentes.
export const aiAgents = pgTable("ai_agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  slug: text("slug").notNull(),
  descricao: text("descricao"),
  finalidade: text("finalidade").notNull().default("atendimento"),
  kind: text("kind").notNull().default("mcp_agent"), // rag_bot | mcp_agent
  prioridade: integer("prioridade").default(100).notNull(),
  status: text("status").default("draft").notNull(), // draft | published | paused | archived
  publishedVersionId: uuid("published_version_id").references((): AnyPgColumn => aiAgentVersions.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_ai_agents_org_slug").on(table.organizacaoId, table.slug),
  index("idx_ai_agents_org_status").on(table.organizacaoId, table.status),
]);

// Catálogo global e credenciais BYOK tenant-scoped. O segredo é AES-GCM em
// base64 (ciphertext/iv/tag separados); endpoints de leitura nunca selecionam
// estes três campos, somente last4/estado de validação.
export const aiModels = pgTable("ai_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  contextWindow: integer("context_window"),
  inputPricePerMillion: decimal("input_price_per_million", { precision: 12, scale: 6 }),
  outputPricePerMillion: decimal("output_price_per_million", { precision: 12, scale: 6 }),
  supportsTools: boolean("supports_tools").default(true).notNull(),
  supportsVision: boolean("supports_vision").default(false).notNull(),
  isDefaultForProvider: boolean("is_default_for_provider").default(false).notNull(),
  deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_models_provider_model").on(table.provider, table.modelId),
  index("idx_ai_models_provider").on(table.provider),
]);

export const aiProviderCredentials = pgTable("ai_provider_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  apiKeyCiphertext: text("api_key_ciphertext").notNull(),
  apiKeyIv: text("api_key_iv").notNull(),
  apiKeyTag: text("api_key_tag").notNull(),
  apiKeyLast4: text("api_key_last4").notNull(),
  encryptionVersion: integer("encryption_version").default(1).notNull(),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  validationError: text("validation_error"),
  modelsAvailable: text("models_available").array(),
  ativo: boolean("ativo").default(true).notNull(),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_provider_credentials_org_provider_label").on(table.organizacaoId, table.provider, table.label),
  index("idx_ai_provider_credentials_org_provider").on(table.organizacaoId, table.provider),
]);

export const aiPurposeBindings = pgTable("ai_purpose_bindings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  purpose: text("purpose").notNull(),
  provider: text("provider").notNull(),
  credentialId: uuid("credential_id").references(() => aiProviderCredentials.id, { onDelete: "set null" }),
  modelId: text("model_id").notNull(),
  baseUrl: text("base_url"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_purpose_bindings_org_purpose").on(table.organizacaoId, table.purpose),
  index("idx_ai_purpose_bindings_credential").on(table.credentialId),
]);

export const aiAgentVersions = pgTable("ai_agent_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "cascade" }).notNull(),
  versao: integer("versao").notNull(),
  status: text("status").default("draft").notNull(), // draft | published | superseded
  systemPrompt: text("system_prompt").notNull().default(""),
  provider: text("provider"),
  modelo: text("modelo"),
  credentialId: uuid("credential_id").references(() => aiProviderCredentials.id, { onDelete: "restrict" }),
  channelSessionId: uuid("channel_session_id").references(() => whatsappSessao.id, { onDelete: "restrict" }),
  tools: jsonb("tools").default([]).notNull(),
  triggerConfig: jsonb("trigger_config").default({}).notNull(),
  handoffConfig: jsonb("handoff_config").default({}).notNull(),
  knowledgeConfig: jsonb("knowledge_config").default({}).notNull(),
  guardrailConfig: jsonb("guardrail_config").default({}).notNull(),
  maxSteps: integer("max_steps").default(8).notNull(),
  tokenBudget: integer("token_budget").default(4000).notNull(),
  costBudget: decimal("cost_budget", { precision: 10, scale: 4 }),
  historyMessageWindow: integer("history_message_window").default(20).notNull(),
  historyTokenWindow: integer("history_token_window").default(8000).notNull(),
  casesEnabled: boolean("cases_enabled").default(false).notNull(),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_ai_agent_versions_number").on(table.agentId, table.versao),
  index("idx_ai_agent_versions_status").on(table.agentId, table.status),
]);

export const aiAgentRuns = pgTable("ai_agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  agentId: uuid("agent_id").references(() => aiAgents.id).notNull(),
  versionId: uuid("version_id").references(() => aiAgentVersions.id),
  contatoId: uuid("contato_id").references(() => contatos.id),
  leadId: uuid("lead_id").references(() => leads.id),
  sourceMessageId: uuid("source_message_id").references(() => whatsappMensagens.id),
  outboundMessageId: uuid("outbound_message_id").references(() => whatsappMensagens.id),
  channelSessionId: uuid("channel_session_id").references(() => whatsappSessao.id),
  correlationId: uuid("correlation_id"),
  modo: text("modo").default("live").notNull(), // dry_run | live
  status: text("status").notNull(), // queued | running | completed | failed | handed_off
  input: jsonb("input"),
  trace: jsonb("trace").default([]).notNull(),
  tokens: integer("tokens").default(0).notNull(),
  tokensInput: integer("tokens_input").default(0).notNull(),
  tokensOutput: integer("tokens_output").default(0).notNull(),
  custo: decimal("custo", { precision: 10, scale: 4 }),
  erro: text("erro"),
  errorCode: text("error_code"),
  abortReason: text("abort_reason"),
  latencyMs: integer("latency_ms"),
  stepsCount: integer("steps_count").default(0).notNull(),
  handoffMotivo: text("handoff_motivo"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("idx_ai_agent_runs_org_started").on(table.organizacaoId, table.startedAt),
  index("idx_ai_agent_runs_agent").on(table.agentId, table.startedAt),
  index("idx_ai_agent_runs_contato").on(table.contatoId, table.startedAt),
  uniqueIndex("uq_ai_agent_runs_one_live_per_contact").on(table.contatoId).where(sql`${table.status} = 'running' AND ${table.modo} = 'live' AND ${table.contatoId} IS NOT NULL`),
  uniqueIndex("uq_ai_agent_runs_nexo_confirmacao")
    .on(table.organizacaoId, sql`(${table.input}->'payload'->>'confirmaDe')`)
    .where(sql`${table.input}->'payload'->>'canal' = 'nexo_confirmacao' AND ${table.input}->'payload'->>'confirmaDe' IS NOT NULL`),
]);

export const aiAgentRunSteps = pgTable("ai_agent_run_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  runId: uuid("run_id").references(() => aiAgentRuns.id, { onDelete: "cascade" }).notNull(),
  sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(), // model_call | tool_call | guardrail | egress | handoff
  name: text("name"),
  status: text("status").notNull(), // running | completed | failed | blocked
  input: jsonb("input"),
  output: jsonb("output"),
  tokensInput: integer("tokens_input").default(0).notNull(),
  tokensOutput: integer("tokens_output").default(0).notNull(),
  custo: decimal("custo", { precision: 10, scale: 4 }),
  latencyMs: integer("latency_ms"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("uq_ai_agent_run_steps_sequence").on(table.runId, table.sequence),
  index("idx_ai_agent_run_steps_org_started").on(table.organizacaoId, table.startedAt),
]);

export const aiSendLedger = pgTable("ai_send_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  runId: uuid("run_id").references(() => aiAgentRuns.id, { onDelete: "cascade" }).notNull(),
  sequence: integer("sequence").notNull(),
  bodyHash: text("body_hash").notNull(),
  channel: text("channel").notNull(),
  status: text("status").default("pending").notNull(),
  externalMessageId: text("external_message_id"),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_send_ledger_run_sequence").on(table.runId, table.sequence),
  index("idx_ai_send_ledger_org_created").on(table.organizacaoId, table.createdAt),
]);

export const aiAlerts = pgTable("ai_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // handoff | budget_exceeded | run_dead | credential | guardrail | other
  severity: text("severity").default("warning").notNull(), // info | warning | critical
  title: text("title").notNull(),
  body: text("body"),
  refKind: text("ref_kind"),
  refId: uuid("ref_id"),
  status: text("status").default("open").notNull(), // open | acknowledged | resolved
  acknowledgedById: uuid("acknowledged_by_id").references(() => usuarios.id),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_alerts_org_status_created").on(table.organizacaoId, table.status, table.createdAt),
]);

export const aiUsageBudgets = pgTable("ai_usage_budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "cascade" }),
  provider: text("provider"),
  period: text("period").default("monthly").notNull(), // daily | monthly
  tokenLimit: integer("token_limit"),
  costLimit: decimal("cost_limit", { precision: 12, scale: 4 }),
  warningPercent: integer("warning_percent").default(80).notNull(),
  hardStop: boolean("hard_stop").default(true).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_usage_budgets_org").on(table.organizacaoId),
  index("idx_ai_usage_budgets_agent").on(table.agentId),
]);

export const aiRouters = pgTable("ai_routers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  nome: text("nome").notNull(),
  channelSessionId: uuid("channel_session_id").references(() => whatsappSessao.id, { onDelete: "cascade" }).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  config: jsonb("config").default({ classifierModel: null, sticky: true, minConfidence: 0.6 }).notNull(),
  fallbackAgentId: uuid("fallback_agent_id").references(() => aiAgents.id, { onDelete: "set null" }),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_routers_org").on(table.organizacaoId),
  uniqueIndex("uq_ai_routers_active_session").on(table.channelSessionId).where(sql`${table.ativo} = true`),
]);

export const aiRouterMembers = pgTable("ai_router_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  routerId: uuid("router_id").references(() => aiRouters.id, { onDelete: "cascade" }).notNull(),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "cascade" }).notNull(),
  intentName: text("intent_name").notNull(),
  intentDescription: text("intent_description").notNull(),
  examples: text("examples").array().default([]).notNull(),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_router_members_intent").on(table.routerId, table.intentName),
  index("idx_ai_router_members_router_position").on(table.routerId, table.position),
]);

export const aiRouterDecisions = pgTable("ai_router_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  routerId: uuid("router_id").references(() => aiRouters.id, { onDelete: "set null" }),
  contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "set null" }),
  intentName: text("intent_name"),
  confidence: decimal("confidence", { precision: 4, scale: 3 }),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "set null" }),
  outcome: text("outcome").notNull(), // classified | sticky | reclassified | fallback | no_match | classifier_failed
  correlationId: uuid("correlation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_router_decisions_org_created").on(table.organizacaoId, table.createdAt),
  index("idx_ai_router_decisions_router_created").on(table.routerId, table.createdAt),
]);

export const aiKnowledgeSources = pgTable("ai_knowledge_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  nome: text("nome").notNull(),
  sourceType: text("source_type").notNull(), // text | url | file | faq
  sourceUri: text("source_uri"),
  mimeType: text("mime_type"),
  checksum: text("checksum"),
  status: text("status").default("pending").notNull(), // pending | indexing | ready | failed | archived
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default({}).notNull(),
  // aprovado | rascunho | historico: agente só enxerga "aprovado" (migration 0103)
  governanca: text("governanca").default("aprovado").notNull(),
  categoria: text("categoria"),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  indexedAt: timestamp("indexed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_knowledge_sources_org_status").on(table.organizacaoId, table.status),
]);

export const aiKnowledgeVersions = pgTable("ai_knowledge_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  sourceId: uuid("source_id").references(() => aiKnowledgeSources.id, { onDelete: "cascade" }).notNull(),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  chunkCount: integer("chunk_count").default(0).notNull(),
  status: text("status").default("draft").notNull(), // draft | published | superseded
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_knowledge_versions_source_number").on(table.sourceId, table.versionNumber),
  index("idx_ai_knowledge_versions_org").on(table.organizacaoId),
]);

export const aiKnowledgeChunks = pgTable("ai_knowledge_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  versionId: uuid("version_id").references(() => aiKnowledgeVersions.id, { onDelete: "cascade" }).notNull(),
  sequence: integer("sequence").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  embedding: jsonb("embedding"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_knowledge_chunks_version_sequence").on(table.versionId, table.sequence),
  index("idx_ai_knowledge_chunks_org").on(table.organizacaoId),
]);

export const aiKnowledgeSearches = pgTable("ai_knowledge_searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  runId: uuid("run_id").references(() => aiAgentRuns.id, { onDelete: "set null" }),
  knowledgeVersionId: uuid("knowledge_version_id").references(() => aiKnowledgeVersions.id, { onDelete: "set null" }),
  hits: integer("hits").default(0).notNull(),
  topScore: decimal("top_score", { precision: 8, scale: 6 }),
  threshold: decimal("threshold", { precision: 8, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_knowledge_searches_org_created").on(table.organizacaoId, table.createdAt),
]);

export const aiMemoryVersions = pgTable("ai_memory_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_memory_versions_org_number").on(table.organizacaoId, table.versionNumber),
]);

export const aiMemoryPointers = pgTable("ai_memory_pointers", {
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).primaryKey(),
  versionId: uuid("version_id").references(() => aiMemoryVersions.id, { onDelete: "restrict" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiMemoryEntries = pgTable("ai_memory_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  source: text("source").notNull(), // manual | flywheel | agent
  status: text("status").default("active").notNull(), // proposed | active | archived
  createdById: uuid("created_by_id").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_memory_entries_org_status").on(table.organizacaoId, table.status, table.createdAt),
]);

export const aiSkillVersions = pgTable("ai_skill_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  versionNumber: integer("version_number").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  manifest: jsonb("manifest").default([]).notNull(),
  forkedFromVersionId: uuid("forked_from_version_id").references((): AnyPgColumn => aiSkillVersions.id, { onDelete: "set null" }),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_skill_versions_org_name_number").on(table.organizacaoId, table.name, table.versionNumber),
  index("idx_ai_skill_versions_name").on(table.name),
]);

export const aiSkillPointers = pgTable("ai_skill_pointers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  versionId: uuid("version_id").references(() => aiSkillVersions.id, { onDelete: "restrict" }).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_skill_pointers_org_name").on(table.organizacaoId, table.name),
]);

export const aiSkillActivations = pgTable("ai_skill_activations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  skillName: text("skill_name").notNull(),
  skillVersionId: uuid("skill_version_id").references(() => aiSkillVersions.id, { onDelete: "set null" }),
  runId: uuid("run_id").references(() => aiAgentRuns.id, { onDelete: "set null" }),
  trigger: text("trigger").notNull(), // hard | probe
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_skill_activations_org_created").on(table.organizacaoId, table.createdAt),
]);

export const aiCases = pgTable("ai_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "cascade" }).notNull(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "set null" }),
  runId: uuid("run_id").references(() => aiAgentRuns.id, { onDelete: "set null" }),
  status: text("status").default("awaiting_human").notNull(), // awaiting_human | awaiting_contact | resolved | escalated | cancelled
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  blocker: text("blocker").notNull(),
  contextSnapshot: jsonb("context_snapshot").default({}).notNull(),
  source: text("source").default("agent").notNull(),
  followupAttempts: integer("followup_attempts").default(0).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_cases_org_status").on(table.organizacaoId, table.status),
  index("idx_ai_cases_contato").on(table.organizacaoId, table.contatoId),
]);

export const aiCaseEvents = pgTable("ai_case_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  caseId: uuid("case_id").references(() => aiCases.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  actorKind: text("actor_kind").notNull(), // agent | human | system | contact
  actorUserId: uuid("actor_user_id").references(() => usuarios.id, { onDelete: "set null" }),
  humanAction: text("human_action"),
  body: text("body"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_case_events_case_created").on(table.caseId, table.createdAt),
]);

export const aiContactFieldProposals = pgTable("ai_contact_field_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "cascade" }).notNull(),
  campo: text("campo").notNull(), // email | nome | telefone
  valorProposto: text("valor_proposto").notNull(),
  valorAnterior: text("valor_anterior"),
  messageId: uuid("message_id").references(() => whatsappMensagens.id, { onDelete: "set null" }),
  trecho: text("trecho"),
  proposedByAgentId: uuid("proposed_by_agent_id").references(() => aiAgents.id, { onDelete: "set null" }),
  status: text("status").default("pending").notNull(), // pending | accepted | dismissed | expired
  proposedAt: timestamp("proposed_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedByUserId: uuid("decided_by_user_id").references(() => usuarios.id, { onDelete: "set null" }),
  motivoRecusa: text("motivo_recusa"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ai_contact_field_proposals_pending").on(table.organizacaoId, table.contatoId, table.campo).where(sql`${table.status} = 'pending'`),
  index("idx_ai_contact_field_proposals_expiring").on(table.organizacaoId, table.expiresAt),
]);

export const aiImprovementProposals = pgTable("ai_improvement_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // playbook | skill | memory | golden_case
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  evidence: jsonb("evidence").default({}).notNull(),
  status: text("status").default("proposed").notNull(), // proposed | accepted | rejected
  decidedById: uuid("decided_by_id").references(() => usuarios.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_improvement_proposals_org_status").on(table.organizacaoId, table.status, table.createdAt),
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
  // Resposta automática é opt-in por conversa: quem ligou e quando. NULL = ninguém ligou,
  // então nenhum agente responde aqui (exceto agente que é o responsável da conversa).
  iaLigadaPor: uuid("ia_ligada_por").references(() => usuarios.id),
  iaLigadaEm: timestamp("ia_ligada_em", { withTimezone: true }),
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

// ─── Agentes de IA: operação autônoma (migration 0103) ──────────────────────
// Atribuição persistente, retomadas do próprio agente e memória com fonte.
// Nenhuma das três depende de cadence_*: cadência é outro produto.
export const aiAgentAtribuicoes = pgTable("ai_agent_atribuicoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "cascade" }).notNull(),
  contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "set null" }),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
  status: text("status").default("ativa").notNull(), // ativa | pausada | aguardando_aprovacao | humano | falha | encerrada
  objetivo: text("objetivo"),
  autonomia: text("autonomia"),
  origem: text("origem").default("manual").notNull(), // manual | atendimento | automacao | regra | evento
  origemRef: text("origem_ref"),
  atribuidoPor: uuid("atribuido_por").references(() => usuarios.id),
  copiloto: boolean("copiloto").default(false).notNull(),
  humanoUsuarioId: uuid("humano_usuario_id").references(() => usuarios.id),
  motivoEstado: text("motivo_estado"),
  resumoHandoff: text("resumo_handoff"),
  estado: jsonb("estado").default({}).notNull(),
  ultimoRunId: uuid("ultimo_run_id"),
  ultimaExecucaoEm: timestamp("ultima_execucao_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  encerradaEm: timestamp("encerrada_em", { withTimezone: true }),
}, (table) => [
  index("idx_ai_agent_atribuicoes_org_status").on(table.organizacaoId, table.status, table.updatedAt),
  index("idx_ai_agent_atribuicoes_agente").on(table.agentId, table.status),
]);

export const aiAgentCompromissos = pgTable("ai_agent_compromissos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "cascade" }).notNull(),
  atribuicaoId: uuid("atribuicao_id").references(() => aiAgentAtribuicoes.id, { onDelete: "set null" }),
  contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  tipo: text("tipo").default("retomada").notNull(), // retomada | lembrete | verificacao
  motivo: text("motivo").notNull(),
  instrucao: text("instrucao"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: text("status").default("pendente").notNull(), // pendente | processando | concluido | cancelado | bloqueado | falhou | expirado
  bloqueioMotivo: text("bloqueio_motivo"),
  tentativas: integer("tentativas").default(0).notNull(),
  origemRunId: uuid("origem_run_id"),
  origemMensagemId: uuid("origem_mensagem_id"),
  runId: uuid("run_id"),
  idempotencyKey: text("idempotency_key"),
  reagendadoDe: timestamp("reagendado_de", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  concluidoEm: timestamp("concluido_em", { withTimezone: true }),
}, (table) => [
  index("idx_ai_agent_compromissos_vencimento").on(table.status, table.dueAt),
  index("idx_ai_agent_compromissos_contato").on(table.contatoId, table.status),
]);

export const aiMemoriaFatos = pgTable("ai_memoria_fatos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  escopo: text("escopo").notNull(), // pessoa | empresa | conversa | operacional
  contatoId: uuid("contato_id").references(() => contatos.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
  tipo: text("tipo").default("fato").notNull(), // fato | preferencia | objecao | promessa | compromisso | proximo_passo | resumo
  chave: text("chave").notNull(),
  valor: text("valor").notNull(),
  fonte: text("fonte").notNull(), // mensagem | formulario | ferramenta | humano | crm
  fonteRef: text("fonte_ref"),
  confirmado: boolean("confirmado").default(false).notNull(),
  confianca: decimal("confianca", { precision: 3, scale: 2 }),
  status: text("status").default("ativo").notNull(), // ativo | corrigido | excluido | expirado
  validoAte: timestamp("valido_ate", { withTimezone: true }),
  agentId: uuid("agent_id").references(() => aiAgents.id, { onDelete: "set null" }),
  runId: uuid("run_id"),
  usuarioId: uuid("usuario_id").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ai_memoria_fatos_contato").on(table.contatoId, table.status, table.updatedAt),
]);

export const roteamentoComercialRegras = pgTable("roteamento_comercial_regras", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  familia: text("familia"), // CALLFACE_AI | WHITE_LABEL | PABX | null
  campanha: text("campanha"),
  prioridade: integer("prioridade").default(100).notNull(),
  ativa: boolean("ativa").default(true).notNull(),
  vigenteDe: timestamp("vigente_de", { withTimezone: true }),
  vigenteAte: timestamp("vigente_ate", { withTimezone: true }),
  destinoUsuarioId: uuid("destino_usuario_id").references(() => usuarios.id),
  fallback: text("fallback").default("fila_humana").notNull(), // fila_humana | rodizio
  criadoPor: uuid("criado_por").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_roteamento_comercial_org").on(table.organizacaoId, table.ativa, table.prioridade),
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
  // 0091: envio pelo worker (sweep campanha-sweep, lib/automacoes/campanhas-envio.ts)
  agendadaPara: timestamp("agendada_para", { withTimezone: true }),
  iniciadaEm: timestamp("iniciada_em", { withTimezone: true }),
  concluidaEm: timestamp("concluida_em", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_outreach_campanhas_org").on(table.organizacaoId),
]);

/** Um destinatário por linha, com status individual do disparo (migration 0091). */
export const outreachCampanhaDestinatarios = pgTable("outreach_campanha_destinatarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  campanhaId: uuid("campanha_id").references(() => outreachCampanhas.id, { onDelete: "cascade" }).notNull(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  nome: text("nome"),
  destino: text("destino").notNull(),
  status: text("status").notNull().default("pendente"), // pendente | enviando | enviado | bloqueado | falhou
  erro: text("erro"),
  mensagemId: text("mensagem_id"),
  enviadoEm: timestamp("enviado_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_campanha_destinatario_destino").on(table.campanhaId, table.destino),
  index("idx_campanha_destinatarios_status").on(table.campanhaId, table.status),
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
  conversaId: uuid("conversa_id"),
  empresaId: uuid("empresa_id"),
  oportunidadeId: uuid("oportunidade_id"),
  tipo: text("tipo"),
  provider: text("provider"),
  subject: text("subject"),
  summary: text("summary"),
  transcript: text("transcript"),
  createdByUserId: uuid("created_by_user_id"),
  metadata: jsonb("metadata").default({}).notNull(),
  origemTabela: text("origem_tabela"),
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
  // Nulos só em execução de fluxo sem registro (agendado "nenhum", webhook sem registro).
  entityType: text("entity_type"), // lead | negocio | contato
  entityId: uuid("entity_id"),
  // regra: sucesso | erro | condicao_nao_atendida · fluxo: executando | aguardando | sucesso | erro | cancelado
  status: text("status").notNull(),
  resultado: jsonb("resultado"),
  erro: text("erro"),
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
  versionId: uuid("version_id"),
  triggerEventId: uuid("trigger_event_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  // Cursor do executor de fluxos (0092).
  modo: text("modo"), // evento | manual | agendado | webhook
  estado: jsonb("estado").default({}).notNull(), // { gatilho, vars, nos, tentativas }
  noAtual: text("no_atual"),
  retomarEm: timestamp("retomar_em", { withTimezone: true }),
  claimedUntil: timestamp("claimed_until", { withTimezone: true }),
  profundidade: integer("profundidade").default(0).notNull(),
  idempotencyKey: text("idempotency_key"),
}, (table) => [
  index("idx_automacao_execucoes_automacao").on(table.automacaoId),
  index("idx_automacao_execucoes_org").on(table.organizacaoId),
  index("idx_automacao_execucoes_executed").on(table.executedAt),
]);

// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 0 (Foundation): teams, audit_log, event_outbox
// Ver docs/decisoes/ARCHITECTURE_DECISIONS.md (ADR-EXEC-001, 005)
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
// RECONCILIAÇÃO v1.1 + RECUPERAÇÃO LEGADO ZOHO (formalizado 2026-08-16)
// Estado consolidado de PROD (tag prod-consolidated-2026-08-16, commit
// 89460f8), promovido de HOMOLOG. Ver ADR-EXEC-019 em
// ARCHITECTURE_DECISIONS.md. Escopo: só o que tem dado válido pra reconciliar
// (histórico Zoho, contratos/anexos, carteira canônica) — NÃO inclui o
// módulo CS (revertido, 0 linhas) nem nada específico do CRM2.0 inacabado.
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
    // Vínculo canônico (migrations 0063 a 0066). Declarado aqui porque
    // coluna que existe no banco e não no Drizzle é invisível para o código.
    oportunidadeOrigemId: uuid("oportunidade_origem_id"),
    ofertaComercialId: uuid("oferta_comercial_id"),
  },
  (table) => [
    uniqueIndex("idx_servicos_canonicos_org_key").on(table.organizacaoId, table.canonicalKey),
    index("idx_servicos_canonicos_portfolio").on(table.organizacaoId, table.portfolioIncluded, table.serviceFamily),
  ],
);

// ─── FULFILLMENT (entrega/implantação pós-Won — 19/08, correção de escopo) ─
// Won termina o comercial; Fulfillment é outro processo, com vida própria,
// nunca uma etapa do Pipeline (achado real do legado Zoho: "Delivery PABX"
// como Stage de Deal — exatamente o erro que este modelo corrige). Um
// serviço (`servicosCanonicos`) pode ter um Fulfillment; o checklist
// (`fulfillmentItens`) é dado configurável, não state machine fixa no
// código — hoje o seed real (PABX) vem do processo operacional real
// (Delivery de Projeto PABX, 8 etapas: levantamento/portabilidade/
// softswitch/infra/licenciamento/configuração/QA/validação-cliente), mas
// isso é STARTING POINT editável por instância, nunca enum travado.
export const fulfillments = pgTable(
  "fulfillments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "cascade" }).notNull(),
    serviceFamily: text("service_family").notNull(), // denormalizado de servicosCanonicos, pra filtrar sem join
    // Estado MACRO — nunca 1 status por etapa do checklist (isso vive em
    // fulfillment_itens). NOT_STARTED|IN_PROGRESS|WAITING_CUSTOMER|
    // BLOCKED_CUSTOMER|BLOCKED_INTERNAL|BLOCKED_PROVIDER|
    // READY_FOR_VALIDATION|COMPLETED|CANCELED
    status: text("status").default("NOT_STARTED").notNull(),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    targetAt: timestamp("target_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Snapshot do escopo vendido no momento do Won (itens/quantidades) — a
    // referência real pra validar o que o cliente pediu vs o que foi
    // contratado (correção de escopo, seção 32/37 do briefing).
    escopoVendidoSnapshot: jsonb("escopo_vendido_snapshot"),
    // Token opaco pra página pública de coleta de informações do cliente
    // (formulário de implantação PABX, seção 33-36 do briefing) — nunca ID
    // sequencial/previsível, sem exigir login do cliente.
    publicToken: uuid("public_token").defaultRandom().notNull(),
    // Qual JORNADA este fulfillment é (migration 0066): ONBOARDING|IMPLEMENTATION.
    // Um serviço pode ter as duas ao mesmo tempo — PABX e White Label exigem
    // implantação ALÉM do onboarding (SPEC 18.1).
    tipo: text("tipo"),
    // Ciclo da jornada. Reonboarding/reimplantação do MESMO serviço incrementa,
    // em vez de sobrescrever a jornada anterior.
    cycleNumber: integer("cycle_number").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Vínculo canônico (migrations 0063 a 0066). Declarado aqui porque
    // coluna que existe no banco e não no Drizzle é invisível para o código.
    dueAt: timestamp("due_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    // NÃO é único desde a migration 0068: a exclusividade por serviço sozinho
    // impedia PABX de ter onboarding E implantação. Quem garante unicidade
    // agora é `uq_fulfillment_ciclo`, abaixo.
    index("idx_fulfillments_servico").on(table.servicoCanonicoId),
    uniqueIndex("uq_fulfillment_ciclo")
      .on(table.servicoCanonicoId, table.tipo, table.cycleNumber)
      .where(sql`servico_canonico_id IS NOT NULL`),
    uniqueIndex("idx_fulfillments_public_token").on(table.publicToken),
    index("idx_fulfillments_org").on(table.organizacaoId),
    index("idx_fulfillments_status").on(table.organizacaoId, table.status),
  ]
);

// Formulário de implantação (PABX hoje) — respostas do cliente, vinculadas
// ao Fulfillment. Payload livre (jsonb) porque os campos variam por família/
// processo real (seção 34 do briefing: contatos/ramais/linhas/canais/URAs/
// filas/regras/telefones/outras informações) — não travar em colunas
// fixas enquanto o processo real pode mudar.
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
  ]
);

export const fulfillmentItens = pgTable(
  "fulfillment_itens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    fulfillmentId: uuid("fulfillment_id").references(() => fulfillments.id, { onDelete: "cascade" }).notNull(),
    // Workstream é texto livre, não enum de banco — cresce conforme o
    // processo real (ex.: "levantamento", "portabilidade", "softswitch",
    // "infraestrutura", "licenciamento", "configuracao_pbx", "qa_interno",
    // "validacao_cliente" hoje pro PABX; outras famílias terão suas
    // próprias). Nunca decidir a lista definitiva em código.
    workstream: text("workstream").notNull(),
    titulo: text("titulo").notNull(),
    // PENDING|IN_PROGRESS|BLOCKED|VALIDATION|DONE. VALIDATION (20/08, pedido
    // Kauã) é estado real e distinto de DONE — usado principalmente pelos
    // workstreams qa_interno/validacao_cliente quando o item já foi feito
    // mas ainda depende de validação (interna ou do cliente) antes de virar
    // DONE de fato. Continua texto livre (sem enum de banco), igual ao resto
    // do modelo — a UI (FulfillmentDetail/ItemDrawer) que mapeia pros 7
    // rótulos exatos do Kauã (Não iniciado/Em andamento/Aguardando cliente/
    // Aguardando fornecedor/Bloqueado/Validação/Concluído), combinando este
    // campo com blockerType quando status=BLOCKED.
    status: text("status").default("PENDING").notNull(),
    blockerType: text("blocker_type"), // CUSTOMER | INTERNAL | PROVIDER
    blockerReason: text("blocker_reason"),
    ordem: integer("ordem").default(0).notNull(),
    metadata: jsonb("metadata"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => usuarios.id),
    // Responsável por ITEM (20/08, pedido Kauã) — hoje só existia 1
    // responsável a nível de fulfillment inteiro (fulfillments.responsavelId).
    // Null pra tudo que já existe (sem backfill); a UI cai pro responsável
    // do fulfillment como fallback SÓ na exibição, nunca grava esse fallback
    // aqui.
    responsavelId: uuid("responsavel_id").references(() => usuarios.id),
    // Prazo/prioridade por item (26/08, redesign da tela de Implantação
    // PABX — antes só existia `fulfillments.targetAt` no nível do projeto
    // todo; de propósito não existia por item até ter um pedido real de UI
    // que precisasse disso, que é este). Texto livre pra prioridade, mesmo
    // padrão de `status`/`blockerType` — sem enum de banco.
    dueDate: timestamp("due_date", { withTimezone: true }),
    priority: text("priority"), // alta | media | baixa
    // Setado só na transição PARA BLOCKED (mesmo padrão de completedAt/
    // completedBy na transição pra DONE) — "desde quando" no bloco de
    // Bloqueios não pode depender de updatedAt (muda em qualquer edição).
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    blockerImpact: text("blocker_impact"), // alto | medio | baixo — só relevante quando status=BLOCKED
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_fulfillment_itens_fulfillment").on(table.fulfillmentId),
    index("idx_fulfillment_itens_org").on(table.organizacaoId),
  ]
);

// Materialização relacional do formulário público de implantação PABX
// (20/08, pedido Kauã: "não deixar só no jsonb invisível"). O jsonb bruto em
// `fulfillment_formularios.respostas` continua sendo gravado e É a fonte de
// verdade/backup; estas duas tabelas são uma PROJEÇÃO relacional dele,
// recriada do zero (delete+insert) a cada submissão — idempotente, nunca
// acumula linha órfã de um envio anterior.
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
    titular: text("titular"), // razaoSocialTitular/cnpjCpfTitular do formulário (nível formulário, replicado por linha pra consulta simples)
    anexoUrl: text("anexo_url"),
    anexoId: text("anexo_id"), // nome original do arquivo enviado — não existe entidade "anexo" própria pra este upload hoje (fs local), guardado aqui como referência textual
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_fulfillment_linhas_portabilidade_fulfillment").on(table.fulfillmentId),
    index("idx_fulfillment_linhas_portabilidade_org").on(table.organizacaoId),
  ]
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
    usuario: text("usuario"), // nome da pessoa (campo `nome` do formulário)
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
  ]
);

export const serviceLedgerBatches = pgTable(
  "service_ledger_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    competence: date("competence").notNull(),
    version: text("version").notNull(),
    sourceFile: text("source_file").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    expectedTotal: decimal("expected_total", { precision: 14, scale: 2 }).notNull(),
    importedTotal: decimal("imported_total", { precision: 14, scale: 2 }).notNull(),
    rowCount: integer("row_count").notNull(),
    status: text("status").notNull(), // OPEN | CLOSED | SUPERSEDED — CLOSED é imutável
    evidence: jsonb("evidence").default({}).notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_service_ledger_batch_version").on(table.organizacaoId, table.competence, table.version),
  ],
);

export const serviceLedgerEntries = pgTable(
  "service_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id").references(() => serviceLedgerBatches.id).notNull(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    sourceRowHash: text("source_row_hash").notNull(),
    sourceRowNumber: integer("source_row_number").notNull(),
    document: text("document"),
    companyName: text("company_name").notNull(),
    billedValue: decimal("billed_value", { precision: 14, scale: 2 }).notNull(),
    serviceFamily: text("service_family").notNull(),
    revenueNature: text("revenue_nature").notNull(),
    serviceId: uuid("service_id").references(() => servicosCanonicos.id),
    confidence: text("confidence").notNull(),
    evidence: jsonb("evidence").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_service_ledger_entry_source").on(table.batchId, table.sourceRowHash),
    index("idx_service_ledger_entries_service_id").on(table.serviceId),
  ],
);

export const servicoBillingTimeline = pgTable(
  "servico_billing_timeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    empresaId: uuid("empresa_id").references(() => empresas.id),
    leadId: uuid("lead_id").references(() => leads.id),
    contratoId: uuid("contrato_id").references(() => contratos.id),
    assinaturaId: uuid("assinatura_id"),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    serviceFamily: text("service_family").notNull(),
    revenueNature: text("revenue_nature").notNull(),
    billingStatus: text("billing_status").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).default("0").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }),
    isCurrent: boolean("is_current").default(false).notNull(),
    confidence: text("confidence").notNull(),
    evidence: jsonb("evidence").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    servicoId: uuid("servico_id").references(() => servicosCanonicos.id),
  },
  (table) => [
    uniqueIndex("idx_servico_billing_timeline_external").on(table.organizacaoId, table.provider, table.externalId),
    index("idx_servico_billing_timeline_servico_id").on(table.servicoId),
  ],
);

export const reconciliationRuns = pgTable(
  "reconciliation_runs",
  {
    id: uuid("id").primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    packageVersion: text("package_version").notNull(),
    packageSha256: text("package_sha256").notNull(),
    environment: text("environment").notNull(), // HOMOLOG | PROD
    status: text("status").notNull(), // RUNNING | COMPLETED | FAILED
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    writesInserted: integer("writes_inserted").default(0).notNull(),
    writesUpdated: integer("writes_updated").default(0).notNull(),
    writesDeactivated: integer("writes_deactivated").default(0).notNull(),
    summary: jsonb("summary").default({}).notNull(),
  },
  (table) => [
    uniqueIndex("idx_reconciliation_run_package").on(table.organizacaoId, table.packageVersion, table.packageSha256),
  ],
);

export const reconciliationChanges = pgTable(
  "reconciliation_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => reconciliationRuns.id).notNull(),
    actionId: text("action_id").notNull(),
    tableName: text("table_name").notNull(),
    recordKey: text("record_key").notNull(),
    operation: text("operation").notNull(), // INSERT | UPDATE | DEACTIVATE
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state").notNull(),
    evidence: jsonb("evidence").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_reconciliation_change").on(table.runId, table.actionId, table.tableName, table.recordKey),
  ],
);

// ─── Recuperação legado Zoho (histórico, anexos, provenance) ───────────────

// ─── ANEXOS (documentos de negócio e da entrega) ──────────
// Portados do CRM 2.0 junto com as telas de pós-venda. `anexos_legado` JÁ
// existe no banco de produção (veio da reconciliação); `anexos` é criada pela
// migration 0010.
export const anexosLegado = pgTable("anexos_legado", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  entidadeTipo: text("entidade_tipo").notNull(),
  entidadeId: uuid("entidade_id"),
  categoria: text("categoria").default("anexo_generico").notNull(),
  zohoId: text("zoho_id"),
  nomeArquivo: text("nome_arquivo").notNull(),
  tamanhoBytes: integer("tamanho_bytes"),
  criadoEmOriginal: timestamp("criado_em_original", { withTimezone: true }),
  storagePath: text("storage_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  checksumSha256: text("checksum_sha256"),
}, (table) => [
  index("idx_anexos_legado_entidade").on(table.entidadeTipo, table.entidadeId),
  index("idx_anexos_legado_org").on(table.organizacaoId),
  uniqueIndex("idx_anexos_legado_zoho_dedup").on(table.organizacaoId, table.zohoId).where(sql`zoho_id IS NOT NULL`),
]);

// ─── ANEXOS (upload real, 25/08) ────────────────────────────
// Diferente de `anexosLegado` (histórico Zoho, read-only, arquivo físico
// pode não existir neste ambiente): estes são uploads REAIS feitos pelo
// time direto no CRM (nota, negócio, etc.), salvos em `UPLOADS_DIR` —
// mesmo mecanismo já usado pra avatar de perfil (`api-server/routes/perfil.ts`).
export const anexos = pgTable(
  "anexos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "cascade" }),
    notaId: uuid("nota_id").references(() => notas.id, { onDelete: "cascade" }),
    nomeArquivo: text("nome_arquivo").notNull(),
    url: text("url").notNull(),
    tipoMime: text("tipo_mime"),
    tamanhoBytes: integer("tamanho_bytes"),
    criadoPorId: uuid("criado_por_id").references(() => usuarios.id),
    /** Acervo canônico do binário (SPEC §32). NULL = anexo de antes da virada. */
    fileObjectId: uuid("file_object_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_anexos_negocio").on(table.negocioId),
    index("idx_anexos_nota").on(table.notaId),
    index("idx_anexos_org").on(table.organizacaoId),
  ]
);

export const legacyProvenance = pgTable("legacy_provenance", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  entidadeTipo: text("entidade_tipo").notNull(),
  entidadeId: uuid("entidade_id").notNull(),
  zohoId: text("zoho_id").notNull(),
  confianca: text("confianca").default("confirmado").notNull(),
  evidencia: jsonb("evidencia"),
  recoveredAt: timestamp("recovered_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_legacy_provenance_entidade").on(table.entidadeTipo, table.entidadeId),
  index("idx_legacy_provenance_org").on(table.organizacaoId),
  uniqueIndex("idx_legacy_provenance_zoho_dedup").on(table.organizacaoId, table.entidadeTipo, table.zohoId),
]);

// ─── BILLING IDENTITIES ───────────────────────────────────────
// CONVERGIDA no merge de 20/09. Os dois lados modelavam a mesma tabela de
// formas diferentes e o banco carregado de produção tem as colunas dos DOIS:
//   dev  -> canonical_empresa_id/canonical_lead_id + provider + external_customer_id
//   prod -> empresa_id/lead_id + canonical_stripe_customer_id + cnpj/email normalizados
// A declaração abaixo espelha o banco coluna a coluna, com a nullability real.
// Unificar os dois modelos num só é decisão de produto, ainda em aberto.
export const billingIdentities = pgTable("billing_identities", {
  id: uuid("id").primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  canonicalEmpresaId: uuid("canonical_empresa_id").references(() => empresas.id, { onDelete: "set null" }),
  canonicalLeadId: uuid("canonical_lead_id").references(() => leads.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  externalCustomerId: text("external_customer_id").notNull(),
  emails: jsonb("emails").default([]).notNull(),
  phones: jsonb("phones").default([]).notNull(),
  confidence: text("confidence").notNull(),
  evidence: jsonb("evidence").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // ── vindas de produção ──
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  canonicalStripeCustomerId: text("canonical_stripe_customer_id"),
  cnpjNormalized: text("cnpj_normalized"),
  primaryEmailNormalized: text("primary_email_normalized"),
  status: text("status"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_billing_identities_dedup").on(table.organizacaoId, table.provider, table.externalCustomerId, table.canonicalLeadId),
]);

export const billingCustomerAliases = pgTable("billing_customer_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  billingIdentityId: uuid("billing_identity_id").references(() => billingIdentities.id).notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  isCanonical: boolean("is_canonical").default(false).notNull(),
  resolutionSource: text("resolution_source").notNull(),
  evidence: jsonb("evidence").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_billing_alias_customer").on(table.stripeCustomerId),
]);

// ─── BILLING AUDIT (auditoria de identidade de faturamento) ───────────────────
// Existiam no banco e não no schema desde a criação em produção. Declaradas na
// fase 01 do refactor para fechar o drift medido no levantamento AS-IS.
export const billingAuditRuns = pgTable("billing_audit_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "set null" }),
  scope: jsonb("scope").default({}).notNull(),
  status: text("status").default("RUNNING").notNull(),
  summary: jsonb("summary").default({}).notNull(),
  artifactPath: text("artifact_path"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const billingResolutionCases = pgTable("billing_resolution_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  auditRunId: uuid("audit_run_id").references(() => billingAuditRuns.id, { onDelete: "set null" }),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "set null" }),
  queue: text("queue").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  crmEntityType: text("crm_entity_type"),
  crmEntityId: uuid("crm_entity_id"),
  evidence: jsonb("evidence").default({}).notNull(),
  recommendedAction: jsonb("recommended_action").default({}).notNull(),
  status: text("status").default("OPEN").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const billingCorrectionLedger = pgTable("billing_correction_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  auditRunId: uuid("audit_run_id").references(() => billingAuditRuns.id, { onDelete: "set null" }),
  billingIdentityId: uuid("billing_identity_id").references(() => billingIdentities.id, { onDelete: "set null" }),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  before: jsonb("before").default({}).notNull(),
  after: jsonb("after").default({}).notNull(),
  evidence: jsonb("evidence").default({}).notNull(),
  ruleApplied: text("rule_applied").notNull(),
  operator: text("operator").notNull(),
  reversible: boolean("reversible").default(true).notNull(),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// SPEC §21.5: esta tabela deve virar projeção derivada de relatório, não fonte de
// verdade mantida à mão. Declarada aqui para fechar o drift; a conversão em
// projeção acontece na fase de finanças.
export const clienteReceitaMensal = pgTable("cliente_receita_mensal", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
  customerKey: text("customer_key").notNull(),
  clienteNome: text("cliente_nome").notNull(),
  documento: text("documento"),
  competencia: date("competencia").notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).default("0").notNull(),
  quantidadeLancamentos: integer("quantidade_lancamentos").default(1).notNull(),
  serviceFamily: text("service_family").default("UNKNOWN").notNull(),
  revenueNature: text("revenue_nature").default("UNKNOWN").notNull(),
  canonicalProduct: text("canonical_product"),
  confidence: text("confidence").default("UNRESOLVED").notNull(),
  source: text("source").notNull(),
  sourceFile: text("source_file"),
  sourceRow: text("source_row"),
  evidence: jsonb("evidence").default({}).notNull(),
  sourceHash: text("source_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const catalogoMapeamentosLegacy = pgTable("catalogo_mapeamentos_legacy", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  legacyProductId: text("legacy_product_id").notNull(),
  legacyName: text("legacy_name").notNull(),
  canonicalProductId: uuid("canonical_product_id").references(() => servicosCatalogo.id, { onDelete: "set null" }),
  canonicalName: text("canonical_name"),
  serviceFamily: text("service_family").notNull(),
  defaultRevenueNature: text("default_revenue_nature").notNull(),
  activeSelectable: boolean("active_selectable").default(false).notNull(),
  historicalOnly: boolean("historical_only").default(true).notNull(),
  confidence: text("confidence").notNull(), // CONFIRMED | PROBABLE | AMBIGUOUS | UNRESOLVED
  evidence: text("evidence"),
  // Classificação do legado (02/09) — campos que faltavam pra essa camada
  // servir de fato a relatório/Cliente 360/financeiro. Nenhuma tabela nova:
  // a camada de mapeamento já existia, só estava mal preenchida (53% das
  // linhas UNKNOWN, e 100% delas marcadas como CONFIRMED).
  legacySource: text("legacy_source"), // onde o nome aparece no histórico
  categoriaCrm: text("categoria_crm"), // plano | setup | hardware | ... | ajuste_financeiro
  ruleSource: text("rule_source"), // planilha_oficial | regra_ajuste | regra_nome | generico_ambiguo | sem_evidencia
  reviewedStatus: text("reviewed_status").default("pendente").notNull(), // pendente | revisado | ignorado
  revisadoPor: uuid("revisado_por").references(() => usuarios.id),
  revisadoEm: timestamp("revisado_em", { withTimezone: true }),
  notes: text("notes"),
  ocorrencias: integer("ocorrencias").default(0).notNull(),
  classificadoEm: timestamp("classificado_em", { withTimezone: true }),
  // Coluna GERADA no banco (sempre coerente com legacy_name). Existe pra
  // casar o histórico (`contrato_itens.nome`, `fatura_itens.nome`) com a
  // classificação por um índice, em vez de repetir translate+regexp em cada
  // relatório. `legacy_product_id` não serve pra isso: nas 193 linhas antigas
  // ele é o id do produto no Zoho.
  nomeNormalizado: text("nome_normalizado").generatedAlwaysAs(sql`btrim(regexp_replace(lower(translate(legacy_name, 'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]+', ' ', 'g'))`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_catalogo_mapeamentos_legacy_dedup").on(table.organizacaoId, table.legacyProductId),
  index("idx_catalogo_mapeamentos_legacy_familia").on(table.organizacaoId, table.serviceFamily, table.confidence),
  index("idx_catalogo_mapeamentos_legacy_revisao").on(table.organizacaoId, table.reviewedStatus, table.confidence),
]);

export const contratoItens = pgTable("contrato_itens", {
  id: uuid("id").defaultRandom().primaryKey(),
  contratoId: uuid("contrato_id").references(() => contratos.id, { onDelete: "cascade" }),
  servicoCatalogoId: uuid("servico_catalogo_id").references(() => servicosCatalogo.id),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).default("1").notNull(),
  valorUnitario: decimal("valor_unitario", { precision: 12, scale: 2 }).default("0").notNull(),
  desconto: decimal("desconto", { precision: 5, scale: 2 }).default("0"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
  zohoId: text("zoho_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  serviceFamily: text("service_family"),
  revenueNature: text("revenue_nature"),
  recurringValue: decimal("recurring_value", { precision: 14, scale: 2 }),
  nonRecurringValue: decimal("non_recurring_value", { precision: 14, scale: 2 }),
  billingSource: text("billing_source"),
  semanticConfidence: text("semantic_confidence"),
  semanticEvidence: jsonb("semantic_evidence"),
  provenance: text("provenance"),
}, (table) => [
  index("idx_contrato_itens_contrato").on(table.contratoId),
  index("idx_contrato_itens_servico").on(table.servicoCatalogoId),
  uniqueIndex("idx_contrato_itens_zoho_dedup").on(table.zohoId).where(sql`zoho_id IS NOT NULL`),
]);

export const faturaItens = pgTable("fatura_itens", {
  id: uuid("id").primaryKey(),
  faturaId: uuid("fatura_id").references(() => faturas.id, { onDelete: "cascade" }).notNull(),
  servicoCatalogoId: uuid("servico_catalogo_id").references(() => servicosCatalogo.id, { onDelete: "set null" }),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  quantidade: decimal("quantidade", { precision: 14, scale: 2 }).default("1").notNull(),
  valorUnitario: decimal("valor_unitario", { precision: 14, scale: 2 }).default("0").notNull(),
  desconto: decimal("desconto", { precision: 14, scale: 2 }).default("0").notNull(),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).default("0").notNull(),
  moeda: text("moeda").default("BRL").notNull(),
  zohoId: text("zoho_id"),
  provenance: text("provenance"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  servicoId: uuid("servico_id").references(() => servicosCanonicos.id, { onDelete: "set null" }),
}, (table) => [
  index("idx_fatura_itens_servico_id").on(table.servicoId),
  uniqueIndex("idx_fatura_itens_zoho_id").on(table.zohoId).where(sql`zoho_id IS NOT NULL`),
]);

// ─── EVENTOS_COMERCIAIS (fato/evidência histórica bruta) ───────────────────
// Fluxo de normalização (decisão fechada 2026-08-16): eventos_comerciais é o
// fato bruto recuperado do Zoho; comercialEvidencia é a representação
// normalizada dentro do domínio comercial CRM2; mrrMovimentos é a
// representação financeira normalizada, só quando o evento altera MRR de
// forma determinística (nunca cópia cega — ver mrrMovimentos.eventoComercialId).
export const eventosComerciais = pgTable("eventos_comerciais", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  negocioId: uuid("negocio_id").references(() => negocios.id),
  negocioOrigemId: uuid("negocio_origem_id"),
  contratoId: uuid("contrato_id").references(() => contratos.id),
  tipo: text("tipo").notNull(), // churn | upgrade | downgrade | renovacao | alteracao_contratual
  zohoId: text("zoho_id"),
  confianca: text("confianca").default("confirmado").notNull(),
  evidencia: jsonb("evidencia"),
  responsavelId: uuid("responsavel_id").references(() => usuarios.id),
  ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull(),
  origem: text("origem").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  servicoId: uuid("servico_id").references(() => servicosCanonicos.id, { onDelete: "set null" }),
}, (table) => [
  index("idx_eventos_comerciais_contrato").on(table.contratoId),
  index("idx_eventos_comerciais_negocio").on(table.negocioId),
  index("idx_eventos_comerciais_negocio_origem").on(table.negocioOrigemId),
  index("idx_eventos_comerciais_org").on(table.organizacaoId),
  index("idx_eventos_comerciais_servico_id").on(table.servicoId),
  index("idx_eventos_comerciais_tipo").on(table.tipo),
  uniqueIndex("idx_eventos_comerciais_zoho_dedup").on(table.organizacaoId, table.zohoId).where(sql`zoho_id IS NOT NULL`),
]);

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: uuid("id").primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  component: text("component").notNull(),
  value: decimal("value", { precision: 14, scale: 2 }).notNull(),
  asOfDate: date("as_of_date"),
  confidence: text("confidence").notNull(),
  evidence: text("evidence"),
  currentExact: boolean("current_exact").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_portfolio_snapshots_dedup").on(table.organizacaoId, table.snapshotDate, table.component),
]);

// ─── Auditoria da correção v1.0 (evidência de proveniência) ────────────────
export const correctionRuns = pgTable("correction_runs", {
  id: uuid("id").primaryKey(),
  ledgerSha256: text("ledger_sha256").notNull(),
  mode: text("mode").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  changeCount: integer("change_count").default(0).notNull(),
  details: jsonb("details").default({}).notNull(),
});

export const correctionChangeLog = pgTable("correction_change_log", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  runId: uuid("run_id").references(() => correctionRuns.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  confidence: text("confidence"),
  evidence: jsonb("evidence"),
  source: text("source"),
});

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
  uniqueIndex("idx_pessoas_lead_legado").on(table.leadIdLegado),
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
  // Bridge de migração/dual-write (backfill de recuperação legado, 2026-08-16)
  // — mesma lógica de pessoas.leadIdLegado.
  leadIdLegado: uuid("lead_id_legado").references(() => leads.id),
  aquisicaoId: uuid("aquisicao_id"),
  gclid: text("gclid"),
  fbclid: text("fbclid"),
  fbc: text("fbc"),
  fbp: text("fbp"),
  metaLeadId: text("meta_lead_id"),
  adsetId: text("adset_id"),
  adId: text("ad_id"),
  provider: text("provider"),
  metadata: jsonb("metadata").default({}).notNull(),
}, (table) => [
  index("idx_pontos_contato_org").on(table.organizacaoId),
  index("idx_pontos_contato_pessoa").on(table.pessoaId),
  index("idx_pontos_contato_empresa").on(table.empresaId),
  index("idx_pontos_contato_pessoa_first").on(table.pessoaId, table.isFirstTouch),
  index("idx_pontos_contato_pessoa_last").on(table.pessoaId, table.isLastTouch),
  uniqueIndex("idx_pontos_contato_lead_legado").on(table.leadIdLegado).where(sql`lead_id_legado IS NOT NULL`),
]);

// ─── OPORTUNIDADE_BUNDLE (agregação de oportunidades irmãs — ADR-EXEC-022) ──
// Quando uma negociação nasce multi-linha (ex: cliente quer Callface AI +
// PABX ao mesmo tempo), cada linha vira sua PRÓPRIA oportunidade — com
// stage/resultado/responsável/valor independentes. O bundle só AGREGA pra
// mostrar "essas N oportunidades vieram da mesma negociação" — não é status,
// não tem stage próprio, não decide won/lost de ninguém.
export const oportunidadeBundle = pgTable("oportunidade_bundle", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(), // ex: "Máxima Educacional — Nova venda"
  leadId: uuid("lead_id").references(() => leads.id),
  empresaId: uuid("empresa_id").references(() => empresas.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_oportunidade_bundle_org").on(table.organizacaoId),
  index("idx_oportunidade_bundle_lead").on(table.leadId),
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
    /** Estagnação: motivo registrado por quem opera (SPEC §11.1, migration 0084). */
    motivoEstagnacao: text("motivo_estagnacao"),
    estagnadoEm: timestamp("estagnado_em", { withTimezone: true }),
    /** Período de trial (SPEC §11.1, migration 0085). */
    trialIniciadoEm: timestamp("trial_iniciado_em", { withTimezone: true }),
    trialEncerradoEm: timestamp("trial_encerrado_em", { withTimezone: true }),
  // Bridge de migração/dual-write — mesma lógica de pessoas.leadIdLegado.
  negocioIdLegado: uuid("negocio_id_legado").references(() => negocios.id),
  // Commercial Core v3 (ADR-EXEC-022) — espelha negocios.bundleId (dual-write).
  bundleId: uuid("bundle_id").references((): AnyPgColumn => oportunidadeBundle.id),
  // Módulo Vendas: os mesmos fatos do negócio, para que a leitura nova não
  // precise atravessar para a tabela legada.
  titulo: text("titulo"),
  serviceFamily: text("service_family"),
  etapa: text("etapa"),
  commercialMotion: text("commercial_motion"),
  sourceProcess: text("source_process"),
  leadId: uuid("lead_id").references(() => leads.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ofertaComercialId: uuid("oferta_comercial_id"),
  // Campos que o SPEC §11.1 define e a expansão da fase 04 não criou
  // (migration 0073). `setup_estimado` separa receita de implantação do
  // recorrente: são coisas diferentes para quem decide, e juntá-las em `valor`
  // fazia o relatório perder a distinção.
  setupEstimado: decimal("setup_estimado", { precision: 12, scale: 2 }),
  servicoCatalogoId: uuid("servico_catalogo_id").references(() => servicosCatalogo.id),
  /** A etapa como REFERÊNCIA. O texto em `etapa` fica até a contração. */
  etapaId: uuid("etapa_id").references(() => pipelineEtapas.id),
}, (table) => [
  index("idx_oportunidades_org").on(table.organizacaoId),
  index("idx_oportunidades_pessoa").on(table.pessoaId),
  index("idx_oportunidades_empresa").on(table.empresaId),
  index("idx_oportunidades_stage").on(table.stage),
  index("idx_oportunidades_responsavel").on(table.responsavelId),
  uniqueIndex("idx_oportunidades_negocio_legado").on(table.negocioIdLegado),
]);

// ─── OPORTUNIDADE_ITENS (item/produto/serviço comercial — ADR-EXEC-019/022) ─
// Correção arquitetural (16/08): service_family/revenue_nature NÃO são
// propriedade estrutural de Oportunidade — vivem no item, não no container.
// Uma oportunidade pode ter múltiplos itens da MESMA linha comercial (ex:
// White Label licença MRR + setup + adicional, ou Callface AI plano +
// adicionais) — isso continua 1 oportunidade só. O que NÃO acontece mais
// (correção ADR-EXEC-022): linhas comerciais INDEPENDENTES (Callface AI +
// PABX) misturadas na mesma oportunidade — cada ciclo independente agora
// vira sua própria oportunidade, relacionadas via oportunidadeBundle quando
// nasceram da mesma negociação. Depois do fechamento cada item dá origem a
// um servicoCanonico correspondente (servicoCanonicoId linka quando existir).
export const oportunidadeItens = pgTable("oportunidade_itens", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  oportunidadeId: uuid("oportunidade_id").references(() => oportunidades.id, { onDelete: "cascade" }).notNull(),
  produto: text("produto"),
  serviceFamily: text("service_family").notNull(), // PABX | CALLFACE_AI | WHITE_LABEL | UNKNOWN
  revenueNature: text("revenue_nature").notNull(), // MRR | SETUP | PROJECT | ONE_TIME | USAGE | HARDWARE | UNKNOWN
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).default("1").notNull(),
  precoUnitario: decimal("preco_unitario", { precision: 12, scale: 2 }).default("0").notNull(),
  desconto: decimal("desconto", { precision: 12, scale: 2 }).default("0"),
  valorTotal: decimal("valor_total", { precision: 12, scale: 2 }).default("0").notNull(),
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id),
  // De onde este item veio: contrato_item/proposta_item são bridge de
  // migração legado (só um dos dois FKs abaixo preenchido); "manual" é
  // Commercial Core (ADR-EXEC-020) — Won 100% manual sem proposta por trás,
  // sem FK de bridge nenhum, quantidade/valor derivados direto do negócio.
  origemLegado: text("origem_legado").notNull(), // contrato_item | proposta_item | manual
  contratoItemIdLegado: uuid("contrato_item_id_legado").references(() => contratoItens.id),
  propostaItemIdLegado: uuid("proposta_item_id_legado").references(() => propostaItens.id),
  // Commercial Core v2 (ADR-EXEC-021) — herdado do proposta_item no momento
  // do sync; grupoComercialId só existe depois do aceite (quando os grupos
  // de fulfillment são formados), null em rascunho.
  commercialModel: text("commercial_model"),
  grupoComercialId: uuid("grupo_comercial_id").references((): AnyPgColumn => propostaGrupoComercial.id),
  // Catálogo Oficial Stripe (02/09) — é `oportunidade_itens` que vira serviço
  // canônico, e é dele que a 2C.2 vai ler o price pra montar a assinatura.
  catalogoPrecoId: uuid("catalogo_preco_id").references((): AnyPgColumn => catalogoPrecos.id),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  skuPreco: text("sku_preco"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_oportunidade_itens_oportunidade").on(table.oportunidadeId),
  uniqueIndex("idx_oportunidade_itens_contrato_legado").on(table.contratoItemIdLegado).where(sql`contrato_item_id_legado IS NOT NULL`),
  uniqueIndex("idx_oportunidade_itens_proposta_legado").on(table.propostaItemIdLegado).where(sql`proposta_item_id_legado IS NOT NULL`),
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
  // CS Owner (18/08, referência de UX da Carteira) — dono da conta pós-venda,
  // distinto do responsável comercial (negocios.responsavelId, quem vendeu)
  // e do responsável de entrega (fulfillments.responsavelId, quem implanta).
  responsavelId: uuid("responsavel_id").references(() => usuarios.id),
  // Contexto de CS (08/09) — entrada na carteira é a data real do serviço
  // mais antigo, não a data em que a linha foi criada; `jornadaIniciadaEm`
  // marca que os marcos de relacionamento já foram semeados (ver lib/cs/jornada.ts).
  entrouCarteiraEm: timestamp("entrou_carteira_em", { withTimezone: true }),
  observacoesCs: text("observacoes_cs"),
  /**
   * Sem nenhuma evidência real de quando virou cliente (nem Won, nem início
   * de contrato, nem primeira fatura) — 91 das 299 contas. A data de entrada
   * dessas é a da reconciliação de agosto/2026, e a jornada delas parte daí.
   * Sinalizado em vez de escondido: é um gap de dado, não um cliente novo.
   */
  csSemEvidencia: boolean("cs_sem_evidencia").default(false).notNull(),
  jornadaIniciadaEm: timestamp("jornada_iniciada_em", { withTimezone: true }),
  leadIdLegado: uuid("lead_id_legado").references(() => leads.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  responsavelCsId: uuid("responsavel_cs_id"),
  lifecycleStatus: text("lifecycle_status"),
  ultimoContatoEm: timestamp("ultimo_contato_em", { withTimezone: true }),
  proximaRevisaoEm: timestamp("proxima_revisao_em", { withTimezone: true }),
  healthAtual: integer("health_atual"),
}, (table) => [
  index("idx_clientes_org").on(table.organizacaoId),
  index("idx_clientes_empresa").on(table.empresaId),
  uniqueIndex("idx_clientes_lead_legado").on(table.leadIdLegado),
  // PARCIAL de propósito (empresa_id é nullable). Existia no banco desde a
  // migration 0012 e não estava declarado aqui — divergência que escondia a
  // razão de `onConflictDoNothing` falhar em lib/cs/handoff.ts. Quem usar este
  // índice em ON CONFLICT precisa repetir o predicado `isNotNull(empresaId)`.
  uniqueIndex("idx_clientes_org_empresa").on(table.organizacaoId, table.empresaId).where(sql`empresa_id IS NOT NULL`),
]);

// ─── EVENT OUTBOX (espinha dorsal de eventos — Postgres + BullMQ) ──
// ADR-EXEC-001: outbox Postgres + worker BullMQ existente, sem broker novo.
// Escrito na MESMA transação da mudança de domínio; consumido por job
// dedicado que publica pros interessados (ex: DealWon -> CS/Finance/Analytics).
// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 5 (Automação): Cadence Engine — genérico, desacoplado de
// canal/provider de IA. Ver docs/decisoes/ARCHITECTURE_DECISIONS.md
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
  draftSteps: jsonb("draft_steps"),
  triggerConfig: jsonb("trigger_config").default({}).notNull(),
  handoffPolicy: jsonb("handoff_policy").default({ mode: "pause_on_reply" }).notNull(),
  status: text("status").default("draft").notNull(), // draft | published | disabled | archived
  versao: integer("versao").default(1).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cadenceVersions = pgTable("cadence_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  cadenceDefinitionId: uuid("cadence_definition_id").references(() => cadenceDefinitions.id, { onDelete: "cascade" }).notNull(),
  versionNumber: integer("version_number").notNull(),
  status: text("status").default("draft").notNull(), // draft | published | superseded
  graph: jsonb("graph").notNull(),
  compiledSteps: jsonb("compiled_steps").notNull(),
  triggerConfig: jsonb("trigger_config").default({}).notNull(),
  handoffPolicy: jsonb("handoff_policy").default({ mode: "pause_on_reply" }).notNull(),
  validationSnapshot: jsonb("validation_snapshot").default({}).notNull(),
  createdById: uuid("created_by_id").references(() => usuarios.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_cadence_versions_definition_number").on(table.cadenceDefinitionId, table.versionNumber),
  index("idx_cadence_versions_org_status").on(table.organizacaoId, table.status),
]);

export const cadenceDefinitionPointers = pgTable("cadence_definition_pointers", {
  cadenceDefinitionId: uuid("cadence_definition_id").references(() => cadenceDefinitions.id, { onDelete: "cascade" }).primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
  draftVersionId: uuid("draft_version_id").references(() => cadenceVersions.id, { onDelete: "set null" }),
  publishedVersionId: uuid("published_version_id").references(() => cadenceVersions.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_cadence_definition_pointers_org").on(table.organizacaoId),
]);

export const cadenceEnrollments = pgTable("cadence_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  cadenceDefinitionId: uuid("cadence_definition_id").references(() => cadenceDefinitions.id, { onDelete: "cascade" }).notNull(),
  cadenceVersionId: uuid("cadence_version_id").references(() => cadenceVersions.id, { onDelete: "restrict" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  // Evento que originou esta execução. A chave abaixo impede replay do mesmo
  // evento na mesma definição, mesmo com mais de um worker.
  sourceEventId: uuid("source_event_id").references(() => eventOutbox.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key"),
  currentStepId: text("current_step_id"), // null antes do 1º step
  currentNodeId: text("current_node_id"),
  status: text("status").notNull().default("active"), // active | waiting | completed | cancelled | failed
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }), // próxima execução devida
  nextEvalAt: timestamp("next_eval_at", { withTimezone: true }),
  claimedUntil: timestamp("claimed_until", { withTimezone: true }),
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  handoffSnapshot: jsonb("handoff_snapshot"),
  vars: jsonb("vars").default({}), // contexto acumulado (resolvido pelo caller: nome, empresa, telefone, etc)
  attempt: integer("attempt").default(0).notNull(), // tentativas do step ATUAL (retry)
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_cadence_enrollments_scheduled").on(table.status, table.scheduledAt),
  index("idx_cadence_enrollments_due").on(table.status, table.nextEvalAt, table.claimedUntil),
  index("idx_cadence_enrollments_entity").on(table.entityType, table.entityId),
  index("idx_cadence_enrollments_org").on(table.organizacaoId),
  uniqueIndex("uq_cadence_enrollments_idempotency").on(table.idempotencyKey),
]);

export const cadenceEnrollmentEvents = pgTable("cadence_enrollment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id").references(() => cadenceEnrollments.id, { onDelete: "cascade" }).notNull(),
  stepId: text("step_id").notNull(),
  status: text("status").notNull(), // executado | erro | condicao_nao_atendida | retry_agendado | cancelado
  resultado: jsonb("resultado"),
  attempt: integer("attempt").default(0).notNull(),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_cadence_enrollment_events_enrollment").on(table.enrollmentId),
  uniqueIndex("uq_cadence_enrollment_events_idempotency").on(table.idempotencyKey),
]);

// ═══════════════════════════════════════════════════════════════
// CRM 2.0 — FASE 4 (Commercial): Commercial Evidence — Won não pode ficar
// acoplado só ao Stripe (achado real: PBX/venda manual fatura fora do
// Stripe). Ver docs/decisoes/ARCHITECTURE_DECISIONS.md (ADR-EXEC-012).
// ═══════════════════════════════════════════════════════════════

export const comercialEvidencia = pgTable("comercial_evidencia", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "cascade" }).notNull(),
  // stripe_payment | stripe_subscription | signed_contract | manual_contract | admin_approval | financial_attestation
  tipo: text("tipo").notNull(),
  sourceRef: text("source_ref"), // id do contrato/assinatura/subscription que originou a evidência
  metadata: jsonb("metadata"),
  // Commercial Core v2 (ADR-EXEC-021) — a que grupo comercial esta evidência
  // pertence (venda mista: evidência do grupo AI é distinta da do grupo PABX).
  // Nullable pra manter compat com evidência pré-existente sem grupo.
  grupoComercialId: uuid("grupo_comercial_id").references((): AnyPgColumn => propostaGrupoComercial.id),
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
  tiposAceitos: jsonb("tipos_aceitos").notNull(), // string[] de TipoEvidenciaComercial — legado: QUALQUER um já libera Won (OR)
  // Correção de escopo (19/08): "qualquer evidência isolada libera Won" é
  // perigoso quando o fluxo exige contrato E pagamento juntos (ex: PABX
  // novo). requiredCombinations descreve isso como OR-de-AND: array de
  // combinações, cada combinação é um array de tipos que precisam TODOS
  // estar presentes; basta UMA combinação ser satisfeita.
  // Ex.: [["signed_contract","stripe_payment"]] exige as duas evidências
  // juntas. Nullable de propósito: quando ausente, o gate cai no
  // comportamento legado (tiposAceitos como OR simples) — nenhuma política
  // existente muda de comportamento só por esta coluna existir. Qual
  // combinação vale pra qual produto é calibração comercial, não decidida
  // aqui (crm2-decisoes-pendentes.md).
  requiredCombinations: jsonb("required_combinations"),
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
// Ver docs/decisoes/ARCHITECTURE_DECISIONS.md (ADR-EXEC-011).
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
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_event_outbox_idempotency").on(table.idempotencyKey),
  index("idx_event_outbox_status").on(table.status),
  index("idx_event_outbox_org").on(table.organizacaoId),
  index("idx_event_outbox_aggregate").on(table.aggregateType, table.aggregateId),
]);

// ═══════════════════════════════════════════════════════════════
// Commercial Core v2 (ADR-EXEC-021) — Checkout como entidade própria +
// Grupo Comercial (fulfillment independente por composição dentro da mesma
// proposta/oportunidade) + Templates de Contrato.
// ═══════════════════════════════════════════════════════════════

export const checkouts = pgTable("checkouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  propostaId: uuid("proposta_id").references(() => propostas.id).notNull(),
  negocioId: uuid("negocio_id").references(() => negocios.id),
  grupoComercialId: uuid("grupo_comercial_id").references((): AnyPgColumn => propostaGrupoComercial.id),
  origem: text("origem").notNull(), // automatico_pos_aceite | manual_vendedor
  criadoPorId: uuid("criado_por_id").references(() => usuarios.id), // só quando origem=manual_vendedor
  stripeSessionId: text("stripe_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCheckoutUrl: text("stripe_checkout_url"),
  status: text("status").default("criado").notNull(), // criado | aberto | pago | falhou | expirado | cancelado
  // Frente 2C.1 — campos que a 2C.2 (Stripe de verdade) preenche. Nenhuma
  // integração nova escreve neles agora: existem pra que o motor interno
  // já tenha onde receber o dado sem migration na hora da integração.
  stripeCustomerId: text("stripe_customer_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status"), // pendente | confirmado | falhou
  nextPaymentDueAt: timestamp("next_payment_due_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
  aberturaEm: timestamp("abertura_em", { withTimezone: true }),
  completadoEm: timestamp("completado_em", { withTimezone: true }),
  expiraEm: timestamp("expira_em", { withTimezone: true }),
}, (table) => [
  index("idx_checkouts_proposta").on(table.propostaId),
  index("idx_checkouts_org").on(table.organizacaoId),
  uniqueIndex("idx_checkouts_stripe_session").on(table.stripeSessionId).where(sql`stripe_session_id IS NOT NULL`),
]);

// Agrupa proposta_itens que compartilham o MESMO modelo comercial — cada
// grupo tem estado PRÓPRIO e independente dos outros grupos da mesma
// proposta (achado real do E2E anterior: "tem PABX na proposta, então tudo
// espera PABX" quebra venda mista de verdade).
export const propostaGrupoComercial = pgTable("proposta_grupo_comercial", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  propostaId: uuid("proposta_id").references(() => propostas.id).notNull(),
  negocioId: uuid("negocio_id").references(() => negocios.id),
  oportunidadeId: uuid("oportunidade_id").references(() => oportunidades.id),
  commercialModel: text("commercial_model").notNull(), // PAGAMENTO_DIRETO | CONTRATO_OBRIGATORIO | CONTRATO_FIDELIDADE_OPCIONAL
  status: text("status").default("aguardando_aceite").notNull(),
  // aguardando_aceite | aguardando_contrato | contrato_enviado_assinatura |
  // contrato_assinado | aguardando_checkout | checkout_gerado |
  // pagamento_pendente | pago | concluido | falhou
  contratoId: uuid("contrato_id").references(() => contratos.id),
  checkoutId: uuid("checkout_id").references(() => checkouts.id),
  concluidoEm: timestamp("concluido_em", { withTimezone: true }),
  // Frente 2C.1 — a família comercial do grupo, denormalizada dos itens no
  // momento do aceite. É ela que decide QUAL evidência fecha a venda
  // (Callface AI = pagamento; PABX/White Label = contrato assinado) e pra
  // qual trilha de entrega o cliente vai. Ver lib/crm/politica-familia.ts.
  serviceFamily: text("service_family"), // PABX | CALLFACE_AI | WHITE_LABEL | UNKNOWN
  contratoAssinadoEm: timestamp("contrato_assinado_em", { withTimezone: true }),
  // Entrega liberada != pagamento confirmado. Em PABX/White Label a
  // assinatura já libera a materialização do serviço e a implantação,
  // enquanto o pagamento segue rastreado como pendente.
  entregaLiberadaEm: timestamp("entrega_liberada_em", { withTimezone: true }),
  entregaLiberadaPor: text("entrega_liberada_por"), // contrato_assinado | pagamento_confirmado | manual
  pagamentoStatus: text("pagamento_status"), // pendente | confirmado | falhou
  pagamentoVenceEm: timestamp("pagamento_vence_em", { withTimezone: true }),
  pagamentoConfirmadoEm: timestamp("pagamento_confirmado_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_grupo_comercial_proposta").on(table.propostaId),
  index("idx_grupo_comercial_negocio").on(table.negocioId),
  index("idx_grupo_comercial_status").on(table.organizacaoId, table.status),
]);

export const propostaGrupoComercialItens = pgTable("proposta_grupo_comercial_itens", {
  id: uuid("id").defaultRandom().primaryKey(),
  grupoId: uuid("grupo_id").references(() => propostaGrupoComercial.id, { onDelete: "cascade" }).notNull(),
  propostaItemId: uuid("proposta_item_id").references(() => propostaItens.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_grupo_itens_proposta_item").on(table.propostaItemId),
  index("idx_grupo_itens_grupo").on(table.grupoId),
]);

export const contratoTemplates = pgTable("contrato_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  versao: integer("versao").default(1).notNull(),
  commercialModel: text("commercial_model"), // null = genérico, aplica a qualquer modelo
  serviceFamily: text("service_family"), // null = qualquer família; PABX/WHITE_LABEL/CALLFACE_AI para texto específico
  // Contrato, aditivo e renovação convivem na mesma família (migration 0093).
  tipoDocumento: text("tipo_documento").default("CONTRATO").notNull(), // CONTRATO | ADITIVO | DOWNGRADE | RENOVACAO
  corpoTemplate: text("corpo_template").notNull(), // texto ou HTML com {{variavel}} — substituição simples
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_contrato_templates_org").on(table.organizacaoId, table.ativo),
]);

// ─── CALLFACE AI — FUNDAÇÃO DE INTEGRAÇÃO EXTERNAL IDENTITY (20/08) ────────
// Baseado na auditoria read-only do banco do SaaS Callface AI
// (vault: projetos/callface/dados/callface-ai-db-audit-2026-08-20/).
// Recomendação da própria auditoria:
// nunca consultar o banco do SaaS em tempo real pelas telas — snapshot/
// agregado local, sincronizado por job incremental dedicado (usuário
// Postgres read-only próprio no SaaS, sem rolbypassrls, ainda não criado).
// Decisão pendente com o Kauã (crm2-decisoes-pendentes.md item 9): SEM
// acesso de sync recorrente aprovado ainda — estas 4 tabelas nascem
// 100% vazias, só estrutura pronta pra receber dado real quando a decisão
// de acesso for tomada. Nenhuma conexão nova ao banco do SaaS foi feita
// nesta rodada, além da auditoria já realizada.
export const callfaceAiExternalIdentities = pgTable(
  "callface_ai_external_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(), // empresa | servico_canonico
    // FK polimórfica (aponta pra empresas.id OU servicos_canonicos.id,
    // conforme entityType) — sem FK de banco por design, entidade variável.
    entityId: uuid("entity_id").notNull(),
    provider: text("provider").default("callface_ai").notNull(),
    externalType: text("external_type").notNull(), // organization | app_client | stripe_customer | subscription | workspace
    externalId: text("external_id").notNull(),
    confidence: text("confidence").notNull(), // deterministic | verified | candidate
    source: text("source"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_callface_ai_ext_ident_entity").on(table.entityType, table.entityId),
    uniqueIndex("idx_callface_ai_ext_ident_unique").on(table.provider, table.externalType, table.externalId),
  ]
);

export const callfaceAiTenantSnapshots = pgTable(
  "callface_ai_tenant_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalIdentityId: uuid("external_identity_id").references(() => callfaceAiExternalIdentities.id, { onDelete: "cascade" }).notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull(),
    usuariosTotal: integer("usuarios_total"),
    usuariosAtivos: integer("usuarios_ativos"),
    usuariosPendentes: integer("usuarios_pendentes"),
    licencasAtivas: integer("licencas_ativas"),
    workspacesAtivos: integer("workspaces_ativos"),
    campanhasAtivas: integer("campanhas_ativas"),
    campanhasConcluidas: integer("campanhas_concluidas"),
    chamadasTotal: integer("chamadas_total"),
    chamadasFinalizadas: integer("chamadas_finalizadas"),
    minutosUso: decimal("minutos_uso", { precision: 14, scale: 2 }),
    agentesProntos: integer("agentes_prontos"),
    integracaoWhatsappConectada: boolean("integracao_whatsapp_conectada"),
    /** A janela que os contadores de uso cobrem. Sem ela o número não é métrica. */
    janelaDias: integer("janela_dias").default(30).notNull(),
    /** Chamadas que PODEM ser desta org e não entraram no total (cadeias divergem). */
    chamadasAmbiguas: integer("chamadas_ambiguas"),
    chamadasSemAtribuicao: integer("chamadas_sem_atribuicao"),
    sessoesCopilot: integer("sessoes_copilot"),
    contatosBase: integer("contatos_base"),
    usuariosComAtividade: integer("usuarios_com_atividade"),
    reunioes: integer("reunioes"),
    appsAtivos: integer("apps_ativos"),
    webhooksAtivos: integer("webhooks_ativos"),
    ultimaAtividadeEm: timestamp("ultima_atividade_em", { withTimezone: true }),
    coletadoEm: timestamp("coletado_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_callface_ai_snapshots_identity").on(table.externalIdentityId, table.snapshotAt),
    uniqueIndex("uq_callface_ai_snapshot_janela").on(table.externalIdentityId, table.snapshotAt, table.janelaDias),
  ]
);

/**
 * Estado de sincronização de integração externa (migration 0086).
 *
 * Uma linha por (organização, provedor, recurso). É o que torna o sync
 * incremental, retry-safe e observável: sem ela a próxima execução não sabe
 * onde a anterior parou, e uma indisponibilidade do provedor vira silêncio.
 */
/**
 * Metric Catalog (migration 0087, Módulo 12) — o REGISTRO das definições.
 *
 * O cálculo mora em código versionado (lib/metricas/catalogo.ts); esta tabela
 * é o espelho, para descoberta, drill-down e para o NEXO consultar a definição
 * oficial em vez de inventar uma.
 */
export const metricCatalog = pgTable(
  "metric_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codigo: text("codigo").notNull(),
    nome: text("nome").notNull(),
    /** EVENT | SNAPSHOT | COHORT — misturar os três produz conversão por razão de snapshots. */
    tipo: text("tipo").notNull(),
    unidade: text("unidade").notNull(),
    descricao: text("descricao").notNull(),
    fonte: text("fonte").notNull(),
    /** O que a métrica deliberadamente NÃO inclui. */
    naoInclui: text("nao_inclui"),
    versao: integer("versao").default(1).notNull(),
    temDrilldown: boolean("tem_drilldown").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uq_metric_catalog_codigo").on(table.codigo)]
);

export const integracaoSyncEstado = pgTable(
  "integracao_sync_estado",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
    provider: text("provider").notNull(),
    recurso: text("recurso").notNull(),
    cursor: text("cursor"),
    ultimoSyncEm: timestamp("ultimo_sync_em", { withTimezone: true }),
    ultimoSucessoEm: timestamp("ultimo_sucesso_em", { withTimezone: true }),
    status: text("status").default("nunca_rodou").notNull(),
    erro: text("erro"),
    tentativas: integer("tentativas").default(0).notNull(),
    itensUltimoSync: integer("itens_ultimo_sync"),
    duracaoMs: integer("duracao_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_integracao_sync_estado").on(table.organizacaoId, table.provider, table.recurso),
    index("idx_integracao_sync_status").on(table.provider, table.status, table.ultimoSyncEm),
  ]
);

export const callfaceAiUsageEvents = pgTable(
  "callface_ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalIdentityId: uuid("external_identity_id").references(() => callfaceAiExternalIdentities.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(), // first_call | first_campaign | agent_completed | copilot_session_ended | ...
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_callface_ai_usage_events_identity").on(table.externalIdentityId, table.occurredAt),
    index("idx_callface_ai_usage_events_type").on(table.eventType),
  ]
);

export const callfaceAiReconciliationCandidates = pgTable(
  "callface_ai_reconciliation_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }).notNull(),
    externalOrganizationId: text("external_organization_id").notNull(),
    matchSignal: text("match_signal").notNull(), // cnpj | stripe_customer_id | email | nome
    score: decimal("score", { precision: 5, scale: 4 }),
    status: text("status").default("pendente").notNull(), // pendente | aprovado | rejeitado
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_callface_ai_recon_empresa").on(table.empresaId),
    index("idx_callface_ai_recon_status").on(table.status),
  ]
);

// ═══════════════════════════════════════════════════════════════
// CS — camada operacional de Customer Success (08/09/2026)
//
// Consome o que já é canônico (servicos_canonicos = serviço/MRR,
// fulfillments = entrega, contratos/assinaturas/faturas = billing,
// nps_respostas = health check) e adiciona só o que não existia: jornada,
// risco explicável, renovação e churn como PROCESSO.
// ═══════════════════════════════════════════════════════════════

/**
 * Marcos da jornada de relacionamento (D0/D7/D30/3M/6M/9M/Renovação).
 *
 * Não confundir com `fulfillments`: aquilo é a entrega do que foi vendido e
 * termina; isto é o acompanhamento e não termina. A tarefa só é criada
 * quando o marco vence — semear 7 tarefas no dia 1 entupiria a fila do CS
 * com trabalho de daqui a 9 meses.
 */
export const csMarcos = pgTable("cs_marcos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }).notNull(),
  /** Só o marco de RENOVACAO é por serviço — vigência é do contrato, não da conta. */
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "cascade" }),
  codigo: text("codigo").notNull(), // D0 | D7 | D30 | M3 | M6 | M9 | RENOVACAO
  ciclo: integer("ciclo").default(1).notNull(),
  titulo: text("titulo").notNull(),
  objetivo: text("objetivo"),
  dueDate: date("due_date").notNull(),
  status: text("status").default("PENDENTE").notNull(), // PENDENTE | CONCLUIDO | PULADO
  tarefaId: uuid("tarefa_id").references(() => tarefas.id, { onDelete: "set null" }),
  tarefaGeradaEm: timestamp("tarefa_gerada_em", { withTimezone: true }),
  /** Respostas do checklist do marco + notas do CS. */
  resultado: jsonb("resultado"),
  concluidoEm: timestamp("concluido_em", { withTimezone: true }),
  concluidoPor: uuid("concluido_por").references(() => usuarios.id),
  chaveIdempotencia: text("chave_idempotencia").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cs_marcos_organizacao_id_chave_idempotencia_key").on(t.organizacaoId, t.chaveIdempotencia),
  index("idx_cs_marcos_empresa").on(t.empresaId, t.status),
  index("idx_cs_marcos_due").on(t.organizacaoId, t.status, t.dueDate),
]);

/**
 * Sinais de risco. Regra fechada do projeto: risco tem motivo e fonte
 * verificáveis — nunca um score 0-100 fabricado com pesos inventados.
 * Sinal que some é RESOLVIDO, não apagado: o histórico é o que permite
 * dizer depois "esse cliente já esteve em risco 3 vezes por cobrança".
 */
export const csRiscos = pgTable("cs_riscos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }).notNull(),
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "set null" }),
  tipo: text("tipo").notNull(),
  severidade: text("severidade").notNull(), // ATENCAO | EM_RISCO | CRITICO
  origem: text("origem").notNull(),         // AUTOMATICO | MANUAL
  motivo: text("motivo").notNull(),
  /** Tabela/serviço de onde o sinal veio — permite auditar a afirmação. */
  fonte: text("fonte").notNull(),
  detalhe: jsonb("detalhe"),
  status: text("status").default("ABERTO").notNull(), // ABERTO | RESOLVIDO
  responsavelId: uuid("responsavel_id").references(() => usuarios.id),
  abertoEm: timestamp("aberto_em", { withTimezone: true }).defaultNow().notNull(),
  abertoPor: uuid("aberto_por").references(() => usuarios.id),
  resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
  resolvidoPor: uuid("resolvido_por").references(() => usuarios.id),
  resolucao: text("resolucao"),
  tarefaId: uuid("tarefa_id").references(() => tarefas.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_cs_riscos_org").on(t.organizacaoId, t.status, t.severidade),
]);

/**
 * Renovação como processo. Por SERVIÇO, com a vigência real do contrato.
 * Serviço sem contrato com prazo não ganha renovação — assinatura Stripe
 * sem termo renova sozinha, e inventar "12 meses" encheria a fila do CS de
 * renovação que não existe.
 */
export const csRenovacoes = pgTable("cs_renovacoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }).notNull(),
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "cascade" }).notNull(),
  contratoId: uuid("contrato_id").references(() => contratos.id, { onDelete: "set null" }),
  ciclo: integer("ciclo").default(1).notNull(),
  vencimento: date("vencimento").notNull(),
  status: text("status").default("FUTURA").notNull(), // FUTURA | ABERTA | EM_NEGOCIACAO | RENOVADA | NAO_RENOVADA
  janelaAbertaEm: timestamp("janela_aberta_em", { withTimezone: true }),
  valorAtual: decimal("valor_atual", { precision: 14, scale: 2 }),
  valorProposto: decimal("valor_proposto", { precision: 14, scale: 2 }),
  novoVencimento: date("novo_vencimento"),
  novoPrazoMeses: integer("novo_prazo_meses"),
  responsavelId: uuid("responsavel_id").references(() => usuarios.id),
  negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "set null" }),
  observacoes: text("observacoes"),
  decididoEm: timestamp("decidido_em", { withTimezone: true }),
  decididoPor: uuid("decidido_por").references(() => usuarios.id),
  motivoNaoRenovacao: text("motivo_nao_renovacao"),
  chaveIdempotencia: text("chave_idempotencia").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cs_renovacoes_organizacao_id_chave_idempotencia_key").on(t.organizacaoId, t.chaveIdempotencia),
  index("idx_cs_renovacoes_empresa").on(t.empresaId, t.status),
  index("idx_cs_renovacoes_janela").on(t.organizacaoId, t.status, t.vencimento),
]);

/**
 * Churn como processo. Cliente nunca é apagado e serviço não vira CHURNED
 * por mudança de status solta: o pedido abre um processo com checagens
 * (contrato, multa, financeiro, equipamento), tentativa de retenção e
 * decisão registrada. Só ao EFETIVAR o serviço é encerrado.
 */
export const csCancelamentos = pgTable("cs_cancelamentos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }).notNull(),
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "set null" }),
  contratoId: uuid("contrato_id").references(() => contratos.id, { onDelete: "set null" }),
  status: text("status").default("SOLICITADO").notNull(), // SOLICITADO | EM_RETENCAO | RETIDO | APROVADO | EFETIVADO
  motivo: text("motivo").notNull(),
  motivoDetalhe: text("motivo_detalhe"),
  canal: text("canal"),
  solicitadoEm: timestamp("solicitado_em", { withTimezone: true }).defaultNow().notNull(),
  solicitadoPor: uuid("solicitado_por").references(() => usuarios.id),
  dataDesejada: date("data_desejada"),
  /** null = ainda não verificado. Falso e "não verificado" são coisas diferentes. */
  contratoVigente: boolean("contrato_vigente"),
  multaAplicavel: boolean("multa_aplicavel"),
  multaValor: decimal("multa_valor", { precision: 14, scale: 2 }),
  pendenciaFinanceira: decimal("pendencia_financeira", { precision: 14, scale: 2 }),
  equipamentosPendentes: text("equipamentos_pendentes"),
  tentativaRetencao: text("tentativa_retencao"),
  ofertaRetencao: text("oferta_retencao"),
  decisao: text("decisao"), // RETIDO | CANCELADO
  decididoEm: timestamp("decidido_em", { withTimezone: true }),
  decididoPor: uuid("decidido_por").references(() => usuarios.id),
  dataEfetiva: date("data_efetiva"),
  motivoFinal: text("motivo_final"),
  motivoFinalDetalhe: text("motivo_final_detalhe"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_cs_cancelamentos_empresa").on(t.empresaId, t.status),
  index("idx_cs_cancelamentos_org").on(t.organizacaoId, t.status),
]);

// ═══════════════════════════════════════════════════════════════
// MÓDULO 01 — VENDAS (SpecDrive, 16/09/2026)
// ═══════════════════════════════════════════════════════════════

/**
 * Linha do tempo comercial.
 *
 * A spec (Bloco 01 §17, Bloco 02 §27, Bloco 04 §22) exige que todo evento
 * relevante tenha entidade, timestamp, executor e contexto — e manda
 * reaproveitar `status_changes`, `atividades`, `audit_log` e `event_outbox` em
 * vez de criar cinco sistemas paralelos. Foi o que se fez: essas tabelas
 * continuam sendo escritas como sempre.
 *
 * O que faltava era um lugar único para LER a linha do tempo sem juntar quatro
 * tabelas em toda consulta. É só isso que esta tabela é. Quem escreve nela é
 * `lib/vendas/eventos.ts`, na mesma transação do comando que a originou.
 *
 * `atorTipo` é o que separa humano de agente sem criar dois fluxos: o motor é
 * o mesmo, muda quem chamou (Bloco 01 §19).
 */
export const vendasEventos = pgTable("vendas_eventos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  tipo: text("tipo").notNull(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  negocioId: uuid("negocio_id").references(() => negocios.id, { onDelete: "cascade" }),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "cascade" }),
  propostaId: uuid("proposta_id").references(() => propostas.id, { onDelete: "cascade" }),
  reuniaoId: uuid("reuniao_id").references(() => reunioes.id, { onDelete: "set null" }),
  usuarioId: uuid("usuario_id").references(() => usuarios.id),
  atorTipo: text("ator_tipo").default("HUMAN").notNull(), // HUMAN | AI_AGENT | AUTOMATION | SYSTEM
  atorRef: text("ator_ref"),
  contexto: jsonb("contexto"),
  ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_vendas_eventos_org_tipo").on(table.organizacaoId, table.tipo),
  index("idx_vendas_eventos_lead").on(table.leadId, table.ocorridoEm),
  index("idx_vendas_eventos_negocio").on(table.negocioId, table.ocorridoEm),
  index("idx_vendas_eventos_empresa").on(table.empresaId, table.ocorridoEm),
  index("idx_vendas_eventos_proposta").on(table.propostaId, table.ocorridoEm),
]);

/**
 * Vínculo Pessoa ↔ Empresa com papel e histórico (Bloco 05 §11-12).
 *
 * `pessoas.empresaId` continua sendo o vínculo atual, porque é o que as
 * consultas existentes leem. Esta tabela é o que permite papel comercial e
 * preservar o passado quando a pessoa troca de empresa — a spec pede
 * explicitamente que a modelagem não apague o vínculo anterior.
 */
export const pessoaEmpresaVinculos = pgTable("pessoa_empresa_vinculos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "cascade" }).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }).notNull(),
  papel: text("papel").default("contato_principal").notNull(),
  principal: boolean("principal").default(false).notNull(),
  iniciadoEm: timestamp("iniciado_em", { withTimezone: true }).defaultNow().notNull(),
  encerradoEm: timestamp("encerrado_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  cargo: text("cargo"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_pessoa_empresa_vinculo_ativo").on(table.pessoaId, table.empresaId).where(sql`encerrado_em IS NULL`),
  index("idx_pessoa_empresa_vinculo_empresa").on(table.empresaId),
]);
// ═══ MODELO CANÔNICO — expansão da fase 04 do refactor (SPEC §38.2) ═══
// Criadas pelas migrations 0057, 0058 e 0059. Vazias até o backfill das
// fases 05 a 15. Ver docs/decisoes/2026-09-22-refactor-arquitetural.md.

export const pipelineEtapas = pgTable("pipeline_etapas", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  codigo: text("codigo").notNull(),
  nome: text("nome").notNull(),
  ordem: integer("ordem").default(0).notNull(),
  tipoFechamento: text("tipo_fechamento").default("OPEN").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aquisicoes = pgTable("aquisicoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
  tipo: text("tipo").default("INBOUND").notNull(),
  origem: text("origem"),
  canal: text("canal"),
  sourceProvider: text("source_provider"),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id, { onDelete: "set null" }),
  etapaId: uuid("etapa_id").references(() => pipelineEtapas.id, { onDelete: "set null" }),
  responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
  qualificado: boolean("qualificado").default(false).notNull(),
  qualificadoEm: timestamp("qualificado_em", { withTimezone: true }),
  desqualificadoEm: timestamp("desqualificado_em", { withTimezone: true }),
  motivoDesqualificacao: text("motivo_desqualificacao"),
  nutricaoStatus: text("nutricao_status"),
  retomarEm: timestamp("retomar_em", { withTimezone: true }),
  firstTouchAt: timestamp("first_touch_at", { withTimezone: true }),
  lastTouchAt: timestamp("last_touch_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  // Ponte de leitura do cutover (migration 0069), igual a
  // `oportunidades.negocio_id_legado`. Nulável de propósito: aquisição criada
  // pelo caminho canônico não tem lead legado, e esse é o estado final.
  leadLegadoId: uuid("lead_legado_id"),
});

export const ofertasComerciais = pgTable("ofertas_comerciais", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  servicoCatalogoId: uuid("servico_catalogo_id").references(() => servicosCatalogo.id).notNull(),
  codigo: text("codigo").notNull(),
  nome: text("nome").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  requiresCompanyBeforeProposal: boolean("requires_company_before_proposal").default(true).notNull(),
  requiresContract: boolean("requires_contract").default(false).notNull(),
  winCondition: text("win_condition").notNull(),
  paymentTrigger: text("payment_trigger").notNull(),
  createsSubscription: boolean("creates_subscription").default(false).notNull(),
  billingModel: text("billing_model"),
  onboardingRequired: boolean("onboarding_required").default(true).notNull(),
  /** A oferta admite período de teste? (SPEC §12.2, migration 0083) */
  permiteTrial: boolean("permite_trial").default(false).notNull(),
  implementationRequired: boolean("implementation_required").default(false).notNull(),
  contratoTemplateId: uuid("contrato_template_id").references(() => contratoTemplates.id, { onDelete: "set null" }),
  checkoutProvider: text("checkout_provider"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pagamentos = pgTable("pagamentos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  faturaId: uuid("fatura_id").references(() => faturas.id, { onDelete: "cascade" }).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id).notNull(),
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  externalPaymentId: text("external_payment_id"),
  paymentMethod: text("payment_method"),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("BRL").notNull(),
  status: text("status").default("PENDING").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversas = pgTable("conversas", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
  canal: text("canal").notNull(),
  externalThreadId: text("external_thread_id"),
  responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
  status: text("status").default("OPEN").notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const domainEvents = pgTable("domain_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  actorType: text("actor_type").default("SYSTEM").notNull(),
  actorId: uuid("actor_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  correlationId: uuid("correlation_id"),
  causationId: uuid("causation_id"),
  idempotencyKey: text("idempotency_key"),
  source: text("source"),
  payload: jsonb("payload").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const timelineEvents = pgTable("timeline_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "cascade" }),
  aquisicaoId: uuid("aquisicao_id").references(() => aquisicoes.id, { onDelete: "cascade" }),
  oportunidadeId: uuid("oportunidade_id").references(() => oportunidades.id, { onDelete: "cascade" }),
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "cascade" }),
  domainEventId: uuid("domain_event_id").references(() => domainEvents.id, { onDelete: "set null" }),
  tipo: text("tipo").notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  icone: text("icone"),
  actorType: text("actor_type").default("SYSTEM").notNull(),
  actorId: uuid("actor_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const csHealthSnapshots = pgTable("cs_health_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }).notNull(),
  servicoCanonicoId: uuid("servico_canonico_id").references(() => servicosCanonicos.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  status: text("status").notNull(),
  factors: jsonb("factors").default({}).notNull(),
  calculationVersion: text("calculation_version").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const automacaoVersoes = pgTable("automacao_versoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  automacaoId: uuid("automacao_id").references(() => automacoes.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  nodes: jsonb("nodes").default([]).notNull(),
  edges: jsonb("edges").default([]).notNull(),
  triggerConfig: jsonb("trigger_config").default({}).notNull(),
  settings: jsonb("settings").default({}).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdById: uuid("created_by_id").references(() => usuarios.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const automacaoPassosExecucao = pgTable("automacao_passos_execucao", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  execucaoId: uuid("execucao_id").references(() => automacaoExecucoes.id, { onDelete: "cascade" }).notNull(),
  nodeId: text("node_id").notNull(),
  nodeType: text("node_type").notNull(),
  ordem: integer("ordem").default(0).notNull(),
  status: text("status").default("PENDING").notNull(),
  input: jsonb("input").default({}).notNull(),
  output: jsonb("output").default({}).notNull(),
  erro: text("erro"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  saida: text("saida"),
  // '<execucao>:<no>:<tentativa>': reservado ANTES do efeito externo (0092).
  idempotencyKey: text("idempotency_key"),
});

export const automacaoInscricoes = pgTable("automacao_inscricoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  automacaoId: uuid("automacao_id").references(() => automacoes.id, { onDelete: "cascade" }).notNull(),
  versionId: uuid("version_id").references(() => automacaoVersoes.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  currentNodeId: text("current_node_id"),
  proximoPassoEm: timestamp("proximo_passo_em", { withTimezone: true }),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  motivoSaida: text("motivo_saida"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  codigo: text("codigo").notNull(),
  dominio: text("dominio").notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  codigo: text("codigo").notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  sistema: boolean("sistema").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable("user_roles", {
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  concedidoPorId: uuid("concedido_por_id").references(() => usuarios.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fileObjects = pgTable("file_objects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  storageProvider: text("storage_provider").notNull(),
  storageKey: text("storage_key").notNull(),
  bucket: text("bucket"),
  nomeOriginal: text("nome_original").notNull(),
  mimeType: text("mime_type").notNull(),
  tamanhoBytes: bigint("tamanho_bytes", { mode: "number" }).notNull(),
  checksumSha256: text("checksum_sha256"),
  retencaoAte: timestamp("retencao_ate", { withTimezone: true }),
  enviadoPorId: uuid("enviado_por_id").references(() => usuarios.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const fileLinks = pgTable("file_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  fileObjectId: uuid("file_object_id").references(() => fileObjects.id, { onDelete: "cascade" }).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  papel: text("papel"),
  createdById: uuid("created_by_id").references(() => usuarios.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


// ═══ RECONCILIAÇÃO E PROVENANCE DO BACKFILL (fase 05, migration 0060) ═══
// `reconciliacao_casos` é onde a ambiguidade fica visível em vez de virar
// palpite. `backfill_provenance` guarda de qual linha legada cada registro
// canônico nasceu, e é o que torna todo backfill idempotente e auditável.

export const reconciliacaoCasos = pgTable("reconciliacao_casos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  fase: text("fase").notNull(),
  tipo: text("tipo").notNull(),
  entidadeAlvo: text("entidade_alvo").notNull(),
  origens: jsonb("origens").default([]).notNull(),
  evidencia: jsonb("evidencia").default({}).notNull(),
  sugestao: jsonb("sugestao").default({}).notNull(),
  status: text("status").default("OPEN").notNull(),
  resolvidoPorId: uuid("resolvido_por_id").references(() => usuarios.id, { onDelete: "set null" }),
  resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
  resolucao: jsonb("resolucao"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const backfillProvenance = pgTable("backfill_provenance", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  fase: text("fase").notNull(),
  entidadeCanonica: text("entidade_canonica").notNull(),
  idCanonico: uuid("id_canonico").notNull(),
  tabelaOrigem: text("tabela_origem").notNull(),
  idOrigem: text("id_origem").notNull(),
  chaveIdentidade: text("chave_identidade"),
  metodo: text("metodo").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


// ─── API PÚBLICA (SPEC §23, §30.2) ──────────────────────────────────────────
//
// Autenticação por token, não por cookie: cookie não tem escopo, não se revoga
// sozinho e não diz quem consumiu o quê. O token NUNCA é guardado em claro —
// guarda-se o SHA-256, como senha, para que um dump do banco não vire acesso.
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
    nome: text("nome").notNull(),
    /** Primeiros caracteres, para reconhecer o token na tela sem expor o segredo. */
    prefixo: text("prefixo").notNull(),
    tokenSha256: text("token_sha256").notNull(),
    /** Escopos são permissões do RBAC: o token nunca pode mais que elas. */
    escopos: text("escopos").array().notNull(),
    criadoPorId: uuid("criado_por_id").references(() => usuarios.id),
    expiraEm: timestamp("expira_em", { withTimezone: true }),
    ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true }),
    revogadoEm: timestamp("revogado_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_api_tokens_hash").on(table.tokenSha256),
    index("idx_api_tokens_org").on(table.organizacaoId),
  ],
);

/** Sem isto não há resposta para "quem puxou esses dados e quando". */
export const apiTokenUsos = pgTable(
  "api_token_usos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: uuid("token_id").references(() => apiTokens.id, { onDelete: "cascade" }).notNull(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
    metodo: text("metodo").notNull(),
    caminho: text("caminho").notNull(),
    status: integer("status").notNull(),
    ip: inet("ip"),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_api_token_usos_token").on(table.tokenId, table.ocorridoEm)],
);

// ─── ENTREGA DE CONVERSÕES À META (SPEC §20) ────────────────────────────────
//
// Uma linha por evento do outbox, não por tentativa: o que se quer saber é o
// estado atual daquele fato. Sem esta tabela não há resposta para a única
// pergunta que importa quando o gerenciador da Meta não bate com o CRM —
// **esse evento chegou lá?**
export const metaCapiEntregas = pgTable(
  "meta_capi_entregas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }).notNull(),
    outboxId: uuid("outbox_id").references(() => eventOutbox.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    eventName: text("event_name"),
    /** Determinístico: dá para procurar este mesmo id no Events Manager. */
    eventId: text("event_id"),
    entregue: boolean("entregue").default(false).notNull(),
    /**
     * Distingue casos que parecem iguais e não são: `sem_mapeamento` e
     * `sem_touchpoint_meta` são o comportamento CERTO; `sem_credencial` é
     * configuração; `recusado` não melhora com retry; `transitorio` melhora.
     */
    motivo: text("motivo"),
    detalhe: text("detalhe"),
    tentativas: integer("tentativas").default(1).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_meta_capi_entregas_outbox").on(table.outboxId),
    index("idx_meta_capi_entregas_pendentes").on(table.organizacaoId, table.criadoEm),
  ],
);

// ─── Agentes como usuários: distribuição de leads e delegação (migration 0097) ───
export const regrasDistribuicaoLeads = pgTable("regras_distribuicao_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  nome: text("nome").notNull(),
  etapa: text("etapa").default("novo").notNull(),
  alvoTipo: text("alvo_tipo").default("usuario").notNull(),
  alvoUsuarioId: uuid("alvo_usuario_id").references(() => usuarios.id),
  rodizioUsuarioIds: uuid("rodizio_usuario_ids").array().default([]).notNull(),
  rodizioUltimoId: uuid("rodizio_ultimo_id"),
  diasSemana: integer("dias_semana").array(),
  horaInicio: text("hora_inicio"),
  horaFim: text("hora_fim"),
  humanoDevolucaoId: uuid("humano_devolucao_id").references(() => usuarios.id),
  prioridade: integer("prioridade").default(100).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdBy: uuid("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_regras_distribuicao_org").on(table.organizacaoId, table.ativo, table.prioridade),
]);

export const delegacoesAgente = pgTable("delegacoes_agente", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizacaoId: uuid("organizacao_id").references(() => organizacoes.id).notNull(),
  leadId: uuid("lead_id").references(() => leads.id),
  negocioId: uuid("negocio_id").references(() => negocios.id),
  agenteUsuarioId: uuid("agente_usuario_id").references(() => usuarios.id).notNull(),
  humanoUsuarioId: uuid("humano_usuario_id").references(() => usuarios.id),
  motivo: text("motivo").notNull(),
  gatilho: text("gatilho").default("manual").notNull(),
  diasSemResposta: integer("dias_sem_resposta").default(2).notNull(),
  intervaloDias: integer("intervalo_dias").default(2).notNull(),
  maxToques: integer("max_toques").default(4).notNull(),
  toques: integer("toques").default(0).notNull(),
  status: text("status").default("ativa").notNull(),
  proximoToqueEm: timestamp("proximo_toque_em", { withTimezone: true }),
  ultimoToqueEm: timestamp("ultimo_toque_em", { withTimezone: true }),
  delegadoPor: uuid("delegado_por").references(() => usuarios.id),
  devolvidaEm: timestamp("devolvida_em", { withTimezone: true }),
  devolvidaMotivo: text("devolvida_motivo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_delegacoes_agente_ativas").on(table.organizacaoId, table.status, table.proximoToqueEm),
]);
