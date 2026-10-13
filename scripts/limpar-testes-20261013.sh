#!/bin/bash
# Limpeza dos dados de teste que ficaram no banco do ONFACE depois da virada de
# 13/10/2026 (o banco era o dev; o CRM legado congelado serviu de referencia).
#
# Uso:  scripts/limpar-testes-20261013.sh --dry   (roda tudo e da ROLLBACK)
#       scripts/limpar-testes-20261013.sh         (roda e da COMMIT)
#
# Tudo numa transacao, ON_ERROR_STOP=1. Se qualquer contagem divergir do
# inventario aprovado, a transacao aborta sem mudar nada.
#
#  Pacote A: apaga o lixo de teste puro (QA2/QA3/QA5, [DOCUMENSO-E2E], leads de
#            teste da Meta) e o que depende dele (cliente, fatura de teste,
#            contrato, CS, checkout, feeds).
#  Pacote B: apaga negocio/oportunidade/proposta/reuniao de teste que o Scott
#            abriu sobre lead/empresa que ja existia (LUX, TESTE LTDA, teste
#            scott). MARCA, nao apaga, os leads Kaua Scott e Teste final:
#            aquisicao em Desqualificado, motivo "teste". Zera so
#            qualificacao_iniciada_em da Lux e do Jeferson.
#  NAO toca: audit_log, domain_events, event_outbox (historico); responsavel de
#            lead; Pacote C (testes antigos do legado); lead "Kaua"/empresa
#            "Scott Studio"; schema legado; tabelas _virada_*/_limpeza_quadros_*.
#
# Backup: cada linha apagada ou alterada vai inteira (to_jsonb) para
# _limpeza_testes_20261013 ANTES da mudanca (acao APAGAR ou ATUALIZAR).
set -euo pipefail
FIM=COMMIT; [ "${1:-}" = "--dry" ] && FIM=ROLLBACK
ssh -i "$HOME/.ssh/infra_callface.pem" ubuntu@34.204.200.52 \
  "docker exec -i callface-crm2-dev-postgres psql -U callface -d callface_crm_mz -X -v ON_ERROR_STOP=1" <<SQL
BEGIN;
CREATE TABLE IF NOT EXISTS _limpeza_testes_20261013 (
  n bigserial PRIMARY KEY, acao text, tabela text, registro_id text, linha jsonb,
  feito_em timestamptz NOT NULL DEFAULT now());
DO \$\$ BEGIN
  IF EXISTS (SELECT 1 FROM _limpeza_testes_20261013) THEN
    RAISE EXCEPTION 'o backup ja tem linhas: esta limpeza ja rodou'; END IF;
END \$\$;

