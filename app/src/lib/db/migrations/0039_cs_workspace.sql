-- ═══════════════════════════════════════════════════════════════
-- CS + CLIENTE 360 — modelo de domínio operacional (08/09/2026)
--
-- O que já existia e NÃO é tocado: `servicos_canonicos` (verdade de
-- serviço/MRR), `fulfillments` (entrega), `contratos`, `assinaturas`,
-- `faturas` (billing Stripe), `nps_respostas` (health check ao vivo),
-- `event_outbox` (barramento). CS consome tudo isso — não duplica nada.
--
-- O que falta e esta migration cria: a camada operacional do CS —
-- jornada (marcos), risco explicável, renovação como processo, churn como
-- processo — mais os vínculos que faltavam pra tarefa/atividade existirem
-- no eixo EMPRESA (hoje só existem no eixo LEAD, que é aquisição).
--
-- Aditiva. Nenhuma coluna existente muda de tipo; a única alteração de
-- constraint é `atividades.lead_id` deixar de ser NOT NULL, o que relaxa
-- (nunca quebra) quem já escreve lá.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. `clientes` vira de fato o registro de conta do CS ───────
-- A tabela já existia com `responsavel_id` (CS owner) e é o que a Carteira
-- lê, mas estava com 8 linhas pra 299 clientes reais: o campo nasceu em
-- 18/08 e nunca foi populado. Aqui ela é normalizada e preenchida.

-- 1a. empresa_id ausente, quando dá pra resolver pelo lead legado.
UPDATE clientes c
   SET empresa_id = l.empresa_id
  FROM leads l
 WHERE l.id = c.lead_id_legado
   AND c.empresa_id IS NULL
   AND l.empresa_id IS NOT NULL;

-- 1b. Deduplicação. Não havia unique em empresa_id (gap real já anotado no
-- código da Carteira, que contorna com DISTINCT ON). Mantém a linha mais
-- recente, mas herda dela o que a mais antiga tinha e ela não tem —
-- perder um CS owner ou um cliente_desde por causa de dedupe seria pior
-- que a duplicata.
WITH ranked AS (
  SELECT id, organizacao_id, empresa_id,
         ROW_NUMBER() OVER (PARTITION BY organizacao_id, empresa_id ORDER BY updated_at DESC, created_at DESC) AS rn
    FROM clientes
   WHERE empresa_id IS NOT NULL
),
sobrevivente AS (SELECT id, organizacao_id, empresa_id FROM ranked WHERE rn = 1),
merge AS (
  SELECT s.id AS destino,
         MIN(c.cliente_desde) FILTER (WHERE c.cliente_desde IS NOT NULL) AS cliente_desde,
         (array_agg(c.responsavel_id) FILTER (WHERE c.responsavel_id IS NOT NULL))[1] AS responsavel_id,
         (array_agg(c.pessoa_principal_id) FILTER (WHERE c.pessoa_principal_id IS NOT NULL))[1] AS pessoa_principal_id
    FROM sobrevivente s
    JOIN clientes c ON c.organizacao_id = s.organizacao_id AND c.empresa_id = s.empresa_id
   GROUP BY s.id
)
UPDATE clientes c
   SET cliente_desde       = COALESCE(c.cliente_desde, m.cliente_desde),
       responsavel_id      = COALESCE(c.responsavel_id, m.responsavel_id),
       pessoa_principal_id = COALESCE(c.pessoa_principal_id, m.pessoa_principal_id)
  FROM merge m
 WHERE c.id = m.destino;

DELETE FROM clientes c
 WHERE c.empresa_id IS NOT NULL
   AND c.id NOT IN (
     SELECT DISTINCT ON (organizacao_id, empresa_id) id
       FROM clientes WHERE empresa_id IS NOT NULL
      ORDER BY organizacao_id, empresa_id, updated_at DESC, created_at DESC
   );

-- Parcial: as linhas de teste E2E sem empresa_id continuam válidas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_org_empresa
  ON clientes (organizacao_id, empresa_id) WHERE empresa_id IS NOT NULL;

-- 1c. Colunas de contexto de CS.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS entrou_carteira_em   timestamptz;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS observacoes_cs       text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS jornada_iniciada_em  timestamptz;

