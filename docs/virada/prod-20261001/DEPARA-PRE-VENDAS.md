# De/Para Pré-vendas — produção → ONFACE canônico

> Medido em produção (`callface-crm-postgres`, banco `callface_crm`) em 01/10/2026.
> **Somente leitura.** Nada foi escrito em produção.
> Export bruto: `pre-vendas-prod-20261001.csv` (1.632 leads `tipo='lead'`, todas as
> colunas + negócio ativo + entidade empresa + responsável).

## 1. O que o board de produção mostra hoje

A tela `crm.callface.io/pre-vendas` não lê uma coluna de etapa. Ela **deriva** a
coluna de `leads.sdr_status` combinado com o status do negócio ativo
(`SDR_STAGES` em `lib/crm/pipeline.ts:193`). Conferido linha a linha:

| Coluna da tela | Como é derivada | Medido em prod |
|---|---|---|
| Outbound (colapsada) | `origem='outbound'` e ainda intocado | 0 |
| Novo | `sdr_status='pending'` | 58 |
| Em Contato | `sdr_status='contacted'` | 492 |
| Follow up | `sdr_status='qualifying'` **+ negócio `no_show` volta pra cá** | 195 + 29 = 224 |
| Qualificado | `sdr_status='qualified'` espelhado pelo status do negócio | 72 |
| Reunião Realizada | espelho de `negocios.status` | 70 |
| **"716 no funil"** | soma de Em Contato + Follow up | **716** |

Fora do funil: 592 desqualificados, 47 `sdr_sem_retorno`, 3 `sdr_sem_interesse`,
2 `sdr_retomar_depois`.

**Consequência para a virada:** a etapa não existe como dado em produção. Ela é
recalculada a cada render. No canônico ela vira fato gravado
(`aquisicoes.etapa_id`), então a tradução tem que acontecer na carga, uma vez.
Esse tradutor já existe: `backfill/06b-estado-pre-vendas-legado.ts`.

## 2. A tabela-deus e as cinco casas

`leads` em produção tem **113 colunas** e mistura cinco coisas distintas. O
canônico já separa:

| Casa canônica | O que guarda |
|---|---|
| `pessoas` | identidade humana (nome, e-mail, telefone, cargo) |
| `empresas` | identidade jurídica |
| `aquisicoes` | o processo de pré-vendas (etapa, responsável, datas, motivo) |
| `pontos_contato` | atribuição (origem, UTM, Meta ads) |
| `oportunidades` | o negócio |

## 3. De/Para por coluna

Legenda do destino: **VAI** direto · **MUDA DE CASA** · **ACUMULA** (dois campos
viram um, com precedência) · **LIXO** (zero linhas ou valor constante).

### 3.1 VAI — identidade humana → `pessoas`

| Coluna em prod | Preenchidas /1632 | Destino |
|---|---|---|
| `nome` | 1632 | `pessoas.nome` |
| `email` | 1625 | `pessoas.email` |
| `telefone` | 1578 | `pessoas.telefone` |
| `cargo` | 1497 | `pessoas.cargo` |
| `sobrenome` | 1370 | `pessoas.sobrenome` |
| `whatsapp` | 23 | `pessoas.whatsapp` |
| `linkedin` | 55 | **sem casa** — `pessoas` não tem a coluna. Decisão pendente. |
| `avatar_url` | 0 | LIXO |

### 3.2 ACUMULA — empresa (o caso que o Kauã levantou)

Este é o caso "o lead não tem empresa mas a conversão dele tem". Medido:

| Situação | Leads |
|---|---|
| tem `empresa_id` (entidade real) | 1.056 |
| sem `empresa_id`, mas com `leads.empresa` em texto | **467** |
| sem nenhum dos dois | 109 |
| …desses 109, com negócio vinculado | 5 |

O board legado resolve com `l.empresa || entidade` (`routes/leads.ts:439`). O
canônico lia só a entidade — por isso 576 cards apareciam como "Empresa não
informada". **Regra: `COALESCE(empresas.nome, leads.empresa)`**, mesma
precedência do legado. Aplicada, 576 → 109.

Decisão já tomada (23/09): **não criar as 467 entidades `empresas` a partir do
texto.** Boa parte é ramo de atividade, não razão social ("Venda de Alimentos",
"Autônomo"), e a base já foi poluída assim antes.

| Coluna | Preenchidas | Destino |
|---|---|---|
| `empresa_id` | 1056 | `aquisicoes.empresa_id` |
| `empresa` (texto) | 1468 | fallback de exibição, **não vira entidade** |
| `empresa_cnpj` | 24 | `empresas.cnpj` quando houver entidade |
| `empresa_cidade` | 23 | `empresas` |
| `empresa_setor` | 23 | **1 único valor distinto** → sem informação |
| `empresa_estado` | 1632 | **1 único valor distinto** → LIXO (constante) |
| `empresa_porte` | 0 | LIXO |

### 3.3 MUDA DE CASA — processo → `aquisicoes`

