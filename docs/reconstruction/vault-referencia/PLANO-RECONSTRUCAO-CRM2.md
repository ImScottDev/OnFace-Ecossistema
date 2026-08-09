---
tags: [scott-studio, callface, crm, projeto-interno, decisao, arquitetura]
---

> **Nota**: cópia de referência do vault Obsidian (fonte de contexto de produto/negócio), snapshot de 09/08/2026. Pode conter wikilinks `[[...]]` no formato Obsidian, que não resolvem fora dele — informativo, não é link quebrado.

# Plano de Reconstrução — Callface CRM 2.0

Plano de guerra de execução, produzido em 08/08/2026, cruzando: [[project_crm_callface|current state auditado]] (8 agentes, código real), o blueprint de 107 pontos ([[blueprint-crm2-vs-current-state]]), a decisão de Attribution/Acquisition Layer, os 10 guardrails finais + Data Governance, e a conversa original completa (ChatGPT, 70 mensagens). Ordem de leitura recomendada antes deste doc: `blueprint-crm2-vs-current-state.md`.

**Princípio que governa este plano** (decisão explícita do Kauã, 08/08): reconstrução de ponta a ponta, sem soluções pela metade. INCREMENTAL ≠ PROVISÓRIO — cada fase entrega valor real, mas construída sobre a arquitetura definitiva, nunca um atalho que vira dívida técnica deliberada. O destino não é só o CRM da Callface — é produto ("hoje é pra Callface, amanhã vira produto"), o que justifica o nível de rigor arquitetural do blueprint mesmo com time pequeno.

## Como a ordem foi decidida

Não é "mais fácil primeiro". Critério de ordenação, nessa prioridade:
1. Dependência arquitetural (o que outra coisa precisa pra existir)
2. Dependência de dados (schema que outros schemas referenciam)
3. Dependência de negócio (o que a operação realmente precisa em que ordem)
4. Risco (financeiro > operacional > cosmético)
5. Impacto operacional e no usuário
6. Migração (o que pode rodar em paralelo vs. o que exige corte)
7. Estabilidade e capacidade de evolução
8. Velocidade de entrega de valor real
9. Preparação para o produto futuro (multi-tenant de verdade, não só Callface)

**Achado que mais mudou a sequência do blueprint original**: o AI SDR estava na "Fase 5" do roadmap de 7 fases do blueprint (depois de Foundation→Core→Commercial→Communication→Automation). Mas a dependência REAL do AI SDR é só Core CRM (Lead/Contact/Company/Deal) + Communication Intelligence (canal + IA de conversa) — ele não toca Proposta/Contrato/Pagamento/Receita, seu trabalho termina em "lead qualificado → reunião agendada → handoff pro closer". Não há motivo arquitetural pra ele esperar Commercial. Por isso, neste plano, **AI SDR é Fase 3, não Fase 5** — resequenciamento justificado por dependência real, não atalho pra tapar buraco operacional. A urgência operacional (SDR removido, closer fazendo qualificação como gambiarra) é resolvida pela ordem certa, não por uma versão provisória.

**Ajuste 08/08 (feedback do Kauã) — a instrução "não comece pelo frontend" não significa "frontend só depois de todo o backend"**: significava não desenhar UI antes de saber o que o produto precisa ser. Correção aplicada: Design/Figma vira **trilha paralela contínua a partir da Fase 1** (quando domínio e fluxos principais já estão definidos o suficiente pra desenhar de verdade), rodando junto com F2-F6 — não é mais uma nota de rodapé, é workstream real com entregável próprio em cada fase. A Fase 7 deixa de ser "hora de desenhar a UI" e passa a ser "hora de implementar o que já está desenhado e validado há fases".

**Ajuste 08/08 (feedback do Kauã) — Definição de "Done" por fase**: nenhuma fase termina só porque o código foi escrito. Ver seção dedicada abaixo, aplicada a cada fase.

---

## Definição de "Done" — 5 dimensões, aplicadas a toda fase

Regra fechada pelo Kauã: **Technical Done + Data Done + Operational Done + UX Done + Observability Done**. Uma fase só está concluída quando as 5 dimensões estão fechadas — código funcionando é só a primeira.

