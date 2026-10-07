-- CHECK FINAL (gate da virada).
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
-- Gate da virada. Roda os checks 09, 10 e 11 (acumulando) e depois a tabela de reconciliacao
-- do mapa (secao 7) e o checklist do diagnostico (secao 7, itens 1 a 33). Sai com codigo 0 so se
-- TUDO bater; senao lista cada falha e termina com erro.
--
-- Uso:  psql -d <alvo> -v inicio='2026-10-07 09:00:00-03' -f checks/99_final.sql
--   inicio = horario em que o run.sh comecou a carga (o check de updated_at precisa dele).
-- O banco alvo tem que ter o schema `legado` (postgres_fdw para o dump fresco de prod).
-- Esperado = legado quando o legado tem a tabela; numero fixo so onde a regra do Scott
-- fixa o numero (planilha set/26) ou o numero vem de fora de prod (qualificacao SDR).
-- Itens do diagnostico sem check proprio abaixo: 3 (so a base dos itens 4 a 9) e 26 (a diferenca
-- de R$1.708,80 do contratado ainda nao foi explicada; sem numero esperado nao ha gate).
\set mz_acumula 1
\ir 09_operacao.sql
\ir 10_timeline.sql
\ir 11_configs.sql
\o /dev/null

-- ─── 01 usuarios ──────────────────────────────────────────────────────────
SELECT pg_temp.mz_eq('01', 'usuarios = legado', pg_temp.mz_cnt('select count(*) from usuarios'), pg_temp.mz_cnt('select count(*) from legado.usuarios'));
SELECT pg_temp.mz_eq('01', 'usuarios qa.%', pg_temp.mz_cnt('select count(*) from usuarios where email like ''qa.%'''), 0);

-- ─── diag 1 / 03 leads e identidade ───────────────────────────────────────
SELECT pg_temp.mz_eq('03', 'diag 1: leads = legado', pg_temp.mz_cnt('select count(*) from leads'), pg_temp.mz_cnt('select count(*) from legado.leads'));
SELECT pg_temp.mz_eq('03', 'diag 22: CNPJ duplicado em empresas',
  pg_temp.mz_cnt('select count(*) from (select 1 from empresas where coalesce(cnpj, '''') <> '''' group by regexp_replace(cnpj, ''\D'', '''', ''g'') having count(*) > 1) x'), 0);
SELECT pg_temp.mz_eq('03', 'pessoas sem lead de origem', pg_temp.mz_cnt('select count(*) from pessoas where lead_id_legado is null'), 0);
-- B4 (mapa): 'novo' so para o pending real, nunca em massa. O diagnostico dizia 0, mas o mapa 2.3 manda pending = novo.
SELECT pg_temp.mz_eq('03', 'leads tipo lead em novo sem ser pending em prod',
  pg_temp.mz_cnt('select count(*) from leads l join legado.leads s on s.id = l.id where l.tipo = ''lead'' and l.estagio_pre_vendas = ''novo'' and s.sdr_status is distinct from ''pending'''), 0);

-- ─── 04 pre-vendas ────────────────────────────────────────────────────────
SELECT pg_temp.mz_eq('04', 'diag 19: etapa do lead <> etapa da aquisicao',
  pg_temp.mz_cnt('select count(*) from leads l join aquisicoes a on a.lead_legado_id = l.id join pipeline_etapas pe on pe.id = a.etapa_id where l.estagio_pre_vendas is distinct from pe.codigo'), 0);
SELECT pg_temp.mz_eq('04', 'diag 20: desqualificado em leads = em aquisicoes',
  pg_temp.mz_cnt('select count(desqualificado_em) from leads'),
  pg_temp.mz_cnt('select count(a.desqualificado_em) from aquisicoes a where a.lead_legado_id is not null'));
SELECT pg_temp.mz_eq('04', 'diag 20: qualificado em leads = em aquisicoes',
  pg_temp.mz_cnt('select count(*) from leads where qualificado'),
  pg_temp.mz_cnt('select count(*) from aquisicoes a where a.qualificado and a.lead_legado_id is not null'));
