-- Política comercial por oferta (SPEC §12.2 e §12.3, fase 08).
--
-- POR QUE ISTO EXISTE
--
-- Hoje a política de ganho vive em `won_evidence_policies`, indexada por família
-- de produto. O banco de produção diz:
--
--   PABX          → [["signed_contract"], ["manual_contract"], ["admin_approval"], ...]
--   WHITE_LABEL   → idem
--   CALLFACE_AI   → [["stripe_payment"], ["stripe_subscription"], ["admin_approval"], ...]
--
-- Cada combinação tem um elemento só, ou seja, é um OR. Para PABX e White Label,
-- `signed_contract` SOZINHO libera Won, sem nenhuma evidência de pagamento. E
-- `won-evidence.ts:19` documenta por escrito o contrário: "contrato sozinho nunca
-- libera Won". O código e o banco discordam, e o banco é quem manda em runtime.
--
-- A causa raiz é a indexação por FAMÍLIA: o mesmo produto pode ser vendido de
-- formas com regras diferentes. Callface AI direto no Stripe ganha no pagamento;
-- Callface AI por contrato ganha na assinatura. Com política por família, uma das
-- duas fica errada por construção.
--
-- Esta migration cria as quatro ofertas do SPEC §12.3, cada uma com política
-- própria. `won_evidence_policies` continua intacta: a troca de leitor acontece
-- no cutover (fase 16), não aqui.
--
-- Semente idempotente: ON CONFLICT por (organizacao_id, codigo).

BEGIN;

-- Preço passa a pendurar na oferta, não só no catálogo (SPEC §12.4).
-- `catalogo_precos` está com 0 linhas hoje, então não há dado a remapear.
ALTER TABLE catalogo_precos ADD COLUMN IF NOT EXISTS oferta_comercial_id uuid REFERENCES ofertas_comerciais(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_catalogo_precos_oferta ON catalogo_precos (oferta_comercial_id);

-- A oportunidade aponta para a oferta, que é quem carrega a política.
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS oferta_comercial_id uuid REFERENCES ofertas_comerciais(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_oportunidades_oferta ON oportunidades (oferta_comercial_id);

-- Proposta e contrato também: o SPEC §13.1 e §14 exigem referência à oferta.
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS oferta_comercial_id uuid REFERENCES ofertas_comerciais(id) ON DELETE SET NULL;
ALTER TABLE contratos  ADD COLUMN IF NOT EXISTS oferta_comercial_id uuid REFERENCES ofertas_comerciais(id) ON DELETE SET NULL;

-- ─── As quatro ofertas do SPEC §12.3 ──────────────────────────────────────────
-- A âncora de catálogo é o produto principal ativo de cada família. Onde a
-- família tem mais de um produto ativo (Callface AI tem seis), a oferta aponta
-- para o de nome canônico e os demais entram como preço da mesma oferta depois.

INSERT INTO ofertas_comerciais (
  organizacao_id, servico_catalogo_id, codigo, nome, ativo,
  requires_company_before_proposal, requires_contract, win_condition, payment_trigger,
  creates_subscription, billing_model, onboarding_required, implementation_required,
  contrato_template_id, checkout_provider, metadata
)
SELECT o.id, sc.id, v.codigo, v.nome, true,
       true, v.requires_contract, v.win_condition, v.payment_trigger,
       v.creates_subscription, v.billing_model, v.onboarding_required, v.implementation_required,
       ct.id, v.checkout_provider,
       jsonb_build_object('origem','SPEC 12.3','criada_em','fase-08-refactor')
FROM organizacoes o
CROSS JOIN (VALUES
  -- Venda direta: ganha quando o dinheiro entra. Sem contrato no caminho.
  ('CALLFACE_AI_DIRECT',   'Callface AI (venda direta)',     'CALLFACE_AI', false,
   'PAYMENT_CONFIRMED',      'ON_PROPOSAL_ACCEPTED', true,  'SUBSCRIPTION', true,  false, NULL,                          'stripe'),
  -- Mesma família, política diferente: ganha na assinatura, cobra depois.
  ('CALLFACE_AI_CONTRACT', 'Callface AI (por contrato)',     'CALLFACE_AI', true,
   'CONTRACT_FULLY_SIGNED',  'ON_CONTRACT_SIGNED',   true,  'SUBSCRIPTION', true,  false, 'Contrato Padrão (genérico)',  'stripe'),
  -- PABX e White Label exigem implantação além do onboarding.
  ('PABX_CONTRACT',        'PABX (por contrato)',            'PABX',        true,
   'CONTRACT_FULLY_SIGNED',  'ON_CONTRACT_SIGNED',   true,  'SUBSCRIPTION', true,  true,  'Contrato PABX base V2',       'stripe'),
  ('WHITE_LABEL_CONTRACT', 'White Label (por contrato)',     'WHITE_LABEL', true,
   'CONTRACT_FULLY_SIGNED',  'ON_CONTRACT_SIGNED',   true,  'SUBSCRIPTION', true,  true,  'Contrato provisório White Label','stripe')
) AS v(codigo, nome, familia, requires_contract, win_condition, payment_trigger,
       creates_subscription, billing_model, onboarding_required, implementation_required,
       template_nome, checkout_provider)
JOIN LATERAL (
  SELECT id FROM servicos_catalogo
   WHERE organizacao_id = o.id AND service_family = v.familia AND ativo
   ORDER BY (nome ILIKE '%starter%') DESC, nome LIMIT 1
) sc ON true
LEFT JOIN contrato_templates ct ON ct.nome = v.template_nome
ON CONFLICT (organizacao_id, codigo) DO NOTHING;

COMMIT;
