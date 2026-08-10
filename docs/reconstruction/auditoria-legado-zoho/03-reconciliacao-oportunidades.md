# Reconciliação Oportunidades de Vendas (Zoho) ↔ negocios (CRM novo)

> Frente 3 de 6 da auditoria forense pós-migração (12/06/2026). **Escopo: reconciliação Deals×negocios — onde mora o ganho/perdido/churn real.** Pura investigação, zero escrita: CSV do Zoho e banco só foram lidos via `csv.DictReader` / `SELECT`.
>
> Fontes: `~/Downloads/Data_001/Data/Oportunidades de Vendas_001.csv` (1.551 linhas, utf-8-sig) e tabela `negocios` (1.104 linhas) em `postgresql://callface:callface2026dev@localhost:5432/callface_crm`. Todo ID Zoho vem prefixado `zcrm_`; usado sempre o sufixo numérico pra casar com `negocios.zoho_id`.

---

## 0. Números-chave (resumo executivo)

| Métrica | Valor |
|---|---|
| Oportunidades no Zoho | 1.551 |
| IDs Zoho duplicados dentro do próprio CSV | 0 |
| negocios no CRM novo | 1.104 (1.039 com `zoho_id`) |
| Oportunidades Zoho com `zoho_id` encontrado em `negocios` | **1.039 (67,0%)** |
| Oportunidades Zoho **sem** correspondência em `negocios` | **512 (33,0%)** |
| `negocios.zoho_id` que não existem no CSV Zoho (órfã reversa) | 0 |
| Oportunidades-evento (CHURN/UPGRADE/DOWNGRADE/RENOVAÇÃO/MIGRAÇÃO) | 244 |
| Dessas, apontam (`Oportunidade Origem`) pra negócio que hoje está `status='ganho'` no CRM | **121** |
| MRR fechado desses 121 negócios "ganho" que na verdade já sofreram um evento pós-venda | ver §2 |
| Só CHURN: negócios-origem `ganho` no CRM apesar de terem opp CHURN apontando pra eles | 45, somando **R$ 64.387,29/mês em `mrr_fechado`** (14,4% de todo o MRR "ganho" do CRM) |
| Achado estrutural novo (não estava no briefing) | **Um pipeline PT-BR legado inteiro (~516 registros, Stage "Concluído/Perdido/Contrato/Proposta Enviada/Nutrição/...") foi migrado em 0-3% dos casos — R$ ~957 mil em Montante histórico Zoho nunca chegou em `negocios`.** |

---

## 1. Padrões de nome como lógica de negócio — confirmado e ampliado

A hipótese do Kauã se confirma: o time usava o campo `Nome Oportunidade de Venda` (estrutura `EMPRESA | TIPO | DETALHE/VENDEDOR`) como campo de tipagem de evento, não só pra CHURN. Varredura de regex + análise de tokens/bigramas em caixa alta encontrou o seguinte vocabulário de eventos:

| Padrão (regex, case-insensitive) | Qtd. registros | % do total (1.551) |
|---|---:|---:|
| CHURN | 88 | 5,7% |
| UPGRADE | 87 | 5,6% |
| DOWNGRADE | 27 | 1,7% |
| RENOVAÇÃO / RENOVACAO | 29 | 1,9% |
| MIGRAÇÃO / MIGRACAO (majoritariamente "MIGRAÇÃO PARA YEASTAR", troca de hardware) | 13 | 0,8% |
| RENEGOCIAÇÃO | 1 | 0,1% |
| CONTRATO INICIAL (marcador de baseline, não é evento pós-venda) | 81 | 5,2% |
| NOVO CALLFACE (venda adicional/expansão de módulo) | 8 | 0,5% |
| **Total evento (exclui CONTRATO INICIAL/NOVO CALLFACE)** | **244** (CHURN+UPGRADE+DOWNGRADE+RENOVAÇÃO+MIGRAÇÃO+RENEGOCIAÇÃO) | 15,7% |