SELECT pg_temp.mz_info('04', 'diag 20: desqualificados / qualificados (ref. 06/10: 667 / 21)',
  pg_temp.mz_cnt('select count(desqualificado_em) from leads') || ' / ' || pg_temp.mz_cnt('select count(*) from leads where qualificado'));
SELECT pg_temp.mz_info('04', 'no-show devolvidos a qualificado (ref. 06/10: 29)',
  pg_temp.mz_cnt('select count(distinct o.lead_id) from oportunidades o join aquisicoes a on a.lead_legado_id = o.lead_id join pipeline_etapas pe on pe.id = a.etapa_id where o.motivo_perda = ''no_show'' and pe.codigo = ''qualificado''')::text);
SELECT pg_temp.mz_eq('04', 'diag 18: board de pre-vendas, novo em aquisicoes = novo em leads',
  pg_temp.mz_cnt('select count(*) from aquisicoes a join pipeline_etapas pe on pe.id = a.etapa_id join leads l on l.id = a.lead_legado_id where l.tipo = ''lead'' and pe.codigo = ''novo'''),
  pg_temp.mz_cnt('select count(*) from leads where tipo = ''lead'' and estagio_pre_vendas = ''novo'''));
SELECT pg_temp.mz_eq('04', 'diag 33: leads com qualificacao SDR', pg_temp.mz_cnt('select count(qualificacao) from leads'), 235);
-- outbound trabalhado (nao pending) em prod; o dump fresco tem 40 (o mapa citava 41, de um dump anterior).
SELECT pg_temp.mz_eq('04', 'diag 33: pre_qualificado em prospeccao_estado pre_qualificado = outbound trabalhado em prod',
  pg_temp.mz_cnt('select count(*) from leads where prospeccao_estado = ''pre_qualificado'' and pre_qualificado'),
  pg_temp.mz_cnt('select count(*) from legado.leads where lower(btrim(origem)) = ''outbound'' and sdr_status is distinct from ''pending'''));

-- ─── 05 funil ─────────────────────────────────────────────────────────────
-- De-para do Scott: reuniao_agendada=entrada; reuniao_realizada=diagnostico; trial+proposta_apresentada=proposta;
-- negociacao_iniciada=negociacao; ganho=ganho; perdido+no_show+4 estagnados=perdido. Esperado vem do legado.
SELECT pg_temp.mz_eq('05', 'negocios = legado', pg_temp.mz_cnt('select count(*) from negocios'), pg_temp.mz_cnt('select count(*) from legado.negocios'));
SELECT pg_temp.mz_eq('05', 'oportunidades = negocios legado', pg_temp.mz_cnt('select count(*) from oportunidades'), pg_temp.mz_cnt('select count(*) from legado.negocios'));
SELECT pg_temp.mz_eq('05', 'diag 2: negocios sem oportunidade',
  pg_temp.mz_cnt('select count(*) from negocios n where not exists (select 1 from oportunidades o where o.negocio_id_legado = n.id)'), 0);
SELECT pg_temp.mz_eq('05', 'negocio_leads = legado', pg_temp.mz_cnt('select count(*) from negocio_leads'), pg_temp.mz_cnt('select count(*) from legado.negocio_leads'));
SELECT pg_temp.mz_eq('05', 'diag ' || d.item || ': etapa ' || d.etapa, pg_temp.mz_cnt('select count(*) from oportunidades where etapa = ' || quote_literal(d.etapa)),
  pg_temp.mz_cnt('select count(*) from legado.negocios where status in (' || d.status || ')'))
  FROM (VALUES (4, 'entrada', '''reuniao_agendada'''), (5, 'diagnostico', '''reuniao_realizada'''),
               (6, 'proposta', '''trial'',''proposta_apresentada'''), (7, 'negociacao', '''negociacao_iniciada'''),
               (8, 'ganho', '''ganho'''),
               (9, 'perdido', '''perdido'',''no_show'',''outra_data'',''sem_retorno'',''trava_negociacao'',''trava_assinatura''')) d(item, etapa, status);
