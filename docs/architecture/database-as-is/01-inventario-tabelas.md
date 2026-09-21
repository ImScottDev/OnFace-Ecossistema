# Inventário de tabelas, estado AS-IS

> **Nota de leitura sobre a coluna "Quem referencia ela".** O número nesta coluna é a
> quantidade de **tabelas distintas** que apontam para ela, não a quantidade de foreign
> keys. Uma mesma tabela pode apontar várias vezes: `ai_agent_runs` tem quatro colunas
> diferentes com FK para `usuarios`, e conta como uma tabela aqui e como quatro FKs em
> `02-relacoes.md`. Por isso os dois documentos trazem números diferentes para a mesma
> entidade, e os dois estão certos:
>
> | Entidade | Tabelas distintas (aqui) | Foreign keys (02-relacoes) |
> |---|---|---|
> | `organizacoes` | 120 | 120 |
> | `usuarios` | 57 | 71 |
> | `leads` | 34 | 35 |
> | `empresas` | 25 | 26 |
> | `negocios` | 19 | 19 |
> | `servicos_canonicos` | 15 | 15 |
> | `contratos` | 12 | 13 |
>
> Conferido contra `pg_constraint` em 20/09/2026.

Banco `callface_crm` (PostgreSQL local carregado com os dados de produção de 20/09/2026), schema `public`.
Este documento descreve o que existe. Não propõe arquitetura, não indica qual tabela deve vencer e não recomenda mudança.

## Resumo

| Medida | Valor | Evidência |
|---|---|---|
| Tabelas base no schema `public` | 151 | `_raw/tabelas-contagem-exata.txt` (151 linhas); `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'` retornou 151 |
| Tabelas vazias (0 linhas) | 81 | `_raw/tabelas-contagem-exata.txt` |
| Tabelas com pelo menos 1 linha | 70 | `_raw/tabelas-contagem-exata.txt` |
| Views | 1 (`current_service_portfolio`) | `_raw/views.txt`; `SELECT count(*) FROM information_schema.views WHERE table_schema='public'` retornou 1 |
| Foreign keys declaradas | 423 | `_raw/foreign-keys.txt` (423 linhas) |
| Colunas `*_id` sem FK declarada | 115 | `_raw/ids-sem-fk.txt` (115 linhas) |
| Tabelas com FK para `organizacoes` | 120 | derivado de `_raw/foreign-keys.txt` |
| Tabelas sem FK entrando nem saindo | 4 (`_carga_contagem_antes`, `_migracoes_aplicadas`, `ai_models`, `meta_lead_staging`) | `_raw/sem-fk-nenhuma.txt` |
| Triggers | 2 (`service_ledger_entries`, `tarefas`) | `_raw/triggers.txt` |
| Functions | 3 | `_raw/functions.txt` |

### Distribuição por domínio

| Domínio | Tabelas | Vazias | Com dados | Linhas somadas |
|---|---:|---:|---:|---:|
| Tenant e autenticação | 5 | 2 | 3 | 38 |
| Pessoas e empresas | 3 | 2 | 1 | 2.199 |
| Aquisição | 10 | 6 | 4 | 4.744 |
| Vendas | 17 | 8 | 9 | 9.245 |
| Proposta e contrato | 10 | 4 | 6 | 5.703 |
| Financeiro | 16 | 5 | 11 | 3.311 |
| Pós-venda e CS | 13 | 5 | 8 | 2.491 |
| Comunicação | 12 | 2 | 10 | 39.861 |
| Atividades | 4 | 1 | 3 | 18.508 |
| Automações | 12 | 11 | 1 | 1.273 |
| Inteligência artificial | 32 | 31 | 1 | 6 |
| Integrações | 5 | 4 | 1 | 105 |
| Auditoria | 5 | 0 | 5 | 31.317 |
| Legado e migração | 5 | 0 | 5 | 7.375 |
| NAO CONFIRMADO | 2 | 0 | 2 | 164 |
| **Total** | **151** | **81** | **70** | **126.340** |

### As cinco maiores tabelas

| Tabela | Linhas |
|---|---:|
| `correction_change_log` | 30.876 |
| `whatsapp_mensagens` | 25.363 |
| `atividades` | 13.044 |
| `status_changes` | 5.923 |
| `legacy_provenance` | 5.064 |

### Como ler as colunas

- **Linhas**: contagem exata, de `_raw/tabelas-contagem-exata.txt`.
- **PK**: coluna(s) da chave primária, de `_raw/primary-keys.txt`.
- **Principais FKs que ela tem**: FKs que saem da tabela, de `_raw/foreign-keys.txt`. A FK `organizacao_id -> organizacoes` foi omitida porque existe em 120 das 151 tabelas; quando ela é a única, a célula diz "só `organizacao_id`". Acima de 5 FKs, o excedente aparece como `+N`.
- **Quem referencia ela**: número de tabelas distintas com FK apontando para ela, e os cinco primeiros nomes em ordem alfabética.
- **Papel aparente**: frase curta. Onde é inferência e não fato lido do schema ou do código, o texto diz "aparentemente" ou "NAO CONFIRMADO".

O agrupamento por domínio usa apenas três fontes de prova: o nome da tabela, as FKs declaradas, e o uso no código em `/Users/Scott/Documents/Scott Studio/callface-crm-dev/app/src`. Tabela sem domínio comprovável foi para a seção **NAO CONFIRMADO** no fim, nunca chutada para um domínio.

---

## Tenant e autenticação

