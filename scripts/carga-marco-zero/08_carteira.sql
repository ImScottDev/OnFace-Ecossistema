-- CARGA MARCO ZERO · passo 08 · carteira: receita mensal, universo de clientes, clientes, fulfillments.
-- Mapa: 02_MAPA_CARGA_MARCO_ZERO.md secao 2.6. Depende do 03 (empresas, leads, pessoas), 05
-- (negocios, oportunidades), 06 (contratos) e 07 (assinaturas, billing_identities). Roda numa
-- transacao do run.sh (psql --single-transaction), com o schema `legado` do 00_preparar.
--
-- Variaveis psql (todas com default):
--   planilha_set   CSV do fechamento de set/2026 (latin1, ';')
--                  default /Users/Scott/Downloads/Faturamento callface 09-2026-(Planilha1).csv
--   historico_tsv  saida de gerar_historico_receita.py (2021-03 a 2026-09, natureza por linha)
--                  default revisao/historico_receita.tsv
--   revisao_dir    pasta das listas para o Scott; default revisao
--   jenifer_email  default jenifer.matos@callface.ai
--   corte          ultimo dia do fechamento; default 2026-09-30
--
-- Regras do Scott que moram aqui:
--  - Cliente ativo = faturado no fechamento de set/26 + venda/contrato/assinatura NOVA depois do corte
--    - cancelado depois do corte. A carteira de prod nao define quem e cliente.
--  - Casar por CNPJ > e-mail (identidade Stripe) > nome. O que nao casa vai para
--    revisao/clientes_sem_match.csv; nunca no chute.
--  - Responsavel de TODOS os clientes = Jenifer Matos (responsavel_id). responsavel_cs_id fica NULL:
--    e o campo que a rota de reatribuicao em massa grava.
--  - Valor: MRR | SETUP | ONE_TIME | DEBITO_RECUPERADO sempre separados em revenue_nature.
--    set/26: Helbor 29.990 = SETUP White Label; Matte e G30 = MRR; TX 9.000 = 3.000 MRR + 6.000 debito.
--  - Data de cliente_desde/entrou_carteira_em nunca e a da carga; sem nenhuma evidencia, cs_sem_evidencia.
--  - Nada aqui toca updated_at de servico/lead que ja existia (M10).
--
-- Idempotente. cliente_receita_mensal: ON CONFLICT (organizacao_id, source_hash); clientes e servicos: id
-- ou chave deterministica. A segunda execucao nao altera linha nenhuma.

\set ON_ERROR_STOP on
\if :{?planilha_set}
\else
  \set planilha_set '/Users/Scott/Downloads/Faturamento callface 09-2026-(Planilha1).csv'
\endif
\if :{?historico_tsv}
\else
  \set historico_tsv 'revisao/historico_receita.tsv'
\endif
\if :{?revisao_dir}
\else
  \set revisao_dir 'revisao'
\endif
\if :{?jenifer_email}
\else
  \set jenifer_email 'jenifer.matos@callface.ai'
\endif
\if :{?corte}
\else
  \set corte '2026-09-30'
\endif

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Helper: copia legado.<tabela> para public.<tabela> usando as colunas que existem
-- nos DOIS lados (coluna que so existe no destino toma o default da tabela).
--   filtro      predicado SQL sobre o alias s (linhas que entram)
--   sobrescreve {coluna: 'expressao sql sobre s'} troca ou cria o valor da coluna
-- Devolve quantas linhas foram inseridas ou realmente mudadas.
CREATE FUNCTION pg_temp.mz_carga(tabela text, filtro text DEFAULT 'true', sobrescreve jsonb DEFAULT '{}') RETURNS bigint
LANGUAGE plpgsql AS $f$
DECLARE cols text[]; sel text; lista text; atualiza text; velho text; novo text; n bigint;
BEGIN
  SELECT array_agg(t.column_name::text ORDER BY t.ordinal_position) INTO cols
    FROM information_schema.columns t
   WHERE t.table_schema = 'public' AND t.table_name = tabela
     AND (sobrescreve ? t.column_name::text OR EXISTS (
           SELECT 1 FROM information_schema.columns l
            WHERE l.table_schema = 'legado' AND l.table_name = tabela AND l.column_name = t.column_name));
  SELECT string_agg(quote_ident(c), ', '),
         string_agg(coalesce(sobrescreve->>c, 's.' || quote_ident(c)), ', ')
    INTO lista, sel FROM unnest(cols) c;
  SELECT string_agg(quote_ident(c) || ' = EXCLUDED.' || quote_ident(c), ', '),
         string_agg('t.' || quote_ident(c), ', '), string_agg('EXCLUDED.' || quote_ident(c), ', ')
    INTO atualiza, velho, novo FROM unnest(cols) c WHERE c <> 'id';
  EXECUTE format(
    'INSERT INTO public.%1$I AS t (%2$s) SELECT %3$s FROM legado.%1$I s WHERE %4$s
       ON CONFLICT (id) DO UPDATE SET %5$s WHERE (%6$s) IS DISTINCT FROM (%7$s)',
    tabela, lista, sel, filtro, atualiza, velho, novo);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;


