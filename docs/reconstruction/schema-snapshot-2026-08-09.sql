--
-- PostgreSQL database dump
--

\restrict 4a8GiEQXcIWXpg7DQWTj4mPCAfdlZWBmO8dO0MoDmhNKFQkVtFGSIp9auz7xRs4

-- Dumped from database version 16.14 (Homebrew)
-- Dumped by pg_dump version 16.14 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: ai_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    resumo text,
    sentimento text,
    intencao text,
    objecoes jsonb,
    necessidades jsonb,
    proximos_passos text,
    score numeric(4,2),
    risco text,
    oportunidade text,
    modelo_usado text,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_sdr_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_sdr_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    groq_api_key text,
    modelo text DEFAULT 'llama-3.3-70b-versatile'::text NOT NULL,
    system_prompt text,
    nome_assistente text DEFAULT 'Assistente'::text NOT NULL,
    idioma_resposta text DEFAULT 'pt-BR'::text NOT NULL,
    horario_comercial jsonb,
    fora_horario_msg text,
    max_tokens_resposta integer DEFAULT 1024 NOT NULL,
    temperatura_modelo text DEFAULT '0.3'::text NOT NULL,
    handoff_triggers jsonb,
    stage_config jsonb,
    style_guide text,
    knowledge_base text,
    rate_limit_msgs integer DEFAULT 10 NOT NULL,
    rate_limit_window_min integer DEFAULT 60 NOT NULL,
    delay_min_ms integer DEFAULT 2000 NOT NULL,
    delay_max_ms integer DEFAULT 5000 NOT NULL,
    debounce_ms integer DEFAULT 5000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_sdr_contato_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_sdr_contato_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contato_id uuid NOT NULL,
    organizacao_id uuid NOT NULL,
    ai_ativo boolean DEFAULT true NOT NULL,
    handoff_at timestamp with time zone,
    handoff_motivo text,
    handoff_usuario_id uuid,
    ultima_ai_msg_at timestamp with time zone,
    ai_msgs_na_janela integer DEFAULT 0 NOT NULL,
    janela_reset_at timestamp with time zone,
    qualificacao_extraida jsonb,
    conversation_summary text,
    intent_detectado text,
    confianca numeric(3,2),
    total_tokens_usados integer DEFAULT 0 NOT NULL,
    total_msgs_ai integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    handoff_status text DEFAULT 'ai_handling'::text NOT NULL
);


--
-- Name: ai_sdr_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_sdr_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    contato_id uuid,
    lead_id uuid,
    tipo text NOT NULL,
    input_content text,
    output_content text,
    intent_detectado text,
    confianca numeric(3,2),
    dados_extraidos jsonb,
    decisao text,
    motivo text,
    tokens_input integer,
    tokens_output integer,
    latencia_ms integer,
    modelo_usado text,
    erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assinaturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assinaturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid,
    empresa_id uuid,
    contrato_id uuid,
    stripe_subscription_id text NOT NULL,
    stripe_customer_id text,
    produto text,
    stripe_price_id text,
    quantidade integer DEFAULT 1,
    mrr numeric(12,2),
    moeda text DEFAULT 'BRL'::text NOT NULL,
    status text NOT NULL,
    iniciada_em timestamp with time zone,
    cancelada_em timestamp with time zone,
    motivo_cancelamento text,
    current_period_end timestamp with time zone,
    raw jsonb,
    synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atividades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atividades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
    lead_id uuid NOT NULL,
    negocio_id uuid,
    usuario_id uuid,
    tipo text NOT NULL,
    titulo text,
    descricao text,
    dados jsonb,
    duracao_segundos integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    before jsonb,
    after jsonb,
    source text DEFAULT 'api'::text NOT NULL,
    ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    tipo text NOT NULL,
    token_hash text NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    usado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automacao_execucoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automacao_execucoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automacao_id uuid NOT NULL,
    organizacao_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    status text NOT NULL,
    resultado jsonb,
    erro text,
    executed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    gatilho text NOT NULL,
    condicao jsonb,
    acao text NOT NULL,
    acao_config jsonb,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: buscas_salvas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buscas_salvas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    filtros jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cadence_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadence_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    entity_type text NOT NULL,
    steps jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cadence_enrollment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadence_enrollment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    step_id text NOT NULL,
    status text NOT NULL,
    resultado jsonb,
    attempt integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cadence_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadence_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    cadence_definition_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    current_step_id text,
    status text DEFAULT 'active'::text NOT NULL,
    scheduled_at timestamp with time zone,
    vars jsonb DEFAULT '{}'::jsonb,
    attempt integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cadencia_execucoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadencia_execucoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    ordem integer NOT NULL,
    canal text NOT NULL,
    status text DEFAULT 'enviado'::text NOT NULL,
    enviado_por_id uuid,
    sessao_id uuid,
    conteudo_enviado text,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campanhas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campanhas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    plataforma text NOT NULL,
    nome text NOT NULL,
    utm_campaign text,
    investimento_mensal numeric(12,2),
    status text DEFAULT 'ativa'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid,
    pessoa_principal_id uuid,
    oportunidade_origem_id uuid,
    cliente_desde timestamp with time zone,
    status_financeiro text,
    lead_id_legado uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: closer_bloqueios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.closer_bloqueios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    inicio timestamp with time zone NOT NULL,
    fim timestamp with time zone NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: closer_disponibilidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.closer_disponibilidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    horario_trabalho jsonb NOT NULL,
    pausa_almoco jsonb,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pausado_rodizio boolean DEFAULT false NOT NULL
);


--
-- Name: comercial_evidencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comercial_evidencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    negocio_id uuid NOT NULL,
    tipo text NOT NULL,
    source_ref text,
    metadata jsonb,
    verificado_por uuid,
    verificado_em timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    pessoa_id uuid,
    canal text NOT NULL,
    direcao text,
    conteudo text,
    duracao_segundos integer,
    status text,
    external_id text,
    usuario_id uuid,
    ocorrido_em timestamp with time zone NOT NULL,
    origem_legado_id uuid,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contato_listas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contato_listas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    cor text DEFAULT '#e23752'::text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contatos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contatos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    canal text NOT NULL,
    nome text NOT NULL,
    telefone text,
    email text,
    avatar_url text,
    sessao_id uuid,
    conta_id uuid,
    responsavel_id uuid,
    lead_id uuid,
    ultima_msg text,
    ultima_msg_at timestamp with time zone,
    nao_lidas integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    zoho_id text
);


--
-- Name: contratos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    negocio_id uuid,
    tipo text NOT NULL,
    descricao text,
    moeda text DEFAULT 'BRL'::text NOT NULL,
    mrr numeric(12,2),
    valor_setup numeric(12,2),
    servicos text[],
    inicio date,
    vencimento date,
    renovacao_auto boolean DEFAULT true,
    status text DEFAULT 'ativo'::text NOT NULL,
    notas text,
    motivo_churn text,
    finalizado_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    zoho_id text,
    stripe_subscription_id text,
    produto text
);


--
-- Name: custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    entidade text NOT NULL,
    nome text NOT NULL,
    label text NOT NULL,
    tipo text NOT NULL,
    opcoes jsonb,
    obrigatorio boolean DEFAULT false,
    ordem integer DEFAULT 0,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_contas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_contas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    tipo text NOT NULL,
    email text NOT NULL,
    nome text,
    access_token text,
    refresh_token text,
    token_expiry timestamp with time zone,
    imap_host text,
    imap_port integer,
    smtp_host text,
    smtp_port integer,
    imap_user text,
    smtp_user text,
    imap_pass text,
    smtp_pass text,
    sync_status text DEFAULT 'active'::text NOT NULL,
    sync_mode text DEFAULT 'sync_all'::text NOT NULL,
    sync_filtro_label text,
    last_sync_at timestamp with time zone,
    last_error text,
    delta_cursor text,
    backfill_status text,
    backfill_progress integer,
    assinatura text,
    envio_como text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_sequencia_execucoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_sequencia_execucoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequencia_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    conta_id uuid NOT NULL,
    passo_atual integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    proxima_execucao_at timestamp with time zone,
    iniciado_at timestamp with time zone DEFAULT now() NOT NULL,
    concluido_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_sequencia_passos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_sequencia_passos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequencia_id uuid NOT NULL,
    ordem integer NOT NULL,
    tipo text NOT NULL,
    template_id uuid,
    delay_minutos integer DEFAULT 0,
    condicao jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_sequencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_sequencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    gatilho text DEFAULT 'manual'::text NOT NULL,
    gatilho_config jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    assunto text NOT NULL,
    corpo text NOT NULL,
    variaveis jsonb,
    categoria text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    contato_id uuid,
    lead_id uuid,
    conta_id uuid,
    de text NOT NULL,
    para text NOT NULL,
    cc text,
    bcc text,
    assunto text NOT NULL,
    corpo text NOT NULL,
    corpo_texto text,
    direcao text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    lido boolean DEFAULT true NOT NULL,
    enviado_por_id uuid,
    message_id text,
    in_reply_to text,
    thread_id text,
    provider_message_id text,
    labels jsonb,
    anexos jsonb,
    sequencia_execucao_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    cnpj text,
    setor text,
    porte text,
    cidade text,
    estado text,
    website text,
    instagram text,
    linkedin text,
    tiktok text,
    telefone text,
    pipedrive_id text,
    num_usuarios_ti integer,
    num_filiais integer DEFAULT 1,
    observacoes text,
    campos_custom jsonb DEFAULT '{}'::jsonb,
    apollo_id text,
    enriched_at timestamp with time zone,
    enrich_status text DEFAULT 'pending'::text,
    industry text,
    employee_count integer,
    annual_revenue text,
    founded_year integer,
    apollo_description text,
    logo_url text,
    endereco text,
    cep text,
    pais text,
    total_funding text,
    funding_stage text,
    growth_6m numeric(5,4),
    growth_12m numeric(5,4),
    twitter text,
    facebook text,
    tech_stack text[],
    apollo_keywords text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    zoho_id text,
    stripe_customer_id text
);


