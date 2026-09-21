-- Cria NEXO e Hermes, os dois agentes que o SPEC 19 define e que nao existiam:
-- `ai_agents` tinha ZERO linhas, com 30 tabelas de plataforma de IA prontas ao
-- lado.
--
-- NEXO  = copiloto operacional do usuario. Responde pergunta sobre a operacao e
--         executa acao que o usuario pediu. Ativado por conversa.
-- HERMES = executor operacional. Ativado por evento de dominio, automacao ou
--          condicao do sistema, nunca por conversa.
--
-- Os dois nascem em `draft`, com autonomia de sugestao. Agente que ja nasce
-- executando sozinho em base de producao e como subir feature sem revisao: pode
-- dar certo, e quando da errado ninguem sabe o que ele fez.
--
-- As ferramentas listadas sao as que existem em `ai-platform/tools/registry.ts`
-- e ja passam pelos adapters de dominio. Nenhuma ferramenta de escrita direta
-- entra na lista.

BEGIN;

INSERT INTO ai_agents (organizacao_id, nome, slug, descricao, finalidade, prioridade, status, kind)
SELECT o.id, a.nome, a.slug, a.descricao, a.finalidade, a.prioridade, 'draft', 'mcp_agent'
  FROM organizacoes o
 CROSS JOIN (VALUES
   ('NEXO', 'nexo',
    'Copiloto operacional: responde sobre a operacao e executa o que o usuario pedir, dentro da permissao dele.',
    'copiloto', 10),
   ('Hermes', 'hermes',
    'Executor operacional: age a partir de evento de dominio, automacao ou condicao do sistema. Nao conversa.',
    'orquestracao', 20)
 ) AS a(nome, slug, descricao, finalidade, prioridade)
 WHERE NOT EXISTS (SELECT 1 FROM ai_agents e WHERE e.organizacao_id = o.id AND e.slug = a.slug);

-- Versao 1 de cada um. `status = draft`: publicar e decisao de quem opera.
INSERT INTO ai_agent_versions (
  organizacao_id, agent_id, versao, status, system_prompt, provider, modelo,
  tools, trigger_config, handoff_config, knowledge_config, guardrail_config,
  max_steps, token_budget, history_message_window, history_token_window, cases_enabled)
SELECT ag.organizacao_id, ag.id, 1, 'draft', v.prompt, 'anthropic', 'claude-sonnet-4-6',
       v.tools::jsonb, v.trigger::jsonb, '{}'::jsonb, '{"usar_base": true}'::jsonb,
       v.guardrail::jsonb, 12, 200000, 30, 60000, true
  FROM ai_agents ag
  JOIN (VALUES
    ('nexo',
     'Voce e o NEXO, copiloto operacional do ONFACE. Responde sobre a operacao com o dado que as ferramentas devolvem, nunca de memoria. Quando nao houver dado, diga que nao ha — nao estime. Voce age SOMENTE dentro da permissao do usuario que pediu; se faltar permissao, explique o que falta em vez de tentar outro caminho. Regra comercial que voce nao contorna: Ganho exige evidencia validada pelo gate, e nenhuma ferramenta sua fecha venda.',
     '["context_read_contact","context_read_crm","context_read_conversation","knowledge_search","memory_read","task_create","lead_update_status","deal_advance","lead_tag","activity_note","followup_enroll","followup_cancel"]',
     '{"tipo": "conversa"}',
     '{"exige_aprovacao_para_mutacao": true, "autonomia": "suggest"}'),
    ('hermes',
     'Voce e o Hermes, executor operacional do ONFACE. Voce e ativado por evento de dominio, automacao ou condicao do sistema — nunca por conversa. Execute o trabalho descrito, usando as ferramentas de dominio, e pare quando ele estiver feito ou quando faltar dado. Nao invente contexto: se o evento nao trouxe o que voce precisa, registre o caso e encerre. Voce nao decide Ganho nem aprova desconto.',
     '["context_read_crm","knowledge_search","memory_read","task_create","lead_update_status","deal_advance","lead_tag","activity_note","followup_enroll","followup_cancel","handoff_request"]',
     '{"tipo": "evento", "fontes": ["domain_event", "automacao", "agendamento"]}',
     '{"exige_aprovacao_para_mutacao": true, "autonomia": "suggest"}')
  ) AS v(slug, prompt, tools, trigger, guardrail) ON v.slug = ag.slug
 WHERE NOT EXISTS (
   SELECT 1 FROM ai_agent_versions av WHERE av.agent_id = ag.id AND av.versao = 1);

COMMIT;

-- Reversao:
--   DELETE FROM ai_agent_versions WHERE agent_id IN (SELECT id FROM ai_agents WHERE slug IN ('nexo','hermes'));
--   DELETE FROM ai_agents WHERE slug IN ('nexo','hermes');
