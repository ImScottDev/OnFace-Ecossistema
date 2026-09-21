# OnFace, banco local, relacoes entre tabelas (AS-IS)

> **Nota de leitura.** Os números deste documento contam **foreign keys**. O
> `01-inventario-tabelas.md` conta **tabelas distintas** que referenciam, que é um
> número menor quando uma tabela aponta para a mesma entidade por mais de uma coluna.
> `usuarios` recebe 71 FKs vindas de 57 tabelas. Os dois documentos estão corretos e
> medem coisas diferentes.

Levantamento somente leitura do banco PostgreSQL `callface_crm` carregado com os dados
de producao de 20/09/2026. Este documento descreve o que existe. Nao propoe arquitetura,
nao indica qual tabela deve prevalecer e nao recomenda mudanca.

Fontes de evidencia usadas aqui:

| Fonte | Caminho | Conteudo |
|---|---|---|
| Foreign keys | `docs/architecture/database-as-is/_raw/foreign-keys.txt` | 423 linhas, formato `tabela\|coluna\|destino\|coluna_destino\|constraint\|delete_rule\|nullability` |
| Contagem de linhas | `_raw/tabelas-contagem-exata.txt` | 151 linhas, `tabela\|linhas` |
| Colunas | `_raw/colunas.txt` | 2298 linhas, `tabela\|coluna\|tipo\|nullable\|default` |
| IDs sem FK | `_raw/ids-sem-fk.txt` | 115 colunas `*_id` sem foreign key declarada |
| Mais referenciadas | `_raw/mais-referenciadas.txt` | contagem de FKs que chegam em cada tabela |
| Sem FK nenhuma | `_raw/sem-fk-nenhuma.txt` | 4 tabelas fora do grafo |
| Views | `_raw/views.txt` | 1 view: `current_service_portfolio` |

Numeros de preenchimento e de orfaos citados na secao 5 vieram de queries `SELECT`
executadas contra o banco local; cada query aparece ao lado do numero.

Panorama do grafo:

| Metrica | Valor |
|---|---|
| Tabelas no banco | 151 |
| Foreign keys declaradas | 423 |
| Tabelas que emitem pelo menos uma FK | 144 |
| Tabelas que recebem pelo menos uma FK | 57 |
| FKs com coluna NOT NULL (OBRIGATORIA) | 177 |
| FKs com coluna nullable (OPCIONAL) | 246 |
| FKs `ON DELETE NO ACTION` | 258 |
| FKs `ON DELETE CASCADE` | 100 |
| FKs `ON DELETE SET NULL` | 60 |
| FKs `ON DELETE RESTRICT` | 5 |

Contagens de nullability e delete rule reproduziveis com:

```bash
cut -d'|' -f7 _raw/foreign-keys.txt | sort | uniq -c   # nullability
cut -d'|' -f6 _raw/foreign-keys.txt | sort | uniq -c   # delete_rule
```

## 1. Todas as foreign keys, agrupadas por tabela de origem

Formato de cada linha:

```
tabela.coluna -> tabela_destino.coluna   [OBRIGATORIA|OPCIONAL]   ON DELETE <regra>
```

`OBRIGATORIA` = coluna de origem declarada `NOT NULL`. `OPCIONAL` = coluna nullable.
O `ON DELETE` so aparece quando a regra nao e `NO ACTION` (o padrao no banco).
Entre parenteses, no titulo de cada bloco, o numero de linhas da tabela de origem
segundo `_raw/tabelas-contagem-exata.txt`.

### ai_agent_run_steps (0 linhas, 2 FKs)

