-- CARGA DA VIRADA · pipeline, passo 01 — DE/PARA do Pipeline de Vendas.
--
-- Este arquivo é o de/para canônico do Bloco 02 e SUPERSEDE, no mesmo diretório,
-- `01_estagnados_viram_perdido.sql`, `01_pipeline_conforme_spec.sql` e
-- `02_status_ativo_por_evidencia.sql`, escritos em paralelo no mesmo banco em
-- 05/10. Os três já foram aplicados e se contradizem entre si (o 02 marcou 143
-- `ativo` como "sem evidência"; o 01 promoveu os 159 a Ganho mesmo assim).
-- Tudo aqui é filtrado pela condição que conserta, então roda limpo em carga
-- nova OU por cima do estado que eles deixaram.
--
-- ───────────────────────────────────────────────────────────────────────────
-- FONTES
--
-- SPEC `docs/produto/specdrive-modulo-01-vendas.md`:
--   Bloco 01 §15 — "No-show não é coluna. No-show é evento comercial."
--                  "preservar oportunidade existente / Lead retorna para
--                  QUALIFICADO". Reagendar reusa a MESMA oportunidade.
--   Bloco 01 §27 — "LEGADO É FONTE DE DADOS A SER PRESERVADA." Por isso
--                  `negocios.status` NÃO é reescrito aqui.
--   Bloco 02 §9/§10 — pipeline oficial: ENTRADA, DIAGNÓSTICO, PROPOSTA,
--                  NEGOCIAÇÃO (+ GANHO/PERDIDO como buckets). Nenhuma delas
--                  significa "parado" e nenhuma significa "cliente ativo".
--   Bloco 02 §11/§12 — reunião é evento; no-show é evento, "preservar mesma
--                  opportunityId", "nunca criar Oportunidade #2".
--   Bloco 02 §17 — Perdido: motivo ESTRUTURADO + data/hora + estágio anterior.
--                  "Evitar perpetuar motivos como statuses diferentes."
--   Bloco 02 §18 — "Negociar em outra data: pode ser encerrado como Perdido
--                  com motivo TIMING / OUTRA DATA."
--   Bloco 02 §19 — "WON é consequência de um gate de evidência válido."
--
-- VAULT:
--   `02_PROJETOS/Callface/CRM/produto/crm2-contexto-bloco-fundacao.md:51`
--     (p037 c51d131a) — "De-para explicitamente decidido: estagnados, sem
--     retorno de contato, trava na negociação, trava na assinatura e quer
--     negociar em outra data vão para Perdido com os respectivos motivos,
--     preservando data de entrada na etapa anterior. Precisa filtrar
--     oportunidades/clientes por motivo para nutrição posterior."
--     → é por isso que `motivo_estagnacao`/`estagnado_em` NÃO são limpos.
--   Mesma nota, bloco "Pipeline e no-show" — "No-show mantém o mesmo negócio em
--     Entrada com etiqueta no-show e retorna o lead para qualificação do SDR."
--   `05_DECISOES/Callface/CRM/2026-09-17-crm-negocio-sem-pipeline-some-do-board.md`
--     — os 10 negócios órfãos de `pipeline_id` em produção; o backfill de 17/09
--     cobriu só os 6 ABERTOS, "os 4 fechados ficam de fora de propósito".
--     E Q ALVES FILHO é um desses 4, e é o perdido sem etapa do item (d).
--   Memória `callface_datas_reconciliacao_nao_sao_reais` — data de carga nunca
--     é data de negócio.
--
-- CÓDIGO que lê o que este arquivo escreve:
--   `app/src/lib/vendas/dominio.ts` — `MOTIVOS_PERDA` é o vocabulário
--     ESTRUTURADO (`sem_retorno`, `timing`, `trava_negociacao`,
--     `trava_contratual`, …) e `rotuloPerda()` traduz a CHAVE para o rótulo.
--     Gravar a frase em `motivo_perda` quebra o filtro e aparece crua na tela.
--     As palavras do Scott viram `negocios.motivo_perda_detalhe`.
--   `app/src/components/crm2/pipeline/shared.ts:26` — o legado já documentava
--     que `ativo` "fica FORA de todo esse De/Para — é pós-venda recorrente,
--     não uma etapa de venda" e NUNCA entrou em coluna de pipeline no CRM2.
--
-- ───────────────────────────────────────────────────────────────────────────
-- MEDIDO ANTES (callface_crm_ensaio_virada, 05/10, antes dos arquivos paralelos)
--
--   oportunidades por etapa: ganho 616 · perdido 443 · entrada 267 ·
--                            proposta 189 · diagnostico 64 · negociacao 34
--   negócios 1.614 · oportunidades 1.613 (1 negócio perdido sem oportunidade)
--   estagnados 245 (outra_data 157 · sem_retorno 64 · trava_negociacao 22 ·
--                   trava_assinatura 2), espalhados pelas 4 colunas abertas
--   no_show 51, todos em entrada, 51/51 com `no_show_em`, 46/51 com a reunião
--                   já em `status='no_show'` (migration 0082)
--   ativo 159, todos em entrada, ZERO status_changes
--
-- ───────────────────────────────────────────────────────────────────────────
-- A DESCOBERTA QUE MUDA O ITEM (c)
--
-- A decisão 4 do Scott manda promover `ativo` a GANHO quando houver evidência
-- de cliente. Evidência de CLIENTE existe: 159/159 têm contrato no lead, 125
-- têm fatura paga. Mas evidência de que a LINHA é uma venda distinta, não:
--
--   157 dos 159 têm, no MESMO lead, um negócio `ganho` com o MESMO
--   `valor_total`; em 154 deles o `ganho_at` do gêmeo cai a menos de 2 dias do
--   `created_at` da linha `ativo` (nos outros 3, a menos de 15).
--
--   SELECT count(*) FROM negocios a WHERE a.status='ativo' AND EXISTS (
--     SELECT 1 FROM negocios g WHERE g.status='ganho' AND g.lead_id=a.lead_id
--       AND coalesce(g.valor_total,0)=coalesce(a.valor_total,0));   -- 157
--
-- Não são 157 vendas: é a MESMA venda duplicada quando o cliente foi ativado
-- (o padrão da memória `callface_pagamento_plataforma_nao_casa_webhook`), e
-- nenhuma delas tem um único `status_changes`. Promover as 157 a Ganho inventa
-- 157 vitórias e R$ 158.719,68 de MRR — é o que o estado atual do banco faz.
-- Bloco 02 §19 ("gate de evidência") e a ordem do Scott ("sem evidência, não
-- chute; marque para revisão e reporte o número") apontam para o mesmo lugar:
-- as 157 saem do funil, NÃO viram Ganho, e vão para revisão humana nomeadas.
-- Só as 2 sem gêmeo viram Ganho, com a data real da evidência.
--
-- O QUE NÃO SE TOCA: `negocios.status` (Bloco 01 §27) e, por consequência,
-- `status_changes` — inserir uma transição "para perdido" que não aconteceu no
-- legado seria inventar movimento. `negocios.etapa` NÃO é legado: é a coluna
-- espelho que o próprio motor escreve (`lib/vendas/pipeline.ts:713`), então ela
-- é alinhada aqui, senão as telas que ainda leem `negocios` contam outra
-- história.
--
-- IDEMPOTENTE: cada passo é filtrado pelo estado que corrige.

BEGIN;

-- ===========================================================================
-- (a) ESTAGNADOS (245) → PERDIDO, com motivo estruturado e data real.
--
--     DATA: última entrada NO STATUS LEGADO ATUAL, em `status_changes`
--     (241/245 têm). Nunca now(). Os 4 sem transição caem em
--     `negocios.etapa_desde` e ficam DECLARADOS em `_carga_perdas_declaradas`.
-- ===========================================================================
CREATE TEMP TABLE _est ON COMMIT DROP AS
SELECT o.id                                   AS oportunidade_id,
       n.id                                   AS negocio_id,
       n.status                               AS status_legado,
       o.etapa                                AS etapa_anterior,
       CASE n.status
         WHEN 'outra_data'       THEN 'timing'
         WHEN 'sem_retorno'      THEN 'sem_retorno'
         WHEN 'trava_negociacao' THEN 'trava_negociacao'
         WHEN 'trava_assinatura' THEN 'trava_contratual'
       END                                    AS motivo_chave,
       CASE n.status
         WHEN 'outra_data'       THEN 'quer negociar em outra data'
         WHEN 'sem_retorno'      THEN 'sem retorno de contato'
         WHEN 'trava_negociacao' THEN 'trava na negociação'
         WHEN 'trava_assinatura' THEN 'trava na assinatura do contrato'
       END                                    AS motivo_detalhe,
       (SELECT max(sc.created_at) FROM status_changes sc
         WHERE sc.negocio_id = n.id AND sc.para_status = n.status) AS dt_status_change,
       n.etapa_desde                          AS dt_fallback,
       pe.id                                  AS etapa_perdido_id
  FROM negocios n
  JOIN oportunidades o ON o.negocio_id_legado = n.id
  LEFT JOIN pipeline_etapas pe
         ON pe.pipeline_id = o.pipeline_id AND pe.codigo = 'perdido'
 WHERE n.status IN ('outra_data','sem_retorno','trava_negociacao','trava_assinatura');

UPDATE oportunidades o
   SET etapa        = 'perdido',
       stage        = 'perdido',
       etapa_id     = COALESCE(e.etapa_perdido_id, o.etapa_id),
       perdido_at   = COALESCE(e.dt_status_change, e.dt_fallback),
       ganho_at     = NULL,
       motivo_perda = e.motivo_chave,
       updated_at   = now()
  FROM _est e
 WHERE o.id = e.oportunidade_id
   AND (o.etapa IS DISTINCT FROM 'perdido'
        OR o.motivo_perda IS DISTINCT FROM e.motivo_chave
        OR o.perdido_at IS DISTINCT FROM COALESCE(e.dt_status_change, e.dt_fallback));

-- Espelho canônico no legado (coluna do motor, não dado do legado).
-- `status`, `motivo_estagnacao` e `estagnado_em` ficam intactos: são a
-- proveniência e o filtro de nutrição que o vault pede.
UPDATE negocios n
   SET etapa                = 'perdido',
       etapa_desde          = COALESCE(e.dt_status_change, e.dt_fallback),
       motivo_perda_detalhe = e.motivo_detalhe,
       updated_at           = n.updated_at
  FROM _est e
 WHERE n.id = e.negocio_id
   AND (n.etapa IS DISTINCT FROM 'perdido'
        OR n.motivo_perda_detalhe IS DISTINCT FROM e.motivo_detalhe);

INSERT INTO _carga_perdas_declaradas (tabela, linhas, motivo)
SELECT 'oportunidades (7-pipeline/01_depara_etapas_vendas)', count(*),
       'perda datada por negocios.etapa_desde: nao ha transicao em status_changes para o status legado de origem; e a melhor evidencia disponivel'
  FROM _est WHERE dt_status_change IS NULL
HAVING count(*) > 0
ON CONFLICT (tabela, motivo) DO UPDATE SET linhas = EXCLUDED.linhas, declarado_em = now();

INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                             tipo, titulo, descricao, actor_type, occurred_at, metadata)
SELECT o.organizacao_id, o.empresa_id, o.pessoa_id, o.id,
       'oportunidade_perdida', 'Oportunidade perdida',
       'Encerrada na virada ONFACE: ' || e.motivo_detalhe,
       'SYSTEM', o.perdido_at,
       jsonb_build_object('origem','carga-virada/7-pipeline/01_depara_etapas_vendas',
                          'status_legado', e.status_legado,
                          'motivo', e.motivo_chave,
                          'etapa_anterior', e.etapa_anterior,
                          'spec','Bloco 02 §17-§18')
  FROM _est e JOIN oportunidades o ON o.id = e.oportunidade_id
 WHERE o.perdido_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM timeline_events te
                    WHERE te.oportunidade_id = o.id AND te.tipo = 'oportunidade_perdida');

