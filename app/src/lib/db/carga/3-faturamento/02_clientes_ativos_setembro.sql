-- CARGA DA VIRADA · faturamento, passo 02 — quem é cliente ATIVO da Callface em
-- setembro/2026, e de que família.
--
-- Regra de negócio (Scott, 05/10): quem tem linha na planilha de faturamento de
-- setembro É cliente ativo. Medido no banco: 324 documentos distintos,
-- R$ 512.404,49 (`SELECT count(DISTINCT doc), sum(valor) FROM tmp_set`).
--
-- Estado medido ANTES deste passo, no ensaio de 05/10:
--   275 clientes canônicos · 217 pagaram em setembro · 58 não pagaram
--   107 pagantes de setembro não eram clientes canônicos
--        ├ 69 têm empresa cadastrada  →  viram cliente aqui
--        └ 38 não têm nem empresa     →  FICAM DE FORA (validação humana em
--          curso, /Users/Scott/callface-virada/38-clientes-sem-cadastro-SETEMBRO.csv)
--
-- ───────────────────────────────────────────────────────────────────────────
-- DE ONDE SAI A FAMÍLIA
--
-- As 149 NFS-e de /Users/Scott/Downloads/NFS-e/Autorizado são o faturamento
-- Stripe de setembro. Ter nota significa que o Stripe cobrou — NÃO significa
-- CALLFACE_AI. A família sai do PRODUTO descrito em <Discriminacao>, cruzado
-- com `servicos_catalogo` e `catalogo_mapeamentos_legacy`. É a correção que o
-- Scott pediu depois do caso G30 (doc 55617458000186, R$ 11.902,80), que tem
-- nota do Stripe e é WHITE_LABEL.
--
-- Os dados das notas estão EMBUTIDOS abaixo, não lidos de uma `tmp_*`: a
-- exportação de NFS-e é um arquivo datado fora do repo, e a classificação
-- precisa ser reproduzível e auditável sem ele. Extração (numero, CNPJ/CPF do
-- tomador, e cada produto da Discriminação, já sem quantidade, preço e
-- proração) — cada linha de produto virou uma linha de `_nf`.
--
-- Medido na extração: 149 notas · 122 documentos (8 notas SEM documento do
-- tomador no XML) · 163 linhas (numero, doc, produto), sendo 111 com produto
-- nomeado e 52 cuja Discriminação só diz "Subscription creation".
-- Produtos distintos nomeados: 19. Destes, 4 casam por nome exato com
-- `servicos_catalogo`/`catalogo_mapeamentos_legacy` com família != UNKNOWN
-- (Agente IA, Callface AI - Business, Callface AI - Full, Callface AI -
-- Starter); os outros 15 caem na leitura literal do nome, abaixo.
--
-- ───────────────────────────────────────────────────────────────────────────
-- LIMITAÇÃO CONHECIDA — a exportação de NFS-e está INCOMPLETA
--
-- A pasta tem 149 notas numeradas de 15244 a 15601; nessa faixa caberiam 358.
-- Faltam ~204 (5 estão em ../Cancelado) e a maior lacuna, 158 notas seguidas,
-- cai entre 04/09 e 08/09. Logo, "sem nota ⇒ PABX" classifica como PABX uma
-- parte que é AI. Medido: 121 dos 324 documentos de setembro têm nota; 203 não
-- têm. TODA família decidida por AUSÊNCIA de nota entra com
-- confidence='UNRESOLVED' e evidence.motivo='sem nota na exportacao parcial'.
-- Isso NÃO é classificação confiável — é um marcador para revisar quando as
-- notas que faltam chegarem.
--
-- Segunda limitação, medida aqui: a única nota que prova a regra do White Label
-- (nº 15601, "84 licença × Callface AI White Label - Licença", R$ 6.846,00, que
-- é o caso G30) NÃO TEM CNPJ do tomador no XML. O G30 já está WHITE_LABEL no
-- banco por outra via (`LEDGER:2026-07:55617458000186:WHITE_LABEL:MRR`,
-- billing_source MANUAL), então a classificação dele não depende desta nota —
-- mas a nota, sozinha, não bastaria.
--
-- ───────────────────────────────────────────────────────────────────────────
-- O QUE ESTE ARQUIVO NÃO FAZ, DE PROPÓSITO
--
-- Não sobrescreve `service_family` que já está preenchida com confidence
-- CONFIRMED. A classificação que já está em `servicos_canonicos` veio do pacote
-- FINAL_IMPLEMENTATION_PLAN com evidência própria (contrato, Zoho, ledger de
-- julho); trocá-la por uma dedução tirada de uma exportação fiscal INCOMPLETA
-- seria piorar o dado. A evidência das notas é usada para (a) PREENCHER o que
-- está 'UNKNOWN', (b) CLASSIFICAR quem não tem serviço canônico nenhum e
-- (c) MARCAR como AMBIGUOUS o que ela contradiz com evidência igualmente firme
-- — nunca para apagar em silêncio. Medido: de 121 documentos com nota, a
-- evidência fiscal concorda com o banco em 116, é mais fraca em 3 e contradiz
-- com força igual em 2.
--
-- Não cria coluna nova. `clientes.status_financeiro` (domínio real do app:
-- ativo | em_atraso | inadimplente | churned | indefinido, ver
-- components/crm2/clientes/Workspace.tsx) e `clientes.lifecycle_status` (texto
-- livre, sem contrato de UI, 100% NULL no dump) já dão conta.
--
-- Não toca em `servicos_canonicos.billing_status` dos não-pagantes: 89 serviços
-- deles estão ACTIVE vindos do Stripe. Não faturar na planilha de setembro não
-- torna falsa a assinatura ativa no Stripe — é justamente a divergência
-- "o CRM não reconcilia o Stripe". Marcar churn no nível do SERVIÇO apagaria
-- esse fato; o churn provável é do CLIENTE e fica em `clientes`.
--
-- Não mexe em `cliente_receita_mensal` (frente A, hoje com 0 linhas), em
-- aquisições/pipeline (frente C) nem em leads/contatos (frente D).
--
-- ───────────────────────────────────────────────────────────────────────────
-- REVERSÃO (tudo que este arquivo escreve é desfazível)
--
--   UPDATE clientes SET status_financeiro = NULL, lifecycle_status = NULL
--    WHERE lifecycle_status LIKE '%_2026-09';
--   DELETE FROM clientes WHERE lifecycle_status = 'ATIVO_SETEMBRO_2026-09'
--      AND created_at >= '<momento da carga>';   -- só os criados aqui
--   DELETE FROM servicos_canonicos WHERE billing_source = 'LEDGER_SETEMBRO';
--   UPDATE servicos_canonicos SET confidence = 'CONFIRMED',
--          evidence = evidence - 'setembro_2026'
--    WHERE evidence -> 'setembro_2026' ->> 'acao' = 'FLAG_AMBIGUOUS';
--
-- PRÉ-REQUISITO: `tmp_set` (planilha de faturamento de setembro: doc, nome,
-- cod, valor, lanc). É a mesma tabela que o passo 01 usa.
--
-- IDEMPOTENTE: criação de cliente é guardada por NOT EXISTS; criação de serviço
-- canônico é ON CONFLICT (organizacao_id, canonical_key) DO NOTHING; os UPDATEs
-- são determinísticos sobre o mesmo conjunto e reescrevem o mesmo valor.

