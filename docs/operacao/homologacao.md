# Homologação e promoção para produção

Dois ambientes, **o mesmo código e a mesma imagem**. Muda só onde ela roda.

| | Homologação | Produção |
|---|---|---|
| Endereço | https://dev.crm.callface.io | https://crm.callface.io |
| Pasta no servidor | `/opt/callface/crm2-homolog` | `/opt/callface/crm2-dev` |
| Banco | cópia própria de produção | o real |
| Integrações (Microsoft, Stripe, Documenso, IA...) | **As mesmas de produção** (mesmo `.env`) | Sim |
| WhatsApp (receber) | **Espelhado** de produção (ver seção WhatsApp) | O principal |
| WhatsApp e e-mail para fora | **Travados**: só números e `@callface.ai` internos | Livres |

A imagem de cada commit é montada pelo GitHub assim que o código entra na `main`.
O deploy só puxa essa imagem pronta (minutos). Promover é rodar em produção
**o mesmo commit** que já foi testado em homologação. Nada é refeito.

## O fluxo

**1. Publicar em homologação** (depois de dar `git push` na `main`):

```bash
cd onface-ux-rebuild
git pull --rebase origin main && git push origin HEAD:main
./deploy.sh homolog                 # publica o commit atual
./deploy.sh homolog <sha>           # ou um commit específico
```

O script espera a imagem ficar pronta (até 20 min se o GitHub ainda estiver
montando), confere ambiente e banco, e troca. Se o terminal cair:
`./deploy.sh homolog --seguir`.

**2. Validar.** Abra https://dev.crm.callface.io e entre com o seu usuário de
sempre (a senha é a mesma de produção: o banco é uma cópia). Teste o que mudou.
Aqui pode apagar, errar e mexer à vontade: é cópia.

**3. Promover para produção.** Quando estiver bom, use o **mesmo commit**:

```bash
git rev-parse --short HEAD          # ou o sha que você validou
./deploy.sh producao --versao <sha-completo>
```

O script avisa se esse sha não é o que está validado em homologação. Para
conferir o que cada ambiente está rodando:

```bash
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  'echo homolog: $(cat /opt/callface/crm2-homolog/.onface-release); echo prod:    $(cat /opt/callface/crm2-dev/.onface-release)'
```

**4. Voltar atrás.** Rode o sha anterior no ambiente que deu problema:

```bash
./deploy.sh producao --versao <sha-anterior>        # produção
./deploy.sh homolog <sha-anterior>             # homologação
```

Atenção: o código volta, **migrations de banco não voltam**. Por isso migration
é sempre aditiva (regra do `AGENTS.md`). Em homologação isso é inofensivo:
`recarregar-banco` (abaixo) zera tudo.

## Recarregar a cópia do banco

Quando a homologação ficar desatualizada ou bagunçada (apaga o banco de lá e
copia o de produção de novo; **não altera produção**, que só é lida; leva uns 2 minutos):

```bash
scripts/homolog-servidor.sh recarregar-banco
```

A cópia sai **saneada** (`scripts/homolog-sanear.sql`): sem os tokens de e-mail/agenda
(Microsoft e Gmail), sem a sessão de WhatsApp e sem eventos pendentes. Os dados são os
reais de clientes e ficam só no servidor. O script confere que nenhum token de e-mail
sobrou e **aborta** se sobrou.

## Banco: o ajuste que você faz em homologação sobe para produção?

**O schema sim. Os dados não.**

- **Schema** (tabela nova, coluna nova, índice, constraint) é sempre uma *migration* no
  repositório (`app/src/lib/db/migrations`). O `deploy.sh` aplica as migrations do sha em
  cada ambiente antes de trocar o container. Então: você cria a migration, publica em
  homologação (`./deploy.sh homolog`), valida, promove o **mesmo sha** (`./deploy.sh producao --versao <sha>`) e a
  produção aplica a mesma migration. Nada a fazer à mão.
