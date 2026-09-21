--
-- PostgreSQL database dump
--

\restrict rrUu3aFdQ8PBoeLzaIAGfZrAhYywqN5HPHwBEHmC1aTN2sAktfWVYidNhDE5aCI

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: normalizar_nome_produto(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalizar_nome_produto(txt text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT btrim(regexp_replace(
    lower(translate(txt,
      'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
      'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
    '[^a-z0-9]+', ' ', 'g'))
$$;


--
-- Name: prevent_closed_service_ledger_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_closed_service_ledger_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM service_ledger_batches b WHERE b.id = OLD.batch_id AND b.status = 'CLOSED') THEN
    RAISE EXCEPTION 'closed service ledger entries are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: tarefas_sincronizar_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tarefas_sincronizar_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.concluida AND NEW.status <> 'concluida' THEN
      NEW.status := 'concluida';
    ELSIF NEW.status = 'concluida' THEN
      NEW.concluida := true;
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    END IF;
    RETURN NEW;
  END IF;

  -- Quem mudou o status manda; se mudou só `concluida`, o status acompanha.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'concluida' THEN
      NEW.concluida := true;
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSE
      NEW.concluida := false;
      NEW.concluida_em := NULL;
    END IF;
  ELSIF NEW.concluida IS DISTINCT FROM OLD.concluida THEN
    IF NEW.concluida THEN
      NEW.status := 'concluida';
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSE
      NEW.status := 'a_fazer';
      NEW.concluida_em := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _carga_contagem_antes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._carga_contagem_antes (
    tabela text NOT NULL,
    linhas bigint NOT NULL
);


--
-- Name: _migracoes_aplicadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migracoes_aplicadas (
    nome text NOT NULL,
    hash text NOT NULL,
    aplicada_em timestamp with time zone DEFAULT now() NOT NULL,
    baseline boolean DEFAULT false NOT NULL
);


--
-- Name: ai_agent_run_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_agent_run_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    run_id uuid NOT NULL,
    sequence integer NOT NULL,
    kind text NOT NULL,
    name text,
    status text NOT NULL,
    input jsonb,
    output jsonb,
    tokens_input integer DEFAULT 0 NOT NULL,
    tokens_output integer DEFAULT 0 NOT NULL,
    custo numeric(10,4),
    latency_ms integer,
    error_code text,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: ai_agent_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_agent_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    version_id uuid,
    contato_id uuid,
    lead_id uuid,
    source_message_id uuid,
    modo text DEFAULT 'live'::text NOT NULL,
    status text NOT NULL,
    input jsonb,
    trace jsonb DEFAULT '[]'::jsonb NOT NULL,
    tokens integer DEFAULT 0 NOT NULL,
    custo numeric(10,4),
    erro text,
    handoff_motivo text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    outbound_message_id uuid,
    channel_session_id uuid,
    correlation_id uuid,
    tokens_input integer DEFAULT 0 NOT NULL,
    tokens_output integer DEFAULT 0 NOT NULL,
    error_code text,
    abort_reason text,
    latency_ms integer,
    steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: ai_agent_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_agent_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    versao integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    system_prompt text DEFAULT ''::text NOT NULL,
    provider text,
    modelo text,
    tools jsonb DEFAULT '[]'::jsonb NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    handoff_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    knowledge_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    max_steps integer DEFAULT 8 NOT NULL,
    token_budget integer DEFAULT 4000 NOT NULL,
    cost_budget numeric(10,4),
    created_by_id uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organizacao_id uuid NOT NULL,
    credential_id uuid,
    channel_session_id uuid,
    guardrail_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    history_message_window integer DEFAULT 20 NOT NULL,
    history_token_window integer DEFAULT 8000 NOT NULL,
    cases_enabled boolean DEFAULT false NOT NULL,
    superseded_at timestamp with time zone
);


--
-- Name: ai_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    slug text NOT NULL,
    descricao text,
    finalidade text DEFAULT 'atendimento'::text NOT NULL,
    prioridade integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'mcp_agent'::text NOT NULL,
    published_version_id uuid,
    archived_at timestamp with time zone
);


--
-- Name: ai_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
    kind text NOT NULL,
    severity text DEFAULT 'warning'::text NOT NULL,
    title text NOT NULL,
    body text,
    ref_kind text,
    ref_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    acknowledged_by_id uuid,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


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
-- Name: ai_case_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_case_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    case_id uuid NOT NULL,
    kind text NOT NULL,
    actor_kind text NOT NULL,
    actor_user_id uuid,
    human_action text,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    contato_id uuid NOT NULL,
    lead_id uuid,
    agent_id uuid,
    run_id uuid,
    status text DEFAULT 'awaiting_human'::text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    blocker text NOT NULL,
    context_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    source text DEFAULT 'agent'::text NOT NULL,
    followup_attempts integer DEFAULT 0 NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_contact_field_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_contact_field_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    contato_id uuid NOT NULL,
    campo text NOT NULL,
    valor_proposto text NOT NULL,
    valor_anterior text,
    message_id uuid,
    trecho text,
    proposed_by_agent_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    proposed_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    decided_at timestamp with time zone,
    decided_by_user_id uuid,
    motivo_recusa text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_improvement_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_improvement_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    decided_by_id uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    version_id uuid NOT NULL,
    sequence integer NOT NULL,
    content text NOT NULL,
    token_count integer,
    embedding jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_knowledge_searches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_searches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    run_id uuid,
    knowledge_version_id uuid,
    hits integer DEFAULT 0 NOT NULL,
    top_score numeric(8,6),
    threshold numeric(8,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_knowledge_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    source_type text NOT NULL,
    source_uri text,
    mime_type text,
    checksum text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_id uuid,
    indexed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_knowledge_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    source_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_memory_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_memory_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    source text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_memory_pointers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_memory_pointers (
    organizacao_id uuid NOT NULL,
    version_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_memory_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_memory_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    model_id text NOT NULL,
    display_name text NOT NULL,
    description text,
    context_window integer,
    input_price_per_million numeric(12,6),
    output_price_per_million numeric(12,6),
    supports_tools boolean DEFAULT true NOT NULL,
    supports_vision boolean DEFAULT false NOT NULL,
    is_default_for_provider boolean DEFAULT false NOT NULL,
    deprecated_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_provider_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    provider text NOT NULL,
    label text NOT NULL,
    api_key_ciphertext text NOT NULL,
    api_key_iv text NOT NULL,
    api_key_tag text NOT NULL,
    api_key_last4 text NOT NULL,
    encryption_version integer DEFAULT 1 NOT NULL,
    validated_at timestamp with time zone,
    validation_error text,
    models_available text[],
    ativo boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_purpose_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_purpose_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    purpose text NOT NULL,
    provider text NOT NULL,
    credential_id uuid,
    model_id text NOT NULL,
    base_url text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_router_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_router_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    router_id uuid,
    contato_id uuid,
    intent_name text,
    confidence numeric(4,3),
    agent_id uuid,
    outcome text NOT NULL,
    correlation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_router_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_router_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    router_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    intent_name text NOT NULL,
    intent_description text NOT NULL,
    examples text[] DEFAULT '{}'::text[] NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_routers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_routers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    channel_session_id uuid NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{"sticky": true, "minConfidence": 0.6, "classifierModel": null}'::jsonb NOT NULL,
    fallback_agent_id uuid,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: ai_send_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_send_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    run_id uuid NOT NULL,
    sequence integer NOT NULL,
    body_hash text NOT NULL,
    channel text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    external_message_id text,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_skill_activations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_skill_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    skill_name text NOT NULL,
    skill_version_id uuid,
    run_id uuid,
    trigger text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_skill_pointers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_skill_pointers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    name text NOT NULL,
    version_id uuid NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_skill_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_skill_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
    name text NOT NULL,
    version_number integer NOT NULL,
    description text,
    instructions text NOT NULL,
    manifest jsonb DEFAULT '[]'::jsonb NOT NULL,
    forked_from_version_id uuid,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_usage_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    agent_id uuid,
    provider text,
    period text DEFAULT 'monthly'::text NOT NULL,
    token_limit integer,
    cost_limit numeric(12,4),
    warning_percent integer DEFAULT 80 NOT NULL,
    hard_stop boolean DEFAULT true NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: anexos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anexos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    negocio_id uuid,
    nota_id uuid,
    nome_arquivo text NOT NULL,
    url text NOT NULL,
    tipo_mime text,
    tamanho_bytes integer,
    criado_por_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: anexos_legado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anexos_legado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    entidade_tipo text NOT NULL,
    entidade_id uuid,
    categoria text DEFAULT 'anexo_generico'::text NOT NULL,
    zoho_id text,
    nome_arquivo text NOT NULL,
    tamanho_bytes bigint,
    criado_em_original timestamp with time zone,
    storage_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    checksum_sha256 text
);


--
-- Name: assinatura_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assinatura_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    assinatura_id uuid NOT NULL,
    stripe_subscription_item_id text,
    stripe_product_id text,
    stripe_price_id text,
    produto text,
    quantidade integer DEFAULT 1 NOT NULL,
    preco_unitario numeric(12,2),
    moeda text DEFAULT 'BRL'::text NOT NULL,
    recurring_interval text,
    service_family text DEFAULT 'UNKNOWN'::text NOT NULL,
    revenue_nature text,
    servico_canonico_id uuid,
    desconto_percentual numeric(5,2),
    proration_behavior text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    status text,
    raw jsonb,
    synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assinaturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assinaturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revenue_nature text,
    billing_status text,
    commercial_lifecycle text,
    semantic_confidence text,
    semantic_evidence jsonb,
    servico_id uuid
);


--
-- Name: atividades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atividades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
    lead_id uuid,
    negocio_id uuid,
    usuario_id uuid,
    tipo text NOT NULL,
    titulo text,
    descricao text,
    dados jsonb,
    duracao_segundos integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    descricao_raw text,
    superseded_by_note_id uuid,
    timeline_visible boolean DEFAULT true NOT NULL,
    usuario_display_name text,
    usuario_source_id text,
    empresa_id uuid
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
-- Name: billing_audit_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_audit_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
    scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'RUNNING'::text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    artifact_path text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT billing_audit_runs_status_check CHECK ((status = ANY (ARRAY['RUNNING'::text, 'COMPLETED'::text, 'FAILED'::text])))
);


--
-- Name: billing_correction_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_correction_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_run_id uuid,
    billing_identity_id uuid,
    organizacao_id uuid,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    before jsonb DEFAULT '{}'::jsonb NOT NULL,
    after jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    rule_applied text NOT NULL,
    operator text NOT NULL,
    reversible boolean DEFAULT true NOT NULL,
    reverted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_customer_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_customer_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    billing_identity_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    is_canonical boolean DEFAULT false NOT NULL,
    resolution_source text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_identities (
    id uuid NOT NULL,
    organizacao_id uuid NOT NULL,
    canonical_empresa_id uuid,
    canonical_lead_id uuid,
    provider text NOT NULL,
    external_customer_id text NOT NULL,
    emails jsonb DEFAULT '[]'::jsonb NOT NULL,
    phones jsonb DEFAULT '[]'::jsonb NOT NULL,
    confidence text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    empresa_id uuid,
    lead_id uuid,
    canonical_stripe_customer_id text,
    cnpj_normalized text,
    primary_email_normalized text,
    status text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_resolution_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_resolution_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_run_id uuid,
    organizacao_id uuid,
    queue text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    crm_entity_type text,
    crm_entity_id uuid,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    recommended_action jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT billing_resolution_cases_queue_check CHECK ((queue = ANY (ARRAY['CONFIRMED'::text, 'REVIEW'::text, 'CONFLICT'::text]))),
    CONSTRAINT billing_resolution_cases_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'APPROVED'::text, 'REJECTED'::text, 'APPLIED'::text])))
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
-- Name: cadence_definition_pointers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadence_definition_pointers (
    cadence_definition_id uuid NOT NULL,
    organizacao_id uuid NOT NULL,
    draft_version_id uuid,
    published_version_id uuid,
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    draft_steps jsonb,
    versao integer DEFAULT 1 NOT NULL,
    published_at timestamp with time zone,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    handoff_policy jsonb DEFAULT '{"mode": "pause_on_reply"}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cadence_version_id uuid,
    current_node_id text,
    next_eval_at timestamp with time zone,
    claimed_until timestamp with time zone,
    last_inbound_at timestamp with time zone,
    handoff_snapshot jsonb,
    source_event_id uuid,
    idempotency_key text
);


--
-- Name: cadence_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cadence_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    cadence_definition_id uuid NOT NULL,
    version_number integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    graph jsonb NOT NULL,
    compiled_steps jsonb NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    handoff_policy jsonb DEFAULT '{"mode": "pause_on_reply"}'::jsonb NOT NULL,
    validation_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_id uuid,
    published_at timestamp with time zone,
    superseded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: callface_ai_external_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.callface_ai_external_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    provider text DEFAULT 'callface_ai'::text NOT NULL,
    external_type text NOT NULL,
    external_id text NOT NULL,
    confidence text NOT NULL,
    source text,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: callface_ai_reconciliation_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.callface_ai_reconciliation_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    external_organization_id text NOT NULL,
    match_signal text NOT NULL,
    score numeric(5,4),
    status text DEFAULT 'pendente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: callface_ai_tenant_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.callface_ai_tenant_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_identity_id uuid NOT NULL,
    snapshot_at timestamp with time zone NOT NULL,
    usuarios_total integer,
    usuarios_ativos integer,
    usuarios_pendentes integer,
    licencas_ativas integer,
    workspaces_ativos integer,
    campanhas_ativas integer,
    campanhas_concluidas integer,
    chamadas_total integer,
    chamadas_finalizadas integer,
    minutos_uso numeric(14,2),
    agentes_prontos integer,
    integracao_whatsapp_conectada boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: callface_ai_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.callface_ai_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_identity_id uuid NOT NULL,
    event_type text NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    metadata jsonb,
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
-- Name: catalogo_mapeamentos_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_mapeamentos_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    legacy_product_id text NOT NULL,
    legacy_name text NOT NULL,
    canonical_product_id uuid,
    canonical_name text,
    service_family text NOT NULL,
    default_revenue_nature text NOT NULL,
    active_selectable boolean DEFAULT false NOT NULL,
    historical_only boolean DEFAULT true NOT NULL,
    confidence text NOT NULL,
    evidence text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    legacy_source text,
    categoria_crm text,
    rule_source text,
    reviewed_status text DEFAULT 'pendente'::text NOT NULL,
    revisado_por uuid,
    revisado_em timestamp with time zone,
    notes text,
    ocorrencias integer DEFAULT 0 NOT NULL,
    classificado_em timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nome_normalizado text GENERATED ALWAYS AS (btrim(regexp_replace(lower(translate(legacy_name, 'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç'::text, 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'::text)), '[^a-z0-9]+'::text, ' '::text, 'g'::text))) STORED
);


--
-- Name: catalogo_precos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_precos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    servico_catalogo_id uuid NOT NULL,
    stripe_price_id text NOT NULL,
    sku text,
    lookup_key text,
    variacao text NOT NULL,
    descricao text,
    valor numeric(12,2) NOT NULL,
    moeda text DEFAULT 'BRL'::text NOT NULL,
    tipo text NOT NULL,
    recorrente boolean DEFAULT false NOT NULL,
    periodo text,
    revenue_nature text NOT NULL,
    modelo_cobranca text,
    modelo_preco_stripe text,
    exige_contrato boolean DEFAULT false NOT NULL,
    observacao text,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checkouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    proposta_id uuid NOT NULL,
    negocio_id uuid,
    grupo_comercial_id uuid,
    origem text NOT NULL,
    criado_por_id uuid,
    stripe_session_id text,
    stripe_subscription_id text,
    stripe_checkout_url text,
    status text DEFAULT 'criado'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    abertura_em timestamp with time zone,
    completado_em timestamp with time zone,
    expira_em timestamp with time zone,
    stripe_customer_id text,
    stripe_invoice_id text,
    stripe_payment_intent_id text,
    payment_status text,
    next_payment_due_at timestamp with time zone,
    paid_at timestamp with time zone,
    metadata jsonb
);


--
-- Name: cliente_receita_mensal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_receita_mensal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid,
    customer_key text NOT NULL,
    cliente_nome text NOT NULL,
    documento text,
    competencia date NOT NULL,
    valor numeric(14,2) DEFAULT 0 NOT NULL,
    quantidade_lancamentos integer DEFAULT 1 NOT NULL,
    service_family text DEFAULT 'UNKNOWN'::text NOT NULL,
    revenue_nature text DEFAULT 'UNKNOWN'::text NOT NULL,
    canonical_product text,
    confidence text DEFAULT 'UNRESOLVED'::text NOT NULL,
    source text NOT NULL,
    source_file text,
    source_row text,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responsavel_id uuid,
    entrou_carteira_em timestamp with time zone,
    observacoes_cs text,
    jornada_iniciada_em timestamp with time zone,
    cs_sem_evidencia boolean DEFAULT false NOT NULL
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    outlook_event_id text
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    grupo_comercial_id uuid
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
-- Name: contato_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contato_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contato_id uuid NOT NULL,
    label_id uuid NOT NULL,
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
    zoho_id text,
    status text DEFAULT 'open'::text NOT NULL,
    snoozed_until timestamp with time zone,
    closed_at timestamp with time zone,
    closed_by_id uuid,
    bot_silenced_until timestamp with time zone,
    active_ai_agent_id uuid,
    active_ai_intent text,
    active_ai_agent_set_at timestamp with time zone
);


--
-- Name: contrato_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contrato_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contrato_id uuid,
    servico_catalogo_id uuid,
    nome text NOT NULL,
    descricao text,
    quantidade numeric(10,2) DEFAULT 1 NOT NULL,
    valor_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    desconto numeric(5,2) DEFAULT 0,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    zoho_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_family text,
    revenue_nature text,
    recurring_value numeric(14,2),
    non_recurring_value numeric(14,2),
    billing_source text,
    semantic_confidence text,
    semantic_evidence jsonb,
    provenance text
);


--
-- Name: contrato_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contrato_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    commercial_model text,
    corpo_template text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_family text
);


