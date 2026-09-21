-- 0085 — o período de trial também passa a morar no canônico (SPEC §11.1)
--
-- A 0083 colocou a CAPACIDADE na oferta (`permite_trial`). Faltava o FATO: as
-- datas viviam só em `negocios.trial_iniciado_em` / `trial_encerrado_em`, que é
-- a última semântica de condução da venda presa ao modelo legado.
--
-- Medido: 17 trials iniciados, ZERO encerrados. No modelo atual um trial começa
-- e nunca termina — a tela tem o botão de encerrar, mas ninguém o usou em 1.562
-- negócios. O dado é registrado como está, sem inventar encerramento.
--
-- Os 17 são copiados independentemente da família. A 0083 decide quem PODE
-- iniciar daqui para frente; reescrever o passado por causa da regra nova seria
-- apagar o que de fato aconteceu.
--
-- Aditiva. As colunas do legado continuam sendo escritas pela ponte.
--
-- ROLLBACK:
--   ALTER TABLE oportunidades DROP COLUMN IF EXISTS trial_iniciado_em;
--   ALTER TABLE oportunidades DROP COLUMN IF EXISTS trial_encerrado_em;

ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS trial_iniciado_em timestamp with time zone;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS trial_encerrado_em timestamp with time zone;

UPDATE oportunidades o
   SET trial_iniciado_em = n.trial_iniciado_em,
       trial_encerrado_em = n.trial_encerrado_em,
       updated_at = o.updated_at
  FROM negocios n
 WHERE o.negocio_id_legado = n.id
   AND n.trial_iniciado_em IS NOT NULL
   AND o.trial_iniciado_em IS NULL;