- **Technical Done**: código implementado, testado, no ar no ambiente esperado (homolog/produção conforme a fase).
- **Data Done**: schema migrado, dado validado (contagem/integridade/relacionamento), sem duplicidade/órfão novo introduzido pela fase.
- **Operational Done**: o processo de negócio funciona ponta a ponta em condição real de operação — quem precisa usar consegue usar, sem patch manual por fora do sistema pra completar o fluxo.
- **UX Done**: a interface (ou ferramenta interina, mesmo antes do Design System da Fase 7) que a pessoa toca é usável de verdade, não só funcional no backend.
- **Observability Done**: tudo é auditável/rastreável, métrica de saúde da fase existe, caminho de erro/fallback é visível (nunca falha silenciosa).

Exemplo de referência (dado pelo próprio Kauã, AI SDR não está pronto só porque "o agente responde WhatsApp" — está pronto quando a cadeia inteira fecha):
```
Lead entrou
  ↓
Agente recebeu evento
  ↓
Agente executou estratégia
  ↓
Comunicação registrada
  ↓
Resposta interpretada
  ↓
CRM atualizado
  ↓
Qualificação registrada
  ↓
Reunião agendada
  ↓
Handoff correto
  ↓
Closer recebeu contexto
  ↓
Tudo auditável
  ↓
Métricas disponíveis
  ↓
Fallback funcionando
```
Esse é o nível de rigor de "Done" pra toda fase deste plano, não só pra Fase 3.

---

## Mapa de dependências entre fases

```
FASE 0 (Fundação)
  ↓
FASE 1 (Domain Model: Lead/Contact/Company/Deal/Attribution) ─┐
  ↓                                                            │
FASE 2 (Communication Intelligence)                            │  TRILHA PARALELA
  ↓                                                            │  CONTÍNUA:
FASE 3 (AI SDR Agent)                                          │  Design/Figma
  ↓                                                            │  (começa aqui,
FASE 4 (Commercial: Produtos/Propostas/Contratos/Pagamentos)   │  roda até
  ↓         ↘                                                  │  o fim da F6,
FASE 5      FASE 6 (Analytics/Data Quality/Command Center)     │  entrega tela
(Cadência    ↓ [versão fina em paralelo com Fase 4]            │  pronta pra
+Automação)  ↓                                                 │  cada fase)
  ↘         ↙                                                 │
FASE 7 (Frontend/UX — IMPLEMENTAÇÃO do que já está desenhado) ←┘
  ↓
FASE 8 (Migração completa / Cutover / Decomissão do legado)
  ↓
FASE 9 (Ecosystem Readiness — CS/Onboarding, Finance, Business Hub)
```

Fases 5 e 6 podem correr em paralelo depois da Fase 4. **Ajuste 08/08**: a trilha de Design/Figma (blocos 91-93 do blueprint) não é mais uma nota — é workstream contínuo a partir da Fase 1, entregando tela desenhada e validada fase a fase (Command Center e telas de Lead/Deal ao fim da F1-F2; telas de Communication/AI SDR ao fim da F2-F3; Proposal Builder/Commercial ao fim da F4; dashboards/Command Center completo ao fim da F6). A Fase 7 deixa de ser "hora de desenhar" — é "hora de implementar o que já foi desenhado e validado", só isso já reduz risco e tempo dela.

---

## FASE 0 — Fundação (arquitetura + governança de dados)

**Objetivo**: construir só o substrato que TODA fase seguinte realmente precisa — não a "Fundação inteira" do blueprint (isso seria meses sem entregar nada visível), o mínimo que destrava o resto com segurança.

