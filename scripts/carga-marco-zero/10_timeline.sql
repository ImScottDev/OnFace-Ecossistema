-- PASSO 10 · timeline_events e communications (mapa secoes 2.8 e 2.9, ordem 10).
-- Derivados do que o passo 9 (e o 5) ja gravou em public; nao le o schema legado.
--
-- timeline_events  atividades, notas, status_changes, ligacoes, anexos_legado.
--                  domain_event_id sempre NULL (o domain_events nao e carregado: a
--                  ponte pode reprocessar). [Scott] Nenhum evento de tarefa do Filipe.
-- communications   whatsapp_mensagens, emails, ligacoes. conversa_id fica NULL: a
--                  tabela `conversas` nao se carrega (artefato da carga antiga).
--
-- Idempotente de verdade: o id do evento e DETERMINISTICO (md5 de origem + id da
-- linha de origem), entao ON CONFLICT (id) DO NOTHING nunca duplica nem toca nada.
-- occurred_at/created_at vem da origem, nunca now().
-- Evento sem ancora (pessoa, aquisicao, oportunidade ou empresa) nao entra: nao
-- apareceria em tela alguma e so inflaria a contagem. O NOTICE do fim diz quantos.

\set ON_ERROR_STOP on
BEGIN;

-- [Scott] Sem eventos de tarefa do Filipe. As tarefas dele ja nao entram no passo 9;
-- este DELETE por lista fechada cobre um banco que as tenha recebido antes.
DELETE FROM timeline_events
 WHERE metadata->'backfill'->>'origem' = 'tarefas'
   AND metadata->'backfill'->>'id' IN
       (SELECT id::text FROM legado.tarefas WHERE usuario_id = 'fcb69714-2213-4cb4-90e0-4c1d2a93c4bc');

-- Ancoras por lead e por negocio, uma vez so (os JOINs lead->pessoa/aquisicao sao 1:1).
CREATE TEMP TABLE _mz_anc_lead AS
SELECT l.id AS lead_id, l.organizacao_id, p.id AS pessoa_id, a.id AS aquisicao_id,
       coalesce(p.empresa_id, l.empresa_id) AS empresa_id
  FROM leads l
  LEFT JOIN pessoas p ON p.lead_id_legado = l.id
  LEFT JOIN aquisicoes a ON a.lead_legado_id = l.id;
CREATE UNIQUE INDEX ON _mz_anc_lead (lead_id);

CREATE TEMP TABLE _mz_anc_neg AS
SELECT negocio_id_legado AS negocio_id, id AS oportunidade_id, empresa_id, organizacao_id
  FROM oportunidades WHERE negocio_id_legado IS NOT NULL;
CREATE UNIQUE INDEX ON _mz_anc_neg (negocio_id);

-- Funcao unica: monta o evento a partir de (origem, id, lead, negocio, empresa direta...)
-- e insere. Cada origem chama uma vez, passando a consulta que devolve as colunas fixas.
CREATE FUNCTION pg_temp.mz_tl(origem text, consulta text) RETURNS bigint
LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE format($q$
    INSERT INTO timeline_events (id, organizacao_id, empresa_id, pessoa_id, aquisicao_id, oportunidade_id,
                                 tipo, titulo, descricao, icone, actor_type, actor_id, occurred_at, created_at, metadata)
    SELECT md5('mz-tl:' || %1$L || ':' || x.id::text)::uuid,
           coalesce(x.organizacao_id, al.organizacao_id, an.organizacao_id, (SELECT id FROM organizacoes)),
           coalesce(x.empresa_id, an.empresa_id, al.empresa_id), al.pessoa_id, al.aquisicao_id, an.oportunidade_id,
           x.tipo, x.titulo, x.descricao, x.icone,
           CASE WHEN x.actor_id IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END, x.actor_id,
           x.ocorrido_em, x.ocorrido_em,
           jsonb_build_object('backfill', jsonb_build_object('fase', 'marco-zero', 'origem', %1$L, 'id', x.id)) || x.extra
      FROM (%2$s) x
      LEFT JOIN _mz_anc_lead al ON al.lead_id = x.lead_id
      LEFT JOIN _mz_anc_neg an ON an.negocio_id = x.negocio_id
     WHERE coalesce(x.empresa_id, an.empresa_id, al.empresa_id, al.pessoa_id, al.aquisicao_id, an.oportunidade_id) IS NOT NULL
    ON CONFLICT (id) DO NOTHING$q$, origem, consulta);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- Colunas devolvidas pela consulta de cada origem:
