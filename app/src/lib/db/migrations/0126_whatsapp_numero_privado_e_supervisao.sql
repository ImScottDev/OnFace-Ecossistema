-- 0126 — Conversa de WhatsApp é dado pessoal: número privado e supervisão explícita.
--
-- Achado de segurança (13/10/2026): o dono do produto conectou o WhatsApp PESSOAL dele ao ONFACE,
-- e a regra de acesso dava a organização inteira a admin/director/operations (e o time a
-- gerente/coordenador) só pelo CARGO. Qualquer admin abria a conversa pessoal dele.
--
-- Política nova (decidida pelo dono, aplicada no servidor em lib/whatsapp/acesso.ts):
--   - cada pessoa vê as próprias conversas e os números explicitamente compartilhados com ela;
--   - conversa transferida a alguém dá acesso àquela conversa;
--   - SUPERVISÃO de equipe exige permissão explícita (whatsapp_supervisao), nunca vem do cargo;
--   - número PRIVADO continua protegido mesmo da supervisão: só o dono, quem ele compartilhou
--     (whatsapp_sessao_acesso) e o super admin (com rastro em audit_log);
--   - super admin tem acesso excepcional, sempre com registro.
--
-- O que esta migration faz:
--   1. `whatsapp_sessao.privado`: o número é pessoal/privado. Backfill: número PESSOAL de dono humano
--      com papel de gestão (super_admin, admin, director, operations, gerente, coordinator) nasce
--      privado. Número de closer/SDR é de trabalho e fica não privado (a supervisão, quando
--      concedida, alcança esse).
--   2. `whatsapp_supervisao`: quem (supervisor) pode ver os números NÃO privados de quem (alvo).
--      Começa VAZIA de propósito: conceder por cargo é exatamente o que a política proíbe.
--   3. Compatibilidade: número SEM dono humano (compartilhado ou de agente de IA) era visível para
--      admin/director/operations pelo cargo. Esse acesso passa a existir como linha explícita em
--      `whatsapp_sessao_acesso` (concedido_por NULL = esta migration), para a operação que hoje
--      acompanha o atendimento da IA e do número compartilhado não parar. Não toca número de pessoa.
--
-- Aditiva e idempotente: coluna, tabela e índice parcial novos, INSERT ... ON CONFLICT DO NOTHING.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_wa_msg_media_url;
--   DROP TABLE IF EXISTS whatsapp_supervisao;
--   ALTER TABLE whatsapp_sessao DROP COLUMN IF EXISTS privado;
--   DELETE FROM whatsapp_sessao_acesso WHERE concedido_por IS NULL;

ALTER TABLE whatsapp_sessao ADD COLUMN IF NOT EXISTS privado boolean NOT NULL DEFAULT false;

UPDATE whatsapp_sessao s
   SET privado = true
  FROM usuarios u
 WHERE u.id = s.usuario_id
   AND s.tipo = 'pessoal'
   AND s.privado = false
   AND u.tipo IS DISTINCT FROM 'agente'
   AND u.agente_id IS NULL
   AND u.role IN ('super_admin', 'admin', 'director', 'operations', 'gerente', 'coordinator');

CREATE TABLE IF NOT EXISTS whatsapp_supervisao (
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  supervisor_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alvo_usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  concedido_por   uuid REFERENCES usuarios(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supervisor_id, alvo_usuario_id),
  CHECK (supervisor_id <> alvo_usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_supervisao_alvo ON whatsapp_supervisao (alvo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_wa_supervisao_org ON whatsapp_supervisao (organizacao_id);

-- A mídia de conversa só sai para quem pode abrir a conversa (rota de arquivo → mensagem → contato): a busca
-- é pela URL do arquivo. Índice parcial, pequeno (só as mensagens com mídia).
CREATE INDEX IF NOT EXISTS idx_wa_msg_media_url ON whatsapp_mensagens (media_url) WHERE media_url IS NOT NULL;

INSERT INTO whatsapp_sessao_acesso (sessao_id, usuario_id, concedido_por)
SELECT s.id, g.id, NULL
  FROM whatsapp_sessao s
  LEFT JOIN usuarios dono ON dono.id = s.usuario_id
  JOIN usuarios g ON g.organizacao_id = s.organizacao_id AND g.ativo
 WHERE g.role IN ('admin', 'director', 'operations')
   AND s.privado = false
   AND (s.usuario_id IS NULL OR dono.tipo = 'agente' OR dono.agente_id IS NOT NULL)
ON CONFLICT (sessao_id, usuario_id) DO NOTHING;