--
-- Name: contratos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
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
    produto text,
    assinatura_legado_zoho jsonb,
    codigo_legado text,
    commercial_lifecycle text,
    current_recurring_value numeric(14,2),
    multa_percentual numeric(5,2),
    prazo_meses integer,
    semantic_confidence text,
    semantic_evidence jsonb,
    service_family text,
    assinatura_status text DEFAULT 'nao_aplicavel'::text NOT NULL,
    assinado_em timestamp with time zone,
    assinado_nome text,
    assinado_ip text,
    grupo_comercial_id uuid,
    template_id uuid,
    template_versao integer,
    variaveis_preenchidas jsonb,
    corpo_gerado text,
    documento_final_url text,
    signature_provider_ref text,
    signature_status text,
    signatarios jsonb,
    email_entrega jsonb,
    documento_publico_token_hash text,
    documento_publico_expira_em timestamp with time zone,
    signature_provider text,
    signature_enviado_em timestamp with time zone,
    signature_public_url text
);


--
-- Name: correction_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.correction_change_log (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    field text NOT NULL,
    old_value text,
    new_value text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    confidence text,
    evidence jsonb,
    source text
);


--
-- Name: correction_change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.correction_change_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.correction_change_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: correction_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.correction_runs (
    id uuid NOT NULL,
    ledger_sha256 text NOT NULL,
    mode text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    change_count integer DEFAULT 0 NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: cs_cancelamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cs_cancelamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    servico_canonico_id uuid,
    contrato_id uuid,
    status text DEFAULT 'SOLICITADO'::text NOT NULL,
    motivo text NOT NULL,
    motivo_detalhe text,
    canal text,
    solicitado_em timestamp with time zone DEFAULT now() NOT NULL,
    solicitado_por uuid,
    data_desejada date,
    contrato_vigente boolean,
    multa_aplicavel boolean,
    multa_valor numeric(14,2),
    pendencia_financeira numeric(14,2),
    equipamentos_pendentes text,
    tentativa_retencao text,
    oferta_retencao text,
    decisao text,
    decidido_em timestamp with time zone,
    decidido_por uuid,
    data_efetiva date,
    motivo_final text,
    motivo_final_detalhe text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cs_cancelamentos_status_check CHECK ((status = ANY (ARRAY['SOLICITADO'::text, 'EM_RETENCAO'::text, 'RETIDO'::text, 'APROVADO'::text, 'EFETIVADO'::text])))
);


--
-- Name: cs_marcos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cs_marcos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    servico_canonico_id uuid,
    codigo text NOT NULL,
    ciclo integer DEFAULT 1 NOT NULL,
    titulo text NOT NULL,
    objetivo text,
    due_date date NOT NULL,
    status text DEFAULT 'PENDENTE'::text NOT NULL,
    tarefa_id uuid,
    tarefa_gerada_em timestamp with time zone,
    resultado jsonb,
    concluido_em timestamp with time zone,
    concluido_por uuid,
    chave_idempotencia text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cs_marcos_codigo_check CHECK ((codigo = ANY (ARRAY['D0'::text, 'D7'::text, 'D30'::text, 'M3'::text, 'M6'::text, 'M9'::text, 'M12'::text, 'RENOVACAO'::text]))),
    CONSTRAINT cs_marcos_status_check CHECK ((status = ANY (ARRAY['PENDENTE'::text, 'CONCLUIDO'::text, 'PULADO'::text])))
);


--
-- Name: cs_renovacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cs_renovacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    servico_canonico_id uuid NOT NULL,
    contrato_id uuid,
    ciclo integer DEFAULT 1 NOT NULL,
    vencimento date NOT NULL,
    status text DEFAULT 'FUTURA'::text NOT NULL,
    janela_aberta_em timestamp with time zone,
    valor_atual numeric(14,2),
    valor_proposto numeric(14,2),
    novo_vencimento date,
    novo_prazo_meses integer,
    responsavel_id uuid,
    negocio_id uuid,
    observacoes text,
    decidido_em timestamp with time zone,
    decidido_por uuid,
    motivo_nao_renovacao text,
    chave_idempotencia text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cs_renovacoes_status_check CHECK ((status = ANY (ARRAY['FUTURA'::text, 'ABERTA'::text, 'EM_NEGOCIACAO'::text, 'RENOVADA'::text, 'NAO_RENOVADA'::text])))
);


--
-- Name: cs_riscos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cs_riscos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    servico_canonico_id uuid,
    tipo text NOT NULL,
    severidade text NOT NULL,
    origem text NOT NULL,
    motivo text NOT NULL,
    fonte text NOT NULL,
    detalhe jsonb,
    status text DEFAULT 'ABERTO'::text NOT NULL,
    responsavel_id uuid,
    aberto_em timestamp with time zone DEFAULT now() NOT NULL,
    aberto_por uuid,
    resolvido_em timestamp with time zone,
    resolvido_por uuid,
    resolucao text,
    tarefa_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cs_riscos_origem_check CHECK ((origem = ANY (ARRAY['AUTOMATICO'::text, 'MANUAL'::text]))),
    CONSTRAINT cs_riscos_severidade_check CHECK ((severidade = ANY (ARRAY['ATENCAO'::text, 'EM_RISCO'::text, 'CRITICO'::text]))),
    CONSTRAINT cs_riscos_status_check CHECK ((status = ANY (ARRAY['ABERTO'::text, 'RESOLVIDO'::text])))
);


--
-- Name: servicos_canonicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicos_canonicos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid,
    lead_id uuid,
    contrato_id uuid,
    canonical_key text NOT NULL,
    service_family text NOT NULL,
    canonical_product text,
    revenue_nature text NOT NULL,
    billing_source text NOT NULL,
    commercial_lifecycle text NOT NULL,
    billing_status text NOT NULL,
    current_recurring_value numeric(14,2) DEFAULT 0 NOT NULL,
    current_subscription_id text,
    as_of_date date,
    portfolio_included boolean DEFAULT false NOT NULL,
    confidence text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_servicos_canonicos_confidence CHECK ((confidence = ANY (ARRAY['CONFIRMED'::text, 'PROBABLE'::text, 'AMBIGUOUS'::text, 'UNRESOLVED'::text]))),
    CONSTRAINT ck_servicos_canonicos_family CHECK ((service_family = ANY (ARRAY['PABX'::text, 'CALLFACE_AI'::text, 'WHITE_LABEL'::text, 'UNKNOWN'::text]))),
    CONSTRAINT ck_servicos_canonicos_nature CHECK ((revenue_nature = ANY (ARRAY['MRR'::text, 'SETUP'::text, 'PROJECT'::text, 'ONE_TIME'::text, 'USAGE'::text, 'HARDWARE'::text, 'UNKNOWN'::text]))),
    CONSTRAINT ck_servicos_canonicos_non_mrr_zero CHECK (((revenue_nature = 'MRR'::text) OR (current_recurring_value = (0)::numeric))),
    CONSTRAINT ck_servicos_canonicos_nonnegative CHECK ((current_recurring_value >= (0)::numeric)),
    CONSTRAINT servicos_canonicos_check CHECK (((revenue_nature = 'MRR'::text) OR (current_recurring_value = (0)::numeric))),
    CONSTRAINT servicos_canonicos_confidence_check CHECK ((confidence = ANY (ARRAY['CONFIRMED'::text, 'PROBABLE'::text, 'AMBIGUOUS'::text, 'UNRESOLVED'::text]))),
    CONSTRAINT servicos_canonicos_current_recurring_value_check CHECK ((current_recurring_value >= (0)::numeric)),
    CONSTRAINT servicos_canonicos_revenue_nature_check CHECK ((revenue_nature = ANY (ARRAY['MRR'::text, 'SETUP'::text, 'PROJECT'::text, 'ONE_TIME'::text, 'USAGE'::text, 'HARDWARE'::text, 'UNKNOWN'::text]))),
    CONSTRAINT servicos_canonicos_service_family_check CHECK ((service_family = ANY (ARRAY['PABX'::text, 'CALLFACE_AI'::text, 'WHITE_LABEL'::text, 'UNKNOWN'::text])))
);


--
-- Name: current_service_portfolio; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.current_service_portfolio AS
 SELECT organizacao_id,
    service_family,
    billing_source,
    billing_status,
    confidence,
    count(*) AS service_count,
    sum(current_recurring_value) AS current_mrr,
    max(as_of_date) AS as_of_date
   FROM public.servicos_canonicos
  WHERE ((portfolio_included = true) AND (revenue_nature = 'MRR'::text) AND (commercial_lifecycle = 'ACTIVE'::text))
  GROUP BY organizacao_id, service_family, billing_source, billing_status, confidence;


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
-- Name: documentos_atendimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_atendimento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    titulo text NOT NULL,
    categoria text NOT NULL,
    familia text,
    arquivo_url text NOT NULL,
    descricao text,
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
    stripe_customer_id text,
    canonical_empresa_id uuid,
    identity_confidence text,
    identity_evidence jsonb,
    tags text[] DEFAULT '{}'::text[],
    razao_social text,
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    dominio text
);


--
-- Name: entity_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    label_id uuid NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_entity_labels_type CHECK ((entity_type = ANY (ARRAY['lead'::text, 'negocio'::text, 'oportunidade'::text, 'cliente'::text, 'empresa'::text, 'contato'::text, 'servico'::text])))
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_started_at timestamp with time zone
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
-- Name: eventos_comerciais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos_comerciais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    negocio_id uuid,
    negocio_origem_id uuid,
    contrato_id uuid,
    tipo text NOT NULL,
    zoho_id text,
    confianca text DEFAULT 'confirmado'::text NOT NULL,
    evidencia jsonb,
    responsavel_id uuid,
    ocorrido_em timestamp with time zone NOT NULL,
    origem text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    servico_id uuid
);


--
-- Name: fatura_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fatura_itens (
    id uuid NOT NULL,
    fatura_id uuid NOT NULL,
    servico_catalogo_id uuid,
    nome text NOT NULL,
    descricao text,
    quantidade numeric(14,2) DEFAULT 1 NOT NULL,
    valor_unitario numeric(14,2) DEFAULT 0 NOT NULL,
    desconto numeric(14,2) DEFAULT 0 NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    moeda text DEFAULT 'BRL'::text NOT NULL,
    zoho_id text,
    provenance text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    servico_id uuid
);


--
-- Name: faturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
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
    acionado_por uuid,
    receivable_state text,
    semantic_confidence text,
    semantic_evidence jsonb,
    negocio_id uuid,
    grupo_comercial_id uuid,
    servico_canonico_id uuid
);


--
-- Name: fulfillment_formularios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillment_formularios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    fulfillment_id uuid NOT NULL,
    status text DEFAULT 'NOT_SENT'::text NOT NULL,
    respostas jsonb DEFAULT '{}'::jsonb NOT NULL,
    enviado_em timestamp with time zone,
    submetido_em timestamp with time zone,
    revisado_por uuid,
    revisado_em timestamp with time zone,
    nota_revisao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fulfillment_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillment_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    fulfillment_id uuid NOT NULL,
    workstream text NOT NULL,
    titulo text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    blocker_type text,
    blocker_reason text,
    ordem integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    completed_at timestamp with time zone,
    completed_by uuid,
    responsavel_id uuid,
    due_date timestamp with time zone,
    priority text,
    blocked_at timestamp with time zone,
    blocker_impact text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fulfillment_linhas_portabilidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillment_linhas_portabilidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    fulfillment_id uuid NOT NULL,
    ddd text,
    numero text,
    tipo text NOT NULL,
    operadora_atual text,
    titular text,
    anexo_url text,
    anexo_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fulfillment_ramais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillment_ramais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    fulfillment_id uuid NOT NULL,
    departamento text,
    numero_externo text,
    ramal text,
    usuario text,
    email text,
    celular text,
    modelo_aparelho text,
    usa_aparelho_fisico boolean DEFAULT false NOT NULL,
    gravacao boolean DEFAULT false NOT NULL,
    ligacoes_internacionais boolean DEFAULT false NOT NULL,
    paises_permitidos text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fulfillments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    servico_canonico_id uuid NOT NULL,
    service_family text NOT NULL,
    status text DEFAULT 'NOT_STARTED'::text NOT NULL,
    responsavel_id uuid,
    started_at timestamp with time zone,
    target_at timestamp with time zone,
    completed_at timestamp with time zone,
    escopo_vendido_snapshot jsonb,
    public_token uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    meta_campaign_id text,
    canonical_lead_id uuid,
    identity_confidence text,
    identity_evidence jsonb,
    crm2_pre_vendas_stage text,
    crm2_pre_vendas_stage_fonte text,
    crm2_reuniao_realizada_em timestamp with time zone,
    crm2_cliente_convertido_em timestamp with time zone,
    crm2_no_show_em timestamp with time zone,
    crm2_migrado_em timestamp with time zone,
    estagio_pre_vendas text,
    qualificado boolean DEFAULT false NOT NULL,
    qualificado_em timestamp with time zone,
    qualificado_por uuid,
    qualificado_por_tipo text,
    qualificacao jsonb,
    qualificacao_iniciada_em timestamp with time zone,
    nutricao_motivo text,
    nutricao_retomar_em date,
    nutricao_observacao text,
    nutrido_em timestamp with time zone,
    nutrido_por uuid,
    desqualificacao_motivo text,
    desqualificacao_detalhe text,
    desqualificado_em timestamp with time zone,
    desqualificado_por uuid,
    desqualificado_de_etapa text,
    pre_qualificado boolean DEFAULT false NOT NULL,
    pre_qualificado_em timestamp with time zone,
    pre_qualificado_por uuid,
    prospeccao_estado text,
    prospeccao_descarte_motivo text,
    prospeccao_descartado_em timestamp with time zone,
    prospeccao_descartado_por uuid,
    CONSTRAINT leads_estagio_pre_vendas_check CHECK (((estagio_pre_vendas IS NULL) OR (estagio_pre_vendas = ANY (ARRAY['novo'::text, 'em_contato'::text, 'qualificacao'::text, 'qualificado'::text, 'oportunidade'::text, 'nutricao'::text, 'desqualificado'::text])))),
    CONSTRAINT leads_prospeccao_estado_check CHECK (((prospeccao_estado IS NULL) OR (prospeccao_estado = ANY (ARRAY['novo'::text, 'em_cadencia'::text, 'respondeu'::text, 'pre_qualificado'::text, 'oportunidade'::text, 'sem_resposta'::text, 'descartado'::text])))),
    CONSTRAINT leads_qualificado_por_tipo_check CHECK (((qualificado_por_tipo IS NULL) OR (qualificado_por_tipo = ANY (ARRAY['HUMAN'::text, 'AI_AGENT'::text, 'AUTOMATION'::text]))))
);


--
-- Name: legacy_provenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_provenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    entidade_tipo text NOT NULL,
    entidade_id uuid NOT NULL,
    zoho_id text NOT NULL,
    confianca text DEFAULT 'confirmado'::text NOT NULL,
    evidencia jsonb,
    recovered_at timestamp with time zone DEFAULT now() NOT NULL
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
    meta_valor_alvo numeric(12,2) DEFAULT 0 NOT NULL,
    meta_realizado numeric(12,2) DEFAULT 0 NOT NULL,
    meta_closers integer DEFAULT 0 NOT NULL,
    pipeline_total numeric(14,2) DEFAULT 0 NOT NULL,
    pipeline_ponderado numeric(14,2) DEFAULT 0 NOT NULL,
    pipeline_negocios_abertos integer DEFAULT 0 NOT NULL,
    fechado_mes_ganhos integer DEFAULT 0 NOT NULL,
    fechado_mes_receita numeric(14,2) DEFAULT 0 NOT NULL,
    fechado_mes_recorrente numeric(14,2) DEFAULT 0 NOT NULL,
    fechado_mes_avulso numeric(14,2) DEFAULT 0 NOT NULL,
    mrr_stripe numeric(14,2) DEFAULT 0 NOT NULL,
    mrr_stripe_clientes integer DEFAULT 0 NOT NULL,
    mrr_risco numeric(14,2) DEFAULT 0 NOT NULL,
    mrr_risco_qtd integer DEFAULT 0 NOT NULL,
    calculado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mrr_movimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrr_movimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid,
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    evento_comercial_id uuid
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
    origem_qualificacao text,
    service_family text,
    revenue_nature text,
    semantic_confidence text,
    semantic_evidence jsonb,
    semantic_provenance text,
    semantic_as_of_date date,
    commercial_motion text DEFAULT 'NEW_BUSINESS'::text NOT NULL,
    bundle_id uuid,
    servico_origem_id uuid,
    etapa text,
    source_process text,
    proxima_acao text,
    proxima_acao_em timestamp with time zone,
    proxima_acao_responsavel_id uuid,
    no_show_em timestamp with time zone,
    no_show_contagem integer DEFAULT 0 NOT NULL,
    trial_iniciado_em timestamp with time zone,
    trial_encerrado_em timestamp with time zone,
    motivo_perda_chave text,
    etapa_desde timestamp with time zone,
    motivo_estagnacao text,
    estagnado_em timestamp with time zone,
    CONSTRAINT negocios_etapa_check CHECK (((etapa IS NULL) OR (etapa = ANY (ARRAY['entrada'::text, 'diagnostico'::text, 'proposta'::text, 'negociacao'::text, 'ganho'::text, 'perdido'::text])))),
    CONSTRAINT negocios_motivo_estagnacao_check CHECK (((motivo_estagnacao IS NULL) OR (motivo_estagnacao = ANY (ARRAY['sem_retorno'::text, 'trava_negociacao'::text, 'trava_assinatura'::text, 'outra_data'::text])))),
    CONSTRAINT negocios_source_process_check CHECK (((source_process IS NULL) OR (source_process = ANY (ARRAY['PRE_SALES'::text, 'OUTBOUND_DIRECT'::text, 'MANUAL'::text, 'EXPANSION'::text]))))
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    autor_display_name text,
    autor_source_id text,
    conteudo_raw text,
    cliente_id uuid,
    reuniao_id uuid
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
    lead_id uuid,
    contrato_id uuid,
    score integer,
    comentario text,
    tipo text NOT NULL,
    token text,
    enviado_em timestamp with time zone,
    respondido_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    respostas jsonb,
    empresa_id uuid,
    registrado_por uuid,
    marco_id uuid
);


