-- Faturas Stripe x planilha de faturamento, por empresa, numa competência (somente leitura).
-- Pergunta: a planilha já contém a receita cobrada pelo Stripe? (então somar as duas dobra a receita)
-- Parâmetro: :comp = 'YYYY-MM' (mês de emissão da fatura = competência da planilha).
WITH st AS (
  SELECT f.empresa_id,
         sum(f.valor) FILTER (WHERE f.status = 'paga')   AS stripe_paga,
         sum(f.valor) FILTER (WHERE f.status = 'aberta') AS stripe_aberta,
         sum(f.valor) FILTER (WHERE f.status = 'rascunho') AS stripe_rascunho,
         count(*) FILTER (WHERE f.status IN ('paga','aberta')) AS faturas_validas
    FROM faturas f
   WHERE f.origem = 'stripe' AND f.status <> 'void' AND f.empresa_id IS NOT NULL
     AND to_char(coalesce(f.emitida_em, f.created_at), 'YYYY-MM') = :'comp'
   GROUP BY 1),
pl AS (
  SELECT r.empresa_id, sum(r.valor) AS planilha, string_agg(DISTINCT r.service_family, ',') AS familia
    FROM cliente_receita_mensal r
   WHERE to_char(r.competencia, 'YYYY-MM') = :'comp' AND r.empresa_id IS NOT NULL
   GROUP BY 1)
SELECT e.nome AS empresa, regexp_replace(coalesce(e.cnpj,''),'\D','','g') AS cnpj, pl.familia,
       coalesce(st.stripe_paga,0) AS stripe_paga, coalesce(st.stripe_aberta,0) AS stripe_aberta, coalesce(st.stripe_rascunho,0) AS stripe_rascunho,
       coalesce(pl.planilha,0) AS planilha,
       CASE
         WHEN st.empresa_id IS NULL THEN 'SO_PLANILHA'
         WHEN pl.empresa_id IS NULL AND coalesce(st.stripe_paga,0)+coalesce(st.stripe_aberta,0) > 0 THEN 'SO_STRIPE_VALIDA'
         WHEN pl.empresa_id IS NULL THEN 'SO_STRIPE_RASCUNHO'
         WHEN abs(coalesce(st.stripe_paga,0)+coalesce(st.stripe_aberta,0) - pl.planilha) < 0.01 THEN 'IGUAL'
         ELSE 'DIFERE'
       END AS situacao
  FROM st FULL JOIN pl ON pl.empresa_id = st.empresa_id
  JOIN empresas e ON e.id = coalesce(st.empresa_id, pl.empresa_id)
 ORDER BY situacao, coalesce(pl.planilha,0) + coalesce(st.stripe_paga,0) DESC;
