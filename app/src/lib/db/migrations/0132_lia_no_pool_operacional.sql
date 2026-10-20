-- 0132 — Lia SDR passa a atender pelo pool de números operacionais.
--
-- Decisão do Scott (20/10/2026): a versão publicada da "Lia SDR — Callface" estava presa a uma
-- sessão de WhatsApp que não existe mais; com vínculo que nunca casa, ela não respondia em lugar
-- nenhum e não dava erro. Em vez de prendê-la a outro número fixo, ela passa a valer para o POOL
-- operacional (whatsapp_sessao.operacional, 0131): atende conversa de número operacional e abre
-- conversa nova no número que a distribuição escolheu para o lead, ou no primeiro operacional.
-- Os números entram e saem do pool por Ajustes › WhatsApp, sem republicar o agente.
--
-- O que muda, só nas versões dos agentes de slug 'lia-sdr':
--   - guardrail_config.canais vira { whatsapp: true, pool: "operacional" } (some a lista fixa
--     `sessoes`, que apontava para número que não existe);
--   - channel_session_id (número fixo) fica nulo.
-- Enquanto nenhum número estiver marcado como operacional, a Lia continua sem atender — o mesmo
-- efeito de hoje, agora explícito. Número privado nunca é operacional (CHECK da 0131).
--
-- Idempotente: só toca versão que ainda não está no pool.
--
-- ROLLBACK (volta a lista fixa vazia; o número antigo não existe mais):
--   UPDATE ai_agent_versions v SET guardrail_config = v.guardrail_config #- '{canais,pool}'
--     FROM ai_agents a WHERE a.id = v.agent_id AND a.slug = 'lia-sdr';

UPDATE ai_agent_versions v
   SET guardrail_config = jsonb_set(
         COALESCE(v.guardrail_config, '{}'::jsonb),
         '{canais}',
         (COALESCE(v.guardrail_config->'canais', '{}'::jsonb) - 'sessoes') || '{"whatsapp": true, "pool": "operacional"}'::jsonb,
         true),
       channel_session_id = NULL
  FROM ai_agents a
 WHERE a.id = v.agent_id
   AND a.slug = 'lia-sdr'
   AND (v.guardrail_config->'canais'->>'pool') IS DISTINCT FROM 'operacional';
