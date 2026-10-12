-- Cadeia por empresa que PAGA (última competência fechada). Uma linha por empresa pagante.
-- contrato -> empresa -> serviço -> pagador/assinatura -> fatura/pagamento, e onde ela quebra.
WITH uc AS (SELECT max(competencia) c FROM cliente_receita_mensal),
pag AS (SELECT r.empresa_id, sum(r.valor) mrr, string_agg(DISTINCT r.service_family, ',') familias
          FROM cliente_receita_mensal r, uc WHERE r.competencia = uc.c AND r.revenue_nature='MRR' AND r.empresa_id IS NOT NULL GROUP BY 1)
SELECT e.id empresa_id, e.nome, regexp_replace(coalesce(e.cnpj,''),'\D','','g') cnpj, p.mrr, p.familias,
  (SELECT count(*) FROM contratos c WHERE c.empresa_id=e.id) contratos,
  (SELECT count(*) FROM contratos c WHERE c.empresa_id=e.id AND c.zoho_id IS NOT NULL) contratos_zoho,
  (SELECT count(*) FROM contratos c WHERE c.empresa_id=e.id AND c.status='ativo') contratos_ativos,
  (SELECT coalesce(sum(a.n),0) FROM contratos c JOIN LATERAL (SELECT count(*) n FROM anexos_legado x WHERE x.entidade_tipo='contrato' AND x.entidade_id=c.id AND x.categoria='documento_assinado') a ON true WHERE c.empresa_id=e.id) docs_assinados_de_contrato,
  (SELECT coalesce(sum(a.n),0) FROM negocios n JOIN LATERAL (SELECT count(*) n FROM anexos_legado x WHERE x.entidade_tipo='negocio' AND x.entidade_id=n.id AND x.categoria='documento_assinado') a ON true WHERE n.empresa_id=e.id) docs_assinados_de_negocio,
  (SELECT count(*) FROM servicos_canonicos s WHERE s.empresa_id=e.id AND s.commercial_lifecycle='ACTIVE') servicos_ativos,
  (SELECT count(*) FROM assinaturas a WHERE a.empresa_id=e.id) assinaturas_stripe,
  (SELECT count(*) FROM billing_identities b WHERE b.empresa_id=e.id OR b.canonical_empresa_id=e.id) identidades_cobranca,
  (SELECT count(*) FROM faturas f WHERE f.empresa_id=e.id) faturas_crm,
  (SELECT count(*) FROM pagamentos g WHERE g.empresa_id=e.id AND upper(g.status) IN ('PAGO','PAID','SUCCEEDED')) pagamentos_crm,
  (SELECT count(*) FROM cliente_receita_mensal r WHERE r.empresa_id=e.id AND r.revenue_nature='MRR') competencias_mrr,
  (e.stripe_customer_id IS NOT NULL) empresa_tem_stripe_customer
FROM pag p JOIN empresas e ON e.id=p.empresa_id
ORDER BY p.mrr DESC;
