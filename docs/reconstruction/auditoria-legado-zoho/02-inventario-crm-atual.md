# Inventário Técnico Completo — CRM Atual (nosso lado)

> Auditoria forense pré-reconstrução CRM 2.0. Frente: inventário técnico do banco atual.
> Fonte: espelho de produção sincronizado em 10/08/2026, via `psql` direto em
> `postgresql://callface:callface2026dev@localhost:5432/callface_crm`. Somente `SELECT`, nenhuma escrita.
> Data da coleta: 2026-08-10. Migração Zoho → CRM próprio: 12/06/2026 (referência dada pelo Kauã).

## Como ler este relatório

O banco tem 3 camadas misturadas:

1. **Migrado do Zoho** (12/06/2026) — linhas com `zoho_id` preenchido.
2. **Nativo do CRM, pós-migração** (12/06/2026 → hoje, quase 2 meses de uso real) — linhas sem `zoho_id`, criadas depois do corte.
3. **Schema novo do CRM 2.0, ainda em construção** — tabelas existem, mas têm **zero linhas**.

Cada seção abaixo indica em qual camada os dados caem.

---

## 1. Inventário completo de tabelas (`\dt` + contagem)

70 tabelas no schema `public`. Abaixo, todas com contagem real. Tabelas com **0 linhas** são schema novo do CRM 2.0 ainda sem dado real (marcadas explicitamente).

| Tabela | Linhas | Status |
|---|---|---|
| tarefas | 29.126 | dado real |
| notificacoes | 184.499 | dado real (ruído operacional, não é dado de negócio) |
| whatsapp_mensagens | 20.749 | dado real |
| leads | 3.196 | dado real |
| atividades | 6.757 | dado real |
| status_changes | 4.767 | dado real |
| negocio_leads | 1.028 | dado real (bridge negócio↔lead) |
| negocios | 1.104 | dado real |
| empresas | 1.560 | dado real |
| propostas | 1.240 | dado real |
| proposta_itens | 2.048 | dado real |
| contatos | 1.001 | dado real |
| notas | 1.515 | dado real |
| faturas | 563 | dado real |
| contratos | 319 | dado real |
| mrr_movimentos | 377 | dado real |
| cadencia_execucoes | 352 | dado real |
| assinaturas | 266 | dado real |
| servicos_catalogo | 218 | dado real (catálogo, não transacional) |
| ligacoes | 777 | dado real |
| reunioes | 167 | dado real |
| meta_lead_staging | 155 | dado real (staging Meta Ads) |
| lead_labels | 145 | dado real |
| lead_user_unread | 126 | dado real |
| emails | 419 | dado real |
| auth_tokens | 16 | dado real (sessões) |
| usuarios | 13 | dado real |
| campanhas | 18 | dado real |
| metas | 11 | dado real |
| labels | 3 | dado real |
| email_contas | 4 | dado real |
| whatsapp_sessao | 4 | dado real |
| pipelines | 2 | dado real |
| organizacoes | 1 | dado real |
| metricas_diarias | 1 | dado real |
| **ai_analysis** | 0 | **CRM 2.0 vazia** |
| **ai_sdr_config** | 0 | **CRM 2.0 vazia** |
| **ai_sdr_contato_state** | 0 | **CRM 2.0 vazia** |
| **ai_sdr_logs** | 0 | **CRM 2.0 vazia** |
| **audit_log** | 0 | **CRM 2.0 vazia** |
| **automacao_execucoes** | 0 | **CRM 2.0 vazia** |
| **automacoes** | 0 | **CRM 2.0 vazia** |
| **buscas_salvas** | 0 | **CRM 2.0 vazia** |
| **cadence_definitions** | 0 | **CRM 2.0 vazia** |
| **cadence_enrollment_events** | 0 | **CRM 2.0 vazia** |
| **cadence_enrollments** | 0 | **CRM 2.0 vazia** |
| **clientes** | 0 | **CRM 2.0 vazia** |
| **closer_bloqueios** | 0 | **CRM 2.0 vazia** |
| **closer_disponibilidade** | 0 | **CRM 2.0 vazia** |
| **comercial_evidencia** | 0 | **CRM 2.0 vazia** |
| **communications** | 0 | **CRM 2.0 vazia** |
| **contato_listas** | 0 | **CRM 2.0 vazia** |
| **custom_fields** | 0 | **CRM 2.0 vazia** |
| **email_sequencia_execucoes** | 0 | **CRM 2.0 vazia** |
| **email_sequencia_passos** | 0 | **CRM 2.0 vazia** |
| **email_sequencias** | 0 | **CRM 2.0 vazia** |
| **email_templates** | 0 | **CRM 2.0 vazia** |
| **event_outbox** | 0 | **CRM 2.0 vazia** |
| **eventos** | 0 | **CRM 2.0 vazia** |
| **lead_listas** | 0 | **CRM 2.0 vazia** |
| **negocio_labels** | 0 | **CRM 2.0 vazia** |
| **nps_respostas** | 0 | **CRM 2.0 vazia** |
| **oportunidades** | 0 | **CRM 2.0 vazia** (parece duplicar `negocios`, checar se é redundância de nomenclatura na modelagem 2.0) |
| **outreach_campanhas** | 0 | **CRM 2.0 vazia** |
| **pessoas** | 0 | **CRM 2.0 vazia** (parece duplicar `contatos`, mesmo ponto de atenção) |
| **pontos_contato** | 0 | **CRM 2.0 vazia** |
| **sdr_memory** | 0 | **CRM 2.0 vazia** |
| **teams** | 0 | **CRM 2.0 vazia** |
| **whatsapp_templates** | 0 | **CRM 2.0 vazia** |
| **won_evidence_policies** | 0 | **CRM 2.0 vazia** |

