# Insights 2.0 — arquitetura funcional

Documento-raiz do módulo. Diz o que o Insights é, como se divide e onde cada peça mora.
Atualizado: 2026-10-21.

| Quer | Abra |
|---|---|
| O catálogo de métricas e a fonte de verdade de cada número | [01-CATALOGO-METRICAS.md](./01-CATALOGO-METRICAS.md) |
| Os contratos das APIs analíticas | [02-CONTRATOS-API.md](./02-CONTRATOS-API.md) |
| Relatórios por domínio: o que existe, falta ou é redundante | [03-RELATORIOS.md](./03-RELATORIOS.md) |
| O modelo de Performance (pessoas e equipes) | [04-PERFORMANCE.md](./04-PERFORMANCE.md) |
| Matriz de testes e QA | [05-TESTES.md](./05-TESTES.md) |
| Estado da execução, pendências e roadmap | [06-ESTADO.md](./06-ESTADO.md) |
| O que a camada antiga faz e o catálogo ainda não | [inventario-camada-legada.md](./inventario-camada-legada.md) |

---

## 1. O que o Insights é

A plataforma de inteligência de negócio do ONFACE. Responde, com dado auditável, como a Callface
está indo, por que mudou e o que exige decisão — e deixa chegar do número ao registro que o compõe.

**A regra que governa tudo:** a mesma métrica, com os mesmos parâmetros, dá o mesmo número em
qualquer superfície. Onde a fonte não sustenta um número, aparece a lacuna com o motivo — nunca um
zero que pareceria um fato.

## 2. Divisão em três destinos

| Destino | Rota | Finalidade | Unidade de trabalho |
|---|---|---|---|
| **Visão Geral** | `/relatorios` | Cockpit executivo. Decisão estratégica em uma tela, com exploração progressiva. | O painel inteiro, numa requisição |
| **Relatórios** | `/relatorios/biblioteca` | Biblioteca por domínio. Cada relatório tem a própria experiência de análise. | Um relatório = um recorte explorável |
| **Performance** | `/relatorios/performance` | Gestão cotidiana de pessoas e equipes. | Uma pessoa ou um time, por papel |

Performance fica **fora** de Relatórios de propósito: sua finalidade é gestão de gente, não análise
de negócio, e seu controle de acesso é diferente (cada um vê o seu; gestão vê o time).

### Os oito domínios da biblioteca

1. Financeiro e Receita · 2. Comercial · 3. Pré-vendas · 4. Clientes e Retenção ·
5. Marketing e Growth · 6. Operação e Atendimento · 7. IA e Telefonia · 8. Qualidade dos Dados

### De-para: as 10 abas de hoje → os 8 domínios

As 10 abas de hoje são `ABAS_GESTAO` em `app/src/components/onface/insights/InsightsOnface.tsx:47`
— um array literal, não um registry, com roteamento por `useState` e URL apenas espelhada.

| Aba de hoje | Vai para | Observação |
|---|---|---|
| Executivo | **Visão Geral** (deixa de ser aba) | já consome o catálogo |
| Fechamento | Financeiro e Receita | |
| Comercial | Comercial | |
| Pré-vendas | Pré-vendas | |
| Pós-venda | Clientes e Retenção | |
| Marketing, Growth, Mídia paga | Marketing e Growth | **três abas viram um domínio** |
| Atividade do time | Operação e Atendimento **e** Performance | precisa ser separado: esforço por pessoa é Performance; fila e atendimento é Operação |
| Qualidade dos dados | Qualidade dos Dados | |
| — | **IA e Telefonia** | **domínio novo, sem fonte ligada hoje** |

**Dois pontos que precisam de decisão sua** (ver §7): a fusão de Marketing/Growth/Mídia paga, e o
domínio IA e Telefonia, que depende de acesso ao banco do Callface AI.

## 3. As duas camadas de dados, e por que uma morre

| | **Catálogo** (`lib/metricas/`) | **Pré-catálogo** (`lib/relatorios/` + 20 endpoints) |
|---|---|---|
| Fonte de verdade | `definir()`: valor e drill derivam do **mesmo** recorte | SQL ad-hoc por endpoint |
| Card = soma do detalhe | garantido por construção, com teste | não existe |
| Filtro não suportado | `FiltroNaoSuportado` → 422 | ignorado em silêncio |
| Janela | `[de, ate)` em São Paulo, piso por métrica | `until = now`, clamp global no go-live |
| Estado honesto | `disponivel \| parcial \| indisponivel \| nao_aplicavel` + motivo | ausência vira zero |
| Cobre hoje | 26 métricas, 4 razões, 5 alertas | 20 endpoints, 8 abas |

A camada pré-catálogo não é refatorada: ela é **substituída domínio a domínio**, e cada endpoint só
é desligado quando a capacidade equivalente existe no catálogo e tem teste. O inventário do que ela
sabe fazer está em [inventario-camada-legada.md](./inventario-camada-legada.md).