-- ids aprovados no inventario: (grupo, id)
CREATE TEMP TABLE s (kind text, id uuid) ON COMMIT DROP;
INSERT INTO s VALUES
  ('A_lead','405ad25a-7ff9-435c-b5a0-af8a65b2fc57'),
  ('A_lead','bf029bdd-b2cd-4219-87c7-4b800a0c9f3c'),
  ('A_lead','b8b53d8d-a4c1-45c7-bd1c-746cd4a4ccb7'),
  ('A_lead','9cfbe52e-bc4f-48f4-962c-d9b78b6f1999'),
  ('A_lead','e05d19a6-7f4a-4c87-8f67-66798db22a6e'),
  ('A_lead','f1635eab-f41f-45df-810d-55b27c75741c'),
  ('A_lead','7a6f59fa-415b-452d-a883-dd8f16e56a22'),
  ('A_lead','6d29eef7-4cca-4548-aefc-615d56cc7f1e'),
  ('A_emp','c58a134d-cd36-41d1-ac40-53998ae6d655'),
  ('A_emp','3f24e8b7-fcfd-423d-8ee0-36c7b173e10c'),
  ('A_emp','ee950d98-380a-4f21-9035-62855635301b'),
  ('A_emp','14405e27-93d1-4510-8648-39412322bebd'),
  ('A_emp','03da7c1f-df26-4fc2-994a-219762c3b7e5'),
  ('A_emp','c7679bea-78b1-4408-b5ac-243925c4546e'),
  ('A_emp','dfa65ac2-01c3-4071-a190-862552b08ce1'),
  ('A_emp','7fda111a-054f-458b-a8bc-bff836640c9c'),
  ('A_emp','ab06887d-410d-472c-90f3-08c4ed605092'),
  ('A_pess','81f1433a-da7a-4dd6-afd6-ce82ec5ac7b1'),
  ('A_pess','8dc08827-6a62-4c03-aec5-643f8de6ad54'),
  ('A_pess','4d92120e-6016-442f-9994-9a2f1baf9c37'),
  ('A_pess','edd61b13-4f1f-4f7e-a36f-714f4be59bc8'),
  ('A_pess','888f6e99-a584-4c62-a630-8ed65175cedb'),
  ('A_pess','4b0f9796-11fa-4c3a-9d68-b07304181820'),
  ('A_pess','c194bff1-9e87-4da1-9c7c-4a739340a5d0'),
  ('A_pess','57d5df66-74d8-6ab1-7060-cf416e296bfb'),
  ('A_pess','2dc097f2-ad03-6f9e-bd48-94aaa89e8a7d'),
  ('A_pess','81d5a5c7-88e7-cf29-6bda-55383c00d715'),
  ('A_neg','4569245a-8641-46ca-87eb-64b4b2d999aa'),
  ('A_neg','9b3fe455-20e5-48f3-9c30-97852b5e34f6'),
  ('A_neg','5a3c76f7-d5cf-4b95-8964-71f9670ee3b0'),
  ('A_neg','984d4b2a-3819-48ae-8c59-b9321574ad52'),
  ('A_neg','62964f48-b8f0-4acc-8416-9f0cf87cfd33'),
  ('A_neg','0041b7bf-8f33-46db-9c94-1e0d922b9255'),
  ('A_neg','62a7541d-e7e9-48a2-8962-5213b894ff9d'),
  ('A_neg','21c379b3-aeb8-4a9d-9194-2daada183d44'),
  ('A_opp','d2dc765f-95d9-4fe0-97c6-929d98e17852'),
  ('A_opp','604f655f-be4e-4f64-a364-79c9b6540679'),
  ('A_opp','aeea010f-35ef-4e60-bb7e-48d021fa36e4'),
  ('A_opp','b9b353bb-69f3-4652-bf29-6ae85bfe2285'),
  ('A_opp','401911f8-2573-48a2-a1a8-5019295e3630'),
  ('A_opp','5f90f891-8fbc-43f4-80a8-b39bf0e23334'),
  ('A_opp','0366acc4-f55c-4984-878c-9d27f20c4c20'),
  ('A_prop','74adda68-5777-4e38-bae2-6f7d6d9d2bec'),
  ('A_prop','9e11d459-79e3-44ea-acc2-fe8704247011'),
  ('A_contr','aae82c30-4825-4f0d-8af9-b6a1ccdf67b7'),
  ('A_contr','d7182760-e6a1-4766-a999-5c0524633004'),
  ('A_reu','e2e51029-2c84-4718-b82c-036bbb464c9d'),
  ('A_reu','7759c185-38e4-4bcc-8b50-3b2f1c93aa48'),
  ('B_neg','ec847e44-3e5e-4c65-aec5-d36c7d7f260a'),
  ('B_neg','a25edb6b-8a24-48c7-a028-8625032a0e7d'),
  ('B_neg','34c3a6ad-2ac4-416f-b449-46687b539845'),
  ('B_neg','d9f22244-b208-4563-8cf1-c861359e43cb'),
  ('B_opp','2702b5c2-0262-448e-847f-27fd610d693c'),
  ('B_opp','2110f70b-f9c1-4bb7-bf8a-275560ab4bbb'),
  ('B_opp','eca3deec-d938-457a-9aaa-152f05907576'),
  ('B_opp','4acc8b49-eab7-4cd3-b978-ed3054af85ed'),
  ('B_prop','0bedcca0-6b2a-40ec-aa99-409bdaa1a83b'),
  ('B_prop','00f5c11d-fb28-494e-b349-853dd4193c69'),
  ('B_reu','e3be4bb9-b7bb-45ad-addf-c416c4da1312'),
  ('B_reu','b7421c79-9bd4-4abe-aa52-f461396fd921'),
  ('B_reu','c07461e6-1261-4922-a67a-ab58639fb567'),
  ('B_reu','c3eac66d-749c-4267-854d-6a6171b38fed'),
  ('B_reu','3b364b3b-39a9-49a0-9e4c-050f2a0b141a'),
  ('B_reu','21126ac4-e6d2-4099-80dd-460c857f652c'),
  ('M_marcar','c0911e6d-3e53-4269-b002-592765fa5f44'),
  ('M_marcar','66112e9a-deac-4659-b22c-6b0f29c21cf2'),
  ('Z_qi','146d6734-32bd-4952-9507-41391e437d58'),
  ('Z_qi','fe015611-934c-4617-b44c-b37a01839b91');