**Total de tabelas vazias (schema novo, sem dado real ainda): 28 de 70.**

Ponto de atenção pra quem for desenhar o CRM 2.0: `oportunidades` (vazia) e `pessoas` (vazia) parecem ser os nomes novos para `negocios` e `contatos` respectivamente — se for isso, a migração de dado real pra essas tabelas novas ainda não rodou.

---

## 2. Separação Zoho vs. Nativo (`zoho_id`)

Tabelas confirmadas com coluna `zoho_id`: `leads`, `negocios`, `empresas`, `contratos`, `contatos`.

| Tabela | Total | Com `zoho_id` (migrado) | Sem `zoho_id` (nativo pós-migração) |
|---|---|---|---|
| leads | 3.196 | 2.450 (76,7%) | 746 (23,3%) |
| negocios | 1.104 | 1.039 (94,1%) | 65 (5,9%) |
| empresas | 1.560 | 944 (60,5%) | 616 (39,5%) |
| contratos | 319 | **0 (0%)** | **319 (100%)** |
| contatos | 1.001 | **0 (0%)** | **1.001 (100%)** |

**Achado crítico:** `contratos` e `contatos` têm a coluna `zoho_id`, mas **nenhuma linha está preenchida**. Ou a migração nunca trouxe contrato/contato do Zoho com o vínculo de origem, ou esses dados foram recriados do zero no CRM novo sem carregar a referência. Combinado com o histograma da seção 3 (100% dessas duas tabelas criado em jul/ago 2026, nada antes), a leitura mais provável é: **contratos e contatos históricos do Zoho não foram migrados como registros rastreáveis** — o que existe hoje é 100% dado novo, gerado depois do go-live. Se havia contrato/contato anterior a 12/06 no Zoho, ele não tem contrapartida aqui.

---

## 3. Histograma de `created_at` por mês (linha do corte)

