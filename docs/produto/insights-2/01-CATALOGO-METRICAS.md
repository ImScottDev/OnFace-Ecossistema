# Insights 2.0 — catálogo de métricas

Cada métrica aqui é **uma definição oficial**: mesma métrica, mesmos parâmetros, mesmo número em
qualquer superfície. A definição mora em código versionado (`app/src/lib/metricas/catalogo.ts`),
não numa tabela que alguém edita sem revisão; `metric_catalog` no banco é espelho para descoberta.

Gerado a partir do código em 2026-10-21 (atualizado após a correção do booking). **Não edite esta tabela à mão** — ela sai de `CATALOGO`.

## Como ler

- **Tipo** — *evento*: conta o que aconteceu numa janela. *retrato*: estado num instante, ignora a
  janela. *coorte*: população que entrou numa janela, acompanhada ao longo do tempo.
- **Piso** — antes desta data a fonte não existe. A resposta carrega `pisoAplicado`, e a tela diz
  "sem dado antes de X" em vez de desenhar zero.
- **Família** — se aceita o filtro de família de serviço. Quem não aceita devolve **422** com o
  motivo, nunca um número filtrado por engano.
- **Dimensões** — por onde a métrica pode ser quebrada, e por onde o drill-down funciona.

## As 28 métricas

| Código | Tipo | Unidade | Piso | Família | Dimensões |
|---|---|---|---|---|---|
| `booking_cabecalho` | evento | R$ | 2026-07-01 | sim | familia |
| `booking_ganho` | evento | R$ | 2026-07-01 | sim | familia |
| `clientes_faturados` | evento | nº | 2021-03-01 | sim | familia |
| `faturado` | evento | R$ | — | não | status |
| `faturamento_competencia` | evento | R$ | 2021-03-01 | sim | familia, natureza, confianca, fonte |
| `faturas_stripe_fora_da_planilha` | evento | R$ | 2025-11-01 | não | situacao |
| `leads_novos` | evento | nº | — | não | origem, status |
| `logos_cancelados` | evento | nº | — | sim | familia |
| `meta_booking` | evento | R$ | 2026-06-01 | não | tipo, usuario |
| `mrr_cancelado` | evento | R$ | — | sim | familia, motivo |
| `mrr_movimento_liquido` | evento | R$ | — | não | tipo, origem |
| `oportunidades_criadas` | evento | nº | — | sim | familia, situacao |
| `oportunidades_perdidas` | evento | nº | — | sim | familia, motivo |
| `pipeline_previsto` | evento | R$ | — | sim | familia, etapa |
| `recebido` | evento | R$ | — | não | metodo |
| `receita_avulsa` | evento | R$ | 2021-03-01 | sim | familia, confianca, fonte |
| `receita_avulsa_vendida` | evento | R$ | 2026-07-01 | sim | familia |
| `receita_setup` | evento | R$ | 2021-03-01 | sim | familia, confianca, fonte |
| `receita_uso` | evento | R$ | 2021-03-01 | sim | familia, confianca, fonte |
| `clientes_ativos` | retrato | nº | — | sim | — |
| `mrr_atual` | retrato | R$ | — | sim | familia, origem |
| `mrr_contratado` | retrato | R$ | — | sim | familia |
| `mrr_em_risco` | retrato | R$ | — | sim | familia |
| `mrr_faturavel` | retrato | R$ | — | sim | familia |
| `oportunidades_abertas` | retrato | nº | — | sim | familia, etapa |
| `oportunidades_estagnadas` | retrato | nº | — | sim | familia, etapa |
| `pipeline_aberto` | retrato | R$ | — | sim | familia, etapa |
| `pipeline_ponderado` | retrato | R$ | — | sim | familia, etapa |

## Razões (não são métricas do catálogo)

Razão não cabe em `definir()`: ele só sabe `sum(valor)` e `count(*)`, e é isso que torna a
aditividade verdadeira por construção. Entrar ali mataria a trava. Moram em
`app/src/lib/metricas/derivadas.ts`, derivadas de duas métricas catalogadas.

