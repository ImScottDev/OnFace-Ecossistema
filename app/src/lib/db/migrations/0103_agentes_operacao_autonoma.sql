-- Agentes de IA 2.0: operação autônoma, separada de cadência e de automação.
--
-- Três peças próprias do agente (nenhuma depende de cadence_*):
--   1. ai_agent_atribuicoes  quem é o agente responsável pelo atendimento, com estado
--                            operacional, objetivo e handoff. Uma atribuição viva por contato.
--   2. ai_agent_compromissos retomadas que o PRÓPRIO agente agenda ("me chama quinta").
--                            Guardam motivo e instrução, nunca o texto pronto: na hora de
--                            vencer o contexto é reconstruído e o agente decide o que dizer.
--   3. ai_memoria_fatos      memória por pessoa, empresa, conversa e operação, com fonte,
--                            data e confirmação. Inferência nunca sobrescreve dado canônico.
-- Mais o roteamento comercial configurável (família/campanha -> closer por ID de usuário).

CREATE TABLE IF NOT EXISTS ai_agent_atribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  contato_id uuid NULL REFERENCES contatos(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  negocio_id uuid NULL REFERENCES negocios(id) ON DELETE SET NULL,
  empresa_id uuid NULL REFERENCES empresas(id) ON DELETE SET NULL,
  -- ativa | pausada | aguardando_aprovacao | humano | falha | encerrada
  status text NOT NULL DEFAULT 'ativa',
  objetivo text NULL,
  autonomia text NULL,                       -- sobrepõe a da versão nesta atribuição (suggest|approval|autonomous)
  origem text NOT NULL DEFAULT 'manual',     -- manual | atendimento | automacao | regra | evento
  origem_ref text NULL,                      -- id da automação/regra que atribuiu
  atribuido_por uuid NULL REFERENCES usuarios(id),
  copiloto boolean NOT NULL DEFAULT false,   -- depois do handoff continua como copiloto interno
  humano_usuario_id uuid NULL REFERENCES usuarios(id),
  motivo_estado text NULL,                   -- por que está pausada / humano / falha / encerrada
  resumo_handoff text NULL,
  estado jsonb NOT NULL DEFAULT '{}'::jsonb, -- progresso do objetivo, próximo passo, pendências
  ultimo_run_id uuid NULL,
  ultima_execucao_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  encerrada_em timestamptz NULL,
  CONSTRAINT ai_agent_atribuicoes_alvo CHECK (contato_id IS NOT NULL OR lead_id IS NOT NULL OR negocio_id IS NOT NULL)
);

-- Exclusividade: nunca dois agentes vivos para o mesmo contato.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_agent_atribuicoes_contato_viva
  ON ai_agent_atribuicoes (contato_id)
  WHERE contato_id IS NOT NULL AND status IN ('ativa','pausada','aguardando_aprovacao','falha');
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_agent_atribuicoes_lead_viva
  ON ai_agent_atribuicoes (lead_id)
  WHERE contato_id IS NULL AND lead_id IS NOT NULL AND status IN ('ativa','pausada','aguardando_aprovacao','falha');
