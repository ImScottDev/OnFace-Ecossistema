-- Atendimento operacional: estados do contato/conversa e tags de inbox.
-- A conversa continua representada por contatos para preservar as mensagens
-- e os vinculos existentes do CRM2.

ALTER TABLE contatos
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_id UUID REFERENCES usuarios(id);

CREATE INDEX IF NOT EXISTS idx_contatos_status_snooze
  ON contatos (organizacao_id, status, snoozed_until);

CREATE TABLE IF NOT EXISTS contato_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT idx_contato_labels_dedup UNIQUE (contato_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_contato_labels_contato ON contato_labels (contato_id);
CREATE INDEX IF NOT EXISTS idx_contato_labels_label ON contato_labels (label_id);

-- Biblioteca interna de roteiros e materiais do Atendimento. Os registros são
-- sempre escopados à organização; o conteúdo é consultado pelo time e nunca
-- dispara mensagem por si só.
CREATE TABLE IF NOT EXISTS scripts_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scripts_atendimento_org ON scripts_atendimento (organizacao_id);

CREATE TABLE IF NOT EXISTS documentos_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  familia TEXT,
  arquivo_url TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documentos_atendimento_org ON documentos_atendimento (organizacao_id);
