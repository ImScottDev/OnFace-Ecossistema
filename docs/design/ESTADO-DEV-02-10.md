# Estado do deploy em dev.crm.callface.io — 02/10

Documento de retomada. Quem pegar daqui não precisa ler o histórico da conversa:
está tudo abaixo, inclusive as armadilhas que custaram horas.

## 1. O que está no ar

O commit `b8018c8` (ONFACE completo: construtor de automações, 5 peças do zip,
NEXO, Ajustes, públicas) **está rodando em dev.crm.callface.io**.

- Código sincronizado: `app/src/` idêntico ao local (1425 arquivos, `diff -rq`
  limpo). `app/public/` subiu, inclusive `public/proto/` (3,4 MB com motion.js
  e logos) que **nunca tinha ido para o DEV**.
- `package.json`, `next.config.ts` e `Dockerfile` idênticos ao local: nenhuma
  dependência nova, nenhuma mudança de build.
- As três imagens reconstruídas: `crm2-dev-app`, `crm2-dev-api`,
  `crm2-dev-worker`. Containers saudáveis.
- Migrations: o banco real está em **93 de 93**, incluindo 0091 e 0092. O app
  aplica na subida.
- 36 rotas conferidas por HTTP (307 para protegida, 404 para inexistente): todas
  corretas. 13 das 15 telas principais abrem logado com dado real e **zero erro
  de console**.

## 2. ARMADILHA PRINCIPAL — o Postgres do DEV tem DOIS bancos

```
callface_crm        161 MB   ← ANTIGO, ninguém usa
callface_crm_novo   187 MB   ← é este que app, api e worker usam
```

Perdi horas trabalhando no `callface_crm`. **Sempre confirme antes:**

```bash
docker exec callface-crm2-dev-app printenv DATABASE_URL | sed -E 's#//[^@]*@#//***@#'
```

O que ficou no banco errado (inofensivo, aditivo, banco sem uso): migrations
0091/0092 e um `dev.local@callface.ai`.

## 3. Acesso

- Basic auth do Traefik + login do CRM. Ver a memória
  `reference_callface_crm2_dev_acesso`.
- Usuário criado para automação: `claude.dev@callface.ai`, papel `super_admin`,
  senha igual à do ambiente local. Ele existe **só no `callface_crm_novo`**.
- O banco real já tem os **16 usuários do time**, inclusive kaua.araujo e scott,
  ambos super_admin.
- Visitante headless remoto: `scratchpad/pw/dev-remoto.mjs` (passa pelo basic
  auth via `httpCredentials` e faz o login do app). Variáveis: `BA_USER`,
  `BA_PASS`, `APP_USER`, `APP_PASS`.

## 4. ABERTO — bug do fuso horário (afeta produção também)

**Só o `wuzapi` tem `TZ` no compose. App, api e worker rodam em UTC**, enquanto
o navegador roda em `America/Sao_Paulo`. Toda tela que calcula "há N dias"
produz um número no servidor e outro no cliente: é o React error #418
(hydration mismatch) em `/pre-vendas` e `/clientes/cs`.

Agora o estrago é pequeno (mesmo dia civil). **Entre 21h e meia-noite o
container já está no dia seguinte**: "hoje" vira "ontem", prazo vencido aparece
como no prazo, e o plano do dia do CS lista o conjunto errado.

Correção (sem rebuild), acrescentar `TZ=America/Sao_Paulo` ao `environment` dos
três serviços e `up -d`. Atenção: se o serviço já tiver bloco `environment:`,
inserir na lista existente em vez de criar um segundo.

**Produção tem o mesmo defeito** e merece a mesma correção.

## 5. ABERTO — token de IA no container da API

O painel NEXO (⌘J) roda no Hono. O container `callface-crm2-dev-api` **não tem
token de IA nenhum**, só `OPENAI_API_KEY`. O worker tem o
`CLAUDE_CODE_OAUTH_TOKEN` que o Codex configurou, e o agente NEXO no DEV já está
como `claude_subscription`. Enquanto a API não receber o token, o painel
responde "IA não configurada". É uma linha no compose e um restart.

## 6. ABERTO — dados de produção (baixa prioridade)

O DEV **já tem dados de produção**, faltando só as últimas semanas:

| | prod | dev | atrás |
|---|---|---|---|
| leads | 4032 | 4016 | 16 |
| negócios | 1606 | 1582 | 24 |
| empresas | 2242 | 2226 | 16 |
| propostas | 1578 | 1560 | 18 |
| mensagens WhatsApp | 31.472 | 27.097 | 4.375 |
| e-mails | 8.219 | 5.121 | 3.098 |

