# Handoff: OnFace — Casca + Pré-vendas

## Visão geral

OnFace é um CRM. Este pacote cobre duas peças:

- **Casca** — a moldura do app: sidebar de navegação, topo (breadcrumb, busca ⌘K, notificações, perfil), o painel do assistente NEXO e o toast de avisos.
- **Pré-vendas** — a tela de trabalho do time de pré-vendas: leads inbound em quadro kanban ou lista agrupada, com filtros, seleção em massa e exportação.

## Sobre os arquivos

Os arquivos deste bundle são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**.

A tarefa é **recriar estas telas no ambiente do codebase de destino** (React, Vue, Next, o que já existir), usando os padrões e bibliotecas já estabelecidos lá. Se ainda não existe ambiente, escolha o stack adequado e implemente as telas nele.

Os `.dc.html` dependem de um runtime de protótipo próprio (`<x-dc>`, `<sc-for>`, `<sc-if>`, `{{ }}`). **Ignore essa sintaxe** — ela é andaime. O que importa é a estrutura, os valores e o comportamento descritos abaixo.

## Fidelidade

**Alta fidelidade.** Cores, tipografia, espaçamentos, raios e estados são finais. Recriar com precisão visual, usando os componentes equivalentes do codebase.

---

## Design tokens

### Cores

| Papel | Hex |
|---|---|
| Graphite (texto forte, avatar, botão ativo) | `#12171d` |
| Tinta (texto padrão) | `#1f252c` |
| Secundário | `#4a5560` |
| Secundário claro | `#67787c` |
| Texto apagado | `#6d747e` · `#8b949e` · `#a3a8a4` |
| Linha forte | `#dbdede` · `#e3e7e8` |
| Linha suave | `#eef1f1` · `#f3f5f5` |
| Fundo do app | `#f6f6f3` |
| Fundo de superfície alternada | `#fafafa` |
| Fundo neutro (chips, trilhos) | `#eeeff3` · `#f1f3f3` |
| Coral — acento | `#fe4f2b` |
| Coral — ação primária | `#d93c1a` (hover `#c2330f`) |
| Coral — texto/destrutivo | `#c2330f` · `#9c3210` |
| Coral — fundo suave | `#fff6f4` (contorno `#fadfd8`) |
| Verde — sucesso/qualificado | `#1f7256` sobre `#e6f4ee` |
| Azul — informativo | `#2c5f9e` sobre `#e8f0fb` |

Sem outras cores. Se faltar, derive da paleta.

### Tipografia

- **Plus Jakarta Sans** (600/700/800) — títulos, nomes de coluna, números grandes. `letter-spacing` negativo: `-.005em` a `-.025em`.
- **Inter** (400/500/600/700) — todo o resto.
- **IBM Plex Mono** — só atalhos de teclado.

Escala em uso: 10px (rótulos maiúsculos, `letter-spacing .05–.09em`), 11–11.5px (metadados), 12–12.5px (corpo, botões), 13–13.5px (títulos de cartão, nome de lead), 14px (coluna do quadro), 25px (nome da empresa).

Números sempre com `font-variant-numeric: tabular-nums`.

### Superfícies

- Cartão branco, `border-radius` 9–14px.
- Contorno com `box-shadow: inset 0 0 0 1px #e3e7e8` — **não** `border` (para não somar ao box model).
- Popover: `border: 1px solid #e3e7e8` + `box-shadow: 0 10px 26px -6px rgba(0,0,0,.2)`.
- Altura de controle padrão: 34px (filtros, botões da barra), 30px (botões dentro de cartão), 28px (chips e ações pequenas).

### Movimento

- Entrada de popover/menu: `of-rise .12s cubic-bezier(.2,0,.2,1) both` — `opacity 0→1`, `translateY(-4px)→0`.
- Gaveta lateral: `.2s cubic-bezier(.2,0,.2,1)`, entra da direita.

> Atenção herdada do protótipo: elementos animados com `transform` viram bloco de contenção de `position: fixed`. Popovers ancorados devem ser renderizados na raiz (portal) e posicionados pelo `getBoundingClientRect()` da âncora, com teto de altura e virada para cima quando não couber.

---

## Tela 1 — Casca (moldura)

### Layout

`display: flex`, altura total da viewport.

- **Sidebar** — `aside` à esquerda, 228px aberta / 56px recolhida, fundo `#fafafa`, divisória direita `1px #e4e4e1`. Transição de largura `.2s`.
- **Miolo** — `flex: 1`, coluna: header 52px + conteúdo da página (`overflow: hidden`, o scroll é interno da página).

### Sidebar