**Escopo**:
- Monólito modular: estabelecer fronteira de domínio (`identity/crm/communications/commercial/automation/ai/billing/integrations/analytics/audit`) como disciplina para código NOVO. Código legado migra módulo a módulo conforme cada fase o toca — não é reescrita geral no dia 1.
- Multi-tenancy real: fechar os furos confirmados na auditoria (`contratos`/`assinaturas`/`faturas`/`mrr_movimentos` com `organizacaoId` nullable — vira NOT NULL com backfill).
- Event Outbox: tabela Postgres + consumidor BullMQ/Redis (o que já existe) como espinha dorsal de eventos — **não introduzir broker novo** (Kafka/RabbitMQ), decisão já registrada como push-back de arquiteto.
- Audit Log genérico (actor/action/entity/before/after/timestamp) — fecha o achado de segurança confirmado (zero log de impersonation/org-switch hoje).
- RBAC v2: mantém NextAuth, estende papéis (adiciona Director/Coordinator/Operations do blueprint), formaliza multi-tenancy+ownership como helper reusável em vez de checagem copiada rota a rota.
- Data Governance como contrato documentado (quem escreve o quê) — força que decisões futuras (ex: só o Financial Core escreve valor de receita) tenham dono explícito desde já.
- **Correções sem risco arquitetural, fazer aqui**: corrigir o IDOR confirmado em `leads.ts` (enrich-bulk), remover as rotas Next.js duplicadas/mortas, **verificar concretamente** os 2 achados técnicos ainda não confirmados (47 assinaturas fora do espelho, 85 reuniões travadas em "agendada") antes de seguir.

**Banco**: novas tabelas (`event_outbox`, `audit_log`, `teams`); alterar existentes (backfill de `organizacaoId`, sem dropar nada).

**Eventos**: definir o subconjunto inicial do catálogo (o suficiente pra Fase 1-3 consumirem), não os ~30 eventos completos do blueprint de uma vez.

**APIs/Frontend/Automações/IA**: nenhum ainda.

**Migração**: nenhuma de dado de produto ainda — só hardening de schema, compatível com o que já roda.

**Testes**: constraint de banco (org_id not null), teste de escrita de audit log, teste de idempotência do outbox.

**Dependências**: nenhuma (é a base).

**Risco**: backfill de `organizacaoId` pode ter linha órfã sem dono claro (mesmo padrão do bug de 03/08, "18 leads sem responsável") — precisa de script de reconciliação manual pros casos ambíguos, não assumir automaticamente.

**Critério de conclusão (5 dimensões de "Done")**:
- *Technical*: outbox + audit log + RBAC v2 no ar em homolog e produção, testes de constraint passando.
- *Data*: zero `organizacaoId` nullable em tabela financeira; backfill validado linha a linha nos casos ambíguos (não assumido automaticamente); os 2 achados técnicos pendentes confirmados ou descartados com evidência.
- *Operational*: qualquer dev/admin consegue consultar "quem fez o quê" via audit log sem pedir acesso a banco; troca de organização/impersonation deixa rastro real usável no dia a dia.
- *UX*: nenhuma tela nova ainda — mas o admin já vê o audit log em algum lugar consultável (mesmo que só uma tabela crua em homolog).
- *Observability*: outbox com métrica de lag/erro visível; audit log com alerta se parar de gravar.

**O que fica disponível**: nada visível pro usuário final — mas o terreno agora é seguro pra construir em cima, e qualquer venda futura já não sangra por falta de verificação dos achados pendentes.

---

## FASE 1 — Domain Model Central (Lead / Contact / Company / Deal / Attribution / Customer)

**Objetivo**: implementar de verdade `LEAD ≠ CONTACT ≠ COMPANY ≠ DEAL ≠ CUSTOMER`, com Company como fio condutor (não Lead) e Attribution como camada própria e desacoplada — a decisão mais importante de todo o projeto, e a de maior risco se sair errada.

**Escopo**:
- `contacts` como identidade persistente real (resolve os 2 conceitos de Contato desconectados hoje: discriminador em `leads.tipo` vs. tabela `contatos` de canal).
- `companies` evoluída (já existe, ganha mais peso como âncora do relacionamento B2B).
- `leads` passa a ser entidade transitória de qualificação (não mais carrega tipo=cliente).
- `deals` referencia `contact_id`/`company_id` diretamente, **não `lead_id`** — decisão já fechada.
- `attribution_touchpoints`: source/medium/campaign/term/content/landing page/referrer/first touch/last touch/timestamps, alimentada por todas as entradas (site/campanha/RD/manual/importação) na mesma camada.
- `customers`: entidade agregadora nova (empresa+contatos+assinaturas+produtos+deals+onboarding+status financeiro) — hoje é só uma flag dentro de Lead.
- Migração dual-write: tabelas novas convivem com `leads` legado durante a transição (strangler pattern, não big-bang).

