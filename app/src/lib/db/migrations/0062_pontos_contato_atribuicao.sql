-- Completa `pontos_contato` como dono da atribuição (SPEC §8.3, fase 06).
--
-- A tabela existe mas nasceu sem os identificadores de clique e sem ligação com
-- a aquisição. Hoje `gclid`, `fbclid`, `fbc`, `fbp` e os ids de campanha da Meta
-- moram em colunas de `leads`, misturados com o processo comercial — é o que o
-- SPEC §7 chama de tabela que faz sete papéis ao mesmo tempo.
--
-- Sem `fbc`/`fbp` fora de `leads` não há como o SPEC §10 (Meta CAPI) devolver
-- conversão com deduplicação: o sinal precisa viver no touchpoint, que é o que
-- tem data e campanha.
--
-- EXPAND puro: só adiciona coluna nulável e índice.

BEGIN;

ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS aquisicao_id  uuid REFERENCES aquisicoes(id) ON DELETE CASCADE;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS gclid         text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS fbclid        text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS fbc           text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS fbp           text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS meta_lead_id  text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS adset_id      text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS ad_id         text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS provider      text;
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS metadata      jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pontos_contato_aquisicao ON pontos_contato (aquisicao_id);
CREATE INDEX IF NOT EXISTS idx_pontos_contato_campanha ON pontos_contato (campaign_id) WHERE campaign_id IS NOT NULL;
-- fbclid é a chave que a Meta usa para casar conversão com clique.
CREATE INDEX IF NOT EXISTS idx_pontos_contato_fbclid ON pontos_contato (fbclid) WHERE fbclid IS NOT NULL;

COMMIT;
