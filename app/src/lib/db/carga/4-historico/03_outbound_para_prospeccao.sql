-- CARGA DA VIRADA · 4-historico · passo 03 — outbound sai de Pré-vendas e vai
-- para Prospecção. Roda DEPOIS da cadeia de migrations e dos backfills.
--
-- O QUE O SCOTT VIU: o Kanban de Pré-vendas da ONFACE abre com 62 cards em
-- "Novo". Medido aqui:
--
--     etapa canônica   inbound   outbound
--     novo                  25         37   ← os 62
--     em_contato           492         13
--     qualificacao         225          0
--     oportunidade         148          1
--     desqualificado       636         27
--     nutricao              55          0
--     qualificado           21          0
--
-- Os 37 são leads `origem='outbound'` que em produção estavam parados na
-- coluna "Outbound" do board legado (`sdrBoardColumn`: sdr_status='pending' +
-- origem='outbound' + nenhum negócio) — nunca entraram no funil de pré-vendas.
-- O de/para do backfill 06b manda a coluna `outbound` para a etapa `novo`, e
-- o board canônico, que lê `aquisicoes` sem olhar o estado de prospecção,
-- misturava os dois.
--
-- ONDE ESTÁ O CONSERTO, E POR QUE NÃO É AQUI:
--
-- O de/para do 06b NÃO é a causa. Quando o prospect for pré-qualificado ele
-- entra em Pré-vendas exatamente na etapa `novo` (`preQualificar()`: "Entrou
-- em Pré-vendas na etapa Novo"), então deixar a etapa pré-gravada está certo.
-- O que faltava era o board saber que Prospecção não é Pré-vendas. Isso foi
-- para `packages/domain/acquisition/queries/board-pre-vendas.ts`, em
-- `somenteDePreVendas()`: a aquisição só entra no board quando o lead legado
-- tem `prospeccao_estado IS NULL` (nunca foi prospect — todo o inbound) ou
-- `= 'pre_qualificado'` (a única saída do outbound que desemboca aqui, por
-- definição do próprio módulo em `lib/vendas/prospeccao.ts`).
--
-- Vale em runtime também: hoje um prospect adicionado pela tela de Prospecção
-- abre aquisição e vira card de "Novo" em Pré-vendas no mesmo instante.
--
-- Não usamos `aquisicoes.closed_at` para tirar o card do board — seria mentira
-- (o processo de aquisição do prospect está ABERTO, só não está em pré-vendas)
-- e quebraria `preQualificar`: `registrarEntrada` só reaproveita aquisição
-- aberta, então uma fechada faria a pré-qualificação tentar criar a segunda e
-- bater em `uq_aquisicoes_lead_legado`.
--
-- O QUE ESTE ARQUIVO CONSERTA ENTÃO: as linhas já gravadas.
--
-- A migration 0048 semeou `prospeccao_estado='novo'` para TODO lead com
-- origem='outbound' (78 no banco), sem olhar se ele já tinha saído do outbound.
-- Em produção Prospecção não existia: esse 'novo' é chute da migration, não
-- fato observado. Com o recorte novo do board, os 41 que JÁ estavam sendo
-- trabalhados em pré-vendas sumiriam das colunas em que produção os mostrava.
--
-- Este UPDATE devolve a eles o estado que diz "saiu do outbound, está em
-- Pré-vendas": `pre_qualificado`. O critério é o MESMO `sdrBoardColumn` do
-- board legado — não é similaridade nem adivinhação: se a coluna legada já não
-- era "Outbound", o lead já não estava em prospecção.
--
-- MEDIDO (banco callface_crm_ensaio_virada, 05/10/2026):
--   leads origem='outbound' ............................. 78 (todos tipo='lead')
--   ainda na coluna "Outbound" do legado (ficam 'novo') .. 37
--   já fora dela (viram 'pre_qualificado') ............... 41
--       sdr_status='disqualified', sem negócio ........... 26
--       sdr_status='contacted',    sem negócio ........... 13
--       sdr_status='pending',      COM negócio ...........  1
--       sdr_status='qualified',    COM negócio ...........  1
--   inscrições de cadência ativas entre eles .............  0
--
-- IDEMPOTENTE: o WHERE exige `prospeccao_estado='novo'` e `pre_qualificado=false`,
-- que é a assinatura exata do que a 0048 semeou. Segunda execução não acha nada,
-- e trabalho humano feito depois na tela (pré-qualificar, descartar, cadência)
-- nunca é revertido.

UPDATE leads l
   SET prospeccao_estado = 'pre_qualificado',
       -- `updated_at` preservado: carga não é toque do operador, e bumpar a
       -- coluna faz o board inteiro dizer "agora mesmo".
       updated_at = l.updated_at
 WHERE lower(trim(COALESCE(l.origem, ''))) = 'outbound'
   AND l.prospeccao_estado = 'novo'
   AND l.pre_qualificado = false
   AND l.prospeccao_descartado_em IS NULL
   -- NÃO está mais na coluna "Outbound" do board legado, que é
   -- `sdr_status IN (NULL,'pending')` E nenhum negócio ligado.
   AND NOT (
     COALESCE(l.sdr_status, 'pending') = 'pending'
     AND NOT EXISTS (SELECT 1 FROM negocio_leads nl WHERE nl.lead_id = l.id)
   );

-- O QUE FICA PARA REVISÃO HUMANA (não foi inventado nada por eles):
--
-- Os 26 com `sdr_status='disqualified'`. O dado não distingue "descartado
-- ainda no outbound" (que em ONFACE seria `prospeccao_estado='descartado'`, e
-- some do Kanban) de "desqualificado depois de entrar em pré-vendas" (que é
-- card na coluna Desqualificado). Produção os mostrava na coluna Desqualificado
-- do board legado, então `pre_qualificado` é a opção que PRESERVA o que a tela
-- de produção mostrava; `descartado` seria uma decisão de negócio nova.
-- Conferir com:
--   SELECT id, nome, empresa, updated_at FROM leads
--    WHERE lower(trim(origem))='outbound' AND sdr_status='disqualified';
