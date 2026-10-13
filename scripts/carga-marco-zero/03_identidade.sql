-- CARGA MARCO ZERO · passo 03 · identidade (mapa 2.2): merge de CNPJ, empresas,
-- leads (com o estado de pre-vendas JA FINAL), pessoas, vinculos, tags.
-- Depende de 00 (legado, _mz_negocio_depara) e 01/02 (usuarios, labels).
--
-- Variavel psql: revisao_dir (saida de revisao/merge_empresas.csv).
--
-- Duas tabelas de apoio ficam no alvo para os passos seguintes (e para as outras
-- frentes: 06 a 09 devem remapear empresa_id pelo mesmo mapa):
--   _mz_empresa_merge (origem_id -> destino_id)   duplicada por CNPJ (fica a mais antiga, P14)
--                                                  ou por NOME igual (fica a que tem CNPJ)
--   _mz_lead_estado   estado final de pre-vendas por lead; 04 espelha em aquisicoes
--
-- Regras do Scott que moram aqui:
--  - estagio_pre_vendas e os fatos (qualificado, desqualificado_em, nutricao_*,
--    motivo) nascem iguais em leads e aquisicoes (B5), e NUNCA 'novo' em massa (B4).
--  - no-show: o negocio vira perdido (passo 05) e o LEAD volta a QUALIFICACAO, so se
--    tipo=lead e nao foi desqualificado, nem estagnado/perdido depois, nem esta em
--    nutricao por sdr_*. Os desqualificados e os sdr_sem_interesse ficam onde estao.
--  - lead com negocio ABERTO depois do de-para = oportunidade. Lead sem negocio
--    aberto cujo negocio estagnou (ou foi perdido, se qualified) = nutricao com o motivo
--    do negocio (P6, premissa do handoff).
--  - leads.responsavel_id vai como em prod; a Jenifer nos leads tipo cliente da
--    carteira e do passo 08 (so ele sabe quem e carteira).
\set ON_ERROR_STOP on
\if :{?revisao_dir}
\else
  \set revisao_dir revisao
\endif
BEGIN;
\ir _lib.sql

