-- DIAGNÓSTICO de pessoas, contatos de canal e empresas duplicados. SÓ LEITURA.
--
-- Contexto: a mescla de 13/10/2026 (scripts/mesclar-duplicados-meta-rd.sh)
-- juntou LEADS (leads.canonical_lead_id) e deixou as PESSOAS e EMPRESAS que
-- nasceram de cada lado. A tela Contatos & Empresas lista `pessoas`
-- (app/src/lib/contatos/tela-contatos.ts), não `leads` nem a tabela `contatos`
-- (conversa de canal), e não filtra canonical_lead_id.
--
-- COMO RODAR (nunca com permissão de escrita; use uma réplica/homologação com
-- cópia do banco se puder, produção só se for inevitável):
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--        -v org=<uuid da organização> \
--        -f scripts/diagnostico-contatos-duplicados.sql
--
-- Garantias: a transação é READ ONLY (o Postgres recusa qualquer escrita) e
-- termina em ROLLBACK; não há CREATE, nem tabela temporária. Toda consulta
-- filtra por organizacao_id (:'org'). A única tabela sem organizacao_id é
-- whatsapp_mensagens, e ela só é lida a partir de ids de leads/contatos já
-- filtrados pela organização.
--
-- Cada seção é independente. Os "pares" são CANDIDATOS: quem decide é o Scott
-- olhando a coluna `sugestao` e `porque`; a regra está em
-- docs/operacao/contatos-duplicados.md. Os padrões de "pseudo" e "LID" são
-- heurísticas (o importador do Zoho não está neste repositório): confira a
-- seção 6b e 4 antes de agir sobre elas.

\set QUIET on
\pset null '·'
\pset pager off
BEGIN TRANSACTION READ ONLY;

-- ═══ 0. Tamanho do problema ═══════════════════════════════════════════════
\echo '== 0. Resumo =='
SELECT
  (SELECT count(*) FROM pessoas  WHERE organizacao_id = :'org'::uuid)                    AS pessoas,
  (SELECT count(*) FROM pessoas p JOIN leads l ON l.id = p.lead_id_legado
    WHERE p.organizacao_id = :'org'::uuid AND l.canonical_lead_id IS NOT NULL)           AS pessoas_de_lead_ja_mesclado,
  (SELECT count(*) FROM leads    WHERE organizacao_id = :'org'::uuid
      AND canonical_lead_id IS NOT NULL)                                                  AS leads_apontando_para_canonico,
  (SELECT count(*) FROM contatos WHERE organizacao_id = :'org'::uuid)                    AS contatos_de_canal,
  (SELECT count(*) FROM empresas WHERE organizacao_id = :'org'::uuid
      AND canonical_empresa_id IS NULL)                                                   AS empresas_sem_alias;