**Banco**: tabelas novas listadas acima; schema V2 em paralelo ao V1 (a mesma decisão que já apareceu na conversa original quando a recomendação mudou de "refatorar banco" pra "criar Schema V2 em paralelo").

**Eventos**: `LeadCreated`, `LeadQualified`, `LeadConverted`, `ContactCreated`, `CompanyCreated`, `DealCreated`.

**APIs**: endpoints novos, moldados no Domain Model, testados em homolog — ainda não substituindo tráfego real de produção.

**Migração**: backfill script mapeando `leads` (tipo=lead/contato/cliente) pra Contact+Lead+Customer separados — validação por contagem, relacionamento e spot-check antes de qualquer corte.

**Frontend**: nenhuma implementação ainda — **mas aqui começa de verdade a trilha paralela de Design/Figma**: wireframe de Lead Detail, Deal Detail, Company/Contact, Pipeline, sobre o Domain Model já fechado. Entregável desta fase pro Design: telas centrais do CRM Core desenhadas e validadas com o Kauã, prontas pra virar código na Fase 7.

**Dependências**: Fase 0 (outbox, audit, RBAC).

**Risco**: o maior de todo o plano — errar aqui contamina tudo depois. Exige a revisão mais rigorosa de qualquer fase, e checkpoint explícito do Kauã antes de prosseguir pra Fase 2.

**Critério de conclusão (5 dimensões de "Done")**:
- *Technical*: schema V2 (Contact/Company/Deal/Attribution/Customer) no ar em homolog, endpoints novos testados.
- *Data*: dado real migrado e validado (contagem bate, amostragem manual aprovada pelo Kauã), zero perda de atribuição/UTM na migração.
- *Operational*: `leads` legado ainda é fonte de verdade em produção (dual-write, sem corte) — ninguém no time percebe mudança operacional ainda, de propósito.
- *UX*: wireframes de Lead/Deal/Company/Contact/Pipeline desenhados e aprovados pelo Kauã (trilha Figma).
- *Observability*: divergência entre schema legado e schema novo é monitorada automaticamente durante o dual-write (não é só "confiar que bate").

**O que fica disponível**: nada visível ainda em produção, mas a fundação de domínio correta existe, já está sendo alimentada com dado real em paralelo, e o design das telas centrais já está pronto pra Fase 7.

---

## FASE 2 — Communication Intelligence (Call / WhatsApp / Email unificados + IA)

**Objetivo**: criar a entidade `Communication` (distinta de `Activity`) + `AIAnalysis`/`AIInsight` genéricos, unificando ligação/WhatsApp/email — usando a integração de telefonia Callface (já com idempotência real e resumo de IA) como padrão de qualidade a replicar, não a reescrever.

**Escopo**: tabela `communications`, tabelas `ai_analysis`/`ai_insight` (atacháveis a qualquer entidade — hoje extração de IA é silo por feature, SDR só pra si, ligação só pra si). Migrar `ligacoes`/`whatsapp_mensagens`/`emails` pra alimentar `Communication` de forma uniforme (dual-write/bridge durante a transição). Aplicar IA (resumo/sentimento/intenção) em WhatsApp e Email no mesmo nível que já existe em Ligações.

**Correções que entram aqui** (achados de integração da auditoria): bypass de verificação de assinatura no webhook do WhatsApp quando header vem vazio; tokens fixos com fallback hardcoded no código (RD Station, Meta-lead-ids).

**Banco**: `communications`, `ai_analysis`.

**Eventos**: `CallStarted/Completed/Analyzed`, `WhatsAppMessageSent/Received`, `EmailSent/Received`.

**Dependências**: Fase 0 (eventos/audit), Fase 1 (Contact/Company como âncora — comunicação se conecta primariamente ao Contact).

