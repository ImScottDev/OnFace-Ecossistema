# Plano — Ligação automática de IA (Callpilot) para leads "Novo" + agendamento real

> Fase 0 executada em 2026-07-23 (investigação de código + Playwright na Callface).
> **Resultado: bloqueador real confirmado.** Detalhado abaixo, com 2 caminhos possíveis
> pra decisão do Kauã antes de seguir pra Fase 2/3. Fase 1 (fix de fila+agenda) é
> pré-requisito sem ambiguidade — implementada nesta mesma rodada, ver seção 4.
> Tickets ficam AQUI, não no Linear (regra confirmada de novo por escrito, 22/07).

---

## 1. O bloqueador (Fase 0 — Callface)

**Achado central:** a Callface usa a MESMA terminologia do ElevenLabs Conversational
AI (System Prompt, First Message, Data Collection, Voice) — é quase certeza que o
produto de agentes de IA deles é construído em cima dessa infraestrutura. Isso
importa porque confirma que **variável dinâmica por chamada é um recurso real da
plataforma**, não uma limitação de produto: o aviso literal no upload de campanha diz

> "Lembre-se de adicionar uma coluna para cada **variável dinâmica** especificada na
> criação do agente."

Ou seja: qualquer `{{variavel}}` escrito no System Prompt ou no First Message do
agente pode ser alimentado por uma coluna da planilha — dá pra ter
`{{horario_opcao_1}}`, `{{closer_nome}}` etc., exatamente como o roteiro da Nathália
precisa.

**O problema não é a existência do recurso — é o caminho de acionamento:**

1. O único jeito de rotear um contato pra um **agente de IA específico** é criar
   uma campanha nova pela tela "Agentes → Nova Campanha", com upload manual de
   `.xlsx/.xls/.csv`. É por ali que as colunas viram variável.
2. O endpoint de API que já usamos (`POST /webhooks/events/create-contact`,
   `{name, phone}`) **cai sempre na mesma campanha fixa "Funil Callface" da
   organização — que não está vinculada a nenhum agente de IA** (confirmado
   comparando: campanhas criadas via upload mostram o nome do agente como
   subtítulo — "Teste" → *Assistente de vendas GBPA"; a "Funil Callface" não
   mostra agente nenhum). Testei mandar campos extras nesse endpoint
   (`horario_opcao_1`, `closer_nome`) — a API aceita 201 silenciosamente, mas não
   há evidência de que isso vire variável de verdade (não está documentado, e o
   contato cai na campanha sem agente de qualquer forma).
3. **Não existe API nem opção de UI pra adicionar contato a uma campanha JÁ
   existente** — o menu de ações de cada campanha só tem "Visualizar" e
   "Deletar". Cada disparo pra um agente é, por design da própria Callface, um
   lote novo.

**Conclusão técnica:** pra automatizar "lead entra em Novo → Callpilot liga
sozinho com horário real", o único caminho hoje é **Playwright criando uma
campanha nova (upload de 1 contato) a cada lead** — exatamente o cenário que o
prompt original já cogitava como bloqueador. Isso é tecnicamente possível, mas:

- **Frágil**: automação de UI quebra silenciosamente a cada mudança de layout da
  Callface (diferente de um contrato de API estável).
- **Lento**: cada lead novo precisa de um ciclo completo de browser automation
  (login/sessão, upload, confirmação) antes da ligação sair — não é "tempo real".
- **Não escala operacionalmente**: o painel já tem 29 páginas de campanhas
  avulsas; isso explodiria ainda mais rápido, uma por lead.
- **Sem confirmação de que a variável realmente chega no agente** sem configurar
  um agente de teste com uma variável simples e validar ponta a ponta — não fiz
  esse teste porque configurar o agente de produção pra isso é decisão de escopo
  (ver seção 3).

## 2. Duas alternativas concretas (decisão do Kauã antes de seguir)

**Caminho A — Playwright por lead (o que o prompt original propôs).**
Um worker novo abre uma sessão Playwright, monta um CSV de 1 linha (Telefone,
Nome, + colunas de variável), sobe pela tela de campanha do agente Nathália, e
confirma. Entrega o roteiro completo (horário real na ligação), mas com os
riscos de fragilidade/latência/escala acima. Recomendo só seguir por aqui se:
(1) o volume de leads novos/dia for baixo o suficiente pra tolerar quebra
ocasional sem virar operação crítica, e (2) alguém acompanhar de perto nas
primeiras semanas.