| Coluna em prod | Preenchidas | Destino |
|---|---|---|
| `sdr_status` | 1632 | `aquisicoes.etapa_id` via De/Para do 06b |
| `origem` | 1632 | `aquisicoes.origem` + `pontos_contato.source` |
| `responsavel_id` | 1628 | `aquisicoes.responsavel_id` |
| `last_contact_at` | 673 | `aquisicoes.last_touch_at` |
| `contato_desde_at` | 427 | `aquisicoes.first_touch_at` |
| `primeiro_contato_at` | 421 | idem — **dois campos para o mesmo fato, precisa precedência** |
| `motivo_perda` | 89 | `aquisicoes.motivo_desqualificacao` |
| `motivo_perda_detalhe` | 45 | idem, concatenado |
| `negocio_ativo_id` | 245 | `oportunidades` (backfill 07) |
| `lead_score` | 1632 | **sem casa no canônico** — decisão pendente |

**De/Para das etapas** (aprovado pelo Kauã em 17/08, já implementado):

```
pending, outbound                         → novo
contacted                                 → em_contato
qualifying                                → qualificacao
qualified, m_qualified, m_reuniao,
m_convertido                              → qualificado
disqualified                              → desqualificado
sdr_sem_retorno, sdr_sem_interesse,
sdr_retomar_depois                        → nutricao   ⚠ decisão aberta
```

### 3.4 MUDA DE CASA — atribuição → `pontos_contato`

| Coluna | Preenchidas | Observação |
|---|---|---|
| `utm_source` | 1457 | real |
| `utm_medium` | 1452 | real |
| `utm_campaign` | 1396 | real |
| `utm_content` | 1168 | real |
| `utm_term` | 1144 | real |
| `meta_campaign_id` | 786 | **só 3 valores distintos** — pobre, mas real |
| `meta_ad_id` / `meta_adset_id` | 782 | real |
| `ip_address` / `user_agent` | 780 | real |
| `gclid`, `gbraid`, `wbraid`, `fbclid`, `fbc`, `fbp`, `event_id`, `landing_page`, `lp_url` | **0** | LIXO — tracking que nunca gravou |

### 3.5 LIXO — 49 colunas com zero linhas, mais 8 constantes

Nenhuma delas carrega um fato. Agrupadas por origem:

| Grupo | Colunas | Preenchidas |
|---|---|---|
| Enriquecimento Apollo | `apollo_id`, `apollo_seniority`, `apollo_headline`, `apollo_photo_url`, `apollo_city`, `apollo_state`, `apollo_country`, `apollo_departments`, `apollo_employment_history`, `apollo_likely_engage`, `enriched_at` | 0 |
| Diagnóstico CIPA | `cipa_score`, `cipa_diagnostico`, `cipa_pagespeed`, `screenshot_url`, `pagespeed_report_url`, `analysis_notes` | 0 |
| Social | `twitter`, `github`, `facebook`, `instagram` | 0 |
| Tracking de clique | `gclid`, `gbraid`, `wbraid`, `fbclid`, `fbc`, `fbp`, `event_id`, `landing_page`, `lp_url` | 0 |
| Pós-venda dentro do lead | `cliente_desde`, `convertido_at`, `proximo_nps`, `nps_score`, `contrato_tipo`, `contrato_vencimento`, `contrato_vence_em` | 0 |
| Qualificação que nunca foi usada | `num_usuarios_ti`, `servicos_interesse`, `modelo_preferido`, `concorrente_atual`, `como_conheceu` | 0 |
| Indicação | `indicado_por`, `indicado_por_lead_id` | 0 |
| Dinheiro no lead | `valor_total`, `mrr_estimado`, `mrr_fechado`, `valor_setup`, `valor_projeto` | 0 (vive em `negocios`) |
| Cadência outbound | `outreach_channel`, `outreach_started_at`, `next_followup_at` | 0 |
| Outros | `pipedrive_id`, `insumo_comercial`, `agenda_closer_id`, `canonical_lead_id`, `identity_confidence`, `identity_evidence` | 0 |

**Constantes — parecem preenchidas, mas têm um único valor distinto em 1.632 linhas:**
`empresa_estado`, `empresa_setor`, `enrich_status`, `num_filiais`,
`renovacao_alertada`, `status`, `tipo_receita`, `whatsapp_nao_lidas`.

### 3.6 Contatos — o lixo da integração Zoho

Dos **2.098** registros `tipo='contato'` em produção:

| Origem | Registros | Com `zoho_id` | Com e-mail | Com telefone |
|---|---|---|---|---|
| `ZohoDesk` | 1.058 | 1.058 | 853 | 325 |
| `(null)` | 542 | 542 | 397 | 324 |
| `migracao_zoho` | 95 | 0 | **0** | **0** |
| demais origens | 403 | — | — | — |

**1.695 de 2.098 (81%) vêm do Zoho.** Os 95 `migracao_zoho` não têm e-mail nem
telefone — são linhas sem nenhum meio de contato.

## 4. Decisões abertas

1. **`linkedin` (55) e `lead_score` (1.632)** não têm casa no canônico.
2. **`sdr_sem_retorno` (47)** vai para `nutricao` ou `desqualificado`.
3. **Contatos Zoho (1.695)** entram no ONFACE, entram marcados, ou ficam fora.
4. **As 49 colunas vazias** são dropadas na carga ou carregadas vazias.
5. **`primeiro_contato_at` x `contato_desde_at`** — qual tem precedência como
   `first_touch_at`.