-- ===========================================================================
-- (b) NO-SHOW (51) — oportunidade PRESERVADA em ENTRADA, no-show vira EVENTO +
--     etiqueta, e o lead volta para QUALIFICADO em Pré-vendas.
--
--     A migration 0082 já moveu o fato para a reunião (46/51 com
--     `reunioes.status='no_show'`); o que faltava era o resto da consequência
--     da spec: a marca no card e o retorno do lead.
--
--     EXCEÇÃO MEDIDA: 12 dos 51 leads foram DESQUALIFICADOS *depois* do
--     no-show (`aquisicoes.desqualificado_em > negocios.no_show_em`). Devolvê-
--     los a QUALIFICADO desfaria uma decisão posterior do SDR e ressuscitaria
--     lead morto no board. Ficam onde estão, com a etiqueta, e são reportados.
-- ===========================================================================
CREATE TEMP TABLE _ns ON COMMIT DROP AS
SELECT n.id          AS negocio_id,
       o.id          AS oportunidade_id,
       n.lead_id,
       n.no_show_em,
       a.id          AS aquisicao_id,
       pe_at.codigo  AS etapa_aquisicao_atual,
       (a.desqualificado_em IS NOT NULL AND a.desqualificado_em > n.no_show_em) AS desq_depois
  FROM negocios n
  JOIN oportunidades o ON o.negocio_id_legado = n.id
  LEFT JOIN aquisicoes a ON a.lead_legado_id = n.lead_id
  LEFT JOIN pipeline_etapas pe_at ON pe_at.id = a.etapa_id
 WHERE n.status = 'no_show';

