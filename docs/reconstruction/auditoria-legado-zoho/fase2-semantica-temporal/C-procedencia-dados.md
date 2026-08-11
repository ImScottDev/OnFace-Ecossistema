# Fase 2 — Procedência dos Dados Pós-Cutover (Semântica Temporal)

> Continuação da auditoria forense (fase 1: [`00-SINTESE-CONSOLIDADA.md`](../00-SINTESE-CONSOLIDADA.md) e [`02-inventario-crm-atual.md`](../02-inventario-crm-atual.md)). Este relatório não redescobre os números já levantados ali (292 empresas novas, 570 leads novos, 65 negócios nativos, 241/319 contratos sem `negocio_id` etc.) — parte deles e investiga a pergunta que a fase 1 deixou aberta: **de onde exatamente vieram os 319 contratos e as faturas pós-cutover, e o que significa "alterado depois do corte" nas outras tabelas.**
>
> Fonte: mesmo espelho de produção (`pg_dump` 10/08/2026), só `SELECT`. Nenhuma linha foi alterada. Corte de referência: **12/06/2026**.
>
> Regra da fase 1 mantida aqui: nada é veredito fechado. Toda conclusão vem com evidência (SQL + trecho de código + confiança) e é marcada como tal.

---

## 0. Resumo executivo

| Achado | Evidência | Confiança |
|---|---|---|
| As 563 faturas do Kauã batem exatamente: **100%** têm `created_at > 12/06/2026` e **100%** têm `origem = 'stripe'` | `SELECT count(*)` idêntico nas duas condições | Alta |
| Faturas são gravadas **exclusivamente** pelo job/webhook `syncStripe()` — não existe nenhum outro caminho de código que insira em `faturas` | grep completo em `api-server`/`worker`/`app/api` sem outro `insert(faturas)` | Alta |
| 171 dos 319 contratos (54%) nascem no **mesmo minuto** (`2026-07-01 07:12`), 0% com `negocio_id`, 100% com `stripe_subscription_id` — é a primeira execução em produção do backfill de assinaturas Stripe, não uso orgânico | timestamp idêntico ao segundo/microssegundo + código de `stripe-sync.ts` que busca `status=all` (inclui histórico já cancelado) | Alta |
| Existe um **segundo mecanismo orgânico** de criação de contrato, via `Proposta aceita → negócio ganho`, que é o único caminho que popula `negocio_id` | código lido em `aceitar-proposta.ts` + `negocios.ts` + cruzamento com os 78 contratos com `negocio_id` | Alta |
| **38 grupos (76 contratos) ainda duplicados** pelo mesmo `stripe_subscription_id` no dump de 10/08, um dia **depois** do fix "F4" (09/08) que corrigiu a causa raiz — o fix impede duplicata nova, não limpou o passivo existente | `GROUP BY stripe_subscription_id HAVING count(*)>1` + `git log` do fix + comentário no próprio código citando "36 pares, R$17.449,30/mês" | Alta (existência da duplicata) / Média (se os 38 batem 1:1 com os "36 pares" do fix ou é um superconjunto) |
| Contaminação de teste/QA pós-cutover é **muito baixa**: 4 leads (`kaua.araujo+1@...`, `scott@scottstudio.com.br`, 1 e-mail externo suspeito), 0 empresas, 0 negócios nativos com nome de teste | varredura por `ILIKE '%teste%'`/`%test%`/`%exemplo%` nos 4 grupos "novo" | Alta |
| Toda a "contaminação de teste" identificada na fase 1 (Zoho: "Mussum Trapalhão", "teste1924" etc.) é **legado Zoho antigo** (2023-2025, com `zoho_id`), não dado gerado durante a construção do CRM 2.0 | `SELECT ... WHERE nome ILIKE '%teste%'` mostra `zoho_id` preenchido e `created_at` 2023-2025 em 100% dos casos | Alta |
| Um evento em massa no **mesmo minuto (07:12 de 01/07)** também bateu `updated_at` de 1.748 leads e 942 empresas com `zoho_id` — parte é explicada pelo código (vínculo de `stripe_customer_id`), parte **não foi identificada** no código disponível | timestamp idêntico + leitura de `stripe-sync.ts` | Média para leads / **Não determinável** para empresas — decisão/lembrança do Kauã necessária |

