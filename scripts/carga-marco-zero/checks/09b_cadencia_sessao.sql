-- CHECK 09b · todo toque de cadencia com sessao em prod aponta para uma sessao do alvo.
\set ON_ERROR_STOP on
\ir _ck.sql
DO $$
DECLARE f text := '';
BEGIN
  f := f || pg_temp.ck('cadencia_execucoes sem sessao_id embora a sessao exista',
             (SELECT count(*) FROM legado.cadencia_execucoes l JOIN cadencia_execucoes c ON c.id = l.id
               WHERE l.sessao_id IS NOT NULL AND c.sessao_id IS NULL AND EXISTS (SELECT 1 FROM whatsapp_sessao w WHERE w.id = l.sessao_id)), 0);
  f := f || pg_temp.ck('whatsapp_sessao carregada (esperado > 0)', (SELECT least(count(*), 1) FROM whatsapp_sessao), 1);
  IF f <> '' THEN RAISE EXCEPTION E'check 09b VERMELHO:%', f; END IF;
  RAISE NOTICE 'check 09b verde';
END $$;