- Topo: logo + nome do workspace; botão de recolher.
- Grupos expansíveis (Vendas, Operação, Clientes, Automações, …) com chevron. Estado de aberto/fechado persiste.
- Item ativo: fundo `#eeeff3`, texto `#12171d`, peso 600. Inativo: texto `#4a5560`, hover fundo `#f1f3f3`.
- Ícones 16–17px, `stroke-width` 1.8–1.9, `stroke` herdando a cor do texto.
- Recolhida: só ícones, com `title` para tooltip nativo.

### Topo (52px)

Da esquerda para a direita:

1. Botão de recolher a sidebar.
2. Divisória vertical `1px × 18px` `#e4e4e1`.
3. **Breadcrumb dinâmico por rota** — este é o ponto central da casca:
   - Tela raiz: título em Plus Jakarta Sans 14.5px/700 + subtítulo 12px `#67787c` embaixo.
   - Tela filha: trilha clicável com chevrons `m9 18 6-6-6-6`, ex. *Pré-vendas › Empresas › **Nome***. O último nível em 700 `#12171d`, os anteriores em `#4a5560` com hover `#12171d`.
4. Espaçador `flex: 1`.
5. **Busca** — botão de lupa 30×30, abre a paleta ⌘K (overlay centralizado, input grande, resultados agrupados por tipo).
6. **Notificações** — sino 30×30 com ponto coral 6px no canto; dropdown 352px com filtros em chips e estado vazio.
7. **Perfil** — avatar 28px redondo `#12171d` com iniciais, nome + workspace, chevron. Dropdown 268px: cabeçalho com e-mail, itens com ícone e atalho em mono, divisória, e **Sair** em `#c2330f` com hover `#fdeeea`.

### NEXO (assistente)

Painel lateral direito acionado por botão flutuante. Três modos: chat, avisos e radar. O radar traz KPIs com delta (seta pelo sinal do número, cor pela leitura de bom/ruim) e um arco de ritmo contra a meta, segmentado por faixa — a última faixa absorve o resto do arredondamento para a soma fechar com o preenchido.

Avatar: `assets/oni-avatar.png`.

### Toast de avisos

Ancorado embaixo ao centro. Tons: neutro, sucesso (`#1f7256`), erro (`#c2330f`). Desenhado pela casca; qualquer tela dispara por um canal compartilhado.

### Estado que a casca detém

`menuAberto`, `menuGrupos`, rota atual, fila de avisos, qual overlay compartilhado está aberto e para qual lead.

---

## Tela 2 — Pré-vendas

Recebe **apenas inbound**: Meta Ads, Instagram, Site, Formulário, WhatsApp, Orgânica.

### Barra de controles (topo, `flex-wrap`)

- **Busca local** — 34px, `flex: 1 1 200px`, `max-width: 270px`, placeholder "Empresa, pessoa ou e-mail".
- **Filtros split** — cada filtro é um par de botões colados dentro de um contorno: corpo (ícone + rótulo + contador quando há seleção) e seta (chevron duplo `m7 15 5 5 5-5M7 9l5-5 5 5`). Ambos abrem o mesmo dropdown. Dropdown: título 11px, lista de checkboxes com `max-height: 260px`, divisória, e **Limpar** em `#c2330f`.
- **Filtros** — botão com borda tracejada `1px dashed #c8ccc9` para adicionar mais filtros.
- Espaçador.
- **Alternador de visão** — trilho `#eeeff3`, raio 9px, padding 3px: Quadro / Lista. Ativo: pílula branca.
- **Exportar** — dropdown com três caminhos: *Exportar esta visão* (com resumo do que está filtrado), *Escolher critérios* (filtros, colunas, formato) e *Selecionar leads* (entra no modo de seleção).
- **Novo lead** — botão coral dividido: ação principal + seta para outras criações. Fundo `#d93c1a`, divisória interna `rgba(255,255,255,.34)`, hover `rgba(0,0,0,.12)` sobreposto.

### Faixa de indicadores

Linha de métricas em texto puro (sem cartão): rótulo 10.5px maiúsculo `#67787c` + valor 11.5px `#a3a8a4`. Gap 18px, quebra em telas estreitas.

### Visão Quadro (kanban)

- Scroll horizontal, colunas de altura total.
- **Coluna**: cabeçalho com ponto de cor da etapa, nome (Plus Jakarta 14px/700), cadeado quando travada, contador, botão de recolher. Corpo com scroll vertical próprio e `gap: 8px`.
- **Coluna recolhida**: faixa estreita clicável com texto em `writing-mode: vertical-rl`; ainda aceita drop.
- **Cartão de lead**: empresa (13.5px/600), pessoa (11.5px `#6d747e`), chips de origem e tag, próxima ação com ponto coral quando ausente, e rodapé separado por `1px #f3f5f5` com avatar 22px + responsável + tempo parado.
- **Checkbox do cartão**: aparece no hover (canto superior direito), fica fixo quando marcado. Marcado: quadrado `#12171d` com check branco.
- **Arrasto**: HTML5 drag entre colunas; coluna sob o cursor ganha realce; colunas travadas recusam. Soltar muda a etapa.

