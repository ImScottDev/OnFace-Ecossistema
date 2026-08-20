-- Pré-vendas: taxonomia nova do CRM2 (17/08, De/Para aprovado pelo Kauã).
-- Aditivo — nenhuma coluna legada (sdr_status, status) é tocada ou reescrita.
-- crm2_pre_vendas_stage guarda a etapa operacional atual na nova estrutura
-- (novo/em_contato/qualificacao/qualificado/agenda_confirmada/sem_resposta/
-- nutricao_retomar/desqualificado). crm2_pre_vendas_stage_fonte preserva de
-- qual coluna REAL do board legado (sdrBoardColumn) ela foi derivada, pra
-- rastreabilidade. Os três timestamps preservam fatos históricos que o
-- De/Para exige não perder mesmo quando não são mais a etapa atual (reunião
-- já realizada, cliente já convertido, já teve no-show).
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS crm2_pre_vendas_stage text,
  ADD COLUMN IF NOT EXISTS crm2_pre_vendas_stage_fonte text,
  ADD COLUMN IF NOT EXISTS crm2_reuniao_realizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS crm2_cliente_convertido_em timestamptz,
  ADD COLUMN IF NOT EXISTS crm2_no_show_em timestamptz,
  ADD COLUMN IF NOT EXISTS crm2_migrado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_crm2_pre_vendas_stage ON leads(crm2_pre_vendas_stage);
