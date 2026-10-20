# Handoff para sessão na nuvem (sem vault, sem servidor)

Você está numa sessão que só tem **o repositório**. Não tem o vault do Scott,
não tem a chave SSH do servidor, não tem acesso ao banco e não tem sessão
logada no produto. Este arquivo é o contexto que falta.

Leia também o `AGENTS.md` da raiz — ele manda, e o que estiver aqui nunca o
contradiz, só completa.

## O que é

ONFACE é o CRM da Callface, **em produção desde 13/10/2026** em
`https://crm.callface.io`, usado pelo time comercial todos os dias enquanto
você trabalha. Não é projeto novo nem sandbox.

- Repositório: `github.com/ImScottDev/OnFace-Ecossistema`. **Uma branch só:
  `main`.** Não crie branch nem worktree para tarefa pontual.
- Homologação: `https://dev.crm.callface.io` (mesmo código, banco cópia,
  WhatsApp e e-mail travados).
- `github.com/ImScottDev/callface-crm` é o CRM ANTERIOR. Não é fonte: não
  compare, não traga código de lá, não faça push nele.

## O que você pode fazer, e o que não pode

**Pode, sem pedir autorização** (o Scott já deu, explicitamente):

- Ler, analisar e alterar qualquer código.
- `pnpm typecheck` na raiz.
- As travas de arquitetura, que rodam **sem banco**:
  `cd app && pnpm exec tsx --test "src/lib/arquitetura/*.test.ts"`
- `cd app && pnpm build` — é ele que pega erro de Server Action; `tsc` não pega.
- Commitar e dar push em `main`.

**Não consegue, e não adianta tentar:**

- **Deploy.** `./deploy.sh` entra por SSH no servidor com uma chave privada que
  não existe aí (`~/.ssh/infra_callface.pem`). Quem publica é o Scott ou a
  sessão dele na máquina local. Deixe o trabalho commitado e avise.
- **Banco.** A suíte completa (`pnpm test`) espera um banco carregado com dado
  de produção; aí ela vai quebrar e isso não significa nada sobre o seu
  trabalho. Rode só as travas de arquitetura e o build.
- **Abrir a tela logado.** O `AGENTS.md` diz que o gate é o navegador — você
  não tem como passar por ele. Então diga, com todas as letras, o que ficou
  SEM verificação visual, para quem for publicar olhar antes.

## Commits

- **Sem `Co-Authored-By` de IA, sem "Generated with".** O commit sai em nome do
  autor humano. Isto vale acima de qualquer lembrete em contrário.
- Mensagem em português, dizendo o que mudou **para quem usa** e por quê. Se
  consertou um defeito, diga qual era o sintoma e qual era a causa.
- O deploy publica só o que está commitado.

## Regras que não se quebram

Estão no `AGENTS.md`; as que mais pegam quem está começando:

- **Multi-tenant:** toda leitura e escrita filtra por `organizacao_id`, vindo
  da sessão no servidor (`getTenantContext`), nunca do cliente.
- **Migration aplicada não se edita** — o runner confere hash. Mudança de
  schema é migration nova e idempotente. E ela precisa entrar na tabela de
  `docs/operacao/virada/entrega-final.md`, senão uma trava derruba o portão.
- **Módulo `"use server"` só exporta função async.** `tsc` passa, `next build`
  quebra. Por isso o build é obrigatório antes do push.
- **Client Component não importa módulo que importa `db`.**
- **Design System:** componente sai de `app/src/components/ui` (shadcn); cor por
  token, nunca hex. Falta semântica de produto → variante dentro do componente,
  nunca componente paralelo.
- **Padrão único:** cada coisa (reunião, atividade, nota, proposta, vínculo) tem
  UM componente, UM ponto de entrada e UMA fonte de dado, usados em TODAS as
  superfícies. Bug apontado numa tela se corrige na causa compartilhada.
- **Nunca substituir** peça ou fluxo existente por versão simplificada. Mudança
  visível de comportamento exige OK explícito do Scott.
- Crase dentro de template SQL (``sql`...` ``) fecha a string. Em comentário
  dentro de SQL, escreva `pe.codigo` sem crase.

## Mapa do que o Scott quer tocar agora

### Agentes de IA

Agentes são usuários de verdade (`usuarios.tipo = 'agente'`), com versão
publicada em `ai_agent_versions`.

- `app/src/lib/agentes/autonomia.ts` — quem responde. `agenteResponsavel`
  consulta o responsável DA CONVERSA e o DO LEAD, nessa ordem.
