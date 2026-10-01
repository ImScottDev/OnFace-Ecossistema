# 04 — DOMAIN & DATA MODEL AS-IS (Fase 5) + insumos de Integrações (06) e Operational Reality (20)

Bancos: `callface_crm` (0090, principal), `callface_crm_pre_carga_20260920` (0050, comparação), `callface_crm_ensaio`. Auditoria 23/09/2026, somente SELECT.

## 0. ACHADO ESTRUTURAL QUE MUDA A LEITURA DE TUDO
- **[FATO] `callface_crm` foi RECRIADO hoje 23/09 01:51:42** (todas as 91 migrações com `aplicada_em` idêntico) + backfill 01:52 + seeds 02:01 + carga Meta 10:25. **NÃO é espelho fiel de produção.**
- **[FATO] `callface_crm_ensaio` = snapshot imediatamente antes da carga de 10:25** (via `_carga_contagem_antes`).
- **[FATO] Fronteira do dado real de produção = 22/09 ~22:00** (não 20/09). Tudo com timestamp de 23/09 é máquina (backfill/worker/carga Meta/smoke).
- **[FATO] O banco fresco PERDEU dados presentes no snapshot 0050 (20/09):**
  - `cliente_receita_mensal`: **12.917 → 0** (R$ 49.025.858,99 evaporaram) — e a competência jul/2026 (445.375,74) é exatamente o número que `reconciliation_runs.summary.JULY` cita. A base que sustenta o número sumiu.
  - `fulfillments` 416→26; `fulfillment_itens` 24.797→1.729; `cs_marcos` 2.114→0; `cs_riscos` 396→0; `notificacoes` 10.463→3.216; `event_outbox` 597(reais)→112(locais); `catalogo_precos` 213→55; `audit_log` 762→138; `tarefas` 554→433.
  - **WhatsApp: 12.739 mensagens presentes em 20/09 ausentes hoje** (overlap 17.832 de ~30k `uazapi_message_id`; não é dedup — é re-sync parcial com janela diferente). `communications` herda a lacuna.
- **[PENDÊNCIA CRÍTICA]** Não é possível, só com os bancos locais, saber se essas perdas ocorreram EM PRODUÇÃO ou apenas na carga local de hoje. **Exige a captura remota (entregável 09).** Até lá: essas perdas são NÍVEL 2 (evidência histórica de que o dado existiu em 20/09), não prova de perda em produção.

## A. Mapa conceito→entidade (contagens em callface_crm)
| Conceito | Canônica DE FATO | Legado/nota |
|---|---|---|
| pessoa | `pessoas` (3.986) | `contatos` (1.731) é INBOX omnichannel, não pessoa (mal nomeado); `leads` (4.066) ainda é a "pessoa" para a UI (195 arquivos) |
| empresa | `empresas` (3.105) | 59,5% sem CNPJ nem zoho_id — ver C1 |
| lead/aquisição | `leads` (4.066) | `aquisicoes` (4.066) = espelho 1:1 estéril |
| oportunidade | empate: `negocios` (1.578, dado, 147 arq.) vs `oportunidades` (1.577, casa canônica, 85 arq.) | schema comenta "negócio LEGADO" mas status é lido pelo legado/financeiro/relatórios |
| proposta | `propostas` (1.556) | `proposta_grupo_comercial*`=0 |
| contrato | `contratos` (745) comercial + `assinaturas` (357) espelho Stripe | 101 subs Stripe duplicadas em contratos |
| cliente | **NENHUMA** — 275/285/299/361 conflitam | ver E5 |
| serviço | `servicos_catalogo` (233, 23 ativos)=oferta; `servicos_canonicos` (439)=carteira | distintos |
| fatura | `faturas` (978) | `pagamentos` (582) caixa separado |
| implantação | `fulfillments` (26) | 416 em 20/09 — perda massiva |
| atividade | `atividades` (13.383) | vivo até 22/09 20:18 |
| comunicação | tabelas de canal (wa 27.096 + email 5.113 + lig 5.221) | `communications` (35.436) é projeção read-only fabricada hoje 01:52 |
| tarefa | `tarefas` (433) | única |
| evento | NENHUMA confiável | `eventos`/`vendas_eventos`=0 (morto); `domain_events`/`timeline_events` fabricados hoje |

