# Auditoria do ONFACE — 23/09/2026

Medida no banco e no código, não presumida. O DEV local está carregado com
produção de hoje (4012 leads), então o que está vazio aqui está vazio de fato.

---

## 1. Por que o projeto parece travado

A resposta curta: **o modelo canônico foi construído e nunca foi exercitado com
dado real numa base limpa.**

Tudo funcionava no banco de desenvolvimento porque aquele banco evoluiu por
acumulação: cada execução deixava estado que a próxima encontrava pronto. Quando
recarreguei de produção de verdade, os buracos apareceram todos de uma vez, e
todos com a mesma assinatura:

| defeito | o que assumia | achado em |
|---|---|---|
| backfill 06 lia `leads.qualificado`, `desqualificado_em`, `estagio_pre_vendas` | colunas que **não existem** em produção | 23/09 |
| migration 0081 materializava etapa | `aquisicoes` já populada (está vazia na cadeia) | 23/09 |
| migration 0083 ligava `permite_trial` | `ofertas_comerciais` já populada (idem) | 23/09 |
| migrations 0084/0085 | mesmo padrão (já corrigido antes pelo passo 16) | anterior |
| backfill 06b casava por `lead_legado_id` | vínculo que só o passo 16 cria, e ele é o último | 23/09 |
| webhook Meta cria aquisição | sem `lead_legado_id`, e o card não abre sem ele | 23/09 |
| sync Callface AI | reportava números quando a conexão caía | 23/09 |
| smoke-board-familia | número fixo de uma carga antiga (125, virou 128) | 23/09 |

**Não são oito bugs. É um bug repetido oito vezes:** código que depende de estado
que só existe num ambiente que cresceu aos poucos. Nenhum deles aparece em
`tsc`, em teste unitário ou em revisão de código. Só aparecem quando se carrega
produção num banco vazio e roda a cadeia inteira, que foi o que esta sessão fez
pela primeira vez.

O lado bom: cada um foi corrigido na origem, e o passo 16 já era a prova de que
o time conhecia o padrão. O lado ruim: eles estavam esperando o dia da virada em
produção para aparecer.

### A minha parte

Fui reativo. Devia ter feito **esta auditoria no primeiro momento**, visto o
mapa inteiro e priorizado. Em vez disso segui item a item conforme cada coisa
quebrava, e gastei rodadas em cautela que não se sustentava quando medida (disse
que um build precisava de janela fora do horário comercial; ele leva segundos).

---

## 2. O que está vazio no banco (78 tabelas)

Com produção de hoje carregada. Agrupado por domínio:

### IA e agentes — 28 tabelas, zero linhas
`ai_agents`, `ai_agent_runs`, `ai_agent_versions`, `ai_routers`, `ai_router_decisions`,
`ai_knowledge_sources`, `ai_knowledge_chunks`, `ai_memory_entries`, `ai_skill_versions`,
`ai_provider_credentials`, `ai_sdr_config`, `ai_sdr_logs`, `ai_usage_budgets`, `ai_alerts`,
`ai_cases`, `ai_analysis` e outras.

Nenhum agente configurado, nenhuma credencial de provider, nenhum run. A
fundação de schema existe inteira; o que não existe é configuração e uso.
`GROQ_API_KEY` está vazia, o que explica parte disso.

### Callface AI — 4 tabelas, zero linhas
`callface_ai_external_identities`, `callface_ai_tenant_snapshots`,
`callface_ai_usage_events`, `callface_ai_reconciliation_candidates`, mais
`integracao_sync_estado`.

**Consequência visível:** 238 serviços da família CALLFACE_AI aparecem como "não
conectado" no Cliente 360. O sync existe (`sincronizar-callface-ai.ts`) e não
roda: a porta 55432 do banco do SaaS está fechada (túnel inativo). Até hoje ele
falhava em silêncio; corrigido nesta sessão para dizer que não sincronizou.

### Automações e cadências — 10 tabelas, zero linhas
`automacoes`, `automacao_versoes`, `automacao_execucoes`, `automacao_inscricoes`,
`automacao_passos_execucao`, `cadence_definitions`, `cadence_versions`,
`cadence_enrollments`, `cadence_enrollment_events`, `cadence_definition_pointers`.

### CS — 4 tabelas, zero linhas
`cs_cancelamentos`, `cs_marcos`, `cs_renovacoes`, `cs_riscos`.

### E-mail — 3 tabelas, zero linhas
`email_sequencias`, `email_sequencia_passos`, `email_sequencia_execucoes`.
`RESEND_API_KEY` vazia.

