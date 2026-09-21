-- Corrige a trava de inscrição em automação, escrita errada na 0058.
--
-- A 0058 declarou UNIQUE (automacao_id, entity_type, entity_id, status). Com o
-- status dentro da chave, a trava impede que a mesma entidade tenha DUAS
-- inscrições canceladas na mesma automação, o que é histórico legítimo:
-- entrou na cadência, saiu, entrou de novo, saiu de novo.
--
-- Provado antes de corrigir, em transação revertida: o segundo INSERT com
-- status CANCELLED falha com duplicate key.
--
-- A intenção real era outra: uma entidade não pode ter mais de uma inscrição
-- VIVA por automação. Isso é índice único parcial, não constraint composta.

BEGIN;

ALTER TABLE automacao_inscricoes DROP CONSTRAINT IF EXISTS uq_automacao_inscricao_ativa;

-- Uma inscrição viva por entidade e automação. Histórico encerrado é ilimitado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacao_inscricao_viva
  ON automacao_inscricoes (automacao_id, entity_type, entity_id)
  WHERE status IN ('ACTIVE','PAUSED');

COMMIT;