**Frontend (trilha paralela)**: wireframe da Timeline unificada (Call/WhatsApp/Email numa linha só, já validada uma vez em produção em 29/07) + painel de AIInsight por conversa.

**Risco**: médio — majoritariamente aditivo, baixo risco de quebrar canal existente (tabelas antigas continuam funcionando durante o dual-write).

**Critério de conclusão (5 dimensões de "Done")**:
- *Technical*: `communications`/`ai_analysis` no ar, IA gerando resumo/sentimento pra WhatsApp e Email no mesmo nível que já existe em Ligações.
- *Data*: toda ligação/WhatsApp/email nova gera registro em `Communication`, sem duplicar o que as tabelas antigas já gravam.
- *Operational*: quem olha o histórico de um lead vê os 3 canais juntos, sem precisar abrir 3 telas diferentes.
- *UX*: Timeline unificada usável (mesmo que ainda dentro do layout antigo, não precisa esperar Fase 7 pra existir uma versão funcional).
- *Observability*: falha de análise de IA (ex: erro de API) fica visível no registro, nunca some silenciosamente.

**O que fica disponível**: a base de dado que a Fase 3 (AI SDR) precisa, e a Timeline unificada já funcionando de verdade, não só desenhada.

---

## FASE 3 — AI SDR Agent

**Objetivo**: construir o AI SDR como agente de verdade (contexto + memória operacional + máquina de estados), substituindo a lacuna real deixada pela remoção do SDR humano — resolvendo a dor operacional atual (closer fazendo qualificação como gambiarra) através da ordem certa, não de um atalho.

**Por que aqui e não na "Fase 5" do blueprint**: dependência real satisfeita neste ponto (Domain Model + Communication Intelligence prontos); o AI SDR não precisa de Proposta/Contrato/Pagamento pra funcionar.

**Escopo**:
- **Corrigir primeiro, custo baixo, não é opcional**: o bug confirmado do endpoint (`sdr.ts` chama `api.openai.com` com nome de modelo Groq, sem env var compatível documentada) — sem isso corrigido, não há base pra construir nada em cima.
- Máquina de estados do agente: `Lead Created → AI SDR → Understand Context → Choose Channel → Execute Action → Observe Response → Interpret → Update CRM → Choose Next Action → Repeat`.
- Human Handoff formal (`AI_HANDLING → HUMAN_REQUIRED → HUMAN_ASSIGNED`) — reaproveitando a heurística de 4 gatilhos já sofisticada do legado (tool-call do modelo, keyword, valor alto, falha de agendamento), só formalizando os estados.
- Trigger por evento (`LeadCreated` da Fase 1), substituindo o sweep por cron atual (5min/15min) por reação em tempo real.
- Formalizar `CalendarProvider` como abstração (hoje já é de facto Microsoft Graph/Outlook — só parar de deixar hardcoded).

**Banco**: evolução do estado de contato IA (equivalente a `aiSdrContatoState`) sob o schema novo, ligado a `Communication`/`AIAnalysis` da Fase 2.

**Eventos**: consome `LeadCreated`; produz `LeadQualified`, `HandoffRequested`, `MeetingScheduled`.

**Integrações**: WhatsApp/Ligação (já prontos na Fase 2), Calendar (Microsoft Graph).

**Dependências**: Fase 1, Fase 2.

**Frontend (trilha paralela)**: painel de monitoramento do agente (AI Agent Monitor do blueprint), tela de configuração de estratégia/prompt, indicador de handoff pro closer.

**Risco**: o maior risco de NEGÓCIO do plano — isso substitui trabalho humano de verdade. Precisa de período de validação com shadow-review (closer ou CS acompanhando output da IA) antes de declarar "closer não faz mais qualificação manual".

