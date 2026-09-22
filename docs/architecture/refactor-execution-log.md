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

---

## 2026-09-21 — Cutover crítico, parte 7: toda leitura canônica executada contra produção

`lib/vendas/consultas.ts` é a porta de leitura de 20 telas, e até agora cada correção
provava uma leitura por vez. `tsc` prova que as consultas compilam e `pnpm build` prova
que as páginas montam; nenhum dos dois executa uma query contra dado real.

`smoke-leituras-canonicas.ts` chama as nove leituras exportadas mais a linha do tempo,
com ids reais, e confere conteúdo, não só ausência de exceção: board vazio é o bug que
este refactor mais encontrou, e "não explodiu" teria passado em todos eles.

| Leitura | Tempo | Conteúdo |
|---|---|---|
| `boardPreVendas` | 75ms | 201 cards, 3.702 ativos |
| `boardPipeline` | 21ms | 290 cards, 603 ganhas |
| `listaProspeccao` | 7ms | 78 linhas |
| `diretorioEmpresas` | 461ms | 200 linhas |
| `diretorioPessoas` | 15ms | 200 linhas |
| `pessoaPorId` | 2ms | encontrada |
| `empresa360` | 38ms | monta, com oportunidades |
| `detalheLead` | 3ms | monta |
| `detalheOportunidade` | 3ms | monta |
| `lerLinhaDoTempo` | 3ms | 50 eventos na pessoa com mais histórico |

O smoke falha se alguma passar de um segundo: consulta de board lenta é problema de
produto, não de teste. `diretorioEmpresas` é a mais próxima do limite e fica registrada.

Duas verificações também conferem que correções anteriores continuam de pé: o board de
pré-vendas traz cards (era o sumiço dos 2.392 leads) e a linha do tempo traz eventos
(era a tabela vazia).

**Outras conferências desta rodada, todas batendo:** os quatro cartões restantes do
board de pré-vendas contra caminho independente; o resumo do pipeline, onde
`o.etapa = 'ganho'` parecia impossível e não é (603 e 431 conferem com `ganho_at` e
`perdido_at`); identidade entre `leads` e `pessoas` (3.950 vinculadas, 0 divergência de
nome e e-mail, 3 de telefone por normalização); e empresa entre `leads` e `aquisicoes`
(2.348 dos dois lados, 0 divergência).

**Validação:** tsc limpo, **257 testes, 0 falhas**, smoke de leituras verde.

---

## 2026-09-21 — Cutover crítico, parte 8: varredura campo a campo, e um marcador de carga na tela

Em vez de continuar adivinhando quais campos divergem, varri: para cada par
canônico/legado ligado por `*_legado_id`, comparei **todo campo que existe nos dois**.

| Par | Campos em comum | Divergências |
|---|---|---|
| `aquisicoes` x `leads` | 7 | `tipo` 100% (vocabulários diferentes, já verificado) |
| `oportunidades` x `negocios` | 13 | `source_process` **100%**, `service_family` 30%, `ganho_at` 2, `motivo_perda` 2 |
| `pessoas` x `leads` | 7 | `whatsapp` 23, `empresa_id` 4, `telefone` 3, `cargo` 2, `sobrenome` 1 |

**`source_process` divergia em 100% porque o backfill gravou o próprio nome nela.**
1.560 de 1.561 oportunidades tinham a string `BACKFILL_07` numa coluna de NEGÓCIO: ela
diz de onde a oportunidade veio (PRE_SALES, OUTBOUND_DIRECT, MANUAL, EXPANSION) e
aparece na tela como "Origem".

O efeito era visível de dois jeitos diferentes: no card do pipeline o rótulo caía no
default e mostrava "—"; na página da oportunidade o valor era exibido cru, e lia-se
"Origem: BACKFILL_07". E 1.497 dessas tinham a origem de verdade guardada no negócio
legado o tempo todo.

Migration 0079 devolve a origem do legado onde ela existe (**1.498 passam a mostrar
"Pré-vendas"**) e grava NULL nas 63 sem evidência, em vez de um palpite. A proveniência
não se perde: `backfill_provenance` já tinha as 1.561 linhas da fase 07, que é o lugar
próprio dela.

A página da oportunidade passou a usar o mesmo `rotuloProcesso` do card, que foi
exportado para os dois. Valor cru em tela é como este marcador apareceu para o usuário;
com o rótulo compartilhado, o próximo valor inesperado não vaza.

Duas travas em `reconciliacao-backfill.test.ts`, e elas são um par: uma proíbe marcador
de carga em coluna de negócio, a outra exige que a proveniência continue registrada. Só
a primeira seria satisfeita apagando o rastro. Verificada falhando com o marcador
recolocado numa linha.

**As divergências pequenas de identidade ficam nomeadas e não foram tocadas**: 23
`whatsapp`, 4 `empresa_id`, 3 `telefone`, 2 `cargo`, 1 `sobrenome` entre `leads` e
`pessoas`, e 2 `ganho_at` e 2 `motivo_perda` entre `negocios` e `oportunidades`.
Escolher qual lado está certo em cada uma é decisão sobre dado real, não regra
derivável.

**Validação:** tsc limpo, **259 testes, 0 falhas**, build exit 0, smoke de leituras
verde.

---

## 2026-09-21 — Cutover crítico, parte 9: o legado podia contaminar a invariante do canônico

As divergências pequenas da varredura anterior (`ganho_at` 2, `motivo_perda` 2) pareciam
ruído e não eram.

São **contradições de estado no legado**: dois negócios com `status = 'perdido'` e
`ganho_at` preenchido, e dois com `status = 'ganho'` e `motivo_perda` preenchido. O
canônico estava certo nos quatro casos, porque o backfill não copiou a contradição.

Mas `syncOportunidadeFromNegocio` copiava `ganhoAt`, `perdidoAt` e `motivoPerda` crus, e
o canônico TEM uma invariante testada de que ganho e perda não coexistem. Provei em
transação com rollback: rodar o sync sobre esses dois negócios produz duas oportunidades
ganhas E perdidas ao mesmo tempo, e a suíte passa a falhar.

**Bastava alguém editar aquele negócio.** Qualquer edição dispara o sync.

A regra que entrou não é arbitrária: um negócio perdido não está ganho, e o `status` é
quem decide qual das duas datas vale. A data que sobra é resíduo de um ganho desfeito
que ninguém limpou. Alcance medido antes de escrever a regra: 603 dos 605 `ganho_at` já
têm `status = 'ganho'`, e nenhum negócio ganho está sem data. A regra toca exatamente as
4 linhas contraditórias.

Provado depois pelo sync de verdade sobre o negócio contraditório real, não por SQL
equivalente: `ganho_at` continua nulo, `perdido_at` intacto, e o banco inteiro segue com
zero oportunidades ganhas e perdidas.

**Validação:** tsc limpo, **260 testes, 0 falhas**, build exit 0.

---

## 2026-09-21 — Cutover crítico, parte 10: identidade completa

Fechando as divergências pequenas que a varredura campo a campo nomeou entre `leads` e
`pessoas`.

**As 23 de `whatsapp` não eram ruído: eram todas as que existem.** Só 23 leads têm
WhatsApp preenchido no banco inteiro, e `pessoas.whatsapp` estava vazio nos 23. O
backfill de identidade não copiou esse campo em nenhum caso. A tela da pessoa lê
`pessoas.whatsapp` e mostrava vazio enquanto o número estava no lead o tempo todo.

Migration 0080 copia, sem normalizar e sem inventar: a sincronização de identidade já
trata o lead como fonte deste campo e copia cru a cada alteração; a migration só
antecipa para quem ninguém editou desde a carga, em vez de esperar um acaso. Normalizar
aqui mudaria o dado sem ninguém ter decidido qual é o formato certo.

**`sobrenome` nunca propagava.** Faltava na lista de campos de perfil da sincronização
de identidade, então editá-lo no lead não chegava na pessoa canônica. Uma linha.

Divergência de identidade depois das duas correções: **zero em `whatsapp`**, e seguem
nomeadas as 4 de `empresa_id`, 3 de `telefone` e 2 de `cargo`, que são casos de dado
real, não de propagação faltando.

**Validação:** tsc limpo, **260 testes, 0 falhas**, build exit 0, smoke de propagação
verde.

---

## 2026-09-21 — Verificador pré-deploy

O checkpoint nomeou um único bloqueio de deploy, e era de procedimento: as 23 migrations
nunca rodaram em produção, e a 0056 aperta `organizacao_id` para NOT NULL em quatro
tabelas financeiras e cria três chaves estrangeiras. Uma linha nula ou uma referência
órfã derruba a migration no meio do deploy.

Dizer "no clone local está limpo" não responde: o clone é de 20/09, e um dia de operação
cria linha nova. `checar-pre-deploy.ts` roda apontando para o banco de produção, com a
aplicação no ar, e é **somente leitura**. Conta as linhas que impediriam cada
`ALTER TABLE`, mostra a consulta para encontrar cada uma, e lista quais migrations
aquele banco já tem.

Um detalhe que o próprio script me corrigiu: a primeira versão checava existência de
tabela para todos os marcos, e reportou 0075 e 0077 como pendentes quando elas já
haviam rodado. Nem toda migration cria tabela — a 0075 cria uma configuração de busca
(`pt_unaccent`) e a 0077 só altera `guardrail_config`. Cada marco passou a checar a
coisa que aquela migration realmente produz.

No clone local: nenhum impedimento, 8 de 8 marcos aplicados.

**Validação:** tsc limpo, **260 testes, 0 falhas**.

---

## 2026-09-21 — O worker tem conexão própria, e eu quase abri uma segunda

