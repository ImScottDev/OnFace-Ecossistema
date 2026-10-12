-- De/Para de contratos (somente leitura). Uma linha por contrato.
-- Pergunta: este contrato aponta para a empresa que paga? Se não, o que o sistema já sabe que sugere outra?
-- Nenhuma associação é inferida por nome parecido. Evidências usadas, todas já gravadas:
--   contrato.empresa_id, negocio.empresa_id (negócio do contrato), lead.empresa_id, mesma empresa por CNPJ,
--   billing_identities (empresa canônica do pagador), assinaturas Stripe, serviços canônicos, documentos assinados.
-- "Pagante" = empresa com MRR na última competência fechada de cliente_receita_mensal.
WITH uc AS (SELECT max(competencia) c FROM cliente_receita_mensal),
pag AS (SELECT DISTINCT empresa_id FROM cliente_receita_mensal, uc WHERE competencia = uc.c AND revenue_nature = 'MRR' AND empresa_id IS NOT NULL),
cnj AS (SELECT id, nome, NULLIF(regexp_replace(coalesce(cnpj,''),'\D','','g'),'') cnpj FROM empresas),
docs AS (SELECT entidade_id contrato_id, count(*) FILTER (WHERE categoria='documento_assinado') assinados, count(*) docs
           FROM anexos_legado WHERE entidade_tipo='contrato' GROUP BY 1),
doc_neg AS (SELECT entidade_id negocio_id, count(*) FILTER (WHERE categoria='documento_assinado') assinados
              FROM anexos_legado WHERE entidade_tipo='negocio' GROUP BY 1),
sc AS (SELECT contrato_id, count(*) servicos, count(*) FILTER (WHERE commercial_lifecycle='ACTIVE') servicos_ativos,
              string_agg(DISTINCT service_family, ',') familias
         FROM servicos_canonicos WHERE contrato_id IS NOT NULL GROUP BY 1),
ass AS (SELECT contrato_id, count(*) assinaturas FROM assinaturas WHERE contrato_id IS NOT NULL GROUP BY 1),
bi AS (SELECT coalesce(empresa_id, canonical_empresa_id) empresa_id, count(*) identidades FROM billing_identities GROUP BY 1)
SELECT
  c.id contrato_id, c.zoho_id, c.codigo_legado, c.status, c.produto, c.service_family, c.inicio, c.vencimento, c.mrr,
  ec.id empresa_contrato_id, ec.nome empresa_contrato, ec.cnpj cnpj_contrato,
  en.id empresa_negocio_id, en.nome empresa_negocio, el.id empresa_lead_id,
  (c.empresa_id IN (SELECT empresa_id FROM pag)) contrato_em_pagante,
  (n.empresa_id IN (SELECT empresa_id FROM pag)) negocio_em_pagante,
  coalesce(d.assinados,0) docs_assinados, coalesce(d.docs,0) docs_total, coalesce(dn.assinados,0) docs_assinados_no_negocio,
  coalesce(sc.servicos,0) servicos_canonicos, coalesce(sc.servicos_ativos,0) servicos_ativos, sc.familias,
  coalesce(ass.assinaturas,0) assinaturas_stripe, (c.stripe_subscription_id IS NOT NULL) tem_stripe_subscription_no_contrato,
  coalesce(bi.identidades,0) identidades_de_cobranca_da_empresa,
  CASE
    WHEN c.empresa_id IS NULL AND n.empresa_id IS NOT NULL THEN 'C1_SEM_EMPRESA_NEGOCIO_INDICA'
    WHEN c.empresa_id IS NULL THEN 'C0_SEM_EMPRESA_SEM_INDICIO'
    WHEN c.empresa_id IN (SELECT empresa_id FROM pag) THEN 'A_EMPRESA_DO_CONTRATO_PAGA'
    WHEN n.empresa_id IS NOT NULL AND n.empresa_id <> c.empresa_id AND n.empresa_id IN (SELECT empresa_id FROM pag) THEN 'B1_DIVERGE_E_NEGOCIO_PAGA'
    WHEN n.empresa_id IS NOT NULL AND n.empresa_id <> c.empresa_id THEN 'B2_DIVERGE_NENHUMA_PAGA'
    WHEN c.status IN ('churned','cancelado') THEN 'D_ENCERRADO_NAO_PAGA_ESPERADO'
    WHEN c.status = 'ativo' THEN 'E_ATIVO_NAO_PAGA_SEM_INDICIO'
    ELSE 'F_OUTRO'
  END classe,
  CASE
    WHEN c.empresa_id IS NULL AND n.empresa_id IS NOT NULL THEN n.empresa_id
    WHEN n.empresa_id IS NOT NULL AND n.empresa_id <> c.empresa_id AND n.empresa_id IN (SELECT empresa_id FROM pag) THEN n.empresa_id
  END empresa_proposta_id,
  CASE
    WHEN c.empresa_id IS NULL AND n.empresa_id IS NOT NULL THEN 'negocio.empresa_id (vínculo gravado no CRM)'
    WHEN n.empresa_id IS NOT NULL AND n.empresa_id <> c.empresa_id AND n.empresa_id IN (SELECT empresa_id FROM pag) THEN 'negocio.empresa_id é pagante; contrato aponta outra empresa'
  END evidencia,
  'a aprovar' AS decisao
FROM contratos c
LEFT JOIN negocios n ON n.id = c.negocio_id
LEFT JOIN leads l ON l.id = c.lead_id
LEFT JOIN cnj ec ON ec.id = c.empresa_id
LEFT JOIN cnj en ON en.id = n.empresa_id
LEFT JOIN cnj el ON el.id = l.empresa_id
LEFT JOIN docs d ON d.contrato_id = c.id
LEFT JOIN doc_neg dn ON dn.negocio_id = c.negocio_id
LEFT JOIN sc ON sc.contrato_id = c.id
LEFT JOIN ass ON ass.contrato_id = c.id
LEFT JOIN bi ON bi.empresa_id = c.empresa_id
ORDER BY classe, c.zoho_id NULLS LAST;
