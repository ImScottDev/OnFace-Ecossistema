-- Numeração de proposta atômica e única (13/10/2026).
--
-- `MAX(numero)+1` na aplicação deixava duas propostas criadas ao mesmo tempo
-- saírem com o mesmo número (evidência: #1561, #1562 e #1563 existem duas
-- vezes, criadas em 08-09/10/2026). O número é compartilhado entre as versões
-- de uma proposta (#P-1177-v1, #P-1177-v2), então a identidade é
-- (organizacao_id, numero, versao).
--
-- 1) `proposta_sequencias`: um contador por organização, incrementado por
--    INSERT ... ON CONFLICT DO UPDATE ... RETURNING (a linha trava até o commit).
-- 2) Duplicatas que JÁ existem não podem derrubar a migration nem ser
--    renumeradas (o cliente pode ter o número): a mais antiga de cada grupo
--    continua valendo e as demais ficam marcadas em `numero_duplicado_legado`.
--    O índice único não olha as marcadas. Para listar: SELECT * FROM propostas
--    WHERE numero_duplicado_legado.
-- 3) Índice único parcial (organizacao_id, numero, versao) para todo o resto.
-- Idempotente: reexecutar não muda nada.

CREATE TABLE IF NOT EXISTS proposta_sequencias (
  organizacao_id uuid PRIMARY KEY REFERENCES organizacoes(id),
  ultimo_numero integer NOT NULL
);

INSERT INTO proposta_sequencias (organizacao_id, ultimo_numero)
SELECT organizacao_id, max(numero) FROM propostas GROUP BY organizacao_id
ON CONFLICT (organizacao_id) DO UPDATE
  SET ultimo_numero = GREATEST(proposta_sequencias.ultimo_numero, EXCLUDED.ultimo_numero);

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS numero_duplicado_legado boolean NOT NULL DEFAULT false;

UPDATE propostas SET numero_duplicado_legado = true
 WHERE id IN (
   SELECT id FROM (
     SELECT id, row_number() OVER (PARTITION BY organizacao_id, numero, versao ORDER BY created_at, id) AS ordem
       FROM propostas WHERE NOT numero_duplicado_legado
   ) t WHERE ordem > 1
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_propostas_org_numero_versao
  ON propostas (organizacao_id, numero, versao) WHERE NOT numero_duplicado_legado;
