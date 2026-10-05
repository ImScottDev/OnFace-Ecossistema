# Plano de carga da virada ONFACE

> **ATENÇÃO — este documento é de ANTES do refactor canônico.**
>
> A receita de carga (fases 1 e 2, corte em 0012) continua válida e é a que o
> `scripts/ensaio-carga.sh` executa. O que falta aqui são os **backfills** e o
> passo 16 de materialização, que vieram depois.
>
> **O procedimento de virada completo e unificado está em
> `docs/operacao/virada/entrega-final.md`, seção 8.** Use aquele. Este fica como
> registro de como a carga foi levantada e do que se perde, medido linha a linha.

> **Estado:** pronto para revisão (QA). Tarefa F0.1 do `PLANO-VIRADA.md`.
> **Data do levantamento:** 18/09/2026. Dump de produção usado no ensaio:
> `pg_dump` de `callface-crm-postgres` em 18/09, 17 MB.
> **Nada foi escrito em homolog ou produção.** O único acesso remoto foi
> `pg_dump`/`psql -Atc` de leitura dentro dos containers. Todo ensaio rodou em
> banco local rascunho (`callface_crm_ensaio`), nunca no banco de trabalho.

O modelo da virada é **substituição, não migração incremental**: domingo o
sistema novo inteiro (código de `dev` + schema de `dev`) toma o lugar do antigo,
e o dado de produção é trazido para o schema novo antes de virar. Este documento
é a receita dessa carga, o que ela custa em dado, e o que ficou sem verificar.

---

## 1. Ensaio local ponta a ponta

### O que foi feito

Dump de produção → restore num banco local rascunho → passos de carga → cadeia
de migrações de `dev` → checks de sanidade. Tudo automatizado em
`scripts/ensaio-carga.sh`, que é **a mesma receita** que roda em homolog no
sábado e em produção no domingo — só muda o banco de destino.

```
./scripts/ensaio-carga.sh            # exit 0
```

Resultado final: **49 migrações aplicadas, nenhuma tabela perdeu linha fora do
declarado, nenhuma FK órfã, e nenhuma tabela ou coluna de `dev` ausente no banco
carregado** (0 tabelas faltando, 0 colunas faltando). O que resta de divergência
está inteiro declarado na seção 2.

| | tabelas | leads | negócios | empresas |
|---|---|---|---|---|
| produção hoje | 82 | 3.989 | 1.562 | 2.199 |
| homolog hoje | 77 | 3.776 | 1.478 | 2.014 |
| `dev` | 146 | — | — | — |
| **resultado da carga** | **151** | 3.989 | 1.562 | 2.199 |

As 151 são as 146 de `dev` mais as 5 que só existem em produção (seção 2.1).

### O tamanho real do buraco

Produção e homolog pararam por volta da migração **0009**. Os ambientes remotos
**não têm a tabela `_migracoes_aplicadas`** — o runner (`db:migrar`) nunca rodou
lá, as migrações foram aplicadas à mão com `psql`, fora de ordem. Evidência: em
prod/homolog as migrações 0031 e 0032 estão aplicadas, mas 0010–0030 não. A 0012
está aplicada **pela metade** (69 dos 86 objetos que ela cria).

Isso significa que "quais migrações faltam em prod" não podia ser respondido por
ferramenta nenhuma — só reconstruindo o schema real e comparando, que foi o que
este levantamento fez.

### O que quebrou no ensaio, e por quê

Rodar a cadeia de `dev` em cima do dump de produção falhou **quatro vezes**.
Cada falha é um defeito real que teria derrubado a virada:

| # | Onde parou | Erro | Causa raiz |
|---|---|---|---|
| 1 | `0021_stripe_billing_foundation` | `column "event_id" does not exist` | `stripe_webhook_events` foi criada à mão em produção com `stripe_event_id`, `status` MAIÚSCULO e um CHECK que só aceita maiúsculo. A 0021 usa `CREATE TABLE IF NOT EXISTS`, pula a criação, e o índice seguinte procura uma coluna que não existe. **É exatamente o bug da Fila de Cobrança.** |
| 2 | `0033_motor_fechamento_familia` | `column "required_combinations" of relation "won_evidence_policies" does not exist` | A coluna existe em `dev` e em `schema.ts`, e **nenhuma migração a cria** — entrou por `drizzle-kit push`. |
| 3 | `0034_catalogo_oficial_stripe` | `could not create unique index … is duplicated` | Dado real: 146 linhas de `servicos_catalogo` compartilham 11 `stripe_product_id` (catálogo PABX legado). O índice único da 0034 é impossível sobre esse dado. |
| 4 | `0039_cs_workspace` | `column c.responsavel_id does not exist` | Mesmo caso do #2: `clientes.responsavel_id` é drift não versionado. Derrubava 0040, 0041 e 0042 em cascata. |

