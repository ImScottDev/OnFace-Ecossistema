# Oportunidade 360 e Propostas — registro de ligação

Convertidas do handoff em 30/09. Markup e lógica gerados por máquina; só os
adaptadores (`OportunidadeProto.tsx`, `PropostasProto.tsx`) são escritos à mão.

## Oportunidade — `/pipeline/[id]`

### Ligado

| ação | command | estado |
|---|---|---|
| Avançar etapa | `acaoMoverEtapa` | grava; o gate recusa com CTA |
| Marcar perdida | `acaoPerder` | grava, motivo estruturado |
| Marcar ganha | `acaoTentarGanhar` | grava; o gate de evidência decide |
| Abrir empresa / proposta / lead | navegação | leva à tela certa |

Provado numa oportunidade real (Cursinho Maximize): 11 atividades, 10 notas,
1 proposta #878-v1, 1 contato, criada em 08/05 — todos conferidos contra o
banco. "Avançar etapa" devolveu a regra do domínio, com o botão que destrava.

### O que a query ganhou

`detalheOportunidade` passou a trazer **atividades**, **notas** e o **comitê**
da empresa. As três existiam no banco e nenhuma chegava à tela.

`textoSimples` limpa o HTML que 575 das 13.388 atividades trazem do Zoho — o
React escapa tudo, e o operador lia `<br>` no meio da frase. Limpo na fronteira
do domínio, não em cada tela, para nenhuma precisar lembrar.

### O que NÃO grava, e avisa

Editar proposta, atividade, reunião, participante e item passam pelo mesmo
`gravarOpp` e respondem com toast honesto + `router.refresh()`.

### `autoRevisao` desligada, de propósito

O desenho cria sozinho uma atividade de revisão quando a proposta é recusada ou
tem ajuste pedido. A regra é legítima, o lugar não: roda no
`componentDidUpdate` e grava, então criaria a tarefa uma vez por aba aberta e
cairia no `persistir`, que recarrega — laço sem fim.

**Automação que cria tarefa é do domínio.** Pertence ao command que muda o
status da proposta, onde roda uma vez e é idempotente (`chave_idempotencia`).

## Propostas — `/propostas`

A lista do domínio é plana; o desenho lista OPORTUNIDADES com as propostas
dentro. O adaptador reagrupa — é a tradução, e é por isso que ele existe.

Proposta sem negócio vira grupo próprio: são 455 no banco, antigas, que só
apontam para um lead. Jogá-las fora esconderia quase um terço da base.

`acaoListar` ganhou **responsável** e **contato** — o filtro por responsável
vinha vazio sem eles.

### Dois acertos que o dado exigiu

**Os itens.** `soma()` percorre `p.itens`, e a lista não os carrega (seriam 200
varreduras, e a lista não desdobra composição). Dois itens agregados
reproduzem exatamente `total` e `totalRecorrente` do banco.

**A data.** O gráfico chama `dataDe()`, que casa com `/(\d{1,2})\s+([a-zç]{3})/`
e devolve HOJE para o que não bate. Com "23/09" tudo caía no mesmo dia e o
forecast desenhava uma reta em R$ 0. Passando "23 set", a curva aparece.

### Por que o Forecast marca R$ 0 — e está certo

O forecast **ponderado** soma só `visualizada` e `ajuste_solicitado`. No banco:

| status | propostas |
|---|---|
| expirada | 525 |
| rascunho | 508 |
| aceita | 428 |
| recusada | 52 |
| enviada | 38 |
| **visualizada** | **0** |
| **ajuste_solicitado** | **0** |

**Nenhuma das 1.557 propostas foi visualizada.** `visualizacoes`,
`primeira_visualizacao_em` e `ajuste_solicitado_em` estão zeradas na base
inteira.

Não é bug da tela nem do caminho: `/api/propostas/:id/publica` chama
`registrarVisualizacao`, que incrementa o contador e muda o status. O que não
aconteceu é o fato — nenhuma proposta foi aberta pela página pública. As 1.557
são legado importado.

**Consequência:** o forecast ponderado, métrica de topo desta tela, fica em R$ 0
até uma proposta ser enviada pelo link público e aberta pelo cliente. O
"Completo" mostra R$ 310k, que bate com o card "Em jogo".

### Dado sujo encontrado

Cinco propostas com status fora do enum: `Em Construção` (2),
`Proposta Ganha` (2), `Negotiation` (1) — resíduo de importação. A tela as
mostra com o status cru; normalizar é decisão de dado, não de interface.

### Enviar, revisar e responder ficam na página da Proposta

O envio dispara e-mail ao cliente. Disparar isso a partir de uma linha de
tabela, sem ver o que vai junto, é o tipo de clique que ninguém desfaz. A lista
leva até lá em vez de fingir que grava.
