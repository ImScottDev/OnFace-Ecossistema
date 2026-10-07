-- CHECK do passo 9 · operacao e atendimento (mapa secao 7, linha 09). Roda depois de 09_operacao.sql.
\set ON_ERROR_STOP on
-- Ajudantes de check (iguais em todo arquivo de check; temp, somem com a sessao).
-- Cada check grava em _mz_res e, no fim, para com RAISE EXCEPTION se algo falhou.
-- Com `-v mz_acumula=1` (o 99_final) nao para: o 99 junta tudo e para uma vez so.
CREATE TEMP TABLE IF NOT EXISTS _mz_res (ordem serial, grupo text, nome text, obtido text, esperado text, ok boolean, info boolean DEFAULT false);
CREATE OR REPLACE FUNCTION pg_temp.mz_cnt(consulta text) RETURNS numeric LANGUAGE plpgsql AS $f$
DECLARE n numeric; BEGIN EXECUTE consulta INTO n; RETURN coalesce(n, 0); END $f$;
CREATE OR REPLACE FUNCTION pg_temp.mz_eq(g text, nome text, obtido numeric, esperado numeric) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO _mz_res (grupo, nome, obtido, esperado, ok) VALUES (g, nome, obtido::text, esperado::text, obtido IS NOT DISTINCT FROM esperado) $f$;
CREATE OR REPLACE FUNCTION pg_temp.mz_min(g text, nome text, obtido numeric, minimo numeric) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO _mz_res (grupo, nome, obtido, esperado, ok) VALUES (g, nome, obtido::text, '>= ' || minimo, obtido >= minimo) $f$;
CREATE OR REPLACE FUNCTION pg_temp.mz_info(g text, nome text, valor text) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO _mz_res (grupo, nome, obtido, esperado, ok, info) VALUES (g, nome, valor, 'informativo', true, true) $f$;
\o /dev/null
-- Esperado = o schema `legado` (dump fresco de prod), nunca numero fixo. Os de 06/10
-- (280 tarefas, 328 reunioes, 5.786 ligacoes, 9.530 e-mails, 33.165 mensagens) sao so a referencia.
\set filipe '''fcb69714-2213-4cb4-90e0-4c1d2a93c4bc'''

-- Tarefas: sem as do Filipe; as cs_risco so nascem no sweep do passo 12.
SELECT pg_temp.mz_eq('09', 'tarefas = legado sem as do Filipe',
  -- so as de prod: o sweep de CS (passo 12) cria tarefas novas (cs_risco, renovacao) depois do 09
  pg_temp.mz_cnt('select count(*) from tarefas where id in (select id from legado.tarefas)'),
  pg_temp.mz_cnt('select count(*) from legado.tarefas where usuario_id is distinct from ' || :'filipe'));
SELECT pg_temp.mz_eq('09', 'tarefas do Filipe', pg_temp.mz_cnt('select count(*) from tarefas where id in (select id from legado.tarefas where usuario_id = ' || :'filipe' || ')'), 0);
SELECT pg_temp.mz_eq('09', 'tarefas legadas com origem RENOVACAO (as 16 do Filipe saem)',
  pg_temp.mz_cnt('select count(*) from tarefas where origem = ''RENOVACAO'' and id in (select id from legado.tarefas)'), 0);
SELECT pg_temp.mz_eq('09', 'tarefas com status fora de a_fazer/concluida', pg_temp.mz_cnt('select count(*) from tarefas where status not in (''a_fazer'',''concluida'')'), 0);
SELECT pg_temp.mz_eq('09', 'tarefas concluidas = legado concluida',
  pg_temp.mz_cnt('select count(*) from tarefas where status = ''concluida'''),
  pg_temp.mz_cnt('select count(*) from legado.tarefas where concluida and usuario_id is distinct from ' || :'filipe'));
SELECT pg_temp.mz_eq('09', 'tarefas ONBOARDING = legado onboarding_agendar_reuniao',
  pg_temp.mz_cnt('select count(*) from tarefas where origem = ''ONBOARDING'' and id in (select id from legado.tarefas)'),
  pg_temp.mz_cnt('select count(*) from legado.tarefas where tipo = ''onboarding_agendar_reuniao'' and usuario_id is distinct from ' || :'filipe'));