--
-- Name: event_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    event_type text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    payload jsonb NOT NULL,
    correlation_id uuid,
    idempotency_key text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    session_id text,
    tipo text NOT NULL,
    pagina text,
    referrer text,
    dados jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: faturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid,
    empresa_id uuid,
    assinatura_id uuid,
    contrato_id uuid,
    origem text NOT NULL,
    external_id text,
    valor numeric(12,2) NOT NULL,
    moeda text DEFAULT 'BRL'::text NOT NULL,
    status text NOT NULL,
    competencia date,
    emitida_em timestamp with time zone,
    paga_em timestamp with time zone,
    tentativas integer DEFAULT 0,
    raw jsonb,
    synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vencimento timestamp with time zone,
    hosted_invoice_url text,
    acionado_cobranca boolean DEFAULT false NOT NULL,
    acionado_em timestamp with time zone,
    acionado_por uuid
);


--
-- Name: labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cor text DEFAULT '#e23752'::text NOT NULL,
    organizacao_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    label_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_listas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_listas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    lista_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_user_unread; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_user_unread (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    whatsapp_nao_lidas integer DEFAULT 0 NOT NULL,
    email_nao_lidos integer DEFAULT 0 NOT NULL
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    sobrenome text,
    email text,
    telefone text,
    cargo text,
    linkedin text,
    avatar_url text,
    empresa_id uuid,
    empresa text,
    empresa_cnpj text,
    empresa_setor text,
    empresa_porte text,
    empresa_cidade text,
    empresa_estado text DEFAULT 'SP'::text,
    num_usuarios_ti integer,
    num_filiais integer DEFAULT 1,
    servicos_interesse text[],
    modelo_preferido text,
    origem text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    gclid text,
    gbraid text,
    wbraid text,
    fbclid text,
    fbc text,
    fbp text,
    event_id text,
    landing_page text,
    ip_address inet,
    user_agent text,
    lead_score integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'novo'::text NOT NULL,
    motivo_perda text,
    motivo_perda_detalhe text,
    valor_total numeric(12,2),
    tipo_receita text DEFAULT 'recorrente'::text,
    mrr_estimado numeric(12,2),
    mrr_fechado numeric(12,2),
    valor_setup numeric(12,2),
    valor_projeto numeric(12,2),
    pipedrive_id text,
    apollo_id text,
    enriched_at timestamp with time zone,
    enrich_status text DEFAULT 'pending'::text,
    apollo_seniority text,
    apollo_headline text,
    apollo_photo_url text,
    apollo_city text,
    apollo_state text,
    apollo_country text,
    apollo_departments text[],
    apollo_employment_history jsonb DEFAULT '[]'::jsonb,
    twitter text,
    github text,
    facebook text,
    apollo_likely_engage boolean,
    como_conheceu text,
    indicado_por text,
    indicado_por_lead_id uuid,
    concorrente_atual text,
    contrato_vence_em date,
    responsavel_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    primeiro_contato_at timestamp with time zone,
    convertido_at timestamp with time zone,
    cliente_desde timestamp with time zone,
    proximo_nps timestamp with time zone,
    nps_score integer,
    contrato_tipo text,
    contrato_vencimento date,
    renovacao_alertada boolean DEFAULT false,
    tipo text DEFAULT 'contato'::text NOT NULL,
    whatsapp_ultima_msg text,
    whatsapp_nao_lidas integer DEFAULT 0,
    whatsapp_ultima_msg_at timestamp with time zone,
    email_nao_lidos integer DEFAULT 0,
    email_ultimo_assunto text,
    email_ultima_msg_at timestamp with time zone,
    negocio_ativo_id uuid,
    campos_custom jsonb DEFAULT '{}'::jsonb,
    lp_url text,
    instagram text,
    whatsapp text,
    cipa_score integer,
    cipa_diagnostico jsonb,
    cipa_pagespeed jsonb,
    screenshot_url text,
    pagespeed_report_url text,
    analysis_notes text,
    insumo_comercial jsonb,
    sdr_status text DEFAULT 'pending'::text,
    outreach_channel text,
    outreach_started_at timestamp with time zone,
    last_contact_at timestamp with time zone,
    next_followup_at timestamp with time zone,
    zoho_id text,
    stripe_customer_id text,
    contato_desde_at timestamp with time zone,
    agenda_closer_id uuid,
    meta_ad_id text,
    meta_adset_id text,
    meta_campaign_id text
);


--
-- Name: ligacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ligacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid,
    negocio_id uuid,
    usuario_id uuid,
    idempotency_key text NOT NULL,
    callface_call_id text,
    callface_contact_id text,
    callface_deal_id text,
    user_email text,
    user_name text,
    destination_number text,
    call_date timestamp with time zone,
    duracao_segundos integer,
    call_status text,
    resumo text,
    transcricao jsonb,
    call_link text,
    audio_url text,
    closure_percentage integer,
    scheduling jsonb,
    payload_raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: meta_lead_staging; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_lead_staging (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fb_lead_id text,
    email text,
    telefone text,
    ad_id text,
    adset_id text,
    campaign_id text,
    ad_name text,
    adset_name text,
    campaign_name text,
    usado boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: metas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    periodo date NOT NULL,
    tipo text NOT NULL,
    valor_alvo numeric(12,2) NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: metricas_diarias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metricas_diarias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    data date NOT NULL,
    meta_valor_alvo numeric(12,2) NOT NULL,
    meta_realizado numeric(12,2) NOT NULL,
    meta_closers integer NOT NULL,
    pipeline_total numeric(14,2) NOT NULL,
    pipeline_ponderado numeric(14,2) NOT NULL,
    pipeline_negocios_abertos integer NOT NULL,
    fechado_mes_ganhos integer NOT NULL,
    fechado_mes_receita numeric(14,2) NOT NULL,
    fechado_mes_recorrente numeric(14,2) NOT NULL,
    fechado_mes_avulso numeric(14,2) NOT NULL,
    mrr_stripe numeric(14,2) NOT NULL,
    mrr_stripe_clientes integer NOT NULL,
    mrr_risco numeric(14,2) NOT NULL,
    mrr_risco_qtd integer NOT NULL,
    calculado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mrr_movimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrr_movimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid,
    assinatura_id uuid,
    contrato_id uuid,
    produto text NOT NULL,
    tipo text NOT NULL,
    delta numeric(12,2) NOT NULL,
    mrr_antes numeric(12,2) NOT NULL,
    mrr_depois numeric(12,2) NOT NULL,
    ocorrido_em timestamp with time zone NOT NULL,
    origem text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: negocio_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.negocio_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    negocio_id uuid NOT NULL,
    label_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: negocio_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.negocio_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    negocio_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    papel text DEFAULT 'contato'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: negocios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.negocios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid,
    empresa_id uuid,
    titulo text NOT NULL,
    descricao text,
    status text DEFAULT 'reuniao_agendada'::text NOT NULL,
    temperatura text DEFAULT 'indefinido'::text,
    valor_total numeric(12,2),
    tipo_receita text DEFAULT 'recorrente'::text,
    mrr_estimado numeric(12,2),
    valor_projeto numeric(12,2),
    mrr_fechado numeric(12,2),
    valor_setup numeric(12,2),
    moeda text DEFAULT 'BRL'::text NOT NULL,
    previsao_fechamento date,
    pipeline_origem text,
    pipedrive_id text,
    motivo_perda text,
    motivo_perda_detalhe text,
    origem_negocio text DEFAULT 'novo'::text NOT NULL,
    servicos_interesse text[],
    necessidades_constatadas text[],
    concorrente_atual text,
    contrato_vence_em date,
    responsavel_id uuid,
    pipeline_id uuid,
    contrato_tipo text,
    negocio_origem_id uuid,
    campos_custom jsonb DEFAULT '{}'::jsonb,
    lp_url text,
    cipa_score integer,
    cipa_diagnostico jsonb,
    cipa_pagespeed jsonb,
    screenshot_url text,
    pagespeed_report_url text,
    analysis_notes text,
    insumo_comercial jsonb,
    cipa_analyzed_at timestamp with time zone,
    apresentacao_config jsonb,
    apresentacao_gerada_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    convertido_at timestamp with time zone,
    ganho_at timestamp with time zone,
    zoho_id text,
    origem_qualificacao text
);


