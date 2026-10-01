# 09 — CAPTURA DO ESTADO REMOTO (PROD/DEV, 23/09) — RODADA 1 EXECUTADA

Executado pelo usuário via terminal (fora do sandbox), 23/09/2026. Read-only.

## FATO CRÍTICO — produção NÃO roda o modelo canônico
`docker exec callface-crm-postgres psql -d callface_crm -c "... _migracoes_aplicadas"` →
**`ERROR: relation "_migracoes_aplicadas" does not exist`**.

O runner `migrar.ts` (que cria `_migracoes_aplicadas` ao aplicar as 91 migrations 0000–0090) **nunca rodou em produção**. ⇒ o schema de produção é o **legado**, não o canônico. Confirma com evidência de runtime no servidor real o que o baseline inferiu: **produção roda a geração anterior**. As contagens canônicas (aquisicoes/oportunidades/servicos_canonicos/cliente_receita_mensal/cs_*) provavelmente NEM EXISTEM como tabela em produção — a "perda" observada no banco local NÃO se aplica a produção do mesmo jeito, porque produção nunca teve o schema canônico. (2ª rodada confirma nomes reais.)

## Host e stacks (docker ps) — FATO
Host `ip-172-31-71-0`. `/opt/callface/` hospeda várias apps: crm, crm-homolog, crm2-dev, merencia, growth, infra, lp, n8n, painel, site.
- **PROD CRM**: `callface-crm-app` (up 5 dias), `callface-crm-api` (6 dias), `callface-crm-worker` (6 dias), `callface-crm-postgres` (2 semanas), `callface-crm-wuzapi`, `callface-crm-redis` (3 meses).
- **DEV remoto**: `callface-crm2-dev-{app,api,worker,postgres,redis,wuzapi}` (app/api/worker up 6–7h → rebuild recente; postgres/redis up 11 dias).
- **HOMOLOG**: `callface-crm-homolog-{app,api,worker,postgres,redis}` (2 semanas–2 meses).
- Merencia (Callface AI?): admin-front/agent/admin-api/tools-api/classifier/mlflow/db/qdrant — stack de IA separada, viva.
- traefik v3, n8n, lp, site, growth, painel — todos up.

## Git em /opt/callface (parcial)
Só `/opt/callface/merencia/` respondeu como repo git: branch `main`, HEAD 39adcb6f, "Merge PR #278 fix/telas-do-glpi-dizem-a-verdade" (23/09), com 3 arquivos `config/tenant.yaml.bak-*` não rastreados. As pastas crm/crm2-dev/crm-homolog não retornaram HEAD no laço (provável: não são git repos no servidor, ou o deploy é por imagem/tarball, não git — coerente com "espelha /opt/callface/crm/app/src" do commit de prod).

## PENDENTE — RODADA 2 (contagens do schema REAL de produção)
O 1º comando abortou no erro do `_migracoes_aplicadas` antes das contagens. Rodar no terminal:

```
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 'echo "=== PROD tabelas ==="; docker exec callface-crm-postgres psql -U callface -d callface_crm -Atc "select tablename from pg_tables where schemaname=\047public\047 order by 1"; echo "=== PROD contagens ==="; for t in leads empresas negocios oportunidades aquisicoes contratos faturas assinaturas fulfillments clientes cliente_receita_mensal cs_marcos cs_riscos servicos_canonicos pessoas contatos audit_log domain_events; do echo -n "$t: "; docker exec callface-crm-postgres psql -U callface -d callface_crm -Atc "select count(*) from $t" 2>/dev/null || echo "(nao existe)"; done; echo "=== PROD assinatura ==="; docker exec callface-crm-postgres psql -U callface -d callface_crm -Atc "select count(*) from contratos where assinado_em is not null" 2>/dev/null || echo "(coluna/tabela nao existe)"; echo "=== PROD ultimo audit ==="; docker exec callface-crm-postgres psql -U callface -d callface_crm -Atc "select max(created_at) from audit_log" 2>/dev/null'
```

Isso responde: (a) qual é o schema real de produção (legado vs canônico); (b) P0-2 — se as tabelas canônicas existem em prod e quão cheias estão; (c) P0-1 — se produção registra assinatura.

---