--
-- Name: oportunidade_bundle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oportunidade_bundle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    nome text NOT NULL,
    lead_id uuid,
    empresa_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: oportunidade_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oportunidade_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    oportunidade_id uuid NOT NULL,
    produto text,
    service_family text NOT NULL,
    revenue_nature text NOT NULL,
    quantidade numeric(10,2) DEFAULT 1 NOT NULL,
    preco_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    desconto numeric(12,2) DEFAULT 0,
    valor_total numeric(12,2) DEFAULT 0 NOT NULL,
    servico_canonico_id uuid,
    origem_legado text NOT NULL,
    contrato_item_id_legado uuid,
    proposta_item_id_legado uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    commercial_model text,
    grupo_comercial_id uuid,
    catalogo_preco_id uuid,
    stripe_product_id text,
    stripe_price_id text,
    sku_preco text
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bundle_id uuid,
    titulo text,
    service_family text,
    etapa text,
    commercial_motion text,
    source_process text,
    lead_id uuid
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
-- Name: pessoa_empresa_vinculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pessoa_empresa_vinculos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    pessoa_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    papel text DEFAULT 'contato_principal'::text NOT NULL,
    principal boolean DEFAULT false NOT NULL,
    iniciado_em timestamp with time zone DEFAULT now() NOT NULL,
    encerrado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pessoa_empresa_vinculos_papel_check CHECK ((papel = ANY (ARRAY['contato_principal'::text, 'decisor'::text, 'influenciador'::text, 'financeiro'::text, 'tecnico'::text, 'usuario'::text, 'outro'::text])))
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lead_id_legado uuid
);


--
-- Name: portfolio_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_snapshots (
    id uuid NOT NULL,
    organizacao_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    component text NOT NULL,
    value numeric(14,2) NOT NULL,
    as_of_date date,
    confidence text NOT NULL,
    evidence text,
    current_exact boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: proposta_grupo_comercial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposta_grupo_comercial (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    proposta_id uuid NOT NULL,
    negocio_id uuid,
    oportunidade_id uuid,
    commercial_model text NOT NULL,
    status text DEFAULT 'aguardando_aceite'::text NOT NULL,
    contrato_id uuid,
    checkout_id uuid,
    concluido_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    service_family text,
    contrato_assinado_em timestamp with time zone,
    entrega_liberada_em timestamp with time zone,
    entrega_liberada_por text,
    pagamento_status text,
    pagamento_vence_em timestamp with time zone,
    pagamento_confirmado_em timestamp with time zone
);


--
-- Name: proposta_grupo_comercial_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposta_grupo_comercial_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid NOT NULL,
    proposta_item_id uuid NOT NULL,
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_source text,
    non_recurring_value numeric(14,2),
    provenance text,
    recurring_value numeric(14,2),
    revenue_nature text,
    semantic_confidence text,
    semantic_evidence jsonb,
    service_family text,
    zoho_id text,
    commercial_model text NOT NULL,
    catalogo_preco_id uuid,
    stripe_product_id text,
    stripe_price_id text,
    sku_preco text,
    variacao text,
    valor_tabela numeric(12,2)
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
    enviada_em timestamp with time zone,
    proximo_passo text,
    visualizacoes integer DEFAULT 0 NOT NULL,
    primeira_visualizacao_em timestamp with time zone,
    ultima_visualizacao_em timestamp with time zone,
    cliente_respondeu_em timestamp with time zone,
    motivo_recusa text,
    signatarios jsonb,
    prazo_contrato_meses integer,
    condicao_pagamento_tipo text,
    parcelas integer DEFAULT 1,
    vencimento_dias integer,
    modo_fechamento text,
    validade_dias integer,
    ajuste_solicitado_em timestamp with time zone,
    ajuste_solicitado_descricao text,
    substituida_em timestamp with time zone,
    substituida_por_id uuid,
    aceita_em timestamp with time zone,
    recusada_em timestamp with time zone,
    expirada_em timestamp with time zone,
    tipo_contratual text,
    contrato_base_id uuid,
    service_family text,
    CONSTRAINT propostas_modo_fechamento_check CHECK (((modo_fechamento IS NULL) OR (modo_fechamento = ANY (ARRAY['PREPAID'::text, 'CONTRACT'::text])))),
    CONSTRAINT propostas_tipo_contratual_check CHECK (((tipo_contratual IS NULL) OR (tipo_contratual = ANY (ARRAY['NOVO_CONTRATO'::text, 'ADITIVO'::text, 'UPGRADE'::text, 'DOWNGRADE'::text]))))
);


--
-- Name: reconciliation_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    action_id text NOT NULL,
    table_name text NOT NULL,
    record_key text NOT NULL,
    operation text NOT NULL,
    before_state jsonb,
    after_state jsonb NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reconciliation_changes_operation_check CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DEACTIVATE'::text])))
);


--
-- Name: reconciliation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_runs (
    id uuid NOT NULL,
    organizacao_id uuid NOT NULL,
    package_version text NOT NULL,
    package_sha256 text NOT NULL,
    environment text NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    writes_inserted integer DEFAULT 0 NOT NULL,
    writes_updated integer DEFAULT 0 NOT NULL,
    writes_deactivated integer DEFAULT 0 NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT reconciliation_runs_environment_check CHECK ((environment = ANY (ARRAY['HOMOLOG'::text, 'PROD'::text]))),
    CONSTRAINT reconciliation_runs_status_check CHECK ((status = ANY (ARRAY['RUNNING'::text, 'COMPLETED'::text, 'FAILED'::text])))
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
    outlook_event_id text,
    lembrete_30min_enviado_em timestamp with time zone
);


--
-- Name: scripts_atendimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scripts_atendimento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    titulo text NOT NULL,
    categoria text NOT NULL,
    conteudo text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: service_ledger_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_ledger_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    competence date NOT NULL,
    version text NOT NULL,
    source_file text NOT NULL,
    source_sha256 text NOT NULL,
    expected_total numeric(14,2) NOT NULL,
    imported_total numeric(14,2) NOT NULL,
    row_count integer NOT NULL,
    status text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    CONSTRAINT service_ledger_batches_check CHECK (((expected_total >= (0)::numeric) AND (imported_total >= (0)::numeric))),
    CONSTRAINT service_ledger_batches_check1 CHECK (((status <> 'CLOSED'::text) OR (expected_total = imported_total))),
    CONSTRAINT service_ledger_batches_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text, 'SUPERSEDED'::text])))
);


--
-- Name: service_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    organizacao_id uuid NOT NULL,
    source_row_hash text NOT NULL,
    source_row_number integer NOT NULL,
    document text,
    company_name text NOT NULL,
    billed_value numeric(14,2) NOT NULL,
    service_family text NOT NULL,
    revenue_nature text NOT NULL,
    service_id uuid,
    confidence text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_ledger_entries_billed_value_check CHECK ((billed_value >= (0)::numeric)),
    CONSTRAINT service_ledger_entries_confidence_check CHECK ((confidence = ANY (ARRAY['CONFIRMED'::text, 'PROBABLE'::text, 'AMBIGUOUS'::text, 'UNRESOLVED'::text]))),
    CONSTRAINT service_ledger_entries_revenue_nature_check CHECK ((revenue_nature = ANY (ARRAY['MRR'::text, 'SETUP'::text, 'PROJECT'::text, 'ONE_TIME'::text, 'USAGE'::text, 'HARDWARE'::text, 'UNKNOWN'::text]))),
    CONSTRAINT service_ledger_entries_service_family_check CHECK ((service_family = ANY (ARRAY['PABX'::text, 'CALLFACE_AI'::text, 'WHITE_LABEL'::text, 'UNKNOWN'::text])))
);


--
-- Name: servico_billing_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servico_billing_timeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    empresa_id uuid,
    lead_id uuid,
    contrato_id uuid,
    assinatura_id uuid,
    provider text NOT NULL,
    external_id text NOT NULL,
    service_family text NOT NULL,
    revenue_nature text NOT NULL,
    billing_status text NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    effective_at timestamp with time zone,
    is_current boolean DEFAULT false NOT NULL,
    confidence text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    servico_id uuid
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
    stripe_product_id text,
    categoria text,
    requer_contrato boolean DEFAULT false NOT NULL,
    creates_canonical_service boolean DEFAULT true NOT NULL,
    creates_fulfillment boolean DEFAULT false NOT NULL,
    quantity_behavior text DEFAULT 'UNIT'::text NOT NULL,
    requires_payment_before_won boolean DEFAULT false NOT NULL,
    requires_signature boolean DEFAULT false NOT NULL,
    revenue_nature text DEFAULT 'UNKNOWN'::text NOT NULL,
    supports_downgrade boolean DEFAULT false NOT NULL,
    supports_proration boolean DEFAULT false NOT NULL,
    supports_upgrade boolean DEFAULT false NOT NULL,
    service_family text DEFAULT 'UNKNOWN'::text NOT NULL,
    commercial_model_padrao text DEFAULT 'PAGAMENTO_DIRETO'::text NOT NULL,
    origem_catalogo text DEFAULT 'legado'::text NOT NULL,
    sku_produto text,
    descricao_extrato text,
    etiqueta_unidade text,
    destino_pos_venda text,
    observacao_operacional text,
    catalogo_sincronizado_em timestamp with time zone
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confianca text DEFAULT 'confirmado'::text NOT NULL,
    evidencia jsonb,
    zoho_id text
);


--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_started_at timestamp with time zone,
    processed_at timestamp with time zone,
    organizacao_id uuid,
    api_version text,
    livemode boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tarefas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarefas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
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
    vence_em timestamp with time zone,
    empresa_id uuid,
    servico_canonico_id uuid,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    motivo text,
    chave_idempotencia text,
    status text DEFAULT 'a_fazer'::text NOT NULL,
    CONSTRAINT tarefas_status_check CHECK ((status = ANY (ARRAY['a_fazer'::text, 'em_andamento'::text, 'aguardando'::text, 'concluida'::text, 'declinada'::text])))
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
-- Name: vendas_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendas_eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacao_id uuid NOT NULL,
    tipo text NOT NULL,
    lead_id uuid,
    negocio_id uuid,
    empresa_id uuid,
    pessoa_id uuid,
    proposta_id uuid,
    reuniao_id uuid,
    usuario_id uuid,
    ator_tipo text DEFAULT 'HUMAN'::text NOT NULL,
    ator_ref text,
    contexto jsonb,
    ocorrido_em timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vendas_eventos_ator_tipo_check CHECK ((ator_tipo = ANY (ARRAY['HUMAN'::text, 'AI_AGENT'::text, 'AUTOMATION'::text, 'SYSTEM'::text]))),
    CONSTRAINT vendas_eventos_entidade_check CHECK (((lead_id IS NOT NULL) OR (negocio_id IS NOT NULL) OR (empresa_id IS NOT NULL) OR (pessoa_id IS NOT NULL) OR (proposta_id IS NOT NULL)))
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    required_combinations jsonb
);


--
-- Name: _carga_contagem_antes _carga_contagem_antes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._carga_contagem_antes
    ADD CONSTRAINT _carga_contagem_antes_pkey PRIMARY KEY (tabela);


--
-- Name: _migracoes_aplicadas _migracoes_aplicadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migracoes_aplicadas
    ADD CONSTRAINT _migracoes_aplicadas_pkey PRIMARY KEY (nome);


--
-- Name: ai_agent_run_steps ai_agent_run_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_run_steps
    ADD CONSTRAINT ai_agent_run_steps_pkey PRIMARY KEY (id);


--
-- Name: ai_agent_runs ai_agent_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_pkey PRIMARY KEY (id);


--
-- Name: ai_agent_versions ai_agent_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_versions
    ADD CONSTRAINT ai_agent_versions_pkey PRIMARY KEY (id);


--
-- Name: ai_agents ai_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_pkey PRIMARY KEY (id);


--
-- Name: ai_alerts ai_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_alerts
    ADD CONSTRAINT ai_alerts_pkey PRIMARY KEY (id);


--
-- Name: ai_analysis ai_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis
    ADD CONSTRAINT ai_analysis_pkey PRIMARY KEY (id);


--
-- Name: ai_case_events ai_case_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_case_events
    ADD CONSTRAINT ai_case_events_pkey PRIMARY KEY (id);


--
-- Name: ai_cases ai_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cases
    ADD CONSTRAINT ai_cases_pkey PRIMARY KEY (id);


--
-- Name: ai_contact_field_proposals ai_contact_field_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_contact_field_proposals
    ADD CONSTRAINT ai_contact_field_proposals_pkey PRIMARY KEY (id);


--
-- Name: ai_improvement_proposals ai_improvement_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_improvement_proposals
    ADD CONSTRAINT ai_improvement_proposals_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_searches ai_knowledge_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_searches
    ADD CONSTRAINT ai_knowledge_searches_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_sources ai_knowledge_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_sources
    ADD CONSTRAINT ai_knowledge_sources_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_versions ai_knowledge_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_versions
    ADD CONSTRAINT ai_knowledge_versions_pkey PRIMARY KEY (id);


--
-- Name: ai_memory_entries ai_memory_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_entries
    ADD CONSTRAINT ai_memory_entries_pkey PRIMARY KEY (id);


--
-- Name: ai_memory_pointers ai_memory_pointers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_pointers
    ADD CONSTRAINT ai_memory_pointers_pkey PRIMARY KEY (organizacao_id);


--
-- Name: ai_memory_versions ai_memory_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_versions
    ADD CONSTRAINT ai_memory_versions_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_provider_credentials ai_provider_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_pkey PRIMARY KEY (id);


--
-- Name: ai_purpose_bindings ai_purpose_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_purpose_bindings
    ADD CONSTRAINT ai_purpose_bindings_pkey PRIMARY KEY (id);


--
-- Name: ai_router_decisions ai_router_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_decisions
    ADD CONSTRAINT ai_router_decisions_pkey PRIMARY KEY (id);


--
-- Name: ai_router_members ai_router_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_members
    ADD CONSTRAINT ai_router_members_pkey PRIMARY KEY (id);


--
-- Name: ai_routers ai_routers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_routers
    ADD CONSTRAINT ai_routers_pkey PRIMARY KEY (id);


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
-- Name: ai_send_ledger ai_send_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_send_ledger
    ADD CONSTRAINT ai_send_ledger_pkey PRIMARY KEY (id);


--
-- Name: ai_skill_activations ai_skill_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_activations
    ADD CONSTRAINT ai_skill_activations_pkey PRIMARY KEY (id);


--
-- Name: ai_skill_pointers ai_skill_pointers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_pointers
    ADD CONSTRAINT ai_skill_pointers_pkey PRIMARY KEY (id);


--
-- Name: ai_skill_versions ai_skill_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_versions
    ADD CONSTRAINT ai_skill_versions_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_budgets ai_usage_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_budgets
    ADD CONSTRAINT ai_usage_budgets_pkey PRIMARY KEY (id);


--
-- Name: anexos_legado anexos_legado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos_legado
    ADD CONSTRAINT anexos_legado_pkey PRIMARY KEY (id);


--
-- Name: anexos anexos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos
    ADD CONSTRAINT anexos_pkey PRIMARY KEY (id);


--
-- Name: assinatura_itens assinatura_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinatura_itens
    ADD CONSTRAINT assinatura_itens_pkey PRIMARY KEY (id);


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
-- Name: billing_audit_runs billing_audit_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_audit_runs
    ADD CONSTRAINT billing_audit_runs_pkey PRIMARY KEY (id);


--
-- Name: billing_correction_ledger billing_correction_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_correction_ledger
    ADD CONSTRAINT billing_correction_ledger_pkey PRIMARY KEY (id);


--
-- Name: billing_customer_aliases billing_customer_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customer_aliases
    ADD CONSTRAINT billing_customer_aliases_pkey PRIMARY KEY (id);


--
-- Name: billing_customer_aliases billing_customer_aliases_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customer_aliases
    ADD CONSTRAINT billing_customer_aliases_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: billing_identities billing_identities_organizacao_id_provider_external_custome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_identities
    ADD CONSTRAINT billing_identities_organizacao_id_provider_external_custome_key UNIQUE (organizacao_id, provider, external_customer_id, canonical_lead_id);


--
-- Name: billing_identities billing_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_identities
    ADD CONSTRAINT billing_identities_pkey PRIMARY KEY (id);


--
-- Name: billing_resolution_cases billing_resolution_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_resolution_cases
    ADD CONSTRAINT billing_resolution_cases_pkey PRIMARY KEY (id);


--
-- Name: buscas_salvas buscas_salvas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buscas_salvas
    ADD CONSTRAINT buscas_salvas_pkey PRIMARY KEY (id);


--
-- Name: cadence_definition_pointers cadence_definition_pointers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definition_pointers
    ADD CONSTRAINT cadence_definition_pointers_pkey PRIMARY KEY (cadence_definition_id);


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
-- Name: cadence_versions cadence_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_versions
    ADD CONSTRAINT cadence_versions_pkey PRIMARY KEY (id);


--
-- Name: cadencia_execucoes cadencia_execucoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadencia_execucoes
    ADD CONSTRAINT cadencia_execucoes_pkey PRIMARY KEY (id);


