-- Auditoria da entrega de conversoes a Meta (SPEC 20).
--
-- Sem isto nao ha resposta para a unica pergunta que importa quando o
-- relatorio do gerenciador nao bate com o CRM: **esse evento chegou na Meta?**
--
-- Uma linha por evento do outbox, nao por tentativa: a tentativa e um contador,
-- e o que se quer saber e o estado atual daquele fato. O historico de erro fica
-- em `detalhe`, que guarda o ultimo — o penultimo erro de uma entrega que ja
-- funcionou nao ajuda ninguem.
--
-- `motivo` distingue os casos que parecem iguais e nao sao:
--
--   sem_mapeamento      o evento nao tem traducao para a Meta, e esta certo
--   sem_touchpoint_meta o fato nao veio da Meta: devolver mentiria o CAC dela
--   sem_credencial      configuracao ausente, nao falha
--   sem_identidade      sem e-mail, telefone nem lead id: a Meta nao casa
--   recusado            a Meta recusou; repetir da o mesmo erro
--   transitorio         rede ou limite de taxa; vale repetir

BEGIN;

CREATE TABLE IF NOT EXISTS meta_capi_entregas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  outbox_id       uuid NOT NULL REFERENCES event_outbox(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  event_name      text,
  -- Determinístico, e por isso auditavel: da para procurar este mesmo id no
  -- Events Manager da Meta.
  event_id        text,
  entregue        boolean NOT NULL DEFAULT false,
  motivo          text,
  detalhe         text,
  tentativas      integer NOT NULL DEFAULT 1,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_capi_entregas_outbox
  ON meta_capi_entregas (outbox_id);

-- Para achar rapido o que falhou e vale reprocessar.
CREATE INDEX IF NOT EXISTS idx_meta_capi_entregas_pendentes
  ON meta_capi_entregas (organizacao_id, criado_em DESC)
  WHERE entregue = false;

COMMIT;

-- Reversao:
--   DROP TABLE IF EXISTS meta_capi_entregas;