# RODADA 2 EXECUTADA — schema e contagens REAIS de produção

Nota: `/sandbox` do usuário retornou "Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally" → a trava de sandbox é POLÍTICA do ambiente; reiniciar não libera SSH. Captura remota permanece via terminal do usuário.

## Produção é uma GERAÇÃO INTERMEDIÁRIA (não legado puro, não canônico completo) — FATO
Tabelas que EXISTEM em prod (parcial do trabalho canônico): `servicos_canonicos` (440), `fulfillments` (27), `fulfillment_itens/ramais/formularios/linhas_portabilidade`, `billing_*` (identities/audit_runs/correction_ledger/resolution_cases/customer_aliases), `correction_runs/change_log`, `reconciliation_runs/changes`, `legacy_provenance`, `eventos_comerciais`, `mrr_movimentos`, `service_ledger_*`, `servico_billing_timeline`, `portfolio_snapshots`, `ai_sdr_config/state/logs`, `automacoes`, `cadencia_execucoes`, `email_sequencias/passos/execucoes`, `meta_lead_staging`, `stripe_webhook_events`, `sdr_memory`.

Tabelas que NÃO EXISTEM em prod (camada canônica final, só em dev/local): **`_migracoes_aplicadas`, `oportunidades`, `aquisicoes`, `pessoas`, `pontos_contato`, `clientes`, `cliente_receita_mensal`, `cs_marcos`, `cs_riscos`, `cs_renovacoes`, `domain_events`, `event_outbox`, `timeline_events`**.

⇒ O refactor canônico final **CP1–CP63** (identidade pessoas/aquisicoes/oportunidades + CS + outbox de domínio) **nunca foi implantado em produção**. Produção parou na geração "F0–F7 + CRM 2.0 + billing/reconciliação", operada pelo grupo `(crm)`. O redesign/dev (crm2-dev) é a geração canônica completa, ainda não em produção.

## Contagens REAIS de produção (a verdade operacional) — FATO
| Tabela | PROD | LOCAL (callface_crm) | Leitura |
|---|---|---|---|
| leads | 4012 | 4066 | +54 locais (Meta de hoje) |
| empresas | **2222** | 3105 | **as 877 de texto livre NÃO existem em prod** — corrupção é LOCAL |
| negocios | 1584 | 1578 | equivalente |
| contratos | 746 | 745 | equivalente |
| faturas | 984 | 978 | equivalente |
| assinaturas | 357 | 357 | igual |
| fulfillments | **27** | 26 | **produção tem 27 — NÃO houve perda de fulfillments** |
| servicos_canonicos | 440 | 439 | equivalente |
| contatos | 1753 | 1731 | equivalente |
| oportunidades/aquisicoes/pessoas/clientes/cliente_receita_mensal/cs_marcos/cs_riscos | **não existem** | preenchidas | **produção nunca teve a camada canônica** |
| audit_log | **22** | 138 (22 reais) | as 22 reais vieram de prod; resto é smoke local. Último audit prod: **2026-09-21 18:11** |
| contratos.assinado_em | **coluna não existe** | NULL em 745 | **P0-1 CONFIRMADO: produção não registra assinatura** |

## Correções às conclusões anteriores (evidência de runtime em produção)
1. **P0-2 (perda de dado) — RESOLVIDO DEFINITIVO**: cliente_receita_mensal (12.917), cs_marcos (2.114), cs_riscos (396) **nunca existiram em produção** — são do experimento de carga canônica LOCAL. fulfillments em prod = 27 (não houve 416→26; o 416 era do pre_carga local com backfill). **Nenhuma perda de dado em produção.**
2. **P0-3 (empresas corrompidas) — é LOCAL**: prod tem 2222 empresas limpas; as 877 de texto livre foram criadas pelo job só no banco local. Produção intocada.
3. **P0-1 (assinatura) — CONFIRMADO e mais grave**: em produção a tabela `contratos` sequer tem a coluna `assinado_em`. Produção não tem como registrar assinatura de contrato. Vale para 746 contratos ativos.
4. **Regra do PO confirmada por dado**: produção (geração intermediária, grupo (crm)) é o que o time usa; a camada canônica e o redesign vivem em dev — a virada é uma promoção futura, não algo já feito.
