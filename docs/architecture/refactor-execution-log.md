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

---

## 2026-09-21 — Fases 09 a 13 — CONCLUÍDAS

**Migrations:** 0064 (proposta/contrato canônicos), 0065 (cliente e serviço),
0066 (ciclos de fulfillment), 0067 (communications canônica).

**09.** 1.094 de 1.095 propostas e 336 de 336 contratos ligados à oportunidade.
455 propostas e 406 contratos nunca tiveram negócio de origem: não é perda.

**10.** `clientes` vira perfil 1:1 de CS da empresa, já respeitado (0 empresas com
mais de um cliente). 29 serviços ligados à oportunidade pelo contrato.

**11.** `UNIQUE(serviço)` vira `UNIQUE(serviço, tipo, ciclo)`. **407 serviços ativos
sem nenhuma jornada** — não foram criados onboardings retroativos, porque o serviço
entrou já ativo por carga de sistema antigo e inventar jornada é histórico falso.
Caso aberto; a regra do SPEC §18 vale para ganho novo.

**12.** 536 pagamentos criados de fatura paga. **Soma bate exatamente:
R$ 194.294,36 nos dois lados.** 118 faturas pagas sem data viraram caso em vez de
ganhar data fabricada. 108 faturas seguem sem empresa: caso aberto.

**13.** 33.005 de 34.761 linhas migradas, 5.249 conversas.

Dois achados que mudaram o resultado:

1. **24.380 de 25.363 mensagens de WhatsApp não têm `lead_id`**, só `contato_id`. A
   primeira versão usava `JOIN` interno em `leads` e teria descartado **96% do
   histórico de WhatsApp em silêncio**. Corrigido para resolver identidade e
   organização pelo contato.
2. **`emails` tem 4.460 linhas para 2.704 `message_id` distintos.** 1.185 ids
   repetidos em 2.941 linhas: a mesma mensagem gravada mais de uma vez.
   `communications` já tinha `UNIQUE(canal, external_id)`. Migrou a primeira
   ocorrência de cada. Deduplicação, não perda.

WhatsApp e ligações: zero não migradas. 27.131 comunicações sem pessoa resolvida,
registradas assim mesmo e com caso aberto.

**Testes:** 134 passando, `tsc` limpo.

---

## 2026-09-21 — Fases 14 a 16 (parcial) — eventos, timeline e primeiros writers

**14 e 15.** `atividades` (13.044 linhas) drenada: 14.078 itens de timeline e 2.016
eventos de domínio. Zero descartadas. A timeline também recebeu os marcos de ganho e
perda, senão contaria a história sem o desfecho.

**Eventos transacionais.** `packages/platform/events`: estado, `domain_event` e
outbox na mesma transação. Teste força rollback no meio e prova que evento e fila não
sobrevivem. É o que impede o cenário medido no AS-IS: 569 ganhos, 33 eventos.

**16 (parcial).** Portas canônicas criadas (`identity`, `acquisition`) e dois webhooks
migrados. `rd-lead` era o pior caso: inseria direto em `leads`, `status_changes` e
`notas`, e criava a tarefa por fora.

**Dois bugs reais encontrados, ambos por verificação e não por acaso:**

1. **Busca de pessoa por telefone usava `LIKE '%numero'`**, então um celular de 9
   dígitos casava dentro de um de 11 e duas pessoas viravam uma. Passou a comparar os
   últimos 10 dígitos exatos. Encontrado pelo smoke contra o banco real.
2. **O smoke apagava dado real na limpeza.** Apagava por id sem checar origem; quando
   a entrada reusou uma aquisição existente, apagou uma real — sobraram 3.988 de
   3.989. Pego pelo teste de reconciliação da fase 06, que existe exatamente para
   isso. Reparado com o backfill idempotente e a limpeza passou a só apagar o que o
   próprio smoke criou.

**Smoke da ponte:** 7 de 7 verificações. Pessoa, empresa, aquisição, touchpoint,
evento e outbox aparecem juntos, e a reentrega do mesmo fato não duplica nada.

**Testes:** 157 passando.

---

## 2026-09-21 — Fase 16 (continuação) · Seis criadores de identidade migrados

`POST /leads` (a maior porta de escrita do sistema, 10 escritas em `leads`),
`contatos`, `prospeccao` e `apollo` passaram a chamar a porta canônica, somando-se aos
dois webhooks da rodada anterior.

**Teste de inventário vivo.** `arquitetura/escritores-migrados.test.ts` transforma o
inventário do SPEC em contrato executável: porta nova sem ligação falha a suíte. Além
disso verifica que a ponte declara ser temporária e em que fase sai — dual-write sem
data de morte vira permanente — e que ninguém removeu a escrita legada cedo demais,
porque as telas ainda leem `leads` e o registro sumiria na hora.

**Testes:** 161 passando. **Smoke:** 7 de 7.

---

## 2026-09-21 — Fase 16e · O caminho de Ganho, provado contra o banco real