CREATE EXTENSION IF NOT EXISTS unaccent;

\set ON_ERROR_STOP on

DO $$ BEGIN
  IF to_regclass('public.tmp_set') IS NULL THEN
    RAISE EXCEPTION 'tmp_set não existe — a planilha de faturamento de setembro precisa estar carregada';
  END IF;
END $$;

-- ═══ 0. evidência das NFS-e de setembro/2026 ═══════════════════════════════
-- (numero da nota, documento do tomador, produto). produto NULL = a
-- Discriminação só diz "Subscription creation", sem nome de produto.
-- doc '' = a nota não traz CNPJ/CPF do tomador (8 casos).
DROP TABLE IF EXISTS _nf;
CREATE TEMP TABLE _nf (numero text, doc text, produto text);
INSERT INTO _nf VALUES
  ('15244','42369224000115',NULL),
  ('15245','45941566000156','Callface Copilot'),
  ('15246','65530939000294',NULL),
  ('15247','63416968000113',NULL),
  ('15248','60487722000144',NULL),
  ('15249','02559819000119','Callface AI - Starter'),
  ('15250','03590527978','Callface Copilot'),
  ('15251','26886182000133','Callface Copilot'),
  ('15252','32009335000167','Negócios Profissionais'),
  ('15253','07825881000129','Callface Copilot'),
  ('15254','47724412000138','COLD CALLING - 2025'),
  ('15254','47724412000138','LINHA SIP ADICIONAL'),
  ('15254','47724412000138','PERFOMANCE CALL'),
  ('15255','09114004780','Callface Copilot'),
  ('15256','36443271000169','Callface AI - Full'),
  ('15257','40526039825',NULL),
  ('15258','55979927832',NULL),
  ('15259','30975431000134','Callface Copilot'),
  ('15260','63631239000180','Callface AI - Starter'),
  ('15261','00432052917','Callface AI - Starter'),
  ('15420','43645250816',NULL),
  ('15421','43924478000110',NULL),
  ('15422','43561294000133','Callface Copilot'),
  ('15423','60927920000181',NULL),
  ('15424','38343077000137','Callface Copilot'),
  ('15425','34781514000143','COLD CALLING - 2025'),
  ('15426','66273062000185','Callface Copilot'),
  ('15427','64469153000165','SETUP BROKER IA'),
  ('15428','42639657000143','Callface Copilot'),
  ('15429','03221326000137','COLD CALLING - 2025'),
  ('15430','48114589000185','Callface AI - Full'),
  ('15431','30203636000100','Callface AI - Starter'),
  ('15432','43201117000146','Callface Copilot'),
  ('15433','06003406518','Callface AI - Starter'),
  ('15434','65757637668','Callface AI - Full'),
  ('15435','32965023000127','PERFOMANCE CALL'),
  ('15436','30741016000116','Callface AI - Starter'),
  ('15437','18197915000102','Callface AI - Full'),
  ('15438','22200129807',NULL),
  ('15439','17529055000196','Callface AI - Full'),
  ('15440','56971343000158',NULL),
  ('15441','69675740191',NULL),
  ('15442','60927920000181',NULL),
  ('15443','31287695000168',NULL),
  ('15444','49452310000136','Callface Copilot'),
  ('15445','26349839000123',NULL),
  ('15446','43645250816',NULL),
  ('15447','44242452845',NULL),
  ('15448','14953134000131',NULL),
  ('15449','64328183000151','Callface AI - Full'),
  ('15450','21057162000136',NULL),
  ('15451','24947528842',NULL),
  ('15452','61654608000124',NULL),
  ('15453','','Callface AI - Pacote 500 Minutos'),
  ('15454','','Callface AI - Agente IA'),
  ('15455','43645250816',NULL),
  ('15456','64809618000180','Callface Copilot'),
  ('15457','67501138000145',NULL),
  ('15458','07112529000146','Callface Copilot'),
  ('15459','53990538000157','Callface Copilot'),
  ('15460','16791310000101','Callface Copilot'),
  ('15461','16704833000173','Callface Copilot'),
  ('15462','08234659936','Callface Copilot'),
  ('15463','57173911000138','Callface AI - Starter'),
  ('15464','','Callface AI - Full'),
  ('15464','','Callface AI - Starter'),
  ('15465','55610242000199',NULL),
  ('15466','68403277000107',NULL),
  ('15467','45220700000120','Callface AI - Full'),
  ('15468','47317871000105','CALLFACE AI - (CONTRATO 12 MESES)'),
  ('15468','47317871000105','Callface AI - Starter'),
  ('15468','47317871000105','Callface Copilot'),
  ('15469','48670984000144','Callface AI - Starter'),
  ('15470','68403277000107',NULL),
  ('15512','61192736000101','Callface Copilot'),
  ('15513','58506313000104',NULL),
  ('15516','62109379000120',NULL),
  ('15517','48670984000144','Callface AI - Starter'),
  ('15518','24790860000134','COLD CALLING - 2025'),
  ('15519','35887687000103',NULL),
  ('15520','47317871000105','Callface AI - Full'),
  ('15521','28895940000105',NULL),
  ('15522','01150125000160','Callface AI - Full'),
  ('15523','30905811000100',NULL),
  ('15524','65868654000187','Callface Copilot'),
  ('15525','60927920000181',NULL),
  ('15526','86423390550',NULL),
  ('15527','48114589000185','Callface Copilot'),
  ('15528','27535631000161','Callface AI - Full'),
  ('15530','16262599762',NULL),
  ('15531','10426136000111','Callface AI - Starter'),
  ('15531','10426136000111','Callface Enterprise - 7000 minutos'),
  ('15534','16262599762',NULL),
  ('15535','58506313000104',NULL),
  ('15536','54164925000105','Callface AI White Label - Licença'),
  ('15537','32325470000111','Callface AI - Starter'),
  ('15539','16262599762',NULL),
  ('15540','62130522000165','Callface AI - Full'),
  ('15541','05016748969','Callface AI - Starter'),
  ('15542','65771026000189','Callface Copilot'),
  ('15543','35588263000148','Callface AI - Starter'),
  ('15544','','Callface Copilot'),
  ('15545','22950548000135','Callface AI - Full'),
  ('15545','22950548000135','Callface AI - Starter'),
  ('15547','27535631000161','Callface AI - Full'),
  ('15547','27535631000161','Callface Copilot'),
  ('15548','31319404000176',NULL),
  ('15549','38485375000161','Callface AI Business Enterprise'),
  ('15550','55780034000138',NULL),
  ('15551','41534125000189',NULL),
  ('15552','44958154000166',NULL),
  ('15553','53332877000146','Callface Copilot'),
  ('15554','40312878877',NULL),
  ('15555','64799798000166','Agente IA'),
  ('15555','64799798000166','Callface AI - Full'),
  ('15556','40972508000176','CALLFACE AI - COLD CALLING'),
  ('15557','40972508000176','CALLFACE AI - COLD CALLING'),
  ('15558','40972508000176','CALLFACE AI - COLD CALLING'),
  ('15559','37458616000110',NULL),
  ('15562','52002038000105','Callface AI - Business'),
  ('15563','44847459000109','Callface Copilot'),
  ('15564','07909170000132','Callface AI - Starter'),
  ('15565','47036699000103','Callface AI - Starter'),
  ('15566','35152606844','Agente IA'),
  ('15566','35152606844','Callface Copilot'),
  ('15567','41905335000136','Callface AI - Starter'),
  ('15567','41905335000136','Callface Copilot'),
  ('15568','36443271000169','Callface AI - Full'),
  ('15569','12600761000163',NULL),
  ('15570','56122580000144','Callface Copilot'),
  ('15571','13902810785',NULL),
  ('15572','43794194000157','Callface AI - Full'),
  ('15573','32825120000114',NULL),
  ('15575','','Callface AI - Full'),
  ('15576','08347821461',NULL),
  ('15577','29699561000102','Agente IA'),
  ('15577','29699561000102','Callface AI - Full'),
  ('15577','29699561000102','Callface Copilot'),
  ('15578','','Callface AI - Starter'),
  ('15579','65913050000105','Callface Copilot'),
  ('15580','35762100000130',NULL),
  ('15581','28664023000110','Callface AI - Full'),
  ('15582','24947528842','Callface AI - Full'),
  ('15583','62838038000195',NULL),
  ('15584','46316746000100','Callface AI - Starter'),
  ('15585','26338058000133','CALLFACE AI - ILIMITADO'),
  ('15586','36443271000169',NULL),
  ('15587','12600761000163',NULL),
  ('15588','10313782000172','Callface AI - Full'),
  ('15588','10313782000172','Callface AI - Starter'),
  ('15589','47020785000128','Callface Copilot'),
  ('15590','30203636000100','Callface AI - Full'),
  ('15591','46436397000160','Callface AI - Starter'),
  ('15592','49255575000144','Callface AI - Starter'),
  ('15593','88073319853','Callface AI - Starter'),
  ('15594','10416300000100','Callface AI - Starter'),
  ('15595','21155216000104','Callface Copilot - (Parceiro)'),
  ('15596','34346315852',NULL),
  ('15597','54137172000130','Callface Copilot'),
  ('15598','21155216000104','Callface Copilot - (Parceiro)'),
  ('15599','30433639000121','Callface Copilot'),
  ('15600','','Callface AI - Full'),
  ('15601','','Callface AI White Label - Licença');

