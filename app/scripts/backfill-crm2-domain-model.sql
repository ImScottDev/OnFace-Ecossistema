-- Backfill de recuperação legado -> Domain Model CRM2 (pessoas, pontos_contato,
-- oportunidades, oportunidade_itens, clientes, comercial_evidencia,
-- mrr_movimentos). Requer a migration 0012_reconciliation_and_crm2_domain_model.sql
-- já aplicada (schema CRM2 + reconciliação v1.1).
--
-- Idempotente: rodar de novo não duplica nada (chaves de idempotência:
-- pessoas.lead_id_legado, pontos_contato.lead_id_legado,
-- oportunidades.negocio_id_legado, oportunidade_itens.contrato_item_id_legado/
-- proposta_item_id_legado, clientes.lead_id_legado,
-- comercial_evidencia (negocio_id,tipo,source_ref), mrr_movimentos.evento_comercial_id).
--
-- USO:
--   psql -U callface -h localhost -d callface_crm -f backfill-crm2-domain-model.sql
-- Por padrão termina em ROLLBACK (dry-run seguro). Pra aplicar de verdade,
-- troque a última linha "ROLLBACK;" por "COMMIT;" antes de rodar.
--
-- Decisões incorporadas (2026-08-16, ver ARCHITECTURE_DECISIONS.md ADR-EXEC-019):
-- - Sem dedup automática de pessoa por e-mail/telefone/nome (só canonical_lead_id).
-- - service_family/revenue_nature NÃO entram em oportunidades — vivem em
--   oportunidade_itens (item), nunca no container.
-- - eventos_comerciais -> comercial_evidencia sempre (fato bruto -> normalizado);
--   eventos_comerciais -> mrr_movimentos só quando financeiramente determinístico
--   (família resolvível sem ambiguidade + empresa linkada). Sem heurística fraca.
-- - clientes.status_financeiro pode ficar "indefinido" — nunca inferido
--   artificialmente. Não é fonte concorrente de MRR: current MRR só vem de
--   servicos_canonicos.current_recurring_value.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _stats (destino text, metrica text, valor bigint);

-- ══════════════════════════════════════════════════════════════
-- FASE B — Backfill PESSOAS (leads dedup por canonical_lead_id)
-- ══════════════════════════════════════════════════════════════

CREATE TEMP TABLE _lead_canonical AS
SELECT l.id AS lead_id, coalesce(l.canonical_lead_id, l.id) AS canonical_id
FROM leads l;

INSERT INTO _stats VALUES ('pessoas', 'source_rows_leads', (SELECT count(*) FROM leads));
INSERT INTO _stats VALUES ('pessoas', 'dedup_groups', (SELECT count(DISTINCT canonical_id) FROM _lead_canonical));

WITH representative AS (
  SELECT DISTINCT ON (lc.canonical_id) l.*
  FROM leads l JOIN _lead_canonical lc ON lc.lead_id = l.id
  WHERE l.id = lc.canonical_id  -- prefer the canonical row itself as representative
  ORDER BY lc.canonical_id, l.created_at
),
missing_canonical AS (
  -- canonical_id points to a lead id that IS the representative already covered above;
  -- this branch covers groups where the canonical_id itself wasn't picked (shouldn't happen,
  -- kept for safety/idempotency)
  SELECT DISTINCT ON (lc.canonical_id) l.*
  FROM leads l JOIN _lead_canonical lc ON lc.lead_id = l.id
  WHERE lc.canonical_id NOT IN (SELECT id FROM representative)
  ORDER BY lc.canonical_id, l.created_at
),
all_reps AS (SELECT * FROM representative UNION ALL SELECT * FROM missing_canonical),
inserted AS (
  INSERT INTO pessoas (organizacao_id, empresa_id, nome, sobrenome, email, telefone, whatsapp, cargo, lead_id_legado, metadata, created_at, updated_at)
  SELECT organizacao_id, empresa_id, nome, sobrenome, email, telefone, whatsapp, cargo, id, jsonb_build_object('origem', 'backfill_prod_consolidado'), created_at, now()
  FROM all_reps
  ON CONFLICT (lead_id_legado) DO NOTHING
  RETURNING id
) INSERT INTO _stats VALUES ('pessoas', 'inserted', (SELECT count(*) FROM inserted));

INSERT INTO _stats VALUES ('pessoas', 'skipped_alias_leads', (SELECT count(*) FROM leads) - (SELECT count(DISTINCT canonical_id) FROM _lead_canonical));

-- ══════════════════════════════════════════════════════════════
-- FASE C — Backfill PONTOS_CONTATO (1 por lead, first-touch)
-- ══════════════════════════════════════════════════════════════

