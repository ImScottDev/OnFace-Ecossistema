-- Ajuste seguro da jornada White Label: só implantações sem atividade (todos
-- os itens pendentes). Mantém os mesmos registros de item, sem apagar
-- histórico, responsáveis ou anexos; acrescenta apenas as quatro fases finais.
WITH etapas(ordem, titulo, workstream) AS (
  VALUES
    (0, 'Iniciar implantação e confirmar responsável interno', 'abertura'),
    (1, 'Revisar o escopo vendido e os contatos do cliente', 'abertura'),
    (2, 'Fazer o primeiro contato de boas-vindas', 'comunicacao'),
    (3, 'Apresentar as etapas e o prazo estimado da implantação', 'comunicacao'),
    (4, 'Enviar o formulário de materiais e configuração', 'materiais'),
    (5, 'Acompanhar o preenchimento do formulário pelo cliente', 'materiais'),
    (6, 'Receber e validar materiais e informações do cliente', 'materiais'),
    (7, 'Solicitar correções ou complementos, quando necessário', 'materiais'),
    (8, 'Configurar ambiente White Label e identidade da marca', 'ambiente'),
    (9, 'Enviar instruções de DNS/CNAME e acompanhar a configuração', 'dominio'),
    (10, 'Validar DNS, TLS e domínio de e-mail (SPF/DKIM quando aplicável)', 'dominio'),
    (11, 'Executar QA interno do ambiente', 'qa_interno')
)
UPDATE fulfillment_itens i
SET titulo = e.titulo, workstream = e.workstream, ordem = e.ordem, updated_at = now()
FROM etapas e, fulfillments f
WHERE f.id = i.fulfillment_id
  AND i.ordem = e.ordem
  AND f.service_family = 'WHITE_LABEL'
  AND NOT EXISTS (SELECT 1 FROM fulfillment_itens x WHERE x.fulfillment_id = f.id AND x.status <> 'PENDING');

INSERT INTO fulfillment_itens (organizacao_id, fulfillment_id, workstream, titulo, ordem, metadata)
SELECT f.organizacao_id, f.id, v.workstream, v.titulo, v.ordem, v.metadata::jsonb
FROM fulfillments f
CROSS JOIN (VALUES
  ('onboarding', 'Agendar e conduzir a reunião de onboarding do ambiente', 12, '{}'),
  ('onboarding', 'Validar ambiente com o cliente e liberar acesso administrativo', 13, '{}'),
  ('go_live', 'Confirmar go-live do ambiente White Label', 14, '{}'),
  ('conclusao', 'Concluir implantação e realizar handoff para Customer Success', 15, '{"handoffCs":true}')
) AS v(workstream, titulo, ordem, metadata)
WHERE f.service_family = 'WHITE_LABEL'
  AND NOT EXISTS (SELECT 1 FROM fulfillment_itens x WHERE x.fulfillment_id = f.id AND x.status <> 'PENDING')
  AND NOT EXISTS (SELECT 1 FROM fulfillment_itens x WHERE x.fulfillment_id = f.id AND x.titulo = v.titulo);
