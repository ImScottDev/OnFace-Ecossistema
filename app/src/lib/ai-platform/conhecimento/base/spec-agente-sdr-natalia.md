---
slug: spec-agente-sdr-natalia
nome: Spec do agente SDR legado (Natália)
categoria: processo
governanca: historico
origem: vault:02_PROJETOS/Callface/CRM/produto/ai-sdr-agente-spec.md
nota: arquitetura legada substituída; não é verdade comercial atual
gerado_em: 2026-10-12
---

# Spec — Agente SDR de IA (WhatsApp autônomo) — Callface CRM

> Objetivo: todo lead que cai em **Pré-vendas → Novo** é contatado sozinho pela IA via WhatsApp, movido automaticamente pro fluxo certo, qualificado, e — se fizer sentido — tem uma reunião de 30min marcada com uma das closers (alternando entre elas), com confirmação automática no dia da reunião. 100% humanizado (o lead não deve perceber que fala com uma IA, salvo quando pedir handoff).
>
> Conecta com: playbook-sdr (conteúdo/tom que a IA usa) · crm-callface-status (status geral do CRM) · project_crm_callface (memória)

## Atualização canônica — 08/09/2026

- O agente SDR passa a ser executado pelo motor geral de automações e cadências do CRM2. Entrada em Pré-vendas/Novo e tags configuradas podem iniciar o fluxo.
- A autonomia esperada cobre o ciclo operacional: construir contexto do CRM, iniciar conversa, qualificar, registrar dados/timeline, atualizar tags e etapa, agendar reunião real e entregar ao humano com resumo e motivo.
- WhatsApp é canal principal; ligação pela Callface AI pode ser uma ação/tool liberada na configuração do agente, com horário, limite, idempotência e auditoria.
- Tags em Lead, Negócio, Oportunidade e Cliente podem disparar, condicionar, ramificar, pausar ou encerrar automações.
- O estado antigo desta nota serve como histórico. A fonte atual é crm-handoff-atual e a implementação deve reaproveitar as fundações nativas de agentes, cadências e `event_outbox` já presentes no CRM2 local.

---

## 0. O fluxo confirmado (10/07/2026)

```
Lead cai em NOVO (pending)
   → IA manda 1ª mensagem automaticamente
   → move pra EM CONTATO (contacted) + responsável = "Agente SDR"
   → IA tenta qualificar por até 2 DIAS (com tentativas de follow-up se o lead não responder)
      ├─ Qualificou + agendou reunião → cria negócio + reunião real, lead aparece como "Qualificado" (mirror)
      └─ Passou 2 dias sem qualificar → move pra FOLLOW UP (qualifying) + responsável = Jenifer (humana assume)
```

Mapeamento pros nomes reais no código (confirmado, não são conceitos novos):

| Nome que o Kauã usa | `sdr_status` | Label no board (`lib/crm/pipeline.ts`) |
|---|---|---|
| Novo | `pending` | "Novo" |
| Em Contato | `contacted` | "Em Contato" |
| Follow-up | `qualifying` | "Follow up" *(já existe com esse label exato — coincidência boa, é literalmente a coluna que o Kauã descreveu)* |

Closers reais confirmadas no banco (role=`closer`, ativas): **Mayara Anjos** ([e-mail removido]) e **Mayra Schincariol** ([e-mail removido]) — nomes parecidos, atenção redobrada pra não trocar na hora de codar o round-robin. Jenifer Matos (role=`sdr`) é quem já recebe hoje os leads escalados (confirmado no job existente).

---

## 1. Estado real do código (auditado 10/07/2026)