-- Reunioes: a regra da P9 so move agendada passada; cancelada fica.
SELECT pg_temp.mz_eq('09', 'reunioes', pg_temp.mz_cnt('select count(*) from reunioes'), pg_temp.mz_cnt('select count(*) from legado.reunioes'));
SELECT pg_temp.mz_eq('09', 'reunioes canceladas = legado', pg_temp.mz_cnt('select count(*) from reunioes where status = ''cancelada'''), pg_temp.mz_cnt('select count(*) from legado.reunioes where status = ''cancelada'''));
SELECT pg_temp.mz_eq('09', 'reunioes: agendada+realizada+no_show = agendadas do legado',
  pg_temp.mz_cnt('select count(*) from reunioes where status in (''agendada'',''realizada'',''no_show'')'),
  pg_temp.mz_cnt('select count(*) from legado.reunioes where status = ''agendada'''));
SELECT pg_temp.mz_eq('09', 'reunioes agendadas no passado com negocio em no_show (devem ser no_show)',
  pg_temp.mz_cnt('select count(*) from reunioes r join legado.negocios n on n.id = r.negocio_id where r.status = ''agendada'' and r.data < now() and n.status = ''no_show'''), 0);
SELECT pg_temp.mz_info('09', 'reunioes agendadas ja passadas (indeterminadas, o time resolve)',
  pg_temp.mz_cnt('select count(*) from reunioes where status = ''agendada'' and data < now()')::text);

-- Copias diretas: mesma contagem do legado.
SELECT pg_temp.mz_eq('09', t || ' = legado', pg_temp.mz_cnt('select count(*) from ' || t), pg_temp.mz_cnt('select count(*) from legado.' || t))
  FROM unnest(ARRAY['atividades','notas','ligacoes','emails','whatsapp_sessao','contatos','whatsapp_mensagens',
                    'notificacoes','lead_user_unread','audit_log','ai_sdr_config','ai_sdr_logs','outreach_campanhas']) t;
SELECT pg_temp.mz_eq('09', 'meta_lead_staging = legado sem fb_lead_id repetido',
  pg_temp.mz_cnt('select count(*) from meta_lead_staging'),
  pg_temp.mz_cnt('select count(distinct coalesce(fb_lead_id, id::text)) from legado.meta_lead_staging'));
SELECT pg_temp.mz_eq('09', 'ligacoes sem usuario, mas com user_email de usuario existente',
  pg_temp.mz_cnt('select count(*) from ligacoes l where usuario_id is null and exists (select 1 from usuarios u where lower(u.email) = lower(l.user_email))'), 0);

-- E-mail: as 2 contas mortas (Kaua e Jenifer) nao entram; o dono e o usuario do mesmo e-mail (P22).
SELECT pg_temp.mz_eq('09', 'email_contas = legado menos as 2 mortas', pg_temp.mz_cnt('select count(*) from email_contas'), pg_temp.mz_cnt('select count(*) from legado.email_contas') - 2);
SELECT pg_temp.mz_eq('09', 'email_contas presas a usuario de outro e-mail',
  pg_temp.mz_cnt('select count(*) from email_contas ec join usuarios u on lower(u.email) = lower(ec.email) where ec.usuario_id <> u.id'), 0);
SELECT pg_temp.mz_eq('09', 'emails apontando para conta morta',
  pg_temp.mz_cnt('select count(*) from emails where conta_id in (''a4b78cee-18d2-4faf-851e-de254cad3738'',''6f757fcf-f094-4a02-a505-c5f0b35be678'')'), 0);

-- Nao lido (P18): notificacoes entram lidas, nao lido por lead zerado.
SELECT pg_temp.mz_eq('09', 'notificacoes nao lidas', pg_temp.mz_cnt('select count(*) from notificacoes where not lida'), 0);
SELECT pg_temp.mz_eq('09', 'lead_user_unread com nao lido', pg_temp.mz_cnt('select count(*) from lead_user_unread where whatsapp_nao_lidas <> 0 or email_nao_lidos <> 0'), 0);
SELECT pg_temp.mz_info('09', 'contatos.nao_lidas somado (segue como veio, decisao do Scott pendente)', pg_temp.mz_cnt('select sum(nao_lidas) from contatos')::text);
SELECT pg_temp.mz_info('09', 'contato_labels derivados', pg_temp.mz_cnt('select count(*) from contato_labels')::text);
\o

\if :{?mz_acumula}
\else
  SELECT grupo, nome, obtido, esperado, CASE WHEN info THEN 'info' WHEN ok THEN 'ok' ELSE 'FALHOU' END AS resultado
    FROM _mz_res ORDER BY ordem;
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM _mz_res WHERE NOT ok) THEN
      RAISE EXCEPTION 'check % falhou: %', (SELECT string_agg(DISTINCT grupo, ',') FROM _mz_res WHERE NOT ok),
        (SELECT string_agg(nome || ' (obtido ' || obtido || ', esperado ' || esperado || ')', '; ') FROM _mz_res WHERE NOT ok);
    END IF;
  END $$;
\endif