**Mudança:** `packages/platform/database/src/repositorio-vendas.ts` implementa o
contrato `RepositorioVendas` em Postgres, e `src/scripts/smoke-ganho-oportunidade.ts`
percorre o caminho inteiro num negócio criado e destruído pelo próprio smoke.

**A regra que isso fecha.** Oportunidade sem oferta não pode ser ganha (`SEM_OFERTA`),
e quem decide o Ganho é a política da OFERTA, não a família do produto. Era o risco
financeiro aberto desde a auditoria: `won_evidence_policies` deixava PABX e White
Label ganharem com contrato assinado e nenhum pagamento, contradizendo
`won-evidence.ts:19`. Agora a mesma família com duas ofertas tem regras opostas, e o
teste de domínio prova isso.

**Migrations:** 0066 (`tipo` e `cycle_number` em `fulfillments`, com
`uq_fulfillment_ciclo`), 0067 (comunicações canônicas), 0068.

**Dois bugs encontrados pela validação, não pelo compilador:**

1. **A 0066 não removeu o índice antigo.** `idx_fulfillments_servico` continuava
   UNIQUE em `servico_canonico_id` sozinho, então o índice velho mandava e o serviço
   aceitava onboarding OU implantação, nunca os dois: PABX criou 1 jornada em vez de
   2. Pego pelo smoke. Migration 0068 devolve o índice como não único.
2. **O ON CONFLICT do caminho legado ficou órfão.** Com a exclusividade removida,
   `lib/crm/pos-venda.ts:375` passou a apontar para um índice que não existe mais — e
   Postgres recusa a query inteira, então todo Ganho que passa por `negocios.ts:804`
   iria pro chão em runtime. Pego pelo `on-conflict.test.ts`, que varre todo
   ON CONFLICT do repo contra os índices reais do banco. Mesma classe do bug de 14/09
   no handoff de CS — a razão do teste existir.

No caminho, três pontos de drift Drizzle × Postgres fechados: `tipo` e `cycle_number`
nunca tinham sido declarados, e `uq_fulfillment_ciclo` também não.

**Gotcha de runtime registrado:** `Date` cru dentro de template `sql` do postgres.js
quebra; os repositórios passaram a serializar com `toISOString()`.

**Validação:** `tsc` limpo, **170 testes passando, 0 falhas**, smoke do Ganho 5/5
(1 serviço, 2 jornadas, timeline, bloqueio funciona, retry idempotente) e smoke da
ponte canônica verde.

**Commits:** `refactor(16e)` e `92327d0` (fix do ON CONFLICT).

---

## 2026-09-21 — Fase 16 fechada · A política da oferta alcança o caminho legado

**O problema que isto resolve.** A fase 16e provou a regra no caminho canônico, mas
quem roda em produção hoje é o legado: `lib/crm/won-evidence.ts`, lendo
`won_evidence_policies`, indexada por FAMÍLIA. Provar a regra no caminho que ninguém
usa ainda não muda o risco.

**A ligação.** `lib/vendas/ponte-ganho.ts` entra nos dois pontos por onde todos os 30
escritores de `negocios` passam: `avaliarEvidenciaWon` (decisão) e
`aplicarEfeitosPosGanho` (propagação). Rota de negócios, webhook do Stripe, webhook do
Documenso, worker e scripts — um lugar, todos os chamadores.

A ponte **não reimplementa a regra**: chama `avaliarGanho`, a mesma função do domínio.
Um teste de arquitetura barra qualquer reescrita da decisão lá dentro. Quando o negócio
ainda não tem oportunidade com oferta, a ponte devolve "não aplicável" e o legado
responde — o que é honesto, não permissivo: as 1.084 oportunidades sem oferta não podem
ser ganhas pelo canônico justamente porque a política está ausente.

**Mais dois escritores fechados:** `contatos-unified` (POST) pela porta de aquisição, e
os três criadores de contato do worker por `garantirPessoaDeContato` — identidade sem
aquisição. Contato de WhatsApp não é processo comercial: abrir aquisição em cada um
encheria o funil com 25.363 processos que ninguém vendeu. A pessoa precisa existir para
a conversa ligar na timeline (SPEC §6, §22); o processo, não.

**Higiene de dado encontrada e corrigida.** 5 oportunidades de teste sobreviveram no
banco às execuções que quebraram no meio durante a depuração da migration 0068 — a
limpeza vinha depois do ponto de falha. Removidas em transação, com inspeção antes do
DELETE, e os smokes passaram a limpar em `finally`. Contagens reconferidas contra o
estado registrado: oportunidades 1.561, negócios 1.562, serviços 438, contratos 742,
aquisições 3.989. Todas batem.

**Validação:** `tsc` limpo, **173 testes, 0 falhas** (3 novos de inventário vivo) e
três smokes verdes. O `smoke-ponte-ganho` é o que importa: mesma prova, decisões
opostas — PABX ganha com contrato assinado, Callface AI direto não ganha sem pagamento.

**Commit:** `016426c`.