INSERT INTO _stats VALUES ('pontos_contato', 'source_rows', (SELECT count(*) FROM leads));

WITH inserted AS (
  INSERT INTO pontos_contato (organizacao_id, pessoa_id, empresa_id, source, medium, campaign, term, content, landing_page, campaign_id, tipo_origem, is_first_touch, is_last_touch, ocorrido_em, raw, lead_id_legado)
  SELECT l.organizacao_id, p.id, l.empresa_id, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_term, l.utm_content, l.landing_page, l.meta_campaign_id,
         coalesce(nullif(l.origem, ''), 'importacao'),
         true, true, l.created_at,
         jsonb_build_object('origem_legado', l.origem, 'fbclid', l.fbclid, 'gclid', l.gclid),
         l.id
  FROM leads l
  JOIN _lead_canonical lc ON lc.lead_id = l.id
  JOIN pessoas p ON p.lead_id_legado = lc.canonical_id
  ON CONFLICT (lead_id_legado) WHERE lead_id_legado IS NOT NULL DO NOTHING
  RETURNING id
) INSERT INTO _stats VALUES ('pontos_contato', 'inserted', (SELECT count(*) FROM inserted));

-- ══════════════════════════════════════════════════════════════
-- FASE D — Backfill OPORTUNIDADES (negocios -> oportunidades)
-- ══════════════════════════════════════════════════════════════

INSERT INTO _stats VALUES ('oportunidades', 'source_rows', (SELECT count(*) FROM negocios));

WITH inserted AS (
  INSERT INTO oportunidades (organizacao_id, pessoa_id, empresa_id, pipeline_id, stage, responsavel_id, valor, mrr, previsao_fechamento, motivo_perda, negocio_id_legado, created_at, updated_at)
  SELECT n.organizacao_id, p.id, coalesce(e.canonical_empresa_id, e.id), n.pipeline_id, n.status, n.responsavel_id,
         n.valor_total, n.mrr_estimado, NULL, n.motivo_perda, n.id, n.created_at, now()
  FROM negocios n
  LEFT JOIN leads l ON l.id = n.lead_id
  LEFT JOIN _lead_canonical lc ON lc.lead_id = l.id
  LEFT JOIN pessoas p ON p.lead_id_legado = lc.canonical_id
  LEFT JOIN empresas e ON e.id = coalesce(n.empresa_id, l.empresa_id)
  ON CONFLICT (negocio_id_legado) DO NOTHING
  RETURNING id, pessoa_id
) INSERT INTO _stats VALUES ('oportunidades', 'inserted', (SELECT count(*) FROM inserted));

INSERT INTO _stats VALUES ('oportunidades', 'unresolved_pessoa', (SELECT count(*) FROM oportunidades WHERE pessoa_id IS NULL));

-- ganhoAt/perdidoAt: negocios nao tem timestamp dedicado, deriva de status_changes
WITH ganho AS (
  SELECT DISTINCT ON (sc.negocio_id) sc.negocio_id, sc.created_at
  FROM status_changes sc WHERE sc.para_status = 'ganho' ORDER BY sc.negocio_id, sc.created_at DESC
), perdido AS (
  SELECT DISTINCT ON (sc.negocio_id) sc.negocio_id, sc.created_at
  FROM status_changes sc WHERE sc.para_status = 'perdido' ORDER BY sc.negocio_id, sc.created_at DESC
), upd AS (
  UPDATE oportunidades o SET ganho_at = g.created_at
  FROM ganho g WHERE g.negocio_id = o.negocio_id_legado AND o.ganho_at IS NULL
  RETURNING o.id
) INSERT INTO _stats VALUES ('oportunidades', 'ganho_at_backfilled', (SELECT count(*) FROM upd));

WITH perdido AS (
  SELECT DISTINCT ON (sc.negocio_id) sc.negocio_id, sc.created_at
  FROM status_changes sc WHERE sc.para_status = 'perdido' ORDER BY sc.negocio_id, sc.created_at DESC
), upd AS (
  UPDATE oportunidades o SET perdido_at = pd.created_at
  FROM perdido pd WHERE pd.negocio_id = o.negocio_id_legado AND o.perdido_at IS NULL
  RETURNING o.id
) INSERT INTO _stats VALUES ('oportunidades', 'perdido_at_backfilled', (SELECT count(*) FROM upd));

-- ══════════════════════════════════════════════════════════════
-- FASE D.2 — Backfill OPORTUNIDADE_ITENS
-- Prioridade por negocio: se tem contrato (venda fechada), usa contrato_itens
-- (composicao real contratada); senao usa proposta_itens (composicao proposta).
-- Nunca os dois pro mesmo negocio (evita duplicar item).
-- ══════════════════════════════════════════════════════════════