Não apareceu no corpus: CANCELAMENTO, DISTRATO, REATIVAÇÃO, SUSPENSÃO, EXPANSÃO, ADITIVO, TERMO — ou seja, o vocabulário de eventos do time é mais restrito do que os rótulos formais que a gente usaria hoje; tudo que não é CHURN/UPGRADE/DOWNGRADE/RENOVAÇÃO/MIGRAÇÃO provavelmente ficou sem marcação nenhuma e está diluído no bulk de oportunidades "normais".

Segmentação exata por `|` confirma a estrutura de template: `CONTRATO INICIAL` (81x), `CHURN` (80x como segmento isolado, 88x com o regex mais largo — a diferença de 8 são casos como `"CHURN PREF ..."` sem pipe isolando a palavra), `UPGRADE CALLFACE AI` (22x) + `CALLFACE AI + AGENTE` (14x) + `CALLFACE AI + AGENTE BDR` (13x) somando ao total de UPGRADE, `DOWNGRADE` (13x isolado), `RENOVAÇÃO` (9x isolado), `MIGRAÇÃO PARA YEASTAR` (9x).

### 1.1 Quantificação por padrão × cruzamento com `Oportunidade Origem.id` → `negocios.zoho_id`

| Padrão | Qtd | Com Origem preenchida | Origem existe em `negocios` | Origem NÃO existe em `negocios` |
|---|---:|---:|---:|---:|
| CHURN | 88 | 85 (96,6%) | 54 | 31 |
| UPGRADE | 87 | 61 (70,1%) | 35 | 26 |
| DOWNGRADE | 27 | 27 (100%) | 19 | 8 |
| RENOVAÇÃO | 29 | 25 (86,2%) | 19 | 6 |
| MIGRAÇÃO | 13 | 11 (84,6%) | 8 | 3 |
| RENEGOCIAÇÃO | 1 | 0 | 0 | 0 |
| **Total (5 padrões principais)** | **244** | **209** | **135** | **74** |

Confirma e refina o número que o Kauã já tinha para CHURN (85 com origem, 54 existem, 31 não existem — bate exato) e mostra que o mesmo problema estrutural se repete em UPGRADE, DOWNGRADE, RENOVAÇÃO e MIGRAÇÃO, em proporção parecida (grosso modo 60-100% tem origem preenchida; dessas, 60-70% acham o negócio no CRM novo, o resto não).

### 1.2 Stage (Zoho) de cada padrão

| Padrão | Distribuição de Stage |
|---|---|
| CHURN | Contrato: 52, Concluído: 28, Closed Lost: 7, Closed Won: 1 |
| UPGRADE | Closed Won: 38, Concluído: 25, Perdido: 8, Closed Lost: 7, Contrato: 3, demais: 6 |
| DOWNGRADE | Perdido: 8, Contrato: 6, Concluído: 6, Closed Won: 3, Closed Lost: 2, Sem Retorno: 2 |
| RENOVAÇÃO | Perdido: 8, Concluído: 8, Closed Won: 7, demais: 6 |
| MIGRAÇÃO | Concluído: 7, Contrato: 2, demais: 4 |

Ponto de atenção: a maioria dos CHURN (52/88) está em Stage **"Contrato"** — que é exatamente o Stage do pipeline legado com taxa de migração de 2,9% (ver §3.1). Ou seja, boa parte dos próprios registros de CHURN também nunca migrou — o problema é duplo: (a) o CHURN não migrou, e (b) o negócio original que ele deveria fechar também pode não ter migrado.

### 1.3 Status no CRM dos negócios-origem (quando existem)

| Padrão | Status da origem em `negocios` (quando existe) |
|---|---|
| CHURN | **ganho: 45**, perdido: 9 |
| UPGRADE | **ganho: 33**, perdido: 2 |
| DOWNGRADE | **ganho: 17**, perdido: 1, no_show: 1 |
| RENOVAÇÃO | **ganho: 19** (100% dos que existem) |
| MIGRAÇÃO | **ganho: 7**, perdido: 1 |
| **Total** | **ganho: 121 / 135 (89,6%)**, perdido: 13, no_show: 1 |

