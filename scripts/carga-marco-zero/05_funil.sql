-- CARGA MARCO ZERO · passo 05 · funil de vendas (mapa 2.4).
-- servicos_canonicos (sem FKs), negocios com o de-para aplicado, negocio_leads,
-- negocio_labels, status_changes (+ sinteticos 'perdido'), oportunidades.
-- O de-para vem de `_mz_negocio_depara` (00_preparar); aqui so se grava.
--
-- Regras do Scott que moram aqui:
--  - negocios.status e oportunidades.stage = status NOVO (estagnados e no-show =
--    'perdido', trial = 'proposta_apresentada'). O original fica em motivo_estagnacao,
--    no_show_em e trial_iniciado_em.
--  - copia 'ativo' (carteira, negocio_origem_id) fica FORA do funil: etapa NULL, status e
--    stage 'ativo', ganho_at NULL. Nunca 'ganho' (dobraria a Nova receita do Inicio).
--  - service_family: copia o NULL de prod. Nao herda a familia deduzida pela carga antiga.
--  - perdido_at e a data do status ORIGINAL; estagnado e no-show ganham um status_changes
--    'perdido' sintetico, senao o sync (sync-domain-model.ts) regrava perdido_at = now.
--  - motivo_perda e motivo_perda_chave recebem a MESMA chave (MOTIVOS_PERDA); o texto
--    livre original vai para motivo_perda_detalhe.
--  - nada grava updated_at = now(): vem de prod.
-- Variavel psql: revisao_dir.
\set ON_ERROR_STOP on
\if :{?revisao_dir}
\else
  \set revisao_dir revisao
\endif
BEGIN;
\ir _lib.sql

-- L4: as etapas do CRM 1 duplicam as canonicas (entrada, diagnostico, proposta,
-- negociacao). Desativa as duplicatas para o board nao mostrar coluna dobrada.
-- em_fechamento (so PABX) nao tem canonica e continua como esta.
UPDATE pipeline_etapas SET ativo = false
 WHERE ativo AND codigo IN ('reuniao_agendada', 'reuniao_realizada', 'trial', 'proposta_apresentada', 'negociacao_iniciada');

-- ───────────────────────── 1. servicos_canonicos (sem FKs) ─────────────────────────
-- contrato_id e oportunidade_origem_id so se preenchem depois de contratos (06) e
-- oportunidades (abaixo); nunca com a copia 'ativo'. oferta_comercial_id nao existe em prod.
-- Os passos 06 (contrato_id) e 08 (carteira: lifecycle, familia, universo) ajustam esta
-- tabela depois: aqui ela so recebe INSERT, e reexecutar o 05 nao desfaz o que eles fizeram.
SELECT 'servicos_canonicos' AS tabela, pg_temp.mz_carga('servicos_canonicos', 'legado.servicos_canonicos',
  's.lead_id IS NULL OR s.lead_id IN (SELECT id FROM public.leads)',
  jsonb_build_object(
    'empresa_id', 'coalesce((SELECT m.destino_id FROM _mz_empresa_merge m WHERE m.origem_id = s.empresa_id), s.empresa_id)',
    'contrato_id', 'NULL', 'oportunidade_origem_id', 'NULL'),
  'id', ARRAY['*']) AS linhas;

-- ───────────────────────── 2. negocios (de-para aplicado) ─────────────────────────
CREATE TEMP TABLE _n AS
SELECT s.*, d.etapa AS d_etapa, d.status_novo AS d_status, d.estagnado AS d_estagnado, d.motivo_chave AS d_motivo,
       d.ganho_at AS d_ganho_at, d.estagnado_em AS d_estagnado_em, d.no_show_em AS d_no_show_em,
       d.no_show_contagem AS d_no_show_n, d.trial_iniciado_em AS d_trial_em, d.etapa_desde AS d_etapa_desde
  FROM legado.negocios s JOIN _mz_negocio_depara d ON d.negocio_id = s.id;
