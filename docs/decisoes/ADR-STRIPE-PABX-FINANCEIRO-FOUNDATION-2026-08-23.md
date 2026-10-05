---
title: "Fundação financeira CRM2: Stripe + PABX mensal"
date: 2026-08-23
status: accepted
---

# Contexto

O CRM2 precisa ser a interface operacional do financeiro, mas existem duas fontes
legítimas de cobrança:

- Stripe: Callface AI e outros serviços com assinatura, invoice e pagamento;
- planilha mensal de faturamento: fonte operacional atual do PABX.

O MRR atual continua vindo de `servicos_canonicos.current_recurring_value`.
Faturamento mensal externo é evidência de cobrança/recebimento e não substitui o
estado comercial, lifecycle ou MRR canônico do Service.

# Decisões

1. Cada upload PABX cria ou atualiza uma competência identificável, preservando o
   arquivo, linhas válidas, linhas com divergência, total e status de fechamento.
   Repetir o mesmo arquivo não duplica a competência.
2. O casamento PABX usa CPF/CNPJ normalizado e/ou chave de linha documentada. Nome
   não é suficiente para atribuir uma cobrança a uma empresa.
3. Stripe webhooks entram primeiro em uma inbox com `event_id` único. Evento
   duplicado recebe ACK idempotente; evento sem organização resolvida não pode
   executar mutação de negócio silenciosamente.
4. Subscription Items são persistidos em tabela própria. `assinaturas.raw` continua
   disponível como evidência, mas não é a interface de domínio.
5. `past_due`, `unpaid`, invoice aberta ou fatura PABX em aberto não significam
   churn. Automação financeira deve operar sobre eventos/status de billing e nunca
   reescrever histórico de Opportunity.
6. Ações Stripe mutáveis ficam em uma etapa posterior, protegidas por RBAC,
   idempotency key e `audit_log`. Sem chave Stripe de teste configurada, a rodada
   não simula sucesso nem altera o provider.

# Fluxo alvo

```text
CSV PABX mensal -> preview -> validação/casamento -> lote por competência
                -> Service/Empresa + evidência -> Financeiro/Cliente 360

Stripe webhook -> assinatura verificada -> stripe_webhook_events
               -> sync idempotente -> Service/assinatura/item/invoice
               -> timeline/auditoria -> automações financeiras
```

# Critérios de aceite desta fatia

- schema/migration para inbox Stripe e itens de assinatura;
- sync grava itens sem perder a granularidade do subscription;
- webhook não processa o mesmo `event_id` duas vezes;
- importador PABX aceita a planilha mensal real e expõe preview/resultado sem
  reimportar o lote fechado de julho;
- tsc, build e `git diff --check` passam sem erro novo;
- nenhuma chamada de escrita Stripe, banco remoto ou produção.

# Fora desta fatia

- trocar plano, quantidade, cancelamento ou reativação via CRM;
- disparar WhatsApp/e-mail automaticamente;
- reconciliar o banco do SaaS Callface AI em tempo real;
- classificar família por nome de produto ou por inferência do CSV de vendas.

