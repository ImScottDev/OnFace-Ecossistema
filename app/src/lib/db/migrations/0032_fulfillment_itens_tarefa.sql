-- Prazo/prioridade/bloqueio por item de checklist de implantação (26/08,
-- redesign da tela de Implantação PABX, pedido do Kauã). Antes só existia
-- fulfillments.target_at no nível do projeto todo; de propósito não existia
-- por item até ter um pedido real de UI que precisasse (este). Colunas
-- nullable, sem backfill, mesmo padrão de responsavel_id/metadata.
ALTER TABLE fulfillment_itens ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE fulfillment_itens ADD COLUMN IF NOT EXISTS priority text; -- alta | media | baixa
ALTER TABLE fulfillment_itens ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE fulfillment_itens ADD COLUMN IF NOT EXISTS blocker_impact text; -- alto | medio | baixo
