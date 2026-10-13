-- 0120 — Condições comerciais gravadas, retomada do aceite e entrega de e-mail real.
--
-- 1) propostas: o que o editor coleta e não tinha coluna (antes só vivia em `propostas.editor`, inacessível
--    ao contrato e à cobrança). Colunas NOVAS: nenhuma existente muda de significado.
--    `dia_vencimento_mes` é o dia do mês da cobrança (1-31). `vencimento_dias` (dias após a emissão, usado
--    pelo boleto/parcelamento do Stripe) continua com o significado dele e NÃO é escrito com o dia do mês.
-- 2) proposta_grupo_comercial: rastro da tentativa de avançar o grupo após o aceite (contrato/checkout),
--    para o botão "reprocessar" e o retry do worker saberem o que parou e há quanto tempo.
-- 3) emails: estado de ENTREGA devolvido pelo provedor (delivered, bounced, suppressed, failed...) e a que
--    proposta/contrato/checkout o envio pertence. `status` segue sendo "o provedor aceitou o envio".
--
-- Aditiva e idempotente.

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS dia_vencimento_mes integer;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS reajuste_indice text;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS inicio_vigencia_tipo text;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS data_inicio_vigencia date;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS fidelidade_meses integer;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS desconto_temporario_alvo text;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS desconto_temporario_meses integer;

ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS fechamento_erro text;
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS fechamento_tentativas integer NOT NULL DEFAULT 0;
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS fechamento_ultima_tentativa_em timestamptz;

ALTER TABLE emails ADD COLUMN IF NOT EXISTS entrega_estado text;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS entrega_detalhe text;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS entrega_verificada_em timestamptz;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS origem_tipo text;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS origem_id uuid;
CREATE INDEX IF NOT EXISTS idx_emails_origem ON emails (origem_tipo, origem_id) WHERE origem_id IS NOT NULL;
