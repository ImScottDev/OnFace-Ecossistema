-- FRENTE 2C.1 — Motor interno de fechamento por família comercial.
--
-- Regra real (Kauã, 01/09): a evidência que fecha a venda DEPENDE da família.
-- Callface AI = pagamento confirmado. PABX e White Label = contrato assinado
-- já basta (o pagamento pode vir depois, e vira pendência financeira). Outras
-- famílias sem regra clara nunca viram ganho automático.
--
-- Nada aqui cria tabela nova: `won_evidence_policies`, `proposta_grupo_comercial`,
-- `checkouts`, `contratos` e `faturas` já existiam. São colunas aditivas
-- nullable + seed idempotente de política — nenhum backfill destrutivo.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Grupo comercial: entrega liberada ≠ pagamento confirmado.
--
-- Até aqui a materialização do serviço só acontecia em `status='concluido'`,
-- que só o pagamento produzia. PABX/White Label precisam liberar a ENTREGA na
-- assinatura, mantendo o pagamento rastreado como pendente — dois fatos
-- distintos que o `status` sozinho não conseguia expressar sem mentir.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS service_family text;               -- PABX | CALLFACE_AI | WHITE_LABEL | UNKNOWN (denormalizado dos itens)
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS contrato_assinado_em timestamptz;
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS entrega_liberada_em timestamptz;
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS entrega_liberada_por text;         -- contrato_assinado | pagamento_confirmado | manual
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS pagamento_status text;             -- pendente | confirmado | falhou
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS pagamento_vence_em timestamptz;
ALTER TABLE proposta_grupo_comercial ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_grupo_comercial_pagamento_status
  ON proposta_grupo_comercial (organizacao_id, pagamento_status)
  WHERE pagamento_status IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Checkout: campos que a 2C.2 (Stripe) vai receber.
--
-- `stripe_session_id`/`stripe_subscription_id` já existiam. O resto é o que o
-- webhook e a fatura precisam pra fechar o ciclo sem depender de ler o payload
-- bruto do Stripe de novo. Nenhum deles é escrito por integração nova agora.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS payment_status text;                              -- pendente | confirmado | falhou
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS next_payment_due_at timestamptz;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS metadata jsonb;                                   -- crm_* metadata espelhada (2C.2)

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Contrato: preparo pra provider externo de assinatura (2C.3).
--
-- Já existiam: signature_provider_ref (provider_document_id), signature_status
-- (contrato_status), documento_final_url (signed_pdf_url), signatarios
-- (signers), assinado_em (signed_at), prazo_meses (contract_term_months).
-- Faltavam só estes 3 — nenhuma integração é ligada agora.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS signature_provider text;                          -- simple_electronic | documenso | autentique | ...
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS signature_enviado_em timestamptz;                 -- sent_at
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS signature_public_url text;                        -- public_signing_url

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fatura: vínculo direto com o que originou a pendência.
--
-- `faturas` é a tabela de recebível que a Carteira e o Financeiro já leem
-- (fatura aberta + vencimento < now = risco/inadimplência). Reusar ela pra
-- pendência de pagamento pós-contrato faz a badge aparecer sem UI nova; só
-- faltava saber de qual grupo/negócio a pendência nasceu.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS grupo_comercial_id uuid REFERENCES proposta_grupo_comercial(id);
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS servico_canonico_id uuid REFERENCES servicos_canonicos(id);

CREATE INDEX IF NOT EXISTS idx_faturas_grupo_comercial ON faturas (grupo_comercial_id) WHERE grupo_comercial_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Política de evidência de ganho POR FAMÍLIA (fim do catch-all).
--
-- Estado antes desta migration: `won_evidence_policies` com ZERO linhas em dev
-- e em produção — tudo caía no default hardcoded de won-evidence.ts, que exige
-- pagamento confirmado sempre. É exatamente por isso que PABX/White Label não
-- fechavam por contrato.
--
-- `required_combinations` é OR-de-AND (já implementado no gate): basta UMA
-- combinação estar inteiramente satisfeita. As vias manuais de exceção
-- (admin_approval / financial_attestation / manual_contract) continuam
-- valendo em TODAS as famílias — nenhum gate existente é removido.
--
-- Idempotente: um índice único parcial impede segunda linha ativa por
-- (org, produto), e o INSERT é ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_won_evidence_policies_org_produto_ativo
  ON won_evidence_policies (organizacao_id, produto)
  WHERE ativo = true;

INSERT INTO won_evidence_policies (organizacao_id, produto, tipos_aceitos, required_combinations, ativo)
SELECT o.id, 'CALLFACE_AI',
  '["stripe_payment","stripe_subscription","admin_approval","financial_attestation"]'::jsonb,
  '[["stripe_payment"],["stripe_subscription"],["admin_approval"],["financial_attestation"]]'::jsonb,
  true
FROM organizacoes o
ON CONFLICT DO NOTHING;

INSERT INTO won_evidence_policies (organizacao_id, produto, tipos_aceitos, required_combinations, ativo)
SELECT o.id, 'PABX',
  '["signed_contract","manual_contract","admin_approval","financial_attestation"]'::jsonb,
  '[["signed_contract"],["manual_contract"],["admin_approval"],["financial_attestation"]]'::jsonb,
  true
FROM organizacoes o
ON CONFLICT DO NOTHING;

INSERT INTO won_evidence_policies (organizacao_id, produto, tipos_aceitos, required_combinations, ativo)
SELECT o.id, 'WHITE_LABEL',
  '["signed_contract","manual_contract","admin_approval","financial_attestation"]'::jsonb,
  '[["signed_contract"],["manual_contract"],["admin_approval"],["financial_attestation"]]'::jsonb,
  true
FROM organizacoes o
ON CONFLICT DO NOTHING;