**Achado estrutural:** a cadeia de migrações **não consegue construir o banco do
zero**. A `0000` cria 7 tabelas; `organizacoes`, `negocios`, `empresas`,
`contatos` e outras nunca tiveram migração — vieram de `drizzle-kit push` no
começo do projeto. Testei: um banco vazio morre em `0001` com
`relation "organizacoes" does not exist`. Por isso a carga **tem** que partir de
um restore de produção, e não de um banco novo.

### O drift não versionado, medido

Comparando o banco carregado com `dev`, faltavam **4 tabelas** e **19 colunas**
que existem em `dev`, estão em `schema.ts`, **são usadas pelo código** e nenhuma
migração cria. Contagem de referências fora de `schema.ts`:

| Objeto | usos no código |
|---|---|
| `ai_sdr_contato_state.handoff_status` | 10 |
| `notas.reuniao_id` | 13 |
| `negocios.commercial_motion` | 9 |
| `closer_bloqueios.outlook_event_id` | 5 |
| `servicos_catalogo.quantity_behavior` / `requires_signature` / `creates_fulfillment` … (9 colunas) | 2–3 cada |
| `empresas.tags` | 12 |
| `callface_ai_external_identities` (+3 tabelas irmãs) | 1 |

Sem fechar isso, a virada subiria e quebraria em runtime, não no deploy — o pior
dos dois modos de falha.

### Como foi fechado

| Arquivo | O que faz |
|---|---|
| `app/src/lib/db/carga/1-antes-da-cadeia/01_stripe_webhook_events.sql` | Converge a tabela vinda de prod para o formato de `schema.ts` preservando as 84 linhas: renomeia `stripe_event_id`→`event_id`, adiciona as colunas que faltam, normaliza `status` para minúsculo e remove o CHECK maiúsculo. |
| `…/02_servicos_catalogo_stripe_duplicado.sql` | Desfaz o vínculo Stripe duplicado de 145 linhas; havendo empate, zera o grupo inteiro em vez de eleger vencedor arbitrário (seção 2.2). **Mexe em dado.** |
| `…/03_lead_labels_duplicado.sql` | Remove 1 linha duplicada de `lead_labels`. **Apaga linha.** |
| `app/src/lib/db/carga/2-depois-de-0012/04_drift_dev_nao_versionado.sql` | Cria as 4 tabelas e as 19 colunas de drift. |
| `app/src/lib/db/migrations/0049_drift_indices_nao_versionados.sql` | Cria os 41 índices de drift. |
| `app/src/lib/db/migrar.ts` | Ganhou `--ate=<número>` para a cadeia parar em 0012. |

**Por que `--ate=0012` e não uma migração `0012a`:** duas das colunas de drift
(`clientes.responsavel_id`, `won_evidence_policies.required_combinations`) são
lidas por 0033/0039, e as tabelas nascem em 0012 — o patch precisa entrar entre
as duas. `migrar.test.ts` exige que o número de 4 dígitos de cada migração seja
único, justamente para a ordem não ficar ambígua entre ambientes; tentei `0012a`
e o teste reprovou, com razão. Cortar a cadeia é a solução que respeita a regra
em vez de enfraquecê-la. O corte está coberto por teste novo.

**`deploy.sh` não muda.** Ele chama `db:migrar` direto, o que está certo para
deploys normais. A carga é operação única, manual, feita **uma vez por ambiente**
antes da virada. Depois dela o ledger fica completo e `deploy.sh` volta a ser
suficiente.

---

## 2. Perdas — o que existe em prod e não tem lugar no schema novo

> **Decisão do Scott, não minha.** O ensaio já foi rodado com a escolha proposta
> em cada item; mudar qualquer uma é editar o `.sql` correspondente e rodar o
> ensaio de novo.

### 2.1 Não se perde nada — só sobra (decisão: aceitar)

Produção tem 5 objetos que `dev` não tem, todos da reconciliação financeira v1.1
que rodou em produção em 16/08 e nunca voltou para o repositório:

- tabelas `billing_audit_runs`, `billing_correction_ledger`,
  `billing_customer_aliases`, `billing_resolution_cases`
