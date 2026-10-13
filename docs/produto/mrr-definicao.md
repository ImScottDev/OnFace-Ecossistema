# MRR: levantamento e proposta de definição única

Data: 13/10/2026. Levantamento somente leitura (banco de produção `callface_crm_mz`
e Stripe pelas ferramentas de leitura). Nada foi alterado em código, banco ou Stripe.
Competência de referência: **setembro/2026**, a última fechada.

## Resumo (o que está certo e por quê)

1. **O número que o produto mostra como MRR oficial, R$ 478.822,89, é o mais próximo do real**
   e deve continuar sendo a base. Ele sai da planilha de faturamento do mês (R$ 476.414,49 de
   linhas com natureza MRR, 323 linhas) mais 8 assinaturas Stripe de clientes sem linha na
   planilha (R$ 2.408,40). Setup e débito recuperado já ficam fora, porque a planilha os
   classifica na importação.
2. **Mas ele não é limpo.** Tem SaaS dentro (a planilha de setembro já traz clientes do SaaS) e
   R$ 28.297,80 de dois contratos White Label em primeiro mês, sem recorrência provada ainda.
3. **O resto das telas diverge por usar outra fonte, não por outra definição.** A mesma
   pergunta "quanto é o MRR" dá R$ 478,8 mil, R$ 389,3 mil, R$ 388,1 mil, R$ 61,9 mil ou
   R$ 46,4 mil conforme a tela. Só a primeira é a conta do Scott.
4. **A regra de recorrência do Scott funciona como validador, não como filtro.** Exige
   "mesmo valor, meses seguidos" e isso reconhece só 50% do MRR (162 clientes, R$ 240 mil);
   o PABX com consumo varia de um mês para o outro e é recorrente de verdade.
5. **Proposta:** MRR = linhas de natureza MRR do último fechamento da planilha, sem SaaS,
   mais a assinatura Stripe de cliente novo sem linha ainda, com anuidade dividida por 12 e
   setup/débito/avulso fora. Cada linha ganha uma etiqueta de confiança (estável, variável,
   novo). Impacto em setembro: de R$ 478.822,89 para **R$ 469,1 mil a R$ 475,4 mil**
   (-0,7% a -2,0%), a depender de quanto do SaaS sem CNPJ se confirma.

---

## 1. Quem calcula MRR hoje

Há **cinco bases** e pelo menos **dez cópias** da conta oficial.