-- Etiqueta "No-show" na oportunidade e no lead (a label já existe na base).
INSERT INTO entity_labels (organizacao_id, entity_type, entity_id, label_id)
SELECT o.organizacao_id, 'oportunidade', o.id, l.id
  FROM _ns ns JOIN oportunidades o ON o.id = ns.oportunidade_id
  CROSS JOIN LATERAL (SELECT id FROM labels WHERE nome = 'No-show'
                       AND (organizacao_id = o.organizacao_id OR organizacao_id IS NULL)
                       ORDER BY organizacao_id NULLS LAST LIMIT 1) l
ON CONFLICT (organizacao_id, entity_type, entity_id, label_id) DO NOTHING;

INSERT INTO entity_labels (organizacao_id, entity_type, entity_id, label_id)
SELECT o.organizacao_id, 'lead', ns.lead_id, l.id
  FROM _ns ns JOIN oportunidades o ON o.id = ns.oportunidade_id
  CROSS JOIN LATERAL (SELECT id FROM labels WHERE nome = 'No-show'
                       AND (organizacao_id = o.organizacao_id OR organizacao_id IS NULL)
                       ORDER BY organizacao_id NULLS LAST LIMIT 1) l
 WHERE ns.lead_id IS NOT NULL
ON CONFLICT (organizacao_id, entity_type, entity_id, label_id) DO NOTHING;

