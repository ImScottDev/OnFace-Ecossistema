-- CARGA MARCO ZERO · passo 04 · pre-vendas e prospeccao (mapa 2.3).
-- aquisicoes (1 por lead), pontos_contato (1 first-touch por aquisicao),
-- cadencia_execucoes (historico de toques). O espelho em `leads` (estagio e fatos)
-- ja foi gravado no passo 03 a partir da MESMA tabela `_mz_lead_estado`, entao
-- leads e aquisicoes nascem iguais (B5). cadence_enrollments fica VAZIO: nao se
-- inventa inscricao a partir dos toques.
--
-- Fora do board: tipo contato, cliente ou ex-cliente nascem com closed_at = created_at;
-- desqualificado e nutricao encerram na data do proprio fato (nunca now()).
-- Nota: aquisicoes.responsavel_id copia leads.responsavel_id. Se o passo 08 trocar o
-- dono dos leads cliente para a Jenifer, ele deve trocar tambem aqui.
-- A pessoa e do lead CANONICO: lead nao canonico (mesmo e-mail/telefone na mesma
-- empresa) nao tem pessoa propria desde a correcao do 03, e apontar para ela
-- quebrava a FK de aquisicoes/pontos_contato.
\set ON_ERROR_STOP on
BEGIN;
\ir _lib.sql

CREATE TEMP TABLE _aq AS
SELECT md5('aq:' || l.id)::uuid AS id, l.organizacao_id, l.empresa_id, coalesce((SELECT p.id FROM pessoas p WHERE p.lead_id_legado = coalesce(l.canonical_lead_id, l.id)), md5('pessoa:' || coalesce(l.canonical_lead_id, l.id))::uuid) AS pessoa_id,
       -- vocabulario fechado do SPEC 8.1; sem acento e em caixa baixa porque o dado real tem "Midia Paga"
       CASE
         WHEN o.k = '' THEN 'MANUAL'
         WHEN o.k ~ 'zoho|import|planilha|migra|stripe|legado' THEN 'IMPORT'
         WHEN o.k ~ 'apollo|outbound|prospec|cold|lista' THEN 'OUTBOUND'
         WHEN o.k ~ 'indica|referr|parceir|webinar' THEN 'REFERRAL'
         WHEN o.k ~ 'midia paga|meta|facebook|instagram|google|ads|site|form|landing|inbound|organico|rd station|rd$' THEN 'INBOUND'
         ELSE 'MANUAL' END AS tipo,
       l.origem, l.utm_medium AS canal, l.utm_source AS source_provider,
       (SELECT id FROM pipelines WHERE slug = 'aquisicao') AS pipeline_id,
       (SELECT pe.id FROM pipeline_etapas pe JOIN pipelines p ON p.id = pe.pipeline_id AND p.slug = 'aquisicao'
         WHERE pe.codigo = e.etapa) AS etapa_id,
       l.responsavel_id,
       e.qualificado, e.qualificado_em, e.desqualificado_em, e.desq_motivo AS motivo_desqualificacao,
       e.nutricao_status, e.retomar_em,
       l.created_at AS first_touch_at, coalesce(l.last_contact_at, l.created_at) AS last_touch_at,
       l.created_at, l.updated_at, e.closed_at, l.id AS lead_legado_id
  FROM leads l
  JOIN _mz_lead_estado e ON e.lead_id = l.id
  CROSS JOIN LATERAL (SELECT trim(translate(lower(coalesce(l.origem, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) AS k) o
 -- aditivo: lead que ja tem aquisicao propria no alvo (criada pelo app, id nao deterministico) fica como esta
 WHERE NOT EXISTS (SELECT 1 FROM aquisicoes ax WHERE ax.lead_legado_id = l.id AND ax.id <> md5('aq:' || l.id)::uuid);
SELECT 'aquisicoes' AS tabela, pg_temp.mz_carga('aquisicoes', '_aq', 'true', '{}', 'id', ARRAY['responsavel_id']) AS linhas;

-- Ponto de contato: 1 first-touch por aquisicao. tipo_origem segue a regra que o
-- sync de runtime (sync-domain-model.ts classificarOrigem) aplica a lead novo.
CREATE TEMP TABLE _pc AS
SELECT md5('pc:' || l.id)::uuid AS id, l.organizacao_id, coalesce((SELECT p.id FROM pessoas p WHERE p.lead_id_legado = coalesce(l.canonical_lead_id, l.id)), md5('pessoa:' || coalesce(l.canonical_lead_id, l.id))::uuid) AS pessoa_id, l.empresa_id,
       coalesce(l.utm_source, l.origem) AS source, l.utm_medium AS medium, l.utm_campaign AS campaign,
       l.utm_term AS term, l.utm_content AS content, l.landing_page,
       l.meta_campaign_id AS campaign_id,
       CASE WHEN coalesce(l.utm_source, '') <> '' THEN 'campanha'
            WHEN lower(coalesce(l.origem, '')) LIKE '%indica%' THEN 'indicacao'
            WHEN lower(coalesce(l.origem, '')) LIKE '%manual%' OR lower(coalesce(l.origem, '')) LIKE '%cadastro%' THEN 'manual'
            WHEN lower(coalesce(l.origem, '')) LIKE '%import%' THEN 'importacao'
            WHEN lower(coalesce(l.origem, '')) ~ 'sdr|outreach|apollo' THEN 'sdr'
            ELSE 'organica' END AS tipo_origem,
       true AS is_first_touch, true AS is_last_touch, l.created_at AS ocorrido_em,
       jsonb_build_object('leadIdLegado', l.id, 'origemLegado', l.origem) AS raw,
       l.created_at, l.id AS lead_id_legado, md5('aq:' || l.id)::uuid AS aquisicao_id,
       l.gclid, l.fbclid, l.fbc, l.fbp, l.meta_adset_id AS adset_id, l.meta_ad_id AS ad_id, l.origem AS provider
  FROM leads l WHERE l.origem IS DISTINCT FROM 'qa'
   AND EXISTS (SELECT 1 FROM aquisicoes aq WHERE aq.id = md5('aq:' || l.id)::uuid)
   AND NOT EXISTS (SELECT 1 FROM pontos_contato px WHERE px.lead_id_legado = l.id AND px.id <> md5('pc:' || l.id)::uuid);  -- lead de teste do dev nao ganha ponto de contato de carga
SELECT 'pontos_contato' AS tabela, pg_temp.mz_carga('pontos_contato', '_pc') AS linhas;

-- Historico de toques da cadencia SDR. sessao_id aponta para whatsapp_sessao, que so
-- existe depois do passo 09: entra NULL aqui e o 09b_cadencia_sessao.sql completa.
SELECT 'cadencia_execucoes' AS tabela, pg_temp.mz_carga('cadencia_execucoes', 'legado.cadencia_execucoes',
  's.lead_id IN (SELECT id FROM public.leads)',
  jsonb_build_object(
    'sessao_id',       '(SELECT w.id FROM public.whatsapp_sessao w WHERE w.id = s.sessao_id)',
    'enviado_por_id',  '(SELECT u.id FROM public.usuarios u WHERE u.id = s.enviado_por_id)')) AS linhas;

COMMIT;