--
-- Name: notas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid,
    negocio_id uuid,
    empresa_id uuid,
    conteudo text NOT NULL,
    autor_id uuid,
    pipedrive_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notificacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    titulo text NOT NULL,
    mensagem text,
    tipo text NOT NULL,
    lida boolean DEFAULT false NOT NULL,
    link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nps_respostas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nps_respostas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
    lead_id uuid NOT NULL,
    contrato_id uuid,
    score integer,
    comentario text,
    tipo text NOT NULL,
    token text,
    enviado_em timestamp with time zone,
    respondido_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: oportunidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oportunidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    pessoa_id uuid,
    empresa_id uuid,
    pipeline_id uuid,
    stage text NOT NULL,
    responsavel_id uuid,
    valor numeric(12,2),
    mrr numeric(12,2),
    probabilidade integer,
    previsao_fechamento date,
    ganho_at timestamp with time zone,
    perdido_at timestamp with time zone,
    motivo_perda text,
    negocio_id_legado uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    slug text NOT NULL,
    dominio text,
    logo_url text,
    cor_primaria text DEFAULT '#1E3A5F'::text,
    apollo_api_key text,
    whatsapp_enabled boolean DEFAULT false NOT NULL,
    pipeline_config jsonb,
    max_usuarios integer DEFAULT 10,
    max_leads integer DEFAULT 5000,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    settings jsonb
);


--
-- Name: outreach_campanhas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_campanhas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    canal text DEFAULT 'email'::text NOT NULL,
    assunto text,
    corpo_html text,
    audiencia jsonb,
    remetente text,
    status text DEFAULT 'rascunho'::text NOT NULL,
    total_destinatarios integer DEFAULT 0,
    total_enviados integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pessoas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pessoas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid,
    nome text NOT NULL,
    sobrenome text,
    email text,
    telefone text,
    whatsapp text,
    cargo text,
    lead_id_legado uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pipelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    slug text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    closed_stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pontos_contato; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pontos_contato (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    pessoa_id uuid,
    empresa_id uuid,
    source text,
    medium text,
    campaign text,
    term text,
    content text,
    landing_page text,
    referrer text,
    campaign_id text,
    source_id text,
    tipo_origem text NOT NULL,
    is_first_touch boolean DEFAULT false NOT NULL,
    is_last_touch boolean DEFAULT false NOT NULL,
    ocorrido_em timestamp with time zone DEFAULT now() NOT NULL,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: proposta_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposta_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposta_id uuid NOT NULL,
    servico_catalogo_id uuid,
    nome text NOT NULL,
    descricao text,
    tipo text NOT NULL,
    moeda text DEFAULT 'BRL'::text NOT NULL,
    quantidade numeric(10,2) DEFAULT '1'::numeric NOT NULL,
    valor_unitario numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    desconto numeric(5,2) DEFAULT '0'::numeric,
    desconto_tipo text DEFAULT 'percentual'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: propostas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.propostas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    negocio_id uuid,
    numero integer NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    proposta_original_id uuid,
    moeda text DEFAULT 'BRL'::text NOT NULL,
    status text DEFAULT 'rascunho'::text NOT NULL,
    data_emissao date,
    data_validade date,
    observacoes text,
    condicoes_pagamento text,
    total_recorrente numeric(12,2) DEFAULT '0'::numeric,
    total_avulso numeric(12,2) DEFAULT '0'::numeric,
    total_geral numeric(12,2) DEFAULT '0'::numeric,
    criado_por_id uuid,
    contrato_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    checkout_url text,
    stripe_session_id text,
    enviada_em timestamp with time zone
);


--
-- Name: reunioes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reunioes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    negocio_id uuid,
    lead_id uuid,
    titulo text NOT NULL,
    data timestamp with time zone NOT NULL,
    duracao integer,
    tipo text DEFAULT 'call'::text,
    status text DEFAULT 'agendada'::text,
    participantes text[],
    notas text,
    transcript text,
    resumo_transcript text,
    responsavel_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    link text,
    outlook_event_id text
);


--
-- Name: sdr_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sdr_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    phone text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: servicos_catalogo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicos_catalogo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text,
    tipo text NOT NULL,
    moeda text DEFAULT 'BRL'::text NOT NULL,
    valor_sugerido numeric(12,2),
    unidade text DEFAULT 'mensal'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_product_id text
);


--
-- Name: status_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    negocio_id uuid,
    de_status text,
    para_status text NOT NULL,
    usuario_id uuid,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tarefas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarefas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
    lead_id uuid,
    usuario_id uuid,
    titulo text NOT NULL,
    descricao text,
    tipo text NOT NULL,
    prioridade text DEFAULT 'media'::text NOT NULL,
    data_vencimento date,
    concluida boolean DEFAULT false NOT NULL,
    concluida_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    negocio_id uuid,
    vence_em timestamp with time zone
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    manager_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha_hash text NOT NULL,
    role text DEFAULT 'vendedor'::text NOT NULL,
    avatar_url text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    team_id uuid
);


--
-- Name: whatsapp_mensagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_mensagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contato_id uuid,
    lead_id uuid,
    sessao_id uuid,
    telefone text NOT NULL,
    direcao text NOT NULL,
    tipo text DEFAULT 'text'::text NOT NULL,
    conteudo text,
    media_url text,
    media_type text,
    media_filename text,
    uazapi_message_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    status_at timestamp with time zone,
    reply_to_id uuid,
    template_nome text,
    enviado_por_id uuid,
    dados jsonb,
    reactions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_sessao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_sessao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    usuario_id uuid,
    session_name text NOT NULL,
    label text,
    is_default boolean DEFAULT false NOT NULL,
    api_token text,
    tipo text DEFAULT 'pessoal'::text NOT NULL,
    assign_strategy text DEFAULT 'manual'::text,
    status text DEFAULT 'disconnected'::text NOT NULL,
    phone_number text,
    qr_code text,
    last_connected_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    categoria text NOT NULL,
    conteudo text NOT NULL,
    botoes jsonb,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: won_evidence_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.won_evidence_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    produto text,
    tipos_aceitos jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_analysis ai_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis
    ADD CONSTRAINT ai_analysis_pkey PRIMARY KEY (id);


--
-- Name: ai_sdr_config ai_sdr_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_config
    ADD CONSTRAINT ai_sdr_config_pkey PRIMARY KEY (id);


--
-- Name: ai_sdr_contato_state ai_sdr_contato_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_contato_state
    ADD CONSTRAINT ai_sdr_contato_state_pkey PRIMARY KEY (id);


--
-- Name: ai_sdr_logs ai_sdr_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_logs
    ADD CONSTRAINT ai_sdr_logs_pkey PRIMARY KEY (id);


--
-- Name: assinaturas assinaturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_pkey PRIMARY KEY (id);


--
-- Name: atividades atividades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_tokens auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_pkey PRIMARY KEY (id);


--
-- Name: automacao_execucoes automacao_execucoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacao_execucoes
    ADD CONSTRAINT automacao_execucoes_pkey PRIMARY KEY (id);


--
-- Name: automacoes automacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacoes
    ADD CONSTRAINT automacoes_pkey PRIMARY KEY (id);


--
-- Name: buscas_salvas buscas_salvas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buscas_salvas
    ADD CONSTRAINT buscas_salvas_pkey PRIMARY KEY (id);


--
-- Name: cadence_definitions cadence_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definitions
    ADD CONSTRAINT cadence_definitions_pkey PRIMARY KEY (id);


--
-- Name: cadence_enrollment_events cadence_enrollment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollment_events
    ADD CONSTRAINT cadence_enrollment_events_pkey PRIMARY KEY (id);


--
-- Name: cadence_enrollments cadence_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollments
    ADD CONSTRAINT cadence_enrollments_pkey PRIMARY KEY (id);


--
-- Name: cadencia_execucoes cadencia_execucoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_execucoes
    ADD CONSTRAINT cadencia_execucoes_pkey PRIMARY KEY (id);


--
-- Name: campanhas campanhas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanhas
    ADD CONSTRAINT campanhas_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: closer_bloqueios closer_bloqueios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closer_bloqueios
    ADD CONSTRAINT closer_bloqueios_pkey PRIMARY KEY (id);