- **Dados** não sobem. O que você digita, cria ou apaga em homologação fica em homologação.
  Exemplo: você cria em homologação o plano "Enterprise 2027" e uma etapa nova de funil.
  A *coluna* que guarda isso sobe com a migration; o *plano* e a *etapa* que você
  cadastrou **não** existem em produção, e têm que ser cadastrados lá (ou entrar numa
  migration de dados idempotente, se for configuração que todo ambiente precisa ter).
- Nunca altere o schema direto no banco de homologação (`psql`): produção não teria a
  mudança e a promoção quebraria. Migration aplicada também não se edita (o runner confere hash).

## Fechar ou abrir uma área por ambiente

Quais áreas aparecem "em breve" é uma variável do `.env` do servidor, não código:
`AREAS_EM_BREVE=automacoes` fecha Automações (página, subrotas e selo no menu);
vazia ou ausente = **aberta**. Hoje: **produção fecha Automações, homologação deixa aberta**.
Insights está aberto nos dois.

```bash
# homologação (recria os containers):
scripts/homolog-servidor.sh env AREAS_EM_BREVE=automacoes     # fechar
scripts/homolog-servidor.sh env AREAS_EM_BREVE=               # abrir
# produção: editar AREAS_EM_BREVE em /opt/callface/crm2-dev/.env e
#   sudo docker compose -p crm2-dev up -d --force-recreate --no-deps app api worker
```

Sem commit nem deploy. **Antes do próximo deploy de produção**, a linha `AREAS_EM_BREVE=automacoes`
tem que estar no `.env` de produção: o `deploy.sh producao` se recusa a publicar sem ela
(sem a variável o código abre a área, e Automações apareceria para o time pela metade).

## O que está ligado e o que pode acontecer

O `.env` de homologação é a **cópia do de produção**. Só mudam o endereço (`dev.crm.callface.io`),
o banco e o Redis (os da homologação) e as três travas abaixo. Ou seja: as chaves são as **reais**,
e um teste aqui **age no mundo real**, salvo onde há trava.

| Integração | Ligada? | O que um teste pode atingir |
|---|---|---|
| **WhatsApp** | Recebe igual a produção (espelho); **envia só com trava** | Mensagens **recebidas** chegam também aqui (relé espelhado, seção abaixo). Mensagem **enviada** só para números em `WHATSAPP_ALLOWLIST` (hoje `0000000000`, ninguém): passe os números do time com `scripts/homolog-servidor.sh env WHATSAPP_ALLOWLIST=5511...,5511...`. |
| **E-mail** (Resend, Outlook, Gmail, SMTP), **convite de agenda** e **assinatura de contrato** | Sim, com **trava** | Só endereços `@callface.ai` (`EMAIL_ALLOWED_DOMAINS`). Proposta, contrato, convite de reunião para cliente real é bloqueado antes de sair; a tela mostra erro. |
| **Stripe** | **Sim, em modo LIVE, sem trava** | **Dinheiro de verdade.** Checkout, fatura e cobrança criados aqui usam a conta real e os clientes reais da cópia. O Stripe pode mandar e-mail de fatura ao cliente por conta própria (fora da nossa trava). Não cobre nem emita fatura de cliente real em teste. Os avisos do Stripe (webhook) só chegam em produção, então o status de pagamento **não atualiza** aqui. |
| **Documenso** (assinatura) | Sim, o **mesmo** de produção, com a trava de e-mail | Os envelopes criados aqui aparecem no Documenso real (mesmo painel), mas só para `@callface.ai`. A conclusão da assinatura não volta para a homologação (o aviso vai para produção, que ignora envelope desconhecido). |
| **Microsoft** (agenda e e-mail) | Sim, mesmo app do Azure | **Leia a caixa abaixo.** |
| **IA** (OpenAI, Groq, Claude) | Sim | Gasta crédito real. Respostas a clientes ainda passam pelas travas de WhatsApp e e-mail. |
| **Meta** (anúncios, formulários, conversões) | Sim | Evento de conversão gerado aqui (lead, ganho) pode ser enviado ao pixel/CAPI **reais** e sujar a otimização dos anúncios. Evite mover negócio real para Ganho em teste. |
| **RD Station**, Apollo, Callface AI (banco só leitura) | Sim | Consultas reais (custo/limite de API). Nada é escrito no Callface AI. |