-- ───────────────────────── 1. merge de empresa duplicada ─────────────────────────
-- Duas passadas, nesta ordem:
--   a) MESMO DOCUMENTO (so digitos, CPF ou CNPJ, nunca sequencia repetida): fica a mais
--      antiga (P14). Sao nomes diferentes da mesma empresa (comercial x razao social).
--   b) MESMO NOME normalizado (caixa, acento e pontuacao fora), quando o grupo tem no
--      MAXIMO um CNPJ distinto: fica a que TEM CNPJ e, sem nenhuma, a mais antiga.
--      E a regra do Scott (06/10) que ja vale no runtime (lib/vendas/identidade.ts):
--      sem CNPJ, nome IGUAL e a mesma empresa. Sem esta passada, prod entregava o par
--      "empresa com o contato" + "empresa com o cliente/negocio", e a ficha do cliente
--      abria SEM contato nenhum (46 grupos no dump de 06/10, 33 deles assim).
--      Grupo com DOIS CNPJs diferentes NAO junta: ai sao empresas distintas de verdade.
DROP TABLE IF EXISTS _mz_empresa_merge;
CREATE TABLE _mz_empresa_merge AS
WITH base AS (
  SELECT e.id, e.nome, e.created_at,
         nullif(regexp_replace(coalesce(e.cnpj, ''), '\D', '', 'g'), '') AS doc_bruto
    FROM legado.empresas e
), doc AS (
  SELECT b.*, CASE WHEN length(b.doc_bruto) IN (11, 14) AND b.doc_bruto !~ '^(\d)\1+$'
                   THEN b.doc_bruto END AS doc
    FROM base b
), por_doc AS (
  SELECT id, doc, first_value(id) OVER (PARTITION BY doc ORDER BY created_at, id) AS manter
    FROM doc WHERE doc IS NOT NULL
), rep AS (   -- representante depois da passada (a)
  SELECT d.id, coalesce(pd.manter, d.id) AS r1
    FROM doc d LEFT JOIN por_doc pd ON pd.id = d.id
), chave AS (   -- um representante por linha, com nome normalizado
  SELECT DISTINCT r.r1 AS id, d.doc, d.created_at,
         regexp_replace(translate(lower(d.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
                        '[^a-z0-9]+', '', 'g') AS k
    FROM rep r JOIN doc d ON d.id = r.r1
), grupo_nome AS (
  SELECT k FROM chave WHERE length(k) >= 3
   GROUP BY k HAVING count(*) > 1 AND count(DISTINCT doc) <= 1
), por_nome AS (
  SELECT c.id,
         first_value(c.id) OVER (PARTITION BY c.k ORDER BY (c.doc IS NULL), c.created_at, c.id) AS manter
    FROM chave c JOIN grupo_nome g USING (k)
)
SELECT r.id AS origem_id,
       coalesce(pn.manter, r.r1) AS destino_id,
       d.doc,
       CASE WHEN r.r1 <> r.id THEN 'cnpj' ELSE 'nome' END AS motivo
  FROM rep r
  JOIN doc d ON d.id = r.id
  LEFT JOIN por_nome pn ON pn.id = r.r1
 WHERE coalesce(pn.manter, r.r1) <> r.id;
ALTER TABLE _mz_empresa_merge ADD PRIMARY KEY (origem_id);
-- Para os passos 06 a 11: qualquer empresa_id que venha de prod passa por aqui
-- (_mz_empresa(s.empresa_id)), senao aponta para a empresa descartada e quebra a FK.
CREATE OR REPLACE FUNCTION public._mz_empresa(id uuid) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT coalesce((SELECT m.destino_id FROM _mz_empresa_merge m WHERE m.origem_id = id), id) $$;

\pset format csv
\set arq :revisao_dir /merge_empresas.csv
SELECT m.motivo, coalesce(m.doc, '') AS documento,
       m.destino_id AS manter_id, k.nome AS manter_nome, k.created_at AS manter_criada_em,
       m.origem_id AS descartar_id, o.nome AS descartar_nome, o.created_at AS descartar_criada_em
  FROM _mz_empresa_merge m
  JOIN legado.empresas k ON k.id = m.destino_id
  JOIN legado.empresas o ON o.id = m.origem_id
 ORDER BY m.motivo, k.nome, o.created_at \g :arq
\pset format aligned

-- ───────────────────────── 2. empresas ─────────────────────────
-- Direto, sem as duplicatas. dominio = host do website (sem esquema, www, caminho);
-- razao_social, logradouro, numero e bairro nao existem em prod, ficam NULL.
CREATE TEMP TABLE _emp AS
SELECT s.*,
       nullif(split_part(regexp_replace(regexp_replace(lower(btrim(s.website)), '^[a-z][a-z0-9+.-]*://', ''), '^www\.', ''), '/', 1), '') AS _host
  FROM legado.empresas s
 WHERE NOT EXISTS (SELECT 1 FROM _mz_empresa_merge m WHERE m.origem_id = s.id);
SELECT 'empresas' AS tabela, pg_temp.mz_carga('empresas', '_emp', 'true', jsonb_build_object(
  'dominio',              $$CASE WHEN s._host ~ '^[^ ]+\.[^ ]+$' THEN s._host END$$,
  'canonical_empresa_id', 'NULL')) AS linhas;  -- FK para si mesma: segunda passada
UPDATE empresas t SET canonical_empresa_id = c.alvo
  FROM (SELECT s.id, coalesce(m.destino_id, s.canonical_empresa_id) AS alvo
          FROM legado.empresas s LEFT JOIN _mz_empresa_merge m ON m.origem_id = s.canonical_empresa_id
         WHERE s.canonical_empresa_id IS NOT NULL) c
 WHERE t.id = c.id AND c.alvo <> c.id AND t.canonical_empresa_id IS DISTINCT FROM c.alvo
   AND EXISTS (SELECT 1 FROM empresas x WHERE x.id = c.alvo);

-- ───────────────────────── 3. estado de pre-vendas por lead ─────────────────────────
DROP TABLE IF EXISTS _mz_lead_estado;
CREATE TABLE _mz_lead_estado AS
WITH neg AS (
  SELECT d.lead_id,
         bool_or(d.aberto)                       AS aberto,
         bool_or(d.status_legado = 'no_show')    AS noshow,
         bool_or(d.estagnado)                    AS estag,
         bool_or(d.status_legado = 'perdido')    AS perd,
         min(n.created_at)                       AS primeiro_negocio_em
    FROM _mz_negocio_depara d JOIN legado.negocios n ON n.id = d.negocio_id
   WHERE d.lead_id IS NOT NULL GROUP BY 1
), ult AS (   -- negocio estagnado/perdido mais recente do lead: da o motivo da nutricao (P6)
  SELECT DISTINCT ON (lead_id) lead_id, status_legado, motivo_chave, perdido_at
    FROM _mz_negocio_depara
   WHERE status_novo = 'perdido' AND status_legado <> 'no_show' AND lead_id IS NOT NULL
   ORDER BY lead_id, perdido_at DESC NULLS LAST, negocio_id
), sc AS (
  SELECT lead_id,
         max(created_at) FILTER (WHERE para_status = 'disqualified') AS desq_em,
         max(created_at) FILTER (WHERE para_status LIKE 'sdr\_%')    AS nut_em
    FROM legado.status_changes WHERE lead_id IS NOT NULL GROUP BY 1
), b AS (
  SELECT l.id AS lead_id, l.tipo, l.sdr_status, l.created_at, l.updated_at, l.contato_desde_at, l.next_followup_at,
         l.motivo_perda, l.motivo_perda_detalhe, l.origem, l.campos_custom, l.negocio_ativo_id,
         coalesce(neg.aberto, false) AS aberto, coalesce(neg.noshow, false) AS noshow,
         coalesce(neg.estag, false) AS estag, coalesce(neg.perd, false) AS perd,
         neg.primeiro_negocio_em, ult.status_legado AS ult_status, ult.motivo_chave AS ult_motivo, ult.perdido_at AS ult_em,
         sc.desq_em, sc.nut_em,
         -- etapa da aquisicao
         CASE
           WHEN l.sdr_status = 'disqualified'                                   THEN 'desqualificado'
           WHEN l.tipo = 'lead' AND coalesce(neg.aberto, false)                 THEN 'oportunidade'
           WHEN l.sdr_status LIKE 'sdr\_%'                                      THEN 'nutricao'
           WHEN l.tipo = 'lead' AND coalesce(neg.noshow, false)
                AND NOT coalesce(neg.estag, false) AND NOT coalesce(neg.perd, false) THEN 'qualificado'  -- no-show volta a QUALIFICADO (Scott 06/10)
           WHEN l.tipo = 'lead' AND (coalesce(neg.estag, false)
                OR (coalesce(neg.perd, false) AND l.sdr_status = 'qualified'))  THEN 'nutricao'
           WHEN l.sdr_status = 'contacted'                                      THEN 'em_contato'
           WHEN l.sdr_status = 'qualifying'                                     THEN 'qualificacao'
           WHEN l.sdr_status = 'qualified'                                      THEN 'qualificado'
           ELSE 'novo'
         END AS etapa
    FROM legado.leads l
    LEFT JOIN neg ON neg.lead_id = l.id
    LEFT JOIN ult ON ult.lead_id = l.id
    LEFT JOIN sc  ON sc.lead_id = l.id
), c AS (
  SELECT b.*,
         -- motivo de nutricao (MOTIVOS_NUTRICAO). retomar_em_data exige data e prod nao tem (P8):
         -- sem next_followup_at cai em sem_resposta.
         CASE WHEN b.etapa <> 'nutricao' THEN NULL
              WHEN b.sdr_status = 'sdr_sem_retorno'   THEN 'sem_resposta'
              WHEN b.sdr_status = 'sdr_sem_interesse' THEN 'sem_interesse_agora'
              WHEN b.sdr_status = 'sdr_retomar_depois' THEN CASE WHEN b.next_followup_at IS NOT NULL THEN 'retomar_em_data' ELSE 'sem_resposta' END
              WHEN b.ult_status = 'outra_data'        THEN 'timing'
              WHEN b.ult_status = 'sem_retorno'       THEN 'sem_resposta'
              WHEN b.ult_status IN ('trava_negociacao', 'trava_assinatura') THEN 'decisao_interna'
              WHEN b.ult_motivo = 'sem_retorno'       THEN 'sem_resposta'
              WHEN b.ult_motivo IN ('sem_orcamento', 'preco') THEN 'sem_orcamento'
              WHEN b.ult_motivo = 'sem_interesse'     THEN 'sem_interesse_agora'
              ELSE 'outro' END AS nutricao_status,
         (b.sdr_status = 'qualified' OR b.etapa IN ('qualificado', 'oportunidade') OR b.primeiro_negocio_em IS NOT NULL) AS qualificado
    FROM b
)
SELECT c.lead_id, c.tipo, c.etapa, c.qualificado,
       -- fato com data real: 1o negocio, senao contato_desde_at, senao a criacao do lead (nunca a data da carga)
       CASE WHEN c.qualificado THEN coalesce(c.primeiro_negocio_em, c.contato_desde_at, c.created_at) END AS qualificado_em,
       CASE WHEN c.etapa = 'desqualificado' THEN coalesce(c.desq_em, c.updated_at) END AS desqualificado_em,
       -- motivo de desqualificacao (MOTIVOS_DESQUALIFICACAO, P7); sem motivo fica NULL, nunca 'outro' inventado
       CASE WHEN c.etapa <> 'desqualificado' THEN NULL
            WHEN c.motivo_perda IN ('fora_icp', 'contato_invalido', 'outro') THEN c.motivo_perda
            WHEN c.motivo_perda = 'sem_interesse'      THEN 'sem_necessidade'
            WHEN c.motivo_perda = 'porte_incompativel' THEN 'sem_fit'
            WHEN c.motivo_perda IN ('sem_budget', 'nao_respondeu') THEN 'outro'
            WHEN c.motivo_perda IS NOT NULL            THEN 'outro' END AS desq_motivo,
       CASE WHEN c.etapa <> 'desqualificado' THEN NULL
            ELSE coalesce(nullif(btrim(c.motivo_perda_detalhe), ''),
                          CASE WHEN c.motivo_perda IN ('sem_budget', 'nao_respondeu') THEN c.motivo_perda END) END AS desq_detalhe,
       c.nutricao_status,
       CASE WHEN c.nutricao_status = 'retomar_em_data' THEN c.next_followup_at END AS retomar_em,
       CASE WHEN c.etapa = 'nutricao' THEN coalesce(c.nut_em, c.ult_em, c.updated_at) END AS nutrido_em,
       -- fora do board: nao-lead (contato, cliente, ex-cliente) nasce encerrado na criacao;
       -- saidas (desqualificado, nutricao) encerram na data do proprio fato (06b), nunca now()
       CASE WHEN c.tipo IS DISTINCT FROM 'lead' THEN c.created_at
            WHEN c.etapa = 'desqualificado' THEN coalesce(c.desq_em, c.updated_at)
            WHEN c.etapa = 'nutricao' THEN coalesce(c.nut_em, c.ult_em, c.updated_at) END AS closed_at,
       c.campos_custom -> 'qualificacaoSdr' AS qualificacao,
       -- outbound: pending = 'novo'; trabalhado = 'pre_qualificado' (L8)
       CASE WHEN lower(btrim(c.origem)) = 'outbound' THEN CASE WHEN c.sdr_status = 'pending' THEN 'novo' ELSE 'pre_qualificado' END END AS prospeccao_estado,
       (lower(btrim(c.origem)) = 'outbound' AND c.sdr_status IS DISTINCT FROM 'pending') AS pre_qualificado,
       -- o negocio ativo do lead so vale se continuou aberto depois do de-para
       (SELECT d.aberto FROM _mz_negocio_depara d WHERE d.negocio_id = c.negocio_ativo_id) IS TRUE AS negocio_ativo_ok
  FROM c;
ALTER TABLE _mz_lead_estado ADD PRIMARY KEY (lead_id);

-- ───────────────────────── 4. leads ─────────────────────────
CREATE TEMP TABLE _l AS
SELECT l.*, e.etapa AS e_etapa, e.qualificado AS e_qualificado, e.qualificado_em AS e_qualificado_em,
       e.desqualificado_em AS e_desq_em, e.desq_motivo AS e_desq_motivo, e.desq_detalhe AS e_desq_detalhe,
       e.nutricao_status AS e_nut_motivo, e.retomar_em AS e_retomar_em, e.nutrido_em AS e_nutrido_em,
       e.qualificacao AS e_qualificacao, e.prospeccao_estado AS e_prosp, e.pre_qualificado AS e_prequal,
       e.negocio_ativo_ok AS e_neg_ok
  FROM legado.leads l JOIN _mz_lead_estado e ON e.lead_id = l.id;
SELECT 'leads' AS tabela, pg_temp.mz_carga('leads', '_l', 'true', jsonb_build_object(
  'empresa_id',             'coalesce((SELECT m.destino_id FROM _mz_empresa_merge m WHERE m.origem_id = s.empresa_id), s.empresa_id)',
  'estagio_pre_vendas',     's.e_etapa',
  'qualificado',            's.e_qualificado',
  'qualificado_em',         's.e_qualificado_em',
  'qualificacao',           's.e_qualificacao',
  'desqualificado_em',      's.e_desq_em',
  'desqualificacao_motivo', 's.e_desq_motivo',
  'desqualificacao_detalhe','s.e_desq_detalhe',
  'nutricao_motivo',        's.e_nut_motivo',
  'nutricao_retomar_em',    's.e_retomar_em::date',
  'nutrido_em',             's.e_nutrido_em',
  'prospeccao_estado',      's.e_prosp',
  'pre_qualificado',        's.e_prequal',
  'pre_qualificado_em',     'CASE WHEN s.e_prequal THEN s.updated_at END',
  'negocio_ativo_id',       'CASE WHEN s.e_neg_ok THEN s.negocio_ativo_id END',
  'canonical_lead_id',      'NULL'),
  'id', ARRAY['responsavel_id']) AS linhas;  -- o 08 troca o dono dos leads cliente da carteira
-- canonical_lead_id aponta para outro lead: segunda passada, depois que todos existem.
UPDATE leads t SET canonical_lead_id = s.canonical_lead_id
  FROM legado.leads s
 WHERE t.id = s.id AND s.canonical_lead_id IS NOT NULL AND t.canonical_lead_id IS DISTINCT FROM s.canonical_lead_id
   AND EXISTS (SELECT 1 FROM leads x WHERE x.id = s.canonical_lead_id);

-- Identidade da PESSOA: o legado nunca preencheu canonical_lead_id (0 de 4.084),
-- entao dois leads da mesma pessoa na mesma empresa viravam duas pessoas (a conta
-- mostrava "Laryssa Luany" tres vezes). Segunda passada: dentro da empresa, leads
-- com o mesmo e-mail, e depois com o mesmo telefone, apontam para o lead mais
-- antigo do grupo. Nome igual NAO junta: homonimo em empresa grande e comum.
CREATE TEMP TABLE _lead_ident AS
WITH i AS (
  SELECT l.id, l.empresa_id, l.created_at,
         nullif(lower(trim(l.email)), '') AS em,
         nullif(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), '') AS tel
    FROM leads l WHERE l.empresa_id IS NOT NULL AND l.canonical_lead_id IS NULL),
por_email AS (
  SELECT id, first_value(id) OVER (PARTITION BY empresa_id, em ORDER BY created_at, id) AS a
    FROM i WHERE em IS NOT NULL),
r1 AS (SELECT i.id, i.empresa_id, i.tel, i.created_at, coalesce(pe.a, i.id) AS a
         FROM i LEFT JOIN por_email pe ON pe.id = i.id),
por_tel AS (
  SELECT id, first_value(a) OVER (PARTITION BY empresa_id, tel ORDER BY created_at, id) AS a
    FROM r1 WHERE tel IS NOT NULL)
SELECT r1.id AS lead_id, coalesce(pt.a, r1.a) AS ancora
  FROM r1 LEFT JOIN por_tel pt ON pt.id = r1.id;

UPDATE leads t SET canonical_lead_id = li.ancora
  FROM _lead_ident li WHERE t.id = li.lead_id AND li.ancora <> t.id;

-- ───────────────────────── 5. pessoas e vinculos ─────────────────────────
-- 1 pessoa por lead CANONICO (pessoas.lead_id_legado), id deterministico para
-- reexecutar sem duplicar. O lead nao canonico continua existindo como aquisicao;
-- so nao vira uma segunda pessoa. Campo nulo no ancora e completado pelo grupo.
-- O vinculo pessoa x empresa vem da empresa do lead; o contato principal da
-- empresa e o lead mais antigo dela.
CREATE TEMP TABLE _pessoa AS
SELECT md5('pessoa:' || a.id)::uuid AS id, a.organizacao_id, a.empresa_id,
       coalesce(a.nome, max(g.nome)) AS nome, coalesce(a.sobrenome, max(g.sobrenome)) AS sobrenome,
       coalesce(a.email, max(g.email)) AS email, coalesce(a.telefone, max(g.telefone)) AS telefone,
       coalesce(a.whatsapp, max(g.whatsapp)) AS whatsapp, coalesce(a.cargo, max(g.cargo)) AS cargo,
       a.id AS lead_id_legado, min(g.created_at) AS created_at, max(g.updated_at) AS updated_at
  FROM leads a
  JOIN leads g ON coalesce(g.canonical_lead_id, g.id) = a.id
 WHERE a.canonical_lead_id IS NULL
   -- lead de teste do dev (origem 'qa', nunca existiu em prod) ja tem pessoa criada pelo app, com id
   -- proprio: gerar a deterministica bateria em idx_pessoas_lead_legado. Mesma regra do usuarios qa.%.
   AND a.origem IS DISTINCT FROM 'qa'
   -- aditivo: lead que ja tem pessoa propria no alvo (id nao deterministico, criada pelo app) nao ganha segunda
   AND NOT EXISTS (SELECT 1 FROM pessoas px WHERE px.lead_id_legado = a.id AND px.id <> md5('pessoa:' || a.id)::uuid)
 GROUP BY a.id, a.organizacao_id, a.empresa_id, a.nome, a.sobrenome, a.email,
          a.telefone, a.whatsapp, a.cargo;
SELECT 'pessoas' AS tabela, pg_temp.mz_carga('pessoas', '_pessoa') AS linhas;

CREATE TEMP TABLE _vinculo AS
SELECT md5('vinculo:' || p.lead_id_legado)::uuid AS id, p.organizacao_id, p.id AS pessoa_id, p.empresa_id,
       (row_number() OVER (PARTITION BY p.empresa_id ORDER BY p.created_at, p.lead_id_legado) = 1) AS principal,
       p.created_at AS iniciado_em, p.cargo, p.created_at, p.updated_at
  FROM _pessoa p WHERE p.empresa_id IS NOT NULL;
SELECT 'pessoa_empresa_vinculos' AS tabela, pg_temp.mz_carga('pessoa_empresa_vinculos', '_vinculo') AS linhas;

-- ───────────────────────── 6. tags ─────────────────────────
-- lead_labels (176): direto, uma linha por (lead, label) (prod tem 1 par repetido).
-- entity_labels espelha lead_labels e negocio_labels (a tela de Contatos le dela).
-- lead_listas e contato_listas (dado de teste) NAO sao carregadas.
CREATE TEMP TABLE _ll AS
SELECT DISTINCT ON (ll.lead_id, ll.label_id) ll.*
  FROM legado.lead_labels ll
  JOIN leads l ON l.id = ll.lead_id JOIN labels b ON b.id = ll.label_id
 ORDER BY ll.lead_id, ll.label_id, ll.created_at, ll.id;
SELECT 'lead_labels' AS tabela, pg_temp.mz_carga('lead_labels', '_ll') AS linhas;

CREATE TEMP TABLE _el AS
SELECT md5('el:lead:' || ll.lead_id || ':' || ll.label_id)::uuid AS id, l.organizacao_id, 'lead'::text AS entity_type,
       ll.lead_id AS entity_id, ll.label_id, ll.created_at
  FROM _ll ll JOIN leads l ON l.id = ll.lead_id;
SELECT 'entity_labels' AS tabela, pg_temp.mz_carga('entity_labels', '_el', 'NOT EXISTS (SELECT 1 FROM public.entity_labels x WHERE x.entity_type = s.entity_type AND x.entity_id = s.entity_id AND x.label_id = s.label_id AND x.id <> s.id)') AS linhas;

COMMIT;
