# Plano — Integração Callface (telefonia/IA) ↔ CRM

> Gerado em 2026-07-22 a partir de: (a) mapeamento completo do código deste repo, (b) pesquisa da documentação pública da Callface, (c) payloads do painel Callface (screenshots do Kauã). **Somente plano — implementação aguarda validação** (lição do módulo CS: não construir grande sem validar recorte).
> Tickets ficam AQUI, não no Linear (regra do Kauã, 22/07).

---

## 1. Resumo executivo

Cada ligação do time vira um registro estruturado no lead certo do CRM (resumo IA, transcrição, áudio, duração, quem ligou) com **série histórica do `deal_closure_percentage`** — sinal de tendência pros alertas de esfriamento que já existem. Quando a IA da Callface detecta reunião combinada, o CRM notifica o responsável com o fluxo de agendamento (round-robin + Outlook, já no ar desde 22/07) pré-preenchido. Na volta, o CRM empurra leads pra fila de discagem da Callface. Click-to-call vem da extensão Chrome deles, que detecta números no DOM sozinha.

**O que joga MUITO a favor (mapeado no código):**
- `atividades` já tem `tipo='ligacao'` + `duracaoSegundos`, e a `LeadTimeline` já renderiza esse tipo com ícone → ligações aparecem na timeline sem mexer em UI.
- O webhook do Stripe (`app/src/app/api/webhooks/stripe/route.ts`) é o gabarito de segurança: validação fail-closed, anti-replay, idempotência por claim atômico.
- `converterLeadEmOportunidade` + `pickNextCloser` + `createOutlookEvent` já existem e funcionam — o `scheduling` da Callface pluga num fluxo pronto.
- Padrão de webhook com fila já existe (WhatsApp → BullMQ → worker).

**O que NÃO existe:** tabela de ligações/CDR, fila de discagem, secrets `CALLFACE_*`.

**Achado da pesquisa externa (muda a Fase 0):** a única doc pública é `callface.ai/developers`. O webhook de saída é **configurado pelo suporte da Callface e o payload é customizável por integração** — os campos `call_status`, `deal_closure_percentage`, `scheduling` e `transcription` dos prints nem constam na doc pública. Não há doc de HMAC/assinatura na saída, nem endpoint público de "originar ligação". Ou seja: a Fase 0 é conversa direta com o time de produto/CTO da Callface, não leitura de doc.

---

## 2. Decisões de arquitetura

### 2.1 Casamento de IDs (a decisão mais importante)

A doc do webhook de Entrada (`create-contact`) só documenta `{name, phone}` — **não há garantia de campo de id externo**. Estratégia em camadas, da mais confiável pra menos:

1. **Se a Callface aceitar um campo de id externo** no create-contact (perguntar na Fase 0 — o payload é customizável): mandamos o UUID do lead do CRM e o retorno casa exato.
2. **Mapeamento por telefone normalizado (fallback principal):** `destination_number` → `leads.telefone`/`leads.whatsapp` normalizados por dígitos (padrão que o CRM já usa no dedupe do rd-lead e na busca de Empresas). Cobre inclusive ligações pra leads que nunca passaram pelo create-contact.
3. **Aprendizado incremental:** na primeira vez que um `contact_id`/`deal_id` da Callface casa com um lead, gravamos como id externo (mesmo padrão de `zohoId`/`pipedriveId` que já existe em `leads`). Chamadas seguintes casam por id exato.
4. **Não casou:** a ligação é gravada mesmo assim (órfã, `leadId=null`) + notificação pra gestão resolver na mão. Nunca descartar evento.

### 2.2 Recepção do webhook de Saída

- **Rota:** `app/src/app/api/webhooks/callface/route.ts` (Next route handler, padrão da casa — Traefik já roteia `/api/webhooks` pro Next; NÃO criar no Hono).
- **Auth:** como não há HMAC documentado, mínimo viável = secret na URL ou header (`CALLFACE_WEBHOOK_SECRET`), **fail-closed** (secret ausente no env → 503, igual Stripe). Se o time Callface suportar header de assinatura, usar. Secret nunca em log.
- **Processamento:** responder 200 rápido e enfileirar em fila BullMQ nova `callface-call-events` (padrão do webhook de WhatsApp, não o inline do rd-lead). Volume é baixo (ligações do próprio time comercial, dezenas–centenas/dia), mas a fila dá retry de graça e não trava o handler em matching+persistência.
- **Idempotência:** se o payload tiver id único de ligação (perguntar na Fase 0), usar. Senão, chave derivada `sha256(destination_number + call_date + user_email)` com unique index — retry da Callface não duplica.