| # | Consumidor (arquivo:linha) | Fonte | Setup | Anuidade | SaaS | Número hoje (set/26) |
|---|---|---|---|---|---|---|
| 1 | Métrica `mrr_atual` (`lib/metricas/catalogo.ts:130-178`). Alimenta Insights (`TabExecutivo.tsx:51`), Início/rodapé (`analytics/command-center.ts:56`), CS (`cs/metricas.ts:61`), Relatórios (`routes/relatorios.ts:133,790,1111`) | `cliente_receita_mensal` último mês, natureza MRR + `assinaturas` ativas sem linha no mês | Fora (natureza SETUP/AVULSO/DEBITO) | Planilha: já vem em valor mensal. Assinatura: `/12` na gravação (`stripe-sync.ts:90-100`) | Não filtra | **R$ 478.822,89** (a métrica ainda aplica o filtro de contas de teste, pode dar centavos a menos) |
| 2 | Financeiro `getMrrAtual` (`lib/financeiro/metricas.ts:94-141`) | Mesma conta do 1, **reescrita em SQL próprio** | Fora | Idem | Não filtra | R$ 478.822,89 |
| 3 | Carteira (`clientes/carteira-desenho.ts:155-190`), Cliente 360 (`clientes/cliente-para-o-desenho.ts:209`), CS (`cs/tela-cs.ts:116-122`, `cs/carteira-em-risco.ts:95-104`) | Mesma conta do 1, por empresa, **três cópias a mais** | Fora | Idem | Não filtra | soma = R$ 478.822,89 (mais as linhas sem empresa) |
| 4 | Clientes (`routes/clientes-crm2.ts:83,166,360,718`), fila de CS (`cs/fila.ts:114`), métrica `clientes_ativos` (`catalogo.ts:291`) | `servicos_canonicos.current_recurring_value` com `portfolio_included` | Fora (natureza MRR) | Não trata | Não filtra | **R$ 388.095,57** (230 serviços) |
| 5 | Conciliação Financeiro `totalContratado` (`metricas.ts:119-128`), Relatórios Comercial (`routes/relatorios.ts:120,125,229,738,746,1013,1515`) | `contratos.mrr` com status ativo | Não separa | Não trata | Não filtra | **R$ 389.290,64** (424 contratos) |
| 6 | Snapshot do Command Center (`analytics/snapshot-diario.ts:38-43`) | `assinaturas.mrr` status ativo+trial+past_due | Fora | `/12` na origem | Não filtra | **R$ 61.879,86** (+ R$ 7.355,80 em `unpaid`) |
| 7 | Churn, riscos, inadimplência, leads (`api/financeiro/churn/route.ts:48`, `metricas.ts:202,519`, `cs/riscos.ts:275`, `routes/relatorios.ts:1193`) | `assinaturas.mrr` por status | Fora | `/12` na origem | Não filtra | ativas R$ 46.431,36 (115); past_due R$ 9.872,00 (30) |
| 8 | "MRR fechado" do mês: Início (`analytics/inicio.ts:459,482`; `onface-inicio.ts:119`), Comando (`command-center.ts:120`), Comercial (`relatorios/comercial.ts:292,339`), Relatórios (`routes/relatorios.ts:1445`) | `negocios.mrr_fechado` por `ganho_at` | Fora | Não trata | n/a | Set: **R$ 51.862,21** (49 negócios). É **fluxo** (venda do mês), não estoque |
| 9 | Início, faturamento do mês (`inicio/consultas.ts:98`) | `mrr_fechado`; avulso/projeto pelo `valor_total` | Fora, de propósito (corrigido em `8b77b2d`) | Não trata | n/a | Set: R$ 61,3 mil |
| 10 | Meta/placar (`lib/metas.ts:21`, `relatorios/performance.ts:134`) | `mrr_fechado + valor_setup` | **Dentro**, de propósito (meta mede venda total) | Não trata | n/a | Set: R$ 51.862,21 + R$ 36.525,00 de setup |
| 11 | Propostas/negócio: `mrr_estimado` (`crm/sync-negocio-valores.ts:26-41`, `crm/proposta-criacao.ts:425`, `crm/proposta-regras.ts:45-51`, `crm/composicao-comercial.ts:193`) | Soma de `proposta_itens.subtotal` com `tipo = recorrente`, versões vigentes | Fora (tipo setup/avulso à parte) | **Soma anuidade como se fosse mensal** (ignora `catalogo_precos.periodo`) | n/a | Estimado: R$ 164,4 mil em negócios abertos |

Observações que importam:

- **A divergência de setup em setembro está parte resolvida.** O Início passou a ignorar o
  setup do híbrido (`8b77b2d`). Sobrou diferença legítima só entre "faturamento" (linha 9) e
  "meta" (linha 10). Setup de setembro em negócios ganhos: R$ 36.525,00 (2 híbridos
  R$ 30.030,00 + 1 projeto R$ 6.495,00). Mais 4 negócios tipo `recorrente` carregam
  R$ 32.450,00 de setup que nenhuma conta de faturamento conta.
- **A única conta que separa anuidade corretamente é a composição da proposta**
  (`lib/vendas/propostas.ts:789-835`). A que alimenta `mrr_estimado` não usa ela.
- **Anuidade hoje é risco latente, não erro medido.** O catálogo tem 3 preços anuais ativos
  (Callface AI Starter R$ 899,00; Full R$ 1.799,90; "Anual" R$ 1.726,80), mas nenhum item de
  proposta e nenhuma assinatura ativa usa preço anual (0 de 2.777 itens; 100% das 430
  linhas em `assinatura_itens` são mensais). Só 4 dos 2.777 itens de proposta apontam para
  um preço do catálogo; nos demais o período é deduzido do tipo. No primeiro anual vendido o
  `mrr_estimado` sai 12 vezes maior.
