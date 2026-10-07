-- CARGA MARCO ZERO · passo 06 · contratos, propostas, itens, anexos.
-- Mapa: 02_MAPA_CARGA_MARCO_ZERO.md secao 2.5. Depende do passo 05 (negocios,
-- oportunidades) e do 03 (empresas, leads). Roda numa transacao do run.sh,
-- com o schema `legado` (postgres_fdw -> prod) criado pelo 00_preparar.
--
-- Variaveis psql: revisao_dir (default 'revisao').
--
-- Regras do Scott que moram aqui:
--  - Assinatura Stripe NAO e contrato: os tipo='assinatura' nao entram (P17)
--    e saem em revisao/contratos_assinatura_descartados.csv.
--  - updated_at e created_at vem de prod, nunca now() (M10): backfill que
--    toca updated_at faz o board mostrar "17min" em tudo.
--  - service_family so com evidencia; sem evidencia fica NULL, nunca PABX.
--
-- Idempotente: INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE (linha) IS
-- DISTINCT FROM (nova). Segunda execucao nao toca linha nenhuma.

\set ON_ERROR_STOP on
\if :{?revisao_dir}
\else
  \set revisao_dir 'revisao'
\endif

-- Upsert generico: as colunas a gravar sao as da tabela temporaria de origem.
-- Compara a linha inteira para nao reescrever (nem tocar updated_at de) quem
-- ja esta igual.
CREATE OR REPLACE FUNCTION pg_temp.mz_up(alvo regclass, origem regclass, chave text DEFAULT 'id')
RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE cols text; sets text; velho text; novo text; n bigint;
BEGIN
  SELECT string_agg(quote_ident(attname), ',' ORDER BY attnum),
         string_agg(quote_ident(attname) || '=EXCLUDED.' || quote_ident(attname), ',' ORDER BY attnum) FILTER (WHERE attname <> chave),
         string_agg('t.' || quote_ident(attname), ',' ORDER BY attnum) FILTER (WHERE attname <> chave),
         string_agg('EXCLUDED.' || quote_ident(attname), ',' ORDER BY attnum) FILTER (WHERE attname <> chave)
    INTO cols, sets, velho, novo
    FROM pg_attribute WHERE attrelid = origem AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('INSERT INTO %s AS t (%s) SELECT %s FROM %s ON CONFLICT (%I) DO UPDATE SET %s WHERE (%s) IS DISTINCT FROM (%s)',
                 alvo, cols, cols, origem, chave, sets, velho, novo);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- ───────────────────────── 1. contratos (sem assinatura) ─────────────────────────
CREATE TEMP TABLE _c_contratos AS
SELECT c.id, c.organizacao_id, c.lead_id, c.negocio_id, c.tipo, c.descricao, c.moeda, c.mrr,
       c.valor_setup, c.servicos, c.inicio, c.vencimento, c.renovacao_auto, c.status, c.notas,
       c.motivo_churn, c.finalizado_at, c.created_at, c.updated_at, c.zoho_id,
       c.stripe_subscription_id, c.produto, c.assinatura_legado_zoho, c.codigo_legado,
       c.commercial_lifecycle, c.current_recurring_value, c.multa_percentual, c.prazo_meses,
       c.semantic_confidence, c.semantic_evidence,
       -- familia: tipo manda, produto='ai' desempata. WHITE LABEL antes de AI
       -- porque "WHITE LABEL - CALLFACE AI" e white label.
       CASE
         WHEN upper(c.tipo) ~ 'WHITE' THEN 'WHITE_LABEL'
         WHEN upper(c.tipo) ~ 'CALLFACE[ _]AI|AGENTE IA|CALLPILOT' THEN 'CALLFACE_AI'
         WHEN upper(c.tipo) ~ 'PABX|RAMAL|LINHA SIP|YEASTAR' THEN 'PABX'
         WHEN lower(c.produto) = 'ai' THEN 'CALLFACE_AI'
         ELSE NULL
       END AS service_family,
       l.empresa_id,
       (SELECT o.id FROM oportunidades o WHERE o.negocio_id_legado = c.negocio_id
         ORDER BY (o.stage = 'ativo') NULLS LAST, o.created_at LIMIT 1) AS oportunidade_id
  FROM legado.contratos c
  JOIN leads l ON l.id = c.lead_id
 WHERE lower(btrim(c.tipo)) IS DISTINCT FROM 'assinatura';

SELECT pg_temp.mz_up('contratos', '_c_contratos') AS contratos_gravados \gset
\echo 06 contratos gravados: :contratos_gravados

-- contrato_itens: so os dos contratos que entraram.
CREATE TEMP TABLE _c_contrato_itens AS
SELECT i.* FROM legado.contrato_itens i JOIN _c_contratos c ON c.id = i.contrato_id;
SELECT pg_temp.mz_up('contrato_itens', '_c_contrato_itens') AS itens_gravados \gset
\echo 06 contrato_itens gravados: :itens_gravados