- colunas extras em `billing_identities`: `canonical_stripe_customer_id`,
  `cnpj_normalized`, `empresa_id`, `lead_id`, `primary_email_normalized`,
  `status`, `updated_at`
- coluna `stripe_webhook_events.processing_started_at`

**Proposta: deixar como está.** A carga não as remove. Elas continuam no banco
com o dado intacto; o código novo simplesmente as ignora (não estão em
`schema.ts`). Nenhuma é `NOT NULL` sem default, então nenhum `INSERT` do código
novo quebra por causa delas. Dropar seria destruição sem ganho.

⚠️ **Consequência a registrar:** o código da reconciliação v1.1 que lê essas
tabelas **não existe em `dev`**. Se alguma rotina financeira em produção depende
dela hoje, ela para de existir na virada — isso é perda de *funcionalidade*, não
de dado, e está fora do que consegui verificar (seção 5).

### 2.2 Perde-se o vínculo Stripe de 145 linhas de catálogo legado

`servicos_catalogo` em produção tem 218 linhas; 146 delas compartilham apenas 11
`stripe_product_id`. O maior grupo são 35 itens (`APARELHO IP X3SG`,
`ATA 16 PORTAS`, `GATEWAY FXO – 4 PORTAS`…) todos apontando para
`prod_VBTX0pnNCGRI3W`.

A migração 0034 cria um índice único sobre `(organizacao_id, stripe_product_id)`
— a regra de negócio é "um produto Stripe não representa dois produtos CRM".
O dado legado viola isso.

**Proposta: manter as 146 linhas e zerar o `stripe_product_id` de 145 delas.**
Não se apaga item de catálogo nenhum: nome, preço, família e histórico ficam. O
que se perde é uma associação que **já estava errada** — aqueles 35 aparelhos
nunca foram o produto Stripe `prod_VBTX0pnNCGRI3W`.

**Quem sobrevive, e por que quase ninguém.** A primeira versão deste passo
elegia "a linha ativa mais recente" de cada grupo. Medindo o dado, isso só
resolve **1 dos 11 grupos**: nos outros 10, todas as linhas são inativas e têm
o mesmo `created_at` — o desempate acabava caindo no `id`, ou seja, o vínculo
Stripe era atribuído a um item de hardware **escolhido por sorteio de UUID**.
Reprovado em revisão, com razão.

Regra corrigida: **havendo empate no topo, ninguém vence — o grupo inteiro é
zerado.** O sistema fica sem vínculo em vez de com o vínculo errado. Sobra
exatamente um vencedor legítimo, `prod_VBTJdoSBgwMkCL`, onde há uma única linha
ativa (`0800 - 1 canal`) contra três inativas.

#### 2.2.1 Os 10 grupos zerados por empate — ratificar

Todos com `ativo = false` em todas as linhas e `created_at` idêntico
(`2026-06-12 06:05:40.763777-03`, a carga única da migração do Zoho):

| `stripe_product_id` | linhas no grupo | linhas empatadas no topo |
|---|---|---|
| `prod_VBTX0pnNCGRI3W` | 35 | 35 |
| `prod_VBTg8DDzuuxttw` | 21 | 21 |
| `prod_VBTnIIwm7oMsAR` | 21 | 21 |
| `prod_VBTk0Pe9bkN1ZR` | 19 | 19 |
| `prod_VBT4nsqsN3VGSI` | 16 | 16 |
| `prod_VBTFygSQgjTg2d` | 13 | 13 |
| `prod_VBTtctBbOH0NK5` | 7 | 7 |
| `prod_VBTJyiTJC07Ant` | 5 | 5 |
| `prod_VBTJJbZONMN6Sy` | 3 | 3 |
| `prod_VBTtaQiq4g8Efp` | 2 | 2 |

Soma: 142 linhas zeradas por empate, mais 3 perdedoras legítimas do grupo
`prod_VBTJdoSBgwMkCL` = **145**.

Efeito medido, em dois momentos:

| | linhas | com vínculo Stripe | sem vínculo |
|---|---|---|---|
| dump de prod, antes da carga | 218 | 153 | 65 |
| logo após o passo 02 | 218 | 8 | 210 |
| fim do ensaio (0034/0035 inserem 2 itens do catálogo oficial) | 220 | 8 | 212 |

Duplicatas restantes: **0**. Os 8 vínculos que sobrevivem são os 7 produtos que
nunca estiveram em grupo duplicado (Callface AI Starter/Business/Full, CallPilot,
Agente IA, Pacote 500min, SETUP STARTER) mais o vencedor legítimo
`0800 - 1 canal`.