### leads
| Mês | Total | Com zoho_id | Sem zoho_id |
|---|---|---|---|
| 2023-10 | 2 | 2 | 0 |
| 2023-11 | 3 | 3 | 0 |
| 2023-12 | 68 | 61 | 7 |
| 2024-01 | 140 | 136 | 4 |
| 2024-02 | 114 | 108 | 6 |
| 2024-03 | 86 | 86 | 0 |
| 2024-04 | 73 | 69 | 4 |
| 2024-05 | 32 | 31 | 1 |
| 2024-06 | 55 | 52 | 3 |
| 2024-07 | 46 | 42 | 4 |
| 2024-08 | 43 | 41 | 2 |
| 2024-09 | 52 | 44 | 8 |
| 2024-10 | 47 | 43 | 4 |
| 2024-11 | 25 | 23 | 2 |
| 2024-12 | 20 | 19 | 1 |
| 2025-01 | 26 | 24 | 2 |
| 2025-02 | 21 | 20 | 1 |
| 2025-03 | 38 | 37 | 1 |
| 2025-04 | 33 | 30 | 3 |
| 2025-05 | 25 | 24 | 1 |
| 2025-06 | 51 | 51 | 0 |
| 2025-07 | 60 | 58 | 2 |
| 2025-08 | 48 | 44 | 4 |
| 2025-09 | 44 | 42 | 2 |
| 2025-10 | 43 | 41 | 2 |
| 2025-11 | 61 | 56 | 5 |
| 2025-12 | 29 | 20 | 9 |
| 2026-01 | 71 | 67 | 4 |
| 2026-02 | 38 | 25 | 13 |
| 2026-03 | 94 | 69 | 25 |
| 2026-04 | 264 | 244 | 20 |
| 2026-05 | 414 | 393 | 21 |
| 2026-06 | 488 | 444 | 44 |
| **2026-07** | 403 | **1** | **402** |
| **2026-08** | 139 | **0** | **139** |

Corte nítido e coerente com a data informada (12/06/2026): junho ainda é majoritariamente Zoho (444 de 488), julho já é praticamente 100% nativo (402 de 403). `created_at` preserva a data histórica original do Zoho (tem lead de 2023-10), não foi sobrescrito no import — isso é bom sinal de qualidade da migração pra essa tabela.

### negocios
| Mês | Total | Com zoho_id | Sem zoho_id |
|---|---|---|---|
| 2023-12 | 12 | 12 | 0 |
| 2024-01 | 16 | 16 | 0 |
| 2024-02 | 32 | 32 | 0 |
| 2024-03 | 28 | 28 | 0 |
| 2024-04 | 22 | 22 | 0 |
| 2024-05 | 12 | 12 | 0 |
| 2024-06 | 24 | 24 | 0 |
| 2024-07 | 33 | 33 | 0 |
| 2024-08 | 16 | 16 | 0 |
| 2024-09 | 22 | 22 | 0 |
| 2024-10 | 16 | 16 | 0 |
| 2024-11 | 8 | 8 | 0 |
| 2024-12 | 7 | 7 | 0 |
| 2025-01 | 1 | 1 | 0 |
| 2025-02 | 4 | 4 | 0 |
| 2025-03 | 5 | 5 | 0 |
| 2025-04 | 7 | 7 | 0 |
| 2025-05 | 8 | 8 | 0 |
| 2025-06 | 21 | 21 | 0 |
| 2025-07 | 33 | 33 | 0 |
| 2025-08 | 21 | 21 | 0 |
| 2025-09 | 39 | 39 | 0 |
| 2025-10 | 15 | 15 | 0 |
| 2025-11 | 32 | 32 | 0 |
| 2025-12 | 10 | 10 | 0 |
| 2026-01 | 47 | 47 | 0 |
| 2026-02 | 20 | 20 | 0 |
| 2026-03 | 33 | 33 | 0 |
| 2026-04 | 74 | 74 | 0 |
| 2026-05 | 89 | 89 | 0 |
| 2026-06 | 94 | 94 | 0 |
| **2026-07** | 234 | **234** | **0** |
| **2026-08** | 69 | 4 | 65 |