CREATE FUNCTION pg_temp.dig(t text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g') $$;
-- Nome comparavel: sem acento, sem sufixo societario, so letras e numeros.
CREATE FUNCTION pg_temp.nn(t text) RETURNS text LANGUAGE sql STABLE AS
$$ SELECT btrim(regexp_replace(regexp_replace(upper(unaccent(coalesce(t, ''))), '\m(LTDA|ME|EPP|EIRELI|SA)\M', ' ', 'g'), '[^A-Z0-9]+', ' ', 'g')) $$;

-- psql nao interpola :var dentro de $$...$$, por isso as travas passam por esta funcao.
CREATE FUNCTION pg_temp.exige(ok boolean, msg text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF NOT coalesce(ok, false) THEN RAISE EXCEPTION '%', msg; END IF; END $$;

-- Responsavel de todos os clientes: a Jenifer, por e-mail. Sem ela a carga para.
SELECT pg_temp.exige((SELECT count(*) FROM usuarios WHERE lower(email) = lower(:'jenifer_email') AND ativo) = 1,
                     'usuario ' || :'jenifer_email' || ' nao existe (ou nao esta ativo) em usuarios');
SELECT id AS jenifer_id FROM usuarios WHERE lower(email) = lower(:'jenifer_email') \gset
SELECT (:'corte'::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo' AS depois_do_corte \gset

-- ═══ 1. Entradas: planilha de set/26 e historico ════════════════════════════
-- O arquivo e lido no cliente (iconv + backtick) em vez de \copy porque \copy nao aceita variavel
-- no caminho. A planilha e latin1 com ';' e CRLF; nenhum campo tem aspas (conferido).
\set planilha_txt `iconv -f latin1 -t utf8 :'planilha_set' | tr -d '\r'`
\set historico_txt `tr -d '\r' < :'historico_tsv'`
\set planilha_set_nome `basename :'planilha_set'`

-- Uma linha por lancamento. A ultima linha do arquivo e o rodape (sem documento) com o total.
CREATE TEMP TABLE _mz_planilha_bruta AS
SELECT t.n AS linha, to_date(nullif(split_part(t.l, ';', 1), ''), 'DD/MM/YYYY') AS data,
       btrim(split_part(t.l, ';', 3)) AS nome, pg_temp.dig(split_part(t.l, ';', 4)) AS doc,
       replace(replace(btrim(split_part(t.l, ';', 5)), '.', ''), ',', '.')::numeric AS valor
  FROM regexp_split_to_table(:'planilha_txt', E'\n') WITH ORDINALITY AS t(l, n)
 WHERE t.n > 1 AND btrim(t.l) <> '';

SELECT count(*) FILTER (WHERE doc = '' AND data IS NOT NULL) AS sem_doc_com_data,
       coalesce(sum(valor) FILTER (WHERE doc = '' AND data IS NULL), 0) AS rodape,
       coalesce(sum(valor) FILTER (WHERE doc <> ''), 0) AS soma_linhas,
       count(DISTINCT doc) FILTER (WHERE doc <> '') AS docs
  FROM _mz_planilha_bruta \gset
\echo 08 planilha: :docs documentos, soma :soma_linhas, rodape :rodape
SELECT pg_temp.exige(:sem_doc_com_data = 0, 'planilha tem linha com data e sem CNPJ/CPF; corrija o arquivo');
SELECT pg_temp.exige(:soma_linhas = :rodape, 'soma das linhas da planilha difere do rodape');

CREATE TEMP TABLE _mz_planilha AS SELECT * FROM _mz_planilha_bruta WHERE doc <> '';

-- Historico gerado do xlsx oficial (TSV: ver gerar_historico_receita.py).
CREATE TEMP TABLE _mz_hist AS
SELECT split_part(t.l, E'\t', 1) AS doc, split_part(t.l, E'\t', 2) AS nome,
       (split_part(t.l, E'\t', 3) || '-01')::date AS competencia, split_part(t.l, E'\t', 4) AS bl,
       split_part(t.l, E'\t', 5)::numeric AS valor, split_part(t.l, E'\t', 6) AS natureza,
       split_part(t.l, E'\t', 7) AS familia, split_part(t.l, E'\t', 8) AS confianca,
       split_part(t.l, E'\t', 9) AS evidencia, split_part(t.l, E'\t', 10) AS fonte,
       split_part(t.l, E'\t', 11)::int AS linha
  FROM regexp_split_to_table(:'historico_txt', E'\n') WITH ORDINALITY AS t(l, n)
 WHERE t.n > 1 AND btrim(t.l) <> '';
SELECT pg_temp.exige(EXISTS (SELECT 1 FROM _mz_hist), 'historico vazio: rode gerar_historico_receita.py');

-- O historico traz a linha de negocio de set por documento; a planilha traz os valores. Tem que fechar
-- documento a documento, senao um dos dois arquivos e de outro dia.
SELECT count(*) AS divergentes FROM (
  SELECT coalesce(p.doc, h.doc) FROM
    (SELECT doc, sum(valor) v FROM _mz_planilha GROUP BY doc) p
    FULL JOIN (SELECT doc, sum(valor) v FROM _mz_hist WHERE competencia = '2026-09-01' GROUP BY doc) h ON h.doc = p.doc
   WHERE p.v IS DISTINCT FROM h.v) x \gset
SELECT pg_temp.exige(:divergentes = 0, 'documentos de set/26 com valor diferente entre a planilha e o historico; regere o historico');

-- ═══ 2. Casar documento com empresa: CNPJ > e-mail > nome ═══════════════════
CREATE TEMP TABLE _mz_docs AS
SELECT doc, (array_agg(nome ORDER BY competencia DESC))[1] AS nome FROM (
  SELECT doc, nome, competencia FROM _mz_hist
  UNION ALL SELECT doc, nome, '2026-09-01'::date FROM _mz_planilha) x
 WHERE doc <> '' GROUP BY doc;

-- 'Unresolved billing identity' e a empresa-lixo do sync Stripe: nunca e cliente.
CREATE TEMP TABLE _mz_emp AS
SELECT id, created_at, pg_temp.dig(cnpj) AS doc, pg_temp.nn(nome) AS n1, pg_temp.nn(razao_social) AS n2
  FROM empresas WHERE nome <> 'Unresolved billing identity';
CREATE INDEX ON _mz_emp (doc); CREATE INDEX ON _mz_emp (n1); CREATE INDEX ON _mz_emp (n2);

CREATE TEMP TABLE _mz_match (doc text PRIMARY KEY, empresa_id uuid NOT NULL, metodo text NOT NULL);

-- 1) CNPJ/CPF igual. Se ainda houver duas empresas com o mesmo documento (o merge do passo 3 deveria
-- ter tirado), vale a mais antiga, a mesma regra do merge.
INSERT INTO _mz_match
SELECT DISTINCT ON (d.doc) d.doc, e.id, 'cnpj' FROM _mz_docs d JOIN _mz_emp e ON e.doc = d.doc
 ORDER BY d.doc, e.created_at, e.id;

-- 2) Identidade Stripe com o mesmo CNPJ: a empresa que ela ja aponta, senao a do lead dela, senao a
-- empresa do lead que tem o e-mail da identidade (um so).
INSERT INTO _mz_match
SELECT d.doc, x.empresa_id, x.metodo FROM _mz_docs d
 CROSS JOIN LATERAL (
   SELECT coalesce(b.empresa_id, b.canonical_empresa_id) AS empresa_id, 'identidade_stripe' AS metodo, 1 AS ord
     FROM billing_identities b WHERE b.cnpj_normalized = d.doc AND coalesce(b.empresa_id, b.canonical_empresa_id) IS NOT NULL
   UNION ALL
   SELECT l.empresa_id, 'identidade_stripe_lead', 2
     FROM billing_identities b JOIN leads l ON l.id = coalesce(b.lead_id, b.canonical_lead_id)
    WHERE b.cnpj_normalized = d.doc AND l.empresa_id IS NOT NULL
   UNION ALL
   SELECT l.empresa_id, 'email', 3
     FROM billing_identities b
     CROSS JOIN LATERAL (SELECT lower(b.primary_email_normalized) AS em WHERE b.primary_email_normalized IS NOT NULL
                         UNION SELECT lower(jsonb_array_elements_text(b.emails))) e
     JOIN leads l ON lower(l.email) = e.em AND l.empresa_id IS NOT NULL
    WHERE b.cnpj_normalized = d.doc
   ORDER BY ord LIMIT 1) x
 WHERE NOT EXISTS (SELECT 1 FROM _mz_match m WHERE m.doc = d.doc)
   AND x.empresa_id IN (SELECT id FROM empresas WHERE nome <> 'Unresolved billing identity');

-- 3) Nome normalizado igual, desde que seja de UMA empresa so e que ela nao tenha OUTRO documento
-- (CNPJ diferente e nome igual e homonimo, vai para a revisao).
INSERT INTO _mz_match
SELECT d.doc, (array_agg(DISTINCT e.id))[1], 'nome' FROM _mz_docs d
  JOIN _mz_emp e ON pg_temp.nn(d.nome) <> '' AND pg_temp.nn(d.nome) IN (e.n1, e.n2) AND e.doc = ''
 WHERE NOT EXISTS (SELECT 1 FROM _mz_match m WHERE m.doc = d.doc)
 GROUP BY d.doc HAVING count(DISTINCT e.id) = 1;