CREATE INDEX IF NOT EXISTS idx_ai_agent_atribuicoes_org_status ON ai_agent_atribuicoes (organizacao_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_atribuicoes_agente ON ai_agent_atribuicoes (agent_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_atribuicoes_lead ON ai_agent_atribuicoes (lead_id) WHERE lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_agent_compromissos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  atribuicao_id uuid NULL REFERENCES ai_agent_atribuicoes(id) ON DELETE SET NULL,
  contato_id uuid NULL REFERENCES contatos(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'retomada',     -- retomada | lembrete | verificacao
  motivo text NOT NULL,                      -- o que o contato combinou, nas palavras do agente
  instrucao text NULL,                       -- orientação para o agente no retorno (não é mensagem pronta)
  due_at timestamptz NOT NULL,
  -- pendente | processando | concluido | cancelado | bloqueado | falhou | expirado
  status text NOT NULL DEFAULT 'pendente',
  bloqueio_motivo text NULL,                 -- humano assumiu, canal fora, opt-out, agente pausado...
  tentativas integer NOT NULL DEFAULT 0,
  origem_run_id uuid NULL,                   -- execução em que o agente combinou
  origem_mensagem_id uuid NULL,
  run_id uuid NULL,                          -- execução que cumpriu
  idempotency_key text NULL,
  reagendado_de timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_agent_compromissos_idem ON ai_agent_compromissos (organizacao_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_agent_compromissos_vencimento ON ai_agent_compromissos (status, due_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_compromissos_contato ON ai_agent_compromissos (contato_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_compromissos_org ON ai_agent_compromissos (organizacao_id, status, due_at);

CREATE TABLE IF NOT EXISTS ai_memoria_fatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  escopo text NOT NULL,                      -- pessoa | empresa | conversa | operacional
  contato_id uuid NULL REFERENCES contatos(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE CASCADE,
  empresa_id uuid NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- fato | preferencia | objecao | promessa | compromisso | proximo_passo | resumo
  tipo text NOT NULL DEFAULT 'fato',
  chave text NOT NULL,
  valor text NOT NULL,
  -- origem do dado: mensagem | formulario | ferramenta | humano | crm
  fonte text NOT NULL,
  fonte_ref text NULL,                       -- id da mensagem/registro que prova
  confirmado boolean NOT NULL DEFAULT false, -- false = inferência do modelo
  confianca numeric(3,2) NULL,
  status text NOT NULL DEFAULT 'ativo',      -- ativo | corrigido | excluido | expirado
  valido_ate timestamptz NULL,
  agent_id uuid NULL REFERENCES ai_agents(id) ON DELETE SET NULL,
  run_id uuid NULL,
  usuario_id uuid NULL REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_memoria_fatos_alvo CHECK (contato_id IS NOT NULL OR lead_id IS NOT NULL OR empresa_id IS NOT NULL OR escopo = 'operacional')
);
CREATE INDEX IF NOT EXISTS idx_ai_memoria_fatos_contato ON ai_memoria_fatos (contato_id, status, updated_at DESC) WHERE contato_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_memoria_fatos_lead ON ai_memoria_fatos (lead_id, status, updated_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_memoria_fatos_empresa ON ai_memoria_fatos (empresa_id, status, updated_at DESC) WHERE empresa_id IS NOT NULL;
-- Um fato ativo por (alvo, escopo, chave): atualizar substitui, não empilha.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_memoria_fatos_ativo
  ON ai_memoria_fatos (organizacao_id, escopo, COALESCE(contato_id, lead_id, empresa_id, organizacao_id), chave)
  WHERE status = 'ativo';

-- Roteamento comercial: família/campanha -> closer, administrável. O destino é ID
-- de usuário (nunca nome), então trocar de closer é editar a regra.
CREATE TABLE IF NOT EXISTS roteamento_comercial_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome text NOT NULL,
  familia text NULL,                         -- CALLFACE_AI | WHITE_LABEL | PABX | null = qualquer
  campanha text NULL,                        -- trecho da campanha/origem (case-insensitive); null = qualquer
  prioridade integer NOT NULL DEFAULT 100,   -- maior vence; campanha específica deve ter prioridade maior
  ativa boolean NOT NULL DEFAULT true,
  vigente_de timestamptz NULL,
  vigente_ate timestamptz NULL,
  destino_usuario_id uuid NULL REFERENCES usuarios(id),
  fallback text NOT NULL DEFAULT 'fila_humana', -- fila_humana | rodizio
  criado_por uuid NULL REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roteamento_comercial_org ON roteamento_comercial_regras (organizacao_id, ativa, prioridade DESC);

-- Conhecimento governado: histórico | rascunho | aprovado. Agente só enxerga aprovado.
ALTER TABLE ai_knowledge_sources ADD COLUMN IF NOT EXISTS governanca text NOT NULL DEFAULT 'aprovado';
ALTER TABLE ai_knowledge_sources ADD COLUMN IF NOT EXISTS categoria text NULL;