- **Filtro de SaaS (`7f2da67`) não está aplicado em produção:** a migration 0119 não rodou
  (a coluna `fora_do_espelho_em` não existe no banco) e nenhum leitor de MRR lê a marca.

## 2. Divergência entre as fontes (setembro/2026)

| Fonte | Valor | Observação |
|---|---|---|
| Planilha de set, linhas MRR | R$ 476.414,49 (323 linhas, 293 com empresa) | PABX 376.431,90; Callface AI 64.619,45; White Label 29.921,55; sem família 5.441,59 |
| MRR oficial (planilha + 8 assinaturas) | **R$ 478.822,89** | conta da linha 1 |
| `servicos_canonicos` (carteira) | R$ 388.095,57 | PABX 362.507,27; AI 23.143,30; WL 2.445,00 |
| `contratos.mrr` ativo | R$ 389.290,64 | AI 145.859,68; sem produto 243.430,96 |
| `assinaturas.mrr` ativa (espelho Stripe) | R$ 46.431,36 (115) | + past_due 9.872,00; trialing 5.576,50; unpaid 7.355,80 |
| Stripe ao vivo | **126 assinaturas ativas** (34 com marca de SaaS, 92 sem) | ver limite abaixo |

**Por que divergem (R$ 478,8 mil contra R$ 388,1 mil, diferença de R$ 90,7 mil):**

| Família | Planilha (oficial) | Carteira | Diferença | Causa |
|---|---|---|---|---|
| Callface AI | 64.619,45 | 23.143,30 | +41.476,15 | A carteira só tem 52 serviços AI ativos; a planilha tem 126 clientes AI. 44 empresas (R$ 31.982,23) cobradas na planilha não têm nenhuma assinatura no espelho |
| White Label | 29.921,55 | 2.445,00 | +27.476,55 | Matte (R$ 16.395,00) e G30 (R$ 11.902,80) classificados à mão na planilha ("white_label_set26"), ainda sem serviço canônico |
| PABX | 376.431,90 | 362.507,27 | +13.924,63 | Consumo/minutos extras que a planilha traz e o valor contratado não |
| Sem família | 5.441,59 | 0 | +5.441,59 | Linhas ainda não classificadas (2 com empresa, resto sem) |

**Callface AI: planilha contra Stripe.** Das 36 empresas AI presentes nos dois lados em setembro,
28 têm valor idêntico (13 delas, R$ 3.237,90, são clientes **marcados como SaaS** no
Stripe e **estão na planilha**). Ou seja, **a planilha de AI é, na prática, a cobrança do
Stripe, SaaS incluído**. Filtrar SaaS só em `assinaturas` não limpa o MRR oficial.

**Limite desta apuração (honesto):** não consegui valorar o Stripe ao vivo. O Sigma não está
contratado na conta e a leitura da API devolve ~3,5 mil tokens por assinatura (126+ chamadas
inviáveis aqui). Obtive só **contagens**: 126 ativas no Stripe contra 115 no espelho (o
espelho foi sincronizado hoje 15:14 UTC). As 11 faltantes são compatíveis com o caminho do
sync que descarta assinatura sem lead (`stripe-sync.ts:596`, `semLead`), mas não confirmei
uma a uma. Por isso o valor de R$ 46.431,36 é **piso**, não o total do Stripe. Os R$ 16.510,90
de SaaS citados no pedido dependem da marca no Customer, que o espelho não guarda
(`raw` não traz o customer); **não reproduzi esse valor**. Pela metadata da própria
assinatura, o espelho tem R$ 6.206,10 de SaaS ativo (20 assinaturas) mais R$ 179,90 em
past_due e R$ 269,80 em unpaid.

**Quanto SaaS está dentro dos R$ 478,8 mil oficiais** (estimativa):
- Confirmado por marca: R$ 3.237,90 (13 empresas na planilha) + R$ 179,80 (1 assinatura na
  cauda) = **R$ 3.417,70**.
