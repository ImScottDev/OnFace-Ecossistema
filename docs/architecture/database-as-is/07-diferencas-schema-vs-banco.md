# 07, Diferenças entre o schema Drizzle e o banco real

> **Atualização de 20/09/2026, após a geração deste documento.** A divergência da seção 4
> (`billing_customer_aliases.origem`) foi corrigida no `schema.ts`. A declaração tinha sido
> escrita à mão nesta mesma data, ao trazer as tabelas de billing de produção, e inventava
> a coluna `origem` além de omitir quatro colunas reais (`is_canonical`, `resolution_source`,
> `evidence`, `updated_at`). O `schema.ts` agora espelha as 8 colunas do banco. **O banco não
> foi alterado.** As demais divergências deste documento permanecem como levantadas.

Levantamento AS-IS, somente leitura. Nada foi alterado no banco e nada foi corrigido em
`schema.ts`. Este documento descreve o drift observado, não prescreve solução.

- Banco: PostgreSQL local `callface_crm`, carga de produção de 20/09/2026.
- Schema de aplicação: `/Users/Scott/Documents/Scott Studio/callface-crm-dev/app/src/lib/db/schema.ts` (4237 linhas, arquivo único).
- Script comparador: `_raw/comparar-schema-banco.py` (reexecutável).
- Dumps do banco: `_raw/colunas.txt`, `_raw/foreign-keys.txt`, `_raw/indices.txt`, `_raw/views.txt`.

## Método

O script `_raw/comparar-schema-banco.py`:

1. Remove comentários de `schema.ts` com um varredor que respeita strings, depois extrai
   cada `pgTable("nome_fisico", { ... }, (table) => [ ... ])` por balanceamento de parênteses.
2. De cada tabela tira os nomes físicos das colunas (primeiro argumento string de `uuid()`,
   `text()`, `timestamp()`, `jsonb()`, `integer()`, `boolean()`, `decimal()`, `date()`, `inet()`),
   a presença de `.notNull()`, `.primaryKey()`, `.unique()`, o alvo de `.references()` e os nomes
   de `index()` / `uniqueIndex()` com suas colunas.
3. Lê `_raw/colunas.txt`, `_raw/foreign-keys.txt` e `_raw/indices.txt` para o lado do banco.
4. Produz o diff.

Comando de verificação usado ao longo do documento:

```
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
psql -U callface -d callface_crm -t -A -F'|' -c "SELECT ..."
```

### Cobertura do parser

O parser não perdeu declaração. Os números fecham contra contagem independente por `grep`:

| Medida | Parser | Contagem independente |
|---|---|---|
| Tabelas em `schema.ts` | 145 | `grep -c 'pgTable('` = 145 |
| Colunas extraídas do Drizzle | 2222 | soma das chamadas de tipo por `grep -oE` = 2222 |
| Índices nomeados no Drizzle | 358 | `grep -cE '\b(index\|uniqueIndex)\("'` = 358 |
| `.references()` no Drizzle | 416 | `grep -c '\.references('` = 416 |

Lado do banco: 151 tabelas base e 1 view (`SELECT table_type, count(*) FROM information_schema.tables WHERE table_schema='public' GROUP BY 1` devolveu `VIEW|1` e `BASE TABLE|151`), 2298 colunas, 565 índices, 423 foreign keys.

## Placar

| Categoria | Divergências |
|---|---|
| Tabela no banco e ausente no Drizzle | 7 (6 tabelas base + 1 view) |
| Tabela no Drizzle e ausente no banco | 0 |
| Coluna no banco e não no Drizzle | 7 (em 2 tabelas) |
| Coluna no Drizzle e não no banco | 1 |
| Divergência de nullability | 6 |
| FK no banco e não no Drizzle | 2 (+ 8 em tabelas que o Drizzle nem conhece) |
| FK no Drizzle e não no banco | 3 |
| FK com destino divergente | 0 |
| Índice do Drizzle ausente do banco | 0 (18 existem no banco com outro nome) |
| Índice no banco e não declarado no Drizzle | 43 (fora 145 PK implícitas e 5 UNIQUE implícitas) |
| Índice com unicidade divergente | 0 |

Total de divergências que mudam comportamento em runtime: 19 (7 tabelas, 7 colunas do banco,
1 coluna do Drizzle, 6 nullability, mais 5 de FK). As 61 diferenças de índice não quebram
consulta; entram na categoria de migração e de plano de execução.

