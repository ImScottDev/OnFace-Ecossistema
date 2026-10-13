-- 0105 — Callface AI: vínculo com evidência, pendências com razão, detalhe e série diária
--
-- Aditiva e idempotente. Nada é escrito no banco do SaaS; esta migration só
-- toca o ONFACE.
--
-- 1. VÍNCULO AUDITÁVEL. `callface_ai_external_identities` ganha a evidência
--    (qual chave casou, valor normalizado, quando) e o estado:
--      auto        = o sync ligou sozinho, com sinal determinístico
--      confirmado  = uma pessoa confirmou uma pendência
--      manual      = uma pessoa escolheu a organização na mão
--    Quem mexeu e quando fica em audit_log (action callface_ai.vinculo.*).
--
-- 2. PENDÊNCIA COM RAZÃO. `callface_ai_reconciliation_candidates` ganha a
--    evidência, o motivo de não ter ligado sozinho e o nome da organização do
--    SaaS, e passa a ter chave única (empresa, organização) para o sync poder
--    reatualizar a sugestão sem empilhar.
--
-- 3. DETALHE por vínculo (plano, licenças, usuários, campanhas, agentes,
--    integrações) e SÉRIE DIÁRIA de ligações/minutos. As telas leem essas
--    tabelas; nunca o banco do SaaS.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS callface_ai_uso_diario;
--   DROP TABLE IF EXISTS callface_ai_tenant_detalhe;
--   DROP INDEX IF EXISTS uq_callface_ai_recon_empresa_org;
--   ALTER TABLE callface_ai_reconciliation_candidates
--     DROP COLUMN IF EXISTS evidencia, DROP COLUMN IF EXISTS razao, DROP COLUMN IF EXISTS org_nome,
--     DROP COLUMN IF EXISTS decidido_por, DROP COLUMN IF EXISTS decidido_em, DROP COLUMN IF EXISTS updated_at;
--   ALTER TABLE callface_ai_external_identities
--     DROP COLUMN IF EXISTS evidencia, DROP COLUMN IF EXISTS estado, DROP COLUMN IF EXISTS org_nome;

ALTER TABLE callface_ai_external_identities
  ADD COLUMN IF NOT EXISTS evidencia jsonb,
  ADD COLUMN IF NOT EXISTS estado    text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS org_nome  text;

DO $$ BEGIN
  ALTER TABLE callface_ai_external_identities
    ADD CONSTRAINT ck_callface_ai_ident_estado CHECK (estado IN ('auto','confirmado','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE callface_ai_reconciliation_candidates
  ADD COLUMN IF NOT EXISTS evidencia   jsonb,
  ADD COLUMN IF NOT EXISTS razao       text,
  ADD COLUMN IF NOT EXISTS org_nome    text,
  ADD COLUMN IF NOT EXISTS decidido_por uuid,
  ADD COLUMN IF NOT EXISTS decidido_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp with time zone NOT NULL DEFAULT now();

-- status: pendente | confirmado | rejeitado | resolvido (o sync ligou sozinho depois)
CREATE UNIQUE INDEX IF NOT EXISTS uq_callface_ai_recon_empresa_org
  ON callface_ai_reconciliation_candidates (empresa_id, external_organization_id);

CREATE TABLE IF NOT EXISTS callface_ai_tenant_detalhe (
  external_identity_id uuid PRIMARY KEY REFERENCES callface_ai_external_identities(id) ON DELETE CASCADE,
  org_nome             text,
  org_criada_em        timestamp with time zone,
  org_desativada_em    timestamp with time zone,
  -- {contratadas, atribuidas, minutosContratados, ilimitado, porPlano:[{plano,motivo,qtd,minutos}]}
  licencas             jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- lista curta, mais ativos primeiro
  usuarios             jsonb NOT NULL DEFAULT '[]'::jsonb,
  campanhas            jsonb NOT NULL DEFAULT '{}'::jsonb,
  agentes              jsonb NOT NULL DEFAULT '{}'::jsonb,
  integracoes          jsonb NOT NULL DEFAULT '{}'::jsonb,
  coletado_em          timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callface_ai_uso_diario (
  external_identity_id uuid NOT NULL REFERENCES callface_ai_external_identities(id) ON DELETE CASCADE,
  dia                  date NOT NULL,              -- dia civil em America/Sao_Paulo
  chamadas             integer NOT NULL DEFAULT 0,
  finalizadas          integer NOT NULL DEFAULT 0,
  minutos              numeric(12,2) NOT NULL DEFAULT 0,
  usuarios_ativos      integer NOT NULL DEFAULT 0,
  coletado_em          timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (external_identity_id, dia)
);
