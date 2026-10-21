# Insights 2.0 — estado da execução

**Leia primeiro.** Diz o que está feito e provado, o que está aberto, e qual é o próximo passo
concreto. Atualizado: 2026-10-21.

## Modo de trabalho vigente

O **Product Design está com o Scott, no Figma**, tela por tela, nesta ordem: Visão Geral Executiva
→ Biblioteca de Relatórios → Explorador → Performance de Equipe → Performance Individual → demais
domínios.

A engenharia **não decide arquitetura visual nova**. Pode construir componentes técnicos,
infraestrutura de filtros e contratos de integração; não pode inventar layout nem replicar
referência por conta própria. Telas aprovadas chegam e são implementadas com fidelidade.

## Estado do código

Seis commits em `main`. **Durante esta sessão outra sessão fez push**, e com ele os seis
commits de Insights foram para `origin/main` — não fui eu que publiquei, e não houve deploy:
`./deploy.sh` não foi executado nem para homologação nem para produção. Estar na `main` significa
que o portão constrói a imagem; a publicação continua sendo um passo manual e autorizado.

Insights segue fechado em produção por `AREAS_EM_BREVE=automacoes,insights`.

| Commit | O quê |
|---|---|
| `030a38b0` | regra de receita vendida numa fonte só; o Fechamento mostrava R$ 100.123,87 a menos |
| `f7635293` | White Label fora do MRR vendido: R$ 73.043,00 que nunca foram cobrados |
| `ea7ce99c` | Visão Geral sem masthead; valor sem quebra; 4 CSS → 1 |
| `19a41039` | 12 métricas novas, razões, alertas, endpoint do painel, estado honesto |
| `9084c371` | documento de estado (anterior a este) |
| `34f7b06c` | Visão Geral com filtros, composição, meta, alertas e faíscas |
| `d8a042d8` | esta documentação |
| `a6efd5e6` | **booking da tela estava R$ 106 mil acima da regra** — a correção da política de receita nunca tinha chegado ao catálogo |

Os dois últimos são **frontend não validado**: funcionam e estão provados no navegador, mas o
desenho não foi aprovado e vai ser substituído pelo que sair do Figma. Ficam como estão — são
base funcional, não decisão visual final.

## Trabalho de outras sessões — não tocar

| Arquivo | O que é |
|---|---|
| `app/src/lib/relatorios/sdr-insights.ts` + teste | função pura de observabilidade de pré-vendas (cobertura de marcos, p50/p90 sem inventar SLA). Não commitado, órfão. |
| `app/src/scripts/diagnosticar-servicos-sem-dono.ts` | **só leitura.** Diagnóstico das assinaturas presas na empresa-balde "Unresolved billing identity" |
| `app/src/scripts/devolver-dono-dos-servicos.ts` | re-aponta `servicos_canonicos` criados antes da correção de 15/10 do `resolveBillingCustomer`. **R$ 7.535/mês de assinatura ativa sem aparecer em ficha de cliente.** |

Em 21/10 às 13:23 essa sessão commitou `09b56a77` — "Devolve o dono a 34 assinaturas presas na
empresa-balde", R$ 6.586,00/mês de assinatura ativa que não aparecia em ficha de cliente. **O
commit não toca código de Insights, mas altera dados** que o módulo lê (`servicos_canonicos`).
Conferido depois dele no banco local: MRR atual e clientes ativos seguem em R$ 478.822,89 e 298 —
o script foi aplicado em outro ambiente. **Em homologação e produção os números podem ter mudado**,
e qualquer conferência lá tem que ser refeita depois dessa correção.

Os dois scripts são da **mesma frente de reconciliação de identidade Stripe** que a frente B deste
plano toca. **Fronteira acordada:** essa sessão fica com `resolveBillingCustomer`, sync do Stripe e
dono de `servicos_canonicos`; Insights fica com leitura, catálogo e diagnóstico. Antes de mexer em
identidade de billing, checar o estado desses arquivos.

Um `SdrTempoExplorer.tsx` órfão e com JSX truncado foi tirado do build (quebrava o typecheck) e
preservado no scratchpad da sessão. Não foi apagado.

---