---

## 1. Tabela no banco e ausente no Drizzle

7 objetos. Query de confirmação do tipo de cada um:

```
psql -U callface -d callface_crm -t -A -F'|' -c "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' AND table_name IN (...)"
```

| Objeto | Tipo real | Linhas | Evidência | Risco em runtime |
|---|---|---|---|---|
| `current_service_portfolio` | VIEW | n/d | `_raw/views.txt:1` | Não é tabela. Nenhum código Drizzle a alcança pelo query builder; só via `sql` cru. |
| `billing_audit_runs` | BASE TABLE | 0 | `_raw/tabelas-contagem-exata.txt` | Invisível ao Drizzle. Escrita e leitura só por SQL cru. `drizzle-kit` a trataria como objeto estranho ao schema. |
| `billing_correction_ledger` | BASE TABLE | 0 | idem | idem |
| `billing_resolution_cases` | BASE TABLE | 0 | idem | idem |
| `cliente_receita_mensal` | BASE TABLE | 0 | idem | idem |
| `_carga_contagem_antes` | BASE TABLE | 82 | idem | Tabela de apoio da carga. Invisível ao Drizzle. |
| `_migracoes_aplicadas` | BASE TABLE | 56 | idem | Controle de migração. Invisível ao Drizzle; o Drizzle usa mecanismo próprio. |

As 4 tabelas `billing_*` / `cliente_receita_mensal` estão com 0 linhas nesta carga. Elas têm
FK declarada no banco (ver seção 6) e índices (ver seção 7), portanto foram criadas por
migração SQL que nunca voltou para `schema.ts`.

## 2. Tabela no Drizzle e ausente no banco

Nenhuma. As 145 tabelas declaradas em `schema.ts` existem no banco.

## 3. Coluna presente no banco e não no Drizzle

7 colunas, concentradas em 2 tabelas.

| Tabela | Coluna | Tipo | Nulável | Default | Evidência | Risco em runtime |
|---|---|---|---|---|---|---|
| `billing_customer_aliases` | `resolution_source` | text | NOT NULL | nenhum | `_raw/colunas.txt:557` | Coluna obrigatória sem default e invisível ao Drizzle: todo `INSERT` montado pelo query builder omite a coluna e o banco rejeita com not-null violation. |
| `billing_customer_aliases` | `is_canonical` | boolean | NOT NULL | `false` | `_raw/colunas.txt:556` | O `INSERT` passa (há default), mas o valor nunca é lido nem escrito pela aplicação. |
| `billing_customer_aliases` | `evidence` | jsonb | NOT NULL | `'{}'::jsonb` | `_raw/colunas.txt:558` | idem |
| `billing_customer_aliases` | `updated_at` | timestamptz | NOT NULL | `now()` | `_raw/colunas.txt:560` | Preenchida só na inserção. Nenhum `UPDATE` do Drizzle a toca, então o valor fica igual ao `created_at` para sempre. |
| `correction_change_log` | `source` | text | nulável | nenhum | `_raw/colunas.txt:987` | Invisível ao Drizzle. `INSERT` passa gravando NULL. |
| `correction_change_log` | `confidence` | text | nulável | nenhum | `_raw/colunas.txt:985` | idem |
| `correction_change_log` | `evidence` | jsonb | nulável | nenhum | `_raw/colunas.txt:986` | idem |

Estado dos dados nessas colunas, medido:

```
SELECT count(*) AS total, count(source), count(confidence), count(evidence) FROM correction_change_log;
  -> 30876|0|0|0
SELECT count(*), count(*) FILTER (WHERE is_canonical) FROM billing_customer_aliases;
  -> 2|1
```

As três colunas de `correction_change_log` estão 100% NULL nas 30.876 linhas. As de
`billing_customer_aliases` estão preenchidas nas 2 linhas existentes, o que indica escrita
por caminho que não passa pelo Drizzle.

## 4. Coluna presente no Drizzle e não no banco

1 coluna.

| Tabela | Coluna | Declaração | Evidência | Risco em runtime |
|---|---|---|---|---|
| `billing_customer_aliases` | `origem` (text, nulável) | `origem: text("origem"),` | `app/src/lib/db/schema.ts:3220` | Qualquer select que a inclua quebra. O Drizzle projeta coluna a coluna, então um `db.select().from(billingCustomerAliases)` emite `"origem"` no SQL e o Postgres devolve erro `42703 column does not exist`. A tabela inteira fica inacessível pelo query builder. |

