-- PASSO 9 · Operacao e atendimento (mapa secoes 2.8 e 2.9).
-- Reunioes, tarefas, atividades, notas, ligacoes, e-mail, WhatsApp, notificacoes,
-- meta_lead_staging, audit_log, ai_sdr_*, outreach_campanhas.
--
-- Fonte: schema `legado` (postgres_fdw para o dump fresco de prod, criado pelo
-- 00_preparar). Destino: public. Depende dos passos 1 a 8 (usuarios, leads,
-- negocios, labels, empresas ja no destino, porque as FKs apontam para la).
--
-- Idempotente: INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE (linha) IS DISTINCT
-- FROM (nova). A copia leva updated_at/created_at do legado; nenhum UPDATE grava
-- now(). ATENCAO: este passo e de MARCO ZERO. Reexecutar depois que o time
-- comecou a editar desfaz o que foi editado (reuniao marcada realizada, tarefa
-- concluida, nao lido). So rode de novo em banco que ainda nao foi aberto.
--
-- Fora deste passo, de proposito: `campanhas` (passo 2), vendas_eventos,
-- domain_events e conversas (nao se carregam: artefatos da carga antiga).

\set ON_ERROR_STOP on
BEGIN;

-- Helper: copia legado.<tabela> para public.<tabela> usando as colunas que existem
-- nos DOIS lados (coluna que so existe no destino toma o default da tabela).
--   filtro      predicado SQL sobre o alias s (linhas que entram)
--   sobrescreve {coluna: 'expressao sql sobre s'} troca ou cria o valor da coluna
-- Devolve quantas linhas foram inseridas ou realmente mudadas.
CREATE FUNCTION pg_temp.mz_carga(tabela text, filtro text DEFAULT 'true', sobrescreve jsonb DEFAULT '{}', so_novos boolean DEFAULT false) RETURNS bigint
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
  IF so_novos THEN  -- aditivo: tokens/sessoes ja existentes no alvo nao sao sobrescritos
    EXECUTE format('INSERT INTO public.%1$I AS t (%2$s) SELECT %3$s FROM legado.%1$I s WHERE %4$s ON CONFLICT (id) DO NOTHING',
                   tabela, lista, sel, filtro);
  ELSE
  EXECUTE format(
    'INSERT INTO public.%1$I AS t (%2$s) SELECT %3$s FROM legado.%1$I s WHERE %4$s
       ON CONFLICT (id) DO UPDATE SET %5$s WHERE (%6$s) IS DISTINCT FROM (%7$s)',
    tabela, lista, sel, filtro, atualiza, velho, novo);
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- ─── Tarefas ───────────────────────────────────────────────────────────────
-- [Scott] As 190 tarefas do Filipe (fcb69714..., 174 follow_up e 16 renovacao) NAO
-- entram (lixo). O DELETE por lista fechada de ids cobre um banco que ja as tenha
-- recebido numa execucao anterior. Ficam 280. As cs_risco nao existem em prod: o
-- sweep do passo 12 as regera com a Jenifer (P10).
-- (aditivo: nao apaga tarefas do alvo; a regra do Filipe fica so no filtro de entrada abaixo)

SELECT 'tarefas' AS tabela, pg_temp.mz_carga('tarefas',
  $$ s.usuario_id IS DISTINCT FROM 'fcb69714-2213-4cb4-90e0-4c1d2a93c4bc' $$,
  jsonb_build_object(
    -- 275 das 470 vem sem organizacao_id; o lead sabe, e na falta dele a unica organizacao.
    'organizacao_id', 'coalesce(s.organizacao_id, (SELECT l.organizacao_id FROM public.leads l WHERE l.id = s.lead_id), (SELECT id FROM public.organizacoes))',
    'empresa_id',     '(SELECT l.empresa_id FROM public.leads l WHERE l.id = s.lead_id)',
    'status',         $$CASE WHEN s.concluida THEN 'concluida' ELSE 'a_fazer' END$$,
    'origem',         $$CASE WHEN s.tipo = 'onboarding_agendar_reuniao' THEN 'ONBOARDING' ELSE 'MANUAL' END$$)) AS linhas;