--
-- Name: closer_disponibilidade closer_disponibilidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closer_disponibilidade
    ADD CONSTRAINT closer_disponibilidade_pkey PRIMARY KEY (id);


--
-- Name: comercial_evidencia comercial_evidencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_pkey PRIMARY KEY (id);


--
-- Name: communications communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pkey PRIMARY KEY (id);


--
-- Name: contato_listas contato_listas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_listas
    ADD CONSTRAINT contato_listas_pkey PRIMARY KEY (id);


--
-- Name: contatos contatos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_pkey PRIMARY KEY (id);


--
-- Name: contratos contratos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: email_contas email_contas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_contas
    ADD CONSTRAINT email_contas_pkey PRIMARY KEY (id);


--
-- Name: email_sequencia_execucoes email_sequencia_execucoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencia_execucoes
    ADD CONSTRAINT email_sequencia_execucoes_pkey PRIMARY KEY (id);


--
-- Name: email_sequencia_passos email_sequencia_passos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencia_passos
    ADD CONSTRAINT email_sequencia_passos_pkey PRIMARY KEY (id);


--
-- Name: email_sequencias email_sequencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencias
    ADD CONSTRAINT email_sequencias_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: event_outbox event_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_pkey PRIMARY KEY (id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: faturas faturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_pkey PRIMARY KEY (id);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: lead_labels lead_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_labels
    ADD CONSTRAINT lead_labels_pkey PRIMARY KEY (id);


--
-- Name: lead_listas lead_listas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_listas
    ADD CONSTRAINT lead_listas_pkey PRIMARY KEY (id);


--
-- Name: lead_user_unread lead_user_unread_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_user_unread
    ADD CONSTRAINT lead_user_unread_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: ligacoes ligacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ligacoes
    ADD CONSTRAINT ligacoes_pkey PRIMARY KEY (id);


--
-- Name: meta_lead_staging meta_lead_staging_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_lead_staging
    ADD CONSTRAINT meta_lead_staging_pkey PRIMARY KEY (id);


--
-- Name: metas metas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_pkey PRIMARY KEY (id);


--
-- Name: metricas_diarias metricas_diarias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metricas_diarias
    ADD CONSTRAINT metricas_diarias_pkey PRIMARY KEY (id);


--
-- Name: mrr_movimentos mrr_movimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrr_movimentos
    ADD CONSTRAINT mrr_movimentos_pkey PRIMARY KEY (id);


--
-- Name: negocio_labels negocio_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocio_labels
    ADD CONSTRAINT negocio_labels_pkey PRIMARY KEY (id);


--
-- Name: negocio_leads negocio_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocio_leads
    ADD CONSTRAINT negocio_leads_pkey PRIMARY KEY (id);


--
-- Name: negocios negocios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_pkey PRIMARY KEY (id);


--
-- Name: notas notas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_pkey PRIMARY KEY (id);


--
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);


--
-- Name: nps_respostas nps_respostas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_pkey PRIMARY KEY (id);


--
-- Name: nps_respostas nps_respostas_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_token_unique UNIQUE (token);


--
-- Name: oportunidades oportunidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_pkey PRIMARY KEY (id);


--
-- Name: organizacoes organizacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizacoes
    ADD CONSTRAINT organizacoes_pkey PRIMARY KEY (id);


--
-- Name: organizacoes organizacoes_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizacoes
    ADD CONSTRAINT organizacoes_slug_unique UNIQUE (slug);


--
-- Name: outreach_campanhas outreach_campanhas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campanhas
    ADD CONSTRAINT outreach_campanhas_pkey PRIMARY KEY (id);


--
-- Name: pessoas pessoas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoas
    ADD CONSTRAINT pessoas_pkey PRIMARY KEY (id);


--
-- Name: pipelines pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipelines
    ADD CONSTRAINT pipelines_pkey PRIMARY KEY (id);


--
-- Name: pontos_contato pontos_contato_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_pkey PRIMARY KEY (id);


--
-- Name: proposta_itens proposta_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_itens
    ADD CONSTRAINT proposta_itens_pkey PRIMARY KEY (id);


--
-- Name: propostas propostas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_pkey PRIMARY KEY (id);


--
-- Name: reunioes reunioes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reunioes
    ADD CONSTRAINT reunioes_pkey PRIMARY KEY (id);


--
-- Name: sdr_memory sdr_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sdr_memory
    ADD CONSTRAINT sdr_memory_pkey PRIMARY KEY (id);


--
-- Name: servicos_catalogo servicos_catalogo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_catalogo
    ADD CONSTRAINT servicos_catalogo_pkey PRIMARY KEY (id);


--
-- Name: status_changes status_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_changes
    ADD CONSTRAINT status_changes_pkey PRIMARY KEY (id);


--
-- Name: tarefas tarefas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_unique UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_mensagens whatsapp_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_mensagens whatsapp_mensagens_uazapi_message_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_uazapi_message_id_unique UNIQUE (uazapi_message_id);


--
-- Name: whatsapp_sessao whatsapp_sessao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessao
    ADD CONSTRAINT whatsapp_sessao_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_sessao whatsapp_sessao_session_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessao
    ADD CONSTRAINT whatsapp_sessao_session_name_unique UNIQUE (session_name);


--
-- Name: whatsapp_templates whatsapp_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);


--
-- Name: won_evidence_policies won_evidence_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.won_evidence_policies
    ADD CONSTRAINT won_evidence_policies_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_analysis_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_analysis_entity ON public.ai_analysis USING btree (entity_type, entity_id);


--
-- Name: idx_ai_analysis_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_analysis_org ON public.ai_analysis USING btree (organizacao_id);


--
-- Name: idx_ai_sdr_config_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ai_sdr_config_org ON public.ai_sdr_config USING btree (organizacao_id);


--
-- Name: idx_ai_sdr_contato_state_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ai_sdr_contato_state_contato ON public.ai_sdr_contato_state USING btree (contato_id);


--
-- Name: idx_ai_sdr_contato_state_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_sdr_contato_state_org ON public.ai_sdr_contato_state USING btree (organizacao_id);


--
-- Name: idx_ai_sdr_logs_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_sdr_logs_contato ON public.ai_sdr_logs USING btree (contato_id);


--
-- Name: idx_ai_sdr_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_sdr_logs_created ON public.ai_sdr_logs USING btree (created_at);


--
-- Name: idx_ai_sdr_logs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_sdr_logs_org ON public.ai_sdr_logs USING btree (organizacao_id);


--
-- Name: idx_ai_sdr_logs_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_sdr_logs_tipo ON public.ai_sdr_logs USING btree (tipo);


--
-- Name: idx_assinaturas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_empresa ON public.assinaturas USING btree (empresa_id);


--
-- Name: idx_assinaturas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_org ON public.assinaturas USING btree (organizacao_id);


--
-- Name: idx_assinaturas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_status ON public.assinaturas USING btree (status);


--
-- Name: idx_assinaturas_stripe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_assinaturas_stripe_id ON public.assinaturas USING btree (stripe_subscription_id);


--
-- Name: idx_atividades_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atividades_lead_id ON public.atividades USING btree (lead_id);


--
-- Name: idx_atividades_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atividades_org ON public.atividades USING btree (organizacao_id);


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_actor ON public.audit_log USING btree (actor_id);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at);


--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_audit_log_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_org ON public.audit_log USING btree (organizacao_id);


--
-- Name: idx_auth_tokens_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_tokens_usuario ON public.auth_tokens USING btree (usuario_id);


--
-- Name: idx_automacao_execucoes_automacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automacao_execucoes_automacao ON public.automacao_execucoes USING btree (automacao_id);


--
-- Name: idx_automacao_execucoes_executed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automacao_execucoes_executed ON public.automacao_execucoes USING btree (executed_at);


--
-- Name: idx_automacao_execucoes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automacao_execucoes_org ON public.automacao_execucoes USING btree (organizacao_id);


--
-- Name: idx_buscas_salvas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buscas_salvas_org ON public.buscas_salvas USING btree (organizacao_id);


--
-- Name: idx_cadence_enrollment_events_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_enrollment_events_enrollment ON public.cadence_enrollment_events USING btree (enrollment_id);


--
-- Name: idx_cadence_enrollments_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_enrollments_entity ON public.cadence_enrollments USING btree (entity_type, entity_id);


--
-- Name: idx_cadence_enrollments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_enrollments_org ON public.cadence_enrollments USING btree (organizacao_id);


--
-- Name: idx_cadence_enrollments_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_enrollments_scheduled ON public.cadence_enrollments USING btree (status, scheduled_at);


--
-- Name: idx_cadencia_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadencia_lead ON public.cadencia_execucoes USING btree (lead_id);


--
-- Name: idx_cadencia_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadencia_org ON public.cadencia_execucoes USING btree (organizacao_id);


--
-- Name: idx_clientes_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_empresa ON public.clientes USING btree (empresa_id);


