# ONFACE — Auditoria completa e plano de conclusão

**Data:** 23/09/2026
**Medido em:** DEV local e remoto carregados com dump de produção do mesmo dia
**Para quem lê sem conhecer o histórico:** comece pelas seções 1 e 2.

> **Princípio deste documento:** nenhuma afirmação sem medida. Todo número tem
> uma consulta ou comando no apêndice que o reproduz. Onde o número vem de
> documento anterior, a data está dita e marcada se foi reconferida — foi assim
> que este projeto acumulou números fantasiosos no passado.

---

## 1. Onde estamos

### 1.1 O projeto teve cinco encarnações, não um rumo que desviou

| # | era | quando | o que é | onde está hoje |
|---|---|---|---|---|
| 1 | **CRM v1** | jun/26 | fork do `scott-studio-crm`, remodelado para parecer o mCRM da KOKO | **é o que roda em produção** |
| 2 | **CRM 2.0** | ago/26 | novo domain model, App Shell, navegação por macros | **nunca chegou a produção** |
| 3 | **ONFACE** | set/26 | devia ser troca de casca visual; nasceu como terceiro sistema paralelo | corrigido em 17/09 pela regra "ADAPTAR, NUNCA CRIAR" |
| 4 | **Refactor canônico** | 21/09 | `packages/`, entidades canônicas, EXPAND→BACKFILL→CUTOVER, 28 fases | em execução |
| 5 | **UX rebuild** | 22/09 | spec de 7.699 linhas, worktree isolado | em execução |

Um agravante estrutural: **o git só passou a refletir produção em 20/09**. Antes
disso o deploy era `rsync` manual, então "o que está em produção" e "o que está
no código" eram coisas diferentes. Código que nunca esteve em branch nenhuma
rodava em produção.

### 1.2 Produção e dev são produtos diferentes, não versões diferentes

Esta é a descoberta que explica a maior parte da confusão.

| | produção (`crm.callface.io`) | dev (`onface-ux-rebuild`) |
|---|---|---|
| monorepo `packages/` | **não existe** | existe (domain, integrations, platform, shared) |
| grupos de rota | só `(crm)` | `(crm)`, `(crm2)`, `(onface-preview)`, + bancadas |
| tabelas no banco | 82 | 175 |

**Produção roda apenas o CRM v1.** Todo o CRM 2.0 e todo o ONFACE existem só em
dev. Não é que dev esteja atrasado em relação a produção: são dois produtos
diferentes convivendo no mesmo repositório.

### 1.3 As 25 telas que produção entrega hoje

```
admin · agenda · automacoes · campanhas · carteira · configuracoes · contatos
contratos · dashboard · email · empresas · financeiro · inbox · leads
negocios · onboarding · perfil · pipeline · pos-venda · pre-vendas · propostas
prospeccao · relatorios · tarefas · whatsapp
```

Esta lista é o **contrato mínimo**: o ONFACE não substitui o legado sem cobrir o
que o time já usa todo dia.

Nota que desfaz um mal-entendido: **`carteira` existe em produção.** A percepção
de que "não existe" vem do ONFACE, não do produto que o time opera.

---

## 2. O que já funciona

Esta seção vem antes das falhas de propósito. A percepção de "nada funciona"
esconde uma base sólida, e jogar fora o que funciona seria o erro mais caro.

| indicador | valor | significado |
|---|---|---|
| **MRR canônico** | **R$ 425.619,39** | idêntico ao baseline histórico de 16/08 |
| `aquisicoes` | 4.066 | funil canônico populado |
| `pessoas` | 3.986 | identidade canônica |
| `communications` | 35.436 | histórico de comunicação |
| `conversas` | 5.912 | atendimento |
| `oportunidades` | 1.577 | pipeline canônico |
| `domain_events` | 2.173 | **event sourcing funciona** |
| `event_outbox` | 101 processados, 3 pendentes | **barramento de eventos funciona** |
| bateria de verificação | **50 de 50 verdes** | smokes, checagens de tela, verificadores |
| `tsc --noEmit` | limpo | |

Além disso:

- **Pré-vendas, Pipeline e Clientes batem com o legado** (validado em 23/09)
- **Schema é aditivo: zero tabelas de produção desapareceram.** As 93 tabelas
  novas foram somadas, nada foi removido