**Os dados são os reais dos clientes** (cópia). Tratar com o mesmo cuidado de produção.

### Microsoft: risco a decidir (Scott)

**O que eu apurei.** Produção e homologação usam **o mesmo app do Azure** (`MICROSOFT_CLIENT_ID`) e **o mesmo secret**.
O `AGENTS.md` avisa que "o refresh do OAuth invalida a sessão de produção". A mecânica real, no
código (`app/src/lib/email/microsoft.ts`): o secret em si não é consumido por usar; o que
**rotaciona** é o *refresh token de cada usuário*, guardado no banco (`email_contas`). A Microsoft pode
devolver um token novo a cada renovação e o código grava o novo. Se a homologação tivesse a
**cópia** do token de produção e o renovasse, o token guardado em produção ficaria obsoleto e o
time **perderia agenda e e-mail** até reconectar.

**O que foi feito.** A cópia do banco é saneada: todos os tokens de `email_contas` vão a `NULL` e o
`recarregar-banco` **aborta** se algum sobrar. Assim a homologação **não tem nenhum token de produção**
e nunca renova o de ninguém. Cada pessoa que conectar o Outlook em `dev.crm.callface.io` gera um token
**próprio e independente** (a Microsoft aceita vários por usuário e app), sem afetar o de produção.
O `dev.crm.callface.io` já é redirect URI cadastrado no app.

**Fica ligado**, então. O que continua valendo:

> **RISCO, em letra grande: o secret é compartilhado.** Girar/revogar o secret do app no Azure derruba
> **os dois ambientes**. E se alguém copiar o banco de produção para a homologação **sem** passar pelo
> saneamento (`recarregar-banco`), os tokens reais vão junto e a homologação passa a poder
> **derrubar a agenda e o e-mail do time**. Nunca restaure banco de produção aqui por outro caminho.
> Conectar o Outlook em homologação grava/cria eventos e lê a caixa **reais** de quem conectou
> (convites a terceiros ficam travados em `@callface.ai`).

**Como separar de vez, se quiser:** criar um segundo app no Azure (Entra ID > Registros de aplicativo) só da homologação,
com redirect `https://dev.crm.callface.io/api/...` (o mesmo caminho do de produção), e trocar `MICROSOFT_CLIENT_ID`
e `MICROSOFT_CLIENT_SECRET` no `.env` de homologação (`scripts/homolog-servidor.sh env ...`). Aí os secrets deixam
de ser compartilhados. Decisão sua; hoje está ligado com o app de produção.

## WhatsApp em homologação: recebe igual, não responde

Produção e homologação usam **o mesmo número de WhatsApp** (o mesmo wuzapi, `callface-crm-wuzapi`).
Só existe um lugar que recebe o aviso do provedor: o **relé** (`callface-wa-relay`, nginx, config em
`/opt/callface/wa-relay/nginx.conf` no servidor). Cada mensagem recebida entra no relé, que:

1. entrega a **produção** (`callface-crm2-dev-api`): é a entrega **principal**, a que responde ao provedor;
2. **copia** a mesma entrega para a **homologação** (`callface-crm2-homolog-api`) com o `mirror` do nginx.

```
cliente -> wuzapi -> relé ──(principal)──> produção  (crm.callface.io)
                       └──(cópia, resposta descartada)──> homologação (dev.crm.callface.io)
```

**Por que a homologação não atrapalha a produção** (testado em 13/10/2026, não é suposição):
a resposta da cópia é descartada pelo nginx e quem responde ao provedor é só a produção. Com a
homologação parada, congelada (`docker pause`), recusando conexão, com nome inexistente ou devolvendo
erro 500, o relé respondeu em ~0,1 s e a produção recebeu a mensagem normalmente. A cópia tem
timeout de 1 s para conectar e 3 s para ler, justamente para nunca segurar a principal.
Se a homologação cair, **ela** perde as mensagens desse período (não há reenvio; é cópia de teste).
A produção não perde nada.

**Como o cliente não recebe resposta em dobro.** A homologação recebe a mensagem e pode "querer"
responder (IA/SDR, cadência, automação, resposta automática). Três camadas impedem que isso saia:

1. **Rede.** A homologação nem enxerga o wuzapi: ele só está nas redes de produção (`crm2dev-network`),
   e o nome `callface-crm-wuzapi` não resolve nos containers da homologação. Ela não consegue enviar,
   marcar como lido, desconectar o número nem baixar mídia/foto, mesmo que o código tentasse.
2. **Código** (`app/src/lib/whatsapp/client.ts`, `checarAllowlist`). Todo envio ao wuzapi, de qualquer
   fluxo (tela, NEXO, IA, cadência, automação, campanha), passa por um funil só. Com
   `WHATSAPP_ALLOWLIST` preenchida: mensagem, reação, "digitando", apagar e "lido" (tique azul) só
   saem para número da lista; conectar/desconectar/parear número e a API de administração são
   **bloqueados**; rota nova que ninguém classificou nasce **bloqueada**. Em produção a variável é
   vazia e nada muda.
3. **IA.** O SDR por IA nem roda para número fora da lista (não gasta crédito para uma resposta
   que a trava barraria).

O teste `app/src/lib/whatsapp/client-trava.test.ts` falha se alguém criar um caminho novo para o
wuzapi sem a trava (rota não classificada, `fetch` direto ao wuzapi fora do `client.ts`).
Se algum dia a homologação for ligada à rede do wuzapi, **a camada 2 passa a ser a única proteção**:
mantenha a `WHATSAPP_ALLOWLIST` preenchida.

Limite da cópia: sem acesso ao wuzapi, mensagens recebidas com **foto, áudio ou documento** aparecem
na homologação sem o arquivo (o download passa pelo wuzapi). Texto vem completo.
Cada mensagem recebida também dispara as automações da cópia (e-mails só para `@callface.ai`).

### Operar o espelho

```bash
scripts/homolog-espelho-whatsapp.sh status      # LIGADO ou DESLIGADO
scripts/homolog-espelho-whatsapp.sh desligar    # homologação deixa de receber; produção continua igual
scripts/homolog-espelho-whatsapp.sh ligar
```

O script faz backup (`nginx.conf.bak-espelho-<data>`), valida com `nginx -t` antes do `reload` e não
imprime o segredo. O `reload` é sem queda. Para voltar à mão: copie um backup por cima de
`/opt/callface/wa-relay/nginx.conf` **com `cat backup > nginx.conf`** (não `mv`/`cp` trocando o arquivo:
ele é montado no container como arquivo único, e trocar o arquivo deixa o container com a versão velha)
e rode `docker exec callface-wa-relay nginx -t && docker exec callface-wa-relay nginx -s reload`.

Confirmar que produção está recebendo: `docker logs --tail 20 callface-wa-relay` deve mostrar
`status=200 antigo=200` (`antigo` é a resposta da produção). Se aparecer outra coisa, desligue o espelho primeiro
e investigue depois.

Se a **homologação for recriada** (novo nome de container/pilha), o nome `callface-crm2-homolog-api`
dentro do arquivo do relé precisa acompanhar, e o segredo da cópia (`UAZAPI_WEBHOOK_SECRET`, o mesmo de produção) também.

## Montagem (uma vez só, já feita em 13/10/2026)

1. DNS: `dev.crm` já existia (`A dev.crm → 34.204.200.52`, mesmo IP de `crm`), desde antes da virada. Nada a criar.
   As integrações (Microsoft/Azure, OAuth, webhooks) já têm esse domínio liberado.
2. `scripts/homolog-servidor.sh preparar`: cria a pasta, refaz o `.env` **a partir do de produção** (no servidor;
   o segredo não passa pelo seu Mac nem pelo git) e sobe banco e Redis. Pode rodar de novo para trazer chave nova
   de produção: preserva a senha do banco e as travas.
3. `scripts/homolog-servidor.sh recarregar-banco`: traz a cópia saneada.
4. `./deploy.sh homolog`: primeira publicação.

O `homolog.crm.callface.io` é o CRM legado congelado (volta da virada) e **não tem relação** com este.