-- O evento. `vendas_eventos` está vazio nesta carga (o histórico foi carregado
-- em `timeline_events`), então o fato vai onde o resto do histórico está.
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                             tipo, titulo, descricao, actor_type, occurred_at, metadata)
SELECT o.organizacao_id, o.empresa_id, o.pessoa_id, o.id,
       'reuniao', 'No-show', 'Cliente não compareceu à reunião.',
       'SYSTEM', ns.no_show_em,
       jsonb_build_object('origem','carga-virada/7-pipeline/01_depara_etapas_vendas',
                          'evento','MeetingNoShow', 'etapa','entrada',
                          'spec','Bloco 01 §15 / Bloco 02 §12')
  FROM _ns ns JOIN oportunidades o ON o.id = ns.oportunidade_id
 WHERE ns.no_show_em IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM timeline_events te
                    WHERE te.oportunidade_id = o.id
                      AND te.tipo = 'reuniao' AND te.titulo = 'No-show');

-- Lead volta para QUALIFICADO (aquisição canônica + espelho no legado).
UPDATE aquisicoes a
   SET etapa_id       = pe.id,
       qualificado    = true,
       qualificado_em = COALESCE(a.qualificado_em, ns.no_show_em),
       closed_at      = NULL,
       updated_at     = now()
  FROM _ns ns
  JOIN pipelines p   ON p.nome = 'Pré-vendas'
  JOIN pipeline_etapas pe ON pe.pipeline_id = p.id AND pe.codigo = 'qualificado'
 WHERE a.id = ns.aquisicao_id
   AND ns.desq_depois IS NOT TRUE
   AND a.etapa_id IS DISTINCT FROM pe.id;