-- Lista de revisao: assinaturas Stripe que NAO viraram contrato.
\pset format csv
\set arq :revisao_dir /contratos_assinatura_descartados.csv
SELECT c.id AS contrato_id, c.lead_id, l.empresa_id, c.status, c.stripe_subscription_id, c.produto,
       c.mrr, c.inicio, c.finalizado_at, c.descricao
  FROM legado.contratos c LEFT JOIN leads l ON l.id = c.lead_id
 WHERE lower(btrim(c.tipo)) = 'assinatura' ORDER BY c.created_at, c.id \g :arq
\pset format aligned

-- ───────────────────────── 2. propostas normalizadas ─────────────────────────
-- Soma dos itens por proposta, para recalcular o cabecalho das zeradas (A16).
CREATE TEMP TABLE _c_prop_soma AS
SELECT proposta_id,
       sum(subtotal) FILTER (WHERE tipo = 'recorrente') AS rec,
       sum(subtotal) FILTER (WHERE tipo <> 'recorrente') AS avu,
       sum(subtotal) AS tot
  FROM legado.proposta_itens GROUP BY proposta_id;

CREATE TEMP TABLE _c_propostas AS
SELECT p.id, p.organizacao_id, p.lead_id, p.negocio_id, p.numero, p.versao, p.proposta_original_id,
       p.moeda,
       -- P5: tres status fora do padrao viram o vocabulario do ONFACE.
       CASE p.status WHEN 'Em Construção' THEN 'rascunho'
                     WHEN 'Negotiation'   THEN 'enviada'
                     WHEN 'Proposta Ganha' THEN 'aceita'
                     ELSE p.status END AS status,
       p.data_emissao, p.data_validade, p.observacoes, p.condicoes_pagamento,
       -- cabecalho: so as zeradas COM item (r+a=0 e itens>0) sao recalculadas.
       CASE WHEN coalesce(p.total_recorrente,0) + coalesce(p.total_avulso,0) = 0 AND coalesce(s.tot,0) > 0
            THEN coalesce(s.rec,0) ELSE p.total_recorrente END AS total_recorrente,
       CASE WHEN coalesce(p.total_recorrente,0) + coalesce(p.total_avulso,0) = 0 AND coalesce(s.tot,0) > 0
            THEN coalesce(s.avu,0) ELSE p.total_avulso END AS total_avulso,
       CASE WHEN coalesce(p.total_recorrente,0) + coalesce(p.total_avulso,0) = 0 AND coalesce(s.tot,0) > 0
            THEN s.tot ELSE p.total_geral END AS total_geral,
       u.id AS criado_por_id,           -- NULL se o autor nao entrou na carga (qa.*, inativo)
       ct.id AS contrato_id,            -- NULL se o contrato era assinatura (nao carregado)
       p.created_at, p.updated_at, p.checkout_url, p.stripe_session_id, p.enviada_em,
       CASE WHEN p.data_validade IS NOT NULL AND p.enviada_em IS NOT NULL
                 AND p.data_validade - p.enviada_em::date >= 1
            THEN p.data_validade - p.enviada_em::date END AS validade_dias,
       -- aceita_em = quando o contrato vinculado nasceu. Sem contrato, sem data.
       CASE WHEN p.status IN ('aceita','Proposta Ganha') THEN ct.created_at END AS aceita_em,
       CASE WHEN p.status = 'expirada' AND p.data_validade IS NOT NULL
            THEN p.data_validade::timestamptz END AS expirada_em,
       l.empresa_id,
       (SELECT o.id FROM oportunidades o WHERE o.negocio_id_legado = p.negocio_id
         ORDER BY (o.stage = 'ativo') NULLS LAST, o.created_at LIMIT 1) AS oportunidade_id
  FROM legado.propostas p
  JOIN leads l ON l.id = p.lead_id
  LEFT JOIN _c_prop_soma s ON s.proposta_id = p.id
  LEFT JOIN usuarios u ON u.id = p.criado_por_id
  LEFT JOIN _c_contratos ct ON ct.id = p.contrato_id;

SELECT pg_temp.mz_up('propostas', '_c_propostas') AS propostas_gravadas \gset
\echo 06 propostas gravadas: :propostas_gravadas

