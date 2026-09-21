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

---

## 2026-09-21 — Fase 17 · Cutover de leitura das telas de vendas

**O sintoma que abriu este refactor, resolvido.** 2.392 dos 3.989 leads não apareciam
em tela nenhuma porque a consulta filtrava `estagio_pre_vendas = ANY(...)` e o campo
está nulo neles. Existiam, com dono e origem, e eram invisíveis. O board passou a ler
`aquisicoes`, onde não há registro sem estado, e saiu de **1.597 para 3.702**
registros, distribuídos em colunas reais.

**Porta única de leitura.** `lib/vendas/consultas.ts` é consumida por 20 arquivos de
tela. Migrá-la migrou pré-vendas, pipeline, contatos, prospecção, Empresa 360 e os
dois detalhes de uma vez — mesmo princípio que fechou os 30 escritores de `negocios`
pelo `won-evidence.ts`.

**446 propostas voltaram.** A lista da Empresa 360 exigia JOIN em `negocios`, e 455
das 1.550 propostas não têm negócio: são antigas, feitas direto para um lead, antes de
existir o modelo de negócio. Pela identidade canônica, 446 chegam à empresa. Medido
numa empresa real: 8 antes, 17 depois.

**Um negócio sumia sem registro.** O backfill da fase 07 pulava negócio sem pessoa e
sem empresa — certo, criar oportunidade sem identidade seria inventar de quem é a
venda — mas só somava num contador. Era 1 de 1.562, e explicava a diferença de R$
1.100 no total do pipeline. Virou caso `OPORTUNIDADE_SEM_IDENTIDADE` com evidência.

**Migration 0069:** `aquisicoes.lead_legado_id`, o análogo de
`oportunidades.negocio_id_legado`. A ligação só existia em `backfill_provenance`, que
é auditoria do backfill; usar auditoria em JOIN de runtime mistura as duas coisas.

### O build estava quebrado, e `tsc` não via

Quatro causas, todas anteriores a esta rodada:

1. **os imports de `packages/*`** por caminho relativo com extensão `.js` não
   resolviam no bundler. O app não declarava os pacotes como dependência e o tsconfig
   não tinha path. Agora importa por nome (`@onface/*`, SPEC §34), com
   `transpilePackages` e workspace declarado;
2. **`app/pnpm-workspace.yaml` órfão** fazia o pnpm tratar `app` como raiz própria e
   não achar os pacotes. A raiz ainda tinha `unrs-resolver: set this to true or false`
   — o texto da instrução copiado literalmente no lugar do valor;
3. **`/contatos/[id]` duplicada** em `(crm)` e `(crm2)`, duas rotas paralelas para o
   mesmo caminho. Todas as outras rotas do CRM 1 foram renomeadas com sufixo
   `-legado`; essa ficou para trás no espelhamento de produção de 20/09;
4. **cinco páginas autenticadas** eram prerenderizadas estaticamente e quebravam em
   `useSession()` undefined.

É a demonstração de que `tsc` limpo não é build passando — e o SPEC §53 pede build.

**Gotcha travado:** crase dentro de template de SQL fecha o template, e o erro sai
como sintaxe TypeScript em coluna arbitrária, sem menção a SQL. Custou três rodadas
neste refactor. Agora há teste, verificado falhando de propósito antes de entrar.

**Validação:** `tsc` limpo, **build de produção passando**, **178 testes, 0 falhas**,
três smokes verdes.

**Commits:** `0af6655`, `a318530`, `58c115e`.

---

## 2026-09-21 — Fase 17 (continuação) · Três buracos de leitura, medidos

**A linha do tempo lia uma tabela vazia.** `lerLinhaDoTempo` consultava só
`vendas_eventos`, que tem ZERO linhas. A tela de detalhe da pessoa dizia "Nenhum
evento registrado" enquanto `timeline_events` tinha 14.078 e `communications`
33.005 — exatamente o item da Definition of Done: "communications canonical table
is empty/unread". Agora lê as três em UNION: 0 eventos antes, 40 depois, em 8ms
numa pessoa real.

O dedup é por **correspondência**, não por canal. As duas fontes descrevem o mesmo
fato por caminhos diferentes: a ligação vira atividade (e daí evento de timeline) e
também vira comunicação. Filtrar o canal inteiro seria uma linha e perderia 983
ligações que nunca viraram atividade.

**406 contratos invisíveis, 271 deles ativos.** Não têm negócio nem oportunidade.
Toda leitura que passa por negócio os descarta: carteira, metas, geração de jornada.
A cadeia de responsável do onboarding resolvia ZERO deles; agora vai do canônico ao
legado (oportunidade, contrato→oportunidade, contrato→negócio, aquisição) e resolve
305. Sem responsável, o onboarding nasce órfão e a notificação não sai.

Os 406 viraram caso `CONTRATO_SEM_PROCESSO_COMERCIAL` no backfill 09. Ligá-los por
proximidade seria inventar de qual venda vieram; o que dá para fazer é parar de
escondê-los.

**Jornada duplicada em silêncio.** `lib/crm/fulfillment.ts` inseria em `fulfillments`
sem `tipo`, obrigatório desde a 0066. A unicidade é (serviço, tipo, ciclo) e com
`tipo` NULO o índice nunca colide, porque NULL não é igual a NULL: este caminho
criaria uma jornada nova a cada execução. Nenhuma duplicata no banco hoje.

**Medido e descartado:** `atividades.empresa_id` está 100% vazia e o canônico não
amplia a cobertura de empresa nas atividades de `clientes-crm2` (1.575 nos dois
caminhos). O comentário que já estava no código — "cobertura real de 152/272, não
fabricar pros outros 44%" — continua correto.

**Validação:** `tsc` limpo, build passando, **180 testes, 0 falhas**.

**Commits:** `714d92e`, `b7d737e`.

---

## 2026-09-21 — Itens da Definition of Done fechados com prova

**50 colunas eram invisíveis para o código.** As migrations 0062 a 0069 criaram
colunas que ninguém declarou no Drizzle: `contratos.oportunidade_id`,
`propostas.oferta_comercial_id`, `communications.conversa_id`, as 10 de atribuição de
`pontos_contato`, e por aí. O backfill escreveu nelas por SQL cru e nenhuma rota
conseguia lê-las pelo ORM. A fase 01 tinha reconciliado o drift à mão, e nada impedia
que voltasse.

Declaradas todas, e um teste passou a varrer as duas direções. Na primeira execução
ele acusou `leads.ip_address` e `eventos.ip_address` — e estava errado: faltava `inet`
na lista de tipos do próprio teste. Mesma classe do teste de atribuição que checava 8
dos 13 sinais e reprovava 87 touchpoints válidos. O teste estava errado, não o código.

**`event_outbox` provado ponta a ponta.** A tabela tem consumidor no worker desde
agosto, mas ninguém tinha provado a cadeia contra dado real. `smoke-outbox.ts` prova
5 de 5, e o caso que mais importa é o terceiro: **transação que falha não deixa evento
órfão**. Evento publicado de uma escrita que não aconteceu é pior que evento nenhum.

