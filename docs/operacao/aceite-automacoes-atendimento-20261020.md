# Aceite em homologação: automações e atendimento (entrega de 20/10/2026)

Roteiro para o Scott validar em **https://dev.crm.callface.io** a entrega de
20/10 (commits `9ce2c533` .. `adb8a9c1`, a partir de `cbfaea90`) antes de
promover o mesmo sha para produção. Fluxo geral de homologação:
[`homologacao.md`](./homologacao.md).

Cada seção traz **pré-condição**, **passos**, **resultado esperado** e
**como conferir no banco** (só `SELECT`). No fim: rollback das migrations
0131/0132 e o passo de promoção.

> Este roteiro foi escrito numa sessão sem servidor, sem banco de homologação e
> sem navegador logado. Nada aqui foi executado em `dev.crm.callface.io`. O
> script de conferência foi rodado só contra um banco local de teste.

---

## 0. Avisos antes de começar (leia todos)

1. **Só números internos na `WHATSAPP_ALLOWLIST`.** Celulares do time, nunca de
   cliente. Hoje o valor padrão é `0000000000` (ninguém). Troca:
   `scripts/homolog-servidor.sh env WHATSAPP_ALLOWLIST=5511XXXXXXXXX,5511YYYYYYYYY`.
2. **Nenhum cliente real.** Toda conversa, lead e negócio de teste usa os dados
   de teste deste roteiro (nome com "Aceite 2010", e-mail `@callface.ai`,
   telefone interno). Não aprove, não responda e não mova conversa de cliente
   real da cópia, mesmo que a trava fosse barrar.
3. **Nada de Stripe.** Stripe está em modo **LIVE, sem trava** em homologação.
   Não gere checkout, fatura nem cobrança. Nada desta entrega precisa de Stripe.
4. **Não mova negócio real para Ganho** (evento de conversão da Meta é real).
5. **A homologação não chega ao wuzapi** (rede separada, ver
   `homologacao.md` › WhatsApp). Mesmo para número da allowlist, a mensagem de
   saída **não chega ao celular** em homologação: ela é gravada, entra na fila e
   falha no envio. O aceite de envio aqui é feito **no banco e na tela**
   (mensagem criada, ledger, motivo de bloqueio). A chegada no celular só se
   prova depois da promoção (seção 12, smoke opcional com número interno).
6. **A mensagem recebida é espelhada de produção.** Mandar WhatsApp de um
   celular de teste para um número da operação também entra em **produção**,
   que roda o código anterior. Use só celular interno e texto neutro
   ("teste aceite 2010").
7. **E-mail** só sai para `@callface.ai` (`EMAIL_ALLOWED_DOMAINS`). Avisos ao
   responsável podem chegar de verdade na caixa de quem é do time.
8. **Segredos não entram em lugar nenhum**: nem neste arquivo, nem no chat, nem
   em commit, nem na URL (use header). As variáveis citadas são lidas do `.env`
   do servidor sem imprimir.
9. A cópia do banco sai **saneada**: todo número fica `status = 'disconnected'`
   e sem token (`scripts/homolog-sanear.sql`). Isso afeta as seções que exigem
   número operacional **conectado** (Lia, distribuição com número): ver P4.

---

## Preparação

**P1. Publicar o sha em homologação** (máquina do Scott):

```bash
git pull --rebase origin main
git rev-parse HEAD                      # anote: é ESTE sha que será promovido
./deploy.sh homolog <sha>
```

**P2. Travas.** Confira e ajuste a allowlist (aviso 1):

```bash
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  "sudo grep -E '^(WHATSAPP_ALLOWLIST|EMAIL_ALLOWED_DOMAINS|AREAS_EM_BREVE)=' /opt/callface/crm2-homolog/.env"
scripts/homolog-servidor.sh env WHATSAPP_ALLOWLIST=<números internos, separados por vírgula>
```

Esperado: `EMAIL_ALLOWED_DOMAINS=callface.ai`, `AREAS_EM_BREVE=` vazio
(Automações aberta em homologação), allowlist só com números do time.

**P3. Atalho de SQL somente leitura** no banco de homologação. Todas as
consultas deste roteiro usam isto (a sessão do `psql` abre em modo read-only):

