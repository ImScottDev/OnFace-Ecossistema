# ONFACE — log de execução do refactor

Histórico append-only. O estado atual vive em `refactor-state.md`.

---

## 2026-09-21 — Fase 01 · Freeze, backup e baseline

**Mudanças:** nenhuma no código ou no banco.

**Ações:**
- repositório confirmado limpo (0 pendências) no commit `98940fe`;
- backup fresco do banco antes de qualquer migration:
  `_prod-snapshot-20260920/pre-refactor-20260920.dump`, 17 MB, `pg_dump -Fc -Z6`;
- backups anteriores preservados: dump de produção de 20/09 (17 MB) e backup do dev
  pré-carga (15 MB);
- branch `refactor/arquitetura-canonica` criada a partir de `98940fe`.

**Migrations:** nenhuma.

**Reconciliação:** nenhuma ainda.

**Testes:** baseline herdado, `tsc` limpo e 115 testes passando.

**Dados não resolvidos:** nenhum novo.

**Auditoria de inconsistência (a pedido do Kauã):** verificado que a correção de
`billing_customer_aliases` está aplicada no commit `98940fe` e é herdada por esta
branch; o diff da branch é zero porque nada novo foi escrito nela ainda. Detalhe em
`refactor-state.md`.

**Commit:** `98940fe` (baseline, sem commit novo nesta entrada).

---

## 2026-09-21 — Fase 01 · Reconciliação de drift — CONCLUÍDA

**Migration aplicada:** `0056_reconciliacao_baseline_refactor.sql`

Verificações feitas **antes** de aplicar, todas com resultado zero:
- nulos em `organizacao_id` nas 4 tabelas financeiras: `contratos` 0, `assinaturas` 0,
  `faturas` 0, `mrr_movimentos` 0;
- órfãos nas 3 relações a criar: `leads.canonical_lead_id` 0,
  `mrr_movimentos.evento_comercial_id` 0, `proposta_grupo_comercial.oportunidade_id` 0.

**Schema:** 4 tabelas declaradas, 3 colunas adicionadas, 26 `.notNull()` aplicados.

**Reconciliação de drift:**

```text
tabelas só no banco      6 → 2 (ambas de controle interno)
tabelas só no Drizzle    0 → 0
colunas divergentes      8 → 0
nullability divergente  26 → 0
FKs sem par              3 → 0
```

**Bugs encontrados e corrigidos:** 3 `INSERT` em `tarefas` no worker sem
`organizacao_id`, que falhavam em runtime desde a migration 0050. Corrigidos usando a
organização já resolvida e validada no escopo de cada um.

**Nota de método:** a primeira tentativa de aplicar `.notNull()` por script inseriu a
chamada dentro do `references()`, porque o parser contava chaves e não parênteses.
Quebrou 25 declarações, foi detectado pelo `tsc` e revertido antes de qualquer commit.

**Testes:** `tsc --noEmit` 0 erros; 104 testes, 0 falhas.

**Dados não resolvidos:** nenhum.

**Commit:** `3a47d94`

---

## 2026-09-21 — Fases 02 e 03 · Arquitetura física e fronteiras — CONCLUÍDAS

**Mudanças:** estrutura de `packages/` e `apps/` criada conforme SPEC §34; workspace
pnpm movido para a raiz; 7 testes de arquitetura adicionados.

**Pacotes:** 38 (14 domínio, 10 integrações, 9 platform, 5 shared), cada um com
`package.json` e `index.ts`. Os diretórios de domínio seguem a anatomia do SPEC §36.

**Decisão de método registrada:** os pacotes nascem vazios e o código migra domínio a
domínio, nas fases seguintes. O pacote `app` continua sendo a aplicação que roda. Isso
evita um big bang de 781 arquivos e mantém o sistema verificável a cada passo, que é o
que o SPEC pede ao exigir checkpoint por bloco.

**Testes de arquitetura (SPEC §35, §50.1):** domínio não importa SDK de provedor,
framework de entrega, implementação de integração nem cliente de banco; integração não
importa aplicação; ferramenta de IA não toca banco; todo pacote tem porta de entrada.
Passam trivialmente enquanto os pacotes estão vazios, e é de propósito: a regra precisa
valer antes do código chegar.

