-- 0088 — um snapshot de health por conta por dia
--
-- `cs_health_snapshots` existe desde a 0057 e tinha ZERO escritores: nenhum
-- código calculava score. O motor de CS em volta dela está vivo — 514 riscos
-- reais, job cs-sweep rodando, painel lendo — e o que faltava era só o cálculo
-- e a materialização.
--
-- Esta migration acrescenta a chave de idempotência que o sweep precisa. Sem
-- ela, o sweep rodando de hora em hora empilharia uma linha por execução, que
-- é exatamente o erro que os snapshots do Callface AI cometeram antes da
-- correção: 208 viraram 416 na segunda rodada porque a chave usava o instante
-- da execução em vez do dia.
--
-- Aditiva. Nenhuma coluna sai.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS uq_cs_health_dia;

-- O snapshot é do DIA, não do instante: reexecutar o sweep no mesmo dia
-- ATUALIZA a avaliação em vez de criar outra.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cs_health_dia
  -- (calculated_at::date) cru não é IMMUTABLE: o resultado depende do fuso da
-- sessão. Converter para UTC antes fixa o dia numa régua só e torna a
-- expressão indexável.
  ON cs_health_snapshots (empresa_id, ((calculated_at AT TIME ZONE 'UTC')::date), calculation_version);