--
-- Name: idx_clientes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_org ON public.clientes USING btree (organizacao_id);


--
-- Name: idx_closer_bloqueios_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closer_bloqueios_org ON public.closer_bloqueios USING btree (organizacao_id);


--
-- Name: idx_closer_bloqueios_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closer_bloqueios_usuario ON public.closer_bloqueios USING btree (usuario_id);


--
-- Name: idx_closer_disponibilidade_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closer_disponibilidade_org ON public.closer_disponibilidade USING btree (organizacao_id);


--
-- Name: idx_comercial_evidencia_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_comercial_evidencia_dedup ON public.comercial_evidencia USING btree (negocio_id, tipo, source_ref);


--
-- Name: idx_comercial_evidencia_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_evidencia_negocio ON public.comercial_evidencia USING btree (negocio_id);


--
-- Name: idx_comercial_evidencia_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comercial_evidencia_org ON public.comercial_evidencia USING btree (organizacao_id);


--
-- Name: idx_communications_canal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communications_canal ON public.communications USING btree (canal);


--
-- Name: idx_communications_external_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_communications_external_id ON public.communications USING btree (canal, external_id);


--
-- Name: idx_communications_ocorrido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communications_ocorrido ON public.communications USING btree (ocorrido_em);


--
-- Name: idx_communications_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communications_org ON public.communications USING btree (organizacao_id);


--
-- Name: idx_communications_pessoa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communications_pessoa ON public.communications USING btree (pessoa_id);


--
-- Name: idx_contato_listas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contato_listas_org ON public.contato_listas USING btree (organizacao_id);


--
-- Name: idx_contatos_conta_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contatos_conta_email ON public.contatos USING btree (conta_id, email);


--
-- Name: idx_contatos_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_lead ON public.contatos USING btree (lead_id);


--
-- Name: idx_contatos_lead_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contatos_lead_responsavel ON public.contatos USING btree (lead_id, responsavel_id);


--
-- Name: idx_contatos_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_org ON public.contatos USING btree (organizacao_id);


--
-- Name: idx_contatos_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_responsavel ON public.contatos USING btree (responsavel_id);


--
-- Name: idx_contatos_sessao_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contatos_sessao_phone ON public.contatos USING btree (sessao_id, telefone);


--
-- Name: idx_contatos_ultima_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_ultima_msg ON public.contatos USING btree (responsavel_id, ultima_msg_at);


--
-- Name: idx_contratos_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contratos_lead_id ON public.contratos USING btree (lead_id);


--
-- Name: idx_contratos_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contratos_org ON public.contratos USING btree (organizacao_id);


--
-- Name: idx_contratos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contratos_status ON public.contratos USING btree (status);


--
-- Name: idx_contratos_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contratos_vencimento ON public.contratos USING btree (vencimento);


--
-- Name: idx_custom_fields_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_org ON public.custom_fields USING btree (organizacao_id);


--
-- Name: idx_custom_fields_org_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_org_entity ON public.custom_fields USING btree (organizacao_id, entidade);


--
-- Name: idx_email_contas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_contas_org ON public.email_contas USING btree (organizacao_id);


--
-- Name: idx_email_contas_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_contas_user ON public.email_contas USING btree (usuario_id);


--
-- Name: idx_email_seq_exec_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_seq_exec_lead ON public.email_sequencia_execucoes USING btree (lead_id);


--
-- Name: idx_email_seq_exec_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_seq_exec_next ON public.email_sequencia_execucoes USING btree (proxima_execucao_at);


--
-- Name: idx_email_seq_exec_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_seq_exec_seq ON public.email_sequencia_execucoes USING btree (sequencia_id);


--
-- Name: idx_email_seq_exec_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_seq_exec_status ON public.email_sequencia_execucoes USING btree (status);


--
-- Name: idx_email_seq_passos_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_seq_passos_seq ON public.email_sequencia_passos USING btree (sequencia_id);


--
-- Name: idx_email_sequencias_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_sequencias_org ON public.email_sequencias USING btree (organizacao_id);


--
-- Name: idx_email_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_org ON public.email_templates USING btree (organizacao_id);


--
-- Name: idx_emails_conta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_conta_id ON public.emails USING btree (conta_id);


--
-- Name: idx_emails_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_contato ON public.emails USING btree (contato_id);


--
-- Name: idx_emails_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_created_at ON public.emails USING btree (created_at);


--
-- Name: idx_emails_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_lead_id ON public.emails USING btree (lead_id);


--
-- Name: idx_emails_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_org ON public.emails USING btree (organizacao_id);


--
-- Name: idx_emails_provider_msg_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_provider_msg_id ON public.emails USING btree (provider_message_id);


--
-- Name: idx_emails_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emails_thread_id ON public.emails USING btree (thread_id);


--
-- Name: idx_empresas_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_nome ON public.empresas USING btree (nome);


--
-- Name: idx_empresas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_org ON public.empresas USING btree (organizacao_id);


--
-- Name: idx_event_outbox_aggregate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_outbox_aggregate ON public.event_outbox USING btree (aggregate_type, aggregate_id);


--
-- Name: idx_event_outbox_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_event_outbox_idempotency ON public.event_outbox USING btree (idempotency_key);


--
-- Name: idx_event_outbox_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_outbox_org ON public.event_outbox USING btree (organizacao_id);


--
-- Name: idx_event_outbox_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_outbox_status ON public.event_outbox USING btree (status);


--
-- Name: idx_eventos_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_lead_id ON public.eventos USING btree (lead_id);


--
-- Name: idx_eventos_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_session_id ON public.eventos USING btree (session_id);


--
-- Name: idx_eventos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_tipo ON public.eventos USING btree (tipo);


--
-- Name: idx_faturas_competencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_competencia ON public.faturas USING btree (competencia);


--
-- Name: idx_faturas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_empresa ON public.faturas USING btree (empresa_id);


--
-- Name: idx_faturas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_org ON public.faturas USING btree (organizacao_id);


--
-- Name: idx_faturas_origem_ext; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_faturas_origem_ext ON public.faturas USING btree (origem, external_id);


--
-- Name: idx_faturas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_status ON public.faturas USING btree (status);


--
-- Name: idx_labels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labels_org ON public.labels USING btree (organizacao_id);


--
-- Name: idx_lead_labels_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_labels_label ON public.lead_labels USING btree (label_id);


--
-- Name: idx_lead_labels_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_labels_lead ON public.lead_labels USING btree (lead_id);


--
-- Name: idx_lead_listas_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_listas_lead ON public.lead_listas USING btree (lead_id);


--
-- Name: idx_lead_listas_lista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_listas_lista ON public.lead_listas USING btree (lista_id);


--
-- Name: idx_lead_user_unread_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_lead_user_unread_unique ON public.lead_user_unread USING btree (lead_id, usuario_id);


--
-- Name: idx_lead_user_unread_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_user_unread_user ON public.lead_user_unread USING btree (usuario_id);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);


--
-- Name: idx_leads_empresa_setor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_empresa_setor ON public.leads USING btree (empresa_setor);


--
-- Name: idx_leads_gclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_gclid ON public.leads USING btree (gclid);


--
-- Name: idx_leads_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_org ON public.leads USING btree (organizacao_id);


--
-- Name: idx_leads_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_org_status ON public.leads USING btree (organizacao_id, status);


--
-- Name: idx_leads_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_origem ON public.leads USING btree (origem);


--
-- Name: idx_leads_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_responsavel ON public.leads USING btree (responsavel_id);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_leads_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_telefone ON public.leads USING btree (telefone);


--
-- Name: idx_leads_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_tipo ON public.leads USING btree (tipo);


--
-- Name: idx_leads_utm_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_utm_campaign ON public.leads USING btree (utm_campaign);


--
-- Name: idx_ligacoes_call_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ligacoes_call_date ON public.ligacoes USING btree (call_date);


--
-- Name: idx_ligacoes_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ligacoes_lead ON public.ligacoes USING btree (lead_id);


--
-- Name: idx_ligacoes_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ligacoes_negocio ON public.ligacoes USING btree (negocio_id);


--
-- Name: idx_ligacoes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ligacoes_org ON public.ligacoes USING btree (organizacao_id);


--
-- Name: idx_meta_lead_staging_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_lead_staging_created_at ON public.meta_lead_staging USING btree (created_at);


--
-- Name: idx_meta_lead_staging_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_lead_staging_email ON public.meta_lead_staging USING btree (email);


--
-- Name: idx_meta_lead_staging_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_lead_staging_telefone ON public.meta_lead_staging USING btree (telefone);


--
-- Name: idx_metas_org_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metas_org_periodo ON public.metas USING btree (organizacao_id, periodo);


--
-- Name: idx_metricas_diarias_org_data; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_metricas_diarias_org_data ON public.metricas_diarias USING btree (organizacao_id, data);


--
-- Name: idx_mrr_mov_assinatura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrr_mov_assinatura ON public.mrr_movimentos USING btree (assinatura_id);


