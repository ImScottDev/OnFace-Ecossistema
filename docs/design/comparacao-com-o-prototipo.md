# Comparação tela a tela com o protótipo — 30/09 e 01/10

Feita porque o Kauã disse "as telas não estão iguais, faltou muita coisa".
Estava certo, e o método foi servir o handoff original num servidor local
(`python3 -m http.server` na pasta do zip) e comparar a assinatura de texto de
cada tela com a versão ligada.

**O padrão do defeito:** o markup é fiel por construção — ele é convertido, não
transcrito. O que faltava era o DADO que alimenta cada parte: onde passei um
campo vazio ou uma lista vazia, o desenho simplesmente não renderizava aquele
pedaço. Nenhum dos buracos era visual; todos eram de ligação.

## Pipeline

| protótipo | estava | agora |
|---|---|---|
| `Grupo Aurora · Eduardo Vilhena · CFO` | sem pessoa nem cargo | contato real |
| card com `R$ 1.950/mês` | sem valor | valor da proposta |
| coluna `R$ 9.150/mês · R$ 1.500 único` | "Valor definido na proposta" sempre | soma real |

`boardPipeline` passou a trazer o contato (`pessoas` canônica com queda para o
lead) e `total_recorrente` por proposta. O cartão e o cabeçalho somam de
`proposta.itens`, então o adaptador monta dois itens agregados que reproduzem
exatamente os totais do banco — a composição real não cabe num quadro de 1.136
cartões.

## Pré-vendas

O desenho põe `campanha || origem` no primeiro chip e a `tag` no segundo. Com
campanha preenchida, **a origem de 3.505 dos 4.066 leads sumia** — e origem
("Mídia Paga", "ZohoDesk", "Site") é o que define o tom da abordagem. Agora ela
ocupa o segundo chip quando a campanha tomou o primeiro.

## Oportunidade

Faltava o bloco inteiro **"Produtos e valores"** — a tabela com natureza,
quantidade e valor de cada linha da proposta. Eu passava lista vazia, então a
tela dizia "O valor nasce na proposta. Crie a primeira" mesmo para oportunidade
com proposta fechada, e o topo dizia "Definido na proposta" em vez do valor.

`detalheOportunidade` passou a trazer os itens. Aqui carregar é barato: é uma
oportunidade, não o quadro.

## Empresa e Pessoa

`ETAPAS` não chegava no catálogo, e as tags reais do lead não chegavam — a
ficha lê tags de `dados.empresas[nome]`, não do registro. Ambos ligados.

## O que PARECIA faltar e não era

Duas coisas que a comparação impediu de "consertar" errado:

- **Propostas, coluna ATUALIZAÇÃO.** Mostra "Rascunho" na minha e "21 set" no
  protótipo porque o desenho faz `status === "rascunho" ? "Rascunho" :
  enviadaEm` — e a lista ordena rascunhos primeiro. Comportamento dele.
- **Empresa, chip de etapa no topo.** `temEtapaTopo: !E.registro` — o desenho
  esconde o chip quando há registro real. É intencional.

## A tela que ficou de fora, e por quê

`OnFace Dashboard.dc.html` é a única das 24 telas de produto do handoff nunca
convertida. Aberta no protótipo, é **outro produto**: um painel de pagamentos
(Pix, cartão, taxa de recusa, "Ativar conta real"), com paleta verde e casca
própria. Não é o Início do CRM — esse é a Visão Geral em `/inicio`.

Registrado em `scripts/handoff-telas.mjs` para ninguém tentar de novo.

## Como repetir esta comparação

```bash
cd <pasta-do-handoff>/oneface/project && python3 -m http.server 8899
# protótipo:  http://localhost:8899/OnFace%20Pipeline.dc.html
# produto:    http://localhost:3000/pipeline
```

Comparar `document.body.innerText` dos dois, não o pixel: o texto denuncia
campo vazio e bloco ausente, que é onde o erro de ligação mora.