| Peça | Onde | Status |
|---|---|---|
| Motor LLM (tool-use) | `app/src/lib/ai/sdr.ts` | ✅ Pronto — tools: `respond`, `qualify_lead`, `handoff`, `advance_stage`, `schedule_meeting`, `update_summary`. Hoje usa Groq (API OpenAI-compatible) — **vai trocar pra OpenAI de verdade** (ver seção 2). |
| Webhook WhatsApp → IA responde quando lead manda mensagem | `worker/index.ts` (`handleAiSdrResponse`) | ✅ Pronto e conectado |
| Config (prompt, horário comercial, rate limit, handoff, stage config) | `/configuracoes/ai-sdr` + `api-server/routes/ai-sdr.ts` | ✅ Pronto |
| Estado por conversa + auditoria de decisões | `ai_sdr_contato_state`, `ai_sdr_logs` | ✅ Pronto |
| **Motor desligado** | `.env` sem chave de LLM, `ai_sdr_config.ativo=false` | ⚠️ Ninguém ligou ainda |
| Job de escalação por tempo parado | `lib/crm/sdr-escalation.ts`, roda a cada 15min | ✅ Existe — já move `contacted`→`qualifying` e reatribui pra **Jenifer** exatamente como o Kauã descreveu. **Só o prazo está errado: hoje é 6h (`SDR_CONTATO_ESCALATION_HOURS`), precisa virar 48h (2 dias).** Mudança de 1 constante. |
| Disparo automático do 1º contato (Novo → Em Contato sozinho) | — | ❌ Não existe. Só existe o painel de cadência manual (07/07), SDR humana clica. |
| "Agente SDR" como responsável visível no board | — | ❌ Não existe usuário/pseudo-usuário representando a IA. |
| Tentativas de follow-up automático dentro da janela de 2 dias (se lead não responde) | — | ❌ Não existe. O motor só reage quando o lead manda mensagem — nada re-inicia contato sozinho. |
| Agendamento real de reunião | tool `schedule_meeting` | ❌ Hoje só cria uma tarefa interna avisando admin, **não cria negócio nem reunião real**. Zero sistema de disponibilidade/agenda no repo (nem nativo, nem Outlook, nem Calendly). |
| Confirmação de reunião no dia | — | ❌ Não existe. |
| Gate de qualificação por score | `lib/crm/lead-scoring.ts` (regras) vs extração da IA (`qualify_lead`) | ⚠️ Existem os dois, não conversam, nenhum trava o agendamento — **decidido ficar livre no MVP** |

---

## 2. Troca de LLM: Groq → OpenAI

Decisão do Kauã (10/07): usar uma LLM da OpenAI em vez do Groq.

**Impacto técnico (baixo, mas precisa ser feito com cuidado):**
- `lib/ai/sdr.ts` usa o SDK da OpenAI apontando pro endpoint do Groq (Groq é compatível) — trocar a `baseURL` pro endpoint real da OpenAI e a chave de `GROQ_API_KEY` pra `OPENAI_API_KEY`.
- A coluna `ai_sdr_config.groq_api_key` tem nome amarrado ao Groq — **migration simples pra renomear** (`llm_api_key`) e adicionar `llm_provider` (só por organização, sem necessidade de multi-provider agora, mas evita esse retrabalho de novo se trocar de LLM de novo no futuro).
- O prompt sanitizer em `sdr.ts` tem regras específicas pra "leaks" de tool call do Llama/Groq (ex.: `<function=respond>` vazando como texto) — com OpenAI isso tende a não acontecer (tool-use da OpenAI é mais consistente), mas vale manter o sanitizer como rede de segurança, não remover.

**Decidido (Kauã, 10/07): modelo `gpt-4o-mini`** — custo baixo, suficiente pro script guiado de qualificação. Reavaliar upgrade pra `gpt-4o` se a qualidade de conversa não sustentar volume real.

---

## 3. Escopo

**Dentro do escopo:**
1. Ativação do motor de IA já existente, com OpenAI (Fase 0).
2. Automação completa Novo → Em Contato → (qualificado | Follow-up 2 dias → Jenifer) (Fase 1).
3. Calendário nativo no CRM: horário padrão seg-sex 9h-18h, bloqueios manuais/pausa de almoço, round-robin Mayara/Mayra, agendamento real de 30min (Fase 2).
4. Confirmação de reunião no dia (Fase 3).
5. Handoff pro humano quando a IA não sabe responder, lead pede atendente, ou sinaliza objeção forte/reclamação.
6. Correção dos 2 bugs de estado achados na auditoria (seção 6) — **pré-requisito da Fase 1/2**, não é opcional.

**Fora do escopo (não mexer agora):**
- BDR/outbound (motor RFB, playbook próprio, prospeccao-outbound).
- Conectar calendário nativo com Outlook real (fica pra fase futura, ver seção 6).
- Reescrever o motor de IA do zero — ele já funciona, o trabalho é trocar o provider e plugar as peças que faltam.
- Voice/Callpilot (isso é telefonia; este agente é 100% texto/WhatsApp).

---

## 4. Fase 0 — Ligar o motor em piloto controlado (com OpenAI)

**Objetivo:** provar que a conversa da IA funciona bem (tom, latência, humanização) antes de plugar automação de disparo/agenda.

