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