| Razão | Numerador / Denominador | Amostra mínima | Drill abre |
|---|---|---|---|
| `win_rate` | `booking_ganho` (registros) / + `oportunidades_perdidas` | 20 | numerador |
| `conversao_lead_oportunidade` | `oportunidades_criadas` / `leads_novos` | 30 | numerador |
| `atingimento_meta_booking` | `booking_ganho` / `meta_booking` | 1 | numerador |
| `ticket_medio_booking` | `booking_ganho` / `booking_ganho` (registros) | 5 | numerador |

Denominador zero ou ausente devolve `null` com motivo `sem_denominador`. Abaixo da amostra mínima,
`null` com `amostra_pequena`. **Nunca 0%** — amostra pequena mente.

## Alertas

Alerta é **métrica catalogada + limiar explícito e versionado**
(`app/src/lib/metricas/alertas.ts`), nunca texto gerado. Cada um aponta a métrica que o prova, e o
clique abre o drill dela.

| Alerta | Métrica que prova | Dispara quando |
|---|---|---|
| `faturas_stripe_fora_da_planilha` | a própria | > 0 |
| `mrr_em_risco` | `mrr_em_risco` | > 0 (assinaturas `past_due`) |
| `oportunidades_estagnadas` | `oportunidades_estagnadas` | > 0 |
| `meta_do_mes` | `meta_booking` vs `booking_ganho` | cobertura insuficiente |
| `churn_acima_da_media` | `mrr_cancelado` | último mês fechado > média dos 3 anteriores |

O limiar é versionado (`versaoLimiares`) para que uma mudança de régua não passe por correção de
número.

## Fonte de verdade, métrica a métrica

**`booking_cabecalho`** — Booking pelo cabeçalho da oportunidade

- Fonte: oportunidades com ganho_at na janela, somando valor sem aplicar regra nenhuma.
- Não inclui: a separação entre mensalidade, setup e avulso, e a regra do White Label. Para decidir, use `booking_ganho`. Divergir daqui é esperado e está medido em `cruzadas.test.ts`.

**`booking_ganho`** — Booking (venda ganha)

- Fonte: negócios ganhos com ganho_at dentro da janela, somando mensalidade vendida mais setup pela política única de `receita-fechada.ts` (White Label entra só com o setup).
- Não inclui: oportunidades abertas, ganhos de períodos anteriores e qualquer previsão. Projeto/avulso fica fora: é `receita_avulsa_vendida`. Booking não vira MRR automaticamente.

**`clientes_ativos`** — Clientes ativos

- Fonte: empresas distintas com servicos_canonicos em commercial_lifecycle ACTIVE.
- Não inclui: a marca leads.tipo = cliente, que envelhece: medido em 21/09, 111 marcados sem contrato ativo e 124 com contrato ativo e sem a marca.

**`clientes_faturados`** — Clientes faturados

- Fonte: cliente_receita_mensal, um registro por documento somando as competências da janela.
- Não inclui: serviço ativo sem faturamento no período e cliente que paga por outro documento. Primeiro faturamento observado não prova primeira venda, e ausência de faturamento não prova cancelamento.

**`faturado`** — Faturado

- Fonte: faturas com data de emissão dentro da janela.
- Não inclui: fatura cancelada e recebimento — quem paga é a métrica recebido.

**`faturamento_competencia`** — Faturamento por competência