UPDATE leads l
   SET estagio_pre_vendas = 'qualificado', updated_at = l.updated_at
  FROM _ns ns
 WHERE l.id = ns.lead_id
   AND ns.desq_depois IS NOT TRUE
   AND l.estagio_pre_vendas IS DISTINCT FROM 'qualificado';

-- A tabela de revisão só aceitava entidades de identidade; a virada precisa
-- marcar aquisição e oportunidade também.
ALTER TABLE _carga_registros_suspeitos DROP CONSTRAINT IF EXISTS _carga_registros_suspeitos_entidade_check;
ALTER TABLE _carga_registros_suspeitos ADD CONSTRAINT _carga_registros_suspeitos_entidade_check
  CHECK (entidade IN ('lead','pessoa','contato','empresa','oportunidade','aquisicao'));

INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe)
SELECT 'aquisicao', ns.aquisicao_id, 'revisar_no_show_desqualificado_depois',
       'lead teve no-show e foi DESQUALIFICADO depois; nao devolvido a QUALIFICADO para nao desfazer decisao posterior do SDR'
  FROM _ns ns WHERE ns.desq_depois AND ns.aquisicao_id IS NOT NULL
ON CONFLICT (entidade, entidade_id, motivo) DO NOTHING;

-- ===========================================================================
-- (c) STATUS `ativo` (159) — sai de ENTRADA. Ganho SÓ com evidência de venda
--     distinta; duplicata de ganho existente vai para revisão, não para Ganho.
-- ===========================================================================
CREATE TEMP TABLE _ativo ON COMMIT DROP AS
SELECT o.id AS oportunidade_id, n.id AS negocio_id, n.lead_id, n.valor_total,
       (SELECT g.id FROM negocios g
         WHERE g.status = 'ganho' AND g.lead_id = n.lead_id
           AND COALESCE(g.valor_total,0) = COALESCE(n.valor_total,0)
         ORDER BY g.ganho_at NULLS LAST LIMIT 1) AS gemeo_ganho_id,
       COALESCE(
         (SELECT min(f.paga_em) FROM faturas f
           WHERE f.paga_em IS NOT NULL AND f.lead_id = n.lead_id
             AND f.paga_em >= n.created_at - interval '7 days'),
         (SELECT min(c.inicio)::timestamptz FROM contratos c
           WHERE c.lead_id = n.lead_id AND c.inicio IS NOT NULL
             AND c.inicio >= (n.created_at - interval '7 days')::date)
       ) AS dt_evidencia,
       pe_g.id AS etapa_ganho_id
  FROM negocios n
  JOIN oportunidades o ON o.negocio_id_legado = n.id
  LEFT JOIN pipeline_etapas pe_g
         ON pe_g.pipeline_id = o.pipeline_id AND pe_g.codigo = 'ganho'
 WHERE n.status = 'ativo';

-- c.1 — SEM gêmeo e COM data de evidência: venda distinta de cliente ativo.
--       Vira GANHO na data REAL (fatura paga; senão início do contrato).
UPDATE oportunidades o
   SET etapa = 'ganho', stage = 'ganho',
       etapa_id = COALESCE(a.etapa_ganho_id, o.etapa_id),
       ganho_at = a.dt_evidencia, perdido_at = NULL, updated_at = now()
  FROM _ativo a
 WHERE o.id = a.oportunidade_id
   AND a.gemeo_ganho_id IS NULL AND a.dt_evidencia IS NOT NULL
   AND (o.etapa IS DISTINCT FROM 'ganho' OR o.ganho_at IS DISTINCT FROM a.dt_evidencia);

