-- Calendário: a volta Outlook -> ONFACE e a conta que criou o evento (14/10/2026).
--
-- 1) reunioes.calendar_conta_id: a conta de e-mail (email_contas) em que o evento
--    foi criado. Atualizar e cancelar passam a usar ESTA conta, não "a primeira
--    Microsoft ativa do usuário": com duas contas, o PATCH ia à conta errada,
--    devolvia 404 e o ONFACE recriava o evento (duplicata no Outlook).
-- 2) reunioes.participantes_respostas: resposta de cada convidado
--    ({email: accepted|declined|tentativelyAccepted|none}), lida do Outlook.
-- 3) calendario_assinaturas: uma linha por conta conectada com a assinatura
--    (change notification) e o cursor de delta query da volta.
--
-- Aditiva e idempotente. Nenhuma coluna sai.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS calendario_assinaturas;
--   ALTER TABLE reunioes DROP COLUMN IF EXISTS calendar_conta_id,
--                        DROP COLUMN IF EXISTS participantes_respostas;
--   DROP INDEX IF EXISTS idx_reunioes_calendar_event;

ALTER TABLE reunioes
  ADD COLUMN IF NOT EXISTS calendar_conta_id uuid REFERENCES email_contas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participantes_respostas jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reunioes_calendar_event
  ON reunioes (calendar_event_id) WHERE calendar_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS calendario_assinaturas (
  conta_id          uuid PRIMARY KEY REFERENCES email_contas(id) ON DELETE CASCADE,
  organizacao_id    uuid NOT NULL REFERENCES organizacoes(id),
  subscription_id   text,
  expira_em         timestamptz,
  delta_link        text,
  delta_iniciado_em timestamptz,
  ultimo_delta_em   timestamptz,
  ultimo_erro       text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendario_assinaturas_sub
  ON calendario_assinaturas (subscription_id) WHERE subscription_id IS NOT NULL;