**89,6% dos negócios que tiveram um evento pós-venda documentado no Zoho (churn, downgrade, upgrade, renovação ou migração) continuam com `status='ganho'` no CRM novo — nenhum desses status reflete o que de fato aconteceu depois.** Zero desses 135 negócios está em qualquer status que sugira encerramento, redução ou mudança de contrato (não existe status tipo "cancelado"/"churned" na tabela — os 13 valores em "perdido" também são incorretos, porque "perdido" no schema atual significa proposta perdida antes de fechar, não cliente que cancelou depois de fechar).

### 1.4 Validação cronológica (evento acontece DEPOIS do negócio ter sido ganho)

Cruzando `Data de Fechamento` da opp-evento com `negocios.ganho_at` do negócio-origem (só para os 121 casos `status='ganho'`):

| Padrão | N | Evento ≥ ganho_at (ordem correta) | Evento < ganho_at (suspeito) |
|---|---:|---:|---:|
| CHURN | 45 | 44 | 1 |
| UPGRADE | 33 | 32 | 1 |
| DOWNGRADE | 17 | 16 | 1 |
| RENOVAÇÃO | 19 | 19 | 0 |
| MIGRAÇÃO | 7 | 7 | 0 |
| **Total** | **121** | **118 (97,5%)** | **3 (2,5%)** |

97,5% dos eventos têm data posterior ao `ganho_at` do negócio original — a relação causal Origem→Evento é real e cronologicamente consistente, não é ruído de dados. Os 3 casos com data invertida merecem checagem pontual (possível erro de digitação de data no Zoho), mas não mudam o quadro geral. **Confiança: alta.**

### 1.5 Impacto financeiro (CHURN, que é o mais crítico pra métrica de churn/retenção)

- Soma de `Montante` das 88 oportunidades CHURN no Zoho: **-R$ 17.715,68** (o time registrava o valor do churn como negativo — outro sinal de que o campo era usado como lógica de negócio, não só nome).
- Os 45 negócios-origem que o Zoho aponta como já churnados e que hoje estão `status='ganho'` somam **R$ 64.387,29/mês em `mrr_fechado`** (R$ 61.087,79 em `mrr_estimado`, R$ 55.244,45 em `valor_total`).
- Total de `mrr_fechado` em todo `negocios` com `status='ganho'`: **R$ 447.603,32/mês** (426 negócios, 402 com valor preenchido).
- **Isso significa que pelo menos 14,4% do MRR "ganho" hoje reconhecido no CRM já tinha sido registrado como CHURN no Zoho antes da migração.** E isso é só o pattern CHURN — sem contar downgrade (redução de MRR sem cancelamento total) nem os 31 CHURN cuja origem nem existe no CRM (não dá pra saber se o negócio original nunca migrou ou nunca foi cadastrado).

**Confiança: alta** — evidência tripla (nome do registro + origem existe e está "ganho" + data do evento é posterior ao `ganho_at`).

---

## 2. Reconciliação total das 1.551 oportunidades

### 2.1 Achado estrutural: migração parece ter sido seletiva por Stage, não por data

Cruzando `Stage` × se o `zoho_id` foi encontrado em `negocios`, o padrão é binário — cada Stage foi migrado **quase 100% ou quase 0%**, não há meio-termo:

