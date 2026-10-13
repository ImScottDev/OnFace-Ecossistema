#!/bin/bash
# Mescla os leads que a entrada Meta + RD criou em dobro (mesmo e-mail/telefone,
# menos de 1h de diferença, os dois com aquisição aberta). Fica o lead com as
# respostas do formulário (ou o mais antigo); o outro aponta para ele
# (canonical_lead_id), as respostas são juntadas e a aquisição duplicada é
# fechada com motivo "duplicada". Nada é apagado; o estado anterior fica em
# _virada_mescla_20261013. A entrada já não duplica desde 386e99f.
set -euo pipefail
ssh -i "$HOME/.ssh/infra_callface.pem" ubuntu@34.204.200.52 \
  "docker exec -i callface-crm2-dev-postgres psql -U callface -d callface_crm_mz -X -v ON_ERROR_STOP=1" <<'SQL'
BEGIN;
CREATE TEMP TABLE base AS
  SELECT l.id, l.organizacao_id, l.created_at,
         EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(l.campos_custom,'{}')) k WHERE k NOT LIKE 'meta\_%') AS resp,
         lower(trim(l.email)) em,
         right(regexp_replace(COALESCE(NULLIF(l.telefone,''), l.whatsapp, ''), '\D','','g'),10) tel
    FROM leads l
   WHERE l.canonical_lead_id IS NULL AND l.tipo='lead'
     AND EXISTS (SELECT 1 FROM aquisicoes a WHERE a.lead_legado_id=l.id AND a.closed_at IS NULL);
CREATE TEMP TABLE pares AS
  SELECT CASE WHEN (a.resp, b.created_at) > (b.resp, a.created_at) THEN a.id ELSE b.id END AS fica,
         CASE WHEN (a.resp, b.created_at) > (b.resp, a.created_at) THEN b.id ELSE a.id END AS sai
    FROM base a JOIN base b ON a.organizacao_id=b.organizacao_id AND a.id<b.id
     AND ((a.em<>'' AND a.em=b.em) OR (length(a.tel)=10 AND a.tel=b.tel))
     AND abs(extract(epoch from b.created_at-a.created_at)) < 3600;
-- correntes (lead que fica num par e sai em outro, ou sai em dois) ficam para revisão manual
DELETE FROM pares WHERE fica IN (SELECT sai FROM pares) OR sai IN (SELECT sai FROM pares GROUP BY sai HAVING count(*)>1);
CREATE TABLE IF NOT EXISTS _virada_mescla_20261013 AS
  SELECT p.fica, p.sai, to_jsonb(l.*) AS lead_sai,
         (SELECT jsonb_agg(to_jsonb(a.*)) FROM aquisicoes a WHERE a.lead_legado_id=p.sai) AS aquisicoes_sai,
         (SELECT campos_custom FROM leads WHERE id=p.fica) AS campos_fica_antes
    FROM pares p JOIN leads l ON l.id=p.sai;
UPDATE leads f SET campos_custom = coalesce(s.campos_custom,'{}') || coalesce(f.campos_custom,'{}'), updated_at=now()
  FROM pares p JOIN leads s ON s.id=p.sai WHERE f.id=p.fica;
UPDATE leads s SET canonical_lead_id=p.fica, updated_at=now() FROM pares p WHERE s.id=p.sai;
UPDATE aquisicoes a SET closed_at=now(), motivo_desqualificacao='duplicada: mesclada no lead '||p.fica, updated_at=now()
  FROM pares p WHERE a.lead_legado_id=p.sai AND a.closed_at IS NULL;
SELECT (SELECT count(*) FROM pares) AS mesclados, (SELECT count(*) FROM _virada_mescla_20261013) AS no_backup;
COMMIT;
SQL
