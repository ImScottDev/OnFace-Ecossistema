-- Commercial Core v2 (ADR-EXEC-021) — modelo comercial por item + grupos de
-- fulfillment independentes dentro da mesma proposta/oportunidade.
--
-- Problema real do v1 (16/08, corrigido agora): "próximo passo" era uma
-- propriedade da PROPOSTA INTEIRA (determinarProximoPasso olhava todos os
-- itens e, se qualquer um exigisse contrato, a proposta inteira ia pro
-- caminho contrato). Numa venda mista real (Callface AI sem fidelidade +
-- PABX contratual), isso trava o AI esperando o PABX assinar. E a mesma
-- família (Callface AI) pode ser vendida COM ou SEM contrato dependendo do
-- desconto negociado — não é propriedade fixa da família/catálogo.

-- ─── 1. Modelo comercial por item (não mais só por família) ────────────────
ALTER TABLE servicos_catalogo
  ADD COLUMN IF NOT EXISTS commercial_model_padrao text;

UPDATE servicos_catalogo SET commercial_model_padrao = 'CONTRATO_OBRIGATORIO' WHERE requer_contrato = true AND commercial_model_padrao IS NULL;
UPDATE servicos_catalogo SET commercial_model_padrao = 'PAGAMENTO_DIRETO' WHERE requer_contrato = false AND commercial_model_padrao IS NULL;

ALTER TABLE servicos_catalogo
  ALTER COLUMN commercial_model_padrao SET NOT NULL,
  ALTER COLUMN commercial_model_padrao SET DEFAULT 'PAGAMENTO_DIRETO';

ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS commercial_model text;

-- Backfill dos itens já existentes (sessão anterior) — herda do catálogo
-- quando linkado, senão PAGAMENTO_DIRETO (mesma cautela conservadora de
-- sempre: item sem vínculo de catálogo nunca vira "exige contrato" sozinho).
UPDATE proposta_itens pi SET commercial_model = sc.commercial_model_padrao
  FROM servicos_catalogo sc WHERE pi.servico_catalogo_id = sc.id AND pi.commercial_model IS NULL;
UPDATE proposta_itens SET commercial_model = 'PAGAMENTO_DIRETO' WHERE commercial_model IS NULL;

ALTER TABLE proposta_itens
  ALTER COLUMN commercial_model SET NOT NULL;