- **Cinco telas já são ONFACE de verdade**: `/pre-vendas`, `/pipeline`,
  `/propostas`, `/prospeccao` e `/contatos` já renderizam os componentes de
  `components/onface/vendas/`. A casca nova já é o produto ali

---

## 3. Inventário de telas

**148 páginas** no total.

| grupo | páginas | o que é de fato |
|---|---|---|
| `(crm)` | 27 | **22 são só `redirect()`**. No dev virou tabela de compatibilidade; em produção essas mesmas pastas são as telas reais do CRM v1 |
| `(crm2)` | 80 | **o produto real**, quase tudo ligado a dado |
| `(onface-preview)` | 15 | **não duplica nada**: 8 das 15 são `import` ou `redirect` para `(crm2)` |
| `onface-desenho` | 13 | bancada de desenho, bloqueada em produção |
| `estudio` | 5 | protótipo 100% mock, abre sem login |
| raiz/público | 8 | login, checkout, proposta pública, formulários de implantação |

### 3.1 O caso "Carteira", explicado

A pergunta era: a tela não existe, ou existe e não puxa dado? **São as duas
coisas, em lugares diferentes** — e é exatamente por isso que confunde.

| # | o que é | onde | estado |
|---|---|---|---|
| 1 | a tela `/clientes/carteira` | `app/src/app/(crm2)/clientes/carteira/page.tsx` | renderiza `ModuloPendente` — casca honesta, declara não estar construída. **Nenhum link do menu aponta para ela** |
| 2 | a aba rotulada "Carteira" no menu | `components/crm2/clientes-tabs.ts:14` | aponta para `/clientes`, que é tela **real** (Cliente 360, contas com MRR) |
| 3 | o backend de carteira | `api-server/routes/carteira.ts`, montado em `GET /api/carteira` | **pronto**: contratos ativos com join de empresa e responsável, MRR total, ticket médio, RBAC por papel. **Nenhuma página o consome** |

Existe até `POST /cs/carteira/atribuir` para resolver a dependência de dono de
conta — também sem consumidor no frontend.

**Resumo: há backend pronto sem tela, e tela-casca sem backend ligado, com o
mesmo nome, ao mesmo tempo.**

### 3.2 As 7 telas que a navegação prevê e não existem

| rota | dependência declarada no próprio código |
|---|---|
| `/clientes/carteira` | atribuir dono de conta (`clientes.responsavel_cs_id` vazio nas 275 contas) + critério de segmentação |
| `/clientes/expansao` | zero negócios com `commercial_motion = EXPANSION` |
| `/clientes/risco` | — |
| `/pos-vendas` | é só card-pai de Onboarding + Implantação no menu |
| `/chamados` | definir origem dos chamados |
| `/automacoes/fluxos` | decidir se o fluxo é editado aqui ou continua no n8n |
| `/relatorios/biblioteca` e `/relatorios/performance` | — |

Nenhuma simula dado. São estados honestos, não telas quebradas.

### 3.3 Lacunas e duplicações

- **Atividades**: a tela existe e está pronta (`montarAtividades` +
  `components/onface/atividades/Atividades.tsx`), mas **só roda em
  `(onface-preview)` e `onface-desenho`**. Dentro do produto, o item "Atividades"
  do menu aponta para `/tarefas`, que é outra coisa.
- **Contratos**: backend maduro (CRUD, PDF, fluxo de assinatura, link público)
  **sem tela de listagem**. `/ajustes/contratos` é gestão de *templates*. A visão
  por cliente vive embutida no Cliente 360.
- **Relatórios**: backend com 15 endpoints; front com 2 das 3 sub-telas pendentes.
- **Home em três implementações**: `(crm2)/inicio` e
  `(onface-preview)/visao-geral` são idênticas linha a linha;
  `(onface-preview)/inicio` é uma terceira, resquício do Command Center antigo.
- **Detalhe de empresa em duas rotas** com implementações diferentes:
  `/empresas/:id` (`Cf2EmpresaWorkspace`) e `/contatos/empresas/:id`
  (`DetalheEmpresaPagina`, estilo ONFACE).
- **IA**: `/automacoes/ai/[module]` existe e funciona, mas **não tem link de
  menu** — só é alcançável digitando a URL. O hub `/automacoes/agente-ia` mostra
  8 conceitos com badge "Em breve".
- **37 arquivos órfãos** em `components/crm/` — código morto do CRM v1.

---

## 4. Backend pronto sem tela

Onde o fio está solto e o ganho é alto. Nenhum destes exige construir feature
nova — exige ligar o que já existe.