5 tabelas, 2 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `organizacoes` | 1 | `id` | nenhuma | **120**: ai_agent_run_steps, ai_agent_runs, ai_agent_versions, ai_agents, ai_alerts, +115 | Tenant raiz. 1 linha. É a tabela mais referenciada do banco. |
| `usuarios` | 16 | `id` | `team_id`->teams | **57**: ai_agent_versions, ai_agents, ai_alerts, ai_case_events, ai_contact_field_proposals, +52 | Usuário do CRM (email, senha_hash, role, team_id). |
| `auth_tokens` | 21 | `id` | `usuario_id`->usuarios | ninguém | Token de autenticação/recuperação por usuário (token_hash, expira_em). |
| `teams` | 0 | `id` | `manager_id`->usuarios | **1**: usuarios | Time com gestor. Vazia, embora `usuarios.team_id` exista e aponte para ela. |
| `custom_fields` | 0 | `id` | só `organizacao_id` | ninguém | Definição de campo customizado por entidade e por tenant. Vazia. |

## Pessoas e empresas

3 tabelas, 2 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `empresas` | 2.199 | `id` | `canonical_empresa_id`->empresas | **25**: assinaturas, atividades, billing_identities, callface_ai_reconciliation_candidates, cliente_receita_mensal, +20 | Cadastro de empresa, com enriquecimento Apollo e autorreferência `canonical_empresa_id`. |
| `pessoas` | 0 | `id` | `empresa_id`->empresas, `lead_id_legado`->leads | **6**: clientes, communications, oportunidades, pessoa_empresa_vinculos, pontos_contato, +1 | Cadastro de pessoa física ligada a empresa. Vazia, mas 6 tabelas apontam para ela. |
| `pessoa_empresa_vinculos` | 0 | `id` | `empresa_id`->empresas, `pessoa_id`->pessoas | ninguém | Vínculo pessoa-empresa com papel (CHECK de 7 valores). Vazia. |

## Aquisição

10 tabelas, 6 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `leads` | 3.989 | `id` | `empresa_id`->empresas, `agenda_closer_id`->usuarios, `desqualificado_por`->usuarios, `nutrido_por`->usuarios, `pre_qualificado_por`->usuarios, +3 | **34**: ai_agent_runs, ai_cases, assinaturas, atividades, billing_identities, +29 | Lead do funil: UTM, click IDs (gclid/fbclid/fbc/fbp), score, estágio. Segunda entidade mais referenciada. |
| `lead_labels` | 161 | `id` | `label_id`->labels, `lead_id`->leads | ninguém | Etiqueta aplicada a lead. |
| `lead_listas` | 0 | `id` | `lead_id`->leads, `lista_id`->contato_listas | ninguém | Lead dentro de uma lista. Vazia. |
| `contato_listas` | 0 | `id` | só `organizacao_id` | **1**: lead_listas | Lista nomeada. Apesar do nome, a única tabela que a referencia é `lead_listas`. Vazia. |
| `campanhas` | 18 | `id` | só `organizacao_id` | ninguém | Campanha de mídia por plataforma, com `utm_campaign` e investimento mensal. |
| `meta_lead_staging` | 576 | `id` | nenhuma | ninguém | Staging de lead do Meta (fb_lead_id, ad/adset/campaign). Não tem FK nenhuma. |
| `eventos` | 0 | `id` | `lead_id`->leads | ninguém | Evento de navegação por lead (página, referrer, user_agent, ip). Vazia. |
| `pontos_contato` | 0 | `id` | `empresa_id`->empresas, `lead_id_legado`->leads, `pessoa_id`->pessoas | ninguém | Ponto de contato / atribuição UTM por pessoa e empresa, com first/last touch. Vazia. |
| `outreach_campanhas` | 0 | `id` | `created_by`->usuarios | ninguém | Campanha de disparo em massa com audiência e contadores de envio. Vazia. |
| `buscas_salvas` | 0 | `id` | só `organizacao_id` | ninguém | Filtro de busca salvo em jsonb. Vazia. |

## Vendas