| Stage (Zoho) | Total | Migrado p/ `negocios` | Não migrado | % migrado | R$ (Montante) não migrado |
|---|---:|---:|---:|---:|---:|
| Closed Won | 458 | 458 | 0 | 100,0% | 0 |
| Closed Lost | 278 | 278 | 0 | 100,0% | 0 |
| **Concluído** | 210 | 0 | 210 | **0,0%** | 149.583,26 |
| **Perdido** | 176 | 0 | 176 | **0,0%** | 610.437,18 |
| Quer Negociar em Outra Data | 132 | 132 | 0 | 100,0% | 0 |
| **Contrato** | 70 | 2 | 68 | **2,9%** | 5.247,70 |
| Proposal/Price Quote | 59 | 59 | 0 | 100,0% | 0 |
| Sem Retorno de Contato | 50 | 50 | 0 | 100,0% | 0 |
| **Proposta Enviada** | 27 | 0 | 27 | **0,0%** | 77.258,23 |
| Negotiation/Review | 19 | 19 | 0 | 100,0% | 0 |
| Reunião Agendada | 15 | 15 | 0 | 100,0% | 0 |
| Reunião Realizada | 12 | 12 | 0 | 100,0% | 0 |
| Value Proposition | 11 | 11 | 0 | 100,0% | 0 |
| **Nutrição** | 9 | 0 | 9 | **0,0%** | 5.408,20 |
| **Negociação/Revisão** | 8 | 0 | 8 | **0,0%** | 60.383,19 |
| **Levantamento de Escopo** | 6 | 0 | 6 | **0,0%** | 15.477,84 |
| Faturamento | 3 | 1 | 2 | 33,3% | 17.926,20 |
| Delivery AI | 3 | 1 | 2 | 33,3% | 6.884,50 |
| **Delivery PABX** | 2 | 0 | 2 | **0,0%** | 5.171,15 |
| **Ganho** | 2 | 0 | 2 | **0,0%** | 3.056,80 |
| Trava na Negociação | 1 | 1 | 0 | 100,0% | 0 |

Os Stages com 0% (ou quase) formam um vocabulário coeso e auto-consistente — **Concluído, Perdido, Contrato, Proposta Enviada, Nutrição, Negociação/Revisão, Levantamento de Escopo, Delivery PABX, Delivery AI, Faturamento, Ganho** — que parece ser um pipeline/funil paralelo ao pipeline "moderno" (Closed Won/Closed Lost/Quer Negociar em Outra Data/Proposal-Price Quote/Sem Retorno de Contato/Negotiation-Review/Reunião Agendada/Reunião Realizada/Value Proposition/Trava na Negociação), que por sua vez migrou 100%.

Verifiquei duas hipóteses alternativas e ambas caem:
- **Não é separação por `Layout.id`** — 1.527 dos 1.551 registros (98,5%) compartilham o mesmíssimo `Layout.id`, incluindo Stages dos dois grupos.
- **Não é corte por data de criação** — os 516 registros do grupo "legado" têm `Hora de Criação` de 26/12/2023 a 10/08/2026, exatamente a mesma janela dos 1.035 do grupo "moderno". Os dois convivem lado a lado ao longo de toda a história, não é um "antes/depois" de uma migração de pipeline no próprio Zoho.

**Conclusão (confiança média — mecanismo exato do script de migração não foi inspecionado, só o efeito observado nos dados):** o processo de migração 12/06/2026 aparenta ter usado uma whitelist de valores de `Stage` pra decidir o que trazer pro `negocios`, e essa whitelist simplesmente não cobria um segundo pipeline/funil inteiro que o time usava (provavelmente pra operação/backoffice/pós-venda, dado que tem "Delivery PABX", "Delivery AI", "Faturamento" nesse grupo). Isso é maior do que o problema de CHURN isolado do §1: são **516 oportunidades, R$ ~957 mil em Montante histórico, incluindo 68 negócios em Stage "Contrato" (soa como cliente ativo/contrato vigente) que hoje não têm NENHUM registro correspondente em `negocios`** — não é um status errado, é ausência total.

### 2.2 Tabela de contingência Stage(Zoho) × status(CRM) — só os 1.039 que migraram

| Stage (Zoho) \ status (CRM) | ativo | ganho | negociacao_iniciada | no_show | outra_data | perdido | proposta_apresentada | reuniao_agendada | reuniao_realizada | sem_retorno | trava_assinatura | trava_negociacao | trial | TOTAL |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Closed Lost | 0 | 0 | 0 | 0 | 0 | **278** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 278 |
| Closed Won | 52 | **405** | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 458 |
| Contrato | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| Delivery AI | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| Faturamento | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| Negotiation/Review | 0 | 1 | 13 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | 19 |
| Proposal/Price Quote | 0 | 6 | 1 | 0 | 1 | 0 | **32** | 0 | 0 | 15 | 0 | 3 | 1 | 59 |
| Quer Negociar em Outra Data | 0 | 0 | 0 | 0 | **132** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 132 |
| Reunião Agendada | 0 | 0 | 0 | 2 | 0 | 0 | 1 | **9** | 2 | 0 | 0 | 0 | 1 | 15 |
| Reunião Realizada | 0 | 0 | 2 | 0 | 0 | 2 | 1 | 0 | **7** | 0 | 0 | 0 | 0 | 12 |
| Sem Retorno de Contato | 0 | 0 | 1 | 22 | 0 | 0 | 0 | 0 | 0 | **27** | 0 | 0 | 0 | 50 |
| Trava na Negociação | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 |
| Value Proposition | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | **10** | 11 |

