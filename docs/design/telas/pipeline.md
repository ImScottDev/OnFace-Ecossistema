# Pipeline — registro de fidelidade e ligação

Convertida de `OnFace Pipeline.dc.html` em 30/09. Markup e lógica gerados por
máquina (`dc-para-tsx.mjs`, `dc-logica-para-tsx.mjs`); o único arquivo escrito
à mão é `PipelineProto.tsx`, o adaptador.

## O que ficou ligado

| ação | command | estado |
|---|---|---|
| arrastar entre colunas abertas | `acaoMoverEtapa` | **grava e sobrevive ao reload** |
| marcar como perdida (modal) | `acaoPerder` | grava, motivo estruturado |
| marcar como ganha (modal) | `acaoTentarGanhar` | grava; o gate de evidência decide |
| abrir oportunidade | `/negocios/:id` | navega |
| abrir empresa | `/empresas/:id` | navega |

Provado no navegador: arrastei "Topo Growth" de Entrada para Diagnóstico, o
banco mudou nos dois lados (`negocios` e `oportunidades`), os contadores foram
de 251/60 para 250/61 e o cartão continuou em Diagnóstico depois do reload.

## O que NÃO grava, e avisa

As outras sete mutações do desenho — editar proposta, atividade, reunião,
participante, item — passam pelo mesmo `gravarOpp`, e o adaptador responde com
um toast dizendo que aquilo ainda não é gravado, além de desfazer a mudança
otimista com `router.refresh()`.

É de propósito: tela que parece que gravou e não gravou é o defeito mais caro,
porque não dá erro. Quando o command existir, é uma linha no `persistir`.

## Decisões da ligação

**`propostas` virou lista.** O board trazia só a contagem, e o desenho pede
`propostas.slice()` — derrubava a tela com `props.slice is not a function`.
A query passou a trazer a lista real por `json_agg`, substituindo as três
contagens que já varriam a mesma tabela. O chip do cartão (Sem proposta /
Rascunho / Enviada / Expirada / Recusada) e o gate de Proposta saem dela.

Sem `itens`: somar item a item para 1.136 cartões seria caro e o cartão não
mostra soma. Quem mostra é o detalhe, que carrega sob demanda.

**`EQUIPE` é lista de nomes, não de objetos.** O protótipo compara
`F.resp.indexOf(o.resp)` com o nome que está no cartão; passar `{id, nome}`
fazia o filtro nunca casar.

**O teto por coluna subiu de 67 para 300.** O cabeçalho do quadro CONTA os
cartões que recebeu, então com `limite: 400` (67 por etapa) Entrada anunciava
67 tendo 251. Ganho e Perdido têm mais que 300 e continuam cortadas — nascem
colapsadas e são bucket de consulta, não fila de trabalho. Render: ~300ms.

**A tela remonta quando `dados` muda.** O protótipo guarda as oportunidades no
próprio estado; sem remontar, ela ficaria presa no que escreveu e nunca mais
enxergaria o servidor — inclusive quando o command RECUSA.

## Dois defeitos do domínio corrigidos no caminho

1. **`aplicarEtapa` não era transacional.** A FK de `status_changes` estourou
   depois do `UPDATE negocios`, e o negócio ficou com etapa nova sem nenhum
   registro de quem a mudou. Agora etapa e histórico vão juntos.

2. **O guard idempotente era cego.** `if (op.etapa === params.para) return`
   olha `negocios`, e a tela lê `oportunidades`. Quando o espelho falhava numa
   tentativa anterior, sair ali congelava a divergência para sempre: o usuário
   arrastava, nada acontecia, e nada avisava. Agora o caminho idempotente
   reconcilia. Mesma assinatura do bug de `atribuirResponsavel`.

## Dívida conhecida

**`data-tilt` e hidratação.** O `motion.js` do handoff escreve `data-tilt` nos
nós que anima. Se entrar antes de o React hidratar, esses atributos não existem
no HTML do servidor e o React avisa (um por cartão). `MotionDoProto` adia a
injeção para o main thread ocioso, o que resolve no Pipeline mas ainda perde a
corrida no Pré-vendas às vezes.

Efeito visível: nenhum — `data-tilt` só serve ao próprio `motion.js`, e o aviso
é de desenvolvimento. Conserto definitivo seria o `motion.js` não escrever
atributo no DOM que o React controla, o que é no Claude Design.

---

## Adendo 30/09 — o que mudou depois

**A tradução saiu daqui.** `persistencia.ts` agora guarda o mapa de motivos, o
conjunto de etapas abertas e a chamada de cada command. Pipeline e Oportunidade
usam o mesmo caminho — escrever duas vezes garantia que um dia discordassem
sobre o que é uma perda válida.

**O CTA da recusa virou botão.** `Resultado` sempre carregou `acao: {rotulo,
tipo}`, e a ligação jogava fora. "Defina a família antes de avançar" sem um
caminho para definir a família deixa o operador sabendo o problema e não a
saída. Agora o toast leva ao detalhe da oportunidade.

**A mensagem do gate nomeia a etapa certa.** Dizia "para Proposta" fixo, mesmo
quando o usuário pediu Negociação.
