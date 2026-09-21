-- 0083 — trial é capacidade da OFERTA, e não um botão livre no negócio (SPEC §12.2)
--
-- Medido: `iniciarTrial` gravava `negocios.trial_iniciado_em` sem gate nenhum.
-- Qualquer oportunidade, de qualquer família, podia entrar em trial — inclusive
-- PABX e White Label, que são venda por contrato e implantação. E
-- `trial_encerrado_em` está em 0 de 1.562: no modelo atual um trial começa e
-- nunca termina.
--
-- A oferta é onde a política comercial mora (requires_contract, win_condition,
-- payment_trigger). Trial é da mesma natureza: a oferta permite ou não.
--
-- O valor inicial NÃO é palpite meu: é lido da configuração que já existe. O
-- pipeline de vendas do Callface AI tem a etapa `trial`; o do PABX não tem.
-- Quem configurou aqueles pipelines já disse quais produtos têm trial.
--
-- Os 17 trials históricos não ajudam a decidir: 16 deles não têm família
-- comercial nenhuma. Ficam registrados, não são usados como evidência.
--
-- Aditiva. Coluna nova com default false.
--
-- ROLLBACK:
--   ALTER TABLE ofertas_comerciais DROP COLUMN IF EXISTS permite_trial;

ALTER TABLE ofertas_comerciais ADD COLUMN IF NOT EXISTS permite_trial boolean NOT NULL DEFAULT false;

UPDATE ofertas_comerciais oc
   SET permite_trial = true, updated_at = oc.updated_at
 WHERE oc.codigo LIKE 'CALLFACE_AI%'
   AND EXISTS (
     SELECT 1 FROM pipelines p
       JOIN pipeline_etapas pe ON pe.pipeline_id = p.id AND pe.codigo = 'trial'
      WHERE p.organizacao_id = oc.organizacao_id AND p.nome = 'Callface AI');