Confirmação de que a coluna não existe:

```
SELECT count(*) FROM information_schema.columns
 WHERE table_schema='public' AND table_name='billing_customer_aliases' AND column_name='origem';
  -> 0
```

Colunas reais da tabela, na ordem:
`id`, `billing_identity_id`, `stripe_customer_id`, `is_canonical`, `resolution_source`,
`evidence`, `created_at`, `updated_at`.

O Drizzle declara `origem` onde o banco tem `resolution_source`, e não declara
`is_canonical`, `evidence` nem `updated_at`. `billing_customer_aliases` é a única tabela do
schema com divergência nos dois sentidos ao mesmo tempo.

## 5. Divergência de nullability

6 colunas, todas `organizacao_id`. Confirmadas em consulta direta:

```
SELECT table_name, column_name, is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND (table_name,column_name) IN (...);
```

### 5.1 Drizzle diz `notNull`, banco aceita NULL

| Tabela | Coluna | Drizzle | Banco | Linhas na tabela | NULLs hoje | Risco em runtime |
|---|---|---|---|---|---|---|
| `contratos` | `organizacao_id` | `.notNull()` (`schema.ts:700`) | nulável | 742 | 0 | O tipo TypeScript promete `string`, o banco pode devolver `null`. Se uma linha com NULL entrar por SQL cru ou por integração, o valor chega como `null` a um código que não checa, e a falha aparece longe da origem. O banco não barra. |
| `assinaturas` | `organizacao_id` | `.notNull()` (`schema.ts:792`) | nulável | 355 | 0 | idem |
| `faturas` | `organizacao_id` | `.notNull()` (`schema.ts:924`) | nulável | 951 | 0 | idem |
| `mrr_movimentos` | `organizacao_id` | `.notNull()` (`schema.ts:980`) | nulável | 665 | 0 | idem |

Contagem de NULLs, medida:

```
SELECT 'assinaturas', count(*) FILTER (WHERE organizacao_id IS NULL), count(*) FROM assinaturas
UNION ALL SELECT 'contratos', ... UNION ALL SELECT 'faturas', ... UNION ALL SELECT 'mrr_movimentos', ...;
  -> assinaturas|0|355
     contratos|0|742
     faturas|0|951
     mrr_movimentos|0|665
```

Nenhuma linha viola a promessa hoje. A promessa não é sustentada pelo banco, só pelo tipo.
Essas são quatro tabelas financeiras, e `organizacao_id` é a coluna de isolamento de tenant.

### 5.2 Drizzle aceita NULL, banco exige NOT NULL

| Tabela | Coluna | Drizzle | Banco | Linhas na tabela | Risco em runtime |
|---|---|---|---|---|---|
| `tarefas` | `organizacao_id` | sem `.notNull()` (`schema.ts:1042`) | NOT NULL, sem default | 462 | O tipo TypeScript marca o campo como opcional no `insert`. Um `INSERT` que o omita compila e é rejeitado pelo banco em runtime com not-null violation. |
| `ai_agent_versions` | `organizacao_id` | sem `.notNull()` (`schema.ts:2183`) | NOT NULL, sem default | 0 | idem. Tabela vazia nesta carga, então o caminho nunca foi exercitado com dado real. |

## 6. Divergência de foreign key

### 6.1 FK existe no banco e não está declarada no Drizzle

2 casos em tabelas que o Drizzle conhece.

| Tabela | Coluna | Destino | Constraint | ON DELETE | Evidência | Risco em runtime |
|---|---|---|---|---|---|---|
| `nps_respostas` | `marco_id` | `cs_marcos.id` | `nps_respostas_marco_id_fkey` | SET NULL | `_raw/foreign-keys.txt:320`; Drizzle em `schema.ts:1022` declara `marcoId: uuid("marco_id")` sem `.references()` | O banco valida e o Drizzle não sabe. Um `INSERT` com `marco_id` inexistente compila e é rejeitado em runtime com foreign key violation. Ao apagar o `cs_marcos`, o banco zera a coluna sem que o código espere. |
| `servico_billing_timeline` | `assinatura_id` | `assinaturas.id` | `servico_billing_timeline_assinatura_id_fkey` | SET NULL | `_raw/foreign-keys.txt:384`; Drizzle em `schema.ts:3059` declara `assinaturaId: uuid("assinatura_id")` sem `.references()` | idem |