**Achado:** o corte "nativo" em `negocios` só aparece em **agosto/2026**, quase 2 meses depois do go-live de 12/06. Todos os 234 negócios criados em julho ainda têm `zoho_id`. Isso sugere que negócios continuaram sendo sincronizados/gerados com referência ao Zoho por mais tempo que leads (dual-write, job de sync residual, ou zoho_id herdado do lead pai em vez de ser gerado no próprio negócio). Vale confirmar com quem manteve o pipeline de import se havia sync incremental Zoho→negocios ainda ativo em julho.

### empresas
| Mês | Total | Com zoho_id | Sem zoho_id |
|---|---|---|---|
| 2023-10 | 3 | 3 | 0 |
| 2023-11 | 3 | 3 | 0 |
| 2023-12 | 182 | 182 | 0 |
| 2024-01 | 49 | 49 | 0 |
| 2024-02 | 38 | 38 | 0 |
| 2024-03 | 15 | 15 | 0 |
| 2024-04 | 19 | 19 | 0 |
| 2024-05 | 11 | 11 | 0 |
| 2024-06 | 13 | 13 | 0 |
| 2024-07 | 8 | 8 | 0 |
| 2024-08 | 11 | 11 | 0 |
| 2024-09 | 15 | 15 | 0 |
| 2024-10 | 9 | 9 | 0 |
| 2024-11 | 8 | 8 | 0 |
| 2024-12 | 2 | 2 | 0 |
| 2025-01 | 4 | 4 | 0 |
| 2025-02 | 4 | 4 | 0 |
| 2025-03 | 7 | 7 | 0 |
| 2025-04 | 7 | 7 | 0 |
| 2025-05 | 8 | 8 | 0 |
| 2025-06 | 26 | 26 | 0 |
| 2025-07 | 34 | 34 | 0 |
| 2025-08 | 27 | 27 | 0 |
| 2025-09 | 34 | 34 | 0 |
| 2025-10 | 13 | 13 | 0 |
| 2025-11 | 30 | 30 | 0 |
| 2025-12 | 9 | 9 | 0 |
| 2026-01 | 44 | 44 | 0 |
| 2026-02 | 19 | 19 | 0 |
| 2026-03 | 40 | 38 | 2 |
| **2026-04** | 149 | 76 | **73** |
| **2026-05** | 285 | 90 | **195** |
| **2026-06** | 278 | 88 | **190** |
| **2026-07** | 98 | 0 | 98 |
| **2026-08** | 58 | 0 | 58 |

**Achado:** diferente de `leads`/`negocios`, `empresas` já tinha volume nativo relevante **antes** do go-live formal (73 em abril, 195 em maio, 190 em junho, todas sem `zoho_id`). Ou o CRM próprio já estava em uso paralelo/piloto criando empresas antes do corte oficial de 12/06, ou o fluxo de criação de lead/negócio já criava empresa nativa mesmo em registros que vieram originalmente do Zoho (ex.: lead migrado, mas empresa vinculada criada na hora pelo sistema novo em vez de vir do Zoho). Recomendo checar isso com quem mexeu no import — é a tabela com a linha de corte menos limpa das três.

### contratos e contatos
Ambos têm **100% das linhas em julho/agosto de 2026** — nenhum registro anterior à data de corte, nenhum `zoho_id` preenchido (ver seção 2). Não há histograma "antes/depois" porque não existe "antes" nesses dados.

| Tabela | 2026-07 | 2026-08 |
|---|---|---|
| contratos | 255 | 64 |
| contatos | 858 | 143 |

---

## 4. Tabelas sem `zoho_id` mas com origem migrável esperada

Contagem total + histograma mensal, mesma lógica de "quanto é herança vs. quanto é novo" — mas aqui nenhuma tem `zoho_id` pra comparar diretamente, então o sinal é 100% o formato do histograma.

