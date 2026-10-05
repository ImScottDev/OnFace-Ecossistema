-- CARGA DA VIRADA · pipeline, passo 04 — Pré-vendas auditado contra a SpecDrive.
--
-- POR QUE ESTE ARQUIVO EXISTE
--
-- O board de Pré-vendas foi montado sem a SpecDrive aberta. O backfill `06b`
-- traduziu `sdr_status` + estado do negócio para as sete etapas canônicas e
-- acertou a COLUNA de cada card. Mas etapa é só a posição de hoje: a spec
-- Bloco 01 cobra FATOS que têm de existir ao lado da coluna, e eles vieram
-- todos vazios do dump de produção.
--
-- A armadilha é a mesma já documentada no vault em
-- 02_PROJETOS/Callface/ONFACE/execucao/2026-09-23-divergencia-prevendas-cutover.md:
-- "em produção NÃO existem as colunas `qualificado`, `qualificado_em`,
-- `desqualificado_em`, `nutricao_*` nem `estagio_pre_vendas`. O backfill
-- `06-aquisicao.ts` deriva todo o estado delas via `SELECT l.*`; sobre dump de
-- prod elas voltam `undefined` sem lançar erro." O `06b` consertou a ETAPA e
-- parou aí — os fatos continuaram zerados. Medido agora, em 4.080 aquisições:
--
--   leads.qualificado            0   leads.qualificado_em         0
--   leads.desqualificacao_motivo 0   leads.desqualificado_em      0
--   leads.nutricao_motivo        0   leads.nutrido_em             0
--
-- AUDITORIA, REGRA POR REGRA (medida em 05/10/2026, banco do ensaio)
--
--   §6  NOVO — campos de entrada .................. PARCIAL (ver nota no fim)
--   §7  EM CONTATO — movimentação registrada ...... PASSOU (status_changes)
--   §8  QUALIFICAÇÃO — dados estruturados ......... PARCIAL (ver nota no fim)
--   §9  QUALIFICADO — etapa existe e é parável .... PASSOU
--   §10 o FATO sobrevive ao estágio ............... FALHOU → corrigido aqui
--   §11 OPORTUNIDADE — handoff explícito .......... PASSOU
--   §12 estágio espelho ........................... PASSOU
--   §13 NUTRIÇÃO com motivo ....................... FALHOU → corrigido aqui
--   §14 DESQUALIFICADO com motivo ................. FALHOU → corrigido aqui
--   §15 NO-SHOW — lead volta a QUALIFICADO ........ PASSOU (passo anterior)
--   §16 origem e atribuição ....................... PARCIAL (ver nota no fim)
--   §17 histórico e eventos ....................... FALHOU → corrigido aqui
--   §26 SLA — tempo na etapa mensurável ........... PASSOU
--   §29 proibições ................................ ver checklist no fim
--
-- IDEMPOTENTE: cada UPDATE é filtrado pelo estado de origem (o fato AUSENTE),
-- e cada INSERT de evento tem NOT EXISTS pelo par (aquisição, tipo).

BEGIN;