UPDATE negocios n
   SET etapa = 'ganho', etapa_desde = a.dt_evidencia, updated_at = n.updated_at
  FROM _ativo a
 WHERE n.id = a.negocio_id
   AND a.gemeo_ganho_id IS NULL AND a.dt_evidencia IS NOT NULL
   AND n.etapa IS DISTINCT FROM 'ganho';

INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                             tipo, titulo, descricao, actor_type, occurred_at, metadata)
SELECT o.organizacao_id, o.empresa_id, o.pessoa_id, o.id,
       'oportunidade_ganha', 'Oportunidade ganha',
       'Reconhecida na virada ONFACE por evidência de pagamento/contrato (status legado: ativo)',
       'SYSTEM', o.ganho_at,
       jsonb_build_object('origem','carga-virada/7-pipeline/01_depara_etapas_vendas',
                          'status_legado','ativo','spec','Bloco 02 §19')
  FROM _ativo a JOIN oportunidades o ON o.id = a.oportunidade_id
 WHERE a.gemeo_ganho_id IS NULL AND o.etapa = 'ganho' AND o.ganho_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM timeline_events te
                    WHERE te.oportunidade_id = o.id AND te.tipo = 'oportunidade_ganha');

-- c.2 — COM gêmeo: a mesma venda, duplicada na ativação. NÃO é Ganho novo.
--       Sai de toda coluna do board (`etapa` NULL = sem etapa comercial, que é
--       exatamente o que o Scott disse que `ativo` é) e vai para revisão
--       humana. `stage` volta ao valor legado, que é o fato.
--       Desfaz também a promoção a Ganho aplicada pelos arquivos paralelos,
--       inclusive o evento de ganho que eles inseriram.
DELETE FROM timeline_events te
 USING _ativo a
 WHERE te.oportunidade_id = a.oportunidade_id
   AND te.tipo = 'oportunidade_ganha'
   AND a.gemeo_ganho_id IS NOT NULL
   AND te.metadata->>'status_legado' = 'ativo';

UPDATE oportunidades o
   SET etapa = NULL, etapa_id = NULL, stage = 'ativo',
       ganho_at = NULL, perdido_at = NULL, updated_at = now()
  FROM _ativo a
 WHERE o.id = a.oportunidade_id
   AND a.gemeo_ganho_id IS NOT NULL
   AND (o.etapa IS NOT NULL OR o.ganho_at IS NOT NULL);

UPDATE negocios n
   SET etapa = NULL, updated_at = n.updated_at
  FROM _ativo a
 WHERE n.id = a.negocio_id
   AND a.gemeo_ganho_id IS NOT NULL
   AND n.etapa IS NOT NULL;

INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe)
SELECT 'oportunidade', a.oportunidade_id, 'revisar_ativo_duplica_ganho_existente',
       'negocio legado status=ativo duplica o negocio ganho ' || a.gemeo_ganho_id ||
       ' (mesmo lead, mesmo valor). Fora do funil ate decisao humana: fundir no ganho ou reconhecer como venda propria.'
  FROM _ativo a WHERE a.gemeo_ganho_id IS NOT NULL
ON CONFLICT (entidade, entidade_id, motivo) DO NOTHING;

-- c.3 — sem gêmeo e sem data: não se chuta. Fica fora do funil, para revisão.
UPDATE oportunidades o
   SET etapa = NULL, etapa_id = NULL, stage = 'ativo', updated_at = now()
  FROM _ativo a
 WHERE o.id = a.oportunidade_id
   AND a.gemeo_ganho_id IS NULL AND a.dt_evidencia IS NULL
   AND o.etapa IS NOT NULL;

INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe)
SELECT 'oportunidade', a.oportunidade_id, 'revisar_ativo_sem_evidencia_datada',
       'negocio legado status=ativo sem gemeo ganho e sem fatura paga/contrato na janela: sem data real, nao promovido'
  FROM _ativo a WHERE a.gemeo_ganho_id IS NULL AND a.dt_evidencia IS NULL
ON CONFLICT (entidade, entidade_id, motivo) DO NOTHING;