**Commit:** `89e9715`.

---

## 2026-09-21 — Fase 18 · Os dois motores de automação convergiram

**Eram dois, e a divergência era perigosa.** `cadencia/cadence-engine.ts` executa
fluxo (espera, ramificação, retry, estado) e seus adapters recusam mover para Ganho:
"Won exige o gate comercial de pagamento/assinatura". `crm/automacao-engine.ts`
executava regra simples com implementação própria de cada ação, e a dele fazia
`update negocios set status` direto — uma regra de automação podia marcar venda como
ganha furando a política da oferta, o mesmo risco financeiro que a fase 16 fechou.

Uma regra é um fluxo de um passo: não precisa de motor próprio, precisa dos mesmos
adapters. `executarAcaoAvulsa` expõe o executor do motor de fluxo, e cinco ações
passaram a delegar. O que veio junto, porque o adapter é melhor que a cópia:
idempotência (a cópia criava duas tarefas iguais em disparo repetido), vínculo
completo, `origem = AUTOMACAO` e publicação de `StageChanged`.

**O que NÃO foi convergido, e está dito no código:** tag de empresa. O motor de fluxo
usa `labels`/`entity_labels`, o de regras usa array de texto em `empresas.tags`. São
modelos diferentes, e unificá-los é escopo próprio.

**Levantamento que mudou o desenho da fase.** Existem três gerações de tabela de
automação e **todas estão vazias** — `automacoes`, `cadence_definitions`,
`email_sequencias`. A única com dado é `cadencia_execucoes` (1.273), que é log de
passo SDR, não máquina de estado. Não havia comportamento de produção para preservar,
o que reduziu muito o risco desta fase. A convergência para grafo → compilador →
motor de fluxo, disparado pelo outbox, já tinha sido começada em
`ai-platform/followup/` e `automations/event-dispatcher.ts`.

**Validação:** `tsc` limpo, build passando, **183 testes**, 5 smokes verdes.

**Commit:** `f309686`.

---

## 2026-09-21 — Fases 22 e 19 · Autorização granular e os dois agentes

**RBAC: o mapa não inventa política.** As 16 permissões estavam semeadas desde a
0058, mas `roles`, `role_permissions` e `user_roles` estavam vazias — a autorização
continuava sendo a string `usuarios.role` lida por funções booleanas grossas. O mapa
traduz o que o sistema já faz; a única permissão não derivável é
`sales.approve_discount`, porque alçada de desconto não existe hoje. Ficou só com
admin, o padrão restritivo, e quem aprova desconto é decisão do Kauã.

A peça que importa é o teste de paridade. Autorização é a mudança em que errar é mais
caro: quem perde acesso descobre no meio do expediente, e quem ganha acesso indevido
ninguém descobre. O teste compara, usuário real por usuário real e permissão por
permissão, o que o RBAC responde contra o que o gate legado responderia — **16 × 16,
zero divergências**.

Um terceiro teste prova a regra do SPEC para agente: o MESMO usuário admin, agindo
por um agente que recebeu só `sales.read`, não consegue `finance.manage`. Sem isso a
IA herdaria o poder de quem está por trás dela.

**NEXO e Hermes existiam no desenho e não no banco.** 30 tabelas de plataforma de IA,
zero agentes. Criados em `draft`, com autonomia de sugestão — agente que nasce
executando sozinho em base de produção é feature sem revisão.

**A IA parou de escrever direto.** `task.create`, `lead.update_status` e
`deal.advance` faziam `db.insert`/`db.update`, o que o SPEC proíbe por escrito. Agora
chamam os mesmos adapters. `deal.advance` já barrava o Ganho por conta própria, e um
"não" repetido em cada chamador é um "não" que uma das cópias esquece.

**Nota de processo:** caí pela terceira vez na sessão no gotcha da crase dentro de
template de SQL. Desta vez a trava criada hoje pegou, apontando arquivo e linha. É o
argumento a favor de escrever a trava na primeira vez, não na terceira.

**Commits:** `955cb07`, `7bfa83d`.

---

## 2026-09-21 — Fase 20 · A Meta entra direto

**O caminho antigo tinha dois webhooks para o mesmo lead**, chegando fora de ordem,
com uma tabela de staging existindo só para segurar o que chegou antes do lead
existir. E um ponto único de falha fora de casa: em julho o token do n8n expirou e
125 leads pagos ficaram presos, descobertos dias depois.

Agora a pessoa e o anúncio chegam no mesmo fato, pela porta canônica de aquisição.
RD Station deixa de ser trânsito obrigatório e continua disponível como destino.

O normalizador cobre os três formatos que aparecem na prática: `field_data` nativo,
integrador achatado e formulário personalizado. O que não é identidade vira resposta
e **não é descartado** — a pergunta do cliente é o que mais vale no formulário e não
tem campo padrão.

**Conversions API.** A Meta só sabe que o formulário foi preenchido; não sabe quem
qualificou, quem virou venda e quem pagou. Otimizar por volume de formulário é
otimizar pelo evento errado, e o levantamento mostrou isso: 1.536 entradas de Mídia
Paga e nenhum retorno de qualidade. Dado pessoal vai em SHA-256, e o teste verifica
procurando o e-mail e o telefone no corpo serializado.

**Um bug real, pego pelo teste:** `first_name` estava na lista de sinônimos de nome,
então "João Pereira" virava "João". Metade do nome tratada como o nome inteiro.

**Duas travas do repositório funcionaram nesta rodada:** a de webhook fail-closed
exigiu registrar o webhook novo com a env do segredo, e a da crase em template de SQL
pegou meu próprio erro apontando arquivo e linha.

**Pendência declarada:** enviar de verdade exige `META_APP_SECRET`,
`META_WEBHOOK_VERIFY_TOKEN` e o token do CAPI, indisponíveis aqui.

**Commit:** `f066ea3`.

---

## 2026-09-21 — Fase 17 (continuação) · Dinheiro invisível e duas regressões minhas

**O relatório de mídia paga decidia investimento sobre 65% da receita.** `JOIN
assinaturas ... leads` interno descartava toda assinatura sem lead legado: 72 das 355,
e 47 delas ATIVAS. CAC e ROAS calculados sobre R$ 40.231,65 de um MRR ativo de
R$ 61.769,55. Não quebra nada visivelmente; devolve um CAC otimista e ninguém
questiona. A atribuição virou cadeia (lead, touchpoint do lead, touchpoint da
empresa) e o relatório passou a ver os R$ 61.769,55 inteiros.

**Revertido na mesma rodada:** tinha trocado o JOIN do relatório de tracking para
resolver e-mail pela pessoa canônica. Medi depois e o ganho foi ZERO — quem tem
e-mail no lead tem na pessoa. Dois JOINs que não mudam número nenhum saíram, e a
limitação (159 de 1.562 negócios fora, por o relatório ser dimensionado por e-mail)
ficou escrita com o número medido e um teste travando a cobertura.