**O que fazer:**
- Trocar client de Groq pra OpenAI (seção 2), configurar `OPENAI_API_KEY` em homolog.
- Ativar `ai_sdr_config.ativo=true` só pra uma conversa de teste (número pessoal do Kauã conectado como sessão WhatsApp).
- Revisar/ajustar `system_prompt`, `style_guide` e `knowledge_base` usando o playbook-sdr (script de qualificação, matriz de perguntas, objeções, tom Clint consultivo — sem travessão, sem "rapidão").
- Rodar conversas de teste manuais (Kauã simulando lead) e revisar os logs (`ai_sdr_logs`) pra calibrar.

**Critérios de aceite:**
- [ ] IA responde rápido, sem soar robótica, respeitando o tom do playbook.
- [ ] `qualify_lead` extrai corretamente os campos-chave (empresa, cargo, dor, volume de ligações) numa conversa de teste completa.
- [ ] `handoff` dispara corretamente quando a conversa foge do script.
- [ ] Logs em `ai_sdr_logs` mostram decisão + motivo pra cada mensagem (auditável).

---

## 5. Fase 1 — Automação Novo → Em Contato → Follow-up

**Objetivo:** exatamente o fluxo da seção 0, sem intervenção humana até o ponto de escalação ou de reunião marcada.

**O que construir:**

2. **Cadência de retentativa automática dentro da janela de 2 dias (decidido, Kauã 10/07): ~4h, ~24h, ~40h** após o primeiro contato, se o lead não responder. 3 tentativas antes de escalar em 48h. Isso não existe hoje: o motor só reage quando o lead escreve. Precisa de um job novo (mesmo padrão do `sdr-followup-escalation`) que verifica leads em `contacted` sem resposta e manda a próxima mensagem da sequência.
3. **Escalação em 48h:** reaproveitar o job `sdr-followup-escalation` já existente — só mudar `SDR_CONTATO_ESCALATION_HOURS` de 6 pra 48. Ele já reatribui pra Jenifer e já move pra `qualifying` ("Follow up"). **Não precisa reescrever, só ajustar a constante** — mas só depois de corrigir o bug da seção 8 (a IA hoje já usa `qualifying` com outro sentido).
4. **Se qualificar dentro da janela:** segue pro fluxo de agendamento (Fase 2).

**Critérios de aceite:**
- [ ] Lead novo recebe a primeira mensagem da IA automaticamente, sem clique humano, e o card já aparece em "Em Contato" com responsável "Agente SDR".
- [ ] Lead que não responde recebe tentativas de follow-up automáticas dentro da janela de 2 dias (não fica em silêncio esperando o prazo estourar).
- [ ] Lead que passa 2 dias em "Em Contato" sem qualificar move sozinho pra "Follow up" com a Jenifer como responsável (reaproveitando o job existente, só com o prazo certo).
- [ ] Lead que responde e está sendo ativamente qualificado pela IA **não** aparece incorretamente na coluna "Follow up" (é o bug da seção 8 corrigido).

---

## 6. Fase 2 — Calendário nativo + agendamento real

**Objetivo:** quando a IA decide oferecer reunião (`schedule_meeting`), ela consulta a disponibilidade real das closers dentro do próprio CRM, alterna entre as duas, e cria a reunião de verdade (não só uma tarefa interna).

**Regras de disponibilidade (confirmadas com Kauã):**
- Padrão: **segunda a sexta, 9h às 18h**, igual pras duas closers.
- Cada closer precisa poder, dentro do CRM: **marcar reunião manualmente** (bloqueia o horário pra IA não oferecer de novo), **bloquear um período** (compromisso externo, ausência), e **configurar pausa de almoço** (bloqueio recorrente diário).
- **Round-robin simples entre Mayara Anjos e Mayra Schincariol:** alterna estritamente 1-1 a cada reunião marcada (não é "quem tem mais vaga" — é ordem de chegada, uma pra cada). Precisa de um ponteiro/contador persistente (ex: campo simples guardando "última closer que recebeu reunião") pra saber de quem é a vez.

**CORREÇÃO IMPORTANTE (10/07, Kauã pegou um erro meu na leitura do código):** o mecanismo de "mover pra Qualificado cria negócio+reunião automaticamente" **já existe e já é usado hoje, de forma manual** — não precisa ser construído do zero. É o endpoint `POST /leads/:id/converter-oportunidade` (`api-server/routes/leads.ts`), chamado hoje pelo `SdrStageControl.tsx` / board de pré-vendas quando a SDR humana arrasta o card pra "Qualificado" ou usa o modal de agendar reunião. Esse endpoint já:
- cria o **negócio** (status `reuniao_agendada`, vinculado ao lead/empresa, com o `closerId` informado como responsável);
- cria a **reunião** de verdade na tabela `reunioes` (aceita `{ data, tipo, duracao, titulo, notas, link }` no corpo da requisição);
- seta `lead.sdrStatus='qualified'`.