CREATE TEMP TABLE _negocio_tem_contrato AS
SELECT DISTINCT negocio_id FROM contratos WHERE negocio_id IS NOT NULL;

INSERT INTO _stats VALUES ('oportunidade_itens', 'source_rows_contrato_itens', (SELECT count(*) FROM contrato_itens));
INSERT INTO _stats VALUES ('oportunidade_itens', 'source_rows_proposta_itens', (SELECT count(*) FROM proposta_itens));

WITH from_contrato AS (
  INSERT INTO oportunidade_itens (organizacao_id, oportunidade_id, produto, service_family, revenue_nature, quantidade, preco_unitario, desconto, valor_total, origem_legado, contrato_item_id_legado, created_at, updated_at)
  SELECT o.organizacao_id, o.id, ci.nome, coalesce(ci.service_family, 'UNKNOWN'), coalesce(ci.revenue_nature, 'UNKNOWN'),
         ci.quantidade, ci.valor_unitario, ci.desconto, ci.subtotal, 'contrato_item', ci.id, ci.created_at, now()
  FROM contrato_itens ci
  JOIN contratos c ON c.id = ci.contrato_id
  JOIN oportunidades o ON o.negocio_id_legado = c.negocio_id
  WHERE c.negocio_id IS NOT NULL
  ON CONFLICT (contrato_item_id_legado) WHERE contrato_item_id_legado IS NOT NULL DO NOTHING
  RETURNING id
) INSERT INTO _stats VALUES ('oportunidade_itens', 'inserted_from_contrato_item', (SELECT count(*) FROM from_contrato));

WITH from_proposta AS (
  INSERT INTO oportunidade_itens (organizacao_id, oportunidade_id, produto, service_family, revenue_nature, quantidade, preco_unitario, desconto, valor_total, origem_legado, proposta_item_id_legado, created_at, updated_at)
  SELECT o.organizacao_id, o.id, pi.nome, coalesce(pi.service_family, 'UNKNOWN'), coalesce(pi.revenue_nature, 'UNKNOWN'),
         pi.quantidade, pi.valor_unitario, pi.desconto, pi.subtotal, 'proposta_item', pi.id, pi.created_at, now()
  FROM proposta_itens pi
  JOIN propostas pr ON pr.id = pi.proposta_id
  JOIN oportunidades o ON o.negocio_id_legado = pr.negocio_id
  WHERE pr.negocio_id IS NOT NULL
    AND pr.negocio_id NOT IN (SELECT negocio_id FROM _negocio_tem_contrato)
  ON CONFLICT (proposta_item_id_legado) WHERE proposta_item_id_legado IS NOT NULL DO NOTHING
  RETURNING id
) INSERT INTO _stats VALUES ('oportunidade_itens', 'inserted_from_proposta_item', (SELECT count(*) FROM from_proposta));

INSERT INTO _stats VALUES ('oportunidade_itens', 'skipped_sem_negocio_link', (
  (SELECT count(*) FROM contrato_itens ci JOIN contratos c ON c.id=ci.contrato_id WHERE c.negocio_id IS NULL)
  + (SELECT count(*) FROM proposta_itens pi JOIN propostas pr ON pr.id=pi.proposta_id WHERE pr.negocio_id IS NULL)
));

-- ══════════════════════════════════════════════════════════════
-- FASE E — Backfill CLIENTES (leads.tipo='cliente')
-- ══════════════════════════════════════════════════════════════

INSERT INTO _stats VALUES ('clientes', 'source_rows', (SELECT count(*) FROM leads WHERE tipo='cliente'));

WITH inserted AS (
  INSERT INTO clientes (organizacao_id, empresa_id, pessoa_principal_id, oportunidade_origem_id, cliente_desde, status_financeiro, lead_id_legado, created_at, updated_at)
  SELECT l.organizacao_id, coalesce(e.canonical_empresa_id, e.id), p.id,
         (SELECT o.id FROM oportunidades o WHERE o.pessoa_id = p.id ORDER BY o.created_at LIMIT 1),
         l.cliente_desde,
         CASE
           WHEN EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = coalesce(e.canonical_empresa_id, e.id) AND sc.commercial_lifecycle='ACTIVE' AND sc.portfolio_included) THEN 'ativo'
           WHEN EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = coalesce(e.canonical_empresa_id, e.id) AND sc.billing_status ILIKE 'PAST_DUE%') THEN 'inadimplente'
           WHEN EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = coalesce(e.canonical_empresa_id, e.id) AND sc.commercial_lifecycle='CHURNED') THEN 'churned'
           ELSE 'indefinido'
         END,
         l.id, l.created_at, now()
  FROM leads l
  LEFT JOIN _lead_canonical lc ON lc.lead_id = l.id
  LEFT JOIN pessoas p ON p.lead_id_legado = lc.canonical_id
  LEFT JOIN empresas e ON e.id = l.empresa_id
  WHERE l.tipo = 'cliente'
  ON CONFLICT (lead_id_legado) DO NOTHING
  RETURNING id, status_financeiro
) INSERT INTO _stats
  SELECT 'clientes', 'inserted_' || status_financeiro, count(*) FROM inserted GROUP BY status_financeiro;