SELECT count(*) FILTER (WHERE m.doc IS NULL) AS sem_match_universo,
       count(*) AS universo_docs
  FROM (SELECT DISTINCT doc FROM _mz_planilha) p LEFT JOIN _mz_match m ON m.doc = p.doc \gset
\echo 08 documentos de set/26 sem empresa :sem_match_universo de :universo_docs
SELECT metodo, count(*) AS docs FROM _mz_match GROUP BY 1 ORDER BY 2 DESC;

-- ═══ 3. cliente_receita_mensal ══════════════════════════════════════════════
-- Natureza: o que a planilha prova (SETUP pela linha de negocio) e as regras do Scott para set/26.
-- Set/26 tem 1 linha por lancamento; aqui vira 1 linha por (documento, natureza, familia).
--   Helbor 29.990 = SETUP White Label; Matte 16.395 e G30 11.902,80 = MRR (assinaturas WL dos clientes
--   deles); TX 9.000 = 3.000 MRR + 6.000 debito recuperado (o 1o lancamento e o MRR).
CREATE TEMP TABLE _mz_set_familia AS
SELECT doc,
       CASE WHEN doc IN ('02967401000140', '54164925000105', '55617458000186') THEN 'WHITE_LABEL'
            WHEN count(DISTINCT familia) = 1 THEN min(familia) ELSE 'UNKNOWN' END AS familia,
       CASE WHEN doc IN ('02967401000140', '54164925000105', '55617458000186') THEN 'CONFIRMED'
            WHEN count(DISTINCT familia) = 1 THEN min(confianca) ELSE 'UNRESOLVED' END AS confianca,
       CASE WHEN doc IN ('02967401000140', '54164925000105', '55617458000186') THEN 'scott:white_label_set26'
            WHEN count(DISTINCT familia) = 1 THEN min(evidencia) ELSE 'mais_de_uma_linha_de_negocio' END AS evidencia
  FROM _mz_hist WHERE competencia = '2026-09-01' GROUP BY doc;