**Critério de conclusão — este é o padrão de referência de "Done" pro projeto inteiro (exemplo dado pelo Kauã), aplicado literalmente**: não basta "o agente responder WhatsApp". Só está pronto quando a cadeia inteira fecha, verificável dimensão por dimensão:
- *Technical*: `Lead entrou → Agente recebeu evento → Agente executou estratégia → Resposta interpretada` funcionando de ponta a ponta em homolog, sem intervenção manual no meio.
- *Data*: `Comunicação registrada → CRM atualizado → Qualificação registrada` — nada disso fica só na cabeça do agente, tudo grava no Domain Model real (Fase 1/2).
- *Operational*: `Reunião agendada → Handoff correto → Closer recebeu contexto` — o closer abre o lead e já sabe o que aconteceu, sem perguntar pro agente ou reconstruir a conversa manualmente.
- *UX*: painel de monitoramento do agente existe e é usável (mesmo que interino, não precisa esperar Fase 7); closer vê o handoff chegando de forma clara, não como uma tarefa genérica sem contexto.
- *Observability*: `Tudo auditável → Métricas disponíveis → Fallback funcionando` — se o agente falhar ou ficar em dúvida, isso é visível e vira ação humana, nunca silêncio.

Só com as 5 fechadas — não quando "o agente responde WhatsApp" — a Fase 3 está pronta.

**O que fica disponível**: a dor real (closer sobrecarregado com qualificação) resolvida — construída sobre fundação de verdade, não sobre gambiarra.

---

## FASE 4 — Commercial (Produtos / Propostas / Contratos / Pagamentos / Won-Lost)

**Objetivo**: reconstruir proposta→contrato→pagamento sobre o Domain Model novo, implementar o gate de Won à prova de mentira (reaplicando/adaptando a lógica já construída e perdida no commit `2111650`), corrigir o bug de MRR duplicado na raiz, construir o Personalized Proposal Engine.

**Escopo**: catálogo de produto, builder de proposta (Master Template + blocos de IA controlados — não geração livre, decisão já registrada da conversa original), Contrato como opcional por Deal (não obrigatório, paralelo a Payment), Billing Provider abstrato sobre Stripe (pronto pra PBX/Holding depois), gate de Won em endpoint de ação explícito (`POST /deals/:id/win`, não escondido num PATCH genérico).

**Banco**: `products`, `proposals`, `proposal_items`, `contracts`, `subscriptions` — schema novo substituindo `propostas`/`contratos`/`assinaturas` via migração.

**Eventos**: `ProposalCreated/Sent/Viewed`, `ContractSigned`, `PaymentSucceeded/Failed`, `DealWon/Lost`.

**Migração — a mais sensível financeiramente**: reaplicar a lógica dos 3 casos já desenhada (upsell confirmado / obsoleto confirmado / ambíguo sem assinatura) sobre o schema novo, com checkpoint humano explícito antes de aplicar qualquer correção em massa — mesmo rigor do plano antigo (`PLANO-MRR-CONTRATOS-DUPLICADOS.md`), agora numa base que não vai duplicar de novo.

**Decisão pendente que precisa fechar nesta fase**: a terceira via de evidência de Won pra venda de PBX que não passa pelo Stripe (atestação manual com dupla aprovação + audit log obrigatório) — push-back de arquiteto já registrado, não resolvido ainda.

**Dependências**: Fase 1 (Deal/Company/Customer), Fase 0 (audit log pra decisão de Won).

**Frontend (trilha paralela)**: Proposal Builder, Proposal Preview, Contract/Signature, Product Catalog — desenhados nesta fase, prontos pra Fase 7.

**Risco**: o maior risco FINANCEIRO do plano — corre em paralelo ao sistema antigo com reconciliação validada antes de qualquer corte de fonte de verdade.

**Critério de conclusão (5 dimensões de "Done")**:
- *Technical*: gate de Won novo no ar (`POST /deals/:id/win` validando evidência), Billing Provider abstrato sobre Stripe funcionando.
- *Data*: zero contrato duplicado novo criado pelo sync; discrepância de MRR antiga reconciliada caso a caso com decisão documentada (não heurística automática).
- *Operational*: vendedor não consegue mais marcar "ganho" sem evidência válida — e sabe exatamente por quê quando o sistema recusa, sem precisar chamar suporte técnico pra entender.
- *UX*: Proposal Builder/Preview/Contract já implementados a partir do desenho da trilha paralela, não construídos do zero aqui.
- *Observability*: todo Won gerado tem o evento que o originou (contrato assinado ou pagamento) auditável; caminho de evidência pra PBX decidido e documentado, não pendente.