---

## 1. Framework de 3 categorias aplicado por tabela

Categorias pedidas: `LEGADO_ZOHO` (zoho_id preenchido), `VEIO_DO_LEGADO_MAS_ALTERADO_POS_CUTOVER` (zoho_id preenchido **e** `updated_at > 12/06` **e** `created_at <= 12/06` — ou seja, nasceu no Zoho e foi tocado depois do corte), `NOVO_POS_CUTOVER` (sem zoho_id, `created_at > 12/06`).

**Limitação estrutural encontrada, não contornável por SQL**: `propostas`, `faturas`, `notas` e `atividades` **não têm coluna `zoho_id`** no schema atual (confirmado via `\d` em cada tabela). Isso não é um problema da query — é a mesma raiz do achado #9 da síntese da fase 1 ("contratos e contatos... sem religação nenhuma ao histórico"), só que em mais 4 tabelas. Para essas quatro, a categorização abaixo usa um 4º bucket (`AMBIGUO_SEM_ZOHO_ID_PRE_CUTOVER` ou, quando 100% dos dados são pós-corte, isso já responde a pergunta sozinho).

### leads (3.196 total)

| Categoria | Qtd |
|---|---|
| VEIO_DO_LEGADO_MAS_ALTERADO_POS_CUTOVER | 2.135 |
| NOVO_POS_CUTOVER | 570 |
| LEGADO_ZOHO (nunca tocado pós-corte) | 315 |
| AMBIGUO_SEM_ZOHO_ID_PRE_CUTOVER | 176 |

**Atenção ao número de 2.135** (67% da tabela): não leia isso como "2.135 edições de negócio reais depois do corte". 1.807 desses toques aconteceram no **mesmo minuto** (`2026-07-01 07:12`) — é um evento de sistema em lote, não 1.807 vendedores editando lead. Ver seção 3.

### empresas (1.560 total)

| Categoria | Qtd |
|---|---|
| VEIO_DO_LEGADO_MAS_ALTERADO_POS_CUTOVER | 891 |
| AMBIGUO_SEM_ZOHO_ID_PRE_CUTOVER | 324 |
| NOVO_POS_CUTOVER | 292 |
| LEGADO_ZOHO (nunca tocado pós-corte) | 53 |

Mesmo problema de leitura: **942 dos 891+ toques aconteceram no mesmo minuto `07:12` de 01/07** (a soma 891 já é só a fração que também tem `zoho_id`; ver seção 3). Praticamente todo `zoho_id` da tabela (944 no total) foi tocado nesse minuto — 53 é tudo que sobrou intocado.

### negocios (1.104 total)

| Categoria | Qtd |
|---|---|
| LEGADO_ZOHO (nunca tocado pós-corte) | 797 |
| VEIO_DO_LEGADO_MAS_ALTERADO_POS_CUTOVER | 242 |
| NOVO_POS_CUTOVER | 65 |

Aqui o padrão é mais saudável: sem rajada de minuto único (a maior concentração de "alterado" é 120 em um dia, 20/07 — plausivelmente time comercial trabalhando o funil, não script). Os 65 nativos foram inspecionados manualmente (nomes reais de empresa, valores plausíveis: `City Card`, `Diamond Global`, `Grupo Royal Energia` etc.) — **nenhum sinal de teste/QA**.

### contratos (319 total)

| Categoria | Qtd |
|---|---|
| NOVO_POS_CUTOVER | 319 (100%) |

Confirma exatamente o achado #9 da fase 1: `zoho_id` nunca foi preenchido em nenhum contrato (0/319). Não existe fração "legado" ou "legado alterado" nessa tabela — é 100% dado pós-corte por construção. A pergunta relevante não é "quanto é legado" (zero), é "esses 319 nasceram de import ou de uso orgânico do produto" — seção 2.

### propostas (1.240 total) — sem coluna `zoho_id`

| Categoria (só por `created_at`, sem zoho_id) | Qtd |
|---|---|
| created_at <= 12/06 (pré-corte, sem marcador de origem) | 984 |
| created_at > 12/06 (NOVO_POS_CUTOVER) | 256 |