--
-- Name: idx_mrr_mov_ocorrido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrr_mov_ocorrido ON public.mrr_movimentos USING btree (ocorrido_em);


--
-- Name: idx_mrr_mov_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrr_mov_org ON public.mrr_movimentos USING btree (organizacao_id);


--
-- Name: idx_mrr_mov_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrr_mov_tipo ON public.mrr_movimentos USING btree (tipo);


--
-- Name: idx_negocio_labels_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocio_labels_label ON public.negocio_labels USING btree (label_id);


--
-- Name: idx_negocio_labels_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocio_labels_negocio ON public.negocio_labels USING btree (negocio_id);


--
-- Name: idx_negocio_labels_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_negocio_labels_unique ON public.negocio_labels USING btree (negocio_id, label_id);


--
-- Name: idx_negocio_leads_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocio_leads_lead ON public.negocio_leads USING btree (lead_id);


--
-- Name: idx_negocio_leads_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocio_leads_negocio ON public.negocio_leads USING btree (negocio_id);


--
-- Name: idx_negocios_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_empresa ON public.negocios USING btree (empresa_id);


--
-- Name: idx_negocios_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_lead ON public.negocios USING btree (lead_id);


--
-- Name: idx_negocios_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_org ON public.negocios USING btree (organizacao_id);


--
-- Name: idx_negocios_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_org_status ON public.negocios USING btree (organizacao_id, status);


--
-- Name: idx_negocios_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_origem ON public.negocios USING btree (origem_negocio);


--
-- Name: idx_negocios_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_responsavel ON public.negocios USING btree (responsavel_id);


--
-- Name: idx_negocios_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_status ON public.negocios USING btree (status);


--
-- Name: idx_notas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_empresa ON public.notas USING btree (empresa_id);


--
-- Name: idx_notas_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_lead ON public.notas USING btree (lead_id);


--
-- Name: idx_notas_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_negocio ON public.notas USING btree (negocio_id);


--
-- Name: idx_notas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_org ON public.notas USING btree (organizacao_id);


--
-- Name: idx_notificacoes_lida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_lida ON public.notificacoes USING btree (lida);


--
-- Name: idx_notificacoes_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_usuario ON public.notificacoes USING btree (usuario_id);


--
-- Name: idx_nps_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nps_lead_id ON public.nps_respostas USING btree (lead_id);


--
-- Name: idx_nps_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nps_org ON public.nps_respostas USING btree (organizacao_id);


--
-- Name: idx_nps_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nps_token ON public.nps_respostas USING btree (token);


--
-- Name: idx_oportunidades_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_empresa ON public.oportunidades USING btree (empresa_id);


--
-- Name: idx_oportunidades_negocio_legado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_negocio_legado ON public.oportunidades USING btree (negocio_id_legado);


--
-- Name: idx_oportunidades_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_org ON public.oportunidades USING btree (organizacao_id);


--
-- Name: idx_oportunidades_pessoa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_pessoa ON public.oportunidades USING btree (pessoa_id);


--
-- Name: idx_oportunidades_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_responsavel ON public.oportunidades USING btree (responsavel_id);


--
-- Name: idx_oportunidades_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_stage ON public.oportunidades USING btree (stage);


--
-- Name: idx_outreach_campanhas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_campanhas_org ON public.outreach_campanhas USING btree (organizacao_id);


--
-- Name: idx_pessoas_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pessoas_email ON public.pessoas USING btree (email);


--
-- Name: idx_pessoas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pessoas_empresa ON public.pessoas USING btree (empresa_id);


--
-- Name: idx_pessoas_lead_legado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pessoas_lead_legado ON public.pessoas USING btree (lead_id_legado);


--
-- Name: idx_pessoas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pessoas_org ON public.pessoas USING btree (organizacao_id);


--
-- Name: idx_pipelines_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipelines_org ON public.pipelines USING btree (organizacao_id);


--
-- Name: idx_pipelines_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pipelines_org_slug ON public.pipelines USING btree (organizacao_id, slug);


--
-- Name: idx_pontos_contato_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pontos_contato_empresa ON public.pontos_contato USING btree (empresa_id);


--
-- Name: idx_pontos_contato_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pontos_contato_org ON public.pontos_contato USING btree (organizacao_id);


--
-- Name: idx_pontos_contato_pessoa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pontos_contato_pessoa ON public.pontos_contato USING btree (pessoa_id);


--
-- Name: idx_pontos_contato_pessoa_first; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pontos_contato_pessoa_first ON public.pontos_contato USING btree (pessoa_id, is_first_touch);


--
-- Name: idx_pontos_contato_pessoa_last; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pontos_contato_pessoa_last ON public.pontos_contato USING btree (pessoa_id, is_last_touch);


--
-- Name: idx_proposta_itens_proposta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposta_itens_proposta ON public.proposta_itens USING btree (proposta_id);


--
-- Name: idx_propostas_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_lead ON public.propostas USING btree (lead_id);


--
-- Name: idx_propostas_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_numero ON public.propostas USING btree (organizacao_id, numero);


--
-- Name: idx_propostas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_org ON public.propostas USING btree (organizacao_id);


--
-- Name: idx_propostas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_status ON public.propostas USING btree (organizacao_id, status);


--
-- Name: idx_reunioes_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reunioes_lead ON public.reunioes USING btree (lead_id);


--
-- Name: idx_reunioes_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reunioes_negocio ON public.reunioes USING btree (negocio_id);


--
-- Name: idx_reunioes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reunioes_org ON public.reunioes USING btree (organizacao_id);


--
-- Name: idx_sdr_memory_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sdr_memory_org ON public.sdr_memory USING btree (organizacao_id);


--
-- Name: idx_sdr_memory_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sdr_memory_phone ON public.sdr_memory USING btree (phone, created_at);


--
-- Name: idx_servicos_catalogo_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_catalogo_ativo ON public.servicos_catalogo USING btree (organizacao_id, ativo);


--
-- Name: idx_servicos_catalogo_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_catalogo_org ON public.servicos_catalogo USING btree (organizacao_id);


--
-- Name: idx_tarefas_concluida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_concluida ON public.tarefas USING btree (concluida);


--
-- Name: idx_tarefas_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_lead_id ON public.tarefas USING btree (lead_id);


--
-- Name: idx_tarefas_negocio_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_negocio_id ON public.tarefas USING btree (negocio_id);


--
-- Name: idx_tarefas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_org ON public.tarefas USING btree (organizacao_id);


--
-- Name: idx_tarefas_org_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_org_vencimento ON public.tarefas USING btree (organizacao_id, data_vencimento);


--
-- Name: idx_tarefas_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_usuario_id ON public.tarefas USING btree (usuario_id);


--
-- Name: idx_tarefas_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_vencimento ON public.tarefas USING btree (data_vencimento);


--
-- Name: idx_teams_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_org ON public.teams USING btree (organizacao_id);


--
-- Name: idx_usuarios_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_org ON public.usuarios USING btree (organizacao_id);


--
-- Name: idx_usuarios_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_team ON public.usuarios USING btree (team_id);


--
-- Name: idx_wa_msg_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_msg_contato ON public.whatsapp_mensagens USING btree (contato_id);


--
-- Name: idx_wa_msg_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_msg_created_at ON public.whatsapp_mensagens USING btree (created_at);


--
-- Name: idx_wa_msg_enviado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_msg_enviado_por ON public.whatsapp_mensagens USING btree (enviado_por_id);


--
-- Name: idx_wa_msg_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_msg_lead_id ON public.whatsapp_mensagens USING btree (lead_id);


--
-- Name: idx_wa_msg_telefone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_msg_telefone ON public.whatsapp_mensagens USING btree (telefone);


--
-- Name: idx_wa_msg_uazapi_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_msg_uazapi_id ON public.whatsapp_mensagens USING btree (uazapi_message_id);


--
-- Name: idx_wa_sessao_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_sessao_org ON public.whatsapp_sessao USING btree (organizacao_id);


--
-- Name: idx_wa_sessao_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_sessao_user ON public.whatsapp_sessao USING btree (usuario_id);


--
-- Name: idx_wa_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_templates_org ON public.whatsapp_templates USING btree (organizacao_id);


--
-- Name: idx_won_evidence_policies_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_won_evidence_policies_org ON public.won_evidence_policies USING btree (organizacao_id);


--
-- Name: uq_auth_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_auth_tokens_hash ON public.auth_tokens USING btree (token_hash);


--
-- Name: uq_cadencia_lead_ordem; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cadencia_lead_ordem ON public.cadencia_execucoes USING btree (lead_id, ordem);


--
-- Name: uq_closer_disponibilidade_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_closer_disponibilidade_usuario ON public.closer_disponibilidade USING btree (usuario_id);


--
-- Name: uq_ligacoes_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ligacoes_idempotency ON public.ligacoes USING btree (idempotency_key);


