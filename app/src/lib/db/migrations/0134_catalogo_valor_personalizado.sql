-- Preços de valor escolhido não são preços fixos de zero reais.
ALTER TABLE catalogo_precos ADD COLUMN IF NOT EXISTS valor_personalizado boolean NOT NULL DEFAULT false;
ALTER TABLE catalogo_precos ADD COLUMN IF NOT EXISTS valor_minimo_centavos integer;
ALTER TABLE catalogo_precos ADD COLUMN IF NOT EXISTS valor_maximo_centavos integer;
