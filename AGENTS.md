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
- Ambiente de validação: `https://dev.crm.callface.io`, publicado com
  `./deploy.sh dev` a partir de um commit.
- **Produção (`crm.callface.io`) só pela virada, com OK explícito do Kauã.**
  Nenhum comando em `/opt/callface/crm` sem essa aprovação.

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

## Referências

- Stripe (checkout, invoice, assinatura): leia
  `docs/operacao/stripe-referencia-agentes.md` antes de mexer.
- Spec do Módulo 01 (Vendas): `docs/produto/specdrive-modulo-01-vendas.md`.
- Como uma tela do handoff de design vira tela do produto:
  `docs/design/COMO-LIGAR-UMA-TELA.md`.
- Contexto de negócio e histórico: vault do Scott,
  `02_PROJETOS/Callface/ONFACE/HUB.md`.
