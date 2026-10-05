-- CARGA DA VIRADA · pipeline, passo 02 — o status "ativo" resolvido por evidência.
--
-- 159 negócios de produção estão com `status='ativo'`. Isso NÃO é etapa do funil
-- comercial e não aparece em nenhuma coluna do pipeline que o time usa. Palavras
-- do Scott (05/10): "ativos é outra coisa, não tem nada a ver com comercial, é
-- cliente ativo; ficaria em ganho dependendo do caso, que de lá criasse cliente,
-- onboarding e outras coisas; no nosso pipeline não tem essa coluna".
--
-- O backfill 07 jogou os 159 em ENTRADA, que é o pior destino possível: vira
-- negócio novo no topo do funil.
--
-- EVIDÊNCIA MEDIDA (05/10), por negócio:
--     tem contrato ................  0
--     tem fatura paga .............  14
--     tem serviço canônico ........  15
--     virou cliente ...............  11
--     SEM evidência nenhuma ....... 144
--
-- Só 15 têm como provar que viraram cliente. Os outros 144 não têm nada, e
-- transformá-los em GANHO inventaria 144 vendas que ninguém mediu — exatamente
-- o tipo de dado que depois vira meta batida que não existiu.
--
-- Então: quem tem evidência vira GANHO, com a data REAL da evidência (a fatura
-- paga mais antiga, ou a entrada do cliente na carteira). Quem não tem fica onde
-- está e sai marcado para revisão humana, com o motivo escrito.
--
-- IDEMPOTENTE: a segunda execução não acha mais 'ativo' com evidência fora de ganho.

-- 1. COM evidência -> GANHO, com data real
WITH com_evidencia AS (
  SELECT o.id AS oportunidade_id,
         COALESCE(
           (SELECT min(COALESCE(f.paga_em, f.vencimento, f.emitida_em))
              FROM faturas f WHERE f.empresa_id = n.empresa_id AND f.status = 'paga'),
           (SELECT min(cl.cliente_desde) FROM clientes cl WHERE cl.empresa_id = n.empresa_id),
           (SELECT min(cl.entrou_carteira_em) FROM clientes cl WHERE cl.empresa_id = n.empresa_id),
           n.updated_at
         ) AS ganho_em,
         (SELECT pe2.id FROM pipeline_etapas pe2
           WHERE pe2.pipeline_id = o.pipeline_id AND pe2.codigo = 'ganho' LIMIT 1) AS etapa_ganho
    FROM negocios n
    JOIN oportunidades o ON o.negocio_id_legado = n.id
   WHERE n.status = 'ativo'
     AND (EXISTS (SELECT 1 FROM clientes cl WHERE cl.empresa_id = n.empresa_id)
       OR EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = n.empresa_id)
       OR EXISTS (SELECT 1 FROM faturas f WHERE f.empresa_id = n.empresa_id AND f.status = 'paga'))
)
UPDATE oportunidades o
   SET etapa_id   = COALESCE(e.etapa_ganho, o.etapa_id),
       etapa      = 'ganho',
       stage      = 'ganho',
       ganho_at   = e.ganho_em,
       updated_at = now()
  FROM com_evidencia e
 WHERE o.id = e.oportunidade_id
   AND COALESCE(o.etapa, '') <> 'ganho';

-- 2. SEM evidência -> fica onde está, marcado para revisão
-- A tabela nasceu na limpeza aceitando so lead/pessoa/contato/empresa.
-- Oportunidade tambem precisa ser marcavel: e a entidade desta revisao.
ALTER TABLE IF EXISTS _carga_registros_suspeitos
  DROP CONSTRAINT IF EXISTS _carga_registros_suspeitos_entidade_check;
ALTER TABLE IF EXISTS _carga_registros_suspeitos
  ADD CONSTRAINT _carga_registros_suspeitos_entidade_check
  CHECK (entidade = ANY (ARRAY['lead','pessoa','contato','empresa','oportunidade']));

CREATE TABLE IF NOT EXISTS _carga_registros_suspeitos (
  entidade text NOT NULL, entidade_id uuid NOT NULL, motivo text NOT NULL,
  detalhe text, detectado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entidade, entidade_id, motivo)
);

INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe)
SELECT 'oportunidade', o.id, 'revisar_status_ativo_sem_evidencia',
       'negócio com status ativo no legado e nenhuma evidência de cliente (sem contrato, sem serviço canônico, sem fatura paga). Não foi promovido a ganho para não inventar venda.'
  FROM negocios n
  JOIN oportunidades o ON o.negocio_id_legado = n.id
 WHERE n.status = 'ativo'
   AND NOT EXISTS (SELECT 1 FROM clientes cl WHERE cl.empresa_id = n.empresa_id)
   AND NOT EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = n.empresa_id)
   AND NOT EXISTS (SELECT 1 FROM faturas f WHERE f.empresa_id = n.empresa_id AND f.status = 'paga')
ON CONFLICT DO NOTHING;

DO $$
DECLARE ganhos int; revisar int;
BEGIN
  SELECT count(*) INTO ganhos FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
   WHERE n.status = 'ativo' AND o.etapa = 'ganho';
  SELECT count(*) INTO revisar FROM _carga_registros_suspeitos
   WHERE motivo = 'revisar_status_ativo_sem_evidencia';
  RAISE NOTICE '── status ativo: % viraram GANHO com evidência · % marcados para revisão', ganhos, revisar;
END $$;
