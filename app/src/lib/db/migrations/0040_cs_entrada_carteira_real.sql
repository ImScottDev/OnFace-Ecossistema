-- ═══════════════════════════════════════════════════════════════
-- CS — corrigir a data de entrada na carteira (08/09/2026)
--
-- 0039 preencheu `entrou_carteira_em` com MIN(servicos_canonicos.created_at),
-- que parecia razoável e não é: os serviços foram todos escritos na
-- reconciliação de agosto/2026, então as 299 contas ficaram com a mesma
-- data e a jornada inteira nasceu com marcos de agosto — 597 marcos
-- "vencidos" que virariam 597 tarefas no primeiro sweep.
--
-- Aqui a data vem de evidência real, em ordem de confiança:
--   1. primeiro negócio GANHO da empresa (188 de 299)
--   2. início do contrato ligado a um serviço da empresa (96)
--   3. primeira fatura emitida (96)
-- Cobertura combinada: 208 de 299. As 91 sem nenhuma evidência ficam com a
-- data da reconciliação — sinalizada, não inventada (ver `cs_sem_evidencia`).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cs_sem_evidencia boolean NOT NULL DEFAULT false;

WITH evidencia AS (
  SELECT c.id,
         (SELECT MIN(n.ganho_at) FROM negocios n
           WHERE n.empresa_id = c.empresa_id AND n.status = 'ganho')                       AS won,
         (SELECT MIN(ct.inicio) FROM contratos ct
            JOIN servicos_canonicos sc ON sc.contrato_id = ct.id
           WHERE sc.empresa_id = c.empresa_id)                                             AS contrato_inicio,
         (SELECT MIN(f.emitida_em) FROM faturas f WHERE f.empresa_id = c.empresa_id)       AS primeira_fatura
    FROM clientes c
   WHERE c.empresa_id IS NOT NULL
)
UPDATE clientes c
   SET entrou_carteira_em = COALESCE(e.won, e.contrato_inicio::timestamptz, e.primeira_fatura, c.entrou_carteira_em),
       cliente_desde      = COALESCE(e.won, e.contrato_inicio::timestamptz, e.primeira_fatura, c.cliente_desde),
       cs_sem_evidencia   = (e.won IS NULL AND e.contrato_inicio IS NULL AND e.primeira_fatura IS NULL)
  FROM evidencia e
 WHERE c.id = e.id;

-- Marcos já semeados com a data errada são descartados e refeitos pela
-- aplicação (iniciarJornadaCs é idempotente e recalcula tudo). Só os que
-- ninguém tocou: marco concluído/pulado por uma PESSOA é registro de
-- trabalho real e fica.
DELETE FROM cs_marcos
 WHERE status = 'PENDENTE' AND tarefa_id IS NULL AND concluido_em IS NULL;

UPDATE clientes SET jornada_iniciada_em = NULL
 WHERE empresa_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM cs_marcos m WHERE m.empresa_id = clientes.empresa_id);