17 tabelas, 8 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `negocios` | 1.562 | `id` | `bundle_id`->oportunidade_bundle, `empresa_id`->empresas, `lead_id`->leads, `pipeline_id`->pipelines, `servico_origem_id`->servicos_canonicos, +2 | **19**: anexos, atividades, checkouts, comercial_evidencia, contratos, +14 | Negócio no pipeline: etapa, valores, temperatura, motivo de perda. |
| `negocio_leads` | 1.199 | `id` | `lead_id`->leads, `negocio_id`->negocios | ninguém | Vínculo N-N negócio-lead com papel. |
| `negocio_labels` | 0 | `id` | `label_id`->labels, `negocio_id`->negocios | ninguém | Etiqueta aplicada a negócio. Vazia. |
| `pipelines` | 2 | `id` | só `organizacao_id` | **2**: negocios, oportunidades | Definição de pipeline: `stages` e `closed_stages` em jsonb. |
| `oportunidades` | 0 | `id` | `bundle_id`->oportunidade_bundle, `empresa_id`->empresas, `lead_id`->leads, `negocio_id_legado`->negocios, `pessoa_id`->pessoas, +2 | **2**: clientes, oportunidade_itens | Modelo de oportunidade do CRM 2.0 (pessoa/empresa/bundle/stage). Vazia; convive com `negocios`. |
| `oportunidade_bundle` | 0 | `id` | `empresa_id`->empresas, `lead_id`->leads | **2**: negocios, oportunidades | Agrupador de oportunidades por lead/empresa. Vazia. |
| `oportunidade_itens` | 0 | `id` | `catalogo_preco_id`->catalogo_precos, `contrato_item_id_legado`->contrato_itens, `grupo_comercial_id`->proposta_grupo_comercial, `oportunidade_id`->oportunidades, `proposta_item_id_legado`->proposta_itens, +1 | ninguém | Item de oportunidade, com ponteiros legados para `contrato_itens` e `proposta_itens`. Vazia. |
| `vendas_eventos` | 0 | `id` | `empresa_id`->empresas, `lead_id`->leads, `negocio_id`->negocios, `pessoa_id`->pessoas, `proposta_id`->propostas, +2 | ninguém | Evento de venda com `ator_tipo` (HUMAN/AI_AGENT/AUTOMATION/SYSTEM) e CHECK exigindo ao menos uma entidade preenchida. Vazia. |
| `status_changes` | 5.923 | `id` | `lead_id`->leads, `negocio_id`->negocios, `usuario_id`->usuarios | ninguém | Histórico de mudança de status de lead e de negócio (de_status/para_status). |
| `eventos_comerciais` | 247 | `id` | `contrato_id`->contratos, `negocio_id`->negocios, `servico_id`->servicos_canonicos, `responsavel_id`->usuarios | ninguém | Evento comercial ligado a negócio, contrato e serviço, com `confianca` e `evidencia`. |
| `reunioes` | 295 | `id` | `lead_id`->leads, `negocio_id`->negocios, `responsavel_id`->usuarios | **2**: notas, vendas_eventos | Reunião comercial com transcript, resumo e `outlook_event_id`. |
| `metas` | 13 | `id` | `criado_por`->usuarios, `usuario_id`->usuarios | ninguém | Meta por usuário e período. |
| `metricas_diarias` | 1 | `id` | só `organizacao_id` | ninguém | Snapshot diário de meta, pipeline e MRR. 1 linha apenas. |
| `closer_disponibilidade` | 0 | `id` | `usuario_id`->usuarios | ninguém | Janela de trabalho do closer para rodízio de agenda. Vazia. |
| `closer_bloqueios` | 0 | `id` | `usuario_id`->usuarios | ninguém | Bloqueio de agenda do closer, com `outlook_event_id`. Vazia. |
| `comercial_evidencia` | 0 | `id` | `grupo_comercial_id`->proposta_grupo_comercial, `negocio_id`->negocios, `verificado_por`->usuarios | ninguém | Evidência que sustenta o Ganho do negócio (`tipo` + `source_ref`). Vazia. |
| `won_evidence_policies` | 3 | `id` | só `organizacao_id` | ninguém | Política de evidência aceita por produto para marcar Ganho. Usada em `lib/crm/won-evidence.ts`. |

## Proposta e contrato

10 tabelas, 4 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `propostas` | 1.550 | `id` | `contrato_base_id`->contratos, `contrato_id`->contratos, `lead_id`->leads, `negocio_id`->negocios, `substituida_por_id`->propostas, +1 | **5**: checkouts, proposta_grupo_comercial, proposta_itens, propostas, vendas_eventos | Proposta comercial versionada, com autorreferência `substituida_por_id`. |
| `proposta_itens` | 2.701 | `id` | `catalogo_preco_id`->catalogo_precos, `proposta_id`->propostas, `servico_catalogo_id`->servicos_catalogo | **2**: oportunidade_itens, proposta_grupo_comercial_itens | Item de proposta, com preço e semântica de receita. |
| `proposta_grupo_comercial` | 0 | `id` | `checkout_id`->checkouts, `contrato_id`->contratos, `negocio_id`->negocios, `proposta_id`->propostas | **6**: checkouts, comercial_evidencia, contratos, faturas, oportunidade_itens, +1 | Grupo que amarra proposta, negócio, contrato e checkout. Vazia. |
| `proposta_grupo_comercial_itens` | 0 | `id` | `grupo_id`->proposta_grupo_comercial, `proposta_item_id`->proposta_itens | ninguém | Item do grupo comercial. Vazia. |
| `contratos` | 742 | `id` | `grupo_comercial_id`->proposta_grupo_comercial, `lead_id`->leads, `negocio_id`->negocios, `template_id`->contrato_templates | **12**: assinaturas, contrato_itens, cs_cancelamentos, cs_renovacoes, eventos_comerciais, +7 | Contrato do cliente: vigência, MRR, assinatura, ciclo de vida comercial. |
| `contrato_itens` | 487 | `id` | `contrato_id`->contratos, `servico_catalogo_id`->servicos_catalogo | **1**: oportunidade_itens | Item de contrato, com natureza de receita e proveniência. |
| `contrato_templates` | 3 | `id` | só `organizacao_id` | **1**: contratos | Template de contrato por modelo comercial e família de serviço. |
| `checkouts` | 0 | `id` | `grupo_comercial_id`->proposta_grupo_comercial, `negocio_id`->negocios, `proposta_id`->propostas, `criado_por_id`->usuarios | **1**: proposta_grupo_comercial | Checkout Stripe originado de proposta/negócio. Vazia. |
| `servicos_catalogo` | 220 | `id` | só `organizacao_id` | **5**: catalogo_mapeamentos_legacy, catalogo_precos, contrato_itens, fatura_itens, proposta_itens | Catálogo de produtos vendáveis, com flags de comportamento (cria serviço canônico, cria fulfillment, exige assinatura). |
| `catalogo_precos` | 0 | `id` | `servico_catalogo_id`->servicos_catalogo | **2**: oportunidade_itens, proposta_itens | Preço/SKU do item de catálogo (price Stripe). Vazia, apesar de `proposta_itens` e `oportunidade_itens` apontarem para ela. |

## Financeiro