--   id, organizacao_id, lead_id, negocio_id, empresa_id, tipo, titulo, descricao, icone, actor_id, ocorrido_em, extra

-- ─── atividades: o tipo da atividade vira o tipo do evento (nada e descartado) ───
-- Atividade do tipo tarefa/reuniao tambem entra: a entidade vive em tarefas/reunioes,
-- a timeline e o registro do fato (e nao ha atividade de tarefa do Filipe: checado).
SELECT 'atividades' AS origem, pg_temp.mz_tl('atividades', $$
  SELECT a.id, a.organizacao_id, a.lead_id, a.negocio_id, NULL::uuid AS empresa_id,
         coalesce(a.tipo, 'atividade') AS tipo, coalesce(nullif(a.titulo, ''), coalesce(a.tipo, 'atividade')) AS titulo,
         a.descricao, NULL::text AS icone, a.usuario_id AS actor_id, a.created_at AS ocorrido_em,
         jsonb_build_object('usuario_nome', a.usuario_display_name) AS extra
    FROM atividades a WHERE coalesce(a.timeline_visible, true)
$$) AS eventos;

SELECT 'notas' AS origem, pg_temp.mz_tl('notas', $$
  SELECT n.id, n.organizacao_id, n.lead_id, n.negocio_id, n.empresa_id,
         'nota' AS tipo, 'Nota' AS titulo, left(coalesce(n.conteudo, ''), 4000) AS descricao, 'file-text' AS icone,
         n.autor_id AS actor_id, n.created_at AS ocorrido_em,
         jsonb_build_object('autor_nome', n.autor_display_name) AS extra
    FROM notas n
$$) AS eventos;

-- status_changes: a memoria do funil ("por onde esse negocio passou").
SELECT 'status_changes' AS origem, pg_temp.mz_tl('status_changes', $$
  SELECT s.id, NULL::uuid AS organizacao_id, s.lead_id, s.negocio_id, NULL::uuid AS empresa_id,
         'mudanca_etapa' AS tipo,
         'Etapa: ' || coalesce(s.de_status, '(inicio)') || ' -> ' || coalesce(s.para_status, '(?)') AS titulo,
         s.motivo AS descricao, 'git-branch' AS icone, s.usuario_id AS actor_id, s.created_at AS ocorrido_em,
         jsonb_build_object('de', s.de_status, 'para', s.para_status) AS extra
    FROM status_changes s
$$) AS eventos;

SELECT 'ligacoes' AS origem, pg_temp.mz_tl('ligacoes', $$
  SELECT g.id, g.organizacao_id, g.lead_id, g.negocio_id, NULL::uuid AS empresa_id,
         'ligacao' AS tipo, 'Ligacao' AS titulo, g.resumo AS descricao, 'phone' AS icone,
         g.usuario_id AS actor_id, coalesce(g.call_date, g.created_at) AS ocorrido_em,
         jsonb_build_object('duracao_segundos', g.duracao_segundos, 'status', g.call_status) AS extra
    FROM ligacoes g
$$) AS eventos;

