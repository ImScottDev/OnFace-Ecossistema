-- Uma ação proposta pelo NEXO pode ser confirmada no máximo uma vez, mesmo
-- quando duas requisições chegam simultaneamente ou há retry do navegador.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_agent_runs_nexo_confirmacao
  ON ai_agent_runs (organizacao_id, ((input->'payload'->>'confirmaDe')))
  WHERE input->'payload'->>'canal' = 'nexo_confirmacao'
    AND input->'payload'->>'confirmaDe' IS NOT NULL;