-- ═══ 1. família por documento, a partir das notas ══════════════════════════
--
-- Por produto, nesta ordem:
--   1) nome EXATO (normalizado: sem acento, maiúsculo, só alfanumérico) em
--      `servicos_catalogo` ou `catalogo_mapeamentos_legacy` com família
--      != UNKNOWN  → família do catálogo, evidência firme;
--   2) o nome diz "WHITE LABEL"                     → WHITE_LABEL, firme;
--   3) o nome diz "LINHA SIP"/"PABX"/"RAMAL"/"CANAIS" → PABX, firme;
--   4) o nome começa com "CALLFACE" ou diz "COPILOT"/"AGENTE IA"
--                                                   → CALLFACE_AI, firme,
--      EXCETO se o nome também disser "PARCEIRO": revenda por parceiro pode
--      ser white label e a nota não resolve — então não é firme;
--   5) nada disso                                   → o produto não vota.
--      São 4 nomes, 8 linhas: COLD CALLING - 2025, PERFOMANCE CALL,
--      Negócios Profissionais, SETUP BROKER IA. Nenhum deles está no catálogo
--      com família, e o nome sozinho não decide. Não chutar é o ponto.
--
-- Por documento: WHITE_LABEL > CALLFACE_AI > PABX. Precedência e não "maior
-- valor" porque a nota não separa valor por item de forma confiável, e porque
-- White Label é a exceção que o Scott mandou não perder.
-- Documento cujos produtos nenhum votou (ou que só tem "Subscription
-- creation") cai em CALLFACE_AI com confidence PROBABLE — é o caso comum do
-- Stripe, como o Scott definiu, mas não é afirmação forte.
DROP TABLE IF EXISTS _nf_fam;
CREATE TEMP TABLE _nf_fam AS
WITH k AS (
  SELECT numero, nullif(doc,'') AS doc, produto,
         trim(regexp_replace(upper(unaccent(coalesce(produto,''))),'[^A-Z0-9]+',' ','g')) AS kn
    FROM _nf
), p AS (
  SELECT k.*,
         (SELECT sf FROM (
            SELECT service_family AS sf FROM servicos_catalogo
             WHERE service_family <> 'UNKNOWN'
               AND trim(regexp_replace(upper(unaccent(nome)),'[^A-Z0-9]+',' ','g')) = k.kn
            UNION ALL
            SELECT service_family FROM catalogo_mapeamentos_legacy
             WHERE service_family <> 'UNKNOWN'
               AND trim(regexp_replace(upper(unaccent(legacy_name)),'[^A-Z0-9]+',' ','g')) = k.kn
          ) z LIMIT 1) AS fam_catalogo
    FROM k
), v AS (
  SELECT p.*,
         CASE
           WHEN produto IS NULL          THEN NULL
           WHEN fam_catalogo IS NOT NULL THEN fam_catalogo
           WHEN kn LIKE '%WHITE LABEL%'  THEN 'WHITE_LABEL'
           WHEN kn LIKE '%LINHA SIP%' OR kn LIKE '%PABX%'
             OR kn LIKE '%RAMAL%'     OR kn LIKE '%CANAIS%' THEN 'PABX'
           WHEN kn LIKE 'CALLFACE%'   OR kn LIKE '%COPILOT%'
             OR kn LIKE '%AGENTE IA%' THEN 'CALLFACE_AI'
         END AS familia,
         (produto IS NOT NULL AND kn NOT LIKE '%PARCEIRO%') AS firme
    FROM p
), a AS (
  SELECT doc,
         bool_or(familia='WHITE_LABEL')            AS wl,
         bool_or(familia='CALLFACE_AI')            AS ai,
         bool_or(familia='PABX')                   AS pabx,
         bool_or(familia='WHITE_LABEL' AND firme)  AS wl_f,
         bool_or(familia='CALLFACE_AI' AND firme)  AS ai_f,
         bool_or(familia='PABX'        AND firme)  AS pabx_f,
         count(*) FILTER (WHERE produto IS NULL)                        AS notas_sem_produto,
         count(*) FILTER (WHERE produto IS NOT NULL AND familia IS NULL) AS itens_sem_familia,
         string_agg(DISTINCT produto, ' | ')        AS produtos,
         string_agg(DISTINCT numero,  ',')          AS notas
    FROM v WHERE doc IS NOT NULL GROUP BY doc
)
SELECT doc,
       CASE WHEN wl THEN 'WHITE_LABEL' WHEN ai THEN 'CALLFACE_AI'
            WHEN pabx THEN 'PABX' ELSE 'CALLFACE_AI' END AS familia,
       CASE WHEN wl   THEN (CASE WHEN wl_f   THEN 'CONFIRMED' ELSE 'PROBABLE' END)
            WHEN ai   THEN (CASE WHEN ai_f   THEN 'CONFIRMED' ELSE 'PROBABLE' END)
            WHEN pabx THEN (CASE WHEN pabx_f THEN 'CONFIRMED' ELSE 'PROBABLE' END)
            ELSE 'PROBABLE' END AS confidence,
       notas_sem_produto, itens_sem_familia, produtos, notas
  FROM a;

-- Família de TODO documento de setembro: com nota, a regra acima; sem nota,
-- PABX por ausência — explicitamente não confiável.
DROP TABLE IF EXISTS _set_fam;
CREATE TEMP TABLE _set_fam AS
SELECT s.doc,
       s.nome,
       s.valor,
       COALESCE(f.familia, 'PABX')          AS familia,
       COALESCE(f.confidence, 'UNRESOLVED') AS confidence,
       CASE WHEN f.doc IS NULL
            THEN jsonb_build_object('motivo','sem nota na exportacao parcial',
                                    'regra','planilha de setembro sem NFS-e correspondente => PABX',
                                    'competencia','2026-09')
            ELSE jsonb_build_object('motivo','produto descrito na NFS-e',
                                    'notas', f.notas,
                                    'produtos', COALESCE(f.produtos,'(so Subscription creation)'),
                                    'itens_sem_familia', f.itens_sem_familia,
                                    'competencia','2026-09')
       END AS evidencia
  FROM (SELECT doc, max(nome) nome, sum(valor) valor FROM tmp_set WHERE doc <> '' GROUP BY doc) s
  LEFT JOIN _nf_fam f ON f.doc = s.doc;

CREATE INDEX ON _set_fam (doc);

-- ═══ 2. criar cliente canônico para quem pagou em setembro, tem empresa ════
--        cadastrada e ainda não é cliente (medido: 69).
--
-- `cliente_desde`: `cliente_receita_mensal` é da frente A e está com 0 linhas,
-- então não dá para tirar a primeira competência dali. Cai na regra seguinte —
-- a data mais antiga QUE EXISTE para aquele documento, nesta ordem de fontes:
-- início de contrato, ganho de oportunidade, criação da empresa no CRM. Não é
-- data inventada: é a mais antiga disponível, e o `least()` escolhe sozinho.
-- Se nenhuma existisse, ficaria NULL (hoje as 69 têm pelo menos a terceira).
INSERT INTO clientes (organizacao_id, empresa_id, cliente_desde, status_financeiro, lifecycle_status)
SELECT e.organizacao_id,
       e.id,
       LEAST(
         (SELECT min(ct.inicio)::timestamptz   FROM contratos     ct WHERE ct.empresa_id = e.id),
         (SELECT min(o.ganho_at)               FROM oportunidades o  WHERE o.empresa_id  = e.id),
         e.created_at
       ),
       'ativo',
       'ATIVO_SETEMBRO_2026-09_CRIADO_NA_VIRADA'
  FROM empresas e
  JOIN _set_fam s ON s.doc = nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'')
 WHERE NOT EXISTS (SELECT 1 FROM clientes c WHERE c.empresa_id = e.id);