- Fonte: cliente_receita_mensal: 11.111 linhas da base histórica (03/2021 a 06/2026) e os fechamentos de julho a setembro de 2026, conciliados ao centavo com os arquivos originais (ver conciliação).
- Não inclui: recebimento (faturamento não prova pagamento), venda decidida e MRR contratado. Mês ainda não fechado aparece como ausente, nunca como zero. A família é a da Business Line da planilha (CALL 

**`faturas_stripe_fora_da_planilha`** — Cobrado no Stripe sem linha na planilha

- Fonte: faturas (origem Stripe, status paga ou aberta) sem linha em cliente_receita_mensal para a mesma empresa e competência.
- Não inclui: rascunho e fatura anulada. Não é receita adicional confirmada: pode ser cobrança de empresa que a planilha lança sob outro documento. É fila de conciliação, não ajuste de faturamento.

**`leads_novos`** — Leads novos

- Fonte: leads com created_at dentro da janela.
- Não inclui: lead com origem de teste (qa, teste_local). O filtro de família não se aplica: lead não tem família de serviço.

**`logos_cancelados`** — Clientes que cancelaram (Stripe)

- Fonte: assinaturas do CRM canceladas na janela, agrupadas por empresa, descontando quem ainda tem assinatura viva.
- Não inclui: Cobre SÓ assinaturas Stripe espelhadas no ONFACE. Boleto e nota fiscal do PABX não têm assinatura aqui: o número NÃO é o churn ou o risco da carteira inteira. Cliente que só trocou de plano 

**`meta_booking`** — Meta comercial (closers)

- Fonte: metas das closers ativas (papéis closer/vendedor) por mês: tipo faturamento_fechado; no mês em que só existe o tipo aposentado mrr_fechado, vale ele (mesma regra de getMetaComercialAgregada)
- Não inclui: meta de SDR e meta de reuniões. Meses anteriores a 09/09/2026 só têm meta do tipo aposentado mrr_fechado (MRR, sem setup): comparar com booking_ganho, que inclui setup, superestima o atingim

**`mrr_atual`** — MRR atual

- Fonte: cliente_receita_mensal na maior competência, revenue_nature = MRR (regra do Scott, 06/10: MRR oficial = faturado no último fechamento) + assinaturas ativas de clientes ainda sem a competênci
- Não inclui: setup, venda avulsa, débito recuperado e projeto (naturezas SETUP/AVULSO/DEBITO_RECUPERADO da mesma tabela), que aparecem separados como faturamento.

**`mrr_cancelado`** — MRR cancelado (Stripe)

- Fonte: assinaturas do CRM com status canceled e cancelada_em dentro da janela, somando mrr.
- Não inclui: Cobre SÓ assinaturas Stripe espelhadas no ONFACE. Boleto e nota fiscal do PABX não têm assinatura aqui: o número NÃO é o churn ou o risco da carteira inteira. Não inclui assinatura que nunca

**`mrr_contratado`** — MRR contratado

- Fonte: servicos_canonicos.current_recurring_value com portfolio_included, natureza MRR e ciclo comercial ACTIVE.
- Não inclui: o que de fato foi faturado (consumo variável do PABX, serviço sem cadastro canônico e White Label ainda sem serviço canônico ficam de fora: medido em set/2026, R$ 388 mil contratado contra R

**`mrr_em_risco`** — MRR em risco (cobrança falhando)

- Fonte: assinaturas do CRM com status past_due, somando mrr.
- Não inclui: Cobre SÓ assinaturas Stripe espelhadas no ONFACE. Boleto e nota fiscal do PABX não têm assinatura aqui: o número NÃO é o churn ou o risco da carteira inteira. Não inclui assinatura 'unpaid' 

**`mrr_faturavel`** — MRR faturável

- Fonte: cliente_receita_mensal na maior competência, revenue_nature = MRR (mrr-oficial.ts, origem fechamento).
- Não inclui: assinatura vendida depois do fechamento e ainda sem linha na planilha (essa entra só no mrr_atual), o valor contratado em si (mrr_contratado), setup, avulso, uso e débito recuperado.

**`mrr_movimento_liquido`** — Movimento líquido de MRR (Stripe)

- Fonte: mrr_movimentos (delta) pela data de ocorrência.
- Não inclui: Cobre SÓ assinaturas Stripe espelhadas no ONFACE. Boleto e nota fiscal do PABX não têm assinatura aqui: o número NÃO é o churn ou o risco da carteira inteira. Os movimentos vêm do sync Strip

**`oportunidades_abertas`** — Oportunidades abertas

- Fonte: oportunidades com ganho_at e perdido_at nulos e etapa canônica preenchida (a mesma contagem do Pipeline).
- Não inclui: ganhas e perdidas, inclusive as fechadas hoje, e o legado com status ativo sem etapa (decisão de 05/10: ativo não é etapa comercial, fica fora do funil).

**`oportunidades_criadas`** — Oportunidades criadas

- Fonte: oportunidades com created_at dentro da janela.
- Não inclui: o que já era oportunidade antes da janela. Inclui as que já foram ganhas ou perdidas: é entrada no funil, não estoque.

**`oportunidades_estagnadas`** — Oportunidades marcadas como estagnadas

- Fonte: oportunidades abertas com estagnado_em preenchido (gravado por lib/vendas/pipeline.ts quando o usuário informa o motivo).
- Não inclui: oportunidade parada há muito tempo que ninguém marcou. Zero aqui significa 'ninguém marcou', não 'nada está parado'.

**`oportunidades_perdidas`** — Oportunidades perdidas

- Fonte: oportunidades com perdido_at dentro da janela.
- Não inclui: o motivo de negócio por trás da perda. Perda em lote (limpeza de funil) conta no dia em que foi marcada: fev/2026 tem 151 perdas e ago/2026 tem 192, picos que não são 151 ou 192 negócios mor

**`pipeline_aberto`** — Pipeline aberto

- Fonte: oportunidades abertas (mesmo recorte de oportunidades_abertas), somando valor.
- Não inclui: oportunidade aberta SEM valor preenchido (entra na contagem, não na soma: veja o preenchimento), ganhas, perdidas e legado sem etapa.

**`pipeline_ponderado`** — Pipeline ponderado

- Fonte: oportunidades abertas, valor x probabilidade / 100.
- Não inclui: oportunidade sem probabilidade ou sem valor: ela não vira zero, fica FORA da soma e o preenchimento mostra quantas faltam.

**`pipeline_previsto`** — Pipeline previsto no período

- Fonte: oportunidades abertas com previsao_fechamento dentro da janela, somando valor.
- Não inclui: oportunidade aberta sem data de previsão (não dá para saber em que período ela cairia: veja o preenchimento), ganhas e perdidas.

**`recebido`** — Recebido (caixa)

- Fonte: pagamentos canônicos com status pago e paid_at na janela (origem Stripe).
- Não inclui: boleto e nota fiscal do PABX: a baixa deles não está no ONFACE, então este número é parcial e NÃO pode ser lido contra o faturado total (em set/2026: R$ 56 mil recebidos contra R$ 512 mil fa

**`receita_avulsa`** — Receita avulsa

- Fonte: cliente_receita_mensal, revenue_nature = ONE_TIME, pela competência.
- Não inclui: setup de implantação (receita_setup), consumo variável (receita_uso), mensalidade (MRR) e débito recuperado. O balde 'Avulso' dos gráficos de faturamento soma setup + pontual + uso; esta mét

**`receita_avulsa_vendida`** — Projeto e avulso vendidos

- Fonte: negócios ganhos com tipo de receita avulso ou projeto, pela política de `receita-fechada.ts`.
- Não inclui: mensalidade e setup — esses são o booking.

**`receita_setup`** — Receita de setup

- Fonte: cliente_receita_mensal, revenue_nature = SETUP, pela competência.
- Não inclui: mensalidade (MRR), venda avulsa e pontual (receita_avulsa), consumo variável (receita_uso) e débito recuperado. O setup do negócio ganho que ainda não foi faturado também fica de fora: aqui 

**`receita_uso`** — Receita de uso

- Fonte: cliente_receita_mensal, revenue_nature = USAGE, pela competência.
- Não inclui: mensalidade fixa (MRR), setup, venda avulsa e débito recuperado. Uso NÃO é MRR: varia de um mês para o outro. O PABX com consumo que a planilha lança como MRR continua dentro do MRR oficial,