16 tabelas, 5 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `assinaturas` | 355 | `id` | `contrato_id`->contratos, `empresa_id`->empresas, `lead_id`->leads, `servico_id`->servicos_canonicos | **4**: assinatura_itens, faturas, mrr_movimentos, servico_billing_timeline | Assinatura Stripe com MRR, status e período corrente. |
| `assinatura_itens` | 0 | `id` | `assinatura_id`->assinaturas, `servico_canonico_id`->servicos_canonicos | ninguém | Item de assinatura (subscription item Stripe). Vazia. |
| `faturas` | 951 | `id` | `assinatura_id`->assinaturas, `contrato_id`->contratos, `empresa_id`->empresas, `grupo_comercial_id`->proposta_grupo_comercial, `lead_id`->leads, +3 | **1**: fatura_itens | Fatura/cobrança com `receivable_state`, vencimento e acionamento de cobrança. |
| `fatura_itens` | 226 | `id` | `fatura_id`->faturas, `servico_catalogo_id`->servicos_catalogo, `servico_id`->servicos_canonicos | ninguém | Item de fatura. |
| `mrr_movimentos` | 665 | `id` | `assinatura_id`->assinaturas, `contrato_id`->contratos, `lead_id`->leads | ninguém | Movimento de MRR (delta, mrr_antes, mrr_depois). |
| `servicos_canonicos` | 438 | `id` | `contrato_id`->contratos, `empresa_id`->empresas, `lead_id`->leads | **15**: assinatura_itens, assinaturas, cs_cancelamentos, cs_marcos, cs_renovacoes, +10 | Serviço canônico do cliente: família, natureza de receita, valor recorrente, `portfolio_included`. |
| `servico_billing_timeline` | 144 | `id` | `assinatura_id`->assinaturas, `contrato_id`->contratos, `empresa_id`->empresas, `lead_id`->leads, `servico_id`->servicos_canonicos | ninguém | Linha do tempo de faturamento por serviço e provedor externo. |
| `service_ledger_batches` | 1 | `id` | só `organizacao_id` | **1**: service_ledger_entries | Lote de importação do ledger de faturamento, com CHECK de fechamento (`expected_total = imported_total`). |
| `service_ledger_entries` | 302 | `id` | `batch_id`->service_ledger_batches, `service_id`->servicos_canonicos | ninguém | Linha do ledger importado. Trigger `trg_closed_service_ledger_entries_immutable` bloqueia UPDATE/DELETE em lote fechado. |
| `cliente_receita_mensal` | 0 | `id` | `empresa_id`->empresas | ninguém | Receita mensal por cliente e competência, com evidência. Vazia. |
| `portfolio_snapshots` | 3 | `id` | só `organizacao_id` | ninguém | Snapshot de componente de portfólio por data. Nenhuma referência encontrada em `app/src`. |
| `billing_identities` | 224 | `id` | `canonical_empresa_id`->empresas, `canonical_lead_id`->leads, `empresa_id`->empresas, `lead_id`->leads | **2**: billing_correction_ledger, billing_customer_aliases | Identidade de cobrança (customer Stripe) ligada a empresa/lead, com par canônico. |
| `billing_customer_aliases` | 2 | `id` | `billing_identity_id`->billing_identities | ninguém | Alias de customer Stripe apontando para uma identidade de cobrança. |
| `billing_audit_runs` | 0 | `id` | só `organizacao_id` | **2**: billing_correction_ledger, billing_resolution_cases | Execução de auditoria de billing (CHECK status RUNNING/COMPLETED/FAILED). Vazia. |
| `billing_correction_ledger` | 0 | `id` | `audit_run_id`->billing_audit_runs, `billing_identity_id`->billing_identities | ninguém | Correção aplicada pela auditoria de billing, marcada como reversível. Vazia. |
| `billing_resolution_cases` | 0 | `id` | `audit_run_id`->billing_audit_runs | ninguém | Caso de resolução de billing por fila (CONFIRMED/REVIEW/CONFLICT). Vazia. |

## Pós-venda e CS

13 tabelas, 5 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `clientes` | 275 | `id` | `empresa_id`->empresas, `lead_id_legado`->leads, `oportunidade_origem_id`->oportunidades, `pessoa_principal_id`->pessoas, `responsavel_id`->usuarios | **1**: notas | Carteira de clientes (empresa + pessoa principal + responsável), com campos de jornada de CS. |
| `cs_marcos` | 0 | `id` | `empresa_id`->empresas, `servico_canonico_id`->servicos_canonicos, `tarefa_id`->tarefas, `concluido_por`->usuarios | **1**: nps_respostas | Marco da jornada, CHECK de código em D0/D7/D30/M3/M6/M9/M12/RENOVACAO, com tarefa gerada. Vazia. |
| `cs_riscos` | 514 | `id` | `empresa_id`->empresas, `servico_canonico_id`->servicos_canonicos, `tarefa_id`->tarefas, `aberto_por`->usuarios, `resolvido_por`->usuarios, +1 | ninguém | Risco de cliente por severidade (ATENCAO/EM_RISCO/CRITICO) e status. |
| `cs_renovacoes` | 0 | `id` | `contrato_id`->contratos, `empresa_id`->empresas, `negocio_id`->negocios, `servico_canonico_id`->servicos_canonicos, `decidido_por`->usuarios, +1 | ninguém | Ciclo de renovação de contrato (FUTURA..NAO_RENOVADA). Vazia. |
| `cs_cancelamentos` | 0 | `id` | `contrato_id`->contratos, `empresa_id`->empresas, `servico_canonico_id`->servicos_canonicos, `decidido_por`->usuarios, `solicitado_por`->usuarios | ninguém | Pedido de cancelamento e retenção (SOLICITADO..EFETIVADO). Vazia. |
| `nps_respostas` | 0 | `id` | `contrato_id`->contratos, `empresa_id`->empresas, `lead_id`->leads, `marco_id`->cs_marcos, `registrado_por`->usuarios | ninguém | Resposta de NPS por token único. Vazia. |
| `fulfillments` | 25 | `id` | `servico_canonico_id`->servicos_canonicos, `responsavel_id`->usuarios | **4**: fulfillment_formularios, fulfillment_itens, fulfillment_linhas_portabilidade, fulfillment_ramais | Entrega/implantação de um serviço canônico, com token público. |
| `fulfillment_itens` | 1.659 | `id` | `fulfillment_id`->fulfillments, `completed_by`->usuarios, `responsavel_id`->usuarios | ninguém | Linha da entrega, com bloqueio (`blocker_type`, `blocker_reason`). |
| `fulfillment_formularios` | 3 | `id` | `fulfillment_id`->fulfillments, `revisado_por`->usuarios | ninguém | Formulário de onboarding preenchido pelo cliente e revisado. |
| `fulfillment_ramais` | 6 | `id` | `fulfillment_id`->fulfillments | ninguém | Ramal declarado no onboarding. |
| `fulfillment_linhas_portabilidade` | 3 | `id` | `fulfillment_id`->fulfillments | ninguém | Linha em portabilidade declarada no onboarding. |
| `documentos_atendimento` | 0 | `id` | só `organizacao_id` | ninguém | Documento de apoio ao atendimento. Tem rota própria (`api-server/routes/documentos-atendimento.ts`). Vazia. |
| `scripts_atendimento` | 6 | `id` | só `organizacao_id` | ninguém | Script de atendimento versionado. Tem rota própria (`api-server/routes/scripts-atendimento.ts`). |