A fase 1 (`04-reconciliacao-propostas-contratos.md`) já tinha feito o trabalho mais fino aqui via match por valor+data: **591 das linhas pré-corte batem com uma Quote do Zoho** (proxy de "legado", já que não há coluna pra confirmar por ID). As 984-591 ≈ 393 pré-corte sem match e as 256 pós-corte não têm origem Zoho identificável.

### faturas (563 total) — sem coluna `zoho_id`

| Categoria | Qtd |
|---|---|
| NOVO_POS_CUTOVER (created_at > 12/06) | 563 (100%) |

Não há nenhuma fatura anterior ao corte. Isso por si só já é uma resposta parcial à investigação da seção 2: a tabela `faturas` do CRM atual **nunca conteve** as 123 faturas históricas do Zoho (fase 1, achado #5) — o que existe é inteiramente posterior e, como mostra a seção 2, 100% Stripe.

### notas (1.515 total) — sem coluna `zoho_id`

| Categoria | Qtd |
|---|---|
| NOVO_POS_CUTOVER (created_at > 12/06) | 1.515 (100%) |

Confirma o achado #6/#4-5 da fase 1: `notas` é 0% Zoho por conteúdo E por estrutura — a coluna que permitiria a distinção nem existe.

### atividades (6.757 total) — sem coluna `zoho_id` e sem coluna `updated_at`

| Categoria (só por `created_at`) | Qtd |
|---|---|
| created_at <= 12/06 (pré-corte) | 3.021 |
| created_at > 12/06 (NOVO_POS_CUTOVER) | 3.736 |

Caso mais atípico do lote: `atividades` **tem** histórico real pré-2026 (remonta a 2021-02, conforme fase 1) mesmo sem nunca ter tido coluna `zoho_id` — ou seja, o script de migração escreveu o `created_at` histórico correto nessa tabela sem deixar rastro de origem. Não dá pra aplicar `VEIO_DO_LEGADO_MAS_ALTERADO` aqui por ausência de `updated_at` também (a tabela não versiona edição). Tratar os 3.021 pré-corte como proxy de "legado" é razoável pelo padrão temporal, mas não é verificável linha a linha.

---

## 2. Investigação forense — de onde vieram os 319 contratos e as 563 faturas

### 2.1 Confirmação do número do Kauã

```sql
SELECT count(*) FROM faturas WHERE created_at > '2026-06-12';  -- 563
SELECT count(*) FROM faturas;                                   -- 563
SELECT origem, count(*) FROM faturas GROUP BY origem;            -- stripe | 563
```

**Bate exatamente.** E mais: **100% das faturas, sem exceção, têm `origem = 'stripe'`**. Não existe fatura manual, importada ou de qualquer outra origem na tabela hoje.

### 2.2 Distribuição temporal — rajada vs. uso orgânico

| Tabela | Dia | Qtd | % do total |
|---|---|---|---|
| contratos | 2026-07-01 | 171 | 54% |
| contratos | resto (23 dias) | 148 | 46% |
| faturas | 2026-07-01 | 398 | 71% |
| faturas | resto (38 dias) | 165 | 29% |

Isso já seria suficiente pra suspeitar de rajada de import, mas o dado fica inequívoco quando se olha o **timestamp exato**:

```sql
-- contratos criados em 01/07:
2026-07-01 07:12:28.640346-03  |  166 linhas
2026-07-01 07:26:34.3xxxxx-03  |    3 linhas
(+ 2 linhas isoladas ao longo do dia)

-- faturas criadas em 01/07, por minuto:
2026-07-01 07:12:00-03  |  375 linhas
2026-07-01 07:26:00-03  |   18 linhas
```

**166 contratos foram inseridos no mesmo microssegundo.** Isso não é um usuário clicando em botões — é um único `INSERT` em laço/transação de um script, rodando uma única vez. É a assinatura clássica de um backfill, não de atividade de produto.

Segundo achado que reforça: dos 171 contratos desse minuto, **0% tem `negocio_id`**, **100% tem `stripe_subscription_id`**, e **96 já nascem com `status = 'churned'`** — ou seja, o backfill trouxe assinaturas do Stripe que já estavam canceladas na hora em que rodou. Isso bate exatamente com o código (seção 2.3): `stripe-sync.ts` busca `subscriptions` com `status: "all"`, que inclui histórico cancelado, não só ativo.

Há uma segunda rajada menor, **04/08 às 13:57-14:09** (30 contratos / 28 faturas em ~15 minutos, não no mesmo microssegundo) — mesmo padrão (28/30 com `stripe_subscription_id`, só 4/30 com `negocio_id`), mas espalhada em minutos, não instantânea. Leitura mais provável: uma nova rodada do mesmo mecanismo de sync recuperando um lote de assinaturas que ainda não tinham contrato-espelho (não necessariamente um bug — o `syncStripe()` roda a cada 30min e paginando 100 por vez, então um lote assim é compatível com operação normal do job encontrando várias novas de uma vez). Confiança média, não alta, porque não há como provar isso com o dump sozinho.

### 2.3 Code archaeology — os mecanismos reais de INSERT

Busca completa (`grep -rn` em `api-server`, `worker`, `app/api`, `scripts/`) encontrou **4 caminhos de código diferentes** que escrevem em `contratos`, e **exatamente 1** que escreve em `faturas`:

**a) `app/src/lib/integrations/stripe-sync.ts` — job "stripe-sync" (worker, a cada 30 min) + disparado pelo webhook do Stripe em tempo real.**
Único inserter de `faturas` em todo o código (upsert por `(origem, external_id)`, `origem` sempre `"stripe"`). Também insere `contratos` quando encontra uma assinatura Stripe de um lead que **ainda não tem contrato nenhum** — grava só `leadId` (nunca `negocioId`), com `descricao: "Assinatura Stripe (sync automático)"` ou `"Assinatura Stripe — {plano}"`. Comentário no próprio arquivo confirma que essa era a causa raiz de um bug de MRR duplicado corrigido em 09/08 ("F4"). Busca `status: "all"` no Stripe (não filtra só ativo) — explica os 96 contratos já `churned` no lote de 01/07.

