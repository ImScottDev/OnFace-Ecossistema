-- CARGA DA VIRADA · FRENTE 3 — varredura de incoerência nas demais telas.
-- Idempotente. NÃO altera nenhuma tabela de domínio: só MARCA para revisão
-- (mesmo padrão de 6-limpeza/01) e deixa as medições registradas no arquivo.
-- Reverter é `DELETE FROM _carga_registros_suspeitos WHERE motivo LIKE 'revisar_cliente_ativo_fora%';`
--
-- Escopo: /contatos, /empresas, /clientes, /clientes/360, /clientes/cs,
-- /clientes/onboarding, /clientes/implantacao, /tarefas, /inicio, /relatorios.
-- Pipeline e Pré-vendas têm dono (01_*, 02_*, 03_ativo_* desta mesma pasta) e
-- não são tocados aqui.
--
-- Medido em 05/10/2026 contra callface_crm_ensaio_virada, org Callface
-- (320a9052-dd43-4edb-9b74-34be53c5c419), competência de receita 2026-09.
--
-- ===================== O QUE A VARREDURA ACHOU ==========================
--
-- [1] /clientes (Carteira) mostrava 216 clientes e R$ 393.546,53 — a planilha
--     de setembro fecha em R$ 512.404,49. CORRIGIDO EM CÓDIGO, não aqui:
--     lib/clientes/carteira-desenho.ts. A CTE `universo` declarava
--     "tem serviço de portfólio OU faturou no último mês", e os dois JOINs
--     seguintes (servicos_agg, familia_dominante) eram INNER — o segundo
--     filtrando `portfolio_included = true`. O OR era anulado em silêncio.
--       70 empresas faturam e não têm serviço de portfólio . R$  98.044,96
--       56 empresas têm portfólio e não faturaram no mês ... R$       0,00
--     Depois do LEFT JOIN: 342 clientes, R$ 491.591,49.
--     Spec Bloco 05 §4 ("Cliente = propriedade relacional da Empresa") e §7
--     (relacionamento DERIVADO dos fatos: serviço ativo OU faturamento).
--
-- [2] Restam R$ 20.813,00 em 38 linhas de `cliente_receita_mensal` com
--     `empresa_id` NULO na competência 2026-09. NÃO é bug de consulta: é
--     receita sem dono no cadastro. Verificado: 0 das 38 casam por CNPJ
--     normalizado com `empresas`; 6 casam só por nome exato (R$ 11.883,10),
--     evidência fraca demais para atribuir R$ 9.000 (TX CORRETORA) a uma
--     empresa no painel do Scott. FICA PARA REVISÃO HUMANA, não é chutado.
--     Essas 38 linhas não podem ser marcadas em `_carga_registros_suspeitos`:
--     o CHECK de `entidade` só aceita lead/pessoa/contato/empresa/
--     oportunidade/aquisicao, e criar valor novo é mexer em schema na véspera.
--     O número fica aqui e no relatório da frente.
--
-- [3] "Clientes ativos" tem TRÊS números no produto, e os três estão certos
--     para recortes diferentes — o que está errado é chamarem-se igual:
--       /inicio ............. 389  (catálogo `clientes_ativos`: empresa com
--                                   serviço ACTIVE, Módulo 11)
--       /clientes/cs ........ 344  (linhas da tabela `clientes`)
--       /clientes (carteira)  342  (serviço de portfólio OU faturou no mês)
--     O rótulo do /inicio prometia "com serviço ativo no portfólio", que é um
--     QUARTO recorte (272) e não é o que a métrica calcula. Rótulo corrigido
--     em lib/analytics/onface-visao-geral.ts. Qual dos três vira "o" número
--     de clientes é DECISÃO DO SCOTT, não inferência desta frente.
--
-- [4] /inicio contava negócio aberto por `negocios.status` (legado) enquanto
--     /pipeline conta por `negocios.etapa` (canônico). A spec Bloco 02 §9
--     define as seis etapas e §17 manda "evitar perpetuar motivos como
--     statuses diferentes" — `status` é exatamente isso (outra_data,
--     sem_retorno, trava_negociacao, trava_assinatura, ativo, no_show).
--     Com o de-para desta pasta aplicado, as duas leituras divergem em 340:
--       Operações ativas por `status` ... 499
--       Operações ativas por `etapa` .... 159
--     Trocado para `etapa` em: analytics/onface-inicio.ts (3 consultas),
--     analytics/inicio.ts, analytics/onface-atividades.ts, cs/tela-cs.ts,
--     cs/fila.ts. O card "Etapa" do /inicio também escrevia o status cru
--     ("trava_assinatura", "outra_data"): passou a usar ROTULO_ETAPA_PIPELINE,
--     a mesma fonte de rótulo do Pipeline.
--     NOTA: os 157 negócios que `03_ativo_evidencia_de_contrato.sql` deixou
--     com `etapa` NULA (marcados `revisar_ativo_duplica_ganho_existente`)
--     ficam FORA de "operações ativas" — NOT IN já exclui NULL. É o correto:
--     negócio sem etapa não está no pipeline, está na fila de revisão.
--
-- [5] /contatos e /empresas — a aba Empresas é um SUBPRODUTO da fatia de 500
--     pessoas (ContatosProto agrupa as linhas de pessoa por empresa), e não
--     uma consulta sobre `empresas`. Consequência medida:
--       empresas na base ............................. 2.272
--       empresas visíveis na aba Empresas .............. 280  (12%)
--       empresas sem NENHUMA pessoa e sem lead ......... 386  (nunca aparecem)
--       clientes ativos ................................ 389
--       clientes ativos visíveis na aba Empresas ........ 20  (5,1%)
--     Isso contraria o Bloco 05 §2 ("Empresa pode existir sem Pessoa" →
--     "Empresa persiste e aparece no diretório") e o critério de aceite §28.
--     NÃO corrigido aqui de propósito: a correção é dar consulta própria à
--     aba Empresas, e isso passa pelo adaptador do handoff (arquivo gerado) na
--     véspera da virada. As 137 empresas que são CLIENTE ATIVO e estão fora do
--     diretório ficam marcadas abaixo, que é o subconjunto que dói.
--
-- [6] /clientes/cs — a jornada nasceu vazia, confirmado: cs_marcos 0,
--     cs_health_snapshots 0, cs_riscos 0, cs_renovacoes 0, cs_cancelamentos 0,
--     clientes.jornada_iniciada_em 0 de 344. A coluna Saúde da carteira cai
--     100% no fallback 70 e o CsProto já força 70/0 na sua ponta, então as
--     duas telas ao menos não se contradizem — mas nenhuma das duas está
--     dizendo algo sobre saúde. Gerar marco ou score aqui seria inventar
--     dado: fica reportado, não preenchido.
--
-- [7] /clientes/onboarding e /clientes/implantacao — 40 fulfillments (30
--     COMPLETED, 1 CANCELED, 9 em curso) para 618 ganhos NÃO é defeito desta
--     carga: está declarado no PLANO-DE-CARGA §2 ("servicos_catalogo.
--     creates_fulfillment = false — fulfillment automático é capacidade
--     nova"). As duas rotas são redirect para /pos-vendas.
--
-- [8] /tarefas — 463 tarefas, 314 abertas, 311 atrasadas, 1 vence hoje,
--     0 sem responsável, origem 100% MANUAL. Números batem com o legado; o
--     "311 atrasadas" é dívida real da operação, não erro de carga.
--
-- [9] /inicio, bloco Atendimento — "470 conversas · 7.502 e-mails". Os 7.502
--     são TODO e-mail de entrada com `lido = false` desde sempre; é ruído de
--     importação, não fila de trabalho. Idem as conversas: as 1.906 linhas de
--     `contatos` estão TODAS com status 'open' (ninguém nunca fechou uma).
--     Não mexido: o recorte certo (janela de tempo, ou fechar o legado em
--     massa) é decisão de operação, não de carga.
--
-- [10] /inicio, faixa da jornada — "Pré-vendas" mostrava 4.080, que é a BASE
--     INTEIRA de contatos. A consulta lia `leads.status = 'novo'`, e
--     `leads.status` é coluna morta: vale 'novo' nas 4.080 linhas. O estágio
--     canônico é `estagio_pre_vendas` (Bloco 01 §6-§9): 1.642 novo + 39
--     qualificado = 1.681 de fato em Pré-vendas; 2.399 sem estágio não estão
--     no funil (2.096 são `tipo = 'contato'`). Trocado em onface-inicio.ts.
--
-- [11] BLOQUEIO PARA O DONO DO PIPELINE — `negocios` e `oportunidades`
--     discordam em 157 registros, e as telas se dividem entre as duas fontes:
--       oportunidades.etapa = 'ganho' ........ 775  (/pipeline, /relatorios)
--       negocios.etapa      = 'ganho' ........ 618  (/inicio, /tarefas, /cs)
--       negocios.etapa IS NULL ............... 157  (exatamente a diferença)
--     Os 157 são os que `03_ativo_evidencia_de_contrato.sql` marcou
--     `revisar_ativo_duplica_ganho_existente`: o lado `negocios` ficou NULO
--     esperando revisão (correto), mas o lado `oportunidades` ficou GANHO com
--     `ganho_at` preenchido. Resultado: duplicatas declaradas contam como
--     venda ganha no board e no relatório — R$ 252.456,55 de valor de
--     oportunidade, R$ 154.539,88 de `mrr_fechado`, com `ganho_at` entre
--     02/07/2026 e 02/10/2026 (1 cai no mês corrente e entra na meta).
--     NÃO corrigido aqui: a decisão sobre esses 157 é da frente do Pipeline.
--
-- [12] /relatorios e /pipeline mostram um pipeline de R$ 10.001,20 em 150
--     oportunidades abertas (R$ 67 de ticket médio): 144 das 150 têm
--     `valor_total` zerado. 45 delas TÊM proposta, somando R$ 203.628,35
--     (R$ 131.478,45 recorrente). Spec Bloco 02 §14 manda o card priorizar o
--     "Valor da oportunidade". Também é da frente do Pipeline — só fica
--     registrado porque aparece no /inicio ("negócios sem próxima ação") e
--     em todo indicador de forecast.
--
-- =========================================================================

BEGIN;

-- [5] Cliente ativo que não existe no diretório de Contatos & Empresas.
-- Empresa com serviço ACTIVE, sem nenhuma pessoa e sem nenhum lead: não há
-- linha que a faça aparecer na aba Empresas, que é montada a partir de
-- pessoas. Marcar (nunca criar pessoa fantasma — Bloco 05 §29 proíbe tratar
-- Empresa e Pessoa como a mesma coisa).
INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe, detectado_em)
SELECT 'empresa', e.id, 'revisar_cliente_ativo_fora_do_diretorio',
       'Cliente ativo sem nenhuma Pessoa e sem nenhum Lead: invisível na aba '
       || 'Empresas de /contatos, que é derivada das pessoas. Bloco 05 §2/§28.',
       now()
  FROM empresas e
 WHERE e.organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
   AND EXISTS (SELECT 1 FROM servicos_canonicos s
                WHERE s.empresa_id = e.id AND s.commercial_lifecycle = 'ACTIVE')
   AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.empresa_id = e.id)
   AND NOT EXISTS (SELECT 1 FROM leads   l WHERE l.empresa_id = e.id)