| Tabela | Total | Tem histórico pré-jul/2026? |
|---|---|---|
| atividades | 6.757 | **Sim** — dados desde 2021-02 |
| status_changes | 4.767 | **Sim** — dados desde 2023-12 |
| propostas | 1.240 | **Sim** — dados desde 2024-01 |
| proposta_itens | 2.048 | **Não** — 100% jul/ago 2026 |
| notas | 1.515 | **Não** — 100% jul/ago 2026 |
| reunioes | 167 | **Não** — 100% jul/ago 2026 |
| ligacoes | 777 | **Não** — 100% jul/ago 2026 |
| tarefas | 29.126 | **Não** — 100% jul/ago 2026 |

### atividades (histórico real, remonta a 2021-02)
| Mês | Total |
|---|---|
| 2021-02 | 1 |
| 2024-01 | 43 |
| 2024-02 | 124 |
| 2024-03 | 78 |
| 2024-04 | 196 |
| 2024-05 | 73 |
| 2024-06 | 109 |
| 2024-07 | 128 |
| 2024-08 | 109 |
| 2024-09 | 116 |
| 2024-10 | 146 |
| 2024-11 | 93 |
| 2024-12 | 44 |
| 2025-01 | 3 |
| 2025-02 | 12 |
| 2025-03 | 1 |
| 2025-04 | 4 |
| 2025-05 | 9 |
| 2025-06 | 123 |
| 2025-07 | 77 |
| 2025-08 | 64 |
| 2025-09 | 104 |
| 2025-10 | 77 |
| 2025-11 | 101 |
| 2025-12 | 47 |
| 2026-01 | 73 |
| 2026-02 | 84 |
| 2026-03 | 102 |
| 2026-04 | 244 |
| 2026-05 | 520 |
| 2026-06 | 668 |
| **2026-07** | **2.566** |
| **2026-08** | **618** |

`atividades` tem histórico real do Zoho (2021-2026), mas o volume pós go-live (jul+ago = 3.184, quase metade do total histórico acumulado em 5 anos) é altíssimo — checar se não há geração automática/duplicada de atividade no CRM novo antes de tratar esse número como "engajamento real" na reconstrução.

### status_changes (histórico real, remonta a 2023-12)
| Mês | Total |
|---|---|
| 2023-12 | 12 |
| 2024-01 | 37 |
| 2024-02 | 75 |
| 2024-03 | 56 |
| 2024-04 | 57 |
| 2024-05 | 29 |
| 2024-06 | 59 |
| 2024-07 | 75 |
| 2024-08 | 45 |
| 2024-09 | 57 |
| 2024-10 | 49 |
| 2024-11 | 21 |
| 2024-12 | 19 |
| 2025-01 | 5 |
| 2025-02 | 10 |
| 2025-03 | 13 |
| 2025-04 | 14 |
| 2025-05 | 17 |
| 2025-06 | 77 |
| 2025-07 | 79 |
| 2025-08 | 53 |
| 2025-09 | 125 |
| 2025-10 | 57 |
| 2025-11 | 79 |
| 2025-12 | 37 |
| 2026-01 | 85 |
| 2026-02 | 221 |
| 2026-03 | 99 |
| 2026-04 | 194 |
| 2026-05 | 300 |
| 2026-06 | 195 |
| **2026-07** | **2.155** |
| **2026-08** | 361 |

### propostas (histórico real, remonta a 2024-01)
| Mês | Total |
|---|---|
| 2024-01 | 36 |
| 2024-02 | 52 |
| 2024-03 | 38 |
| 2024-04 | 49 |
| 2024-05 | 24 |
| 2024-06 | 27 |
| 2024-07 | 25 |
| 2024-08 | 29 |
| 2024-09 | 35 |
| 2024-10 | 30 |
| 2024-11 | 21 |
| 2024-12 | 6 |
| 2025-01 | 12 |
| 2025-02 | 13 |
| 2025-03 | 19 |
| 2025-04 | 15 |
| 2025-05 | 16 |
| 2025-06 | 36 |
| 2025-07 | 38 |
| 2025-08 | 35 |
| 2025-09 | 52 |
| 2025-10 | 22 |
| 2025-11 | 29 |
| 2025-12 | 21 |
| 2026-01 | 29 |
| 2026-02 | 37 |
| 2026-03 | 38 |
| 2026-04 | 77 |
| 2026-05 | 91 |
| 2026-06 | 94 |
| **2026-07** | 152 |
| **2026-08** | 42 |