Ao revisar o que tinha mudado no worker, li o comentário no topo de
`sdr-escalation.ts`: ele recebe `db` por parâmetro de propósito, porque o worker cria a
PRÓPRIA instância (`drizzle(pgSql)` na linha 22 de `worker/index.ts`) e nunca importa a
da aplicação.

Minha correção de propagação de dono importava `registrarMudancaResponsavel`, e essa
função importava `@/lib/db`. O bundle resolve o alias (esbuild com `--alias:@=./src`),
então nada quebraria no build nem em teste: o processo do worker simplesmente abriria um
**segundo pool de conexões** na primeira escalação de SDR. Aparece como conexão esgotada
no Postgres, longe da causa.

A porta de dono passou a aceitar a instância do chamador, com a da aplicação como
padrão. Quem chama de dentro do worker passa a sua.

Trava em `escritores-migrados.test.ts`: `sdr-escalation` não pode importar a conexão da
aplicação, tem que repassar a que recebeu, e a porta tem que aceitar. Verificado também
pelo bundle real do worker (`esbuild`, exit 0).

**Validação:** tsc limpo, **261 testes, 0 falhas**, build do Next exit 0, bundle do
worker exit 0.

---

## 2026-09-21 — Cutover crítico, parte 11: o detalhe da oportunidade também escondia a família

Mesma correção do board, agora na porta de leitura canônica. `detalheOportunidade` lia
`negocios.service_family`, que é NULL em 475 das 1.561 oportunidades, e mostrava "sem
família" para um negócio cujo produto o canônico conhece.

Passou a completar pelo canônico, com o legado tendo precedência onde tem valor, porque
editar ganha de deduzir. `source_process` foi junto, pelo mesmo motivo.

A verificação entrou em `smoke-leituras-canonicas` e não é genérica: ela busca no banco
um negócio que tem família SÓ no canônico e confere que a tela mostra. Com o dado
sincronizado dos dois lados, um teste genérico passaria sem provar nada.

Este é um pedaço da leitura de detalhe migrando, e é o pedaço que dava para migrar sem a
escrita: os campos onde o canônico é melhor e a propagação já está fechada. O resto do
`detalheLead` e do `detalheOportunidade` lê campos que **não existem** no modelo
canônico (`qualificacao` em JSON, UTMs, nutrição, desqualificação, próxima ação, no-show,
trial), e esses migram junto com a escrita na fase 25.

**Validação:** tsc limpo, **261 testes, 0 falhas**, build exit 0, smokes de leitura e de
sincronização verdes.

---

## 2026-09-21 — Cutover crítico, parte 12: 43 propostas paradas por um dado que o sistema tem

Continuando a varredura de leitores de `service_family`, cheguei nas telas de proposta. O
que parecia mais do mesmo virou o achado mais sério do dia.

`enviarProposta` recusa com "Defina a família comercial antes de enviar uma proposta"
quando a oportunidade não tem família. A leitura que alimenta esse gate
(`carregarProposta`) olhava só `negocios.service_family`.

**Isso não é exibição, é a operação comercial travada.** 526 negócios abertos sem
família no legado, e em **125 deles a oportunidade canônica sabe qual é**. Há **43
propostas em rascunho** nesses negócios, que ninguém conseguia enviar por um dado que o
sistema já tinha deduzido no backfill.

A cadeia de família virou proposta → negócio → oportunidade canônica, do mais específico
para o mais geral: o que foi decidido na proposta manda, depois o que foi decidido no
negócio, e a dedução entra só quando ninguém decidiu. Nas três consultas da tela de
propostas e na leitura do gate.

Medido pela mesma condição do gate: **propostas com família resolvível de 2 para 469**.
1.548 das 1.550 propostas não têm família própria nem no negócio.

O `LEFT JOIN` foi conferido contra duplicação antes de entrar: 1.550 propostas dos dois
lados.

`smoke-proposta-familia.ts` prova os quatro lados: existem negócios nesse estado, a
cadeia destrava, a proposta carrega a família do canônico, ela passa no gate real
(`ehFamiliaValida`), e a precedência não inverte — onde o legado tem valor, ele manda.

**Validação:** tsc limpo, **261 testes, 0 falhas**, build exit 0, smokes de ganho e de
leitura verdes.

---

## 2026-09-21 — Cutover crítico, parte 13: o mesmo bloqueio no avanço de etapa

Depois de destravar o envio de proposta, varri os outros **gates** de regra de negócio
atrás do mesmo padrão: operação bloqueada por leitura de campo legado incompleto.

Achei um, e é o mesmo campo. `moverEtapa` recusa avançar para Proposta ou Negociação
sem família válida, e `carregarOportunidade` lia `negocios.service_family` cru. Os mesmos
125 negócios abertos ficavam presos na etapa anterior.

`carregarOportunidade` alimenta quase toda ação do pipeline (mover etapa, perder,
tentar ganhar, alterar família, próxima ação, reunião, trial), então a correção entrou
lá, uma vez.

**Um cuidado que quase virou bug silencioso:** `alterarFamilia` compara a família atual
com a escolhida e sai cedo quando são iguais. Com a família resolvida, escolher
justamente a que o canônico deduziu viraria um no-op — o usuário clicaria em "definir
família", nada aconteceria, e o legado ficaria nulo para sempre. A carga passou a
devolver os dois valores: o resolvido, que alimenta os gates, e o próprio do legado, que
`alterarFamilia` usa para decidir se há o que gravar.

O smoke move a etapa de um negócio real nesse estado e devolve tudo ao lugar: a etapa
avança para Proposta, e o estado original é restaurado nos dois modelos.

**Validação:** tsc limpo, **261 testes, 0 falhas**, build exit 0, cinco smokes que tocam
o pipeline verdes, zero resíduo.

---

## 2026-09-21 — Cutover crítico, parte 14: a classe fechada e travada

Último leitor da família fora da cadeia: `cs.ts`, a lista de expansões. Medi antes e o
impacto é **zero** — nenhum negócio de expansão está sem família no legado. Corrigi
assim mesmo, porque deixar um leitor fora do padrão faz o próximo a copiá-lo repetir o
buraco que os outros seis tinham.

Subconsulta em vez de `JOIN` aqui também: bundle cria oportunidades irmãs do mesmo
negócio, e um `JOIN` duplicaria a linha.

A trava em `escritores-migrados.test.ts` varre os seis arquivos linha a linha e acusa
qualquer uso de `negocios.service_family` que não esteja dentro de um `COALESCE` nem
seja o valor próprio que `alterarFamilia` precisa comparar. Verificada falhando com o
`COALESCE` removido de um deles.

**O placar da classe, fechada:** 7 leitores, 5 escondiam dado na tela, 2 bloqueavam
operação. 43 propostas em rascunho destravadas, 125 negócios abertos liberados para
avançar de etapa, 467 propostas e 125 cards passando a mostrar o produto.

**Validação:** tsc limpo, **262 testes, 0 falhas**, build exit 0.

---

## 2026-09-21 — O construtor de proposta abre sem catálogo

Rodei `aceite-vendas.ts`, que exercita os critérios de aceite do Módulo 01 contra o banco
real. Ele passa doze verificações e **interrompe no passo do catálogo**.

A causa não é o refactor: `catalogo_precos` tem **0 linhas** e nenhum dos 220
`servicos_catalogo` tem `origem_catalogo = 'oficial_stripe'`. `GET /api/catalogo-oficial`
faz `INNER JOIN` com a primeira e filtra pela segunda, então devolve zero itens.
`NovaProposta.tsx`, a tela de montar proposta, abre com o catálogo vazio.

Os itens de proposta continuam sendo criados (105 em setembro, 75 deles ligados a
serviço de catálogo), então existe outro caminho em uso — o catálogo legado, não o
oficial.

**Não é defeito de código nem bloqueio externo.** O importador existe, lê um snapshot
commitado no repo em 02/09 (21 produtos, 213 preços, ids reais do Stripe) e não chama o
Stripe. Em `--dry-run`: criaria 17 produtos e 213 preços, atualizaria 4, sem tocar nas
220 linhas do catálogo legado.

**Não executei.** Isso grava preço comercial, e decidir que aquele snapshot é a tabela
vigente é decisão do Kauã, não conclusão derivável do código. Fica nomeado no estado com
o comando pronto, e a consequência dita: enquanto não rodar, os critérios de aceite do
Módulo 01 a partir daquele passo não são verificáveis.

---

## 2026-09-21 — Cutover crítico, parte 15: lead criado na tela não tinha aquisição

Rodar `aceite-vendas.ts` de ponta a ponta (depois de fazê-lo pular o bloco do catálogo
em vez de morrer nele) destravou o achado mais grave desta rodada.

**`preVendas.criarLead` não criava a aquisição canônica.** Só a rota HTTP `POST /leads` e
o webhook do site chamavam `garantirEntradaCanonica`. As duas server actions do CRM2 —
criar lead na tela de pré-vendas e criar lead a partir da empresa — não chamavam.

O board de pré-vendas lê `aquisicoes`. Ou seja: **lead criado pela tela não aparecia no
board onde acabou de ser criado.** É o pior formato de bug, porque quem cria não
consegue nem reportar: o registro existe, a tela está certa, e o dado não se encontram.

A chamada entrou dentro de `criarLead`, que é a função por onde os quatro caminhos
passam. Guarda na função compartilhada, não em cada chamador, que é a regra que este
refactor vem aplicando.

**Em cadeia, dois defeitos estruturais apareceram junto:**

1. **A porta canônica não gravava `lead_legado_id` na aquisição**, só na proveniência. A
   leitura canônica do board devolve esse campo como o id do card, e
   `sincronizarAquisicaoDoLead` casa os dois modelos por ele. Aquisição criada em runtime
   nascia órfã: o card não abriria e nada do lead voltaria a propagar para ela. O campo
   entrou no contrato do domínio e no INSERT do repositório.