**Percalço registrado:** a primeira criação da árvore usou `for x in $VAR` em zsh, que
não faz word splitting como bash, e gerou um diretório único com o nome inteiro. Foi
detectado na conferência, removido e refeito em Python antes de qualquer commit.

**Migrations:** nenhuma nesta fase.

**Testes:** `tsc` 0 erros; 111 testes, 0 falhas.

**Commit:** `9c79729`

---

## 2026-09-21 — Fase 04 · Expansão do modelo canônico — CONCLUÍDA

**Migrations:** `0057_expansao_dominio_canonico`, `0058_expansao_plataforma`,
`0059_corrige_unicidade_inscricao`.

**17 tabelas criadas**, todas vazias e todas com `organizacao_id NOT NULL` + FK.
EXPAND puro: nenhuma alteração incompatível, nenhuma remoção, nenhum dado movido.

**Erro próprio encontrado na revisão e corrigido:** a 0058 declarou
`UNIQUE (automacao_id, entity_type, entity_id, status)` em `automacao_inscricoes`.
Com o status dentro da chave, duas inscrições **canceladas** da mesma entidade
colidiam, e isso é histórico legítimo. Provado em transação revertida: o segundo
`INSERT` com `CANCELLED` falhava. A 0059 troca por índice único parcial sobre
`ACTIVE`/`PAUSED`. Reteste nos dois sentidos: duas canceladas passam, duas ativas
são bloqueadas.

**Constraints exercitadas (10):** aquisição sem empresa nem pessoa bloqueia; só com
empresa passa; tipo inválido bloqueia; score 150 bloqueia e 72 passa; `actor_type`
inválido bloqueia e `AI_AGENT` passa; idempotency_key duplicada bloqueia;
`win_condition` inválido bloqueia; `entity_type` de arquivo inválido bloqueia.

**Conferência de schema:** as 17 tabelas comparadas coluna a coluna com o banco,
17/17 idênticas. Drift de tabela permanece 0.

**Testes:** `tsc` 0 erros; 111 testes, 0 falhas.

**Dados não resolvidos:** nenhum. Nenhum dado foi tocado nesta fase.

**Commit:** `635377f`

---

## 2026-09-21 — Fases 05 e 06 · Backfill de identidade e aquisição — CONCLUÍDAS

**Migrations:** 0060 (reconciliação e provenance), 0061 (campos de vínculo),
0062 (atribuição em `pontos_contato`).

**Fase 05 — identidade.** 3.989 leads → 3.950 pessoas. Resolução determinística:
e-mail normalizado (3.496), telefone com 10+ dígitos (344), origem única (110).
Colapso de 39 linhas que eram a mesma pessoa. 2.324 vínculos pessoa-empresa.
8 casos de reconciliação: identidades com mais de uma empresa ganharam vínculo para
cada uma, nenhum principal, decisão adiada para humano.

**Fase 06 — aquisição.** 3.989 aquisições e 1.583 touchpoints. Tipos: INBOUND 1.907,
IMPORT 1.279, MANUAL 656, OUTBOUND 100, REFERRAL 47.

**Três erros próprios, encontrados antes de causar dano:**

1. O script da fase 05 usou `cargo` numa tabela que só tinha `papel`. Falhou na
   primeira linha, antes de gravar em massa. A 0061 adicionou a coluna.
2. O mapeamento de origem da fase 06 comparava com acento e não reconhecia
   "Mídia Paga" (1.536 linhas) nem "Orgânico"; e tratava "ZohoDesk" e "stripe"
   como canal em vez de carga de sistema antigo. MANUAL caiu de 2.481 para 656.
3. O teste "atribuição não foi inventada" acusou 87 touchpoints vazios. Investigado:
   os 87 têm `utm_term` e `utm_content`, que são sinais legítimos. O teste olhava 8
   dos 13 campos. O backfill estava certo, o teste errado.

**Dado ausente declarado:** as colunas de qualificação de `leads` estão vazias em
3.989 de 3.989 linhas no banco de produção.