Leitura: a diagonal principal (em negrito) domina — quando o Stage migra, o mapeamento pra `status` é bem direto (Closed Won→ganho, Closed Lost→perdido, Quer Negociar em Outra Data→outra_data, etc). O ruído relevante:
- **Closed Won → 52 negócios com `status='ativo'`, não `ganho`** — pode ser proposital (recategorização pós-venda pra "ativo" = contrato vigente) ou pode ser outro sintoma do mesmo problema do §1 (negócio ganho que depois teve algum evento e foi reclassificado como "ativo" em vez de refletir o evento real). **Confiança média** — sem mais contexto de quando/por que `ativo` é atribuído, não dá pra afirmar que está errado.
- **Sem Retorno de Contato → 22 foram pra `no_show`** (não `sem_retorno`) — mapeamento não 1:1, mistura dois conceitos (contato que não responde vs lead que não apareceu em reunião agendada). Confiança média.
- **Reunião Realizada → 2 foram pra `perdido`** e Negotiation/Review → 2 pra `perdido` — plausível (reunião aconteceu e depois perdeu), não é evidência de erro.

### 2.3 negocios sem Oportunidade Zoho correspondente

`negocios.zoho_id` que não aparece no CSV Zoho: **0**. Todo `zoho_id` gravado no CRM novo tem uma linha correspondente no export — não há corrupção de ID nessa direção. Os 65 negócios sem `zoho_id` (1.104 − 1.039) são presumivelmente criados nativamente no CRM novo, depois da migração.

---

## 3. Duplicidade dentro do próprio Zoho

Critério pedido: mesma Empresa + mesmo Contato + Montante dentro de 5% + Data de Fechamento a até 7 dias, excluindo pares já ligados por `Oportunidade Origem` (que são eventos legítimos, não duplicidade).

**Resultado: só 3 pares candidatos, envolvendo 1 único grupo empresa+contato (`FACILITA`).**

| Opp 1 | Opp 2 | Datas | Montante | Stages |
|---|---|---|---|---|
| FACILITA \| POC 5R \| CINTHIA | FACILITA \| SETUP 182 AP \| CINTHIA | 05/03/24 → 06/03/24 | R$0 / R$0 | Concluído / Closed Won |
| FACILITA \| MEDIUM \| PREF ITUTINGA \| CINTHIA | FACILITA \| MEDIUM \| PREF ARAPONGA-MG \| CINTHIA CUNHA | 06/03/24 → 08/03/24 | R$799,90 ambos | Closed Won / Closed Won |
| FACILITA \| SMALL \| CLINICA NLM | FACILITA \| SMALL \| LN GESTÃO | 21/08/24 → 27/08/24 | R$299,90 ambos | Closed Won / Closed Lost |

Refazendo sem exigir o mesmo Contato (só mesma Empresa, pra não perder duplicidade em registros sem contato preenchido — 28% dos casos): sobem pra **5 pares, 3 empresas** (`FACILITA`, `MAIS TEC`, `MANDIC ARARAS`).

