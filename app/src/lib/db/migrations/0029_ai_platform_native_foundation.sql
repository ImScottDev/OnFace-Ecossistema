-- AI Platform nativo do Callface — paridade funcional com Deskcomm sem
-- Supabase, segundo backend, job_queue paralelo ou WABA/WAHA novo.
-- Migration aditiva e idempotente. Fonte: docs/reconstruction/
-- DESKCOMM-AI-NATIVE-PORT-2026-08-24.md

-- ─── AGENTES, PROVIDERS, CREDENCIAIS E RUNS ────────────────────────────────

ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'mcp_agent',
  ADD COLUMN IF NOT EXISTS published_version_id UUID,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  context_window INTEGER,
  input_price_per_million NUMERIC(12,6),
  output_price_per_million NUMERIC(12,6),
  supports_tools BOOLEAN NOT NULL DEFAULT true,
  supports_vision BOOLEAN NOT NULL DEFAULT false,
  is_default_for_provider BOOLEAN NOT NULL DEFAULT false,
  deprecated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_models_provider_model UNIQUE (provider, model_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);

CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  api_key_iv TEXT NOT NULL,
  api_key_tag TEXT NOT NULL,
  api_key_last4 TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  validated_at TIMESTAMPTZ,
  validation_error TEXT,
  models_available TEXT[],
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_provider_credentials_org_provider_label UNIQUE (organizacao_id, provider, label)
);
CREATE INDEX IF NOT EXISTS idx_ai_provider_credentials_org_provider
  ON ai_provider_credentials(organizacao_id, provider);

CREATE TABLE IF NOT EXISTS ai_purpose_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_id UUID REFERENCES ai_provider_credentials(id) ON DELETE SET NULL,
  model_id TEXT NOT NULL,
  base_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_purpose_bindings_org_purpose UNIQUE (organizacao_id, purpose)
);
CREATE INDEX IF NOT EXISTS idx_ai_purpose_bindings_credential ON ai_purpose_bindings(credential_id);