SELECT 'negocios' AS tabela, pg_temp.mz_carga('negocios', '_n', 'true', jsonb_build_object(
  'empresa_id',   'coalesce((SELECT m.destino_id FROM _mz_empresa_merge m WHERE m.origem_id = s.empresa_id), s.empresa_id)',
  -- 4 negocios de prod nao tem pipeline: caem no pipeline de vendas padrao, senao nao tem coluna no board
  'pipeline_id',  'coalesce(s.pipeline_id, (SELECT id FROM public.pipelines WHERE slug = ''callface-ai''))',
  'status',       's.d_status',
  'etapa',        's.d_etapa',
  'etapa_desde',  's.d_etapa_desde',
  'ganho_at',     's.d_ganho_at',
  'motivo_perda',        $$CASE WHEN s.d_status = 'perdido' THEN s.d_motivo ELSE s.motivo_perda END$$,
  'motivo_perda_chave',  $$CASE WHEN s.d_status = 'perdido' THEN s.d_motivo END$$,
  'motivo_perda_detalhe',$$CASE WHEN s.d_status = 'perdido'
                               THEN coalesce(nullif(btrim(s.motivo_perda_detalhe), ''),
                                             CASE WHEN s.motivo_perda IS NOT NULL AND s.motivo_perda <> s.d_motivo THEN s.motivo_perda END)
                               ELSE s.motivo_perda_detalhe END$$,
  'motivo_estagnacao',   'CASE WHEN s.d_estagnado THEN s.status END',
  'estagnado_em',        's.d_estagnado_em',
  'no_show_em',          's.d_no_show_em',
  'no_show_contagem',    's.d_no_show_n',
  'trial_iniciado_em',   's.d_trial_em',
  -- carteira = EXPANSION; o resto, venda nova (M1)
  'commercial_motion',   $$CASE WHEN s.origem_negocio = 'carteira' THEN 'EXPANSION' ELSE 'NEW_BUSINESS' END$$)) AS linhas;

SELECT 'negocio_leads' AS tabela, pg_temp.mz_carga('negocio_leads', 'legado.negocio_leads',
  's.negocio_id IN (SELECT id FROM public.negocios) AND s.lead_id IN (SELECT id FROM public.leads)') AS linhas;
SELECT 'negocio_labels' AS tabela, pg_temp.mz_carga('negocio_labels', 'legado.negocio_labels',
  's.negocio_id IN (SELECT id FROM public.negocios) AND s.label_id IN (SELECT id FROM public.labels)') AS linhas;
-- entity_labels espelha negocio_labels (a automacao 'lead quente' le entity_labels).
CREATE TEMP TABLE _eln AS
SELECT md5('el:negocio:' || nl.negocio_id || ':' || nl.label_id)::uuid AS id, n.organizacao_id, 'negocio'::text AS entity_type,
       nl.negocio_id AS entity_id, nl.label_id, nl.created_at
  FROM negocio_labels nl JOIN negocios n ON n.id = nl.negocio_id;
SELECT 'entity_labels(negocio)' AS tabela, pg_temp.mz_carga('entity_labels', '_eln', 'NOT EXISTS (SELECT 1 FROM public.entity_labels x WHERE x.entity_type = s.entity_type AND x.entity_id = s.entity_id AND x.label_id = s.label_id AND x.id <> s.id)') AS linhas;

-- ───────────────────────── 3. status_changes ─────────────────────────
SELECT 'status_changes' AS tabela, pg_temp.mz_carga('status_changes', 'legado.status_changes',
  '(s.negocio_id IS NULL OR s.negocio_id IN (SELECT id FROM public.negocios))
   AND (s.lead_id IS NULL OR s.lead_id IN (SELECT id FROM public.leads))',
  jsonb_build_object('usuario_id', '(SELECT u.id FROM public.usuarios u WHERE u.id = s.usuario_id)')) AS linhas;

-- Sintetico 'perdido' para estagnado, no-show e perdido sem registro: com a data original.
CREATE TEMP TABLE _sc AS
SELECT md5('sc-perdido:' || d.negocio_id)::uuid AS id, d.negocio_id, d.lead_id,
       CASE WHEN d.status_legado <> 'perdido' THEN d.status_legado END AS de_status,
       'perdido'::text AS para_status, d.motivo_chave AS motivo, d.perdido_at AS created_at,
       'sintetico'::text AS confianca,
       jsonb_build_object('origem', 'carga_marco_zero', 'status_original', d.status_legado) AS evidencia
  FROM _mz_negocio_depara d
 WHERE d.precisa_sintetico AND d.negocio_id IN (SELECT id FROM negocios)
   AND (d.lead_id IS NULL OR d.lead_id IN (SELECT id FROM leads));