-- ===========================================================================
-- §10 — "O fato Qualificado precisa sobreviver ao estágio atual"
--
--   "Não depender apenas de `stage = QUALIFICADO`. Porque amanhã ele poderá
--   estar Oportunidade / Proposta / Negociação / Cliente, e ainda assim
--   precisamos saber que ELE FOI QUALIFICADO em determinado momento."
--
--   E §29: "❌ Qualificação depender de uma tag removível."
--
-- MEDIDO ANTES: `qualificado = true` em 60 de 4.080 — exatamente, e só, os que
-- estão parados na coluna QUALIFICADO. Ou seja: hoje o fato É a coluna. O lead
-- que avançou para Oportunidade perdeu o registro de ter sido qualificado, que
-- é literalmente o caso que a §10 escreve para proibir.
--
-- A EVIDÊNCIA que vale, e por que só estas duas:
--   a) `leads.sdr_status = 'qualified'` — o SDR marcou. 276 leads.
--   b) aquisição na etapa `oportunidade` ou `qualificado` — §11 diz que mover
--      de Qualificado para Oportunidade "não é apenas alteração de status, ela
--      executa CRIAR OPORTUNIDADE". Estar lá prova que passou por qualificado.
--   União: 603 aquisições.
--
-- O que NÃO serve como evidência, e por isso ficou de fora: "o lead tem
-- negócio" (1.131). A §29 do Bloco 01 proíbe "Form inbound criar oportunidade
-- automaticamente" justamente porque o legado FAZIA isso — 714 aquisições em
-- NOVO têm negócio. Negócio criado por formulário não prova qualificação, e
-- usá-lo infla o funil com 528 qualificações que nunca aconteceram.
--
-- A DATA. §10 pede `qualificadoEm`. Para quem virou oportunidade, o handoff é
-- o próprio `min(negocios.created_at)` do lead — data real, e teto correto: a
-- qualificação aconteceu nele ou antes. 522 dos 543 têm. Os outros 21 recebem
-- o FATO sem data: perder o fato é o que a spec proíbe; a data ausente fica
-- declarada em `_carga_perdas_declaradas` em vez de ser inventada.
-- ===========================================================================
WITH evidencia AS (
  SELECT a.id,
         (SELECT min(n.created_at) FROM negocios n WHERE n.lead_id = a.lead_legado_id) AS handoff_em
    FROM aquisicoes a
    JOIN pipeline_etapas pe ON pe.id = a.etapa_id
    LEFT JOIN leads l ON l.id = a.lead_legado_id
   WHERE a.qualificado IS NOT TRUE
     AND (l.sdr_status = 'qualified' OR pe.codigo IN ('qualificado', 'oportunidade'))
)
UPDATE aquisicoes a
   SET qualificado    = true,
       qualificado_em = e.handoff_em,
       updated_at     = now()
  FROM evidencia e
 WHERE a.id = e.id;

INSERT INTO _carga_perdas_declaradas (tabela, linhas, motivo)
SELECT 'aquisicoes (7-pipeline/04)', count(*),
       'fato qualificado=true gravado SEM qualificado_em: o lead nao gerou negocio, e o legado nao guarda data de qualificacao (leads.qualificado_em veio vazio do dump). Fato preservado, data declarada ausente — SPEC Bloco 01 §10'
  FROM aquisicoes WHERE qualificado AND qualificado_em IS NULL
HAVING count(*) > 0
ON CONFLICT (tabela, motivo) DO UPDATE SET linhas = EXCLUDED.linhas, declarado_em = now();

-- ===========================================================================
-- §13 — "Nutrição não pode ser uma lixeira elegante. Ao mover para Nutrição,
--        abrir modal. Motivos estruturados iniciais: Sem resposta / Sem
--        interesse no momento / ... / Retomar em outra data."
--        §29: "❌ Nutrição sem motivo."
--
-- MEDIDO ANTES: 52 em nutrição, TODAS com `nutricao_status = 'estagnado_legado'`.
-- Isso não é motivo, é carimbo de migração — a spec pede o porquê.
--
-- O porquê EXISTE no legado, em `sdr_status`, e cai um-para-um na lista da §13:
--   sdr_sem_retorno (47) → "Sem resposta"
--   sdr_sem_interesse (3) → "Sem interesse no momento"
--   sdr_retomar_depois (2) → "Retomar em outra data"
--
-- `retomar_em` fica NULL: a §13 diz que "dependendo do motivo, Retomar em pode
-- se tornar obrigatório", mas o legado não guarda essa data. Regra do Kauã —
-- sem evidência, não chutar. Declarado abaixo.
-- ===========================================================================
UPDATE aquisicoes a
   SET nutricao_status = CASE l.sdr_status
         WHEN 'sdr_sem_retorno'    THEN 'sem_resposta'
         WHEN 'sdr_sem_interesse'  THEN 'sem_interesse_no_momento'
         WHEN 'sdr_retomar_depois' THEN 'retomar_em_outra_data'
       END,
       updated_at = now()
  FROM leads l, pipeline_etapas pe
 WHERE l.id = a.lead_legado_id
   AND pe.id = a.etapa_id AND pe.codigo = 'nutricao'
   AND l.sdr_status IN ('sdr_sem_retorno', 'sdr_sem_interesse', 'sdr_retomar_depois')
   AND COALESCE(a.nutricao_status, '') IN ('', 'estagnado_legado');

-- Carimbo de migracao que sobrou em quem JA SAIU da nutricao (o no-show
-- devolveu 3 leads para Qualificado). Estado de nutricao em quem nao esta em
-- nutricao e a "segunda verdade" que a §29 do Bloco 02 chama de proibida.
UPDATE aquisicoes a
   SET nutricao_status = NULL, retomar_em = NULL, updated_at = now()
  FROM pipeline_etapas pe
 WHERE pe.id = a.etapa_id AND pe.codigo <> 'nutricao'
   AND a.nutricao_status IS NOT NULL;