-- O marcador que os arquivos paralelos deixaram descreve um estado que não
-- existe mais (eles marcaram 143 "sem evidência" e promoveram os 159).
-- (os mesmos 159 já estão re-marcados acima com o motivo que descreve o fato)
DELETE FROM _carga_registros_suspeitos
 WHERE motivo IN ('revisar_status_ativo_sem_evidencia', 'revisar_ativo_sem_evidencia_de_ganho');

-- ===========================================================================
-- (d) OS 2 PERDIDOS SEM ETAPA.
--
--     d.1 — "E Q ALVES FILHO": oportunidade existe e está em `perdido`, mas com
--           `pipeline_id` NULL, herdado do negócio órfão de produção. É um dos
--           4 FECHADOS que o fix de 17/09 deixou de fora de propósito. Sem
--           pipeline não há `etapa_id`, e o card não existe em aba nenhuma.
--           Vai para o pipeline padrão (Callface AI), como os 6 abertos foram.
--           Perdido: não mexe em receita por pipeline.
-- ===========================================================================
UPDATE oportunidades o
   SET pipeline_id = p.id,
       etapa_id    = pe.id,
       updated_at  = now()
  FROM pipelines p
  JOIN pipeline_etapas pe ON pe.pipeline_id = p.id
 WHERE p.nome = 'Callface AI'
   AND pe.codigo = o.etapa
   AND o.pipeline_id IS NULL
   AND o.etapa IS NOT NULL;

-- Rede de segurança: etapa textual preenchida e FK vazia dentro do mesmo pipeline.
UPDATE oportunidades o
   SET etapa_id = pe.id, updated_at = now()
  FROM pipeline_etapas pe
 WHERE pe.pipeline_id = o.pipeline_id AND pe.codigo = o.etapa
   AND o.etapa_id IS NULL AND o.etapa IS NOT NULL;

--     d.2 — "INCLUDER | YESTAR | MAYRA": negócio perdido (Zoho, R$ 300, motivo
--           "Preço") que o backfill 07 recusou por não ter pessoa NEM empresa
--           — a regra do SPEC §42 de não inventar de quem é a venda. A recusa
--           faz sentido para oportunidade acionável; para uma PERDIDA ela
--           esconde uma linha e faz Perdidas fechar 443 contra 444 do legado.
--           A oportunidade é criada sem identidade (nenhuma consulta do board
--           exige pessoa: todos os joins são LEFT) e o caso
--           OPORTUNIDADE_SEM_IDENTIDADE CONTINUA ABERTO em
--           `reconciliacao_casos` até alguém dizer de quem é.
INSERT INTO oportunidades (
  organizacao_id, pipeline_id, etapa_id, stage, etapa, titulo, valor, mrr,
  service_family, commercial_motion, perdido_at, motivo_perda,
  negocio_id_legado, lead_id, responsavel_id, created_at, updated_at)
SELECT n.organizacao_id, n.pipeline_id, pe.id, 'perdido', 'perdido', n.titulo,
       n.valor_total, n.mrr_fechado, NULLIF(n.service_family,'UNKNOWN'),
       COALESCE(n.commercial_motion,'NEW_BUSINESS'), n.updated_at,
       'preco', n.id, n.lead_id, n.responsavel_id, n.created_at, now()
  FROM negocios n
  JOIN pipeline_etapas pe ON pe.pipeline_id = n.pipeline_id AND pe.codigo = 'perdido'
 WHERE n.status = 'perdido'
   AND n.empresa_id IS NULL AND n.lead_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM oportunidades o WHERE o.negocio_id_legado = n.id);

INSERT INTO backfill_provenance (organizacao_id, fase, entidade_canonica, id_canonico,
                                 tabela_origem, id_origem, metodo)
SELECT o.organizacao_id, 'carga-virada/7-pipeline/01_depara_etapas_vendas',
       'oportunidade', o.id, 'negocios', o.negocio_id_legado::text,
       'PERDIDA_SEM_IDENTIDADE_RECONCILIADA'
  FROM oportunidades o
  JOIN negocios n ON n.id = o.negocio_id_legado
 WHERE n.empresa_id IS NULL AND n.lead_id IS NULL AND o.etapa = 'perdido'
ON CONFLICT (entidade_canonica, tabela_origem, id_origem) DO NOTHING;