-- ═══ 1. Pares de PESSOAS candidatas a mescla, com o que cada lado tem ═════
-- motivo: mescla_de_leads = a pessoa do lead que a mescla de 13/10 aposentou
--         (lead.canonical_lead_id) contra a pessoa do lead canônico;
--         telefone = mesma chave de telefone (55+DDD+número, igual a
--         telefoneChaveSql de app/src/lib/vendas/identidade.ts);
--         email = mesmo e-mail em minúsculas e sem espaço.
-- Chaves compartilhadas por mais de 4 pessoas (central telefônica, e-mail
-- genérico) NÃO viram par: estão na seção 2.
-- "leads" de cada lado conta o lead da pessoa + os leads que apontam para ele.
-- sugestao/porque aplicam a regra de desempate do documento, em ordem:
--   1 canônica da mescla de leads; 2 cliente; 3 mais histórico; 4 mais antiga.
\echo '== 1. Pares de pessoas =='
WITH
pes AS (
  SELECT p.id, p.nome, p.sobrenome, p.email, p.telefone, p.whatsapp, p.empresa_id, p.lead_id_legado, p.created_at,
         CASE WHEN position('@' in coalesce(p.email,'')) > 0
               AND lower(trim(p.email)) !~ '(@|\.)zoho|\.(invalid|local)$|^[0-9]{6,}@'
              THEN lower(trim(p.email)) END AS em,
         l.canonical_lead_id, l.tipo AS lead_tipo, l.estagio_pre_vendas
    FROM pessoas p
    LEFT JOIN leads l ON l.id = p.lead_id_legado AND l.organizacao_id = p.organizacao_id
   WHERE p.organizacao_id = :'org'::uuid
),
chaves AS (
  SELECT DISTINCT id, k FROM (
    SELECT p.id,
           CASE WHEN d ~ '^55[1-9][0-9]{9,10}$' THEN d
                WHEN d ~ '^[1-9][0-9]{9,10}$'   THEN '55' || d END AS k
      FROM pes p, LATERAL (VALUES (regexp_replace(coalesce(p.telefone,''),  '\D','','g')),
                                  (regexp_replace(coalesce(p.whatsapp,''), '\D','','g'))) v(d)
  ) x
  WHERE k IS NOT NULL
    AND substr(k,3) !~ '^(\d)\1*$' AND substr(k,3) !~ '^\d0{9,}$'   -- 11111111111, 1000000000: preenchimento
),
k_grande AS (SELECT k  FROM chaves GROUP BY k  HAVING count(*) > 4),
e_grande AS (SELECT em FROM pes WHERE em IS NOT NULL GROUP BY em HAVING count(*) > 4),
pares_brutos AS (
  SELECT a.id AS a, b.id AS b, 'telefone'::text AS motivo, NULL::uuid AS canonica
    FROM chaves a JOIN chaves b ON b.k = a.k AND a.id < b.id
   WHERE a.k NOT IN (SELECT k FROM k_grande)
  UNION ALL
  SELECT a.id, b.id, 'email', NULL
    FROM pes a JOIN pes b ON b.em = a.em AND a.id < b.id
   WHERE a.em IS NOT NULL AND a.em NOT IN (SELECT em FROM e_grande)
  UNION ALL
  SELECT least(l.id, w.id), greatest(l.id, w.id), 'mescla_de_leads', w.id
    FROM pes l JOIN pes w ON w.lead_id_legado = l.canonical_lead_id
),
pares AS (
  SELECT a, b, array_agg(DISTINCT motivo ORDER BY motivo) AS motivos, max(canonica::text)::uuid AS canonica
    FROM pares_brutos GROUP BY a, b
),
ids AS (SELECT a AS id FROM pares UNION SELECT b FROM pares),
lset AS (            -- leads de cada pessoa: o dela + os que a mescla apontou para ele
  SELECT p.id AS pessoa_id, p.lead_id_legado AS lead_id
    FROM pes p JOIN ids USING (id) WHERE p.lead_id_legado IS NOT NULL
  UNION
  SELECT p.id, l.id
    FROM pes p JOIN ids USING (id)
    JOIN leads l ON l.canonical_lead_id = p.lead_id_legado AND l.organizacao_id = :'org'::uuid
),
cset AS (            -- conversas de canal ligadas a esses leads
  SELECT s.pessoa_id, c.id AS contato_id
    FROM lset s JOIN contatos c ON c.lead_id = s.lead_id AND c.organizacao_id = :'org'::uuid
),
m AS (
  SELECT i.id,
    (SELECT count(*) FROM lset s WHERE s.pessoa_id = i.id)                                                   AS leads,
    (SELECT count(*) FROM cset s WHERE s.pessoa_id = i.id)                                                   AS conversas,
    (SELECT count(*) FROM (
        SELECT x.id FROM whatsapp_mensagens x WHERE x.lead_id    IN (SELECT lead_id    FROM lset WHERE pessoa_id = i.id)
        UNION
        SELECT x.id FROM whatsapp_mensagens x WHERE x.contato_id IN (SELECT contato_id FROM cset WHERE pessoa_id = i.id)
     ) q)                                                                                                      AS mensagens,
    (SELECT count(*) FROM atividades  x WHERE x.organizacao_id = :'org'::uuid AND x.lead_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)) AS atividades,
    (SELECT count(*) FROM notas       x WHERE x.organizacao_id = :'org'::uuid AND x.lead_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)) AS notas,
    (SELECT count(*) FROM reunioes    x WHERE x.organizacao_id = :'org'::uuid AND x.lead_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)) AS reunioes,
    (SELECT count(*) FROM negocios    x WHERE x.organizacao_id = :'org'::uuid AND x.lead_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)) AS negocios,
    (SELECT count(*) FROM propostas   x WHERE x.organizacao_id = :'org'::uuid AND x.lead_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)) AS propostas,
    (SELECT count(*) FROM contratos   x WHERE x.organizacao_id = :'org'::uuid AND x.lead_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)) AS contratos,
    (SELECT count(*) FROM aquisicoes  x WHERE x.organizacao_id = :'org'::uuid
        AND (x.pessoa_id = i.id OR x.lead_legado_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)))   AS aquisicoes,
    (SELECT count(*) FROM aquisicoes  x WHERE x.organizacao_id = :'org'::uuid AND x.closed_at IS NULL
        AND (x.pessoa_id = i.id OR x.lead_legado_id IN (SELECT lead_id FROM lset WHERE pessoa_id = i.id)))   AS aquisicoes_abertas,
    (SELECT count(*) FROM oportunidades x WHERE x.organizacao_id = :'org'::uuid AND x.pessoa_id = i.id)      AS oportunidades,
    (SELECT count(*) FROM pontos_contato x WHERE x.organizacao_id = :'org'::uuid AND x.pessoa_id = i.id)     AS touchpoints,
    (SELECT count(*) FROM communications x WHERE x.organizacao_id = :'org'::uuid AND x.pessoa_id = i.id)     AS comunicacoes,
    (SELECT count(*) FROM clientes x WHERE x.organizacao_id = :'org'::uuid AND x.pessoa_principal_id = i.id) AS cliente_principal,
    (SELECT count(*) FROM pessoa_empresa_vinculos x WHERE x.organizacao_id = :'org'::uuid AND x.pessoa_id = i.id AND x.encerrado_em IS NULL) AS vinculos_empresa
  FROM ids i
),
lado AS (
  SELECT m.*, p.created_at,
         (m.mensagens + m.atividades + m.notas + m.reunioes + m.negocios + m.propostas + m.contratos
          + m.oportunidades + m.comunicacoes) AS historico,
         (m.cliente_principal > 0 OR p.lead_tipo = 'cliente') AS cliente
    FROM pes p JOIN m USING (id)
)
SELECT pr.motivos,
       pa.nome AS nome_a, pa.email AS email_a, coalesce(pa.telefone, pa.whatsapp) AS tel_a,
       pb.nome AS nome_b, pb.email AS email_b, coalesce(pb.telefone, pb.whatsapp) AS tel_b,
       la.leads AS leads_a,         lb.leads AS leads_b,
       la.conversas AS conv_a,      lb.conversas AS conv_b,
       la.mensagens AS msgs_a,      lb.mensagens AS msgs_b,
       la.atividades AS ativ_a,     lb.atividades AS ativ_b,
       la.negocios AS neg_a,        lb.negocios AS neg_b,
       la.oportunidades AS opp_a,   lb.oportunidades AS opp_b,
       la.aquisicoes_abertas AS aq_abertas_a, lb.aquisicoes_abertas AS aq_abertas_b,
       la.historico AS historico_a, lb.historico AS historico_b,
       (pa.empresa_id IS DISTINCT FROM pb.empresa_id) AS empresas_diferentes,
       CASE WHEN pr.canonica = pa.id THEN 'A'
            WHEN pr.canonica = pb.id THEN 'B'
            WHEN la.cliente <> lb.cliente THEN CASE WHEN la.cliente THEN 'A' ELSE 'B' END
            WHEN la.historico <> lb.historico THEN CASE WHEN la.historico > lb.historico THEN 'A' ELSE 'B' END
            WHEN (la.created_at, pa.id) <= (lb.created_at, pb.id) THEN 'A' ELSE 'B' END AS sugestao,
       CASE WHEN pr.canonica IN (pa.id, pb.id) THEN 'é a pessoa do lead canônico da mescla de 13/10'
            WHEN la.cliente <> lb.cliente THEN 'é cliente'
            WHEN la.historico <> lb.historico THEN 'tem mais histórico'
            ELSE 'é a mais antiga' END AS porque,
       pa.id AS id_a, pb.id AS id_b
  FROM pares pr
  JOIN pes pa ON pa.id = pr.a  JOIN lado la ON la.id = pr.a
  JOIN pes pb ON pb.id = pr.b  JOIN lado lb ON lb.id = pr.b
 ORDER BY (pr.motivos @> ARRAY['mescla_de_leads']) DESC, la.historico + lb.historico DESC, pa.nome;