SELECT pg_temp.mz_eq('05', 'diag 10: copias ativo com etapa',
  pg_temp.mz_cnt('select count(*) from oportunidades o join negocios n on n.id = o.negocio_id_legado where n.status = ''ativo'' and o.etapa is not null'), 0);
SELECT pg_temp.mz_eq('05', 'diag 10: ativo com ganho_at',
  pg_temp.mz_cnt('select count(*) from oportunidades o join negocios n on n.id = o.negocio_id_legado where n.status = ''ativo'' and o.ganho_at is not null'), 0);
SELECT pg_temp.mz_eq('05', 'diag 11: fechadas sem data',
  pg_temp.mz_cnt('select count(*) from oportunidades where (etapa = ''ganho'' and ganho_at is null) or (etapa = ''perdido'' and perdido_at is null)'), 0);
SELECT pg_temp.mz_eq('05', 'perdidas sem motivo_perda', pg_temp.mz_cnt('select count(*) from oportunidades where etapa = ''perdido'' and coalesce(motivo_perda, '''') = '''''), 0);
SELECT pg_temp.mz_eq('05', 'diag 12: etapa_id incoerente',
  pg_temp.mz_cnt('select count(*) from oportunidades o left join pipeline_etapas e on e.id = o.etapa_id where o.etapa is distinct from e.codigo'), 0);
SELECT pg_temp.mz_eq('05', 'negocios com status aberto e oportunidade em perdido',
  pg_temp.mz_cnt('select count(*) from negocios n join oportunidades o on o.negocio_id_legado = n.id where n.status in (''reuniao_agendada'',''reuniao_realizada'',''trial'',''proposta_apresentada'',''negociacao_iniciada'') and o.etapa = ''perdido'''), 0);
SELECT pg_temp.mz_eq('05', 'diag 13: abertas = entrada+diagnostico+proposta+negociacao',
  pg_temp.mz_cnt('select count(*) from oportunidades where etapa is not null and ganho_at is null and perdido_at is null'),
  pg_temp.mz_cnt('select count(*) from legado.negocios where status in (''reuniao_agendada'',''reuniao_realizada'',''trial'',''proposta_apresentada'',''negociacao_iniciada'')'));
SELECT pg_temp.mz_eq('05', 'diag 14: estagnados com motivo_estagnacao',
  pg_temp.mz_cnt('select count(*) from oportunidades where motivo_estagnacao is not null'),
  pg_temp.mz_cnt('select count(*) from legado.negocios where status in (''outra_data'',''sem_retorno'',''trava_negociacao'',''trava_assinatura'')'));
SELECT pg_temp.mz_eq('05', 'diag 14: estagnados com motivo_perda',
  pg_temp.mz_cnt('select count(*) from oportunidades where motivo_estagnacao is not null and coalesce(motivo_perda, '''') <> '''''),
  pg_temp.mz_cnt('select count(*) from legado.negocios where status in (''outra_data'',''sem_retorno'',''trava_negociacao'',''trava_assinatura'')'));
SELECT pg_temp.mz_eq('05', 'diag 15: no-show fechado (total / com perdido_at / com motivo)',
  pg_temp.mz_cnt('select count(*) from oportunidades where motivo_perda = ''no_show'' and perdido_at is not null'),
  pg_temp.mz_cnt('select count(*) from legado.negocios where status = ''no_show'''));
SELECT pg_temp.mz_eq('05', 'diag 16: valor de Ganho',
  pg_temp.mz_cnt('select sum(valor) from oportunidades where etapa = ''ganho'''),
  pg_temp.mz_cnt('select sum(coalesce(valor_total, valor_projeto)) from legado.negocios where status = ''ganho'''));
SELECT pg_temp.mz_eq('05', 'diag 17: Mayara set/26 (valor)',
  pg_temp.mz_cnt('select sum(o.valor) from oportunidades o join usuarios u on u.id = o.responsavel_id where u.nome ilike ''Mayara%'' and o.etapa = ''ganho'' and o.ganho_at >= ''2026-09-01 00:00-03'' and o.ganho_at < ''2026-10-01 00:00-03'''),
  pg_temp.mz_cnt('select sum(n.valor_total) from legado.negocios n join legado.usuarios u on u.id = n.responsavel_id where u.nome ilike ''Mayara%'' and n.status = ''ganho'' and n.ganho_at >= ''2026-09-01 00:00-03'' and n.ganho_at < ''2026-10-01 00:00-03'''));