**O que fica disponível**: números de receita em que se pode confiar — a outra dor real resolvida.

---

## FASE 5 — Cadência & Motor de Automação

**Objetivo**: dar execução real ao que hoje só existe como tabela sem motor (`automacoes`) e ao Cadence Builder configurável — substituindo tanto o array hardcoded de 13 toques quanto o CRUD sem executor atual.

**Escopo**: entidade `Cadence` (steps/enrollment/exit rules), entidade `Automation` (trigger/condition/action/execution_history), builder visual, migrar o conteúdo/copy dos 13 toques do playbook atual pra definições orientadas a dado (preservar o conhecimento, reconstruir o mecanismo).

**Dependências**: Fase 0 (eventos), Fase 3 (o AI SDR já é event-driven — o motor de cadência generaliza esse padrão pra toques não-IA também), Fase 2 (canais).

**Frontend (trilha paralela)**: Cadence Builder visual, Automation Builder, Automation Logs.

**Risco**: médio.

**Critério de conclusão (5 dimensões de "Done")**:
- *Technical*: motor de execução real lendo `Cadence`/`Automation` e disparando ação por evento (não cron cru).
- *Data*: as automações hoje hardcoded no worker (SLA, follow-up, renovação, reativação de perdido) reimplementadas como registros configuráveis, não código — com histórico de execução gravado.
- *Operational*: time de operações cria/edita automação sem pedir código a ninguém.
- *UX*: Cadence/Automation Builder implementados a partir do desenho já validado na trilha paralela.
- *Observability*: toda execução de automação tem log (`execution_history`) consultável — se uma automação falhar silenciosamente hoje, isso não pode se repetir aqui.

**O que fica disponível**: time de operações cria/edita automação sem pedir código.

---

## FASE 6 — Analytics, Data Quality & Command Center

**Objetivo**: separar Analytics do banco operacional (projeções via evento, não join pesado em produção), construir o Data Quality Layer (os 10 checks do bloco 82 — mapeiam quase 1:1 pros bugs reais já achados), construir o Command Center/Next Best Action como landing padrão.

**Nota de sequenciamento**: uma versão fina do Command Center (lista de follow-up atrasado, reunião do dia, proposta sem resposta) pode nascer logo depois da Fase 4, em paralelo com o resto desta fase — não precisa esperar o Analytics Layer completo pra existir, é majoritariamente um problema de agregação sobre o Domain Model já pronto.

**Frontend (trilha paralela)**: Command Center completo, Sales/Pipeline/Revenue/SDR Analytics, Forecast — versão fina do Command Center pode já ter sido implementada antes (ver nota de sequenciamento acima).

**Dependências**: Fases 1-4 (precisa de dado de Deal/Commercial pra ser útil).

**Critério de conclusão (5 dimensões de "Done")**:
- *Technical*: Analytics Layer separado do OLTP (projeção por evento, não join pesado em produção).
- *Data*: Data Quality Layer com os 10 checks do bloco 82 no ar, **detectando de fato** os problemas históricos já conhecidos (é o teste de que funciona — se não detectar o que já sabemos que existe, não está pronto).
- *Operational*: gestor entra no Command Center e sabe o que fazer no dia, sem precisar perguntar pro time ("o que está travado?").
- *UX*: Command Center substitui o Dashboard antigo como landing padrão, implementado a partir do desenho já validado.
- *Observability*: o próprio painel de Data Quality é a observabilidade do dado — mas precisa ter alerta, não só número passivo que ninguém olha.

**O que fica disponível**: confiança real no dado + a peça que mais reduz overhead de coordenação pro time pequeno.

---

## FASE 7 — Frontend/UX: implementação do que já foi desenhado

**Objetivo**: **não é "hora de desenhar a UI"** — isso já vem acontecendo em paralelo desde a Fase 1. É a hora de implementar, com o design system do Figma já validado, o que a trilha paralela produziu fase a fase: Command Center, Lead/Deal/Company/Contact, Timeline unificada, painel do AI SDR, Proposal Builder, Cadence/Automation Builder, Analytics. Junto com isso, unificar o padrão de Drawer (já bom hoje, só precisa das peças que faltam — reviver o `Topbar` órfão, dar paridade ao `ContratoDrawer`, ligar `react-hook-form`+`zod` que já estão instalados mas nunca usados), estados de loading/empty/error consistentes.

