-- Acionamento manual da fila de cobrança (Financeiro > Cobrança & Inadimplência):
-- marca o que já foi contatado, pra dar controle de trabalho pra quem roda a fila.
ALTER TABLE faturas
  ADD COLUMN IF NOT EXISTS acionado_cobranca boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acionado_em timestamptz,
  ADD COLUMN IF NOT EXISTS acionado_por uuid REFERENCES usuarios(id);

CREATE INDEX IF NOT EXISTS idx_faturas_acionado ON faturas (acionado_cobranca);