-- ═══ 3. status financeiro ══════════════════════════════════════════════════
-- Ativo = tem linha na planilha de setembro.
-- `lifecycle_status` só é escrito quando está NULL (é o caso de 275/275 no
-- dump) ou quando o valor é um marcador desta própria carga. Rótulo que
-- alguém tenha posto à mão não é sobrescrito.
UPDATE clientes c
   SET status_financeiro = 'ativo',
       lifecycle_status  = CASE
         WHEN c.lifecycle_status IS NULL
           OR c.lifecycle_status LIKE 'CHURN_PROVAVEL_SEM_FATURA_%' THEN 'ATIVO_SETEMBRO_2026-09'
         ELSE c.lifecycle_status END,
       updated_at        = now()
  FROM empresas e
 WHERE e.id = c.empresa_id
   AND nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'') IN (SELECT doc FROM _set_fam)
   AND (c.status_financeiro IS DISTINCT FROM 'ativo'
        OR c.lifecycle_status IS NULL
        OR c.lifecycle_status LIKE 'CHURN_PROVAVEL_SEM_FATURA_%');

-- Churn provável = NÃO tem linha na planilha de setembro. Inclui os clientes
-- sem empresa ou sem CNPJ (26 no dump): sem documento não há como casar com a
-- planilha, e "não consegui casar" não é "faturou".
-- Nada é apagado: só dois campos de texto que estavam 100% NULL no dump.
UPDATE clientes c
   SET status_financeiro = 'churned',
       lifecycle_status  = 'CHURN_PROVAVEL_SEM_FATURA_2026-09',
       updated_at        = now()
 WHERE NOT EXISTS (
         SELECT 1 FROM empresas e JOIN _set_fam s
                    ON s.doc = nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'')
          WHERE e.id = c.empresa_id)
   AND c.status_financeiro IS DISTINCT FROM 'churned';

