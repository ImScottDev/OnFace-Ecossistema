# AUDITORIA — Módulo Financeiro (2026-07-21)

> Fase 1 do projeto "Financeiro como central de decisão do SaaS". Toda afirmação abaixo foi
> confirmada em código (repo local, que espelha prod) e/ou query read-only no banco de PROD
> + API do Stripe (consultada de dentro da EC2, key não saiu do servidor).

## 1. Arquitetura atual (de onde vem cada número)

### Fluxo de dados

```
Stripe API ──(polling 30min, worker "stripe-sync")──► assinaturas + contratos(espelho) + faturas(origem='stripe')
Stripe webhooks ──(tempo real, /api/webhooks/stripe no NEXT)──► aceite de proposta + dispara syncStripe() incremental
Planilha Wevy (PABX) ──► NUNCA FOI IMPORTADA (ver §3.1)
```

- **Integração é híbrida webhook + polling**: webhooks (`invoice.paid`, `invoice.payment_failed`,
  `invoice.finalized`, `customer.subscription.*`, `checkout.session.*`) chegam em tempo real e
  disparam um `syncStripe()` completo; o worker roda o mesmo sync a cada 30 min como rede de
  segurança. Atraso máximo de dado no dashboard: ~30 min. **Não é gargalo.**
- **Roteamento**: Traefik manda `/api/*` pro Hono, MAS `/api/financeiro` e `/api/webhooks` são
  exceções explícitas que ficam no Next (`_deploy-prod/docker-compose.yml` linhas 90/136).
  As rotas do Financeiro são Next route handlers, não Hono — qualquer rota NOVA de financeiro
  precisa ou entrar na exceção do Traefik ou (melhor, padrão do projeto) nascer no Hono.

### Origem de cada número da UI (`app/(crm)/financeiro/page.tsx`)

| Card / coluna | Endpoint | Fonte |
|---|---|---|
| Receita Prevista (mês) | `/api/financeiro/inadimplencia` | `sum(contratos.mrr)` status=ativo |
| Recebido no Mês | idem | `sum(faturas.valor)` status=paga, paga_em >= início do mês |
| A Receber (mês) | idem | derivado no front: prevista − recebido − atraso (clamp 0) |
| Em Atraso | idem | faturas `aberta`/`uncollectible` emitidas NO mês corrente |
| "histórico" (não cobrado) | idem | faturas `aberta`/`uncollectible` emitidas ANTES do mês |
| Cancelamentos no Mês | idem | `contratos` status=churned com finalizado_at no mês |
| Tabela (1 linha/contrato) | idem | contratos ativos + LATERAL agregando faturas do lead |
| Coluna "Status" | idem | **enum derivado na hora** (ver §2.1) |
| Aba Faturas | `/api/financeiro/vendas?visao=fatura` | lista bruta de `faturas`, sem filtro de status na UI |

### Tabelas

- `contratos` — status ativo/churned, `mrr`, `produto` (ai|pabx|**NULL**), `stripe_subscription_id`, `motivo_churn`.
- `assinaturas` — espelho 1:1 da subscription Stripe (status, mrr, cancelada_em, `motivo_cancelamento` **sempre NULL hoje**).
- `faturas` — espelho de invoice Stripe (`origem='stripe'`) + espaço reservado pra PABX (`origem='pabx'`, vazio).
  **Não tem coluna de vencimento (due_date)** — aging só dá pra aproximar por `emitida_em`.

## 2. Diagnóstico confirmado (com dado de prod, 21/07)

### 2.1 Coluna "Status" mistura 4 dimensões — CONFIRMADO
`inadimplencia/route.ts:89-93`: o status é um `if/else` que colapsa (venceu quando? × pagou? ×
há quanto tempo?) num enum só (`atrasado`, `pendencia_antiga`, `pago`, `a_faturar`, `em_dia`...).
Não existe campo de vencimento, data de pagamento por linha, nem dias em atraso. Funil de
cobrança é impossível com esse dado.

### 2.2 Nenhuma métrica de SaaS calculada — CONFIRMADO
Growth report tem só "MRR ativo" (`sum(contratos.mrr)` de TODOS os ativos, sem quebra por
componente e sem segmentar produto). Não existe MRR novo/expansão/contração/churn, ARR, NRR,
LTV, ARPU, LTV:CAC, CAC payback em lugar nenhum do código. O CAC já existe na aba Mídia Paga
(`lib/relatorios/midia-paga.ts`) — o cruzamento é viável.

### 2.3 Inadimplência sem aging — CONFIRMADO, e o aging real é este (banco de prod, 21/07):

| Faixa (desde emissão) | Faturas | Valor |
|---|---|---|
| 0–15 dias | 16 | R$ 12.853,89 |
| 16–30 dias | 13 | R$ 2.936,08 |
| 31–60 dias | 29 | R$ 14.633,43 |
| 60+ dias | 29 | R$ 9.174,76 |