| módulo | backend | frontend | ação |
|---|---|---|---|
| **Carteira** | `GET /api/carteira` completo, com RBAC | `ModuloPendente` | trocar a casca por tela que consuma, apontar o menu para ela |
| **Atividades** | `montarAtividades` + componente pronto | só no preview | promover para `(crm2)`, corrigir item de menu |
| **Contratos** | CRUD, PDF, assinatura, link público | sem listagem | criar a tela de lista |
| **Relatórios** | 15 endpoints (`comercial`, `growth`, `marketing`, `midia-paga`, `pos-venda`, `sdr-esteira`, `tendencias`, `tracking`…) | 2 sub-telas pendentes | ligar |
| **CS** | ~30 endpoints, o mais completo do backend | telas existem | conferir cobertura |

---

## 5. Dados

### 5.1 O modelo canônico em números

- **93 tabelas novas** em relação a produção
- **34 com dado (37%)**
- **59 vazias (63%)**

Composição das 59 vazias:

| grupo | qtd |
|---|---|
| IA / agentes (`ai_*`) | 25 |
| cadência | 5 |
| CS | 4 |
| Callface AI | 4 |
| automação | 4 |
| proposta, oportunidade, file, vendas, teams, métricas, integração | 13 |

**O núcleo funciona; a periferia é que está oca.** Ver seção 6 para o motivo de
cada grupo — que na maioria dos casos não é falta de código.

### 5.2 Dado que trava operação

| item | medido hoje | consequência |
|---|---|---|
| catálogo com `service_family` = UNKNOWN | **208 de 233 (89%)** | trava venda |
| preços carregados | **55** contra 213 da planilha oficial | faltam Plano, Setup, Integração, Serviço Avulso, Linha SIP, Linha 0800 — **não se monta venda de PABX** |
| contratos ativos com data de vencimento | **19 de 597 (3%)** | **o CS não gera renovação** |
| oportunidades sem oferta comercial | **1.094** | trava relatório e regra de Ganho |
| serviços sem `canonical_product` | **413 de 439 (94%)** | serviço sabe a família, não sabe o produto |
| negócios abertos sem tarefa aberta | **533 de 536 (99,4%)** | ninguém sabe o próximo passo |
| aquisições ativas sem responsável | 63 | lead sem dono |
| leads com score zero | **2.524 de 4.066 (62%)** | ver seção 6.2 |

### 5.3 Aviso sobre números de documentos anteriores

O ATLAS AS-IS (19/09) tem um backlog de **43 itens (8 P0, 15 P1, 20 P2)** com
evidência e critério de aceite. **Ele continua sendo a melhor referência de
escopo, mas os números foram medidos num banco que não existe mais.** Revalidação
contra o banco de hoje:

| item | ATLAS 19/09 | hoje | veredito |
|---|---|---|---|
| fulfillments parados | 415 de 416 | **3 de 26** | número obsoleto |
| oportunidades sem oferta | 1.084 | **1.094** | continua |
| `canonical_product` NULL | 100% | **94%** | continua |
| `service_family` NULL | problema | **0** | **resolvido** |
| negócios sem próxima ação | 99,1% | **99,4%** | continua |
| aquisições sem responsável | 54 | **63** | continua |

---

## 6. Motores: a descoberta central

**O que falta majoritariamente não é código. É configuração e dado.**

| domínio | motor | quem aciona | por que está zerado |
|---|---|---|---|
| **IA / agentes** | completo, e **é o caminho primário** | `worker/index.ts:866`, a **cada mensagem de WhatsApp** | `Hermes` e `NEXO` existem, ambos em **`draft`**. Sem versão publicada, `NoEligibleAgentError` dispara sempre e cai no SDR legado |
| **Cadência** (motor-alvo) | completo | consumer do `event_outbox` + cron a cada 5 min | `cadence_definitions` = 0. Ninguém publicou fluxo pela UI |
| **Automação** (CRUD) | existe | 5 pontos reais: leads, negócios, NPS, atendimento, webhook Stripe | `automacoes` = 0. Ninguém criou regra |
| **CS** | completo | cron `cs-sweep` **a cada hora** | 19 de 597 contratos com vencimento — sem data não há renovação a gerar |
| **Callface AI** | completo, leitura-only por design | **ninguém** — só script manual | falta um `upsertJobScheduler` no worker; o padrão já existe para copiar de `stripe-sync` |
| **E-mail sequências** | executor roda a cada 60s | cron `check-sequences` | **não existe UI de autoria** de sequência multi-passo |
| **Arquivos** | completo, com teste de regressão no CI | 4 rotas reais | ninguém fez upload — e no dev remoto o upload está **quebrado por permissão de volume** |
| **`event_outbox`** | 57 pontos publicam, consumer a cada 60s | — | **funciona** |