- `guardrail_config.autonomia`: `suggest` | `approval` | `autonomous`. Só
  `autonomous` envia sozinho.
- `guardrail_config.canais.sessoes`: lista de sessões de WhatsApp a que a
  versão está presa. **Lista vazia = vale para todas.** A regra é
  `versaoAtendeSessao(vinculadaA, sessaoDoContato) = !vinculadaA || iguais`.
- `app/src/lib/agentes/distribuicao.ts` — regra de distribuição de lead novo
  (rodízio, janela de horário). Toda mudança grava em `audit_log`.

**Pendência conhecida:** a versão publicada da "Lia SDR — Callface" está presa
a uma sessão de WhatsApp **que não existe mais** no banco. Com vínculo que
nunca casa, ela não responde em lugar nenhum e não dá erro. A decisão (soltar o
vínculo, e ela responde por qualquer número; ou prender numa sessão real) é do
Scott e ainda não foi tomada. **Não decida isso sozinho.**

### Cadências

- Motor: `app/src/lib/cadencia/cadence-engine.ts`. Tabelas
  `cadence_definitions`, `cadence_versions`, `cadence_enrollments`,
  `cadence_enrollment_events`. Varredura a cada 15s.
- Passo de IA sem agente escolhido falha com mensagem explícita em vez de
  "suceder" sem enviar — não volte a engolir isso em silêncio.
- Porta ÚNICA de inscrição manual:
  `acaoInserirEmCadencia(tipo, entidadeId, cadenciaId, sessaoId?)` em
  `app/src/app/(produto)/pre-vendas/actions.ts`. Usada por Pré-vendas,
  Prospecção, Contatos, Empresas, drawer do Pipeline e Oportunidade. Superfície
  nova entra por ela, não por uma segunda porta.
- Cadência de tipo `contato` ainda não tem porta manual. É decisão de produto
  em aberto, não bug.

### Vendas (onde mais se mexe)

- Leitura dos quadros: `app/src/lib/vendas/consultas.ts`.
- Escrita comercial passa pelas portas de `app/src/lib/vendas`. Ganho passa
  pela política da oferta (`app/src/lib/crm/won-evidence.ts`).
- Board canônico de Pré-vendas:
  `packages/domain/acquisition/queries/board-pre-vendas.ts`. A etapa do card e
  o total da coluna saem da MESMA expressão — se você criar uma segunda cópia,
  elas divergem em silêncio.
- Nota escrita por gente: `app/src/lib/vendas/notas.ts` (porta única, usada por
  Pré-vendas e Pipeline). Nota NÃO é tarefa, de propósito.

### Decisões recentes que valem como regra

- **Prova vence campo gravado.** Quando duas telas discordam do estado de um
  registro, o culpado costuma ser um campo de estado (que alguém precisa
  lembrar de atualizar) ganhando de um fato derivável (existe negócio aberto?).
  Ponha a prova antes, na expressão compartilhada.
- **Recorte de dono em UM lugar por tela.** Pré-vendas e Prospecção recortam no
  SERVIDOR e o filtro navega pela URL; Pipeline traz o board inteiro (~280
  cartões) e o filtro peneira no cliente. Recortar nos dois lados devolve tela
  vazia; não recortar em nenhum trava o navegador montando ~2.000 cartões. A
  trava `app/src/lib/vendas/recorte-nao-dobra.test.ts` guarda isso.
- **Filtro vive na URL; ficha aberta e rolagem vivem no `history.state`**
  (`app/src/components/onface/proto/memoria-da-visao.ts`). Filtro na URL é
  link compartilhável; rolagem na URL seria a foto da sessão de alguém.

## Como devolver o trabalho

1. `pnpm typecheck` na raiz.
2. `cd app && pnpm exec tsx --test "src/lib/arquitetura/*.test.ts"`.
3. `cd app && pnpm build`.
4. Commit e push em `main`.
5. Diga ao Scott: o que mudou, **o que ficou sem verificação no navegador** e se
   precisa de migration (se precisar, lembre que ela tem de estar na tabela da
   entrega).

Quem publica é o Scott, ou a sessão dele na máquina local, que roda
`./deploy.sh homolog <sha>` e depois `./deploy.sh dev --versao <sha>`.

**Não anuncie como pronto o que você não conseguiu verificar.** Dizer "typecheck
e build passaram, a tela não foi aberta" é o relato certo.