R$ 23,8k (58 faturas) têm mais de 30 dias — recuperabilidade baixíssima, e hoje esse valor
aparece diluído num número único.

### 2.4 Cancelamentos sem contexto — CONFIRMADO E QUANTIFICADO
Os "16 cancelamentos no mês" da UI, abertos no Stripe (julho/2026):
- **10 involuntários** (`payment_failed`) × 6 voluntários (`cancellation_requested`)
- MRR perdido: **~R$ 5.536/mês** (número que a UI não mostra)
- Histórico geral: 56 de 86 canceladas = `payment_failed` (65%, bate com a auditoria de dados de jun).
- `assinaturas.motivo_cancelamento`: **0 de 86 preenchidos** — o sync não grava `cancellation_details`
  que o Stripe já retorna de graça. Feedback de cancelamento existe em só 18/86 no Stripe.

### 2.5 PABX: pior que "manual" — NUNCA ENTROU
Zero faturas `origem='pabx'` e zero contratos `produto='pabx'` no banco de prod. A aba PABX
existe no código mas foi removida da UI (page.tsx renderiza só "Callface AI" e "Faturas").
A receita PABX hoje não está desatualizada no CRM — ela **não existe** no CRM. Fonte segue
sendo a planilha `PLANO 2026.xlsx` da Wevy, fora do sistema.

### 2.6 ACHADO NOVO — 22 contratos ativos invisíveis (R$ 18.327 de MRR)
`aceitar-proposta.ts` cria contrato **sem `produto`**. Resultado em prod: 22 contratos ativos
com produto NULL (R$ 18,3k MRR). A aba Callface AI filtra `c.produto = 'ai'` → **toda venda
nova fechada por proposta/checkout some do Financeiro** (e o LATERAL de faturas também não
casa, porque `NULL <> 'pabx'` é NULL). Números da aba: 90 contratos ai (R$ 34,3k), quando a
carteira real ativa é 112 (R$ 52,6k).

### 2.7 ACHADO NOVO — janela de 60 dias congela status de fatura antiga
`stripe-sync.ts:208` só puxa invoices criadas nos últimos 60 dias. Fatura mais velha que isso
que mudar de status no Stripe (paga tarde, void, uncollectible) fica **congelada como "aberta"
no CRM pra sempre**. O banco tem 87 abertas × Stripe tem 91 open — divergência já existente.
Qualquer aging/taxa de recuperação construído em cima disso nasce errado. (Pendência já
apontada na auditoria Stripe de 21/07, vira pré-requisito agora.)

### 2.8 Stripe: o que JÁ está pronto e o que falta ligar

| Feature | Estado real (verificado via API, 21/07) |
|---|---|
| Retries automáticos | **Rodando** (attempt_count até 9 nas abertas). MAS: 85 das 91 open esgotaram a régua e ficaram penduradas sem `next_payment_attempt` — sem ação final configurada (marcar uncollectible / cancelar sub) nem fila humana. |
| Customer Portal | **JÁ EXISTE, ativo e default**, com update de cartão E cancelamento habilitados. Ninguém manda o link pro cliente inadimplente. |
| Pesquisa de cancelamento | Parcial: portal coleta feedback às vezes (18/86). Falta exigir motivo no fluxo de cancel do portal. |
| E-mail de cartão expirando / dunning e-mails | **Não verificável por API** (config de dashboard). Checar em Settings → Billing → Automatic collection. Dado indireto: 18 subs past_due acumuladas sugerem régua de e-mail fraca ou desligada. |
| Smart Retries vs régua fixa | Não verificável por API; attempt_count 9 sugere régua custom agressiva. Confirmar no dashboard se "Smart Retries" está selecionado. |

### 2.9 Sem coorte, forecast ou calendário — CONFIRMADO
Nada disso existe. Dado necessário já está no banco (contratos.vencimento + assinaturas.
current_period_end + pipeline comercial nos relatórios), só não é usado.

## 3. Correções de premissa vs prompt original

1. A integração Stripe **já é webhook + polling** (não só polling) — o problema de dado não é
   atraso, é completude (janela 60d, produto NULL, due_date ausente, cancellation_details ignorado).
2. O Customer Portal **não precisa ser construído nem ativado** — já está ativo; falta usá-lo
   na régua de cobrança.
3. PABX não é "dado manual atrasado" — é dado inexistente no sistema. O ticket certo é ingestão
   (upload de planilha padronizada), não reconciliação.

## 4. Riscos se nada for feito

- R$ 39,6k em faturas abertas sem fila de ação (só ~R$ 15,8k com <30d, janela boa de recuperação).
- ~R$ 5,5k de MRR/mês evaporando, 62% por cartão recusado (recuperável com dunning decente).
- Liderança decidindo com "MRR ativo" que ignora R$ 18,3k de contratos sem produto e mistura
  linhas de receita.

Plano de ação com tickets: `PLANO-ACAO-FINANCEIRO.md`.