### 6.2 FK está declarada no Drizzle e não existe no banco

3 casos. Confirmação por contagem de constraints reais:

```
SELECT c.relname, a.attname, count(con.oid)
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
  LEFT JOIN pg_constraint con ON con.conrelid=c.oid AND con.contype='f' AND a.attnum=ANY(con.conkey)
 WHERE c.relname IN ('leads','mrr_movimentos','proposta_grupo_comercial')
   AND a.attname IN ('canonical_lead_id','evento_comercial_id','oportunidade_id')
 GROUP BY 1,2;
  -> leads|canonical_lead_id|0
     mrr_movimentos|evento_comercial_id|0
     proposta_grupo_comercial|oportunidade_id|0
```

| Tabela | Coluna | Destino declarado | Linha no schema | Risco em runtime |
|---|---|---|---|---|
| `leads` | `canonical_lead_id` | `leads.id` (auto-referência) | `schema.ts:350` | Nenhuma integridade no banco. Um `canonical_lead_id` apontando para lead inexistente ou já apagado é aceito e fica órfão. Como é a coluna de deduplicação de lead, uma cadeia quebrada não é detectada na escrita. `leads` tem 3.989 linhas. |
| `mrr_movimentos` | `evento_comercial_id` | `eventos_comerciais.id` | `schema.ts:995` | Sem validação no banco. Movimento de MRR pode referenciar evento comercial inexistente. 665 linhas na tabela. |
| `proposta_grupo_comercial` | `oportunidade_id` | `oportunidades.id` | `schema.ts:3874` | Sem validação no banco. Grupo comercial pode apontar para oportunidade inexistente. |

### 6.3 FK em tabela que o Drizzle não conhece

8 FKs, nas 4 tabelas da seção 1. Não são drift de declaração, são consequência de a tabela
inteira estar fora do `schema.ts`.

| Tabela | Coluna |
|---|---|
| `billing_audit_runs` | `organizacao_id` |
| `billing_correction_ledger` | `organizacao_id`, `audit_run_id`, `billing_identity_id` |
| `billing_resolution_cases` | `organizacao_id`, `audit_run_id` |
| `cliente_receita_mensal` | `organizacao_id`, `empresa_id` |

Risco em runtime: o Drizzle não consegue montar join nem relação para essas tabelas; qualquer
acesso é SQL cru, sem tipo.

### 6.4 FK com destino divergente

Nenhuma. Nas 413 colunas em que Drizzle e banco declaram FK, o par `(tabela_destino, coluna_destino)` é idêntico.

### 6.5 Conferência dos totais de FK

```
416 (Drizzle) - 3 (só no Drizzle) + 2 (só no banco, tabela conhecida) + 8 (tabela desconhecida) = 423 (banco)
```

## 7. Divergência de índice

O banco tem 565 índices, o `schema.ts` nomeia 358. A diferença se decompõe assim:

| Classe | Qtd | O que é |
|---|---|---|
| Nome bate nos dois lados | 340 | Sem divergência |
| Mesmo índice, nome diferente no banco | 18 | Mesma tabela, mesma lista de colunas, mesma unicidade, nome outro |
| PK implícita (`<tabela>_pkey`) | 145 | Criada pelo `.primaryKey()` de coluna; o Drizzle não nomeia índice para ela |
| UNIQUE implícita (`.unique()` de coluna) | 5 | `nps_respostas_token_unique`, `organizacoes_slug_unique`, `usuarios_email_unique`, `whatsapp_mensagens_uazapi_message_id_unique`, `whatsapp_sessao_session_name_unique` |
| Existe no banco, não declarado no Drizzle | 43 | Ver 7.2 |
| Índices em tabelas fora do Drizzle | 14 | Nas 6 tabelas base da seção 1 |
| **Declarado no Drizzle e inexistente no banco** | **0** | |

Conferência: `340 + 211 + 14 = 565` do lado do banco, e `340 + 18 = 358` do lado do Drizzle.

### 7.1 Índice declarado no Drizzle que existe no banco com outro nome

18 casos. Nenhum é índice parcial dos dois lados, então a comparação por lista de colunas e
unicidade é conclusiva (verificado: nenhum dos 18 gêmeos tem cláusula `WHERE` em
`_raw/indices.txt`, e nenhum dos 14 índices parciais do Drizzle está nesta lista).