-- contagens de antes
CREATE TEMP TABLE antes ON COMMIT DROP AS
  SELECT 'leads' t,(SELECT count(*) FROM leads) n
  UNION ALL SELECT 'empresas',(SELECT count(*) FROM empresas)
  UNION ALL SELECT 'pessoas',(SELECT count(*) FROM pessoas)
  UNION ALL SELECT 'negocios',(SELECT count(*) FROM negocios)
  UNION ALL SELECT 'oportunidades',(SELECT count(*) FROM oportunidades)
  UNION ALL SELECT 'propostas',(SELECT count(*) FROM propostas)
  UNION ALL SELECT 'contratos',(SELECT count(*) FROM contratos)
  UNION ALL SELECT 'reunioes',(SELECT count(*) FROM reunioes)
  UNION ALL SELECT 'clientes',(SELECT count(*) FROM clientes)
  UNION ALL SELECT 'faturas',(SELECT count(*) FROM faturas)
  UNION ALL SELECT 'aquisicoes',(SELECT count(*) FROM aquisicoes)
  UNION ALL SELECT 'aquisicoes_abertas',(SELECT count(*) FROM aquisicoes WHERE closed_at IS NULL);

DO \$\$
DECLARE
  -- grupo, tabela, quantidade aprovada no inventario
  prim text[] := ARRAY['A_lead:leads:8','A_emp:empresas:9','A_pess:pessoas:10','A_neg:negocios:8','A_opp:oportunidades:7',
    'A_prop:propostas:2','A_contr:contratos:2','A_reu:reunioes:2','B_neg:negocios:4','B_opp:oportunidades:4',
    'B_prop:propostas:2','B_reu:reunioes:6'];
  -- dependentes cuja contagem exata foi aprovada
  esperado jsonb := '{"clientes":2,"faturas":2,"servicos_canonicos":2,"cs_renovacoes":2,"cs_riscos":2,"cs_marcos":14,"cs_health_snapshots":12,"checkouts":3,"proposta_grupo_comercial":3}';
  dep text[] := ARRAY['vendas_eventos','timeline_events','atividades','status_changes','tarefas','notas','comercial_evidencia','oportunidade_itens',
    'pontos_contato','cs_marcos','cs_health_snapshots','cs_renovacoes','cs_riscos','faturas','servicos_canonicos','clientes',
    'checkouts','proposta_grupo_comercial','proposta_itens','negocio_leads','aquisicoes',
    'pessoa_empresa_vinculos'];
  -- principais, filhos antes dos pais: tabela:grupos
  pdel text[] := ARRAY['contratos:A_contr','propostas:A_prop,B_prop','reunioes:A_reu,B_reu','oportunidades:A_opp,B_opp',
    'negocios:A_neg,B_neg','pessoas:A_pess','leads:A_lead','empresas:A_emp'];
  x text; a text[]; t text; k text; cl text; n bigint; m bigint; r record; f record; tot jsonb := '{}';
