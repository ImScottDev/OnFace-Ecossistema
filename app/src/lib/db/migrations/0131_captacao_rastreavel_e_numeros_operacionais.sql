-- Captação rastreável, distribuição por campanha e números operacionais.
--
-- Três buracos que apareciam juntos quando alguém perguntava "por que este lead
-- foi para esta pessoa, e de qual número ela deve falar com ele?":
--
-- 1. A regra de distribuição (0097) só olhava etapa e dia/horário. Lead da
--    campanha X para o time Y, ou formulário Z para a Lia, não tinha como ser
--    dito. As colunas novas de critério são todas opcionais: regra sem critério
--    continua valendo para qualquer lead, exatamente como antes.
-- 2. O lead não guardava QUAL regra o atribuiu nem por quê, e o webhook da Meta
--    e o do RD gravavam o dono sem rastro nenhum. `leads` ganha a proveniência
--    da atribuição (é `leads` que as telas, o contexto dos fluxos e as três
--    portas de entrada leem e escrevem; a aquisição nem sempre existe no
--    instante em que o webhook decide o dono).
-- 3. Lead da Meta ou do RD que falhava ficava só no console.error, sem como
--    reprocessar. `captacao_entregas` guarda cada entrega como chegou, com chave
--    de idempotência por canal: reentrega do mesmo fato não cria lead nem gasta
--    vez de rodízio.
--
-- E o número OPERACIONAL: a operação ligou números de WhatsApp para SDR, Lia,
-- automações e distribuição, mas não são todos os números conectados. A coluna
-- marca o pool que a máquina pode usar. Número privado (0126) nunca é
-- operacional: CHECK no banco e a mesma regra na aplicação.
--
-- Aditiva e idempotente: colunas e tabela novas, nenhuma linha existente muda.

ALTER TABLE whatsapp_sessao ADD COLUMN IF NOT EXISTS operacional boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_sessao_privado_nao_operacional') THEN
    ALTER TABLE whatsapp_sessao
      ADD CONSTRAINT whatsapp_sessao_privado_nao_operacional CHECK (NOT (privado AND operacional)) NOT VALID;
  END IF;
END $$;
-- Coluna nova nasce false em toda linha, então a validação não encontra nada;
-- validar de novo numa segunda execução é inofensivo.
ALTER TABLE whatsapp_sessao VALIDATE CONSTRAINT whatsapp_sessao_privado_nao_operacional;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessao_operacional
  ON whatsapp_sessao (organizacao_id) WHERE operacional = true;

-- Critérios de atribuição (nulo ou vazio = qualquer valor) e o número alvo.
ALTER TABLE regras_distribuicao_leads ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE regras_distribuicao_leads ADD COLUMN IF NOT EXISTS origem text[];
ALTER TABLE regras_distribuicao_leads ADD COLUMN IF NOT EXISTS utm_source text[];
ALTER TABLE regras_distribuicao_leads ADD COLUMN IF NOT EXISTS utm_campaign text[];
ALTER TABLE regras_distribuicao_leads ADD COLUMN IF NOT EXISTS meta_campaign_ids text[];
ALTER TABLE regras_distribuicao_leads ADD COLUMN IF NOT EXISTS formulario text[];
ALTER TABLE regras_distribuicao_leads ADD COLUMN IF NOT EXISTS sessao_whatsapp_id uuid
  REFERENCES whatsapp_sessao(id) ON DELETE SET NULL;

-- Proveniência da atribuição no lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS distribuicao_regra_id uuid
  REFERENCES regras_distribuicao_leads(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS distribuicao_motivo text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sessao_whatsapp_preferida_id uuid
  REFERENCES whatsapp_sessao(id) ON DELETE SET NULL;

-- Caixa de entrada crua de toda captação (Meta, RD, site, API).
CREATE TABLE IF NOT EXISTS captacao_entregas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id     uuid NOT NULL REFERENCES organizacoes(id),
  canal              text NOT NULL CHECK (canal IN ('meta', 'rd', 'site', 'api')),
  chave_idempotencia text NOT NULL,
  payload            jsonb NOT NULL,
  status             text NOT NULL DEFAULT 'recebida'
                       CHECK (status IN ('recebida', 'processada', 'duplicada', 'falhou')),
  erro               text,
  lead_id            uuid REFERENCES leads(id) ON DELETE SET NULL,
  regra_id           uuid REFERENCES regras_distribuicao_leads(id) ON DELETE SET NULL,
  entregas           integer NOT NULL DEFAULT 1,
  ultima_entrega_em  timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  processada_em      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_captacao_entregas_chave
  ON captacao_entregas (organizacao_id, canal, chave_idempotencia);
CREATE INDEX IF NOT EXISTS idx_captacao_entregas_org_data
  ON captacao_entregas (organizacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_captacao_entregas_falhas
  ON captacao_entregas (organizacao_id, created_at DESC) WHERE status = 'falhou';