2. **`criarOportunidadeDoLead` vinculava empresa ao lead com SQL direto**, sem passar por
   `registrarEvento`, que é quem dispara a sincronização. O lead ganhava empresa e não
   aparecia na conta dele na Empresa 360. Agora sincroniza no ponto, com `await`: a
   sincronização geral é best-effort e disparada com `void`, o que serve para propagação
   de fundo, mas aqui é parte do comando que o usuário acabou de executar.

E `sincronizarAquisicaoDoLead` passou a copiar `empresa_id` (com COALESCE: o legado
preenche, nunca apaga).

**Por que nada disso apareceu medindo o banco:** os 3.989 leads e as 3.989 aquisições
vieram do backfill, já pareados. Divergência zero. Só criando um lead do zero, como o
aceite faz, o buraco aparece.

**Resíduo encontrado e limpo:** duas aquisições e 27 linhas de proveniência de execuções
anteriores que morreram no meio. A limpeza do aceite ganhou rede de segurança: aquisição
apontando para lead inexistente é sempre resíduo, independente da marca da execução.

`aceite-vendas` saiu de **interrompido com 12 verificações** para **72 passaram, 0
falharam, 3 não verificados** — os três dependem do catálogo oficial, que é decisão de
operação, e o placar diz isso em vez de contá-los como aprovados.

**Validação:** tsc limpo, **262 testes, 0 falhas**, build exit 0, bundle do worker exit 0,
21 de 21 smokes verdes, `leads` = `aquisicoes` = 3.989, zero resíduo.

---

## 2026-09-21 — Cutover crítico, parte 16: a linha do tempo não mostrava atividade

A mesma lente que achou o lead invisível, aplicada às server actions: quais escrevem
direto no banco sem passar por porta. As de Atividades escrevem em `tarefas`, que é a
casa canônica da atividade, então não cruzam fronteira nenhuma. Mas não publicam evento.

**A linha do tempo tem 346 eventos de tarefa, todos do backfill, e o mais recente é de
10/08.** Existem 463 tarefas, 119 criadas nos últimos 30 dias. Nenhuma aparecia na conta
da pessoa.

São **dez lugares** que criam tarefa, sem porta compartilhada. Pedir evento a dez
chamadores é refatoração própria, e não é o que o cutover crítico precisa agora. A
leitura passou a somar `tarefas` como QUARTA fonte da linha do tempo, pelo mesmo desenho
que já valia para `communications`.

Conferido contra duplicação, e a conferência ensinou algo: os eventos `tarefa_legado`
vieram de `atividades`, que é outra tabela. Num lead com 5 desses eventos e 2 tarefas, os
títulos não se repetem — "Oportunidade Vencida" contra "Recontato" e "Renovação de
contrato". São fatos diferentes, e o dedup por título e dois minutos fica como seguro.

Medido depois: **5 de 5 tarefas do lead aparecem na linha do tempo**, com título legível.

**Um erro meu, e a trava que o pegou.** Ao limpar proveniência órfã eu rodei um DELETE
sem filtrar `entidade_canonica`, e um id de pessoa nunca casa com um id de aquisição:
apaguei linhas de proveniência de `pessoa`. A trava de reconciliação acusou na hora — "4
pessoas sem provenance: apareceram do nada e ninguém sabe de onde".

Eram as quatro do meu smoke novo, não dado de produção: o smoke apagava pessoa só por
`lead_id_legado`, e pessoa criada pela porta canônica pode não carregar esse campo.
Corrigidos os dois: o filtro por entidade nas duas redes de segurança, e a limpeza do
smoke por nome também.

**Nona vez com a crase em comentário de SQL**, desta vez no comentário que acabei de
escrever sobre o filtro por entidade. `tsc` chegou antes da trava.

**Validação:** tsc limpo, **262 testes, 0 falhas**, build exit 0, **22 de 22 smokes**,
aceite 72/0/3, e integridade conferida: `leads` = `aquisicoes` = 3.989, 3.950 pessoas,
zero sem proveniência.

---

## 2026-09-21 — Fase 23 fechada: a gestão de tokens ganhou tela

O backend ficou pronto e validado antes, e API pública sem forma de criar credencial é
API que não existe para quem a usaria: `api_tokens` tinha 0 linhas e só era escrita por
script.

`/ajustes/api-tokens` lista, cria e revoga. As três regras do produto aparecem na tela,
não só no servidor:

- **o valor aparece uma vez**, com o aviso dito na interface, porque quem fecha sem
  copiar precisa saber que o caminho é revogar e criar outro, não procurar em algum lugar;
- **a recusa do teto é mostrada como veio**, nomeando a permissão que falta. Trocar por
  "erro ao criar" mandaria a pessoa para o suporte em vez do administrador dela;
- **o revogado continua na lista**, em cinza, com quem criou e quando foi usado. Sumir
  com a linha resolveria o acesso e destruiria a resposta para "o que essa credencial
  andou puxando".

