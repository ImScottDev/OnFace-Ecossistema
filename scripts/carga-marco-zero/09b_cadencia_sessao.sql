-- CARGA MARCO ZERO · passo 09b · liga cadencia_execucoes a whatsapp_sessao.
-- O 04 carrega os toques da cadencia SDR sem sessao_id porque whatsapp_sessao so
-- existe depois do 09. Aqui o vinculo e completado, so onde a sessao existe no alvo.
-- Nao toca updated_at (a tabela nem tem) e nao mexe em quem ja esta ligado.
\set ON_ERROR_STOP on
BEGIN;
UPDATE cadencia_execucoes c SET sessao_id = l.sessao_id
  FROM legado.cadencia_execucoes l
 WHERE l.id = c.id AND l.sessao_id IS NOT NULL AND c.sessao_id IS DISTINCT FROM l.sessao_id
   AND EXISTS (SELECT 1 FROM whatsapp_sessao w WHERE w.id = l.sessao_id);
COMMIT;
