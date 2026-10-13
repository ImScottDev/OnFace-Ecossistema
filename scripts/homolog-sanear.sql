-- Roda DEPOIS de restaurar a cópia de produção na homologação (scripts/homolog-servidor.sh).
-- Tira da cópia tudo o que daria à homologação poder de agir no mundo real:
-- credenciais de e-mail/WhatsApp/IA e fila de eventos pendentes.
-- Só nesta cópia. Nunca rodar contra o banco de produção.
-- Falha alto de propósito (ON_ERROR_STOP): se uma tabela mudou de nome, o recarregamento para.
BEGIN;
UPDATE email_contas SET access_token = NULL, refresh_token = NULL, imap_pass = NULL, smtp_pass = NULL;
UPDATE whatsapp_sessao SET api_token = NULL, status = 'disconnected';
UPDATE ai_sdr_config SET groq_api_key = NULL;
UPDATE organizacoes SET apollo_api_key = NULL;
DELETE FROM ai_provider_credentials;
-- Eventos que produção ainda não tinha processado não podem ser executados aqui.
UPDATE event_outbox SET status = 'processed', processed_at = now() WHERE status <> 'processed';
COMMIT;
