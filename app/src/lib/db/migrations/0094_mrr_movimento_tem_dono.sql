-- Expansão que entra pelo Stripe precisa de dono comercial.
--
-- `mrr_movimentos` registra novo, expansao, contracao, churn e reativacao — e
-- tinha vínculo com lead, assinatura e contrato, mas NÃO com negócio. O efeito
-- prático: o time aumentava a quantidade direto no Stripe, o MRR consolidado
-- subia certo, e a venda sumia da atribuição. Nenhum negócio de expansão,
-- nenhum closer creditado, nada na meta. Medido em 01/10: zero negócios com
-- commercial_motion = 'EXPANSION' no banco inteiro.
--
-- `negocio_id` fecha o elo. `detectado_fora_do_crm` separa os dois casos, que
-- exigem tratamento diferente:
--   false → a venda nasceu no CRM e a alteração foi aplicada por ele
--   true  → alguém mexeu direto no Stripe; o negócio foi criado depois, pela
--           reconciliação, e precisa de um humano confirmando o responsável
--
-- Aditiva: coluna nova anulável e índice. Nenhuma linha é reescrita.

ALTER TABLE mrr_movimentos
  ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id) ON DELETE SET NULL;

ALTER TABLE mrr_movimentos
  ADD COLUMN IF NOT EXISTS detectado_fora_do_crm boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mrr_movimentos_negocio
  ON mrr_movimentos (negocio_id) WHERE negocio_id IS NOT NULL;

-- Para a fila de "expansão sem dono" que o time precisa revisar.
CREATE INDEX IF NOT EXISTS idx_mrr_movimentos_sem_dono
  ON mrr_movimentos (organizacao_id, ocorrido_em DESC)
  WHERE negocio_id IS NULL AND tipo IN ('expansao', 'contracao');