-- Pessoa cujo lead foi aposentado pela mescla e cujo lead canônico NÃO tem
-- pessoa: não há par para somar, só uma linha a esconder da lista.
\echo '== 1b. Pessoa de lead mesclado sem pessoa do canônico =='
SELECT p.id AS pessoa_id, p.nome, p.email, p.telefone, l.id AS lead_aposentado, l.canonical_lead_id
  FROM pessoas p
  JOIN leads l ON l.id = p.lead_id_legado AND l.organizacao_id = p.organizacao_id
 WHERE p.organizacao_id = :'org'::uuid AND l.canonical_lead_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM pessoas w WHERE w.organizacao_id = p.organizacao_id AND w.lead_id_legado = l.canonical_lead_id)
 ORDER BY p.nome;

-- ═══ 2. Chaves compartilhadas por muitas pessoas (NÃO são pares) ═══════════
\echo '== 2. Telefones e e-mails compartilhados por 5+ pessoas =='
WITH ch AS (
  SELECT p.id, p.nome,
         CASE WHEN d ~ '^55[1-9][0-9]{9,10}$' THEN d WHEN d ~ '^[1-9][0-9]{9,10}$' THEN '55' || d END AS k
    FROM pessoas p, LATERAL (VALUES (regexp_replace(coalesce(p.telefone,''),'\D','','g')),
                                    (regexp_replace(coalesce(p.whatsapp,''),'\D','','g'))) v(d)
   WHERE p.organizacao_id = :'org'::uuid
)
SELECT 'telefone' AS tipo, k AS chave, count(DISTINCT id) AS pessoas, (array_agg(DISTINCT nome))[1:4] AS exemplos
  FROM ch WHERE k IS NOT NULL GROUP BY k HAVING count(DISTINCT id) > 4