```
ai_agent_run_steps.organizacao_id -> organizacoes.id    [OBRIGATORIA]  ON DELETE CASCADE
ai_agent_run_steps.run_id         -> ai_agent_runs.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_agent_runs (0 linhas, 8 FKs)

```
ai_agent_runs.agent_id            -> ai_agents.id            [OBRIGATORIA]
ai_agent_runs.channel_session_id  -> whatsapp_sessao.id      [OPCIONAL]
ai_agent_runs.contato_id          -> contatos.id             [OPCIONAL]
ai_agent_runs.lead_id             -> leads.id                [OPCIONAL]
ai_agent_runs.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
ai_agent_runs.outbound_message_id -> whatsapp_mensagens.id   [OPCIONAL]
ai_agent_runs.source_message_id   -> whatsapp_mensagens.id   [OPCIONAL]
ai_agent_runs.version_id          -> ai_agent_versions.id    [OPCIONAL]
```

### ai_agent_versions (0 linhas, 5 FKs)

```
ai_agent_versions.agent_id           -> ai_agents.id                 [OBRIGATORIA]  ON DELETE CASCADE
ai_agent_versions.channel_session_id -> whatsapp_sessao.id           [OPCIONAL]     ON DELETE RESTRICT
ai_agent_versions.created_by_id      -> usuarios.id                  [OPCIONAL]
ai_agent_versions.credential_id      -> ai_provider_credentials.id   [OPCIONAL]     ON DELETE RESTRICT
ai_agent_versions.organizacao_id     -> organizacoes.id              [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_agents (0 linhas, 3 FKs)

```
ai_agents.created_by_id        -> usuarios.id            [OPCIONAL]
ai_agents.organizacao_id       -> organizacoes.id        [OBRIGATORIA]
ai_agents.published_version_id -> ai_agent_versions.id   [OPCIONAL]     ON DELETE SET NULL
```

### ai_alerts (0 linhas, 2 FKs)

```
ai_alerts.acknowledged_by_id -> usuarios.id       [OPCIONAL]
ai_alerts.organizacao_id     -> organizacoes.id   [OPCIONAL]     ON DELETE CASCADE
```

### ai_analysis (0 linhas, 1 FK)

```
ai_analysis.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### ai_case_events (0 linhas, 3 FKs)

```
ai_case_events.actor_user_id  -> usuarios.id       [OPCIONAL]     ON DELETE SET NULL
ai_case_events.case_id        -> ai_cases.id       [OBRIGATORIA]  ON DELETE CASCADE
ai_case_events.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_cases (0 linhas, 5 FKs)

```
ai_cases.agent_id       -> ai_agents.id       [OPCIONAL]     ON DELETE SET NULL
ai_cases.contato_id     -> contatos.id        [OBRIGATORIA]  ON DELETE CASCADE
ai_cases.lead_id        -> leads.id           [OPCIONAL]     ON DELETE SET NULL
ai_cases.organizacao_id -> organizacoes.id    [OBRIGATORIA]  ON DELETE CASCADE
ai_cases.run_id         -> ai_agent_runs.id   [OPCIONAL]     ON DELETE SET NULL
```

### ai_contact_field_proposals (0 linhas, 5 FKs)

```
ai_contact_field_proposals.contato_id           -> contatos.id             [OBRIGATORIA]  ON DELETE CASCADE
ai_contact_field_proposals.decided_by_user_id   -> usuarios.id             [OPCIONAL]     ON DELETE SET NULL
ai_contact_field_proposals.message_id           -> whatsapp_mensagens.id   [OPCIONAL]     ON DELETE SET NULL
ai_contact_field_proposals.organizacao_id       -> organizacoes.id         [OBRIGATORIA]  ON DELETE CASCADE
ai_contact_field_proposals.proposed_by_agent_id -> ai_agents.id            [OPCIONAL]     ON DELETE SET NULL
```

### ai_improvement_proposals (0 linhas, 2 FKs)

```
ai_improvement_proposals.decided_by_id  -> usuarios.id       [OPCIONAL]
ai_improvement_proposals.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_knowledge_chunks (0 linhas, 2 FKs)

```
ai_knowledge_chunks.organizacao_id -> organizacoes.id            [OBRIGATORIA]  ON DELETE CASCADE
ai_knowledge_chunks.version_id     -> ai_knowledge_versions.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_knowledge_searches (0 linhas, 3 FKs)

```
ai_knowledge_searches.knowledge_version_id -> ai_knowledge_versions.id   [OPCIONAL]     ON DELETE SET NULL
ai_knowledge_searches.organizacao_id       -> organizacoes.id            [OBRIGATORIA]  ON DELETE CASCADE
ai_knowledge_searches.run_id               -> ai_agent_runs.id           [OPCIONAL]     ON DELETE SET NULL
```

### ai_knowledge_sources (0 linhas, 2 FKs)

```
ai_knowledge_sources.created_by_id  -> usuarios.id       [OPCIONAL]
ai_knowledge_sources.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_knowledge_versions (0 linhas, 2 FKs)

```
ai_knowledge_versions.organizacao_id -> organizacoes.id           [OBRIGATORIA]  ON DELETE CASCADE
ai_knowledge_versions.source_id      -> ai_knowledge_sources.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_memory_entries (0 linhas, 2 FKs)

```
ai_memory_entries.created_by_id  -> usuarios.id       [OPCIONAL]
ai_memory_entries.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_memory_pointers (0 linhas, 2 FKs)

```
ai_memory_pointers.organizacao_id -> organizacoes.id         [OBRIGATORIA]  ON DELETE CASCADE
ai_memory_pointers.version_id     -> ai_memory_versions.id   [OBRIGATORIA]  ON DELETE RESTRICT
```

### ai_memory_versions (0 linhas, 2 FKs)

```
ai_memory_versions.created_by_id  -> usuarios.id       [OPCIONAL]
ai_memory_versions.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_provider_credentials (0 linhas, 2 FKs)

```
ai_provider_credentials.created_by_id  -> usuarios.id       [OPCIONAL]
ai_provider_credentials.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_purpose_bindings (0 linhas, 2 FKs)

```
ai_purpose_bindings.credential_id  -> ai_provider_credentials.id   [OPCIONAL]     ON DELETE SET NULL
ai_purpose_bindings.organizacao_id -> organizacoes.id              [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_router_decisions (0 linhas, 4 FKs)

```
ai_router_decisions.agent_id       -> ai_agents.id      [OPCIONAL]     ON DELETE SET NULL
ai_router_decisions.contato_id     -> contatos.id       [OPCIONAL]     ON DELETE SET NULL
ai_router_decisions.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
ai_router_decisions.router_id      -> ai_routers.id     [OPCIONAL]     ON DELETE SET NULL
```

### ai_router_members (0 linhas, 3 FKs)

```
ai_router_members.agent_id       -> ai_agents.id      [OBRIGATORIA]  ON DELETE CASCADE
ai_router_members.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
ai_router_members.router_id      -> ai_routers.id     [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_routers (0 linhas, 4 FKs)

```
ai_routers.channel_session_id -> whatsapp_sessao.id   [OBRIGATORIA]  ON DELETE CASCADE
ai_routers.created_by_id      -> usuarios.id          [OPCIONAL]
ai_routers.fallback_agent_id  -> ai_agents.id         [OPCIONAL]     ON DELETE SET NULL
ai_routers.organizacao_id     -> organizacoes.id      [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_sdr_config (0 linhas, 1 FK)

```
ai_sdr_config.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### ai_sdr_contato_state (0 linhas, 3 FKs)

```
ai_sdr_contato_state.contato_id         -> contatos.id       [OBRIGATORIA]  ON DELETE CASCADE
ai_sdr_contato_state.handoff_usuario_id -> usuarios.id       [OPCIONAL]
ai_sdr_contato_state.organizacao_id     -> organizacoes.id   [OBRIGATORIA]
```

### ai_sdr_logs (0 linhas, 1 FK)

```
ai_sdr_logs.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### ai_send_ledger (0 linhas, 2 FKs)

```
ai_send_ledger.organizacao_id -> organizacoes.id    [OBRIGATORIA]  ON DELETE CASCADE
ai_send_ledger.run_id         -> ai_agent_runs.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### ai_skill_activations (0 linhas, 3 FKs)

```
ai_skill_activations.organizacao_id   -> organizacoes.id        [OBRIGATORIA]  ON DELETE CASCADE
ai_skill_activations.run_id           -> ai_agent_runs.id       [OPCIONAL]     ON DELETE SET NULL
ai_skill_activations.skill_version_id -> ai_skill_versions.id   [OPCIONAL]     ON DELETE SET NULL
```

### ai_skill_pointers (0 linhas, 2 FKs)

```
ai_skill_pointers.organizacao_id -> organizacoes.id        [OBRIGATORIA]  ON DELETE CASCADE
ai_skill_pointers.version_id     -> ai_skill_versions.id   [OBRIGATORIA]  ON DELETE RESTRICT
```

### ai_skill_versions (0 linhas, 3 FKs)

```
ai_skill_versions.created_by_id          -> usuarios.id            [OPCIONAL]
ai_skill_versions.forked_from_version_id -> ai_skill_versions.id   [OPCIONAL]     ON DELETE SET NULL
ai_skill_versions.organizacao_id         -> organizacoes.id        [OPCIONAL]     ON DELETE CASCADE
```

### ai_usage_budgets (0 linhas, 2 FKs)

```
ai_usage_budgets.agent_id       -> ai_agents.id      [OPCIONAL]     ON DELETE CASCADE
ai_usage_budgets.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### anexos (0 linhas, 4 FKs)

```
anexos.criado_por_id  -> usuarios.id       [OPCIONAL]
anexos.negocio_id     -> negocios.id       [OPCIONAL]     ON DELETE CASCADE
anexos.nota_id        -> notas.id          [OPCIONAL]     ON DELETE CASCADE
anexos.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### anexos_legado (1.980 linhas, 1 FK)

```
anexos_legado.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### assinatura_itens (0 linhas, 3 FKs)

```
assinatura_itens.assinatura_id       -> assinaturas.id          [OBRIGATORIA]  ON DELETE CASCADE
assinatura_itens.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
assinatura_itens.servico_canonico_id -> servicos_canonicos.id   [OPCIONAL]
```

### assinaturas (355 linhas, 5 FKs)

```
assinaturas.contrato_id    -> contratos.id            [OPCIONAL]
assinaturas.empresa_id     -> empresas.id             [OPCIONAL]
assinaturas.lead_id        -> leads.id                [OPCIONAL]
assinaturas.organizacao_id -> organizacoes.id         [OPCIONAL]
assinaturas.servico_id     -> servicos_canonicos.id   [OPCIONAL]     ON DELETE SET NULL
```

### atividades (13.044 linhas, 5 FKs)

```
atividades.empresa_id     -> empresas.id       [OPCIONAL]     ON DELETE CASCADE
atividades.lead_id        -> leads.id          [OPCIONAL]
atividades.negocio_id     -> negocios.id       [OPCIONAL]
atividades.organizacao_id -> organizacoes.id   [OPCIONAL]
atividades.usuario_id     -> usuarios.id       [OPCIONAL]
```

### audit_log (21 linhas, 2 FKs)

```
audit_log.actor_id       -> usuarios.id       [OPCIONAL]
audit_log.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### auth_tokens (21 linhas, 1 FK)

```
auth_tokens.usuario_id -> usuarios.id   [OBRIGATORIA]
```

### automacao_execucoes (0 linhas, 2 FKs)

```
automacao_execucoes.automacao_id   -> automacoes.id     [OBRIGATORIA]  ON DELETE CASCADE
automacao_execucoes.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### automacoes (0 linhas, 1 FK)

```
automacoes.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### billing_audit_runs (0 linhas, 1 FK)

```
billing_audit_runs.organizacao_id -> organizacoes.id   [OPCIONAL]     ON DELETE SET NULL
```

### billing_correction_ledger (0 linhas, 3 FKs)

```
billing_correction_ledger.audit_run_id        -> billing_audit_runs.id   [OPCIONAL]     ON DELETE SET NULL
billing_correction_ledger.billing_identity_id -> billing_identities.id   [OPCIONAL]     ON DELETE SET NULL
billing_correction_ledger.organizacao_id      -> organizacoes.id         [OPCIONAL]     ON DELETE SET NULL
```

### billing_customer_aliases (2 linhas, 1 FK)

```
billing_customer_aliases.billing_identity_id -> billing_identities.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### billing_identities (224 linhas, 5 FKs)

```
billing_identities.canonical_empresa_id -> empresas.id       [OPCIONAL]     ON DELETE SET NULL
billing_identities.canonical_lead_id    -> leads.id          [OPCIONAL]     ON DELETE SET NULL
billing_identities.empresa_id           -> empresas.id       [OPCIONAL]     ON DELETE SET NULL
billing_identities.lead_id              -> leads.id          [OPCIONAL]     ON DELETE SET NULL
billing_identities.organizacao_id       -> organizacoes.id   [OBRIGATORIA]
```

### billing_resolution_cases (0 linhas, 2 FKs)

```
billing_resolution_cases.audit_run_id   -> billing_audit_runs.id   [OPCIONAL]     ON DELETE SET NULL
billing_resolution_cases.organizacao_id -> organizacoes.id         [OPCIONAL]     ON DELETE SET NULL
```

### buscas_salvas (0 linhas, 1 FK)

```
buscas_salvas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### cadence_definition_pointers (0 linhas, 4 FKs)

```
cadence_definition_pointers.cadence_definition_id -> cadence_definitions.id   [OBRIGATORIA]  ON DELETE CASCADE
cadence_definition_pointers.draft_version_id      -> cadence_versions.id      [OPCIONAL]     ON DELETE SET NULL
cadence_definition_pointers.organizacao_id        -> organizacoes.id          [OBRIGATORIA]  ON DELETE CASCADE
cadence_definition_pointers.published_version_id  -> cadence_versions.id      [OPCIONAL]     ON DELETE SET NULL
```

### cadence_definitions (0 linhas, 1 FK)

```
cadence_definitions.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### cadence_enrollment_events (0 linhas, 1 FK)

```
cadence_enrollment_events.enrollment_id -> cadence_enrollments.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### cadence_enrollments (0 linhas, 4 FKs)

```
cadence_enrollments.cadence_definition_id -> cadence_definitions.id   [OBRIGATORIA]  ON DELETE CASCADE
cadence_enrollments.cadence_version_id    -> cadence_versions.id      [OPCIONAL]     ON DELETE RESTRICT
cadence_enrollments.organizacao_id        -> organizacoes.id          [OBRIGATORIA]
cadence_enrollments.source_event_id       -> event_outbox.id          [OPCIONAL]     ON DELETE SET NULL
```

### cadence_versions (0 linhas, 3 FKs)

```
cadence_versions.cadence_definition_id -> cadence_definitions.id   [OBRIGATORIA]  ON DELETE CASCADE
cadence_versions.created_by_id         -> usuarios.id              [OPCIONAL]
cadence_versions.organizacao_id        -> organizacoes.id          [OBRIGATORIA]  ON DELETE CASCADE
```

### cadencia_execucoes (1.273 linhas, 4 FKs)

```
cadencia_execucoes.enviado_por_id -> usuarios.id          [OPCIONAL]
cadencia_execucoes.lead_id        -> leads.id             [OBRIGATORIA]
cadencia_execucoes.organizacao_id -> organizacoes.id      [OBRIGATORIA]
cadencia_execucoes.sessao_id      -> whatsapp_sessao.id   [OPCIONAL]
```

### callface_ai_reconciliation_candidates (0 linhas, 1 FK)

```
callface_ai_reconciliation_candidates.empresa_id -> empresas.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### callface_ai_tenant_snapshots (0 linhas, 1 FK)

```
callface_ai_tenant_snapshots.external_identity_id -> callface_ai_external_identities.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### callface_ai_usage_events (0 linhas, 1 FK)

```
callface_ai_usage_events.external_identity_id -> callface_ai_external_identities.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### campanhas (18 linhas, 1 FK)

```
campanhas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### catalogo_mapeamentos_legacy (193 linhas, 3 FKs)

```
catalogo_mapeamentos_legacy.canonical_product_id -> servicos_catalogo.id   [OPCIONAL]     ON DELETE SET NULL
catalogo_mapeamentos_legacy.organizacao_id       -> organizacoes.id        [OBRIGATORIA]
catalogo_mapeamentos_legacy.revisado_por         -> usuarios.id            [OPCIONAL]
```

### catalogo_precos (0 linhas, 2 FKs)

```
catalogo_precos.organizacao_id      -> organizacoes.id        [OBRIGATORIA]
catalogo_precos.servico_catalogo_id -> servicos_catalogo.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### checkouts (0 linhas, 5 FKs)

```
checkouts.criado_por_id      -> usuarios.id                   [OPCIONAL]
checkouts.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
checkouts.negocio_id         -> negocios.id                   [OPCIONAL]
checkouts.organizacao_id     -> organizacoes.id               [OBRIGATORIA]
checkouts.proposta_id        -> propostas.id                  [OBRIGATORIA]
```

### cliente_receita_mensal (0 linhas, 2 FKs)

```
cliente_receita_mensal.empresa_id     -> empresas.id       [OPCIONAL]     ON DELETE SET NULL
cliente_receita_mensal.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### clientes (275 linhas, 6 FKs)

```
clientes.empresa_id             -> empresas.id        [OPCIONAL]
clientes.lead_id_legado         -> leads.id           [OPCIONAL]
clientes.oportunidade_origem_id -> oportunidades.id   [OPCIONAL]
clientes.organizacao_id         -> organizacoes.id    [OBRIGATORIA]
clientes.pessoa_principal_id    -> pessoas.id         [OPCIONAL]
clientes.responsavel_id         -> usuarios.id        [OPCIONAL]
```

### closer_bloqueios (0 linhas, 2 FKs)

```
closer_bloqueios.organizacao_id -> organizacoes.id   [OBRIGATORIA]
closer_bloqueios.usuario_id     -> usuarios.id       [OBRIGATORIA]
```

### closer_disponibilidade (0 linhas, 2 FKs)

```
closer_disponibilidade.organizacao_id -> organizacoes.id   [OBRIGATORIA]
closer_disponibilidade.usuario_id     -> usuarios.id       [OBRIGATORIA]
```

### comercial_evidencia (0 linhas, 4 FKs)

```
comercial_evidencia.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
comercial_evidencia.negocio_id         -> negocios.id                   [OBRIGATORIA]  ON DELETE CASCADE
comercial_evidencia.organizacao_id     -> organizacoes.id               [OBRIGATORIA]
comercial_evidencia.verificado_por     -> usuarios.id                   [OPCIONAL]
```

### communications (0 linhas, 3 FKs)

```
communications.organizacao_id -> organizacoes.id   [OBRIGATORIA]
communications.pessoa_id      -> pessoas.id        [OPCIONAL]
communications.usuario_id     -> usuarios.id       [OPCIONAL]
```

### contato_labels (0 linhas, 2 FKs)

```
contato_labels.contato_id -> contatos.id   [OBRIGATORIA]  ON DELETE CASCADE
contato_labels.label_id   -> labels.id     [OBRIGATORIA]  ON DELETE CASCADE
```

### contato_listas (0 linhas, 1 FK)

```
contato_listas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### contatos (1.663 linhas, 7 FKs)

```
contatos.active_ai_agent_id -> ai_agents.id         [OPCIONAL]     ON DELETE SET NULL
contatos.closed_by_id       -> usuarios.id          [OPCIONAL]
contatos.conta_id           -> email_contas.id      [OPCIONAL]
contatos.lead_id            -> leads.id             [OPCIONAL]
contatos.organizacao_id     -> organizacoes.id      [OBRIGATORIA]
contatos.responsavel_id     -> usuarios.id          [OPCIONAL]
contatos.sessao_id          -> whatsapp_sessao.id   [OPCIONAL]
```

### contrato_itens (487 linhas, 2 FKs)

```
contrato_itens.contrato_id         -> contratos.id           [OPCIONAL]     ON DELETE CASCADE
contrato_itens.servico_catalogo_id -> servicos_catalogo.id   [OPCIONAL]
```

### contrato_templates (3 linhas, 1 FK)

```
contrato_templates.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### contratos (742 linhas, 5 FKs)

```
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
contratos.lead_id            -> leads.id                      [OBRIGATORIA]
contratos.negocio_id         -> negocios.id                   [OPCIONAL]
contratos.organizacao_id     -> organizacoes.id               [OPCIONAL]
contratos.template_id        -> contrato_templates.id         [OPCIONAL]
```

### correction_change_log (30.876 linhas, 1 FK)

```
correction_change_log.run_id -> correction_runs.id   [OBRIGATORIA]
```

### cs_cancelamentos (0 linhas, 6 FKs)

```
cs_cancelamentos.contrato_id         -> contratos.id            [OPCIONAL]     ON DELETE SET NULL
cs_cancelamentos.decidido_por        -> usuarios.id             [OPCIONAL]
cs_cancelamentos.empresa_id          -> empresas.id             [OBRIGATORIA]  ON DELETE CASCADE
cs_cancelamentos.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
cs_cancelamentos.servico_canonico_id -> servicos_canonicos.id   [OPCIONAL]     ON DELETE SET NULL
cs_cancelamentos.solicitado_por      -> usuarios.id             [OPCIONAL]
```

### cs_marcos (0 linhas, 5 FKs)

```
cs_marcos.concluido_por       -> usuarios.id             [OPCIONAL]
cs_marcos.empresa_id          -> empresas.id             [OBRIGATORIA]  ON DELETE CASCADE
cs_marcos.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
cs_marcos.servico_canonico_id -> servicos_canonicos.id   [OPCIONAL]     ON DELETE CASCADE
cs_marcos.tarefa_id           -> tarefas.id              [OPCIONAL]     ON DELETE SET NULL
```

### cs_renovacoes (0 linhas, 7 FKs)

```
cs_renovacoes.contrato_id         -> contratos.id            [OPCIONAL]     ON DELETE SET NULL
cs_renovacoes.decidido_por        -> usuarios.id             [OPCIONAL]
cs_renovacoes.empresa_id          -> empresas.id             [OBRIGATORIA]  ON DELETE CASCADE
cs_renovacoes.negocio_id          -> negocios.id             [OPCIONAL]     ON DELETE SET NULL
cs_renovacoes.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
cs_renovacoes.responsavel_id      -> usuarios.id             [OPCIONAL]
cs_renovacoes.servico_canonico_id -> servicos_canonicos.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### cs_riscos (514 linhas, 7 FKs)

```
cs_riscos.aberto_por          -> usuarios.id             [OPCIONAL]
cs_riscos.empresa_id          -> empresas.id             [OBRIGATORIA]  ON DELETE CASCADE
cs_riscos.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
cs_riscos.resolvido_por       -> usuarios.id             [OPCIONAL]
cs_riscos.responsavel_id      -> usuarios.id             [OPCIONAL]
cs_riscos.servico_canonico_id -> servicos_canonicos.id   [OPCIONAL]     ON DELETE SET NULL
cs_riscos.tarefa_id           -> tarefas.id              [OPCIONAL]     ON DELETE SET NULL
```

### custom_fields (0 linhas, 1 FK)

```
custom_fields.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### documentos_atendimento (0 linhas, 1 FK)

```
documentos_atendimento.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### email_contas (8 linhas, 2 FKs)

```
email_contas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
email_contas.usuario_id     -> usuarios.id       [OBRIGATORIA]
```

### email_sequencia_execucoes (0 linhas, 3 FKs)

```
email_sequencia_execucoes.conta_id     -> email_contas.id       [OBRIGATORIA]
email_sequencia_execucoes.lead_id      -> leads.id              [OBRIGATORIA]
email_sequencia_execucoes.sequencia_id -> email_sequencias.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### email_sequencia_passos (0 linhas, 2 FKs)

```
email_sequencia_passos.sequencia_id -> email_sequencias.id   [OBRIGATORIA]  ON DELETE CASCADE
email_sequencia_passos.template_id  -> email_templates.id    [OPCIONAL]
```

### email_sequencias (0 linhas, 1 FK)

```
email_sequencias.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### email_templates (1 linhas, 1 FK)

```
email_templates.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### emails (4.460 linhas, 4 FKs)

```
emails.conta_id       -> email_contas.id   [OPCIONAL]
emails.enviado_por_id -> usuarios.id       [OPCIONAL]
emails.lead_id        -> leads.id          [OPCIONAL]
emails.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### empresas (2.199 linhas, 2 FKs)

```
empresas.canonical_empresa_id -> empresas.id       [OPCIONAL]     ON DELETE SET NULL
empresas.organizacao_id       -> organizacoes.id   [OBRIGATORIA]
```

### entity_labels (161 linhas, 3 FKs)

```
entity_labels.created_by_id  -> usuarios.id       [OPCIONAL]     ON DELETE SET NULL
entity_labels.label_id       -> labels.id         [OBRIGATORIA]  ON DELETE CASCADE
entity_labels.organizacao_id -> organizacoes.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### event_outbox (0 linhas, 1 FK)

```
event_outbox.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### eventos (0 linhas, 1 FK)

```
eventos.lead_id -> leads.id   [OPCIONAL]
```

### eventos_comerciais (247 linhas, 5 FKs)

```
eventos_comerciais.contrato_id    -> contratos.id            [OPCIONAL]
eventos_comerciais.negocio_id     -> negocios.id             [OPCIONAL]
eventos_comerciais.organizacao_id -> organizacoes.id         [OBRIGATORIA]
eventos_comerciais.responsavel_id -> usuarios.id             [OPCIONAL]
eventos_comerciais.servico_id     -> servicos_canonicos.id   [OPCIONAL]     ON DELETE SET NULL
```

### fatura_itens (226 linhas, 3 FKs)

```
fatura_itens.fatura_id           -> faturas.id              [OBRIGATORIA]  ON DELETE CASCADE
fatura_itens.servico_catalogo_id -> servicos_catalogo.id    [OPCIONAL]     ON DELETE SET NULL
fatura_itens.servico_id          -> servicos_canonicos.id   [OPCIONAL]     ON DELETE SET NULL
```

### faturas (951 linhas, 9 FKs)

```
faturas.acionado_por        -> usuarios.id                   [OPCIONAL]
faturas.assinatura_id       -> assinaturas.id                [OPCIONAL]
faturas.contrato_id         -> contratos.id                  [OPCIONAL]
faturas.empresa_id          -> empresas.id                   [OPCIONAL]
faturas.grupo_comercial_id  -> proposta_grupo_comercial.id   [OPCIONAL]
faturas.lead_id             -> leads.id                      [OPCIONAL]
faturas.negocio_id          -> negocios.id                   [OPCIONAL]
faturas.organizacao_id      -> organizacoes.id               [OPCIONAL]
faturas.servico_canonico_id -> servicos_canonicos.id         [OPCIONAL]
```

### fulfillment_formularios (3 linhas, 3 FKs)

```
fulfillment_formularios.fulfillment_id -> fulfillments.id   [OBRIGATORIA]  ON DELETE CASCADE
fulfillment_formularios.organizacao_id -> organizacoes.id   [OBRIGATORIA]
fulfillment_formularios.revisado_por   -> usuarios.id       [OPCIONAL]
```

### fulfillment_itens (1.659 linhas, 4 FKs)

```
fulfillment_itens.completed_by   -> usuarios.id       [OPCIONAL]
fulfillment_itens.fulfillment_id -> fulfillments.id   [OBRIGATORIA]  ON DELETE CASCADE
fulfillment_itens.organizacao_id -> organizacoes.id   [OBRIGATORIA]
fulfillment_itens.responsavel_id -> usuarios.id       [OPCIONAL]
```

### fulfillment_linhas_portabilidade (3 linhas, 2 FKs)

```
fulfillment_linhas_portabilidade.fulfillment_id -> fulfillments.id   [OBRIGATORIA]  ON DELETE CASCADE
fulfillment_linhas_portabilidade.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### fulfillment_ramais (6 linhas, 2 FKs)

```
fulfillment_ramais.fulfillment_id -> fulfillments.id   [OBRIGATORIA]  ON DELETE CASCADE
fulfillment_ramais.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### fulfillments (25 linhas, 3 FKs)

```
fulfillments.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
fulfillments.responsavel_id      -> usuarios.id             [OPCIONAL]
fulfillments.servico_canonico_id -> servicos_canonicos.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### labels (3 linhas, 1 FK)

```
labels.organizacao_id -> organizacoes.id   [OPCIONAL]
```

### lead_labels (161 linhas, 2 FKs)

```
lead_labels.label_id -> labels.id   [OPCIONAL]     ON DELETE CASCADE
lead_labels.lead_id  -> leads.id    [OPCIONAL]     ON DELETE CASCADE
```

### lead_listas (0 linhas, 2 FKs)

```
lead_listas.lead_id  -> leads.id            [OPCIONAL]     ON DELETE CASCADE
lead_listas.lista_id -> contato_listas.id   [OPCIONAL]     ON DELETE CASCADE
```

### lead_user_unread (217 linhas, 2 FKs)

```
lead_user_unread.lead_id    -> leads.id      [OBRIGATORIA]  ON DELETE CASCADE
lead_user_unread.usuario_id -> usuarios.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### leads (3.989 linhas, 9 FKs)

```
leads.agenda_closer_id          -> usuarios.id       [OPCIONAL]
leads.desqualificado_por        -> usuarios.id       [OPCIONAL]
leads.empresa_id                -> empresas.id       [OPCIONAL]
leads.nutrido_por               -> usuarios.id       [OPCIONAL]
leads.organizacao_id            -> organizacoes.id   [OBRIGATORIA]
leads.pre_qualificado_por       -> usuarios.id       [OPCIONAL]
leads.prospeccao_descartado_por -> usuarios.id       [OPCIONAL]
leads.qualificado_por           -> usuarios.id       [OPCIONAL]
leads.responsavel_id            -> usuarios.id       [OPCIONAL]
```

### legacy_provenance (5.064 linhas, 1 FK)

```
legacy_provenance.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### ligacoes (4.938 linhas, 4 FKs)

```
ligacoes.lead_id        -> leads.id          [OPCIONAL]
ligacoes.negocio_id     -> negocios.id       [OPCIONAL]
ligacoes.organizacao_id -> organizacoes.id   [OBRIGATORIA]
ligacoes.usuario_id     -> usuarios.id       [OPCIONAL]
```

### metas (13 linhas, 3 FKs)

```
metas.criado_por     -> usuarios.id       [OPCIONAL]
metas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
metas.usuario_id     -> usuarios.id       [OBRIGATORIA]
```

### metricas_diarias (1 linhas, 1 FK)

```
metricas_diarias.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### mrr_movimentos (665 linhas, 4 FKs)

```
mrr_movimentos.assinatura_id  -> assinaturas.id    [OPCIONAL]
mrr_movimentos.contrato_id    -> contratos.id      [OPCIONAL]
mrr_movimentos.lead_id        -> leads.id          [OPCIONAL]
mrr_movimentos.organizacao_id -> organizacoes.id   [OPCIONAL]
```

### negocio_labels (0 linhas, 2 FKs)

```
negocio_labels.label_id   -> labels.id     [OBRIGATORIA]  ON DELETE CASCADE
negocio_labels.negocio_id -> negocios.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### negocio_leads (1.199 linhas, 2 FKs)

```
negocio_leads.lead_id    -> leads.id      [OBRIGATORIA]  ON DELETE CASCADE
negocio_leads.negocio_id -> negocios.id   [OBRIGATORIA]  ON DELETE CASCADE
```

### negocios (1.562 linhas, 8 FKs)

```
negocios.bundle_id                   -> oportunidade_bundle.id   [OPCIONAL]
negocios.empresa_id                  -> empresas.id              [OPCIONAL]
negocios.lead_id                     -> leads.id                 [OPCIONAL]
negocios.organizacao_id              -> organizacoes.id          [OBRIGATORIA]
negocios.pipeline_id                 -> pipelines.id             [OPCIONAL]
negocios.proxima_acao_responsavel_id -> usuarios.id              [OPCIONAL]
negocios.responsavel_id              -> usuarios.id              [OPCIONAL]
negocios.servico_origem_id           -> servicos_canonicos.id    [OPCIONAL]     ON DELETE SET NULL
```

### notas (5.002 linhas, 7 FKs)

```
notas.autor_id       -> usuarios.id       [OPCIONAL]
notas.cliente_id     -> clientes.id       [OPCIONAL]     ON DELETE CASCADE
notas.empresa_id     -> empresas.id       [OPCIONAL]     ON DELETE CASCADE
notas.lead_id        -> leads.id          [OPCIONAL]     ON DELETE CASCADE
notas.negocio_id     -> negocios.id       [OPCIONAL]     ON DELETE CASCADE
notas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
notas.reuniao_id     -> reunioes.id       [OPCIONAL]     ON DELETE CASCADE
```

### notificacoes (3.203 linhas, 1 FK)

```
notificacoes.usuario_id -> usuarios.id   [OPCIONAL]
```

### nps_respostas (0 linhas, 6 FKs)

```
nps_respostas.contrato_id    -> contratos.id      [OPCIONAL]
nps_respostas.empresa_id     -> empresas.id       [OPCIONAL]     ON DELETE CASCADE
nps_respostas.lead_id        -> leads.id          [OPCIONAL]
nps_respostas.marco_id       -> cs_marcos.id      [OPCIONAL]     ON DELETE SET NULL
nps_respostas.organizacao_id -> organizacoes.id   [OPCIONAL]
nps_respostas.registrado_por -> usuarios.id       [OPCIONAL]
```

### oportunidade_bundle (0 linhas, 3 FKs)

```
oportunidade_bundle.empresa_id     -> empresas.id       [OPCIONAL]
oportunidade_bundle.lead_id        -> leads.id          [OPCIONAL]
oportunidade_bundle.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### oportunidade_itens (0 linhas, 7 FKs)

```
oportunidade_itens.catalogo_preco_id       -> catalogo_precos.id            [OPCIONAL]
oportunidade_itens.contrato_item_id_legado -> contrato_itens.id             [OPCIONAL]
oportunidade_itens.grupo_comercial_id      -> proposta_grupo_comercial.id   [OPCIONAL]
oportunidade_itens.oportunidade_id         -> oportunidades.id              [OBRIGATORIA]  ON DELETE CASCADE
oportunidade_itens.organizacao_id          -> organizacoes.id               [OBRIGATORIA]
oportunidade_itens.proposta_item_id_legado -> proposta_itens.id             [OPCIONAL]
oportunidade_itens.servico_canonico_id     -> servicos_canonicos.id         [OPCIONAL]
```

### oportunidades (0 linhas, 8 FKs)

```
oportunidades.bundle_id         -> oportunidade_bundle.id   [OPCIONAL]
oportunidades.empresa_id        -> empresas.id              [OPCIONAL]
oportunidades.lead_id           -> leads.id                 [OPCIONAL]
oportunidades.negocio_id_legado -> negocios.id              [OPCIONAL]
oportunidades.organizacao_id    -> organizacoes.id          [OBRIGATORIA]
oportunidades.pessoa_id         -> pessoas.id               [OPCIONAL]
oportunidades.pipeline_id       -> pipelines.id             [OPCIONAL]
oportunidades.responsavel_id    -> usuarios.id              [OPCIONAL]
```

### outreach_campanhas (0 linhas, 2 FKs)

```
outreach_campanhas.created_by     -> usuarios.id       [OPCIONAL]
outreach_campanhas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### pessoa_empresa_vinculos (0 linhas, 3 FKs)

```
pessoa_empresa_vinculos.empresa_id     -> empresas.id       [OBRIGATORIA]  ON DELETE CASCADE
pessoa_empresa_vinculos.organizacao_id -> organizacoes.id   [OBRIGATORIA]
pessoa_empresa_vinculos.pessoa_id      -> pessoas.id        [OBRIGATORIA]  ON DELETE CASCADE
```

### pessoas (0 linhas, 3 FKs)

```
pessoas.empresa_id     -> empresas.id       [OPCIONAL]
pessoas.lead_id_legado -> leads.id          [OPCIONAL]
pessoas.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### pipelines (2 linhas, 1 FK)

```
pipelines.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### pontos_contato (0 linhas, 4 FKs)

```
pontos_contato.empresa_id     -> empresas.id       [OPCIONAL]
pontos_contato.lead_id_legado -> leads.id          [OPCIONAL]
pontos_contato.organizacao_id -> organizacoes.id   [OBRIGATORIA]
pontos_contato.pessoa_id      -> pessoas.id        [OPCIONAL]
```

### portfolio_snapshots (3 linhas, 1 FK)

```
portfolio_snapshots.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### proposta_grupo_comercial (0 linhas, 5 FKs)

```
proposta_grupo_comercial.checkout_id    -> checkouts.id      [OPCIONAL]
proposta_grupo_comercial.contrato_id    -> contratos.id      [OPCIONAL]
proposta_grupo_comercial.negocio_id     -> negocios.id       [OPCIONAL]
proposta_grupo_comercial.organizacao_id -> organizacoes.id   [OBRIGATORIA]
proposta_grupo_comercial.proposta_id    -> propostas.id      [OBRIGATORIA]
```

### proposta_grupo_comercial_itens (0 linhas, 2 FKs)

```
proposta_grupo_comercial_itens.grupo_id         -> proposta_grupo_comercial.id   [OBRIGATORIA]  ON DELETE CASCADE
proposta_grupo_comercial_itens.proposta_item_id -> proposta_itens.id             [OBRIGATORIA]
```

### proposta_itens (2.701 linhas, 3 FKs)

```
proposta_itens.catalogo_preco_id   -> catalogo_precos.id     [OPCIONAL]
proposta_itens.proposta_id         -> propostas.id           [OBRIGATORIA]  ON DELETE CASCADE
proposta_itens.servico_catalogo_id -> servicos_catalogo.id   [OPCIONAL]
```

### propostas (1.550 linhas, 7 FKs)

```
propostas.contrato_base_id   -> contratos.id      [OPCIONAL]
propostas.contrato_id        -> contratos.id      [OPCIONAL]
propostas.criado_por_id      -> usuarios.id       [OPCIONAL]
propostas.lead_id            -> leads.id          [OBRIGATORIA]
propostas.negocio_id         -> negocios.id       [OPCIONAL]
propostas.organizacao_id     -> organizacoes.id   [OBRIGATORIA]
propostas.substituida_por_id -> propostas.id      [OPCIONAL]
```

### reconciliation_changes (413 linhas, 1 FK)

```
reconciliation_changes.run_id -> reconciliation_runs.id   [OBRIGATORIA]
```

### reconciliation_runs (1 linhas, 1 FK)

```
reconciliation_runs.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### reunioes (295 linhas, 4 FKs)

```
reunioes.lead_id        -> leads.id          [OPCIONAL]
reunioes.negocio_id     -> negocios.id       [OPCIONAL]
reunioes.organizacao_id -> organizacoes.id   [OBRIGATORIA]
reunioes.responsavel_id -> usuarios.id       [OPCIONAL]
```

### scripts_atendimento (6 linhas, 1 FK)

```
scripts_atendimento.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### sdr_memory (0 linhas, 1 FK)

```
sdr_memory.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### service_ledger_batches (1 linhas, 1 FK)

```
service_ledger_batches.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### service_ledger_entries (302 linhas, 3 FKs)

```
service_ledger_entries.batch_id       -> service_ledger_batches.id   [OBRIGATORIA]
service_ledger_entries.organizacao_id -> organizacoes.id             [OBRIGATORIA]
service_ledger_entries.service_id     -> servicos_canonicos.id       [OPCIONAL]     ON DELETE SET NULL
```

### servico_billing_timeline (144 linhas, 6 FKs)

```
servico_billing_timeline.assinatura_id  -> assinaturas.id          [OPCIONAL]     ON DELETE SET NULL
servico_billing_timeline.contrato_id    -> contratos.id            [OPCIONAL]     ON DELETE SET NULL
servico_billing_timeline.empresa_id     -> empresas.id             [OPCIONAL]     ON DELETE SET NULL
servico_billing_timeline.lead_id        -> leads.id                [OPCIONAL]     ON DELETE SET NULL
servico_billing_timeline.organizacao_id -> organizacoes.id         [OBRIGATORIA]
servico_billing_timeline.servico_id     -> servicos_canonicos.id   [OPCIONAL]     ON DELETE SET NULL
```

### servicos_canonicos (438 linhas, 4 FKs)

```
servicos_canonicos.contrato_id    -> contratos.id      [OPCIONAL]     ON DELETE SET NULL
servicos_canonicos.empresa_id     -> empresas.id       [OPCIONAL]     ON DELETE SET NULL
servicos_canonicos.lead_id        -> leads.id          [OPCIONAL]     ON DELETE SET NULL
servicos_canonicos.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### servicos_catalogo (220 linhas, 1 FK)

```
servicos_catalogo.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### status_changes (5.923 linhas, 3 FKs)

```
status_changes.lead_id    -> leads.id      [OPCIONAL]
status_changes.negocio_id -> negocios.id   [OPCIONAL]
status_changes.usuario_id -> usuarios.id   [OPCIONAL]
```

### stripe_webhook_events (105 linhas, 1 FK)

```
stripe_webhook_events.organizacao_id -> organizacoes.id   [OPCIONAL]
```

### tarefas (462 linhas, 6 FKs)

```
tarefas.empresa_id          -> empresas.id             [OPCIONAL]     ON DELETE CASCADE
tarefas.lead_id             -> leads.id                [OPCIONAL]
tarefas.negocio_id          -> negocios.id             [OPCIONAL]
tarefas.organizacao_id      -> organizacoes.id         [OBRIGATORIA]
tarefas.servico_canonico_id -> servicos_canonicos.id   [OPCIONAL]     ON DELETE SET NULL
tarefas.usuario_id          -> usuarios.id             [OPCIONAL]
```

### teams (0 linhas, 2 FKs)

```
teams.manager_id     -> usuarios.id       [OPCIONAL]
teams.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### usuarios (16 linhas, 2 FKs)

```
usuarios.organizacao_id -> organizacoes.id   [OBRIGATORIA]
usuarios.team_id        -> teams.id          [OPCIONAL]
```

### vendas_eventos (0 linhas, 8 FKs)

```
vendas_eventos.empresa_id     -> empresas.id       [OPCIONAL]     ON DELETE CASCADE
vendas_eventos.lead_id        -> leads.id          [OPCIONAL]     ON DELETE CASCADE
vendas_eventos.negocio_id     -> negocios.id       [OPCIONAL]     ON DELETE CASCADE
vendas_eventos.organizacao_id -> organizacoes.id   [OBRIGATORIA]
vendas_eventos.pessoa_id      -> pessoas.id        [OPCIONAL]     ON DELETE CASCADE
vendas_eventos.proposta_id    -> propostas.id      [OPCIONAL]     ON DELETE CASCADE
vendas_eventos.reuniao_id     -> reunioes.id       [OPCIONAL]     ON DELETE SET NULL
vendas_eventos.usuario_id     -> usuarios.id       [OPCIONAL]
```

### whatsapp_mensagens (25.363 linhas, 3 FKs)

```
whatsapp_mensagens.enviado_por_id -> usuarios.id          [OPCIONAL]
whatsapp_mensagens.lead_id        -> leads.id             [OPCIONAL]
whatsapp_mensagens.sessao_id      -> whatsapp_sessao.id   [OPCIONAL]
```

### whatsapp_sessao (7 linhas, 2 FKs)

```
whatsapp_sessao.organizacao_id -> organizacoes.id   [OBRIGATORIA]
whatsapp_sessao.usuario_id     -> usuarios.id       [OPCIONAL]
```

### whatsapp_templates (1 linhas, 1 FK)

```
whatsapp_templates.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

### won_evidence_policies (3 linhas, 1 FK)

```
won_evidence_policies.organizacao_id -> organizacoes.id   [OBRIGATORIA]
```

## 2. Tabelas muito referenciadas

Ranking completo de `_raw/mais-referenciadas.txt`, cruzado com a contagem de linhas.
A coluna "referencias" conta quantas foreign keys apontam para a tabela, nao quantas
linhas apontam.

| # | Tabela | Referencias recebidas | Linhas na tabela |
|---:|---|---:|---:|
| 1 | `organizacoes` | 120 | 1 |
| 2 | `usuarios` | 71 | 16 |
| 3 | `leads` | 35 | 3.989 |
| 4 | `empresas` | 26 | 2.199 |
| 5 | `negocios` | 19 | 1.562 |
| 6 | `servicos_canonicos` | 15 | 438 |
| 7 | `contratos` | 13 | 742 |
| 8 | `ai_agents` | 9 | 0 |
| 9 | `whatsapp_sessao` | 6 | 7 |
| 10 | `proposta_grupo_comercial` | 6 | 0 |
| 11 | `pessoas` | 6 | 0 |
| 12 | `contatos` | 6 | 1.663 |
| 13 | `servicos_catalogo` | 5 | 220 |
| 14 | `propostas` | 5 | 1.550 |
| 15 | `ai_agent_runs` | 5 | 0 |
| 16 | `labels` | 4 | 3 |
| 17 | `fulfillments` | 4 | 25 |
| 18 | `assinaturas` | 4 | 355 |
| 19 | `whatsapp_mensagens` | 3 | 25.363 |
| 20 | `email_contas` | 3 | 8 |
| 21 | `cadence_versions` | 3 | 0 |
| 22 | `cadence_definitions` | 3 | 0 |
| 23 | `ai_skill_versions` | 3 | 0 |
| 24 | `tarefas` | 2 | 462 |
| 25 | `reunioes` | 2 | 295 |
| 26 | `proposta_itens` | 2 | 2.701 |
| 27 | `pipelines` | 2 | 2 |
| 28 | `oportunidades` | 2 | 0 |
| 29 | `oportunidade_bundle` | 2 | 0 |
| 30 | `email_sequencias` | 2 | 0 |
| 31 | `catalogo_precos` | 2 | 0 |
| 32 | `callface_ai_external_identities` | 2 | 0 |
| 33 | `billing_identities` | 2 | 224 |
| 34 | `billing_audit_runs` | 2 | 0 |
| 35 | `ai_routers` | 2 | 0 |
| 36 | `ai_provider_credentials` | 2 | 0 |
| 37 | `ai_knowledge_versions` | 2 | 0 |
| 38 | `ai_agent_versions` | 2 | 0 |
| 39 | `teams` | 1 | 0 |
| 40 | `service_ledger_batches` | 1 | 1 |
| 41 | `reconciliation_runs` | 1 | 1 |
| 42 | `notas` | 1 | 5.002 |
| 43 | `faturas` | 1 | 951 |
| 44 | `event_outbox` | 1 | 0 |
| 45 | `email_templates` | 1 | 1 |
| 46 | `cs_marcos` | 1 | 0 |
| 47 | `correction_runs` | 1 | 6 |
| 48 | `contrato_templates` | 1 | 3 |
| 49 | `contrato_itens` | 1 | 487 |
| 50 | `contato_listas` | 1 | 0 |
| 51 | `clientes` | 1 | 275 |
| 52 | `checkouts` | 1 | 0 |
| 53 | `cadence_enrollments` | 1 | 0 |
| 54 | `automacoes` | 1 | 0 |
| 55 | `ai_memory_versions` | 1 | 0 |
| 56 | `ai_knowledge_sources` | 1 | 0 |
| 57 | `ai_cases` | 1 | 0 |

Leitura estrutural dos numeros:

- `organizacoes` recebe **120** das 423 FKs, ou seja 28,4% de todas as relacoes do banco
  terminam nela. Das 151 tabelas, 120 carregam uma coluna que aponta para `organizacoes`.
  Estruturalmente isso e uma coluna de tenancy replicada em quase todo o schema: a
  organizacao nao e um no do dominio comercial, e um eixo que atravessa o schema inteiro.
  Nenhuma tabela aponta duas vezes para `organizacoes`: sao 120 tabelas distintas.
  A tabela tem **1 linha** (`_raw/tabelas-contagem-exata.txt`), entao no estado atual todas
  as 120 colunas convergem para o mesmo valor. O grafo foi desenhado para multi-tenant e
  o dado carregado e single-tenant.
- `usuarios` recebe **71** FKs com 16 linhas, distribuidas em 33 nomes de coluna
  diferentes. Os mais frequentes: `usuario_id` (14), `responsavel_id` (11),
  `created_by_id` (10), `criado_por_id` (3), `enviado_por_id` (3). O restante sao nomes
  de uso unico (`desqualificado_por`, `nutrido_por`, `pre_qualificado_por`,
  `prospeccao_descartado_por`, `agenda_closer_id`, e outros). Estruturalmente e a segunda
  coluna transversal do schema: autoria e responsabilidade, nao no de dominio. Nao ha
  padrao unico de nomenclatura: convivem `created_by_id`, `criado_por_id`, `created_by`
  e `criado_por` como nomes distintos para a mesma relacao. Reproducao:
  `awk -F'|' '$3=="usuarios"{print $2}' _raw/foreign-keys.txt | sort | uniq -c | sort -rn`.
- Descontando essas duas, o grafo de dominio propriamente dito tem topo em `leads` (35),
  `empresas` (26), `negocios` (19), `servicos_canonicos` (15) e `contratos` (13). Esses
  cinco concentram 108 FKs e sao os pontos em que o resto do schema se pendura.
- Ha assimetria clara entre grau e volume. `ai_agents` recebe 9 FKs com 0 linhas,
  `proposta_grupo_comercial` recebe 6 com 0 linhas e `pessoas` recebe 6 com 0 linhas.
  Sao sub-grafos estruturados e vazios. No outro extremo, `whatsapp_mensagens` tem 25.363
  linhas e recebe apenas 3 FKs, e `labels` tem 3 linhas recebendo 4 FKs.
- Apenas 57 das 151 tabelas recebem alguma FK. As outras 94 sao folhas: so apontam.

## 3. Entidades que funcionam como raiz

Criterio usado, aplicado sobre `_raw/foreign-keys.txt`: uma tabela e raiz quando nao
emite nenhuma foreign key, ou quando a unica FK que emite aponta para `organizacoes`.
Reproducao: `cut -d'|' -f1 _raw/foreign-keys.txt | sort -u` da as 144 tabelas que emitem
FK; o complemento das 151 da as que nao emitem.

### 3.1 Raizes puras, nao dependem de ninguem

Sete tabelas nao aparecem como origem em nenhuma das 423 FKs. Tres delas recebem FK e
por isso sao raiz do grafo; as outras quatro nao recebem nem emitem e estao na secao 6.

| Tabela | FKs emitidas | FKs recebidas | Linhas |
|---|---:|---:|---:|
| `callface_ai_external_identities` | 0 | 2 | 0 |
| `correction_runs` | 0 | 1 | 6 |
| `organizacoes` | 0 | 120 | 1 |

Comprovacao das referencias recebidas por cada uma:

```
organizacoes                     <- 120 FKs (ver secao 2)
callface_ai_external_identities  <- callface_ai_tenant_snapshots.external_identity_id
                                 <- callface_ai_usage_events.external_identity_id
correction_runs                  <- correction_change_log.run_id
```

`organizacoes` e a unica raiz do grafo comercial: 120 tabelas dependem dela e ela nao
depende de nenhuma. `callface_ai_external_identities` (0 linhas) e raiz de um sub-grafo
de tres tabelas; `correction_runs` (6 linhas) e raiz do sub-grafo de correcao, com
`correction_change_log` (30.876 linhas) pendurado nela.

### 3.2 Raizes de dominio, dependem apenas de `organizacoes`

Trinta tabelas emitem FK, e o unico destino dessas FKs e `organizacoes`. Descontado o
eixo de tenancy, elas nao dependem de nenhuma entidade de negocio.

| Tabela | FKs recebidas | Linhas |
|---|---:|---:|
| `ai_analysis` | 0 | 0 |
| `ai_sdr_config` | 0 | 0 |
| `ai_sdr_logs` | 0 | 0 |
| `anexos_legado` | 0 | 1.980 |
| `automacoes` | 1 | 0 |
| `billing_audit_runs` | 2 | 0 |
| `buscas_salvas` | 0 | 0 |
| `cadence_definitions` | 3 | 0 |
| `campanhas` | 0 | 18 |
| `contato_listas` | 1 | 0 |
| `contrato_templates` | 1 | 3 |
| `custom_fields` | 0 | 0 |
| `documentos_atendimento` | 0 | 0 |
| `email_sequencias` | 2 | 0 |
| `email_templates` | 1 | 1 |
| `event_outbox` | 1 | 0 |
| `labels` | 4 | 3 |
| `legacy_provenance` | 0 | 5.064 |
| `metricas_diarias` | 0 | 1 |
| `pipelines` | 2 | 2 |
| `portfolio_snapshots` | 0 | 3 |
| `reconciliation_runs` | 1 | 1 |
| `scripts_atendimento` | 0 | 6 |
| `sdr_memory` | 0 | 0 |
| `service_ledger_batches` | 1 | 1 |
| `servicos_catalogo` | 5 | 220 |
| `stripe_webhook_events` | 0 | 105 |
| `whatsapp_templates` | 0 | 1 |
| `won_evidence_policies` | 0 | 3 |

Observacoes factuais sobre esse grupo:

- Quatro delas concentram volume: `legacy_provenance` (5.064), `anexos_legado` (1.980),
  `servicos_catalogo` (220) e `stripe_webhook_events` (105). As duas primeiras sao
  tabelas de procedencia e anexo do legado e se ligam ao resto por coluna polimorfica
  (`entidade_tipo` + `entidade_id`), sem FK, ver secao 5.
- Dezenove das trinta tem 0 linhas.
- `servicos_catalogo` e a de maior grau do grupo: recebe 5 FKs e tem 220 linhas.
- `usuarios`, apesar de receber 71 FKs, **nao** e raiz: emite FK para `organizacoes` e
  para `teams` (`usuarios.team_id`), e esta dentro de um ciclo, ver secao 4.

### 3.3 Verificacao negativa

Nenhuma tabela do banco tem como unica dependencia uma auto-referencia. As tres
auto-referencias existentes (secao 4.1) estao em tabelas que tambem apontam para outras.

## 4. Ciclos no grafo de foreign keys

Deteccao feita por script, nao a olho. O script monta o grafo dirigido a partir de
`_raw/foreign-keys.txt` (aresta `origem -> destino`, arestas paralelas colapsadas),
separa as auto-referencias e depois enumera todos os ciclos elementares de tamanho >= 2
por busca em profundidade com ancoragem no menor vertice (variante de Johnson): a
partir de cada vertice `s` so caminha por vertices `> s`, o que garante que cada ciclo
elementar aparece uma unica vez. Script em
`/private/tmp/.../scratchpad/analise.py` (sessao temporaria); o mesmo codigo esta
transcrito abaixo.

```python
cycles = set()
def dfs(start, node, path, onpath):
    for nxt in graph.get(node, []):
        if nxt == start:
            cyc = tuple(path); i = cyc.index(min(cyc))
            cycles.add(cyc[i:] + cyc[:i])
        elif nxt not in onpath and nxt > start:
            onpath.add(nxt); path.append(nxt)
            dfs(start, nxt, path, onpath)
            path.pop(); onpath.remove(nxt)
for s in sorted(graph):
    dfs(s, s, [s], {s})
```

Resultado: **3 auto-referencias** e **11 ciclos elementares de tamanho >= 2**.

### 4.1 Auto-referencias (tabela.coluna -> tabela.id)

```
ai_skill_versions.forked_from_version_id -> ai_skill_versions.id   [OPCIONAL]   ON DELETE SET NULL
empresas.canonical_empresa_id -> empresas.id   [OPCIONAL]   ON DELETE SET NULL
propostas.substituida_por_id -> propostas.id   [OPCIONAL]   ON DELETE NO ACTION
```

| Tabela | Coluna | Linhas na tabela | Constraint |
|---|---|---:|---|
| `ai_skill_versions` | `forked_from_version_id` | 0 | `ai_skill_versions_forked_from_version_id_fkey` |
| `empresas` | `canonical_empresa_id` | 2.199 | `empresas_canonical_empresa_id_fkey` |
| `propostas` | `substituida_por_id` | 1.550 | `propostas_substituida_por_id_fkey` |

As tres sao opcionais. `empresas.canonical_empresa_id` e `propostas.substituida_por_id`
expressam cadeia de sucessao (empresa canonica, proposta substituta);
`ai_skill_versions.forked_from_version_id` expressa fork de versao.

### 4.2 Ciclos de tamanho >= 2

Os 11 ciclos encontrados, do menor para o maior. Sao ciclos no grafo de tabelas:
cada aresta e uma FK declarada e existente.

**Ciclo 1** (2 tabelas): `ai_agent_versions -> ai_agents -> ai_agent_versions`

```
ai_agent_versions.agent_id -> ai_agents.id   [OBRIGATORIA]   ON DELETE CASCADE
ai_agents.published_version_id -> ai_agent_versions.id   [OPCIONAL]   ON DELETE SET NULL
```

**Ciclo 2** (2 tabelas): `checkouts -> proposta_grupo_comercial -> checkouts`

```
checkouts.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.checkout_id -> checkouts.id   [OPCIONAL]
```

**Ciclo 3** (2 tabelas): `contratos -> proposta_grupo_comercial -> contratos`

```
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.contrato_id -> contratos.id   [OPCIONAL]
```

**Ciclo 4** (2 tabelas): `teams -> usuarios -> teams`

```
teams.manager_id -> usuarios.id   [OPCIONAL]
usuarios.team_id -> teams.id   [OPCIONAL]
```

**Ciclo 5** (3 tabelas): `contratos -> negocios -> servicos_canonicos -> contratos`

```
contratos.negocio_id -> negocios.id   [OPCIONAL]
negocios.servico_origem_id -> servicos_canonicos.id   [OPCIONAL]   ON DELETE SET NULL
servicos_canonicos.contrato_id -> contratos.id   [OPCIONAL]   ON DELETE SET NULL
```

**Ciclo 6** (3 tabelas): `contratos -> proposta_grupo_comercial -> propostas -> contratos`

```
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.proposta_id -> propostas.id   [OBRIGATORIA]
propostas.contrato_base_id -> contratos.id   [OPCIONAL]
propostas.contrato_id -> contratos.id   [OPCIONAL]
```

**Ciclo 7** (4 tabelas): `checkouts -> propostas -> contratos -> proposta_grupo_comercial -> checkouts`

```
checkouts.proposta_id -> propostas.id   [OBRIGATORIA]
propostas.contrato_base_id -> contratos.id   [OPCIONAL]
propostas.contrato_id -> contratos.id   [OPCIONAL]
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.checkout_id -> checkouts.id   [OPCIONAL]
```

**Ciclo 8** (4 tabelas): `contratos -> proposta_grupo_comercial -> negocios -> servicos_canonicos -> contratos`

```
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.negocio_id -> negocios.id   [OPCIONAL]
negocios.servico_origem_id -> servicos_canonicos.id   [OPCIONAL]   ON DELETE SET NULL
servicos_canonicos.contrato_id -> contratos.id   [OPCIONAL]   ON DELETE SET NULL
```

**Ciclo 9** (5 tabelas): `checkouts -> negocios -> servicos_canonicos -> contratos -> proposta_grupo_comercial -> checkouts`

```
checkouts.negocio_id -> negocios.id   [OPCIONAL]
negocios.servico_origem_id -> servicos_canonicos.id   [OPCIONAL]   ON DELETE SET NULL
servicos_canonicos.contrato_id -> contratos.id   [OPCIONAL]   ON DELETE SET NULL
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.checkout_id -> checkouts.id   [OPCIONAL]
```

**Ciclo 10** (5 tabelas): `contratos -> proposta_grupo_comercial -> propostas -> negocios -> servicos_canonicos -> contratos`

```
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.proposta_id -> propostas.id   [OBRIGATORIA]
propostas.negocio_id -> negocios.id   [OPCIONAL]
negocios.servico_origem_id -> servicos_canonicos.id   [OPCIONAL]   ON DELETE SET NULL
servicos_canonicos.contrato_id -> contratos.id   [OPCIONAL]   ON DELETE SET NULL
```

**Ciclo 11** (6 tabelas): `checkouts -> propostas -> negocios -> servicos_canonicos -> contratos -> proposta_grupo_comercial -> checkouts`

```
checkouts.proposta_id -> propostas.id   [OBRIGATORIA]
propostas.negocio_id -> negocios.id   [OPCIONAL]
negocios.servico_origem_id -> servicos_canonicos.id   [OPCIONAL]   ON DELETE SET NULL
servicos_canonicos.contrato_id -> contratos.id   [OPCIONAL]   ON DELETE SET NULL
contratos.grupo_comercial_id -> proposta_grupo_comercial.id   [OPCIONAL]
proposta_grupo_comercial.checkout_id -> checkouts.id   [OPCIONAL]
```

Leitura factual do conjunto:

- Dois ciclos sao independentes e de tamanho 2. `ai_agents <-> ai_agent_versions`:
  o agente aponta para a versao publicada (`published_version_id`, `SET NULL`) e a versao
  aponta para o agente (`agent_id`, `CASCADE`); ambas as tabelas tem 0 linhas.
  `usuarios <-> teams`: o usuario pertence a um time (`team_id`) e o time aponta para o
  gerente (`manager_id`); `usuarios` tem 16 linhas e `teams` tem 0.
- Os outros 9 ciclos sao todos do mesmo emaranhado comercial, formado por 6 tabelas:
  `checkouts`, `contratos`, `negocios`, `proposta_grupo_comercial`, `propostas` e
  `servicos_canonicos`. As 9 variacoes sao caminhos alternativos dentro desse mesmo
  conjunto, nao emaranhados separados.
- As arestas que fecham esse emaranhado sao: `contratos.grupo_comercial_id`,
  `proposta_grupo_comercial.contrato_id`, `proposta_grupo_comercial.checkout_id`,
  `checkouts.proposta_id`, `propostas.contrato_id`, `propostas.contrato_base_id`,
  `propostas.negocio_id`, `negocios.servico_origem_id` e
  `servicos_canonicos.contrato_id`.
- Volume das seis tabelas do emaranhado: `checkouts` 0, `contratos` 742, `negocios` 1.562,
  `proposta_grupo_comercial` 0, `propostas` 1.550, `servicos_canonicos` 438.
- Apenas duas arestas do emaranhado sao OBRIGATORIAS: `checkouts.proposta_id` e
  `proposta_grupo_comercial.proposta_id`. Todas as outras sao nullable, o que e o que
  permite inserir linhas apesar do ciclo.

## 5. IDs guardados sem foreign key

`_raw/ids-sem-fk.txt` lista **115 colunas** cujo nome termina em `_id` e que nao tem
foreign key declarada. Uma das 115 (`current_service_portfolio.organizacao_id`) pertence
a uma **view**, nao a uma tabela; views nao aceitam FK, entao ela aparece classificada
a parte. As outras 114 sao colunas de tabela.

Distribuicao:

| Categoria | Colunas |
|---|---:|
| (a) Destino interno unico e existente | 15 |
| (a) Destino interno, mas polimorfico (`entity_type` + `entity_id`) | 13 |
| (b) Id de sistema externo, FK nao se aplicaria | 70 |
| (c) Nao classificavel com a evidencia disponivel | 17 |
| **Total** | **115** |

### 5.a1 Apontam para uma tabela interna, com destino unico e existente

Em todas as linhas abaixo o nome da coluna indica um destino obvio, e esse destino
existe no banco. Os numeros de preenchimento e de orfaos na coluna "Evidencia" vieram de
`SELECT` contra o banco local; orfao = valor preenchido que nao corresponde a nenhuma
linha da tabela destino.

| Origem | Destino sugerido | Destino existe? | Evidencia |
|---|---|---|---|
| `ai_sdr_logs.contato_id` | `contatos.id` | sim | Tabela com 0 linhas. |
| `ai_sdr_logs.lead_id` | `leads.id` | sim | Tabela com 0 linhas. |
| `atividades.superseded_by_note_id` | `notas.id` | sim | 0 de 13.044 linhas preenchidas. |
| `emails.contato_id` | `contatos.id` | sim | 0 de 4.460 linhas preenchidas. `emails` ja tem FK declarada para `leads`, `usuarios` e `organizacoes`. |
| `emails.sequencia_execucao_id` | `email_sequencia_execucoes.id` | sim | Tabela destino existe e tem 0 linhas. |
| `eventos_comerciais.negocio_origem_id` | `negocios.id` | sim | 185 preenchidos, 0 orfaos. |
| `leads.canonical_lead_id` | `leads.id` | sim | Auto-referencia sem FK. 0 de 3.989 preenchidos. Note que `empresas.canonical_empresa_id`, equivalente, **tem** FK declarada. |
| `leads.indicado_por_lead_id` | `leads.id` | sim | Auto-referencia sem FK. 0 preenchidos. |
| `leads.negocio_ativo_id` | `negocios.id` | sim | 285 preenchidos, 0 orfaos. |
| `mrr_movimentos.evento_comercial_id` | `eventos_comerciais.id` | sim | 0 de 665 preenchidos. |
| `negocios.negocio_origem_id` | `negocios.id` | sim | Auto-referencia sem FK. 146 preenchidos, 0 orfaos. |
| `proposta_grupo_comercial.oportunidade_id` | `oportunidades.id` | sim | Ambas com 0 linhas. |
| `propostas.proposta_original_id` | `propostas.id` | sim | Auto-referencia sem FK. 38 preenchidos e **2 orfaos**, ou seja 2 linhas apontam para uma proposta que nao existe. Note que `propostas.substituida_por_id`, a outra auto-referencia da mesma tabela, tem FK declarada. |
| `whatsapp_mensagens.contato_id` | `contatos.id` | sim | 24.574 de 25.363 preenchidos, 0 orfaos. E a coluna sem FK com maior volume preenchido do banco. |
| `whatsapp_mensagens.reply_to_id` | `whatsapp_mensagens.id` | sim | Auto-referencia sem FK. 1 preenchido, 0 orfaos. |

Query padrao usada para preenchidos e orfaos, exemplo com `leads.negocio_ativo_id`:

```sql
SELECT count(*) FILTER (WHERE negocio_ativo_id IS NOT NULL) AS preenchidos,
       count(*) FILTER (WHERE negocio_ativo_id IS NOT NULL
                        AND NOT EXISTS (SELECT 1 FROM negocios n WHERE n.id = l.negocio_ativo_id)) AS orfaos
FROM leads l;   -- resultado: 285 | 0
```

Dois fatos que saltam desse grupo:

- `propostas.proposta_original_id` e a unica com orfao confirmado: 38 valores
  preenchidos, 2 deles sem linha correspondente em `propostas`.
- O tratamento e inconsistente dentro da mesma tabela. `propostas.substituida_por_id`
  (auto-referencia) tem FK; `propostas.proposta_original_id` (auto-referencia) nao tem.
  `empresas.canonical_empresa_id` tem FK; `leads.canonical_lead_id`, equivalente, nao tem.

### 5.a2 Apontam para tabela interna, mas o destino varia por linha (polimorficas)

Nestas o destino e interno, porem nao e unico: a tabela guarda o tipo da entidade numa
coluna ao lado e o id na outra. Uma foreign key simples nao consegue expressar um
destino que muda por linha, entao a ausencia aqui e consequencia direta do desenho
polimorfico, nao descuido pontual.

| Origem | Coluna de tipo ao lado | Evidencia |
|---|---|---|
| `ai_alerts.ref_id` | `ref_kind` | Par `ref_kind` + `ref_id`. 0 linhas. |
| `ai_analysis.entity_id` | `entity_type` | Par `entity_type` + `entity_id`. 0 linhas. |
| `anexos_legado.entidade_id` | `entidade_tipo` | Par `entidade_tipo` + `entidade_id`. Tipos presentes: contrato 1.164, negocio 615, notes 123, empresa 44, desconhecido 19, emails 14, lead 1. |
| `audit_log.entity_id` | `entity_type` | Par `entity_type` + `entity_id`. 21 linhas. |
| `automacao_execucoes.entity_id` | `entity_type` | Par `entity_type` + `entity_id`. 0 linhas. |
| `billing_correction_ledger.entity_id` | `entity_type` | Par `entity_type` + `entity_id`. 0 linhas. |
| `billing_resolution_cases.crm_entity_id` | `crm_entity_type` | Par `crm_entity_type` + `crm_entity_id`. 0 linhas. |
| `cadence_enrollments.entity_id` | `entity_type` | Par `entity_type` + `entity_id`. 0 linhas. |
| `callface_ai_external_identities.entity_id` | `entity_type` | Par `entity_type` + `entity_id`. 0 linhas. |
| `correction_change_log.entity_id` | `entity_type` | Par `entity_type` + `entity_id`, coluna `text` e nao `uuid`. 30.876 linhas, 22 valores distintos de `entity_type`, com sinonimos coexistindo (`nota` 8.556 e `note` 473; `atividade` 4.144 e `activity` 6.808; `contrato` 1.227 e `contract` 923; `proposta_item` 456 e `proposal_item` 66). |
| `entity_labels.entity_id` | `entity_type` | Par `entity_type` + `entity_id`. 161 linhas, todas com `entity_type = lead`. |
| `event_outbox.aggregate_id` | `aggregate_type` | Par `aggregate_type` + `aggregate_id`. 0 linhas. |
| `legacy_provenance.entidade_id` | `entidade_tipo` | Par `entidade_tipo` + `entidade_id`. 5.064 linhas; tipos: nota 2.486, proposta 1.051, proposta_item 448, contrato 265, lead 228, fatura_item 226, negocio 204, empresa 156. |

Query usada para as distribuicoes de tipo citadas acima:

```sql
SELECT entidade_tipo, count(*) FROM anexos_legado     GROUP BY 1 ORDER BY 2 DESC;
SELECT entidade_tipo, count(*) FROM legacy_provenance GROUP BY 1 ORDER BY 2 DESC;
SELECT entity_type,   count(*) FROM entity_labels     GROUP BY 1 ORDER BY 2 DESC;
SELECT entity_type,   count(*) FROM correction_change_log GROUP BY 1 ORDER BY 2 DESC;
SELECT entity_type,   count(*) FROM audit_log         GROUP BY 1 ORDER BY 2 DESC;
```

Volume desse grupo: `correction_change_log` 30.876 linhas, `legacy_provenance` 5.064,
`anexos_legado` 1.980, `entity_labels` 161, `audit_log` 21. As outras oito tem 0 linhas.

### 5.b Guardam id de sistema externo

Para estas nao haveria foreign key mesmo: o id vive em outro sistema, fora deste banco.
Sao 70 colunas, 61% das 115.

| Origem | Sistema externo | Observacao |
|---|---|---|
| `ai_models.model_id` | provedor de IA | Identificador do modelo no provedor. Ha `UNIQUE (provider, model_id)` em `_raw/constraints.txt`. |
| `ai_send_ledger.external_message_id` | provedor do canal | Id da mensagem no provedor de envio. |
| `anexos_legado.zoho_id` | Zoho CRM |  |
| `assinatura_itens.stripe_price_id` | Stripe |  |
| `assinatura_itens.stripe_product_id` | Stripe |  |
| `assinatura_itens.stripe_subscription_item_id` | Stripe |  |
| `assinaturas.stripe_customer_id` | Stripe |  |
| `assinaturas.stripe_price_id` | Stripe |  |
| `assinaturas.stripe_subscription_id` | Stripe |  |
| `billing_customer_aliases.stripe_customer_id` | Stripe |  |
| `billing_identities.canonical_stripe_customer_id` | Stripe |  |
| `billing_identities.external_customer_id` | Stripe | 224 linhas, todas com `provider = STRIPE` e valor no formato `cus_...`. Query: `SELECT provider, count(*), max(external_customer_id) FROM billing_identities GROUP BY 1`. |
| `billing_resolution_cases.stripe_customer_id` | Stripe |  |
| `billing_resolution_cases.stripe_subscription_id` | Stripe |  |
| `callface_ai_external_identities.external_id` | externo, varia por linha | Tabela existe para guardar id externo; tem `provider` e `external_type` ao lado. 0 linhas. |
| `callface_ai_reconciliation_candidates.external_organization_id` | Callface AI | 0 linhas. |
| `catalogo_mapeamentos_legacy.legacy_product_id` | Zoho CRM | 193 linhas; valores com 19 digitos, formato de id do Zoho. Query: `SELECT count(*), max(legacy_product_id) FROM catalogo_mapeamentos_legacy`. |
| `catalogo_precos.stripe_price_id` | Stripe |  |
| `checkouts.stripe_customer_id` | Stripe |  |
| `checkouts.stripe_invoice_id` | Stripe |  |
| `checkouts.stripe_payment_intent_id` | Stripe |  |
| `checkouts.stripe_session_id` | Stripe |  |
| `checkouts.stripe_subscription_id` | Stripe |  |
| `closer_bloqueios.outlook_event_id` | Microsoft Outlook / Graph |  |
| `communications.external_id` | externo, varia por linha | Ao lado de `canal`. 0 linhas, provedor nao verificavel no dado. |
| `contatos.zoho_id` | Zoho CRM |  |
| `contrato_itens.zoho_id` | Zoho CRM |  |
| `contratos.stripe_subscription_id` | Stripe |  |
| `contratos.zoho_id` | Zoho CRM |  |
| `emails.message_id` | provedor de e-mail | Cabecalho `Message-ID`. |
| `emails.provider_message_id` | provedor de e-mail |  |
| `emails.thread_id` | provedor de e-mail |  |
| `empresas.apollo_id` | Apollo |  |
| `empresas.pipedrive_id` | Pipedrive |  |
| `empresas.stripe_customer_id` | Stripe |  |
| `empresas.zoho_id` | Zoho CRM |  |
| `eventos_comerciais.zoho_id` | Zoho CRM |  |
| `fatura_itens.zoho_id` | Zoho CRM |  |
| `faturas.external_id` | Stripe | 951 de 951 linhas preenchidas, valores no formato `in_...` (invoice Stripe). Query: `SELECT count(*) FILTER (WHERE external_id IS NOT NULL), max(external_id) FROM faturas`. |
| `leads.apollo_id` | Apollo |  |
| `leads.meta_ad_id` | Meta Ads |  |
| `leads.meta_adset_id` | Meta Ads |  |
| `leads.meta_campaign_id` | Meta Ads |  |
| `leads.pipedrive_id` | Pipedrive |  |
| `leads.stripe_customer_id` | Stripe |  |
| `leads.zoho_id` | Zoho CRM |  |
| `legacy_provenance.zoho_id` | Zoho CRM | NOT NULL; 5.064 linhas. |
| `ligacoes.callface_call_id` | plataforma Callface (telefonia) | 4.938 de 4.938 preenchidos, formato UUID em coluna `text`. |
| `ligacoes.callface_contact_id` | plataforma Callface (telefonia) | 1 linha preenchida, valor `example-contact-id`. |
| `ligacoes.callface_deal_id` | plataforma Callface (telefonia) | 1 linha preenchida, valor `example-deal-id`. |
| `meta_lead_staging.ad_id` | Meta Ads | Tabela de staging de lead da Meta, ver secao 6. |
| `meta_lead_staging.adset_id` | Meta Ads |  |
| `meta_lead_staging.campaign_id` | Meta Ads |  |
| `meta_lead_staging.fb_lead_id` | Meta / Facebook |  |
| `negocios.pipedrive_id` | Pipedrive |  |
| `negocios.zoho_id` | Zoho CRM |  |
| `notas.pipedrive_id` | Pipedrive |  |
| `oportunidade_itens.stripe_price_id` | Stripe |  |
| `oportunidade_itens.stripe_product_id` | Stripe |  |
| `proposta_itens.stripe_price_id` | Stripe |  |
| `proposta_itens.stripe_product_id` | Stripe |  |
| `proposta_itens.zoho_id` | Zoho CRM |  |
| `propostas.stripe_session_id` | Stripe |  |
| `reunioes.outlook_event_id` | Microsoft Outlook / Graph |  |
| `servico_billing_timeline.external_id` | Stripe | 144 linhas, todas com `provider = STRIPE` e valor `sub_...`. Query: `SELECT provider, count(*), max(external_id) FROM servico_billing_timeline GROUP BY 1`. |
| `servicos_canonicos.current_subscription_id` | Stripe | Nome sugere id interno, mas os 144 valores preenchidos sao `sub_...` da Stripe. Query: `SELECT count(*) FILTER (WHERE current_subscription_id IS NOT NULL), max(current_subscription_id) FROM servicos_canonicos`. Existe tabela interna `assinaturas` (355 linhas), e esta coluna nao aponta para ela. |
| `servicos_catalogo.stripe_product_id` | Stripe |  |
| `status_changes.zoho_id` | Zoho CRM | 0 preenchidos em 5.923 linhas. |
| `stripe_webhook_events.event_id` | Stripe | 105 linhas, valores `evt_...`. |
| `whatsapp_mensagens.uazapi_message_id` | uazapi (gateway WhatsApp) |  |

Concentracao por sistema:

| Sistema | Colunas |
|---|---:|
| Stripe | 30 |
| Zoho CRM | 13 |
| Meta Ads | 6 |
| Pipedrive | 4 |
| provedor de e-mail | 3 |
| plataforma Callface (telefonia) | 3 |
| externo, varia por linha | 2 |
| Microsoft Outlook / Graph | 2 |
| Apollo | 2 |
| provedor de IA | 1 |
| provedor do canal | 1 |
| Callface AI | 1 |
| Meta / Facebook | 1 |
| uazapi (gateway WhatsApp) | 1 |

Tres dessas merecem destaque porque o nome nao denuncia a origem externa:

- `servicos_canonicos.current_subscription_id` parece interno (existe `assinaturas` com
  355 linhas), mas os 144 valores preenchidos sao `sub_...` da Stripe.
- `faturas.external_id` e `servico_billing_timeline.external_id` sao genericos no nome;
  os dados sao `in_...` e `sub_...`, ambos Stripe.
- `ligacoes.callface_call_id` guarda UUID em coluna `text`, o que parece id interno, mas
  e id da plataforma de telefonia Callface, nao deste banco.

### 5.c Nao classificavel com a evidencia disponivel, NAO CONFIRMADO

Para estas 17 colunas nao ha evidencia suficiente para afirmar destino interno nem
externo. Os motivos recorrentes sao: tabela com 0 linhas (sem dado para inspecionar),
tipo `text` onde a PK candidata e `uuid`, ou nome generico sem par de tipo ao lado.
Entra aqui tambem `current_service_portfolio.organizacao_id`, que nao e caso de ausencia
de FK: o objeto e uma view e view nao aceita foreign key.

| Origem | Tipo da coluna | Destino que o nome sugere | Por que nao da para confirmar |
|---|---|---|---|
| `ai_agent_runs.correlation_id` | `uuid` | - | `uuid` sem coluna de tipo ao lado. Tabela com 0 linhas. |
| `ai_purpose_bindings.model_id` | `text` | ai_models(provider, model_id)? | O destino existe como chave unica (`UNIQUE (provider, model_id)` em `ai_models`), nao como PK, e a tabela `ai_purpose_bindings` tem 0 linhas. Nao da para confirmar se o valor referencia `ai_models` ou e rotulo livre do provedor. NAO CONFIRMADO. |
| `ai_router_decisions.correlation_id` | `uuid` | - | `uuid` de correlacao entre execucoes; sem destino unico identificavel. NAO CONFIRMADO. |
| `atividades.usuario_source_id` | `text` | - | Coluna `text` (nao `uuid`), 0 de 13.044 preenchidos. O nome sugere id do usuario no sistema de origem, mas sem dado nao da para confirmar qual. NAO CONFIRMADO. |
| `cadence_enrollment_events.step_id` | `text` | - | Coluna `text`. Nao existe tabela `cadence_steps` no banco; os passos vivem em `cadence_versions.compiled_steps` (jsonb). NAO CONFIRMADO se e chave dentro do JSON. |
| `cadence_enrollments.current_node_id` | `text` | - | Coluna `text`. Nao existe tabela de nodes; `cadence_versions.graph` e jsonb. NAO CONFIRMADO. |
| `cadence_enrollments.current_step_id` | `text` | - | Coluna `text`. Mesma situacao de `current_node_id`. NAO CONFIRMADO. |
| `communications.origem_legado_id` | `uuid` | - | `uuid`, 0 linhas na tabela. Nome nao indica tabela destino. NAO CONFIRMADO. |
| `current_service_portfolio.organizacao_id` | `uuid` | organizacoes.id | `current_service_portfolio` e uma **view** (`_raw/views.txt`), nao tabela. View nao aceita foreign key, entao a ausencia aqui nao e lacuna de modelagem. Fora de escopo das outras duas categorias. |
| `event_outbox.correlation_id` | `uuid` | - | `uuid` de correlacao, ao lado de `aggregate_id`. 0 linhas. NAO CONFIRMADO. |
| `eventos.session_id` | `text` | - | Coluna `text` numa tabela de tracking web (`pagina`, `referrer`, `ip_address`, `user_agent`). Sugere sessao de navegacao, nao linha de tabela. 0 linhas. NAO CONFIRMADO. |
| `fulfillment_linhas_portabilidade.anexo_id` | `text` | anexos.id? | O nome sugere `anexos.id`, e a tabela `anexos` existe (0 linhas), mas o tipo nao bate: a coluna e `text` e `anexos.id` e `uuid`. Ha `anexo_url` (`text`) ao lado. 3 linhas na tabela. NAO CONFIRMADO. |
| `leads.event_id` | `text` | - | Coluna `text`, 0 de 3.989 preenchidos. Existe tabela `eventos` (0 linhas) com PK `uuid`, tipo nao bate. NAO CONFIRMADO. |
| `notas.autor_source_id` | `text` | - | Coluna `text`, 0 de 5.002 preenchidos. Nome sugere autor no sistema de origem. NAO CONFIRMADO. |
| `pontos_contato.campaign_id` | `text` | - | Coluna `text` ao lado de `campaign` (`text`), num bloco de UTM. 0 linhas. Sugere id de campanha de plataforma de anuncio, mas nao da para confirmar qual. NAO CONFIRMADO. |
| `pontos_contato.source_id` | `text` | - | Coluna `text` ao lado de `source` (`text`). 0 linhas. NAO CONFIRMADO. |
| `reconciliation_changes.action_id` | `text` | - | Coluna `text` NOT NULL, 413 linhas; valores no formato `ZOHO:VETLOG:PABX...`, ou seja chave textual de acao da rodada de reconciliacao, nao id de linha. Query: `SELECT count(*), max(action_id) FROM reconciliation_changes`. NAO CONFIRMADO como referencia a tabela. |

## 6. Tabelas isoladas

`_raw/sem-fk-nenhuma.txt` lista as 4 tabelas que nao emitem nenhuma foreign key e nao
recebem nenhuma. Estao fora do grafo relacional por completo.

| Tabela | Linhas | FKs emitidas | FKs recebidas | Primary key | Colunas `*_id` sem FK |
|---|---:|---:|---:|---|---|
| `_carga_contagem_antes` | 82 | 0 | 0 | `tabela` | nenhuma |
| `_migracoes_aplicadas` | 56 | 0 | 0 | `nome` | nenhuma |
| `ai_models` | 6 | 0 | 0 | `id` | `model_id` |
| `meta_lead_staging` | 576 | 0 | 0 | `id` | `ad_id`, `adset_id`, `campaign_id`, `fb_lead_id` |

Descricao de cada uma, pelas colunas em `_raw/colunas.txt`:

- **`_carga_contagem_antes`** (82 linhas, PK `tabela`). Guarda a contagem de linhas por
  tabela antes de uma carga. E instrumento do processo de carga, nao entidade de dominio.
- **`_migracoes_aplicadas`** (56 linhas, PK `nome`). Registro de migrations ja aplicadas.
  Tambem infraestrutura, nao dominio.
- **`ai_models`** (6 linhas, PK `id`). Catalogo de modelos de IA por provedor, com
  `UNIQUE (provider, model_id)`, preco por milhao de tokens, janela de contexto e flags
  de suporte a tools e visao. Fica isolada apesar de `ai_purpose_bindings.model_id`
  existir, ver secao 5.c.
- **`meta_lead_staging`** (576 linhas, PK `id`). Area de pouso de lead vindo da Meta,
  com `ad_id`, `adset_id`, `campaign_id` e `fb_lead_id`, todos ids externos. E a unica
  das quatro com volume relevante de dado de negocio, e nao tem ligacao declarada com
  `leads` (3.989 linhas).

Somadas, as quatro tem 720 linhas.

---

Documento gerado a partir dos arquivos em `_raw/` e de queries `SELECT` no banco local.
Nenhuma escrita foi executada contra o banco.