SELECT pg_temp.mz_eq('05', 'service_family nao nula em oportunidades', pg_temp.mz_cnt('select count(service_family) from oportunidades'), pg_temp.mz_cnt('select count(service_family) from legado.negocios'));
SELECT pg_temp.mz_eq('05', 'commercial_motion EXPANSION = negocios de carteira',
  pg_temp.mz_cnt('select count(*) from oportunidades where commercial_motion = ''EXPANSION'''),
  pg_temp.mz_cnt('select count(*) from legado.negocios where origem_negocio = ''carteira'''));

-- ─── 06 contratos e propostas ─────────────────────────────────────────────
SELECT pg_temp.mz_eq('06', 'contratos = legado sem assinatura Stripe', pg_temp.mz_cnt('select count(*) from contratos'), pg_temp.mz_cnt('select count(*) from legado.contratos where tipo <> ''assinatura'''));
SELECT pg_temp.mz_eq('06', 'propostas = legado', pg_temp.mz_cnt('select count(*) from propostas'), pg_temp.mz_cnt('select count(*) from legado.propostas'));
SELECT pg_temp.mz_eq('06', 'proposta_itens = legado', pg_temp.mz_cnt('select count(*) from proposta_itens'), pg_temp.mz_cnt('select count(*) from legado.proposta_itens'));
SELECT pg_temp.mz_eq('06', 'contrato_itens dos contratos carregados',
  pg_temp.mz_cnt('select count(*) from contrato_itens'),
  pg_temp.mz_cnt('select count(*) from legado.contrato_itens i join legado.contratos c on c.id = i.contrato_id where c.tipo <> ''assinatura'''));
SELECT pg_temp.mz_eq('06', 'diag 27: propostas com cabecalho zerado',
  pg_temp.mz_cnt('select count(*) from propostas p where total_recorrente = 0 and total_avulso = 0 and total_geral > 0 and exists (select 1 from proposta_itens i where i.proposta_id = p.id and i.tipo = ''recorrente'')'), 0);
SELECT pg_temp.mz_eq('06', 'proposta_itens sem revenue_nature', pg_temp.mz_cnt('select count(*) from proposta_itens where revenue_nature is null'), 0);
SELECT pg_temp.mz_eq('06', 'diag 29: contratos com PDF', pg_temp.mz_cnt('select count(distinct entidade_id) from anexos_legado where entidade_tipo = ''contrato'' and entidade_id is not null'), 211);
SELECT pg_temp.mz_eq('06', 'assinatura Stripe tratada como contrato', pg_temp.mz_cnt('select count(*) from contratos where tipo = ''assinatura'''), 0);

-- ─── 07 financeiro e diag 25 (volumes 1:1) ────────────────────────────────
SELECT pg_temp.mz_eq('07', 'diag 25: ' || t || ' = legado', pg_temp.mz_cnt('select count(*) from ' || t), pg_temp.mz_cnt('select count(*) from legado.' || t))
  FROM unnest(ARRAY['faturas','fatura_itens','assinaturas','mrr_movimentos','stripe_webhook_events','billing_identities',
                    'anexos_legado','atividades']) t;
-- status_changes ONFACE = legado + os sinteticos do de-para (nunca menos).
SELECT pg_temp.mz_min('07', 'diag 25: status_changes >= legado', pg_temp.mz_cnt('select count(*) from status_changes'), pg_temp.mz_cnt('select count(*) from legado.status_changes'));