UNION ALL
SELECT 'email', lower(trim(email)), count(*), (array_agg(DISTINCT nome))[1:4]
  FROM pessoas WHERE organizacao_id = :'org'::uuid AND position('@' in coalesce(email,'')) > 0
 GROUP BY lower(trim(email)) HAVING count(*) > 4
 ORDER BY 3 DESC;

-- ═══ 3. Pessoas com telefone que não é número brasileiro utilizável ════════
-- Inclui LID colado no campo de telefone/whatsapp da pessoa.
\echo '== 3. Pessoas com telefone suspeito (LID ou lixo) =='
SELECT p.id AS pessoa_id, p.nome, p.telefone, p.whatsapp, p.email, p.lead_id_legado
  FROM pessoas p, LATERAL (VALUES (regexp_replace(coalesce(p.telefone,''),'\D','','g')),
                                  (regexp_replace(coalesce(p.whatsapp,''),'\D','','g'))) v(d)
 WHERE p.organizacao_id = :'org'::uuid
   AND d <> '' AND d !~ '^55[1-9][0-9]{9,10}$' AND d !~ '^[1-9][0-9]{9,10}$'
   AND length(d) >= 13                           -- 13+ dígitos sem ser 55+DDD+número: LID ou lixo
 GROUP BY p.id, p.nome, p.telefone, p.whatsapp, p.email, p.lead_id_legado
 ORDER BY p.nome;

-- ═══ 4. Conversas de canal (tabela contatos) com LID ═══════════════════════
-- LID do WhatsApp: identificador interno de 14-15 dígitos, sem o 55 do Brasil,
-- que o worker grava no lugar do telefone quando o evento não traz o número
-- (app/src/worker/index.ts:634-636). `par_real_na_sessao` procura, NA MESMA
-- sessão, uma conversa com o mesmo nome (não numérico) e telefone brasileiro
-- válido: é o candidato a "mesma pessoa, número verdadeiro".
\echo '== 4. Conversas de canal com LID =='
WITH c AS (
  SELECT c.*, regexp_replace(coalesce(c.telefone,''),'\D','','g') AS d
    FROM contatos c
   WHERE c.organizacao_id = :'org'::uuid AND c.canal = 'whatsapp'
),
lid AS (
  SELECT * FROM c WHERE d ~ '^[0-9]{14,}$' AND d !~ '^55[1-9][0-9]{9,10}$'
)
SELECT l.id AS contato_id, l.nome, l.telefone AS lid, l.sessao_id, l.lead_id, l.responsavel_id,
       l.ultima_msg_at, l.created_at,
       (SELECT count(*) FROM whatsapp_mensagens m WHERE m.contato_id = l.id) AS mensagens,
       (SELECT count(*) FROM contato_labels cl WHERE cl.contato_id = l.id)    AS etiquetas,
       (SELECT count(*) FROM ai_cases a WHERE a.organizacao_id = :'org'::uuid AND a.contato_id = l.id) AS casos_ia,
       (SELECT r.id FROM c r
         WHERE r.sessao_id = l.sessao_id AND r.id <> l.id
           AND r.d ~ '^55[1-9][0-9]{9,10}$'
           AND l.nome !~ '^[0-9+\s()-]+$' AND lower(trim(r.nome)) = lower(trim(l.nome))
         LIMIT 1) AS par_real_na_sessao
  FROM lid l
 ORDER BY mensagens DESC, l.ultima_msg_at DESC NULLS LAST;