-- 1d. Backfill: toda empresa que hoje tem serviço no portfólio é uma conta
-- de CS, mesmo sem owner definido — "sem responsável" é justamente um dos
-- filtros que o CS precisa enxergar. `entrou_carteira_em` usa a data real
-- do serviço mais antigo, nunca now().
INSERT INTO clientes (organizacao_id, empresa_id, cliente_desde, entrou_carteira_em, status_financeiro)
SELECT sc.organizacao_id, sc.empresa_id, MIN(sc.created_at), MIN(sc.created_at), NULL
  FROM servicos_canonicos sc
 WHERE sc.empresa_id IS NOT NULL AND sc.portfolio_included = true
 GROUP BY sc.organizacao_id, sc.empresa_id
    ON CONFLICT (organizacao_id, empresa_id) WHERE empresa_id IS NOT NULL DO NOTHING;

UPDATE clientes c
   SET entrou_carteira_em = COALESCE(c.entrou_carteira_em, c.cliente_desde, c.created_at)
 WHERE c.empresa_id IS NOT NULL AND c.entrou_carteira_em IS NULL;

-- ─── 2. Tarefa e atividade no eixo EMPRESA ──────────────────────
-- `tarefas`/`atividades` só sabiam falar de lead e negócio, que são
-- objetos de aquisição. O CS trabalha por empresa e, quando faz sentido,
-- por serviço — sem isso um marco de 3 meses não teria onde se pendurar.

ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS empresa_id           uuid REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS servico_canonico_id  uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL;
-- MANUAL | PLAYBOOK | BILLING | ONBOARDING | IMPLANTACAO | RENOVACAO | RISCO | EXPANSAO | AUTOMACAO
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS origem               text NOT NULL DEFAULT 'MANUAL';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS motivo               text;
-- Trava de idempotência das tarefas automáticas: mesmo marco/sinal nunca
-- gera duas tarefas, por mais vezes que o sweep rode.
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS chave_idempotencia   text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tarefas_chave_idem ON tarefas (organizacao_id, chave_idempotencia)
  WHERE chave_idempotencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_empresa ON tarefas (empresa_id) WHERE empresa_id IS NOT NULL;

ALTER TABLE atividades ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE atividades ALTER COLUMN lead_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_atividades_empresa ON atividades (empresa_id) WHERE empresa_id IS NOT NULL;

-- Expansão não é entidade nova: é `negocios` com commercial_motion =
-- 'EXPANSION' (coluna que já existe). O que faltava era saber de qual
-- serviço ela nasceu.
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS servico_origem_id uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL;

