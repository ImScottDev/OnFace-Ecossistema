# PLANO DE AÇÃO — Financeiro como central de decisão (2026-07-21)

> Fase 2 do projeto. Tickets prontos pro Linear, priorizados. Base: `AUDITORIA-FINANCEIRO.md`.
> Regra de entrega: cada onda sobe em homolog, valida com Kauã, e só então a próxima começa
> (lição do módulo CS — nada de construir tudo de uma vez).

## Onda 0 — Fundação do dado (pré-requisito de TUDO)

### F1 — Faturas: separar as dimensões de status
**Escopo:** adicionar `vencimento` (due_date do Stripe; pra cobrança automática usar
`period_end`/data da tentativa), `hosted_invoice_url`; `dias_em_atraso` vira cálculo derivado
(now − vencimento) exposto pela API, não coluna. Sync passa a gravar tudo. Backfill das 452
faturas existentes re-puxando do Stripe por id.
**Aceite:** nenhuma fatura aberta sem vencimento; endpoint retorna venceu_em / pago_em /
dias_em_atraso como campos separados; enum "status de cliente" some da API (fica só visual).

### F2 — Sync sem janela cega
**Escopo:** reconciliar TODAS as invoices `open`/`uncollectible` do Stripe (query por status,
sem filtro de created) além da janela de 60d pra novas; upsert com lock (corrida do webhook +
worker não duplica contrato — pendência da auditoria Stripe).
**Aceite:** count(abertas) CRM == count(open) Stripe; rodar sync 2x seguidas não muda nada.

### F3 — Contratos sem produto (R$ 18,3k invisíveis)
**Escopo:** `aceitar-proposta.ts` seta `produto: 'ai'`; backfill dos 22 contratos NULL;
constraint NOT NULL depois do backfill.
**Aceite:** aba Callface AI mostra 112 contratos / R$ 52,6k; zero contrato ativo sem produto.

### F4 — Motivo de cancelamento no sync
**Escopo:** gravar `cancellation_details.reason` + `feedback` + `comment` em
`assinaturas.motivo_cancelamento` (e propagar pro `contratos.motivo_churn` no espelho).
Backfill das 86 canceladas.
**Aceite:** toda assinatura cancelada tem reason; churn separável em voluntário × involuntário
por query.

## Onda 1 — Ganhos rápidos no Stripe (config, quase zero código)

### F5 — Régua de cobrança nativa (checklist de dashboard, executar com Kauã)
**Escopo:** conferir/ligar em Settings → Billing: Smart Retries; e-mails de cartão expirando;
e-mails de fatura falha com link do **Customer Portal que já está ativo**; ação final da régua
(marcar `uncollectible` + cancelar assinatura) — hoje 85 faturas ficam penduradas sem próxima
tentativa. Ligar coleta obrigatória de motivo no cancel do portal.
**Aceite:** print das configs no ticket; fatura nova que falhar percorre régua completa e
termina em estado terminal, não "open" eterna.

### F6 — Notificação interna de pagamento falho e past_due
**Escopo:** webhook `invoice.payment_failed` → notificação no CRM pro responsável da conta
com link do portal pra mandar ao cliente. Assinatura `past_due` (18 hoje) vira item de fila.
**Aceite:** falha de pagamento gera notificação em <1 min com valor, cliente e ação sugerida.

## Onda 2 — Métricas centrais (backend)

### F7 — Tabela de movimentos de MRR
**Escopo:** `mrr_movimentos` (data, assinatura, tipo: novo|expansao|contracao|churn|reativacao,
delta). Alimentada pelo diff do sync (mrr anterior × novo) + `customer.subscription.updated`.
Backfill histórico a partir do Stripe (subscriptions + histórico de items).
**Aceite:** soma dos movimentos reconstrói o MRR ativo atual com erro < 1%.

### F8 — Camada de métricas `lib/financeiro/metricas.ts`
**Escopo:** MRR 5 componentes, ARR, Net MRR growth, NRR, churn de logo × receita,
voluntário × involuntário, ARPU, LTV (por cliente e por plano), LTV:CAC e CAC payback
(CAC vem de `midia-paga.ts`), taxa de recuperação de pagamento falho (paga após attempt>1).
Tudo segmentável por produto (ai|pabx). Script de invariantes no padrão
`checar-invariantes-relatorios.ts`.
**Aceite:** endpoint `/api/financeiro/metricas?periodo=` (Hono) com os números batendo contra
queries manuais no banco; invariantes verdes.

### F9 — Forecast e calendário
**Escopo:** projeção de MRR 3 meses (base ativa − churn médio 3m + pipeline ponderado do
relatório comercial); calendário de renovação (contratos.vencimento + current_period_end) e
cartões prestes a expirar (Stripe `payment_method.card.exp_*`).
**Aceite:** aba Visão Geral mostra caixa previsto do mês; lista de renovações 90d exportável.

## Onda 3 — PABX (Wevy)

### F10 — Ingestão da planilha PABX
**Escopo:** upload de planilha padronizada (modelo fixo derivado da PLANO 2026.xlsx) numa tela
admin → parser → upsert em `contratos`/`faturas` com `origem='pabx'` e chave estável por linha.
Guardar `ultima_carga_em` visível na UI. Sem integração direta com a Wevy por ora.
**Aceite:** subir a planilha do mês popula a aba PABX; subir a mesma 2x não duplica; data da
última carga aparece na aba.

## Onda 4 — Frontend (6 abas, uma por PR, aprovação visual por aba)

### F11 — Visão Geral (o "bate o olho" da liderança)
MRR com 5 componentes + ARR + NRR + churn logo/receita + LTV:CAC + caixa previsto. Receita
sempre segmentada AI × PABX (nunca um total sem quebra).

### F12 — Cobrança & Inadimplência
Aging em faixas (0-15/16-30/31-60/60+), fila de ação ordenada por recuperabilidade
(valor × dias × histórico), taxa de recuperação, botão "copiar link do portal".

### F13 — Clientes & Assinaturas (evolução da aba atual)
Por cliente: LTV acumulado, tempo de vida, plano, ciclo, próxima cobrança, risco (atraso
recorrente / cartão expirando / disputa). Colunas de status separadas (F1), não enum único.

### F14 — Churn & Cancelamentos
Lista com motivo (F4), MRR perdido, voluntário × involuntário, tendência mensal.

### F15 — Faturas (Stripe) com filtro por status real
Mantém lista bruta + filtro paid/open/past_due/void/uncollectible + link hosted_invoice_url.

### F16 — PABX (Wevy)
Receita e inadimplência da linha PABX + data da última planilha importada em destaque.

## Dependências

```
F1,F2,F3,F4 (Onda 0) ─► F7,F8 ─► F9, F11-F15
F5,F6 independentes (podem começar já)
F10 ─► F16
```

## Ordem sugerida de execução (time de 1 dev + validação Kauã)

1. **Semana 1:** Onda 0 inteira (F1-F4) + F5 (30 min de dashboard com o Kauã) + F6.
   Só isso já: recupera R$ 18,3k de MRR invisível, destrava funil de cobrança e liga a
   máquina de recuperação nativa do Stripe no maior ralo de churn (62% involuntário).
2. **Semana 2:** F7 + F8 (métricas), validar números contra Stripe/planilha antes de UI.
3. **Semana 3:** F11 + F12 (as duas abas de maior decisão), depois F13-F15 aba a aba.
4. **Paralelo/depois:** F10 + F16 quando a Wevy padronizar a planilha.