ALTER TABLE ai_agent_versions
  ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS credential_id UUID REFERENCES ai_provider_credentials(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS channel_session_id UUID REFERENCES whatsapp_sessao(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS guardrail_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS history_message_window INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS history_token_window INTEGER NOT NULL DEFAULT 8000,
  ADD COLUMN IF NOT EXISTS cases_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

UPDATE ai_agent_versions v
SET organizacao_id = a.organizacao_id
FROM ai_agents a
WHERE v.agent_id = a.id AND v.organizacao_id IS NULL;

ALTER TABLE ai_agent_versions ALTER COLUMN organizacao_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_agents_published_version') THEN
    ALTER TABLE ai_agents
      ADD CONSTRAINT fk_ai_agents_published_version
      FOREIGN KEY (published_version_id) REFERENCES ai_agent_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE ai_agent_runs
  ADD COLUMN IF NOT EXISTS outbound_message_id UUID REFERENCES whatsapp_mensagens(id),
  ADD COLUMN IF NOT EXISTS channel_session_id UUID REFERENCES whatsapp_sessao(id),
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS tokens_input INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS abort_reason TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS steps_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_agent_runs_one_live_per_contact
  ON ai_agent_runs(contato_id)
  WHERE status = 'running' AND modo = 'live' AND contato_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_agent_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES ai_agent_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL,
  input JSONB,
  output JSONB,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  custo NUMERIC(10,4),
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_ai_agent_run_steps_sequence UNIQUE (run_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_run_steps_org_started
  ON ai_agent_run_steps(organizacao_id, started_at);

CREATE TABLE IF NOT EXISTS ai_send_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES ai_agent_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  body_hash TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  external_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_send_ledger_run_sequence UNIQUE (run_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_ai_send_ledger_org_created
  ON ai_send_ledger(organizacao_id, created_at);

CREATE TABLE IF NOT EXISTS ai_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  body TEXT,
  ref_kind TEXT,
  ref_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  acknowledged_by_id UUID REFERENCES usuarios(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_org_status_created
  ON ai_alerts(organizacao_id, status, created_at);

CREATE TABLE IF NOT EXISTS ai_usage_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  provider TEXT,
  period TEXT NOT NULL DEFAULT 'monthly',
  token_limit INTEGER,
  cost_limit NUMERIC(12,4),
  warning_percent INTEGER NOT NULL DEFAULT 80,
  hard_stop BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_budgets_org ON ai_usage_budgets(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_budgets_agent ON ai_usage_budgets(agent_id);

-- ─── ROTEAMENTO ────────────────────────────────────────────────────────────

ALTER TABLE contatos
  ADD COLUMN IF NOT EXISTS bot_silenced_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_ai_intent TEXT,
  ADD COLUMN IF NOT EXISTS active_ai_agent_set_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ai_routers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  channel_session_id UUID NOT NULL REFERENCES whatsapp_sessao(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{"classifierModel":null,"sticky":true,"minConfidence":0.6}'::jsonb,
  fallback_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_routers_org ON ai_routers(organizacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_routers_active_session
  ON ai_routers(channel_session_id) WHERE ativo = true;

CREATE TABLE IF NOT EXISTS ai_router_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  router_id UUID NOT NULL REFERENCES ai_routers(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  intent_name TEXT NOT NULL,
  intent_description TEXT NOT NULL,
  examples TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_router_members_intent UNIQUE (router_id, intent_name)
);
CREATE INDEX IF NOT EXISTS idx_ai_router_members_router_position
  ON ai_router_members(router_id, position);

CREATE TABLE IF NOT EXISTS ai_router_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  router_id UUID REFERENCES ai_routers(id) ON DELETE SET NULL,
  contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
  intent_name TEXT,
  confidence NUMERIC(4,3),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_router_decisions_org_created
  ON ai_router_decisions(organizacao_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_router_decisions_router_created
  ON ai_router_decisions(router_id, created_at);

-- ─── CONHECIMENTO ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  mime_type TEXT,
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_id UUID REFERENCES usuarios(id),
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_org_status
  ON ai_knowledge_sources(organizacao_id, status);

CREATE TABLE IF NOT EXISTS ai_knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES ai_knowledge_sources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_knowledge_versions_source_number UNIQUE (source_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_versions_org ON ai_knowledge_versions(organizacao_id);

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES ai_knowledge_versions(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_knowledge_chunks_version_sequence UNIQUE (version_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_org ON ai_knowledge_chunks(organizacao_id);

CREATE TABLE IF NOT EXISTS ai_knowledge_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  run_id UUID REFERENCES ai_agent_runs(id) ON DELETE SET NULL,
  knowledge_version_id UUID REFERENCES ai_knowledge_versions(id) ON DELETE SET NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  top_score NUMERIC(8,6),
  threshold NUMERIC(8,6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_searches_org_created
  ON ai_knowledge_searches(organizacao_id, created_at);

-- ─── MEMÓRIA E SKILLS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_memory_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_by_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_memory_versions_org_number UNIQUE (organizacao_id, version_number)
);

CREATE TABLE IF NOT EXISTS ai_memory_pointers (
  organizacao_id UUID PRIMARY KEY REFERENCES organizacoes(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES ai_memory_versions(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_memory_entries_org_status
  ON ai_memory_entries(organizacao_id, status, created_at);

CREATE TABLE IF NOT EXISTS ai_skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  forked_from_version_id UUID REFERENCES ai_skill_versions(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_skill_versions_org_name_number UNIQUE NULLS NOT DISTINCT (organizacao_id, name, version_number)
);
CREATE INDEX IF NOT EXISTS idx_ai_skill_versions_name ON ai_skill_versions(name);

CREATE TABLE IF NOT EXISTS ai_skill_pointers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version_id UUID NOT NULL REFERENCES ai_skill_versions(id) ON DELETE RESTRICT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_skill_pointers_org_name UNIQUE (organizacao_id, name)
);

CREATE TABLE IF NOT EXISTS ai_skill_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  skill_version_id UUID REFERENCES ai_skill_versions(id) ON DELETE SET NULL,
  run_id UUID REFERENCES ai_agent_runs(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_skill_activations_org_created
  ON ai_skill_activations(organizacao_id, created_at);

-- ─── LOOP HUMANO, PROPOSTAS E FLYWHEEL ────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  run_id UUID REFERENCES ai_agent_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_human',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  blocker TEXT NOT NULL,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'agent',
  followup_attempts INTEGER NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_cases_org_status ON ai_cases(organizacao_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_cases_contato ON ai_cases(organizacao_id, contato_id);

CREATE TABLE IF NOT EXISTS ai_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES ai_cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  human_action TEXT,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_case_events_case_created ON ai_case_events(case_id, created_at);

CREATE TABLE IF NOT EXISTS ai_contact_field_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  valor_proposto TEXT NOT NULL,
  valor_anterior TEXT,
  message_id UUID REFERENCES whatsapp_mensagens(id) ON DELETE SET NULL,
  trecho TEXT,
  proposed_by_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  decided_by_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo_recusa TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_contact_field_proposals_pending
  ON ai_contact_field_proposals(organizacao_id, contato_id, campo)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_contact_field_proposals_expiring
  ON ai_contact_field_proposals(organizacao_id, expires_at);

CREATE TABLE IF NOT EXISTS ai_improvement_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed',
  decided_by_id UUID REFERENCES usuarios(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_improvement_proposals_org_status
  ON ai_improvement_proposals(organizacao_id, status, created_at);

-- ─── FOLLOW-UPS VERSIONADOS EM GRAFO ──────────────────────────────────────

ALTER TABLE cadence_definitions
  ADD COLUMN IF NOT EXISTS trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS handoff_policy JSONB NOT NULL DEFAULT '{"mode":"pause_on_reply"}'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS cadence_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  cadence_definition_id UUID NOT NULL REFERENCES cadence_definitions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  graph JSONB NOT NULL,
  compiled_steps JSONB NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  handoff_policy JSONB NOT NULL DEFAULT '{"mode":"pause_on_reply"}'::jsonb,
  validation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_id UUID REFERENCES usuarios(id),
  published_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cadence_versions_definition_number UNIQUE (cadence_definition_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_cadence_versions_org_status
  ON cadence_versions(organizacao_id, status);

CREATE TABLE IF NOT EXISTS cadence_definition_pointers (
  cadence_definition_id UUID PRIMARY KEY REFERENCES cadence_definitions(id) ON DELETE CASCADE,
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  draft_version_id UUID REFERENCES cadence_versions(id) ON DELETE SET NULL,
  published_version_id UUID REFERENCES cadence_versions(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cadence_definition_pointers_org
  ON cadence_definition_pointers(organizacao_id);

ALTER TABLE cadence_enrollments
  ADD COLUMN IF NOT EXISTS cadence_version_id UUID REFERENCES cadence_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS current_node_id TEXT,
  ADD COLUMN IF NOT EXISTS next_eval_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_snapshot JSONB;

UPDATE cadence_enrollments SET next_eval_at = scheduled_at WHERE next_eval_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_due
  ON cadence_enrollments(status, next_eval_at, claimed_until);

-- ─── CATÁLOGO INICIAL ─────────────────────────────────────────────────────

INSERT INTO ai_models
  (provider, model_id, display_name, description, context_window, input_price_per_million, output_price_per_million, supports_tools, supports_vision, is_default_for_provider)
VALUES
  ('anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'Equilíbrio entre qualidade e latência', 200000, 3.000000, 15.000000, true, true, true),
  ('anthropic', 'claude-haiku-4-5', 'Claude Haiku 4.5', 'Classificação e atendimento rápido', 200000, 1.000000, 5.000000, true, true, false),
  ('openai', 'gpt-5-mini', 'GPT-5 Mini', 'Modelo eficiente com ferramentas', 400000, 1.500000, 6.000000, true, true, true),
  ('openai', 'gpt-4o', 'GPT-4o', 'Compatibilidade multimodal', 128000, 2.500000, 10.000000, true, true, false),
  ('google', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'Modelo rápido e multimodal', 1000000, 0.300000, 2.500000, true, true, true),
  ('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B via Groq', 'Compatibilidade com o AI SDR atual', 128000, 0.590000, 0.790000, true, false, true)
ON CONFLICT (provider, model_id) DO NOTHING;