### 2.3 Persistência — tabela nova `ligacoes`

`atividades` sozinha não serve pra série histórica nem pra transcrição/áudio (é timeline genérica). Tabela nova (DDL aditivo, uuid PK como todo o schema):

```
ligacoes: id, organizacao_id, lead_id (null se órfã), negocio_id?, usuario_id?
          (match por user_email), user_email, user_name, destination_number,
          callface_contact_id, callface_deal_id, call_date, duracao_segundos,
          status, resumo (md), transcricao, call_link, audio_url,
          closure_percentage (int 0-100), scheduling (jsonb), payload_raw (jsonb),
          idempotency_key (unique), created_at
```

Cada ligação também insere **uma linha em `atividades`** (`tipo='ligacao'`, `duracaoSegundos`, resumo curto em `descricao`, `dados.ligacaoId`) → timeline funciona no dia 1 sem tocar em UI. A série histórica do closure % é simplesmente `SELECT closure_percentage, call_date FROM ligacoes WHERE lead_id=... ORDER BY call_date`.

### 2.4 `scheduling` "Combinado" → fluxo de qualificação

**v1 (Fase 1): humano no loop.** Notificação (insert direto em `notificacoes`, padrão Stripe) + tarefa pro responsável do lead: "IA detectou reunião combinada na ligação de {data} — confirmar agendamento", com link que abre o lead com o `AgendarReuniaoModal` pré-preenchido (data/hora sugerida pelo `scheduling`, e-mail do lead). O fluxo existente cuida do resto (fila de closers, Outlook, Teams).

**v2 (evolução, NÃO agora): auto-agendamento** via `converterLeadEmOportunidade` direto. Só depois de medir a precisão da detecção em produção (critério: ≥20 casos observados na v1 com ≥90% de data/hora corretas). Motivo: agendar sozinho no horário errado queima o lead e a agenda da closer; notificação errada custa um clique.

### 2.5 CRM → fila de discagem (Entrada)

- Client em `lib/integrations/callface.ts`: `enviarParaDiscagem(lead)` → `POST https://api.callface.io/webhooks/events/create-contact` com token `CALLFACE_INBOUND_TOKEN` (env), telefone normalizado. Registra `atividades` (tipo='ligacao' ou nota "enviado pra discagem") pra ficar auditável na timeline.
- **v1 manual:** botão "Enviar pra discagem" no `LeadDrawer` (ao lado de Ligar/WhatsApp).
- **v2 automático (depois, atrás de toggle na config, desligado por default):** job no worker com regras — ex.: lead `pending` sem contato há X horas, negócio esfriando com closure em queda. Reusa `getPipelineEsfriando` e a infra de `scheduledQueue`.

### 2.6 Click-to-call (Fase 4)

A extensão Chrome da Callface (v2.4.5, Chrome Web Store) **detecta números de telefone no DOM e injeta o ícone de discagem sozinha** — é assim que ela funciona nos CRMs integrados. Caminho pragmático: instalar a extensão, testar nas telas do CRM (homolog) e ajustar formato de renderização dos telefones se preciso. Sem código novo no melhor caso. Fallback: pedir ao time Callface endpoint de originate (não existe público).

### 2.7 Segurança (transversal)

- Secrets só em `.env` (`CALLFACE_WEBHOOK_SECRET`, `CALLFACE_INBOUND_TOKEN`), documentados no `.env.example` (que está desatualizado — aproveitar e corrigir). Nunca em log; falha de auth loga só IP/timestamp.
- Transcrição/áudio são dado sensível (LGPD): ficam atrás do auth normal do CRM, sem rota pública; `payload_raw` não vai pra stdout.
- Endpoint valida em TODA request; sem secret configurado, recusa tudo (fail-closed).

---

## 3. Tickets por fase

### Fase 0 — Descoberta (bloqueia o resto; maior parte é conversa com o time Callface)

| # | Ticket | Aceite |
|---|---|---|
| CF-01 | Levar ao time Callface (suporte/CTO) a lista de perguntas da seção 4 e configurar o webhook de Saída apontando pra **homolog** (`homolog.crm.callface.io/api/webhooks/callface?token=...`) com endpoint de captura simples | Perguntas respondidas por escrito; ≥5 payloads reais capturados, incluindo 1 ligação não atendida (se o evento existir) |
| CF-02 | Teste de casamento de ids: criar contato via `create-contact` em homolog, ligar pra ele, comparar `contact_id`/`deal_id` do retorno | Documentado no repo se o id externo ecoa ou se o match será por telefone |
| CF-03 | Instalar extensão Chrome no CRM homolog e testar detecção de números nas telas de lead/negócio/empresa | Relatório: em quais telas/formatos ela detecta e disca |