- Possível: 30 linhas de MRR sem empresa (R$ 8.929,90; 27 são AI, R$ 6.305,90, tickets de
  R$ 89,90 a R$ 179,90 típicos de plano SaaS). Se todas forem SaaS, o teto é R$ 9.723,60.
- O restante dos R$ 16,5 mil está nas leituras por `assinaturas` (linhas 6 e 7), que o
  filtro `7f2da67` corrigiria.

## 3. A regra de recorrência do Scott: ela funciona?

Teste em `cliente_receita_mensal`, por cliente (`customer_key`), natureza MRR, setembro contra
meses anteriores (mesmo valor exato, centavo a centavo):

| Critério | Clientes | MRR de set | % do MRR |
|---|---|---|---|
| Mesmo valor em jul, ago e set | 162 | R$ 240.274,78 | 50,4% |
| Mesmo valor em ago e set, jul diferente/ausente | 37 | R$ 44.197,50 | 9,3% |
| Valor variou de ago para set | 59 | R$ 141.515,47 | 29,7% |
| Não estava em agosto (novo ou voltou) | 65 | R$ 50.426,74 | 10,6% |
| **Total** | **323** | **R$ 476.414,49** | |

Variantes: igual nos últimos 6 meses (abr a set): 74 clientes, R$ 137.336,68; igual em ao menos
4 dos 6 meses: 142 clientes, R$ 210.060,47; **tolerância de 5% em jul/ago/set: 204 clientes,
R$ 363.658,44 (76%)**.

Por família, quem varia: PABX 33 clientes variaram (R$ 113.372,64 de MRR em set); AI 23
variaram e 58 são novos de agosto para setembro (R$ 26.055,91, mês de entrada forte do AI).

**Veredito.** A ideia é correta como *prova* de recorrência e ruim como *filtro* de MRR:

- **Funciona** para provar o núcleo: 162 clientes iguais por 3 meses são recorrência
  inequívoca (R$ 240 mil). Com tolerância de 5% sobe para R$ 364 mil.
- **Falha no consumo.** Dos 59 que variaram, 30 variaram até 5% (R$ 94,8 mil de MRR, quase
  tudo subindo: minutos/uso), 16 variaram 15 a 50% e 11 mais de 50%. Cliente de PABX com
  minuto extra é MRR; a regra "mesmo valor" o jogaria fora.
- **Falha no cliente novo.** Os 65 sem agosto (R$ 50,4 mil) só ganham recorrência no mês
  seguinte; a regra os trata como não-MRR por um mês inteiro, e o AI cresceu muito em set.
- **Falha no valor errado ao contrário.** Matte e G30 (R$ 28.297,80, White Label) estão em
  MRR por classificação manual do Scott, com 1 mês de histórico e 3 a 4 lançamentos cada: a
  regra não os confirmaria, e é provável que tenham parte de implantação.
- O histórico só cobre bem 3 meses fechados na mesma estrutura (jul, ago, set); antes de jul a
  base é a importação antiga (10.740 linhas mensais até 06/2026).

Por isso a recomendação é usar a regra para **etiquetar**, não para **cortar** (seção 5).

## 4. Setup contra recorrente: dá para distinguir hoje?

Dá, mas **cada tabela diz de um jeito, e a mais usada para negócio é a pior preenchida**.

