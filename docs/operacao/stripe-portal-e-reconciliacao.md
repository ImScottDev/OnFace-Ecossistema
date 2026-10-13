# Stripe: Portal do cliente e reconciliação (lotes 5 e 6)

> Decisão e estado em 13/10/2026. Conta Stripe live `acct_1RhDFIEd4dqxpSBf`, COMPARTILHADA com o SaaS Callface.

## 1. Portal: configuração própria do ONFACE

**Decisão:** o ONFACE gere a PRÓPRIA configuração de portal (marca `metadata.crm_portal = crm-cliente-360-v1`),
versionada em `app/src/lib/integrations/stripe-portal-config.ts`. Não adota a configuração padrão da conta.

Por quê (lido na conta em 13/10, só leitura):

| Configuração | Quem é | Problema |
|---|---|---|
| `bpc_1RizqoEd4dqxpSBfC0NjNR2g` | padrão da conta (`is_default`), feita à mão no Dashboard em jul/2025 | deixa o cliente trocar o **e-mail** (identidade do Customer no webhook), não deixa corrigir o **documento fiscal**, e qualquer pessoa com Dashboard muda o portal sem revisão |
| `bpc_1UNAU0Ed4dqxpSBfjw18idmU` | do SaaS (`managed_by = callface-backend`) | intocável |

Mudança de plano **não** entra no portal: upgrade é imediato com pró-rata, downgrade vale no próximo ciclo e o CS pode
sobrescrever (Cliente 360). O portal só rebaixa entre Prices do mesmo Product e não opera assinatura com vários itens,
com teste ou cobrada por envio de fatura/boleto. Plano muda pelas portas de `lib/vendas`, num caminho só.

Resolução (`configurarPortal`): 1) `STRIPE_PORTAL_CONFIGURATION_ID`, se fixado, é respeitado (escolha explícita do
operador; a do SaaS é recusada); 2) a configuração com a marca `crm_portal`, usada como está e **atualizada só se
divergir** (antes escrevia no Stripe a cada clique); 3) criar. Nunca toca a padrão nem a do SaaS.

**Política de privacidade e termos.** A API não os marca como obrigatórios (a configuração do SaaS foi criada com os
dois nulos), mas o Stripe recusou a criação do ONFACE. A causa não é legível só com leitura. Por isso o caminho é
honesto: `STRIPE_PORTAL_PRIVACY_URL` e `STRIPE_PORTAL_TERMS_URL` entram na criação; se o Stripe recusar, a rota
`POST /clientes/:id/portal-stripe` responde **422** com a mensagem do que falta (`PortalConfigError`), não um 400 cru.

**Para sair da variável posta à mão:** definir as duas URLs no `.env`, remover `STRIPE_PORTAL_CONFIGURATION_ID` e rodar
`npx tsx --env-file=.env src/scripts/stripe-portal-configuracao.ts --simular` (e `--aplicar` para criar). Enquanto a
variável estiver fixada na padrão, o script `--simular` lista os riscos.

## 2. O que o cliente faz no portal e volta ao ONFACE

| Ação no portal | Evento Stripe | Inbox | Espelho | Timeline | Aviso |
|---|---|---|---|---|---|
| Cancelar (fim do período) | `customer.subscription.updated` | já ouvido | **novo:** `assinaturas.raw.cancela_no_fim` (o Cliente 360 e o CS já liam e nunca era gravado) | já existia; **agora com o motivo** | **novo:** `cancelamento_agendado` (a hora de reverter) |
| Desfazer o cancelamento | `customer.subscription.updated` | já ouvido | idem | já existia | — |
| Cancelamento efetivado | `customer.subscription.deleted` | já ouvido | já existia | já existia | já existia |
| Cartão novo | `payment_method.attached` | **faltava no endpoint** | n/a | já existia | — |
| Nome, telefone, endereço | `customer.updated` | **faltava no endpoint** | **novo:** empresa (só preenche vazio) | **novo:** `CustomerBillingUpdated` | **novo:** `cadastro_divergente` se o CRM tem outro valor |
| Documento fiscal | `customer.tax_id.created/updated/deleted` (não vem em `customer.updated`) | **faltava no endpoint e no código** | **novo:** `empresas.cnpj` se vazio | **novo** | idem |

O endpoint `we_1TjdWrEd4dqxpSBfkUfCj8QE` (`crm.callface.io/api/webhooks/stripe`, API `2025-06-30.basil`) ouve 20 eventos.
**Faltam 11** (`EVENTOS_NOVOS`): `invoice.created`, `invoice.overdue`, `invoice.payment_action_required`,
`customer.updated`, `payment_method.attached/updated/detached`, `customer.subscription.trial_will_end`,
`customer.tax_id.created/updated/deleted`. Sem eles, **cartão novo e dados corrigidos no portal nunca chegam**. Aplicar é
configuração da conta live (compartilhada): `stripe-endpoint-eventos-faltantes.ts --simular` lista; quem aplica é o Scott.

Regra do cadastro: o formulário do portal é público, então só **preenche campo vazio**, nunca sobrescreve o que a equipe
ou o contrato definiram (mesmo critério do checkout). Onde o cliente informou outro valor, é divergência para a equipe decidir.

## 3. Reconciliação

`app/src/lib/integrations/stripe-reconciliacao.ts` (regra pura, testada) + `stripe-reconciliacao-db.ts` (I/O) +
`app/src/scripts/reconciliar-stripe-onface.ts`.

- `--simular` (padrão): lê Stripe (GET) e banco (SELECT) e lista divergências por tipo (`so_no_stripe`, `so_no_onface`,
  `valor_diferente`, `status_diferente`) × objeto (assinatura, fatura, pagamento). Objetos do SaaS ficam fora e são só contados.
- `--aplicar`: roda o `syncStripe` da organização, recalcula recebíveis, compara de novo e registra o que sobrou como
  caso aberto (`billing_resolution_cases`, fila `REVIEW`) dentro de uma execução em `billing_audit_runs`.
  Não apaga nada.
- O teto de 50 páginas do sync virou 1.000, e estourar **falha alto** em vez de cortar em silêncio.
- Para ficar periódica, o worker chama `reconciliarOrganizacao(org, { aplicar: false })` e alerta se houver divergência
  `alta` (não ligado: o worker fica fora desta frente).

Sem migration nesta entrega.

## O que a documentação do Stripe recomenda

- Portal: configuração × sessão. A sessão é efêmera (5 min); a configuração só se gerencia por API fora da padrão; sessão
  sem `configuration` usa a padrão. Recomenda ouvir `customer.subscription.updated/deleted`, `payment_method.attached` e
  `customer.updated`; com cancelamento no fim do período, o `updated` é o aviso antecipado. Portal não atualiza assinatura com
  vários itens, teste, uso medido ou `collection_method=send_invoice`.
- Reconciliação: Balance Transactions e o relatório de conciliação de repasses (`payout_reconciliation.itemized`) casam
  dinheiro com repasse; Revenue Recognition reconcilia com o Balance summary (fatura `open` continua reconhecida como
  receita: marcar `void`/`uncollectible`). A conta não tem Sigma; relatórios exigem a Reporting API.