INSERT INTO _carga_perdas_declaradas (tabela, linhas, motivo)
SELECT 'aquisicoes/nutricao (7-pipeline/04)', count(*),
       'nutricao com motivo mas sem retomar_em: o legado nao guarda a data de retomada (leads.nutricao_retomar_em veio vazia do dump) — SPEC Bloco 01 §13'
  FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id
 WHERE pe.codigo = 'nutricao' AND a.retomar_em IS NULL
HAVING count(*) > 0
ON CONFLICT (tabela, motivo) DO UPDATE SET linhas = EXCLUDED.linhas, declarado_em = now();

-- ===========================================================================
-- §14 — "Ao desqualificar, motivo estruturado OBRIGATÓRIO. Base inicial:
--        Fora do ICP / Contato inválido / Empresa sem fit / Sem necessidade /
--        Duplicado / Outro. Registrar: motivo, detalhe, responsável pela
--        decisão, data/hora, ETAPA ANTERIOR, origem, campanha, tempo até
--        desqualificação."  §29: "❌ Desqualificação sem motivo."
--
-- MEDIDO ANTES: 657 desqualificados, `motivo_desqualificacao` NULL em 657.
-- A data está em 657 de 657, então só o motivo e a etapa anterior faltam.
--
-- A EVIDÊNCIA, e o que ela cobre de verdade:
--   `leads.motivo_perda` ....... 92 leads, em código já quase estruturado
--   `status_changes.motivo` .... 535 leads, no formato "Pré-vendas: <etapa
--                                anterior> → Desqualificado" — não é o motivo,
--                                mas É a ETAPA ANTERIOR que a §14 exige.
--
-- Os outros 565 NÃO TÊM motivo em lugar nenhum do legado. A regra do Kauã é
-- explícita: nunca inventar dado; sem evidência, marcar para revisão e reportar
-- o número. Eles recebem `NAO_INFORMADO_LEGADO` — que é uma afirmação
-- verdadeira ("o legado não registrou") e não um motivo fabricado — e entram em
-- `_carga_registros_suspeitos` para o time resolver na tela.
--
-- O mapeamento para a lista da §14 só traduz o que casa sem ambiguidade. O
-- código legado cru vai junto no evento de timeline, para o de/para ser
-- auditável depois.
-- ===========================================================================
UPDATE aquisicoes a
   SET motivo_desqualificacao = CASE l.motivo_perda
         WHEN 'fora_icp'           THEN 'fora_do_icp'
         WHEN 'contato_invalido'   THEN 'contato_invalido'
         WHEN 'porte_incompativel' THEN 'empresa_sem_fit'
         WHEN 'sem_interesse'      THEN 'sem_necessidade'
         -- `sem_budget` e `nao_respondeu` não existem na lista da §14 para
         -- Pré-vendas (são motivos de PERDA, Bloco 02 §17). Caem em "Outro"
         -- com o código original preservado no evento.
         WHEN 'sem_budget'         THEN 'outro'
         WHEN 'nao_respondeu'      THEN 'outro'
         WHEN 'outro'              THEN 'outro'
         ELSE 'outro'
       END,
       updated_at = now()
  FROM leads l, pipeline_etapas pe
 WHERE l.id = a.lead_legado_id
   AND pe.id = a.etapa_id AND pe.codigo = 'desqualificado'
   AND l.motivo_perda IS NOT NULL
   AND a.motivo_desqualificacao IS NULL;

UPDATE aquisicoes a
   SET motivo_desqualificacao = 'nao_informado_legado',
       updated_at = now()
  FROM pipeline_etapas pe
 WHERE pe.id = a.etapa_id AND pe.codigo = 'desqualificado'
   AND a.motivo_desqualificacao IS NULL;

-- A tabela nasceu na limpeza aceitando so entidades de identidade, e o passo 02
-- a reescreve sem 'aquisicao'. Reafirmar aqui deixa este arquivo rodavel
-- sozinho, em qualquer ordem.
ALTER TABLE _carga_registros_suspeitos DROP CONSTRAINT IF EXISTS _carga_registros_suspeitos_entidade_check;
ALTER TABLE _carga_registros_suspeitos ADD CONSTRAINT _carga_registros_suspeitos_entidade_check
  CHECK (entidade IN ('lead','pessoa','contato','empresa','oportunidade','aquisicao'));

