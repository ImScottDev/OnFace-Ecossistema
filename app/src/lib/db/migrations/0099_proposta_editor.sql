-- O estado do editor da proposta (signatários dos dois lados, condições do
-- contrato, dados congelados no envio) deixa de viver só na tela: sem isto,
-- fechar e reabrir a proposta devolvia o editor vazio. Aditiva e idempotente.
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS editor jsonb;