CREATE TEMP TABLE _mz_receita AS
-- historico ate ago/26
SELECT h.doc, h.nome, h.competencia, h.valor, 1 AS qtd, h.familia AS service_family, h.natureza AS revenue_nature,
       h.confianca AS confidence,
       CASE WHEN h.fonte LIKE 'base_faturamento%' THEN 'planilha_base_faturamento' ELSE 'planilha_faturamento_mensal' END AS source,
       h.fonte AS source_file, h.linha::text AS source_row,
       jsonb_build_object('business_line', h.bl, 'evidencia_business_line', h.evidencia) AS evidence,
       h.bl AS chave
  FROM _mz_hist h WHERE h.competencia < '2026-09-01'
UNION ALL
-- set/26, direto da planilha
SELECT l.doc, min(l.nome), '2026-09-01'::date, sum(l.valor), count(*)::int, f.familia, l.natureza, f.confianca,
       'planilha_faturamento_mensal', :'planilha_set_nome', min(l.linha)::text,
       jsonb_build_object('evidencia_business_line', f.evidencia) ||
         CASE l.natureza WHEN 'SETUP' THEN jsonb_build_object('regra', 'scott: setup White Label')
                         WHEN 'DEBITO_RECUPERADO' THEN jsonb_build_object('regra', 'scott: debito atrasado recuperado, nao recorrente')
                         ELSE '{}'::jsonb END,
       l.natureza
  FROM (SELECT p.*, CASE WHEN p.doc = '02967401000140' THEN 'SETUP'
                         WHEN p.doc = '40972508000176' AND p.linha > min(p.linha) OVER (PARTITION BY p.doc) THEN 'DEBITO_RECUPERADO'
                         ELSE 'MRR' END AS natureza
          FROM _mz_planilha p) l
  JOIN _mz_set_familia f ON f.doc = l.doc
 GROUP BY l.doc, l.natureza, f.familia, f.confianca, f.evidencia;