```bash
HSQL() {
  ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
    "sudo docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' \
       callface-crm2-homolog-postgres psql -U callface -d callface_crm_mz -X -P pager=off"
}
HSQL <<'SQL'
select count(*) from leads;
SQL
```

**P4. Script de conferência** (só `SELECT`, numa transação `READ ONLY`). Pelo
túnel para o Postgres da homologação (porta 5434 só em `127.0.0.1` do servidor):

```bash
# terminal 1: túnel
ssh -i ~/.ssh/infra_callface.pem -N -L 15434:127.0.0.1:5434 ubuntu@34.204.200.52
# terminal 2: env temporário FORA do repositório, sem imprimir a senha
umask 077
SENHA="$(ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  "sudo grep '^DB_PASSWORD=' /opt/callface/crm2-homolog/.env | cut -d= -f2-")"
printf 'DATABASE_URL=postgres://callface:%s@127.0.0.1:15434/callface_crm_mz\n' "$SENHA" > /tmp/homolog-ro.env
unset SENHA
cd app && npx tsx --env-file=/tmp/homolog-ro.env src/scripts/checar-automacoes-homolog.ts
rm -f /tmp/homolog-ro.env
```

(Se a senha tiver caractere especial de URL, codifique antes de montar a URL.)

Esperado logo após o deploy: todas as linhas `PASS` em migrations, colunas,
CHECK, "privado e operacional" e "privado como padrão"; Lia `PASS` com
`canais.pool = 'operacional'`. Os **AVISOS** "Lia não atende" são esperados
enquanto nenhum número estiver operacional **e** conectado. Código de saída 1 =
algum `FAIL`: pare e investigue antes de seguir.

**P5. Número de teste conectado (só homologação, só dado de teste).** Por causa
do aviso 9, todo número está `disconnected` na cópia, e Lia/distribuição só usam
número operacional **conectado**. Para exercitar as seções 2, 3 e 10, escolha UM
número de trabalho da operação (não privado), marque-o operacional pela tela
(seção 2) e, só na homologação, marque-o conectado:

```bash
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  "sudo docker exec -i callface-crm2-homolog-postgres psql -U callface -d callface_crm_mz -X" <<'SQL'
-- ESCRITA EM HOMOLOGAÇÃO (cópia). Nunca rodar em produção.
UPDATE whatsapp_sessao SET status = 'connected' WHERE id = '<id do número de teste>' AND NOT privado;
SQL
```

Isso não faz a mensagem sair (aviso 5); só deixa o roteamento escolher o número.
`recarregar-banco` desfaz.

---

## 1. Privacidade de números privados

Commit `9ce2c533` (+ `a4aef183`). Número privado (WhatsApp pessoal, 0126) deixa
de ser canal de automação e de IA.

**Pré-condição:** existe pelo menos um número com `privado = true` na cópia.

```sql
select id, label, phone_number, privado, operacional, is_default, status
  from whatsapp_sessao where privado order by label;
```

**Passos**
1. Ajustes › WhatsApp: abrir um número privado. Tentar marcá-lo como padrão da
   organização.
2. Automações › Fluxos › abrir (ou criar "Aceite 2010 — fluxo") › bloco "Enviar
   WhatsApp" › seletor de número.
3. Automações › Campanhas › Nova: lista de remetentes.
4. Se tiver um celular interno ligado a um número privado: mandar "teste aceite
   2010" de outro celular interno para ele.

**Esperado**
1. Recusa (409) com mensagem; o número continua não padrão.
2. Número privado **não aparece** no seletor; os operacionais aparecem com
   "(operacional)".
3. Número privado não aparece como remetente.
4. A mensagem aparece na conversa (para quem pode ver), mas **nenhuma** IA,
   fluxo ou regra "whatsapp_recebido" roda para ela. Só a cadência para (lead
   respondeu), se houver.

**Banco**

```sql
-- nenhum privado é padrão nem operacional (o script também confere)
select count(*) filter (where privado and is_default) as privado_padrao,
       count(*) filter (where privado and operacional) as privado_operacional
  from whatsapp_sessao;                                   -- esperado 0 e 0
-- nenhuma execução de IA ou fluxo a partir de conversa em número privado na última hora
select r.id, r.status, r.started_at from ai_agent_runs r
  join whatsapp_sessao s on s.id = r.channel_session_id
 where s.privado and r.started_at > now() - interval '1 hour';  -- esperado 0 linhas
```