-- anexos_legado e polimorfico: contrato -> empresa do contrato; negocio -> negocio;
-- lead -> lead; empresa -> a propria. Sem entidade_id resolvido nao ha ancora.
SELECT 'anexos_legado' AS origem, pg_temp.mz_tl('anexos_legado', $$
  SELECT x.id, x.organizacao_id,
         CASE WHEN x.entidade_tipo IN ('lead', 'Lead', 'contato') THEN x.entidade_id END AS lead_id,
         CASE WHEN x.entidade_tipo = 'negocio' THEN x.entidade_id ELSE c.negocio_id END AS negocio_id,
         CASE WHEN x.entidade_tipo IN ('empresa', 'Empresa', 'Account') THEN x.entidade_id ELSE c.empresa_id END AS empresa_id,
         'anexo' AS tipo, coalesce(nullif(x.nome_arquivo, ''), 'Documento') AS titulo, x.categoria AS descricao,
         'paperclip' AS icone, NULL::uuid AS actor_id, coalesce(x.criado_em_original, x.created_at) AS ocorrido_em,
         jsonb_build_object('storage_path', x.storage_path, 'categoria', x.categoria, 'entidade_tipo', x.entidade_tipo) AS extra
    FROM anexos_legado x
    LEFT JOIN contratos c ON x.entidade_tipo = 'contrato' AND c.id = x.entidade_id
$$) AS eventos;

-- ─── communications ────────────────────────────────────────────────────────
-- pessoa pela cadeia lead (direto ou via contato); empresa herdada da pessoa/lead.
-- ON CONFLICT DO NOTHING cobre os dois unicos: (canal, external_id) e (origem_tabela, origem_legado_id).
-- A tabela emails tem message_id repetido (mesma mensagem gravada mais de uma vez):
-- fica a primeira ocorrencia. Sem message_id, cada linha e uma mensagem.
WITH i AS (
  INSERT INTO communications (organizacao_id, pessoa_id, empresa_id, canal, tipo, direcao, conteudo, external_id,
                              provider, status, ocorrido_em, usuario_id, created_at, origem_legado_id, origem_tabela, metadata)
  SELECT (SELECT id FROM organizacoes), al.pessoa_id, al.empresa_id, 'whatsapp', coalesce(w.tipo, 'texto'),
         coalesce(w.direcao, 'desconhecida'), w.conteudo, w.uazapi_message_id, 'wuzapi', w.status, w.created_at,
         w.enviado_por_id, w.created_at, w.id, 'whatsapp_mensagens',
         jsonb_build_object('media_url', w.media_url, 'media_type', w.media_type, 'contato_id', w.contato_id)
    FROM whatsapp_mensagens w
    LEFT JOIN contatos ct ON ct.id = w.contato_id
    LEFT JOIN _mz_anc_lead al ON al.lead_id = coalesce(w.lead_id, ct.lead_id)
  ON CONFLICT DO NOTHING RETURNING canal)
SELECT canal, count(*) AS comunicacoes FROM i GROUP BY canal;

WITH i AS (
  INSERT INTO communications (organizacao_id, pessoa_id, empresa_id, oportunidade_id, canal, tipo, direcao, duracao_segundos,
                              external_id, provider, status, ocorrido_em, usuario_id, created_at, summary, transcript,
                              origem_legado_id, origem_tabela, metadata)
  SELECT coalesce(g.organizacao_id, (SELECT id FROM organizacoes)), al.pessoa_id, al.empresa_id, an.oportunidade_id,
         'ligacao', 'chamada', 'desconhecida', g.duracao_segundos, g.callface_call_id, 'callface', g.call_status,
         coalesce(g.call_date, g.created_at), g.usuario_id, coalesce(g.call_date, g.created_at), g.resumo, g.transcricao::text,
         g.id, 'ligacoes', jsonb_build_object('destino', g.destination_number)
    FROM ligacoes g
    LEFT JOIN _mz_anc_lead al ON al.lead_id = g.lead_id
    LEFT JOIN _mz_anc_neg an ON an.negocio_id = g.negocio_id
  ON CONFLICT DO NOTHING RETURNING canal)
SELECT canal, count(*) AS comunicacoes FROM i GROUP BY canal;

