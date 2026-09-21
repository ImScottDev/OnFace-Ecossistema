-- Expansão do modelo canônico — plataforma (SPEC §38.2, fase 04 do refactor).
--
-- EXPAND puro, igual à 0057: só cria e adiciona coluna nulável. Nada existente é
-- alterado de forma incompatível, nada é removido, nenhum dado se move.
--
-- Cobre automação (§25), RBAC (§31) e arquivos (§32).

BEGIN;

-- ─── Automação (SPEC §25.1) ───────────────────────────────────────────────────
-- Hoje convivem três gerações: `cadencia_execucoes` com 1.273 linhas, as sete
-- tabelas `cadence_*` vazias e as três de sequência de e-mail vazias. O SPEC
-- manda convergir para um motor só. Estas tabelas são o destino da convergência;
-- a migração de comportamento acontece na fase 18.

-- Definição imutável e versionada do fluxo. Publicar cria versão nova em vez de
-- editar a anterior: execução em andamento não pode mudar de regra no meio.
CREATE TABLE IF NOT EXISTS automacao_versoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  automacao_id    uuid NOT NULL REFERENCES automacoes(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  nodes           jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges           jsonb NOT NULL DEFAULT '[]'::jsonb,
  trigger_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at    timestamptz,
  created_by_id   uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_automacao_versoes UNIQUE (automacao_id, version)
);
CREATE INDEX IF NOT EXISTS idx_automacao_versoes_automacao ON automacao_versoes (automacao_id, version DESC);

-- `automacoes` e `automacao_execucoes` existem desde antes e estão vazias, mas
-- não têm as colunas que o SPEC exige. Adicionadas como nuláveis para não
-- quebrar nada; viram obrigatórias no CONTRACT, depois do cutover.
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS tipo               text;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS current_version_id uuid REFERENCES automacao_versoes(id) ON DELETE SET NULL;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS created_by_id      uuid REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS version_id       uuid REFERENCES automacao_versoes(id) ON DELETE SET NULL;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS trigger_event_id uuid REFERENCES domain_events(id) ON DELETE SET NULL;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS started_at       timestamptz;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS finished_at      timestamptz;

-- Histórico passo a passo: sem isso não há como responder onde uma execução
-- parou, que é a pergunta que se faz quando uma automação não entrega.
CREATE TABLE IF NOT EXISTS automacao_passos_execucao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  execucao_id    uuid NOT NULL REFERENCES automacao_execucoes(id) ON DELETE CASCADE,
  node_id        text NOT NULL,
  node_type      text NOT NULL,
  ordem          integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'PENDING',
  input          jsonb NOT NULL DEFAULT '{}'::jsonb,
  output         jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro           text,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_automacao_passos_status
    CHECK (status IN ('PENDING','RUNNING','DONE','FAILED','SKIPPED','WAITING'))
);
CREATE INDEX IF NOT EXISTS idx_automacao_passos_execucao ON automacao_passos_execucao (execucao_id, ordem);

-- Inscrição em jornada longa: é o que uma cadência realmente é. Substitui
-- `cadence_enrollments` (0 linhas) e `cadencia_execucoes` (1.273) na fase 18.
CREATE TABLE IF NOT EXISTS automacao_inscricoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  automacao_id    uuid NOT NULL REFERENCES automacoes(id) ON DELETE CASCADE,
  version_id      uuid REFERENCES automacao_versoes(id) ON DELETE SET NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  status          text NOT NULL DEFAULT 'ACTIVE',
  current_node_id text,
  proximo_passo_em timestamptz,
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  motivo_saida    text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_automacao_inscricoes_status
    CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','CANCELLED','FAILED')),
  -- A mesma entidade não entra duas vezes na mesma automação enquanto a
  -- primeira inscrição estiver viva. É a trava que falta hoje e que deixa a
  -- mesma pessoa receber a cadência em duplicidade.
  CONSTRAINT uq_automacao_inscricao_ativa UNIQUE (automacao_id, entity_type, entity_id, status)
);
CREATE INDEX IF NOT EXISTS idx_automacao_inscricoes_devido
  ON automacao_inscricoes (proximo_passo_em) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_automacao_inscricoes_entidade
  ON automacao_inscricoes (entity_type, entity_id);

