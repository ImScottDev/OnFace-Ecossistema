# ONFACE — instruções para agentes de código

Leia o `README.md` para o mapa do sistema. Este arquivo tem as regras de
trabalho. Para a frente de produto e telas, leia também
[`docs/operacao/protocolo.md`](./docs/operacao/protocolo.md): as quatro leis
(adaptar nunca criar, Design System como fonte única, quem faz não fecha, o
gate é o navegador), a ordem de trabalho e a definição de pronto.

## Onde o trabalho acontece

- Repositório: `github.com/ImScottDev/OnFace-Ecossistema`. **Uma branch só:
  `main`.** Não crie branch nem worktree para tarefa pontual.
- `github.com/ImScottDev/callface-crm` é o CRM anterior. Não é fonte do ONFACE:
  não compare com ele, não traga código dele, não faça push nele.
- **Desde a virada de 13/10/2026 o ONFACE É a produção:** `https://crm.callface.io`,
  pilha `crm2-dev` em `/opt/callface/crm2-dev`, publicado com `./deploy.sh dev`
  a partir de um commit. Todo deploy vai para o time que está operando:
  typecheck e testes antes, e cuidado com envios reais (WhatsApp, e-mail,
  Stripe live, Documenso).
- **Fluxo normal: homologação antes de produção.** `./deploy.sh homolog` publica em
  `https://dev.crm.callface.io` (.env de produção, banco cópia, WhatsApp e e-mail travados); validado, promove-se o
  mesmo sha com `./deploy.sh dev --versao <sha>`. Guia: `docs/operacao/homologacao.md`.
  Não confundir com o `homolog.crm.callface.io` abaixo, que é o legado.
- **Deploy parado em "esperando ... no GHCR"?** O portão roda num runner
  self-hosted no Mac do Scott (`RUNNER_PORTAO=onface-mac`), porque a cota de
  Actions do repositório privado esgotou em 19/10/2026 e travou todo deploy.
  Primeiro a conferir é se o runner está online — Mac desligado deixa o job na
  fila e o `deploy.sh` estoura os 20 min como se fosse falta de cota. Receita,
  troca de máquina e fallbacks: [`docs/operacao/portao-sem-cota.md`](./docs/operacao/portao-sem-cota.md).
- O CRM legado fica em `homolog.crm.callface.io`, só consulta, worker parado
  (`/opt/callface/crm`). Não religar nem escrever no banco dele. Volta da
  virada: `scripts/virada-dominio-voltar.sh 20261013-0408`.

## Commits

- Commits saem em nome do autor humano. **Sem `Co-Authored-By` de IA, sem
  "Generated with".**
- Mensagem em português, dizendo o que mudou para quem usa e por quê.
- O deploy publica só o que está commitado.

## Regras que não se quebram

- **Multi-tenant:** toda leitura e escrita filtra por `organizacao_id`, que vem
  da sessão no servidor (`getTenantContext`), nunca do cliente.
- **Escrita comercial passa pelas portas** de `app/src/lib/vendas`; a decisão de
  Ganho passa pela política da oferta (`app/src/lib/crm/won-evidence.ts`).
- **Migration aplicada não se edita.** O runner (`app/src/lib/db/migrar.ts`)
  confere hash. Mudança de schema é uma migration nova, idempotente.
- **Nada de `drizzle-kit push`.** O schema muda só por migration.
- **Segredo nunca em arquivo versionado** (código, script, compose, doc). Vem do
  `.env` do ambiente.
- **URL pública** (links de e-mail, proposta, checkout) sai de
  `app/src/lib/app-url.ts`, nunca de um fallback local.
- **Client Component não importa módulo que importa `db`.**
- **Design System:** componente sai de `app/src/components/ui` (shadcn); falta
  semântica de produto → variante dentro do componente, nunca componente
  paralelo; cor por token, nunca hex. Laboratório vivo em `/design`.
- Não rode `pnpm build` com o `next dev` de pé (sobrescreve `.next`).
- **Padrão único:** cada coisa (reunião, atividade, arquivo, proposta, data,
  vínculo) tem UM componente, UM ponto de entrada e UMA fonte de dado
  carregada por id, usados em TODAS as superfícies (página, drawer,
  Pré-vendas, fichas, Cliente 360, calendário, Início, NEXO). Bug apontado
  numa tela se corrige na causa compartilhada, para todas.
- **Nunca substituir** uma peça ou fluxo existente (ex.: peça de atividade com
  subatividades e painel lateral, peça de reunião) por versão simplificada ou
  paralela. Mudança visível de comportamento exige OK explícito do Scott.

## `.env` de desenvolvimento local

Ao gerar o `app/.env` a partir de um `.env` real, **deixe vazias** as chaves
com efeito colateral real ou token compartilhado com produção:
`STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`,
`RESEND_API_KEY`, `MICROSOFT_CLIENT_SECRET` (o refresh do OAuth invalida a
sessão de produção), `RD_REFRESH_TOKEN`.

## Antes de dizer que está pronto

```bash
pnpm typecheck                                # raiz
cd app && pnpm test                           # suíte completa
npx tsx --env-file=.env src/scripts/checar-rotas-onface.ts   # telas do menu, logado
```

E abra a tela no navegador: teste verde não prova que a tela funciona.

## Sessão sem a máquina do Scott (nuvem, CI, contratado)

Trabalhando só com o repositório — sem o vault, sem a chave do servidor, sem
banco e sem sessão logada no produto: leia
[`docs/operacao/handoff-sessao-nuvem.md`](./docs/operacao/handoff-sessao-nuvem.md).
Ele diz o que dá para verificar aí (typecheck, travas de arquitetura e build
rodam sem banco), o que não dá (deploy e suíte completa) e como devolver o
trabalho sem anunciar como pronto o que não foi aberto no navegador.

## Referências

- Stripe (checkout, invoice, assinatura): leia
  `docs/operacao/stripe-referencia-agentes.md` antes de mexer.
- Spec do Módulo 01 (Vendas): `docs/produto/specdrive-modulo-01-vendas.md`.
- Como uma tela do handoff de design vira tela do produto:
  `docs/design/COMO-LIGAR-UMA-TELA.md`.
- Contexto de negócio e histórico: vault do Scott,
  `02_PROJETOS/Callface/ONFACE/HUB.md`.