### Arquivos — 3 tabelas, zero linhas
`anexos`, `file_objects`, `file_links`. Ver o item de storage abaixo: **nunca
funcionou**, e o P0-11 do tracker de readiness segue marcado como pendente.

### Eventos e métricas
| tabela | linhas |
|---|---|
| `eventos` (event sourcing canônico) | **0** |
| `event_outbox` | 104 |
| `vendas_eventos` | 0 |
| `metricas_diarias` | 0 |
| `cliente_receita_mensal` | 0 |

O outbox tem movimento e a tabela canônica de eventos não. Vale apurar se
`eventos` deveria estar recebendo.

### O que TEM dado (para contraste)
`atividades` 13.383 · `conversas` 5.912 · `ligacoes` 5.221 · `propostas` 1.556 ·
`contratos` 745 · `reunioes` 305 · `tarefas` 433 · `leads` 4.012 ·
`aquisicoes` 4.066 · `negocios` 1.578.

O núcleo comercial está cheio e reconciliado. O que falta é a periferia:
automação, IA, CS, e-mail, arquivos, métricas.

---

## 3. Integrações, uma por uma

| integração | dev local | dev remoto | o que falta |
|---|---|---|---|
| **Meta Graph / Lead Ads** | token System User sem expiração, `leads_retrieval` ok, 877 leads importados | **nenhuma variável `META_*`** | copiar as variáveis do local para o remoto |
| **Meta CAPI** | `META_CAPI_ACCESS_TOKEN` preenchido | ausente | idem |
| **Meta Ads Insights** | `META_ADS_ACCESS_TOKEN` preenchido | ausente | idem |
| **Stripe** | `STRIPE_API_KEY` **vazia** | vazia | chave `sk_test_` — não existe em lugar nenhum do repo ou vault |
| **Resend** | vazia | vazia | chave de teste |
| **Groq (SDR/IA)** | vazia | vazia | chave |
| **Callface AI** | URL preenchida, **porta fechada** | ausente | túnel/porta 55432 |
| **Documenso** | URL e token preenchidos | não verificado | validar |
| **WhatsApp (wuzapi)** | container de pé há 11 dias | de pé | validar envio |

---

## 4. Storage: quebrado, e não é config de app

O volume `/opt/callface/crm2-dev/uploads` pertence a uid **1000** com permissão
755. O container roda como uid **1001** (`nextjs`, criado assim no Dockerfile).
O container não consegue gravar: `Permission denied`.

O diretório está vazio desde 11/09. As três tabelas de arquivo estão zeradas.
**Upload nunca funcionou nesse ambiente.**

Correção (uma linha, precisa de root):

```bash
sudo chown -R 1001:65533 /opt/callface/crm2-dev/uploads
```

Alternativa sem root: declarar `user: "1000:1000"` no serviço `app` do compose.

---

## 5. Estado do que foi corrigido nesta sessão

| frente | resultado |
|---|---|
| DEV local | produção de hoje, funil 1620, Pipeline 536/604, bateria 50/50 |
| DEV remoto | banco sincronizado, imagens `app` e `api` reconstruídas, tudo healthy |
| Pré-vendas | causa raiz corrigida no backfill e na leitura |
| Carteira | 60 serviços reconciliados nos dois ambientes (ACTIVE 135 → 85) |
| Meta Lead Ads | importador novo; 877 leads, **54 que não estavam no CRM** |
| Callface AI | sync deixou de mentir quando a conexão cai |

---

## 6. O que eu faria a seguir, nesta ordem

1. **Destravar as integrações** (bloqueado por credencial, não por código):
   copiar `META_*` do local para o remoto, e obter `sk_test_` do Stripe, chave do
   Resend e do Groq. Sem isso não há como testar cobrança, e-mail nem SDR.
2. **Storage** — uma linha de `chown`, e o P0-11 fecha.
3. **Túnel do Callface AI** — destrava 238 serviços marcados como "não
   conectado" e as 4 tabelas de identidade.
4. **Corrigir o webhook da Meta** para criar o lead legado, como o `rd-lead` já
   faz. Hoje todo lead que entra por ele nasce com card que não abre.
5. **Apurar `eventos` com 0 linhas** enquanto o outbox tem 104.
6. **Só então** voltar para UI e jornadas. Enquanto integração e dado estiverem
   assim, toda tela vai parecer quebrada — e vai estar, por falta de dado, não
   por falta de design.
