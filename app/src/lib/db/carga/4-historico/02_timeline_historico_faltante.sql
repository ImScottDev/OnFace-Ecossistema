-- CARGA DA VIRADA · histórico, passo 02 — leva para a timeline o histórico que
-- o backfill 14-15 não migra.
--
-- O PROBLEMA: `14-15-eventos-timeline` lê SÓ a tabela `atividades` (13.997
-- linhas) e os eventos de ganho/perda. Todo o resto do histórico de produção
-- fica nas tabelas legadas, fora da timeline do cliente:
--
--     notas             5.237   o que o time escreveu sobre o cliente
--     status_changes    6.212   as movimentações de card — a memória do funil
--     anexos_legado     1.980   contratos e documentos recebidos
--     tarefas             463
--     reuniões            322
--                      ──────
--                      14.214 linhas
--
-- Para o time que faz a virada, isso é o que mais dói: abrir um cliente e não
-- ver a nota que alguém escreveu, nem por quais etapas o negócio passou.
--
-- ÂNCORAS: cada evento é pendurado em pessoa, empresa, aquisição e
-- oportunidade pelos vínculos legado→canônico que os backfills já criaram
-- (`pessoas.lead_id_legado`, `aquisicoes.lead_legado_id`,
-- `oportunidades.negocio_id_legado`). Um evento sem nenhuma âncora não é
-- inserido — apareceria em tela nenhuma e só inflaria a contagem.
--
-- IDEMPOTENTE: cada INSERT filtra por `metadata->'backfill'->>'origem'`, então
-- rodar de novo não duplica.

-- ── notas ────────────────────────────────────────────────────────────────
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             oportunidade_id, tipo, titulo, descricao, icone,
                             actor_type, actor_id, occurred_at, metadata)
SELECT n.organizacao_id,
       COALESCE(n.empresa_id, o.empresa_id, p.empresa_id),
       p.id, a.id, o.id,
       'nota', 'Nota',
       left(COALESCE(n.conteudo, ''), 4000), 'file-text',
       CASE WHEN n.autor_id IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
       n.autor_id, n.created_at,
       jsonb_build_object('backfill', jsonb_build_object('fase','carga-4-historico','origem','notas','id',n.id),
                          'autor_nome', n.autor_display_name)
  FROM notas n
  LEFT JOIN pessoas       p ON p.lead_id_legado     = n.lead_id
  LEFT JOIN aquisicoes    a ON a.lead_legado_id     = n.lead_id
  LEFT JOIN oportunidades o ON o.negocio_id_legado  = n.negocio_id
 WHERE NOT EXISTS (SELECT 1 FROM timeline_events t
                    WHERE t.metadata->'backfill'->>'origem' = 'notas'
                      AND t.metadata->'backfill'->>'id' = n.id::text)
   AND COALESCE(n.empresa_id, o.empresa_id, p.empresa_id, p.id, a.id, o.id) IS NOT NULL;

-- ── status_changes: as movimentações de card ─────────────────────────────
-- É o que responde "por onde esse negócio passou". Sem isso o time perde a
-- memória do funil na virada.
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             oportunidade_id, tipo, titulo, descricao, icone,
                             actor_type, actor_id, occurred_at, metadata)
SELECT COALESCE(o.organizacao_id, a.organizacao_id, p.organizacao_id),
       COALESCE(o.empresa_id, p.empresa_id),
       p.id, a.id, o.id,
       'mudanca_etapa',
       'Etapa: ' || COALESCE(s.de_status,'(início)') || ' → ' || COALESCE(s.para_status,'(?)'),
       s.motivo, 'git-branch',
       CASE WHEN s.usuario_id IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
       s.usuario_id, s.created_at,
       jsonb_build_object('backfill', jsonb_build_object('fase','carga-4-historico','origem','status_changes','id',s.id),
                          'de', s.de_status, 'para', s.para_status)
  FROM status_changes s
  LEFT JOIN pessoas       p ON p.lead_id_legado    = s.lead_id
  LEFT JOIN aquisicoes    a ON a.lead_legado_id    = s.lead_id
  LEFT JOIN oportunidades o ON o.negocio_id_legado = s.negocio_id
 WHERE NOT EXISTS (SELECT 1 FROM timeline_events t
                    WHERE t.metadata->'backfill'->>'origem' = 'status_changes'
                      AND t.metadata->'backfill'->>'id' = s.id::text)
   AND COALESCE(p.id, a.id, o.id) IS NOT NULL;

-- ── reuniões ─────────────────────────────────────────────────────────────
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             oportunidade_id, tipo, titulo, descricao, icone,
                             actor_type, actor_id, occurred_at, metadata)
