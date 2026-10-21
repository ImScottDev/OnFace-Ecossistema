# Insights 2.0 — evidências medidas

Banco local `callface_crm` (cópia de produção). Tudo aqui é número medido, com a consulta ao lado.
Plano: `~/.claude/plans/miss-o-onface-insights-2-0-mutable-hippo.md`.

## 2026-10-21 — P1: a regra de receita vendida estava em 4 lugares, e os 4 perdiam o setup

### O defeito

Quatro cópias calculavam `avulso/projeto ? valor_total : mrr_fechado`:
`api-server/routes/relatorios.ts:1740` e `:1745`, `lib/relatorios/fechamento-comercial.ts:369`,
`components/onface/insights/TabFechamento.tsx:55` (regra financeira dentro de componente React).

Nenhuma somava `valor_setup` da venda recorrente. O Fechamento Comercial mostrava, portanto,
**R$ 100.123,87 a menos** do que a Callface vendeu.

`decomporVenda()` já existia em `lib/relatorios/receita-fechada.ts` com a regra certa e **não era
chamada por ninguém** (`grep` não achou um consumidor).

### A decisão do Scott (21/10)

Booking = **recorrente + setup** num número; **avulso/projeto separado**. A regra anterior juntava
setup de venda recorrente com projeto avulso no mesmo bucket chamado "setup" — as telas diziam
"setup" e mostravam outra coisa.

### Os três buckets, medidos nas 623 vendas ganhas

```sql
SELECT round(sum(CASE WHEN coalesce(tipo_receita,'') IN ('avulso','projeto') THEN 0
                      ELSE coalesce(mrr_fechado,0) END),2)  AS mrr,
       round(sum(CASE WHEN coalesce(tipo_receita,'') IN ('avulso','projeto') THEN 0
                      ELSE coalesce(valor_setup,0) END),2)  AS setup,
       round(sum(CASE WHEN coalesce(tipo_receita,'') IN ('avulso','projeto')
                      THEN (CASE WHEN coalesce(valor_total,0) > 0 THEN valor_total
                                 ELSE coalesce(valor_setup,0) END) ELSE 0 END),2) AS avulso
  FROM negocios WHERE ganho_at IS NOT NULL;
```

| grandeza | valor |
|---|---|
| MRR vendido | R$ 542.241,63 |
| Setup vendido | R$ 100.123,87 |
| **Booking (MRR + setup)** | **R$ 642.365,50** |
| Avulso/projeto (fora do booking) | R$ 26.465,00 |
| Total vendido | R$ 668.830,50 |

Por tipo de receita: `recorrente` 613 ganhos, `hibrido` 8, `projeto` 2. O `hibrido` recorre e entra
como recorrente + setup — não como avulso.

**O total não mudou**: a correção separa em três grandezas o que já somava igual. O que muda é o
número que cada tela chama de "vendido".

### O que foi feito

- `lib/relatorios/receita-fechada-shared.ts` (novo): política + `decomporVenda` + `valorVendido`,
  puro, sem `db` nem schema — pode ir para Client Component (padrão de `metas-shared.ts`).
- `lib/relatorios/receita-fechada.ts`: `VALOR_SETUP_VENDIDO` e `VALOR_AVULSO_VENDIDO` separados,
  `VALOR_BOOKING_VENDIDO` novo. `VALOR_NAO_RECORRENTE_VENDIDO` marcado `@deprecated` (ainda lido por
  4 pontos da camada pré-catálogo, que será aposentada).
- `fechamento-comercial.ts`: `VendaFechada` ganhou `valorVendido` e `valorAvulso`, calculados por
  `decomporVenda` no servidor. As 4 cópias passam a ler daí.
- `TabFechamento.tsx`: `valorDaVenda` deletada. A tela não decompõe venda.

### Prova

`node --import tsx --env-file=.env --test src/lib/relatorios/receita-fechada.test.ts` — 8/8.
Inclui dois testes contra o banco: o SQL concorda com o TS **linha por linha** nas 623 vendas
ganhas, e `booking + avulso` fecha o total no agregado.
`pipeline-fonte-unica.test.ts` 3/3. `pnpm typecheck` limpo.

## 2026-10-21 — booking canônico x legado: a divergência é de R$ 800 em um registro

`cobertura.test.ts` ("o canônico e o legado contam o mesmo ganho") está **vermelho desde antes desta
sessão** — só importa `db` e `drizzle-orm`, nada do código alterado. A divergência é de dado:

| | legado (`negocios`) | canônico (`oportunidades`) | diferença |
|---|---|---|---|
| MRR dos ganhos | R$ 542.241,63 | R$ 543.041,63 | **R$ 800,00** |
| Ganhos | 623 | 626 | **3** |

- **Os 3 ganhos a mais são todos `[QA]`**, valor zero, criados em 06/10 (`[QA] Churn`, `[QA] Entrega`,
  `[QA] Won`). O catálogo já os exclui por `semTestes`; o `cobertura.test.ts` não aplica o filtro.
- **Os R$ 800,00 são UM registro:** `RESDIL | 20 RAMAIS + 04 LINHAS SIP | CIN`, ganho em 28/05/2023,
  `tipo_receita = 'recorrente'`, com `oportunidades.mrr = 800,00` e `negocios.mrr_fechado = 0,00`.
  20 ramais + 4 linhas SIP é PABX recorrente: o canônico está certo e o legado está zerado.