**Correção 08/08 sobre o "porquê"**: a instrução do Kauã nunca foi "não toque em frontend até o backend acabar" — foi "não desenhe UI antes de saber o que o produto precisa ser". Como o design já foi feito em paralelo com conhecimento real do domínio (não no vácuo), esta fase é mais rápida do que seria se começasse do zero aqui.

**Dependências**: essencialmente todas as fases de backend (a UI expõe os dados delas) + os entregáveis de design acumulados desde a Fase 1.

**Critério de conclusão (5 dimensões de "Done")**:
- *Technical*: todas as telas do inventário do blueprint (bloco 9) implementadas sobre o Domain Model novo.
- *Data*: nenhuma tela lê mais do schema legado — tudo consome o Domain Model da Fase 1-6.
- *Operational*: vendedor/gestor conseguem trabalhar o dia inteiro sem precisar do schema antigo aberto em nenhuma tela.
- *UX*: design system aplicado de forma consistente (não é mais “cada Drawer reimplementa sua própria seção”).
- *Observability*: erro de UI (falha de fetch, permissão negada) tem mensagem compreensível, nunca tela branca ou "undefined".

---

## FASE 8 — Migração completa / Cutover / Decomissão do legado

**Objetivo**: fechar o strangler pattern — cortar os caminhos de leitura/escrita restantes do schema legado pro novo, decomissionar código morto (rotas Next.js duplicadas, filas mortas como `cipa-analysis`, componentes órfãos), validação controlada (contagem/integridade/relacionamentos/valores/ownership/status/receita, exatamente como o bloco 65 do blueprint já define).

**Dependências**: todas as fases anteriores estáveis em produção por um período de "burn-in" definido.

**Critério de conclusão (5 dimensões de "Done")**: *Technical* — zero rota/tabela legada recebendo tráfego real; *Data* — validação final por contagem/integridade/relacionamento/valor/ownership/status/receita (bloco 65) aprovada; *Operational* — ninguém no time precisa mais do sistema antigo pra nada; *UX* — nenhuma tela aponta pro schema velho; *Observability* — dashboard de "saúde da migração" zerado (sem escrita remanescente no legado).

---

## FASE 9 — Ecosystem Readiness (CS/Onboarding, Finance, Business Hub)

**Objetivo**: publicar os contratos de evento (`DealWon`, `CustomerCreated`, etc.) como superfície real de integração pros sistemas futuros — API-first, webhooks, IDs globais já estabelecidos desde a Fase 0/1. Essa fase é sobretudo documentar/publicar o contrato e construir o primeiro consumidor real (mesmo que um stub) pra provar que funciona.

**Critério de conclusão (5 dimensões de "Done")**: *Technical* — contrato de evento publicado e versionado; *Data* — IDs globais consistentes entre CRM e o primeiro consumidor externo; *Operational* — o stub consumidor processa um evento real de ponta a ponta sem intervenção manual; *UX* — nenhuma tela nova aqui, é infraestrutura de integração; *Observability* — todo evento publicado é rastreável até o consumidor (ou até a ausência de consumidor, sem se perder).

---

## Decisões ainda pendentes que bloqueiam alguma fase específica

1. Terceira via de evidência de Won pra venda de PBX (bloqueia fechamento pleno da Fase 4).
2. Confirmação dos 2 achados técnicos não verificados — assinaturas fora do espelho, reuniões travadas (bloqueia o critério de conclusão da Fase 0).
3. Definição de mecanismo jurídico/tecnológico de assinatura eletrônica (`SignatureProvider`) — não bloqueia nenhuma fase agora, só precisa da interface abstrata pronta na Fase 4.

---

*Este plano é vivo — atualizar conforme cada fase avança ou decisão nova aparecer. Detalhe de cruzamento current-state × blueprint × conversa original em `blueprint-crm2-vs-current-state.md`.*