Ou seja: **isso não é um "Bug #2" a corrigir do zero** (eu errei ao descrever assim) — é uma peça pronta que só precisa ser **reaproveitada pelo lado da IA**. A automação da Fase 2 é: a IA, dentro do `schedule_meeting`, chama esse mesmo endpoint/lógica (server-side, sem precisar do HTTP round-trip) passando `closerId` (do round-robin) + `reuniao.data` (do slot escolhido) — em vez de só criar uma tarefa avisando o admin como faz hoje. **O caminho manual continua existindo exatamente como está**, intocado — a IA só passa a chamar a mesma porta de entrada.

**O que de fato precisa ser construído (isso sim é novo):**
- Tabela nova de disponibilidade por closer: horário de trabalho recorrente (dias + hora início/fim) + bloqueios pontuais (inclui o tipo "almoço" como bloqueio diário recorrente).
- UI simples pra cada closer configurar isso (Configurações ou perfil do usuário) — sem isso configurado, a closer não entra no round-robin.
- Cálculo de slots livres: horário de trabalho − reuniões já existentes (`reunioes`, que já tem `data`+`duracao`) − bloqueios manuais = janelas de 30min livres.
- Lógica de round-robin (ponteiro/contador de qual closer recebe a próxima reunião).
- No `schedule_meeting` (worker): decidir de quem é a vez (round-robin), consultar os slots livres dela, oferecer 2-3 horários reais na conversa de WhatsApp, e ao confirmar, **chamar a lógica de `converter-oportunidade` já existente** com `closerId` + `reuniao.data` preenchidos.

**Critérios de aceite:**
- [ ] Closer configura a própria janela de trabalho + pausa de almoço em poucos minutos.
- [ ] IA nunca oferece um horário que colida com reunião já marcada, bloqueio manual ou almoço.
- [ ] Reuniões marcadas alternam corretamente entre Mayara e Mayra (1 pra cada, na ordem).
- [ ] Reunião marcada aparece automaticamente em `reunioes` E o lead aparece corretamente como "Qualificado" no board, com o negócio criado do jeito que já acontece no fluxo manual hoje.
- [ ] Lead recebe a confirmação da reunião marcada (closer, data, hora) na mesma conversa de WhatsApp.
- [ ] Fluxo manual (SDR humana arrastando card / usando o modal de agendar) continua funcionando exatamente como hoje, sem regressão.

---

## 7. Fase 3 — Confirmação de reunião no dia

**Objetivo:** reduzir no-show. Requisito confirmado pelo Kauã: mensagem **no dia** da reunião avisando que é hoje e pedindo confirmação (D-1 é opcional/bônus, não é o pedido original).

**O que construir:**
- Job agendado (1x/dia, de manhã) que busca reuniões de `reunioes` marcadas pra **hoje** → dispara confirmação via WhatsApp ("nossa reunião é hoje às Xh com [closer], tá confirmado?").
- Se o lead responder "não posso"/pedir reagendar, IA reabre o fluxo de agendamento (Fase 2) em vez de só marcar como no-show.

**Critérios de aceite:**
- [ ] Toda reunião marcada pra hoje recebe confirmação automática.
- [ ] Lead que responde "não posso" é redirecionado pro fluxo de reagendamento.
- [ ] Reunião confirmada/desmarcada fica registrada no CRM.

---

## 8. Bug real achado na auditoria (corrigir ANTES de ligar a automação)

**Bug — Colisão de significado no status `qualifying`.**
No `advance_stage` (worker), quando o lead simplesmente **responde** a IA (`novoStatus="respondeu"`), o código seta `sdrStatus="qualifying"` — que é EXATAMENTE o mesmo valor que o board mostra como coluna **"Follow up"** (a coluna que devia significar "IA não conseguiu em 2 dias, Jenifer assume"). Ou seja, do jeito que está hoje, no minuto em que um lead responde a primeira mensagem da IA, ele já pularia pra "Follow up" — o oposto do que devia acontecer (ele devia continuar em "Em Contato" enquanto a IA conversa ativamente). **Fix:** remover/renomear essa transição — lead que responde continua em `contacted` durante toda a conversa ativa da IA; só o job de escalação (48h sem qualificar) deve setar `qualifying`.

