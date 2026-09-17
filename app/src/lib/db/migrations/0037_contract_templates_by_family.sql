ALTER TABLE contrato_templates
  ADD COLUMN IF NOT EXISTS service_family text;

CREATE INDEX IF NOT EXISTS idx_contrato_templates_family
  ON contrato_templates (organizacao_id, service_family, ativo);

INSERT INTO contrato_templates (organizacao_id, nome, versao, commercial_model, service_family, corpo_template, ativo)
SELECT
  o.id,
  'Contrato provisório PABX',
  1,
  'CONTRATO_OBRIGATORIO',
  'PABX',
  'CONTRATO DE PRESTAÇÃO DE SERVIÇOS PABX

CONTRATANTE: {{empresa_nome}}, CNPJ {{empresa_cnpj}}, representada por {{pessoa_nome}}, e-mail {{pessoa_email}}.

OBJETO: fornecimento dos serviços {{itens_descricao}}.

VALORES: valor total {{valor_total}}, nas condições {{condicoes_pagamento}}.

VIGÊNCIA: {{prazo_descricao}}.

Este texto é um modelo operacional provisório e deverá ser substituído pela versão jurídica final antes do uso em produção.',
  true
FROM organizacoes o
WHERE NOT EXISTS (
  SELECT 1 FROM contrato_templates t
  WHERE t.organizacao_id = o.id AND t.service_family = 'PABX' AND t.ativo = true
);

INSERT INTO contrato_templates (organizacao_id, nome, versao, commercial_model, service_family, corpo_template, ativo)
SELECT
  o.id,
  'Contrato provisório White Label',
  1,
  'CONTRATO_OBRIGATORIO',
  'WHITE_LABEL',
  'CONTRATO DE LICENCIAMENTO E IMPLANTAÇÃO WHITE LABEL

CONTRATANTE: {{empresa_nome}}, CNPJ {{empresa_cnpj}}, representada por {{pessoa_nome}}, e-mail {{pessoa_email}}.

OBJETO: licenciamento e implantação dos serviços {{itens_descricao}}.

VALORES: valor total {{valor_total}}, nas condições {{condicoes_pagamento}}.

VIGÊNCIA: {{prazo_descricao}}.

Este texto é um modelo operacional provisório e deverá ser substituído pela versão jurídica final antes do uso em produção.',
  true
FROM organizacoes o
WHERE NOT EXISTS (
  SELECT 1 FROM contrato_templates t
  WHERE t.organizacao_id = o.id AND t.service_family = 'WHITE_LABEL' AND t.ativo = true
);