**Decisão pendente do Scott:** ratificar o zeramento destes 10 grupos.
Se quiser eleger vencedores à mão (qual aparelho de fato corresponde a cada
produto Stripe), isso é tarefa pós-virada — e é trabalho de catálogo, não de
carga. Alternativa mais agressiva, se preferir: apagar as linhas inativas do
catálogo legado em vez de desvincular. Mais limpo, mais destrutivo, e some com
o histórico.

### 2.3 Perde-se 1 linha de `lead_labels`

Um par `(lead_id, label_id)` está repetido em produção e bloqueia o índice único
de `dev`. `lead_labels` é tabela de ligação pura: a linha repetida não carrega
informação além do vínculo, que continua existindo na linha sobrevivente.

**Proposta: apagar a duplicata.** Impacto real: nenhum.

### 2.4 Diferenças de tipo/nulidade que ficam como estão (26 colunas)

Nenhuma exige ação e nenhuma perde dado. Registradas para não virarem
falso-positivo em auditoria futura:

| Coluna | `dev` | carregado | Por que fica |
|---|---|---|---|
| `assinaturas.organizacao_id`, `contratos.organizacao_id`, `faturas.organizacao_id`, `mrr_movimentos.organizacao_id` | `NOT NULL` | `NULL` | Conferi o dado real: **zero linhas com `organizacao_id` nulo** nas quatro tabelas (0/355, 0/742, 0/945, 0/662). Apertar para `NOT NULL` funcionaria, mas é `ALTER` desnecessário num banco cheio durante a janela de virada. |
| `ai_agent_versions.organizacao_id` | `NULL` | `NOT NULL` | O carregado é o mais estrito (a 0029 aperta). Quem está drifted é `dev`. |
| `anexos_legado.tamanho_bytes`, `correction_change_log.id` | `integer` | `bigint` | O carregado é mais largo. Estreitar é que seria destrutivo. |
| `metricas_diarias.*` (14 colunas) | sem default | `DEFAULT 0` | O carregado tem default a mais. Inofensivo. |
| `oportunidade_itens.*` (4 colunas) | `'0'::numeric` | `0` | Mesmo valor, grafia diferente no `pg_dump`. |
| `proposta_itens.commercial_model` | `DEFAULT 'PAGAMENTO_DIRETO'` | sem default | A coluna é `NOT NULL` nos dois. Só afeta `INSERT` que omita a coluna — o código não omite. |

### 2.5 Índices e constraints

O check D imprime 692 linhas de divergência, e a maior parte é ruído de
nomenclatura. Comparando por **definição** em vez de por nome, sobra isto:

**Só de nome — nenhuma ação (a esmagadora maioria).** `dev` nomeia FK no padrão
do drizzle (`_<col>_<tabela>_<col>_fk`), prod no do Postgres (`_fkey`) — são
~220 FKs idênticas com nome diferente. E 17 índices únicos de `dev` existem no
carregado como *constraint* `UNIQUE` de mesmo efeito e outro nome
(`idx_metricas_diarias_org_data` ↔ `metricas_diarias_organizacao_id_data_key`,
`idx_empresas_canonical` ↔ `idx_empresas_canonical_empresa_id`, …). Outros 4
índices de `dev` colidem de nome com uma versão **mais ampla** no carregado
(`audit_log (organizacao_id)` ↔ `(organizacao_id, created_at DESC)`;
`stripe_webhook_events (status)` ↔ `(status, received_at)`;
`assinatura_itens` parcial; `ai_skill_versions` com `NULLS NOT DISTINCT`) — o do
ambiente é superconjunto e atende as mesmas consultas.

**Diferença real nº 1 — 10 FKs são mais permissivas no carregado.** As mesmas
dez chaves existem nos dois lados, mas no banco carregado têm
`ON DELETE SET NULL` e em `dev` não têm ação nenhuma:
`assinaturas.servico_id`, `empresas.canonical_empresa_id`,
`leads.canonical_lead_id`, `mrr_movimentos.evento_comercial_id`,
`proposta_grupo_comercial.oportunidade_id`, `service_ledger_entries.service_id`
e as quatro de `servico_billing_timeline`.

Consequência: apagar um `servicos_canonicos` referenciado por assinatura é
**bloqueado em `dev`** e **silenciosamente aceito em produção**, zerando o
vínculo. **Proposta: não mexer agora** — recriar FK em tabela cheia durante a
janela é risco maior que o problema, e são deleções administrativas raras.
Registrado para virar tarefa depois da virada.