ON CONFLICT (entidade, entidade_id, motivo) DO NOTHING;

COMMIT;

-- ============================ VERIFICAÇÃO ===============================
-- Roda sozinho; nenhum número abaixo é afirmado sem sair do banco.

\echo '--- [5] clientes ativos fora do diretorio (esperado 137) ---'
SELECT count(*) AS marcados
  FROM _carga_registros_suspeitos
 WHERE motivo = 'revisar_cliente_ativo_fora_do_diretorio';

\echo '--- [1] /clientes: antes (INNER) x depois (LEFT) ---'
WITH uc AS (
  SELECT max(competencia) AS c FROM cliente_receita_mensal
   WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'),
sa AS (
  SELECT r.empresa_id, SUM(r.valor) AS mrr FROM cliente_receita_mensal r, uc
   WHERE r.organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
     AND r.competencia = uc.c AND r.empresa_id IS NOT NULL GROUP BY 1),
fd AS (SELECT DISTINCT empresa_id FROM servicos_canonicos
        WHERE portfolio_included = true AND empresa_id IS NOT NULL),
univ AS (
  SELECT e.id FROM empresas e
   WHERE e.organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
     AND (EXISTS (SELECT 1 FROM servicos_canonicos s
                   WHERE s.empresa_id = e.id AND s.portfolio_included = true)
          OR EXISTS (SELECT 1 FROM sa WHERE sa.empresa_id = e.id)))
SELECT 'antes (INNER)' AS leitura,
       (SELECT count(*) FROM univ u JOIN sa ON sa.empresa_id = u.id
                                    JOIN fd ON fd.empresa_id = u.id) AS clientes,
       (SELECT round(COALESCE(sum(sa.mrr), 0), 2) FROM univ u
          JOIN sa ON sa.empresa_id = u.id JOIN fd ON fd.empresa_id = u.id) AS receita
UNION ALL
SELECT 'depois (LEFT)',
       (SELECT count(*) FROM univ),
       (SELECT round(COALESCE(sum(sa.mrr), 0), 2) FROM univ u LEFT JOIN sa ON sa.empresa_id = u.id)
UNION ALL
SELECT 'planilha 2026-09', NULL,
       (SELECT round(sum(valor), 2) FROM cliente_receita_mensal
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND competencia = '2026-09-01')
UNION ALL
SELECT '[2] sem empresa_id',
       (SELECT count(*)::bigint FROM cliente_receita_mensal
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND competencia = '2026-09-01' AND empresa_id IS NULL),
       (SELECT round(COALESCE(sum(valor), 0), 2) FROM cliente_receita_mensal
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND competencia = '2026-09-01' AND empresa_id IS NULL);

\echo '--- [4] operacoes ativas: status (legado) x etapa (canonico) ---'
SELECT 'por status (antes)' AS leitura,
       (SELECT count(*) FROM negocios
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND status NOT IN ('ganho','perdido','sem_retorno'))
     + (SELECT count(*) FROM fulfillments
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND status NOT IN ('COMPLETED','CANCELED')) AS total
UNION ALL
SELECT 'por etapa (depois)',
       (SELECT count(*) FROM negocios
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND etapa NOT IN ('ganho','perdido'))
     + (SELECT count(*) FROM fulfillments
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND status NOT IN ('COMPLETED','CANCELED'))
UNION ALL
SELECT 'negocios sem etapa (revisao)',
       (SELECT count(*) FROM negocios
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419' AND etapa IS NULL);

\echo '--- [5] cobertura do diretorio Contatos & Empresas ---'
WITH ident AS (
  SELECT COALESCE(p.empresa_id, l.empresa_id) AS emp, l.id AS lead_id
    FROM pessoas p LEFT JOIN leads l ON l.id = p.lead_id_legado
   WHERE p.organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
  UNION ALL
  SELECT l.empresa_id, l.id FROM leads l
   WHERE l.organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
     AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)),
ult AS (SELECT a.lead_id, max(a.created_at) AS u FROM atividades a
         WHERE a.lead_id IS NOT NULL GROUP BY 1),
fatia AS (SELECT i.emp FROM ident i LEFT JOIN ult ul ON ul.lead_id = i.lead_id
           ORDER BY ul.u DESC NULLS LAST LIMIT 500),
ativos AS (SELECT DISTINCT empresa_id FROM servicos_canonicos
            WHERE commercial_lifecycle = 'ACTIVE' AND empresa_id IS NOT NULL)
SELECT (SELECT count(*) FROM empresas
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419') AS empresas_na_base,
       (SELECT count(DISTINCT emp) FROM fatia WHERE emp IS NOT NULL)     AS visiveis_na_aba,
       (SELECT count(*) FROM ativos)                                     AS clientes_ativos,
       (SELECT count(*) FROM ativos a
         WHERE a.empresa_id IN (SELECT emp FROM fatia WHERE emp IS NOT NULL)) AS clientes_ativos_visiveis;

\echo '--- [10] faixa Pre-vendas do Inicio: status (morto) x estagio canonico ---'
SELECT count(*) FILTER (WHERE status = 'novo')                                        AS por_status_morto,
       count(*) FILTER (WHERE estagio_pre_vendas
                        IN ('novo','em_contato','qualificacao','qualificado'))        AS por_estagio_canonico,
       count(*) FILTER (WHERE estagio_pre_vendas IS NULL)                             AS fora_de_pre_vendas
  FROM leads WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419';

\echo '--- [11] negocios x oportunidades: as duas fontes discordam ---'
SELECT (SELECT count(*) FROM oportunidades WHERE etapa = 'ganho')      AS oport_ganho,
       (SELECT count(*) FROM negocios      WHERE etapa = 'ganho')      AS negocio_ganho,
       (SELECT count(*) FROM negocios      WHERE etapa IS NULL)        AS negocio_sem_etapa,
       (SELECT count(*) FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
         WHERE COALESCE(n.etapa,'~') <> COALESCE(o.etapa,'~'))         AS pares_divergentes,
       (SELECT round(COALESCE(sum(o.valor), 0), 2) FROM negocios n
          JOIN oportunidades o ON o.negocio_id_legado = n.id
         WHERE n.etapa IS NULL AND o.etapa = 'ganho')                  AS valor_duplicado_como_ganho;

\echo '--- [12] valor do pipeline aberto ---'
SELECT count(*)                                                        AS abertas,
       count(*) FILTER (WHERE COALESCE(valor_total, 0) = 0)            AS com_valor_zero,
       round(COALESCE(sum(valor_total), 0), 2)                         AS valor_na_tela,
       (SELECT round(COALESCE(sum(p.total_geral), 0), 2) FROM (
          SELECT DISTINCT ON (negocio_id) negocio_id, total_geral FROM propostas
           WHERE negocio_id IN (SELECT id FROM negocios
                                 WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
                                   AND etapa IN ('entrada','diagnostico','proposta','negociacao'))
           ORDER BY negocio_id, versao DESC NULLS LAST, created_at DESC) p) AS valor_das_propostas
  FROM negocios
 WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
   AND etapa IN ('entrada','diagnostico','proposta','negociacao');

\echo '--- [6] modulo de CS: a jornada nasceu vazia ---'
SELECT (SELECT count(*) FROM cs_marcos)            AS marcos,
       (SELECT count(*) FROM cs_health_snapshots)  AS health,
       (SELECT count(*) FROM cs_riscos)            AS riscos,
       (SELECT count(*) FROM cs_renovacoes)        AS renovacoes,
       (SELECT count(*) FROM cs_cancelamentos)     AS cancelamentos,
       (SELECT count(*) FROM clientes
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419') AS clientes,
       (SELECT count(*) FROM clientes
         WHERE organizacao_id = '320a9052-dd43-4edb-9b74-34be53c5c419'
           AND jornada_iniciada_em IS NOT NULL) AS com_jornada;
