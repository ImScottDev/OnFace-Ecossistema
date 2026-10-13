# Homologação e promoção para produção

Dois ambientes, **o mesmo código e a mesma imagem**. Muda só onde ela roda.

| | Homologação | Produção |
|---|---|---|
| Endereço | https://qa.crm.callface.io | https://crm.callface.io |
| Pasta no servidor | `/opt/callface/crm2-homolog` | `/opt/callface/crm2-dev` |
| Banco | cópia própria de produção | o real |
| Manda e-mail, WhatsApp, cobra? | **Não, nunca** | Sim |

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

**2. Validar.** Abra https://qa.crm.callface.io e entre com o seu usuário de
sempre (a senha é a mesma de produção: o banco é uma cópia). Teste o que mudou.
Aqui pode apagar, errar e mexer à vontade: é cópia.

**3. Promover para produção.** Quando estiver bom, use o **mesmo commit**:

```bash
git rev-parse --short HEAD          # ou o sha que você validou
./deploy.sh dev --versao <sha-completo>
```

O script avisa se esse sha não é o que está validado em homologação. Para
conferir o que cada ambiente está rodando:

```bash
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  'echo homolog: $(cat /opt/callface/crm2-homolog/.onface-release); echo prod:    $(cat /opt/callface/crm2-dev/.onface-release)'
```

**4. Voltar atrás.** Rode o sha anterior no ambiente que deu problema:

```bash
./deploy.sh dev --versao <sha-anterior>        # produção
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

A cópia sai **saneada** (`scripts/homolog-sanear.sql`): sem credenciais de
e-mail, WhatsApp e IA, e sem eventos pendentes. Os dados são os reais de
clientes e ficam só no servidor.

## Por que homologação não manda nada para ninguém

O `.env` dela é gerado do zero, sem copiar nada do de produção. Ficam **vazios**:
Stripe, Resend (e-mail), Microsoft, RD Station, Meta, WhatsApp (uazapi), Documenso e IA.
A trava de WhatsApp aponta para um número que não existe. Chaves de cifra são
próprias, então credencial cifrada que viesse na cópia nem abre.
Consequência: nesse ambiente **não** se testa envio de e-mail, WhatsApp, checkout,
assinatura de contrato nem NEXO. Para testar um desses, edite o `.env` em
`/opt/callface/crm2-homolog` **com chave de teste** (nunca a de produção) e avise o time.

## Montagem (uma vez só)

1. DNS: registro `A  qa.crm  →  34.204.200.52` na Cloudflare (só DNS, sem proxy), igual ao de `crm`.
2. `scripts/homolog-servidor.sh preparar`: cria a pasta, o `.env` e sobe banco e Redis.
3. `scripts/homolog-servidor.sh recarregar-banco`: traz a cópia.
4. `./deploy.sh homolog`: primeira publicação.

O `homolog.crm.callface.io` é o CRM legado congelado (volta da virada) e **não tem relação** com este.