INSERT INTO cliente_receita_mensal AS t
  (organizacao_id, empresa_id, customer_key, cliente_nome, documento, competencia, valor, quantidade_lancamentos,
   service_family, revenue_nature, confidence, source, source_file, source_row, evidence, source_hash)
SELECT (SELECT id FROM organizacoes), m.empresa_id, r.doc, r.nome, r.doc, r.competencia, r.valor, r.qtd,
       r.service_family, r.revenue_nature, r.confidence, r.source, r.source_file, r.source_row,
       r.evidence || jsonb_build_object('empresa_match', coalesce(m.metodo, 'sem_match')),
       encode(sha256(convert_to(r.doc || '|' || r.competencia || '|' || r.chave || '|' || r.revenue_nature, 'UTF8')), 'hex')
  FROM _mz_receita r LEFT JOIN _mz_match m ON m.doc = r.doc
 -- aditivo: se o alvo ja tem faturamento deste (documento, competencia) vindo de outra carga (outro source_hash),
 -- ele fica como esta; inserir de novo dobraria a receita do cliente naquele mes.
 WHERE NOT EXISTS (SELECT 1 FROM cliente_receita_mensal x WHERE x.customer_key = r.doc AND x.competencia = r.competencia
                      AND x.source_hash <> encode(sha256(convert_to(r.doc || '|' || r.competencia || '|' || r.chave || '|' || r.revenue_nature, 'UTF8')), 'hex'))
ON CONFLICT (organizacao_id, source_hash) DO UPDATE SET
  empresa_id = EXCLUDED.empresa_id, cliente_nome = EXCLUDED.cliente_nome, valor = EXCLUDED.valor,
  quantidade_lancamentos = EXCLUDED.quantidade_lancamentos, service_family = EXCLUDED.service_family,
  revenue_nature = EXCLUDED.revenue_nature, confidence = EXCLUDED.confidence, source = EXCLUDED.source,
  source_file = EXCLUDED.source_file, source_row = EXCLUDED.source_row, evidence = EXCLUDED.evidence, updated_at = now()
WHERE (t.empresa_id, t.cliente_nome, t.valor, t.quantidade_lancamentos, t.service_family, t.revenue_nature, t.confidence,
       t.source, t.source_file, t.source_row, t.evidence)
      IS DISTINCT FROM (EXCLUDED.empresa_id, EXCLUDED.cliente_nome, EXCLUDED.valor, EXCLUDED.quantidade_lancamentos,
       EXCLUDED.service_family, EXCLUDED.revenue_nature, EXCLUDED.confidence, EXCLUDED.source, EXCLUDED.source_file,
       EXCLUDED.source_row, EXCLUDED.evidence);

SELECT competencia::text AS mes, revenue_nature, count(*) AS linhas, sum(valor) AS valor
  FROM cliente_receita_mensal WHERE competencia >= '2026-07-01' GROUP BY 1, 2 ORDER BY 1, 2;

-- ═══ 4. Universo de clientes ════════════════════════════════════════════════
-- ativo = faturou em set/26 + venda/contrato/assinatura nova depois do corte - cancelado depois do corte.
-- Venda nova de outubro nunca vira churn (so quem estava no fechamento pode ser cancelado).
-- Assinatura Stripe nova conta como cliente mesmo sem virar contrato (P15).
CREATE TEMP TABLE _mz_universo AS
WITH set26 AS (
  SELECT DISTINCT m.empresa_id FROM _mz_match m WHERE m.doc IN (SELECT doc FROM _mz_planilha)),
novos AS (
  SELECT empresa_id FROM negocios WHERE status = 'ganho' AND ganho_at >= :'depois_do_corte' AND empresa_id IS NOT NULL
  UNION SELECT empresa_id FROM contratos WHERE status = 'ativo' AND created_at >= :'depois_do_corte' AND empresa_id IS NOT NULL
  UNION SELECT empresa_id FROM assinaturas WHERE status IN ('active', 'trialing', 'past_due')
           AND coalesce(iniciada_em, created_at) >= :'depois_do_corte' AND empresa_id IS NOT NULL),
u AS (
  SELECT e.id AS empresa_id, e.id IN (SELECT empresa_id FROM set26) AS em_set26, e.id IN (SELECT empresa_id FROM novos) AS venda_nova
    FROM empresas e WHERE e.id IN (SELECT empresa_id FROM set26 UNION SELECT empresa_id FROM novos))