| Tabela | Nome no Drizzle | Nome no banco | Tipo |
|---|---|---|---|
| `billing_customer_aliases` | `uq_billing_alias_customer` | `billing_customer_aliases_stripe_customer_id_key` | UNIQUE |
| `billing_identities` | `idx_billing_identities_dedup` | `billing_identities_organizacao_id_provider_external_custome_key` | UNIQUE |
| `catalogo_mapeamentos_legacy` | `idx_catalogo_mapeamentos_legacy_dedup` | `catalogo_mapeamentos_legacy_organizacao_id_legacy_product_i_key` | UNIQUE |
| `comercial_evidencia` | `idx_comercial_evidencia_dedup` | `comercial_evidencia_negocio_id_tipo_source_ref_key` | UNIQUE |
| `communications` | `idx_communications_external_id` | `communications_canal_external_id_key` | UNIQUE |
| `empresas` | `idx_empresas_canonical` | `idx_empresas_canonical_empresa_id` | btree |
| `event_outbox` | `idx_event_outbox_idempotency` | `event_outbox_idempotency_key_key` | UNIQUE |
| `fulfillment_linhas_portabilidade` | `idx_fulfillment_linhas_portabilidade_fulfillment` | `idx_fulfillment_linhas_port_fulfillment` | btree |
| `fulfillment_linhas_portabilidade` | `idx_fulfillment_linhas_portabilidade_org` | `idx_fulfillment_linhas_port_org` | btree |
| `legacy_provenance` | `idx_legacy_provenance_zoho_dedup` | `legacy_provenance_organizacao_id_entidade_tipo_zoho_id_key` | UNIQUE |
| `metricas_diarias` | `idx_metricas_diarias_org_data` | `metricas_diarias_organizacao_id_data_key` | UNIQUE |
| `portfolio_snapshots` | `idx_portfolio_snapshots_dedup` | `portfolio_snapshots_organizacao_id_snapshot_date_component_key` | UNIQUE |
| `reconciliation_changes` | `idx_reconciliation_change` | `reconciliation_changes_run_id_action_id_table_name_record_k_key` | UNIQUE |
| `reconciliation_runs` | `idx_reconciliation_run_package` | `reconciliation_runs_organizacao_id_package_version_package__key` | UNIQUE |
| `service_ledger_batches` | `idx_service_ledger_batch_version` | `service_ledger_batches_organizacao_id_competence_version_key` | UNIQUE |
| `service_ledger_entries` | `idx_service_ledger_entry_source` | `service_ledger_entries_batch_id_source_row_hash_key` | UNIQUE |
| `servico_billing_timeline` | `idx_servico_billing_timeline_external` | `servico_billing_timeline_organizacao_id_provider_external_i_key` | UNIQUE |
| `servicos_canonicos` | `idx_servicos_canonicos_org_key` | `servicos_canonicos_organizacao_id_canonical_key_key` | UNIQUE |

Risco em runtime: nenhum para consulta. O índice existe e o planejador o usa. Dos 18, 16 têm
nome terminado em `_key`, o padrão que o Postgres dá a uma `UNIQUE (...)` de tabela; em
`_raw/constraints.txt` eles aparecem como constraint tipo `u`, não como `CREATE UNIQUE INDEX`.
Ou seja, foram criados por migração SQL com sintaxe de constraint, enquanto `schema.ts` os
declara como `uniqueIndex()` com nome próprio. `drizzle-kit generate` enxerga isso como
18 índices faltando e 18 sobrando, e proporia dropar e recriar.

Nenhum dos 18 nomes existe no banco. Confirmado:

```
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN (os 18 nomes);
  -> 0 linhas
```

### 7.2 Índice no banco e não declarado no Drizzle

43 casos, fora as PKs e UNIQUEs implícitas. Fonte: `_raw/indices.txt`.