**Fila de cobrança e régua de renovação** dependiam de lead legado por JOIN interno.
Hoje não há perda, mas 72 assinaturas não têm lead e a próxima fatura aberta vinda de
uma delas cairia fora em silêncio. Viraram LEFT com a empresa como segunda via.

### Duas regressões que eu mesmo criei, e a regra que faltava

Auditando a própria fase 17, achei que migrar a leitura sem conferir a propagação
quebra o produto de um jeito silencioso:

1. **o card voltava para a coluna anterior.** O board de pipeline lê
   `oportunidades.etapa`, e `syncOportunidadeFromNegocio` propagava `stage` e não
   `etapa`, `titulo`, `service_family`, `commercial_motion`;
2. **qualificar um lead não movia o card.** O board de pré-vendas lê `aquisicoes` e
   as oito ações escrevem em `leads`. Nada propagava.

A regra ficou escrita: **leitura canônica exige que a sincronização cubra tudo que a
leitura usa.** A ponte de pré-vendas entrou em `registrarEvento`, por onde todas as
ações passam — um lugar, oito ações.

Os dois smokes consultam o board de verdade e foram verificados falhando de propósito
antes de entrar.

**Higiene:** o teste de reconciliação da fase 05 pegou uma pessoa órfã que o meu
próprio smoke deixou (a porta canônica cria pessoa sem `lead_id_legado`, que só o
backfill preenche). Removida, e a limpeza passou a usar o id que a porta devolve.

**Validação:** `tsc` limpo, build passando, **200 testes**, 7 smokes verdes,
contagens idênticas ao registrado.

**Commits:** `b322c17`, `f0aa196`, `24d2bae`, `377bc02`.

---

## 2026-09-21 — Fase 21 · Arquivo sai do disco da máquina

O SPEC diz a frase certa: "local personal-Mac storage is not production
architecture". O problema não é elegância. `fs.writeFileSync` significa que o arquivo
morre com a máquina, não existe para um segundo container, e não tem checksum,
retenção nem verificação de permissão na hora de servir.

`@onface/platform-storage` implementa metadado no Postgres e binário no object
storage, com o provedor como adapter. As tabelas existiam vazias desde a 0058.

O que a implementação anterior não tinha: limite de tamanho, lista de tipos
**permitidos** (a de bloqueio está sempre uma extensão atrás), checksum com
deduplicação, isolamento de tenant **no caminho do arquivo** e não só na consulta,
travessia de caminho barrada, e remoção lógica que preserva a prova de que o arquivo
existiu.

Duas decisões que ficaram no código com o motivo: **produção sem object storage
falha** em vez de cair no disco local, porque cair em silêncio é exatamente como o
produto chegou aqui; e o disco local **devolve null em vez de URL assinada**, porque
um adapter que fingisse assinar transformaria arquivo privado em público.

**Pendência declarada:** o adapter S3/R2 precisa das credenciais de bucket. Migrar os
pontos de upload existentes vem junto com elas, porque trocá-los agora só mudaria um
disco local por outro.

**Commit:** `8609ff1`.

---

## 2026-09-21 — Fase 23 · API pública v1

Superfície versionada com os nove recursos canônicos e o pipeline do SPEC:
autenticação, tenant vindo do token, escopo por rota, consulta de domínio, resposta.
Nenhuma rota expõe tabela, e um teste barra nome de tabela interna na URL — API
pública é contrato, e expor tabela transforma cada refactor interno em quebra de
integração.

Token em vez de cookie, porque cookie não tem escopo, não se revoga sozinho e não diz
quem consumiu o quê. O token é guardado só como SHA-256; revogado, expirado e
inexistente respondem igual; a comparação é em tempo constante; e todo uso fica
registrado.

**Uma trava nova para um bug que apareceu duas vezes no mesmo dia.** O driver devolve
`text[]` do Postgres como a string `"{a,b}"`, e construir um Set a partir dela itera
caractere por caractere. Aconteceu nas ferramentas do agente e de novo nos escopos da
API — as duas vezes parecendo bug de permissão. O teste varre toda coluna de array do
banco projetada crua, e foi verificado pegando o caso real, inclusive o primeiro
falso positivo (`AS servicos`, que é alias e não coluna).

**Commit:** `be5e84a`.

---

## 2026-09-21 — Fase 24 · Validação de paridade, e o que ela encontrou

A validação percorre os 14 cenários do SPEC e distingue **três** respostas, não duas:
OK, FALHA e NÃO VERIFICÁVEL com o motivo dito. Tratar "não verificável" como OK é o
que faz uma virada parecer segura.

**R$ 103.255,19 de faturas pagas estavam sem pagamento canônico.** O estado dizia que
a conciliação batia exata em R$ 194.294,36 — e batia, para o subconjunto que o
backfill migrou. Ele exigia `empresa_id` na própria fatura, e 71 pagas não tinham.
Pela cadeia canônica, 43 recuperam empresa: **R$ 16.751,30 de receita voltou ao
modelo**. As outras 28 viraram caso por linha, porque agregado diz que o problema
existe e por linha diz qual fatura conferir. Conciliação agora: R$ 211.045,66 dos
dois lados.

**A regra de "proposta exige empresa" existia e não estava ligada em lugar nenhum.**
285 propostas de oportunidade sem empresa, 59 deste mês. Regra que mora só no domínio
e ninguém chama é documentação, não regra. Ligada na rota, com default restritivo
quando a oferta não está resolvida.

**A conferência do próprio backfill comparava universos diferentes** depois que a
cadeia mudou, e acusava divergência inexistente. O cenário financeiro passou a
comparar o universo conciliável e exigir que o resto esteja coberto por caso.

Carteira de CS virou "não verificável", não falha: a capacidade existe na rota e
nenhum dos 275 clientes tem dono. Cobrar isso do código seria cobrar uma decisão de
operação.

**Commit:** `64d94e8`.

---

## 2026-09-21 — Fase 17 (final) · Dois gaps entre o SPEC e a expansão

Encontrados ao tentar migrar o relatório por pessoa para `oportunidades`.

**Faltavam campos que o SPEC §11.1 define.** O canônico tinha `valor` e `mrr`; o SPEC
define também `setup_estimado`, `servico_catalogo_id` e `etapa_id`. Migrar o relatório
sem o campo de setup teria juntado receita recorrente com receita de implantação, que
são decisões diferentes. Migration 0073, com 212 de 212 setups migrados.

**`pipeline_etapas` foi semeada do pipeline errado.** O backfill 07 a preencheu de
`pipelines.stages`, a configuração do CRM 1, enquanto o módulo Vendas usa outro
vocabulário. Resultado: 1.561 oportunidades e **zero** com `etapa_id`, e isso não
aparecia em teste nenhum porque nada lia `etapa_id` ainda. Migration 0074 semeia as
seis etapas em uso e liga as 1.561; as antigas ficam, porque apagar aqui seria
contrair antes da hora.