--
-- Name: uq_metas_org_user_periodo_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_metas_org_user_periodo_tipo ON public.metas USING btree (organizacao_id, usuario_id, periodo, tipo);


--
-- Name: ai_analysis ai_analysis_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis
    ADD CONSTRAINT ai_analysis_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: ai_sdr_config ai_sdr_config_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_config
    ADD CONSTRAINT ai_sdr_config_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: ai_sdr_contato_state ai_sdr_contato_state_contato_id_contatos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_contato_state
    ADD CONSTRAINT ai_sdr_contato_state_contato_id_contatos_id_fk FOREIGN KEY (contato_id) REFERENCES public.contatos(id) ON DELETE CASCADE;


--
-- Name: ai_sdr_contato_state ai_sdr_contato_state_handoff_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_contato_state
    ADD CONSTRAINT ai_sdr_contato_state_handoff_usuario_id_usuarios_id_fk FOREIGN KEY (handoff_usuario_id) REFERENCES public.usuarios(id);


--
-- Name: ai_sdr_contato_state ai_sdr_contato_state_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_contato_state
    ADD CONSTRAINT ai_sdr_contato_state_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: ai_sdr_logs ai_sdr_logs_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_sdr_logs
    ADD CONSTRAINT ai_sdr_logs_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: assinaturas assinaturas_contrato_id_contratos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_contrato_id_contratos_id_fk FOREIGN KEY (contrato_id) REFERENCES public.contratos(id);


--
-- Name: assinaturas assinaturas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: assinaturas assinaturas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: assinaturas assinaturas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: atividades atividades_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: atividades atividades_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: atividades atividades_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: atividades atividades_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: audit_log audit_log_actor_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_usuarios_id_fk FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: audit_log audit_log_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: auth_tokens auth_tokens_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: automacao_execucoes automacao_execucoes_automacao_id_automacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacao_execucoes
    ADD CONSTRAINT automacao_execucoes_automacao_id_automacoes_id_fk FOREIGN KEY (automacao_id) REFERENCES public.automacoes(id) ON DELETE CASCADE;


--
-- Name: automacao_execucoes automacao_execucoes_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacao_execucoes
    ADD CONSTRAINT automacao_execucoes_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: automacoes automacoes_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacoes
    ADD CONSTRAINT automacoes_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: buscas_salvas buscas_salvas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buscas_salvas
    ADD CONSTRAINT buscas_salvas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cadence_definitions cadence_definitions_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definitions
    ADD CONSTRAINT cadence_definitions_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cadence_enrollment_events cadence_enrollment_events_enrollment_id_cadence_enrollments_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollment_events
    ADD CONSTRAINT cadence_enrollment_events_enrollment_id_cadence_enrollments_id_ FOREIGN KEY (enrollment_id) REFERENCES public.cadence_enrollments(id) ON DELETE CASCADE;


--
-- Name: cadence_enrollments cadence_enrollments_cadence_definition_id_cadence_definitions_i; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollments
    ADD CONSTRAINT cadence_enrollments_cadence_definition_id_cadence_definitions_i FOREIGN KEY (cadence_definition_id) REFERENCES public.cadence_definitions(id) ON DELETE CASCADE;


--
-- Name: cadence_enrollments cadence_enrollments_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollments
    ADD CONSTRAINT cadence_enrollments_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cadencia_execucoes cadencia_execucoes_enviado_por_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_execucoes
    ADD CONSTRAINT cadencia_execucoes_enviado_por_id_usuarios_id_fk FOREIGN KEY (enviado_por_id) REFERENCES public.usuarios(id);


--
-- Name: cadencia_execucoes cadencia_execucoes_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_execucoes
    ADD CONSTRAINT cadencia_execucoes_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: cadencia_execucoes cadencia_execucoes_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_execucoes
    ADD CONSTRAINT cadencia_execucoes_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cadencia_execucoes cadencia_execucoes_sessao_id_whatsapp_sessao_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_execucoes
    ADD CONSTRAINT cadencia_execucoes_sessao_id_whatsapp_sessao_id_fk FOREIGN KEY (sessao_id) REFERENCES public.whatsapp_sessao(id);


--
-- Name: campanhas campanhas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanhas
    ADD CONSTRAINT campanhas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: clientes clientes_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: clientes clientes_lead_id_legado_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_lead_id_legado_leads_id_fk FOREIGN KEY (lead_id_legado) REFERENCES public.leads(id);


--
-- Name: clientes clientes_oportunidade_origem_id_oportunidades_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_oportunidade_origem_id_oportunidades_id_fk FOREIGN KEY (oportunidade_origem_id) REFERENCES public.oportunidades(id);


--
-- Name: clientes clientes_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: clientes clientes_pessoa_principal_id_pessoas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pessoa_principal_id_pessoas_id_fk FOREIGN KEY (pessoa_principal_id) REFERENCES public.pessoas(id);


--
-- Name: closer_bloqueios closer_bloqueios_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closer_bloqueios
    ADD CONSTRAINT closer_bloqueios_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: closer_bloqueios closer_bloqueios_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closer_bloqueios
    ADD CONSTRAINT closer_bloqueios_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: closer_disponibilidade closer_disponibilidade_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closer_disponibilidade
    ADD CONSTRAINT closer_disponibilidade_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: closer_disponibilidade closer_disponibilidade_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closer_disponibilidade
    ADD CONSTRAINT closer_disponibilidade_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: comercial_evidencia comercial_evidencia_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- Name: comercial_evidencia comercial_evidencia_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: comercial_evidencia comercial_evidencia_verificado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_verificado_por_usuarios_id_fk FOREIGN KEY (verificado_por) REFERENCES public.usuarios(id);


--
-- Name: communications communications_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: communications communications_pessoa_id_pessoas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pessoa_id_pessoas_id_fk FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id);


--
-- Name: communications communications_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: contato_listas contato_listas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_listas
    ADD CONSTRAINT contato_listas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: contatos contatos_conta_id_email_contas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_conta_id_email_contas_id_fk FOREIGN KEY (conta_id) REFERENCES public.email_contas(id);


--
-- Name: contatos contatos_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: contatos contatos_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: contatos contatos_responsavel_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_responsavel_id_usuarios_id_fk FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: contatos contatos_sessao_id_whatsapp_sessao_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_sessao_id_whatsapp_sessao_id_fk FOREIGN KEY (sessao_id) REFERENCES public.whatsapp_sessao(id);


--
-- Name: contratos contratos_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: contratos contratos_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: contratos contratos_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: custom_fields custom_fields_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: email_contas email_contas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_contas
    ADD CONSTRAINT email_contas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: email_contas email_contas_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_contas
    ADD CONSTRAINT email_contas_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: email_sequencia_execucoes email_sequencia_execucoes_conta_id_email_contas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencia_execucoes
    ADD CONSTRAINT email_sequencia_execucoes_conta_id_email_contas_id_fk FOREIGN KEY (conta_id) REFERENCES public.email_contas(id);


--
-- Name: email_sequencia_execucoes email_sequencia_execucoes_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencia_execucoes
    ADD CONSTRAINT email_sequencia_execucoes_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: email_sequencia_execucoes email_sequencia_execucoes_sequencia_id_email_sequencias_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencia_execucoes
    ADD CONSTRAINT email_sequencia_execucoes_sequencia_id_email_sequencias_id_fk FOREIGN KEY (sequencia_id) REFERENCES public.email_sequencias(id) ON DELETE CASCADE;


--
-- Name: email_sequencia_passos email_sequencia_passos_sequencia_id_email_sequencias_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencia_passos
    ADD CONSTRAINT email_sequencia_passos_sequencia_id_email_sequencias_id_fk FOREIGN KEY (sequencia_id) REFERENCES public.email_sequencias(id) ON DELETE CASCADE;


--
-- Name: email_sequencia_passos email_sequencia_passos_template_id_email_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencia_passos
    ADD CONSTRAINT email_sequencia_passos_template_id_email_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.email_templates(id);


--
-- Name: email_sequencias email_sequencias_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sequencias
    ADD CONSTRAINT email_sequencias_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: email_templates email_templates_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: emails emails_conta_id_email_contas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_conta_id_email_contas_id_fk FOREIGN KEY (conta_id) REFERENCES public.email_contas(id);


--
-- Name: emails emails_enviado_por_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_enviado_por_id_usuarios_id_fk FOREIGN KEY (enviado_por_id) REFERENCES public.usuarios(id);


--
-- Name: emails emails_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: emails emails_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: empresas empresas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: event_outbox event_outbox_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: eventos eventos_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: faturas faturas_acionado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_acionado_por_usuarios_id_fk FOREIGN KEY (acionado_por) REFERENCES public.usuarios(id);


--
-- Name: faturas faturas_assinatura_id_assinaturas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_assinatura_id_assinaturas_id_fk FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id);


