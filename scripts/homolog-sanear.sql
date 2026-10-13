-- Roda DEPOIS de restaurar a cópia de produção na homologação (scripts/homolog-servidor.sh).
-- Tira da cópia tudo o que daria à homologação poder de agir no mundo real:
-- tokens de e-mail/agenda (Microsoft/Gmail), sessão de WhatsApp e fila de eventos pendentes.
-- NÃO mexe nas chaves de IA e de enriquecimento (OpenAI, Groq, Apollo): o Scott quer testar a IA de verdade.
-- A razão dos tokens: o refresh token da Microsoft ROTACIONA a cada uso; se a homologação usasse o
-- token copiado de produção, o de produção ficaria obsoleto e o usuário perderia agenda e e-mail.
-- Só nesta cópia. Nunca rodar contra o banco de produção.
-- Falha alto de propósito (ON_ERROR_STOP): se uma tabela mudou de nome, o recarregamento para.
BEGIN;
UPDATE email_contas SET access_token = NULL, refresh_token = NULL, imap_pass = NULL, smtp_pass = NULL;
UPDATE whatsapp_sessao SET api_token = NULL, status = 'disconnected';
-- Eventos que produção ainda não tinha processado não podem ser executados aqui.
UPDATE event_outbox SET status = 'processed', processed_at = now() WHERE status <> 'processed';
COMMIT;