**Diferença real nº 2 — o carregado tem 15 CHECKs que `dev` não tem.** Criados
pela 0012/0014 nos ambientes que rodaram a cadeia inteira; `dev` não os tem
porque as tabelas de `dev` vieram de `drizzle-kit push`, não das migrações:
5 em `servicos_canonicos` (`service_family`, `revenue_nature`, `confidence`,
valor não-negativo, MRR-zero), 4 em `service_ledger_entries`, 3 em
`service_ledger_batches`, 2 em `reconciliation_runs`, 1 em
`reconciliation_changes`.

Consequência: **produção é mais estrita que `dev`**. Um `INSERT` que passa no
banco local pode estourar em produção com violação de CHECK — e testar em `dev`
não pega. **Proposta: manter os CHECKs** (são as regras corretas) e tratar isto
como o ponto de atenção nº 1 do smoke em homolog: qualquer gravação em serviço
canônico / ledger tem que ser exercitada lá, não só localmente.

---

## 3. Preenchimentos — o que o dado velho não preenche

Toda coluna nova entra com default conservador: **o comportamento que o produto
já tinha antes da coluna existir**. Nenhum default inventa fato de negócio.

| Coluna | Default | Por quê |
|---|---|---|
| `servicos_catalogo.creates_canonical_service` | `true` | Era o que o sistema fazia: todo item de catálogo virava serviço canônico. |
| `servicos_catalogo.creates_fulfillment` | `false` | Fulfillment automático é capacidade nova. Ligar para o catálogo inteiro geraria trabalho operacional inexistente. |
| `servicos_catalogo.requires_signature`, `requires_payment_before_won` | `false` | Travar ganho de negócio por assinatura/pagamento é regra nova. Com `true`, o pipeline inteiro de produção congelaria no domingo. |
| `servicos_catalogo.supports_upgrade` / `downgrade` / `proration` | `false` | Nenhum item legado foi modelado para isso. |
| `servicos_catalogo.quantity_behavior` | `'UNIT'` | Comportamento que já valia. |
| `servicos_catalogo.revenue_nature` | `'UNKNOWN'` | Honesto: o legado não classificou. `MRR` seria chute que contamina relatório de receita. |
| `negocios.commercial_motion` | `'NEW_BUSINESS'` | Os 1.562 negócios de produção são de aquisição. Expansão/renovação são conceitos que nascem agora. |
| `ai_sdr_contato_state.handoff_status` | `'ai_handling'` | Estado em que todo contato do SDR já estava. |
| `empresas.tags` | `'{}'` | Vazio. |
| `clientes.responsavel_id`, `usuarios.team_id`, `notas.cliente_id`, `notas.reuniao_id`, `closer_bloqueios.outlook_event_id`, `correction_change_log.{confidence,evidence,source}`, `won_evidence_policies.required_combinations` | `NULL` | São vínculos/atributos que não existem retroativamente. `NULL` é a resposta correta: "não se sabe". |
| tabelas `callface_ai_*` | vazias | Integração Callface AI não tem histórico a importar. |

**Não há backfill proposto.** Qualquer preenchimento retroativo com significado
de negócio (classificar `revenue_nature` do catálogo legado, atribuir
`responsavel_id` aos clientes) é decisão de produto e deve virar tarefa própria,
depois da virada — não algo que um script decide sozinho na madrugada.

---

## 4. Receita da virada

Mesma sequência nos três lugares. **Sábado em homolog, domingo em produção.**
Homolog tem exatamente as mesmas pendências que produção (verificado: 11 grupos
de `stripe_product_id` duplicado, 1 duplicata em `lead_labels`, e
`stripe_webhook_events` nem existe lá — o passo 01 é no-op).

### 4.0 Antes (fazer local, antes de tocar em qualquer servidor)

```bash
# ensaio contra o dump do dia — se isso não fechar verde, não vira
./scripts/ensaio-carga.sh
```

Exit 0 obrigatório. Este passo é o gate; os de baixo só executam o que ele já
provou.

### 4.1 Backup — o rollback mora aqui

```bash
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52
cd /opt/callface/crm                      # (homolog: /opt/callface/crm-homolog)
docker exec callface-crm-postgres pg_dump -U callface -d callface_crm -Fc -Z6 \
  > /opt/callface/backup-pre-virada-$(date +%Y%m%d-%H%M).dump
ls -lh /opt/callface/backup-pre-virada-*.dump     # conferir tamanho > 15 MB
```

