-- Teto de permissao das versoes do NEXO e do Hermes (SPEC 31).
--
-- Sem isto as ferramentas passam pelos adapters de dominio — o que ja impede a
-- IA de escrever direto no banco — mas nenhuma verifica PERMISSAO. Um agente
-- configurado com a ferramenta de mover etapa move a etapa de qualquer
-- oportunidade, independentemente de quem o acionou poder fazer isso.
--
-- O risco concreto: NEXO e operado por conversa. Sem o teto, um SDR pede ao
-- agente uma acao que o papel dele nao permite, o agente executa, e o RBAC
-- inteiro vira decoracao — basta pedir ao robo.
--
-- Os dois tetos sao DIFERENTES de proposito:
--
--   NEXO    copiloto do usuario. Trabalha aquisicao e venda, porque e isso que
--           o usuario pede. NAO mexe em automacao: mudar fluxo e configuracao,
--           nao operacao, e configuracao por conversa e como se perde o
--           controle de um sistema.
--
--   HERMES  executor de evento, roda SEM usuario por tras. Teto ainda mais
--           apertado: so o que um fluxo automatico precisa fazer sozinho.
--           Nada de qualificar lead, que e julgamento comercial.
--
-- A interseccao com quem aciona acontece em runtime; isto aqui e so o limite
-- superior. Ampliar e decisao explicita de quem opera.

BEGIN;

UPDATE ai_agent_versions v
   SET guardrail_config = v.guardrail_config || jsonb_build_object(
         'permissoes', jsonb_build_array(
           'acquisition.read', 'acquisition.manage',
           'sales.read', 'sales.manage',
           'companies.read', 'cs.read', 'ai.use'
         ))
  FROM ai_agents a
 WHERE a.id = v.agent_id AND a.slug = 'nexo'
   AND NOT (v.guardrail_config ? 'permissoes');

UPDATE ai_agent_versions v
   SET guardrail_config = v.guardrail_config || jsonb_build_object(
         'permissoes', jsonb_build_array(
           'acquisition.read', 'acquisition.manage',
           'sales.read',
           'companies.read', 'ai.use'
         ))
  FROM ai_agents a
 WHERE a.id = v.agent_id AND a.slug = 'hermes'
   AND NOT (v.guardrail_config ? 'permissoes');

COMMIT;

-- Reversao:
--   UPDATE ai_agent_versions SET guardrail_config = guardrail_config - 'permissoes';
