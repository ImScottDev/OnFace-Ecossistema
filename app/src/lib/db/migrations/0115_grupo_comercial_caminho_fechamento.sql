-- P1-13: o aceite decide contrato × pagamento ITEM A ITEM (14/10/2026).
--
-- Antes, o grupo comercial era formado só pelo modelo comercial das linhas e o
-- caminho (contrato ou checkout) saía de UMA família por grupo (a de maior
-- valor): um PABX com modelo PAGAMENTO_DIRETO dividia grupo com um plano
-- Callface AI e seguia o caminho dele. Agora cada linha tem o seu caminho e o
-- grupo nasce já com ele; fica gravado aqui, e nunca é recalculado depois.
--
-- `caminho_fechamento` = 'contrato' | 'pagamento'. NULL = grupo anterior a esta
-- migration, que continua valendo pela regra antiga (por grupo). Não há backfill
-- de propósito: um chute sobre venda em andamento seria pior que a regra antiga.
-- Idempotente: reexecutar não muda nada.

ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS caminho_fechamento text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposta_grupo_comercial_caminho_check') THEN
    ALTER TABLE proposta_grupo_comercial
      ADD CONSTRAINT proposta_grupo_comercial_caminho_check
      CHECK (caminho_fechamento IS NULL OR caminho_fechamento IN ('contrato', 'pagamento'));
  END IF;
END $$;
