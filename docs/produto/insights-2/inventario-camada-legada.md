# Inventário da camada legada do Insights

Atualizado: 2026-10-21. Somente leitura: nenhum código foi alterado para produzir este documento.

Objetivo: dizer, com precisão, o que a camada antiga (`app/src/lib/relatorios/` + os 20 endpoints de
`app/src/api-server/routes/relatorios.ts`) sabe fazer, o que o catálogo novo
(`app/src/lib/metricas/`) já cobre, e o que se perderia se a camada antiga fosse desligada.

## 0. Como ler e como foi medido

- Caminhos são relativos a `app/src/`. Número depois de `:` é linha.
- "Catálogo" = 26 métricas em `lib/metricas/catalogo.ts` (`CATALOGO`) mais 4 razões em
  `lib/metricas/derivadas.ts` (`RAZOES`: `win_rate`, `conversao_lead_oportunidade`,
  `atingimento_meta_booking`, `ticket_medio_booking`). Cada métrica de EVENT tem série temporal,
  composição por dimensão, tabela paginada e exportação via `lib/metricas/explorar.ts`.
- **Onde medi:** banco local `localhost:5432/callface_crm`, organização "Callface"
  (`320a9052-dd43-4edb-9b74-34be53c5c419`), em 2026-10-21. É uma cópia de desenvolvimento, **não** o
  `callface_crm_mz` de produção. Os dados têm corte diferente por tabela (leads até 21/10, ganhos até
  09/10, ligações até 09/10, notas até 12/10). Trate os números como medida de ordem de grandeza e de
  existência de dado, e **reexecute as queries em produção antes de decidir qualquer corte**.
- Números de "função × catálogo" saíram de chamadas reais às funções (`getPipelineAtual`,
  `getWinRate`, `medir`, `medirRazao`, `getVisoesSdr` etc.) sobre o mesmo banco, na mesma janela.
- Não medi o que depende da Graph API da Meta (gasto, CPL, CTR): é chamada externa, sem tabela local.
  O token `META_ADS_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID` existem no `.env`.
- Piso de dados do ONFACE como sistema de registro: 01/07/2026 (`GO_LIVE`, `lib/relatorios/periodo.ts:9`).

## 1. Mapa: quem chama quem

```
/relatorios (page.tsx)  ->  InsightsOnface (components/onface/insights/InsightsOnface.tsx)
  abas gestão: executivo | comercial | sdr | pos-venda | atividade-time | growth | marketing |
               midia-paga | fechamento | qualidade
  abas pessoais: comercial ("Meu desempenho") | sdr ("Minha pré-venda")

/relatorios/biblioteca/[id]  ->  InsightsRelatorio (components/onface/relatorios/InsightsRelatorio.tsx)
  renderiza OS MESMOS Tab* de crm2/relatorios, por outro caminho de URL

/relatorios/performance  ->  lib/relatorios/performance.ts  (NÃO passa pelos 20 endpoints)
```

- `executivo` já é 100% camada nova (`TabExecutivo` -> `usePainel` -> `/api/relatorios/painel`).
- `qualidade` usa `/qualidade`; `fechamento` usa `/fechamento-comercial`; `comercial` ainda embute
  `BlocoGestao` (`/gestao`). As demais abas são os `Tab*` herdados de `components/crm2/relatorios/`.
- Duas rotas de entrada hospedam os mesmos `Tab*`: o shell de Insights e a Biblioteca. O período
  persiste na URL nos dois, mas `safra` só persiste no shell de Insights (ver seção 3).
- Traefik manda `/api/relatorios/*` para o Hono (`api-server/server.ts:147-149`). Existe um
  duplicado morto do `/qualidade` no Next (`app/api/relatorios/qualidade/route.ts`), mesmo gate
  `finance.read`.
- Outros consumidores das funções de `lib/relatorios/`, fora dos endpoints:
  `getPipelineAtual`/`getFechadoPeriodo`/`getWinRate`/`getTicketMedio` em `api-server/routes/carol.ts`,
  `api-server/routes/pipeline-crm2.ts`, `lib/analytics/command-center.ts`,
  `lib/analytics/snapshot-diario.ts`; `getMetricasPorCampanha`/`agregarFunil` em
  `app/api/financeiro/metricas/route.ts`; `VALOR_TOTAL_VENDIDO` em `lib/metas.ts`;
  `listarVendasFechadas` & cia. em `app/(produto)/relatorios/biblioteca/[id]/page.tsx`;
  `consultarQualidadeDados` no Next. **Desligar `lib/relatorios/` quebra esses também.**

## 2. Os 20 endpoints

### 2.1 Tabela-resumo

Equivalência: **Total** = o catálogo responde todas as chaves com consumidor; **Parcial** = responde
parte (ou responde com outra conta); **Nenhuma**.

| # | Endpoint (linha) | Gate real | Consumidor | Catálogo |
|---|---|---|---|---|
| 1 | `GET /qualidade` (:39) | `exigirCtx("finance.read")` | `TabQualidadeDados` | Nenhuma (só sondas de preenchimento) |
| 2 | `GET /snapshot-diario` (:52) | `getCtx`, sem papel | nenhum no front (só worker grava) | Nenhuma |
| 3 | `GET /meta-capi-saude` (:84) | `exigirCtx("finance.read")` | `MetaCapiObservabilidade` (dentro de `TabMidiaPaga`) | Nenhuma |
| 4 | `GET /resumo` (:103) | `getCtx`; personal view escopa por responsável | **nenhum** | Total (sem delta/trend) |
| 5 | `GET /tendencias` (:170) | `getCtx`, **sem escopo por papel** | `TabMarketing` (só `tipo=leads`) | Parcial |
| 6 | `GET /equipe` (:281) | `getCtx`; personal view vira "só eu" | `TabComercial` | Nenhuma |
| 7 | `GET /atividade-time` (:414) | `getCtx` + 403 se personal view | `TabAtividadeTime` | Nenhuma |
| 8 | `GET /atividade-time/:usuarioId/:dia` (:499) | idem + UUID/data validados | `TabAtividadeTime` (drawer) | Nenhuma |
| 9 | `GET /comercial` (:613) | `getCtx`; personal view escopa por responsável | `TabComercial`, `TabComercialCloser`, `HeroComercial` | Parcial |
| 10 | `GET /gestao` (:723) | `isAdminView` ou `leitor` | `BlocoGestao` | Nenhuma |
| 11 | `GET /growth` (:739) | `isAdminView` (leitor leva 403) | `TabGrowth` | Parcial |
| 12 | `GET /marketing` (:886) | `getCtx`, **sem gate de papel** | `TabMarketing` | Nenhuma |
| 13 | `GET /pos-venda` (:1039) | `getCtx`, **sem gate de papel** | `TabPosVenda` | Parcial |
| 14 | `GET /tracking` (:1176) | `isAdminView` | `TabMarketing`, `OrigemLeads` (Campanhas) | Nenhuma |
| 15 | `GET /midia-paga` (:1413) | `getCtx`, **sem gate de papel** | `TabMidiaPaga` | Nenhuma |
| 16 | `GET /faturamento-categoria` (:1461) | `getCtx`, **sem gate de papel**; safra validada | `FaturamentoCategoria` (dentro de `TabComercial`) | Parcial |
| 17 | `GET /fechado-mensal` (:1532) | `getCtx`, **sem escopo por papel**; safra validada | `TabComercial`, `HeroComercial` | Parcial |
| 18 | `GET /sdr-esteira` (:1607) | `getCtx`; só `porResponsavel` é escopado | `TabSdr`, `HeroSdr` | Nenhuma |
| 19 | `GET /fechamento-comercial` (:1704) | `isAdminView` ou `leitor` | `TabFechamento` | Nenhuma |
| 20 | `GET /fechamento-comercial/export` (:1855) | idem | link em `TabFechamento` e na Biblioteca | Nenhuma |

