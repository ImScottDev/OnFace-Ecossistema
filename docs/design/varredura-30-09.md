# Varredura de telas — 30/09

Feita porque o Kauã reportou "páginas bugadas e o sidebar não funciona". Estava
certo nas duas coisas.

## O sidebar não navegava — recursão infinita

**O bug mais grave desta sessão, e era meu.**

As telas do handoff definem `ir(href, label)` chamando `E.irPara(...)`. Meu
portador gerava `irPara: (href) => this.ir(href)` — apontando de volta para o
método da classe. O ciclo `ir → irPara → ir` estourava a pilha
("Maximum call stack size exceeded") e **nenhum item do menu navegava**.

Corrigido no portador: `irPara` chama a PROP (`this.props.ir`), que é o
`router.push` do adaptador. Afetava todas as telas, não só a casca.

## "Início" caía em 404

O item aponta para `/onface-preview/visao-geral`, e a regra genérica de tirar
o prefixo produzia `/visao-geral`, que não existe. Trocada por mapa explícito
(ver DEFEITOS-DO-HANDOFF §7).

## Atendimento não preenchia a tela

`.onface-conteudo-interno` media 1128px e o workspace dentro media 416px:
sobrava meia tela branca. O container era `display:block`, e a altura não
chega ao filho por bloco. Mesma correção que `desenho` já tinha —
`flex column` — agora também em `tela-cheia`.

## O que NÃO era bug do código

**Os 500 em `/api/*`** eram o meu ambiente: eu tinha subido só o `next dev`, e
o Hono (porta 3012) não estava no ar. `scripts/dev.sh` sobe os três (app, api,
worker) — rodar só o app deixa `/clientes`, `/tarefas` e as telas que falam
com a API em erro.

**Os renders de 30s** eram concorrência do próprio teste: nove navegações em
rajada. Medido isolado depois: Pipeline 1,1s, Pré-vendas 4,2s, Contatos 2,1s.

## Estado por rota

Todas as 25 rotas do menu respondem 200. Verificadas no navegador:
`/inicio`, `/atendimento`, `/tarefas`, `/clientes`, `/clientes/cs`,
`/pre-vendas`, `/pipeline`, `/propostas`, `/contatos`, `/automacoes/fluxos` —
todas renderizam com dado real, sem error boundary.

## Dívida que permanece

`data-tilt` do `motion.js` continua gerando aviso de hidratação quando a
página está ocupada e o `requestIdleCallback` dispara pelo timeout. É
dev-only e sem efeito visível. Conserto definitivo é no Claude Design
(DEFEITOS-DO-HANDOFF §3).
