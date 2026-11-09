# DESIGN.md — Pós-venda (módulo)

Substitui, para este módulo, o visual do DESIGN.md global. Não toca na casca (sidebar e topbar).

## Mundo visual: planilha de avanço

O cronograma de obra que todo time de implantação brasileiro já leu: folha branca de linhas finas, faixa de título tingida por situação, barra de avanço, e uma régua de leitura (quem, o que fazer, situação, avanço, responsável, tempo). A unidade é a LINHA. O cartão existe só como segunda forma de ler (`?visao=cartoes`).

Por que: o desenho reprovado assumia cartão cheio e o dado real é esparso (9/56 sem dono, 425/430 em produção; nenhum prazo; 109/430 sem pessoa). 56 cartões iguais escondiam o que importa. Linha densa com texto no lugar de cada ausência mantém a mesma altura cheia ou vazia.

## Jornada
A tela responde "o que faço agora". A lista vem agrupada por urgência (Pedem ação agora, Falta o aceite, Esperando alguém, Em andamento, Ainda não começaram) e os encerrados ficam recolhidos. O grupo "Pedem ação" mistura tarefa vencida com prazo estourado, por isso não se chama "Atrasados" (o indicador Atrasados é só prazo): cada linha diz qual motivo é o dela. Gráficos ficam num painel lateral e seguem os filtros.

## Cor
Restrained com faixas tingidas. Cor é SITUAÇÃO e nada mais: azul = em andamento, âmbar = esperando alguém, violeta = falta aceite, verde = concluído, coral (do shell) = pede ação, cinza = não iniciado. Família de produto nunca tem cor (etiqueta em tinta). Tinta é azul-grafite (matiz 255), não preto. Tudo em `oklch()`, zero hex. Tokens `--pv-*` em `pos-venda.css`. Zero tinta tingida quando o número é zero.

## Tipografia
Uma família (Inter do shell), sem display. Escala 12/13/14/16/20/28/30, numerais tabulares no módulo todo. Título de página 28/700 com tracking -0.03em; número de indicador 30/600; corpo 13.

## Densidade, raios, sombra
Linha 64px, cabeçalho de grupo 44px. Folha 16px de raio, controles 10px, pílulas inteiras. Sombra mínima (0 1px 2px a 5%); a borda carrega a forma. Menus levam sombra com offset e blur.

## Controles
Seleção é tinta cheia (aba de família, aba do projeto, segmento de jornada e de visão). Recortes de um toque são chips; filtros ligados aparecem como etiquetas removíveis com "Limpar tudo". Responsável e estado em popover. Ordem por select. Tudo vive na URL (`?aba`, `?familia`, `?responsavel`, `?estado`, `?recorte`, `?q`, `?visao`, `?ordem`).

## Motion
Só estado: 120 a 160 ms em cor e seta de grupo, barra de avanço 420 ms ease-out, gráficos animam uma vez. `prefers-reduced-motion` desliga tudo.

## Ausência
"Sem dono" em âmbar tracejado (normal, não erro), "Sem contatos", "Sem tarefas", prazo tracejado no relógio em vez de barra cheia, "Começa no T0", nomes suspeitos ("." / "Empresa não identificada") em itálico, duplicatas com selo "N projetos". Rosca mostra só o que está em aberto.