O relatório migrou com **paridade exata**: R$ 497.904,42 de MRR e R$ 76.628,87 de
setup, 603 ganhos dos dois lados.

**Commit:** `ffdb614`.

---

## 2026-09-21 — Fase 20 revisada com credencial real

Com as credenciais em mãos, a revisão mostrou que a fase **não estava pronta**, e os
dois problemas maiores só aparecem quando existe credencial para testar.

**O adapter da CAPI não tinha caller.** `montarEventoCapi` e `enviarParaCapi`
existiam com teste passando, e nada em runtime os chamava: a integração parecia
pronta e nenhum evento saía. A cadeia agora fecha pelo outbox, que é onde moram
retry, idempotência e ordem. Um teste barra a regressão, e ele existe por causa deste
erro.

**O webhook assumia dados que a Meta não manda.** O webhook de leadgen avisa que um
lead existe e entrega o `leadgen_id`; os dados só vêm de `/{leadgen_id}`. Assumir
`field_data` funciona com o integrador que já buscou por nós e falha em silêncio
quando a Meta chama direto.

### Três coisas medidas contra a Meta, não presumidas

1. **v26.0 é a versão atual** — v26 valida o caminho, v27+ respondem "Unknown path
   components". Estava `v21.0` em dois lugares;
2. **o token da CAPI não serve para Ads Insights** — escopo único
   `read_ads_dataset_quality`, e a Meta responde erro 200 ao tentar ler insights;
3. **Pixel e Dataset são o mesmo ID e o mesmo endpoint** — uma variável só.

### A política de eventos

`QualifiedLead` é o evento que mais importa: otimizar por `Lead` é otimizar por
volume de formulário. `CompleteRegistration` **não** é apelido de venda ganha — ela
significa cadastro concluído, e usá-la assim ensina a Meta a otimizar por outra
coisa. Só `Purchase` e `OpportunityWon` levam valor.

**Só volta o que veio:** outbound puro não é devolvido como conversão, porque isso faz
o algoritmo otimizar para um público que a Meta nunca trouxe.

### Validado enviando de verdade

Os oito eventos do ciclo de vida foram aceitos em modo Test Events
(`events_received: 8`), incluindo os cinco customizados, e o reenvio do mesmo
`Purchase` foi deduplicado por `event_id`.

**Bloqueio externo isolado:** `META_LEADS_ACCESS_TOKEN` depende da aprovação do
CRM/App na aba CRMs do Business Manager. Tudo que não depende disso está pronto.

**Commit:** `a6f2b6d`.

---

## 2026-09-21 — Fase 19 · Permissão delegada ao agente

O SPEC §31 é literal: NEXO e Hermes *"cannot exceed the permissions delegated to the
run"*. As ferramentas já passavam pelos adapters de domínio, o que impede a IA de
escrever direto no banco, mas **nenhuma verificava permissão**.

O risco concreto: NEXO é operado por conversa. Um SDR pede ao agente uma ação que o
papel dele não permite, o agente executa, e o RBAC vira decoração — basta pedir ao
robô.

**O teto é a interseção**, não a união: o agente não pode mais que a versão dele nem
mais que quem o acionou. Provado com um papel que tem MENOS que o agente — o NEXO tem
7 permissões e, acionado por um leitor, fica sem nenhuma de escrita. Testar com closer
ou admin não provaria nada, porque eles já têm tudo que o agente tem.

Os tetos são diferentes de propósito: Hermes roda sem humano por trás e é o mais
apertado. **Nenhum dos dois mexe em automação, financeiro ou usuários** — mudar fluxo
por conversa é como se perde o controle de um sistema.

O gate roda no `executeRegisteredTool`, por onde toda ferramenta passa: verificar
dentro de cada uma seriam catorze lugares para esquecer um.

**Uma trava pegou o que eu tinha esquecido:** o teste de inventário acusou
`alert.create`, fora do meu mapeamento. Entrou como exceção junto com
`handoff.request` e `case.open`, todas da mesma família — é o que o agente faz quando
NÃO pode agir, e negá-las o deixaria travado em silêncio.

**Commit:** `64eb8a9`.

---

## 2026-09-21 — Fase 18 concluída · A tag ia para um array vazio

Última duplicação do motor. Havia dois modelos de tag: `empresas.tags`, um array de
texto, e `labels`/`entity_labels`, com tabela dedicada e evento de domínio. Medido: o
array está **vazio em todas as empresas** e a tabela tem 161 vínculos. O motor de
regras escrevia no modelo que ninguém usa — a tag posta por automação existia no banco
e não aparecia junto com as outras na tela.

Não havia dado para migrar; havia código para convergir. A resolução nome→label
acontece na ponte, porque quem escreve uma regra sabe o nome da tag e não o uuid dela.

Com isto os dois motores não têm mais nenhuma implementação própria de ação.

---

## 2026-09-21 — Fase 22 · Duas portas abertas na configuração

**As rotas de automação e de agente não tinham gate nenhum**, só `getCtx`, que
autentica e não autoriza. Isso invalidava a delegação de permissão do commit
anterior: o teto do agente mora em `guardrail_config`, e `PATCH .../versions/:id`
gravava ali sem verificar nada — bastava editar a versão do agente para se dar
qualquer permissão.

A varredura seguinte encontrou **181 de 210 rotas de escrita sem autorização**. O
critério para separar ficou escrito no teste: operação (quem está no CRM trabalha),
pública por desenho (o cliente não tem login) e **configuração**, que não pode ficar
aberta porque é o caminho mais curto para contornar todo o resto.

As 15 rotas de `ai-platform.ts` eram configuração e estavam abertas. A pior: criar
credencial de provedor de IA sem gate deixa qualquer usuário ligar um modelo por
conta da empresa.

`ai.configure` (mexer no que a IA pode fazer) e `ai.use` (trabalhar a fila dela) são
permissões diferentes de propósito.

O teste de levantamento **não exige fechar as 166 restantes** — exige que o número não
cresça em silêncio. Fechá-las às cegas quebraria operação legítima; deixá-las sem
medida deixaria a próxima entrar sem ninguém ver.

---

## 2026-09-21 — Fase 24 · A cadeia até a Meta, provada na junta

Os outros smokes provam as peças; este prova a junta: o fato acontece, o evento nasce
na mesma transação, o worker pega e a conversão chega na Meta com auditoria. É a
diferença entre "o adapter funciona" e "a integração funciona" — a mesma que a revisão
da fase 20 encontrou como defeito.

**Dois fatos idênticos, um só entregue.** O smoke cria duas aquisições iguais, uma com
touchpoint da Meta e outra sem. Só a primeira vira conversão.

**Validação de paridade: 11 → 12 dos 14, 0 falhas.** O cenário 13 dizia "enviar exige
pixel e token" — afirmação que ficou desatualizada quando as credenciais chegaram. O
cenário 12 ficou mais honesto: separa o que dá para verificar sem modelo (agentes com
teto, gate provado) do que falta (credencial de provedor; zero ativas).