INSERT INTO _stats VALUES ('clientes', 'total_inserted', (SELECT count(*) FROM clientes));

-- ══════════════════════════════════════════════════════════════
-- FASE F — Backfill COMERCIAL_EVIDENCIA (eventos_comerciais -> sempre)
-- ══════════════════════════════════════════════════════════════

INSERT INTO _stats VALUES ('comercial_evidencia', 'source_rows', (SELECT count(*) FROM eventos_comerciais));

WITH inserted AS (
  INSERT INTO comercial_evidencia (organizacao_id, negocio_id, tipo, source_ref, metadata, verificado_por, verificado_em)
  SELECT ec.organizacao_id, ec.negocio_id, 'manual_contract', ec.id::text,
         jsonb_build_object('eventos_comerciais_tipo', ec.tipo, 'origem', ec.origem, 'confianca', ec.confianca, 'evidencia', ec.evidencia, 'zoho_id', ec.zoho_id),
         NULL, ec.ocorrido_em
  FROM eventos_comerciais ec
  WHERE ec.negocio_id IS NOT NULL
  ON CONFLICT (negocio_id, tipo, source_ref) DO NOTHING
  RETURNING id
) INSERT INTO _stats VALUES ('comercial_evidencia', 'inserted', (SELECT count(*) FROM inserted));

INSERT INTO _stats VALUES ('comercial_evidencia', 'skipped_no_negocio', (SELECT count(*) FROM eventos_comerciais WHERE negocio_id IS NULL));

-- ══════════════════════════════════════════════════════════════
-- FASE G — Backfill MRR_MOVIMENTOS (de-para determinístico e idempotente)
-- churn/upgrade/downgrade sempre; renovacao só se montante != 0;
-- alteracao_contratual NUNCA. Resolve servico via empresa+keyword de familia
-- no nome_zoho (deterministico); sem match único = unresolved (nao insere).
-- ══════════════════════════════════════════════════════════════

CREATE TEMP TABLE _mrr_candidates AS
SELECT
  ec.id AS evento_id, ec.organizacao_id, ec.negocio_id, ec.ocorrido_em, ec.confianca,
  ec.evidencia,
  (ec.evidencia->>'montante')::numeric AS montante,
  ec.tipo AS evento_tipo,
  CASE ec.tipo
    WHEN 'churn' THEN 'churn'
    WHEN 'upgrade' THEN 'expansao'
    WHEN 'downgrade' THEN 'contracao'
    WHEN 'renovacao' THEN 'reativacao'
  END AS mrr_tipo,
  n.lead_id,
  l.empresa_id AS lead_empresa_id,
  CASE
    WHEN (ec.evidencia->>'nome_zoho') ILIKE '%callface ai%' OR (ec.evidencia->>'nome_zoho') ILIKE '% ai %' OR (ec.evidencia->>'nome_zoho') ILIKE '%ai|%' THEN 'CALLFACE_AI'
    WHEN (ec.evidencia->>'nome_zoho') ILIKE '%pabx%' THEN 'PABX'
    WHEN (ec.evidencia->>'nome_zoho') ILIKE '%white label%' OR (ec.evidencia->>'nome_zoho') ILIKE '%whitelabel%' THEN 'WHITE_LABEL'
    ELSE NULL
  END AS familia_inferida
FROM eventos_comerciais ec
JOIN negocios n ON n.id = ec.negocio_id
LEFT JOIN leads l ON l.id = n.lead_id
WHERE ec.tipo <> 'alteracao_contratual'
  AND NOT (ec.tipo = 'renovacao' AND coalesce((ec.evidencia->>'montante')::numeric, 0) = 0);

