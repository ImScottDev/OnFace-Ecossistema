# Como ligar uma tela do Claude Design

O Claude Design é a versão final do front. O trabalho aqui **não é recriar a
tela** lendo o desenho — é usar o que veio e ligar nos dados reais.

Recriar à mão produz divergência em cada transcrição (um padding, um peso, uma
cor), e aí alguém tem que validar a tela inteira elemento por elemento. Foi o
que aconteceu até 24/09 e é o que este fluxo existe para acabar.

## O fluxo

```bash
# 1. converter o desenho em React (mecânico, sem transcrição)
node scripts/dc-para-tsx.mjs \
  "<tela>.dc.html" \
  app/src/components/onface/proto/<Tela>Desenho.tsx \
  <Tela>Desenho

# 2. ligar: preencher o contrato com dado real
#    app/src/components/onface/proto/<Tela>Liga.tsx
```

O conversor gera duas coisas:

| arquivo | o que é |
|---|---|
| `<Tela>Desenho.tsx` | o markup, **intocável**. Regenerado a cada desenho novo |
| `<Tela>Desenho.logica.txt` | a lógica do protótipo, para portar ligando nos dados |

## A fronteira

O componente gerado exporta `ValoresDe<Tela>Desenho` — o contrato do que o
desenho consome. **Ligar a tela é preencher esse objeto**, e é a única coisa
que há para revisar: o resto não foi escrito à mão, logo não tem o que
divergir.

## Regras

1. **Nunca edite o `<Tela>Desenho.tsx` à mão.** A próxima geração sobrescreve.
   Desenho errado se conserta no Claude Design, não aqui.
2. **Desenho novo = rodar o conversor de novo.** O diff mostra só o que o
   desenho mudou.
3. **Elemento sem dado no banco entra assim mesmo**, e é anotado no registro da
   tela. Nunca se remove por conta própria.

## O que o conversor cobre

| protótipo | React |
|---|---|
| `{{ expr }}` | `{expr}` |
| `<sc-for list="{{ a }}" as="b">` | `{(a ?? []).map((b, i1) => …)}` |
| `<sc-if value="{{ c }}">` | `{(c) ? (<>…</>) : null}` |
| `style="a:b"` | `style={{ a: "b" }}` |
| `style="{{ x }}"` | `style={estilo(x)}` (string de CSS em runtime) |
| `style-hover="…"` | classe com `:hover` gerada pelo runtime |
| `class`, `for`, kebab do SVG | `className`, `htmlFor`, camelCase |

O runtime (`proto-runtime.tsx`) tem duas funções e existe porque `:hover` não
cabe em estilo inline. Trocar hover por estado seria um re-render por cartão a
cada movimento do mouse — e perderia o hover de quem usa teclado.

## O que ele NÃO cobre, de propósito

O `<script type="text/x-dc">` do protótipo: é a lógica, e é exatamente onde os
dados de exemplo precisam virar os dados reais. Converter isso em silêncio
produziria uma tela bonita alimentada por mock, que é o pior desfecho
possível — então ele sai para um `.logica.txt` marcado, para ser portado com
atenção.

---

## Estado das telas do zip (24/09)

O bundle `OneFace2.zip` traz cinco arquivos `.dc.html`. Todos convertidos:

| desenho | componente gerado | ligado? |
|---|---|---|
| `OnFace Pre-vendas` | `PreVendasDesenho` | **sim** — `/pre-vendas` |
| `OnFace Pecas` | `PecasDesenho` | **sim** — gaveta e modais de Pré-vendas |
| `OnFace Casca` | `CascaDesenho` | **sim** — o layout de `(crm2)` inteiro |
| `OnFace Empresa` | `EmpresaDesenho` | não |
| `OnFace Dashboard` | `DashboardDesenho` | não |

### As peças são o ponto que mais importa

`OnFace Pecas.dc.html` traz a gaveta de detalhe, o popup de qualificação,
nutrição, desqualificação, o modal de atividade, o menu de tags e o de
cadência. No produto existiam versões **recriadas à mão** (`vendas/GavetaLead`,
`vendas/SaidasLead`) e era daí que vinha boa parte da divergência que aparecia
na revisão.

Desde 24/09 `/pre-vendas` usa as peças convertidas. As recriadas continuam no
repo, sem uso pela rota.

### A casca

**Trocada em 24/09.** `AppSidebar` + `TopbarOnface` eram a versão recriada à
mão e saíram do layout de `(crm2)`.

Eu tinha dito que ela "já batia", medindo quatro propriedades do container
(fundo, padding, gap, raio). Não bastava: a casca é sidebar com grupos
expansíveis, topo com trilha, busca ⌘K, sino, perfil e NEXO — dezenas de
detalhes que só batem quando é o mesmo markup. Comparar container não é
comparar casca.

O título e a trilha saem de `trilhaAtual(pathname)`, a mesma fonte que a
topbar antiga usava, para as duas nunca divergirem. As rotas da árvore do
protótipo apontam para `/onface-preview/*`; o prefixo cai em `CascaLiga.ir()`,
num lugar só, em vez de editar a árvore e perder a regeração.

As ~80 telas continuam recebendo o recuo da casca: `CascaProto` envolve o
miolo em `onface-conteudo-interno`, e o CSS já sabe zerá-lo para quem traz
`data-workspace="desenho"`. Testadas depois da troca: `/inicio`, `/pipeline`,
`/tarefas`, `/clientes` e `/atendimento` — todas 200, nenhuma quebrada.

### O que o conversor aprendeu nesta rodada

- tags SVG em camelCase (`linearGradient`, `clipPath`, `feGaussianBlur`…): o
  HTML não diferencia maiúscula, o JSX sim
- `style-focus`, irmão do `style-hover` — vira regra `:focus-within`, e não
  `:focus`, porque no protótipo o estilo está no invólucro e quem recebe foco é
  o `input` dentro dele
- `title` em `<svg>` vira `<title>` filho: o tipo do React não aceita o
  atributo, e como filho o leitor de tela ainda anuncia
- `class` + `style-hover` + `style-focus` desembocam num `className` só
- atributos numéricos (`rows`, `cols`, `span`, `min`, `max`…)

### O `<style>` do `<helmet>` — o erro que quase passou

A primeira versão do conversor pulava o `<helmet>` inteiro, e o efeito foi
silencioso: **nada quebrou, tudo ficou um pouco errado.** Os itens da sidebar
saíram centralizados (falta de `button{text-align:left}`), popover e gaveta
entravam sem animação (faltavam os `@keyframes of-rise`, `of-fade`, `of-slide`,
`of-pisca`) e o checkbox do cartão não aparecia no hover — porque
`.of-card:hover .of-check` vive ali também.

É o tipo de divergência mais caro de achar: não dá erro, só fica torto.

Agora o conversor extrai esse `<style>` para um `.css` ao lado e o componente
gerado o importa.
