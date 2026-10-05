# OnFace — protótipo

## Regra principal: um arquivo, um dono

Vários chats trabalham neste projeto ao mesmo tempo. Dois chats editando o mesmo
arquivo se sobrescrevem. Antes de editar, confirme que o arquivo é seu escopo.
Se precisar de algo que vive em outro arquivo, peça — não edite.

## Arquitetura: a página importa a moldura

Cada tela é um arquivo que abre sozinho no navegador e **importa a casca**:

```html
<dc-import name="OnFace Casca" rota="/onface-preview/pre-vendas"
  titulo="Pré-vendas" subtitulo="Leads, qualificação e saídas" hint-size="100%,100%">
  <div data-screen-label="...">… a tela …</div>
  <dc-import name="OnFace Pecas" style="display:contents" hint-size="0,0"></dc-import>
</dc-import>
```

A moldura continua sendo **um arquivo só**: mexer na sidebar, no topo, na busca ou
no NEXO muda todas as páginas de uma vez. Só é preciso tocar em cada página quando
a moldura ganha uma **prop nova** — aí cada `<dc-import>` recebe mais um atributo.

Navegar entre telas é troca de arquivo de verdade (`OnFaceEstado.irPara`). O que
precisa sobreviver à troca vive no store, não no state.

## Arquivos

| Arquivo | Dono / escopo |
|---|---|
| `dados.js` | Fonte única de dados (leads, equipe, etapas, cadências, segmentos, canais, helpers `slug`/`iniciais`/`cadenciaPadrao`) em `window.OnFaceDados` **e** o store compartilhado `window.OnFaceEstado`. Mudança de dado entra aqui, nunca duplicada nas páginas. |
| `OnFace Casca.dc.html` | A moldura: sidebar, topo/breadcrumb, busca ⌘K, NEXO e o toast de avisos. Renderiza `{{ children }}` no miolo. Props: `rota`, `titulo`, `subtitulo`, `trilha`, `menuAberto`. |
| `OnFace Pecas.dc.html` | Peças compartilhadas: gaveta de detalhe do lead, modal de atividade, menu de tags, modal de cadência, popup de qualificação, desqualificação e nutrição. Não recebe props — escuta o barramento. |
| `OnFace Pre-vendas.dc.html` | Tela de Pré-vendas: filtros, quadro, lista, exportação e seleção em massa. |
| `OnFace Empresa.dc.html` | Página da empresa. Lê o lead de `?lead=` e do store. |

## O store (`window.OnFaceEstado`)

Estado que atravessa páginas, persistido em `localStorage` (`onface.estado.v1`):
`leads`, `qual`, `cadencias`, `atvs`, `tagsLead`, `tagsCriadas`, `menuAberto`,
`menuGrupos`, `visao`.

- `tudo()` / `ler(chave, alternativa)` / `gravar(patch)` / `assinar(fn)`
- `avisar(texto, tom)` / `assinarAviso(fn)` — o toast é desenhado pela casca
- `abrir(peca, leadId)` / `assinarPecas(fn)` — peças: `detalhe`, `nutrir`,
  `desqualificar`, `qualificar`, `atividade`, `cadencia`
- `irPara(href, rotulo, params)` / `arquivoDe(href)` / `parametro(nome)` — rota sem
  arquivo mapeado vira aviso "em construção"

Padrão nas páginas: espelhar as chaves compartilhadas no state, puxar em
`assinar` e empurrar em `componentDidUpdate`. Nunca escrever no `localStorage` direto.

## Como uma página nova entra

1. Crie `OnFace <Nome>.dc.html` (nome de arquivo **sem acento**). No `<helmet>`:
   fontes, `@keyframes`, reset e `<script src="dados.js"></script>`.
2. O corpo é o `<dc-import name="OnFace Casca" …>` acima, com a tela dentro e o
   import de `OnFace Pecas` no fim (só se a tela usar gaveta ou modais).
3. Registre a rota em `ROTAS`, dentro de `dados.js`, apontando para o arquivo.
4. Dados vêm do store; avisos, modais e navegação vão pelo barramento. Página não
   chama componente de outra página direto.

## Convenções visuais

- **Estilos inline apenas.** Sem classes, sem folha de estilo. O `<helmet>` só
  carrega fontes, `@keyframes` e resets.
- **Paleta:** graphite `#12171d`, tinta `#1f252c`, secundário `#4a5560` / `#67787c`,
  linhas `#e3e7e8` / `#eef1f1`, fundos `#f6f6f3` / `#fafafa` / `#eeeff3`,
  coral `#fe4f2b` (acento) e `#d93c1a` / `#c2330f` (ações e estados de erro),
  verde `#1f7256` / `#e6f4ee` (sucesso e qualificação).
  Nada de pastéis novos — se faltar cor, derive da paleta.
- **Tipografia:** Plus Jakarta Sans em títulos e números grandes; Inter no resto;
  IBM Plex Mono só em atalhos de teclado.
- **Superfícies:** cartão branco, `border-radius` 9–14px, contorno com
  `box-shadow: inset 0 0 0 1px #e3e7e8` (não `border`, para não somar ao layout).
- **Popovers flutuantes:** `position: fixed` posicionado pelo `getBoundingClientRect()`
  da âncora, com teto de altura e virada para cima quando não couber.
  Motivo: os scrollers e o `aside` animado recortam `absolute`.
  O nó flutuante precisa do mesmo `data-of-*` da âncora, senão o clique-fora
  fecha antes do clique registrar. Se o popover nasce dentro de um elemento com
  `transform`, renderize-o na raiz do template.
- **Ações destrutivas ou irreversíveis** pedem confirmação com motivo
  (ver desqualificação e qualificação).

## Vocabulário do produto

Qualificar é um **fato gravado**, não uma coluna — por isso passa por popup com
critérios. Criar oportunidade é uma **entidade nova** e exige empresa associada.
Pré-vendas recebe só inbound: Meta Ads, Instagram, Site, Formulário, WhatsApp e
Orgânica. NEXO é o assistente (chat, avisos e radar); o avatar é `assets/oni-avatar.png`.