**Conclusão:** as duas fontes de booking estão praticamente conciliadas. `negocios` +
`decomporVenda` é base sólida; `oportunidade_itens`, que seria a fonte mais fina, **não serve
hoje** (ver abaixo).

## 2026-10-21 — `oportunidade_itens` é uma tabela morta

```sql
SELECT count(*) FROM oportunidade_itens;                    -- 3 linhas no banco inteiro
-- oportunidades ganhas com pelo menos um item:              0 de 626
```

A tabela tem exatamente o que falta (`service_family NOT NULL`, `revenue_nature NOT NULL`,
`valor_total NOT NULL`), e ninguém escreve nela. **O plano de ler booking por item não é
executável hoje** — fica como destino, dependendo de a porta de escrita do Ganho passar a gravar
item (`lib/vendas`, fora do escopo de Insights).

### Consequência: a família do booking continua sem fonte

| caminho | cobertura |
|---|---|
| `negocios.service_family` | 1 de 623 |
| `oportunidades.service_family` | 2 de 623 |
| `oportunidade_itens` | 0 de 623 |
| família única do serviço canônico da empresa | **274 de 623** (2 ambíguos, 347 sem serviço) |

Derivar pela empresa só é honesto quando a empresa tem **uma** família de serviço ativo — 274 casos.
Nos outros 349 a família fica indeterminada. A Visão Geral declara a cobertura em vez de inventar.

Faturamento por família **não** tem esse problema: `cliente_receita_mensal.service_family` é
classificado na carga.

## 2026-10-21 — White Label: o MRR registrado não é recorrência

### A regra, dita pelo Scott e confirmada no vault

Na venda, o parceiro paga **só o setup**; a recorrência **nunca existiu** na venda de WL, mesmo
quando a proposta trouxe setup + MRR. Depois, mês a mês, a vendedora abre o admin da Callface, vê
quanto o parceiro consumiu, e **cria uma fatura à mão no Stripe** — e isso não foi feito todos os
meses.

O vault (`CRM/arquitetura/white-label/06-faturamento`) descreve o modelo desenhado: cobrança **por
usuário ativo, não por assento** ("é por uso real na organização"), **pró-rata por dias ativos**,
**trial não entra na fatura**, e **sem split automático para o cliente final** — ou seja, a receita
da Callface é o *wholesale* que o parceiro paga, não o preço de revenda. Isso resolve o
`UNRESOLVED` da auditoria semântica: é receita própria, mas o valor certo é consumo × wholesale.

### A prova de que não recorre

```sql
SELECT coalesce(service_family,'UNKNOWN') familia, count(DISTINCT competencia) competencias,
       min(competencia), max(competencia)
  FROM cliente_receita_mensal WHERE revenue_nature='MRR' GROUP BY 1;
```

| família | competências com MRR | período |
|---|---|---|
| PABX | **67** | 03/2021 → 09/2026 |
| CALLFACE_AI | **39** | 06/2023 → 09/2026 |
| UNKNOWN | 11 | 03/2022 → 09/2026 |
| **WHITE_LABEL** | **2** | 08/2026 → 09/2026 |

PABX recorre em 67 de 67 competências. White Label em **2**. E o valor salta de R$ 4.221,75
(ago/26, 2 linhas) para R$ 29.921,55 (set/26, 3 linhas), com clientes diferentes.

As 3 linhas de set/2026, todas de `planilha_faturamento_mensal`:

| cliente | valor | confiança |
|---|---|---|
| MATTE TECNOLOGIA LTDA | R$ 16.395,00 | CONFIRMED |
| G30 EDUCACAO AUTOMOTIVA LTDA | R$ 11.902,80 | CONFIRMED |
| BROKER IA SISTEMAS & TECNOLOGIA LTDA | R$ 1.623,75 | PROBABLE |

Matte e G30 são exatamente as faturas manuais que o Scott citou de memória. Broker IA repete em
ago e set pelo mesmo valor — e a errata da auditoria semântica (V2) diz que esse R$ 1.623,75 é
**SETUP BROKER IA**, não MRR.

### O efeito na métrica

`mrrOficialLinhas` define MRR como *"o faturado com natureza MRR na última competência fechada +
assinatura ativa de cliente sem linha MRR nessa competência"* (regra do Scott, 06/10). Para PABX
isso é correto — recorre em todas as competências. Para White Label assume que o faturado em
set/2026 vai repetir, e o histórico mostra que não repete.

Outras leituras possíveis de WL, para comparação:

| fonte | linhas | valor |
|---|---|---|
| `cliente_receita_mensal`, última competência MRR | 3 | **R$ 29.921,55** (é o que entra no MRR hoje) |
| `servicos_canonicos` WL ativos (`current_recurring_value`) | 7 | R$ 2.445,00 |
| assinaturas ativas de empresa com serviço WL | 18 | R$ 9.409,15 |
| `contratos` com produto WL | 0 | — |

**Pendente de decisão do Scott** (pergunta feita em 21/10): se o faturamento manual de WL conta
como MRR atual. Se não contar, o MRR atual cai de R$ 478.013,79 para ~R$ 448.092,24 e o WL passa a
aparecer só em faturamento por competência. Nada foi alterado até a resposta.