-- ─── 3. cs_marcos — a jornada de CS ─────────────────────────────
-- Distinta de onboarding/implantação (`fulfillments`): aquilo é entrega do
-- que foi vendido e termina; isto é relacionamento e não termina. Um marco
-- é uma data com um objetivo; a tarefa é o que o CS de fato executa, e é
-- gerada só quando o marco vence (não 12 tarefas no dia 1).
CREATE TABLE IF NOT EXISTS cs_marcos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- Marco de relacionamento é por CONTA. Só o de renovação é por serviço,
  -- porque vigência é do contrato/serviço, não da empresa.
  servico_canonico_id uuid REFERENCES servicos_canonicos(id) ON DELETE CASCADE,
  codigo text NOT NULL,          -- D0 | D7 | D30 | M3 | M6 | M9 | RENOVACAO
  ciclo integer NOT NULL DEFAULT 1,
  titulo text NOT NULL,
  objetivo text,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE',  -- PENDENTE | CONCLUIDO | PULADO
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE SET NULL,
  tarefa_gerada_em timestamptz,
  resultado jsonb,               -- respostas do checklist + notas do CS
  concluido_em timestamptz,
  concluido_por uuid REFERENCES usuarios(id),
  chave_idempotencia text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (codigo IN ('D0','D7','D30','M3','M6','M9','RENOVACAO')),
  CHECK (status IN ('PENDENTE','CONCLUIDO','PULADO')),
  UNIQUE (organizacao_id, chave_idempotencia)
);
CREATE INDEX IF NOT EXISTS idx_cs_marcos_empresa ON cs_marcos (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_cs_marcos_due     ON cs_marcos (organizacao_id, status, due_date);

-- ─── 4. cs_riscos — sinal explicável, nunca score inventado ─────
-- Regra fechada do projeto: risco tem MOTIVO e FONTE. Cada linha aqui é um
-- sinal real e verificável, com histórico preservado quando some (resolve,
-- não apaga).
CREATE TABLE IF NOT EXISTS cs_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  servico_canonico_id uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  severidade text NOT NULL,      -- ATENCAO | EM_RISCO | CRITICO
  origem text NOT NULL,          -- AUTOMATICO | MANUAL
  motivo text NOT NULL,
  fonte text NOT NULL,           -- tabela/serviço de onde o sinal veio
  detalhe jsonb,
  status text NOT NULL DEFAULT 'ABERTO',  -- ABERTO | RESOLVIDO
  responsavel_id uuid REFERENCES usuarios(id),
  aberto_em timestamptz NOT NULL DEFAULT now(),
  aberto_por uuid REFERENCES usuarios(id),
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES usuarios(id),
  resolucao text,
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (severidade IN ('ATENCAO','EM_RISCO','CRITICO')),
  CHECK (origem IN ('AUTOMATICO','MANUAL')),
  CHECK (status IN ('ABERTO','RESOLVIDO'))
);
-- Um sinal aberto por tipo/serviço — o sweep reavalia, não empilha.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_riscos_aberto_unico
  ON cs_riscos (empresa_id, tipo, COALESCE(servico_canonico_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'ABERTO';
CREATE INDEX IF NOT EXISTS idx_cs_riscos_org ON cs_riscos (organizacao_id, status, severidade);

-- ─── 5. cs_renovacoes — renovação como processo ─────────────────
-- Por SERVIÇO, com vigência real do contrato quando existe. Sem contrato
-- com prazo, não inventa data: fica sem renovação em vez de assumir 12
-- meses (assinatura Stripe sem termo não vence, renova sozinha).
CREATE TABLE IF NOT EXISTS cs_renovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  servico_canonico_id uuid NOT NULL REFERENCES servicos_canonicos(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
  ciclo integer NOT NULL DEFAULT 1,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'FUTURA',  -- FUTURA | ABERTA | EM_NEGOCIACAO | RENOVADA | NAO_RENOVADA
  janela_aberta_em timestamptz,
  valor_atual numeric(14,2),
  valor_proposto numeric(14,2),
  novo_vencimento date,
  novo_prazo_meses integer,
  responsavel_id uuid REFERENCES usuarios(id),
  negocio_id uuid REFERENCES negocios(id) ON DELETE SET NULL,
  observacoes text,
  decidido_em timestamptz,
  decidido_por uuid REFERENCES usuarios(id),
  motivo_nao_renovacao text,
  chave_idempotencia text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('FUTURA','ABERTA','EM_NEGOCIACAO','RENOVADA','NAO_RENOVADA')),
  UNIQUE (organizacao_id, chave_idempotencia)
);
CREATE INDEX IF NOT EXISTS idx_cs_renovacoes_empresa ON cs_renovacoes (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_cs_renovacoes_janela  ON cs_renovacoes (organizacao_id, status, vencimento);

-- ─── 6. cs_cancelamentos — churn como processo ──────────────────
-- Cliente nunca é apagado. O pedido vira um processo com etapa, motivo
-- estruturado e data efetiva; só no fim o serviço é encerrado.
CREATE TABLE IF NOT EXISTS cs_cancelamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  servico_canonico_id uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'SOLICITADO',  -- SOLICITADO | EM_RETENCAO | RETIDO | APROVADO | EFETIVADO
  motivo text NOT NULL,
  motivo_detalhe text,
  canal text,                    -- como o pedido chegou
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  solicitado_por uuid REFERENCES usuarios(id),
  data_desejada date,
  -- Checagens obrigatórias antes de efetivar; null = ainda não verificado.
  contrato_vigente boolean,
  multa_aplicavel boolean,
  multa_valor numeric(14,2),
  pendencia_financeira numeric(14,2),
  equipamentos_pendentes text,
  tentativa_retencao text,
  oferta_retencao text,
  decisao text,                  -- RETIDO | CANCELADO
  decidido_em timestamptz,
  decidido_por uuid REFERENCES usuarios(id),
  data_efetiva date,
  motivo_final text,
  motivo_final_detalhe text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('SOLICITADO','EM_RETENCAO','RETIDO','APROVADO','EFETIVADO'))
);
CREATE INDEX IF NOT EXISTS idx_cs_cancelamentos_empresa ON cs_cancelamentos (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_cs_cancelamentos_org     ON cs_cancelamentos (organizacao_id, status);