**b) `app/src/lib/crm/aceitar-proposta.ts` — `marcarPropostaAceita()`, chamado por dois pontos: `POST /propostas/:id/aceitar` (aceite manual) e o webhook Stripe `checkout.session.completed` quando o pagamento é confirmado.**
Este é o caminho **orgânico**: proposta aceita → cria contrato → se a proposta tem negócio vinculado (ou o lead tem um negócio ativo), marca `negocioId` no contrato. É o único caminho que explica os contratos **com** `negocio_id`.

**c) `app/src/api-server/routes/negocios.ts` (linha ~581) — transição de status do negócio para `"ganho"`.**
Se ainda não existe contrato pra aquele negócio, cria um com `negocioId` preenchido. Segundo caminho orgânico que popula `negocio_id`.

**d) `app/src/api-server/routes/leads.ts` (linha ~887) — transição de status do lead para `"fechado"`.**
Cria um contrato "rascunho" só com `leadId` (sem `negocioId`) **se não houver proposta aceita que já tenha criado um**. Caminho manual/administrativo que também produz contrato órfão de negócio, mas por ação humana, não por sync.

**e) `app/src/api-server/routes/contratos.ts` (linha ~104) — `POST /api/contratos`.**
Endpoint de criação manual via UI/API, também sem `negocioId` no payload.

**Cruzamento com o dado real:** dos 319 contratos, **279 (87,5%) têm `stripe_subscription_id`** e **78 (24,5%) têm `negocio_id`**. Como o webhook do caminho (b) também grava `stripeSubscriptionId` de volta no contrato que ele mesmo criou (linha 90-93 do `webhooks/stripe/route.ts`), a presença de `stripe_subscription_id` isoladamente **não** distingue caminho (a) de (b) — mas o cruzamento por dia sim: dos 148 contratos fora da rajada de 01/07, **78 têm `negocio_id`** (caminho b/c, orgânico) e os outros 70 vieram por (a)/(d)/(e) espalhados no tempo.

**Conclusão consolidada da origem dos 319 contratos:**

