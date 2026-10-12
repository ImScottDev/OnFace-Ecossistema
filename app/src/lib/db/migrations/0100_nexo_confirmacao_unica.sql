-- Uma ação proposta pelo NEXO pode ser confirmada no máximo uma vez, mesmo
-- quando duas requisições chegam simultaneamente ou há retry do navegador.
--
-- Bancos que já rodaram sem a trava podem ter a mesma ação confirmada duas
-- vezes. A auditoria fica: a primeira execução mantém a chave e as repetidas
-- ganham um sufixo com o próprio id, para o índice único poder nascer.
WITH ordenadas AS (
  SELECT id,
         row_number() OVER (PARTITION BY organizacao_id, input->'payload'->>'confirmaDe' ORDER BY started_at, id) AS n
    FROM ai_agent_runs
   WHERE input->'payload'->>'canal' = 'nexo_confirmacao'
     AND input->'payload'->>'confirmaDe' IS NOT NULL
)
UPDATE ai_agent_runs r
   SET input = jsonb_set(r.input, '{payload,confirmaDe}', to_jsonb((r.input->'payload'->>'confirmaDe') || ':repetida:' || r.id::text))
  FROM ordenadas o
 WHERE o.id = r.id AND o.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_agent_runs_nexo_confirmacao
  ON ai_agent_runs (organizacao_id, ((input->'payload'->>'confirmaDe')))
  WHERE input->'payload'->>'canal' = 'nexo_confirmacao'
    AND input->'payload'->>'confirmaDe' IS NOT NULL;