**Publicar dois agentes, publicar um fluxo de cadência, agendar um cron e
preencher vencimento de contrato destravam quatro domínios inteiros.**

### 6.1 O worker tem 21 schedulers ativos

`sla-check` · `sdr-followup-escalation` · `ai-sdr-outreach` · `ai-sdr-retry` ·
`ai-sdr-meeting-confirmation` · `stripe-sync` · `catalogo-stripe-sync` ·
`reconcile-pagamentos` · `expirar-propostas` · `follow-up-proposta` ·
**`cs-sweep`** · **`cadence-sweep`** · **`event-outbox-sweep`** ·
`snapshot-diario` · `check-sequences` · `email-sync-trigger` ·
`rd-criativo-sync` · `outlook-reuniao-sync` · `calendar-sync-retry` ·
`alerta-renovacao` · `reativar-lead-perdido` · `check-whatsapp-connection` ·
`lembrete-reuniao-30min`

**Não há nenhum job para Callface AI.**

### 6.2 Onde falta código de verdade

- **`eventos`** (tracking de navegação): **nenhum `INSERT` em todo o
  repositório**. O lado produtor nunca foi construído. E
  `lib/crm/lead-scoring.ts:106` **lê** essa tabela como sinal de score — por isso
  62% dos leads têm score zero, e ninguém percebeu.
- **`cliente_receita_mensal`**: existe no banco mas **não está no `schema.ts`**.
  O Drizzle não sabe que ela existe; nenhum código consegue escrever nela.
- **`automacao_versoes`, `automacao_passos_execucao`, `automacao_inscricoes`**:
  puro scaffolding. Zero linhas de código em todo o repo tocam nelas.
- **UI de autoria de sequência de e-mail**: não existe.
- **Adaptador S3/R2**: `criarS3 = undefined`. Tudo cai em disco local.

### 6.3 Três motores de automação convivendo — com decisão já tomada

`docs/reconstruction/AUTOMATION-AGENTS-TARGET-2026-09-08.md` já decidiu:
`cadence_definitions` é o executor único; o CRUD de `automacoes` fica como
compatibilidade temporária. **A convivência é transição documentada, não
acidente.** Hoje quem roda de fato é o terceiro, o legado `cadencia_execucoes`
(1.306 linhas).

---

## 7. Integrações

| integração | dev local | dev remoto | o que falta |
|---|---|---|---|
| **Meta Graph / Lead Ads** | token System User sem expiração, `leads_retrieval` ativo | **nenhuma variável `META_*`** | copiar variáveis do local |
| **Meta CAPI** | preenchido | ausente | idem |
| **Meta Ads Insights** | preenchido | ausente | idem |
| **Stripe** | **vazio** | vazio | chave `sk_test_` — não existe no repo nem no vault |
| **Resend** | vazio | vazio | chave de teste |
| **Groq (SDR/IA)** | vazio | vazio | chave |
| **E-mail (Microsoft)** | — | **`EMAIL_ENCRYPTION_KEY` ausente** | sync falha em loop, com 8 contas e 5.113 e-mails já importados |
| **WhatsApp (wuzapi)** | — | **8 sessões desconectadas** | reconectar; há 27.096 mensagens no histórico |
| **Callface AI** | URL configurada, **porta 55432 fechada** | ausente | túnel + cron |
| **Documenso** | URL e token preenchidos | não verificado | validar |

**Nota positiva sobre Stripe:** estar vazio em dev é o comportamento **correto e
seguro** — nenhum risco de cobrar cliente real. Só falta a chave de teste para
poder exercitar o fluxo.

---

## 8. Dívida técnica: oito defeitos, um padrão

Todos encontrados em 23/09, todos corrigidos na origem. Vale entender o padrão,
porque ele prediz onde ainda há defeito escondido.