Não seguir sem esse arquivo na mão e com tamanho plausível.

### 4.2 Parar quem escreve

```bash
docker compose stop app api worker
```

Com app/api/worker de pé, a carga compete com escrita do time. Postgres fica no
ar (a carga precisa dele).

### 4.3 Carga, fase 1

```bash
docker cp app/src/lib/db/carga callface-crm-postgres:/tmp/carga
for f in /tmp/carga/1-antes-da-cadeia/*.sql; do
  docker exec callface-crm-postgres psql -U callface -d callface_crm -v ON_ERROR_STOP=1 -f "$f"
done
```

### 4.4 Cadeia de migrações, com o corte em 0012

**4.4.a — criar o ledger e baselinar a 0000.** Os ambientes remotos não têm
`_migracoes_aplicadas`. A `0000` é a **única migração não idempotente** da
cadeia (`CREATE TABLE` cru, sem `IF NOT EXISTS`) e já está aplicada em qualquer
banco vindo de produção. Sem registrar a 0000 aqui, o `--ate=0012` do passo
seguinte tenta reexecutá-la e morre em `relation "leads" already exists`.

O hash tem que ser o do arquivo que está sendo implantado — é o que o runner
compara. Este comando calcula e insere de uma vez, sem valor copiado à mão:

```bash
# rodar de /opt/callface/crm (homolog: /opt/callface/crm-homolog)
HASH_0000=$(sha256sum app/src/lib/db/migrations/0000_gifted_silver_samurai.sql | cut -d' ' -f1)
echo "hash da 0000: $HASH_0000"
# conferência: no ensaio de 18/09 este valor era
#   3fac76791977de6e89b25ed6ffd6dae0dbfb50103e3c1acd67735909ea6d713f
# se divergir, o arquivo mudou desde o ensaio — PARAR e reensaiar.

docker exec -i callface-crm-postgres psql -U callface -d callface_crm -v ON_ERROR_STOP=1 <<SQL
CREATE TABLE IF NOT EXISTS _migracoes_aplicadas (
  nome        text PRIMARY KEY,
  hash        text NOT NULL,
  aplicada_em timestamptz NOT NULL DEFAULT now(),
  baseline    boolean NOT NULL DEFAULT false
);
INSERT INTO _migracoes_aplicadas (nome, hash, baseline)
VALUES ('0000_gifted_silver_samurai.sql', '$HASH_0000', true)
ON CONFLICT (nome) DO NOTHING;
SQL

# conferir que ficou exatamente UMA linha, e que é a 0000 marcada como baseline
docker exec callface-crm-postgres psql -U callface -d callface_crm -c \
  "SELECT nome, baseline, left(hash,12) AS hash FROM _migracoes_aplicadas"
```

Esperado: 1 linha, `0000_gifted_silver_samurai.sql | t | 3fac76791977`.
**Só a 0000.** Baselinar qualquer outra migração aqui faria a carga pular DDL
que produção realmente não tem.

> Em homolog o container é `callface-crm-homolog-postgres`. Se o ambiente não
> tiver `sha256sum`, use `shasum -a 256`.

**4.4.b — cadeia até 0012, drift, resto da cadeia.**

```bash
docker compose run --rm --no-deps --entrypoint "" api \
  node --import tsx src/lib/db/migrar.ts --ate=0012

for f in /tmp/carga/2-depois-de-0012/*.sql; do
  docker exec callface-crm-postgres psql -U callface -d callface_crm -v ON_ERROR_STOP=1 -f "$f"
done

docker compose run --rm --no-deps --entrypoint "" api \
  node --import tsx src/lib/db/migrar.ts
```

Esperado (igual ao ensaio): **12 migrações** no primeiro comando, **37** no
terceiro. Qualquer erro aqui: **parar**, não improvisar, ir para 4.7.

### 4.4.c Backfills — SEM ISSO O CANÔNICO FICA VAZIO

Este passo faltava no documento, e é o que separa "o schema converge" de "o
sistema tem dado". A cadeia de migrações cria as tabelas canônicas; quem as
POPULA é outro script, que o `ensaio-carga.sh` não chama:

```bash
./scripts/rodar-backfills.sh "$URL" --dry-run   # ler a saída antes
./scripts/rodar-backfills.sh "$URL"             # aplicar
```