**Um erro meu, pego pela própria trava.** A primeira execução do smoke morreu numa
constraint depois de criar pessoa e aquisição, e o registro para limpeza só acontecia
no fim da função — os dois ficaram órfãos. Os testes de reconciliação acusaram na
rodada seguinte. É a segunda vez na sessão, e a causa é sempre a mesma: limpeza que
depende do caminho feliz não limpa o caminho que falhou.

**Commit:** `daa4310`.

---

## 2026-09-21 — Fase 24 · Dois eventos que não saíam

**Qualificar um lead não gerava evento de domínio.** Dois modelos conviviam:
`vendas_eventos`, que alimenta só a linha do tempo, e `domain_events`, que alimenta
outbox, automação e Meta. A qualificação escrevia só no primeiro, então
`AcquisitionQualified` — o evento que vira `QualifiedLead` e é o mais importante para
otimização — nunca era publicado. A Meta seguia otimizando por volume de formulário.

**Só a primeira mudança de etapa do sistema publicava evento.** `actionKey` usa
`enrollmentId`, vazio na execução avulsa, então toda automação que movia etapa gerava
a mesma chave. Com `ON CONFLICT DO NOTHING`, a segunda em diante não publicava nada: a
automação funcionava, a etapa mudava, e nada a jusante reagia.

Verificado revertendo a correção de propósito: dois negócios movidos publicam um
evento sem ela, dois com ela.

**Commit:** `8917613`.

---

## 2026-09-21 — Fase 24 · Registro e timeline

**A maior parte dos fatos não existia no registro.** Dois publicadores conviviam: um
grava só a mensagem no `event_outbox` (20 chamadores), outro grava o fato em
`domain_events` e a mensagem (4 chamadores). Fila e registro são coisas diferentes: a
fila some de vista depois de processada, o registro é de onde sai a timeline e onde se
olha para responder "o que houve com esta empresa em agosto". O legado passou a gravar
os dois, na mesma transação, sem tocar nos vinte chamadores.

**A timeline parou no dia da carga.** `projetarTimeline` existia, tinha teste, e só era
chamada em teste — as 14.078 linhas eram todas do backfill. Ligada no consumidor.

Nem todo evento vira linha: `domain_events` é o registro completo, a timeline é o que
uma pessoa lê. Projetar tudo transformaria a tela num log, e log que ninguém lê esconde
o que importa.

Dois bugs pegos ao ligar: `Date` cru no template do postgres.js (a proteção entrou
dentro da função do pacote, para nenhum chamador precisar lembrar) e o id da fila onde
a FK espera o id do registro.

**Commits:** `55822d9`, `374d726`.

---

## 2026-09-21 — Fase 32: o acervo de arquivos, e a varredura que o encontrou

Depois de o mesmo defeito aparecer três vezes seguidas — peça pronta, teste verde,
produção sem caller — parei de esperar tropeçar na quarta e varri: tudo que os pacotes
canônicos exportam, cruzado com quem chama fora de teste.

**39 funções exportadas, 13 sem caller aparente, 1 gap real.** Seis das treze eram
falso positivo do método (chamada dentro do próprio pacote, invisível a um grep sobre
`app/src`). Das sete restantes, duas são andaime da fase 25 e uma é ferramenta de
diagnóstico. Sobrou o acervo de arquivos.

**O acervo estava inteiro e desligado.** Serviço, adaptador local, adaptador S3 por
injeção, repositório Postgres, `file_objects` e `file_links` migradas, testes passando.
Nenhum caller: `anexos.ts`, `perfil.ts` e `fulfillment-formulario-publico.ts` seguiam
chamando `fs.writeFileSync` num diretório da máquina. Em container isso é anexo que
morre no próximo deploy e não existe para a segunda réplica — que é exatamente a frase
que o §32 usa para justificar o pacote.

`file_objects`: 0 linhas. `file_links`: 0 linhas.

**Medido antes de ligar, para não inventar buraco.** Os dois andaimes da fase 25
pareciam gaps e não são: a exigência de empresa na proposta roda por
`verificarPropostaExigeEmpresa`, que chama a mesma política do domínio e ainda resolve
empresa em cadeia (oportunidade → negócio → pessoa), coisa que o comando canônico não
faz; e a perda está íntegra dos dois lados — 431 oportunidades perdidas, 431 com
motivo, contra 432 negócios perdidos. Função sem caller nem sempre é buraco.

Também conferi e descartei duas suspeitas minhas: `anexos` com 0 linhas ao lado de
`anexos_legado` com 1.980 **não** é rename que órfãou dado (são tabelas distintas, a
segunda é o histórico Zoho da 0012); e o guard de `marcarPerdida` comparando com `WON`
funciona, porque o repositório traduz `ganho_at`/`perdido_at` para o vocabulário do
domínio.

**O que foi ligado.** As três rotas gravam pelo acervo. A entrega ganhou endereço pelo
id do metadado (`/api/arquivos/:id`), não pela chave de armazenamento, para a troca de
provedor não tocar em tela. O formulário público ganhou entrega própria autorizada por
vínculo em `file_links` — quem preenche é o cliente, não tem sessão, e o que autoriza
passou a ser o vínculo que o upload criou, não um prefixo de caminho. A autorização de
`/api/uploads/*` passou a comparar a organização que está dentro da chave.

Servir lendo o disco teria deixado `entregarArquivo` sem caller — repetir, no mesmo
commit, o defeito que o commit existe para corrigir.

**Dois defeitos só apareceram com dado real:** a união `EntidadeVinculada` declarava
`cliente` e `comunicacao`, que o CHECK `ck_file_links_entity` recusa, e omitia
`servico_canonico` e `aquisicao`, que ele aceita — tipo que compila e viola constraint;
e `application/zip`, aceito pela rota de anexos em produção, era recusado pelo
allowlist do pacote. Alinhei o pacote ao produto, não o contrário.

**A trava pegou algo na primeira execução.** `gravacao-de-arquivo.test.ts` acusou
`fulfillment-formulario-publico.ts`, rota que eu não tinha visto ao levantar os
caminhos de upload.

**Landmine removido de passagem:** `RepositorioVendas.moverEtapa` era
`SET updated_at = now()` e nada mais — não movia etapa e marcava a oportunidade como
recém-alterada, o efeito que já encheu o board de "17min". Agora falha alto até a fase
25 decidir onde vive a etapa canônica (`oportunidades.etapa_id`: 0 de 1.561).

**Bloqueio externo registrado:** sem credencial de object storage, o provedor continua
disco local. `escolherAdaptador` recusa isso em produção, e a recusa foi mantida —
ligada a uma permissão nominal, `STORAGE_ALLOW_LOCAL`, porque desligá-la hoje derrubaria
upload em produção por uma credencial que ainda não chegou. Apagar a variável é a
virada, e é ambiente, não código.

**Migration:** `0078_anexos_no_acervo_canonico` (`anexos.file_object_id`, nullable —
anexo antigo não tem acervo e não se inventa checksum de arquivo que não se leu).