-- Simetrico ao da nutricao: lead REATIVADO (o no-show devolve o lead para
-- Qualificado, SPEC §15) nao pode continuar carregando o estado de
-- desqualificacao como se fosse o estado atual. O FATO nao se perde — ele vive
-- no evento `desqualificacao` da timeline, que e a modelagem que a §10 aceita
-- ("ou modelagem equivalente via eventos + projecao"). O que sai e a COLUNA,
-- que descreve o estado de agora.
UPDATE aquisicoes a
   SET motivo_desqualificacao = NULL, desqualificado_em = NULL, updated_at = now()
  FROM pipeline_etapas pe
 WHERE pe.id = a.etapa_id AND pe.codigo <> 'desqualificado'
   AND (a.motivo_desqualificacao IS NOT NULL OR a.desqualificado_em IS NOT NULL);

INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe)
SELECT 'aquisicao', a.id, 'revisar_desqualificacao_sem_motivo',
       'desqualificado no legado sem motivo registrado em lugar nenhum (leads.motivo_perda nulo e status_changes so guarda a transicao) — SPEC Bloco 01 §14 exige motivo estruturado'
  FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id
 WHERE pe.codigo = 'desqualificado' AND a.motivo_desqualificacao = 'nao_informado_legado'
ON CONFLICT (entidade, entidade_id, motivo) DO NOTHING;

DELETE FROM _carga_registros_suspeitos s
 USING aquisicoes a
 WHERE s.entidade = 'aquisicao' AND s.entidade_id = a.id
   AND s.motivo = 'revisar_desqualificacao_sem_motivo'
   AND a.motivo_desqualificacao <> 'nao_informado_legado';

-- ===========================================================================
-- §17 — "Nenhuma mudança importante pode existir apenas como estado atual.
--        Precisamos poder reconstruir: ... LeadQualified, LeadNurtured,
--        LeadDisqualified ... todo evento relevante possui entidade, timestamp,
--        executor e contexto."
--
-- §10 fecha dizendo que `qualificadoPor`/`qualificadoPorTipo` podem vir de
-- "modelagem equivalente via eventos + projeção". É o que se faz aqui:
-- `timeline_events.actor_type` carrega o executor, e os tipos reusados
-- (`qualificacao`, `desqualificacao`) são os que `lib/events/projecao-timeline.ts`
-- já projeta — nenhum tipo novo que a tela não saiba desenhar.
-- ===========================================================================
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             tipo, titulo, descricao, icone, actor_type, occurred_at, metadata)
SELECT a.organizacao_id, a.empresa_id, a.pessoa_id, a.id,
       'qualificacao', 'Qualificado',
       'Fato recuperado na virada ONFACE a partir do legado (sdr_status/handoff para Pipeline)',
       'check', 'SYSTEM',
       COALESCE(a.qualificado_em, a.created_at),
       jsonb_build_object('origem', 'carga-virada/7-pipeline/04',
                          'spec', 'Bloco 01 §10',
                          'data_confirmada', a.qualificado_em IS NOT NULL)
  FROM aquisicoes a
 WHERE a.qualificado
   AND NOT EXISTS (SELECT 1 FROM timeline_events te
                    WHERE te.aquisicao_id = a.id AND te.tipo = 'qualificacao');

INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             tipo, titulo, descricao, icone, actor_type, occurred_at, metadata)
SELECT a.organizacao_id, a.empresa_id, a.pessoa_id, a.id,
       'desqualificacao',
       'Desqualificado: ' || a.motivo_desqualificacao,
       -- A §14 exige a ETAPA ANTERIOR. Ela está no texto da transição legada.
       COALESCE((SELECT s.motivo FROM status_changes s
                  WHERE s.lead_id = a.lead_legado_id AND s.para_status = 'disqualified'
                    AND s.motivo IS NOT NULL ORDER BY s.created_at DESC LIMIT 1),
                'etapa anterior nao registrada no legado'),
       'x', 'SYSTEM',
       COALESCE(a.desqualificado_em, a.updated_at),
       jsonb_build_object('origem', 'carga-virada/7-pipeline/04',
                          'spec', 'Bloco 01 §14',
                          'motivo_legado', (SELECT l.motivo_perda FROM leads l WHERE l.id = a.lead_legado_id),
                          'detalhe_legado', (SELECT l.motivo_perda_detalhe FROM leads l WHERE l.id = a.lead_legado_id))
  FROM aquisicoes a
  JOIN pipeline_etapas pe ON pe.id = a.etapa_id
 WHERE pe.codigo = 'desqualificado'
   AND NOT EXISTS (SELECT 1 FROM timeline_events te
                    WHERE te.aquisicao_id = a.id AND te.tipo = 'desqualificacao');