---

## 2. Números operacionais (Ajustes › WhatsApp)

Commits `f58430e4`, `17eec372` (0131), `4c5936f4`.

**Pré-condição:** usuário admin/gerente; pelo menos um número de trabalho
(não privado) e um privado.

**Passos**
1. Ajustes › WhatsApp: ver os selos **Privado** e **Operacional** e a legenda.
2. Abrir um número de trabalho › ligar "Número operacional" › salvar.
3. Abrir um número privado › a chave "Número operacional" deve estar travada,
   com o motivo.
4. Desligar e religar o operacional do número de trabalho (deixar ligado no fim
   para as seções 3 e 10).
5. Entrar com um usuário que **não** administra o número e tentar mudar a chave.

**Esperado:** selos corretos; operacional liga/desliga; privado travado; usuário
sem permissão não muda (sem botão ou recusa do servidor); cada troca gera
auditoria.

**Banco**

```sql
select id, label, phone_number, privado, operacional, status
  from whatsapp_sessao where operacional order by label;
select created_at, actor_id, entity_id, before, after
  from audit_log where action = 'whatsapp.numero_operacional'
 order by created_at desc limit 10;
```

---

## 3. Distribuição por campanha (Ajustes › Leads)

Commits `6cbab2af`, `4c5936f4`, `e3209f5f`, `17eec372`.

**Pré-condição:** P5 feito (um número operacional conectado); dois usuários
internos ativos para o rodízio.

**Passos**
1. Ajustes › Leads › nova regra "Aceite 2010 — campanha":
   - Quando › Campanha (utm_campaign) = `aceite-2010`; Fonte (utm_source) = `aceite`;
   - destino: Rodízio entre os dois usuários internos;
   - número de atendimento: o número operacional do P5 (o seletor só lista
     operacionais não privados);
   - prioridade **10** (número menor vence) e uma descrição.
2. Conferir na lista o resumo: "Campanha: aceite-2010 · Fonte: aceite → Rodízio (2) · Número: …".
3. Lead falso do **site** (sem segredo; o endpoint é público com honeypot):

   ```bash
   curl -sS -X POST https://dev.crm.callface.io/api/webhooks/site-lead \
     -H 'Content-Type: application/json' -H 'Origin: https://site.callface.io' \
     -d '{"nome":"Aceite Site 2010","email":"aceite.site.2010@callface.ai","telefone":"<TELEFONE INTERNO>","empresa":"Aceite 2010 LTDA","utmSource":"aceite","utmCampaign":"aceite-2010"}'
   ```

4. Lead falso do **RD** (segredo `RD_WEBHOOK_SECRET`, lido do `.env` da
   homologação sem imprimir e enviado em header, nunca na URL):

   ```bash
   export RD_WEBHOOK_SECRET="$(ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
     "sudo grep '^RD_WEBHOOK_SECRET=' /opt/callface/crm2-homolog/.env | cut -d= -f2-")"
   curl -sS -X POST https://dev.crm.callface.io/api/webhooks/rd-lead \
     -H "x-webhook-secret: $RD_WEBHOOK_SECRET" -H 'Content-Type: application/json' \
     -d '{"leads":[
       {"uuid":"aceite-rd-2010-a","name":"Aceite RD 2010 A","email":"aceite.rd.2010a@callface.ai",
        "last_conversion":{"id":"aceite-rd-2010-conv-a","created_at":"2026-10-20T15:00:00Z",
          "content":{"identificador":"cf-aceite-2010"},
          "conversion_origin":{"source":"aceite","medium":"teste","campaign":"aceite-2010"}}},
       {"uuid":"aceite-rd-2010-b","name":"Aceite RD 2010 B","email":"aceite.rd.2010b@callface.ai",
        "last_conversion":{"id":"aceite-rd-2010-conv-b","created_at":"2026-10-20T15:00:01Z",
          "content":{"identificador":"cf-aceite-2010"},
          "conversion_origin":{"source":"aceite","medium":"teste","campaign":"aceite-2010"}}}
     ]}'
   unset RD_WEBHOOK_SECRET
   ```

   (`identificador` começando com `cf-` é o que faz o RD reconhecer o lead como
   Callface; sem isso volta `skipped:not-callface`.)