**Interpretação (confiança baixa de que sejam erro real):** nos 3 casos, o nome da oportunidade tem sufixo de localidade/cliente-final diferente (`PREF ITUTINGA` vs `PREF ARAPONGA`, `CLINICA NLM` vs `LN GESTÃO`). `FACILITA` e `MAIS TEC` aparentam ser **revendedores/franqueados** que fecham várias unidades/prefeituras distintas sob a mesma conta-empresa no Zoho — Montante igual (R$799,90, R$299,90, R$600,00) é o preço de tabela do plano, não coincidência de erro de duplicação. **Não há evidência de duplicidade operacional real relevante** — a checagem deu praticamente zero, o que é em si um resultado (a hipótese de "duplicata por erro de digitação" não se sustenta nos dados).

---

## 4. Órfãs dentro do próprio Zoho (sem Empresa ou sem Contato)

| Campo faltante | Qtd | % de 1.551 |
|---|---:|---:|
| Sem `Empresa Nome.id` | 2 | 0,1% |
| Sem `Nome Contato.id` | 437 | 28,2% |
| Sem os dois | 0 | 0% |

- As 2 sem Empresa: Stage Closed Lost e Proposta Enviada — irrelevante, baixo impacto.
- As 437 sem Contato: distribuídas por praticamente todo Stage, com peso maior em **Closed Won (150)**, **Perdido (66)**, **Concluído (81)**, **Closed Lost (64)**, **Contrato (44)**. Isso é esperado num CRM operado por planilha/pipe-no-nome — o "Contato" formal do Zoho não era preenchido com disciplina, o time confiava no nome da oportunidade e no campo Empresa. Não é exatamente uma "órfã" grave, mas explica por que qualquer reconciliação automática por Contato (inclusive a duplicidade do §3) tem baixa cobertura.

---

## 5. Síntese por nível de confiança

| Achado | Evidência | Confiança |
|---|---|---|
| 45 negócios CHURN (Zoho) apontam pra origem `status='ganho'` no CRM, com data do evento posterior ao `ganho_at` — R$64.387/mês de MRR "ativo" que na origem já era churn documentado | nome + origem existe + status + ordem cronológica (44/45 datas corretas) | **Alta** |
| O mesmo padrão se repete em UPGRADE (33), DOWNGRADE (17), RENOVAÇÃO (19) e MIGRAÇÃO (7) — total 121 de 135 negócios-evento continuam `status='ganho'` sem refletir o evento | idem, 97,5% de consistência cronológica agregada | **Alta** |
| Um pipeline Zoho inteiro (Stage "Concluído/Perdido/Contrato/Proposta Enviada/Nutrição/Negociação-Revisão/Levantamento de Escopo/Delivery/Faturamento/Ganho", 516 registros, R$~957k em Montante) foi migrado em 0-3% dos casos | tabela binária 100%/0% por Stage, não explicada por Layout.id nem por data de criação | **Média** (mecanismo de migração não inspecionado diretamente, só o efeito nos dados) |
| 74 oportunidades-evento (CHURN/UPGRADE/DOWNGRADE/RENOVAÇÃO/MIGRAÇÃO) têm `Oportunidade Origem` preenchida apontando pra um `zoho_id` que nem existe em `negocios` | contagem direta | **Alta** (o dado ausente é fato, a causa raiz — se o original nunca migrou ou nunca existiu — fica em aberto) |
| Closed Won → 52 negócios em `status='ativo'` em vez de `ganho` | contingência Stage×status | **Média** (pode ser categorização proposital de pós-venda, não necessariamente erro) |
| Duplicidade operacional por erro de digitação no Zoho é praticamente inexistente (3-5 pares, todos explicáveis por revenda multi-unidade) | busca sistemática empresa+contato+valor+data | **Alta** (de que NÃO é um problema relevante) |
| 437 oportunidades sem Contato vinculado | contagem direta | **Alta** (fato), mas **baixa** relevância como "erro" — reflete disciplina de preenchimento, não corrupção de dado |

---

## 6. Scripts e artefatos

Toda a análise foi feita em Python (`csv.DictReader`, utf-8-sig) + `psql` read-only, sem escrita em nenhuma fonte. Export intermediário usado (leitura, não persistido no repo): `negocios` → CSV via `\copy ... to` com as colunas `zoho_id, status, valor_total, mrr_estimado, mrr_fechado, ganho_at, titulo, created_at, empresa_id, lead_id`.