-- ─── Reunioes ──────────────────────────────────────────────────────────────
-- Prod so conhece agendada e cancelada. Cancelada vai direto; agendada futura fica
-- agendada; agendada JA PASSADA (P9): negocio em no_show = no_show; negocio que
-- avancou depois da data (mudanca de status posterior para realizada, trial,
-- proposta, negociacao ou ganho, ou ja esta num desses) = realizada; senao fica
-- agendada (indeterminada, o time resolve).
SELECT 'reunioes' AS tabela, pg_temp.mz_carga('reunioes', 'true', jsonb_build_object(
  'status', $$CASE
    WHEN s.status <> 'agendada' THEN s.status
    WHEN s.data >= now() THEN 'agendada'
    WHEN EXISTS (SELECT 1 FROM legado.negocios n WHERE n.id = s.negocio_id AND n.status = 'no_show') THEN 'no_show'
    WHEN EXISTS (SELECT 1 FROM legado.negocios n WHERE n.id = s.negocio_id
                    AND n.status IN ('reuniao_realizada','trial','proposta_apresentada','negociacao_iniciada','ganho'))
      OR EXISTS (SELECT 1 FROM legado.status_changes c WHERE c.negocio_id = s.negocio_id AND c.created_at > s.data
                    AND c.para_status IN ('reuniao_realizada','trial','proposta_apresentada','negociacao_iniciada','ganho'))
      THEN 'realizada'
    ELSE 'agendada' END$$)) AS linhas;

-- ─── Atividades, notas, ligacoes (direto) ──────────────────────────────────
-- ligacoes.usuario_id NULL e casado pelo user_email do payload.
SELECT 'atividades' AS tabela, pg_temp.mz_carga('atividades') AS linhas;
-- empresa_id de prod pode ser uma das empresas descartadas no merge de CNPJ (passo 03): remapeia.
SELECT 'notas' AS tabela, pg_temp.mz_carga('notas', 'true',
  jsonb_build_object('empresa_id', 'public._mz_empresa(s.empresa_id)')) AS linhas;
SELECT 'ligacoes' AS tabela, pg_temp.mz_carga('ligacoes', 'true', jsonb_build_object(
  'usuario_id', 'coalesce(s.usuario_id, (SELECT u.id FROM public.usuarios u WHERE lower(u.email) = lower(s.user_email)))')) AS linhas;

-- ─── E-mail ────────────────────────────────────────────────────────────────
-- Tokens ja vem cifrados; o destino precisa da MESMA EMAIL_ENCRYPTION_KEY de prod.
-- P22: a caixa kaua.araujo@ esta presa ao usuario do Scott. Cada conta passa a ser
-- do usuario cujo e-mail e o da caixa (so muda o caso do Kaua; as demais ja batem).
-- As 2 contas mortas desde 20/07 ('Invalid token lifetime', Kaua e Jenifer) nao
-- sao carregadas; os e-mails delas migram para a conta viva do mesmo endereco.
\set conta_morta_kaua  '''a4b78cee-18d2-4faf-851e-de254cad3738'''
\set conta_viva_kaua   '''27cca3cf-92f2-481e-95af-ebf70da9c1d4'''
\set conta_morta_jen   '''6f757fcf-f094-4a02-a505-c5f0b35be678'''
\set conta_viva_jen    '''868ebb70-927b-43a9-b8ae-10415a136bb3'''
\set remapeia_conta 'CASE s.conta_id WHEN ' :conta_morta_kaua ' THEN ' :conta_viva_kaua '::uuid WHEN ' :conta_morta_jen ' THEN ' :conta_viva_jen '::uuid ELSE s.conta_id END'

SELECT 'email_contas' AS tabela, pg_temp.mz_carga('email_contas',
  's.id NOT IN (' || :'conta_morta_kaua' || '::uuid, ' || :'conta_morta_jen' || '::uuid)',
  jsonb_build_object('usuario_id', 'coalesce((SELECT u.id FROM public.usuarios u WHERE lower(u.email) = lower(s.email)), s.usuario_id)'), true) AS linhas;

