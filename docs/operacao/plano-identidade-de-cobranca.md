# Plano: um cliente, um Customer, uma assinatura

Medido em produção e no Stripe live em **15/10/2026**. Tudo aqui é leitura;
nada foi alterado no Stripe para produzir este documento.

## O retrato

**123 assinaturas ativas, R$ 53.586,86 de MRR.** Cada Customer tem exatamente
uma assinatura ativa — a duplicação não está dentro do Customer, está **entre
Customers do mesmo cliente**.

### De onde vem cada assinatura (pela metadata no Stripe)

| Origem | Assinaturas | MRR | O que significa |
|---|---|---|---|
| **CRM** (`negocioId`, `propostaId`) | 54 | R$ 18.780,01 | criada pelo ONFACE, numa venda |
| **Sem marca nenhuma** | 34 | **R$ 27.162,45** | ninguém assinou a autoria — herança do CRM antigo |
| **Plataforma** (`organization_id`, `plan_id`, `user_id`) | 35 | R$ 7.644,40 | criada pelo Callface AI, fora do comercial |
| Conflito (marca dos dois) | 0 | — | |

**Metade da receita (51%) vem do grupo sem marca.** É o maior problema, e não
é duplicação: é receita que nenhum dos dois sistemas reconhece como sua.

### O mesmo cliente em Customers diferentes

São **8 clientes**, em **18 Customers**, somando **R$ 4.126,91 de MRR**:

| Cliente (e-mail) | Customers | MRR | Origens |
|---|---|---|---|
| naturallabdigital@gmail.com | 3 | 1.259,20 | CRM, CRM, CRM |
| victorpradodirecionalvendas@gmail.com | 3 | 799,60 | CRM, CRM, CRM |
| thiago@laster.com.br | 2 | 539,60 | CRM, CRM |
| pedro.galluzzo@engelink.com.br | 2 | 359,80 | CRM + **Plataforma** |
| leonardomartoni1p@gmail.com | 2 | 339,71 | CRM, CRM |
| admcitycard@gmail.com | 2 | 329,80 | CRM, CRM |
| dranathaliasteinert@gmail.com | 2 | 269,80 | CRM, CRM |
| jeanrodriguesan@gmail.com | 2 | 269,80 | CRM + **sem marca** |

**Seis dos oito são duplicação dentro do próprio CRM** — não é briga entre
sistemas, é o ONFACE criando Customer novo para quem já era cliente dele.

Este critério pega só o **mesmo e-mail**. Cliente com e-mails diferentes em
cada Customer não aparece aqui, e o Laster é a prova de que isso acontece: o
e-mail de cobrança é o do financeiro, não o do contato da proposta.

### No CRM

| | |
|---|---|
| Assinaturas ativas **sem empresa** no espelho | 20 — **R$ 8.355,91 de MRR** |
| Empresa-balde "Unresolved billing identity" | 17 assinaturas, R$ 10.483,90 |
| Empresas com mais de um Customer | 37 |

## As três causas, que são diferentes

### 1. O CRM escrevia a identidade e não lia de volta — CORRIGIDO

O sync só gravava a assinatura se achasse um **lead** pelo `stripe_customer_id`
ou pelo **e-mail do Customer**. E-mail de cobrança diferente do contato da
proposta ⇒ a assinatura ficava fora do espelho "para sempre"
(`stripe-sync.ts`, comentário na própria linha).

A ironia: a assinatura carrega `negocioId` e `propostaId` na metadata — o CRM
escreveu ali de quem é, e depois procurava por e-mail, em outro objeto.

**Correção:** `resolveBillingCustomer` passa a aceitar a metadata da assinatura
e resolver por negócio/proposta, que é prova direta. Resolve sozinho o grupo
**CRM (54 assinaturas, R$ 18.780,01)**.

### 2. Customer novo para quem já era cliente — JÁ ESTANCADO

`garantirCustomerDaEmpresa` é a porta única (8 passos de busca, advisory lock,
idempotência) e nasceu justamente por causa disto. A curva confirma que
funcionou — assinaturas ativas duplicadas por mês de criação:
**12 (jul) → 11 (ago) → 7 (set) → 1 (out)**.

Os 8 clientes duplicados são **passivo**, não sangramento.

### 3. A fronteira entre o CRM e a plataforma — ABERTA

35 assinaturas (R$ 7.644,40) nascem no Callface AI, fora do comercial. O CRM as
ignora de propósito, porque a conta Stripe é compartilhada. Enquanto os dois
puderem criar assinatura para o mesmo cliente sem se falarem, isto volta.

E as **34 sem marca (R$ 27.162,45)** são de antes: vieram do CRM antigo e não
têm autoria. Não dá para automatizar o que não tem evidência — cada uma precisa
de um olhar.

## O plano

### Fase 1 — Parar de criar passivo (feito, falta publicar)
- [x] Sync resolve a identidade pelo `negocioId`/`propostaId` da assinatura
- [x] Expansão cobra na assinatura existente, com pró-rata, em vez de abrir outra
- [x] Expansão devolve o link da fatura para o cliente pagar
- [ ] Publicar em produção

**Efeito esperado:** as 54 do grupo CRM passam a casar sozinhas no próximo sync.
Mede-se pela queda das 20 órfãs.

### Fase 2 — Devolver dono às órfãs (precisa de decisão humana)
As 20 ativas sem empresa, R$ 8.355,91/mês. Depois da Fase 1, parte some sozinha.
O resto é na mão, do mais caro para o mais barato, com a regra: **CNPJ ou
negócio provam; e-mail e nome sugerem**. Nome nunca decide sozinho.

### Fase 3 — Consolidar os 8 clientes duplicados
Para cada um, **um** Customer fica e os outros saem **no fim do ciclo pago**
(não no ato), que é a única forma de não deixar crédito preso — crédito de
cancelamento fica no Customer onde nasceu e **não migra**.

Ordem: Natural Lab (3 Customers), Victor Prado (3), Laster (2), e os outros 5.

Decisões necessárias, por cliente:
- qual Customer fica
- o que fazer com dívida em aberto (ex.: Laster tem R$ 359,80 vencidos)
- se houve cobrança a maior, se estorna

### Fase 4 — Fechar a fronteira
Decidir quem manda na assinatura de um cliente que usa o Callface AI e é
atendido pelo comercial. Enquanto não houver resposta, a Fase 3 se repete.
Esta é a única fase que é arquitetura, não limpeza.

## O que não fazer

- **Não cancelar assinatura sem saber se é ela que libera o acesso do cliente
  ao produto.** O Laster tem 6 pessoas com 5 mil chamadas em 30 dias.
- **Não fundir Customer no Stripe:** não existe. O que existe é eleger um e
  encerrar os outros.
- **Não casar cliente por nome.** "Natural Lab" e "Natural Lab Digital" são o
  mesmo; dois "Victor Prado" podem não ser.
