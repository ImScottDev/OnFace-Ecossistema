-- 0084 — estagnação passa a ter casa no modelo canônico (SPEC §11.1)
--
-- Medido: `negocios.motivo_estagnacao` está preenchido em 227 registros, e nos
-- 227 o valor é IDÊNTICO ao `negocios.status`: outra_data, sem_retorno,
-- trava_negociacao, trava_assinatura. Não é dedução minha — é uma coluna que
-- espelha a outra.
--
-- Isso NÃO torna o dado inventado: esses quatro valores são motivos reais que
-- alguém registrou (o cliente pediu outra data, não respondeu, travou a
-- negociação, travou a assinatura). O vocabulário legado é que guardava motivo
-- e posição na mesma coluna. O que falta é casa canônica para o motivo.
--
-- Os 227 estão TODOS em oportunidade aberta (141 proposta, 39 entrada, 25
-- negociação, 22 diagnóstico) e nenhum em ganho ou perdido — `aplicarEtapa` já
-- limpa a estagnação ao mudar de etapa. É dado vivo, não histórico morto.
--
-- Aditiva. As colunas do legado continuam sendo escritas pela ponte.
--
-- ROLLBACK:
--   ALTER TABLE oportunidades DROP COLUMN IF EXISTS motivo_estagnacao;
--   ALTER TABLE oportunidades DROP COLUMN IF EXISTS estagnado_em;

ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS motivo_estagnacao text;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS estagnado_em timestamp with time zone;

UPDATE oportunidades o
   SET motivo_estagnacao = n.motivo_estagnacao,
       estagnado_em = n.estagnado_em,
       updated_at = o.updated_at
  FROM negocios n
 WHERE o.negocio_id_legado = n.id
   AND n.motivo_estagnacao IS NOT NULL
   AND o.ganho_at IS NULL AND o.perdido_at IS NULL
   AND o.motivo_estagnacao IS NULL;

CREATE INDEX IF NOT EXISTS idx_oportunidades_estagnadas
  ON oportunidades (organizacao_id, estagnado_em)
  WHERE motivo_estagnacao IS NOT NULL AND ganho_at IS NULL AND perdido_at IS NULL;
