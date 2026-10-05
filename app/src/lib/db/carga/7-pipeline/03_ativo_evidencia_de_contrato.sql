-- CARGA DA VIRADA · pipeline, passo 03 — o `ativo` que o passo 02 não alcançou.
--
-- POR QUE ESTE ARQUIVO EXISTE (e não é reescrita do 02)
--
-- O passo 02 testa a evidência pela EMPRESA: existe cliente, serviço canônico
-- ou fatura paga em `empresa_id`. Medido no ensaio, isso alcança 16 dos 159
-- negócios com `status = 'ativo'`. Os outros 143 continuaram sentados em
-- ENTRADA — que é exatamente o cartão incoerente que o Kauã viu na tela:
-- cliente pagando, com contrato assinado, parado na primeira coluna do funil.
--
-- A evidência que faltou olhar é `contratos`, e ela cobre 159 de 159:
--
--   contratos com `lead_id`     774 de 774
--   contratos com `negocio_id`  350 de 774   ← por isso o vínculo direto falha
--   dos 159 `ativo`: 159 têm contrato cujo `inicio` cai na janela do negócio
--
-- SPEC — specdrive-modulo-01-vendas-final.md, Bloco 02 §19 "Ganho / Won":
-- "O estado WON é consequência de um gate de evidência válido para aquela
-- família e para aquele modo comercial." Contrato assinado com data de início
-- é o gate. §20 lista os fluxos (pagamento confirmado, contrato) — os dois
-- deixam rastro datado, e é esse rastro que vira `ganho_at`.
--
-- VAULT — decisão 4 do Kauã (05/10): "ativos é cliente ativo, não tem nada a
-- ver com comercial; ficaria em ganho dependendo do caso. No nosso pipeline
-- não tem essa coluna." E a regra dura: com evidência → GANHO com a data REAL
-- da evidência; sem evidência → não chutar, marcar para revisão.
--
-- A DATA, e por que a janela de 7 dias não é enfeite. Nota de memória
-- `callface_datas_reconciliacao_nao_sao_reais`: data de reconciliação não é
-- data de venda. Por isso `servicos_canonicos.created_at` e `negocios.updated_at`
-- estão PROIBIDOS como fonte aqui — `updated_at` sobe a cada toque na linha.
-- E `min(contratos.inicio)` SEM janela também erra: um lead acumula até 11
-- contratos de vendas diferentes. Caso real medido — VENDA NA VEIA: negócio
-- criado em 14/07, contrato mais antigo do lead em 10/05, de outra venda.
--
-- ORDEM DE FORÇA DA EVIDÊNCIA:
--   a) contrato ligado DIRETO ao negócio              → contratos.inicio
--   b) contrato do mesmo lead iniciado na janela      → contratos.inicio
--   c) primeira fatura PAGA do lead na janela         → faturas.paga_em
--   nenhuma das três → NÃO promove, marca para revisão.
--
-- Este passo também RE-DATA os 16 que o passo 02 já promoveu: a data deles veio
-- de `min(faturas.paga_em)` por EMPRESA, que pode ser a fatura de outra venda
-- da mesma empresa, ou do fallback `n.updated_at`. Convergem para a mesma
-- evidência dos outros 143 — uma fonte só para os 159.
--
-- IDEMPOTENTE: a promoção é filtrada pelo estado de origem; a re-datação é
-- convergente (recalcula o mesmo valor) e só escreve quando difere.

BEGIN;

-- ---------------------------------------------------------------------------
-- A evidência, uma vez só, para os dois passos abaixo.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _evid_ativo ON COMMIT DROP AS
SELECT o.id            AS oportunidade_id,
       o.pipeline_id,
       o.etapa,
       o.ganho_at,
       COALESCE(
         (SELECT min(c.inicio)::timestamptz FROM contratos c
           WHERE c.negocio_id = n.id AND c.inicio IS NOT NULL),
         (SELECT min(c.inicio)::timestamptz FROM contratos c
           WHERE c.lead_id = n.lead_id AND c.inicio IS NOT NULL
             AND c.inicio >= (n.created_at - interval '7 days')::date),
         (SELECT min(f.paga_em) FROM faturas f
           WHERE f.lead_id = n.lead_id AND f.paga_em IS NOT NULL
             AND f.paga_em >= n.created_at - interval '7 days')
       ) AS ganho_em
  FROM negocios n
  JOIN oportunidades o ON o.negocio_id_legado = n.id
 WHERE n.status = 'ativo';

-- ---------------------------------------------------------------------------
-- 1. COM evidência → GANHO. Sem evidência a linha NÃO se move.
-- ---------------------------------------------------------------------------
UPDATE oportunidades o
   SET etapa      = 'ganho',
       stage      = 'ganho',
       etapa_id   = COALESCE(pe.id, o.etapa_id),
       ganho_at   = e.ganho_em,
       updated_at = now()
  FROM _evid_ativo e
  LEFT JOIN pipeline_etapas pe
    ON pe.pipeline_id = e.pipeline_id AND pe.codigo = 'ganho'
 WHERE o.id = e.oportunidade_id
   AND e.ganho_em IS NOT NULL
   AND COALESCE(o.etapa, '') <> 'ganho';