--
-- Name: callface_ai_external_identities callface_ai_external_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.callface_ai_external_identities
    ADD CONSTRAINT callface_ai_external_identities_pkey PRIMARY KEY (id);


--
-- Name: callface_ai_reconciliation_candidates callface_ai_reconciliation_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.callface_ai_reconciliation_candidates
    ADD CONSTRAINT callface_ai_reconciliation_candidates_pkey PRIMARY KEY (id);


--
-- Name: callface_ai_tenant_snapshots callface_ai_tenant_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.callface_ai_tenant_snapshots
    ADD CONSTRAINT callface_ai_tenant_snapshots_pkey PRIMARY KEY (id);


--
-- Name: callface_ai_usage_events callface_ai_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.callface_ai_usage_events
    ADD CONSTRAINT callface_ai_usage_events_pkey PRIMARY KEY (id);


--
-- Name: campanhas campanhas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanhas
    ADD CONSTRAINT campanhas_pkey PRIMARY KEY (id);


--
-- Name: catalogo_mapeamentos_legacy catalogo_mapeamentos_legacy_organizacao_id_legacy_product_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_mapeamentos_legacy
    ADD CONSTRAINT catalogo_mapeamentos_legacy_organizacao_id_legacy_product_i_key UNIQUE (organizacao_id, legacy_product_id);


--
-- Name: catalogo_mapeamentos_legacy catalogo_mapeamentos_legacy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_mapeamentos_legacy
    ADD CONSTRAINT catalogo_mapeamentos_legacy_pkey PRIMARY KEY (id);


--
-- Name: catalogo_precos catalogo_precos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_precos
    ADD CONSTRAINT catalogo_precos_pkey PRIMARY KEY (id);


--
-- Name: checkouts checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_pkey PRIMARY KEY (id);


--
-- Name: cliente_receita_mensal cliente_receita_mensal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_receita_mensal
    ADD CONSTRAINT cliente_receita_mensal_pkey PRIMARY KEY (id);


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
-- Name: comercial_evidencia comercial_evidencia_negocio_id_tipo_source_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_negocio_id_tipo_source_ref_key UNIQUE (negocio_id, tipo, source_ref);


--
-- Name: comercial_evidencia comercial_evidencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_pkey PRIMARY KEY (id);


--
-- Name: communications communications_canal_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_canal_external_id_key UNIQUE (canal, external_id);


--
-- Name: communications communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pkey PRIMARY KEY (id);


--
-- Name: contato_labels contato_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_labels
    ADD CONSTRAINT contato_labels_pkey PRIMARY KEY (id);


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
-- Name: contrato_itens contrato_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contrato_itens
    ADD CONSTRAINT contrato_itens_pkey PRIMARY KEY (id);


--
-- Name: contrato_templates contrato_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contrato_templates
    ADD CONSTRAINT contrato_templates_pkey PRIMARY KEY (id);


--
-- Name: contratos contratos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);


--
-- Name: correction_change_log correction_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correction_change_log
    ADD CONSTRAINT correction_change_log_pkey PRIMARY KEY (id);


--
-- Name: correction_runs correction_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correction_runs
    ADD CONSTRAINT correction_runs_pkey PRIMARY KEY (id);


--
-- Name: cs_cancelamentos cs_cancelamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_cancelamentos
    ADD CONSTRAINT cs_cancelamentos_pkey PRIMARY KEY (id);


--
-- Name: cs_marcos cs_marcos_organizacao_id_chave_idempotencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_marcos
    ADD CONSTRAINT cs_marcos_organizacao_id_chave_idempotencia_key UNIQUE (organizacao_id, chave_idempotencia);


--
-- Name: cs_marcos cs_marcos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_marcos
    ADD CONSTRAINT cs_marcos_pkey PRIMARY KEY (id);


--
-- Name: cs_renovacoes cs_renovacoes_organizacao_id_chave_idempotencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_organizacao_id_chave_idempotencia_key UNIQUE (organizacao_id, chave_idempotencia);


--
-- Name: cs_renovacoes cs_renovacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_pkey PRIMARY KEY (id);


--
-- Name: cs_riscos cs_riscos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: documentos_atendimento documentos_atendimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_atendimento
    ADD CONSTRAINT documentos_atendimento_pkey PRIMARY KEY (id);


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
-- Name: entity_labels entity_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_labels
    ADD CONSTRAINT entity_labels_pkey PRIMARY KEY (id);


--
-- Name: event_outbox event_outbox_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: event_outbox event_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_pkey PRIMARY KEY (id);


