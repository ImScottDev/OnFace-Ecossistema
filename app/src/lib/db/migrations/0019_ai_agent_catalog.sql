CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  descricao TEXT,
  finalidade TEXT NOT NULL DEFAULT 'atendimento',
  prioridade INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT idx_ai_agents_org_slug UNIQUE (organizacao_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_ai_agents_org_status ON ai_agents (organizacao_id, status);

CREATE TABLE IF NOT EXISTS ai_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  system_prompt TEXT NOT NULL DEFAULT '',
  provider TEXT,
  modelo TEXT,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  handoff_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  knowledge_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_steps INTEGER NOT NULL DEFAULT 8,
  token_budget INTEGER NOT NULL DEFAULT 4000,
  cost_budget NUMERIC(10,4),
  created_by_id UUID REFERENCES usuarios(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT idx_ai_agent_versions_number UNIQUE (agent_id, versao)
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_versions_status ON ai_agent_versions (agent_id, status);

CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
  agent_id UUID NOT NULL REFERENCES ai_agents(id),
  version_id UUID REFERENCES ai_agent_versions(id),
  contato_id UUID REFERENCES contatos(id),
  lead_id UUID REFERENCES leads(id),
  source_message_id UUID REFERENCES whatsapp_mensagens(id),
  modo TEXT NOT NULL DEFAULT 'live',
  status TEXT NOT NULL,
  input JSONB,
  trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  tokens INTEGER NOT NULL DEFAULT 0,
  custo NUMERIC(10,4),
  erro TEXT,
  handoff_motivo TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_org_started ON ai_agent_runs (organizacao_id, started_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent ON ai_agent_runs (agent_id, started_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_contato ON ai_agent_runs (contato_id, started_at);
