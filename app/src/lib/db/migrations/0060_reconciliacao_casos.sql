-- Casos de reconciliação de identidade (SPEC §40, fase 05 do refactor).
--
-- O SPEC é explícito: quando a identidade é ambígua, cria-se um caso de
-- reconciliação e NÃO se faz merge destrutivo. Esta tabela é onde o caso vive.
--
-- Sem ela, a alternativa seria escolher um vencedor por heurística e perder a
-- outra linha em silêncio, que é exatamente o que o SPEC §56 proíbe
-- ("never invent mapping for ambiguous data", "surface unresolved cases").

BEGIN;

CREATE TABLE IF NOT EXISTS reconciliacao_casos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  -- Qual backfill levantou o caso: identidade, aquisição, oportunidade, etc.
  fase            text NOT NULL,
  tipo            text NOT NULL,
  entidade_alvo   text NOT NULL,
  -- As linhas de origem envolvidas. Nenhuma é apagada nem alterada: o caso
  -- existe justamente para que a decisão seja humana e posterior.
  origens         jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidencia       jsonb NOT NULL DEFAULT '{}'::jsonb,
  sugestao        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'OPEN',
  resolvido_por_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  resolvido_em    timestamptz,
  resolucao       jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_reconciliacao_status CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  -- Reexecutar o backfill não pode multiplicar o mesmo caso.
  CONSTRAINT uq_reconciliacao_caso UNIQUE (fase, tipo, entidade_alvo, status)
);
CREATE INDEX IF NOT EXISTS idx_reconciliacao_abertos ON reconciliacao_casos (fase, status) WHERE status = 'OPEN';

-- Provenance do backfill: de qual linha legada cada registro canônico nasceu.
-- O SPEC §41 pede preservar o ID legado "in migration provenance, not as
-- permanent business dependency" — por isso fica aqui, e não como FK no domínio.
CREATE TABLE IF NOT EXISTS backfill_provenance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id    uuid NOT NULL REFERENCES organizacoes(id),
  fase              text NOT NULL,
  entidade_canonica text NOT NULL,
  id_canonico       uuid NOT NULL,
  tabela_origem     text NOT NULL,
  id_origem         text NOT NULL,
  chave_identidade  text,
  metodo            text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_backfill_provenance UNIQUE (entidade_canonica, tabela_origem, id_origem)
);
CREATE INDEX IF NOT EXISTS idx_backfill_prov_canonico ON backfill_provenance (entidade_canonica, id_canonico);
CREATE INDEX IF NOT EXISTS idx_backfill_prov_origem ON backfill_provenance (tabela_origem, id_origem);

COMMIT;