INSERT INTO timeline_events (organizacao_id, oportunidade_id, tipo, titulo, descricao,
                             actor_type, occurred_at, metadata)
SELECT o.organizacao_id, o.id, 'oportunidade_perdida', 'Oportunidade perdida',
       'Negócio perdido do legado sem pessoa nem empresa; identidade segue em reconciliação.',
       'SYSTEM', o.perdido_at,
       jsonb_build_object('origem','carga-virada/7-pipeline/01_depara_etapas_vendas',
                          'sem_identidade', true)
  FROM oportunidades o
  JOIN negocios n ON n.id = o.negocio_id_legado
 WHERE n.empresa_id IS NULL AND n.lead_id IS NULL AND o.etapa = 'perdido'
   AND NOT EXISTS (SELECT 1 FROM timeline_events te
                    WHERE te.oportunidade_id = o.id AND te.tipo = 'oportunidade_perdida');

-- ===========================================================================
-- VERIFICAÇÃO — invariantes do Bloco 02.
-- ===========================================================================
DO $$
DECLARE
  ent int; diag int; prop int; neg int; g int; p int; fora_funil int;
  conducao_suja int; sem_data int; etapa_sem_fk int; dup int; ns_qualificado int;
BEGIN
  SELECT count(*) FILTER (WHERE etapa='entrada'),     count(*) FILTER (WHERE etapa='diagnostico'),
         count(*) FILTER (WHERE etapa='proposta'),    count(*) FILTER (WHERE etapa='negociacao'),
         count(*) FILTER (WHERE etapa='ganho'),       count(*) FILTER (WHERE etapa='perdido'),
         count(*) FILTER (WHERE etapa IS NULL)
    INTO ent, diag, prop, neg, g, p, fora_funil FROM oportunidades;

  -- Nenhum estagnado e nenhum `ativo` pode ocupar coluna de condução.
  SELECT count(*) INTO conducao_suja
    FROM oportunidades o JOIN negocios n ON n.id = o.negocio_id_legado
   WHERE o.etapa IN ('entrada','diagnostico','proposta','negociacao')
     AND n.status IN ('ativo','outra_data','sem_retorno','trava_negociacao','trava_assinatura');

  SELECT count(*) INTO sem_data FROM oportunidades
   WHERE (etapa = 'ganho' AND ganho_at IS NULL) OR (etapa = 'perdido' AND perdido_at IS NULL);

  SELECT count(*) INTO etapa_sem_fk FROM oportunidades WHERE etapa IS NOT NULL AND etapa_id IS NULL;

  SELECT count(*) INTO dup FROM _carga_registros_suspeitos
   WHERE motivo = 'revisar_ativo_duplica_ganho_existente';

  SELECT count(*) INTO ns_qualificado
    FROM negocios n JOIN aquisicoes a ON a.lead_legado_id = n.lead_id
    JOIN pipeline_etapas pe ON pe.id = a.etapa_id
   WHERE n.status = 'no_show' AND pe.codigo = 'qualificado';

  RAISE NOTICE '── pipeline: entrada % · diagnostico % · proposta % · negociacao % · ganho % · perdido % · fora do funil %',
               ent, diag, prop, neg, g, p, fora_funil;
  RAISE NOTICE '── estagnado/ativo em coluna de conducao: % (tem de ser 0)', conducao_suja;
  RAISE NOTICE '── ganho/perdido sem data: % (tem de ser 0)', sem_data;
  RAISE NOTICE '── etapa textual sem etapa_id: % (tem de ser 0)', etapa_sem_fk;
  RAISE NOTICE '── ativo duplicando ganho, para revisao humana: %', dup;
  RAISE NOTICE '── leads de no-show devolvidos a QUALIFICADO: % de 51', ns_qualificado;

  IF conducao_suja > 0 OR sem_data > 0 OR etapa_sem_fk > 0 THEN
    RAISE EXCEPTION 'de/para nao fechou: % em conducao, % sem data, % sem etapa_id',
                    conducao_suja, sem_data, etapa_sem_fk;
  END IF;
END $$;

COMMIT;