| Tabela / campo | Classificados | Situação |
|---|---|---|
| `cliente_receita_mensal.revenue_nature` | 12.041 de 12.041 | Completo. Valores: MRR, SETUP, DEBITO_RECUPERADO. Set/26: 1 SETUP (R$ 29.990,00, Helbor, "setup White Label"), 1 DEBITO_RECUPERADO (R$ 6.000,00). Setup antigo vem com família UNKNOWN (ex.: 7 linhas em mai/26) |
| `proposta_itens.revenue_nature` + `tipo` | 2.777 de 2.777 | Completo: MRR 2.654; SETUP 57; ONE_TIME 66 |
| `proposta_itens.recurring_value` / `non_recurring_value` | **0 de 2.777** | Coluna existe e **ninguém preenche**. Quem lê esse par não acha nada |
| `contrato_itens.revenue_nature` e `recurring_value`/`non_recurring_value` | 399 de 443 (44 em branco) | Bom: MRR 378 itens, R$ 206.395,67; SETUP 8, R$ 65.526,00; ONE_TIME 3 |
| `servicos_canonicos.revenue_nature` | 496 de 496, mas 83 `UNKNOWN` | 36 `UNKNOWN` dentro da carteira, todos com valor R$ 0,00 |
| `assinaturas.revenue_nature` | **144 de 382** | Falta em 62% |
| `negocios.revenue_nature` | **2 de 1.643** | Inutilizável |
| `negocios.tipo_receita` + `valor_setup` + `mrr_fechado` | tipo preenchido nos ganhos (613 recorrente, 8 híbrido, 2 projeto) | É a classificação real do negócio. 146 negócios `recorrente` ganhos têm `mrr_fechado` zero |
| `contratos.valor_setup` / `leads.valor_setup` | parcial | Sem natureza |

Conclusão: **para o estoque (MRR), a separação setup/recorrente já está feita na origem**
(`cliente_receita_mensal.revenue_nature`, preenchido na importação da planilha). Para a
venda (negócio), vale `tipo_receita` + `valor_setup`, não `revenue_nature`. O que falta é
poucas coisas: preencher `assinaturas.revenue_nature`, e um dia ligar `recurring_value`.

## 5. Proposta: UMA definição de MRR

> **MRR do mês M** = soma do valor das linhas de `cliente_receita_mensal` com
> `revenue_nature = 'MRR'` na competência M (a última fechada), **excluindo clientes do SaaS
> Callface**, **mais** o valor mensal normalizado (`/12` se anual) das assinaturas Stripe
> **ativas do CRM** de clientes que ainda não têm linha na competência M.

Entra:
- Faturamento recorrente da planilha: PABX, Callface AI, White Label, incluindo consumo
  recorrente (minutos extras que se repetem) e linhas que variam até a tolerância.
- Assinatura Stripe do CRM, ativa, de cliente que virou cliente depois do fechamento.
- Anuidade como valor mensal (`valor anual / 12`).

Fica de fora:
- Setup, venda avulsa, projeto, débito recuperado, hardware e uso pontual (naturezas SETUP,
  ONE_TIME, DEBITO_RECUPERADO, HARDWARE, USAGE).
- SaaS Callface (pela marca de `7f2da67`, aplicada também às linhas da planilha: hoje 13
  empresas confirmadas).
- Assinatura em `past_due`/`unpaid`/`incomplete` que não esteja na planilha (continua
  aparecendo como risco, não como MRR).
- `negocios.mrr_fechado` e `mrr_estimado` **não são MRR**: são "MRR vendido no mês" (fluxo) e
  "MRR previsto". Mantêm o nome de **Vendido** e **Previsto** e nunca somam com o estoque.

Etiqueta de confiança por linha (não altera o total, aparece em cada card e na lista):
- **Estável:** mesmo valor em 2 ou mais meses seguidos, ou variação até 5% (hoje 204 clientes,
  R$ 363,7 mil).
- **Variável:** variou mais de 5% (consumo). Continua MRR.
- **Novo:** primeiro mês da planilha (hoje 65 clientes, R$ 50,4 mil, incluindo os dois White
  Label). Entra no MRR; vira Estável no mês seguinte.

Impacto em setembro, partindo do que está na tela:

| Passo | Valor |
|---|---|
| MRR oficial hoje | R$ 478.822,89 |
| Retirar SaaS confirmado por marca (13 empresas na planilha + 1 assinatura) | -R$ 3.417,70 |
| **MRR proposto, piso de ajuste** | **R$ 475.405,19** (-0,7%) |
| Se as 27 linhas AI sem empresa (R$ 6.305,90) forem SaaS | -R$ 6.305,90 |
| **MRR proposto, teto de ajuste** | **R$ 469.099,29** (-2,0%) |
| Anuidade | R$ 0,00 hoje (nenhuma ativa); evita erro de 12x no primeiro anual |
| Setup/débito | R$ 0,00 de mudança: já estão fora |

