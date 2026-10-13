-- Calendário: troca de responsável da reunião move o evento entre calendários (13/10/2026).
--
-- reunioes.calendar_remocao_pendente: o evento que ficou no calendário ANTIGO depois que o
-- novo foi criado e gravado, ainda não retirado de lá. Formato:
--   {"provider":"microsoft","contaId":"<uuid>","eventId":"<id>","desde":"<iso>"}
-- A troca cria o evento novo ANTES de cancelar o antigo (o cliente nunca fica sem convite).
-- Se o cancelamento do antigo falha, ele não é esquecido: o worker (calendar-sync-retry) e a
-- próxima edição repetem só o cancelamento, até dar certo. NULL = nada a retirar.
--
-- Aditiva e idempotente. Nenhuma coluna existente muda.
--
-- ROLLBACK:
--   ALTER TABLE reunioes DROP COLUMN IF EXISTS calendar_remocao_pendente;

ALTER TABLE reunioes
  ADD COLUMN IF NOT EXISTS calendar_remocao_pendente jsonb;