| defeito | assumia |
|---|---|
| backfill `06-aquisicao` lia `qualificado`, `desqualificado_em`, `estagio_pre_vendas` | colunas que **não existem** em produção |
| migration `0081` materializava etapa | `aquisicoes` já populada |
| migration `0083` ligava `permite_trial` | `ofertas_comerciais` já populada |
| migrations `0084`/`0085` | mesmo padrão |
| backfill `06b` casava por `lead_legado_id` | vínculo que só o último passo da cadeia cria |
| webhook da Meta cria aquisição | que aquisição sem lead legado abre card |
| sync do Callface AI | que dava para reportar número sem conexão |
| `smoke-board-familia` | número fixo de uma carga antiga (125, virou 128) |

**É o mesmo defeito oito vezes: código que assume estado que só existe num banco
crescido por acumulação.**

Nenhum deles aparece em `tsc`, teste unitário ou revisão de código. Só aparecem
carregando produção num banco vazio e rodando a cadeia inteira — o que foi feito
pela primeira vez em 23/09. **Todos estavam esperando o dia da virada em
produção para se manifestar.**

O passo 16 (`16-materializacao-canonica.ts`) já era a prova de que o time
conhecia o padrão; ele existe exatamente para reaplicar materializações que
rodaram cedo demais.

### Onde ainda pode haver defeito escondido

Qualquer backfill ou migration que leia coluna/tabela preenchida por um passo
posterior. A forma de encontrar é a mesma: **carregar produção num banco virgem e
rodar a cadeia inteira**, que agora está documentada no runbook.

---

## 9. Decisões de negócio pendentes

Estas travam execução e só o Kauã fecha. Consolidadas do vault.

| decisão | impacto |
|---|---|
| 33 contratos "duplicata provável" | **R$ 17.449,30/mês de MRR em excesso** |
| 1.094 oportunidades sem oferta comercial | trava relatório e regra de Ganho |
| fórmula do Health Score do CS | nunca definida, pendente desde agosto |
| provedor de assinatura eletrônica | Autentique → Documenso → sem decisão final |
| mecanismo de ativação de licença White Label | tabela de preço definida, mecanismo não |
| 1.980 anexos do Zoho | só no Mac do Scott, sem storage nem backup |
| catálogo: 172 preços só na planilha | existem no Stripe sem metadata (barato) ou não existem (caro)? Precisa da chave Stripe para descobrir |
| `sdr_sem_retorno` (46 leads) | mapeado provisoriamente para `nutricao`; a etapa `sem_resposta` não existe no canônico |

---

## 10. Plano de ação

Ordenado por dependência real. Cada bloco destrava o seguinte.

### Bloco 0 — risco imediato (hoje, minutos)

**O disco da EC2 está em 96%, com 4,4 GB livres, e produção roda no mesmo host.**

A causa não são os dados (os bancos do dev somam 340 MB). É o Docker: 33,5 GB de
build cache e 77,7 GB de imagens (163, só 28 ativas).

```bash
docker builder prune -f    # libera ~9,9 GB, não toca em nada em execução
docker image prune -f      # libera ~6,4 GB
```

### Bloco 1 — destravar o que já está pronto (horas, sem escrever código)

1. Publicar `Hermes` e `NEXO` (hoje em `draft`) → liga o runtime de IA
2. Abrir o túnel da porta 55432 (banco do Callface AI)
3. Agendar o cron do Callface AI no worker → destrava 238 serviços "não conectado"
4. `sudo chown -R 1001:65533 /opt/callface/crm2-dev/uploads` → conserta upload
5. Copiar as variáveis `META_*` do dev local para o remoto
6. Configurar `EMAIL_ENCRYPTION_KEY` → para o sync de e-mail sair do loop de erro
7. Reconectar as 8 sessões de WhatsApp
8. Obter e configurar `sk_test_` do Stripe, chave do Resend e do Groq

### Bloco 2 — dado que trava operação (dias)

9. **Catálogo**: resolver 208 itens UNKNOWN e os 158 preços faltantes
10. **Vencimento de contrato**: 19 de 597 — sem isso o CS não gera renovação
11. **1.094 oportunidades sem oferta** e **413 serviços sem `canonical_product`**
12. Decidir os contratos com duplicata provável

### Bloco 3 — ligar front a backend que já existe (dias, ganho alto)

13. **Carteira**: consumir `/api/carteira`, apontar o menu para a tela certa
14. **Atividades**: promover do preview para `(crm2)`, corrigir o menu
15. **Contratos**: criar a tela de listagem
16. **Relatórios**: ligar as 2 sub-telas aos 15 endpoints prontos

