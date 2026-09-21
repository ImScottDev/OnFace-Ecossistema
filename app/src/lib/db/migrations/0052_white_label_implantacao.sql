-- Corrige a trilha já criada no ambiente local: White Label é implantação,
-- não onboarding. A migração é idempotente e preserva itens já executados.
DO $$
DECLARE
  f record;
  etapa record;
  etapas jsonb := '[
    {"workstream":"abertura","titulo":"Iniciar implantação e confirmar responsável interno"},
    {"workstream":"comunicacao","titulo":"Fazer contato de boas-vindas e apresentar os próximos passos"},
    {"workstream":"comunicacao","titulo":"Enviar formulário de materiais e configuração"},
    {"workstream":"coleta","titulo":"Receber e validar materiais e informações do cliente"},
    {"workstream":"coleta","titulo":"Solicitar correções ou complementos, quando necessário"},
    {"workstream":"configuracao","titulo":"Configurar ambiente White Label e identidade da marca"},
    {"workstream":"dominio","titulo":"Enviar instruções de DNS/CNAME e acompanhar a configuração"},
    {"workstream":"dominio","titulo":"Validar DNS, TLS e domínio de e-mail (SPF/DKIM quando aplicável)"},
    {"workstream":"qualidade","titulo":"Executar QA interno do ambiente"},
    {"workstream":"validacao_cliente","titulo":"Validar ambiente com o cliente e liberar acesso administrativo"},
    {"workstream":"go_live","titulo":"Confirmar go-live do ambiente White Label"},
    {"workstream":"handoff","titulo":"Realizar handoff para Customer Success"}
  ]'::jsonb;
BEGIN
  FOR f IN SELECT id, organizacao_id FROM fulfillments WHERE service_family = 'WHITE_LABEL' LOOP
    -- Só reescreve checklists ainda totalmente pendentes; nunca apaga o
    -- histórico de uma implantação que já teve execução humana.
    IF NOT EXISTS (SELECT 1 FROM fulfillment_itens WHERE fulfillment_id = f.id AND status <> 'PENDING') THEN
      DELETE FROM fulfillment_itens WHERE fulfillment_id = f.id;
      FOR etapa IN SELECT value, ordinality FROM jsonb_array_elements(etapas) WITH ORDINALITY LOOP
        INSERT INTO fulfillment_itens (organizacao_id, fulfillment_id, workstream, titulo, ordem)
        VALUES (f.organizacao_id, f.id, etapa.value->>'workstream', etapa.value->>'titulo', etapa.ordinality - 1);
      END LOOP;
    END IF;
  END LOOP;
END $$;