*(O que eu tinha chamado de "Bug #2" — `schedule_meeting` não criar negócio — **não é bem um bug**: o mecanismo de criar negócio+reunião já existe e funciona hoje via `converter-oportunidade`, só não estava sendo chamado pelo lado da IA. Corrigido na seção 6 — é reaproveitamento, não conserto.)*

---

## 9. Riscos / decisões em aberto

1. **Outlook fica pra fase futura** (fora deste spec): conectar o calendário nativo com o Outlook real via Microsoft Graph (`Calendars.ReadWrite`) quando fizer sentido — a base OAuth já existe pro email, só falta estender o escopo e criar o sync. Até lá, agenda vive só dentro do CRM.
2. ~~Cadência exata de retentativa dentro dos 2 dias~~ **Decidido: ~4h, ~24h, ~40h.**
3. ~~Modelo OpenAI a usar~~ **Decidido: `gpt-4o-mini`.**
4. **Custo de LLM** — monitorar tokens/mês via `ai_sdr_logs` assim que o piloto rodar volume real (upgrade pra `gpt-4o` se necessário).
5. **Gate de qualificação por score** — decidido ficar livre no MVP; reavaliar após ver taxa de reuniões mal qualificadas nas primeiras semanas.
6. **O que acontece com o painel de cadência manual (07/07)?** Ele fica redundante pra leads novos (a IA assume o disparo). Decidir se continua existindo só pra casos de handoff manual, ou se é aposentado.

---

## 11. Progresso (código já alterado em `callface-crm` local, ainda NÃO deployado em homolog)

**TUDO ABAIXO ESTÁ NO AR EM HOMOLOG (10/07), aguardando só o teste de ponta a ponta:**

- ✅ **LLM trocado de Groq pra OpenAI** (`lib/ai/sdr.ts` + endpoint de style guide), modelo `gpt-4o-mini`. Chave real do Kauã configurada no `.env` de homolog (não versionada em lugar nenhum).
- ✅ **Bug da seção 8 corrigido**: lead que só respondeu não pula mais pra "Follow up" incorretamente.
- ✅ **Escalação: 6h → 48h** (2 dias) em `SDR_CONTATO_ESCALATION_HOURS`.
- ✅ **Fase 1 completa**: job `ai-sdr-outreach` (roda a cada 5min, dispara 1º contato automático pra lead em "Novo", move pra "Em Contato", responsável = usuário pseudo **Natália**) + job `ai-sdr-retry` (a cada 15min, retentativa em ~4h/~24h/~40h se o lead não responder, com trava de segurança que nunca manda retry em cima de conversa ativa).
- ✅ **Fase 2 completa**: tabelas `closer_disponibilidade`/`closer_bloqueios` (migration `0007`), `lib/crm/agenda-closers.ts` (round-robin stateless + cálculo de slot livre), `schedule_meeting` da IA agora chama a MESMA função `converterLeadEmOportunidade` que o fluxo manual usa (extraída de `converter-oportunidade.ts`) — cria negócio+reunião de verdade, e suporta remarcação (lead pede outro horário antes da reunião acontecer).
- ✅ **Fase 3 completa**: job `ai-sdr-meeting-confirmation` (cron 9h da manhã), manda confirmação de reunião marcada pro dia, evita duplicar via marker na timeline.
- ✅ **Persona Natália aplicada**: `ai_sdr_config.system_prompt` da org com toda a personalidade/fluxo mental/regras que você mandou (2976 caracteres), `nome_assistente='Natália'`, `ativo=true`.

- ✅ Migration aplicada, código sincronizado, containers `app`/`api`/`worker` rebuildados e healthy em homolog.

**O que NÃO foi feito (gaps conhecidos, na sua lista pra próxima rodada):**
- ❌ **UI pra Mayara/Mayra ajustarem a própria disponibilidade.** Hoje só existe via SQL (o que eu configurei). Funciona pro teste, mas elas não têm como bloquear um dia ou mudar horário sozinhas ainda.
- ❌ **Remarcação 100% automática não é garantida.** O código já suporta (ver Fase 2), mas se o lead pedir pra remarcar depois que a reunião já aconteceu/avançou no pipeline do closer, cai em handoff manual — não tentei automatizar esse caso extremo.
- ⚠️ **Coluna `groq_api_key`/`groqApiKey`** mantida sem renomear (cosmético, baixo risco).