--
-- Name: eventos_comerciais eventos_comerciais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_comerciais
    ADD CONSTRAINT eventos_comerciais_pkey PRIMARY KEY (id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: fatura_itens fatura_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatura_itens
    ADD CONSTRAINT fatura_itens_pkey PRIMARY KEY (id);


--
-- Name: faturas faturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_formularios fulfillment_formularios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_formularios
    ADD CONSTRAINT fulfillment_formularios_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_itens fulfillment_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_itens
    ADD CONSTRAINT fulfillment_itens_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_linhas_portabilidade fulfillment_linhas_portabilidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_linhas_portabilidade
    ADD CONSTRAINT fulfillment_linhas_portabilidade_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_ramais fulfillment_ramais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_ramais
    ADD CONSTRAINT fulfillment_ramais_pkey PRIMARY KEY (id);


--
-- Name: fulfillments fulfillments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillments
    ADD CONSTRAINT fulfillments_pkey PRIMARY KEY (id);


--
-- Name: ai_agent_versions idx_ai_agent_versions_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_versions
    ADD CONSTRAINT idx_ai_agent_versions_number UNIQUE (agent_id, versao);


--
-- Name: ai_agents idx_ai_agents_org_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT idx_ai_agents_org_slug UNIQUE (organizacao_id, slug);


--
-- Name: contato_labels idx_contato_labels_dedup; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_labels
    ADD CONSTRAINT idx_contato_labels_dedup UNIQUE (contato_id, label_id);


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
-- Name: legacy_provenance legacy_provenance_organizacao_id_entidade_tipo_zoho_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_provenance
    ADD CONSTRAINT legacy_provenance_organizacao_id_entidade_tipo_zoho_id_key UNIQUE (organizacao_id, entidade_tipo, zoho_id);


--
-- Name: legacy_provenance legacy_provenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_provenance
    ADD CONSTRAINT legacy_provenance_pkey PRIMARY KEY (id);


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
-- Name: metricas_diarias metricas_diarias_organizacao_id_data_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metricas_diarias
    ADD CONSTRAINT metricas_diarias_organizacao_id_data_key UNIQUE (organizacao_id, data);


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
-- Name: oportunidade_bundle oportunidade_bundle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_bundle
    ADD CONSTRAINT oportunidade_bundle_pkey PRIMARY KEY (id);


--
-- Name: oportunidade_itens oportunidade_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_pkey PRIMARY KEY (id);


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
-- Name: pessoa_empresa_vinculos pessoa_empresa_vinculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoa_empresa_vinculos
    ADD CONSTRAINT pessoa_empresa_vinculos_pkey PRIMARY KEY (id);


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
-- Name: portfolio_snapshots portfolio_snapshots_organizacao_id_snapshot_date_component_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_organizacao_id_snapshot_date_component_key UNIQUE (organizacao_id, snapshot_date, component);


--
-- Name: portfolio_snapshots portfolio_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_pkey PRIMARY KEY (id);


--
-- Name: proposta_grupo_comercial_itens proposta_grupo_comercial_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial_itens
    ADD CONSTRAINT proposta_grupo_comercial_itens_pkey PRIMARY KEY (id);


--
-- Name: proposta_grupo_comercial proposta_grupo_comercial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial
    ADD CONSTRAINT proposta_grupo_comercial_pkey PRIMARY KEY (id);


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
-- Name: reconciliation_changes reconciliation_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_changes
    ADD CONSTRAINT reconciliation_changes_pkey PRIMARY KEY (id);


--
-- Name: reconciliation_changes reconciliation_changes_run_id_action_id_table_name_record_k_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_changes
    ADD CONSTRAINT reconciliation_changes_run_id_action_id_table_name_record_k_key UNIQUE (run_id, action_id, table_name, record_key);


--
-- Name: reconciliation_runs reconciliation_runs_organizacao_id_package_version_package__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_runs
    ADD CONSTRAINT reconciliation_runs_organizacao_id_package_version_package__key UNIQUE (organizacao_id, package_version, package_sha256);


--
-- Name: reconciliation_runs reconciliation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_runs
    ADD CONSTRAINT reconciliation_runs_pkey PRIMARY KEY (id);


--
-- Name: reunioes reunioes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reunioes
    ADD CONSTRAINT reunioes_pkey PRIMARY KEY (id);


--
-- Name: scripts_atendimento scripts_atendimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scripts_atendimento
    ADD CONSTRAINT scripts_atendimento_pkey PRIMARY KEY (id);


--
-- Name: sdr_memory sdr_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sdr_memory
    ADD CONSTRAINT sdr_memory_pkey PRIMARY KEY (id);


--
-- Name: service_ledger_batches service_ledger_batches_organizacao_id_competence_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_batches
    ADD CONSTRAINT service_ledger_batches_organizacao_id_competence_version_key UNIQUE (organizacao_id, competence, version);


--
-- Name: service_ledger_batches service_ledger_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_batches
    ADD CONSTRAINT service_ledger_batches_pkey PRIMARY KEY (id);


--
-- Name: service_ledger_entries service_ledger_entries_batch_id_source_row_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_entries
    ADD CONSTRAINT service_ledger_entries_batch_id_source_row_hash_key UNIQUE (batch_id, source_row_hash);


--
-- Name: service_ledger_entries service_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_entries
    ADD CONSTRAINT service_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: servico_billing_timeline servico_billing_timeline_organizacao_id_provider_external_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_organizacao_id_provider_external_i_key UNIQUE (organizacao_id, provider, external_id);


--
-- Name: servico_billing_timeline servico_billing_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_pkey PRIMARY KEY (id);


--
-- Name: servicos_canonicos servicos_canonicos_organizacao_id_canonical_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_canonicos
    ADD CONSTRAINT servicos_canonicos_organizacao_id_canonical_key_key UNIQUE (organizacao_id, canonical_key);


--
-- Name: servicos_canonicos servicos_canonicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_canonicos
    ADD CONSTRAINT servicos_canonicos_pkey PRIMARY KEY (id);


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
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: stripe_webhook_events stripe_webhook_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_stripe_event_id_key UNIQUE (event_id);


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
-- Name: ai_agent_run_steps uq_ai_agent_run_steps_sequence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_run_steps
    ADD CONSTRAINT uq_ai_agent_run_steps_sequence UNIQUE (run_id, sequence);


--
-- Name: ai_knowledge_chunks uq_ai_knowledge_chunks_version_sequence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT uq_ai_knowledge_chunks_version_sequence UNIQUE (version_id, sequence);


--
-- Name: ai_knowledge_versions uq_ai_knowledge_versions_source_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_versions
    ADD CONSTRAINT uq_ai_knowledge_versions_source_number UNIQUE (source_id, version_number);


--
-- Name: ai_memory_versions uq_ai_memory_versions_org_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_versions
    ADD CONSTRAINT uq_ai_memory_versions_org_number UNIQUE (organizacao_id, version_number);


--
-- Name: ai_models uq_ai_models_provider_model; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT uq_ai_models_provider_model UNIQUE (provider, model_id);


--
-- Name: ai_provider_credentials uq_ai_provider_credentials_org_provider_label; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_credentials
    ADD CONSTRAINT uq_ai_provider_credentials_org_provider_label UNIQUE (organizacao_id, provider, label);


--
-- Name: ai_purpose_bindings uq_ai_purpose_bindings_org_purpose; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_purpose_bindings
    ADD CONSTRAINT uq_ai_purpose_bindings_org_purpose UNIQUE (organizacao_id, purpose);


--
-- Name: ai_router_members uq_ai_router_members_intent; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_members
    ADD CONSTRAINT uq_ai_router_members_intent UNIQUE (router_id, intent_name);


--
-- Name: ai_send_ledger uq_ai_send_ledger_run_sequence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_send_ledger
    ADD CONSTRAINT uq_ai_send_ledger_run_sequence UNIQUE (run_id, sequence);


--
-- Name: ai_skill_pointers uq_ai_skill_pointers_org_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_pointers
    ADD CONSTRAINT uq_ai_skill_pointers_org_name UNIQUE (organizacao_id, name);


--
-- Name: ai_skill_versions uq_ai_skill_versions_org_name_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_versions
    ADD CONSTRAINT uq_ai_skill_versions_org_name_number UNIQUE NULLS NOT DISTINCT (organizacao_id, name, version_number);


--
-- Name: cadence_versions uq_cadence_versions_definition_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_versions
    ADD CONSTRAINT uq_cadence_versions_definition_number UNIQUE (cadence_definition_id, version_number);


--
-- Name: entity_labels uq_entity_labels_entity_label; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_labels
    ADD CONSTRAINT uq_entity_labels_entity_label UNIQUE (organizacao_id, entity_type, entity_id, label_id);


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
-- Name: vendas_eventos vendas_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_pkey PRIMARY KEY (id);


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
-- Name: idx_ai_agent_run_steps_org_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_run_steps_org_started ON public.ai_agent_run_steps USING btree (organizacao_id, started_at);


--
-- Name: idx_ai_agent_runs_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_runs_agent ON public.ai_agent_runs USING btree (agent_id, started_at);


--
-- Name: idx_ai_agent_runs_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_runs_contato ON public.ai_agent_runs USING btree (contato_id, started_at);


--
-- Name: idx_ai_agent_runs_org_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_runs_org_started ON public.ai_agent_runs USING btree (organizacao_id, started_at);


--
-- Name: idx_ai_agent_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agent_versions_status ON public.ai_agent_versions USING btree (agent_id, status);


--
-- Name: idx_ai_agents_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_agents_org_status ON public.ai_agents USING btree (organizacao_id, status);


--
-- Name: idx_ai_alerts_org_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_alerts_org_status_created ON public.ai_alerts USING btree (organizacao_id, status, created_at);


--
-- Name: idx_ai_analysis_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_analysis_entity ON public.ai_analysis USING btree (entity_type, entity_id);


--
-- Name: idx_ai_analysis_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_analysis_org ON public.ai_analysis USING btree (organizacao_id);


--
-- Name: idx_ai_case_events_case_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_case_events_case_created ON public.ai_case_events USING btree (case_id, created_at);


--
-- Name: idx_ai_cases_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_cases_contato ON public.ai_cases USING btree (organizacao_id, contato_id);


--
-- Name: idx_ai_cases_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_cases_org_status ON public.ai_cases USING btree (organizacao_id, status);


--
-- Name: idx_ai_contact_field_proposals_expiring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_contact_field_proposals_expiring ON public.ai_contact_field_proposals USING btree (organizacao_id, expires_at);


--
-- Name: idx_ai_improvement_proposals_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_improvement_proposals_org_status ON public.ai_improvement_proposals USING btree (organizacao_id, status, created_at);


--
-- Name: idx_ai_knowledge_chunks_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_knowledge_chunks_org ON public.ai_knowledge_chunks USING btree (organizacao_id);


--
-- Name: idx_ai_knowledge_searches_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_knowledge_searches_org_created ON public.ai_knowledge_searches USING btree (organizacao_id, created_at);


--
-- Name: idx_ai_knowledge_sources_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_knowledge_sources_org_status ON public.ai_knowledge_sources USING btree (organizacao_id, status);


--
-- Name: idx_ai_knowledge_versions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_knowledge_versions_org ON public.ai_knowledge_versions USING btree (organizacao_id);


--
-- Name: idx_ai_memory_entries_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_memory_entries_org_status ON public.ai_memory_entries USING btree (organizacao_id, status, created_at);


--
-- Name: idx_ai_models_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_provider ON public.ai_models USING btree (provider);


--
-- Name: idx_ai_provider_credentials_org_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_provider_credentials_org_provider ON public.ai_provider_credentials USING btree (organizacao_id, provider);


--
-- Name: idx_ai_purpose_bindings_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_purpose_bindings_credential ON public.ai_purpose_bindings USING btree (credential_id);


--
-- Name: idx_ai_router_decisions_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_router_decisions_org_created ON public.ai_router_decisions USING btree (organizacao_id, created_at);


--
-- Name: idx_ai_router_decisions_router_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_router_decisions_router_created ON public.ai_router_decisions USING btree (router_id, created_at);


--
-- Name: idx_ai_router_members_router_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_router_members_router_position ON public.ai_router_members USING btree (router_id, "position");


--
-- Name: idx_ai_routers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_routers_org ON public.ai_routers USING btree (organizacao_id);


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
-- Name: idx_ai_send_ledger_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_send_ledger_org_created ON public.ai_send_ledger USING btree (organizacao_id, created_at);


--
-- Name: idx_ai_skill_activations_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_skill_activations_org_created ON public.ai_skill_activations USING btree (organizacao_id, created_at);


--
-- Name: idx_ai_skill_versions_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_skill_versions_name ON public.ai_skill_versions USING btree (name);


--
-- Name: idx_ai_usage_budgets_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_budgets_agent ON public.ai_usage_budgets USING btree (agent_id);


--
-- Name: idx_ai_usage_budgets_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_budgets_org ON public.ai_usage_budgets USING btree (organizacao_id);


--
-- Name: idx_anexos_legado_entidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anexos_legado_entidade ON public.anexos_legado USING btree (entidade_tipo, entidade_id);


--
-- Name: idx_anexos_legado_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anexos_legado_org ON public.anexos_legado USING btree (organizacao_id);


--
-- Name: idx_anexos_legado_zoho_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_anexos_legado_zoho_dedup ON public.anexos_legado USING btree (organizacao_id, zoho_id) WHERE (zoho_id IS NOT NULL);


--
-- Name: idx_anexos_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anexos_negocio ON public.anexos USING btree (negocio_id);


--
-- Name: idx_anexos_nota; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anexos_nota ON public.anexos USING btree (nota_id);


--
-- Name: idx_anexos_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anexos_org ON public.anexos USING btree (organizacao_id);


--
-- Name: idx_assinatura_itens_assinatura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinatura_itens_assinatura ON public.assinatura_itens USING btree (assinatura_id);


--
-- Name: idx_assinatura_itens_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinatura_itens_org ON public.assinatura_itens USING btree (organizacao_id);


--
-- Name: idx_assinatura_itens_stripe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_assinatura_itens_stripe_id ON public.assinatura_itens USING btree (stripe_subscription_item_id) WHERE (stripe_subscription_item_id IS NOT NULL);


--
-- Name: idx_assinaturas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_empresa ON public.assinaturas USING btree (empresa_id);


--
-- Name: idx_assinaturas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_org ON public.assinaturas USING btree (organizacao_id);


--
-- Name: idx_assinaturas_servico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_servico_id ON public.assinaturas USING btree (servico_id);


--
-- Name: idx_assinaturas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assinaturas_status ON public.assinaturas USING btree (status);


--
-- Name: idx_assinaturas_stripe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_assinaturas_stripe_id ON public.assinaturas USING btree (stripe_subscription_id);


--
-- Name: idx_atividades_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atividades_empresa ON public.atividades USING btree (empresa_id) WHERE (empresa_id IS NOT NULL);


--
-- Name: idx_atividades_lead_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atividades_lead_created ON public.atividades USING btree (lead_id, created_at DESC);


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

CREATE INDEX idx_audit_log_org ON public.audit_log USING btree (organizacao_id, created_at DESC);


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
-- Name: idx_billing_alias_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_alias_identity ON public.billing_customer_aliases USING btree (billing_identity_id);


--
-- Name: idx_billing_cases_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_cases_customer ON public.billing_resolution_cases USING btree (stripe_customer_id);


--
-- Name: idx_billing_cases_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_cases_queue ON public.billing_resolution_cases USING btree (organizacao_id, queue, status);


--
-- Name: idx_billing_identity_canonical_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_identity_canonical_customer ON public.billing_identities USING btree (organizacao_id, canonical_stripe_customer_id);


--
-- Name: idx_billing_identity_cnpj; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_identity_cnpj ON public.billing_identities USING btree (organizacao_id, cnpj_normalized) WHERE (cnpj_normalized IS NOT NULL);


--
-- Name: idx_billing_identity_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_identity_email ON public.billing_identities USING btree (organizacao_id, primary_email_normalized) WHERE (primary_email_normalized IS NOT NULL);


--
-- Name: idx_billing_identity_empresa_v2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_identity_empresa_v2 ON public.billing_identities USING btree (organizacao_id, empresa_id);


--
-- Name: idx_billing_ledger_audit_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_ledger_audit_run ON public.billing_correction_ledger USING btree (audit_run_id, created_at);


--
-- Name: idx_billing_ledger_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_ledger_entity ON public.billing_correction_ledger USING btree (entity_type, entity_id);


--
-- Name: idx_buscas_salvas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buscas_salvas_org ON public.buscas_salvas USING btree (organizacao_id);


--
-- Name: idx_cadence_definition_pointers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_definition_pointers_org ON public.cadence_definition_pointers USING btree (organizacao_id);


--
-- Name: idx_cadence_enrollment_events_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_enrollment_events_enrollment ON public.cadence_enrollment_events USING btree (enrollment_id);


--
-- Name: idx_cadence_enrollments_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_enrollments_due ON public.cadence_enrollments USING btree (status, next_eval_at, claimed_until);


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
-- Name: idx_cadence_versions_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadence_versions_org_status ON public.cadence_versions USING btree (organizacao_id, status);


--
-- Name: idx_cadencia_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadencia_lead ON public.cadencia_execucoes USING btree (lead_id);


--
-- Name: idx_cadencia_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cadencia_org ON public.cadencia_execucoes USING btree (organizacao_id);


--
-- Name: idx_callface_ai_ext_ident_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_callface_ai_ext_ident_entity ON public.callface_ai_external_identities USING btree (entity_type, entity_id);


--
-- Name: idx_callface_ai_ext_ident_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_callface_ai_ext_ident_unique ON public.callface_ai_external_identities USING btree (provider, external_type, external_id);


--
-- Name: idx_callface_ai_recon_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_callface_ai_recon_empresa ON public.callface_ai_reconciliation_candidates USING btree (empresa_id);


--
-- Name: idx_callface_ai_recon_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_callface_ai_recon_status ON public.callface_ai_reconciliation_candidates USING btree (status);


--
-- Name: idx_callface_ai_snapshots_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_callface_ai_snapshots_identity ON public.callface_ai_tenant_snapshots USING btree (external_identity_id, snapshot_at);


--
-- Name: idx_callface_ai_usage_events_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_callface_ai_usage_events_identity ON public.callface_ai_usage_events USING btree (external_identity_id, occurred_at);


--
-- Name: idx_callface_ai_usage_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_callface_ai_usage_events_type ON public.callface_ai_usage_events USING btree (event_type);


--
-- Name: idx_catalogo_mapeamentos_legacy_familia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_mapeamentos_legacy_familia ON public.catalogo_mapeamentos_legacy USING btree (organizacao_id, service_family, confidence);


--
-- Name: idx_catalogo_mapeamentos_legacy_nome_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_mapeamentos_legacy_nome_norm ON public.catalogo_mapeamentos_legacy USING btree (organizacao_id, nome_normalizado);


--
-- Name: idx_catalogo_mapeamentos_legacy_revisao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_mapeamentos_legacy_revisao ON public.catalogo_mapeamentos_legacy USING btree (organizacao_id, reviewed_status, confidence);


--
-- Name: idx_catalogo_precos_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_precos_lookup ON public.catalogo_precos USING btree (organizacao_id, lookup_key);


--
-- Name: idx_catalogo_precos_produto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_precos_produto ON public.catalogo_precos USING btree (servico_catalogo_id, ordem);


--
-- Name: idx_catalogo_precos_stripe_price; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_catalogo_precos_stripe_price ON public.catalogo_precos USING btree (organizacao_id, stripe_price_id);


--
-- Name: idx_checkouts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_org ON public.checkouts USING btree (organizacao_id);


--
-- Name: idx_checkouts_proposta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkouts_proposta ON public.checkouts USING btree (proposta_id);


--
-- Name: idx_checkouts_stripe_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_checkouts_stripe_session ON public.checkouts USING btree (stripe_session_id) WHERE (stripe_session_id IS NOT NULL);


--
-- Name: idx_cliente_receita_mensal_documento_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_receita_mensal_documento_mes ON public.cliente_receita_mensal USING btree (organizacao_id, documento, competencia);


--
-- Name: idx_cliente_receita_mensal_empresa_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_receita_mensal_empresa_mes ON public.cliente_receita_mensal USING btree (organizacao_id, empresa_id, competencia);


--
-- Name: idx_cliente_receita_mensal_familia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_receita_mensal_familia ON public.cliente_receita_mensal USING btree (organizacao_id, service_family, revenue_nature, confidence);


--
-- Name: idx_cliente_receita_mensal_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cliente_receita_mensal_source ON public.cliente_receita_mensal USING btree (organizacao_id, source_hash);


--
-- Name: idx_clientes_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_empresa ON public.clientes USING btree (empresa_id);


--
-- Name: idx_clientes_lead_legado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_clientes_lead_legado ON public.clientes USING btree (lead_id_legado);


--
-- Name: idx_clientes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_org ON public.clientes USING btree (organizacao_id);


--
-- Name: idx_clientes_org_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_clientes_org_empresa ON public.clientes USING btree (organizacao_id, empresa_id) WHERE (empresa_id IS NOT NULL);


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
-- Name: idx_contato_labels_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contato_labels_contato ON public.contato_labels USING btree (contato_id);


--
-- Name: idx_contato_labels_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contato_labels_label ON public.contato_labels USING btree (label_id);


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
-- Name: idx_contatos_status_snooze; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_status_snooze ON public.contatos USING btree (organizacao_id, status, snoozed_until);


--
-- Name: idx_contatos_ultima_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_ultima_msg ON public.contatos USING btree (responsavel_id, ultima_msg_at);


--
-- Name: idx_contrato_itens_contrato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contrato_itens_contrato ON public.contrato_itens USING btree (contrato_id);


--
-- Name: idx_contrato_itens_servico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contrato_itens_servico ON public.contrato_itens USING btree (servico_catalogo_id);


--
-- Name: idx_contrato_itens_zoho_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contrato_itens_zoho_dedup ON public.contrato_itens USING btree (zoho_id) WHERE (zoho_id IS NOT NULL);


--
-- Name: idx_contrato_templates_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contrato_templates_family ON public.contrato_templates USING btree (organizacao_id, service_family, ativo);


--
-- Name: idx_contrato_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contrato_templates_org ON public.contrato_templates USING btree (organizacao_id, ativo);


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
-- Name: idx_cs_cancelamentos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_cancelamentos_empresa ON public.cs_cancelamentos USING btree (empresa_id, status);


--
-- Name: idx_cs_cancelamentos_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_cancelamentos_org ON public.cs_cancelamentos USING btree (organizacao_id, status);


--
-- Name: idx_cs_marcos_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_marcos_due ON public.cs_marcos USING btree (organizacao_id, status, due_date);


--
-- Name: idx_cs_marcos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_marcos_empresa ON public.cs_marcos USING btree (empresa_id, status);


--
-- Name: idx_cs_renovacoes_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_renovacoes_empresa ON public.cs_renovacoes USING btree (empresa_id, status);


--
-- Name: idx_cs_renovacoes_janela; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_renovacoes_janela ON public.cs_renovacoes USING btree (organizacao_id, status, vencimento);


--
-- Name: idx_cs_riscos_aberto_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cs_riscos_aberto_unico ON public.cs_riscos USING btree (empresa_id, tipo, COALESCE(servico_canonico_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE (status = 'ABERTO'::text);


--
-- Name: idx_cs_riscos_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_riscos_org ON public.cs_riscos USING btree (organizacao_id, status, severidade);


--
-- Name: idx_custom_fields_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_org ON public.custom_fields USING btree (organizacao_id);


--
-- Name: idx_custom_fields_org_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_org_entity ON public.custom_fields USING btree (organizacao_id, entidade);


--
-- Name: idx_documentos_atendimento_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_atendimento_org ON public.documentos_atendimento USING btree (organizacao_id);


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
-- Name: idx_empresas_canonical_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_canonical_empresa_id ON public.empresas USING btree (canonical_empresa_id);


--
-- Name: idx_empresas_cnpj; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_cnpj ON public.empresas USING btree (organizacao_id, cnpj) WHERE (cnpj IS NOT NULL);


--
-- Name: idx_empresas_dominio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_dominio ON public.empresas USING btree (organizacao_id, dominio) WHERE (dominio IS NOT NULL);


--
-- Name: idx_empresas_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_nome ON public.empresas USING btree (nome);


--
-- Name: idx_empresas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_empresas_org ON public.empresas USING btree (organizacao_id);


--
-- Name: idx_entity_labels_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_labels_entity ON public.entity_labels USING btree (organizacao_id, entity_type, entity_id);


--
-- Name: idx_entity_labels_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_labels_label ON public.entity_labels USING btree (label_id);


--
-- Name: idx_event_outbox_aggregate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_outbox_aggregate ON public.event_outbox USING btree (aggregate_type, aggregate_id);


--
-- Name: idx_event_outbox_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_outbox_org ON public.event_outbox USING btree (organizacao_id);


--
-- Name: idx_event_outbox_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_outbox_status ON public.event_outbox USING btree (status);


--
-- Name: idx_eventos_comerciais_contrato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_comerciais_contrato ON public.eventos_comerciais USING btree (contrato_id);


--
-- Name: idx_eventos_comerciais_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_comerciais_negocio ON public.eventos_comerciais USING btree (negocio_id);


--
-- Name: idx_eventos_comerciais_negocio_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_comerciais_negocio_origem ON public.eventos_comerciais USING btree (negocio_origem_id);


--
-- Name: idx_eventos_comerciais_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_comerciais_org ON public.eventos_comerciais USING btree (organizacao_id);


--
-- Name: idx_eventos_comerciais_servico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_comerciais_servico_id ON public.eventos_comerciais USING btree (servico_id);


--
-- Name: idx_eventos_comerciais_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_comerciais_tipo ON public.eventos_comerciais USING btree (tipo);


--
-- Name: idx_eventos_comerciais_zoho_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_eventos_comerciais_zoho_dedup ON public.eventos_comerciais USING btree (organizacao_id, zoho_id) WHERE (zoho_id IS NOT NULL);


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
-- Name: idx_fatura_itens_servico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fatura_itens_servico_id ON public.fatura_itens USING btree (servico_id);


--
-- Name: idx_fatura_itens_zoho_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fatura_itens_zoho_id ON public.fatura_itens USING btree (zoho_id) WHERE (zoho_id IS NOT NULL);


--
-- Name: idx_faturas_acionado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_acionado ON public.faturas USING btree (acionado_cobranca);


--
-- Name: idx_faturas_competencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_competencia ON public.faturas USING btree (competencia);


--
-- Name: idx_faturas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_empresa ON public.faturas USING btree (empresa_id);


--
-- Name: idx_faturas_grupo_comercial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faturas_grupo_comercial ON public.faturas USING btree (grupo_comercial_id) WHERE (grupo_comercial_id IS NOT NULL);


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
-- Name: idx_fulfillment_formularios_fulfillment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_formularios_fulfillment ON public.fulfillment_formularios USING btree (fulfillment_id);


--
-- Name: idx_fulfillment_formularios_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_formularios_org ON public.fulfillment_formularios USING btree (organizacao_id);


--
-- Name: idx_fulfillment_itens_fulfillment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_itens_fulfillment ON public.fulfillment_itens USING btree (fulfillment_id);


--
-- Name: idx_fulfillment_itens_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_itens_org ON public.fulfillment_itens USING btree (organizacao_id);


--
-- Name: idx_fulfillment_linhas_port_fulfillment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_linhas_port_fulfillment ON public.fulfillment_linhas_portabilidade USING btree (fulfillment_id);


--
-- Name: idx_fulfillment_linhas_port_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_linhas_port_org ON public.fulfillment_linhas_portabilidade USING btree (organizacao_id);


--
-- Name: idx_fulfillment_ramais_fulfillment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_ramais_fulfillment ON public.fulfillment_ramais USING btree (fulfillment_id);


--
-- Name: idx_fulfillment_ramais_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_ramais_org ON public.fulfillment_ramais USING btree (organizacao_id);


--
-- Name: idx_fulfillments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillments_org ON public.fulfillments USING btree (organizacao_id);


--
-- Name: idx_fulfillments_public_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fulfillments_public_token ON public.fulfillments USING btree (public_token);


--
-- Name: idx_fulfillments_servico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fulfillments_servico ON public.fulfillments USING btree (servico_canonico_id);


--
-- Name: idx_fulfillments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillments_status ON public.fulfillments USING btree (organizacao_id, status);


--
-- Name: idx_grupo_comercial_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupo_comercial_negocio ON public.proposta_grupo_comercial USING btree (negocio_id);


--
-- Name: idx_grupo_comercial_pagamento_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupo_comercial_pagamento_status ON public.proposta_grupo_comercial USING btree (organizacao_id, pagamento_status) WHERE (pagamento_status IS NOT NULL);


--
-- Name: idx_grupo_comercial_proposta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupo_comercial_proposta ON public.proposta_grupo_comercial USING btree (proposta_id);


--
-- Name: idx_grupo_comercial_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupo_comercial_status ON public.proposta_grupo_comercial USING btree (organizacao_id, status);


--
-- Name: idx_grupo_itens_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupo_itens_grupo ON public.proposta_grupo_comercial_itens USING btree (grupo_id);


--
-- Name: idx_grupo_itens_proposta_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_grupo_itens_proposta_item ON public.proposta_grupo_comercial_itens USING btree (proposta_item_id);


--
-- Name: idx_labels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labels_org ON public.labels USING btree (organizacao_id);


--
-- Name: idx_lead_labels_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_lead_labels_dedup ON public.lead_labels USING btree (lead_id, label_id);


--
-- Name: idx_lead_labels_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_labels_label ON public.lead_labels USING btree (label_id);


--
-- Name: idx_lead_labels_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_labels_lead ON public.lead_labels USING btree (lead_id);


--
-- Name: idx_lead_listas_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_lead_listas_dedup ON public.lead_listas USING btree (lead_id, lista_id);


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
-- Name: idx_leads_agenda_closer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_agenda_closer ON public.leads USING btree (agenda_closer_id);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);


--
-- Name: idx_leads_crm2_pre_vendas_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_crm2_pre_vendas_stage ON public.leads USING btree (crm2_pre_vendas_stage);


--
-- Name: idx_leads_empresa_setor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_empresa_setor ON public.leads USING btree (empresa_setor);


--
-- Name: idx_leads_estagio_pre_vendas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_estagio_pre_vendas ON public.leads USING btree (organizacao_id, estagio_pre_vendas);


--
-- Name: idx_leads_gclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_gclid ON public.leads USING btree (gclid);


--
-- Name: idx_leads_nutricao_retomar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_nutricao_retomar ON public.leads USING btree (organizacao_id, nutricao_retomar_em) WHERE (nutricao_retomar_em IS NOT NULL);


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
-- Name: idx_leads_prospeccao_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_prospeccao_estado ON public.leads USING btree (organizacao_id, prospeccao_estado) WHERE (prospeccao_estado IS NOT NULL);


--
-- Name: idx_leads_qualificado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_qualificado ON public.leads USING btree (organizacao_id, qualificado) WHERE (qualificado = true);


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
-- Name: idx_leads_utm_campaign_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_utm_campaign_lookup ON public.leads USING btree (utm_campaign) WHERE (utm_campaign IS NOT NULL);


--
-- Name: idx_legacy_provenance_entidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legacy_provenance_entidade ON public.legacy_provenance USING btree (entidade_tipo, entidade_id);


--
-- Name: idx_legacy_provenance_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legacy_provenance_org ON public.legacy_provenance USING btree (organizacao_id);


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
-- Name: idx_mrr_movimentos_evento_comercial; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mrr_movimentos_evento_comercial ON public.mrr_movimentos USING btree (evento_comercial_id) WHERE (evento_comercial_id IS NOT NULL);


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
-- Name: idx_negocios_bundle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_bundle ON public.negocios USING btree (bundle_id);


--
-- Name: idx_negocios_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_empresa ON public.negocios USING btree (empresa_id);


--
-- Name: idx_negocios_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_etapa ON public.negocios USING btree (organizacao_id, etapa);


--
-- Name: idx_negocios_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_family ON public.negocios USING btree (organizacao_id, service_family);


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
-- Name: idx_negocios_proxima_acao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_proxima_acao ON public.negocios USING btree (organizacao_id, proxima_acao_em) WHERE (proxima_acao_em IS NOT NULL);


--
-- Name: idx_negocios_responsavel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_responsavel ON public.negocios USING btree (responsavel_id);


--
-- Name: idx_negocios_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_status ON public.negocios USING btree (status);


--
-- Name: idx_negocios_status_ganho_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_negocios_status_ganho_at ON public.negocios USING btree (status, ganho_at);


--
-- Name: idx_notas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_cliente ON public.notas USING btree (cliente_id);


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
-- Name: idx_notas_reuniao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_reuniao ON public.notas USING btree (reuniao_id);


--
-- Name: idx_notificacoes_lida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_lida ON public.notificacoes USING btree (lida);


--
-- Name: idx_notificacoes_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_usuario ON public.notificacoes USING btree (usuario_id);


--
-- Name: idx_nps_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nps_empresa ON public.nps_respostas USING btree (empresa_id, respondido_em DESC) WHERE (empresa_id IS NOT NULL);


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
-- Name: idx_oportunidade_bundle_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidade_bundle_lead ON public.oportunidade_bundle USING btree (lead_id);


--
-- Name: idx_oportunidade_bundle_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidade_bundle_org ON public.oportunidade_bundle USING btree (organizacao_id);


--
-- Name: idx_oportunidade_itens_contrato_legado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_oportunidade_itens_contrato_legado ON public.oportunidade_itens USING btree (contrato_item_id_legado) WHERE (contrato_item_id_legado IS NOT NULL);


--
-- Name: idx_oportunidade_itens_oportunidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidade_itens_oportunidade ON public.oportunidade_itens USING btree (oportunidade_id);


--
-- Name: idx_oportunidade_itens_proposta_legado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_oportunidade_itens_proposta_legado ON public.oportunidade_itens USING btree (proposta_item_id_legado) WHERE (proposta_item_id_legado IS NOT NULL);


--
-- Name: idx_oportunidades_bundle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_bundle ON public.oportunidades USING btree (bundle_id);


--
-- Name: idx_oportunidades_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oportunidades_empresa ON public.oportunidades USING btree (empresa_id);


--
-- Name: idx_oportunidades_negocio_legado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_oportunidades_negocio_legado ON public.oportunidades USING btree (negocio_id_legado);


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
-- Name: idx_pessoa_empresa_vinculo_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pessoa_empresa_vinculo_ativo ON public.pessoa_empresa_vinculos USING btree (pessoa_id, empresa_id) WHERE (encerrado_em IS NULL);


--
-- Name: idx_pessoa_empresa_vinculo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pessoa_empresa_vinculo_empresa ON public.pessoa_empresa_vinculos USING btree (empresa_id);


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

CREATE UNIQUE INDEX idx_pessoas_lead_legado ON public.pessoas USING btree (lead_id_legado);


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
-- Name: idx_pontos_contato_lead_legado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pontos_contato_lead_legado ON public.pontos_contato USING btree (lead_id_legado) WHERE (lead_id_legado IS NOT NULL);


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
-- Name: idx_proposta_itens_stripe_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposta_itens_stripe_price ON public.proposta_itens USING btree (stripe_price_id) WHERE (stripe_price_id IS NOT NULL);


--
-- Name: idx_propostas_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_lead ON public.propostas USING btree (lead_id);


--
-- Name: idx_propostas_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_negocio ON public.propostas USING btree (negocio_id) WHERE (negocio_id IS NOT NULL);


--
-- Name: idx_propostas_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_numero ON public.propostas USING btree (organizacao_id, numero);


--
-- Name: idx_propostas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_org ON public.propostas USING btree (organizacao_id);


--
-- Name: idx_propostas_signatarios; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propostas_signatarios ON public.propostas USING gin (signatarios);


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
-- Name: idx_scripts_atendimento_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scripts_atendimento_org ON public.scripts_atendimento USING btree (organizacao_id);


--
-- Name: idx_sdr_memory_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sdr_memory_org ON public.sdr_memory USING btree (organizacao_id);


--
-- Name: idx_sdr_memory_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sdr_memory_phone ON public.sdr_memory USING btree (phone, created_at);


--
-- Name: idx_service_ledger_entries_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_ledger_entries_service_id ON public.service_ledger_entries USING btree (service_id);


--
-- Name: idx_servico_billing_timeline_servico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servico_billing_timeline_servico_id ON public.servico_billing_timeline USING btree (servico_id);


--
-- Name: idx_servicos_canonicos_portfolio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_canonicos_portfolio ON public.servicos_canonicos USING btree (organizacao_id, portfolio_included, service_family);


--
-- Name: idx_servicos_catalogo_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_catalogo_ativo ON public.servicos_catalogo USING btree (organizacao_id, ativo);


--
-- Name: idx_servicos_catalogo_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_catalogo_org ON public.servicos_catalogo USING btree (organizacao_id);


--
-- Name: idx_servicos_catalogo_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicos_catalogo_origem ON public.servicos_catalogo USING btree (organizacao_id, origem_catalogo, service_family);


--
-- Name: idx_servicos_catalogo_stripe_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_servicos_catalogo_stripe_product ON public.servicos_catalogo USING btree (organizacao_id, stripe_product_id) WHERE (stripe_product_id IS NOT NULL);


--
-- Name: idx_stripe_webhook_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_webhook_events_org ON public.stripe_webhook_events USING btree (organizacao_id);


--
-- Name: idx_stripe_webhook_events_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_webhook_events_received ON public.stripe_webhook_events USING btree (received_at);


--
-- Name: idx_stripe_webhook_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_webhook_events_status ON public.stripe_webhook_events USING btree (status, received_at);


--
-- Name: idx_tarefas_chave_idem; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tarefas_chave_idem ON public.tarefas USING btree (organizacao_id, chave_idempotencia) WHERE (chave_idempotencia IS NOT NULL);


--
-- Name: idx_tarefas_concluida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_concluida ON public.tarefas USING btree (concluida);


--
-- Name: idx_tarefas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_empresa ON public.tarefas USING btree (empresa_id) WHERE (empresa_id IS NOT NULL);


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
-- Name: idx_tarefas_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarefas_org_status ON public.tarefas USING btree (organizacao_id, status);


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
-- Name: idx_vendas_eventos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_eventos_empresa ON public.vendas_eventos USING btree (empresa_id, ocorrido_em DESC) WHERE (empresa_id IS NOT NULL);


--
-- Name: idx_vendas_eventos_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_eventos_lead ON public.vendas_eventos USING btree (lead_id, ocorrido_em DESC) WHERE (lead_id IS NOT NULL);


--
-- Name: idx_vendas_eventos_negocio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_eventos_negocio ON public.vendas_eventos USING btree (negocio_id, ocorrido_em DESC) WHERE (negocio_id IS NOT NULL);


--
-- Name: idx_vendas_eventos_org_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_eventos_org_tipo ON public.vendas_eventos USING btree (organizacao_id, tipo);


--
-- Name: idx_vendas_eventos_proposta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_eventos_proposta ON public.vendas_eventos USING btree (proposta_id, ocorrido_em DESC) WHERE (proposta_id IS NOT NULL);


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
-- Name: idx_won_evidence_policies_org_produto_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_won_evidence_policies_org_produto_ativo ON public.won_evidence_policies USING btree (organizacao_id, produto) WHERE (ativo = true);


--
-- Name: uq_ai_agent_runs_one_live_per_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ai_agent_runs_one_live_per_contact ON public.ai_agent_runs USING btree (contato_id) WHERE ((status = 'running'::text) AND (modo = 'live'::text) AND (contato_id IS NOT NULL));


--
-- Name: uq_ai_contact_field_proposals_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ai_contact_field_proposals_pending ON public.ai_contact_field_proposals USING btree (organizacao_id, contato_id, campo) WHERE (status = 'pending'::text);


--
-- Name: uq_ai_routers_active_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ai_routers_active_session ON public.ai_routers USING btree (channel_session_id) WHERE (ativo = true);


--
-- Name: uq_assinaturas_org_stripe_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_assinaturas_org_stripe_subscription ON public.assinaturas USING btree (organizacao_id, stripe_subscription_id);


--
-- Name: uq_auth_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_auth_tokens_hash ON public.auth_tokens USING btree (token_hash);


--
-- Name: uq_billing_alias_one_canonical_per_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_billing_alias_one_canonical_per_identity ON public.billing_customer_aliases USING btree (billing_identity_id) WHERE is_canonical;


--
-- Name: uq_cadence_enrollment_events_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cadence_enrollment_events_idempotency ON public.cadence_enrollment_events USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uq_cadence_enrollments_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cadence_enrollments_idempotency ON public.cadence_enrollments USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uq_cadence_enrollments_one_live; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cadence_enrollments_one_live ON public.cadence_enrollments USING btree (cadence_definition_id, entity_type, entity_id) WHERE (status = ANY (ARRAY['active'::text, 'waiting'::text, 'waiting_reply'::text, 'paused'::text]));


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
-- Name: uq_stripe_webhook_events_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stripe_webhook_events_event_id ON public.stripe_webhook_events USING btree (event_id);


--
-- Name: service_ledger_entries trg_closed_service_ledger_entries_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_closed_service_ledger_entries_immutable BEFORE DELETE OR UPDATE ON public.service_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_service_ledger_mutation();


--
-- Name: tarefas trg_tarefas_sincronizar_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tarefas_sincronizar_status BEFORE INSERT OR UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.tarefas_sincronizar_status();


--
-- Name: ai_agent_run_steps ai_agent_run_steps_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_run_steps
    ADD CONSTRAINT ai_agent_run_steps_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_agent_run_steps ai_agent_run_steps_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_run_steps
    ADD CONSTRAINT ai_agent_run_steps_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_agent_runs(id) ON DELETE CASCADE;


--
-- Name: ai_agent_runs ai_agent_runs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: ai_agent_runs ai_agent_runs_channel_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_channel_session_id_fkey FOREIGN KEY (channel_session_id) REFERENCES public.whatsapp_sessao(id);


--
-- Name: ai_agent_runs ai_agent_runs_contato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_contato_id_fkey FOREIGN KEY (contato_id) REFERENCES public.contatos(id);


--
-- Name: ai_agent_runs ai_agent_runs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: ai_agent_runs ai_agent_runs_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: ai_agent_runs ai_agent_runs_outbound_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_outbound_message_id_fkey FOREIGN KEY (outbound_message_id) REFERENCES public.whatsapp_mensagens(id);


--
-- Name: ai_agent_runs ai_agent_runs_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.whatsapp_mensagens(id);


--
-- Name: ai_agent_runs ai_agent_runs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_runs
    ADD CONSTRAINT ai_agent_runs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.ai_agent_versions(id);


--
-- Name: ai_agent_versions ai_agent_versions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_versions
    ADD CONSTRAINT ai_agent_versions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE CASCADE;


--
-- Name: ai_agent_versions ai_agent_versions_channel_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_versions
    ADD CONSTRAINT ai_agent_versions_channel_session_id_fkey FOREIGN KEY (channel_session_id) REFERENCES public.whatsapp_sessao(id) ON DELETE RESTRICT;


--
-- Name: ai_agent_versions ai_agent_versions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_versions
    ADD CONSTRAINT ai_agent_versions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_agent_versions ai_agent_versions_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_versions
    ADD CONSTRAINT ai_agent_versions_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.ai_provider_credentials(id) ON DELETE RESTRICT;


--
-- Name: ai_agent_versions ai_agent_versions_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agent_versions
    ADD CONSTRAINT ai_agent_versions_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_agents ai_agents_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_agents ai_agents_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: ai_alerts ai_alerts_acknowledged_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_alerts
    ADD CONSTRAINT ai_alerts_acknowledged_by_id_fkey FOREIGN KEY (acknowledged_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_alerts ai_alerts_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_alerts
    ADD CONSTRAINT ai_alerts_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_analysis ai_analysis_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_analysis
    ADD CONSTRAINT ai_analysis_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: ai_case_events ai_case_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_case_events
    ADD CONSTRAINT ai_case_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: ai_case_events ai_case_events_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_case_events
    ADD CONSTRAINT ai_case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.ai_cases(id) ON DELETE CASCADE;


--
-- Name: ai_case_events ai_case_events_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_case_events
    ADD CONSTRAINT ai_case_events_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_cases ai_cases_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cases
    ADD CONSTRAINT ai_cases_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: ai_cases ai_cases_contato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cases
    ADD CONSTRAINT ai_cases_contato_id_fkey FOREIGN KEY (contato_id) REFERENCES public.contatos(id) ON DELETE CASCADE;


--
-- Name: ai_cases ai_cases_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cases
    ADD CONSTRAINT ai_cases_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: ai_cases ai_cases_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cases
    ADD CONSTRAINT ai_cases_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_cases ai_cases_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cases
    ADD CONSTRAINT ai_cases_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL;


--
-- Name: ai_contact_field_proposals ai_contact_field_proposals_contato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_contact_field_proposals
    ADD CONSTRAINT ai_contact_field_proposals_contato_id_fkey FOREIGN KEY (contato_id) REFERENCES public.contatos(id) ON DELETE CASCADE;


--
-- Name: ai_contact_field_proposals ai_contact_field_proposals_decided_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_contact_field_proposals
    ADD CONSTRAINT ai_contact_field_proposals_decided_by_user_id_fkey FOREIGN KEY (decided_by_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: ai_contact_field_proposals ai_contact_field_proposals_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_contact_field_proposals
    ADD CONSTRAINT ai_contact_field_proposals_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.whatsapp_mensagens(id) ON DELETE SET NULL;


--
-- Name: ai_contact_field_proposals ai_contact_field_proposals_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_contact_field_proposals
    ADD CONSTRAINT ai_contact_field_proposals_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_contact_field_proposals ai_contact_field_proposals_proposed_by_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_contact_field_proposals
    ADD CONSTRAINT ai_contact_field_proposals_proposed_by_agent_id_fkey FOREIGN KEY (proposed_by_agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: ai_improvement_proposals ai_improvement_proposals_decided_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_improvement_proposals
    ADD CONSTRAINT ai_improvement_proposals_decided_by_id_fkey FOREIGN KEY (decided_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_improvement_proposals ai_improvement_proposals_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_improvement_proposals
    ADD CONSTRAINT ai_improvement_proposals_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.ai_knowledge_versions(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_searches ai_knowledge_searches_knowledge_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_searches
    ADD CONSTRAINT ai_knowledge_searches_knowledge_version_id_fkey FOREIGN KEY (knowledge_version_id) REFERENCES public.ai_knowledge_versions(id) ON DELETE SET NULL;


--
-- Name: ai_knowledge_searches ai_knowledge_searches_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_searches
    ADD CONSTRAINT ai_knowledge_searches_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_searches ai_knowledge_searches_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_searches
    ADD CONSTRAINT ai_knowledge_searches_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL;


--
-- Name: ai_knowledge_sources ai_knowledge_sources_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_sources
    ADD CONSTRAINT ai_knowledge_sources_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_knowledge_sources ai_knowledge_sources_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_sources
    ADD CONSTRAINT ai_knowledge_sources_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_versions ai_knowledge_versions_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_versions
    ADD CONSTRAINT ai_knowledge_versions_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_versions ai_knowledge_versions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_versions
    ADD CONSTRAINT ai_knowledge_versions_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ai_knowledge_sources(id) ON DELETE CASCADE;


--
-- Name: ai_memory_entries ai_memory_entries_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_entries
    ADD CONSTRAINT ai_memory_entries_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_memory_entries ai_memory_entries_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_entries
    ADD CONSTRAINT ai_memory_entries_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_memory_pointers ai_memory_pointers_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_pointers
    ADD CONSTRAINT ai_memory_pointers_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_memory_pointers ai_memory_pointers_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_pointers
    ADD CONSTRAINT ai_memory_pointers_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.ai_memory_versions(id) ON DELETE RESTRICT;


--
-- Name: ai_memory_versions ai_memory_versions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_versions
    ADD CONSTRAINT ai_memory_versions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_memory_versions ai_memory_versions_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_memory_versions
    ADD CONSTRAINT ai_memory_versions_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_provider_credentials ai_provider_credentials_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_provider_credentials ai_provider_credentials_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_purpose_bindings ai_purpose_bindings_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_purpose_bindings
    ADD CONSTRAINT ai_purpose_bindings_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.ai_provider_credentials(id) ON DELETE SET NULL;


--
-- Name: ai_purpose_bindings ai_purpose_bindings_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_purpose_bindings
    ADD CONSTRAINT ai_purpose_bindings_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_router_decisions ai_router_decisions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_decisions
    ADD CONSTRAINT ai_router_decisions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: ai_router_decisions ai_router_decisions_contato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_decisions
    ADD CONSTRAINT ai_router_decisions_contato_id_fkey FOREIGN KEY (contato_id) REFERENCES public.contatos(id) ON DELETE SET NULL;


--
-- Name: ai_router_decisions ai_router_decisions_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_decisions
    ADD CONSTRAINT ai_router_decisions_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_router_decisions ai_router_decisions_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_decisions
    ADD CONSTRAINT ai_router_decisions_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.ai_routers(id) ON DELETE SET NULL;


--
-- Name: ai_router_members ai_router_members_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_members
    ADD CONSTRAINT ai_router_members_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE CASCADE;


--
-- Name: ai_router_members ai_router_members_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_members
    ADD CONSTRAINT ai_router_members_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_router_members ai_router_members_router_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_router_members
    ADD CONSTRAINT ai_router_members_router_id_fkey FOREIGN KEY (router_id) REFERENCES public.ai_routers(id) ON DELETE CASCADE;


--
-- Name: ai_routers ai_routers_channel_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_routers
    ADD CONSTRAINT ai_routers_channel_session_id_fkey FOREIGN KEY (channel_session_id) REFERENCES public.whatsapp_sessao(id) ON DELETE CASCADE;


--
-- Name: ai_routers ai_routers_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_routers
    ADD CONSTRAINT ai_routers_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_routers ai_routers_fallback_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_routers
    ADD CONSTRAINT ai_routers_fallback_agent_id_fkey FOREIGN KEY (fallback_agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: ai_routers ai_routers_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_routers
    ADD CONSTRAINT ai_routers_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


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
-- Name: ai_send_ledger ai_send_ledger_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_send_ledger
    ADD CONSTRAINT ai_send_ledger_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_send_ledger ai_send_ledger_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_send_ledger
    ADD CONSTRAINT ai_send_ledger_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_agent_runs(id) ON DELETE CASCADE;


--
-- Name: ai_skill_activations ai_skill_activations_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_activations
    ADD CONSTRAINT ai_skill_activations_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_skill_activations ai_skill_activations_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_activations
    ADD CONSTRAINT ai_skill_activations_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL;


--
-- Name: ai_skill_activations ai_skill_activations_skill_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_activations
    ADD CONSTRAINT ai_skill_activations_skill_version_id_fkey FOREIGN KEY (skill_version_id) REFERENCES public.ai_skill_versions(id) ON DELETE SET NULL;


--
-- Name: ai_skill_pointers ai_skill_pointers_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_pointers
    ADD CONSTRAINT ai_skill_pointers_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_skill_pointers ai_skill_pointers_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_pointers
    ADD CONSTRAINT ai_skill_pointers_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.ai_skill_versions(id) ON DELETE RESTRICT;


--
-- Name: ai_skill_versions ai_skill_versions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_versions
    ADD CONSTRAINT ai_skill_versions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: ai_skill_versions ai_skill_versions_forked_from_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_versions
    ADD CONSTRAINT ai_skill_versions_forked_from_version_id_fkey FOREIGN KEY (forked_from_version_id) REFERENCES public.ai_skill_versions(id) ON DELETE SET NULL;


--
-- Name: ai_skill_versions ai_skill_versions_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_skill_versions
    ADD CONSTRAINT ai_skill_versions_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: ai_usage_budgets ai_usage_budgets_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_budgets
    ADD CONSTRAINT ai_usage_budgets_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE CASCADE;


--
-- Name: ai_usage_budgets ai_usage_budgets_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_budgets
    ADD CONSTRAINT ai_usage_budgets_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: anexos anexos_criado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos
    ADD CONSTRAINT anexos_criado_por_id_fkey FOREIGN KEY (criado_por_id) REFERENCES public.usuarios(id);


--
-- Name: anexos_legado anexos_legado_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos_legado
    ADD CONSTRAINT anexos_legado_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: anexos anexos_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos
    ADD CONSTRAINT anexos_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- Name: anexos anexos_nota_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos
    ADD CONSTRAINT anexos_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES public.notas(id) ON DELETE CASCADE;


--
-- Name: anexos anexos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexos
    ADD CONSTRAINT anexos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: assinatura_itens assinatura_itens_assinatura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinatura_itens
    ADD CONSTRAINT assinatura_itens_assinatura_id_fkey FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id) ON DELETE CASCADE;


--
-- Name: assinatura_itens assinatura_itens_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinatura_itens
    ADD CONSTRAINT assinatura_itens_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: assinatura_itens assinatura_itens_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinatura_itens
    ADD CONSTRAINT assinatura_itens_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id);


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
-- Name: assinaturas assinaturas_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: atividades atividades_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


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
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: audit_log audit_log_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: auth_tokens auth_tokens_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: automacao_execucoes automacao_execucoes_automacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacao_execucoes
    ADD CONSTRAINT automacao_execucoes_automacao_id_fkey FOREIGN KEY (automacao_id) REFERENCES public.automacoes(id) ON DELETE CASCADE;


--
-- Name: automacao_execucoes automacao_execucoes_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacao_execucoes
    ADD CONSTRAINT automacao_execucoes_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: automacoes automacoes_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automacoes
    ADD CONSTRAINT automacoes_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: billing_audit_runs billing_audit_runs_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_audit_runs
    ADD CONSTRAINT billing_audit_runs_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE SET NULL;


--
-- Name: billing_correction_ledger billing_correction_ledger_audit_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_correction_ledger
    ADD CONSTRAINT billing_correction_ledger_audit_run_id_fkey FOREIGN KEY (audit_run_id) REFERENCES public.billing_audit_runs(id) ON DELETE SET NULL;


--
-- Name: billing_correction_ledger billing_correction_ledger_billing_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_correction_ledger
    ADD CONSTRAINT billing_correction_ledger_billing_identity_id_fkey FOREIGN KEY (billing_identity_id) REFERENCES public.billing_identities(id) ON DELETE SET NULL;


--
-- Name: billing_correction_ledger billing_correction_ledger_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_correction_ledger
    ADD CONSTRAINT billing_correction_ledger_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE SET NULL;


--
-- Name: billing_customer_aliases billing_customer_aliases_billing_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customer_aliases
    ADD CONSTRAINT billing_customer_aliases_billing_identity_id_fkey FOREIGN KEY (billing_identity_id) REFERENCES public.billing_identities(id) ON DELETE CASCADE;


--
-- Name: billing_identities billing_identities_canonical_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_identities
    ADD CONSTRAINT billing_identities_canonical_empresa_id_fkey FOREIGN KEY (canonical_empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;


--
-- Name: billing_identities billing_identities_canonical_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_identities
    ADD CONSTRAINT billing_identities_canonical_lead_id_fkey FOREIGN KEY (canonical_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: billing_identities billing_identities_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_identities
    ADD CONSTRAINT billing_identities_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;


--
-- Name: billing_identities billing_identities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_identities
    ADD CONSTRAINT billing_identities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: billing_identities billing_identities_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_identities
    ADD CONSTRAINT billing_identities_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: billing_resolution_cases billing_resolution_cases_audit_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_resolution_cases
    ADD CONSTRAINT billing_resolution_cases_audit_run_id_fkey FOREIGN KEY (audit_run_id) REFERENCES public.billing_audit_runs(id) ON DELETE SET NULL;


--
-- Name: billing_resolution_cases billing_resolution_cases_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_resolution_cases
    ADD CONSTRAINT billing_resolution_cases_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE SET NULL;


--
-- Name: buscas_salvas buscas_salvas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buscas_salvas
    ADD CONSTRAINT buscas_salvas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cadence_definition_pointers cadence_definition_pointers_cadence_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definition_pointers
    ADD CONSTRAINT cadence_definition_pointers_cadence_definition_id_fkey FOREIGN KEY (cadence_definition_id) REFERENCES public.cadence_definitions(id) ON DELETE CASCADE;


--
-- Name: cadence_definition_pointers cadence_definition_pointers_draft_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definition_pointers
    ADD CONSTRAINT cadence_definition_pointers_draft_version_id_fkey FOREIGN KEY (draft_version_id) REFERENCES public.cadence_versions(id) ON DELETE SET NULL;


--
-- Name: cadence_definition_pointers cadence_definition_pointers_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definition_pointers
    ADD CONSTRAINT cadence_definition_pointers_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: cadence_definition_pointers cadence_definition_pointers_published_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definition_pointers
    ADD CONSTRAINT cadence_definition_pointers_published_version_id_fkey FOREIGN KEY (published_version_id) REFERENCES public.cadence_versions(id) ON DELETE SET NULL;


--
-- Name: cadence_definitions cadence_definitions_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_definitions
    ADD CONSTRAINT cadence_definitions_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cadence_enrollment_events cadence_enrollment_events_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollment_events
    ADD CONSTRAINT cadence_enrollment_events_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.cadence_enrollments(id) ON DELETE CASCADE;


--
-- Name: cadence_enrollments cadence_enrollments_cadence_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollments
    ADD CONSTRAINT cadence_enrollments_cadence_definition_id_fkey FOREIGN KEY (cadence_definition_id) REFERENCES public.cadence_definitions(id) ON DELETE CASCADE;


--
-- Name: cadence_enrollments cadence_enrollments_cadence_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollments
    ADD CONSTRAINT cadence_enrollments_cadence_version_id_fkey FOREIGN KEY (cadence_version_id) REFERENCES public.cadence_versions(id) ON DELETE RESTRICT;


--
-- Name: cadence_enrollments cadence_enrollments_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollments
    ADD CONSTRAINT cadence_enrollments_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cadence_enrollments cadence_enrollments_source_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_enrollments
    ADD CONSTRAINT cadence_enrollments_source_event_id_fkey FOREIGN KEY (source_event_id) REFERENCES public.event_outbox(id) ON DELETE SET NULL;


--
-- Name: cadence_versions cadence_versions_cadence_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_versions
    ADD CONSTRAINT cadence_versions_cadence_definition_id_fkey FOREIGN KEY (cadence_definition_id) REFERENCES public.cadence_definitions(id) ON DELETE CASCADE;


--
-- Name: cadence_versions cadence_versions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_versions
    ADD CONSTRAINT cadence_versions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id);


--
-- Name: cadence_versions cadence_versions_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cadence_versions
    ADD CONSTRAINT cadence_versions_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


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
-- Name: callface_ai_reconciliation_candidates callface_ai_reconciliation_candidates_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.callface_ai_reconciliation_candidates
    ADD CONSTRAINT callface_ai_reconciliation_candidates_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: callface_ai_tenant_snapshots callface_ai_tenant_snapshots_external_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.callface_ai_tenant_snapshots
    ADD CONSTRAINT callface_ai_tenant_snapshots_external_identity_id_fkey FOREIGN KEY (external_identity_id) REFERENCES public.callface_ai_external_identities(id) ON DELETE CASCADE;


--
-- Name: callface_ai_usage_events callface_ai_usage_events_external_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.callface_ai_usage_events
    ADD CONSTRAINT callface_ai_usage_events_external_identity_id_fkey FOREIGN KEY (external_identity_id) REFERENCES public.callface_ai_external_identities(id) ON DELETE CASCADE;


--
-- Name: campanhas campanhas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanhas
    ADD CONSTRAINT campanhas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: catalogo_mapeamentos_legacy catalogo_mapeamentos_legacy_canonical_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_mapeamentos_legacy
    ADD CONSTRAINT catalogo_mapeamentos_legacy_canonical_product_id_fkey FOREIGN KEY (canonical_product_id) REFERENCES public.servicos_catalogo(id) ON DELETE SET NULL;


--
-- Name: catalogo_mapeamentos_legacy catalogo_mapeamentos_legacy_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_mapeamentos_legacy
    ADD CONSTRAINT catalogo_mapeamentos_legacy_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: catalogo_mapeamentos_legacy catalogo_mapeamentos_legacy_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_mapeamentos_legacy
    ADD CONSTRAINT catalogo_mapeamentos_legacy_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id);


--
-- Name: catalogo_precos catalogo_precos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_precos
    ADD CONSTRAINT catalogo_precos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: catalogo_precos catalogo_precos_servico_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_precos
    ADD CONSTRAINT catalogo_precos_servico_catalogo_id_fkey FOREIGN KEY (servico_catalogo_id) REFERENCES public.servicos_catalogo(id) ON DELETE CASCADE;


--
-- Name: checkouts checkouts_criado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_criado_por_id_fkey FOREIGN KEY (criado_por_id) REFERENCES public.usuarios(id);


--
-- Name: checkouts checkouts_grupo_comercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_grupo_comercial_id_fkey FOREIGN KEY (grupo_comercial_id) REFERENCES public.proposta_grupo_comercial(id);


--
-- Name: checkouts checkouts_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: checkouts checkouts_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: checkouts checkouts_proposta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkouts
    ADD CONSTRAINT checkouts_proposta_id_fkey FOREIGN KEY (proposta_id) REFERENCES public.propostas(id);


--
-- Name: cliente_receita_mensal cliente_receita_mensal_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_receita_mensal
    ADD CONSTRAINT cliente_receita_mensal_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;


--
-- Name: cliente_receita_mensal cliente_receita_mensal_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_receita_mensal
    ADD CONSTRAINT cliente_receita_mensal_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: clientes clientes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: clientes clientes_lead_id_legado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_lead_id_legado_fkey FOREIGN KEY (lead_id_legado) REFERENCES public.leads(id);


--
-- Name: clientes clientes_oportunidade_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_oportunidade_origem_id_fkey FOREIGN KEY (oportunidade_origem_id) REFERENCES public.oportunidades(id);


--
-- Name: clientes clientes_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: clientes clientes_pessoa_principal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pessoa_principal_id_fkey FOREIGN KEY (pessoa_principal_id) REFERENCES public.pessoas(id);


--
-- Name: clientes clientes_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


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
-- Name: comercial_evidencia comercial_evidencia_grupo_comercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_grupo_comercial_id_fkey FOREIGN KEY (grupo_comercial_id) REFERENCES public.proposta_grupo_comercial(id);


--
-- Name: comercial_evidencia comercial_evidencia_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- Name: comercial_evidencia comercial_evidencia_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: comercial_evidencia comercial_evidencia_verificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comercial_evidencia
    ADD CONSTRAINT comercial_evidencia_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES public.usuarios(id);


--
-- Name: communications communications_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: communications communications_pessoa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id);


--
-- Name: communications communications_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: contato_labels contato_labels_contato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_labels
    ADD CONSTRAINT contato_labels_contato_id_fkey FOREIGN KEY (contato_id) REFERENCES public.contatos(id) ON DELETE CASCADE;


--
-- Name: contato_labels contato_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_labels
    ADD CONSTRAINT contato_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: contato_listas contato_listas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_listas
    ADD CONSTRAINT contato_listas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: contatos contatos_active_ai_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_active_ai_agent_id_fkey FOREIGN KEY (active_ai_agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;


--
-- Name: contatos contatos_closed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_closed_by_id_fkey FOREIGN KEY (closed_by_id) REFERENCES public.usuarios(id);


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
-- Name: contrato_itens contrato_itens_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contrato_itens
    ADD CONSTRAINT contrato_itens_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE;


--
-- Name: contrato_itens contrato_itens_servico_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contrato_itens
    ADD CONSTRAINT contrato_itens_servico_catalogo_id_fkey FOREIGN KEY (servico_catalogo_id) REFERENCES public.servicos_catalogo(id);


--
-- Name: contrato_templates contrato_templates_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contrato_templates
    ADD CONSTRAINT contrato_templates_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: contratos contratos_grupo_comercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_grupo_comercial_id_fkey FOREIGN KEY (grupo_comercial_id) REFERENCES public.proposta_grupo_comercial(id);


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
-- Name: contratos contratos_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.contrato_templates(id);


--
-- Name: correction_change_log correction_change_log_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correction_change_log
    ADD CONSTRAINT correction_change_log_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.correction_runs(id);


--
-- Name: cs_cancelamentos cs_cancelamentos_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_cancelamentos
    ADD CONSTRAINT cs_cancelamentos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;


--
-- Name: cs_cancelamentos cs_cancelamentos_decidido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_cancelamentos
    ADD CONSTRAINT cs_cancelamentos_decidido_por_fkey FOREIGN KEY (decidido_por) REFERENCES public.usuarios(id);


--
-- Name: cs_cancelamentos cs_cancelamentos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_cancelamentos
    ADD CONSTRAINT cs_cancelamentos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: cs_cancelamentos cs_cancelamentos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_cancelamentos
    ADD CONSTRAINT cs_cancelamentos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cs_cancelamentos cs_cancelamentos_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_cancelamentos
    ADD CONSTRAINT cs_cancelamentos_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: cs_cancelamentos cs_cancelamentos_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_cancelamentos
    ADD CONSTRAINT cs_cancelamentos_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES public.usuarios(id);


--
-- Name: cs_marcos cs_marcos_concluido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_marcos
    ADD CONSTRAINT cs_marcos_concluido_por_fkey FOREIGN KEY (concluido_por) REFERENCES public.usuarios(id);


--
-- Name: cs_marcos cs_marcos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_marcos
    ADD CONSTRAINT cs_marcos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: cs_marcos cs_marcos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_marcos
    ADD CONSTRAINT cs_marcos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cs_marcos cs_marcos_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_marcos
    ADD CONSTRAINT cs_marcos_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id) ON DELETE CASCADE;


--
-- Name: cs_marcos cs_marcos_tarefa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_marcos
    ADD CONSTRAINT cs_marcos_tarefa_id_fkey FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE SET NULL;


--
-- Name: cs_renovacoes cs_renovacoes_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;


--
-- Name: cs_renovacoes cs_renovacoes_decidido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_decidido_por_fkey FOREIGN KEY (decidido_por) REFERENCES public.usuarios(id);


--
-- Name: cs_renovacoes cs_renovacoes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: cs_renovacoes cs_renovacoes_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE SET NULL;


--
-- Name: cs_renovacoes cs_renovacoes_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cs_renovacoes cs_renovacoes_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: cs_renovacoes cs_renovacoes_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_renovacoes
    ADD CONSTRAINT cs_renovacoes_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id) ON DELETE CASCADE;


--
-- Name: cs_riscos cs_riscos_aberto_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_aberto_por_fkey FOREIGN KEY (aberto_por) REFERENCES public.usuarios(id);


--
-- Name: cs_riscos cs_riscos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: cs_riscos cs_riscos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: cs_riscos cs_riscos_resolvido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_resolvido_por_fkey FOREIGN KEY (resolvido_por) REFERENCES public.usuarios(id);


--
-- Name: cs_riscos cs_riscos_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: cs_riscos cs_riscos_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: cs_riscos cs_riscos_tarefa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cs_riscos
    ADD CONSTRAINT cs_riscos_tarefa_id_fkey FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE SET NULL;


--
-- Name: custom_fields custom_fields_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: documentos_atendimento documentos_atendimento_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_atendimento
    ADD CONSTRAINT documentos_atendimento_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


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
-- Name: empresas empresas_canonical_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_canonical_empresa_id_fkey FOREIGN KEY (canonical_empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;


--
-- Name: empresas empresas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: entity_labels entity_labels_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_labels
    ADD CONSTRAINT entity_labels_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: entity_labels entity_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_labels
    ADD CONSTRAINT entity_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: entity_labels entity_labels_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_labels
    ADD CONSTRAINT entity_labels_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;


--
-- Name: event_outbox event_outbox_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: eventos_comerciais eventos_comerciais_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_comerciais
    ADD CONSTRAINT eventos_comerciais_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id);


--
-- Name: eventos_comerciais eventos_comerciais_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_comerciais
    ADD CONSTRAINT eventos_comerciais_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: eventos_comerciais eventos_comerciais_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_comerciais
    ADD CONSTRAINT eventos_comerciais_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: eventos_comerciais eventos_comerciais_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_comerciais
    ADD CONSTRAINT eventos_comerciais_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: eventos_comerciais eventos_comerciais_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_comerciais
    ADD CONSTRAINT eventos_comerciais_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: eventos eventos_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: fatura_itens fatura_itens_fatura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatura_itens
    ADD CONSTRAINT fatura_itens_fatura_id_fkey FOREIGN KEY (fatura_id) REFERENCES public.faturas(id) ON DELETE CASCADE;


--
-- Name: fatura_itens fatura_itens_servico_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatura_itens
    ADD CONSTRAINT fatura_itens_servico_catalogo_id_fkey FOREIGN KEY (servico_catalogo_id) REFERENCES public.servicos_catalogo(id) ON DELETE SET NULL;


--
-- Name: fatura_itens fatura_itens_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fatura_itens
    ADD CONSTRAINT fatura_itens_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: faturas faturas_acionado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_acionado_por_fkey FOREIGN KEY (acionado_por) REFERENCES public.usuarios(id);


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
-- Name: faturas faturas_grupo_comercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_grupo_comercial_id_fkey FOREIGN KEY (grupo_comercial_id) REFERENCES public.proposta_grupo_comercial(id);


--
-- Name: faturas faturas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: faturas faturas_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: faturas faturas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: faturas faturas_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faturas
    ADD CONSTRAINT faturas_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id);


--
-- Name: ai_agents fk_ai_agents_published_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT fk_ai_agents_published_version FOREIGN KEY (published_version_id) REFERENCES public.ai_agent_versions(id) ON DELETE SET NULL;


--
-- Name: fulfillment_formularios fulfillment_formularios_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_formularios
    ADD CONSTRAINT fulfillment_formularios_fulfillment_id_fkey FOREIGN KEY (fulfillment_id) REFERENCES public.fulfillments(id) ON DELETE CASCADE;


--
-- Name: fulfillment_formularios fulfillment_formularios_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_formularios
    ADD CONSTRAINT fulfillment_formularios_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: fulfillment_formularios fulfillment_formularios_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_formularios
    ADD CONSTRAINT fulfillment_formularios_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id);


--
-- Name: fulfillment_itens fulfillment_itens_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_itens
    ADD CONSTRAINT fulfillment_itens_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.usuarios(id);


--
-- Name: fulfillment_itens fulfillment_itens_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_itens
    ADD CONSTRAINT fulfillment_itens_fulfillment_id_fkey FOREIGN KEY (fulfillment_id) REFERENCES public.fulfillments(id) ON DELETE CASCADE;


--
-- Name: fulfillment_itens fulfillment_itens_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_itens
    ADD CONSTRAINT fulfillment_itens_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: fulfillment_itens fulfillment_itens_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_itens
    ADD CONSTRAINT fulfillment_itens_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: fulfillment_linhas_portabilidade fulfillment_linhas_portabilidade_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_linhas_portabilidade
    ADD CONSTRAINT fulfillment_linhas_portabilidade_fulfillment_id_fkey FOREIGN KEY (fulfillment_id) REFERENCES public.fulfillments(id) ON DELETE CASCADE;


--
-- Name: fulfillment_linhas_portabilidade fulfillment_linhas_portabilidade_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_linhas_portabilidade
    ADD CONSTRAINT fulfillment_linhas_portabilidade_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: fulfillment_ramais fulfillment_ramais_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_ramais
    ADD CONSTRAINT fulfillment_ramais_fulfillment_id_fkey FOREIGN KEY (fulfillment_id) REFERENCES public.fulfillments(id) ON DELETE CASCADE;


--
-- Name: fulfillment_ramais fulfillment_ramais_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_ramais
    ADD CONSTRAINT fulfillment_ramais_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: fulfillments fulfillments_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillments
    ADD CONSTRAINT fulfillments_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: fulfillments fulfillments_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillments
    ADD CONSTRAINT fulfillments_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: fulfillments fulfillments_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillments
    ADD CONSTRAINT fulfillments_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id) ON DELETE CASCADE;


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
-- Name: leads leads_desqualificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_desqualificado_por_fkey FOREIGN KEY (desqualificado_por) REFERENCES public.usuarios(id);


--
-- Name: leads leads_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: leads leads_nutrido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_nutrido_por_fkey FOREIGN KEY (nutrido_por) REFERENCES public.usuarios(id);


--
-- Name: leads leads_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: leads leads_pre_qualificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pre_qualificado_por_fkey FOREIGN KEY (pre_qualificado_por) REFERENCES public.usuarios(id);


--
-- Name: leads leads_prospeccao_descartado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_prospeccao_descartado_por_fkey FOREIGN KEY (prospeccao_descartado_por) REFERENCES public.usuarios(id);


--
-- Name: leads leads_qualificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_qualificado_por_fkey FOREIGN KEY (qualificado_por) REFERENCES public.usuarios(id);


--
-- Name: leads leads_responsavel_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_responsavel_id_usuarios_id_fk FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: legacy_provenance legacy_provenance_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_provenance
    ADD CONSTRAINT legacy_provenance_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


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
-- Name: metricas_diarias metricas_diarias_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metricas_diarias
    ADD CONSTRAINT metricas_diarias_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


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
-- Name: negocios negocios_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.oportunidade_bundle(id);


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
-- Name: negocios negocios_proxima_acao_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_proxima_acao_responsavel_id_fkey FOREIGN KEY (proxima_acao_responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: negocios negocios_responsavel_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_responsavel_id_usuarios_id_fk FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- Name: negocios negocios_servico_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negocios
    ADD CONSTRAINT negocios_servico_origem_id_fkey FOREIGN KEY (servico_origem_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: notas notas_autor_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_autor_id_usuarios_id_fk FOREIGN KEY (autor_id) REFERENCES public.usuarios(id);


--
-- Name: notas notas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


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
-- Name: notas notas_reuniao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_reuniao_id_fkey FOREIGN KEY (reuniao_id) REFERENCES public.reunioes(id) ON DELETE CASCADE;


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
-- Name: nps_respostas nps_respostas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: nps_respostas nps_respostas_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: nps_respostas nps_respostas_marco_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_marco_id_fkey FOREIGN KEY (marco_id) REFERENCES public.cs_marcos(id) ON DELETE SET NULL;


--
-- Name: nps_respostas nps_respostas_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: nps_respostas nps_respostas_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_respostas
    ADD CONSTRAINT nps_respostas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios(id);


--
-- Name: oportunidade_bundle oportunidade_bundle_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_bundle
    ADD CONSTRAINT oportunidade_bundle_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: oportunidade_bundle oportunidade_bundle_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_bundle
    ADD CONSTRAINT oportunidade_bundle_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: oportunidade_bundle oportunidade_bundle_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_bundle
    ADD CONSTRAINT oportunidade_bundle_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: oportunidade_itens oportunidade_itens_catalogo_preco_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_catalogo_preco_id_fkey FOREIGN KEY (catalogo_preco_id) REFERENCES public.catalogo_precos(id);


--
-- Name: oportunidade_itens oportunidade_itens_contrato_item_id_legado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_contrato_item_id_legado_fkey FOREIGN KEY (contrato_item_id_legado) REFERENCES public.contrato_itens(id);


--
-- Name: oportunidade_itens oportunidade_itens_grupo_comercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_grupo_comercial_id_fkey FOREIGN KEY (grupo_comercial_id) REFERENCES public.proposta_grupo_comercial(id);


--
-- Name: oportunidade_itens oportunidade_itens_oportunidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_oportunidade_id_fkey FOREIGN KEY (oportunidade_id) REFERENCES public.oportunidades(id) ON DELETE CASCADE;


--
-- Name: oportunidade_itens oportunidade_itens_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: oportunidade_itens oportunidade_itens_proposta_item_id_legado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_proposta_item_id_legado_fkey FOREIGN KEY (proposta_item_id_legado) REFERENCES public.proposta_itens(id);


--
-- Name: oportunidade_itens oportunidade_itens_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidade_itens
    ADD CONSTRAINT oportunidade_itens_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id);


--
-- Name: oportunidades oportunidades_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.oportunidade_bundle(id);


--
-- Name: oportunidades oportunidades_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: oportunidades oportunidades_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: oportunidades oportunidades_negocio_id_legado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_negocio_id_legado_fkey FOREIGN KEY (negocio_id_legado) REFERENCES public.negocios(id);


--
-- Name: oportunidades oportunidades_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: oportunidades oportunidades_pessoa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id);


--
-- Name: oportunidades oportunidades_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id);


