# Stripe no ONFACE — diagnóstico e plano, 05/10

Cruzamento de duas leituras feitas hoje: o inventário linha a linha do nosso
código e a documentação atual do Stripe. Nada foi alterado; isto é o mapa.

## O retrato em uma frase

A integração **cobra bem e reconcilia bem**, e **erra em tudo que vem depois do
primeiro pagamento**: cliente duplicado, upsell, estorno, trial, autoatendimento.

## Medido no banco (não é opinião)

| | |
|---|---|
| Empresas com **mais de um** cliente no Stripe | **30** |
| Clientes do Stripe vinculados a **mais de uma** empresa | **6** |
| Mapeamentos de alias criados para resolver isso | **2** |
| Linhas na tabela `checkouts` | **0** |
| Assinaturas (130 ativas, 19 em atraso, 25 não pagas, 2 em teste) | 357 |
| Empresas com cliente no Stripe | 125 de 3.105 |

A tabela `checkouts` zerada quer dizer que o fluxo "aceite da proposta → Stripe"
**nunca completou uma vez** nesta base.

---

## 1. O que está certo e deve ser preservado

- **Reconciliação de MRR funciona.** `stripe-sync.ts:381-410` compara o valor
  anterior com o recalculado do Stripe a cada 30 min e em todo webhook, com
  `pg_advisory_xact_lock`, dedup de contrato espelho e alerta de pagante órfão.
  **A hipótese "o CRM não reconcilia" está refutada.** O problema é atribuição,
  não valor.
- **Webhook é seguro**: HMAC manual com tolerância de 300 s, múltiplos `v1`
  (rotação de segredo), `timingSafeEqual`, e **fail-closed** — sem
  `STRIPE_WEBHOOK_SECRET` devolve 503 em vez de aceitar payload forjado.
- **Inbox de eventos** com `event_id` único e payload bruto guardado.
- **Trava de chave live**: chave `_live_` só passa com `NODE_ENV=production` E
  `ALLOW_STRIPE_LIVE_CHECKOUT=true`.
- **Metadata rica** (13 chaves `crm_*`) propagada para Customer, Session,
  Subscription, PaymentIntent e Invoice. Limite do Stripe é 50 chaves — folga.

---

## 2. Os nove defeitos, em ordem de dano

### D1 — Cliente duplicado é garantido por construção
`stripe-checkout.ts:96-115` vai direto para `POST /customers` quando não há id
no CRM. **Não existe nenhuma busca no Stripe em todo o repositório.** A única
defesa é uma chave de idempotência que **expira em 24 h**.

Consequência: segunda proposta no dia seguinte = cliente novo. Cliente que já
existia no Stripe antes do CRM = cliente novo. É a causa dos 30 casos medidos.

**O certo (doc):** a verdade do vínculo mora no nosso banco; quando faltar,
`GET /v1/customers?email=` — que é consistente — e **nunca** `customers/search`,
que atrasa até 1 h e tem limite de 20 leituras/s.

### D2 — Upsell em quem já paga: bloqueado, e sem saída
> **Resolvido (lote 3):** a alteração existe em `lib/integrations/stripe-assinatura-acoes.ts`, exposta por `api-server/routes/clientes-assinatura.ts` e usada no Cliente 360 (`components/onface/AssinaturasDoCliente.tsx`). O texto abaixo é o diagnóstico original.

