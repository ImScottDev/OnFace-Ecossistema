-- 0122 — Callface AI: espelho do White Label (parceiros, licenças reservadas, faturas de parceiro)
--        e minuto TARIFADO ao lado da duração.
--
-- Aditiva e idempotente. Nada é escrito no banco do SaaS; só toca o ONFACE.
--
-- Por que existe: a plataforma Callface AI já tem o modelo de White Label e já cobra
-- o parceiro por licença, proporcional por dia (`partners`, `organizations.partner_id`,
-- `license.reason = 'PARTNER_WHITE_LABEL'`, `partner_invoices` + `partner_invoice_items`).
-- O ONFACE não enxergava nada disso, nem a receita vencida. Estas tabelas espelham o
-- que a plataforma faturou para que a CONFERÊNCIA contra o CRM possa existir e a
-- divergência vire pendência visível (`callface_ai_parceiro_pendencias`).
--
-- Todo id do SaaS fica em text: o espelho não presume o tipo da chave do outro lado.
-- `organizacao_id` é a organização do ONFACE que sincronizou (multi-tenant).
--
-- Parte 2: `callface_ai_tenant_snapshots` e `callface_ai_uso_diario` passam a guardar
-- a duração ao lado do minuto tarifado (`calls.billed_time`), e quantas chamadas não
-- têm `billed_time`. NULL nessas colunas = linha antiga, gravada quando `minutos`
-- ainda era a duração; o sync usa isso para reler a série de 90 dias uma vez.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS callface_ai_parceiro_pendencias, callface_ai_parceiro_fatura_itens,
--     callface_ai_parceiro_faturas, callface_ai_parceiro_licencas, callface_ai_parceiros;
--   ALTER TABLE callface_ai_tenant_snapshots DROP COLUMN IF EXISTS minutos_duracao,
--     DROP COLUMN IF EXISTS chamadas_sem_tarifa;
--   ALTER TABLE callface_ai_uso_diario DROP COLUMN IF EXISTS minutos_duracao,
--     DROP COLUMN IF EXISTS chamadas_sem_tarifa;

CREATE TABLE IF NOT EXISTS callface_ai_parceiros (
  organizacao_id        uuid NOT NULL REFERENCES organizacoes(id),
  partner_id            text NOT NULL,
  nome                  text,
  preco_por_licenca     numeric(12,2),            -- wholesale_price_per_license
  dia_faturamento       integer,                  -- billing_day
  prazo_pagamento_dias  integer,                  -- payment_terms_days
  dominio               text,                     -- custom_domain
  dns_verificado        boolean,
  ativo                 boolean,                  -- NULL = o SaaS não informa
  -- Empresa do CRM que é este parceiro. NULL = ainda sem vínculo (vira pendência).
  empresa_id            uuid REFERENCES empresas(id) ON DELETE SET NULL,
  vinculo_origem        text,                     -- organizacao | cnpj | manual
  coletado_em           timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, partner_id),
  CONSTRAINT ck_callface_ai_parceiro_vinculo CHECK (vinculo_origem IS NULL OR vinculo_origem IN ('organizacao','cnpj','manual'))
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_parceiros_empresa
  ON callface_ai_parceiros (empresa_id) WHERE empresa_id IS NOT NULL;

-- O bloco reservado: slot de organização, sem usuário, cobrado independente de quantos o usam.
CREATE TABLE IF NOT EXISTS callface_ai_parceiro_licencas (
  organizacao_id          uuid NOT NULL REFERENCES organizacoes(id),
  license_id              text NOT NULL,
  partner_id              text,                   -- organizations.partner_id da organização dona do slot
  external_organization_id text NOT NULL,
  org_nome                text,
  inicio_em               timestamp with time zone,
  revogada_em             timestamp with time zone,
  expira_em               timestamp with time zone,
  coletado_em             timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, license_id)
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_parceiro_licencas_partner
  ON callface_ai_parceiro_licencas (organizacao_id, partner_id);

CREATE TABLE IF NOT EXISTS callface_ai_parceiro_faturas (
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  invoice_id      text NOT NULL,
  partner_id      text NOT NULL,
  status          text NOT NULL,                  -- como a plataforma grava (ex.: OVERDUE)
  competencia     date,                           -- mês de referência, quando a plataforma o informa
  ciclo_inicio    date,
  ciclo_fim       date,
  vencimento      timestamp with time zone,
  paga_em         timestamp with time zone,
  total           numeric(14,2),                  -- NULL = a plataforma não informa o total
  moeda           text,
  coletado_em     timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_parceiro_faturas_partner
  ON callface_ai_parceiro_faturas (organizacao_id, partner_id, competencia);

CREATE TABLE IF NOT EXISTS callface_ai_parceiro_fatura_itens (
  organizacao_id           uuid NOT NULL REFERENCES organizacoes(id),
  item_id                  text NOT NULL,
  invoice_id               text NOT NULL,
  license_id               text,
  external_organization_id text,
  dias_ativos              integer,
  dias_no_ciclo            integer,
  proporcional             boolean,
  preco_unitario           numeric(12,2),
  total_linha              numeric(14,2),
  licenca_inicio_em        timestamp with time zone,
  licenca_revogada_em      timestamp with time zone,
  coletado_em              timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_parceiro_itens_fatura
  ON callface_ai_parceiro_fatura_itens (organizacao_id, invoice_id);

-- A conferência: uma linha por divergência. `chave` é estável, então rodar de novo
-- atualiza a mesma pendência; quando o fato some, `resolvida_em` é preenchida (a
-- linha fica, é a história). Aberta = resolvida_em IS NULL.
CREATE TABLE IF NOT EXISTS callface_ai_parceiro_pendencias (
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  chave           text NOT NULL,
  tipo            text NOT NULL,
  severidade      text NOT NULL,
  partner_id      text,
  invoice_id      text,
  mensagem        text NOT NULL,
  esperado        numeric(14,2),
  encontrado      numeric(14,2),
  detectada_em    timestamp with time zone NOT NULL DEFAULT now(),
  ultima_vista_em timestamp with time zone NOT NULL DEFAULT now(),
  resolvida_em    timestamp with time zone,
  PRIMARY KEY (organizacao_id, chave),
  CONSTRAINT ck_callface_ai_parceiro_pend_sev CHECK (severidade IN ('alta','media','info'))
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_parceiro_pend_abertas
  ON callface_ai_parceiro_pendencias (organizacao_id, severidade) WHERE resolvida_em IS NULL;

-- Parte 2: minuto tarifado ao lado da duração.
ALTER TABLE callface_ai_tenant_snapshots ADD COLUMN IF NOT EXISTS minutos_duracao numeric(14,2);
ALTER TABLE callface_ai_tenant_snapshots ADD COLUMN IF NOT EXISTS chamadas_sem_tarifa integer;
ALTER TABLE callface_ai_uso_diario ADD COLUMN IF NOT EXISTS minutos_duracao numeric(12,2);
ALTER TABLE callface_ai_uso_diario ADD COLUMN IF NOT EXISTS chamadas_sem_tarifa integer;