--
-- Name: oportunidades oportunidades_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oportunidades
    ADD CONSTRAINT oportunidades_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


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
-- Name: pessoa_empresa_vinculos pessoa_empresa_vinculos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoa_empresa_vinculos
    ADD CONSTRAINT pessoa_empresa_vinculos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: pessoa_empresa_vinculos pessoa_empresa_vinculos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoa_empresa_vinculos
    ADD CONSTRAINT pessoa_empresa_vinculos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pessoa_empresa_vinculos pessoa_empresa_vinculos_pessoa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoa_empresa_vinculos
    ADD CONSTRAINT pessoa_empresa_vinculos_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id) ON DELETE CASCADE;


--
-- Name: pessoas pessoas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoas
    ADD CONSTRAINT pessoas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pessoas pessoas_lead_id_legado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoas
    ADD CONSTRAINT pessoas_lead_id_legado_fkey FOREIGN KEY (lead_id_legado) REFERENCES public.leads(id);


--
-- Name: pessoas pessoas_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pessoas
    ADD CONSTRAINT pessoas_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pipelines pipelines_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipelines
    ADD CONSTRAINT pipelines_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pontos_contato pontos_contato_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pontos_contato pontos_contato_lead_id_legado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_lead_id_legado_fkey FOREIGN KEY (lead_id_legado) REFERENCES public.leads(id);