### Por que razão e alerta não entram no catálogo

`definir()` só sabe `sum(valor)` e `count(*)` — é isso que torna a aditividade verdadeira por
construção. Razão (win rate, conversão, % de meta) quebraria a trava, então mora em
`lib/metricas/derivadas.ts`, derivada de duas métricas catalogadas, com amostra mínima e
denominador zero devolvendo `null` com motivo. Alerta é **métrica + limiar versionado** em
`lib/metricas/alertas.ts`, nunca texto gerado: cada alerta aponta a métrica que o prova.

## 4. Camadas do módulo

```
Postgres
  └─ lib/metricas/            catálogo, razões, alertas, janela, recorte, composição do painel
       ├─ catalogo.ts         definir(): recorte único → valor, drill, série, composição, CSV
       ├─ derivadas.ts        razões (não cabem no catálogo)
       ├─ alertas.ts          métrica + limiar versionado
       ├─ janela.ts           [de, ate) em America/Sao_Paulo, piso por métrica
       ├─ painel-geral.ts     composição do cockpit
       └─ painel-geral-tipos.ts   tipos puros, importáveis por Client Component
  └─ api-server/routes/
       ├─ relatorios-metricas.ts  GET /:codigo e /:codigo/exportar
       ├─ relatorios-painel.ts    GET /painel (zod, 400 com os campos)
       └─ relatorios.ts           os 20 ad-hoc, a aposentar
  └─ components/onface/
       ├─ insights/           Visão Geral
       ├─ relatorios/         explorador de métrica, hook, formatação
       └─ ds/                 Design System: gráficos, DataGrid, gaveta
```

**Regra de fronteira:** regra de negócio mora em `lib/`, nunca em componente. Client Component não
importa módulo que importa `db` — por isso os tipos do painel estão num arquivo separado e a
política de receita tem a parte pura em `lib/relatorios/receita-fechada-shared.ts`.

## 5. Sistema de filtros

Cada métrica **declara** os filtros que suporta. Filtro pedido e não suportado devolve 422 com a
frase do porquê — nunca é ignorado em silêncio. Todo recorte é serializável em querystring e
sobrevive ao reload; o servidor emite a querystring do drill pronta, e a tela nunca remonta um
recorte (é isso que garante que cartão, barra do gráfico e CSV mostrem o mesmo conjunto).

Dimensões-alvo, por ordem de prontidão:

| Filtro | Estado |
|---|---|
| Período (presets + intervalo personalizado) | presets prontos; **intervalo personalizado e comparação explícita faltam** |
| Comparação com período anterior equivalente | pronto no catálogo (`comparacao` + `serieAnterior`) |
| Família de serviço | pronto |
| Dados de teste dentro/fora | pronto |
| Responsável, equipe | parcial — existe em alguns endpoints legados, não no catálogo |
| Origem, canal, campanha | existe como dimensão de `leads_novos`; não como filtro |
| Pipeline, etapa, status | existe nos legados; não no catálogo |
| Organização | sempre do servidor, nunca do cliente |

## 6. Regras que não se quebram

- Toda leitura filtra `organizacao_id` vindo do servidor.
- Janelas `[início, fim)` em `America/Sao_Paulo`. Nunca `until = now`.
- Dado ausente **nunca** vira zero.
- Nada de `drizzle-kit push`; schema muda só por migration nova e idempotente.
- Migration aplicada não se edita.
- Lógica financeira não mora em componente React.
- Nenhum indicador é declarado correto sem evidência medida.
- Correção em dado real: só com diagnóstico, simulação, trilha reversível e autorização.

## 7. Decisões de negócio pendentes

Nenhuma bloqueia a fundação técnica; todas têm estado honesto implementado enquanto não há resposta.
Detalhe e números em [06-ESTADO.md](./06-ESTADO.md).

1. **Fusão Marketing + Growth + Mídia paga** num domínio só — muda navegação.
2. **Domínio IA e Telefonia** — depende do banco do Callface AI (`CALLFACE_AI_DATABASE_URL`; túnel
   `:55432` estava fechado). Sem acesso, o domínio nasce vazio.
3. **Risco de MRR** é `past_due`, `unpaid` ou os dois?
4. **Churn**: o Stripe cobre o suficiente para a Visão Geral falar de churn? Hoje são 165
   cancelamentos, sem boleto nem NF do PABX.
5. **"Recorrência confirmada"** de White Label = 3 competências seguidas é limiar proposto.
6. **Meta comparável a booking**: o banco só tem metas do tipo `mrr_fechado` (aposentado), e booking
   inclui setup — o atingimento de 117,4% está superestimado por isso.
7. **Data do booking**: `ganho_at` ou data da evidência de ganho (pagamento/assinatura)?