-- ---------------------------------------------------------------------------
-- 2. RE-DATA quem já estava em ganho com data de outra fonte (os 16 do passo 02).
-- ---------------------------------------------------------------------------
UPDATE oportunidades o
   SET ganho_at   = e.ganho_em,
       updated_at = now()
  FROM _evid_ativo e
 WHERE o.id = e.oportunidade_id
   AND e.ganho_em IS NOT NULL
   AND o.etapa = 'ganho'
   AND o.ganho_at IS DISTINCT FROM e.ganho_em;

-- ---------------------------------------------------------------------------
-- 3. SEM evidência: fica onde está, com o motivo escrito. Nunca inventar venda.
-- ---------------------------------------------------------------------------
INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe)
SELECT 'oportunidade', e.oportunidade_id, 'revisar_ativo_sem_contrato_nem_pagamento',
       'negocio legado status=ativo sem contrato (direto ou do lead na janela) e sem fatura paga na janela — nao promovido a Ganho'
  FROM _evid_ativo e
 WHERE e.ganho_em IS NULL
ON CONFLICT (entidade, entidade_id, motivo) DO NOTHING;

-- Quem ganhou evidência depois deixa de ser suspeito.
DELETE FROM _carga_registros_suspeitos s
 USING _evid_ativo e
 WHERE s.entidade = 'oportunidade'
   AND s.entidade_id = e.oportunidade_id
   AND s.motivo IN ('revisar_ativo_sem_contrato_nem_pagamento', 'revisar_status_ativo_sem_evidencia')
   AND e.ganho_em IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. O fato na timeline. SPEC Bloco 02 §27 "Histórico/eventos mínimos": o ganho
--    é evento, não só coluna. O tipo `oportunidade_ganha` já existe na base.
-- ---------------------------------------------------------------------------
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                             tipo, titulo, descricao, actor_type, occurred_at, metadata)
SELECT o.organizacao_id, o.empresa_id, o.pessoa_id, o.id,
       'oportunidade_ganha', 'Oportunidade ganha',
       'Reconhecida na virada ONFACE por evidência de contrato/pagamento (status legado: ativo)',
       'SYSTEM', o.ganho_at,
       jsonb_build_object('origem', 'carga-virada/7-pipeline/03',
                          'status_legado', 'ativo', 'spec', 'Bloco 02 §19')
  FROM oportunidades o
  JOIN _evid_ativo e ON e.oportunidade_id = o.id
 WHERE o.etapa = 'ganho' AND o.ganho_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM timeline_events te
                    WHERE te.oportunidade_id = o.id AND te.tipo = 'oportunidade_ganha');

-- ---------------------------------------------------------------------------
-- 5. Borda: oportunidade sem `pipeline_id` fica sem `etapa_id`, e a FK é por
--    onde o detalhe e as automações caminham. Cai no pipeline padrão.
-- ---------------------------------------------------------------------------
UPDATE oportunidades o
   SET pipeline_id = p.id, updated_at = now()
  FROM pipelines p
 WHERE p.organizacao_id = o.organizacao_id AND p.is_default AND p.tipo = 'SALES'
   AND o.pipeline_id IS NULL;

UPDATE oportunidades o
   SET etapa_id = pe.id, updated_at = now()
  FROM pipeline_etapas pe
 WHERE pe.pipeline_id = o.pipeline_id AND pe.codigo = o.etapa
   AND o.etapa_id IS NULL AND o.etapa IS NOT NULL;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO
-- ---------------------------------------------------------------------------
DO $$
DECLARE ganhos int; parados int; revisar int; sem_data int; sem_fk int; mal_datado int;
BEGIN
  SELECT count(*) FILTER (WHERE o.etapa = 'ganho'),
         count(*) FILTER (WHERE o.etapa <> 'ganho')
    INTO ganhos, parados
    FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
   WHERE n.status = 'ativo';

  SELECT count(*) INTO revisar FROM _carga_registros_suspeitos
   WHERE motivo IN ('revisar_ativo_sem_contrato_nem_pagamento','revisar_status_ativo_sem_evidencia');

  SELECT count(*) INTO sem_data FROM oportunidades
   WHERE (etapa = 'ganho' AND ganho_at IS NULL) OR (etapa = 'perdido' AND perdido_at IS NULL);

  SELECT count(*) INTO sem_fk FROM oportunidades WHERE etapa IS NOT NULL AND etapa_id IS NULL;

  -- Nenhum ganho vindo de `ativo` pode carregar updated_at como data de venda.
  SELECT count(*) INTO mal_datado
    FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
   WHERE n.status = 'ativo' AND o.ganho_at = n.updated_at;

  RAISE NOTICE '── status ativo: % em GANHO · % ainda parados · % para revisao', ganhos, parados, revisar;
  RAISE NOTICE '── ganho/perdido sem data: % · sem etapa_id: % · datado por updated_at: %',
               sem_data, sem_fk, mal_datado;

  IF parados <> revisar THEN
    RAISE EXCEPTION 'passo 03 nao fechou: % parados mas % marcados para revisao', parados, revisar;
  END IF;
  IF sem_data > 0 OR mal_datado > 0 THEN
    RAISE EXCEPTION 'passo 03 nao fechou: % sem data, % datados por updated_at', sem_data, mal_datado;
  END IF;
END $$;

COMMIT;
