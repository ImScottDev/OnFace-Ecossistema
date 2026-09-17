-- Fecha o backfill de etapa das oportunidades legadas.
--
-- A 0047 deixou 301 negócios sem etapa canônica porque o `status` deles não é
-- etapa nenhuma: é motivo de estagnação (`outra_data`, `sem_retorno`,
-- `trava_negociacao`, `trava_assinatura`) ou o genérico `ativo` da carteira.
--
-- Bloco 02 §17 da SpecDrive: "evitar perpetuar motivos como statuses
-- diferentes". Então motivo vira coluna própria e a etapa é recuperada de
-- `status_changes` — a etapa real de onde o negócio saiu quando estagnou.
-- Nada de chute: onde o histórico não sabe, entra 'entrada', que é a etapa
-- mais conservadora possível (nenhum avanço presumido).

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS motivo_estagnacao text,
  ADD COLUMN IF NOT EXISTS estagnado_em timestamptz;

ALTER TABLE negocios DROP CONSTRAINT IF EXISTS negocios_motivo_estagnacao_check;
ALTER TABLE negocios ADD CONSTRAINT negocios_motivo_estagnacao_check
  CHECK (motivo_estagnacao IS NULL OR motivo_estagnacao IN
    ('sem_retorno','trava_negociacao','trava_assinatura','outra_data'));

UPDATE negocios
   SET motivo_estagnacao = status,
       estagnado_em = COALESCE(estagnado_em, updated_at)
 WHERE motivo_estagnacao IS NULL
   AND status IN ('sem_retorno','trava_negociacao','trava_assinatura','outra_data');

-- Etapa real de onde o negócio saiu quando estagnou.
UPDATE negocios n
   SET etapa = CASE anterior.de_status
         WHEN 'reuniao_agendada'     THEN 'entrada'
         WHEN 'reuniao_realizada'    THEN 'diagnostico'
         WHEN 'trial'                THEN 'diagnostico'
         WHEN 'proposta_apresentada' THEN 'proposta'
         WHEN 'negociacao_iniciada'  THEN 'negociacao'
         ELSE 'entrada'
       END
  FROM (
    SELECT n2.id,
           (SELECT s.de_status FROM status_changes s
             WHERE s.negocio_id = n2.id AND s.para_status = n2.status
             ORDER BY s.created_at DESC LIMIT 1) AS de_status
      FROM negocios n2
     WHERE n2.etapa IS NULL
  ) anterior
 WHERE n.id = anterior.id AND n.etapa IS NULL;

-- `ativo` é o genérico com que a carteira nasceu; nenhum avanço comercial foi
-- registrado nesses, então entram como Entrada.
UPDATE negocios SET etapa = 'entrada' WHERE etapa IS NULL AND status = 'ativo';

-- Qualquer resto (status desconhecido, importação antiga) fica em Entrada pelo
-- mesmo motivo: é a única etapa que não presume nada.
UPDATE negocios SET etapa = 'entrada' WHERE etapa IS NULL;

UPDATE negocios SET etapa_desde = COALESCE(etapa_desde, updated_at, created_at) WHERE etapa_desde IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Fato "Qualificado": a data que a 0047 não conseguiu preencher.
--
-- `convertido_at` está vazio na base inteira, então os 117 leads qualificados
-- ficaram com o fato e sem a data. O histórico sabe: `status_changes` guarda a
-- primeira transição para uma etapa que só existe depois da qualificação.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE leads l
   SET qualificado_em = evidencia.quando,
       qualificado_por = COALESCE(l.qualificado_por, evidencia.usuario_id)
  FROM (
    SELECT s.lead_id, min(s.created_at) AS quando,
           (array_agg(s.usuario_id ORDER BY s.created_at))[1] AS usuario_id
      FROM status_changes s
     WHERE s.lead_id IS NOT NULL
       AND s.para_status IN ('qualified','reuniao_agendada')
     GROUP BY s.lead_id
  ) evidencia
 WHERE l.id = evidencia.lead_id
   AND l.qualificado = true
   AND l.qualificado_em IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Estado de Prospecção para quem já é outbound.
--
-- Bloco 04 §24: a existência de oportunidade deixa de significar "qualificado".
-- Quem veio de outbound e não tem estado ainda entra em `novo`; quem já tem
-- inscrição ativa em cadência entra em `em_cadencia`. O resto fica NULL, que
-- é o correto para quem nunca foi prospect.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE leads
   SET prospeccao_estado = 'novo'
 WHERE prospeccao_estado IS NULL
   AND lower(COALESCE(origem, '')) = 'outbound';

UPDATE leads l
   SET prospeccao_estado = 'em_cadencia'
 WHERE l.prospeccao_estado = 'novo'
   AND EXISTS (
     SELECT 1 FROM cadence_enrollments e
      WHERE e.entity_type = 'lead' AND e.entity_id = l.id
        AND e.status IN ('active','waiting')
   );