**Validação:** pessoas sem provenance 0; leads não mapeados 0; e-mail sem origem 0;
origem para dois destinos 0; vínculos órfãos 0; aquisições sem identidade 0;
touchpoints órfãos 0; touchpoints sem sinal 0.

**Testes:** 121 passando, 0 falhas. 10 testes de reconciliação (SPEC §50.2).

**Commits:** `145f475`, `69568cd` e o fix do teste.

---

## 2026-09-21 — Fase 07 · Pipeline e oportunidade — CONCLUÍDA

**Etapas:** 10 saíram do JSON de `pipelines.stages` para `pipeline_etapas`, com
`tipo_fechamento` explícito. `outra_data`, `sem_retorno` e `no_show` mapeiam para
`OPEN`: são tentativa, não fechamento. Tratá-los como perda inflaria a taxa de perda
em 246 linhas.

**Oportunidades:** 1.562 negócios → 1.561 oportunidades. Um não foi migrado por não
ter pessoa nem empresa, e está declarado em vez de forçado.

**Família de produto, a regra difícil desta fase.** O SPEC §42 diz que
`service_family` ausente "must not be blindly filled with guesses". Cadeia de
evidência aplicada em ordem de confiança:

```text
o próprio negócio                  2
item de proposta                   0
catálogo do item da proposta     256
item de contrato                 142
serviço canônico do lead          77
────────────────────────────────────
resolvidas                       477
NÃO resolvidas                 1.084  → caso de reconciliação, família NULA
```

Nenhuma foi chutada. `NULL` não virou `'UNKNOWN'`: um teste garante a distinção.

**Erro próprio corrigido antes de gravar:** o script referenciou `n.valor` e `n.mrr`,
que não existem. As colunas reais são `valor_total`/`valor_projeto` e
`mrr_fechado`/`mrr_estimado`, e `negocios` não tem `perdido_at`. Falhou no primeiro
insert, antes de qualquer gravação em massa.

**Validação:** negócios não migrados 1 (declarado); família `UNKNOWN` gravada 0; sem
família e sem caso 0; sem identidade 0; família sem evidência 0; ganho e perda
coexistindo 0.

**Testes:** 126 passando, 0 falhas. 15 de reconciliação.

**Commit:** `f96c163`

---

## 2026-09-21 — Fase 08 · Política comercial por oferta — CONCLUÍDA

**Migration 0063.** Cria as quatro ofertas do SPEC §12.3 e adiciona
`oferta_comercial_id` em `oportunidades`, `propostas`, `contratos` e
`catalogo_precos`.

**O risco que esta fase fecha.** Confirmado no banco de produção:
`won_evidence_policies` libera Won para PABX e White Label com `signed_contract`
isolado, sem prova de pagamento, enquanto `won-evidence.ts:19` documenta o
contrário. Código e banco discordam, e em runtime o banco vence. A causa raiz é a
política ser indexada por família: o mesmo produto vendido de duas formas precisa de
duas regras, e com uma regra por família uma delas está errada por construção.

`won_evidence_policies` **fica intacta**. A troca de leitor é cutover (fase 16).

**Vínculo por evidência, nunca por default:**

```text
CALLFACE_AI_DIRECT     189   (negócio sem contrato)
CALLFACE_AI_CONTRACT   138   (negócio com contrato)
PABX_CONTRACT          139
WHITE_LABEL_CONTRACT    11
──────────────────────────
vinculadas             477   sem oferta correspondente: 0
```

**Primeiro pacote de domínio com código real:** `packages/domain/catalog`. Sem SDK
de provedor, sem framework de entrega, sem banco — recebe o estado já lido e devolve
decisão com o que falta, no mesmo contrato de `lib/vendas/resultado.ts`. Os testes de
arquitetura da fase 03 garantem a fronteira.

**8 testes de domínio (SPEC §50.3)** cobrindo o caso que originou o risco: PABX com
contrato assinado e sem pagamento; a mesma família com regras opostas; pessoa sem
empresa bloqueada na proposta.

**Testes:** 134 passando, 0 falhas.

**Commit:** `484b1bb`