5. Repetir **exatamente** o mesmo `curl` do RD (reentrega).
6. Lead do site **sem** a campanha (`utmCampaign` vazio, e-mail
   `aceite.site.2010b@callface.ai`): não deve casar a regra.
7. Meta (opcional): o webhook exige assinatura `META_APP_SECRET`; não forjar.
   Validar com o próximo lead real só depois da promoção, pelo motivo gravado.

**Esperado**
- Passo 3: `{"ok":true,...}` com lead criado; dono = um dos dois do rodízio.
- Passo 4: `created: 2`; os dois leads do lote caem em **pessoas diferentes**
  (antes o lote inteiro ia para a mesma).
- Passo 5: `skipped: 2` com `skipped:duplicate`; **o rodízio não anda**.
- Passo 6: lead criado pela política padrão; `distribuicao_regra_id` nulo ou de
  outra regra.
- Ficha do lead: origem/UTM corretas; variáveis do grupo "Campanha" aparecem no
  seletor de variáveis do fluxo (`75f8e24a`).

**Banco**

```sql
select l.nome, l.email, l.utm_source, l.utm_campaign, u.nome as dono,
       r.nome as regra, l.distribuicao_motivo, s.label as numero_preferido, l.created_at
  from leads l
  left join usuarios u on u.id = l.responsavel_id
  left join regras_distribuicao_leads r on r.id = l.distribuicao_regra_id
  left join whatsapp_sessao s on s.id = l.sessao_whatsapp_preferida_id
 where l.email like 'aceite.%2010%@callface.ai' order by l.created_at;
-- motivo esperado no formato: Regra Aceite 2010 — campanha (utm_campaign = aceite-2010; ...; rodízio entre 2)

select nome, rodizio_usuario_ids, rodizio_ultimo_id, utm_campaign, utm_source, sessao_whatsapp_id, prioridade
  from regras_distribuicao_leads where nome like 'Aceite 2010%';

select canal, chave_idempotencia, status, entregas, lead_id, erro, created_at
  from captacao_entregas
 where payload::text like '%aceite%2010%' order by created_at;
-- RD: chave conv:aceite-rd-2010-conv-a / -b, status processada, entregas = 2 depois da reentrega
```

**Limpeza:** desativar a regra "Aceite 2010 — campanha" no fim (ou deixar; a
cópia é recarregada). Não criar essa regra em produção.

---

## 4. Caixa de entrada da captação e reprocessamento

Commits `d84cb38a`, `53794a1e` (API) e `d4f1af56` (tela). Tela: **Ajustes ›
Leads › Caixa de entrada da captação**, só para gestão (admin, gerente, super
admin): filtros de status/canal, link para o lead e botão "Reprocessar". A API
abaixo continua valendo para conferir pelo navegador logado em
`dev.crm.callface.io` (a sessão vai no cookie).

**Pré-condição:** seção 3 feita (há entregas `site` e `rd`).

**Passos**
1. Abrir no navegador logado:
   `https://dev.crm.callface.io/api/captacao/entregas?limite=20`
   e depois `...?status=falhou` e `...?canal=rd`.
2. Reprocessar uma entrega **já processada** (console do navegador, na aba do CRM):
   ```js
   await (await fetch('/api/captacao/entregas/<id processada>/reprocessar', { method: 'POST' })).json()
   ```
3. Se `?status=falhou` trouxer alguma entrega: reprocessar ela (mesmo comando).
   Se não houver nenhuma (o normal na cópia: os webhooks reais vão para
   produção), dá para criar o caso **só em homologação, só com dado de teste**:
   ```sql
   -- ESCRITA EM HOMOLOGAÇÃO (cópia). Só na entrega do teste da seção 3.
   UPDATE captacao_entregas SET status = 'falhou', erro = 'aceite 2010: falha simulada'
    WHERE chave_idempotencia = 'conv:aceite-rd-2010-conv-a';
   ```
   e reprocessar essa entrega; depois clicar duas vezes rápido (dois `fetch`
   seguidos) numa entrega `falhou`.
4. Com um usuário **sem** papel de gestão, abrir o passo 1.