-- ─── 08 carteira ──────────────────────────────────────────────────────────
-- A planilha de fechamento set/26 e arquivo oficial, nao vem de prod: numero fixo.
-- 11.685 = pares cliente x mes. Setup/debito recuperado do mesmo mes viram linha propria (natureza separada), entao linhas > 11.685.
SELECT pg_temp.mz_eq('08', 'diag 24: pares cliente x mes da planilha', pg_temp.mz_cnt('select count(distinct (customer_key, competencia)) from cliente_receita_mensal'), 11685);
SELECT pg_temp.mz_info('08', 'diag 24: linhas de cliente_receita_mensal (1 por natureza/familia)', pg_temp.mz_cnt('select count(*) from cliente_receita_mensal')::text);
SELECT pg_temp.mz_eq('08', 'diag 24: total de set/26', pg_temp.mz_cnt('select sum(valor) from cliente_receita_mensal where competencia = date ''2026-09-01'''), 512404.49);
-- Regra do Scott: cliente = faturado em set/26 (com empresa casada) + venda nova - cancelado. O 305/344 do diagnostico era
-- o universo antigo; 32 documentos de set/26 ficam fora ate o Scott resolver revisao/clientes_sem_match.csv.
SELECT pg_temp.mz_min('08', 'diag 21: clientes >= empresas faturadas em set/26',
  pg_temp.mz_cnt('select count(*) from clientes'),
  pg_temp.mz_cnt('select count(distinct empresa_id) from cliente_receita_mensal where competencia = date ''2026-09-01'' and empresa_id is not null'));
SELECT pg_temp.mz_eq('08', 'diag 21: empresas do ultimo mes sem linha em clientes',
  pg_temp.mz_cnt('select count(distinct r.empresa_id) from cliente_receita_mensal r where r.competencia = (select max(competencia) from cliente_receita_mensal) and r.empresa_id is not null and not exists (select 1 from clientes c where c.empresa_id = r.empresa_id)'), 0);
SELECT pg_temp.mz_eq('08', 'diag 32: clientes sem dono', pg_temp.mz_cnt('select count(*) from clientes where responsavel_id is null'), 0);
SELECT pg_temp.mz_eq('08', 'clientes cujo dono nao e a Jenifer Matos',
  pg_temp.mz_cnt('select count(*) from clientes c where c.responsavel_id is distinct from (select id from usuarios where nome = ''Jenifer Matos'')'), 0);
SELECT pg_temp.mz_eq('08', 'clientes com cliente_desde = dia da carga', pg_temp.mz_cnt('select count(*) from clientes c where c.cliente_desde::date = current_date
    and not exists (select 1 from contratos x where x.empresa_id = c.empresa_id and x.created_at::date = current_date)
    and not exists (select 1 from faturas x where x.empresa_id = c.empresa_id and x.created_at::date = current_date)
    and not exists (select 1 from negocios x where x.empresa_id = c.empresa_id and x.ganho_at::date = current_date)'), 0);
SELECT pg_temp.mz_info('08', 'diag 23: MRR canonico (portfolio_included), ONFACE x legado (a regra set/26 pode mudar o valor)',
  pg_temp.mz_cnt('select sum(current_recurring_value) from servicos_canonicos where portfolio_included') || ' x ' ||
  pg_temp.mz_cnt('select sum(current_recurring_value) from legado.servicos_canonicos where portfolio_included'));

-- ─── 09, 10, 11 x diag 30, 31 ─────────────────────────────────────────────
SELECT pg_temp.mz_eq('09', 'diag 31: tarefas legadas (280) e nenhuma RENOVACAO legada', pg_temp.mz_cnt('select count(*) from tarefas where id in (select id from legado.tarefas) and origem = ''RENOVACAO'''), 0);

-- ─── final ────────────────────────────────────────────────────────────────
\if :{?inicio}
SELECT pg_temp.mz_eq('99', 'diag 28: updated_at >= inicio da carga em ' || t,
  pg_temp.mz_cnt('select count(*) from ' || t || ' where updated_at >= ' || quote_literal(:'inicio'::text) || '::timestamptz'), 0)
  FROM unnest(ARRAY['propostas','contratos','leads','negocios']) t;
\else
INSERT INTO _mz_res (grupo, nome, obtido, esperado, ok) VALUES ('99', 'diag 28: passe -v inicio=<horario do inicio da carga>', 'sem inicio', 'inicio informado', false);
\endif
\o

\unset mz_acumula
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
