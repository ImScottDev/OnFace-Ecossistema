-- Link público da proposta (/p/:id) passa a poder ser desativado pelo time
-- (decisão D6, 27/10/2026). A validade já existia: o aceite recusa proposta com
-- data_validade vencida e a página mostra "vencida". Faltava revogar um link que
-- foi para a pessoa errada ou ficou circulando. NULL = link ativo (todos hoje).
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS link_publico_revogado_em timestamptz;