SELECT r.organizacao_id,
       COALESCE(o.empresa_id, p.empresa_id),
       p.id, a.id, o.id,
       'reuniao',
       COALESCE(NULLIF(r.titulo,''), 'Reunião'),
       COALESCE(r.resumo_transcript, r.notas), 'calendar',
       CASE WHEN r.responsavel_id IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
       r.responsavel_id, COALESCE(r.data, r.created_at),
       jsonb_build_object('backfill', jsonb_build_object('fase','carga-4-historico','origem','reunioes','id',r.id),
                          'status', r.status, 'tipo_reuniao', r.tipo)
  FROM reunioes r
  LEFT JOIN pessoas       p ON p.lead_id_legado    = r.lead_id
  LEFT JOIN aquisicoes    a ON a.lead_legado_id    = r.lead_id
  LEFT JOIN oportunidades o ON o.negocio_id_legado = r.negocio_id
 WHERE NOT EXISTS (SELECT 1 FROM timeline_events t
                    WHERE t.metadata->'backfill'->>'origem' = 'reunioes'
                      AND t.metadata->'backfill'->>'id' = r.id::text)
   AND COALESCE(p.id, a.id, o.id) IS NOT NULL;

-- ── tarefas ──────────────────────────────────────────────────────────────
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             oportunidade_id, tipo, titulo, descricao, icone,
                             actor_type, actor_id, occurred_at, metadata)
SELECT t2.organizacao_id,
       COALESCE(t2.empresa_id, o.empresa_id, p.empresa_id),
       p.id, a.id, o.id,
       'tarefa',
       COALESCE(NULLIF(t2.titulo,''), 'Tarefa'),
       t2.descricao, 'check-square',
       CASE WHEN t2.usuario_id IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
       t2.usuario_id, t2.created_at,
       jsonb_build_object('backfill', jsonb_build_object('fase','carga-4-historico','origem','tarefas','id',t2.id),
                          'concluida', t2.concluida, 'prioridade', t2.prioridade)
  FROM tarefas t2
  LEFT JOIN pessoas       p ON p.lead_id_legado    = t2.lead_id
  LEFT JOIN aquisicoes    a ON a.lead_legado_id    = t2.lead_id
  LEFT JOIN oportunidades o ON o.negocio_id_legado = t2.negocio_id
 WHERE NOT EXISTS (SELECT 1 FROM timeline_events t
                    WHERE t.metadata->'backfill'->>'origem' = 'tarefas'
                      AND t.metadata->'backfill'->>'id' = t2.id::text)
   AND COALESCE(t2.empresa_id, p.id, a.id, o.id) IS NOT NULL;

-- ── anexos ───────────────────────────────────────────────────────────────
-- `anexos_legado` é polimórfico (`entidade_tipo` + `entidade_id`). Só os que
-- apontam para lead/empresa têm âncora resolvível aqui.
INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             tipo, titulo, descricao, icone, actor_type,
                             occurred_at, metadata)
SELECT x.organizacao_id,
       COALESCE(e.id, p.empresa_id),
       p.id, a.id,
       'anexo',
       COALESCE(NULLIF(x.nome_arquivo,''), 'Documento'),
       x.categoria, 'paperclip', 'SYSTEM',
       COALESCE(x.criado_em_original, x.created_at),
       jsonb_build_object('backfill', jsonb_build_object('fase','carga-4-historico','origem','anexos_legado','id',x.id),
                          'storage_path', x.storage_path, 'categoria', x.categoria)
  FROM anexos_legado x
  LEFT JOIN pessoas    p ON x.entidade_tipo IN ('lead','Lead','contato')  AND p.lead_id_legado = x.entidade_id
  LEFT JOIN aquisicoes a ON x.entidade_tipo IN ('lead','Lead','contato')  AND a.lead_legado_id = x.entidade_id
  LEFT JOIN empresas   e ON x.entidade_tipo IN ('empresa','Empresa','Account') AND e.id = x.entidade_id
 WHERE NOT EXISTS (SELECT 1 FROM timeline_events t
                    WHERE t.metadata->'backfill'->>'origem' = 'anexos_legado'
                      AND t.metadata->'backfill'->>'id' = x.id::text)
   AND COALESCE(e.id, p.id, a.id) IS NOT NULL;

-- ── relatório ────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '── histórico levado à timeline ──';
  FOR r IN
    SELECT o AS origem,
           (SELECT count(*) FROM timeline_events t WHERE t.metadata->'backfill'->>'origem' = o) AS migrados,
           CASE o WHEN 'notas' THEN (SELECT count(*) FROM notas)
                  WHEN 'status_changes' THEN (SELECT count(*) FROM status_changes)
                  WHEN 'reunioes' THEN (SELECT count(*) FROM reunioes)
                  WHEN 'tarefas' THEN (SELECT count(*) FROM tarefas)
                  WHEN 'anexos_legado' THEN (SELECT count(*) FROM anexos_legado) END AS origem_total
      FROM unnest(ARRAY['notas','status_changes','reunioes','tarefas','anexos_legado']) AS o
  LOOP
    RAISE NOTICE '  %: % de % (sem âncora: %)',
      rpad(r.origem,15), r.migrados, r.origem_total, r.origem_total - r.migrados;
  END LOOP;
  RAISE NOTICE '  timeline total: %', (SELECT count(*) FROM timeline_events);
END $$;