Para julgar se uma tela está certa, isso não atrapalha. **Faça por último**, logo
antes de uma validação humana, para não refazer depois de cada correção.

A comparação de schema (feita por máquina, prod × DEV) deu: 83 tabelas em
produção, todas existem no DEV; **82 totalmente compatíveis**; só
`stripe_webhook_events` diverge (prod tem `stripe_event_id`, o DEV não). O DEV é
superconjunto, com 94 tabelas a mais do modelo canônico.

Pontos que o método tem de respeitar, descobertos na análise:
- O **id da organização é idêntico** nos dois (`320a9052-…`), então o que o DEV
  tem referenciando a organização continua válido.
- `ai_agents`, `ai_provider_credentials`, `roles`, `user_roles` e o catálogo
  Stripe de teste **não existem em produção** — a configuração do Codex está
  segura por construção.
- `usuarios` e `organizacoes` devem ir por **atualização, não substituição**,
  para não perder usuário que só existe no DEV.
- **Nunca `TRUNCATE ... CASCADE`**: em `whatsapp_sessao` ele arrasta
  `ai_agent_versions` e apaga a configuração do NEXO. Use `DELETE` com
  `session_replication_role = replica`.
- `emails.conta_id → email_contas` e `whatsapp_mensagens.sessao_id →
  whatsapp_sessao`: essas duas tabelas têm de vir junto, senão as mensagens não
  carregam.
- Não há fila pendente de envio em produção (`email_sequencia_execucoes` vazia,
  cadências só em estado terminal), então a cópia não dispara nada. O DEV ainda
  tem `WHATSAPP_ALLOWLIST=000000000000` (bloqueia todo envio) e Stripe em modo
  `test`.

## 7. LIÇÃO CARA — build nessa EC2 derruba produção

A EC2 (34.204.200.52) tem **2 vCPU e 7,8 GB** e roda produção, homolog, dev, n8n,
Documenso e dois serviços Python **na mesma máquina**.

Um `docker compose build` normal (buildkit) **saturou a máquina a ponto de o SSH
não autenticar e o Traefik não responder**. Produção ficou fora por cerca de 15
minutos e a máquina reiniciou sozinha.

`docker compose build` usa buildkit, que **ignora limites de CPU e memória**. O
jeito que funciona:

```bash
cd /opt/callface/crm2-dev
sudo env DOCKER_BUILDKIT=0 docker build --cpuset-cpus=1 --memory=4g --memory-swap=9g \
  -f Dockerfile -t crm2-dev-app .
```

`--cpuset-cpus=1` prende o build a um núcleo e **garante o outro para produção**:
a carga ficou em 2,5 em vez de 32, e produção respondeu em 0,5 s o tempo todo.

Também foi preciso: **swap de 2 GB → 6 GB** (o primeiro build morreu com SIGKILL
por falta de memória) e parar o Documenso do DEV durante o build. Depois,
`docker builder prune -af` liberou 18 GB (disco foi de 78% para 74%).

Contexto e Dockerfile de cada serviço (do `compose config`):
- app → `Dockerfile`, api → `Dockerfile.api`, worker → `Dockerfile.worker`
- contexto: `/opt/callface/crm2-dev` (a raiz, não `app/`)

## 8. O QUE FALTA VALIDAR (nunca rodou em lugar nenhum)

1. **O worker executando um fluxo de verdade** — disparo por evento do outbox,
   retomada de espera, agendamento. Local nunca rodou worker.
2. **Construtor de automações de ponta a ponta no DEV**: criar de modelo,
   ensaiar, publicar, disparar, ver execução passo a passo.
3. **Stripe TEST, Microsoft, Documenso** — configurados pelo Codex em blocos
   anteriores, não revalidados depois deste deploy.
4. **NEXO respondendo de verdade** (depende do item 5 acima).
5. **Papéis reais**: validei como super_admin. Closer, SDR e leitor nunca
   abriram as telas.

## 9. Regras que continuam valendo

- Não mexer em homolog nem em produção. O DEV é o alvo até ele substituir o
  legado de verdade.
- O Codex trabalha na mesma branch em paralelo.
- Nada foi commitado além do `b8018c8`; o deploy é rsync, não git.
- Backup do DEV antes de tudo:
  `/opt/callface/crm2-dev/_backup-pre-b8018c8-20261001-1505.sql.gz` (28 MB).