**Caminho B — roteiro simplificado, sem variável dinâmica (o "fallback" que o
próprio prompt já sugeriu).** O agente NÃO oferece horário real durante a
ligação — em vez disso, pergunta a disponibilidade do lead ("prefere de manhã
ou de tarde, essa semana ou a que vem?") e encerra dizendo que vai confirmar por
WhatsApp/e-mail. O sistema já resolvido nesta mesma sessão anterior
(`tentarAutoAgendar` em `lib/integrations/callface.ts`) entra exatamente aqui:
quando o webhook de retorno da ligação chega com a resposta de disponibilidade
capturada via Data Collection (recurso que já funciona bem, sem bloqueio
nenhum), o CRM cruza com a agenda real do closer da vez e confirma via
WhatsApp/e-mail. **Reaproveita 100% do que já está pronto e testado** (webhook,
parser de resumo, auto-agendamento, round-robin) e não depende de nenhum
recurso frágil da Callface. Fica um passo mais manual (a reunião não sai
100% fechada na primeira ligação), mas é a via tecnicamente mais sólida.

**Terceira opção, não excludente:** perguntar ao suporte da Callface (mesmo
canal usado pra configurar os webhooks) se o `create-contact` pode ser
estendido pra aceitar variáveis + roteamento de agente — a doc pública já
diz que "os campos exatos podem ser ajustados conforme a necessidade da sua
integração". Se topar, o Caminho A vira viável sem Playwright nenhum. Vale
perguntar antes de investir tempo no Caminho A do jeito frágil.

**Recomendação:** perguntar ao suporte primeiro (grátis, rápido); enquanto isso,
seguir com o Caminho B pra não travar o projeto — ele já está 90% construído
pelas sessões anteriores. Caminho A fica como upgrade se o suporte topar
estender a API, ou como decisão consciente do Kauã se ele preferir aceitar o
risco da automação via browser mesmo assim.

## 3. Perguntas pro time Callface (adicionar às já existentes no plano de integração)

- O `create-contact` pode aceitar campos extras que virem variável dinâmica de
  um agente específico, e/ou um parâmetro pra rotear o contato direto pra uma
  campanha de agente (em vez de sempre cair no funil manual da organização)?
- Existe uma API (mesmo que não documentada publicamente) pra criar campanha
  de agente programaticamente, equivalente ao upload de planilha?

## 4. Fase 1 — Fila de rodízio e disponibilidade real (pré-requisito, SEM bloqueio, implementado nesta rodada)

Achados do agente de investigação de código (arquivo:linha específico no relatório
completo, resumo aqui):

| # | Problema encontrado | Onde |
|---|---|---|
| P1 | **Race condition real**: `pickNextCloser` lê "última reunião" sem lock; hoje já são 3 chamadores concorrentes (SDR WhatsApp, modal manual, auto-agendamento Callface) — dois disparando quase juntos escolhem o MESMO closer e pulam a fila inteira | `lib/crm/agenda-closers.ts` |
| P2 | Sem histórico, cai pra ordem alfabética pura quando não há sinal (não é round-robin de verdade nesse caso) | idem |
| P3 | Botão de pausar rodízio **não existe em nenhuma tela** — a rota já existe (`PUT /agenda/closers/:id/pausa-rodizio`) mas zero chamadas no front | `api-server/routes/agenda.ts` |
| P4 | Dois campos parecidos sem UI que explique a diferença: `ativo` (tira de tudo) vs `pausadoRodizio` (só tira do automático) | `agenda/page.tsx` |
| P5 | **Só o fluxo manual cruza com Outlook de verdade** (`getFullAvailability` + `busyExtra`); o worker do Agente SDR de WhatsApp usa `getAvailableSlots` puro, SEM Outlook — a automação nova da Callface NÃO PODE reaproveitar esse caminho, senão oferece horário que já está ocupado | `worker/index.ts` vs `api-server/routes/agenda.ts` |
| P6 | Erro de token Outlook expirado falha silenciosamente — grava `lastError` no banco mas nenhuma tela mostra isso; "nunca conectou" e "erro agora" retornam exatamente igual (`conectadoOutlook: false`) | `lib/email/microsoft.ts` |

**Implementado e VALIDADO em homolog (23/07):**
- **CF-P1 (race condition):** `pickNextCloserLocked` em `agenda-closers.ts` — pick do closer + insert que reserva a vaga rodam na MESMA transação com `pg_advisory_xact_lock` por organização (mesmo padrão do stripe-sync). Aplicado em `tentarAutoAgendar` (o caminho ativo e crescendo). O offer-step do worker do Agente SDR (WhatsApp) tem uma race de classe diferente (pick sem reserva imediata — pinning acontece no lead, não numa reunião) que exigiria mudança de arquitetura maior; **não mexido nesta rodada porque esse motor está desligado em produção** (sem chave de LLM configurada) — sem risco real hoje. Documentado aqui pra não esquecer quando for ligado.
- **Achado NOVO durante a implementação, fora do escopo original mas crítico:** `tentarAutoAgendar` não validava se o horário que a IA "confirmou" por telefone batia com a agenda real do closer — a IA não tem visibilidade de calendário durante a ligação (é o próprio motivo do bloqueador da seção 1), então qualquer data que ela repetisse de volta era aceita cegamente. Corrigido: `closerTemConflito` (novo, CRM) + `getBusyTimes` (Outlook, best-effort) rodam DENTRO do mesmo lock antes de criar a reunião; se colidir com algo real, cai pro aviso manual em vez de duplicar a agenda do closer. **Testado com cenário forçado** (bloqueio manual no horário exato) — recusou criar o negócio/reunião, zero efeito colateral, notificação manual correta.
- **CF-P3/P4 (UI de pausa):** toggle "No rodízio"/"Rodízio pausado" na tela Minha Agenda, ao lado do "Ativo/Inativo" já existente, cada um com tooltip explicando a diferença. Testado: toggle grava no banco e reflete na hora.
- **CF-P6 (visibilidade Outlook):** card "Conta Outlook" na mesma tela, 3 estados (conectado / erro com motivo real / nunca conectado). Achado durante a implementação: a função que o caminho de AGENDA usa (`getValidAccessToken`) nunca gravava `lastError` — só a classe de e-mail gravava; corrigido, e a correção já capturou um erro real (token expirado) durante a validação.

**Deploy:** homolog (app + api + worker rebuildados; api tinha ficado de fora numa primeira leva, corrigido). Prod intocado.

## 5. Fase 2/3 — Roteiro Nathália + gatilho automático

**PENDENTE de decisão do Kauã (Caminho A/B/seção 2).** Não implementado nesta
rodada — implementar sem essa decisão seria prometer um fluxo que pode não ser
o que faz sentido pro negócio, indo contra a própria instrução do prompt
("Fase 0 é bloqueante... não prometer o roteiro completo até confirmar").

Se Caminho B for escolhido, o trabalho restante é pequeno (reaproveita tudo):
adaptar o system prompt da Nathália pra tirar a promessa de horário real e
trocar por "vou confirmar com você", configurar Data Collection pros campos
de qualificação + disponibilidade informada, e criar o job de sweep que
envia lead `pending` recém-criado (mesma trava de 2h do `ai-sdr-outreach`) pro
`enviarParaDiscagem` já existente — só que apontando pra uma campanha do
agente Nathália em vez do discador manual (ainda depende de decidir como
rotear pro agente certo, dado o achado da seção 1 — provavelmente via
Playwright de qualquer forma, mas SEM variável dinâmica o CSV fica trivial:
só Nome+Telefone, sem coluna de horário).

## 6. Decisão do Kauã (23/07) — Caminho A confirmado, validado ponta a ponta

**Kauã decidiu Caminho A** ("mesmo que ele precise criar uma nova campanha toda
vez"). Validação técnica completa feita via Playwright real (não simulação),
com o próprio Kauã confirmando por telefone real que a variável dinâmica
funcionou (recebeu a ligação, ouviu a IA falar o valor injetado).

**Passo a passo confirmado do fluxo de disparo (pra implementar na Fase 3):**
1. Montar planilha `.xlsx` (não `.csv` — Callface rejeita apesar do texto da UI
   dizer que aceita) com colunas: `Telefone` (DDD+número puro, SEM "+55" — a
   Callface já prefixa sozinha, ex: `11987654321`), `Nome`, e uma coluna por
   variável dinâmica usada no agente (nome da coluna == nome da variável).
2. Upload em Agentes → card do agente → "Nova Campanha" → confirma "Continuar"
   → "Criar campanha" (fica com status "Pendente").
3. **Ativação é um toggle `<div class="switch">` na própria tela de Agentes**,
   ao lado da campanha pendente — não tem `role`/`<input>` acessível, só dá pra
   clicar via `document.querySelectorAll('div.switch')` + `browser_evaluate`.
   **NÃO é o "Iniciar" do Discador Automático** (isso só navega pra
   `/calls?tab=campaigns`, não muda status nenhum — testado e descartado).
4. Clicar o toggle sozinho já basta: campanha vira "Em progresso" e a IA liga
   sozinha em segundos. Confirmação de retorno chega pelo webhook normal (pode
   levar alguns minutos).

**Agente de produção repaginado pra ser o agente oficial do Callpilot:** por
decisão do Kauã, o antigo "Assistente de vendas GBPA" (baixo uso, ficou sem
função clara) foi **renomeado e reconfigurado como "Nathália - Callpilot
(Leads Novos)"** — não é mais um agente de teste, é a peça de produção
definitiva do fluxo de lead "Novo". Configurado com o roteiro completo do
prompt original (seção 5 acima), variáveis `{{nome_do_lead}}`,
`{{horario_opcao_1}}`, `{{horario_opcao_2}}`, `{{horario_opcao_3}}`, e 4 campos
de Data Collection (`email_lead`, `atendimento_ligacao_essencial`,
`tamanho_time_operacional`, mais o `Data para reunião` que já existia). Voz
ficou Roberta (o campo de voz da tela 1 mostrou "Keren" durante a edição mas o
valor persistido no backend é Roberta — não afeta o roteiro, mulher jovem de
qualquer forma).

**Achado de UI**: o chip de variável dinâmica detectada só aparece visualmente
abaixo do campo **First Message** — não aparece abaixo do **System Prompt**,
mesmo com `{{variavel}}` escrito lá dentro. Não é um bloqueador (a engine da
ElevenLabs substitui variável em qualquer um dos dois campos, é só a UI de
preview que não mostra chip pro System Prompt), mas fica documentado porque no
teste anterior a validação visual do chip só foi vista no First Message — a
prova real de que a substituição funciona no System Prompt ainda depende do
próximo teste de campanha real com `horario_opcao_1/2/3` preenchidos.

**Pendente pra fechar a Fase 3:** implementar o gatilho automático (job/worker
que, quando lead entra em "Novo", monta a planilha de 1 linha com as variáveis
reais vindas da Fase 1 — fila de rodízio + `getBusyTimes` do closer da vez — e
dispara via Playwright headless a campanha na Nathália). Ainda não
implementado nesta rodada; o que existe hoje é a validação manual de que o
mecanismo funciona ponta a ponta.

**Limpeza:** das 3 campanhas de teste ("Teste Variavel Dinamica (apagar)",
"Teste Variavel v2 (apagar)", "Teste Variavel v3 (apagar)"), a tentativa de
deletar via UI retornou "Erro ao deletar campanha" — falha do lado da
Callface, não investigada a fundo (baixa prioridade, são só 3 linhas
poluindo a lista de 29 páginas de campanhas que já existe). Seguem lá, sem
efeito funcional.

## 7. Outlook — causa raiz do token expirando + teste do Kauã (23/07)

**Causa raiz confirmada:** a linha de `email_contas` pra `kaua.araujo@callface.ai`
(conectada em 20/07 20:42 UTC) **não tem `refresh_token` gravado**
(`tem_refresh = f`, `access_token` presente mas expirado desde 20/07 22:09).
Existe um bug documentado no código, corrigido em 20/07, em que o MSAL
`ConfidentialClientApplication` mantinha cache por chamada (descartado a cada
request) e por isso o `refreshToken` sempre voltava vazio na troca do código
OAuth — a conexão do Kauã muito provavelmente aconteceu bem antes/durante
esse bug. Reconectar agora, com o código já corrigido, deve resolver
definitivamente (sem mais expiração repetida).

**Teste pedido pelo Kauã** ("talvez ele consiga ver a agenda das meninas"):
**resposta é NÃO, e não precisou nem esperar o reconnect pra confirmar** — o
código (`lib/email/microsoft.ts`) mostra que:
- Os escopos pedidos no OAuth são só delegados: `Mail.ReadWrite`, `Mail.Send`,
  `Calendars.ReadWrite`, `User.Read`, `offline_access` — sem
  `Calendars.Read.Shared` nem qualquer permissão de aplicação
  (`Calendars.Read.All` com admin consent), que seriam os únicos jeitos de um
  token enxergar calendário de outro usuário.
- `getBusyTimes` (a função usada em todo o fluxo de agenda/auto-agendamento)
  chama literalmente `/me/calendarView` na Microsoft Graph — hardcoded pro
  dono do token, nunca `/users/{outro-email}/calendarView`.
- Ou seja: **cada closer precisa conectar a própria conta Microsoft** pra
  entrar na verificação real de disponibilidade (`closerTemConflito` +
  `getBusyTimes`, seção 4 acima). Conectar pela conta do Kauã só resolve o
  Outlook do Kauã — não estende visibilidade pras "meninas". Se elas não
  conectarem a própria conta, o auto-agendamento continua funcionando (o
  Outlook check é best-effort, cai só no CRM se não tiver conta conectada),
  só não pega conflito de agenda Microsoft delas.

## 8. Fase 3 implementada e depois PAUSADA (23/07, mesmo dia)

Implementei o gatilho automático completo: `lib/integrations/callpilot-trigger.ts` (novo
módulo, worker), sweep a cada 5min (`callpilot-novo-lead`), cálculo de horários reais
(CRM+Outlook), planilha + Playwright headless (puppeteer, já usado em
`lib/propostas/proposta-pdf.ts`) fazendo login → agente Nathália → Nova Campanha → upload →
Continuar → Criar campanha → **toggle de ativação → "Iniciar" no menu de ações** (2 passos de
ativação confirmados nesta rodada, o toggle sozinho não bastava). WhatsApp (Agente SDR) virou
FALLBACK explícito: só assume um lead se o Callpilot não tentou em 6min, ou tentou e não teve
sucesso em 20min (`agendaCloserId` pinado no lead também unifica quem recebe a reunião entre a
oferta e a confirmação — decisão de arquitetura ainda sem confirmação explícita do Kauã).

**5 bugs reais corrigidos no caminho:**
1. Schema drift: `meta_ad_id`/`meta_adset_id`/`meta_campaign_id` e `meta_lead_staging` nunca
   tinham sido aplicados em homolog (só em prod) — qualquer `SELECT *` em `leads` quebrava.
2. Seletor de card do agente pegava o PRIMEIRO "Nova campanha" da página (wrapper grande contém
   o nome de todos os agentes) — criava campanha no agente errado. Fix: casar pelo elemento
   FOLHA com texto exato, não `.includes()` num wrapper.
3. Sessão headless nova renderiza em INGLÊS por padrão (sem localStorage de idioma) — só
   `localStorage.setItem("i18nextLng","pt-BR")` via `evaluateOnNewDocument` resolve
   (`Accept-Language`/`--lang` do Chrome NÃO funcionam).
4. Seletores de nome da campanha/upload de arquivo estavam errados (chutados sem inspecionar o
   DOM real — `input[name="name"]` e `#file-input` são os reais).
5. Toggle de ativação buscava só `<div>` com texto exato, mas o nome renderiza num `<span>` —
   nunca batia.

**Validado com evidência real:** pelo menos 1 ligação FINISHED de 28s, disparada 100% pela
automação (sem intervenção manual), com resumo de IA real gerado. Prova que o mecanismo
funciona ponta a ponta quando a ativação (2 passos) dá certo.

**Instabilidade encontrada:** a etapa de ativação (achar a campanha na tela /agents logo após
criar) tem timing variável — funcionou em alguns testes, falhou em 2 consecutivos processando 2
leads em sequência (erro "Toggle não encontrado" mesmo com o fix aplicado). Suspeita: a
listagem de campanhas às vezes demora mais que os 15s de espera configurados.

**DECISÃO DO KAUÃ (23/07, mesma rodada): pausar a Fase 3 por enquanto.** Foco volta pro que já
estava validado e funcionando (sessões anteriores): ligar manual pelo CRM (deep link
`callfaceCallUrl`), registro automático via webhook, e aviso de reunião quando a IA detecta
"Combinado" (fluxo de `tentarAutoAgendar`). **Ação tomada:** linha
`scheduledQueue.upsertJobScheduler("callpilot-novo-lead", ...)` comentada em `worker/index.ts`
+ scheduler já registrado removido do Redis (`removeJobScheduler`) + dados de teste (4 leads, 1
campanha) limpos + pausas de rodízio de teste revertidas. **Código do módulo INTACTO** em
`lib/integrations/callpilot-trigger.ts` — só descomentar a linha do scheduler pra retomar
quando decidido (idealmente depois de resolver a instabilidade do passo de ativação).

**Achado que ainda precisa de decisão do Kauã quando isso for retomado:** hoje, se a ligação
não tem sucesso e o WhatsApp (Agente SDR) está desligado (caso de PRODUÇÃO — lá ele não tem
chave LLM), o lead fica preso em "Novo" pra sempre, sem fallback nenhum. Precisa definir o que
fazer nesse caso antes de ligar a automação em prod.

## 9. Bug real achado no fluxo SIMPLES (o que ficou ativo) — corrigido

`callfaceCallUrl()` (`lib/utils/callface-call.ts`, usado em todo botão "ligar" do CRM) usava
`normalizePhone` (de `lib/whatsapp/phone-utils`, pensado pro WhatsApp) que prefixa "55" — mas a
Callface JÁ prefixa "55" sozinha no `call_to`, causando prefixo duplicado e disparando pro
número errado (achado pelo Kauã: DDD 19 virando outro número). Corrigido pra mandar só
DDD+número puro, sem tentar adicionar código de país — mesmo padrão já usado no upload de
planilha de campanha.