### proposta_itens, notas, reunioes, ligacoes, tarefas — 100% pós go-live
| Tabela | 2026-07 | 2026-08 | Total |
|---|---|---|---|
| proposta_itens | 1.988 | 60 | 2.048 |
| notas | 1.311 | 204 | 1.515 |
| reunioes | 133 | 34 | 167 |
| ligacoes | 557 | 220 | 777 |
| tarefas | 29.082 | 44 | 29.126 |

**Achado crítico #2:** `notas`, `reunioes`, `ligacoes` e `proposta_itens` não têm **nenhum** registro anterior a julho/2026. Se o Zoho tinha notas, reuniões, ligações e itens de proposta associados a negócios antigos, esse histórico **não veio na migração** — ele simplesmente não existe no banco atual. Isso é possivelmente a maior perda de informação da migração (junto com contratos/contatos da seção 2), porque são exatamente os registros que documentam o relacionamento com o cliente ao longo do tempo.

**Achado crítico #3:** `tarefas` tem 29.082 linhas criadas em um único mês (julho/2026) contra 44 em agosto e zero antes. Esse volume é desproporcional a qualquer outra tabela do sistema — muito provavelmente é geração automática (ex.: automação de cadência, tarefa recorrente, ou rotina de importação que criou tarefa por lead/negócio em massa) e não 29 mil tarefas manuais reais. Recomendo investigar a origem antes de usar esse número como indicador de atividade operacional no CRM 2.0.

---

## 5. Qualidade de dado

### Negócios "ganho" sem atividade/nota recente
- Total de negócios com `status = 'ganho'`: **426**
- Desses, quantos têm `created_at` há mais de 90 dias (ou seja, já passaram da janela toda): **282**
- Quantos **não têm nenhuma atividade nem nota** registrada nos últimos 90 dias (não importa a data de criação do negócio): **297** (≈ 70% dos ganhos)

Não é conclusão de churn — é só o sinal bruto: quase 7 em cada 10 negócios marcados como "ganho" não têm nenhum toque (atividade ou nota) registrado nos últimos 3 meses. Pode ser cliente saudável e silencioso, pode ser churn não refletido no status. Fica pra quem for desenhar o módulo de CS decidir o que fazer com isso.

### Distribuição de `status` em contratos (319 total)
| Status | Qtd |
|---|---|
| ativo | 222 |
| churned | 97 |

### Distribuição de `status` em propostas (1.240 total)
| Status | Qtd |
|---|---|
| rascunho | 504 |
| aceita | 351 |
| expirada | 307 |
| recusada | 48 |
| enviada | 30 |

504 propostas em rascunho (40,6% do total) é um volume alto — vale entender se isso é rascunho ativo de vendas em andamento ou lixo acumulado (proposta iniciada e nunca finalizada).

---

## 6. Duplicidade

### Empresas — CNPJ duplicado
- Empresas com CNPJ nulo/vazio: **769** de 1.560 (49,3% sem CNPJ cadastrado)
- Grupos de CNPJ duplicado (aparece em mais de uma linha): **6 grupos**, envolvendo **12 linhas**
- CNPJs duplicados: `12671265000109`, `51914600000104`, `38315122000140`, `00943122000111`, `26349839000123`, `42830071000161` (todos com exatamente 2 ocorrências)