**Validação:** tsc limpo; 246 testes (era 242); build exit 0; smoke do acervo com 18
verificações no banco carregado com produção — guarda, deduplica, vincula, entrega,
isola por organização, recusa vazio e tipo fora da lista, e não deixa resíduo.

**Contagens:** `file_objects` 0 → 0 (o smoke limpa o que cria), `anexos` 0,
`anexos_legado` 1.980 (intocada), `timeline_events` 14.078, `domain_events` 2.016,
`event_outbox` 0.

**Commit:** `d0948f4`.

---

## 2026-09-21 — Correções exigidas antes de fechar o batch de Storage

Dois pontos levantados pelo Kauã na revisão, os dois procedentes.

**1. A leitura pública do anexo não estava autorizada.** A rota recebia
`fulfillmentId` + `fileObjectId` e conferia só que os dois estavam vinculados em
`file_links`. Isso prova PARENTESCO, não permissão: os dois identificadores circulam
por caminhos diferentes do produto, e quem juntasse um par válido abriria o documento
sem nunca ter tido o link do formulário. Agora quem autoriza é o `publicToken`, a mesma
credencial que abre o formulário inteiro e todas as respostas dele; o vínculo continua
sendo checado, no papel certo, para um token legítimo não virar chave de arquivo de
outro fulfillment.

Provado por chamada real à rota, não por grep: token certo abre (200), token errado não
(404), id do fulfillment no lugar do token não (404), token válido não alcança arquivo
de outro fulfillment (404), e a rota autenticada segue exigindo sessão (401). As duas
primeiras execuções do smoke falharam por caminho de mount errado, o que é a prova de
que o teste estava medindo alguma coisa: os casos negativos "passavam" enquanto tudo
devolvia 404.

**2. Object storage tinha virado dependência para o deploy subir.** A versão anterior
exigia `STORAGE_ALLOW_LOCAL=true` para não lançar em produção, e produção não tem essa
variável: o próximo deploy derrubaria upload, avatar, anexo e formulário público por
causa de credencial que ainda não existe. Trocaria um problema de arquitetura por uma
queda.

Corrigido invertendo o default. Sem `STORAGE_*` o serviço usa disco local, como o
produto já fazia, sem variável nova nenhuma. A exigência virou opt-in
(`STORAGE_REQUIRE_OBJECT_STORAGE`), que é o passo da virada e não um requisito de hoje.
O caminho completo da virada ficou escrito no topo de `lib/arquivos/servico.ts`, onde
quem for executá-la vai ler.

Também ficou explícito um silêncio que teria enganado: o adaptador S3/R2 ainda não foi
implementado, então configurar as quatro variáveis hoje não liga nada. O serviço avisa
alto nesse caso em vez de deixar quem configurou achando que ligou.

**Ainda neste batch, a gestão de tokens da API pública.** A API tinha nove recursos,
autenticação por token, escopo e registro de uso, e nenhuma forma de criar um token:
`api_tokens` só era escrita pelo smoke, com 0 linhas. Na prática a API inteira era
inacessível sem `INSERT` manual. Entraram as rotas de criar, listar e revogar, com três
regras: o token aparece uma vez e só o sha256 fica guardado; ninguém cria token acima de
si; revogar não apaga, para não destruir a resposta sobre o que a credencial andou
puxando.

**Uma vulnerabilidade real no caminho:** `gerarToken` derivava a credencial de
`Date.now()`, `Math.random()` e `process.pid`. Os três são adivinháveis e passar por
sha256 não acrescenta entropia. Agora é `randomBytes(32)`. Varri o resto do código
atrás da mesma classe: o único outro uso é sufixo de chave de idempotência do Stripe,
que não é fronteira de segurança.

**Um teste ruim pego por mutação.** A primeira trava do teto de escopo procurava o nome
da função no arquivo da rota. Removi a regra de propósito para conferir, e o teste
passou. A regra saiu para `lib/auth/teto-de-token.ts` e ganhou teste que a EXECUTA (7
casos); a trava estrutural ficou, sabendo que é estrutural, só para impedir uma segunda
cópia da regra dentro da rota.

Disso saiu uma correção de fundo: `permissoesEfetivas` em `lib/auth/permissoes.ts`
passou a ser a decisão única. O teto usava o RBAC cru e ignorava o fallback de papel
legado, então um admin sem papel vinculado não conseguiria criar token nenhum. O teste
de paridade de permissões continua passando, o que prova que centralizar não mudou quem
pode o quê.

**Validação:** tsc limpo, **255 testes, 0 falhas**, build de produção exit 0, smoke do
acervo (23 verificações) e smoke de gestão de tokens (12 verificações) no banco
carregado com produção, mais o smoke da API pública.

**Pendente e NÃO removido do escopo:** a tela de gestão de tokens (`/ajustes/api-tokens`)
da fase 23. O backend está completo e validado; falta a interface.

---

## 2026-09-21 — Cutover crítico, parte 1: o espelho estava apagando o canônico

Prioridade reordenada a pedido do Kauã: primeiro o que impede o produto funcionar em
produção. Comecei medindo divergência entre canônico e legado par a par, em vez de
confiar no documento.

**Quase tudo está em paridade.** 3.989 leads pareados com 3.989 aquisições, zero sem
par, responsável e qualificação idênticos. 1.561 negócios pareados com oportunidades,
`stage`, `titulo` e `empresa_id` sem nenhuma divergência.

**Menos um campo: `service_family`, divergente em 475 de 1.561.** E a divergência é
unidirecional: o canônico TEM o valor, o legado é NULL. Não é dado sujo, é o backfill
tendo deduzido a família por cadeia de cinco evidências onde o negócio nunca teve. 299
desses estão ganhos. `source_process` tem o mesmo padrão, em 63.

**E o espelho apagava exatamente isso.** `espelharNoDominioV2` e
`syncOportunidadeFromNegocio` copiavam os dois campos do legado sem condição. Como a
segunda roda em toda alteração de negócio, a dedução morria no primeiro toque. Provei
numa transação com rollback antes de mexer: um PABX real vira NULL depois do UPDATE.

Apagar a família não é perda cosmética. A política de Ganho decide jornada de pós-venda
por ela: sem família, PABX e White Label não geram implantação e o produto engole a
etapa sem erro nenhum.

**O smoke pegou o que eu não tinha visto.** Corrigi o espelho do pipeline primeiro e
rodei pelo caminho real (`moverEtapa`): `source_process` sobreviveu e `service_family`
continuou sendo apagada. Havia um SEGUNDO escritor, `sync-domain-model.ts`, chamado
antes. Se eu tivesse validado com SQL escrito à mão em vez do caminho real, teria
fechado o commit com o bug intacto.

Os dois agora preenchem sem apagar. O que não é dedução segue cópia direta de propósito:
título, etapa, `commercial_motion` e responsável são editados no legado, e ali esvaziar
é intenção do usuário, não ausência de evidência.

Trava em `escritores-migrados.test.ts`, verificada falhando com a correção removida, e
smoke `smoke-espelho-nao-apaga.ts` pelo caminho real.