SELECT u.*,
       (u.em_set26 AND NOT u.venda_nova
        AND (EXISTS (SELECT 1 FROM assinaturas a WHERE a.empresa_id = u.empresa_id AND a.status = 'canceled' AND a.cancelada_em >= :'depois_do_corte')
             OR EXISTS (SELECT 1 FROM contratos c WHERE c.empresa_id = u.empresa_id AND c.status IN ('churned', 'cancelado') AND c.finalizado_at >= :'depois_do_corte'))
        AND NOT EXISTS (SELECT 1 FROM assinaturas a WHERE a.empresa_id = u.empresa_id AND a.status IN ('active', 'trialing', 'past_due', 'unpaid'))
        AND NOT EXISTS (SELECT 1 FROM contratos c WHERE c.empresa_id = u.empresa_id AND c.status = 'ativo')) AS cancelado
  FROM u;
SELECT count(*) AS universo, count(*) FILTER (WHERE cancelado) AS cancelados, count(*) FILTER (WHERE venda_nova AND NOT em_set26) AS novos_fora_do_set FROM _mz_universo \gset
\echo 08 universo: :universo empresas (:cancelados cancelados depois do corte, :novos_fora_do_set vendas novas fora do fechamento)

-- ═══ 5. Clientes ════════════════════════════════════════════════════════════
-- 1 linha por empresa do universo (o 360 da 404 sem ela). cliente_desde = 1a competencia da planilha;
-- sem planilha, a mais antiga entre ganho, inicio de contrato e 1a fatura paga; nunca a data da carga.
-- responsavel_id = Jenifer; responsavel_cs_id fica NULL (e o que a reatribuicao em massa grava).
CREATE TEMP TABLE _mz_clientes AS
SELECT md5('mz-cliente:' || u.empresa_id)::uuid AS id, e.organizacao_id, u.empresa_id,
       (SELECT p.id FROM pessoas p JOIN leads l ON l.id = p.lead_id_legado
         WHERE l.empresa_id = u.empresa_id AND l.tipo = 'cliente' AND p.email IS NOT NULL
         ORDER BY l.created_at, l.id LIMIT 1) AS pessoa_principal_id,
       (SELECT o.id FROM oportunidades o WHERE o.empresa_id = u.empresa_id AND o.stage = 'ganho'
         ORDER BY o.ganho_at NULLS LAST, o.created_at LIMIT 1) AS oportunidade_origem_id,
       d.desde AS cliente_desde,
       CASE WHEN u.cancelado THEN 'churned' ELSE 'ativo' END AS status_financeiro,
       (SELECT l.id FROM leads l WHERE l.empresa_id = u.empresa_id AND l.tipo = 'cliente'
           AND NOT EXISTS (SELECT 1 FROM clientes c2 WHERE c2.lead_id_legado = l.id AND c2.empresa_id IS DISTINCT FROM u.empresa_id)
         ORDER BY l.created_at, l.id LIMIT 1) AS lead_id_legado,
       d.desde IS NULL AS cs_sem_evidencia,
       CASE WHEN u.cancelado THEN 'churned_apos_fechamento_set26'
            WHEN u.em_set26 THEN 'ativo_fechamento_set26' ELSE 'ativo_venda_nova_apos_set26' END AS lifecycle_status
  FROM _mz_universo u JOIN empresas e ON e.id = u.empresa_id
  CROSS JOIN LATERAL (SELECT coalesce(
      (SELECT (min(r.competencia)::timestamp AT TIME ZONE 'America/Sao_Paulo') FROM _mz_receita r JOIN _mz_match m ON m.doc = r.doc WHERE m.empresa_id = u.empresa_id),
      LEAST((SELECT min(n.ganho_at) FROM negocios n WHERE n.empresa_id = u.empresa_id AND n.status = 'ganho'),
            (SELECT min(c.inicio)::timestamp AT TIME ZONE 'America/Sao_Paulo' FROM contratos c WHERE c.empresa_id = u.empresa_id),
            (SELECT min(f.paga_em) FROM faturas f WHERE f.empresa_id = u.empresa_id AND f.paga_em IS NOT NULL))) AS desde) d;

INSERT INTO clientes AS t (id, organizacao_id, empresa_id, pessoa_principal_id, oportunidade_origem_id, cliente_desde,
                           entrou_carteira_em, status_financeiro, lead_id_legado, responsavel_id, cs_sem_evidencia, lifecycle_status)
SELECT c.id, c.organizacao_id, c.empresa_id, c.pessoa_principal_id, c.oportunidade_origem_id, c.cliente_desde,
       c.cliente_desde, c.status_financeiro, c.lead_id_legado, :'jenifer_id'::uuid, c.cs_sem_evidencia, c.lifecycle_status
  FROM _mz_clientes c