## Comunicação

12 tabelas, 2 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `contatos` | 1.663 | `id` | `active_ai_agent_id`->ai_agents, `conta_id`->email_contas, `lead_id`->leads, `sessao_id`->whatsapp_sessao, `closed_by_id`->usuarios, +1 | **6**: ai_agent_runs, ai_cases, ai_contact_field_proposals, ai_router_decisions, ai_sdr_contato_state, +1 | Conversa do inbox por canal, com responsável, snooze e agente de IA ativo. |
| `contato_labels` | 0 | `id` | `contato_id`->contatos, `label_id`->labels | ninguém | Etiqueta aplicada a conversa do inbox. Vazia. |
| `whatsapp_sessao` | 7 | `id` | `usuario_id`->usuarios | **6**: ai_agent_runs, ai_agent_versions, ai_routers, cadencia_execucoes, contatos, +1 | Sessão/instância de WhatsApp (session_name único, api_token, status). |
| `whatsapp_mensagens` | 25.363 | `id` | `lead_id`->leads, `sessao_id`->whatsapp_sessao, `enviado_por_id`->usuarios | **2**: ai_agent_runs, ai_contact_field_proposals | Mensagem de WhatsApp. Maior tabela do banco. |
| `whatsapp_templates` | 1 | `id` | só `organizacao_id` | ninguém | Template de mensagem de WhatsApp. |
| `emails` | 4.460 | `id` | `conta_id`->email_contas, `lead_id`->leads, `enviado_por_id`->usuarios | ninguém | E-mail sincronizado ou enviado, com thread e anexos. |
| `email_contas` | 8 | `id` | `usuario_id`->usuarios | **3**: contatos, email_sequencia_execucoes, emails | Conta de e-mail conectada (OAuth ou IMAP/SMTP), com estado de sync. |
| `email_templates` | 1 | `id` | só `organizacao_id` | **1**: email_sequencia_passos | Template de e-mail com variáveis. |
| `ligacoes` | 4.938 | `id` | `lead_id`->leads, `negocio_id`->negocios, `usuario_id`->usuarios | ninguém | Registro de ligação vindo da telefonia Callface, com transcrição e áudio. |
| `communications` | 0 | `id` | `pessoa_id`->pessoas, `usuario_id`->usuarios | ninguém | Tabela genérica de comunicação por canal ligada a pessoa, com unique (canal, external_id). Vazia. |
| `lead_user_unread` | 217 | `id` | `lead_id`->leads, `usuario_id`->usuarios | ninguém | Contador de não lidas de WhatsApp e e-mail por lead e usuário. |
| `notificacoes` | 3.203 | `id` | `usuario_id`->usuarios | ninguém | Notificação in-app para usuário. Única FK é `usuario_id`. |

## Atividades

4 tabelas, 1 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `atividades` | 13.044 | `id` | `empresa_id`->empresas, `lead_id`->leads, `negocio_id`->negocios, `usuario_id`->usuarios | ninguém | Item de timeline de lead, negócio ou empresa. |
| `tarefas` | 462 | `id` | `empresa_id`->empresas, `lead_id`->leads, `negocio_id`->negocios, `servico_canonico_id`->servicos_canonicos, `usuario_id`->usuarios | **2**: cs_marcos, cs_riscos | Tarefa com status (CHECK de 5 valores). Trigger `trg_tarefas_sincronizar_status` sincroniza `concluida` e `status`. |
| `notas` | 5.002 | `id` | `cliente_id`->clientes, `empresa_id`->empresas, `lead_id`->leads, `negocio_id`->negocios, `reuniao_id`->reunioes, +1 | **1**: anexos | Nota em lead, negócio, empresa, cliente ou reunião. |
| `anexos` | 0 | `id` | `negocio_id`->negocios, `nota_id`->notas, `criado_por_id`->usuarios | ninguém | Anexo de negócio ou nota. Vazia; o acervo está em `anexos_legado`. |

## Automações