BEGIN
  -- guarda no backup as linhas que o ON DELETE CASCADE vai levar junto (filhos de 1 coluna)
  CREATE TEMP TABLE IF NOT EXISTS casc_log(tabela text, linhas bigint) ON COMMIT DROP;
  -- 1) confere o inventario
  FOREACH x IN ARRAY prim LOOP
    a := string_to_array(x, ':');
    EXECUTE format('SELECT count(*) FROM %I y WHERE y.id IN (SELECT id FROM s WHERE kind=%L)', a[2], a[1]) INTO n;
    IF n <> a[3]::int THEN RAISE EXCEPTION 'inventario diverge: % tem % no banco, esperado %', a[1], n, a[3]; END IF;
  END LOOP;

  -- 2) marcacoes e zeragens (backup da linha antes do UPDATE)
  INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha)
    SELECT 'ATUALIZAR','aquisicoes',q.id::text,to_jsonb(q) FROM aquisicoes q
     WHERE q.lead_legado_id IN (SELECT id FROM s WHERE kind='M_marcar');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>2 THEN RAISE EXCEPTION 'aquisicoes a marcar: % (esperado 2)', n; END IF;
  UPDATE aquisicoes SET etapa_id=(SELECT id FROM pipeline_etapas WHERE codigo='desqualificado' AND nome='Desqualificado'),
         desqualificado_em=coalesce(desqualificado_em,now()), closed_at=coalesce(closed_at,now()),
         motivo_desqualificacao='teste', updated_at=now()
   WHERE lead_legado_id IN (SELECT id FROM s WHERE kind='M_marcar');

  INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha)
    SELECT 'ATUALIZAR','leads',l.id::text,to_jsonb(l) FROM leads l
     WHERE l.id IN (SELECT id FROM s WHERE kind='Z_qi')
        OR (l.negocio_ativo_id IN (SELECT id FROM s WHERE kind IN ('A_neg','B_neg'))
            AND l.id NOT IN (SELECT id FROM s WHERE kind='A_lead'));
  -- sem mexer em updated_at, para nao parecer atividade
  UPDATE leads SET qualificacao_iniciada_em=NULL WHERE id IN (SELECT id FROM s WHERE kind='Z_qi');
  UPDATE leads SET negocio_ativo_id=NULL
   WHERE negocio_ativo_id IN (SELECT id FROM s WHERE kind IN ('A_neg','B_neg'))
     AND id NOT IN (SELECT id FROM s WHERE kind='A_lead');

  -- 3) dependentes: o filtro e montado com as colunas de ligacao que a tabela tem
  FOREACH t IN ARRAY dep LOOP
    cl := '';
    FOR r IN SELECT column_name c FROM information_schema.columns WHERE table_schema='public' AND table_name=t LOOP
      k := CASE
        WHEN r.c IN ('lead_id','lead_id_legado','lead_legado_id') THEN 'A_lead'
        WHEN r.c='empresa_id' THEN 'A_emp'
        WHEN r.c IN ('pessoa_id','pessoa_principal_id') THEN 'A_pess'
        WHEN r.c IN ('negocio_id','negocio_id_legado') THEN 'A_neg,B_neg'
        WHEN r.c IN ('oportunidade_id','oportunidade_origem_id') THEN 'A_opp,B_opp'
        WHEN r.c='proposta_id' THEN 'A_prop,B_prop'
        WHEN r.c='contrato_id' THEN 'A_contr'
        WHEN r.c='reuniao_id' THEN 'A_reu,B_reu' END;
      IF k IS NOT NULL THEN
        cl := cl || CASE WHEN cl='' THEN '' ELSE ' OR ' END
              || format('y.%I IN (SELECT id FROM s WHERE kind = ANY(string_to_array(%L,'','')))', r.c, k);
      END IF;
    END LOOP;
    CONTINUE WHEN cl='';
    EXECUTE format('INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha) SELECT ''APAGAR'',%L,coalesce(to_jsonb(y)->>''id'',y.ctid::text),to_jsonb(y) FROM %I y WHERE %s', t, t, cl);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF t='checkouts' THEN
      -- checkout e grupo comercial apontam um para o outro: guarda o grupo e solta o elo antes de apagar
      EXECUTE format('INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha) SELECT ''ATUALIZAR'',''proposta_grupo_comercial'',g.id::text,to_jsonb(g) FROM proposta_grupo_comercial g WHERE g.checkout_id IN (SELECT y.id FROM checkouts y WHERE %s)', cl);
      EXECUTE format('UPDATE proposta_grupo_comercial g SET checkout_id=NULL WHERE g.checkout_id IN (SELECT y.id FROM checkouts y WHERE %s)', cl);
    END IF;
    IF t='proposta_grupo_comercial' THEN
      -- contrato aponta para o grupo e o grupo para o contrato: guarda o contrato e solta o elo
      EXECUTE format('INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha) SELECT ''ATUALIZAR'',''contratos'',c.id::text,to_jsonb(c) FROM contratos c WHERE c.grupo_comercial_id IN (SELECT y.id FROM proposta_grupo_comercial y WHERE %s)', cl);
      EXECUTE format('UPDATE contratos c SET grupo_comercial_id=NULL WHERE c.grupo_comercial_id IN (SELECT y.id FROM proposta_grupo_comercial y WHERE %s)', cl);
    END IF;
    FOR f IN SELECT c.conrelid::regclass::text child, ca.attname ccol, pa.attname pcol
               FROM pg_constraint c JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
               JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
              WHERE c.contype='f' AND c.confdeltype='c' AND array_length(c.conkey,1)=1 AND c.confrelid=to_regclass('public.'||t) LOOP
      EXECUTE format('INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha) SELECT ''APAGAR_CASCATA'',%L,coalesce(to_jsonb(z)->>''id'',z.ctid::text),to_jsonb(z) FROM %s z WHERE z.%I IN (SELECT y.%I FROM %I y WHERE %s)', f.child, f.child, f.ccol, f.pcol, t, cl);
      GET DIAGNOSTICS m = ROW_COUNT;
      IF m>0 THEN RAISE NOTICE '  cascata % : % linhas', f.child, m; END IF;
    END LOOP;
    EXECUTE format('DELETE FROM %I y WHERE %s', t, cl);
    tot := tot || jsonb_build_object(t,n);
    RAISE NOTICE 'dependente %: % linhas', t, n;
  END LOOP;
  FOR r IN SELECT key, value::int v FROM jsonb_each_text(esperado) LOOP
    IF coalesce((tot->>r.key)::int,0) <> r.v THEN
      RAISE EXCEPTION 'contagem diverge em %: apagou %, esperado %', r.key, tot->>r.key, r.v; END IF;
  END LOOP;

  -- 4) principais
  FOREACH x IN ARRAY pdel LOOP
    a := string_to_array(x, ':');
    EXECUTE format('INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha) SELECT ''APAGAR'',%L,y.id::text,to_jsonb(y) FROM %I y WHERE y.id IN (SELECT id FROM s WHERE kind = ANY(string_to_array(%L,'','')))', a[1], a[1], a[2]);
    FOR f IN SELECT c.conrelid::regclass::text child, ca.attname ccol, pa.attname pcol
               FROM pg_constraint c JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
               JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
              WHERE c.contype='f' AND c.confdeltype='c' AND array_length(c.conkey,1)=1 AND c.confrelid=to_regclass('public.'||a[1]) LOOP
      EXECUTE format('INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha) SELECT ''APAGAR_CASCATA'',%L,coalesce(to_jsonb(z)->>''id'',z.ctid::text),to_jsonb(z) FROM %s z WHERE z.%I IN (SELECT y.%I FROM %I y WHERE %s)', f.child, f.child, f.ccol, f.pcol, a[1], format('y.id IN (SELECT id FROM s WHERE kind = ANY(string_to_array(%L,'','')))', a[2]));
      GET DIAGNOSTICS m = ROW_COUNT;
      IF m>0 THEN RAISE NOTICE '  cascata % : % linhas', f.child, m; END IF;
    END LOOP;
    EXECUTE format('DELETE FROM %I y WHERE y.id IN (SELECT id FROM s WHERE kind = ANY(string_to_array(%L,'','')))', a[1], a[2]);
    RAISE NOTICE 'principal %: apagado', a[1];
  END LOOP;

  -- 5) nada pode sobrar apontando para o que foi apagado (fora do historico mantido)
  FOR r IN SELECT c.table_name tn, c.column_name cn FROM information_schema.columns c
           JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name AND tb.table_type='BASE TABLE'
          WHERE c.table_schema='public' AND c.table_name !~ '^_' AND c.data_type='uuid'
            AND c.table_name NOT IN ('audit_log','domain_events','event_outbox','backfill_provenance')
            AND c.column_name IN ('lead_id','lead_id_legado','lead_legado_id','empresa_id','pessoa_id','pessoa_principal_id',
                'negocio_id','negocio_id_legado','oportunidade_id','oportunidade_origem_id','proposta_id','contrato_id','reuniao_id','canonical_lead_id') LOOP
    k := CASE
        WHEN r.cn IN ('lead_id','lead_id_legado','lead_legado_id','canonical_lead_id') THEN 'A_lead'
        WHEN r.cn='empresa_id' THEN 'A_emp'
        WHEN r.cn IN ('pessoa_id','pessoa_principal_id') THEN 'A_pess'
        WHEN r.cn IN ('negocio_id','negocio_id_legado') THEN 'A_neg,B_neg'
        WHEN r.cn IN ('oportunidade_id','oportunidade_origem_id') THEN 'A_opp,B_opp'
        WHEN r.cn='proposta_id' THEN 'A_prop,B_prop'
        WHEN r.cn='contrato_id' THEN 'A_contr'
        ELSE 'A_reu,B_reu' END;
    EXECUTE format('SELECT count(*) FROM %I y WHERE y.%I IN (SELECT id FROM s WHERE kind = ANY(string_to_array(%L,'','')))', r.tn, r.cn, k) INTO n;
    IF n>0 THEN RAISE EXCEPTION 'sobrou referencia: %.% (% linhas)', r.tn, r.cn, n; END IF;
  END LOOP;