## Números de referência (banco local, cópia de produção)

| Medida | Valor |
|---|---|
| MRR atual | R$ 478.822,89 |
| — PABX / Callface AI / White Label / sem família | 376.431,90 / 64.799,25 / 29.921,55 / 7.670,19 |
| MRR vendido (booking recorrente) | R$ 469.198,63 |
| Setup vendido | R$ 100.123,87 |
| **Booking (recorrente + setup), todo o histórico** | **R$ 569.322,50** |
| Booking desde o go-live (o que a tela mostra) | R$ 152.168,25 — era R$ 258.274,55 antes de `a6efd5e6` |
| Avulso/projeto (fora do booking) | R$ 26.465,00 |
| Faturado set/26 | R$ 512.404,49 em 303 linhas |
| Clientes ativos | 298 |
| Win rate | 31,3% (173 de 553) |
| Ticket médio do booking | R$ 1.492,92 |
| Meta do mês cadastrada | R$ 220.000,00 em 9 metas |

## Lacunas de dado confirmadas — não são bug de tela

| Lacuna | Medida |
|---|---|
| `oportunidade_itens` | **3 linhas no banco inteiro**; 0 das 626 oportunidades ganhas tem item |
| `oportunidades.probabilidade` e `previsao_fechamento` | nulas nas 110 abertas → pipeline ponderado e previsto indisponíveis |
| `pipeline_aberto` | só 52 de 110 abertas têm valor → cartão sai `parcial` |
| Família do booking | derivável com honestidade em 274 de 623 (família única do serviço da empresa); 2 ambíguos, 347 sem serviço |
| `cliente_receita_mensal.revenue_nature` | só MRR, SETUP e DEBITO_RECUPERADO — **não existe ONE_TIME nem USAGE** |
| `leads.primeiro_contato_at` | 221 de 1.207 leads nos últimos 90 dias (18%) |
| `oportunidades_estagnadas` | 0 real: o campo só é preenchido quando alguém marca à mão |
| White Label no MRR | só 2 de 67 competências têm MRR de WL (PABX tem 67, Callface AI 39) |

## Achados do inventário da camada legada

Medidos em `docs/produto/insights-2/inventario-camada-legada.md`. **No banco local; reexecutar em
produção antes de cortar qualquer coisa.**

- Dos 20 endpoints legados: **1** tem equivalente total no catálogo (e nem tem consumidor), **6**
  parcial, **13** nenhum.
- **Bugs**: o churn do `/pos-venda` ignora o status `churned` (0,45% exibido contra 4,9% real);
  seis endpoints não têm gate de papel embora a Biblioteca anuncie acesso de gestão; o
  `/atividade-time` mistura dia UTC com dia do banco.
- **"Qualificado" tem cinco definições** em setembro: 112, 80, 45, 88 e 166.
- **Receita atribuída à mídia paga** ainda usa a fórmula anterior à correção do White Label: inclui
  ~R$ 73 mil de MRR de WL e omite R$ 67,7 mil de setup, então o ROAS sai inflado.
- **Janela de período diverge em quase todos os endpoints**, não só no `/comercial`: `12m` vira
  01/07 no legado e 01/11/2025 no canônico; `tudo` e `ano_atual` caem em 30 dias sem erro.
- **Taxonomias de origem divergem** entre `getLeadsPorCanal` e `origemCanonica` (Site: 18 contra 81).
- **Dado que não sustenta a capacidade**: NPS tem 0 linhas; 96% dos contratos ativos sem
  `vencimento`; só 5% das mensagens de WhatsApp de saída e 50% das ligações têm usuário — o
  relatório de atividade do time parece mais preciso do que é.
- Há consumidores de `lib/relatorios/` **fora** dos endpoints (Carol, `pipeline-crm2`,
  `command-center`, snapshot, `financeiro/metricas`, Biblioteca): desligar não é só apagar rota.

## Divergência aberta

Movimento líquido de MRR **não fecha** com a variação do MRR faturável:

| Competência | Variação do faturável | Movimento líquido | Gap |
|---|---|---|---|
| 2026-09 | +R$ 40.787,85 | +R$ 6.340,11 | R$ 34.447,74 |
| 2026-08 | −R$ 9.749,10 | +R$ 11.443,45 | −R$ 21.192,55 |
| 2026-07 | +R$ 30.061,17 | +R$ 8.051,30 | R$ 22.009,87 |

`cruzadas.test.ts` trava a magnitude em R$ 50 mil/mês. O bridge de MRR não sobe antes disso fechar.

---

## Decisões de negócio pendentes

Nenhuma bloqueia a fundação; todas têm estado honesto implementado.

1. **Fusão Marketing + Growth + Mídia paga** num domínio só — muda navegação.
2. **Domínio IA e Telefonia** — depende do banco do Callface AI (`CALLFACE_AI_DATABASE_URL`, túnel
   `:55432` estava fechado). Sem acesso, nasce vazio.
3. **Risco de MRR**: `past_due`, `unpaid` ou os dois? Hoje `past_due` (R$ 10.101,90 em 31).
4. **Churn**: o Stripe cobre o suficiente? 165 cancelamentos, sem boleto nem NF do PABX.
5. **"Recorrência confirmada"** de White Label = 3 competências seguidas é limiar proposto.
6. **Meta comparável a booking**: só existem metas `mrr_fechado` (tipo aposentado) e booking inclui
   setup — o atingimento de 117,4% está superestimado por isso.
7. **Data do booking**: `ganho_at` ou data da evidência de ganho?

## Pendências técnicas

- **Causa raiz do White Label não consertada:** `aceitar-proposta.ts` segue gravando a linha
  Recorrente da proposta em `mrr_fechado` no aceite, então toda venda nova de WL entra inflada.
  Mexer é entrar em Vendas — precisa de autorização.
- Conciliação aplicada **só no banco local** (run `0096fe55`, reversível).
- Identidade Stripe N:1 vazia: `billing_identities` + `billing_customer_aliases` existem e nunca
  foram usadas. `empresas.stripe_customer_id` é 1:1 e mente.
- Contratos legados do Zoho não importados: 191 das 291 pagantes sem contrato (R$ 286.688,61).
- `financeiro/metricas.ts:28` vaza linhas de org nula (dívida de segurança, não de número).
- Gate anunciado ≠ aplicado em 18 dos 20 endpoints legados.
- As 8 abas de `crm2/relatorios/` seguem na camada pré-catálogo.
- Performance sem endpoint próprio; `usuarios.role` usado como papel histórico, o que não é confiável.

---

## Roadmap técnico priorizado

Entregas verticais: dados → consulta → endpoint → contrato → teste. **Sem decisão visual nova.**

| # | Entrega | Por que nesta ordem | Depende de |
|---|---|---|---|
| **F1** | **Filtros compartilhados**: intervalo personalizado, comparação explícita, responsável, equipe, origem, canal, campanha, etapa — cada métrica declarando o que aceita | é o que toda tela do Figma vai pedir, e hoje só existe período+família | — |
| **F2** | **Contrato de Performance**: endpoint próprio, réguas por papel, papel vindo do evento | Performance é a 4ª e 5ª tela do Figma | F1 |
| **F3** | **Fundação por domínio**: contratos de dados dos 8 domínios, métricas que faltam registradas, capacidades legadas migradas com teste | destrava a biblioteca inteira | F1, inventário |
| **F4** | **Desligar a camada legada**, endpoint a endpoint, só quando houver equivalente testado | reduz a superfície de divergência | F3 |
| **F5** | **Reconciliação**: identidade Stripe N:1, PLATAFORM com prova, contratos Zoho | corrige número, exige autorização por lote | coordenação com a outra sessão |
| **F6** | **Gate real** nos endpoints e `org` estrito em `financeiro/metricas.ts` | segurança | — |
| **F7** | **Relatório salvo / visão salva**: persistência versionada | só depois que o catálogo e os filtros estabilizarem | F1, F3 |

**Próximo passo concreto:** F1. Começar pela declaração de filtros suportados por métrica em
`catalogo.ts` (hoje só `familia` e `testes`), estendendo `Periodo` e `lerPedido` para as dimensões
novas, com 422 para o que a métrica não aceita e teste cobrindo cada par métrica×filtro.