### Fase 1 — Webhook de Saída → CRM (valor imediato)

| # | Ticket | Aceite |
|---|---|---|
| CF-10 | Migration `ligacoes` (DDL aditivo homolog+prod, padrão da casa) | Tabela nos 2 bancos, `information_schema` conferido |
| CF-11 | Endpoint `app/api/webhooks/callface/route.ts`: auth fail-closed + 200 rápido + enfileira `callface-call-events` | Payload sem token → 401; sem env → 503; com token → job na fila |
| CF-12 | Worker: matching em camadas (§2.1), persiste `ligacoes` + `atividades` tipo='ligacao', idempotência por unique key; órfã → notificação gestão | **Ligação de teste real aparece na timeline do lead certo em homolog**; mesmo payload 2x não duplica |
| CF-13 | `scheduling` "Combinado" → notificação + tarefa pro responsável com deep-link pro modal pré-preenchido | Ligação de teste com reunião combinada gera notificação com data/hora sugerida; 1 clique abre o modal preenchido |

### Fase 2 — CRM → fila de discagem

| # | Ticket | Aceite |
|---|---|---|
| CF-20 | `lib/integrations/callface.ts` + botão "Enviar pra discagem" no LeadDrawer + registro na timeline | **Lead enviado pelo CRM aparece na campanha funil da org na Callface** |
| CF-21 | (depois de CF-20 rodar 1 semana) Regra automática atrás de toggle: lead `pending` sem contato há X horas | Toggle default OFF; ligado em homolog, lead elegível entra na fila sem ação humana |

### Fase 3 — Timeline rica + métricas

| # | Ticket | Aceite |
|---|---|---|
| CF-30 | Seção "Ligações" no LeadDrawer/NegocioDrawer: player de áudio, resumo, transcrição expansível, gráfico da evolução do closure % (kit visual dos relatórios) | Lead com 3+ ligações mostra série do closure % e player funcional |
| CF-31 | Métricas nos relatórios existentes (sem duplicar cálculo, reusar `lib/relatorios/`): volume de ligação por vendedor, taxa ligação→reunião, closure médio por vendedor/estágio | Números batem com contagem manual em `ligacoes` |
| CF-32 | Sinal de tendência no radar de esfriamento: closure % em queda (última vs média das 2 anteriores) entra no `getPipelineEsfriando`/Growth | Negócio com closure caindo aparece no alerta mesmo com `updatedAt` recente |
| CF-33 | (opcional) Resumo da ligação → contexto do Agente SDR (`sdrMemory`) pra continuidade WhatsApp pós-ligação | SDR referencia contexto da ligação em conversa de teste |

### Fase 4 — Click-to-call

| # | Ticket | Aceite |
|---|---|---|
| CF-40 | Conforme CF-03: ajustar renderização de telefones pra extensão detectar em todas as telas; se insuficiente, negociar originate API com o time | Clicar no número em lead/contato/empresa dispara ligação na Callface |

**Ordem e dependências:** F0 → F1 → (F2 e F3 em paralelo) → F4. CF-32/33 dependem de volume real acumulado em `ligacoes`.

---

## 4. Perguntas pro time Callface (levar na Fase 0)

1. Quais **eventos** o webhook de Saída dispara além de ligação finalizada (perdida, não atendida, em andamento)? Lista completa de valores de `call_status`?
2. Existe **id único da ligação** no payload (pra idempotência)? Qual a política de **retry** de vocês (quantas tentativas, em que intervalo)?
3. O `create-contact` aceita um **campo de id externo** (id do lead no nosso CRM) que ecoe de volta no webhook de Saída? (A doc diz que os campos são ajustáveis por integração.)
4. O webhook de Saída suporta **header de assinatura/secret** configurado por vocês? Qual formato?
5. Existe endpoint de **originar ligação via API** (click-to-call server-side), ou o caminho oficial é só a extensão?
6. O `deal_closure_percentage` é recalculado por ligação ou acumulado do deal? (Muda como plotamos a série.)
7. `scheduling`: quais os valores possíveis de categoria/tipo/status além de "Combinado"? A data vem com timezone?

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Payload real ≠ prints (campos customizáveis por integração) | Fase 0 captura payloads reais antes de qualquer código; `payload_raw` jsonb guarda tudo mesmo que o parse mude |
| Match por telefone erra (números compartilhados, formatação) | Normalização por dígitos (padrão já validado no repo) + órfãs nunca descartadas + aprendizado de id externo |
| Auto-agendamento com data errada queima lead | v1 é humano-no-loop; auto só com precisão medida (§2.4) |
| Dependência do suporte Callface pra configurar webhook | É o processo oficial deles; iniciar o contato já na Fase 0 pra não bloquear o cronograma |
| Secret vazar em log | Fail-closed + secret só em env + revisão de todo `console.log`/`logger` no caminho do webhook antes do deploy |

