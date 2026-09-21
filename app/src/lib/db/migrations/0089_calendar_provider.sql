-- 0089 — CalendarProvider: a reunião passa a saber em qual agenda ela vive
--
-- O gap era conhecido e foi confirmado no código: existe criar
-- (`criarEventoOutlookParaReuniao`) e existe ler de volta
-- (`syncOutlookReunioes`), e NÃO existe atualizar. O cliente Graph tem create,
-- get e delete — nenhum update.
--
-- O efeito: `PATCH /reunioes/:id` muda a data no ONFACE e só avisa o provider
-- quando o status vira "cancelada". Reagendar deixa o convite antigo de pé na
-- agenda do cliente, e ninguém é avisado disso.
--
-- Esta migration generaliza o vínculo. `outlook_event_id` CONTINUA — é ponte,
-- não some: o sync existente lê por ele, e a coluna nova nasce preenchida a
-- partir dela.
--
-- Módulo 09: "Microsoft e Google entram por CalendarProvider", "Create/Update/
-- Cancel sincronizam provider" e "Falha de sync é visível e reprocessável" —
-- daí as colunas de status e erro, e não só o id do evento.
--
-- Aditiva. Nenhuma coluna sai.
--
-- ROLLBACK:
--   ALTER TABLE reunioes
--     DROP COLUMN IF EXISTS calendar_provider,
--     DROP COLUMN IF EXISTS calendar_event_id,
--     DROP COLUMN IF EXISTS calendar_sync_status,
--     DROP COLUMN IF EXISTS calendar_sync_erro,
--     DROP COLUMN IF EXISTS calendar_sync_em;
--   DROP INDEX IF EXISTS idx_reunioes_sync_pendente;

ALTER TABLE reunioes
  ADD COLUMN IF NOT EXISTS calendar_provider     text,
  ADD COLUMN IF NOT EXISTS calendar_event_id     text,
  -- pendente | ok | falhou | sem_provedor
  -- "sem_provedor" não é falha: é organização que não conectou agenda, e
  -- tratar as duas como a mesma coisa faz o alerta tocar em ambiente que
  -- nunca foi configurado.
  ADD COLUMN IF NOT EXISTS calendar_sync_status  text,
  ADD COLUMN IF NOT EXISTS calendar_sync_erro    text,
  ADD COLUMN IF NOT EXISTS calendar_sync_em      timestamp with time zone;

-- O que já existe no Outlook nasce vinculado, sem reprocessar nada.
UPDATE reunioes
   SET calendar_provider = 'microsoft',
       calendar_event_id = outlook_event_id,
       calendar_sync_status = 'ok',
       calendar_sync_em = updated_at
 WHERE outlook_event_id IS NOT NULL
   AND calendar_event_id IS NULL;

-- A fila de reprocessamento: quem falhou e precisa de nova tentativa.
CREATE INDEX IF NOT EXISTS idx_reunioes_sync_pendente
  ON reunioes (organizacao_id, calendar_sync_em)
  WHERE calendar_sync_status = 'falhou';