--
-- Name: pontos_contato pontos_contato_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: pontos_contato pontos_contato_pessoa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_contato
    ADD CONSTRAINT pontos_contato_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id);


--
-- Name: portfolio_snapshots portfolio_snapshots_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: proposta_grupo_comercial proposta_grupo_comercial_checkout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial
    ADD CONSTRAINT proposta_grupo_comercial_checkout_id_fkey FOREIGN KEY (checkout_id) REFERENCES public.checkouts(id);


--
-- Name: proposta_grupo_comercial proposta_grupo_comercial_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial
    ADD CONSTRAINT proposta_grupo_comercial_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id);


--
-- Name: proposta_grupo_comercial_itens proposta_grupo_comercial_itens_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial_itens
    ADD CONSTRAINT proposta_grupo_comercial_itens_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.proposta_grupo_comercial(id) ON DELETE CASCADE;


--
-- Name: proposta_grupo_comercial_itens proposta_grupo_comercial_itens_proposta_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial_itens
    ADD CONSTRAINT proposta_grupo_comercial_itens_proposta_item_id_fkey FOREIGN KEY (proposta_item_id) REFERENCES public.proposta_itens(id);


--
-- Name: proposta_grupo_comercial proposta_grupo_comercial_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial
    ADD CONSTRAINT proposta_grupo_comercial_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id);