-- ═══ 4. service_family em servicos_canonicos ═══════════════════════════════
--
-- 4a. Quem pagou em setembro, tem empresa cadastrada e NÃO tem nenhum serviço
--     canônico (medido: 19 documentos; os outros 38 sem serviço são os 38 sem
--     cadastro, que ficam de fora). Sem uma linha aqui esses clientes não têm
--     família nenhuma — o serviço nasce com a família da nota, ou PABX
--     UNRESOLVED quando não há nota.
--     `revenue_nature` fica UNKNOWN e `current_recurring_value` 0 de propósito:
--     a planilha diz QUANTO foi faturado no mês, não que isso seja recorrência.
--     O valor faturado fica em `evidence.faturado_setembro`, que é fato.
--     (O CHECK ck_servicos_canonicos_non_mrr_zero exige 0 fora de MRR.)
INSERT INTO servicos_canonicos (
  organizacao_id, empresa_id, canonical_key, service_family, revenue_nature,
  billing_source, commercial_lifecycle, billing_status, current_recurring_value,
  as_of_date, confidence, evidence)
SELECT e.organizacao_id,
       e.id,
       'LEDGER:2026-09:' || s.doc || ':' || s.familia || ':UNKNOWN',
       s.familia,
       'UNKNOWN',
       'LEDGER_SETEMBRO',
       'ACTIVE',
       'UNKNOWN',
       0,
       DATE '2026-09-30',
       s.confidence,
       s.evidencia
         || jsonb_build_object('action','CREATE',
                               'package','CARGA_VIRADA_3-faturamento_02',
                               'record_role','PROJECTED_LEDGER_SERVICE',
                               'faturado_setembro', s.valor,
                               'nome_planilha', s.nome)
  FROM _set_fam s
  JOIN empresas e ON nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'') = s.doc
 WHERE NOT EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id)
