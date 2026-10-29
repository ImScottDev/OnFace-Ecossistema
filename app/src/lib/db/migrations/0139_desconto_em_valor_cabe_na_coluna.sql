-- Desconto pode ser percentual ou em reais (desconto_tipo), mas a coluna tinha
-- precisão de percentual: R$ 1.000,00 ou mais estourava o insert com 22003 e a
-- proposta não era criada. oportunidade_itens (12,2) e fatura_itens (14,2) já
-- comportavam; proposta_itens e contrato_itens tinham ficado para trás, então o
-- mesmo desconto passava na oportunidade e quebrava na proposta e no contrato.
ALTER TABLE proposta_itens ALTER COLUMN desconto TYPE numeric(12, 2);
ALTER TABLE contrato_itens ALTER COLUMN desconto TYPE numeric(12, 2);
