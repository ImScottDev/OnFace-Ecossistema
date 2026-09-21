-- 0087 — Metric Catalog mínimo (Documento Mestre v0.13, Módulo 12)
--
-- "Uma métrica = uma definição oficial." Hoje não é o caso, e dá para medir:
-- a palavra MRR sai de QUATRO fontes diferentes no código de analytics, e no
-- banco real de 21/09/2026 elas devolvem números que variam oito vezes.
--
--   negocios.mrr_fechado (ganhos) ................ R$ 497.904,42   603 linhas
--   servicos_canonicos.current_recurring_value ... R$ 426.619,39   432 linhas
--   assinaturas.mrr (active/past_due/trialing) ... R$  61.769,55   153 linhas
--   mrr_movimentos (soma dos deltas) ............. R$  81.308,35   665 linhas
--
-- Não são erros de cálculo: são conceitos diferentes com o mesmo nome. O
-- primeiro é BOOKING acumulado desde sempre, o segundo é o recorrente ATUAL, o
-- terceiro é só o que está no Stripe (o PABX legado não está), e o quarto é o
-- livro de movimentos. O Módulo 11 exige que Venda, Faturamento, Recebimento e
-- MRR sejam conceitos distintos; o Módulo 12 exige uma definição por métrica.
--
-- Esta tabela é o REGISTRO das definições, não o motor. O cálculo mora em
-- código versionado (lib/metricas/catalogo.ts) e é materializado aqui para
-- descoberta, drill-down e para o NEXO consultar em vez de inventar.
--
-- Mínimo de propósito: seis métricas, as quatro financeiras que o Módulo 11
-- manda separar mais duas operacionais. Não é um BI; é a fonte única das
-- métricas que as telas já consomem hoje.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS metric_catalog;

CREATE TABLE IF NOT EXISTS metric_catalog (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         text NOT NULL,
  nome           text NOT NULL,
  -- EVENT    = conta fatos datados num período (venda, fatura, pagamento)
  -- SNAPSHOT = estado num instante (MRR atual, clientes ativos)
  -- COHORT   = acompanha um grupo ao longo do tempo
  -- Misturar os três é o que produz "conversão" dividindo snapshots
  -- independentes, que o Módulo 12 proíbe explicitamente.
  tipo           text NOT NULL,
  unidade        text NOT NULL,
  descricao      text NOT NULL,
  -- De onde o número sai, em português, para quem lê o relatório entender sem
  -- abrir o código.
  fonte          text NOT NULL,
  -- O que esta métrica deliberadamente NÃO inclui. É o campo que impede a
  -- próxima pessoa de somar setup no MRR "porque parecia receita".
  nao_inclui     text,
  versao         integer NOT NULL DEFAULT 1,
  tem_drilldown  boolean NOT NULL DEFAULT true,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ck_metric_catalog_tipo CHECK (tipo IN ('EVENT','SNAPSHOT','COHORT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_catalog_codigo ON metric_catalog (codigo);