Dois detalhes de leitura que valem: "nunca usado" é informação útil, porque token que
ninguém chama pode ser revogado sem dó; e a lista vazia explica a consequência ("sem
token, a API pública não responde a ninguém") em vez de só dizer que está vazia.

Trava estrutural liga a tela às três rotas nos dois sentidos, para nenhum dos lados
ficar órfão sem ninguém perceber. O comportamento das regras continua provado em
`smoke-gestao-tokens` e `teto-de-token.test.ts`.

**Validação:** tsc limpo, **263 testes, 0 falhas**, build exit 0 com a rota
`/ajustes/api-tokens` registrada, smoke de tokens verde.

---

## 2026-09-21 — Fase 22: as 11 rotas públicas saíram do balde

"166 rotas de escrita sem gate de permissão" era um contador com duas coisas dentro:
rota de operação, onde a autenticação é o gate, e rota pública por desenho, onde o gate
é token ou assinatura. Misturadas, **uma rota nova que esquecesse a sessão entraria sem
ninguém notar** — bastava o total ficar abaixo do teto.

Separadas: **154 exigem sessão, 11 não exigem nada**. As 11 foram lidas uma a uma, e
todas têm gate próprio:

| Rota | Gate |
|---|---|
| `apollo /webhook` | segredo de ambiente |
| `whatsapp /webhook` | assinatura + segredo |
| `auth-flow /esqueci` | sempre 200, não revela se o e-mail existe |
| `auth-flow /definir-senha` | token com prazo **e consumo de uso único** |
| `nps /:token` | token do convite |
| `fulfillment-formulario` (2) | `publicToken` do formulário |
| `propostas *-publico` (4) | UUID não enumerável, com estado e validade checados no domínio |

Duas coisas que só apareceram lendo, e que minha varredura por padrão tinha errado: o
`definir-senha` **consome** o token (`consumirToken`), então não é reutilizável — meu
regex procurava outro radical e teria reportado um falso positivo de segurança; e as
rotas públicas de proposta delegam a validação de estado e validade para
`proposta-aceite`, que é o lugar certo, então a rota parecer "só o id na URL" não
significa ausência de regra.

A trava agora exige que rota sem sessão esteja nomeada COM o gate dela, e também acusa
nome na lista que não existe mais — declaração obsoleta faz a próxima pessoa achar que
algo está coberto. Verificada com uma rota de escrita sem gate acrescentada de propósito.

**Validação:** tsc limpo, **264 testes, 0 falhas**, build exit 0.

---

## 2026-09-21 — O catálogo passou a falar com o Stripe

O Kauã mandou a planilha de catálogo e disse para não confiar nela: "depois dessa
planilha fiz alguns ajustes e tem coisas aí que saiu, ou alterei". E depois, o ponto que
mudou o desenho: "o catálogo pode ser algo que fala diretamente com o Stripe também né,
pq se não pode ser que em algum momento altere lá e não reflita no ONFACE".

Ele está certo, e o número prova.

**A medição.** Li a conta live pelo conector do Stripe e comparei com o snapshot
commitado (que é a planilha de 02/09), 19 dias depois:

| | |
|---|---|
| preços no snapshot | 213 |
| preços vivos no Stripe | **55** |
| coincidem | 42 |
| **no snapshot e já não existem no Stripe** | **171** |
| no Stripe e ausentes do snapshot | 13 |

Rodar o importador que eu tinha deixado "pronto, aguardando decisão" teria criado **171
preços fantasmas** e escondido 13 reais. A decisão que eu tinha devolvido ao Kauã era a
pergunta errada: não era "aprovar esses preços?", era "por que o catálogo é um arquivo?".

**O desenho.** `stripe-catalogo.ts` lê a API (paginada, incluindo inativos, porque preço
desativado lá precisa ser desativado aqui). `sincronizar-stripe.ts` faz o upsert por id
do Stripe. A divisão de responsabilidade é o coração: o Stripe manda no que ele cobra,
o CRM manda em ordem, comportamento de quantidade e observação operacional. O `DO UPDATE`
não toca nas colunas do CRM, e há teste que lê o SQL para garantir isso.

**O recorte** é o prefixo do nome, regra dada pelo Kauã. Os outros 41 produtos ativos do
Stripe são históricos e faturam sem ser catálogo. White Label é classificado ANTES de
Callface AI: o nome dele começa igual, e a ordem trocada classificaria todo White Label
como CALLFACE_AI — e a política de Ganho dele, que exige implantação, nunca dispararia.

**Não inventa classificação.** A família vem da metadata ou do prefixo (regra explícita).
A categoria não tem regra equivalente: sem metadata, vira pendência nomeada. Dois
produtos caem aí, e os dois são dado no Stripe, não no código: `Callface AI - Starter`
sem `familia` nem `categoria_crm`, e `Callface AI - Business` com a metadata preenchida
em colunas deslocadas (`categoria_crm="Mensal"`, `sku_interno="nao"`,
`exige_contrato="plano"`).

**Resultado medido:** 15 produtos, 55 preços. O construtor de proposta saiu de **0 para
55 itens**. O aceite do Módulo 01 saiu de **72 passaram com 3 não verificados** para
**97 passaram, 0 falharam, 0 não verificados** — o catálogo destravou 25 critérios.

Dois produtos já existiam no legado com o mesmo `stripe_product_id` e foram
reclassificados em vez de duplicados; as 220 linhas legadas não perderam nenhuma.

**Roda de hora em hora no worker.** Sem chave configurada, o job sai em silêncio:
ambiente sem Stripe não é integração quebrada.

**O importador antigo foi desarmado**, não só documentado: ele recusa rodar e aponta o
comando novo. Aviso em log some; o estrago aqui seria preço errado numa proposta.

**Dois gotchas conhecidos apareceram e foram evitados:** `ON CONFLICT` contra
`idx_servicos_catalogo_stripe_product`, que é índice PARCIAL e exige repetir o predicado;
e array interpolado no template do postgres.js, que vira `record` e falha com 42846 —
resolvido passando JSON e expandindo com `jsonb_array_elements_text`.

**Validação:** tsc limpo, **273 testes, 0 falhas**, build exit 0, bundle do worker exit 0,
**23 de 23 smokes**, aceite 97/0, paridade 13/14.

---

## 2026-09-21 — As duas pendências de metadata corrigidas no Stripe

O Kauã pediu para eu corrigir direto, já que tenho acesso. Foram escritas de metadata na
conta live, e só isso: nenhum preço, nome, descrição ou situação foi tocado.

**`Callface AI - Starter`** tinha só `SKU_INTERNO`, em maiúsculo e fora do padrão dos
outros. Ganhou os sete campos (`familia`, `categoria_crm`, `destino_pos_venda`,
`exige_contrato`, `modelo_cobranca`, `tipo_receita`, `sku_interno`) e a chave maiúscula
foi removida.

**`Callface AI - Business`** tinha os valores deslocados uma posição:
`categoria_crm="Mensal"` (que é período), `exige_contrato="plano"` (que é categoria),
`sku_interno="nao"` (que é exige_contrato) — e `tipo_receita` faltando por completo. O
padrão de deslocamento é o que permitiu reconstruir: cada valor pertencia ao campo
anterior.

Os valores vieram do padrão dos produtos irmãos, `Full` e `Pro`, que são planos Callface
AI do mesmo tipo. Não de semelhança de nome.

Depois: **zero produtos sem categoria** no catálogo oficial, e a sincronização não
reporta mais nenhuma pendência.

**A fixture do smoke foi atualizada**, e vale dizer por quê: ela é um retrato do Stripe,
e o Stripe mudou. Manter o retrato antigo para o teste continuar tendo assunto seria
exatamente o problema que este trabalho inteiro veio resolver. A detecção de metadata
quebrada segue testada com dado inline, que é onde ela deve morar.

**Quatro preços NÃO foram nomeados, de propósito.** `Callface AI - Starter` tem dois
avulsos de R$ 89,90, um deles com `transform_quantity` dividindo por 5; `Pacote 500
Minutos` tem um avulso de R$ 105,00 e outro de R$ 99,90 dividindo por 15. Sem apelido,
cada par aparece na tela com o mesmo rótulo e preços diferentes. Escrever um nome ali
seria inventar regra comercial, e a pergunta ficou registrada para o Kauã.

**Validação:** tsc limpo, **273 testes, 0 falhas**, build exit 0, aceite 97/0, smoke do
catálogo com zero pendências.

---

## 2026-09-21 — Fase 25: a pergunta que nenhum teste fazia

Board e detalhe tinham teste. Escrita tinha teste. Ninguém perguntava: **depois de a
tela executar a ação, a mesma tela mostra o resultado?** `smoke-tela-escreve-tela-le`
chama a MESMA função que a server action chama e relê pela MESMA consulta que a página
usa. Na primeira execução, o board dizia "novo" enquanto o detalhe dizia "em_contato".

**A causa.** `moverEtapa` escrevia `leads.estagio_pre_vendas`; o board lê `aquisicoes`,
onde a etapa era **derivada** de fatos — `last_touch_at > first_touch_at` virava "em
contato". Mover um card não é um fato de toque, então a derivação não via nada e o card
voltava para Novo. Sem erro, sem jeito de reportar.

A SPEC §8.2 já dizia onde a etapa mora: `pipelines` + `pipeline_etapas`, com
`aquisicoes.etapa_id` apontando. As duas colunas existiam e estavam em **0 de 3.989**.

Migration 0081 cria o pipeline de aquisição com 7 etapas e materializa em `etapa_id`
exatamente o que o board já mostrava: **2.919 novo, 531 em contato, 539 oportunidade**.
Nenhum card mudou de coluna. `updated_at` não foi tocado, pela lição do backfill que
bumpou 216 leads e fez o board mostrar "17min" em tudo.

**Onde ligar.** `registrarMudancaDeEtapa` — por onde já passavam mover, qualificar,
nutrir, desqualificar e reativar. Ligar em cada comando seria a mesma regra escrita
cinco vezes, que é como as duas verdades nasceram.

**Duas cópias do mesmo CASE.** O card e o total da coluna tinham a derivação escrita
duas vezes, em consultas diferentes. Corrigir só uma faria total e cards discordarem
dentro da mesma tela. Viraram uma expressão só.

### Os dois escritores que o inventário chamava de "atualizam, não criam"

Foi onde estava o resto.

**Cadência não chegava ao board.** `cadencia.ts` tem **zero** chamadas à porta canônica
no arquivo inteiro. Escrevia `leads.last_contact_at` e `sdr_status`, e o card continuava
em Novo. Os dois toques passaram por `registrarPrimeiroContato`.

**Atribuição nascia sem aquisição.** `registrarTouchpoint` gravava pessoa, empresa e
lead legado, e deixava `aquisicao_id` NULO. Os 1.583 pontos de contato existentes tinham
o vínculo porque o BACKFILL preencheu — medir o banco dava 100% e não acusava nada. Só
criar um lead pela tela e reler a atribuição mostrava o buraco. **Terceira vez que esse
padrão aparece nesta refatoração.** Resolvido dentro da função, a partir do lead legado.

**Leitura de detalhe.** Atribuição saiu de `leads` para `pontos_contato` (SPEC §8.3).
Medido campo a campo antes de trocar: campaign 1.428, medium 1.490, content 1.278, term
1.251, e **zero só de um lado**. Nutrição e desqualificação leem o estado de
`aquisicoes`.

**Validação:** tsc limpo, 276 testes 0 falhas, build exit 0, 25/25 smokes,
`smoke-tela-escreve-tela-le` 30/30, aceite de vendas 97/0, zero resíduo.

---

## 2026-09-21 — Fase 26: as semânticas que não tinham dono

Cinco fatos de condução da venda viviam em coluna do negócio, sem casa canônica.

**Próxima ação.** `negocios.proxima_acao` está vazia em **1.562 de 1.562**. O efeito
visível: o selo "Sem próxima ação" aparecia em TODO card aberto, inclusive nos que
tinham tarefa marcada — o selo olhava a coluna, a fila do vendedor olhava `tarefas`.
Virou Task (SPEC §23), uma por oportunidade via `chave_idempotencia`; limpar declina em
vez de apagar, que preserva o rastro de que alguém combinou e desmarcou. O selo caiu de
**527 para 523** dos 527 abertos — o número baixo é a verdade, não o bug.

**No-show.** `no_show_em` preenchido nos mesmos 38 registros em que `status = 'no_show'`.
Cópia do status legado, escrita por nenhum código de runtime. Enquanto isso
`reunioes.status` tinha só `agendada` e `cancelada` em 295 linhas: a reunião a que o
cliente faltou continuava agendada para sempre. Uma auditoria anterior já tinha
tropeçado nisso ("realizadas era sempre 0, ninguém atualiza `reunioes.status`") e
contornado contando eventos.

A migration 0082 moveu 34 dos 38. **A primeira versão dela sobrescreveu dois que já
estavam `cancelada`** — cancelar antes e não aparecer são fatos diferentes. Restaurados
do `pre-refactor-20260920.dump` e o filtro entrou na migration. Os 4 restantes ficam
como reconciliação nomeada.

O negócio continua NÃO virando perdido: fica na coluna e o lead volta para pré-vendas.

**Trial.** `iniciarTrial` gravava sem gate nenhum — PABX e White Label, que são venda
por contrato com implantação, podiam entrar em "trial". A capacidade foi para a oferta
(`permite_trial`), e o valor inicial **não é palpite**: o pipeline de vendas do Callface
AI tem a etapa `trial`, o do PABX não tem. Quem configurou aqueles pipelines já disse
quais produtos têm trial. Os 17 trials históricos não serviram de evidência porque 16
deles não têm família comercial nenhuma. `trial_encerrado_em` está em 0 de 1.562: no
modelo atual um trial começa e nunca termina, e isso foi copiado como está.

**Estagnação.** `motivo_estagnacao` é IDÊNTICO a `negocios.status` nos 227 registros.
Não torna o dado inventado — `outra_data`, `sem_retorno`, `trava_negociacao` e
`trava_assinatura` são motivos que alguém registrou; o vocabulário legado é que guardava
motivo e posição na mesma coluna. Os 227 estão todos em oportunidade aberta.

`marcarEstagnacao`, `iniciarTrial` e `encerrarTrial` não chamavam o espelho: a escrita
ficava só no legado e o canônico só descobria por acaso, na próxima mudança de etapa.

**Propostas.** Detalhe e board casam por `oportunidade_id` com `negocio_id` como
fallback. Registrado sem palpite: **455 propostas apontam só para um lead**, sem negócio
nem oportunidade, e **81 delas estão ACEITAS**.

**Cliente.** SPEC §16.3 é literal: "Do not model one absolute `empresa.status =
CLIENTE`". `leads.tipo` só era atualizado ao mexer num contrato por uma rota específica;
todo outro caminho deixava a marca envelhecer. Medido: **287 marcados, 300 com contrato
ativo, 111 marcados sem contrato, 124 com contrato e não marcados**. O filtro "Clientes"
perdia 124 clientes de verdade. Passou a derivar (contrato ativo OU marca) — união e não
substituição, de propósito: ninguém some da tela, e os 111 ficam como reconciliação.

### Duas armadilhas do próprio método

**Crase em comentário de SQL, décima vez.** Escrevendo o comentário que explicava a
leitura canônica de atribuição, citei nomes de coluna entre crases dentro de um template
`sql`. O erro sai como `TS1005` sem mencionar SQL.

**Smoke que dependia do relógio.** `smoke-catalogo-stripe` verificava reclassificação com
`created_at < now() - interval '1 hour'`. Uma hora depois da primeira sincronização os 15
produtos viraram "antigos" e o smoke passou a falhar sozinho, sem nada ter mudado.
Trocado pela invariante real: sincronizar de novo não cria linha.

**Validação:** tsc limpo, **276 testes 0 falhas**, build exit 0, **25/25 smokes**,
aceite de vendas **97/0**, paridade **13/14** (NEXO, credencial de provedor), migrations
em dia, zero resíduo de smoke no banco.

---

## 2026-09-21 — Conclusão do ONFACE: CP1 a CP3

Começou o trabalho de convergir o produto ao Documento Mestre v0.13. A regra que
o Kauã impôs e que mudou o tamanho de dois checkpoints: **auditar antes de
construir**. Os dois casos em que ela valeu:

**Implantação.** "0 fulfillments IMPLEMENTATION" parecia ausência de jornada.
Não era: o runtime cria e o smoke prova. Os 200 serviços PABX/White Label sem
implantação são históricos do backfill, que nunca passaram pelo Won canônico. O
que a auditoria achou foi outra coisa, e mais séria: o comando canônico criava
ONBOARDING e IMPLEMENTATION no mesmo instante do ganho, contra o §06.1
("Implantação não nasce automaticamente no Won"). Criada ali, a jornada técnica
nascia sem kickoff, sem material e sem implantador — os três que o Módulo 05
exige como porta de entrada dela.

**CS Health.** `cs_health_snapshots = 0` parecia motor inexistente. O motor
estava vivo: 514 riscos reais calculados, job `cs-sweep` agendado, painel
lendo, 3.353 linhas em `lib/cs`. Faltava só o score e a materialização. O
checkpoint encolheu de "construir CS Health" para "calcular e gravar no sweep
que já roda".

### O que o Metric Catalog encontrou

A palavra MRR saía de **oito** expressões no repositório. Quatro fontes
distintas, medidas no banco real:

    negocios.mrr_fechado (ganhos) ................ R$ 497.904,42
    servicos_canonicos.current_recurring_value ... R$ 426.619,39
    assinaturas.mrr .............................. R$  61.769,55
    mrr_movimentos (deltas) ...................... R$  81.308,35

Oito vezes de diferença entre a maior e a menor. Não eram erros de soma: eram
conceitos diferentes com o mesmo nome — booking acumulado, recorrente atual, o
que está no Stripe (o PABX legado não está) e o livro de movimentos.

A convergência não foi declarada, foi feita: o KPI global do Command Center e o
de `lib/cs/metricas.ts` passaram a chamar `medir(org, "mrr_atual")`. As
agregações por empresa continuam — é outra granularidade — mas ganharam o filtro
de ciclo de vida que faltava, sem o qual um serviço CHURNED somava no MRR da
conta.

A definição canônica adotou `portfolio_included`, que a tela operacional já
usava. A diferença de R$ 1.000 entre as duas era UM serviço de família UNKNOWN
marcado fora do portfólio. Adotar a decisão já registrada no dado é diferente de
inventar uma terceira definição.

### Erro próprio, corrigido

O `smoke-meta-lead-ads` aninhava a limpeza da pessoa dentro do if da aquisição.
O caso comum é o outro: o lead da Meta cai numa aquisição que já existe E cria
pessoa nova. Uma pessoa ficou para trás e o teste de reconciliação a encontrou
como "apareceu do nada". A limpeza passou a decidir a pessoa por contagem
própria, com rede de segurança para pessoa sem proveniência.

**Validação:** tsc limpo, **286 testes 0 falhas**, build exit 0, **27/27 smokes**,
zero resíduo no banco.

## 2026-09-21 — Conclusão do ONFACE: CP4 a CP6

### CP4 — o convite que ficava de pé

Criar e cancelar evento externo existiam. **Atualizar nunca existiu.** Reagendar
uma reunião mudava a data no ONFACE e deixava o convite antigo na agenda do
cliente, sem aviso. Cinco caminhos chamavam o Graph direto, e o helper que
existia para deduplicar três deles terminou **sem nenhum chamador** — o defeito
recorrente deste repo em uma frase.

`CalendarProvider` abstrai Microsoft Graph e Google Calendar atrás de
create/update/cancel. A ponte `COALESCE(r.calendar_event_id,
r.outlook_event_id)` impede que reagendar uma reunião criada pelas rotas antigas
crie um **segundo** convite. Quatro rotas antigas continuam chamando o Graph
direto: são conhecidas, funcionam, e converter é trabalho da substituição. O
teste arquitetural impede o **quinto** aparecer.

### CP5 — a terceira cópia da regra de tag que não nasceu

`adicionar/removerTag` estava escrito duas vezes. Escrever a ação em massa por
fora faria a terceira, e duas cópias da mesma regra divergem em silêncio.
Consolidado em `lib/crm/tags.ts` antes de construir qualquer coisa em cima.

As ações em massa devolvem desfecho por registro. A regra que decidiu o desenho
inteiro está no §9.5: "nunca falhar silenciosamente por causa de um registro sem
telefone válido". Reaplicar uma tag reporta 0 aplicados e 3 ignorados — não
mente que trabalhou, e não publica evento em no-op (senão a automação dispara de
novo a cada reexecução de cadência).

### CP6 — Ganho e Perdido voltaram para a mesma linha

O board do Pipeline tinha a mesma doença das abas de Pré-vendas, do outro lado
do funil. As seis colunas passaram a viver juntas, com as fechadas colapsadas
via `<details>` nativo — o navegador já sabe abrir e fechar, e teclado e leitor
de tela vêm de graça.

Colunas fechadas nascem com `aceitaDrop: false`. Não é detalhe de UI: Ganho
nunca é alcançado arrastando, e perda exige motivo.

O checklist de fechamento explica a regra da oferta sem decidir nada. A decisão
continua em `avaliarGanho`. O caso que prova a diferença: das 4 oportunidades
ganhas com `CALLFACE_AI_CONTRACT`, todas mostram "Pagamento: pendente — esta
oferta fecha na assinatura, e a cobrança segue no Financeiro". Uma tela que
decidisse sozinha teria chamado isso de erro.

### Falso negativo próprio

A primeira medição de `/pipeline/<id>` disse que o checklist não renderizava,
com o dado presente no payload RSC. Não era o código: o servidor em pé servia
chunk antigo. Rebuild e nova medição mostraram as três linhas. Registrado porque
a conclusão errada seria "o componente não funciona" e o conserto seria em cima
de código que já estava certo.

**Validação:** tsc limpo, **291 testes 0 falhas**, build exit 0, **29/29
smokes**, rotas `/pipeline` e `/pipeline/<id>` conferidas contra build de
produção com dado real.

## 2026-09-21 — CP7: o Financeiro estava somando quatro coisas diferentes

O módulo não faltava. Estava errado de um jeito que nenhum teste perguntava.

A medição que abriu o caso foi simples: comparar as quatro métricas canônicas do
catálogo (CP2) com o que as leituras do Financeiro devolviam. `mrr_atual` batia.
`recebido` divergia em R$ 2.308,80. Puxando o fio:

- **R$ 368.049,69 de PABX reportados como Callface AI.** O filtro de produto
  olhava `contratos.produto`, coluna que é NULL em 263 dos 598 contratos ativos
  e **nunca** vale `'pabx'`. A aba PABX mostrava zero em tudo; a aba AI mostrava
  a empresa inteira. A quebra real mora em `servicos_canonicos.service_family`.
- **R$ 2.308,80 de caixa que nunca entrou.** Dez faturas do Stripe marcadas
  `paga`, sem pagamento nenhum e sem `amount_paid`/`charge` no `raw`. Somar o
  valor de face de fatura paga não é caixa: é billing quitado.
- **Denominador de inadimplência errado.** 7,3% na aba de Callface AI porque
  dividia pelos 598 contratos da empresa. O número real do segmento é 16,4%.

Nenhum desses casos de reconciliação foi resolvido por palpite. As 10 faturas
continuam como estão, agora visíveis na tela em campo próprio.

A quarta cópia das definições, em `api/financeiro/inadimplencia`, foi apagada em
favor de `getFluxoMes`. Mesmo movimento do CP5 com a tag: consolidar antes de
construir em cima.

**Validação:** tsc limpo, **293 testes 0 falhas**, build exit 0, **29/29
smokes**, as duas rotas conferidas nos três produtos contra build de produção.

## 2026-09-21 — CP8: auditar primeiro salvou a entrega de ser reescrita

O plano dizia "board universal + 6 fases". A auditoria mostrou que o módulo já
tinha 5 tabelas, 25 fulfillments reais, 1.659 itens e checklists derivados de
processos reais — e que as "6 fases universais" seriam um erro já cometido.

O próprio código registra: a primeira versão comprimiu a jornada de Callface AI
em 4 fases genéricas e o Kauã reprovou como "muito simplório"; o guia real tem
10 marcos. Universalizar o vocabulário repetiria isso. O que virou universal foi
o board; cada card responde na língua do processo dele.

Os três buracos reais eram ligações que faltavam:

- **White Label voltava fase e etapa nulas** com um comentário dizendo que não
  havia registro real — havia, com checklist preenchido. Os itens dele nem eram
  carregados na rota.
- **O board das três famílias não tinha chamador.** O comentário no componente
  dizia "uso interno, não mais linkado nos tabs do módulo". Peça pronta sem
  caller, de novo, custando ver a entrega do produto errado.
- **O mapa de marcos estava duplicado na tela**, porque o original mora num
  arquivo que importa `db` e Client Component não pode importá-lo. Movido para o
  módulo puro.

O teste de cobertura mapa × checklist achou um defeito próprio na primeira
execução: `conclusao` ficou sem fase, e uma entrega esperando só o handoff do CS
apareceria em "Planejamento".

**Validação:** tsc limpo, **297 testes 0 falhas**, build exit 0, **29/29
smokes**, rota conferida com dado real.

## 2026-09-21 — CP9 e CP10, com QA de rotas

### CP9 — o contador que não levava a lugar nenhum

`boardPipeline` já devolvia `semProximaAcao` e a tela já mostrava "527 sem
próxima ação". Não havia filtro, rota nem lista: o operador via o problema e
não tinha para onde ir.

527 de 527 oportunidades abertas estão sem próximo passo. Não é atraso do time,
é mecanismo que nunca disparou. A fila derivada soma 928 loops em 527
oportunidades e R$ 477.191,68 parados, com uma proposta de R$ 33.930,00
esperando resposta há 11 dias e outra de R$ 9.251,80 há 61.

Nada cria próxima ação: inventar follow-up para 527 oportunidades seria fabricar
combinado que ninguém fez.

Junto veio a mesma duplicação do CP6, noutro lugar: as condições de filtro do
board estavam escritas duas vezes (cards e totais), e filtro aplicado num lado
só faz a coluna mostrar N cards enquanto o cabeçalho anuncia outro número.

### CP10 — uma conclusão minha corrigida pela auditoria

Eu tinha concluído que `executeAgent` não tinha chamador. Tem: o worker o chama
por import dinâmico relativo dentro de `handleAiSdrResponse`, e uma varredura
textual não acha porque o caminho do import é o mesmo texto que se filtra.

O defeito real era outro e pior: o gate de publicação não conferia credencial.
Publicar o NEXO passaria nas quatro checagens e falharia na primeira mensagem
do cliente, sem cair no legado (cair duplicaria a resposta). O contato
escreveria e ninguém responderia.

### Um erro próprio, no teste e não no código

O primeiro bloco de smoke do CP9 acusou três falhas. Não era o filtro: um bloco
anterior do mesmo smoke já define próxima ação naquela oportunidade, então ela
chegava com o loop fechado. A premissa do teste estava errada, e corrigi-la
deixou o teste melhor — agora ele abre o loop, confere que aparece, fecha e
confere que some.

**Validação:** tsc limpo, **300 testes 0 falhas**, build exit 0, **29/29
smokes**, e QA das 19 rotas do módulo contra build de produção: todas 200, com
o único 307 sendo o redirect documentado de `/negocios` para `/pipeline`.

## 2026-09-21 — CP14: auditoria das portas, e o SPEC que não existe

Duas descobertas antes do trabalho.

**O `ONFACE-ARCHITECTURE-SPEC.md` não existe.** O `refactor-state.md` o citava
como fonte normativa do TO-BE; ele não está no repositório nem no vault. A ordem
vigente é a do HUB do ONFACE no vault. Drift corrigido no cabeçalho do estado.

**O menu não está errado.** A suspeita de que apontar para `/onface-preview/*`
fosse defeito não se sustentou: o HUB registra que `/onface-preview` **é** o
produto e `(crm2)` é onde a tela mora. Cinco dessas rotas são espelhos com par
oficial; duas (`atividades`, `visao-geral`) são a implementação real. Verificar
antes evitou "consertar" na direção errada.

**O defeito real era um bump.** `rd-criativo` preenchia UTM e resetava
`updated_at` junto. Como o board de Pré-vendas ordena por esse campo, rodar a
rotina jogaria 2.006 leads parados para o topo. É a terceira aparição desse
defeito no projeto.

A trava criada não proíbe bumpar, exige justificativa: `callface.ts` (ligação
atendida) e `stripe-sync.ts` (muda status junto) estão na lista e continuam
bumpando, porque neles é fato real.

**Validação:** tsc limpo, **310 testes 0 falhas**, **29/29 smokes**.

## 2026-09-21 — CP15: o backfill da virada apagava o histórico do board

Mesma lente do CP14, agora em `oportunidades`. A porta de escrita está fechada;
o problema estava nos backfills, que rodam na virada sobre a base inteira.

A prova ficou visível ao comparar dois grupos no mesmo banco: as 401
oportunidades abertas sem família têm `updated_at` espalhado de 09/02 a 21/09; as
126 com família têm todas a mesma data, a de hoje, que é quando o backfill 08
rodou. Em produção seriam 477 de uma vez.

Revertido a partir de `negocios.updated_at`, que não foi contaminado (125 das
126 divergiam). Efeito medido na fila de loops: **324 → 392 paradas há mais de
14 dias**. Havia 68 escondidas.

A trava foi verificada por reintrodução: com o defeito de volta ela falha, sem
ele passa. Teste que não falha com o defeito não é teste.

**Validação:** tsc limpo, **311 testes 0 falhas**, **29/29 smokes**.

## 2026-09-21 — CP16: fechando a varredura do relógio de trabalho

25 arquivos bumpam `updated_at` nas quatro tabelas que governam board. Abrir um
a um mostrou que a maioria está certa: mover etapa, processar mensagem,
registrar toque, ligação atendida. São fatos reais.

Dois que pareciam defeito não eram. O scoring bumpa, mas só roda depois de
criação ou edição real do lead, então o relógio já tinha sido resetado pelo fato
de verdade. O bundle muda id e título juntos, o que é alguém agrupando.

Um era, de impacto baixo, e foi corrigido pela regra e não pelo risco:
`backfill-valor-negocios` bumpava ao preencher `mrr_fechado`.

Ele expôs um buraco na própria trava do CP15, que olhava só a pasta
`scripts/backfill/`. Agora cobre backfill solto em `scripts/` também, verificado
por reintrodução nos dois lugares.

**Validação:** tsc limpo, **311 testes 0 falhas**, **29/29 smokes**.

## 2026-09-21 — CP17: o lead do formulário andava no legado e parava na tela

Seis arquivos movem `negocios.status`. Três são a porta. Dos três de fora, dois
já propagavam para o canônico e diziam isso no código.

O terceiro era o worker, no caminho do formulário do site. A IA gera o insumo, o
worker move o negócio, registra em `status_changes`, e a oportunidade canônica
fica para trás — com o board lendo `oportunidades.etapa`, a tela não mexe.

A divergência no banco era zero, porque os 24 negócios naquele status vieram do
backfill e não desse caminho. Zero de divergência hoje não absolve defeito
latente: ele aparece em produção, no primeiro formulário preenchido.

**Validação:** tsc limpo, **313 testes 0 falhas**, **29/29 smokes**.

## 2026-09-21 — CP20: Risco / Churn, a tela que esperava uma dependência já resolvida

Onze telas do menu estão marcadas `pendente: true`. Cada uma vale a pergunta: a
dependência que trava ainda existe?

Em Risco / Churn não existia mais. O placeholder pedia "definir o que conta como
sinal de risco" e "separar churn involuntário do voluntário", e as duas coisas
estavam prontas havia dias: 491 riscos abertos calculados por `lib/cs/riscos`, e
o tipo do risco já separando as naturezas.

A tela agrupa por quem resolve, não só por gravidade. Numa lista única o time
ataca as 249 contas de "sem próxima ação" e não vê as 15 críticas com
R$ 22.915,90 prestes a cair por cobrança.

O MRR vem quebrado por severidade de propósito: somar tudo daria a carteira
inteira, porque quase toda conta tem algum risco de atenção aberto.

**Validação:** tsc limpo, **319 testes 0 falhas**, **29/29 smokes**, tela
conferida no navegador com filtro funcionando (273 → 24 no recorte de cobrança).

## 2026-09-21 — CP21: implantação por família, consolidada em vez de triplicada

As três rotas traziam a mesma dependência: "falta definir as etapas próprias
dessa família". As três foram definidas no CP8.

Não viraram tela nova. O board já aceita `familiaFixa` e já desenha a fase de
cada família; três telas seriam o terceiro caminho que a arquitetura manda
evitar.

O par CP20/CP21 deixou um aprendizado: das quatro telas destravadas, todas as
quatro listavam dependência já resolvida por outro checkpoint, dias antes. A
dependência escrita num placeholder envelhece, e ninguém volta para reler.

Restam 7 telas pendentes, e as 7 esperam decisão de produto, não trabalho
técnico.

**Validação:** tsc limpo, **319 testes 0 falhas**, build exit 0, **29/29 smokes**.

## 2026-09-21 — CP22: o SDR estava desligado por nome de variável

A auditoria de 09/08 pegou este defeito e corrigiu a biblioteca, com ADR. Os
quatro chamadores ficaram para trás por mais de um mês.

Três gates no worker liam `OPENAI_API_KEY`, ausente neste ambiente, e passavam
o valor adiante como `groqApiKey` para uma lib que chama api.groq.com. O SDR era
pulado com "Sem OPENAI_API_KEY" enquanto a chave Groq estava no ambiente.

Uma rota chamava api.openai.com aceitando a chave Groq como credencial, o que
volta 401, com modelo padrão `gpt-4o-mini` que não existe na Groq.

Corrigir a biblioteca e esquecer quem a chama é o defeito recorrente deste repo
pelo avesso.

**Validação:** tsc limpo, **322 testes 0 falhas**, **29/29 smokes**.

## 2026-09-21 — CP23: o Insight Engine existia inteiro e nunca foi ligado

77 exports de lib sem chamador. A maioria não é buraco; a filtragem foi por
"tem dado no banco esperando", e sobraram duas metades da mesma feature:
`gerarInsights` e `getMetasPorVendedor` encaixam campo a campo e tinham zero
chamadores as duas.

Ligadas, geravam zero. A agregada de metas devolvia R$ 50.000,00 e a
por-vendedor devolvia zero para as MESMAS duas closers: as 9 metas cadastradas
são do tipo aposentado `mrr_fechado`, e só a agregada tinha o fallback de tipo
legado — com comentário explicando por que ele existia.

Mesmo padrão do CP22: a correção foi aplicada numa leitura e não na irmã.

**Validação:** tsc limpo, **324 testes 0 falhas**, **29/29 smokes**, tela
conferida no navegador.

## 2026-09-21 — CP24: o MRR duplicado cresce, e a prova está na descrição

Investigação de dois exports sem chamador que NÃO virou código: a ferramenta, o
relatório e a tela de duplicidade existem e funcionam em 0,2s.

O que rendeu foi um número datado. O MRR em excesso saiu de R$ 17.449,30 (08/08)
para R$ 24.205,50 (14/09) e está em R$ 31.840,60 hoje.

A causa raiz foi corrigida em `syncStripe` no commit f17c961, de 09/08, e os
duplicados continuam nascendo — o último par é de 18/09. A prova de por quê está
na descrição: cada par traz "Gerado da proposta #P-XXXX-v1", string que o commit
63dcd5c removeu do código em 16/08.

Contrato criado em 18/09 com uma string apagada do código em 16/08 confirma o
que o HUB já registra: o deploy é rsync, não git, e produção roda outro código.

Para a decisão da virada: o passivo cresce ~R$ 7 mil de MRR inflado por mês, e
para no dia da virada, porque o caminho duplicador não existe mais aqui.

## 2026-09-22 — CP25: a jornada de CS estava desligada por falta de um caminho em lote

`semearJornadaEmLote` existia desde 08/09 sem nenhuma rota. A única porta era
uma conta por clique, e com 275 contas ninguém clicou 275 vezes: `cs_marcos`
vazia, 0 de 275 com jornada, e o sweep processando nada.

A rota nova simula por padrão e só grava com `{ aplicar: true }`, porque semear
a carteira é decisão de operação.

**Erro meu, registrado:** a primeira versão do smoke chamou `aplicar: true` sem
limite e semeou 1.932 marcos em 276 contas reais. Revertido, e a reversão por
janela de tempo não bastou — `iniciarJornadaCs` grava `jornada_iniciada_em` com
data retroativa, não `now()`. O smoke passou a exercer o lote numa empresa
própria e ganhou a verificação que faltava: nenhum marco fora da conta de teste.

Três fios fechados sem código no caminho: os ganhos sem contrato são históricos
ou de oferta que não exige; não há duas políticas de Won; e a tela de
duplicidade não tem buraco.

## 2026-09-22 — CP26: o smoke que quebrou sozinho à meia-noite

`smoke-cs-health` falhou dizendo "gravou 550 snapshot(s) (antes 275)". O produto
estava certo: 275 de 21/09 e 275 de 22/09, um por conta por dia, que é o
desenho. O smoke afirmava que o total da tabela é igual ao número de contas, o
que só vale no primeiro dia.

Segunda aparição do defeito: `smoke-catalogo-stripe` usava
`created_at < now() - interval '1 hour'` e passou a falhar uma hora depois da
primeira sincronização.

Afirmação dependente de relógio mente nos dois sentidos, e o invariante certo
aqui é por dia: um snapshot por conta hoje, reexecução atualiza em vez de
empilhar, histórico preservado.

## 2026-09-22 — CP27: uma rota atravessava a fronteira entre organizações

Varredura de RBAC nas 217 rotas de escrita. A primeira passagem acusou 176 sem
gate e estava errada — não reconhecia `getSuperCtx`. Corrigido o padrão, o
resultado bate com a decisão da fase 22.

A lente que achou o problema foi outra: rota autenticada que escreve **sem usar
o contexto**. Seis casos, cinco legítimos (super admin e perfil). O sexto era
real: `PATCH /email/sequencias/execucoes/:id` obtinha `ctx` e descartava, e o
`where` usava só o id. Qualquer usuário autenticado de qualquer organização
podia pausar, retomar ou cancelar a execução de sequência de outra.

Isolamento pela sequência, que é a âncora que as outras rotas do arquivo já
usavam. Resposta 404 e não 403: dizer "existe, mas não é sua" confirmaria o id.

Verificado por reintrodução: com o código antigo o smoke pega HTTP 200 e a
escrita na execução da vizinha.

## 2026-09-22 — CP28: reentrega da Meta duplicava o staging

Dos quatro webhooks que inserem, três tinham marca de idempotência. O de
`meta-lead-ids` não, e a tabela só tinha PK no id.

O risco estava materializado: ao criar o índice único, a migration removeu 18
linhas duplicadas de 576, para 558 `fb_lead_id` distintos.

Erro meu, corrigido antes do commit: escrevi na migration que a tabela estava
vazia, confundindo com `meta_capi_entregas`. O `DELETE 18` desmentiu e o
comentário foi reescrito com o fato medido.

O índice sozinho teria criado um modo de falha novo — webhook respondendo erro
na reentrega é o que faz a Meta reentregar mais. Por isso o `onConflictDoNothing`
entrou no mesmo passo.

## 2026-09-22 — CP29: idempotência auditada, e a segunda prova sobre produção

Varredura dos jobs de fila. Meu padrão de regex acusou seis sem marca e estava
errado — regex sobre corpo de função vaza entre blocos. A medição no banco não.

No dado: 0 chaves repetidas no outbox, 0 duplicatas de WhatsApp, 4.938 de 4.938
ligações com chave. As 96 atividades idênticas no mesmo minuto pediam olho, e as
de ligação apontavam para 42 ligações DISTINTAS — chamadas reais, não reentrega.

A duplicação real era "Link de pagamento gerado" gravado duas vezes para a mesma
proposta. Essa string não existe no código desde 16/08, commit 63dcd5c — o mesmo
do CP24. Segunda evidência independente, com data, de que produção roda código
anterior a esta branch.

Nada a corrigir aqui: o caminho já não existe, e o passivo para na virada.

## 2026-09-22 — CP30: o procedimento parava numa migration que não é a última

O passo 6 dizia "resto da cadeia, 0013 a 0086" e a cadeia vai até 0090. Ao pé da
letra, a virada deixaria de fora metric_catalog, cs_health_snapshots,
calendar_provider e o índice do staging da Meta.

O script nunca teve o teto: `ensaio-carga.sh` chama `migrar.ts` sem `--ate`. Era
drift do documento, não da execução — mas número fixo num procedimento envelhece
a cada migration nova.

A trava acusou 0073 a 0077 também, e ali ela exagerou: estavam documentadas numa
linha agregada que o padrão não reconhecia. Foram abertas em linhas próprias
porque a agregada as descrevia mal.

## 2026-09-22 — CP31: o primeiro teste de reaplicação não testava nada

O procedimento corrigido no CP30 só vale se a cadeia aguentar reexecução. As 35
migrations de 0056 em diante reaplicam sem erro, em ~2s, verificado por execução.

A primeira versão do teste rodava cada migration uma vez dentro de
BEGIN/ROLLBACK. Com o rollback, a segunda execução nunca via a primeira: uma
migration deliberadamente quebrada passou. Só a verificação por reintrodução
mostrou isso.

Corrigido para aplicar o corpo duas vezes na mesma transação — é a segunda que
encontra o estado da primeira.

Teste que não falha com o defeito não é teste, e a única forma de saber é
reintroduzir o defeito de propósito.

## 2026-09-22 — CP32: o aceite que a virada exige estava quebrado

Tentei refazer o ensaio de carga e bati num bloqueio legítimo: nenhum dump nem
banco local representa produção virgem. O dump pré-refactor carrega
`_carga_contagem_antes` e o banco pre_carga já tem `oportunidades`. Ensaio real
exige dump fresco, e isso é acesso a produção.

A tentativa rendeu outra coisa. Ao rodar os aceites do passo 9,
`aceite-contrato-assinado` falhava: criava o negócio sem família comercial, e a
regra que exige família antes da proposta entrou depois dele.

Ninguém viu porque **nada roda os aceites** — nem script, nem package.json, nem
CI. O procedimento dizia "o aceite de vendas", no singular. Um aceite quebrado só
apareceria no domingo da virada.

Criado `scripts/rodar-aceites.sh`, chamado pelo passo 9. Os quatro somam 208
asserções, 0 falhas.

## 2026-09-22 — CP33: os dois validadores da virada também não rodavam

A lente do CP32 aplicada ao resto do passo 9. O passo pede "a validação de
paridade, TODOS os aceites e os smokes", e nem `validacao-paridade` nem
`validar-catalogo-oficial` eram chamados por nada — zero referências em
`package.json`, em script, em CI.

Rodados à mão: paridade passa (13/14, o não verificável é o NEXO por credencial);
o de catálogo morria com `TypeError: Cannot read properties of undefined
(reading 'lk')` na linha 171, indexando `[0]` de uma consulta vazia, e as seções
3, 4 e 5 nunca rodavam.

Três defeitos no mesmo script, todos de envelhecimento sem caller:

1. `[0].lk!` sem guarda — agora cai para outra família de setup, diz que caiu e
   segue.
2. `limpar()` derivava os negócios só das propostas. Morrendo entre criar o
   negócio e criar a proposta, negócio e oportunidade ficavam órfãos e a rodada
   seguinte travava para sempre no `DELETE` de `pessoas` pela FK da
   oportunidade. Aconteceu de verdade. Agora o negócio vem também do título.
3. Dois asserts com número mágico (`213 prices / 21 produtos` e `217 legados`),
   que são o tamanho do snapshot da planilha. Passaram a comparar contra linha
   de base medida antes do teste, que é a invariante real: "o teste não suja o
   catálogo".

Os dois validadores entraram em `scripts/rodar-aceites.sh`. A trava varre o
diretório: todo `src/scripts/valida*.ts` precisa de caller. Provada por
reintrodução — removido o validador de catálogo do runner, o teste fica
vermelho com a mensagem certa.

GAP REAL: o catálogo PABX no banco tem 30 preços e 5 categorias; o snapshot tem
194 e 9. Faltam Plano (18), Setup/Implantação (21), Integração (25), Serviço
Avulso (23), Linha SIP (5), Linha 0800 (4), Callface AI Pro e Business. Dois
caminhos de carga divergentes — planilha (16/09) x Stripe real (21/09). 41
preços em comum, 14 só no banco, 172 só no snapshot. Decisão do Kauã: bloqueio 7.

Validação: tsc limpo; `./scripts/rodar-aceites.sh` roda 4 aceites (208
asserções, 0 falhas) + 2 validadores e sai vermelho pelo gap de catálogo.

## 2026-09-22 — CP34: os 32 smokes sem caller, e um aceite sujando a carteira real

Terceira perna do passo 9. 32 smokes e nenhum chamador — zero referências em
`package.json`, em script, em CI. Criado `scripts/rodar-smokes.sh` (glob, exit
code, filtro opcional), chamado pelo passo 9 junto com os aceites.

Primeira execução da bateria: 31 de 32. O que falhou levou ao achado.

`aceite-cs` escreve numa conta REAL da carteira — escolhe de propósito "a que
tem serviço no portfólio e mais dado em volta". A limpeza cobria cancelamentos,
riscos, negócios, tarefas e atividades, e não `cs_marcos`. Medido: a query do
aceite devolve `101bca9d-… Unresolved billing identity`, que tinha 7 marcos (D0
a M12) de 22/09 03:06:26 e uma tarefa PLAYBOOK gerada pelo sweep do próprio
aceite — na fila de trabalho do CS. Hipóteses descartadas antes de concluir:
nenhum `domain_events` na janela, e os outros callers de `iniciarJornadaCs`
criam a própria empresa.

Corrigido: guarda os marcos preexistentes antes do TESTE 5 e remove só os seus,
na ordem da FK (marco antes da tarefa). Resíduo revertido com backup em
`docs/architecture/evidencias/2026-09-22-residuo-aceite-cs.sql`: DELETE 7 e
DELETE 1, carteira a zero. Aceite corrigido: 48/0.

`smoke-jornada-em-lote` media o total absoluto de marcos fora da conta de teste
— foi o que pegou o vazamento, mas ficaria vermelho para sempre depois da
virada, com 275 contas legitimamente semeadas. Passou a medir delta.

Travas por reintrodução: runner de smokes por glob com exit code; `aceite-cs`
guarda preexistentes, apaga `csMarcos` e cobre `CS_MARCO:`; a lista enumerada de
`rodar-backfills.sh` cobre a pasta inteira.

Gotcha: `rodar-smokes.sh` e `npm test` no mesmo banco dão corrida —
`reconciliacao-backfill` acusou "3 leads sem aquisição" que eram leads de um
smoke em voo. Sozinha, a suíte dá 335/0.

Validação: tsc limpo, 335 testes / 0 falhas, 32/32 smokes, 208 asserções de
aceite.

## 2026-09-22 — CP35: a home pintava de verde uma queda de 78%

O passo 10 da virada é uma frase sem roteiro ("subir o código novo e provar no
navegador"). Indo provar, os quatro cards de KPI da Visão Geral usavam o mesmo
selo verde fixo (`badge-positive`, `#3fb950` cru do export do Figma): receita
−78% em verde, leads −51% em verde, e dois selos verdes com "—" dentro.

`ds/crm.css` já tinha `.of-tendencia[data-tom]` com ok/risco/neutro — a tela não
usava. Importar o arquivo ali é seguro (todos os seletores são de classe
`.of-`/`.ds-`). O tom passou a sair de `tomDoDelta`: positivo → ok, negativo →
risco, nulo ou zero → neutro.

Medido no navegador com sessão real: −78% e −51% em `rgba(231,0,11,0.1)` com
texto vermelho; os dois "—" em cinza neutro.

`checar-onface-inicio.ts` terminava em `process.exit(0)` incondicional — existia
para pegar "home mostrando 0 com 244 clientes" e nunca falhava. Ganhou 8 asserts
na forma "não pode zerar quando a fonte tem linha", sem reimplementar a conta da
tela.

Achado aberto para o CP36: o gráfico "Evolução da operação" no centro da home é
imagem SVG estática do Figma, com legenda fixa "Crescimento consistente em todas
as frentes" e meses até dezembro. `getEvolucaoOperacao` existe, devolve série
real e não é chamada pela home.

Trava `sinal-nao-e-decoracao` provada por reintrodução nas duas direções.
Validação: tsc limpo, 337 testes / 0 falhas.

## 2026-09-22 — CP36: o gráfico no centro da home era desenho

O card "Evolução da operação" era uma pilha de <img> de segmento de reta, cada
um girado num ângulo fixo, com os meses "Jul … Dez" escritos na marcação (três
no futuro) e o subtítulo fixo "Crescimento consistente em todas as frentes." no
mesmo card em que a receita caía 78%. `getEvolucaoOperacao` já devolvia doze
meses reais e a home não a chamava.

Trocado por SVG na mesma caixa do desenho. Cada série é normalizada pelo próprio
máximo — receita em dezenas de milhares e ganhos em dezenas não cabem num eixo
só. A legenda passou a nomear o que a consulta devolve (Receita, Leads, Ganhos,
no lugar de Receita, Operações, Clientes) e o subtítulo virou `resumoDaEvolucao`,
derivado da comparação entre o primeiro e o último mês.

Medido no navegador com sessão real: 3 polyline, zero img de gráfico, rótulos
Abr–Set vindos da série.

Trava `sinal-nao-e-decoracao` estendida. A primeira versão dela ficou vermelha
por causa do próprio comentário que citava a frase antiga: agora ignora
comentários e olha só a marcação.

Validação: tsc limpo, 338 testes / 0 falhas.

## 2026-09-22 — CP37: "Financeiro: Saudável" era texto na marcação

Terceiro placeholder da mesma tela. Os quatro cards de "Áreas em destaque"
traziam "Em movimento", "Alta performance", "Saudável" e "Excelente NPS"
escritos na marcação. "Financeiro: Saudável" convivia com R$ 26.729,69 em
cobrança e 7 vencidos; "Excelente NPS" sem nenhuma resposta de NPS no período.

`montarVisaoGeral` já derivava os mesmos quatro a partir de número e a home não
os usava. A página passou a buscar `getMrrAtivo` (Metric Catalog) e
`getPrecisaAtencao` e a derivar: 480 em curso · R$ 10,1k no mês · R$ 425,6k de
MRR · 5 sinais abertos. O MRR do card bate com o da tela de Clientes.

Validação: tsc limpo, 339 testes / 0 falhas, trava provada por reintrodução.

## 2026-09-22 — CP38 e CP39: as checagens de tela e o passo 10

CP38. As três `checar-onface-*` também terminavam em `process.exit(0)`
incondicional. A de Visão Geral já calculava a lista de blocos vazios, imprimia
`BLOCOS VAZIOS: …` e saía zero — o painel em branco passava verde com o
diagnóstico impresso na tela. Critério de falha calibrado: só vira falha o vazio
que não acontece por operação (períodos de `generate_series`, operações com
entrega aberta, métricas sem valor). O assert do resumo truncado da tela de
Atividades provou valor na primeira execução: resumo 320, lista 300/300.

Duas mentiras que o runner contou sobre si mesmo, as duas minhas: chamei uma
função `rodar` que só existia no outro script — as três checagens deram
`command not found` e o runner fechou com "✔ 32 verificações passaram" — e,
com filtro que não casa nada, dizia "✔ 0 verificações passaram" e saía zero.
Zero executado não é sucesso; grupo com glob vazio agora é acusado pelo nome.

CP39. `checar-rotas-onface.ts` cobre as 14 rotas do ONFACE e entra no passo 10,
junto com o comando de subir os dois processos. A primeira versão acusou as 13
rotas, todas falsas: procurava "This page could not be found" no corpo, e essa
frase está no payload RSC que o Next embute em toda página. Erro se identifica
pelo `<title>`. A segunda acusou 404 numa rota certa: o id do contato vinha de
`leads` cru, e um lead com pessoa canônica espelhada é excluído da lista E do
detalhe pelo mesmo `NOT EXISTS`. O id passou a vir da consulta da lista, e o
teste passou a provar que o primeiro item da lista abre no detalhe.

Validação: tsc limpo, 340 testes / 0 falhas, 35 verificações na bateria,
14/14 rotas.