12 tabelas, 11 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `automacoes` | 0 | `id` | só `organizacao_id` | **1**: automacao_execucoes | Regra de automação (gatilho, condição, ação). Vazia. |
| `automacao_execucoes` | 0 | `id` | `automacao_id`->automacoes | ninguém | Execução de automação por entidade. Vazia. |
| `cadence_definitions` | 0 | `id` | só `organizacao_id` | **3**: cadence_definition_pointers, cadence_enrollments, cadence_versions | Definição de cadência versionada, com steps e draft_steps. Vazia. |
| `cadence_versions` | 0 | `id` | `cadence_definition_id`->cadence_definitions, `created_by_id`->usuarios | **2**: cadence_definition_pointers, cadence_enrollments | Versão da cadência (unique por definição + número). Vazia. |
| `cadence_definition_pointers` | 0 | `cadence_definition_id` | `cadence_definition_id`->cadence_definitions, `draft_version_id`->cadence_versions, `published_version_id`->cadence_versions | ninguém | Ponteiro para a versão publicada e a rascunho de uma cadência. Vazia. |
| `cadence_enrollments` | 0 | `id` | `cadence_definition_id`->cadence_definitions, `cadence_version_id`->cadence_versions, `source_event_id`->event_outbox | **1**: cadence_enrollment_events | Inscrição de uma entidade numa cadência, com idempotência e claim. Vazia. |
| `cadence_enrollment_events` | 0 | `id` | `enrollment_id`->cadence_enrollments | ninguém | Evento da inscrição em cadência. Vazia. |
| `cadencia_execucoes` | 1.273 | `id` | `lead_id`->leads, `sessao_id`->whatsapp_sessao, `enviado_por_id`->usuarios | ninguém | Execução de passo de cadência por lead e canal. É a única das três engines de cadência com dado. |
| `email_sequencias` | 0 | `id` | só `organizacao_id` | **2**: email_sequencia_execucoes, email_sequencia_passos | Sequência de e-mails. Vazia. |
| `email_sequencia_passos` | 0 | `id` | `sequencia_id`->email_sequencias, `template_id`->email_templates | ninguém | Passo da sequência, ligado a template. Vazia. |
| `email_sequencia_execucoes` | 0 | `id` | `conta_id`->email_contas, `lead_id`->leads, `sequencia_id`->email_sequencias | ninguém | Execução da sequência por lead e conta. Vazia. |
| `event_outbox` | 0 | `id` | só `organizacao_id` | **1**: cadence_enrollments | Outbox de eventos de domínio com `idempotency_key` único e tentativas. Vazia. |

## Inteligência artificial

32 tabelas, 31 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `ai_agents` | 0 | `id` | `published_version_id`->ai_agent_versions, `created_by_id`->usuarios | **9**: ai_agent_runs, ai_agent_versions, ai_cases, ai_contact_field_proposals, ai_router_decisions, +4 | Agente de IA por tenant (unique org+slug), com ponteiro para versão publicada. Vazia. |
| `ai_agent_versions` | 0 | `id` | `agent_id`->ai_agents, `channel_session_id`->whatsapp_sessao, `credential_id`->ai_provider_credentials, `created_by_id`->usuarios | **2**: ai_agent_runs, ai_agents | Versão do agente (unique agent+versão), com credencial e sessão de canal. Vazia. |
| `ai_agent_runs` | 0 | `id` | `agent_id`->ai_agents, `channel_session_id`->whatsapp_sessao, `contato_id`->contatos, `lead_id`->leads, `outbound_message_id`->whatsapp_mensagens, +2 | **5**: ai_agent_run_steps, ai_cases, ai_knowledge_searches, ai_send_ledger, ai_skill_activations | Execução do agente sobre uma mensagem/contato/lead. Vazia. |
| `ai_agent_run_steps` | 0 | `id` | `run_id`->ai_agent_runs | ninguém | Passo de uma execução (unique run+sequence). Vazia. |
| `ai_send_ledger` | 0 | `id` | `run_id`->ai_agent_runs | ninguém | Ledger de envio feito por uma execução (unique run+sequence). Vazia. |
| `ai_routers` | 0 | `id` | `channel_session_id`->whatsapp_sessao, `fallback_agent_id`->ai_agents, `created_by_id`->usuarios | **2**: ai_router_decisions, ai_router_members | Roteador de intenção entre agentes, com fallback. Vazia. |
| `ai_router_members` | 0 | `id` | `agent_id`->ai_agents, `router_id`->ai_routers | ninguém | Agente associado a uma intenção do roteador. Vazia. |
| `ai_router_decisions` | 0 | `id` | `agent_id`->ai_agents, `contato_id`->contatos, `router_id`->ai_routers | ninguém | Decisão de roteamento registrada. Vazia. |
| `ai_skill_versions` | 0 | `id` | `forked_from_version_id`->ai_skill_versions, `created_by_id`->usuarios | **3**: ai_skill_activations, ai_skill_pointers, ai_skill_versions | Versão de skill, com fork de outra versão. Vazia. |
| `ai_skill_pointers` | 0 | `id` | `version_id`->ai_skill_versions | ninguém | Ponteiro nome->versão de skill por tenant. Vazia. |
| `ai_skill_activations` | 0 | `id` | `run_id`->ai_agent_runs, `skill_version_id`->ai_skill_versions | ninguém | Skill ativada numa execução. Vazia. |
| `ai_knowledge_sources` | 0 | `id` | `created_by_id`->usuarios | **1**: ai_knowledge_versions | Fonte de conhecimento (RAG). Vazia. |
| `ai_knowledge_versions` | 0 | `id` | `source_id`->ai_knowledge_sources | **2**: ai_knowledge_chunks, ai_knowledge_searches | Versão da fonte de conhecimento. Vazia. |
| `ai_knowledge_chunks` | 0 | `id` | `version_id`->ai_knowledge_versions | ninguém | Chunk indexado da versão (unique version+sequence). Vazia. |
| `ai_knowledge_searches` | 0 | `id` | `knowledge_version_id`->ai_knowledge_versions, `run_id`->ai_agent_runs | ninguém | Busca de conhecimento feita numa execução. Vazia. |
| `ai_memory_entries` | 0 | `id` | `created_by_id`->usuarios | ninguém | Entrada de memória do agente. Vazia. |
| `ai_memory_versions` | 0 | `id` | `created_by_id`->usuarios | **1**: ai_memory_pointers | Versão da memória por tenant. Vazia. |
| `ai_memory_pointers` | 0 | `organizacao_id` | `version_id`->ai_memory_versions | ninguém | Ponteiro da memória corrente. PK é `organizacao_id`, não `id`. Vazia. |
| `ai_cases` | 0 | `id` | `agent_id`->ai_agents, `contato_id`->contatos, `lead_id`->leads, `run_id`->ai_agent_runs | **1**: ai_case_events | Caso aberto pela IA sobre contato/lead. Vazia. |
| `ai_case_events` | 0 | `id` | `case_id`->ai_cases, `actor_user_id`->usuarios | ninguém | Evento do caso de IA. Vazia. |
| `ai_alerts` | 0 | `id` | `acknowledged_by_id`->usuarios | ninguém | Alerta de IA com reconhecimento por usuário. Vazia. |
| `ai_analysis` | 0 | `id` | só `organizacao_id` | ninguém | Análise de IA sobre uma entidade (resumo, sentimento, objeções, score). Vazia. |
| `ai_contact_field_proposals` | 0 | `id` | `contato_id`->contatos, `message_id`->whatsapp_mensagens, `proposed_by_agent_id`->ai_agents, `decided_by_user_id`->usuarios | ninguém | Proposta de preenchimento de campo de contato feita por agente. Vazia. |
| `ai_improvement_proposals` | 0 | `id` | `decided_by_id`->usuarios | ninguém | Proposta de melhoria gerada pela IA, com decisão humana. Vazia. |
| `ai_models` | 6 | `id` | nenhuma | ninguém | Catálogo de modelos por provedor, com preço por milhão e capacidades. Não tem FK nenhuma. |
| `ai_provider_credentials` | 0 | `id` | `created_by_id`->usuarios | **2**: ai_agent_versions, ai_purpose_bindings | Credencial de provedor de IA por tenant. Vazia. |
| `ai_purpose_bindings` | 0 | `id` | `credential_id`->ai_provider_credentials | ninguém | Amarração propósito->credencial (unique org+purpose). Vazia. |
| `ai_usage_budgets` | 0 | `id` | `agent_id`->ai_agents | ninguém | Orçamento de uso por agente. Vazia. |
| `ai_sdr_config` | 0 | `id` | só `organizacao_id` | ninguém | Configuração do SDR de IA (chave Groq, prompt, horário, rate limit). Vazia. |
| `ai_sdr_contato_state` | 0 | `id` | `contato_id`->contatos, `handoff_usuario_id`->usuarios | ninguém | Estado do SDR por contato (handoff, janela, resumo). Vazia. |
| `ai_sdr_logs` | 0 | `id` | só `organizacao_id` | ninguém | Log de inferência do SDR (tokens, latência, intent). Vazia. |
| `sdr_memory` | 0 | `id` | só `organizacao_id` | ninguém | Memória de conversa do SDR por telefone. Usada em `api-server/routes/sdr.ts`. Vazia. |

