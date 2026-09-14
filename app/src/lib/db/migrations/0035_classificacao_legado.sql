-- Camada de classificação do CATÁLOGO LEGADO (leitura/relatório/Cliente 360).
--
-- A camada JÁ EXISTIA: `catalogo_mapeamentos_legacy`, 193 linhas, com
-- legacy_product_id, legacy_name, canonical_product_id, canonical_name,
-- service_family, default_revenue_nature, confidence e evidence. Nada de novo
-- foi criado no lugar dela — só faltavam 4 campos do briefing.
--
-- O problema real dela hoje NÃO é a estrutura, é o preenchimento:
--   - 103 das 193 linhas (53%) estão service_family='UNKNOWN' e
--     default_revenue_nature='UNKNOWN', incluindo itens obviamente
--     classificáveis ("HEADSET USB", "TELEFONE FANVIL C600",
--     "GATEWAY FXO – 8 PORTAS", "SOLUÇÃO 3CX - LICENÇA");
--   - as 193 linhas têm confidence='CONFIRMED', inclusive as UNKNOWN —
--     "confirmado como não classificado" é um dado que mente, e mata o valor
--     do campo justamente onde ele deveria pedir revisão humana;
--   - itens idênticos divergem ("TELEFONE FANVIL X7" = PABX/MRR mas
--     "TELEFONE FANVIL C600" = UNKNOWN).
--
-- Nada aqui apaga, renomeia ou reclassifica contrato, assinatura, fatura ou
-- serviço. É camada de LEITURA.

ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS legacy_source text;      -- contrato_itens | fatura_itens | servicos_catalogo | proposta_itens (agregado)
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS categoria_crm text;      -- plano | setup | linha | ramal | hardware | ... | ajuste_financeiro
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS rule_source text;        -- planilha_oficial | regra_ajuste | regra_nome | generico_ambiguo | sem_evidencia
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS reviewed_status text NOT NULL DEFAULT 'pendente'; -- pendente | revisado | ignorado
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS revisado_por uuid REFERENCES usuarios(id);
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS revisado_em timestamptz;
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS ocorrencias integer NOT NULL DEFAULT 0; -- em quantas linhas do histórico esse nome aparece
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS classificado_em timestamptz;

-- `updated_at` não existia (a tabela nasceu como append-only da reconciliação).
-- Necessário agora que o classificador reprocessa e atualiza linhas.
ALTER TABLE catalogo_mapeamentos_legacy ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- `id` não tinha default (era sempre gerado pelo script de reconciliação).
-- Sem isso o upsert do classificador precisaria gerar UUID na aplicação.
ALTER TABLE catalogo_mapeamentos_legacy ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_catalogo_mapeamentos_legacy_familia
  ON catalogo_mapeamentos_legacy (organizacao_id, service_family, confidence);
CREATE INDEX IF NOT EXISTS idx_catalogo_mapeamentos_legacy_revisao
  ON catalogo_mapeamentos_legacy (organizacao_id, reviewed_status, confidence);

-- ─────────────────────────────────────────────────────────────────────────────
-- Chave de JOIN estável entre o histórico e a classificação.
--
-- As 193 linhas que já existiam usam o ID do produto no Zoho como
-- `legacy_product_id` (rastreabilidade real, preservada). As novas usam
-- `nome:<normalizado>`. Ou seja: `legacy_product_id` NÃO serve pra casar com
-- `contrato_itens.nome` / `fatura_itens.nome`.
--
-- `nome_normalizado` é coluna GERADA (sempre coerente com legacy_name, sem
-- risco de dessincronizar) e resolve o JOIN com um índice, em vez de repetir
-- translate+regexp em cada consulta de relatório.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE catalogo_mapeamentos_legacy
  ADD COLUMN IF NOT EXISTS nome_normalizado text
  GENERATED ALWAYS AS (
    btrim(regexp_replace(
      lower(translate(legacy_name,
        'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
      '[^a-z0-9]+', ' ', 'g'))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_catalogo_mapeamentos_legacy_nome_norm
  ON catalogo_mapeamentos_legacy (organizacao_id, nome_normalizado);

-- Função equivalente pro lado do histórico, pra não repetir a expressão.
CREATE OR REPLACE FUNCTION normalizar_nome_produto(txt text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    lower(translate(txt,
      'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
      'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
    '[^a-z0-9]+', ' ', 'g'))
$$;