-- ═══ 5. Conversas de canal duplicadas ══════════════════════════════════════
-- Mesma sessão + mesmo número em formatos diferentes (o índice único só pega
-- texto idêntico), e vários contatos para o mesmo lead. A MESMA pessoa em
-- sessões diferentes é legítima (cada número da empresa tem a sua conversa) e
-- só aparece em 5b, como informação.
\echo '== 5a. Mesma sessão, mesmo número, formato diferente =='
WITH c AS (
  SELECT c.id, c.nome, c.telefone, c.sessao_id, c.lead_id, c.responsavel_id, c.created_at,
         CASE WHEN d ~ '^55[1-9][0-9]{9,10}$' THEN d WHEN d ~ '^[1-9][0-9]{9,10}$' THEN '55' || d END AS k
    FROM contatos c, LATERAL (SELECT regexp_replace(coalesce(c.telefone,''),'\D','','g') AS d) x
   WHERE c.organizacao_id = :'org'::uuid AND c.canal = 'whatsapp' AND c.sessao_id IS NOT NULL
)
SELECT a.sessao_id, a.k AS chave, a.id AS contato_a, a.telefone AS tel_a, a.nome AS nome_a,
       b.id AS contato_b, b.telefone AS tel_b, b.nome AS nome_b,
       (SELECT count(*) FROM whatsapp_mensagens m WHERE m.contato_id = a.id) AS msgs_a,
       (SELECT count(*) FROM whatsapp_mensagens m WHERE m.contato_id = b.id) AS msgs_b
  FROM c a JOIN c b ON b.sessao_id = a.sessao_id AND b.k = a.k AND a.id < b.id
 WHERE a.k IS NOT NULL
 ORDER BY a.sessao_id, a.k;

\echo '== 5b. Vários contatos de canal para o mesmo lead =='
SELECT c.lead_id, l.nome AS lead, count(*) AS conversas, array_agg(c.id ORDER BY c.created_at) AS contatos
  FROM contatos c LEFT JOIN leads l ON l.id = c.lead_id
 WHERE c.organizacao_id = :'org'::uuid AND c.lead_id IS NOT NULL
 GROUP BY c.lead_id, l.nome HAVING count(*) > 1
 ORDER BY count(*) DESC;

-- ═══ 6. Pseudo-e-mails gerados pela importação do Zoho ═════════════════════
-- HEURÍSTICA: o importador não está no repositório. Padrões tratados como
-- pseudo: domínio contendo "zoho", terminação .invalid/.local, parte local só
-- numérica com 6+ dígitos. Confirme o padrão real em 6b e ajuste a regex.
\echo '== 6a. Pessoas e leads com e-mail pseudo (heurística) =='
SELECT 'pessoa' AS onde, p.id, p.nome, p.email, p.lead_id_legado AS lead_id
  FROM pessoas p
 WHERE p.organizacao_id = :'org'::uuid
   AND lower(trim(p.email)) ~ '(@|\.)zoho|\.(invalid|local)$|^[0-9]{6,}@'
UNION ALL
SELECT 'lead', l.id, l.nome, l.email, l.id
  FROM leads l
 WHERE l.organizacao_id = :'org'::uuid AND l.canonical_lead_id IS NULL
   AND lower(trim(l.email)) ~ '(@|\.)zoho|\.(invalid|local)$|^[0-9]{6,}@'
 ORDER BY 1, 3;

-- 6b. Para descobrir o padrão: os domínios mais comuns entre os leads que vieram
-- do Zoho (zoho_id preenchido). Domínio raro e repetido em muitos registros,
-- ou e-mail igual ao zoho_id, é o pseudo-e-mail.
\echo '== 6b. Domínios dos leads vindos do Zoho =='
SELECT split_part(lower(trim(email)), '@', 2) AS dominio, count(*) AS leads,
       count(*) FILTER (WHERE lower(trim(email)) LIKE '%' || zoho_id || '%') AS email_contem_zoho_id,
       (array_agg(email))[1:3] AS exemplos
  FROM leads
 WHERE organizacao_id = :'org'::uuid AND zoho_id IS NOT NULL AND position('@' in coalesce(email,'')) > 0
 GROUP BY 1 ORDER BY 2 DESC LIMIT 40;