## B. Dual-write / duplicação
- **B1 `leads`×`aquisicoes`**: espelho perfeito e VIVO (4.066=4.066, lead_legado_id 100%, created_at idêntico 4.066/4.066, zero órfão). Dual-write vivo comprovado: 54 leads de hoje 10:25 (Meta) entraram em leads+aquisicoes+pessoas (`backfill_provenance` runtime META_LEAD_ADS). **`aquisicoes` não agrega nada — custo puro.**
- **B2 `negocios`×`oportunidades`**: espelho VIVO com **deriva de valor** — `mrr_estimado≠mrr` em 27 pares, `valor≠` em 1, `ganho_at≠` em 2, 1 negócio órfão. Estrutura/etapa sincronizam, VALOR não. Dashboards que leem MRR de fontes diferentes divergem.
- **B3 `contatos`×`pessoas`**: NÃO é duplicação. Só 524/1.731 (30,3%) casam por telefone; `contatos.lead_id` em 25 (1,4%). `contatos` é inbox (canal/sessão/nao_lidas). **70% das conversas não identificadas.**
- **B4 `contratos`×`assinaturas`**: 417 casam por subscription Stripe; 260 assinaturas com contrato_id; 97 (27%) sem contrato; 408 contratos (54,8%) sem processo comercial.

## C. Órfãos e FKs lógicas (destaques; nenhum órfão referencial real — FKs íntegras)
100%: `atividades` sem empresa_id, `tarefas` sem empresa_id, `faturas` sem negocio_id. 90,3% `communications` sem empresa_id. 74,4% `contratos` sem empresa_id. 69,4% `oportunidades` sem service_family. 54,8% `contratos` sem oportunidade_id. 47,8% `propostas` sem empresa_id. 40,4% leads/aquisicoes sem empresa_id.
- **C1 [FATO] Explosão de empresas hoje**: **877 empresas criadas em 1 minuto (10:25)** a partir de texto livre `leads.empresa` (`Autônomo`×21, `Casa`, `Não trabalho`, `.`×10, `Nenhuma`). Base +40% num dia. **59,5% (1.847) sem CNPJ nem zoho_id; 38% (1.180) não referenciadas por NADA; 369 grupos de nome duplicado.** [INFERÊNCIA] job de "normalização de identidade" sem validação semântica → "empresa" deixou de ser confiável para agregação (MRR/empresa, carteira).

