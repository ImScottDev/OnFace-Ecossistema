-- Reconciliação do catálogo semântico (19/08) — classifica servicos_catalogo
-- que hoje está UNKNOWN usando EVIDÊNCIA REAL (contrato_itens.service_family/
-- revenue_nature já populados pela reconciliação de 16/08), não heurística de
-- nome. Só classifica quando existe exatamente 1 valor real distinto de
-- família pra aquele nome (sem conflito) — quando há conflito ou zero
-- evidência, a linha fica UNKNOWN e entra na lista "unresolved".
--
-- Rodar primeiro com dry-run (SELECT), só depois o UPDATE real.

-- ── DRY RUN: o que vai mudar ──────────────────────────────────────────
with evidencia as (
  select
    sc.id as catalogo_id,
    sc.nome,
    ci.service_family,
    ci.revenue_nature,
    count(*) as ocorrencias
  from servicos_catalogo sc
  join contrato_itens ci on upper(trim(ci.nome)) = upper(trim(sc.nome))
  where sc.service_family = 'UNKNOWN'
    and ci.service_family is not null
    and ci.revenue_nature is not null
  group by 1, 2, 3, 4
),
consolidado as (
  select
    catalogo_id, nome,
    count(distinct service_family) as familias_distintas,
    count(distinct revenue_nature) as naturezas_distintas,
    (array_agg(service_family order by ocorrencias desc))[1] as familia_escolhida,
    (array_agg(revenue_nature order by ocorrencias desc))[1] as natureza_escolhida,
    sum(ocorrencias) as total_ocorrencias
  from evidencia
  group by 1, 2
)
select nome, familia_escolhida, natureza_escolhida, total_ocorrencias,
  case when familias_distintas > 1 then 'CONFLITO_FAMILIA' when naturezas_distintas > 1 then 'CONFLITO_NATUREZA' else 'OK' end as status
from consolidado
order by status desc, nome;
