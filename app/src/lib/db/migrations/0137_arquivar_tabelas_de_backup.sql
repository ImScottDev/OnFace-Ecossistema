-- Tabelas de backup/cargas pontuais saem do esquema public (ONF-0021, 27/10/2026).
-- Nenhuma é lida pelo produto: só pelos scripts de uso único que as criaram.
-- Não apaga nada: move para o esquema `arquivo`. Para voltar uma:
--   ALTER TABLE arquivo.<nome> SET SCHEMA public;
-- Reaplicável: move só o que está em public e ainda não existe em arquivo.
CREATE SCHEMA IF NOT EXISTS arquivo;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_bkp_ganhos_sem_empresa_20261008', '_bkp_leads_enriquecimento_meta_20261008',
    '_bkp_opps_ganhos_sem_empresa_20261008', '_carga_contagem_antes',
    '_consolidacao_email_contas_20261013', '_enriquecimento_meta_20261013',
    '_limpeza_quadros_20261013', '_limpeza_quadros_20261013_leg_leads',
    '_limpeza_quadros_20261013_leg_neg', '_limpeza_quadros_20261013_leg_nl',
    '_limpeza_testes_20261013', '_mz_depara', '_mz_empresa_merge', '_mz_esperado',
    '_mz_lead_estado', '_mz_meta', '_mz_negocio_depara', '_produto_legado_20261013',
    '_qa_removido', '_relacoes_conversao_20261013', '_virada_mescla_20261013',
    '_virada_mescla_20261013_b', 'ganhos_empresa_bkp_20261014174939',
    'negocios_bkp_familia_20261014115942', 'servicos_canonicos_bkp_mz_churn_20261015090633',
    'servicos_canonicos_bkp_produto_20261013114524', 'servicos_catalogo_bkp_familia_20261014175018'
  ] LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL
       AND to_regclass('arquivo.' || quote_ident(t)) IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA arquivo', t);
    END IF;
  END LOOP;
END $$;
