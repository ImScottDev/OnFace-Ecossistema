-- 0080 — 23 pessoas sem WhatsApp que o lead tem.
--
-- O backfill de identidade não copiou `whatsapp` em 23 casos, provavelmente
-- números que não passaram pela normalização (fixos de 10 dígitos, sem o nono
-- dígito ou sem DDI). A tela da pessoa lê `pessoas.whatsapp` e mostrava vazio
-- enquanto o número estava no lead o tempo todo.
--
-- A sincronização de identidade já trata o lead como fonte deste campo: copia
-- `whatsapp` cru a cada alteração. Esta migration só antecipa para as 23 que
-- ninguém editou desde a carga, em vez de esperar um acaso.
--
-- Não normaliza e não inventa: copia o que existe. Normalizar aqui mudaria o
-- dado sem ninguém ter decidido qual é o formato certo.

UPDATE pessoas p
   SET whatsapp = l.whatsapp, updated_at = now()
  FROM leads l
 WHERE p.lead_id_legado = l.id
   AND COALESCE(p.whatsapp, '') = ''
   AND COALESCE(l.whatsapp, '') <> '';