## 10a. Bug meu — corrigido (10/07, mesma sessão): sessão da Natália não conectava

Ao seedar a sessão WhatsApp da Natália eu só criei a linha na tabela `whatsapp_sessao` do CRM, sem registrar ela de fato na **wuzapi** (o servidor que fala com o WhatsApp de verdade). Sem esse registro, o token ficava vazio e o botão "Conectar" nunca gerava QR — o Kauã tentou e não rolou. **A wuzapi em si estava (e está) ativa e saudável** (as outras 4 sessões — Mayra, Mayara Anjos, Jenifer Ferreira, Scott Growth — seguem rodando normal nela); o problema era só o registro faltando pra Natália.

**Corrigido:** registrado o usuário "natalia" na wuzapi via `/admin/users` (mesmo endpoint que o botão "criar sessão" da UI usa), webhook apontando pro **homolog** (`https://homolog.crm.callface.io/api/whatsapp/webhook` — diferente das sessões antigas, que foram clonadas do prod e ainda apontam pro webhook de prod), token real gerado e salvo em `whatsapp_sessao.api_token`. Testado: `GET /session/status` responde 200 (`loggedIn:false`, aguardando QR).

## 10b. INCIDENTE REAL (10/07): a IA mandou mensagem pra 20 leads reais do backlog

Ao ligar `ai_sdr_config.ativo=true` pela primeira vez, o job `ai-sdr-outreach` não tinha NENHUM filtro de recência — ele pegava **todo lead `tipo=lead` e `sdr_status=pending`** no banco, sem distinguir "acabou de cair em Novo" de "está pending há semanas". Homolog é clone de prod e tem milhares de leads antigos parados em `pending` (backlog de prospecção nunca trabalhado). Resultado: no minuto em que o motor ligou, ele varreu e mandou mensagem de WhatsApp pra **20 pessoas reais** (nomes/telefones reais de prospecção de 02/07), não só pro lead de teste João.

**Ação imediata (nesta ordem):** `ai_sdr_config.ativo=false` (para tudo instantaneamente) → esvaziada a fila `bull:whatsapp-outgoing:wait` (8 mensagens que ainda não tinham saído, removidas antes de disparar) → os 20 leads revertidos pro estado original (`sdr_status=pending`, responsável/timestamps limpos, `ai_ativo=false` no estado da conversa) → **não dá pra desmandar as mensagens que já saíram**, isso já foi.

**Fix aplicado (`worker/index.ts`, `runAiSdrFirstContactSweep`):** adicionado filtro `createdAt >= now() - 2h` — o sweep agora só pode pegar lead que caiu em Novo nas últimas 2 horas, nunca backlog histórico. Verificado antes de religar: a query com o filtro novo retorna **só o João**. Motor religado (`ativo=true`) só depois dessa verificação.

**Lição pra não repetir:** qualquer automação que varre "todo registro que bate uma condição" precisa considerar que o banco pode ter histórico acumulado — condição por status sozinha não basta, precisa de corte temporal ou de um flag explícito de "isso é novo". Vale revisitar esse mesmo risco antes de promover pra prod (prod também tem 2500+ leads antigos, alguns podem estar em `pending`).

## 10. Como testar (próximo passo, com o Kauã)

1. Entrar em homolog (`https://homolog.crm.callface.io`), ir em Configurações → WhatsApp, achar a sessão "Natália (Agente SDR)" e escanear o QR com o número de teste (seu, por enquanto). Já deve gerar QR normalmente agora.
2. Criar/mover um lead de teste pra "Novo" no board Pré-vendas (ou esperar o próximo lead real de teste).
3. Em até 5min o job `ai-sdr-outreach` deve disparar a 1ª mensagem sozinho, mover o card pra "Em Contato" com responsável "Natália (Agente SDR)".
4. Responder pelo WhatsApp simulando o lead, conduzir a conversa até o ponto de qualificar/agendar, ver se a IA oferece horário real (batendo com a disponibilidade seedada) e cria a reunião de verdade.
5. Conferir logs: `docker logs callface-crm-homolog-worker -f` no EC2 mostra `[AI-SDR-Outreach]`, `[AI-SDR-Retry]`, `[AI-SDR-Confirmacao]` e `[AI-SDR]` (reativo).

Tudo isso é **só homolog**. Prod está intocado — só sobe depois que você validar.