-- ─── 2. Checkouts como entidade própria (não mais um campo solto em propostas) ──
CREATE TABLE IF NOT EXISTS checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  proposta_id uuid NOT NULL REFERENCES propostas(id),
  negocio_id uuid REFERENCES negocios(id),
  grupo_comercial_id uuid, -- FK adicionada abaixo, depois que proposta_grupo_comercial existir
  origem text NOT NULL, -- automatico_pos_aceite | manual_vendedor
  criado_por_id uuid REFERENCES usuarios(id), -- só quando origem=manual_vendedor
  stripe_session_id text,
  stripe_subscription_id text,
  stripe_checkout_url text,
  status text NOT NULL DEFAULT 'criado', -- criado | aberto | pago | falhou | expirado | cancelado
  criado_em timestamptz NOT NULL DEFAULT now(),
  abertura_em timestamptz,
  completado_em timestamptz,
  expira_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_checkouts_proposta ON checkouts(proposta_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_org ON checkouts(organizacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkouts_stripe_session ON checkouts(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- ─── 3. Grupo comercial — a peça central: agrupa itens da proposta que  ────
-- compartilham o MESMO modelo comercial/fulfillment, com estado PRÓPRIO e
-- independente dos outros grupos da mesma proposta/oportunidade.
CREATE TABLE IF NOT EXISTS proposta_grupo_comercial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  proposta_id uuid NOT NULL REFERENCES propostas(id),
  negocio_id uuid REFERENCES negocios(id),
  oportunidade_id uuid, -- preenchido quando a oportunidade for sincronizada (dual-write)
  commercial_model text NOT NULL, -- PAGAMENTO_DIRETO | CONTRATO_OBRIGATORIO | CONTRATO_FIDELIDADE_OPCIONAL
  status text NOT NULL DEFAULT 'aguardando_aceite',
  -- aguardando_aceite | aguardando_contrato | contrato_enviado_assinatura |
  -- contrato_assinado | aguardando_checkout | checkout_gerado |
  -- pagamento_pendente | pago | concluido | falhou
  contrato_id uuid REFERENCES contratos(id),
  checkout_id uuid REFERENCES checkouts(id),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grupo_comercial_proposta ON proposta_grupo_comercial(proposta_id);
CREATE INDEX IF NOT EXISTS idx_grupo_comercial_negocio ON proposta_grupo_comercial(negocio_id);
CREATE INDEX IF NOT EXISTS idx_grupo_comercial_status ON proposta_grupo_comercial(organizacao_id, status);

ALTER TABLE checkouts
  ADD CONSTRAINT checkouts_grupo_comercial_id_fkey FOREIGN KEY (grupo_comercial_id) REFERENCES proposta_grupo_comercial(id);

CREATE TABLE IF NOT EXISTS proposta_grupo_comercial_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES proposta_grupo_comercial(id) ON DELETE CASCADE,
  proposta_item_id uuid NOT NULL REFERENCES proposta_itens(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_itens_proposta_item ON proposta_grupo_comercial_itens(proposta_item_id);
CREATE INDEX IF NOT EXISTS idx_grupo_itens_grupo ON proposta_grupo_comercial_itens(grupo_id);

-- oportunidade_itens: rastreia o grupo (quando já formado) + modelo comercial
-- herdado do proposta_item — permite a tela de negócio mostrar fulfillment
-- por item sem recalcular nada.
ALTER TABLE oportunidade_itens
  ADD COLUMN IF NOT EXISTS commercial_model text,
  ADD COLUMN IF NOT EXISTS grupo_comercial_id uuid REFERENCES proposta_grupo_comercial(id);

-- ─── 4. Evidência comercial passa a poder referenciar o grupo específico ───
ALTER TABLE comercial_evidencia
  ADD COLUMN IF NOT EXISTS grupo_comercial_id uuid REFERENCES proposta_grupo_comercial(id);

-- ─── 5. Contratos: templates + vínculo ao grupo (não mais à proposta inteira) ──
CREATE TABLE IF NOT EXISTS contrato_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  commercial_model text, -- null = genérico, aplica a qualquer modelo
  corpo_template text NOT NULL, -- texto com {{variavel}} — motor de substituição simples, sem engine de template pesado
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contrato_templates_org ON contrato_templates(organizacao_id, ativo);

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS grupo_comercial_id uuid REFERENCES proposta_grupo_comercial(id),
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES contrato_templates(id),
  ADD COLUMN IF NOT EXISTS template_versao integer,
  ADD COLUMN IF NOT EXISTS variaveis_preenchidas jsonb,
  -- Texto do contrato já renderizado (template + variáveis) ANTES da
  -- assinatura — o que o cliente lê na página pública. documento_final_url
  -- é o documento FINAL assinado (futuro, quando um provider real existir).
  ADD COLUMN IF NOT EXISTS corpo_gerado text,
  ADD COLUMN IF NOT EXISTS documento_final_url text,
  -- Abstração de assinatura (SignatureProvider) — provider-agnóstico. As
  -- colunas assinatura_status/assinado_nome/assinado_ip/assinado_em
  -- continuam existindo como o armazenamento CONCRETO do provider "aceite
  -- eletrônico simples" (implementação atual); signature_status é o status
  -- NORMALIZADO que qualquer provider futuro (DocuSign/Clicksign/etc)
  -- também vai preencher, sem mudar nada do domínio.
  ADD COLUMN IF NOT EXISTS signature_provider_ref text,
  ADD COLUMN IF NOT EXISTS signature_status text; -- contract_created|sent_for_signature|opened|signed|declined|expired|canceled

-- Template default genérico — sem isso, gerarContratoDeTemplate não tem o
-- que usar na primeira venda. Nasce inativo-editável (ativo=true, mas é só
-- um placeholder textual, não peça jurídica real — Kauã decide o texto
-- definitivo depois, é só a estrutura funcionando ponta a ponta).
INSERT INTO contrato_templates (organizacao_id, nome, versao, commercial_model, corpo_template)
SELECT id, 'Contrato Padrão (genérico)', 1, NULL,
  'CONTRATO DE PRESTAÇÃO DE SERVIÇOS' || chr(10) ||
  'CONTRATANTE: {{empresa_nome}} ({{empresa_cnpj}}), representada por {{pessoa_nome}} ({{pessoa_email}}).' || chr(10) ||
  'CONTRATADA: Callface.' || chr(10) ||
  'OBJETO: {{itens_descricao}}.' || chr(10) ||
  'VALOR: {{valor_total}}.' || chr(10) ||
  'PRAZO: {{prazo_descricao}}.' || chr(10) ||
  'CONDIÇÕES: {{condicoes_pagamento}}.'
FROM organizacoes
WHERE NOT EXISTS (SELECT 1 FROM contrato_templates ct WHERE ct.organizacao_id = organizacoes.id);