**O board do CRM2 escondia família que o sistema conhece.** `/api/pipeline-crm2/board`
lia só `negocios.service_family`, NULL em 526 dos 527 cards abertos. Em 125 deles a
oportunidade sabe a família. A consulta passou a completar pelo canônico, com o legado
tendo precedência onde tem valor, porque editar tem que ganhar de deduzir. Medido pela
consulta da rota: **1 → 126 cards com família**.

Subconsulta em vez de JOIN: hoje a relação é 1:1, mas bundle cria oportunidades irmãs do
mesmo negócio e um JOIN duplicaria o card.

**Não migrei `cs/expansoes`**, que também lê a família do legado: medi e o impacto é
zero (nenhum negócio de expansão sem família). Está registrado como leitura legada
restante, não como resolvido.

**Duas coisas medidas e deliberadamente NÃO "corrigidas",** porque corrigir seria
inventar:

- 574 das 603 oportunidades ganhas não têm serviço canônico ligado, e o backfill 10
  declarou isso com 0 casos abertos. Ligar por proximidade seria fabricar de qual venda
  veio cada serviço.
- Zero fulfillments de IMPLEMENTATION no banco, contra 126 ganhos PABX/White Label.
  Criar jornada retroativa para cliente implantado há um ano é inventar trabalho
  operacional. A regra vale daqui pra frente e já tem prova: `smoke-ganho-oportunidade`
  gera as duas jornadas para PABX.

**Validação:** tsc limpo, **256 testes, 0 falhas**, build exit 0, smokes do espelho,
do board, do acervo, de tokens e de ganho.

---

## 2026-09-21 — Cutover crítico, parte 2: propagação medida e cenário 8 destravado

**Cinco ações de pipeline escreviam em `negocios` sem chamar o espelho.** Mapeei
função por função esperando encontrar o mesmo bug de novo. Não era: `definirProximaAcao`,
`marcarEstagnacao`, `registrarNoShow`, `reagendarAposNoShow` e `iniciarTrial` escrevem
colunas que **não existem** em `oportunidades`, e `consultas.ts` as lê do legado de
propósito, porque o canônico não as deriva. Não há o que propagar. Registrado como
verificado, não como pendência.

**O cenário 8 não era "não verificável", era duas coisas misturadas.** Estava assim
porque 0 de 275 clientes têm dono. Mas o cenário do SPEC é "atribuir e editar o dono",
que é capacidade, e capacidade se verifica chamando a rota.

Para chamar rota autenticada de verdade, criei `_sessao-de-smoke.ts`, que emite um
cookie com o mesmo `encode` do Auth.js que a API usa para decodificar, com o mesmo
segredo e salt. Reimplementar o formato do JWE é o que um dia fez o Next autenticar
enquanto o Hono recusava o mesmo cookie; usar a biblioteca evita repetir isso.

`smoke-cs-responsavel.ts` atribui, confere o histórico em `audit_log`, troca por outro
dono, remove, checa 401 sem sessão e restaura o estado original, porque roda sobre dado
de produção. Passa em 9 verificações.

O que continua pendente é QUEM fica com quais 275 contas. É decisão de operação, e está
listada como decisão, não como código faltando.

**Paridade: 13 de 14 passam, 0 falham, 1 não verificável.** O único restante é o NEXO,
bloqueado por credencial de provedor de modelo. Tudo antes da chamada ao modelo já está
provado: ferramenta de domínio, teto de permissão por interseção e gate de autorização.

**Validação:** tsc limpo, 256 testes, build exit 0.

---

## 2026-09-21 — Cutover crítico, parte 3: trocar o dono não chegava no canônico

Auditoria de escritores por coluna: para cada arquivo que escreve em `leads` ou
`negocios`, quais colunas toca, se elas existem no canônico e se ele propaga. Oito
suspeitos, um falso positivo (`won-evidence.ts`, que usa `propagarGanhoCanonico` e o
meu detector não conhecia).

**O padrão real era um só: `responsavel_id`.**

Provei pela rota, não pela tabela. O board de pré-vendas conta "sem responsável" a
partir de `aquisicoes.responsavel_id` e a Empresa 360 lê o dono de
`oportunidades.responsavel_id`. `PATCH /negocios/:id` propagava; `PATCH /leads/:id`
**não**. A pessoa reatribuía o lead, recarregava, e a tela continuava mostrando o dono
antigo.

**A divergência no banco era ZERO, e era isso que escondia o defeito.** O backfill
sincronizou os dois lados, então medir o estado atual não acusava nada: o problema só
apareceria na primeira reatribuição depois da carga. Por isso o smoke provoca a troca
pela rota de verdade em vez de medir o que já está lá. Na primeira execução ele falhou,
como esperado, e nomeou qual dos dois lados estava parado.

**A correção foi na porta, não nos chamadores.** `registrarMudancaResponsavel` já era o
ponto por onde toda troca de dono passa, com cinco chamadores, mas só gravava auditoria.
Passou a propagar também, com um mapa entidade → tabela canônica. `pessoa`, `cliente` e
os `fulfillment*` ficam de fora sem exceção escrita à mão, porque já são canônicos.

Ordem deliberada: canônico primeiro, auditoria depois. Se o processo morrer entre as
duas escritas, é melhor ter o dono certo sem a linha de auditoria do que a auditoria de
uma troca que a tela não mostra.

**Dois caminhos trocavam dono sem passar pela porta**, e agora passam:

- `crm_assign_owner` do motor de automação. Além de não propagar, não deixava rastro:
  a pergunta "quem colocou isso na minha carteira" não tinha resposta quando a resposta
  era "uma regra".
- a escalação do SDR, que reatribui lead em lote depois de N horas em Em Contato.

A porta ganhou `actorId` nulável e `source`, para separar na auditoria o que uma pessoa
fez do que uma regra fez. Sem isso, automação teria que inventar um usuário.

Trava em `escritores-migrados.test.ts`, verificada falhando com a propagação removida,
varrendo sete arquivos que escrevem responsável.

**Também medido e descartado:** `contatos-crm2.ts`, `contratos.ts` e
`pre-vendas/actions.ts` apareceram na varredura mas já estavam cobertos, o primeiro
porque chama a porta, os outros dois porque as colunas que escrevem (`tipo`,
`empresa_id`) seguem caminho próprio já migrado.

**Validação:** tsc limpo, **257 testes, 0 falhas**, build exit 0, `smoke-dono-propaga`
e `smoke-motor-unico` verdes.

---

## 2026-09-21 — Cutover crítico, parte 4: a automação movia etapa para uma coluna morta

`crm_update_stage` escrevia na tabela por conta própria. Para lead, escrevia em
`leads.crm2_pre_vendas_stage`: **zero linhas preenchidas em todo o banco**, nenhuma
leitura consulta. A automação movia a etapa, devolvia sucesso, e nada acontecia no
produto. Para negócio, escrevia `negocios.status` sem propagar, e o board de pipeline,
que lê `oportunidades`, ficava na etapa antiga.