--
-- Name: faturas faturas_contrato_id_contratos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_contrato_id_contratos_id_fk FOREIGN KEY (contrato_id) REFERENCES public.contratos(id);


--
-- Name: faturas faturas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: faturas faturas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: faturas faturas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: labels labels_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: lead_labels lead_labels_label_id_labels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_labels
    ADD CONSTRAINT lead_labels_label_id_labels_id_fk FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: lead_labels lead_labels_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_labels
    ADD CONSTRAINT lead_labels_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_listas lead_listas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_listas
    ADD CONSTRAINT lead_listas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_listas lead_listas_lista_id_contato_listas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_listas
    ADD CONSTRAINT lead_listas_lista_id_contato_listas_id_fk FOREIGN KEY (lista_id) REFERENCES public.contato_listas(id) ON DELETE CASCADE;


--
-- Name: lead_user_unread lead_user_unread_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_user_unread
    ADD CONSTRAINT lead_user_unread_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_user_unread lead_user_unread_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_user_unread
    ADD CONSTRAINT lead_user_unread_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: leads leads_agenda_closer_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_agenda_closer_id_usuarios_id_fk FOREIGN KEY (agenda_closer_id) REFERENCES public.usuarios(id);


--
-- Name: leads leads_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: leads leads_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: leads leads_responsavel_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_responsavel_id_usuarios_id_fk FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: ligacoes ligacoes_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ligacoes
    ADD CONSTRAINT ligacoes_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: ligacoes ligacoes_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ligacoes
    ADD CONSTRAINT ligacoes_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: ligacoes ligacoes_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ligacoes
    ADD CONSTRAINT ligacoes_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: ligacoes ligacoes_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ligacoes
    ADD CONSTRAINT ligacoes_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: metas metas_criado_por_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_criado_por_usuarios_id_fk FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);


--
-- Name: metas metas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: metas metas_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: metricas_diarias metricas_diarias_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metricas_diarias
    ADD CONSTRAINT metricas_diarias_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: mrr_movimentos mrr_movimentos_assinatura_id_assinaturas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrr_movimentos
    ADD CONSTRAINT mrr_movimentos_assinatura_id_assinaturas_id_fk FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id);


--
-- Name: mrr_movimentos mrr_movimentos_contrato_id_contratos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrr_movimentos
    ADD CONSTRAINT mrr_movimentos_contrato_id_contratos_id_fk FOREIGN KEY (contrato_id) REFERENCES public.contratos(id);


--
-- Name: mrr_movimentos mrr_movimentos_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrr_movimentos
    ADD CONSTRAINT mrr_movimentos_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: mrr_movimentos mrr_movimentos_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrr_movimentos
    ADD CONSTRAINT mrr_movimentos_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: negocio_labels negocio_labels_label_id_labels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocio_labels
    ADD CONSTRAINT negocio_labels_label_id_labels_id_fk FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: negocio_labels negocio_labels_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocio_labels
    ADD CONSTRAINT negocio_labels_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- Name: negocio_leads negocio_leads_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocio_leads
    ADD CONSTRAINT negocio_leads_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: negocio_leads negocio_leads_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocio_leads
    ADD CONSTRAINT negocio_leads_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- Name: negocios negocios_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: negocios negocios_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: negocios negocios_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: negocios negocios_pipeline_id_pipelines_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_pipeline_id_pipelines_id_fk FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id);


--
-- Name: negocios negocios_responsavel_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_responsavel_id_usuarios_id_fk FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: notas notas_autor_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_autor_id_usuarios_id_fk FOREIGN KEY (autor_id) REFERENCES public.usuarios(id);


--
-- Name: notas notas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: notas notas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: notas notas_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- Name: notas notas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: notificacoes notificacoes_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: nps_respostas nps_respostas_contrato_id_contratos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_contrato_id_contratos_id_fk FOREIGN KEY (contrato_id) REFERENCES public.contratos(id);


--
-- Name: nps_respostas nps_respostas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: nps_respostas nps_respostas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: oportunidades oportunidades_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: oportunidades oportunidades_negocio_id_legado_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_negocio_id_legado_negocios_id_fk FOREIGN KEY (negocio_id_legado) REFERENCES public.negocios(id);


--
-- Name: oportunidades oportunidades_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: oportunidades oportunidades_pessoa_id_pessoas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_pessoa_id_pessoas_id_fk FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id);


--
-- Name: oportunidades oportunidades_pipeline_id_pipelines_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_pipeline_id_pipelines_id_fk FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id);


--
-- Name: oportunidades oportunidades_responsavel_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_responsavel_id_usuarios_id_fk FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: outreach_campanhas outreach_campanhas_created_by_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campanhas
    ADD CONSTRAINT outreach_campanhas_created_by_usuarios_id_fk FOREIGN KEY (created_by) REFERENCES public.usuarios(id);


--
-- Name: outreach_campanhas outreach_campanhas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campanhas
    ADD CONSTRAINT outreach_campanhas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pessoas pessoas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoas
    ADD CONSTRAINT pessoas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pessoas pessoas_lead_id_legado_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoas
    ADD CONSTRAINT pessoas_lead_id_legado_leads_id_fk FOREIGN KEY (lead_id_legado) REFERENCES public.leads(id);


--
-- Name: pessoas pessoas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoas
    ADD CONSTRAINT pessoas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pipelines pipelines_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipelines
    ADD CONSTRAINT pipelines_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pontos_contato pontos_contato_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pontos_contato pontos_contato_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pontos_contato pontos_contato_pessoa_id_pessoas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_pessoa_id_pessoas_id_fk FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id);


--
-- Name: proposta_itens proposta_itens_proposta_id_propostas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_itens
    ADD CONSTRAINT proposta_itens_proposta_id_propostas_id_fk FOREIGN KEY (proposta_id) REFERENCES public.propostas(id) ON DELETE CASCADE;


--
-- Name: proposta_itens proposta_itens_servico_catalogo_id_servicos_catalogo_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_itens
    ADD CONSTRAINT proposta_itens_servico_catalogo_id_servicos_catalogo_id_fk FOREIGN KEY (servico_catalogo_id) REFERENCES public.servicos_catalogo(id);


--
-- Name: propostas propostas_contrato_id_contratos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_contrato_id_contratos_id_fk FOREIGN KEY (contrato_id) REFERENCES public.contratos(id);


--
-- Name: propostas propostas_criado_por_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_criado_por_id_usuarios_id_fk FOREIGN KEY (criado_por_id) REFERENCES public.usuarios(id);


--
-- Name: propostas propostas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: propostas propostas_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: propostas propostas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: reunioes reunioes_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reunioes
    ADD CONSTRAINT reunioes_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: reunioes reunioes_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reunioes
    ADD CONSTRAINT reunioes_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: reunioes reunioes_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reunioes
    ADD CONSTRAINT reunioes_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: reunioes reunioes_responsavel_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reunioes
    ADD CONSTRAINT reunioes_responsavel_id_usuarios_id_fk FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: sdr_memory sdr_memory_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sdr_memory
    ADD CONSTRAINT sdr_memory_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: servicos_catalogo servicos_catalogo_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_catalogo
    ADD CONSTRAINT servicos_catalogo_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: status_changes status_changes_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_changes
    ADD CONSTRAINT status_changes_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: status_changes status_changes_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_changes
    ADD CONSTRAINT status_changes_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: status_changes status_changes_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_changes
    ADD CONSTRAINT status_changes_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: tarefas tarefas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: tarefas tarefas_negocio_id_negocios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_negocio_id_negocios_id_fk FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: tarefas tarefas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: tarefas tarefas_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: teams teams_manager_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_manager_id_usuarios_id_fk FOREIGN KEY (manager_id) REFERENCES public.usuarios(id);


--
-- Name: teams teams_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: usuarios usuarios_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: usuarios usuarios_team_id_teams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: whatsapp_mensagens whatsapp_mensagens_enviado_por_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_enviado_por_id_usuarios_id_fk FOREIGN KEY (enviado_por_id) REFERENCES public.usuarios(id);


--
-- Name: whatsapp_mensagens whatsapp_mensagens_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: whatsapp_mensagens whatsapp_mensagens_sessao_id_whatsapp_sessao_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_sessao_id_whatsapp_sessao_id_fk FOREIGN KEY (sessao_id) REFERENCES public.whatsapp_sessao(id);


--
-- Name: whatsapp_sessao whatsapp_sessao_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessao
    ADD CONSTRAINT whatsapp_sessao_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: whatsapp_sessao whatsapp_sessao_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessao
    ADD CONSTRAINT whatsapp_sessao_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: whatsapp_templates whatsapp_templates_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: won_evidence_policies won_evidence_policies_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.won_evidence_policies
    ADD CONSTRAINT won_evidence_policies_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 4a8GiEQXcIWXpg7DQWTj4mPCAfdlZWBmO8dO0MoDmhNKFQkVtFGSIp9auz7xRs4