WITH i AS (
  INSERT INTO communications (organizacao_id, pessoa_id, empresa_id, canal, tipo, direcao, subject, conteudo, external_id,
                              provider, status, ocorrido_em, usuario_id, created_at, origem_legado_id, origem_tabela, metadata)
  SELECT coalesce(e.organizacao_id, (SELECT id FROM organizacoes)), al.pessoa_id, al.empresa_id, 'email', 'mensagem',
         coalesce(e.direcao, 'desconhecida'), e.assunto, coalesce(e.corpo_texto, e.corpo), e.message_id, 'email', e.status,
         e.created_at, e.enviado_por_id, e.created_at, e.id, 'emails',
         jsonb_build_object('de', e.de, 'para', e.para, 'thread_id', e.thread_id)
    FROM (SELECT DISTINCT ON (coalesce(message_id, id::text)) * FROM emails
           ORDER BY coalesce(message_id, id::text), created_at, id) e
    LEFT JOIN _mz_anc_lead al ON al.lead_id = e.lead_id
  ON CONFLICT DO NOTHING RETURNING canal)
SELECT canal, count(*) AS comunicacoes FROM i GROUP BY canal;

-- Orfas (96% do WhatsApp nao tem lead_id): casa pelo meio de contato, so quando ele
-- aponta para UMA pessoa (telefone pelos 8 ultimos digitos; e-mail normalizado).
-- Telefone ambiguo fica sem dono de proposito: pendurar a conversa na pessoa errada
-- e pior do que deixa-la sem dono. Idempotente: so toca pessoa_id IS NULL.
WITH pes AS MATERIALIZED (
  SELECT right(regexp_replace(telefone, '\D', '', 'g'), 8) AS k, (array_agg(id))[1] AS pessoa_id
    FROM pessoas WHERE length(regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) >= 8
   GROUP BY 1 HAVING count(*) = 1)
UPDATE communications c SET pessoa_id = pes.pessoa_id
  FROM whatsapp_mensagens w, pes
 WHERE c.canal = 'whatsapp' AND c.pessoa_id IS NULL AND c.origem_tabela = 'whatsapp_mensagens'
   AND w.id = c.origem_legado_id AND pes.k = right(regexp_replace(coalesce(w.telefone, ''), '\D', '', 'g'), 8);

WITH pes AS MATERIALIZED (
  SELECT lower(trim(email)) AS k, (array_agg(id))[1] AS pessoa_id
    FROM pessoas WHERE coalesce(email, '') <> '' GROUP BY 1 HAVING count(*) = 1)
-- De e para podem apontar para duas pessoas (ex.: closer e lead, ambos cadastrados): vale a ponta de FORA
-- (de em 'in', para em 'out'); sem ela, a outra ponta; empate fecha por id. Sem isso o UPDATE ... FROM
-- escolhia uma linha qualquer e a carga nao reproduzia (12 e-mails mudavam de pessoa entre rodadas).
UPDATE communications c SET pessoa_id = m.pessoa_id
  FROM emails e
  CROSS JOIN LATERAL (
    SELECT pes.pessoa_id FROM pes
     WHERE pes.k = ANY (ARRAY[lower(trim(coalesce(e.de, ''))), lower(trim(coalesce(e.para, '')))])
     ORDER BY (pes.k = lower(trim(coalesce(CASE WHEN e.direcao = 'out' THEN e.para ELSE e.de END, '')))) DESC, pes.pessoa_id
     LIMIT 1) m
 WHERE c.canal = 'email' AND c.pessoa_id IS NULL AND c.origem_tabela = 'emails'
   AND e.id = c.origem_legado_id;

-- A empresa herda da pessoa: sem isso a conversa some da tela da empresa (por onde o CS trabalha).
UPDATE communications c SET empresa_id = p.empresa_id
  FROM pessoas p
 WHERE c.empresa_id IS NULL AND c.pessoa_id = p.id AND p.empresa_id IS NOT NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT canal, count(*) total, count(*) FILTER (WHERE pessoa_id IS NULL) sem_pessoa
             FROM communications GROUP BY canal ORDER BY 1
  LOOP RAISE NOTICE 'communications %: % (sem pessoa: %)', r.canal, r.total, r.sem_pessoa; END LOOP;
END $$;

COMMIT;