### Empresas — nome duplicado (normalizado lower/trim)
- Grupos de nome duplicado: **3 grupos**, envolvendo **6 linhas**

A duplicidade de empresa em si é baixa (12-18 linhas de 1.560), mas o CNPJ ausente em quase metade da base compromete qualquer dedup mais rigorosa — duplicatas reais podem estar escondidas atrás da falta de CNPJ pra cruzar.

### Leads — telefone duplicado
- Leads com telefone nulo/vazio: **1.019** de 3.196 (31,9%)
- Grupos de telefone duplicado (normalizado, só dígitos), aparecendo em mais de um lead: **91 grupos**, envolvendo **196 linhas**
- Casos de maior repetição: `11941086153` (6x), `31999439028` (4x), **`11000000000` (4x — número placeholder/lixo, não é duplicata real)**, `85987838932` (4x), `1938295700` (4x)

Atenção ao número `11000000000`: é claramente um valor de preenchimento/dummy, não uma duplicata legítima. Qualquer rotina de dedup por telefone no CRM 2.0 precisa filtrar esse tipo de valor antes de agir.

---

## 7. Órfãos (FK ausente)

| Check | Qtd |
|---|---|
| `negocios` sem `lead_id` | **0** |
| `propostas` sem `negocio_id` | **455** (36,7% de 1.240) |
| `contratos` sem `negocio_id` | **241** (75,5% de 319) |
| `contratos` sem `lead_id` | **0** |

**Achado crítico #4:** 241 de 319 contratos (75,5%) não têm `negocio_id` — ou seja, ¾ dos contratos não estão vinculados a nenhum negócio no funil. Combinado com o achado da seção 2 (contratos 100% sem `zoho_id`, 100% criados em jul/ago), isso reforça a hipótese de que a entidade `contratos` foi recriada/populada de forma solta no CRM novo, sem religar ao negócio de origem. Isso é um problema estrutural pra reconstrução: sem `negocio_id`, não dá pra reconstituir o histórico completo negócio→proposta→contrato pra 3 em cada 4 contratos.

Também vale registrar que `propostas` tem 455 linhas (36,7%) sem `negocio_id` — mais de um terço das propostas está desconectado do funil de negócio.

---

## Resumo dos achados mais importantes

1. **Contratos e contatos (100% das linhas) não têm `zoho_id` e não têm nenhum registro anterior a julho/2026** — o histórico dessas duas entidades no Zoho, se existia, não foi trazido de forma rastreável pra cá.
2. **Notas, reuniões, ligações e itens de proposta também são 100% pós-migração** — nenhum histórico de interação com cliente anterior a jul/2026 sobreviveu nessas tabelas.
3. **75,5% dos contratos (241/319) não têm `negocio_id`** e **36,7% das propostas (455/1.240) não têm `negocio_id`** — funil quebrado pra reconstrução de histórico ponta a ponta.
4. **`negocios` só passa a criar registros nativos (sem `zoho_id`) em agosto/2026**, quase 2 meses depois do corte oficial de 12/06 — sugere sync residual com Zoho mais longo que o esperado nessa tabela.
5. **29.082 tarefas foram criadas num único mês (julho/2026)** — volume desproporcional, provável artefato de automação/importação em massa, não atividade manual real.
6. **297 dos 426 negócios "ganho" (70%) não têm atividade nem nota nos últimos 90 dias** — sinal bruto de possível blind spot de CS, não conclusão de churn.
7. **28 das 70 tabelas do banco são schema novo do CRM 2.0, ainda vazias** — inclusive `oportunidades` e `pessoas`, que parecem ser os substitutos pretendidos de `negocios` e `contatos` e ainda não receberam a migração de dado real.
8. Duplicidade direta é baixa (12-18 empresas, 196 leads por telefone), mas mascarada por dado ausente: **49,3% das empresas não têm CNPJ** e **31,9% dos leads não têm telefone**, o que limita qualquer dedup mais confiável no CRM 2.0.