| Tabela | Índice | Tipo | Colunas |
|---|---|---|---|
| `assinaturas` | `idx_assinaturas_servico_id` | btree | servico_id |
| `assinaturas` | `uq_assinaturas_org_stripe_subscription` | UNIQUE | organizacao_id, stripe_subscription_id |
| `atividades` | `idx_atividades_empresa` | btree | empresa_id |
| `atividades` | `idx_atividades_lead_created` | btree | lead_id, created_at DESC |
| `billing_customer_aliases` | `idx_billing_alias_identity` | btree | billing_identity_id |
| `billing_customer_aliases` | `uq_billing_alias_one_canonical_per_identity` | UNIQUE | billing_identity_id |
| `billing_identities` | `idx_billing_identity_canonical_customer` | btree | organizacao_id, canonical_stripe_customer_id |
| `billing_identities` | `idx_billing_identity_cnpj` | btree | organizacao_id, cnpj_normalized |
| `billing_identities` | `idx_billing_identity_email` | btree | organizacao_id, primary_email_normalized |
| `billing_identities` | `idx_billing_identity_empresa_v2` | btree | organizacao_id, empresa_id |
| `cadence_enrollments` | `uq_cadence_enrollments_one_live` | UNIQUE | cadence_definition_id, entity_type, entity_id |
| `catalogo_mapeamentos_legacy` | `idx_catalogo_mapeamentos_legacy_nome_norm` | btree | organizacao_id, nome_normalizado |
| `contrato_templates` | `idx_contrato_templates_family` | btree | organizacao_id, service_family, ativo |
| `cs_riscos` | `idx_cs_riscos_aberto_unico` | UNIQUE | empresa_id, tipo, COALESCE(servico_canonico_id, '000...000'::uuid) |
| `empresas` | `idx_empresas_cnpj` | btree | organizacao_id, cnpj |
| `empresas` | `idx_empresas_dominio` | btree | organizacao_id, dominio |
| `faturas` | `idx_faturas_acionado` | btree | acionado_cobranca |
| `faturas` | `idx_faturas_grupo_comercial` | btree | grupo_comercial_id |
| `leads` | `idx_leads_agenda_closer` | btree | agenda_closer_id |
| `leads` | `idx_leads_crm2_pre_vendas_stage` | btree | crm2_pre_vendas_stage |
| `leads` | `idx_leads_estagio_pre_vendas` | btree | organizacao_id, estagio_pre_vendas |
| `leads` | `idx_leads_nutricao_retomar` | btree | organizacao_id, nutricao_retomar_em |
| `leads` | `idx_leads_prospeccao_estado` | btree | organizacao_id, prospeccao_estado |
| `leads` | `idx_leads_qualificado` | btree | organizacao_id, qualificado |
| `leads` | `idx_leads_utm_campaign_lookup` | btree | utm_campaign |
| `negocios` | `idx_negocios_bundle` | btree | bundle_id |
| `negocios` | `idx_negocios_etapa` | btree | organizacao_id, etapa |
| `negocios` | `idx_negocios_family` | btree | organizacao_id, service_family |
| `negocios` | `idx_negocios_proxima_acao` | btree | organizacao_id, proxima_acao_em |
| `negocios` | `idx_negocios_status_ganho_at` | btree | status, ganho_at |
| `nps_respostas` | `idx_nps_empresa` | btree | empresa_id, respondido_em DESC |
| `oportunidades` | `idx_oportunidades_bundle` | btree | bundle_id |
| `proposta_grupo_comercial` | `idx_grupo_comercial_pagamento_status` | btree | organizacao_id, pagamento_status |
| `proposta_itens` | `idx_proposta_itens_stripe_price` | btree | stripe_price_id |
| `propostas` | `idx_propostas_negocio` | btree | negocio_id |
| `propostas` | `idx_propostas_signatarios` | btree | signatarios |
| `servicos_catalogo` | `idx_servicos_catalogo_origem` | btree | organizacao_id, origem_catalogo, service_family |
| `servicos_catalogo` | `idx_servicos_catalogo_stripe_product` | UNIQUE | organizacao_id, stripe_product_id |
| `stripe_webhook_events` | `stripe_webhook_events_stripe_event_id_key` | UNIQUE | event_id |
| `tarefas` | `idx_tarefas_chave_idem` | UNIQUE | organizacao_id, chave_idempotencia |
| `tarefas` | `idx_tarefas_empresa` | btree | empresa_id |
| `tarefas` | `idx_tarefas_org_status` | btree | organizacao_id, status |
| `won_evidence_policies` | `idx_won_evidence_policies_org_produto_ativo` | UNIQUE | organizacao_id, produto |

Risco em runtime, por natureza do índice:

- Os 34 btree: nenhum efeito sobre correção. O planejador os usa normalmente. O efeito é sobre
  migração: `drizzle-kit generate` não os conhece e um schema regenerado a partir do
  `schema.ts` não os teria, o que muda o plano de consultas de `leads`, `negocios` e `tarefas`,
  as três tabelas mais indexadas fora do Drizzle.
