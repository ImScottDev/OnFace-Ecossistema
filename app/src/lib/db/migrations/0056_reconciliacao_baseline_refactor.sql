-- Reconciliação de baseline do refactor de arquitetura (fase 01).
--
-- O levantamento AS-IS (docs/architecture/database-as-is/07-diferencas-schema-vs-banco.md)
-- mediu drift entre o schema Drizzle e o PostgreSQL. Esta migration fecha o lado do
-- banco; o lado do schema.ts é ajustado no mesmo commit.
--
-- Nada aqui é destrutivo. Todas as condições foram verificadas antes:
--   - as 4 colunas organizacao_id têm ZERO nulos hoje;
--   - as 3 relações têm ZERO órfãos hoje.
-- Se qualquer uma dessas premissas deixar de valer, o comando falha e a transação
-- inteira volta, em vez de corromper dado.
--
-- Reversível: cada ALTER tem o inverso comentado ao lado.

BEGIN;

-- ─── 1. organizacao_id obrigatório nas tabelas de tenant ──────────────────────
-- SPEC §5: "All tenant-owned canonical tables must contain organizacao_id NOT NULL".
-- O Drizzle já prometia NOT NULL nas quatro; o banco aceitava NULL. A promessa do
-- tipo TypeScript não era garantida por ninguém: uma escrita por SQL cru ou por
-- integração podia gravar NULL e o erro apareceria longe da origem.
-- Reverter: ALTER TABLE <t> ALTER COLUMN organizacao_id DROP NOT NULL;

ALTER TABLE contratos      ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE assinaturas    ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE faturas        ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE mrr_movimentos ALTER COLUMN organizacao_id SET NOT NULL;

-- ─── 2. Foreign keys que o Drizzle declarava e o banco não tinha ──────────────
-- Sem elas, o banco aceitava referência para linha inexistente. No caso de
-- leads.canonical_lead_id isso é especialmente sério: é a coluna de deduplicação,
-- e uma cadeia quebrada não seria detectada na escrita.
-- Reverter: ALTER TABLE <t> DROP CONSTRAINT <nome>;

ALTER TABLE leads
  ADD CONSTRAINT leads_canonical_lead_id_fkey
  FOREIGN KEY (canonical_lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE mrr_movimentos
  ADD CONSTRAINT mrr_movimentos_evento_comercial_id_fkey
  FOREIGN KEY (evento_comercial_id) REFERENCES eventos_comerciais(id) ON DELETE SET NULL;

ALTER TABLE proposta_grupo_comercial
  ADD CONSTRAINT proposta_grupo_comercial_oportunidade_id_fkey
  FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id) ON DELETE SET NULL;

COMMIT;