| Origem | Qtd estimada | Mecanismo | Confiança |
|---|---|---|---|
| Backfill Stripe (primeira execução, 01/07, mesmo minuto) | 171 | `stripe-sync.ts`, `status=all` | Alta |
| Backfill/catch-up Stripe (04/08, minutos, não instantâneo) | 30 | mesmo mecanismo, execução periódica | Média |
| Proposta aceita → negócio ganho (orgânico, com `negocio_id`) | 78 | `aceitar-proposta.ts` + `negocios.ts` | Alta |
| Lead fechado manualmente / criação manual via `POST /contratos` / catch-up Stripe residual espalhado | ~40 | `leads.ts` (d) + `contratos.ts` (e) + sobra de (a) | Média (não é possível separar os 3 sem instrumentar o código com logging retroativo) |

**Conclusão consolidada dos 563 faturas:** **100% via `stripe-sync.ts`**, sem ambiguidade — é o único inserter, `origem` é sempre `"stripe"`, e o número bate exato com "created_at > corte". Confiança alta.

### 2.4 Ligação Stripe explícita no schema

`faturas` não tem coluna própria `stripe_invoice_id` — usa `origem` (texto, sempre `"stripe"` na prática) + `external_id` (guarda o `invoice.id` do Stripe) com índice único em `(origem, external_id)`, que é o que garante idempotência no upsert. `contratos.stripe_subscription_id` e `assinaturas.stripe_subscription_id` (com índice único) completam a cadeia contrato ↔ assinatura ↔ Stripe. O webhook (`app/src/app/api/webhooks/stripe/route.ts`) está registrado pros eventos `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `customer.subscription.*` e `checkout.session.*`, com verificação de assinatura HMAC (fail-closed se `STRIPE_WEBHOOK_SECRET` não estiver configurado — hardening documentado no próprio código como resposta a um achado de auditoria de 21/07).

### 2.5 Duplicidade residual (achado colateral relevante pro financeiro)

```sql
SELECT stripe_subscription_id, count(*) FROM contratos
WHERE stripe_subscription_id IS NOT NULL GROUP BY 1 HAVING count(*)>1;
-- 38 grupos, todos com count=2 → 76 contratos duplicados
```

O commit `e14c184` (09/08, "F4: fix da causa raiz do MRR duplicado") corrige exatamente o branch de `stripe-sync.ts` que causava isso (o comentário no código cita "36 pares, R$17.449,30/mês de excesso" como o achado que motivou o fix). O dump usado nesta auditoria é de **10/08**, um dia depois do fix — e ainda mostra **38 grupos duplicados**. Leitura mais provável: o fix impede *novas* duplicatas a partir de 09/08, mas **não rodou nenhuma limpeza retroativa** nos pares que já existiam. Não é possível, só com o dump, confirmar se os 38 são exatamente os mesmos "36 pares" do achado original ou um número que cresceu/mudou depois — mas a mecânica (código lido) explica por que eles existem e por que ainda estão lá. **Recomendação prática (não é decisão minha, é observação):** rodar uma limpeza pontual desses 38 pares agora que a causa raiz está corrigida, senão o financeiro continua contando MRR duplicado.

### 2.6 Contaminação de teste/QA — separado do dado real de produção

Varredura por nome/e-mail contendo "teste"/"test"/"exemplo" nos grupos **novos pós-corte** (não no legado, que a fase 1 já cobriu):

- **Leads**: 4 casos — `kaua.araujo+1@callface.ai` (2x, nome "teste"/"Teste"), `scott@scottstudio.com.br` (nome "teste scott"), e 1 e-mail externo (`webimarcas@gmail.com`, nome "Teste") que pode ser lead real mal preenchido ou teste de terceiro, não determinável com certeza. Volume irrelevante (4 de 570 novos, 0,7%), sem contrato/fatura associado encontrado.
- **Empresas novas (292)**: 0 casos.
- **Negócios nativos (65)**: 0 casos — inspeção manual de todos os 65 mostra nomes de empresa reais (City Card, Diamond Global, Grupo Royal Energia, Odonto Bel etc.), valores em faixas de plano reais (89,90 / 179,90 / 269,70...), nenhum indício de dado fabricado durante o desenvolvimento do CRM 2.0.
- **Contratos**: 3 de 319 com `mrr` nulo ou zero — baixo volume, provavelmente contrato de setup avulso (serviço não recorrente) mais do que lixo, não investigado a fundo por ser marginal.
- Os "valores redondos" em `contratos.mrr`/`faturas.valor` (179.90 x 195, 89.90 x 81 etc.) **não são um sinal de dado fabricado** — são preços de tabela reais de plano SaaS (Callpilot/discador preditivo em diferentes tiers), esperado se repetir muito numa base de assinatura.
- Todo o dado de teste encontrado na fase 1 (empresas "Mussum Trapalhão", "teste1924 teste teste", "Pedro teste" etc.) foi confirmado aqui como **100% legado Zoho antigo** (todos com `zoho_id` preenchido, `created_at` entre 2023-11 e 2025-01) — não é contaminação do CRM 2.0, é lixo herdado que já veio sujo do Zoho.

**Conclusão**: não há evidência de dado de teste/QA relevante contaminando os números financeiros pós-cutover. O que existe é marginal e isolado em `leads`.

---

## 3. O evento de 01/07 às 07:12 — o que o código explica e o que não explica

O mesmo minuto exato (`2026-07-01 07:12`) aparece simultaneamente em quatro tabelas:

| Tabela | O que aconteceu nesse minuto |
|---|---|
| faturas | 375 INSERTs novos |
| contratos | 166 INSERTs novos |
| leads | 1.748 UPDATEs de `updated_at` (com `zoho_id` preenchido) |
| empresas | 942 UPDATEs de `updated_at` (com `zoho_id` preenchido) |

**O que o código explica com confiança alta:** `syncStripe()` roda em transação única e, ao processar cada assinatura, faz `UPDATE leads SET stripe_customer_id = ...` sempre que vincula um lead a um cliente Stripe por e-mail pela primeira vez (comentário no código cita isso como fix de um achado real de 04/08 — "47 assinaturas ativas... ficavam de fora do espelho"). Isso explica bump de `updated_at` em leads correlacionado no tempo com o backfill de contratos/faturas — é literalmente o mesmo job, na mesma transação/execução. **Não explica por si só os 1.748** (o código só toca o lead quando ainda não tem `stripe_customer_id` e casa por e-mail — plausível pra uma fração, não necessariamente pra todos).

**O que não foi possível explicar com o código disponível:** nenhum trecho lido em `stripe-sync.ts`, `stripe-checkout.ts` ou nos scripts em `app/src/scripts/`/`app/src/lib/db/` (`backfill-mrr-movimentos.ts`, `backfill-domain-model.ts` — este último tem data de commit **09/08**, posterior ao evento, não pode ser a causa) toca a tabela `empresas`. O histórico do git deste repositório foi resetado em `bbc773e` ("Commit inicial: CRM Callface", 29/06) — ou seja, se um script ad-hoc rodou manualmente em produção no dia 01/07 (via `psql` direto, um script não commitado, ou uma migration que foi revertida do histórico), ele não é visível nesta auditoria de código. **Isso é achado explícito, não determinável pelos dados/código disponíveis — decisão ou lembrança do Kauã necessária** sobre o que foi executado na madrugada/manhã de 01/07/2026 (deploy? script manual de correção pós-migração? reprocessamento de enriquecimento?).

Isso importa pra leitura da tabela da seção 1: os "2.135 leads alterados pós-corte" e "891 empresas alteradas pós-corte" **não devem ser lidos como atividade comercial** — a maioria absoluta é este evento de sistema de um único minuto, não 2 meses de edição humana gradual.

---

## 4. Conclusão por grupo de dado novo — mecanismo + confiança

| Grupo | Mecanismo identificado | Confiança |
|---|---|---|
| 563 faturas | 100% `stripe-sync.ts` (job worker 30min + webhook em tempo real), zero import manual, zero origem além de Stripe | **Alta** |
| 171 contratos do minuto 07:12 de 01/07 | Primeira execução em produção do backfill de assinaturas Stripe (`status: "all"`, inclui histórico já cancelado) | **Alta** |
| 30 contratos do lote de 04/08 | Mesmo mecanismo, execução periódica subsequente pegando lote de novas assinaturas | **Média** |
| ~78 contratos com `negocio_id` | Fluxo orgânico Proposta aceita → negócio ganho → contrato (`aceitar-proposta.ts` + `negocios.ts`) | **Alta** |
| ~40 contratos residuais sem `negocio_id`, fora das duas rajadas | Mistura de: lead fechado manualmente (`leads.ts`), criação manual via UI (`contratos.ts` `POST`), e possíveis catch-ups menores do sync — não separável com o dado disponível | **Média** |
| 76 contratos (38 pares) duplicados por `stripe_subscription_id` | Bug de causa raiz corrigido em 09/08 (commit `e14c184`), passivo pré-fix não limpo retroativamente | **Alta** (causa) / não determinável se é exatamente igual ao "achado de 36 pares" citado no código |
| 65 negócios nativos | Uso orgânico do funil comercial pós-cutover — inspeção manual não encontrou nada anômalo | **Alta** |
| 570 leads novos | Já coberto pela fase 1 (majoritariamente Mídia Paga, 356) — reconfirmado aqui sem achado adicional | **Alta** (herdado da fase 1) |
| 292 empresas novas | Já coberto pela fase 1 como crescimento orgânico — mas ver ressalva da seção 3 (parte da tabela também sofreu o evento de sistema de 01/07, então "criação" ≠ "toque"; os 292 são especificamente `created_at`, não afetados pelo evento de `updated_at`) | **Alta** |
| 1.748 leads + 942 empresas com `updated_at` batido no minuto 07:12 de 01/07 | Parcialmente explicado (vínculo `stripe_customer_id` em leads); mecanismo pleno **não determinável pelo código disponível** | **Não determinável — decisão/lembrança do Kauã necessária** |
| 4 leads de teste/QA (`kaua.araujo+1@`, `scott@scottstudio.com.br`, 1 externo) | Uso interno de teste do próprio time, volume irrelevante | **Alta** |

---

## 5. Perguntas abertas pro Kauã (não decidido aqui, só levantado)

1. **O que rodou em produção às 07:12 de 01/07/2026?** É o deploy inicial da integração Stripe (`stripe-sync.ts` fazendo sua primeira varredura completa)? Rodou junto algum script de correção de `empresas`/`leads` que não sobrou no histórico do git (reset em 29/06)? Vale perguntar a quem fez esse deploy antes de assumir que foi só o sync do Stripe.
2. **Os 38 pares de contrato duplicado por `stripe_subscription_id` (76 linhas) já foram limpos manualmente depois do dump de 10/08, ou ainda estão contando MRR em dobro no financeiro hoje?** Se ainda estão lá, é um passivo direto em relatório de receita.
3. **Os ~40 contratos residuais sem rajada e sem `negocio_id`** (nem backfill claro, nem proposta aceita) — vale a pena auditar 1 a 1 (são poucos) pra confirmar se são "lead fechado manualmente" legítimo ou lixo de teste que passou pela varredura de nome/e-mail sem ser pego (a varredura só olhou nome/e-mail, não olhou, por exemplo, contrato criado por usuário de teste interno).
4. O lote de 04/08 (30 contratos/faturas em ~15 minutos) — se alguém do time lembrar de ter rodado algo manual nesse dia/horário, isso fecha a lacuna de confiança "média → alta" sem precisar de mais investigação de código.

---

## Fontes

- SQL direto em `postgresql://callface:callface2026dev@localhost:5432/callface_crm` (só leitura), 10/08/2026.
- Schema: `app/src/lib/db/schema.ts`.
- Código lido integralmente: `app/src/lib/integrations/stripe-sync.ts`, `app/src/app/api/webhooks/stripe/route.ts`, `app/src/lib/crm/aceitar-proposta.ts`, trechos de `app/src/api-server/routes/{leads,negocios,contratos}.ts`.
- `git log --follow` em `stripe-sync.ts`, `aceitar-proposta.ts`, `webhooks/stripe/route.ts`, `backfill-domain-model.ts` (branch `feature/crm2-fase7-frontend`).
- Relatórios-fonte da fase 1: [`00-SINTESE-CONSOLIDADA.md`](../00-SINTESE-CONSOLIDADA.md), [`02-inventario-crm-atual.md`](../02-inventario-crm-atual.md), [`04-reconciliacao-propostas-contratos.md`](../04-reconciliacao-propostas-contratos.md).