END \$\$;

-- antes x depois e backup gravado
SELECT a.t AS categoria, a.n AS antes,
       CASE a.t WHEN 'leads' THEN (SELECT count(*) FROM leads) WHEN 'empresas' THEN (SELECT count(*) FROM empresas)
        WHEN 'pessoas' THEN (SELECT count(*) FROM pessoas) WHEN 'negocios' THEN (SELECT count(*) FROM negocios)
        WHEN 'oportunidades' THEN (SELECT count(*) FROM oportunidades) WHEN 'propostas' THEN (SELECT count(*) FROM propostas)
        WHEN 'contratos' THEN (SELECT count(*) FROM contratos) WHEN 'reunioes' THEN (SELECT count(*) FROM reunioes)
        WHEN 'clientes' THEN (SELECT count(*) FROM clientes) WHEN 'faturas' THEN (SELECT count(*) FROM faturas)
        WHEN 'aquisicoes' THEN (SELECT count(*) FROM aquisicoes)
        ELSE (SELECT count(*) FROM aquisicoes WHERE closed_at IS NULL) END AS depois
  FROM antes a;
SELECT acao, tabela, count(*) AS linhas_no_backup FROM _limpeza_testes_20261013 GROUP BY 1,2 ORDER BY 1,2;
$FIM;
SQL