- Os 9 UNIQUE: são regras de integridade que o banco aplica e o código não declara. Um
  `INSERT` que viole `uq_assinaturas_org_stripe_subscription`, `uq_cadence_enrollments_one_live`,
  `idx_tarefas_chave_idem`, `idx_cs_riscos_aberto_unico`, `uq_billing_alias_one_canonical_per_identity`,
  `idx_servicos_catalogo_stripe_product`, `idx_won_evidence_policies_org_produto_ativo` ou
  `stripe_webhook_events_stripe_event_id_key` compila e é rejeitado em runtime com unique
  violation. Nenhuma dessas regras aparece no tipo TypeScript.

Observação factual sobre `stripe_webhook_events_stripe_event_id_key`: o nome da constraint cita
`stripe_event_id`, mas a coluna indexada é `event_id`, e não existe coluna `stripe_event_id`
na tabela (`_raw/colunas.txt`). O nome ficou de um estado anterior do schema.

### 7.3 Índice com unicidade divergente

Nenhum. Nos 340 índices cujo nome bate dos dois lados, `uniqueIndex()` corresponde a
`CREATE UNIQUE INDEX` e `index()` a `CREATE INDEX` em todos os casos.

---

## NÃO CONFIRMADO

- **Divergência de tipo de dado.** Não foi comparada. O `schema.ts` usa `decimal(..., { precision, scale })`
  e `timestamp(..., { withTimezone: true })`, e o dump traz `numeric` e `timestamp with time zone`.
  Um comparador de tipos exigiria mapear cada helper do Drizzle para o tipo do Postgres, inclusive
  precisão, escala e `.array()`. O script atual não faz isso.
- **Divergência de valor default.** Não foi comparada. `_raw/colunas.txt` traz o default do banco, mas
  os `.default()` do Drizzle não foram extraídos.
- **Índices parciais: igualdade do predicado.** Os 14 `uniqueIndex().where(sql\`...\`)` do `schema.ts`
  batem por nome com índices do banco, e a unicidade confere, mas o texto do predicado não foi
  comparado com a cláusula `WHERE` do `CREATE INDEX`. Um predicado divergente com mesmo nome não
  seria detectado.
- **Ordem e direção das colunas dentro do índice.** Na detecção de renomeação (7.1) a comparação
  respeita a ordem, mas `ASC`/`DESC` e `NULLS FIRST/LAST` do lado do Drizzle não foram lidos.
- **`ON DELETE` / `ON UPDATE` das FKs.** O banco declara a regra (`_raw/foreign-keys.txt`, coluna 6) e o
  Drizzle também (`{ onDelete: "cascade" }`, 148 ocorrências), mas as duas não foram confrontadas.
- **Constraints CHECK.** `_raw/constraints.txt` tem 82 linhas com 39 UNIQUE e o restante CHECK. O Drizzle
  não declara CHECK neste schema, então toda CHECK do banco é desconhecida da aplicação. O número
  exato de CHECKs não foi apurado nem listado.
- **Triggers e a view.** `_raw/triggers.txt` lista 2 triggers (`service_ledger_entries`, `tarefas`) e
  `_raw/views.txt` 1 view. Nada disso tem representação no Drizzle. Não foi investigado o que fazem.
- **Se o drift é o mesmo em homologação e produção.** Este levantamento cobre apenas o banco local
  com a carga de 20/09/2026.
- **Qual lado está certo.** Fora de escopo por instrução. O documento registra a diferença, não
  decide qual versão prevalece.
- **Comentário em `schema.ts:890`** marca `organizacao_id`, `api_version` e `livemode` de
  `stripe_webhook_events` como "só no dev". As três existem neste banco local
  (`_raw/colunas.txt`). Se o comentário descreve produção, não foi verificado.

## Como reproduzir

```
cd "/Users/Scott/Documents/Scott Studio/callface-crm-dev/docs/architecture/database-as-is/_raw"
python3 comparar-schema-banco.py            # placar por categoria
python3 comparar-schema-banco.py --json     # diff completo em JSON
python3 comparar-schema-banco.py --check    # autoteste dos parsers
```

O script lê `schema.ts` e os `.txt` deste diretório. Não abre conexão com o banco e não escreve
nada. Para regerar os `.txt` a partir do banco, ver a seção "Como este material foi produzido"
em `README.md` e o dump `00-schema-only.sql`.