-- ===========================================================================
-- VERIFICAÇÃO — cada regra vira uma asserção. PASSOU/FALHOU com número.
-- ===========================================================================
DO $$
DECLARE
  s10_alvo int; s10_fato int; s10_sem_data int;
  s13_tot int; s13_com_motivo int;
  s14_tot int; s14_com_motivo int; s14_revisar int;
  s15_fora int; s29_tag int; cruzado int;
BEGIN
  -- §10: todo lead com evidência de qualificação carrega o fato, em QUALQUER etapa.
  SELECT count(*), count(*) FILTER (WHERE a.qualificado)
    INTO s10_alvo, s10_fato
    FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id
    LEFT JOIN leads l ON l.id = a.lead_legado_id
   WHERE l.sdr_status = 'qualified' OR pe.codigo IN ('qualificado','oportunidade');
  SELECT count(*) INTO s10_sem_data FROM aquisicoes WHERE qualificado AND qualificado_em IS NULL;

  -- §13: nutrição sem motivo é proibida (§29).
  SELECT count(*), count(*) FILTER (WHERE a.nutricao_status IS NOT NULL
                                      AND a.nutricao_status <> 'estagnado_legado')
    INTO s13_tot, s13_com_motivo
    FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id WHERE pe.codigo = 'nutricao';

  -- §14: desqualificação sem motivo é proibida (§29).
  SELECT count(*), count(a.motivo_desqualificacao),
         count(*) FILTER (WHERE a.motivo_desqualificacao = 'nao_informado_legado')
    INTO s14_tot, s14_com_motivo, s14_revisar
    FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id WHERE pe.codigo = 'desqualificado';

  -- §15/§29: no-show não é coluna e não cria oportunidade nova. Lead volta a
  -- Qualificado, salvo quando foi desqualificado DEPOIS do no-show.
  SELECT count(*) INTO s15_fora
    FROM negocios n JOIN leads l ON l.id = n.lead_id JOIN aquisicoes a ON a.lead_legado_id = l.id
    JOIN pipeline_etapas pe ON pe.id = a.etapa_id
   WHERE n.status = 'no_show' AND pe.codigo NOT IN ('qualificado','desqualificado');

  -- §29: a qualificação não pode depender de tag removível. Nenhuma aquisição
  -- pode ter só a tag e não o fato.
  SELECT count(*) INTO s29_tag
    FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id
   WHERE pe.codigo = 'qualificado' AND a.qualificado IS NOT TRUE;

  -- Estado de saida (nutricao/desqualificacao) em quem nao esta na saida.
  SELECT count(*) INTO cruzado
    FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id
   WHERE (pe.codigo <> 'nutricao' AND a.nutricao_status IS NOT NULL)
      OR (pe.codigo <> 'desqualificado' AND (a.motivo_desqualificacao IS NOT NULL OR a.desqualificado_em IS NOT NULL));

  RAISE NOTICE '── §10 fato qualificado: %/% (sem data: %, declarado)', s10_fato, s10_alvo, s10_sem_data;
  RAISE NOTICE '── estado de saida fora da etapa de saida: % (tem de ser 0)', cruzado;
  RAISE NOTICE '── §13 nutricao com motivo: %/%', s13_com_motivo, s13_tot;
  RAISE NOTICE '── §14 desqualificacao com motivo: %/% (% sem motivo no legado, p/ revisao)',
               s14_com_motivo, s14_tot, s14_revisar;
  RAISE NOTICE '── §15 no-show fora de qualificado/desqualificado: % (tem de ser 0)', s15_fora;
  RAISE NOTICE '── §29 qualificado sem o fato: % (tem de ser 0)', s29_tag;

  IF s10_fato <> s10_alvo THEN
    RAISE EXCEPTION '§10 FALHOU: % de % sem o fato qualificado', s10_alvo - s10_fato, s10_alvo;
  END IF;
  IF s13_com_motivo <> s13_tot THEN
    RAISE EXCEPTION '§13 FALHOU: % em nutricao sem motivo', s13_tot - s13_com_motivo;
  END IF;
  IF s14_com_motivo <> s14_tot THEN
    RAISE EXCEPTION '§14 FALHOU: % desqualificados sem motivo', s14_tot - s14_com_motivo;
  END IF;
  IF cruzado > 0 THEN
    RAISE EXCEPTION 'estado cruzado: % aquisicoes com nutricao/desqualificacao fora da etapa correspondente', cruzado;
  END IF;
  IF s29_tag > 0 THEN
    RAISE EXCEPTION '§29 FALHOU: % na coluna Qualificado sem o fato estruturado', s29_tag;
  END IF;
