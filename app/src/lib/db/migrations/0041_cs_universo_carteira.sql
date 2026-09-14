-- ═══════════════════════════════════════════════════════════════
-- CS — alinhar o universo de contas ao da Carteira (08/09/2026)
--
-- 0039 backfillou `clientes` só com quem tem serviço no portfólio (299).
-- A Carteira (GET /clientes-crm2) trabalha com 302: inclui também a empresa
-- 100% CHURNED sem nenhum serviço ativo. Duas listas de cliente com
-- universos diferentes é exatamente o tipo de divergência que faz o CS e o
-- gestor discutirem qual número está certo — e o cliente que cancelou é
-- justamente onde mora o histórico de churn que o CS precisa consultar.
--
-- Empresa que só tem serviço SUPERSEDED ou fora do portfólio fica de fora:
-- nunca foi cliente ativo.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO clientes (organizacao_id, empresa_id, cliente_desde, entrou_carteira_em, cs_sem_evidencia)
SELECT sc.organizacao_id, sc.empresa_id, MIN(sc.created_at), MIN(sc.created_at), true
  FROM servicos_canonicos sc
 WHERE sc.empresa_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM servicos_canonicos s2
      WHERE s2.empresa_id = sc.empresa_id
        AND (s2.portfolio_included = true OR s2.commercial_lifecycle = 'CHURNED'))
 GROUP BY sc.organizacao_id, sc.empresa_id
    ON CONFLICT (organizacao_id, empresa_id) WHERE empresa_id IS NOT NULL DO NOTHING;

-- Mesma correção de evidência da 0040, agora pras contas recém-incluídas.
WITH evidencia AS (
  SELECT c.id,
         (SELECT MIN(n.ganho_at) FROM negocios n WHERE n.empresa_id = c.empresa_id AND n.status = 'ganho') AS won,
         (SELECT MIN(ct.inicio) FROM contratos ct
            JOIN servicos_canonicos sc ON sc.contrato_id = ct.id
           WHERE sc.empresa_id = c.empresa_id) AS contrato_inicio,
         (SELECT MIN(f.emitida_em) FROM faturas f WHERE f.empresa_id = c.empresa_id) AS primeira_fatura
    FROM clientes c
   WHERE c.empresa_id IS NOT NULL AND c.cs_sem_evidencia = true
)
UPDATE clientes c
   SET entrou_carteira_em = COALESCE(e.won, e.contrato_inicio::timestamptz, e.primeira_fatura, c.entrou_carteira_em),
       cliente_desde      = COALESCE(e.won, e.contrato_inicio::timestamptz, e.primeira_fatura, c.cliente_desde),
       cs_sem_evidencia   = (e.won IS NULL AND e.contrato_inicio IS NULL AND e.primeira_fatura IS NULL)
  FROM evidencia e
 WHERE c.id = e.id;