**Esperado**
1. Lista com canal, status, lead e nome/e-mail que vieram.
2. **409**: "Só entrega que falhou é reprocessada (esta está "processada")".
3. Reprocesso roda o mesmo código do webhook com o payload guardado: a entrega
   volta `processada` apontando para o **mesmo lead** (dedup), sem criar lead
   novo nem gastar vez do rodízio; o segundo clique recebe 409.
4. 403.

**Banco**

```sql
select id, canal, status, entregas, lead_id, erro, processada_em
  from captacao_entregas where chave_idempotencia like 'conv:aceite-rd-2010%';
select created_at, actor_id, entity_id, after
  from audit_log where action = 'captacao.entrega_reprocessada'
 order by created_at desc limit 5;
select count(*) from leads where email = 'aceite.rd.2010a@callface.ai';   -- esperado 1
```

---

## 5. Handoff: quem atende é quem assumiu

Commits `486a70f3`, `e187e521`, `4f9d3928`, `cfe7fecd`, `3acdf981`, `5426794e`.

**Pré-condição:** uma conversa de teste (celular interno → número operacional
do P5) com um agente atribuído (Atendimento › conversa › "Agente nesta
conversa"). Lembrete: a resposta da IA não chega no celular em homologação
(aviso 5); confira pelo painel e pelo banco.

### 5a. Pessoa responde pelo celular do número → a IA para

**Passos:** com a IA atendendo a conversa de teste, responder ao celular de
teste **direto pelo aparelho** do número da operação. Depois, mandar nova
mensagem do celular de teste.

**Esperado:** a mensagem dada no aparelho aparece assinada pelo dono humano do
número; o agente **não** responde por cima. O eco de envio do próprio CRM não
vira mensagem "humana" duplicada.

```sql
select m.created_at, m.direcao, left(m.conteudo, 60) as texto, u.nome as autor,
       m.dados->>'enviadoPeloCelular' as celular, m.dados->>'aiGenerated' as ia, m.status
  from whatsapp_mensagens m left join usuarios u on u.id = m.enviado_por_id
 where m.telefone = '<TELEFONE INTERNO>' order by m.created_at desc limit 20;
```

### 5b. Assumir conversa / pausar

**Passos:** no painel "Agente nesta conversa": **Pausar agente**; ver o rótulo.
Depois **Retomar agente**. Depois **Assumir conversa** com um resumo e
**Confirmar e assumir**. Mandar mensagem do celular de teste.

**Esperado:** "Pausada por <seu nome>" (não "por uma pessoa"); ao retomar, o
registro some; ao assumir, "Com humano: <nome>" com o motivo curto e o resumo;
nenhuma resposta do agente depois disso.

```sql
select a.status, a.motivo_estado, u.nome as humano, a.resumo_handoff,
       a.estado->>'pausada_por' as pausada_por_id, a.updated_at
  from ai_agent_atribuicoes a left join usuarios u on u.id = a.humano_usuario_id
  join contatos c on c.id = a.contato_id
 where c.telefone like '%<FINAL DO TELEFONE INTERNO>' order by a.updated_at desc limit 5;
select handoff_status, handoff_motivo, handoff_at, ai_ativo
  from ai_sdr_contato_state s join contatos c on c.id = s.contato_id
 where c.telefone like '%<FINAL DO TELEFONE INTERNO>';
```

### 5c. Agente pede handoff

**Passos:** com o agente atendendo, mandar do celular de teste "quero falar com
uma pessoa".

**Esperado:** atribuição vai para `humano`, a pessoa que recebe é o dono
**humano** do lead (se o dono for agente, a regra de devolução escolhe a
pessoa), ela recebe **um** aviso; Execuções mostra o motivo do handoff.

```sql
select r.started_at, r.status, r.handoff_motivo, r.error_code
  from ai_agent_runs r join contatos c on c.id = r.contato_id
 where c.telefone like '%<FINAL DO TELEFONE INTERNO>' order by r.started_at desc limit 5;
```

### 5d. Lia marca reunião → closer assume

**Pré-condição:** seção 10 (Lia no pool) pronta; agenda de closer disponível
na cópia (o convite só sai para `@callface.ai`).

**Passos:** pelo celular de teste, conversar com a Lia até ela marcar a reunião.
Mandar mais uma mensagem depois da confirmação.

**Esperado:** a confirmação ao contato é gerada; a atribuição vira `humano` com
motivo `reuniao_agendada`, a closer como humano e resumo "Reunião agendada. …";
sem aviso duplicado; a Lia **não** responde a mensagem seguinte.

```sql
select a.status, a.motivo_estado, u.nome as closer, left(a.resumo_handoff, 80), a.updated_at
  from ai_agent_atribuicoes a join ai_agents g on g.id = a.agent_id
  left join usuarios u on u.id = a.humano_usuario_id
 where g.slug = 'lia-sdr' and a.motivo_estado = 'reuniao_agendada'
 order by a.updated_at desc limit 5;
```

### 5e. Automação de "mensagem recebida" não cala o agente

**Passos:** com uma automação ativa de gatilho "mensagem recebida" na
organização, mandar mensagem na conversa de teste que tem agente atribuído.

**Esperado:** a automação roda **e** o agente atribuído também responde (um
run por mensagem, sem duplicar).

---

## 6. Aprovações ("Aprovar e enviar", editar)

Commits `1884cbc5`, `5426794e`, `3acdf981`.

**Pré-condição:** um agente de teste em modo **Sob aprovação** atribuído à
conversa de teste.

**Passos**
1. Mandar mensagem do celular de teste. No painel da conversa aparece a resposta
   preparada com **Aprovar e enviar**, **Editar e enviar**, **Descartar**.
2. **Editar e enviar** com um texto alterado ("aceite 2010 editado").
3. Nova mensagem → **Descartar**.
4. Ação com ferramenta de permissão (ex.: agendar reunião) → **Aprovar**.
5. No editor do agente (Automações › Agentes › aba de casos): aprovar um caso
   pelo editor e conferir a prévia do texto antes de enviar.
6. Clicar duas vezes em "Aprovar e enviar".

**Esperado:** enquanto aguarda decisão o atendimento fica "Aguardando
aprovação" e o agente **não** é acionado a cada nova mensagem; aprovar envia
pelo caminho do agente (política de canal, ledger, fila) com o texto editado;
não há mais 409 nem "sem permissão delegada" na ação; decidido o caso, o
atendimento volta a "IA atendendo"; clique duplo não duplica a mensagem; erro do
servidor aparece no próprio caso. (Saída para o celular falha por rede em
homologação: aviso 5.)

**Banco**

```sql
select c.status, c.title, c.updated_at from ai_cases c
  join contatos ct on ct.id = c.contato_id
 where ct.telefone like '%<FINAL DO TELEFONE INTERNO>' order by c.updated_at desc limit 5;
select created_at, action, after->>'aprovadoPorId' as aprovador
  from audit_log where action like 'ai.case.%' order by created_at desc limit 5;
select m.created_at, left(m.conteudo, 60), m.status, m.dados->>'aprovadoPorId' as aprovador
  from whatsapp_mensagens m where m.telefone = '<TELEFONE INTERNO>' and m.direcao = 'out'
 order by m.created_at desc limit 5;
select l.status, l.last_error, r.outbound_message_id
  from ai_send_ledger l join ai_agent_runs r on r.id = l.run_id
 where r.contato_id = (select id from contatos where telefone like '%<FINAL DO TELEFONE INTERNO>' limit 1)
 order by l.created_at desc limit 5;
-- em homologação o ledger termina "failed" com erro de rede: é a trava, não defeito (504d6eab)
```

---

## 7. Fila da equipe

Commits `b65a5563`, `3acdf981`.

**Passos:** Automações › Execuções › visão **Agentes** › **Fila da equipe**.
Com as seções 5 e 6 feitas, conferir as contagens "Aguardando aprovação" e
"Com humano"; clicar em cada uma; filtrar por agente. Repetir na aba
**Gatilhos e atribuição** do agente.

**Esperado:** lista com agente, motivo curto, "Com humano: <nome>" e link para
a conversa; contagens batem com o banco; filtro por agente respeitado.

```sql
select g.nome as agente, a.status, count(*)
  from ai_agent_atribuicoes a join ai_agents g on g.id = a.agent_id
 where a.status in ('aguardando_aprovacao', 'humano')
 group by 1, 2 order by 1, 2;
```

---

## 8. Fluxos: "Quando o lead responder"

Commits `15f72768`, `7efc2934`, `2297ccbb`, `2cc56c1c`, `6bb67a41`.

**Pré-condição:** lead de teste da seção 3 com contato no telefone interno.

**Passos**
1. Automações › Fluxos › novo "Aceite 2010 — para ao responder": gatilho manual
   (ou lead criado com `utm_campaign = aceite-2010`) › Espera 10 min ›
   Enviar WhatsApp. Sem bloco selecionado, nas configurações: **Quando o lead
   responder = Parar o fluxo**. Publicar.
2. Rodar para o lead de teste. Durante a espera, mandar mensagem do celular de
   teste.
3. Duplicar o fluxo com **Continuar o fluxo** e repetir.
4. (Opcional) bloco "IA: responder" seguido de um bloco que usa
   `{{ nos.<bloco>.resposta }}`; e um bloco "IA: classificar".

**Esperado:** com "Parar", a execução vira `cancelado` com "lead respondeu" e o
bloco em que retomaria aparece **pulado** em Execuções; com "Continuar", segue
como antes. "IA: responder" publica o texto enviado (ou `null` se nada saiu);
"IA: classificar"/"gerar texto" não executa ferramenta (não move etapa, não cria
tarefa).

```sql
select e.id, a.nome, e.status, e.erro, e.started_at, e.finished_at, v.settings->>'aoResponder' as ao_responder
  from automacao_execucoes e join automacoes a on a.id = e.automacao_id
  join automacao_versoes v on v.id = e.version_id
 where a.nome like 'Aceite 2010%' order by e.executed_at desc limit 10;
select p.node_type, p.status, p.erro, p.output->>'motivo' as motivo
  from automacao_passos_execucao p
 where p.execucao_id = '<id da execução>' order by p.ordem;
```

---

## 9. Cadência: passo de IA respeita handoff e opt-out

Commits `4177bf38`, `0543ee03`, `cfe7fecd`.

**Passos**
1. Cadência de teste "Aceite 2010" com passo **Mensagem da IA** e passo de
   texto pronto, inscrevendo o lead de teste.
2. Antes do passo de IA, **Assumir conversa** (seção 5b). Deixar o passo rodar.
3. Em outra inscrição: registrar **opt-out** do contato de teste (pedir
   descadastro na conversa, ou o agente registrar opt-out) e deixar o passo de
   texto pronto e o "Enviar WhatsApp" de um fluxo rodarem.
4. Com dono do lead = agente, responder do celular de teste (cadência pausa).

**Esperado:** passo de IA **falha** com motivo visível em Execuções ("o
atendimento está com uma pessoa", "pausado"), sem cair no modelo de reserva;
passos de texto/modelo e "Enviar WhatsApp" falham com **"opt-out"** em vez de
enfileirar; o aviso "lead respondeu" vai para a **pessoa** de devolução, não
para o usuário da agente.

```sql
select e.status, e.cancel_reason, ev.status as passo, ev.resultado->>'motivo' as motivo,
       ev.resultado->>'erro' as erro, ev.created_at
  from cadence_enrollments e join cadence_enrollment_events ev on ev.enrollment_id = e.id
 where e.entity_id in (select id from leads where email like 'aceite.%2010%@callface.ai')
 order by ev.created_at desc limit 20;
select chave, status, fonte, created_at from ai_memoria_fatos
 where chave = 'opt_out' and contato_id in (select id from contatos where telefone like '%<FINAL DO TELEFONE INTERNO>');
```

---

## 10. Lia no pool operacional (migration 0132)

Commit `adb8a9c1`. **Precisa de número marcado operacional** (seção 2) e, em
homologação, conectado (P5). Sem isso a Lia continua sem atender, como antes.

**Passos**
1. Rodar o script (P4): Lia `PASS` e a organização com ≥ 1 operacional
   conectado (sem o AVISO "Lia não atende").
2. Automações › Agentes › Lia: os canais mostram o pool operacional, sem número
   fixo.
3. Celular de teste → número operacional: conversa com a Lia atribuída (ou
   responsável) → ela responde (run criado; envio falha por rede em homologação).
4. Celular de teste → número **não** operacional: a Lia **não** responde.
5. Lead de teste da seção 3 com número preferido: conversa nova aberta pela Lia
   usa `leads.sessao_whatsapp_preferida_id`; sem preferido, o primeiro
   operacional.
6. Tirar o número do pool em Ajustes › WhatsApp e repetir o passo 3: não
   responde mais (sem republicar a Lia). Religar no fim.

**Banco**

```sql
select v.id, v.status, v.guardrail_config->'canais' as canais, v.channel_session_id
  from ai_agent_versions v join ai_agents a on a.id = v.agent_id
 where a.slug = 'lia-sdr';
-- esperado: canais = {"whatsapp": true, "pool": "operacional"}, sem "sessoes", channel_session_id nulo
select r.started_at, r.status, s.label, s.operacional, r.error_code
  from ai_agent_runs r join ai_agents a on a.id = r.agent_id
  left join whatsapp_sessao s on s.id = r.channel_session_id
 where a.slug = 'lia-sdr' order by r.started_at desc limit 10;
```

---

## 11. Rollback das migrations 0131 e 0132

Regra geral (`homologacao.md`): o deploy de um sha anterior **volta o código,
não o banco**. As duas migrations são aditivas e o código anterior ignora as
colunas novas, então o normal é **voltar só o código** e deixar o schema.

- **0132** (`app/src/lib/db/migrations/0132_lia_no_pool_operacional.sql`): o
  bloco `ROLLBACK` no cabeçalho do arquivo tira `canais.pool` das versões da
  `lia-sdr`. A lista fixa antiga **não volta** (o número não existe mais), então
  a Lia fica sem atender, como estava antes de 20/10. Rodar só com decisão do
  Scott, em produção, à mão, e conferir com a consulta da seção 10.
- **0131** (`app/src/lib/db/migrations/0131_captacao_rastreavel_e_numeros_operacionais.sql`):
  o arquivo **não traz bloco ROLLBACK**: é aditiva e idempotente e nenhuma linha
  existente muda. Não há o que desfazer para voltar ao comportamento anterior.
  Se for preciso tirar números do pool sem reverter código, desligue
  "Número operacional" em Ajustes › WhatsApp. Derrubar colunas/tabela perde a
  caixa de entrada e a proveniência dos leads: **não fazer**.
- Nunca editar 0131/0132 (o runner confere hash). Qualquer correção de schema é
  migration nova.
- Em homologação: `scripts/homolog-servidor.sh recarregar-banco` zera tudo.

---

## 12. Promoção para produção

Só **depois** de todas as seções acima marcadas como OK (tabela abaixo) e do
script sem `FAIL`:

```bash
./deploy.sh dev --versao <sha completo validado no P1>
```

O `deploy.sh dev` exige `AREAS_EM_BREVE=automacoes` no `.env` de produção
(ver `homologacao.md`). Depois da promoção:

1. Rodar o script contra produção (mesma receita do P4, trocando para o
   Postgres de produção; continua só leitura). Esperado: migrations, colunas e
   CHECK `PASS`; Lia `PASS`; AVISO "Lia não atende" até alguém marcar número
   operacional em Ajustes › WhatsApp de produção (dado não sobe da homologação).
2. Recriar em produção, se quiser, as regras de distribuição de verdade (as de
   homologação não sobem). **Não** criar a regra "Aceite 2010".
3. Smoke opcional, só com celular interno: mensagem para um número operacional
   e conferir que a resposta da Lia **chega** no aparelho e que o ledger fica
   `sent` com `outbound_message_id`.

---

## Registro do aceite

| # | Capacidade | OK? | Observação |
|---|---|---|---|
| P4 | Script de conferência sem FAIL | | |
| 1 | Privacidade de números privados | | |
| 2 | Números operacionais | | |
| 3 | Distribuição por campanha (site, RD, reentrega) | | |
| 4 | Caixa de entrada e reprocessamento | | |
| 5a | Resposta pelo celular para a IA | | |
| 5b | Pausar / assumir com nome | | |
| 5c | Handoff pedido pelo agente | | |
| 5d | Lia marca reunião → closer | | |
| 5e | Automação de recebida não cala agente | | |
| 6 | Aprovações | | |
| 7 | Fila da equipe | | |
| 8 | Fluxo "Quando o lead responder" | | |
| 9 | Cadência: IA respeita handoff e opt-out | | |
| 10 | Lia no pool operacional | | |
| 12 | Promovido: sha `________` em `____/____` | | |