SELECT 'status_changes(sinteticos)' AS tabela, pg_temp.mz_carga('status_changes', '_sc') AS linhas;

-- ───────────────────────── 4. oportunidades ─────────────────────────
-- Uma por negocio, derivada do negocio JA gravado (mesma regra do sync-domain-model.ts).
-- Ganho e perda sao exclusivos: ganho_at so no ganho, perdido_at/motivo so no perdido.
CREATE TEMP TABLE _o AS
SELECT md5('opp:' || n.id)::uuid AS id, n.organizacao_id,
       -- Pessoa do lead CANONICO: lead nao canonico nao tem pessoa propria (03),
       -- e sem isto 21 oportunidades ficavam sem pessoa.
       (SELECT p.id FROM pessoas p
         WHERE p.lead_id_legado = coalesce((SELECT l2.canonical_lead_id FROM leads l2 WHERE l2.id = n.lead_id), n.lead_id)) AS pessoa_id,
       n.empresa_id,
       -- A copia 'ativo' (carteira) fica FORA do funil, como diz a regra la em
       -- cima: entao ela tambem nao carrega pipeline. Levando o pipeline junto,
       -- ela virava "oportunidade COM pipeline e SEM etapa" e derrubava
       -- cobertura.test.ts ("o vocabulario de etapa divergiu de novo") nas 161.
       CASE WHEN n.status = 'ativo' THEN NULL ELSE n.pipeline_id END AS pipeline_id,
       n.status AS stage, n.responsavel_id, coalesce(n.valor_total, n.valor_projeto) AS valor,
       coalesce(nullif(n.mrr_fechado, 0), n.mrr_estimado) AS mrr, n.previsao_fechamento,
       CASE WHEN n.status = 'ganho' THEN d.ganho_at END AS ganho_at,
       CASE WHEN n.status = 'perdido' THEN d.perdido_at END AS perdido_at,
       CASE WHEN n.status = 'perdido' THEN n.motivo_perda_chave END AS motivo_perda,
       n.id AS negocio_id_legado, n.created_at, n.updated_at, n.titulo, n.service_family, n.etapa,
       n.commercial_motion, n.lead_id, n.valor_setup AS setup_estimado,
       (SELECT pe.id FROM pipeline_etapas pe WHERE pe.pipeline_id = n.pipeline_id AND pe.codigo = n.etapa) AS etapa_id,
       n.motivo_estagnacao, n.estagnado_em, n.trial_iniciado_em
  FROM negocios n JOIN _mz_negocio_depara d ON d.negocio_id = n.id;
SELECT 'oportunidades' AS tabela, pg_temp.mz_carga('oportunidades', '_o', $$NOT EXISTS (SELECT 1 FROM public.oportunidades x WHERE x.negocio_id_legado = s.negocio_id_legado AND x.id <> s.id)$$) AS linhas;

-- Depois das oportunidades: servicos_canonicos.oportunidade_origem_id so aponta para
-- negocio com origem real. O 06 completa contrato_id. Aqui nada a ligar: prod nao
-- guarda a oportunidade de origem do servico.

-- ───────────────────────── 5. lista de revisao ─────────────────────────
-- 'ativo' cuja origem e um negocio perdido: o Scott decide se o cliente existe.
\pset format csv
\set arq :revisao_dir /ativo_origem_perdido.csv
SELECT a.id AS negocio_ativo_id, a.titulo, a.empresa_id, a.valor_total, a.mrr_fechado,
       o.id AS negocio_origem_id, o.titulo AS origem_titulo, o.status AS origem_status_legado, d.status_novo AS origem_status_novo
  FROM legado.negocios a
  JOIN legado.negocios o ON o.id = a.negocio_origem_id
  JOIN _mz_negocio_depara d ON d.negocio_id = o.id
 WHERE a.status = 'ativo' AND d.status_novo = 'perdido'
 ORDER BY a.created_at, a.id \g :arq
\pset format aligned

COMMIT;