INSERT INTO _stats VALUES ('mrr_movimentos', 'candidatos_pos_filtro_tipo', (SELECT count(*) FROM _mrr_candidates));
INSERT INTO _stats VALUES ('mrr_movimentos', 'skipped_alteracao_contratual', (SELECT count(*) FROM eventos_comerciais WHERE tipo='alteracao_contratual'));
INSERT INTO _stats VALUES ('mrr_movimentos', 'skipped_renovacao_sem_delta', (SELECT count(*) FROM eventos_comerciais WHERE tipo='renovacao' AND coalesce((evidencia->>'montante')::numeric,0)=0));

CREATE TEMP TABLE _mrr_resolved AS
SELECT c.*, sc.id AS servico_id, sc.current_recurring_value AS mrr_depois_real,
       (SELECT count(*) FROM servicos_canonicos z WHERE z.empresa_id = coalesce(e.canonical_empresa_id, e.id) AND z.service_family = c.familia_inferida) AS match_count
FROM _mrr_candidates c
LEFT JOIN empresas e ON e.id = c.lead_empresa_id
LEFT JOIN servicos_canonicos sc ON sc.empresa_id = coalesce(e.canonical_empresa_id, e.id) AND sc.service_family = c.familia_inferida;

INSERT INTO _stats VALUES ('mrr_movimentos', 'unresolved_sem_empresa', (SELECT count(*) FROM _mrr_resolved WHERE lead_empresa_id IS NULL));
INSERT INTO _stats VALUES ('mrr_movimentos', 'unresolved_familia_nao_inferida', (SELECT count(*) FROM _mrr_resolved WHERE lead_empresa_id IS NOT NULL AND familia_inferida IS NULL));
INSERT INTO _stats VALUES ('mrr_movimentos', 'unresolved_match_ambiguo_ou_zero', (SELECT count(DISTINCT evento_id) FROM _mrr_resolved WHERE familia_inferida IS NOT NULL AND match_count <> 1));

WITH resolved_unique AS (
  SELECT DISTINCT ON (evento_id) *
  FROM _mrr_resolved
  WHERE familia_inferida IS NOT NULL AND match_count = 1
),
signed AS (
  SELECT *,
    CASE mrr_tipo WHEN 'churn' THEN -abs(montante) WHEN 'contracao' THEN -abs(montante) ELSE abs(montante) END AS delta_assinado
  FROM resolved_unique
),
inserted AS (
  INSERT INTO mrr_movimentos (organizacao_id, lead_id, contrato_id, produto, tipo, delta, mrr_antes, mrr_depois, ocorrido_em, origem, evento_comercial_id)
  SELECT organizacao_id, lead_id, NULL,
         CASE familia_inferida WHEN 'CALLFACE_AI' THEN 'ai' WHEN 'PABX' THEN 'pabx' ELSE 'white_label' END,
         mrr_tipo, delta_assinado, mrr_depois_real - delta_assinado, mrr_depois_real, ocorrido_em, 'backfill', evento_id
  FROM signed
  ON CONFLICT (evento_comercial_id) WHERE evento_comercial_id IS NOT NULL DO NOTHING
  RETURNING id
) INSERT INTO _stats VALUES ('mrr_movimentos', 'inserted', (SELECT count(*) FROM inserted));

-- ══════════════════════════════════════════════════════════════
-- FASE H — Invariantes financeiros (nao pode ter mudado NADA)
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE p numeric; a numeric; w numeric; total numeric; july numeric;
BEGIN
  SELECT coalesce(sum(current_recurring_value),0) INTO p FROM servicos_canonicos WHERE portfolio_included AND revenue_nature='MRR' AND commercial_lifecycle='ACTIVE' AND service_family='PABX';
  SELECT coalesce(sum(current_recurring_value),0) INTO a FROM servicos_canonicos WHERE portfolio_included AND revenue_nature='MRR' AND commercial_lifecycle='ACTIVE' AND service_family='CALLFACE_AI';
  SELECT coalesce(sum(current_recurring_value),0) INTO w FROM servicos_canonicos WHERE portfolio_included AND revenue_nature='MRR' AND commercial_lifecycle='ACTIVE' AND service_family='WHITE_LABEL';
  total := p+a+w;
  SELECT imported_total INTO july FROM service_ledger_batches LIMIT 1;
  IF p<>368049.69 OR a<>53505.10 OR w<>4064.60 OR total<>425619.39 THEN RAISE EXCEPTION 'MRR mismatch PABX=% AI=% WL=% TOTAL=%',p,a,w,total; END IF;
  IF july<>445375.74 THEN RAISE EXCEPTION 'July ledger mismatch: %',july; END IF;
END $$;

SELECT destino, metrica, valor FROM _stats ORDER BY destino, metrica;

ROLLBACK;