ON CONFLICT (organizacao_id, empresa_id) WHERE empresa_id IS NOT NULL DO UPDATE SET
  pessoa_principal_id = EXCLUDED.pessoa_principal_id, oportunidade_origem_id = EXCLUDED.oportunidade_origem_id,
  cliente_desde = EXCLUDED.cliente_desde, entrou_carteira_em = EXCLUDED.entrou_carteira_em,
  status_financeiro = EXCLUDED.status_financeiro, lead_id_legado = coalesce(t.lead_id_legado, EXCLUDED.lead_id_legado),
  -- quem ja foi reatribuido na tela nao volta para a Jenifer
  responsavel_id = coalesce(t.responsavel_id, EXCLUDED.responsavel_id),
  cs_sem_evidencia = EXCLUDED.cs_sem_evidencia, lifecycle_status = EXCLUDED.lifecycle_status, updated_at = now()
WHERE (t.pessoa_principal_id, t.oportunidade_origem_id, t.cliente_desde, t.entrou_carteira_em, t.status_financeiro,
       t.lead_id_legado, t.responsavel_id, t.cs_sem_evidencia, t.lifecycle_status)
      IS DISTINCT FROM (EXCLUDED.pessoa_principal_id, EXCLUDED.oportunidade_origem_id, EXCLUDED.cliente_desde,
       EXCLUDED.entrou_carteira_em, EXCLUDED.status_financeiro, coalesce(t.lead_id_legado, EXCLUDED.lead_id_legado),
       coalesce(t.responsavel_id, EXCLUDED.responsavel_id), EXCLUDED.cs_sem_evidencia, EXCLUDED.lifecycle_status);

-- P11: o lead tipo cliente dos clientes da carteira tambem e da Jenifer (Contatos e as fichas mostram o
-- mesmo dono). O negocio mantem a closer. Sem tocar updated_at (M10).
UPDATE leads SET responsavel_id = :'jenifer_id'::uuid
 WHERE tipo = 'cliente' AND empresa_id IN (SELECT empresa_id FROM _mz_universo)
   AND responsavel_id IS DISTINCT FROM :'jenifer_id'::uuid;

-- ═══ 6. Servicos canonicos alinhados ao universo (P12) ══════════════════════
-- 6a. Empresa do universo sem nenhum servico ganha um. Familia: a do contrato (service_family ja
--     derivada por tipo no passo 06) e, sem contrato, a linha de negocio da planilha de faturamento,
--     quando ela tem evidencia. Sem evidencia a familia e UNKNOWN: NUNCA default PABX.
--     revenue_nature UNKNOWN e valor 0 de proposito (a planilha diz o faturado, nao a recorrencia).
INSERT INTO servicos_canonicos (organizacao_id, empresa_id, canonical_key, service_family, revenue_nature, billing_source,
                                commercial_lifecycle, billing_status, current_recurring_value, as_of_date, portfolio_included,
                                confidence, evidence)
SELECT e.organizacao_id, u.empresa_id, 'MARCO_ZERO:' || u.empresa_id, f.familia, 'UNKNOWN', 'MARCO_ZERO',
       CASE WHEN u.cancelado THEN 'CHURNED' ELSE 'ACTIVE' END, 'UNKNOWN', 0, :'corte'::date, NOT u.cancelado,
       f.confianca, jsonb_build_object('origem', 'marco_zero_universo', 'evidencia_familia', f.evidencia)
  FROM _mz_universo u JOIN empresas e ON e.id = u.empresa_id
  CROSS JOIN LATERAL (
    SELECT familia, confianca, evidencia FROM (
      SELECT c.service_family AS familia, 'PROBABLE' AS confianca, 'contrato:' || c.tipo AS evidencia, 1 AS ord
        FROM contratos c WHERE c.empresa_id = u.empresa_id AND c.service_family IS NOT NULL
      UNION ALL
      SELECT sf.familia, sf.confianca, 'faturamento:' || sf.evidencia, 2
        FROM _mz_set_familia sf JOIN _mz_match m ON m.doc = sf.doc
       WHERE m.empresa_id = u.empresa_id AND sf.familia <> 'UNKNOWN' AND sf.confianca <> 'UNRESOLVED'
      UNION ALL SELECT 'UNKNOWN', 'UNRESOLVED', 'sem_evidencia', 3) z
    ORDER BY ord LIMIT 1) f
 WHERE NOT EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = u.empresa_id)
ON CONFLICT (organizacao_id, canonical_key) DO NOTHING;