Contagem: **1 Total, 6 Parcial, 13 Nenhuma.** (Parcial = #5, #9, #11, #13, #16, #17.)

Parâmetros: **nenhum endpoint valida `periodo`.** `parsePeriodo` (`lib/relatorios/periodo.ts:28`)
aceita `mes_atual`, `mes_passado`, `Nd` (1 a 365), `12m` e `custom:AAAA-MM-DD:AAAA-MM-DD`; qualquer
outra string cai em 30 dias, em silêncio. O catálogo rejeita com 400 (`relatorios-painel.ts` usa Zod
`.strict()`). Valida-se: `safra` (400), `tipo` de `/tendencias` (400), `dias` (clamp 1 a 31),
`semanas` (clamp 1 a 52), UUID e formato da data no drill-down.

### 2.2 Fichas

Convenção: "Tabelas" = tabelas lidas direta ou indiretamente. "Funções" = chamadas em `lib/relatorios/`
(ou `lib/metricas/`, `lib/metas`). O helper local `periodWindow` (`routes/relatorios.ts:77`) deriva
`since/until/prevSince` de `parsePeriodo`; a janela anterior tem o mesmo tamanho (não é MTD).

#### 1. `/qualidade`
- **Pergunta:** os dados que sustentam o faturamento estão íntegros e completos?
- **Parâmetros:** nenhum.
- **Gate:** `finance.read`.
- **Tabelas:** `cliente_receita_mensal`, `contratos`, `assinaturas`, `faturas`, `pagamentos`,
  `anexos_legado`, `service_ledger_batches`, `service_ledger_entries`, `leads`.
- **Função:** `consultarQualidadeDados` (`lib/relatorios/qualidade-dados.ts:6`).
- **Resposta:** `corte`, `fonte`, `competencia`, `atualizadoEm`, `historico` (KPIs: linhas, MRR da
  competência, pagantes sem contrato, linhas sem empresa, família desconhecida), `financeiro`
  (assinaturas ativas sem empresa/serviço, faturas pagas sem pagamento), `legado` (contratos sem
  empresa, anexos, lotes fechados pendentes), `slaQualidade` (coorte de 7 dias: primeiro contato,
  cronologia inválida), `aviso`.
- **Consumidor:** `components/onface/insights/TabQualidadeDados.tsx:72`.
- **Equivalente:** nenhum. O catálogo tem `preenchimento` por métrica (sonda de cobertura) e
  `faturas_stripe_fora_da_planilha`, mas não um relatório de integridade. A arquitetura prevê o domínio
  "Qualidade dos Dados". Faltaria registrar: pagantes sem contrato, linhas sem empresa, família
  desconhecida, faturas pagas sem pagamento, contratos sem empresa, lotes pendentes.

#### 2. `/snapshot-diario`
- **Pergunta:** qual foi o retrato de hoje (meta, pipeline, fechado do mês, MRR Stripe, MRR em risco)?
- **Parâmetros:** nenhum.
- **Gate:** `getCtx` (qualquer papel autenticado).
- **Tabelas:** `metricas_diarias`; no fallback, `metas`, `oportunidades`, `negocios`, `assinaturas`.
- **Funções:** `calcularSnapshotDiario` (`lib/analytics/snapshot-diario.ts:29`), que chama
  `getMetaComercialAgregada`, `getPipelineAtual`, `getFechadoPeriodo`.
- **Resposta:** linha de `metricas_diarias` (KPIs soltos): `metaValorAlvo`, `metaRealizado`,
  `metaClosers`, `pipelineTotal`, `pipelinePonderado`, `pipelineNegociosAbertos`,
  `fechadoMes{Ganhos,Receita,Recorrente,Avulso}`, `mrrStripe`, `mrrStripeClientes`, `mrrRisco`,
  `mrrRiscoQtd`; mais `calculadoAgora` no fallback.
- **Consumidor:** nenhum no front (grep em `components/` e `app/` não acha). O worker grava a cada
  1 h (`worker/index.ts:4378`). Só `lib/metricas/cruzadas.test.ts:19` lê a tabela.
- **Equivalente:** nenhum. As métricas SNAPSHOT do catálogo (`mrr_atual`, `pipeline_aberto`) dão o
  valor de agora, não histórico. A tabela é a única fonte de **histórico diário de pipeline e MRR
  Stripe**. Medido: 4 linhas (06/10 a 09/10) nesta base.

#### 3. `/meta-capi-saude`
- **Pergunta:** o que o CRM mandou de volta à Meta (Conversions API) foi entregue, e por que não?
- **Parâmetros:** `periodo` (padrão `30d`, não validado).
- **Gate:** `finance.read`.
- **Tabela:** `meta_capi_entregas`.
- **Função:** `consultarSaudeCapi` (`lib/relatorios/meta-capi-saude.ts:45`).
- **Resposta:** `periodo`, `total`, `entregues`, `excluidos`, `bloqueados`, `aguardando`,
  `elegiveis`, `taxaEntrega`, `ultimaAtualizacao`, `porEvento[]` (série por evento), `motivos[]`
  (composição das falhas), `aviso`.
- **Consumidor:** `components/crm2/relatorios/MetaCapiObservabilidade.tsx:23`.
- **Equivalente:** nenhum. Faltaria registrar `capi_eventos` (EVENT sobre `meta_capi_entregas`,
  dimensões: evento, motivo, entregue) e uma razão `capi_taxa_entrega`.

#### 4. `/resumo`
- **Pergunta:** quais os quatro números de topo (leads, pipeline, win rate, MRR) e como variaram?
- **Parâmetros:** `periodo` (padrão `mes_atual`).
- **Gate:** `getCtx`; closer/SDR enxergam só o próprio recorte, **exceto** o MRR da visão de gestão.
- **Tabelas:** `leads`, `oportunidades` (+ `negocios`) via funções, `contratos` (join `leads`),
  `cliente_receita_mensal`/`assinaturas` via `medir("mrr_atual")`.
- **Funções:** `getPipelineAtual`, `getWinRate` (atual e anterior), `crescimento`, `medir`.
- **Resposta:** quatro objetos `{ total, delta, trend }`: `leads` (com sparkline de 7 buckets),
  `pipeline` (sem delta), `winRate`, `mrr`.
- **Consumidor:** nenhum. Só comentários citam a rota.
- **Equivalente:** Total em valor: `leads_novos`, `pipeline_aberto`, `win_rate`, `mrr_atual`. O que
  não existe é o **delta contra a janela anterior** e o sparkline (o `explorar` dá série, não comparação).
  O MRR do `/resumo` mistura duas fontes: total oficial, delta de `contratos.mrr` (seção 5, D2).

#### 5. `/tendencias`
- **Pergunta:** como evoluem no tempo (a) leads por origem, (b) ganhos e receita, (c) MRR fechado?
- **Parâmetros:** `periodo` (padrão `30d`); `tipo` = `leads | negocios | mrr` (validado, 400).
- **Gate:** `getCtx` apenas. **Não escopa por papel**: um closer ou SDR lê a série da organização
  inteira, inclusive receita e MRR.
- **Tabelas:** `leads` (diário por `origem`), `negocios` (semanal, `ganho_at`, `valor_total`),
  `contratos` (mensal por `inicio`, `status='ativo'`, join `leads`).
- **Funções:** nenhuma de `lib/relatorios/` além de `periodWindow`/`clampDesdeGoLive`.
- **Resposta:** `{ data: [...] }`, série. `leads`: `{periodo,total,origens{}}`; `negocios`:
  `{periodo,ganhos,perdidos(sempre 0),receita}`; `mrr`: `{periodo,mrr,contratos}`.
- **Consumidor:** `TabMarketing.tsx:280` usa **só** `tipo=leads`. `negocios` e `mrr` não têm consumidor.
- **Equivalente:** `leads` -> `leads_novos` (campoData `criado_em`, dimensão `origem`). `negocios` ->
  `booking_ganho` (série por `ganho_at`, mas valor de outra conta, D3). `mrr` -> nenhum e errado de
  origem: soma `contratos.mrr` por data de início, não MRR; o catálogo tem `mrr_movimento_liquido`.
  Usa `date_trunc` sem fuso explícito (depende da sessão do banco), ao contrário do catálogo
  (`janela.ts`, fixo em -03:00).

#### 6. `/equipe`
- **Pergunta:** como cada closer performa (leads, qualificados, ganhos, perdidos, win rate, receita,
  ciclo, atividades)?
- **Parâmetros:** `periodo` (padrão `30d`).
- **Gate:** `getCtx`; closer/SDR (personal view) recebem só a própria linha; leitor vê todos.
- **Tabelas:** `usuarios` (papel `closer`/`vendedor` + `CLOSER_EXTRA_IDS`), `negocios`, `status_changes`,
  `leads`, `atividades`.
- **Funções:** `getFechadoPorResponsavel` (`comercial.ts:336`), `getPerdidosPorResponsavel`
  (`funil-eventos.ts:100`).
- **Resposta:** `{ membros: [{usuarioId,nome,role,qualificados,ganhos,perdidos,winRate,receitaTotal,
  cicloMedio,leadsAtribuidos,atividadesTotal}] }` (lista). "Qualificados" aqui é
  `leads.sdr_status='qualified'` (definição própria, D5).
- **Consumidor:** `TabComercial.tsx:163` (tabela "Desempenho por Vendedor").
- **Equivalente:** nenhum. **Nenhuma métrica do catálogo tem dimensão de responsável/pessoa**
  (`booking_ganho` só tem `familia`; só `meta_booking` expõe `usuario`). A página
  `/relatorios/performance` (`lib/relatorios/performance.ts`) cobre faturamento, ganhos, conversão e
  esforço por pessoa com **outra conta** (reuniões agendadas pela própria pessoa no lead dela).
  Faltaria: dimensão `responsavel` em `booking_ganho`, `oportunidades_perdidas`,
  `oportunidades_criadas`, e uma métrica de ciclo.

#### 7. `/atividade-time`
- **Pergunta:** quem está de fato trabalhando, por pessoa e por dia, nos últimos N dias?
- **Parâmetros:** `dias` (padrão 14, clamp 1 a 31).
- **Gate:** `getCtx` + 403 em personal view (leitor passa).
- **Tabelas:** `usuarios`, `ligacoes`, `notas`, `whatsapp_mensagens` (direção `out`), `status_changes`,
  `tarefas` (`concluida=true`).
- **Funções:** nenhuma (SQL inline). Lógica parecida está duplicada em `lib/relatorios/performance.ts`.
- **Resposta:** `{ dias: string[], membros: [{usuarioId,nome,role,porDia{dia: {ligacoes,
  duracaoLigacoesSegundos,notas,mensagens,mudancasEstagio,tarefasConcluidas,total}}, totais,
  diasAtivos}] }` (matriz pessoa x dia, ordenada por quem fez menos).
- **Consumidor:** `TabAtividadeTime.tsx:198`.
- **Equivalente:** nenhum. Faltaria um domínio "Operação" com métricas de esforço (ligações,
  mensagens, notas, mudanças de etapa, tarefas concluídas) e dimensão pessoa x dia.
- **Atenção:** janela em dias UTC (`setUTCHours`), agrupamento por `date_trunc('day')` na sessão do
  banco, drill-down em `T00:00:00Z`. Com o banco em America/Sao_Paulo (como no local), o quadrado do
  grid e o feed do drill-down cobrem janelas diferentes (3 h de deslocamento). Não verifiquei o fuso
  do banco de produção.

#### 8. `/atividade-time/:usuarioId/:dia`
- **Pergunta:** o que essa pessoa fez naquele dia, item a item?
- **Parâmetros:** `usuarioId` (UUID, regex), `dia` (`AAAA-MM-DD`, regex; dia impossível como
  `2026-13-45` passa na regex e estoura em `toISOString`, dando 500).
- **Gate:** idem #7. O texto do WhatsApp só sai se `sessaoVisivel(ctx, ...)` autoriza; senão vira
  "(mensagem em número pessoal)".
- **Tabelas:** `ligacoes`, `notas`, `whatsapp_mensagens`, `whatsapp_sessao`, `status_changes`,
  `tarefas`, com `leads` e `negocios` para o nome.
- **Resposta:** `{ resumo{ligacoes,notas,mensagens,mudancasEstagio,tarefasConcluidas,total},
  itens[{tipo,titulo,contexto,leadId,negocioId,createdAt}] }` (lista cronológica).
- **Consumidor:** `TabAtividadeTime.tsx:93`.
- **Equivalente:** nenhum (o drill do catálogo abre registros de uma métrica, não um feed misto).

#### 9. `/comercial`
- **Pergunta:** como está o comercial: fechado, pipeline, conversões, perdas, meta, e o que esfria?
- **Parâmetros:** `periodo` (padrão `mes_atual`), `safra` = `nativo | legado | todos` (padrão
  `nativo`, validado).
- **Gate:** `getCtx`; personal view -> `responsavelId` do próprio; `metaComercial` e `insights` só
  para `isAdminView`.
- **Tabelas:** `oportunidades` (+ `negocios` por `negocio_id_legado`) para pipeline, win rate,
  motivos, cobertura; `negocios` para fechado, ciclo, esfriando, funil e `ganhosList`; `status_changes`
  (funil por evento); `leads` (ciclo, nome); `metas` (via `lib/metas`).
- **Funções:** `getPipelineAtual` (`comercial.ts:115`), `getWinRate` (:162), `getMotivosPerda` (:198),
  `getCicloMedio` (:254), `getFechadoPeriodo` (:287), `getTicketMedio` (:472), `getFunilConversao`
  (:394), `getPipelineEsfriando` (:495), `getLeadsQualificados` (:450), `getCoberturaValorPorEtapa`
  (:539), `getMetaComercialAgregada`, `getMetasPorVendedor` + `gerarInsights`.
- **Resposta (primeiro nível):** `safra`, `metaEscopo`, `periodoEfetivo` (sem consumidor);
  `ganhosList` (lista); `coberturaValor` (lista); `pipeline` (composição por etapa + totais);
  `winRateInfo` (KPI); `motivosInfo` (composição); `fechado` (KPIs); `ticketMedio` (KPI);
  `funilConversao` (funil); `pipelineEsfriando` (lista); `leadsQualificados` (KPI);
  `metaComercial` (KPI); `insights` (lista de frases); `forecast`; compat com tela antiga
  (`pipelineMrr`, `winRate`, `motivosPerda`, `cicloMedio`, `negociosAbertos`). `pipelineMrr` e
  `motivosPerda` não têm consumidor.
- **Consumidor:** `TabComercial.tsx:138`, `TabComercialCloser.tsx:39`, `InsightsOnface.tsx:263`
  (`HeroComercial`, mesma queryKey para deduplicar). `funilConversao` e `ganhosList` só são
  desenhados na aba do closer.
- **Equivalente (por bloco):**
  - pipeline por etapa: `pipeline_aberto` / `oportunidades_abertas` (dimensão `etapa`). Mesmo valor
    medido: R$ 17.598,30 nos dois. Contagem 110 (legado) x 107 (catálogo): o catálogo exclui os 3 `[QA`.
  - forecast ponderado: `pipeline_ponderado`, **mas com outra conta** (D4).
  - win rate: `win_rate` (D7). Motivos: `oportunidades_perdidas` (dimensão `motivo`).
  - fechado/ticket: `booking_ganho` / `ticket_medio_booking`, **outra conta** (D3).
  - meta: `meta_booking` + `atingimento_meta_booking` (mesma meta; realizado diferente, D3).
  - ciclo médio, funil por evento, esfriando por inatividade, cobertura de valor por etapa, filtro de
    safra, escopo por responsável, insights de meta: **sem equivalente** (seção 4).
  - `oportunidades_estagnadas` NÃO substitui "esfriando": é uma marca manual (`estagnado_em`), não
    cálculo de tempo parado.
- **Janela:** `periodWindow` próprio, não `janelaDoPeriodo` (D1).

#### 10. `/gestao`
- **Pergunta:** quanto tempo o negócio fica em cada etapa, qual origem converte, quem tem tarefa vencida?
- **Parâmetros:** `periodo` (padrão `mes_atual`).
- **Gate:** `isAdminView` ou `leitor`.
- **Tabelas:** `status_changes` + `negocios` (tempo por etapa); `leads` + `negocios` (conversão);
  `tarefas` + `usuarios` (vencidas).
- **Funções:** `getTempoPorEtapa` (`gestao-operacional.ts:34`), `getConversaoPorOrigem` (:89, usa
  `origemCanonica` de `lib/vendas/origem-canonica`), `getTarefasVencidasPorPessoa` (:119).
- **Resposta:** `tempoPorEtapa` (4 linhas: `encerradas{n,medianaDias,mediaDias}`,
  `abertas{n,medianaDias,maisAntigaDias}`), `conversaoPorOrigem` (composição: `origem,leads,
  comOportunidade,ganhos,conversaoPct`), `tarefasVencidas` (lista por pessoa).
- **Consumidor:** `BlocoGestao.tsx:28`, renderizado só sob a aba Comercial.
- **Equivalente:** nenhum para os três. Ver seção 4.

#### 11. `/growth`
- **Pergunta:** visão CEO: aquisição, funil, receita, pipeline, retenção, time, meta.
- **Parâmetros:** `periodo` (padrão `mes_atual`).
- **Gate:** `isAdminView` (leitor leva 403; o front esconde a aba para quem não é admin).
- **Tabelas:** `leads`, `negocios`/`oportunidades` (funções), `status_changes`, `contratos`,
  `nps_respostas`, `usuarios`, `metas`, `cliente_receita_mensal`/`assinaturas` (via `medir`), mais
  **Meta Graph API ao vivo** (`fetchMetaCampaignInsights`).
- **Funções:** `getLeadsPorCanal`, `getPipelineAtual`, `getWinRate`, `getFechadoPeriodo`,
  `getTicketMedio`, `getCicloMedio`, `getFunilConversao`, `getPipelineEsfriando`,
  `getLeadsQualificados`, `contarReunioes`, `getFechadoPorResponsavel`, `getPerdidosPorResponsavel`,
  `getMetaComercialAgregada`, `medir("mrr_atual")`, `medir("clientes_ativos")`.
- **Resposta:** `periodo`; `aquisicao{leads,leadsDelta,porCanal[],midia{gasto,leadsPagos,cpl,
  configurado},cac}`; `funil{leads,qualificados,reunioesAgendadas,reunioesRealizadas,noShow,ganhos,
  taxaQualificacao,taxaFechamento,etapas[]}`; `receita{mrrNovoFechado,receitaFechada,mrrAtivo,
  ticketMedio,cicloMedio,winRate,winN,winAmostraPequena}`; `pipeline{total,ponderado,negociosAbertos,
  etapas,esfriando}`; `retencao{mrrAtivo,contratosAtivos,clientesAtivos,npsMedia,nps,npsDistrib,
  contratosVencendo{count,mrr}}`; `time{sdr,closers[]}`; `metaComercial`.
- **Consumidor:** `TabGrowth.tsx:106`.
- **Equivalente:** parcial. Sim: leads, pipeline, win rate, MRR ativo, clientes ativos, meta. Não:
  canal canônico, CAC/CPL (depende de gasto Meta), funil de reuniões, ticket/ciclo do closer, NPS,
  contratos vencendo, tabela de closers.
- **Sobre `contratos.mrr`:** o `mrrAtivo` do topo **já** vem de `medir("mrr_atual")`. O que ainda lê
  `contratos.mrr` é `retencao.contratosVencendo.mrr` (:778) e `contratosAtivos` (:771), a contagem.

#### 12. `/marketing`
- **Pergunta:** do investimento à venda: investimento, leads, CPL, qualificados, CPQ/CPC por campanha
  e por criativo, funis, ROAS.
- **Parâmetros:** `periodo` (padrão `30d`).
- **Gate:** `getCtx` apenas. A Biblioteca declara `acesso: "gestao"`, mas o endpoint não aplica.
- **Tabelas:** `leads` (utm_*), `negocios`, `propostas`, `status_changes`; **Meta Graph API ao vivo**
  (campanha e anúncio, mais `getMetricasPorCampanha` que busca de novo).
- **Funções:** `getLeadsPorCanal` (`canais.ts:15`), `getEsteiraSdr` (`esteira-sdr.ts:38`),
  `getFunilVendasEventos` (`funil-eventos.ts:134`), `getLeadsQualificados`, `getMetricasPorCampanha`
  (`midia-paga.ts:316`), `agregarFunil` (:428).
- **Resposta:** `leads_por_canal[]` (composição), `funilPreVendas[]`, `funilVendas[]` (funis),
  `cpl_por_campanha[]`, `por_criativo[]` (tabelas com `gasto,leads,cpl,cliques,impressoes,
  qualificados,clientes,cpq,cpc`), `metaConfigured`, `metaErro`, `totalQualificados`, `hero{
  investimento,leadsCrm,leadsMeta,qualificados,vendasAtribuidas,receitaAtribuida,cpl,cac,roas}`.
- **Consumidor:** `TabMarketing.tsx:268` (a aba dispara também `/tendencias` e `/tracking`).
- **Equivalente:** nenhum. O catálogo não tem gasto de mídia nem UTM. `leads_novos` tem dimensão
  `origem` crua.

#### 13. `/pos-venda`
- **Pergunta:** carteira ativa, NPS, churn histórico, contratos vencendo em 90 dias, MRR por família.
- **Parâmetros:** nenhum (retrato de agora).
- **Gate:** `getCtx` apenas, sem restrição de papel (a lista nomeia clientes e MRR).
- **Tabelas:** `contratos`, `leads`, `nps_respostas`; `cliente_receita_mensal`/`assinaturas` via
  `mrrOficialLinhas` e `medir`.
- **Funções:** `medir("mrr_atual")`, `medir("clientes_ativos")`, `mrrOficialLinhas`.
- **Resposta:** `mrr_total_ativo`, `contratos_ativos`, `clientes_ativos`, `nps_medio`,
  `nps_total_respostas`, `nps_distribuicao{detratores,neutros,promotores}`, `churnRate`,
  `contratosVencendo[]` (lista), `mrrPorTipo[]` (composição por família).
- **Consumidor:** `TabPosVenda.tsx:25`.
- **Equivalente:** parcial. `mrr_atual` (dimensão `familia`), `clientes_ativos`; churn real:
  `mrr_cancelado` / `logos_cancelados` (só Stripe). Sem equivalente: NPS, contratos vencendo.
- **Defeitos de base:** `churnRate` = `status='cancelado'` / total de contratos e ignora
  `status='churned'` (medido: 2 `cancelado` e 20 `churned` de 446, logo 0,45% mostrado contra 4,9% se
  somasse). `mrrResult.mrrTotal` é calculado e nunca usado.

#### 14. `/tracking`
- **Pergunta:** o funil (lead, qualificado, oportunidade, ganho, MRR) por campanha, source, medium e
  origem, com custo e ROAS quando a campanha é Meta.
- **Parâmetros:** `periodo` (padrão `all`). O comentário do código cita `?desde=`, mas o código só lê
  `periodo`.
- **Gate:** `isAdminView` (travado por `api-server/seguranca-api.test.ts:43`).
- **Tabelas:** `leads`, `negocios`, `assinaturas` (via `doCrm`), `pontos_contato`; **Meta ao vivo**.
- **Funções:** nenhuma de `lib/relatorios/`; SQL inline (`funilPor(dim)` x 4) e `doCrm`.
- **Resposta:** `periodo`, `totalLeads`, `leadsRastreados`, `atribuicao{mrrTotal,mrrAtribuido,
  clientesTotal,clientesAtribuidos,pctAtribuido}`, `porCampanha[]`, `porSource[]`, `porMedium[]`,
  `porOrigem[]` (cada linha: `leads,qualificados,clientes,mrrReal,oportunidades,ganhos,taxas`, e para
  campanha Meta `gastoMeta,leadsMeta,cliquesMeta,cpl,cplq,cac,roas`), `meta{configured,totalGasto,
  totalLeads,naoCasadas[],erro}`.
- **Consumidor:** `TabMarketing.tsx:289`, `onface/campanhas/OrigemLeads.tsx:46`.
- **Equivalente:** nenhum.
- **Limitação declarada no código (:1226):** dimensiona por e-mail do lead, deixando de fora 159 dos
  1.562 negócios; e `assinaturas` ativas sem lead eram 47 (:1284). Medido aqui: 37 ativas sem lead
  (R$ 19.538,90 de R$ 62.329,56).

#### 15. `/midia-paga`
- **Pergunta:** quanto cada campanha, conjunto e criativo custou e devolveu (cohort por lead, receita
  do período por origem, ROAS de ciclo, onde estão os leads pagos agora)?
- **Parâmetros:** `periodo` (padrão `30d`).
- **Gate:** `getCtx` apenas.
- **Tabelas:** `leads`, `negocios`, `propostas`; **Meta ao vivo** em três níveis (campanha, conjunto,
  anúncio) e `getRoasCiclo` com histórico desde 2025-06-01.
- **Funções:** `getMetricasPorCampanha/Conjunto/Criativo` (`midia-paga.ts:316/381/343`),
  `agregarFunil` (:428), `gerarAlertas` (:662), `rankingPorRoas` (:447), `getStatusAtualLeadsPagos`
  (:472), `getReceitaAtribuida` (:542), `getRoasCiclo` (:586), `getPipelineAbertoPago` (:638).
- **Resposta:** `periodo`, `metaConfigured`, `funil`, `porCampanha[]`, `porConjunto[]`,
  `porCriativo[]`, `ranking{Campanhas,Conjuntos,Criativos}[]`, `alertas[]`, `statusAtual[]`,
  `receitaAtribuida{linhas,receitaTotal,receitaPaga,...}`, `roasCiclo[]`, `pipelineAberto`.
- **Consumidor:** `TabMidiaPaga.tsx:267`.
- **Equivalente:** nenhum. Receita atribuída usa fórmula própria desatualizada (D9).

#### 16. `/faturamento-categoria`
- **Pergunta:** de que o time vendeu (mensalidade x setup) mês a mês e por pessoa?
- **Parâmetros:** `periodo`, `safra` (validada).
- **Gate:** `getCtx` apenas. `porPessoa` traz nome e valor de cada closer/SDR para qualquer papel.
- **Tabelas:** `negocios`, `usuarios`.
- **Funções:** constantes SQL `VALOR_MRR_VENDIDO`, `VALOR_NAO_RECORRENTE_VENDIDO`,
  `VALOR_TOTAL_VENDIDO` (`receita-fechada.ts:29-69`).
- **Resposta:** `periodo`, `safra`, `periodoEfetivo`, `series[{mes,mrr,setup,total,negocios}]`,
  `porPessoa[{nome,mrr,setup,total,negocios}]`, `negociosSemValor`, `fonte`.
- **Consumidor:** `FaturamentoCategoria.tsx:55` (dentro de `TabComercial`, com seleção de barra que
  altera o período global).
- **Equivalente:** parcial. `faturamento_competencia` e `receita_setup/avulsa/uso` respondem
  "faturamento por competência", que é outra pergunta (planilha de faturamento), não "booking por
  data de ganho". Faltaria composição MRR x setup x avulso em `booking_ganho` e dimensão pessoa.

#### 17. `/fechado-mensal`
- **Pergunta:** ganhos, MRR fechado e perdidos por semana.
- **Parâmetros:** `periodo` (opcional; sem ele, últimas `semanas`), `safra`, `semanas`/`meses`
  (clamp 1 a 52).
- **Gate:** `getCtx` apenas, sem escopo por papel (o próprio front admite: "a rota não escopa por
  papel", `InsightsOnface.tsx:268`).
- **Tabelas:** `negocios` (ganhos, `ganho_at`), `oportunidades` (+ `negocios`) (perdas, `perdido_at`).
- **Resposta:** `periodo`, `safra`, `periodoEfetivo`, `semanas`, `series[{wk,mes,ganhosAi,mrrAi,
  perdidos,...}]` (colunas `Pabx`/`Outros`/`fat*` sempre 0, resíduo), `fontes`.
- **Consumidor:** `TabComercial.tsx:153`, `InsightsOnface.tsx:274` (gráfico semanal do hero).
- **Equivalente:** parcial. Ganhos por semana: `booking_ganho` (série), mas valor e contagem de
  outra conta (D3). Perdidos por semana: `oportunidades_perdidas` (mesma fonte, `perdido_at`). O MRR
  fechado não existe no catálogo.

#### 18. `/sdr-esteira`
- **Pergunta:** a esteira de pré-vendas funciona: contato, qualificação, reuniões, SLA, quem qualificou,
  parados, inbound x outbound?
- **Parâmetros:** `periodo` (padrão `30d`).
- **Gate:** `getCtx`; em personal view só `porResponsavel` e `qualificacoesPorResponsavel` são
  filtrados e `baseParada` é nulo. `funil`, `reunioes`, `sla`, `origem` continuam da organização
  inteira (o hero da SDR já contorna lendo só `porResponsavel[0]`).
- **Tabelas:** `leads`, `negocios`, `usuarios`, `status_changes`, `reunioes`.
- **Funções:** `getEsteiraSdr` (`esteira-sdr.ts:38`), `getVisoesSdr` (`sdr-visoes.ts:127`),
  `contarReunioes` (`funil-eventos.ts:49`), `ESTAGNADO_DIAS` = 7.
- **Resposta:** `funil[]`, `desqualificado`, `estagnados`, `estagnadosFlag`, `estagnadosParados`,
  `estagnadoDias`, `qualificandoAtual`, `novosLeads`, `totalEsteira`, `trabalhados`, `taxaContato`,
  `taxaQualificacao`, `reunioes`, `reunioesClosers`, `porResponsavel[]`, `qualificadosDetalhe`,
  `qualificacoesPorResponsavel[]`, `sla`, `slaFunil`, `origem`, `baseParada`.
- **Consumidor:** `TabSdr.tsx:130`, `InsightsOnface.tsx:326` (`HeroSdr`).
- **Equivalente:** nenhum. Há `razao conversao_lead_oportunidade`, que NÃO é a taxa de qualificação.

#### 19. `/fechamento-comercial`
- **Pergunta:** o que o Financeiro precisa para fechar o mês: vendas ganhas com evidência de
  pagamento, agendas realizadas por SDR, vendas atribuídas a SDR.
- **Parâmetros:** `periodo` (padrão `mes_passado`); filtros `closerId`, `sdrId`, `familia`,
  `empresaId` (não validados; aplicados em memória por `aplicarFiltrosFechamento`).
- **Gate:** `isAdminView` ou `leitor`.
- **Tabelas:** `negocios`, `leads`, `empresas`, `usuarios`, `contratos`, `propostas`, `assinaturas`,
  `faturas`, `status_changes`.
- **Funções:** `listarVendasFechadas` (`fechamento-comercial.ts:110`), `listarAgendasRealizadas`
  (:304), `listarVendasAtribuidasSdr` (:375), `decomporVenda`.
- **Resposta:** `periodo`, `filtrosAplicados`, `opcoes{closers,sdrs,familias,empresas}`,
  `resumo{totalVendido,totalAvulso,quantidadeVendas,porCloser,porSdr,vendasCom*}`, `vendas[]`,
  `agendas[]`, `atribuidas[]`.
- **Consumidor:** `components/onface/insights/TabFechamento.tsx:79`. Estado dos filtros: `useState`,
  morre no reload.
- **Equivalente:** nenhum. Faltaria registrar as três listas como métricas EVENT com drill por
  registro, e as sondas de evidência (Stripe, Zoho, comprovante).

#### 20. `/fechamento-comercial/export`
- **Pergunta:** a mesma coisa, em planilha .xlsx de três abas com link do comprovante.
- **Parâmetros e gate:** idênticos a #19. Reusa as mesmas funções (garante que tela e planilha batem).
- **Consumidor:** `TabFechamento.tsx:149`; link direto na Biblioteca
  (`biblioteca/[id]/page.tsx:155`).
- **Equivalente:** nenhum. O `/metricas/:codigo/exportar` do catálogo exporta **CSV de uma métrica**,
  não xlsx de três abas com evidência.

## 3. Os componentes de `components/crm2/relatorios/`

"Persistência" = onde vive o estado do filtro. **URL** = sobrevive a reload e link colado. "Local"
= `useState`, morre no reload. Só o shell de Insights grava na URL, e só estes parâmetros:
`aba`, `periodo`, `safra` (somente na aba comercial), `familia` e `janela` (somente executivo)
(`InsightsOnface.tsx:130-143`).

| Componente | Endpoint(s) | Blocos | Filtros próprios | Persistência |
|---|---|---|---|---|
| `TabComercial` (550 l.) | `/comercial`, `/fechado-mensal`, `/equipe`; embute `FaturamentoCategoria` (`/faturamento-categoria`) | alertas; insights de meta; `MetaProgress`; KPIs (receita, ticket, win rate, ciclo, qualificados); pipeline (2 KPIs + explorador por etapa + esfriando + cobertura de valor); donuts de motivos de perda e mix recorrente x avulso; barras MRR por semana e ganhos x perdidos por semana; tabela Desempenho por Vendedor | `periodo` (prop), `safra` (`safraLocal` + prop) | `periodo` e `safra`: URL no shell de Insights. Na Biblioteca só `periodo`; `safra` é local |
| `TabComercialCloser` (167) | `/comercial`; `/api/metas/usuario/:id` | `MetaProgress`, lista Fechados no período, funil Meu funil, motivos, esfriando | `periodo` (prop) | URL (`periodo`) |
| `TabSdr` (469) | `/sdr-esteira` | alertas; KPIs de reuniões; funil de pré-qualificação; Quem qualificou (tabela); SLA (3 KPIs); Velocidade e origem (inbound x outbound); Base parada (tabela); Por SDR (tabela) | `periodo` (prop) | URL (`periodo`) |
| `TabGrowth` (325) | `/growth` | KPIs; leads por canal; funil de 6 KPIs + conversão do pipeline; receita; pipeline por etapa; esfriando; time (SDR e closers); `MetaProgress`; alertas | `periodo` (prop) | URL (`periodo`) |
| `TabMarketing` (711) | `/marketing`, `/tendencias?tipo=leads`, `/tracking` | hero de 6 KPIs; gráfico de leads por dia; leads por canal; funil de pré-vendas; funil de vendas; CPL por campanha (tabela); performance por criativo (tabela); tracking por campanha, origem, source, medium | `periodo` (prop). Sem filtro próprio | URL (`periodo`) |
| `TabMidiaPaga` (451) | `/midia-paga`; embute `MetaCapiObservabilidade` (`/meta-capi-saude`) | alertas; KPIs; jornada do cohort (funil); saúde da CAPI; onde estão agora (funil); receita por origem; ROAS de ciclo; 3 rankings; tabelas campanha e conjunto com expansão; diagnóstico de atribuição | `periodo` (prop); `abertos` (linhas expandidas, local); CAPI: alternância eventos/motivos (local) | `periodo`: URL. O resto morre no reload |
| `TabPosVenda` (81) | `/pos-venda` | 4 KPIs; distribuição de NPS; MRR por tipo; contratos vencendo | nenhum | n/a. O seletor de período do shell nem aparece (a aba mostra "Carteira atual") |
| `TabAtividadeTime` (269) | `/atividade-time`, `/atividade-time/:u/:dia` | grade pessoa x dia (14 dias); drawer com o feed do dia | `selecionado` (pessoa+dia, local) | Morre no reload. Janela fixa de 14 dias, sem seletor |
| `FaturamentoCategoria` (205) | `/faturamento-categoria` | barras empilhadas por mês; tabela por pessoa | seleção de barra: chama `aoSelecionarPeriodo` (muda o `periodo` global) | via `periodo` (URL) |
| `MetaCapiObservabilidade` (102) | `/meta-capi-saude` | KPIs; barras por evento; barras por motivo | `visao` (local) | Morre no reload |
| `ComercialPipelineExplorer` (88) | recebe `etapas` de `/comercial` | barras por etapa | `medida` (valor/contagem) e `selecionado` (local) | Morre no reload |
| `AlertasCard` (54), `MetaProgress` (134) | recebem dados dos pais | alertas heurísticos; barra de meta | nenhum | n/a |
| `PeriodSelector` (116), `kit.tsx`, `charts/` | sem endpoint | seletor segmentado; `Stat`, `Secao`, `ChartCard`, `DonutChart` | n/a | n/a |

Tabs do shell novo que ainda dependem de endpoint legado (`components/onface/insights/`):

| Componente | Endpoint | Blocos | Filtros | Persistência |
|---|---|---|---|---|
| `TabFechamento` (233) | `/fechamento-comercial` (+export) | sub-abas Vendas/Agendas/Atribuídas; chips por closer; 4 selects (closer, SDR, família, empresa) | `periodo` (prop), `closerId`, `sdrId`, `familia`, `empresaId`, `sub` | `periodo`: URL. Os quatro selects e a sub-aba: **local, morrem no reload** |
| `BlocoGestao` (108) | `/gestao` | tabela tempo por etapa; tabela conversão por origem; tabela tarefas vencidas | `periodo` (prop) | URL (`periodo`). Só aparece embaixo da aba Comercial |
| `TabQualidadeDados` (175) | `/qualidade` | cartões de integridade, drawer de detalhe | nenhum | n/a |
| `HeroComercial` / `HeroSdr` (em `InsightsOnface`) | `/comercial`, `/fechado-mensal`, `/sdr-esteira` | hero com 6 KPIs e gráfico semanal | `periodo`, `safra` | URL |

Observações:
- Chaves devolvidas e **nunca lidas**: `/comercial` (`metaEscopo`, `periodoEfetivo`, `pipelineMrr`,
  `motivosPerda`), `/fechado-mensal` (colunas `ganhosPabx`, `mrrPabx`, `fatStripe`, etc.),
  `/tendencias` (`tipo=negocios` e `mrr`), todo o `/resumo` e o `/snapshot-diario`.
- `TabComercial` não desenha `funilConversao`; só `TabComercialCloser` desenha.
- Nenhum `Tab*` tem teste. Nenhuma das funções de `lib/relatorios/` que alimentam SDR, gestão,
  mídia paga, funil por evento, fechamento ou performance tem teste (grep por nome em `*.test.*`:
  zero arquivos para `getVisoesSdr`, `getEsteiraSdr`, `contarReunioes`, `getTempoPorEtapa`,
  `getConversaoPorOrigem`, `getTarefasVencidasPorPessoa`, `getMetricasPorCampanha`,
  `getReceitaAtribuida`, `getRoasCiclo`, `listarVendasFechadas`, `getPerformance`, `getFunilConversao`,
  `getCicloMedio`). Têm teste: `meta-capi-saude`, `receita-fechada`, `pipeline-fonte-unica`,
  `comercial-qualificacao`, `cobertura`, `calendario-sp`, `insights-narrativa`, `sdr-insights`.
  `sdr-insights.ts` (e `.test.ts`) estão **sem commit** no momento e `resumoMarco` não está ligado a
  nada ainda.

## 4. Capacidades da camada antiga sem equivalente no catálogo

Para cada uma: onde mora, tabelas, e cobertura **medida** (banco local, org Callface, janela
01/07/2026 a 21/10/2026, salvo indicação).

### 4.1 Resultado por pessoa (closer e SDR)
- **Onde:** `/equipe` (rota :281), `getFechadoPorResponsavel` (`comercial.ts:336`),
  `getPerdidosPorResponsavel` (`funil-eventos.ts:100`); tabela "Desempenho por Vendedor".
- **Tabelas:** `negocios`, `status_changes`, `leads`, `atividades`, `usuarios`.
- **Cobertura:** só há 2 usuários ativos com papel `closer`; `CLOSER_EXTRA_IDS` (`lib/metas-shared.ts:50`)
  acrescenta Jenifer Matos, que tem papel `gerente`. Não medi o preenchimento de
  `negocios.responsavel_id`. Ganhos desde o go-live: 173 (negócios) e 176 (oportunidades), 3 de
  diferença entre as duas fontes que a mesma tela usa.
- **Por que não migra sozinho:** o catálogo não tem dimensão `responsavel`.

### 4.2 Tempo por etapa do pipeline
- **Onde:** `getTempoPorEtapa` (`gestao-operacional.ts:34`).
- **Tabelas:** `status_changes` (para_status mapeado para 4 etapas por `ETAPA_DO_STATUS`), `negocios`
  (`etapa`, `etapa_desde`).
- **Cobertura medida:** 1.332 negócios têm evento em `status_changes` de 1.645 (81%);
  `negocios.etapa_desde` preenchido em 1.479 (90%). Resultado real: entrada 316 passagens encerradas
  (mediana 0,7 d), diagnóstico 136 (6,5 d), proposta 180 (3,9 d), negociação 115 (3,7 d). Parados agora:
  30, 15, 56 e 6 negócios (medianas de 17,5 a 37,4 dias). Só 107 negócios estão em uma das 4 etapas;
  166 estão com `status='ativo'` sem etapa e ficam fora (mesmo critério do catálogo).
  Tem massa suficiente para ser confiável.

### 4.3 SLA de primeiro contato
- **Onde:** `getVisoesSdr` -> `slaFunil` (`sdr-visoes.ts:127`, query G); `consultarQualidadeDados` ->
  `slaQualidade` (coorte 7 dias).
- **Tabela:** `leads.created_at`, `leads.primeiro_contato_at` (gravado por `registrarPrimeiroContato`).
- **Cobertura medida: baixa e em queda.** 419 de 1.547 leads desde o go-live têm
  `primeiro_contato_at` (27,1%). Por mês: jul 256/523, ago 89/537, set 71/304, out 3/183. Último valor
  gravado: 09/10/2026. Consequência no relatório: "sem contato" = 1.128 leads, o mais antigo há
  2.695 h. Esse número é em grande parte **ausência de captura**, não ausência de contato (o campo
  `leads.last_contact_at` existe em 746 leads, 48%). O SLA calculado (mediana 14,9 h, p90 327 h,
  n=419) vale só para quem tem o marco.

### 4.4 Conversão por origem canônica
- **Onde:** `getConversaoPorOrigem` (`gestao-operacional.ts:89`) + `origemCanonica`
  (`lib/vendas/origem-canonica.ts`).
- **Tabelas:** `leads` (`origem`), `negocios` (por `lead_id`).
- **Cobertura medida:** `leads.origem` vazia em 211 de 1.547 (13,6%), que a função rotula "Sem origem".
  Mídia Paga 987 leads (4,0% a ganho), Site 81 (18,5%), Manual 50 (64%), Outbound 103, etc.
- **Observação:** é uma taxonomia diferente da de `getLeadsPorCanal` (D6).

### 4.5 Tarefas vencidas por pessoa
- **Onde:** `getTarefasVencidasPorPessoa` (`gestao-operacional.ts:119`).
- **Tabelas:** `tarefas`, `usuarios`.
- **Cobertura medida:** 360 tarefas (209 `a_fazer`, 151 `concluida`; zero `declinada`). 185 das 209
  abertas têm prazo (88,5%). Resultado: 184 vencidas, de 5 pessoas (a maior, 114 de 115 abertas, a
  mais antiga há 90 dias). O dado existe, mas quase toda tarefa aberta está vencida, o que sugere
  que as pessoas não fecham tarefa, não que o relatório erre.

### 4.6 Esforço por pessoa e dia (atividade do time)
- **Onde:** `/atividade-time` e drill-down; duplicado em `performance.ts`.
- **Tabelas e cobertura medida (por tabela, desde o go-live):**

| Fonte | Linhas | Com autor/usuário | Cobertura |
|---|---|---|---|
| `ligacoes` | 6.078 | 3.070 | 50,5% (VOICEMAIL 635 não mapeado em `CALL_STATUS_LABEL`) |
| `whatsapp_mensagens` saída | 18.902 | 1.008 | **5,3%** |
| `notas` | 3.964 | 2.154 | 54,3% |
| `status_changes` | 4.391 | 3.043 | 69,3% |
| `tarefas` concluídas | 151 | 151 | 100% |

  O grid soma linhas **com** usuário; metade das ligações e 95% das mensagens de saída não são
  atribuídas a ninguém. Nos últimos 14 dias: 265 ligações, 114 notas, 807 mensagens, 147 mudanças de
  etapa, 2 tarefas concluídas (volume total, antes de atribuir).
- **Conclusão:** a capacidade é real, o dado que a alimenta é fraco. Migrar sem corrigir captura de
  `enviado_por_id` entrega um relatório que parece preciso e não é.

### 4.7 Funil de conversão por evento
- **Onde:** `getFunilConversao` (`comercial.ts:394`), `getFunilVendasEventos`
  (`funil-eventos.ts:134`).
- **Tabela:** `status_changes` (eventos por negócio ou lead).
- **Cobertura medida:** 4.391 eventos desde o go-live, 31 valores distintos de `para_status`
  (inclui legados como `qualificado`, `oportunidade`, `nutricao`). O funil devolvido: Entrada 458,
  Diagnóstico 353, Proposta 260, Negociação 173, Ganho 173. O piso "quem ganhou passou por todas as
  etapas" iguala Negociação ao Ganho; é conserto de coerência, não medida.

### 4.8 Ciclo médio (lead cai no CRM até ganho)
- **Onde:** `getCicloMedio` (`comercial.ts:254`), `CICLO_LEAD_ATE_GANHO`.
- **Tabelas:** `negocios.ganho_at`, `leads.created_at` (fallback `negocios.created_at`).
- **Cobertura:** `negocios.lead_id` existe nos ganhos; não medi a taxa de fallback.

### 4.9 Esteira de SDR (funil de pré-qualificação, quem qualificou, base parada)
- **Onde:** `getEsteiraSdr` (`esteira-sdr.ts:38`), `getVisoesSdr` (`sdr-visoes.ts:127`).
- **Tabelas:** `leads` (`sdr_status`, `responsavel_id`, `last_contact_at`, `origem`), `negocios`
  (`origem_qualificacao`), `status_changes`, `reunioes`, `usuarios`.
- **Cobertura medida (go-live a hoje):** 1.547 leads na coorte. Esteira: novo 335, em contato 481,
  qualificando 109, qualificado 346, desqualificado 269, estagnado 7. Qualificados via reunião 254,
  direta 88. Quem qualificou: Mayra Schincariol 208, Mayara Anjos 72, Jenifer Matos 57 (papel
  `gerente`), Agente SDR (IA) 4, Scott 1. Base parada all-time: 2.458 leads, dos quais 1.533 em
  "Novo" há mais de 30 dias. `negocios.origem_qualificacao` nulo em 373 de 1.645 (o código usa
  proxy "existe reunião" para esses).
- **Observação de papel:** `porResponsavel` filtra `role='sdr'` (3 usuários); quem qualifica de fato
  é, em sua maioria, `closer`/`gerente`. A tabela "Por SDR" e a tabela "Quem qualificou" contam
  populações diferentes.

### 4.10 Reuniões por evento (agendadas, realizadas, no-show, comparecimento)
- **Onde:** `contarReunioes` (`funil-eventos.ts:49`).
- **Tabela:** `status_changes` (`reuniao_agendada`, `no_show` e o conjunto "pós-call").
- **Cobertura medida (go-live a hoje):** agendadas 331, realizadas 352, no-show 65, compareceram 240
  (72,5%). "Realizadas" (qualquer etapa após a entrada) pode passar de "agendadas" porque não é
  coorte; a taxa de comparecimento é a coorte.
- **Contradição de fonte:** a tabela `reunioes` tem 343 linhas (todas depois de 01/07) e 208 com
  `status='realizada'` (32 realizadas em set/2026 contra 78 reuniões criadas em set). O código diz que
  `reunioes.status` "nunca é atualizado" (`funil-eventos.ts:4`, `routes/relatorios.ts:781`); nesta base
  isso já não é verdade. Valeria reabrir a decisão de usar `status_changes`.

### 4.11 Atribuição e custo de mídia (Marketing, Mídia paga, Tracking, CAC do Growth)
- **Onde:** `/marketing`, `/midia-paga`, `/tracking`, `/growth` (`aquisicao.midia`); `midia-paga.ts`
  inteiro (697 linhas); `lib/integrations/meta-insights.ts`.
- **Tabelas:** `leads` (`utm_*`, `meta_campaign_id`, `meta_ad_id`, `origem`), `negocios`, `propostas`,
  `assinaturas`, `pontos_contato`; gasto **somente** pela Graph API da Meta, em cada requisição, sem
  cache e sem tabela de gasto. A aba Marketing dispara ao menos 4 chamadas à Meta por abertura (campanha e
  anúncio em `/marketing`, campanha de novo em `getMetricasPorCampanha`, campanha em `/tracking`), e a
  Mídia paga mais quatro (campanha, conjunto, anúncio e `getRoasCiclo`, esta cobrindo desde
  2025-06-01).
- **Cobertura medida (leads desde o go-live, n=1.547):** `utm_campaign` em 1.025 (66,3%), `utm_source`
  1.133, `utm_medium` 1.120, `utm_content` 890, `meta_campaign_id` 928 (60%), `origem` vazia 211
  (13,6%); `origem='Mídia Paga'` 986 (63,7%). `pontos_contato`: 4.270 linhas, 1.644 com `campaign`.
- **Não medi:** gasto e leads da Meta (externo).

### 4.12 Saúde do Meta CAPI
- **Onde:** `consultarSaudeCapi` (`meta-capi-saude.ts:45`).
- **Tabela:** `meta_capi_entregas`.
- **Cobertura medida:** **6 linhas**, 07/10 e 08/10, todas entregues (QualifiedLead 4, Lead 2). Dado
  ainda em implantação.

### 4.13 Fechamento comercial com evidência
- **Onde:** `fechamento-comercial.ts` (391 linhas) e `/export`.
- **Tabelas:** ver ficha #19.
- **Cobertura:** o próprio código registra que `leads.agenda_closer_id` tem 0% de preenchimento e que
  "quem foi SDR" só se reconstrói por `status_changes`. Não medi a cobertura de comprovante Stripe/Zoho
  por venda. É o relatório que o Financeiro usa todo mês.

### 4.14 Snapshot diário (histórico)
- **Onde:** `calcularSnapshotDiario`; tabela `metricas_diarias`.
- **Cobertura medida:** 4 linhas (06/10 a 09/10). Sem consumidor de tela. É a única fonte de
  histórico diário de pipeline e MRR Stripe, mas hoje está praticamente vazia.

### 4.15 NPS, contratos vencendo, churn histórico (Pós-venda e Growth)
- **Onde:** `/pos-venda`, `/growth.retencao`.
- **Tabelas:** `nps_respostas`, `contratos`.
- **Cobertura medida: zero.** `nps_respostas` tem 0 linhas (respondidas: 0). Contratos ativos com
  `vencimento` entre hoje e +90 dias: 0; 406 de 424 contratos ativos (96%) não têm `vencimento`.
  O "churn" calculado só conta `cancelado` e ignora `churned` (D12).
- **Conclusão:** capacidade existente e **sem dado**. Perde-se pouco.

### 4.16 Filtro de safra (CRM nativo x Zoho migrado)
- **Onde:** parâmetro `safra` em `/comercial`, `/faturamento-categoria`, `/fechado-mensal`
  (`negocios.zoho_id IS NULL`).
- **Cobertura medida:** dos 173 ganhos desde o go-live, 101 são nativos e **72 (42%) são migrados**.
  O padrão da tela é `nativo`, então a visão de hoje exclui quase metade dos ganhos pós-go-live. O
  catálogo não tem a dimensão e `booking_ganho` conta todos (176).

### 4.17 Outras
- **Alertas e insights heurísticos** do Comercial/Growth/SDR/Mídia: derivados no front ou por
  `gerarAlertas` (`midia-paga.ts:662`) e `lib/insights`. Os alertas do catálogo
  (`lib/metricas/alertas.ts`) cobrem outro conjunto (faturas fora da planilha, MRR em risco,
  estagnadas, meta, churn).
- **Pipeline esfriando por inatividade (>= 5 dias)** (`getPipelineEsfriando`, `comercial.ts:495`):
  lê `negocios.updated_at`; o catálogo só tem a marca manual `estagnado_em`.
- **Cobertura de valor por etapa** (`getCoberturaValorPorEtapa`, :539): o catálogo expõe o
  `preenchimento` das métricas de pipeline, mas não o percentual por etapa.
- **Leads por canal normalizado** (`getLeadsPorCanal`): CASE próprio sobre `utm_medium` e `origem`.
- **`/relatorios/performance`:** `performance.ts` (213 linhas) já é uma terceira camada, independente
  dos 20 endpoints. Sobrevive ao desligamento deles, mas duplica a lógica de esforço e usa a régua de
  reuniões da meta da SDR (`lib/metas.ts`).

## 5. Redundâncias e divergências

Quando comparei dois números, usei a mesma janela e o mesmo banco. IDs `D1...D12`.

### D1. Janela de período: confirmado, e não é só o `/comercial`
`periodWindow` (`routes/relatorios.ts:77`) chama `parsePeriodo` (`lib/relatorios/periodo.ts:28`). **Todos**
os endpoints com período usam essa janela (via `periodWindow`, ou chamando `parsePeriodo` direto, como
`/tracking`, `/fechamento-comercial` e o export). Nenhum usa `janelaDoPeriodo` (`lib/metricas/janela.ts`). Medido em 21/10/2026 (UTC):

| Período | Legado `[de, ate)` | Canônico `[de, ate)` |
|---|---|---|
| `mes_atual` | 01/10 03:00 a **agora** (16:25) | 01/10 03:00 a **22/10 03:00** (fim de hoje) |
| `30d` | **agora - 30d** (21/09 16:25) | **início de hoje - 30d** (22/09 03:00) |
| `90d` | agora - 90d | início do dia - 90d |
| `12m` | 01/07/2026 (**piso go-live; 365 d clampados**) | 01/11/2025 (12 meses de calendário) |
| `tudo` | **cai em 30 dias** (21/09 a 21/10) | 01/03/2021 |
| `ano_atual` | **cai em 30 dias** | 01/01/2026 |
| `mes_passado` | 01/09 a 01/10 (igual) | 01/09 a 01/10 |

Consequência: o mesmo rótulo na tela devolve linhas diferentes; e `tudo`/`ano_atual` pedidos ao
legado voltam sem erro com 30 dias. O piso 01/07 é aplicado globalmente no legado; o catálogo aplica
piso por métrica (`booking_ganho` 01/07/2026, `meta_booking` 01/06/2026). O `page.tsx` do Insights
(`PERIODO_OK`) não aceita `ano_atual` nem `tudo` por esse motivo.

### D2. MRR: `contratos.mrr` x `mrrOficialLinhas`: confirmado, com ressalva
Medido: `contratos` ativos = 424, soma de `mrr` = **R$ 389.290,64**; `mrr_atual` = **R$ 478.822,89**
(diferença de R$ 89.532,25, 18,7%). Onde `contratos.mrr` ainda é lido:

| Local | O que lê |
|---|---|
| `/resumo` :143-151 | **delta** do MRR (o total já vem de `mrr_atual`) e o total para personal view |
| `/tendencias?tipo=mrr` :252 | série de MRR por `contratos.inicio` |
| `/growth` :771 e :778 | contagem de contratos ativos e MRR dos "vencendo em 60 dias" |
| `/pos-venda` :1045 e :1111 | contagem, `mrrTotal` (calculado e não usado) e MRR dos "vencendo" |
| `lib/financeiro/metricas.ts` :109-113 | `totalContratado`, **deduplicado por assinatura Stripe**, rotulado como "contratado" (o total oficial vem de `mrrOficialLinhas`) |

Ressalva: a afirmação "o `/growth` lê `contratos.mrr`" vale só para `retencao.*`, não para o MRR do
topo, que já é `mrr_atual`. O mesmo vale para `financeiro/metricas.ts`: o total já é oficial.

### D3. Booking/fechado: `negocios` com `VALOR_*` x `oportunidades.valor` (NOVA)
O fechado do legado (`getFechadoPeriodo`) soma MRR + setup + avulso via `VALOR_*`
(`receita-fechada.ts:29-69`), em `negocios`. O `booking_ganho` do catálogo soma `oportunidades.valor`.
Setembro/2026 (`mes_passado`), mesma contagem de ganhos (49):
- legado: **R$ 52.387,21** (recorrente 12.892,21 + avulso 39.495,00);
- catálogo: **R$ 91.357,21**.

Reflexo na meta (mesma meta de R$ 50.000, 2 closers): `metaComercial` do legado dá realizado
R$ 52.387,21 (104,8%); `atingimento_meta_booking` do catálogo dá **182,7%**. O número vai de "bateu
a meta" a "quase o dobro" só por trocar de camada. É a divergência com maior impacto de decisão.
O mesmo vale para `ticket_medio_booking` x `getTicketMedio`.

### D4. Pipeline ponderado: probabilidade fixa x probabilidade da oportunidade (NOVA)
`getPipelineAtual` pondera por `STAGE_PROB` fixo (`comercial.ts:56`: 10/25/50/70%). `pipeline_ponderado`
pondera por `oportunidades.probabilidade`. Medido: legado **R$ 7.204,68**; catálogo **R$ 0**,
porque 0 das 110 oportunidades abertas têm `probabilidade`. Sem decisão sobre qual regra vale, o
número some na migração.

### D5. "Qualificado" tem cinco definições (NOVA)
Leads/oportunidades de setembro/2026, medidos direto no banco:

| Onde | Definição | Valor |
|---|---|---|
| `getLeadsQualificados` (Comercial, Growth, Marketing, Mídia paga, hero) | leads distintos com **negócio criado** na janela | 112 |
| `getEsteiraSdr` (aba SDR) | lead **criado** na janela, não desqualificado, com negócio | 80 |
| `/equipe` e CPQ/CPC do `/marketing` | `leads.sdr_status = 'qualified'` (`/marketing` também aceita `negocio_ativo_id`) | 45 |
| `/tracking` | `sdr_status IN ('qualifying','qualified')` | 88 |
| Catálogo `oportunidades_criadas` | oportunidades criadas na janela (não é lead) | 166 |

O hero de `/marketing` diz "Qualificados 112" ao lado do funil de pré-vendas "Qualificado 80" na mesma
aba (a legenda do funil já avisa). O catálogo tem `conversao_lead_oportunidade` (oportunidades
criadas por lead novo) que não é nenhuma das cinco.

### D6. Duas taxonomias de origem/canal (NOVA)
`getLeadsPorCanal` (`canais.ts`: CASE sobre utm_medium/origem) alimenta Marketing e Growth;
`origemCanonica` alimenta o `/gestao`. Mesma janela:
- `getLeadsPorCanal`: Orgânico 71, Email 22, Direto 27, Site 18, Outbound 81. `origemCanonica`:
  Instagram 29, RD Station 22, Direto 4, Site 81, Outbound 103 (absorve `apollo`), Orgânico 1. Os
  rótulos "Não definido" e "Sem origem" têm os mesmos 211 leads, mas "Site" varia de 18 para 81 e
  "Direto" de 27 para 4.

`leads_novos` (catálogo) expõe `origem` crua (uma terceira visão).

### D7. Win rate (confirmado, pequeno)
Legado: ganhos pela data de decisão em `oportunidades`, **filtrando** `origem_negocio='novo'`; set/2026:
48 ganhos, 90 perdidos, 34,8%. Catálogo: sem esse filtro: 49 e 90, 35,3% (`amostraMinima` 20).
Divergência de definição, pequena em valor.

### D8. Contagem de abertas (menor)
`pipeline.negociosAbertos` 110 x `oportunidades_abertas` 107: o catálogo exclui marcadores `[QA...` por
padrão (`recorte.ts`), o legado não filtra teste nenhum. O valor é igual (R$ 17.598,30) porque os 3
testes têm valor zero. 168 oportunidades abertas (R$ 265.164,15) estão **sem etapa** e ficam fora dos
dois (decisão de 05/10 documentada no catálogo).

### D9. Receita atribuída à mídia: fórmula pré-correção (NOVA, com dinheiro)
`getReceitaAtribuida` (`midia-paga.ts:542`) e `getRoasCiclo` (:586) somam
`CASE WHEN tipo_receita IN ('avulso','projeto') THEN valor_total ELSE mrr_fechado END`, que é a
régua anterior à decisão de que White Label não tem recorrência (commit f7635293). Medido nos
ganhos desde o go-live: essa fórmula dá R$ 184.002,38; ela **inclui o MRR de White Label (cerca de
R$ 73 mil que a régua canônica zera) e omite R$ 67,7 mil de setup**. Consequência: ROAS e receita
paga inflados. O `/tracking` usa outra régua (MRR de assinatura Stripe) e o `/marketing`
`hero.receitaAtribuida` usa a da mídia paga. Há então três ROAS na mesma família de abas.

### D10. "Cliente" e "venda" na atribuição
`/tracking`: `clientes = ganhos` via junção por e-mail; `/marketing`: `cpc` usa `leads.tipo='cliente'`;
`/midia-paga`: `vendas` = negócio ganho por coorte de lead; `/growth`: `cac` = gasto / **todos** os
ganhos do período (não só os de mídia). Quatro respostas a "quanto custa um cliente".

### D11. Reuniões: `status_changes` x tabela `reunioes` (NOVA)
Ver 4.10. Duas fontes, com uma delas hoje parcialmente preenchida (208 realizadas), e a premissa de
que a tabela "nunca é atualizada" documentada no código já não vale nesta base.

### D12. Defeitos isolados achados no caminho
- `/pos-venda` `churnRate` ignora `churned` (4.15).
- `/tendencias?tipo=negocios` devolve `perdidos: 0` fixo; `/fechado-mensal` devolve colunas mortas.
- `/atividade-time`: janela UTC x `date_trunc` na sessão do banco (ficha #7).
- `/atividade-time/:usuarioId/:dia`: data impossível passa na regex e vira 500.
- `/tendencias`, `/marketing`, `/midia-paga`, `/pos-venda`, `/faturamento-categoria`, `/fechado-mensal`
  não têm gate de papel; a Biblioteca anuncia `gestao` ou `admin` para boa parte dessas abas. O front
  esconde, a API entrega. Em `/faturamento-categoria` e `/pos-venda` isso expõe valores por pessoa e
  por cliente a closer e SDR.
- `/resumo`, `/snapshot-diario` e partes de `/comercial` e `/tendencias` não têm consumidor.

## 6. O que se perde se desligarmos hoje

Ordem: do que mais doeria perder para o que menos. Critério: uso real e recorrente, decisão que depende
dele, existência de substituto parcial, e se o dado tem cobertura para sustentar. Os números de
cobertura vêm da seção 4.

1. **Fechamento comercial com evidência e planilha .xlsx** (#19, #20). O Financeiro fecha o mês com
   ele. Nenhum substituto, nenhuma métrica equivalente, requisito explícito de exportação idêntica à
   tela. O dado existe (vendas, contratos, faturas, Stripe e Zoho) e a cobertura de comprovante não
   foi medida. Perda imediata e visível.
2. **Resultado por pessoa** (#6 + tabela "Desempenho por Vendedor" e `getFechadoPorResponsavel`). É o
   que o gestor usa para cobrar gente. O catálogo não tem dimensão de responsável e a página de
   Performance cobre só parte, com outra régua. Atenção: a escolha entre `negocios` e `oportunidades`
   (D3) muda o número de cada pessoa.
3. **Esteira de pré-vendas** (#18: funil, quem qualificou, reuniões por evento, SLA, base parada,
   inbound x outbound). A meta da SDR depende das reuniões por evento. Cobertura mista: reuniões e
   qualificações boas (4.9, 4.10); SLA de primeiro contato fraco (27% de captura). Sem equivalente e
   sem testes, então reimplementar exige reaprender as regras da auditoria de 22/07.
4. **Marketing, Mídia paga, Tracking e o CAC do Growth** (#12, #14, #15, #11). É onde se decide
   investimento em mídia. Dependem de gasto da Meta ao vivo e de UTM (66% dos leads), sem tabela local
   de gasto. Sem equivalente. Parte do que mostram já está errado (D9, D10); desligar elimina o erro e
   a capacidade juntos.
5. **Funil por evento, ciclo médio e "esfriando"** do Comercial (`getFunilConversao`,
   `getCicloMedio`, `getPipelineEsfriando`; aba do closer inclusive). Responde "onde os negócios
   morrem" e "o que está parado". O catálogo só tem a marca manual `estagnado_em`. Dado sólido
   (4.391 eventos).
6. **Gestão do funil** (#10): tempo por etapa, conversão por origem e tarefas vencidas. Dado sólido
   (tempo por etapa) e razoável (origem 86% preenchida); sem equivalente. Fica menos doloroso porque
   é uma seção embaixo da aba Comercial.
7. **Composição do booking por mês e por pessoa** (#16): mensalidade x setup x avulso por mês de
   ganho. A arquitetura nova separa faturamento por competência de booking, mas o booking com
   composição por tipo e pessoa não existe lá.
8. **Filtro de safra** (nativo x Zoho migrado). 42% dos ganhos pós-go-live são migrados; a tela abre
   em "CRM nativo" e a migração para o catálogo muda o total exibido sem aviso.
9. **Atividade do time** (#7 e #8). Capacidade real e relevante, mas o dado que a sustenta é fraco
   (5% das mensagens de saída e 50% das ligações sem autor). Parte do valor já vive em
   `/relatorios/performance`, que sobrevive ao desligamento. Perda moderada; o que se perde é o feed do
   dia e a matriz pessoa x dia.
10. **Qualidade dos dados** (#1). Sem equivalente além de sondas de preenchimento por métrica. Valor
    alto para a migração (é o instrumento que acusa o que falta), mas ele já existe como aba do shell
    novo, então a decisão é só de qual rota alimenta.
11. **Histórico diário (snapshot)** (#2). Hoje vazio (4 linhas) e sem tela. Perde-se a promessa, não
    um dado que alguém use. Se for descartado, descartar também o worker e a tabela de uma vez, e
    registrar que pipeline e MRR Stripe não têm histórico reconstruível.
12. **Saúde do Meta CAPI** (#3). 6 linhas, em implantação. Útil quando a integração estabilizar, hoje
    de pouco uso.
13. **Pós-venda: NPS, contratos vencendo e churn histórico** (#13). Sem dado (0 respostas de NPS, 0
    vencendo, 96% dos contratos sem vencimento) e churn calculado errado. O MRR e os clientes ativos
    dessa aba o catálogo já entrega.
14. **`/resumo` e `/tendencias` (negocios/mrr).** Sem consumidor. Desligar não tira nada de tela.

O que **não** se perde ao desligar: MRR atual, clientes ativos, pipeline aberto, leads novos,
oportunidades criadas e perdidas (com motivo), win rate, meta e atingimento, faturamento por competência,
faturas fora da planilha, MRR em risco e cancelado. Cuidado: parte desses números **muda de valor** ao
trocar de camada (D3, D4, D7, D8).

### Pré-requisitos antes de qualquer desligamento

1. Decidir a régua oficial de booking: `negocios` + `VALOR_*` ou `oportunidades.valor` (D3). Meta e
   atingimento dependem disto.
2. Decidir a definição única de "qualificado" (D5) e a de "origem/canal" (D6).
3. Adicionar ao catálogo a dimensão `responsavel` (mínimo: `booking_ganho`, `oportunidades_criadas`,
   `oportunidades_perdidas`) e a de `safra` (ou decidir descartá-la).
4. Ligar a captura que está faltando: `leads.primeiro_contato_at` (parou em 09/10),
   `whatsapp_mensagens.enviado_por_id`, `ligacoes.usuario_id`.
5. Corrigir antes de migrar (não migrar bug): receita atribuída à mídia (D9), `churnRate` (D12), gates
   (D12).
6. Tirar os consumidores externos de `lib/relatorios/` (seção 1: Carol, pipeline-crm2, command-center,
   snapshot, financeiro/metricas, Biblioteca, Next `/qualidade`) ou mover as funções que eles usam.
7. Reexecutar as medições da seção 4 em produção (`callface_crm_mz`).