ON CONFLICT (organizacao_id, canonical_key) DO NOTHING;

-- 4b. PREENCHER o que está sem família. `service_family='UNKNOWN'` é ausência
--     de classificação, não uma classificação — aqui a nota decide.
--     (Medido no dump: 1 linha UNKNOWN em toda a tabela, e ela NÃO é de
--     pagante de setembro, então hoje isto é no-op. Fica porque a próxima
--     carga pode trazer outras.)
UPDATE servicos_canonicos sc
   SET service_family = s.familia,
       confidence     = s.confidence,
       evidence       = sc.evidence || jsonb_build_object('setembro_2026',
                          s.evidencia || jsonb_build_object('acao','PREENCHER_UNKNOWN')),
       updated_at     = now()
  FROM empresas e, _set_fam s
 WHERE e.id = sc.empresa_id
   AND s.doc = nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'')
   AND sc.service_family = 'UNKNOWN';

-- 4c. CONTRADIÇÃO com força igual: a nota diz uma família (CONFIRMED) e o
--     serviço já diz outra (CONFIRMED). Nenhuma das duas evidências vence a
--     outra, então NÃO se troca a família — marca-se `confidence='AMBIGUOUS'`
--     (valor já previsto pelo CHECK da tabela) e guarda-se as duas versões em
--     `evidence.setembro_2026`, para revisão humana.
--     Medido: 2 linhas / 2 documentos.
--       47724412000138 IPSILON — banco CALLFACE_AI (ledger de julho) × nota com
--         "LINHA SIP ADICIONAL" (PABX). O cliente pode ter as duas coisas.
--       64809618000180 VENDA NA VEIA — banco WHITE_LABEL SETUP (ledger de
--         julho) × nota com "Callface Copilot" (AI). Pode ser setup WL antigo
--         + assinatura AI nova.
UPDATE servicos_canonicos sc
   SET confidence = 'AMBIGUOUS',
       evidence   = sc.evidence || jsonb_build_object('setembro_2026',
                      s.evidencia || jsonb_build_object(
                        'acao','FLAG_AMBIGUOUS',
                        'familia_no_banco', sc.service_family,
                        'familia_pela_nota', s.familia,
                        'confidence_anterior', sc.confidence)),
       updated_at = now()
  FROM empresas e, _set_fam s
 WHERE e.id = sc.empresa_id
   AND s.doc = nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'')
   AND s.confidence = 'CONFIRMED'
   AND sc.confidence = 'CONFIRMED'
   AND sc.service_family <> 'UNKNOWN'
   AND sc.service_family <> s.familia;