---

## 6. PROMOVIDO A PRODUÇÃO (23/07/2026)

Depois de validado em homolog (22-23/07) e do fix de um bug real de formatação de
telefone (`callfaceCallUrl()` duplicava o "55" — corrigido), o Kauã pediu a
promoção pra produção na hora, escopo explícito: **só ligar/webhook/registro/
auto-agendamento — sem WhatsApp, sem a automação Callpilot de campanha por lead
(essa segue pausada, ver `PLANO-CALLPILOT-LEAD-NOVO.md`)**.

**Estado de prod antes**: greenfield total pra telefonia. Tabela `ligacoes` já
existia (schema.ts sincronizado numa sessão anterior, zero linhas de uso real),
mas sem rota, sem worker, sem secret.

**Patch cirúrgico** (não substituição de arquivo inteiro — prod e homolog
divergiram bastante em alguns pontos, sobretudo `worker/index.ts`, então cada
arquivo foi comparado e só a parte de telefonia foi inserida):
- Novos: `lib/integrations/callface.ts`, `lib/utils/callface-call.ts`,
  `lib/utils/parse-resumo-callface.ts`, `components/crm/LigacoesSection.tsx`,
  `api-server/routes/ligacoes.ts`, `app/api/webhooks/callface/route.ts`.
- Patches pontuais (achado real: `ai-sdr-outreach` roda ATIVO em prod a cada
  5min, não estava "desligado" como se pensava — cuidado extra pra não mexer
  nele): `lib/queue/index.ts`, `worker/index.ts` (só a fila
  `callface-call-events`), `api-server/server.ts`, `lib/crm/agenda-closers.ts`
  (`pickNextCloserLocked`/`closerTemConflito`), `LeadDrawer.tsx`/
  `NegocioDrawer.tsx`/`ContatoInfoSidebar.tsx` + páginas de contatos/negócios/
  contratos (troca de `tel:` por `callfaceCallUrl()` + `LigacoesSection`).
- `.env` de prod: `CALLFACE_WEBHOOK_SECRET`/`CALLFACE_INBOUND_TOKEN`
  adicionados (mesmo valor usado em homolog — é config da organização na
  Callface, não muda por ambiente de destino).

**Feature nova**: quando o auto-agendamento cria reunião mas o closer não tem
Outlook conectado (`outlookCriado=false`), o sistema agora cria uma `tarefa`
com `prioridade="urgente"` (já renderiza badge vermelho de destaque no
LeadDrawer/ContatoInfoSidebar) — antes ficava só uma frase dentro do corpo da
notificação, que sumia da tela assim que lida.

**Deploy**: backup do source de prod antes de qualquer mudança
(`app-src-prod-backup-callface-promo-*.tgz`), build limpo dos 3 containers
(app+api+worker), subida sem erros. `postgres` apareceu como "Recreate" no
`docker compose up` (não fomos nós que mexemos nele) — dados confirmados
intactos (3045 leads, 941 negócios, 10 usuários) antes de seguir.

**Webhook migrado**: URL trocada em app.callface.ai → Configurações →
Integração → Webhooks (Saída), de `https://homolog.crm.callface.io/...` pra
`https://crm.callface.io/api/webhooks/callface`. Testado com o botão "Testar"
nativo da Callface: status 200, evento processado pelo worker de prod, casou
por telefone com um contato de teste real do banco (`tipo='contato'`), e
**corretamente NÃO tentou auto-agendar** (guard rail funcionou: só
`tipo='lead'` aciona). Registro de teste removido depois de confirmar.

**A partir de agora, homolog para de receber ligações reais** — a URL
configurada na Callface é única, org-wide (não dá pra apontar pros dois ao
mesmo tempo sem uma segunda integração de webhook). Sem ticket no Linear.