A mudança de **número** é pequena. A mudança grande é de **consistência**: as telas das
linhas 4 a 7 passam de R$ 46 mil a R$ 389 mil para o mesmo R$ 475 mil, e as 10 cópias da
conta viram uma só.

### Decisões que preciso do Scott

1. **Linhas sem empresa da planilha (R$ 8.929,90, 30 linhas), SaaS ou cliente?** Define se
   o ajuste é -0,7% ou -2,0%.
2. **Matte e G30 (R$ 28.297,80)** ficam em MRR no primeiro mês, como hoje, ou entram em
   "Novo/a confirmar" fora do total por um mês? Setembro cresceu R$ 40,7 mil sobre agosto
   (+9,3%) e R$ 25,7 mil disso é White Label.
3. **Tolerância de "estável":** 5% (proposta) ou outra?
4. **Cliente em `past_due`** da planilha segue como MRR? (Hoje sim, pois a planilha é faturamento.)

### O que implementar depois do OK (não feito)

1. Uma só função de MRR (a do catálogo `mrr_atual`); remover as cópias de
   `financeiro/metricas.ts:94`, `carteira-desenho.ts:155`, `tela-cs.ts:116`,
   `carteira-em-risco.ts:95`, `cliente-para-o-desenho.ts:209`.
2. Aplicar a migration 0119 e `marcar-saas-fora-do-espelho.ts` (simula antes); a métrica
   passa a ignorar `fora_do_espelho_em` e a marca SaaS também nas linhas da planilha.
3. `sync-negocio-valores.ts` e `proposta-criacao.ts:425` passam a usar `periodo` do preço
   (anual / 12 em `mrr_estimado`, anuidade à parte), igual a `composicaoDaProposta`.
4. Telas 4 a 7 passam a ler a métrica ou ganham o rótulo de "contratado" / "Stripe".
5. Preencher `assinaturas.revenue_nature` (62% em branco) e decidir o destino de
   `proposta_itens.recurring_value`/`non_recurring_value` (vazios).
6. Investigar as 11 assinaturas ativas do Stripe fora do espelho e as 44 empresas AI
   cobradas na planilha sem nenhuma assinatura no CRM.

## Metodologia e limites

- Todas as consultas em produção foram `SELECT`. Nenhuma escrita em banco ou Stripe.
- "Cliente" na seção 3 é `customer_key` da planilha (soma de linhas MRR do mês); a
  planilha ainda tem 30 linhas sem `empresa_id`.
- SaaS identificado por metadata da assinatura (`organization_id`, `plan_id`, `user_id`),
  a mesma regra de `lib/integrations/stripe-origem.ts`. A marca no Customer não está no
  espelho e não foi consultada.
- Stripe: apenas contagens (126 ativas; 92 sem `plan_id`). Valor ao vivo não apurado.
- O código lido é o do `HEAD` local (`7f2da67`); presumo que produção rode o mesmo commit.

## Fase 3 (13/10/2026): uma consulta, nomes distintos

- A conta oficial mora em `app/src/lib/metricas/mrr-oficial.ts` (`mrrOficialLinhas`). Catálogo
  (`mrr_atual`), Financeiro, Carteira, tela de CS, carteira em risco e Cliente 360 só a embrulham,
  com recorte por família, empresa ou conjunto de empresas.
- Métricas novas no catálogo: `mrr_contratado` (servicos_canonicos), `mrr_faturavel` (fechamento da
  planilha), `receita_setup`, `receita_avulsa` (ONE_TIME), `receita_uso` (USAGE). `mrr_atual` segue sendo o MRR oficial.
- Setup nunca entra no MRR. A única soma com setup é a meta/placar (`lib/metas.ts`, `relatorios/performance.ts`),
  de propósito: mede venda total do vendedor.
