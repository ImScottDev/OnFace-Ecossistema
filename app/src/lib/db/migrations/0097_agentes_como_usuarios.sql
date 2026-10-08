-- Agentes de IA de atendimento como USUÁRIOS do sistema + regra de distribuição
-- de leads + delegação de follow-up a agente.
--
-- Pedido do Scott (08/10): a agente (ex.: "Lia") precisa poder ser responsável de
-- lead/oportunidade como qualquer pessoa, aparecer em todos os seletores de
-- responsável e receber leads por regra. Por isso o agente ganha uma linha em
-- `usuarios` (tipo = 'agente', sem login: senha_hash inutilizável) ligada a
-- `ai_agents`. Nada do que lê `usuarios` precisa mudar para listá-la.
--
-- Aditiva e idempotente: colunas e tabelas novas, nenhuma linha existente tocada.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'humano';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS agente_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_agente ON usuarios (agente_id) WHERE agente_id IS NOT NULL;

-- Regra: "novos leads em etapa X -> responsável Y", com vigência opcional.
-- Várias regras podem existir; vence a de maior prioridade (menor número) que
-- esteja ativa e vigente no momento da criação do lead. Sem regra vigente vale o
-- comportamento anterior (organizacoes.settings.preVendas.responsavelInboundId).
CREATE TABLE IF NOT EXISTS regras_distribuicao_leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id      uuid NOT NULL REFERENCES organizacoes(id),
  nome                text NOT NULL,
  etapa               text NOT NULL DEFAULT 'novo',
  alvo_tipo           text NOT NULL DEFAULT 'usuario' CHECK (alvo_tipo IN ('usuario', 'rodizio')),
  alvo_usuario_id     uuid REFERENCES usuarios(id),
  rodizio_usuario_ids uuid[] NOT NULL DEFAULT '{}',
  rodizio_ultimo_id   uuid,
  dias_semana         smallint[],
  hora_inicio         time,
  hora_fim            time,
  humano_devolucao_id uuid REFERENCES usuarios(id),
  prioridade          integer NOT NULL DEFAULT 100,
  ativo               boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES usuarios(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regras_distribuicao_org ON regras_distribuicao_leads (organizacao_id, ativo, prioridade);

-- Delegação de follow-up (lead ou oportunidade) a um agente, com motivo,
-- cadência e o humano para quem devolver.
CREATE TABLE IF NOT EXISTS delegacoes_agente (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id     uuid NOT NULL REFERENCES organizacoes(id),
  lead_id            uuid REFERENCES leads(id),
  negocio_id         uuid REFERENCES negocios(id),
  agente_usuario_id  uuid NOT NULL REFERENCES usuarios(id),
  humano_usuario_id  uuid REFERENCES usuarios(id),
  motivo             text NOT NULL,
  gatilho            text NOT NULL DEFAULT 'manual',
  dias_sem_resposta  integer NOT NULL DEFAULT 2,
  intervalo_dias     integer NOT NULL DEFAULT 2,
  max_toques         integer NOT NULL DEFAULT 4,
  toques             integer NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'devolvida', 'encerrada')),
  proximo_toque_em   timestamptz,
  ultimo_toque_em    timestamptz,
  delegado_por       uuid REFERENCES usuarios(id),
  devolvida_em       timestamptz,
  devolvida_motivo   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delegacoes_agente_alvo CHECK (lead_id IS NOT NULL OR negocio_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_delegacoes_agente_ativas ON delegacoes_agente (organizacao_id, status, proximo_toque_em);
CREATE UNIQUE INDEX IF NOT EXISTS uq_delegacao_ativa_negocio ON delegacoes_agente (negocio_id) WHERE status = 'ativa' AND negocio_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_delegacao_ativa_lead ON delegacoes_agente (lead_id) WHERE status = 'ativa' AND negocio_id IS NULL AND lead_id IS NOT NULL;
