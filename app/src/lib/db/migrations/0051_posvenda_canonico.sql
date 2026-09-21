-- ═══════════════════════════════════════════════════════════════
-- PÓS-VENDA CANÔNICO (08/09/2026)
-- Won -> Serviço -> Onboarding / Implantação PABX / Implantação White Label.
--
-- ADITIVO PURO. Nenhuma tabela, coluna, índice ou constraint existente é
-- alterada ou removida. O CRM atual não muda de comportamento.
--
-- `servicos_canonicos` já existe em produção desde a reconciliação de
-- agosto/2026 (413 linhas). O CREATE abaixo é IF NOT EXISTS e serve só pra
-- que a migration seja auto-suficiente em qualquer ambiente que ainda não a
-- tenha (foi o caso do dev). Em produção e homolog ele é no-op.
--
-- Rollback: DROP das 5 tabelas de fulfillment, na ordem inversa. Seguro
-- porque nenhuma tabela preexistente as referencia.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS servicos_canonicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
  canonical_key text NOT NULL,
  service_family text NOT NULL,
  canonical_product text,
  revenue_nature text NOT NULL,
  billing_source text NOT NULL,
  commercial_lifecycle text NOT NULL,
  billing_status text NOT NULL,
  current_recurring_value numeric(14,2) NOT NULL DEFAULT 0,
  current_subscription_id text,
  as_of_date date,
  portfolio_included boolean NOT NULL DEFAULT false,
  confidence text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, canonical_key),
  CHECK (service_family IN ('PABX','CALLFACE_AI','WHITE_LABEL','UNKNOWN')),
  CHECK (revenue_nature IN ('MRR','SETUP','PROJECT','ONE_TIME','USAGE','HARDWARE','UNKNOWN')),
  CHECK (current_recurring_value >= 0),
  CHECK (confidence IN ('CONFIRMED','PROBABLE','AMBIGUOUS','UNRESOLVED')),
  CHECK (revenue_nature = 'MRR' OR current_recurring_value = 0)
);
CREATE INDEX IF NOT EXISTS idx_servicos_canonicos_portfolio
  ON servicos_canonicos (organizacao_id, portfolio_included, service_family);

-- Uma entrega por serviço canônico (UNIQUE em servico_canonico_id) — é a
-- trava final de idempotência do pós-venda.
CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  servico_canonico_id uuid NOT NULL REFERENCES servicos_canonicos(id) ON DELETE CASCADE,
  service_family text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  responsavel_id uuid REFERENCES usuarios(id),
  started_at timestamptz,
  target_at timestamptz,
  completed_at timestamptz,
  escopo_vendido_snapshot jsonb,
  public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillments_servico      ON fulfillments(servico_canonico_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillments_public_token ON fulfillments(public_token);
CREATE INDEX IF NOT EXISTS        idx_fulfillments_org          ON fulfillments(organizacao_id);
CREATE INDEX IF NOT EXISTS        idx_fulfillments_status       ON fulfillments(organizacao_id, status);

CREATE TABLE IF NOT EXISTS fulfillment_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  workstream text NOT NULL,
  titulo text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  blocker_type text,
  blocker_reason text,
  ordem integer NOT NULL DEFAULT 0,
  metadata jsonb,
  completed_at timestamptz,
  completed_by uuid REFERENCES usuarios(id),
  responsavel_id uuid REFERENCES usuarios(id),
  due_date timestamptz,
  priority text,
  blocked_at timestamptz,
  blocker_impact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_itens_fulfillment ON fulfillment_itens(fulfillment_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_itens_org         ON fulfillment_itens(organizacao_id);

CREATE TABLE IF NOT EXISTS fulfillment_formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'NOT_SENT',
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado_em timestamptz,
  submetido_em timestamptz,
  revisado_por uuid REFERENCES usuarios(id),
  revisado_em timestamptz,
  nota_revisao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_formularios_fulfillment ON fulfillment_formularios(fulfillment_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_formularios_org         ON fulfillment_formularios(organizacao_id);

CREATE TABLE IF NOT EXISTS fulfillment_ramais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  departamento text,
  numero_externo text,
  ramal text,
  usuario text,
  email text,
  celular text,
  modelo_aparelho text,
  usa_aparelho_fisico boolean NOT NULL DEFAULT false,
  gravacao boolean NOT NULL DEFAULT false,
  ligacoes_internacionais boolean NOT NULL DEFAULT false,
  paises_permitidos text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_ramais_fulfillment ON fulfillment_ramais(fulfillment_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_ramais_org         ON fulfillment_ramais(organizacao_id);

CREATE TABLE IF NOT EXISTS fulfillment_linhas_portabilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  ddd text,
  numero text,
  tipo text NOT NULL,
  operadora_atual text,
  titular text,
  anexo_url text,
  anexo_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_linhas_port_fulfillment ON fulfillment_linhas_portabilidade(fulfillment_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_linhas_port_org         ON fulfillment_linhas_portabilidade(organizacao_id);

-- Anexos de negócio/nota. Usado pela aba Documentos da tela de entrega, portada
-- do CRM 2.0. `anexos_legado` já existe em produção (veio da reconciliação de
-- agosto) e por isso não aparece aqui.
CREATE TABLE IF NOT EXISTS anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  negocio_id uuid REFERENCES negocios(id) ON DELETE CASCADE,
  nota_id uuid REFERENCES notas(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  url text NOT NULL,
  tipo_mime text,
  tamanho_bytes integer,
  criado_por_id uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anexos_negocio ON anexos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_anexos_nota    ON anexos(nota_id);
CREATE INDEX IF NOT EXISTS idx_anexos_org     ON anexos(organizacao_id);

-- Trilha de auditoria. Usada por lib/crm/owner.ts (troca de responsável da
-- entrega), portado do CRM 2.0 junto com as telas. Não existia em produção.
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  actor_id uuid REFERENCES usuarios(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  source text NOT NULL DEFAULT 'api',
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_org    ON audit_log(organizacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