`lib/crm/checkout.ts:41-47` barra o checkout de expansão com a mensagem "conclua
pela alteração de assinatura aprovada". **Essa alteração não existe em runtime.**
Não há uma chamada de `subscription_items` fora de script manual. O próprio
código registra: "hoje o banco tem ZERO negócios com `commercial_motion =
'EXPANSION'`".

**O certo (doc):** `POST /v1/subscription_items` com
`proration_behavior=always_invoice` (emite a fatura na hora; o default
`create_prorations` só cobra na próxima) e `metadata[crm_negocio_id]`. Mostrar
`POST /v1/invoices/create_preview` ao closer antes de confirmar.

**Decisão de produto embutida:** assinatura com vários itens **tira o upgrade
autosserviço do Customer Portal**. Se o autoatendimento importa mais, a saída é uma
assinatura por família de serviço. É escolha, não detalhe.

**Armadilha que vale um guard no código:** mandar `items[0][price]` sem
`items[0][id]` **adiciona** um item em vez de trocar (cliente paga os dois), e
trocar o preço **reseta `quantity` para 1** — 5 licenças viram 1 em silêncio.

### D3 — Dinheiro fora do fluxo do CRM some
`route.ts:37` e `:146`: sem linha em `checkouts`, o handler sai sem fazer nada e
o evento é marcado como **processado com sucesso**. O `syncStripe` depois cria
assinatura, contrato e fatura — então **o dinheiro aparece no Financeiro e o
negócio fica aberto no pipeline para sempre**.

Confirma a hipótese "signup direto nunca dá ganho automático".

### D4 — Expansão não credita vendedor
`mrr_movimentos` (`schema.ts:987-1015`) tem lead, assinatura, contrato e evento
comercial — **e não tem `negocio_id`**. `registrarMovimento` não cria negócio.
O dinheiro entra no MRR e desaparece da atribuição.

Confirma "upsell no Stripe não conta na meta do closer".

### D5 — Estorno e contestação não existem
`charge.refunded`, `charge.dispute.created` e `charge.dispute.closed` **não estão
na lista de eventos ouvidos** (`route.ts:405-423`). Negócio estornado continua
`ganho`, com MRR vivo.

Nota: **boleto não tem chargeback** (não há fluxo de disputa), então isso vale
para cartão.

### D6 — Trial não existe
`grep trial_period_days` no projeto inteiro: **zero**. O período de teste da
proposta não chega ao Stripe.

**O certo (doc):** `subscription_data[trial_period_days]` +
`payment_method_collection=if_required` +
`subscription_data[trial_settings][end_behavior][missing_payment_method]`
(`pause` para não gerar fatura sem forma de pagamento). Ouvir
`customer.subscription.trial_will_end` — **mas conferir o status antes de
comunicar**, porque a doc avisa que ele pode disparar junto com a cobrança.

### D7 — Portal do cliente não existe
Nenhuma `billingPortal.sessions` em lugar nenhum. Hoje a única forma de trocar
cartão é o link que vai numa notificação **depois que a fatura falhou**.

Era a dor do "boleto para cartão". **O portal resolve**: o cliente troca sozinho,
boleto e Pix estão entre os métodos suportados.

**Pegadinha de retry:** o Stripe tenta primeiro no
`subscription.default_payment_method` e só depois no do Customer. Trocar só o do
Customer deixa a assinatura tentando no método velho.

### D8 — Documento fiscal: coletado duas vezes, e o oficial não funciona aqui
`stripe-checkout.ts:247` manda `tax_id_collection` **e** `:253` um campo manual
obrigatório. O cliente digita o CNPJ duas vezes.

**E tem mais, que muda o conserto:** `tax_id_collection` **não suporta o Brasil**
— `br_cnpj` e `br_cpf` existem só na API de Tax IDs do Customer, não no Checkout.
Então o campo "oficial" nunca ia funcionar mesmo.

**O certo:** manter o campo manual (com validação de dígito verificador, não
contagem de dígitos como hoje em `route.ts:204-206`) e gravar depois com
`POST /v1/tax_ids` tipo `br_cnpj`/`br_cpf` — é isso que faz o documento sair no
PDF da fatura e no boleto.

**Nota fiscal:** o Stripe **não emite NF-e/NFS-e** e o **Stripe Tax não cobre o
Brasil**. `automatic_tax` é inútil aqui. O desenho certo é disparar o emissor
(eNotas, NFE.io, ERP) no `invoice.paid`.

### D9 — Reprocessamento de webhook está morto
A rota grava status em minúsculas (`route.ts:555,585,590`) e o worker compara em
MAIÚSCULAS (`stripe-webhook-events.ts:18,23`). O claim atômico **nunca casa**, o
job roda sem trava, e eventos que falharam ficam parados sem ninguém drenar.

---

## 3. Dois bugs que cobram errado (corrigir antes de ir para live)

1. **Cupom replayado com desconto velho.** `stripe-checkout.ts:207` usa a chave
   `crm-coupon-${crm_group_id}` **sem `attemptKey`**, enquanto a sessão usa
   `crm-session-${grupo}-${attemptKey}`. Re-gerar o checkout com desconto
   renegociado dentro de 24 h faz o Stripe **repetir o cupom antigo**.
2. **Retry de checkout falha por construção.** `:261` manda
   `integration_identifier` com sufixo aleatório no corpo, com chave de
   idempotência determinística em `:275`. Mesma chave + corpo diferente = o
   Stripe recusa. (O campo também não é parâmetro documentado de Checkout.)
3. **Parcelamento sem transação.** `stripe-invoice.ts:115-131` faz N chamadas em
   laço **sem `Idempotency-Key`**. Falha de rede no meio e o retry do operador
   **cobra o cliente duas vezes**.

---

## 4. Dívida de arquitetura

- **Não usamos o SDK oficial.** Não há dependência `stripe` no `package.json`:
  são **cinco clientes HTTP artesanais**. Perde-se retry com backoff, tipos e
  pin de versão central.
- **Versão da API fixada em 2 de 5 lugares.** `stripe-sync.ts`,
  `stripe-invoice.ts` e a rota de webhook rodam na versão default da conta. Isso
  é pior que versão antiga: são duas versões no mesmo fluxo. Já gerou remendo —
  `stripe-sync.ts:131-132` lê `invoice.subscription` **e**
  `invoice.parent.subscription_details.subscription` porque o campo mudou de
  lugar.
- **Sync trunca em silêncio.** `stripe-sync.ts:68` pagina no máximo 50 vezes:
  para em 5.000 registros por recurso, sem erro nem aviso.
- **`client_reference_id` não é usado** — é o campo que o Stripe oferece
  exatamente para ligar a sessão ao nosso id.
- **Eventos fora da lista branca não são persistidos** (`route.ts:538-540`
  responde 200 antes de qualquer gravação): perde-se a trilha de estorno,
  disputa e mudança de catálogo.

---

## 5. Ordem de ataque

**Antes de virar o Stripe para live**
1. Corrigir os três bugs de cobrança da seção 3 (cupom, retry, parcelamento).
2. Dedup de cliente: `customers?email=` como fallback e chave de idempotência
   derivada do negócio, não do tempo. **Sem isto, cada dia em live cria mais
   duplicata.**
3. Ouvir `charge.refunded` e `charge.dispute.*` — nem que seja só para criar
   tarefa de CS e tirar o negócio de `ganho`.
4. Consertar o case do status do inbox (uma linha, destrava o reprocessamento).

**Primeira semana**
5. Caminho de expansão: `subscription_items` com `always_invoice`, prévia para o
   closer, e `negocio_id` em `mrr_movimentos` para creditar o vendedor.
6. Pagamento sem `checkouts`: em vez de descartar, abrir caso de conciliação
   (a tabela `billing_resolution_cases` já existe e está vazia).
7. Portal do cliente: uma configuração versionada e um botão no Cliente 360.

**Depois**
8. Trial de verdade no Checkout, com `trial_will_end` tratado.
9. Documento fiscal: tirar o `tax_id_collection` (não funciona no Brasil),
   validar dígito verificador e gravar via `POST /v1/tax_ids`.
10. Adotar o SDK oficial e fixar a versão da API num lugar só.

**Ferramental (barato e muda a qualidade do que escrevemos)**
`stripe agent setup` instala o plugin oficial, que traz MCP + skills atualizados
pela própria Stripe. Em Claude Code:
`claude plugin install stripe@claude-plugins-official`.
**Prazo duro: a partir de 31/10/2026 o MCP do Stripe deixa de aceitar secret key
full-access** — é preciso migrar para Agent Keys.

---

## 6. Se for usar Pix Automático

Três armadilhas que matam upsell em silêncio:
- **Teto do mandato default é R$ 400.** Valor acima disso **falha**.
- **Só uma cobrança por ciclo.** Upsell com cobrança imediata exige um Checkout
  à parte, com o cliente presente.
- O cliente **revoga o mandato no app do banco** e o único aviso é o evento
  `mandate.updated`, que hoje ninguém ouve.

## 7. Dunning de boleto é problema nosso

O Smart Retries do Stripe **não cobre boleto** (a tabela de retry de métodos
locais cobre só débitos diretos). Para boleto, **a régua de cobrança tem de ser
do CRM**, em cima de `invoice.payment_failed`, `invoice.overdue` e
`next_payment_attempt`.

E separar nos relatórios: `invoice.marked_uncollectible` é **baixa contábil
decidida por nós**, não falha de pagamento.