END $$;

COMMIT;

-- ===========================================================================
-- O QUE FICA ABERTO, E POR QUE NÃO FOI "CONSERTADO" AQUI
--
-- §6 NOVO — "Registrar obrigatoriamente: origem". 561 das 4.080 aquisições
--   estão sem origem. Medido: ZERO delas tem origem no lead legado também.
--   Não há de onde tirar. Inventar "origem desconhecida" seria trocar um campo
--   vazio honesto por um valor que parece dado.
--
-- §6/§5 Empresa — 1.039 das 2.129 em NOVO sem `empresa_id`. NÃO é bug novo: o
--   Kauã já decidiu em 23/09 (vault, mesma nota) não criar entidade `empresas`
--   a partir do texto de `leads.empresa`, porque "boa parte é ramo de atividade
--   ('Venda de Alimentos', 'Autônomo') e a base já foi poluída assim antes".
--   A tela usa a precedência `COALESCE(empresas.nome, leads.empresa)`.
--
-- §8 QUALIFICAÇÃO estruturada — a spec lista ICP, dor, necessidade, urgência,
--   budget, decisor, timing. O legado tem só `leads.qualificacao` (texto livre)
--   e `concorrente_atual`. Não existe no canônico casa tipada para os demais;
--   isso é esquema a nascer na implementação, não dado a carregar.
--
-- §16 atribuição em `pontosContato` — 2.410 aquisições sem linha em
--   `pontos_contato`. Dessas, 1.849 têm atribuição no lead, mas APENAS
--   `leads.origem`: zero utm_source, zero campanha, zero landing page. E essa
--   origem JÁ está em `aquisicoes.origem`, ou seja, ela NÃO se perdeu na
--   conversão (que é o que a §29 proíbe). Criar 1.849 linhas cujo único campo
--   duplica uma coluna existente, e inventar `tipo_origem` (NOT NULL) para cada
--   uma, adicionaria zero informação e um palpite por linha.
--
-- §29 CHECKLIST, item a item, medido:
--   ❌ Form inbound criar oportunidade automaticamente ....... o legado FAZIA:
--      714 aquisições em NOVO têm negócio. É fato histórico a preservar
--      (§27: "legado é fonte de dados a ser preservada"), e por isso esses
--      negócios NÃO foram contados como evidência de qualificação no §10 acima.
--      A proibição vale para a escrita nova, não para reescrever o passado.
--   ❌ Lead tratado como pessoa isolada ...................... tela, não dado.
--   ❌ Qualificado criar oportunidade automaticamente ........ 60 parados em
--      Qualificado sem oportunidade: a etapa é parável, como a §9 manda.
--   ❌ Reunião necessária para existir oportunidade .......... 68 em Entrada,
--      17 com reunião agendada e 51 em no-show: oportunidade existe sem reunião.
--   ❌ No-show criar segunda oportunidade .................... 51 no-show, 51
--      oportunidades. Nenhuma duplicada.
--   ❌ No-show virar coluna permanente ....................... não existe etapa
--      no-show em `pipeline_etapas` do funil de vendas; o contexto é badge.
--   ❌ Qualificação depender de tag removível ................ corrigido acima:
--      o fato agora é coluna, não a posição no board.
--   ❌ Nutrição sem motivo ................................... corrigido acima.
--   ❌ Desqualificação sem motivo ............................ corrigido acima
--      onde havia evidência; o resto marcado para revisão, nunca inventado.
--   ❌ Perder origem depois da conversão ..................... origem preservada
--      em `aquisicoes.origem` nas 3.519 que a tinham.
--   ❌ IA com lógica comercial paralela ...................... código, não dado.
--   ❌ Claude redesenhar regra do módulo por conta própria .... nenhuma regra
--      nova foi criada aqui: cada UPDATE cita a seção da spec que o manda.
-- ===========================================================================