## D. Linhagem legada
- **[FATO] Migração Pipedrive NÃO EXISTE** — todas as colunas `pipedrive_id` 100% vazias nos dois bancos. Única linhagem real = Zoho (+ Stripe).
- zoho_id: leads 2.677, negocios 1.240, empresas 1.100, contratos 270/**265 distintos (5 duplicados)**. `contratos.codigo_legado`, `assinatura_legado_zoho`, `contatos.zoho_id`, `status_changes.zoho_id`, `proposta_itens.zoho_id`, `canonical_lead_id` = 0.
- **D2 `backfill_provenance` (10.585, 100% de hoje)**: `NAO_RESOLVIDO` = **1.094 de 1.577 oportunidades (69,4%)** sem família resolvida.
- **D3 `legacy_provenance` (5.064)**: congelado 11–12/08, rodada única (7 timestamps distintos).
- **D4 `reconciliation_runs`**: **1 rodada, 16/08**, `started_at=completed_at` (duração zero), declara `writes_inserted=45.331` mas `reconciliation_changes` tem **413 linhas (0,9%)**. Auto-inconsistente.
- **D5 `correction_change_log` (30.876 mudanças) materializado em só 434 linhas de contrato_itens.** `atividade.usuario_display_name`, `nota.autor_display_name`, `fatura.receivable_state`, `contrato.commercial_lifecycle`, `contract.service_family` = **100% NULL nos DOIS bancos**. [INFERÊNCIA] o ledger é registro de execução em OUTRO ambiente, ou revertido. **Não é prova de que as correções existem no dado.** `negocios.semantic_confidence=CONFIRMED` em 2 de 1.578.
- **D6 `catalogo_mapeamentos_legacy`**: 193, 100% `pendente` há 6 semanas (eram 318, −125).
- **D7 `reconciliacao_casos`**: 1.541, **100% OPEN**, zero resolvidos — FAMILIA_NAO_RESOLVIDA 1.094, CONTRATO_SEM_PROCESSO_COMERCIAL 408, FATURA_PAGA_SEM_EMPRESA 29.

## E. MRR / métricas conflitantes — 6 respostas
| Fonte | Valor |
|---|---|
| `servicos_canonicos` ACTIVE+MRR+portfolio (metric_catalog canônico) | **R$ 425.619,39** |
| `contratos.mrr` status=ativo | R$ 426.812,73 (+1.193,34) |
| `assinaturas.mrr` active | R$ 51.635,75 |
| `mrr_movimentos` Σ delta | R$ 81.418,35 (não reconstitui nada) |
- **[FATO] Causa do desvio dos contratos: 101 subscriptions Stripe com 2 contratos cada (202 contratos) = R$ 62.822,00 de MRR ativo contado EM DOBRO.** Em `assinaturas` não há duplicata.
- `contratos.current_recurring_value` e `commercial_lifecycle` = 100% NULL.
- **E5 "Cliente" tem 4 respostas: 275 (tabela) / 285 (leads tipo=cliente) / 299 (leads c/ contrato ativo) / 361 (empresas c/ serviço ACTIVE).** Tabela `clientes` nasceu hoje com `lifecycle_status`/`status_financeiro`/`responsavel_cs_id`/`oportunidade_origem_id` 100% NULL. `metric_catalog.clientes_ativos` documenta: 111 marcados sem contrato ativo, 124 com contrato ativo sem a marca.
- Portfólio (`current_service_portfolio`) congelado em `as_of_date=2026-08-16` (38 dias): PABX 367.601,19 (180) · CALLFACE_AI ACTIVE 34.248,80 (83) · WHITE_LABEL 2.445.
- `cs_health_snapshots`: 275, todas num batch de 0,13s — não é série temporal.

## F. OPERATIONAL REALITY (insumo do entregável 20)
Ressalva: ≤22/09 22:00 = produção; 23/09 = máquina. Tabelas com created_at reescrito pelo backfill (communications, timeline_events, domain_events, clientes, conversas...) não servem como sinal de atividade — usar campo de tempo de negócio.

- **[FATO] A operação real são 3 pessoas**: Mayra Schincariol (closer, 1.730 atividades/30d, 73 propostas), Mayara Anjos (closer, 426/30d, 42 propostas), Jenifer Matos (gerente, 167/30d). **9 de 16 usuários têm ZERO atividade histórica.** `Growth (backup)` tem 1.347 atividades históricas mas 0 nos 30d.
- Volume mensal real: ~3.000 ligações, ~11.200 WhatsApp, 118 propostas criadas, 196 negócios criados, 58 ganhos, 18 contratos.
- **[FATO] Zero contratos com `assinado_em` em 745.** Confirma a perda ZohoSign do entregável 18.
- **[FATO] Não há telemetria de login** (sem coluna `ultimo_login`, sem tabela de sessão; `auth_tokens` último uso 15/09).
- `audit_log`: só **22 linhas de produção real** (fulfillment.responsavel_alterado, 09–21/09, 2 usuários); 116 são smoke test com 109 entity_id apontando para o vazio.
- `domain_events`: 95% backfill + 51 dangling + 54 Meta reais. **Zero eventos de operação humana real.**
- `timeline_events` (14.478): `aquisicao_id` NULL 100%; cobre 0,6% das comunicações.
- `status_changes`: coexistem PT (novo/ganho/perdido) e EN (contacted/qualifying/disqualified) na mesma coluna → [INFERÊNCIA] dois motores de estágio escrevendo junto.
- Dias 12/09 e 19/09: só e-mail em lote, zero CRM.

## G. INTEGRAÇÕES NO DADO (insumo do entregável 06)
- **G1 [FATO] `integracao_sync_estado` = 0 linhas. ZERO observabilidade de integração** — nenhum provider registrou cursor/último sync/status/erro.
- **G2 `stripe_webhook_events` (140)**: 139 processed em segundos; **1 `invoice.paid` de 14/09 pending há 9 dias, attempts=0, nunca tentado.** Retenção só 8 dias. `livemode` NULL (não distingue teste/prod).
- **G3 `meta_lead_staging` (575)**: 574 usado=true; **1 preso em usado=false desde 22/07 (63 dias).**
- **G4 `meta_capi_entregas` (54)**: 100% entregue, mas é dos 54 leads de hoje (local).
- **G5 [FATO] `callface_ai_*` = TUDO ZERO** (snapshots/usage/identities/reconciliation). Fundação (migração 0086) nunca recebeu dado.
- **G6 `event_outbox` (112)**: todas de hoje, 3 pending (11:42), attempts=0. Contraste: pre_carga tinha 597 eventos comerciais reais de 01–19/09.
- `email_sequencias/_passos/_execucoes` = 0. `automacoes/automacao_*`, `cadence_definitions/enrollments`, `checkouts`, `nps_respostas`, `metricas_diarias`, `billing_audit_runs/correction_ledger/resolution_cases`, `cs_riscos/renovacoes/marcos/cancelamentos` = 0.
- **`ai_*` (35 tabelas): só `ai_models` (6), `ai_agents` (2), `ai_agent_versions` (2) — seeds. As outras 32 vazias** (ai_agent_runs, ai_router_decisions, ai_send_ledger, ai_knowledge_*, ai_memory_*, ai_sdr_*, ai_cases).

## Pendências para a captura remota (entregável 09)
- As perdas da seção 0 ocorreram em produção ou só na carga local? Só o banco de produção resolve.
- `reconciliation_runs` auto-inconsistente (45.331 declarados vs 413 registrados) — impossível reconstituir o que foi escrito em 16/08.