### Visão Lista

- Cartão branco único, raio 12px, com scroll horizontal interno (`min-width: 916px`).
- Cabeçalho da lista: título + explicação ("ordenada por urgência — quem não tem próxima ação sobe ao topo"), botão de expandir/recolher tudo e total.
- Grid de 6 colunas: `30px minmax(170px,1.7fr) minmax(180px,1.5fr) 176px 108px 66px` — checkbox, empresa·pessoa, próxima ação, responsável, origem, parado.
- **Agrupamento por etapa**: cabeçalho de grupo clicável com chevron, ponto da etapa, nome, contador em pílula e, quando houver, "N sem ação" em `#9c3210` com ponto coral.
- **Responsável inline**: botão que abre menu de troca com avatares. O menu precisa ir para a raiz (portal) — dentro do scroller ele é recortado.
- Estado vazio: título 13px/600 + explicação 12px, centralizado, padding 44px.

### Seleção em massa

Ao marcar cartões, uma barra de ação aparece com a contagem e as ações em lote (exportar, atribuir responsável, mover etapa, aplicar tag).

### Overlays compartilhados

Vivem fora da página (hoje na casca) e são abertos por um canal comum, recebendo o id do lead:

- **Gaveta de detalhe do lead** — entra da direita, com identidade, campos de qualificação editáveis, atividades e ações.
- **Modal de atividade** — registrar ligação, e-mail, WhatsApp ou nota.
- **Menu de tags** — popover com tags existentes e criação inline.
- **Modal de cadência** — escolher ou trocar a cadência do lead.
- **Popup de qualificação** — critérios preenchidos antes de gravar: interesse (multi-seleção), tamanho da operação (stepper numérico com selo de faixa — Micro ≤10, Pequena ≤50, Média ≤200, Enterprise >200), dor principal (texto) e fit (Alto/Médio/Baixo).
- **Desqualificação e nutrição** — pedem motivo antes de confirmar.

### Campos de qualificação

O mesmo formato de valor vale na gaveta e no popup:

- `interesse` — multi-seleção (Callface AI, PABX, White Label, Integrações, SMS), serializada com `|`.
- `tamanho` — número inteiro de atendentes, com stepper de ±5 e selo de faixa derivado.
- `dor` — texto livre.
- `fit` — Alto / Médio / Baixo.

---

## Interações & comportamento

- **Navegação** entre telas é troca de rota real. Estado que precisa sobreviver à troca (leads, qualificações, cadências, atividades, tags, preferências de menu, visão escolhida) vive numa store compartilhada e persistida; estado efêmero (menu aberto, hover, arrasto) fica local.
- **Fechar ao clicar fora** — todos os popovers. No protótipo isso usa um atributo marcador tanto na âncora quanto no nó flutuante, para o clique não fechar antes de registrar; no codebase, use o padrão de portal + click-outside já existente.
- **Ações destrutivas ou irreversíveis** exigem confirmação com motivo.
- **Responsividade** — a barra de controles quebra em várias linhas; o quadro rola na horizontal; a lista rola na horizontal com largura mínima. A casca recolhe a sidebar.
- **Acessibilidade** — alvos de toque ≥ 28px nos controles densos e 34px+ nos principais; contraste mínimo 4.5:1 para texto.

---

## Assets

- `assets/oni-avatar.png` — avatar do NEXO.
- Todos os ícones são SVG inline no traço do design (`stroke-width` 1.8–2.3, `stroke-linecap: round`). No codebase, mapeie para a biblioteca de ícones já em uso, mantendo o peso de traço.

---

## Screenshots

`screenshots/` traz as telas renderizadas:

| Arquivo | O que mostra |
|---|---|
| `pre-vendas-quadro.png` | Pré-vendas na visão Quadro, dentro da casca |
| `pre-vendas-lista.png` | Pré-vendas na visão Lista, agrupada por etapa |
| `gaveta-detalhe-lead.png` | Gaveta de detalhe do lead |
| `popup-qualificacao.png` | Popup de qualificação com os critérios |

## Arquivos deste bundle

| Arquivo | O que é |
|---|---|
| `OnFace Casca.dc.html` | Referência da moldura: sidebar, topo, NEXO, toast. Contém também a Pré-vendas embutida (a separação ainda não foi feita no protótipo). |
| `OnFace Pre-vendas.dc.html` | Referência da tela de Pré-vendas. |
| `dados.js` | Dados de exemplo (leads, equipe, etapas, cadências, segmentos, canais) e a store compartilhada. Útil para entender o **shape dos dados**; não é backend. |

Para ver as telas, abra os `.dc.html` num navegador — eles renderizam sozinhos.
