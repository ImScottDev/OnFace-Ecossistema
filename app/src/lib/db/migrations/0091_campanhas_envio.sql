-- Envio de campanhas de outreach.
--
-- `outreach_campanhas` existia só como rascunho: nenhum worker lia a tabela,
-- então status "agendada/enviando/concluida" era promessa sem processo. Esta
-- migration dá ao worker o que ele precisa para disparar (sweep
-- `campanha-sweep`, lib/automacoes/campanhas-envio.ts):
--
--   - `agendada_para`: quando a campanha pode começar (agora = envio imediato);
--   - `iniciada_em` / `concluida_em`: rastro do disparo;
--   - `outreach_campanha_destinatarios`: uma linha por lead alcançado, com o
--     status individual (pendente → enviando → enviado | bloqueado | falhou).
--     O status por destinatário é o que impede reenvio após queda do worker e
--     o que a tela mostra no detalhe.
--
-- Aditiva: nenhuma coluna existente muda, nenhum dado é reescrito.

ALTER TABLE outreach_campanhas ADD COLUMN IF NOT EXISTS agendada_para timestamptz;
ALTER TABLE outreach_campanhas ADD COLUMN IF NOT EXISTS iniciada_em timestamptz;
ALTER TABLE outreach_campanhas ADD COLUMN IF NOT EXISTS concluida_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_outreach_campanhas_devidas
  ON outreach_campanhas (status, agendada_para)
  WHERE status IN ('agendada', 'enviando');

CREATE TABLE IF NOT EXISTS outreach_campanha_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  campanha_id uuid NOT NULL REFERENCES outreach_campanhas(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  nome text,
  destino text NOT NULL,
  status text NOT NULL DEFAULT 'pendente', -- pendente | enviando | enviado | bloqueado | falhou
  erro text,
  mensagem_id text,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_campanha_destinatario_destino
  ON outreach_campanha_destinatarios (campanha_id, destino);
CREATE INDEX IF NOT EXISTS idx_campanha_destinatarios_status
  ON outreach_campanha_destinatarios (campanha_id, status);