--
-- Name: proposta_grupo_comercial proposta_grupo_comercial_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial
    ADD CONSTRAINT proposta_grupo_comercial_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: proposta_grupo_comercial proposta_grupo_comercial_proposta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_grupo_comercial
    ADD CONSTRAINT proposta_grupo_comercial_proposta_id_fkey FOREIGN KEY (proposta_id) REFERENCES public.propostas(id);


--
-- Name: proposta_itens proposta_itens_catalogo_preco_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_itens
    ADD CONSTRAINT proposta_itens_catalogo_preco_id_fkey FOREIGN KEY (catalogo_preco_id) REFERENCES public.catalogo_precos(id);


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
-- Name: propostas propostas_contrato_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_contrato_base_id_fkey FOREIGN KEY (contrato_base_id) REFERENCES public.contratos(id);


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
-- Name: propostas propostas_substituida_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_substituida_por_id_fkey FOREIGN KEY (substituida_por_id) REFERENCES public.propostas(id);


--
-- Name: reconciliation_changes reconciliation_changes_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_changes
    ADD CONSTRAINT reconciliation_changes_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.reconciliation_runs(id);


--
-- Name: reconciliation_runs reconciliation_runs_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_runs
    ADD CONSTRAINT reconciliation_runs_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


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
-- Name: scripts_atendimento scripts_atendimento_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scripts_atendimento
    ADD CONSTRAINT scripts_atendimento_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: sdr_memory sdr_memory_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sdr_memory
    ADD CONSTRAINT sdr_memory_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: service_ledger_batches service_ledger_batches_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_batches
    ADD CONSTRAINT service_ledger_batches_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: service_ledger_entries service_ledger_entries_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_entries
    ADD CONSTRAINT service_ledger_entries_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.service_ledger_batches(id);


--
-- Name: service_ledger_entries service_ledger_entries_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_entries
    ADD CONSTRAINT service_ledger_entries_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: service_ledger_entries service_ledger_entries_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_ledger_entries
    ADD CONSTRAINT service_ledger_entries_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: servico_billing_timeline servico_billing_timeline_assinatura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_assinatura_id_fkey FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id) ON DELETE SET NULL;


--
-- Name: servico_billing_timeline servico_billing_timeline_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;


--
-- Name: servico_billing_timeline servico_billing_timeline_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;


--
-- Name: servico_billing_timeline servico_billing_timeline_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: servico_billing_timeline servico_billing_timeline_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: servico_billing_timeline servico_billing_timeline_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico_billing_timeline
    ADD CONSTRAINT servico_billing_timeline_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: servicos_canonicos servicos_canonicos_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_canonicos
    ADD CONSTRAINT servicos_canonicos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;


--
-- Name: servicos_canonicos servicos_canonicos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_canonicos
    ADD CONSTRAINT servicos_canonicos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;


--
-- Name: servicos_canonicos servicos_canonicos_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_canonicos
    ADD CONSTRAINT servicos_canonicos_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: servicos_canonicos servicos_canonicos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicos_canonicos
    ADD CONSTRAINT servicos_canonicos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


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
-- Name: stripe_webhook_events stripe_webhook_events_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: tarefas tarefas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


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
-- Name: tarefas tarefas_servico_canonico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_servico_canonico_id_fkey FOREIGN KEY (servico_canonico_id) REFERENCES public.servicos_canonicos(id) ON DELETE SET NULL;


--
-- Name: tarefas tarefas_usuario_id_usuarios_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarefas
    ADD CONSTRAINT tarefas_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: teams teams_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.usuarios(id);


--
-- Name: teams teams_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: usuarios usuarios_organizacao_id_organizacoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_organizacao_id_organizacoes_id_fk FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: usuarios usuarios_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: vendas_eventos vendas_eventos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: vendas_eventos vendas_eventos_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: vendas_eventos vendas_eventos_negocio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE CASCADE;


--
-- Name: vendas_eventos vendas_eventos_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- Name: vendas_eventos vendas_eventos_pessoa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id) ON DELETE CASCADE;


--
-- Name: vendas_eventos vendas_eventos_proposta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_proposta_id_fkey FOREIGN KEY (proposta_id) REFERENCES public.propostas(id) ON DELETE CASCADE;


--
-- Name: vendas_eventos vendas_eventos_reuniao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_reuniao_id_fkey FOREIGN KEY (reuniao_id) REFERENCES public.reunioes(id) ON DELETE SET NULL;


--
-- Name: vendas_eventos vendas_eventos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas_eventos
    ADD CONSTRAINT vendas_eventos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


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
-- Name: won_evidence_policies won_evidence_policies_organizacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.won_evidence_policies
    ADD CONSTRAINT won_evidence_policies_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id);


--
-- PostgreSQL database dump complete
--

\unrestrict rrUu3aFdQ8PBoeLzaIAGfZrAhYywqN5HPHwBEHmC1aTN2sAktfWVYidNhDE5aCI