-- 6b. Quem nao e cliente da carteira (fora do universo, ou cancelado depois do corte) sai do portfolio e
--     o servico ACTIVE dele passa a CHURNED; a ficha e as telas leem isso. Nunca liga portfolio_included de
--     servico que prod tinha desligado. O estado de antes fica em evidence.marco_zero_p12 (reversivel).
--     Nao toca updated_at.
UPDATE servicos_canonicos sc
   SET portfolio_included = false,
       commercial_lifecycle = CASE WHEN sc.commercial_lifecycle = 'ACTIVE' THEN 'CHURNED' ELSE sc.commercial_lifecycle END,
       evidence = sc.evidence || jsonb_build_object('marco_zero_p12', coalesce(sc.evidence -> 'marco_zero_p12',
                    jsonb_build_object('portfolio_included_antes', sc.portfolio_included, 'commercial_lifecycle_antes', sc.commercial_lifecycle)))
 WHERE (sc.portfolio_included OR sc.commercial_lifecycle = 'ACTIVE')
   AND NOT EXISTS (SELECT 1 FROM _mz_universo u WHERE u.empresa_id = sc.empresa_id AND NOT u.cancelado);

-- ═══ 7. Fulfillments (onboarding) ═══════════════════════════════════════════
SELECT 'fulfillments' AS tabela, pg_temp.mz_carga('fulfillments', 'true', jsonb_build_object(
  'tipo', $$'ONBOARDING'$$,
  'cancelled_at', $$CASE WHEN s.status = 'CANCELED' THEN s.updated_at END$$)) AS linhas;
SELECT 'fulfillment_itens' AS tabela, pg_temp.mz_carga('fulfillment_itens') AS linhas;
SELECT 'fulfillment_formularios' AS tabela, pg_temp.mz_carga('fulfillment_formularios') AS linhas;
SELECT 'fulfillment_ramais' AS tabela, pg_temp.mz_carga('fulfillment_ramais') AS linhas;
SELECT 'fulfillment_linhas_portabilidade' AS tabela, pg_temp.mz_carga('fulfillment_linhas_portabilidade') AS linhas;

-- ═══ 8. Listas para o Scott revisar (revisao/ fica fora do git) ═════════════
\pset format csv
-- Documentos faturados em set/26 que nao casaram com nenhuma empresa. O candidato e o nome mais parecido
-- (pg_trgm), so uma sugestao: ninguem foi ligado no chute.
\set arq :revisao_dir /clientes_sem_match.csv
SELECT p.doc AS documento, min(p.nome) AS nome_planilha, count(*) AS lancamentos, sum(p.valor) AS valor_set_2026,
       c.id AS candidato_empresa_id, c.nome AS candidato_nome, c.cnpj AS candidato_cnpj, round(c.sim::numeric, 2) AS similaridade
  FROM _mz_planilha p
  LEFT JOIN LATERAL (SELECT e.id, e.nome, e.cnpj, similarity(pg_temp.nn(e.nome), pg_temp.nn(p.nome)) AS sim
                       FROM empresas e ORDER BY 4 DESC LIMIT 1) c ON true
 WHERE NOT EXISTS (SELECT 1 FROM _mz_match m WHERE m.doc = p.doc)
 GROUP BY p.doc, c.id, c.nome, c.cnpj, c.sim ORDER BY 4 DESC \g :arq

-- Servicos que sairam do portfolio porque a empresa nao faturou em set/26 nem comprou depois.
\set arq :revisao_dir /servicos_fora_do_universo.csv
SELECT sc.id AS servico_id, e.nome AS empresa, e.cnpj, sc.service_family, sc.revenue_nature, sc.current_recurring_value AS valor_recorrente,
       sc.billing_status, sc.evidence -> 'marco_zero_p12' ->> 'commercial_lifecycle_antes' AS lifecycle_antes
  FROM servicos_canonicos sc LEFT JOIN empresas e ON e.id = sc.empresa_id
 WHERE sc.evidence ? 'marco_zero_p12' AND sc.evidence -> 'marco_zero_p12' ->> 'commercial_lifecycle_antes' = 'ACTIVE'
 ORDER BY sc.current_recurring_value DESC, e.nome \g :arq

-- Quem entrou no universo e por que (confere o numero de clientes ativos).
\set arq :revisao_dir /clientes_universo.csv
SELECT e.id AS empresa_id, e.nome, e.cnpj, cl.status_financeiro, cl.lifecycle_status, u.em_set26, u.venda_nova, u.cancelado,
       (SELECT sum(r.valor) FROM cliente_receita_mensal r WHERE r.empresa_id = u.empresa_id AND r.competencia = '2026-09-01') AS faturado_set_2026
  FROM _mz_universo u JOIN empresas e ON e.id = u.empresa_id JOIN clientes cl ON cl.empresa_id = u.empresa_id
 ORDER BY cl.status_financeiro, e.nome \g :arq
\pset format aligned