São 11 passos em ordem, idempotentes por `backfill_provenance`. Sem eles,
`pessoas`, `aquisicoes`, `oportunidades`, `communications` e `timeline_events`
ficam zeradas e a ONFACE abre com as telas vazias — exatamente a cara de "dado
incoerente" que as cargas anteriores produziram.

Medido em 05/10/2026 contra o dump do dia: 4.040 pessoas, 2.441 aquisições,
1.115 oportunidades, 43.518 comunicações, 15.056 eventos de timeline.

### 4.4.d Carga complementar — faturamento, histórico, LTV e limpeza

Quatro fases acrescentadas em 05/10, todas idempotentes, aplicadas na ordem:

```bash
for d in 3-faturamento 4-historico 5-ltv 6-limpeza; do
  for f in app/src/lib/db/carga/$d/*.sql; do
    psql "$URL" -v ON_ERROR_STOP=1 -f "$f"
  done
done
```

- **3-faturamento** — mescla cadastros duplicados por CNPJ (16 CNPJs, 17
  registros; nome fantasia × razão social) e reconcilia clientes ativos contra
  a planilha do mês. A mescla declara a própria perda em
  `_carga_perdas_declaradas`, que o check B passou a respeitar.
- **4-historico** — devolve dono às comunicações órfãs (36.722 entravam sem
  `pessoa_id`, 96,6% do WhatsApp, porque as mensagens apontam para `contatos`,
  tabela que `05-identidade` não lê) e leva à timeline as 14.214 linhas que o
  `14-15` não migra: movimentações de card, notas, reuniões, tarefas, anexos.
  Também tira o outbound do Kanban de Pré-vendas, que é lugar de Prospecção.
- **5-ltv** — popula `cliente_receita_mensal` com o histórico de receita de
  2021-M03 a 2026-M09, a partir da base histórica e das planilhas mensais. É o
  que alimenta o gráfico de quanto cada cliente pagou mês a mês. Os três
  últimos meses fecham exato: 445.375,74 / 435.626,64 / 512.404,49.
- **6-limpeza** — marca (nunca apaga) o lixo herdado do Zoho em
  `_carga_registros_suspeitos`. Reverter é um `DELETE` na tabela de marcação.

**Armadilha que custou tempo:** `npx drizzle-kit migrate` responde "migrations
applied successfully" e NÃO aplica nada — o journal do drizzle conhece uma
migration e as outras 93 são SQL escrito à mão. O runner é
`app/src/lib/db/migrar.ts`, que registra em `_migracoes_aplicadas`. Conferir
sempre no banco, nunca no exit code.

**Onde construir o banco:** no Mac, não na EC2. A máquina tem 2 vCPU e hospeda
produção, homolog e crm2-dev juntos; um build normal já derrubou produção por
15 minutos. `scripts/aplicar-carga-no-dev.sh` constrói aqui e envia pronto,
deixando só um `pg_restore` para lá.

### 4.5 Checks de sanidade

```bash
docker compose run --rm --no-deps --entrypoint "" api \
  node --import tsx src/lib/db/migrar.ts --check          # tem que dizer "banco em dia"
```

E os cinco checks do `scripts/checar-carga.sh`, que no servidor viram consulta
direta:

- **A · migrações** — `--check` tem que dizer "banco em dia";
- **B · contagem por tabela** — nenhuma tabela pode ter perdido linha, exceto
  `lead_labels` (−1, declarada em 2.3);
- **C · FKs órfãs** — zero;
- **D · schema × `dev`** — só as diferenças das seções 2.1, 2.4 e 2.5;
- **E · amostras de negócio** — `leads`, `negocios`, `empresas`, `contratos`,
  `faturas`, `assinaturas` com a mesma contagem de antes da carga.

**O script é fail-closed, e isso importa na madrugada.** São três desfechos e
nenhum deles é verde por omissão:

| exit | significado |
|---|---|
| `0` | os cinco checks **executaram** e passaram |
| `1` | algum check executou e **reprovou** |
| `2` | algum check **não conseguiu executar** (psql caiu, catálogo voltou vazio, banco sem `_carga_contagem_antes`) |

`exit 2` **não é aprovação**: significa que o resultado daquele check é
desconhecido. Tratar como reprovação e ir para 4.7. A versão anterior deste
script podia imprimir "✔ nenhuma FK órfã" e "✔ schema idêntico ao de dev"
quando as consultas simplesmente falhavam — dois arquivos vazios comparam
iguais. Foi reprovado em revisão e corrigido: cada check agora valida que
rodou (catálogo com menos de 500 linhas ou varredura de FK vazia abortam).