-- ─── RBAC (SPEC §31) ──────────────────────────────────────────────────────────
-- Hoje `usuarios.role` é texto com 8 valores que entregam 3 comportamentos reais:
-- director, coordinator e operations são rótulos sem escopo próprio. Sem permissão
-- nomeada não há como um agente de IA receber escopo menor que o do usuário, que
-- é o que o SPEC §31 exige.

CREATE TABLE IF NOT EXISTS permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  dominio     text NOT NULL,
  descricao   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  codigo          text NOT NULL,
  nome            text NOT NULL,
  descricao       text,
  -- Papel de sistema não pode ser apagado pelo usuário: é o que garante que
  -- sempre exista alguém capaz de administrar o workspace.
  sistema         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_roles_codigo UNIQUE (organizacao_id, codigo)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  usuario_id      uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  concedido_por_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_org ON user_roles (organizacao_id, usuario_id);

-- Catálogo de permissões do SPEC §31. Idempotente: rodar de novo não duplica.
INSERT INTO permissions (codigo, dominio, descricao) VALUES
  ('companies.read',        'identity',     'Ver empresas'),
  ('companies.write',       'identity',     'Criar e editar empresas'),
  ('acquisition.read',      'acquisition',  'Ver aquisições e pré-vendas'),
  ('acquisition.manage',    'acquisition',  'Trabalhar a fila de aquisição'),
  ('sales.read',            'sales',        'Ver oportunidades e pipeline'),
  ('sales.manage',          'sales',        'Criar e mover oportunidades'),
  ('sales.approve_discount','sales',        'Aprovar desconto acima da alçada'),
  ('finance.read',          'finance',      'Ver faturas, pagamentos e receita'),
  ('finance.manage',        'finance',      'Lançar e conciliar financeiro'),
  ('cs.read',               'customer-success', 'Ver carteira, saúde e risco'),
  ('cs.manage',             'customer-success', 'Gerir carteira e renovação'),
  ('automation.manage',     'automation',   'Criar e publicar automações'),
  ('ai.use',                'intelligence', 'Usar NEXO e agentes'),
  ('ai.configure',          'intelligence', 'Configurar agentes, modelos e ferramentas'),
  ('integrations.manage',   'integrations', 'Conectar e configurar provedores'),
  ('admin.manage_users',    'admin',        'Gerir usuários, papéis e permissões')
ON CONFLICT (codigo) DO NOTHING;

-- ─── Arquivos (SPEC §32) ──────────────────────────────────────────────────────
-- Hoje os 1.980 anexos recuperados do Zoho existem apenas numa pasta pessoal no
-- Mac, e o próprio código registra isso como decisão de infraestrutura nunca
-- tomada. Estas tabelas guardam metadado; o binário vai para object storage.

CREATE TABLE IF NOT EXISTS file_objects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  storage_provider text NOT NULL,
  storage_key     text NOT NULL,
  bucket          text,
  nome_original   text NOT NULL,
  mime_type       text NOT NULL,
  tamanho_bytes   bigint NOT NULL,
  -- Checksum para provar integridade e deduplicar upload repetido.
  checksum_sha256 text,
  retencao_ate    timestamptz,
  enviado_por_id  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT uq_file_objects_storage UNIQUE (storage_provider, bucket, storage_key)
);
CREATE INDEX IF NOT EXISTS idx_file_objects_org ON file_objects (organizacao_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_file_objects_checksum ON file_objects (checksum_sha256) WHERE checksum_sha256 IS NOT NULL;

-- Um arquivo pode estar ligado a mais de uma coisa (o mesmo contrato assinado
-- pertence à empresa e à oportunidade). Vínculo polimórfico por isso.
CREATE TABLE IF NOT EXISTS file_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  file_object_id uuid NOT NULL REFERENCES file_objects(id) ON DELETE CASCADE,
  entity_type    text NOT NULL,
  entity_id      uuid NOT NULL,
  papel          text,
  created_by_id  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_file_links_entity CHECK (entity_type IN (
    'empresa','pessoa','oportunidade','proposta','contrato',
    'servico_canonico','fulfillment','communication','reuniao','aquisicao'
  )),
  CONSTRAINT uq_file_links UNIQUE (file_object_id, entity_type, entity_id, papel)
);
CREATE INDEX IF NOT EXISTS idx_file_links_entidade ON file_links (entity_type, entity_id);

COMMIT;