-- ═══ 7. Empresas duplicadas ════════════════════════════════════════════════
-- Só entram empresas SEM alias (canonical_empresa_id nulo). Chave: CNPJ só
-- dígitos (já mesclados em 05/10, deve vir vazio), domínio (empresas.dominio),
-- e nome normalizado quando não há documento. "pendurado" soma tudo que aponta
-- para a empresa; o lado com mais é o candidato a vencedor.
\echo '== 7. Pares de empresas =='
WITH e AS (
  SELECT e.id, e.nome, e.cnpj, e.dominio, e.created_at,
         nullif(regexp_replace(coalesce(e.cnpj,''),'\D','','g'),'') AS doc,
         nullif(lower(trim(e.dominio)),'') AS dom,
         nullif(regexp_replace(translate(lower(e.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '', 'g'),'') AS nm
    FROM empresas e
   WHERE e.organizacao_id = :'org'::uuid AND e.canonical_empresa_id IS NULL
),
pares AS (
  SELECT a.id AS a, b.id AS b, 'cnpj' AS motivo FROM e a JOIN e b ON b.doc = a.doc AND a.id < b.id WHERE a.doc IS NOT NULL
  UNION ALL
  SELECT a.id, b.id, 'dominio' FROM e a JOIN e b ON b.dom = a.dom AND a.id < b.id WHERE a.dom IS NOT NULL
  UNION ALL
  SELECT a.id, b.id, 'nome_sem_cnpj' FROM e a JOIN e b ON b.nm = a.nm AND a.id < b.id
   WHERE a.nm IS NOT NULL AND length(a.nm) > 4 AND a.doc IS NULL AND b.doc IS NULL
),
ps AS (
  SELECT a, b, array_agg(DISTINCT motivo ORDER BY motivo) AS motivos FROM pares GROUP BY a, b
),
ids AS (SELECT a AS id FROM ps UNION SELECT b FROM ps),
m AS (
  SELECT i.id,
    (SELECT count(*) FROM pessoas x            WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS pessoas,
    (SELECT count(*) FROM leads x              WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id AND x.canonical_lead_id IS NULL) AS leads,
    (SELECT count(*) FROM negocios x           WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS negocios,
    (SELECT count(*) FROM oportunidades x      WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS oportunidades,
    (SELECT count(*) FROM propostas x          WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS propostas,
    (SELECT count(*) FROM contratos x          WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS contratos,
    (SELECT count(*) FROM assinaturas x        WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS assinaturas,
    (SELECT count(*) FROM faturas x            WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS faturas,
    (SELECT count(*) FROM servicos_canonicos x WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS servicos,
    (SELECT count(*) FROM clientes x           WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS clientes,
    (SELECT count(*) FROM atividades x         WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS atividades,
    (SELECT count(*) FROM tarefas x            WHERE x.organizacao_id = :'org'::uuid AND x.empresa_id = i.id) AS tarefas
  FROM ids i
)
SELECT ps.motivos, ea.nome AS nome_a, ea.cnpj AS cnpj_a, ea.dominio AS dominio_a,
       eb.nome AS nome_b, eb.cnpj AS cnpj_b, eb.dominio AS dominio_b,
       ma.pessoas AS pessoas_a, mb.pessoas AS pessoas_b, ma.leads AS leads_a, mb.leads AS leads_b,
       ma.negocios + ma.oportunidades AS neg_a, mb.negocios + mb.oportunidades AS neg_b,
       ma.assinaturas + ma.servicos + ma.faturas AS financeiro_a, mb.assinaturas + mb.servicos + mb.faturas AS financeiro_b,
       (ma.pessoas+ma.leads+ma.negocios+ma.oportunidades+ma.propostas+ma.contratos+ma.assinaturas+ma.faturas+ma.servicos+ma.clientes+ma.atividades+ma.tarefas) AS pendurado_a,
       (mb.pessoas+mb.leads+mb.negocios+mb.oportunidades+mb.propostas+mb.contratos+mb.assinaturas+mb.faturas+mb.servicos+mb.clientes+mb.atividades+mb.tarefas) AS pendurado_b,
       ea.id AS id_a, eb.id AS id_b
  FROM ps
  JOIN empresas ea ON ea.id = ps.a  JOIN m ma ON ma.id = ps.a
  JOIN empresas eb ON eb.id = ps.b  JOIN m mb ON mb.id = ps.b
 ORDER BY (ma.assinaturas + ma.servicos + mb.assinaturas + mb.servicos) DESC, ea.nome;

ROLLBACK;