### 4.6 Subir o código novo e provar no navegador

```bash
docker compose build app api worker && docker compose up -d
```

Gate do protocolo: login real, abrir pré-vendas / pipeline / negócios / clientes,
executar **uma ação que persiste**, recarregar, conferir que continuou lá.
Console e network limpos. **Nunca executar Enriquecer/Apollo.**

### 4.7 Rollback

Trivial por desenho — o prod antigo fica intacto até o OK:

| Falhou em | O que fazer |
|---|---|
| 4.3 / 4.4 (carga ou migração) | Containers ainda estão parados e o código velho ainda está no disco. `docker compose up -d app api worker` volta o sistema antigo. Se o banco ficou meio migrado: `dropdb`/`createdb` + `pg_restore` do dump de 4.1. |
| 4.5 (check reprovou) | Idem. Nada foi exposto ao usuário ainda. |
| 4.6 (código novo no ar, problema em uso) | `docker compose stop app api worker` → restaurar o dump de 4.1 → reimplantar o `app/` anterior → `up -d`. Tempo dominado pelo `pg_restore` (~2–4 min para 17 MB). |

Só se apaga o backup de 4.1 depois do OK explícito do Scott (e do Kauã, em
produção).

---

## 5. O que NÃO consegui verificar

1. **Se o código novo funciona com o dado carregado.** O ensaio prova que o
   schema converge e que o dado sobrevive. Não subi a aplicação apontando para
   `callface_crm_ensaio` — não estava no escopo desta tarefa e exige uma janela
   de smoke própria. **Recomendo fazer isso antes de sábado**, é barato:
   `DATABASE_URL` apontando para o rascunho e percorrer as telas do dinheiro.

2. **O impacto de aposentar a reconciliação financeira v1.1.** As 4 tabelas
   `billing_*` e as colunas extras de `billing_identities` são de código que roda
   em produção desde 16/08 (branch `promotion/reconciliation-v1.1`) e **não
   existe em `dev`**. Não consegui determinar se alguma rotina financeira viva
   depende disso. É a maior incógnita deste documento e precisa de resposta do
   Scott antes de domingo.

3. **Dado de homolog além das duas verificações pontuais.** Conferi só o que a
   carga toca (duplicatas de catálogo, `lead_labels`, existência de
   `stripe_webhook_events`) e as contagens principais. Não rodei o ensaio
   completo contra um dump de homolog — o de produção é o caso mais difícil e
   homolog é clone dele, mas isso é inferência, não medição.

4. **Volume e tempo em produção.** O ensaio rodou em Postgres local com 17 MB de
   dado. Não medi quanto a cadeia leva dentro do container da EC2, que tem disco
   e CPU diferentes. Pela ordem de grandeza (segundos localmente), a janela deve
   ser de minutos, não de horas — mas não está medido.

5. **`callface-crm2-dev` na EC2.** Existe um quarto ambiente no servidor
   (containers `callface-crm2-dev-*`, de pé há 7 dias) que não está no
   `PLANO-VIRADA.md` nem em nenhuma memória do vault. Não toquei nele e não sei
   o que é. Vale o Scott dizer se entra na virada ou se é resíduo.

---

## Arquivos desta entrega

| Arquivo | |
|---|---|
| `docs/operacao/virada/PLANO-DE-CARGA.md` | este documento |
| `scripts/ensaio-carga.sh` | a receita executável (ensaio local = virada) |
| `scripts/checar-carga.sh` | os cinco checks de sanidade, fail-closed (exit 0/1/2) |
| `app/src/lib/db/carga/1-antes-da-cadeia/01_stripe_webhook_events.sql` | novo |
| `app/src/lib/db/carga/1-antes-da-cadeia/02_servicos_catalogo_stripe_duplicado.sql` | novo, **mexe em dado** |
| `app/src/lib/db/carga/1-antes-da-cadeia/03_lead_labels_duplicado.sql` | novo, **apaga linha** |
| `app/src/lib/db/carga/2-depois-de-0012/04_drift_dev_nao_versionado.sql` | novo |
| `app/src/lib/db/migrations/0049_drift_indices_nao_versionados.sql` | novo |
| `app/src/lib/db/catalogo-comparavel.sql` | consulta de catálogo usada nos diffs |
| `app/src/lib/db/migrar.ts` | `--ate=<número>` |
| `app/src/lib/db/migrar.test.ts` | teste do corte |
