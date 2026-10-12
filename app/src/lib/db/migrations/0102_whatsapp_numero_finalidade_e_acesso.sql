-- Número de WhatsApp como entidade operacional (12/10/2026).
--
-- `whatsapp_sessao` já é o número: dono (usuario_id, nulo = compartilhado),
-- tipo, padrão, status, telefone, última conexão. Faltavam duas coisas que
-- nenhuma coluna cobria:
--   1. a finalidade do número (comercial, atendimento, suporte, sdr...);
--   2. quem, além do dono, pode usar um número compartilhado. Hoje "sem dono"
--      é visível para a organização inteira; passa a ser visível só para quem
--      está em `whatsapp_sessao_acesso` (e para a gestão).
-- Aditiva e idempotente: nenhuma linha existente é tocada.

ALTER TABLE whatsapp_sessao ADD COLUMN IF NOT EXISTS finalidade text;

CREATE TABLE IF NOT EXISTS whatsapp_sessao_acesso (
  sessao_id     uuid NOT NULL REFERENCES whatsapp_sessao(id) ON DELETE CASCADE,
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  concedido_por uuid REFERENCES usuarios(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sessao_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_sessao_acesso_usuario ON whatsapp_sessao_acesso (usuario_id);
