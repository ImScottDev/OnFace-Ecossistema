-- 0124 — Serviço canônico guarda a QUANTIDADE vendida.
--
-- Por que existe: `materializarItem` (crm/servico-canonico.ts) gravava só o valor total da linha em
-- `current_recurring_value` e descartava `oportunidade_itens.quantidade`. "Linha SIP x 10" virava um
-- serviço de R$ 45,00 sem nunca dizer que eram dez. A coluna é INFORMATIVA: o valor continua sendo o
-- total da linha e a linha continua sendo UMA (sem componentes), para que nenhuma leitura de MRR some
-- em dobro.
--
-- Aditiva e idempotente. Linhas antigas ficam com 1.
--
-- ROLLBACK:
--   ALTER TABLE servicos_canonicos DROP COLUMN IF EXISTS quantidade;

ALTER TABLE servicos_canonicos ADD COLUMN IF NOT EXISTS quantidade numeric(14,3) NOT NULL DEFAULT 1;