### Bloco 4 — código que falta de verdade (dias)

17. Produtor de `eventos`, ou remover o sinal do `lead-scoring`
18. UI de autoria de sequência de e-mail
19. `cliente_receita_mensal` no `schema.ts`
20. Corrigir o webhook da Meta para criar lead legado
21. Adaptador S3/R2 para o acervo

### Bloco 5 — higiene e paridade (semanas)

22. Resolver duplicações: home em 3 implementações, empresa em 2 rotas
23. Remover os 37 arquivos órfãos de `components/crm/`
24. Fechar as 7 telas `ModuloPendente`, na ordem da jornada comercial
25. Cobrir as 25 telas do contrato mínimo (seção 1.3)

> **Blocos 0, 1 e 3 não exigem construir feature nova.** São configuração e
> ligar fio solto. Fazer só eles muda a percepção do produto de "nada funciona"
> para "funciona, falta preencher".

---

## 11. Apêndice: como reconferir cada número

```sql
-- tabelas vazias do modelo canônico (seção 5.1)
SELECT c.relname, s.n_live_tup FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = 'public'
  JOIN pg_stat_user_tables s ON s.relid = c.oid
 WHERE c.relkind = 'r' AND s.n_live_tup = 0 ORDER BY 1;

-- por que o CS não gera renovação: 19 de 597 (seção 5.2)
SELECT count(*) FILTER (WHERE vencimento IS NOT NULL) AS com_vencimento,
       count(*) AS ativos
  FROM contratos WHERE status = 'ativo';

-- por que a IA não roda: agentes em draft (seção 6)
SELECT nome, status FROM ai_agents;
SELECT status, count(*) FROM ai_agent_versions GROUP BY 1;

-- o barramento de eventos funciona (seção 2)
SELECT status, count(*) FROM event_outbox GROUP BY 1;

-- catálogo: 208 de 233 UNKNOWN (seção 5.2)
SELECT coalesce(service_family, '(nula)'), count(*)
  FROM servicos_catalogo GROUP BY 1 ORDER BY 2 DESC;

-- negócios sem próxima ação: 533 de 536 (seção 5.2)
SELECT count(*) FROM negocios n
 WHERE n.status NOT IN ('ganho','perdido','churned')
   AND NOT EXISTS (SELECT 1 FROM tarefas t
                    WHERE t.negocio_id = n.id AND t.concluida = false);

-- MRR canônico: R$ 425.619,39 (seção 2)
SELECT sum(current_recurring_value) FROM servicos_canonicos
 WHERE portfolio_included;

-- score de lead: 62% em zero (seção 5.2)
SELECT count(*) FILTER (WHERE coalesce(lead_score,0) = 0), count(*) FROM leads;
```

```bash
# produção não tem o monorepo (seção 1.2)
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  "docker exec callface-crm-app sh -lc 'ls -d /app/packages'"

# as 25 telas de produção (seção 1.3)
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  "docker exec callface-crm-app sh -lc 'ls /app/src/app/\"(crm)\"'"

# o disco que ameaça produção (bloco 0)
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 "df -h / && docker system df"

# páginas por grupo de rota (seção 3)
for g in "(crm)" "(crm2)" "(onface-preview)"; do
  echo "$g: $(find "app/src/app/$g" -name page.tsx | wc -l)"
done

# o worker do dev remoto e seus erros (seção 7)
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  "docker logs --tail 30 callface-crm2-dev-worker"
```

### Documentos de referência

| documento | para quê |
|---|---|
| `docs/reconstruction/PRODUCTION-READINESS-TRACKER.md` | os 13 P0 técnicos, fonte de verdade de go-live |
| `PRODUCT-FINALIZATION-TRACKER.md` | contrato da fase de finalização de produto |
| `docs/reconstruction/AUTOMATION-AGENTS-TARGET-2026-09-08.md` | a decisão sobre qual motor de automação vence |
| `docs/sync-dev-20260923/DIAGNOSTICO.md` | causa raiz da divergência de Pré-vendas |
| `docs/sync-dev-20260923/RUNBOOK-DEPLOY-DEV.md` | como recarregar e publicar o dev remoto |
| vault: `atlas-as-is/07-backlog-de-recuperacao.md` | os 43 itens com critério de aceite (números a reconferir) |
| vault: `atlas-as-is/HANDOFF-CANONICO-ONFACE-AS-IS.md` | leitura única mais densa para quem assume o projeto |