## Integrações

5 tabelas, 4 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `callface_ai_external_identities` | 0 | `id` | nenhuma | **2**: callface_ai_tenant_snapshots, callface_ai_usage_events | Identidade externa no produto Callface AI. Não tem FK saindo. Vazia. |
| `callface_ai_tenant_snapshots` | 0 | `id` | `external_identity_id`->callface_ai_external_identities | ninguém | Snapshot de uso do tenant no Callface AI (usuarios, chamadas, minutos). Vazia. |
| `callface_ai_usage_events` | 0 | `id` | `external_identity_id`->callface_ai_external_identities | ninguém | Evento de uso do Callface AI. Vazia. |
| `callface_ai_reconciliation_candidates` | 0 | `id` | `empresa_id`->empresas | ninguém | Candidato de match entre empresa do CRM e organização do Callface AI, com score. Vazia. |
| `stripe_webhook_events` | 105 | `id` | só `organizacao_id` | ninguém | Inbox de webhook Stripe, com `event_id` único, tentativas e erro. |

## Auditoria

5 tabelas, 0 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `audit_log` | 21 | `id` | `actor_id`->usuarios | ninguém | Log de alteração com `before`/`after` em jsonb por entidade. |
| `correction_runs` | 6 | `id` | nenhuma | **1**: correction_change_log | Execução de correção de dados a partir de um ledger (`ledger_sha256`, `mode`). |
| `correction_change_log` | 30.876 | `id` | `run_id`->correction_runs | ninguém | Alteração campo a campo feita por uma correção. Segunda maior tabela do banco. |
| `reconciliation_runs` | 1 | `id` | só `organizacao_id` | **1**: reconciliation_changes | Execução de reconciliação por pacote e ambiente (CHECK HOMOLOG/PROD). |
| `reconciliation_changes` | 413 | `id` | `run_id`->reconciliation_runs | ninguém | Mudança aplicada pela reconciliação (INSERT/UPDATE/DEACTIVATE) com before/after. |

## Legado e migração

5 tabelas, 0 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `anexos_legado` | 1.980 | `id` | só `organizacao_id` | ninguém | Anexo importado do Zoho. Aponta para a entidade por `entidade_tipo`/`entidade_id`, sem FK. |
| `legacy_provenance` | 5.064 | `id` | só `organizacao_id` | ninguém | Proveniência Zoho por entidade (unique org+tipo+zoho_id), com confiança e evidência. |
| `catalogo_mapeamentos_legacy` | 193 | `id` | `canonical_product_id`->servicos_catalogo, `revisado_por`->usuarios | ninguém | De-para produto legado para produto canônico do catálogo, com status de revisão. |
| `_migracoes_aplicadas` | 56 | `nome` | nenhuma | ninguém | Controle de migrations aplicadas (nome, hash, baseline). PK é `nome`. |
| `_carga_contagem_antes` | 82 | `tabela` | nenhuma | ninguém | Contagem de linhas por tabela antes de uma carga. PK é `tabela`. |

## NAO CONFIRMADO

2 tabelas, 0 vazias.