Não há automação ativa hoje (0 em `automacoes`), então isso nunca queimou ninguém.
Queimaria na primeira que alguém ligasse, em silêncio.

O lead passou a usar `lib/vendas/pre-vendas::moverEtapa`, que é a porta da tela: valida
a transição, grava na coluna certa, registra o evento e sincroniza a aquisição. Duas
recusas vieram de graça e são corretas: qualificar deixou de ser possível por "mover
etapa" (qualificação é um fato, não posição no board) e etapa inexistente é recusada em
vez de gravada.

**Um erro meu, pego pelo smoke que já existia.** Roteei também o negócio para a porta de
`etapa`, e quebrei `smoke-motor-unico`. `negocios.status` e `negocios.etapa` são campos
diferentes com vocabulários diferentes: `status` é o estado comercial legado
(`reuniao_agendada`, `negociacao_iniciada`, ...) e `etapa` é a coluna do board CRM2
(`entrada`, `diagnostico`, ...). A automação sempre mexeu em `status`, e trocar o campo
mudaria o significado da ação para quem já a usa. O defeito real nunca foi o campo, era
a falta de propagação. Revertido o campo, mantida a propagação via
`syncOportunidadeFromNegocio`.

Vale registrar como o erro apareceu: o smoke do motor falhou em três verificações de uma
vez. Sem ele, o commit teria trocado a semântica de uma ação de automação sem ninguém
perceber.

**A propagação nova criou uma filha que a limpeza antiga não conhecia.** `smoke-motor-unico`
passou a deixar `oportunidades` órfã e quebrava no próprio DELETE. Corrigido nos dois
pontos de limpeza, e o resíduo de duas linhas foi removido do banco.

`smoke-automacao-etapa.ts`, 11 verificações, prova o caminho inteiro pela ação de
verdade: lead vai para a coluna que o produto lê e NÃO para a morta, a aquisição
sincroniza, qualificação e etapa inexistente são recusadas, o negócio propaga para a
oportunidade, e Ganho continua exigindo o gate comercial.

**Validação:** tsc limpo, **257 testes, 0 falhas**, build exit 0,
`smoke-automacao-etapa` e `smoke-motor-unico` verdes.

---

## 2026-09-21 — Cutover crítico, parte 5: a projeção descartava 100% do que recebia

Varredura dos adapters do motor: quais escrevem direto e quais passam por porta. Três
sem porta. Dois são inofensivos (`crm_callface_call` escreve estado interno do motor,
`email` escreve em `contatos`). O terceiro não era.

**`crm_add_note` gravava a nota só em `atividades`.** A linha do tempo canônica lê
`timeline_events` e `communications`, então a nota existia no banco e não aparecia na
tela da pessoa. Escrita invisível, o formato de bug que este refactor mais encontrou.

A nota passou a publicar `NoteAdded`, e a projeção ganhou a regra de como ela aparece.
O evento sai DEPOIS do insert: se a nota não foi gravada, não há fato a anunciar.

**E aí o smoke mostrou o problema de verdade.** O fato entrava no registro, entrava na
fila, e a linha do tempo continuava vazia.

`projetarEventoNaTimeline` exigia `empresa_id`, `pessoa_id`, `aquisicao_id` ou
`oportunidade_id` DENTRO do payload. O publicador legado, que tem 20 chamadores, põe
`entityId` (id de lead ou negócio) e não o id canônico. Medido: **2.016 de 2.016 eventos
de domínio não carregam nenhum id canônico**, e 659 são de tipo projetável.

Ou seja: a projeção que liguei na rodada anterior **descartava tudo o que recebia**, e
em silêncio, porque descartar evento sem vínculo é o comportamento correto para evento
que não tem onde aparecer. Teste verde, caller ligado, e nenhuma linha nova.

A correção é na projeção, não nos publicadores: ela passou a resolver o vínculo a partir
do agregado (`lead` → aquisição e pessoa, `negocio` → oportunidade, empresa e pessoa),
porque pedir a 20 chamadores que carreguem ids canônicos é o tipo de contrato que se
cumpre em 19.

**A história não precisou de reprojeção, e isso foi medido antes de mexer:** as 2.016
linhas de timeline com `domain_event_id` correspondem exatamente aos 2.016 eventos, e os
659 `ProposalSent` já estão todos ligados. O backfill 14-15 fez esse trabalho. O buraco
era só daqui pra frente, que é onde ele foi fechado.

**Validação:** tsc limpo, **257 testes, 0 falhas**, build exit 0, `smoke-automacao-etapa`
(15 verificações), `smoke-motor-unico`, `smoke-outbox` e `smoke-capi-outbox` verdes, e
zero resíduo de smoke no banco.

---

## 2026-09-21 — Cutover crítico, parte 6: o cartão "Sem 1º contato" mostrava zero para sempre

Auditoria dos quatro escritores que o inventário classificava como "atualizam, não
criam". Três confirmados inofensivos: `email.ts` e `whatsapp.ts` escrevem contadores de
caixa de entrada que não existem no canônico, e o `tipo` que `contratos.ts` escreve em
`leads` (cliente, contato, lead) não tem relação com `aquisicoes.tipo` (INBOUND,
OUTBOUND), apesar do nome igual. Colisão de nome, não de significado.

O quarto levou a outro lugar. `cadencia.ts` escreve `leads.last_contact_at`, e foi
puxando esse fio que apareceu um KPI quebrado na tela.

**O board de pré-vendas mostra "Sem 1º contato" com alerta, e o número é sempre zero.**
A condição era `last_touch_at IS NULL`, e **nenhuma das 3.989 aquisições tem esse campo
nulo**: o backfill grava a chegada do lead como último toque quando ninguém o contatou
depois. A condição nunca podia ser verdadeira. Um indicador que só sabe dizer "está tudo
bem".

O backfill não estava errado, e por isso não mexi nele: `first_touch_at = created_at`
é defensável, o lead chegando É um toque, ele veio até nós. O erro estava na LEITURA.

"Sem 1º contato" significa não ter havido toque DEPOIS da chegada. Com essa condição, o
número é **3.060 de 3.702 aquisições abertas**, e ele bate exatamente com uma
conferência por caminho independente do canônico: leads abertos com `last_contact_at`
nulo. Duas contas separadas chegando no mesmo número é o que me deixou publicar isso
como correção e não como palpite.

A verificação entrou em `smoke-prevendas-leitura`, consultando o BOARD e comparando com
a conferência independente, e falha também se o número voltar a ser zero.

**Sétima vez com a crase.** Escrevi `` `last_touch_at` `` dentro de um comentário no
template `sql` e o literal fechou no meio. O erro sai como `TS1005` numa coluna
arbitrária, sem nenhuma menção a SQL. A trava `sql-template.test.ts` existe desde hoje
de manhã justamente para isso.

**Validação:** tsc limpo, **257 testes, 0 falhas**, build exit 0,
`smoke-prevendas-leitura` verde com o cartão em 3.060.