-- ─── WhatsApp ──────────────────────────────────────────────────────────────
-- Sessoes com api_token (os webhooks sao apontados para o wuzapi de prod fora do banco).
SELECT 'whatsapp_sessao' AS tabela, pg_temp.mz_carga('whatsapp_sessao', 'true', '{}', true) AS linhas;
-- contatos: status 'open' (default da tabela), snoozed/closed NULL.
SELECT 'contatos' AS tabela, pg_temp.mz_carga('contatos', 'true', jsonb_build_object('conta_id', :'remapeia_conta')) AS linhas;
-- Midia legada (4.301) nao abre nem em prod: copia a URL, a tela mostra "midia indisponivel".
SELECT 'whatsapp_mensagens' AS tabela, pg_temp.mz_carga('whatsapp_mensagens') AS linhas;

-- contato_labels: prod nao tem a tabela. Deriva do lead do contato (contatos.lead_id,
-- ou o unico lead dono do telefone/e-mail), pelas labels que o lead ja tem no destino.
-- Telefone pelos 8 ultimos digitos; so vale quando aponta para UM lead (ambiguo = sem label).
WITH lf AS MATERIALIZED (
  SELECT right(regexp_replace(telefone, '\D', '', 'g'), 8) AS k, (array_agg(id))[1] AS lead_id
    FROM leads WHERE length(regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) >= 8
   GROUP BY 1 HAVING count(*) = 1),
le AS MATERIALIZED (
  SELECT lower(trim(email)) AS k, (array_agg(id))[1] AS lead_id
    FROM leads WHERE coalesce(email, '') <> '' GROUP BY 1 HAVING count(*) = 1),
alvo AS (
  SELECT c.id AS contato_id,
         coalesce(c.lead_id,
                  (SELECT lf.lead_id FROM lf WHERE lf.k = right(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), 8)),
                  (SELECT le.lead_id FROM le WHERE le.k = lower(trim(c.email)))) AS lead_id
    FROM contatos c)
INSERT INTO contato_labels (contato_id, label_id)
SELECT DISTINCT a.contato_id, ll.label_id
  FROM alvo a JOIN lead_labels ll ON ll.lead_id = a.lead_id
 WHERE a.lead_id IS NOT NULL
ON CONFLICT (contato_id, label_id) DO NOTHING;

SELECT 'emails' AS tabela, pg_temp.mz_carga('emails', 'true', jsonb_build_object('conta_id', :'remapeia_conta')) AS linhas;

-- ─── Notificacoes e nao lido (P18) ─────────────────────────────────────────
-- As 3.750 notificacoes legadas eram 100% nao lidas; entram lidas. O nao lido por
-- lead (273) e zerado. contatos.nao_lidas (493) segue como veio: e o contador da
-- conversa no Atendimento, nao do sino (decisao pendente do Scott, ver retorno).
SELECT 'notificacoes' AS tabela, pg_temp.mz_carga('notificacoes', 'true', jsonb_build_object('lida', 'true')) AS linhas;
SELECT 'lead_user_unread' AS tabela, pg_temp.mz_carga('lead_user_unread', 'true',
  jsonb_build_object('whatsapp_nao_lidas', '0', 'email_nao_lidos', '0')) AS linhas;

-- ─── Resto (direto) ────────────────────────────────────────────────────────
-- Prod tem 18 fb_lead_id repetidos (o retry de 5 min do webhook gravou 2x); o destino tem
-- indice unico em fb_lead_id. Entra o mais antigo de cada um: 650 -> 632.
SELECT 'meta_lead_staging' AS tabela, pg_temp.mz_carga('meta_lead_staging',
  $$ (s.fb_lead_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.meta_lead_staging px WHERE px.fb_lead_id = s.fb_lead_id AND px.id <> s.id)) AND (s.fb_lead_id IS NULL OR s.id = (SELECT x.id FROM legado.meta_lead_staging x WHERE x.fb_lead_id = s.fb_lead_id ORDER BY x.created_at, x.id LIMIT 1)) $$) AS linhas;
SELECT 'audit_log' AS tabela, pg_temp.mz_carga('audit_log') AS linhas;
SELECT 'ai_sdr_config' AS tabela, pg_temp.mz_carga('ai_sdr_config') AS linhas;
SELECT 'ai_sdr_logs' AS tabela, pg_temp.mz_carga('ai_sdr_logs') AS linhas;
SELECT 'outreach_campanhas' AS tabela, pg_temp.mz_carga('outreach_campanhas') AS linhas;

COMMIT;