-- proposta_itens: revenue_nature pelo tipo. commercial_model e NOT NULL no
-- schema (migration 0014), por isso 'PAGAMENTO_DIRETO' (o mesmo default
-- conservador da 0014: item sem vinculo nunca vira "exige contrato"). O mapa
-- dizia NULL; nao e possivel. catalogo_preco_id e stripe_price_id seguem NULL.
CREATE TEMP TABLE _c_prop_itens AS
SELECT i.id, i.proposta_id, i.servico_catalogo_id, i.nome, i.descricao, i.tipo, i.moeda, i.quantidade,
       i.valor_unitario, i.desconto, i.desconto_tipo, i.subtotal, i.ordem, i.created_at,
       i.billing_source, i.non_recurring_value, i.provenance, i.recurring_value,
       CASE i.tipo WHEN 'recorrente' THEN 'MRR' WHEN 'setup' THEN 'SETUP' ELSE 'ONE_TIME' END AS revenue_nature,
       i.semantic_confidence, i.semantic_evidence, i.service_family, i.zoho_id,
       'PAGAMENTO_DIRETO'::text AS commercial_model
  FROM legado.proposta_itens i JOIN _c_propostas p ON p.id = i.proposta_id;
SELECT pg_temp.mz_up('proposta_itens', '_c_prop_itens') AS prop_itens_gravados \gset
\echo 06 proposta_itens gravados: :prop_itens_gravados

-- ───────────────────────── 3. anexos com entidade_id ─────────────────────────
-- Tres caminhos para achar o contrato do PDF, do mais forte ao mais fraco:
--  a) o entidade_id que prod ja traz, se o contrato entrou;
--  b) codigo "CT - NNN - MM/AAAA" ou "CONTRATO ID NNN - MM_AAAA" no nome do
--     arquivo, casando NUMERO e MES/ANO juntos (so numero repete entre anos)
--     com exatamente 1 contrato (mesma regra do antigo 4-historico/05);
--  c) "SalesOrder_<id>" no nome = contratos.zoho_id, tambem so se unico.
-- Ambiguo fica sem entidade_id. Anexo de contrato-assinatura descartado tambem.
CREATE TEMP TABLE _c_anexo_cod AS
SELECT x.id AS anexo_id,
       (SELECT c.id FROM _c_contratos c WHERE c.id = x.entidade_id) AS por_id,
       CASE WHEN m.m IS NOT NULL AND (SELECT count(*) FROM _c_contratos c2
              WHERE c2.descricao ~ ('CT\s*-\s*' || m.m[1] || '\s*-\s*' || m.m[2] || '[/_]' || m.m[3])) = 1
            THEN (SELECT c2.id FROM _c_contratos c2
              WHERE c2.descricao ~ ('CT\s*-\s*' || m.m[1] || '\s*-\s*' || m.m[2] || '[/_]' || m.m[3])) END AS por_codigo,
       CASE WHEN so.s IS NOT NULL AND (SELECT count(*) FROM _c_contratos c3 WHERE c3.zoho_id = so.s[1]) = 1
            THEN (SELECT c3.id FROM _c_contratos c3 WHERE c3.zoho_id = so.s[1]) END AS por_salesorder
  FROM legado.anexos_legado x
  CROSS JOIN LATERAL (SELECT regexp_match(x.nome_arquivo, '(?:CT|CONTRATO ID)\s*-?\s*(\d+)\s*-\s*(\d{2})[/_](\d{4})') AS m) m
  CROSS JOIN LATERAL (SELECT regexp_match(x.nome_arquivo, 'SalesOrder_(\d+)') AS s) so
 WHERE x.entidade_tipo = 'contrato';

CREATE TEMP TABLE _c_anexos AS
SELECT x.id, x.organizacao_id, x.entidade_tipo,
       CASE WHEN x.entidade_tipo = 'contrato'
            THEN coalesce(a.por_id, a.por_codigo, a.por_salesorder)
            ELSE x.entidade_id END AS entidade_id,
       x.categoria, x.zoho_id, x.nome_arquivo, x.tamanho_bytes, x.criado_em_original,
       x.storage_path, x.created_at, x.checksum_sha256
  FROM legado.anexos_legado x LEFT JOIN _c_anexo_cod a ON a.anexo_id = x.id;
SELECT pg_temp.mz_up('anexos_legado', '_c_anexos') AS anexos_gravados \gset
\echo 06 anexos_legado gravados: :anexos_gravados

-- ───────────────────────── 4. FKs de servicos_canonicos ─────────────────────────
-- contrato_id e oportunidade_origem_id so depois de contratos e oportunidades.
-- contrato_id = o que prod ja gravava, desde que o contrato tenha entrado (o de
-- assinatura nao entrou, entao o servico fica sem contrato, e esta certo).
-- oportunidade_origem_id = oportunidade do negocio do contrato, nunca a copia
-- 'ativo' (a que sai do funil). Nao toca updated_at.
UPDATE servicos_canonicos sc
   SET contrato_id = c.id,
       oportunidade_origem_id = coalesce(sc.oportunidade_origem_id, c.oportunidade_id)
  FROM legado.servicos_canonicos lsc
  JOIN _c_contratos c ON c.id = lsc.contrato_id
 WHERE lsc.id = sc.id
   AND (sc.contrato_id IS DISTINCT FROM c.id
        OR sc.oportunidade_origem_id IS NULL AND c.oportunidade_id IS NOT NULL);