| Tabela | Linhas | PK | Principais FKs que ela tem | Quem referencia ela | Papel aparente |
|---|---:|---|---|---|---|
| `labels` | 3 | `id` | só `organizacao_id` | **4**: contato_labels, entity_labels, lead_labels, negocio_labels | Dicionário de etiquetas do tenant. Quatro tabelas de domínios diferentes a referenciam (`lead_labels`, `negocio_labels`, `contato_labels`, `entity_labels`), então o domínio não e comprovável. |
| `entity_labels` | 161 | `id` | `label_id`->labels, `created_by_id`->usuarios | ninguém | Etiqueta genérica. O CHECK `ck_entity_labels_type` aceita `lead`, `negocio`, `oportunidade`, `cliente`, `empresa`, `contato` e `servico`, então não pertence a um domínio único. |

---

## Tabelas vazias, agrupadas por domínio

81 das 151 tabelas estão com 0 linhas no banco carregado com produção de 20/09/2026. Fonte: `_raw/tabelas-contagem-exata.txt`.

| Domínio | Vazias | Total no domínio | Tabelas vazias |
|---|---:|---:|---|
| Tenant e autenticação | 2 | 5 | `teams`, `custom_fields` |
| Pessoas e empresas | 2 | 3 | `pessoas`, `pessoa_empresa_vinculos` |
| Aquisição | 6 | 10 | `lead_listas`, `contato_listas`, `eventos`, `pontos_contato`, `outreach_campanhas`, `buscas_salvas` |
| Vendas | 8 | 17 | `negocio_labels`, `oportunidades`, `oportunidade_bundle`, `oportunidade_itens`, `vendas_eventos`, `closer_disponibilidade`, `closer_bloqueios`, `comercial_evidencia` |
| Proposta e contrato | 4 | 10 | `proposta_grupo_comercial`, `proposta_grupo_comercial_itens`, `checkouts`, `catalogo_precos` |
| Financeiro | 5 | 16 | `assinatura_itens`, `cliente_receita_mensal`, `billing_audit_runs`, `billing_correction_ledger`, `billing_resolution_cases` |
| Pós-venda e CS | 5 | 13 | `cs_marcos`, `cs_renovacoes`, `cs_cancelamentos`, `nps_respostas`, `documentos_atendimento` |
| Comunicação | 2 | 12 | `contato_labels`, `communications` |
| Atividades | 1 | 4 | `anexos` |
| Automações | 11 | 12 | `automacoes`, `automacao_execucoes`, `cadence_definitions`, `cadence_versions`, `cadence_definition_pointers`, `cadence_enrollments`, `cadence_enrollment_events`, `email_sequencias`, `email_sequencia_passos`, `email_sequencia_execucoes`, `event_outbox` |
| Inteligência artificial | 31 | 32 | `ai_agents`, `ai_agent_versions`, `ai_agent_runs`, `ai_agent_run_steps`, `ai_send_ledger`, `ai_routers`, `ai_router_members`, `ai_router_decisions`, `ai_skill_versions`, `ai_skill_pointers`, `ai_skill_activations`, `ai_knowledge_sources`, `ai_knowledge_versions`, `ai_knowledge_chunks`, `ai_knowledge_searches`, `ai_memory_entries`, `ai_memory_versions`, `ai_memory_pointers`, `ai_cases`, `ai_case_events`, `ai_alerts`, `ai_analysis`, `ai_contact_field_proposals`, `ai_improvement_proposals`, `ai_provider_credentials`, `ai_purpose_bindings`, `ai_usage_budgets`, `ai_sdr_config`, `ai_sdr_contato_state`, `ai_sdr_logs`, `sdr_memory` |
| Integrações | 4 | 5 | `callface_ai_external_identities`, `callface_ai_tenant_snapshots`, `callface_ai_usage_events`, `callface_ai_reconciliation_candidates` |
| Auditoria | 0 | 5 | nenhuma |
| Legado e migração | 0 | 5 | nenhuma |
| NAO CONFIRMADO | 0 | 2 | nenhuma |

Observações factuais sobre as vazias, sem interpretação de causa:

- O domínio de IA responde por 31 das 81 vazias.
- Há tabelas vazias que são alvo de FK de tabelas com dado: `catalogo_precos` (0 linhas) é referenciada por `proposta_itens` (2.701 linhas) e `oportunidade_itens`; `pessoas` (0) é referenciada por `clientes` (275 linhas); `teams` (0) é referenciada por `usuarios` (16 linhas); `oportunidades` (0) é referenciada por `clientes`.
- Das três engines de cadência presentes no schema, apenas `cadencia_execucoes` tem dado (1.273 linhas); `cadence_*` e `email_sequencia*` estão todas em 0.
- `anexos` está em 0 e `anexos_legado` em 1.980.
- Por que cada uma está vazia: **NAO CONFIRMADO**. Os dados extraídos mostram a contagem, não a razão.

---

## O que este documento não afirma

- **NAO CONFIRMADO**: se as tabelas vazias são features não lançadas, features desligadas, ou destino de migração ainda não executada.
- **NAO CONFIRMADO**: qual entidade é a "oficial" em pares que se sobrepõem no schema (`negocios` x `oportunidades`, `leads` x `pessoas`, `contratos` x `assinaturas`, as três engines de cadência). O documento registra que coexistem e quantas linhas cada uma tem.
- **NAO CONFIRMADO**: se as 115 colunas `*_id` sem FK declarada (`_raw/ids-sem-fk.txt`) apontam de fato para as tabelas que o nome sugere.
- **NAO CONFIRMADO**: a semântica de negócio de `portfolio_snapshots`, que não tem nenhuma referência em `app/src` e tem 3 linhas.
- Nenhuma leitura de integridade referencial (órfãos, violações lógicas) foi feita aqui.
