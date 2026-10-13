-- 0123 — Callface AI, retrato do cliente na plataforma (Fase 6): espelho do plano,
--        do Stripe conectado, das licenças por tipo, dos usuários por papel e estado,
--        de workspaces/equipes e dos receptivos (DIDs).
--
-- Aditiva e idempotente. Nada é escrito no banco do SaaS; só toca o ONFACE.
--
-- Por que existe: o CRM só enxergava contagens (usuários, licenças ativas). Não sabia
-- qual plano a organização usa nem por qual preço de tabela, se o Stripe está
-- conectado, se a licença é teste ou paga, quem é admin e quem foi desativado, nem
-- que números receptivos foram entregues. `users_organizations.crm_user_id` (vínculo
-- direto com o usuário do ONFACE) passa a ser guardado também.
--
-- Todo id do SaaS fica em text. `organizacao_id` é a organização do ONFACE que
-- sincronizou (multi-tenant). Nenhuma coluna guarda nome ou e-mail de pessoa.
-- O motivo, a expiração e a revogação da licença ficam CRUS: "ativa hoje" e
-- "pagante" são decididos na leitura, porque mudam com o tempo.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS callface_ai_planos, callface_ai_org_stripe, callface_ai_licencas,
--     callface_ai_usuarios, callface_ai_equipes, callface_ai_receptivos;

CREATE TABLE IF NOT EXISTS callface_ai_planos (
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  plan_id         text NOT NULL,
  nome            text,
  preco           numeric(12,2),            -- preço de TABELA do plano; NULL = coluna de preço não reconhecida
  preco_coluna    text,                     -- de qual coluna do SaaS o preço saiu
  stripe_price_id text,
  intervalo       text,
  coletado_em     timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, plan_id)
);

CREATE TABLE IF NOT EXISTS callface_ai_org_stripe (
  organizacao_id           uuid NOT NULL REFERENCES organizacoes(id),
  external_organization_id text NOT NULL,
  stripe_customer_id       text,            -- NULL = Stripe não conectado
  stripe_migrado           boolean,         -- has_stripe_migrated; NULL = nulo no SaaS
  coletado_em              timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, external_organization_id)
);

CREATE TABLE IF NOT EXISTS callface_ai_licencas (
  organizacao_id           uuid NOT NULL REFERENCES organizacoes(id),
  license_id               text NOT NULL,
  external_organization_id text NOT NULL,
  plan_id                  text,
  motivo                   text NOT NULL,   -- TRIAL | SUBSCRIPTION_PAID | INTERNAL | PARTNER_WHITE_LABEL | ...
  inicio_em                timestamp with time zone,
  revogada_em              timestamp with time zone,
  expira_em                timestamp with time zone,
  atribuida                boolean NOT NULL DEFAULT false,
  coletado_em              timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, license_id)
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_licencas_org
  ON callface_ai_licencas (organizacao_id, external_organization_id);

CREATE TABLE IF NOT EXISTS callface_ai_usuarios (
  organizacao_id           uuid NOT NULL REFERENCES organizacoes(id),
  vinculo_id               text NOT NULL,   -- users_organizations.id
  external_organization_id text NOT NULL,
  papel                    text NOT NULL,   -- CREATOR | ADMIN | MANAGER | EMPLOYEE
  aceite                   text,            -- acceptance_status
  convite                  text,            -- invite_status
  desativado_em            timestamp with time zone,
  usuario_ativo            boolean NOT NULL DEFAULT true,   -- users.active
  crm_user_id              text,            -- users_organizations.crm_user_id
  coletado_em              timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, vinculo_id)
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_usuarios_org
  ON callface_ai_usuarios (organizacao_id, external_organization_id);
CREATE INDEX IF NOT EXISTS idx_callface_ai_usuarios_crm
  ON callface_ai_usuarios (organizacao_id, crm_user_id) WHERE crm_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS callface_ai_equipes (
  organizacao_id           uuid NOT NULL REFERENCES organizacoes(id),
  tipo                     text NOT NULL,   -- workspace | equipe
  ref_id                   text NOT NULL,
  external_organization_id text NOT NULL,
  nome                     text,
  status                   text,
  coletado_em              timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, tipo, ref_id),
  CONSTRAINT ck_callface_ai_equipes_tipo CHECK (tipo IN ('workspace','equipe'))
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_equipes_org
  ON callface_ai_equipes (organizacao_id, external_organization_id);

CREATE TABLE IF NOT EXISTS callface_ai_receptivos (
  organizacao_id           uuid NOT NULL REFERENCES organizacoes(id),
  did_id                   text NOT NULL,
  external_organization_id text NOT NULL,
  numero                   text NOT NULL,
  destino_tipo             text,            -- usuario | ura | workspace | ...
  destino_id               text,
  disponivel               boolean,         -- NULL = a plataforma não informa
  status                   text,
  coletado_em              timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, did_id)
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_receptivos_org
  ON callface_ai_receptivos (organizacao_id, external_organization_id);