-- ═══ 5. medição ════════════════════════════════════════════════════════════
-- Tudo que este arquivo afirma é contado aqui, no mesmo run. Nada é estimado.
CREATE OR REPLACE FUNCTION pg_temp.brl(numeric) RETURNS text LANGUAGE sql IMMUTABLE AS
$f$ SELECT translate(to_char(coalesce($1,0),'FM999G999G990D00'), ',.', '.,') $f$;

DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '── clientes ──';
  FOR r IN
              SELECT 1 o, 'total'                           m, count(*)::text v FROM clientes
    UNION ALL SELECT 2, 'ativos (planilha de setembro)',       count(*)::text FROM clientes WHERE status_financeiro='ativo'
    UNION ALL SELECT 3, 'dos quais criados nesta carga',       count(*)::text FROM clientes WHERE lifecycle_status='ATIVO_SETEMBRO_2026-09_CRIADO_NA_VIRADA'
    UNION ALL SELECT 4, 'criados sem cliente_desde (NULL)',    count(*)::text FROM clientes WHERE lifecycle_status='ATIVO_SETEMBRO_2026-09_CRIADO_NA_VIRADA' AND cliente_desde IS NULL
    UNION ALL SELECT 5, 'churn provável (sem fatura em set)',  count(*)::text FROM clientes WHERE status_financeiro='churned'
    UNION ALL SELECT 6, 'churn provável com serviço ACTIVE no Stripe',
                        count(DISTINCT c.id)::text FROM clientes c JOIN servicos_canonicos sc ON sc.empresa_id=c.empresa_id
                         WHERE c.status_financeiro='churned' AND sc.billing_status='ACTIVE'
    ORDER BY 1
  LOOP RAISE NOTICE '  % %', rpad(r.m,42), r.v; END LOOP;

  RAISE NOTICE '── família dos 324 documentos de setembro, pela REGRA DO SCOTT ──';
  RAISE NOTICE '   (nota => produto da nota; sem nota => PABX, não confiável)';
  FOR r IN
    SELECT familia||' / '||confidence AS m,
           lpad(count(*)::text,3)||' clientes · R$ '||lpad(pg_temp.brl(sum(valor)),12) AS v
      FROM _set_fam GROUP BY 1 ORDER BY 1
  LOOP RAISE NOTICE '  % %', rpad(r.m,42), r.v; END LOOP;

  RAISE NOTICE '── família dos clientes ATIVOS, por servicos_canonicos ──';
  RAISE NOTICE '   (dominante: WHITE_LABEL > CALLFACE_AI > PABX; valor = planilha de setembro)';
  FOR r IN
    WITH s AS (SELECT doc, sum(valor) valor FROM tmp_set WHERE doc<>'' GROUP BY 1),
         cli AS (SELECT c.empresa_id, nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'') doc
                   FROM clientes c JOIN empresas e ON e.id=c.empresa_id WHERE c.status_financeiro='ativo'),
         dom AS (SELECT cli.doc, sc.service_family f,
                        row_number() OVER (PARTITION BY cli.doc ORDER BY
                          CASE sc.service_family WHEN 'WHITE_LABEL' THEN 1 WHEN 'CALLFACE_AI' THEN 2
                                                 WHEN 'PABX' THEN 3 ELSE 4 END) rn
                   FROM cli JOIN servicos_canonicos sc ON sc.empresa_id=cli.empresa_id)
    SELECT coalesce(d.f,'(sem serviço canônico)') m,
           lpad(count(*)::text,3)||' clientes · R$ '||lpad(pg_temp.brl(sum(s.valor)),12) v
      FROM cli JOIN s ON s.doc=cli.doc LEFT JOIN dom d ON d.doc=cli.doc AND d.rn=1
     GROUP BY 1 ORDER BY 1
  LOOP RAISE NOTICE '  % %', rpad(r.m,42), r.v; END LOOP;

  RAISE NOTICE '── as duas leituras batem? (203 docs de setembro SEM nota) ──';
  FOR r IN
    WITH semnota AS (SELECT doc FROM _set_fam WHERE confidence='UNRESOLVED'),
         f AS (SELECT nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'') doc,
                      bool_or(sc.service_family='PABX') pabx, bool_or(sc.service_family='CALLFACE_AI') ai,
                      bool_or(sc.service_family='WHITE_LABEL') wl
                 FROM empresas e JOIN servicos_canonicos sc ON sc.empresa_id=e.id GROUP BY 1)
    SELECT CASE WHEN f.doc IS NULL      THEN 'sem serviço canônico (dos 38 sem cadastro)'
                WHEN f.wl               THEN 'banco diz WHITE_LABEL (a regra erraria)'
                WHEN f.pabx AND NOT f.ai THEN 'banco diz PABX (a regra acerta)'
                WHEN f.ai AND NOT f.pabx THEN 'banco diz CALLFACE_AI (a regra erraria)'
                ELSE 'banco diz PABX + CALLFACE_AI' END m,
           count(*)::text v
      FROM semnota n LEFT JOIN f ON f.doc=n.doc GROUP BY 1 ORDER BY 2 DESC
  LOOP RAISE NOTICE '  % %', rpad(r.m,42), r.v; END LOOP;

  RAISE NOTICE '── reconciliação com R$ 512.404,49 ──';
  FOR r IN
              SELECT 1 o, 'planilha de setembro (324 docs)' m, pg_temp.brl(sum(valor)) v FROM _set_fam
    UNION ALL SELECT 2, 'atribuído a cliente ativo (286)', pg_temp.brl(sum(s.valor))
                FROM _set_fam s WHERE EXISTS (SELECT 1 FROM empresas e JOIN clientes c ON c.empresa_id=e.id
                      WHERE nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'')=s.doc)
    UNION ALL SELECT 3, 'NÃO atribuído — 38 sem cadastro', pg_temp.brl(sum(s.valor))
                FROM _set_fam s WHERE NOT EXISTS (SELECT 1 FROM empresas e JOIN clientes c ON c.empresa_id=e.id
                      WHERE nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'')=s.doc)
    ORDER BY 1
  LOOP RAISE NOTICE '  % R$ %', rpad(r.m,42), lpad(r.v,12); END LOOP;

  RAISE NOTICE '── servicos_canonicos ──';
  FOR r IN
              SELECT 1 o, 'criados aqui (LEDGER_SETEMBRO)' m, count(*)::text v FROM servicos_canonicos WHERE billing_source='LEDGER_SETEMBRO'
    UNION ALL SELECT 2, 'destes, PABX por ausência de nota', count(*)::text FROM servicos_canonicos WHERE billing_source='LEDGER_SETEMBRO' AND confidence='UNRESOLVED'
    UNION ALL SELECT 3, 'marcados AMBIGUOUS p/ revisão',     count(*)::text FROM servicos_canonicos WHERE evidence->'setembro_2026'->>'acao'='FLAG_AMBIGUOUS'
    UNION ALL SELECT 4, 'service_family ainda UNKNOWN',      count(*)::text FROM servicos_canonicos WHERE service_family='UNKNOWN'
    UNION ALL SELECT 5, 'total na tabela',                   count(*)::text FROM servicos_canonicos
    ORDER BY 1
  LOOP RAISE NOTICE '  % %', rpad(r.m,42), r.v; END LOOP;
END $$;

-- Lista para revisão humana: os 38 documentos que faturaram em setembro e não
-- têm cadastro nenhum. Não são criados aqui de propósito (validação em curso).
\echo '── 38 documentos de setembro sem cadastro (ficaram de fora) ──'
SELECT s.doc, s.nome, pg_temp.brl(s.valor) AS valor_setembro
  FROM _set_fam s
 WHERE NOT EXISTS (SELECT 1 FROM empresas e
                    WHERE nullif(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'),'') = s.doc)
 ORDER BY s.valor DESC;
