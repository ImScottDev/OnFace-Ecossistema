#!/usr/bin/env node
/**
 * Converte uma tela do Claude Design (`.dc.html`) em componente React.
 *
 * ── Por que isto existe ──────────────────────────────────────────────────
 *
 * O Claude Design é a versão final do front. O trabalho aqui não é recriar a
 * tela lendo o desenho — é USAR o que veio e ligar nos dados reais. Recriar à
 * mão produz divergência em cada transcrição (um padding, um peso de fonte,
 * uma cor), e aí alguém tem que validar a tela inteira elemento por elemento.
 *
 * Convertido por máquina, o markup sai idêntico por construção: não há
 * transcrição, logo não há o que divergir. O que sobra para revisar é só a
 * ligação com o dado, que é onde o julgamento de fato importa.
 *
 * O protótipo já é React (`class Component extends DCLogic`, `setState`,
 * `createRef`), e todo o estilo é `style=""` inline com valor literal — sem
 * classes, sem tokens. Por isso a conversão é mecânica.
 *
 * ── O que converte ───────────────────────────────────────────────────────
 *
 *   {{ expr }}                      →  {expr}
 *   <sc-for list="{{ a }}" as="b">  →  {(a ?? []).map((b, i) => (<Fragment …>))}
 *   <sc-if value="{{ c }}">         →  {(c) ? (<>…</>) : null}
 *   style="a:b;c:d"                 →  style={{ a: "b", c: "d" }}
 *   style="{{ x }}"                 →  style={estilo(x)}
 *   style-hover="…"                 →  data-hover + folha gerada (ver runtime)
 *   class= / for= / kebab do SVG    →  className / htmlFor / camelCase
 *
 * ── O que NÃO converte, de propósito ─────────────────────────────────────
 *
 * O `<script type="text/x-dc">` fica de fora: é a lógica, e é exatamente onde
 * os dados de exemplo precisam virar os dados reais. Converter isso em
 * silêncio produziria uma tela bonita alimentada por mock, que é o pior
 * desfecho possível. O conversor extrai o script para um arquivo ao lado,
 * marcado, para ser portado com atenção.
 *
 * Uso:
 *   node scripts/dc-para-tsx.mjs <arquivo.dc.html> <destino.tsx> [NomeDoComponente]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

/* ── Atributos que o React escreve de outro jeito ──────────────────────── */

const RENOMEADOS = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  colspan: "colSpan",
  rowspan: "rowSpan",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  contenteditable: "contentEditable",
  spellcheck: "spellCheck",
  srcset: "srcSet",
};

/** `stroke-width` → `strokeWidth`. Vale para SVG; `data-` e `aria-` ficam de fora. */
const camel = (nome) => nome.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function nomeDeAtributo(nome) {
  if (RENOMEADOS[nome]) return RENOMEADOS[nome];
  // `data-` e `aria-` são os únicos que o React quer com hífen mesmo.
  if (nome.startsWith("data-") || nome.startsWith("aria-")) return nome;
  return nome.includes("-") ? camel(nome) : nome;
}

/* ── Estilo ────────────────────────────────────────────────────────────── */

/**
 * `"display:flex;gap:7px"` → `{ display: "flex", gap: "7px" }`.
 *
 * Mantém o valor como string sempre, inclusive números: `flex: "1 1 200px"` e
 * `zIndex: "35"` funcionam, e converter para número quebraria os compostos.
 */
function estiloParaObjeto(texto) {
  const pares = [];
  for (const parte of texto.split(";")) {
    const corte = parte.indexOf(":");
    if (corte < 0) continue;
    const chave = parte.slice(0, corte).trim();
    const valor = parte.slice(corte + 1).trim();
    if (!chave || !valor) continue;
    const propriedade = chave.startsWith("--") ? `"${chave}"` : camel(chave);
    pares.push(`${propriedade}: ${JSON.stringify(valor)}`);
  }
  return `{ ${pares.join(", ")} }`;
}

/* ── Expressões `{{ }}` ────────────────────────────────────────────────── */

const soExpressao = (v) => /^\s*\{\{([\s\S]+?)\}\}\s*$/.exec(v);

/** Valor de atributo → expressão JSX. */
function valorDeAtributo(nome, bruto) {
  const inteira = soExpressao(bruto);

  if (nome === "style") {
    // `style="{{ f.grupoStyle }}"` devolve uma STRING de CSS em tempo de
    // execução, então precisa do conversor do runtime.
    if (inteira) { anotarExpressao(inteira[1]); return `{estilo(${inteira[1].trim()})}`; }
    return `{${estiloParaObjeto(bruto)}}`;
  }

  if (inteira) { anotarExpressao(inteira[1]); return `{${inteira[1].trim()}}`; }

  // Interpolação no meio do texto: `title="Abrir {{ nome }}"`.
  if (bruto.includes("{{")) {
    const corpo = bruto.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => "${" + e.trim() + "}");
    return "{`" + corpo.replace(/`/g, "\\`") + "`}";
  }

  return JSON.stringify(bruto);
}

/* ── Texto ─────────────────────────────────────────────────────────────── */

function converterTexto(texto) {
  if (!texto.includes("{{")) {
    // Chaves soltas em texto quebram JSX.
    return texto.replace(/[{}]/g, (c) => `{"${c}"}`);
  }
  return texto.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => { anotarExpressao(e); return `{${e.trim()}}`; });
}

/* ── Tokenizador ───────────────────────────────────────────────────────── */

/* O HTML não diferencia maiúscula em nome de tag, mas o JSX sim: `<lineargradient>`
   vira um elemento desconhecido. Estas são as tags SVG com camelCase. */
const TAGS_SVG = new Map([
  "linearGradient", "radialGradient", "clipPath", "textPath", "foreignObject",
  "feGaussianBlur", "feColorMatrix", "feComposite", "feOffset", "feBlend",
  "feFlood", "feMerge", "feMergeNode", "feDropShadow", "feTurbulence",
  "feDisplacementMap", "animateTransform", "animateMotion",
].map((n) => [n.toLowerCase(), n]));

const VAZIAS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function tokenizar(html) {
  const tokens = [];
  let i = 0;
  while (i < html.length) {
    const abre = html.indexOf("<", i);
    if (abre < 0) {
      if (i < html.length) tokens.push({ tipo: "texto", valor: html.slice(i) });
      break;
    }
    if (abre > i) tokens.push({ tipo: "texto", valor: html.slice(i, abre) });

    if (html.startsWith("<!--", abre)) {
      const fim = html.indexOf("-->", abre);
      i = fim < 0 ? html.length : fim + 3;
      continue;
    }

    const fecha = acharFechamentoDaTag(html, abre);
    const cru = html.slice(abre, fecha + 1);
    i = fecha + 1;

    if (cru.startsWith("</")) {
      const fechado = /^<\/\s*([^\s>]+)/.exec(cru)[1].toLowerCase();
      tokens.push({ tipo: "fecha", nome: TAGS_SVG.get(fechado) ?? fechado });
      continue;
    }

    const nome = /^<\s*([^\s/>]+)/.exec(cru)[1];
    const minusculo = nome.toLowerCase();
    tokens.push({
      tipo: "abre",
      nome: TAGS_SVG.get(minusculo) ?? minusculo,
      atributos: lerAtributos(cru.slice(nome.length + 1)),
      sozinha: /\/\s*>$/.test(cru) || VAZIAS.has(nome.toLowerCase()),
    });
  }
  return tokens;
}

/** Acha o `>` que fecha a tag, ignorando os que estão dentro de aspas. */
function acharFechamentoDaTag(html, inicio) {
  let aspas = null;
  for (let i = inicio + 1; i < html.length; i++) {
    const c = html[i];
    if (aspas) { if (c === aspas) aspas = null; continue; }
    if (c === '"' || c === "'") { aspas = c; continue; }
    if (c === ">") return i;
  }
  return html.length - 1;
}

function lerAtributos(texto) {
  const saida = [];
  const re = /([:@a-zA-Z_][-:.\w]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(texto))) {
    if (m[1] === "/") continue;
    saida.push({ nome: m[1], valor: m[3] ?? m[4] ?? m[5] ?? null });
  }
  return saida;
}

/* ── De onde vêm as variáveis ──────────────────────────────────────────── */

/* Os nomes ligados por `<sc-for as="x">` são locais do laço; todo o resto vem
   de fora, do `renderVals()` do protótipo. Separar os dois é o que permite
   gerar a desestruturação no topo do componente — sem isso o JSX referencia
   `busca` e `filtros` sem que nada os defina. */
const locaisDeLaco = new Set();
const identificadoresDeTopo = new Set();

const PALAVRAS = new Set([
  "true", "false", "null", "undefined", "this", "new", "typeof", "void",
  "in", "of", "instanceof", "return", "if", "else", "Math", "String",
  "Number", "Boolean", "Array", "Object", "JSON", "Date",
]);

function anotarExpressao(codigo) {
  // A raiz de `a.b.c` e de `a[0]` é `a`; chamadas e literais não interessam.
  const re = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(codigo))) {
    const nome = m[1];
    if (PALAVRAS.has(nome) || locaisDeLaco.has(nome)) continue;
    identificadoresDeTopo.add(nome);
  }
}

/* ── Gerador ───────────────────────────────────────────────────────────── */

const avisos = [];
let profundidadeDeLaco = 0;

function gerar(tokens) {
  let i = 0;

  function filhos(ate) {
    const partes = [];
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.tipo === "fecha") {
        if (!ate || t.nome === ate) { i++; break; }
        i++; // fechamento órfão: o protótipo tem alguns
        continue;
      }
      const p = no();
      if (p !== null) partes.push(p);
    }
    return partes;
  }

  function no() {
    const t = tokens[i];

    if (t.tipo === "texto") {
      i++;
      const limpo = t.valor.replace(/\s+/g, " ");
      if (!limpo.trim()) return null;
      return { tipo: "texto", codigo: converterTexto(limpo) };
    }

    i++;

    /* `<sc-for list="{{ a }}" as="b">` — repetição. */
    if (t.nome === "sc-for") {
      const lista = atributo(t, "list");
      const item = atributo(t, "as") || "item";
      locaisDeLaco.add(item);
      /* Índice numerado por nível: `sc-for` dentro de `sc-for` usaria `i` nos
         dois e o TypeScript acusa identificador duplicado. */
      const indice = `i${(profundidadeDeLaco += 1)}`;
      const dentro = t.sozinha ? [] : filhos("sc-for");
      profundidadeDeLaco -= 1;
      const expr = soExpressao(lista ?? "")?.[1]?.trim() ?? lista ?? "[]";
      anotarExpressao(expr);
      return {
        tipo: "bloco",
        codigo: `{(${expr} ?? []).map((${item}: any, ${indice}: number) => (\n<Fragment key={${item}?.id ?? ${item}?.chave ?? ${indice}}>\n${juntar(dentro)}\n</Fragment>\n))}`,
      };
    }

    /* `<sc-if value="{{ c }}">` — condicional. */
    if (t.nome === "sc-if") {
      const cond = atributo(t, "value");
      const dentro = t.sozinha ? [] : filhos("sc-if");
      const expr = soExpressao(cond ?? "")?.[1]?.trim() ?? cond ?? "false";
      anotarExpressao(expr);
      return { tipo: "bloco", codigo: `{(${expr}) ? (<>\n${juntar(dentro)}\n</>) : null}` };
    }

    /* Invólucros do runtime do protótipo: somem, o conteúdo fica. */
    if (t.nome === "x-dc" || t.nome === "dc-import" || t.nome === "helmet") {
      if (t.nome === "helmet") { pular("helmet"); return null; }
      const dentro = t.sozinha ? [] : filhos(t.nome);
      return { tipo: "bloco", codigo: juntar(dentro) };
    }

    const atributos = montarAtributos(t);
    if (t.sozinha) return { tipo: "bloco", codigo: `<${t.nome}${atributos} />` };

    const dentro = filhos(t.nome);
    const titulo = tituloDeSvg.get(t);
    const cabeca = titulo ? `<title>${titulo}</title>\n` : "";
    if (!dentro.length && !cabeca) return { tipo: "bloco", codigo: `<${t.nome}${atributos} />` };
    return { tipo: "bloco", codigo: `<${t.nome}${atributos}>\n${cabeca}${juntar(dentro)}\n</${t.nome}>` };
  }

  function pular(nome) {
    let profundidade = 1;
    while (i < tokens.length && profundidade > 0) {
      const t = tokens[i++];
      if (t.tipo === "abre" && t.nome === nome && !t.sozinha) profundidade++;
      if (t.tipo === "fecha" && t.nome === nome) profundidade--;
    }
  }

  const raiz = filhos(null);
  return juntar(raiz);
}

const juntar = (partes) => partes.map((p) => p.codigo).join("\n");
const atributo = (t, nome) => t.atributos.find((a) => a.nome === nome)?.valor ?? null;

/** Atributos que o React quer como número, não como string. */
const NUMERICOS = new Set(["tabIndex", "colSpan", "rowSpan", "maxLength", "size", "rows", "cols", "span", "start", "min", "max", "step"]);

/* `title` em `<svg>`: o protótipo usa para o tooltip nativo, e o tipo do React
   não aceita o atributo em SVG. Vira `<title>` filho — que além de compilar é
   a forma acessível: o leitor de tela anuncia o nome do gráfico. */
const tituloDeSvg = new Map();

function montarAtributos(t) {
  const fora = [];
  let hover = null;
  let foco = null;
  let classe = null;

  for (const a of t.atributos) {
    if (a.nome === "style-hover") { hover = a.valor; continue; }
    /* `style-focus` é o irmão do hover no protótipo. Mesmo mecanismo: sem
       pseudo-classe em estilo inline, ele vira regra numa folha. */
    if (a.nome === "style-focus") { foco = a.valor; continue; }
    if (a.nome === "title" && t.nome === "svg") { tituloDeSvg.set(t, a.valor); continue; }
    // Dicas do editor do protótipo: não têm sentido em produção.
    if (a.nome.startsWith("hint-") || a.nome === "data-screen-label") continue;
    if (a.valor === null) { fora.push(a.nome); continue; }

    const nome = nomeDeAtributo(a.nome);

    /* `class` fica de lado: com `style-hover` no mesmo elemento os dois viram
       `className` e o JSX recusa atributo repetido. */
    if (nome === "className") { classe = a.valor; continue; }

    if (NUMERICOS.has(nome) && /^\d+$/.test(a.valor)) {
      fora.push(`${nome}={${a.valor}}`);
      continue;
    }

    fora.push(`${nome}=${valorDeAtributo(a.nome, a.valor)}`);
  }

  /* `class`, `style-hover` e `style-focus` desembocam todos em `className`:
     o JSX recusa o atributo repetido, então eles se juntam aqui. */
  const pedacos = [];
  if (classe !== null) {
    const inteira = soExpressao(classe);
    if (inteira) { anotarExpressao(inteira[1]); pedacos.push(inteira[1].trim()); }
    else pedacos.push(JSON.stringify(classe));
  }
  for (const [css, fn] of [[hover, "hover"], [foco, "foco"]]) {
    if (!css) continue;
    const expr = soExpressao(css);
    if (expr) { anotarExpressao(expr[1]); pedacos.push(`${fn}(${expr[1].trim()})`); }
    else pedacos.push(`${fn}(${JSON.stringify(css)})`);
  }
  if (pedacos.length) {
    fora.push(pedacos.length === 1 && classe !== null && !hover && !foco
      ? `className=${valorDeAtributo("class", classe)}`
      : `className={[${pedacos.join(", ")}].filter(Boolean).join(" ")}`);
  }

  return fora.length ? " " + fora.join(" ") : "";
}

/* ── Entrada ───────────────────────────────────────────────────────────── */

const [entrada, saida, nomeDado] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error("uso: node scripts/dc-para-tsx.mjs <arquivo.dc.html> <destino.tsx> [Nome]");
  process.exit(1);
}

const html = readFileSync(entrada, "utf8");

/* O `<style>` do `<helmet>` — reset, scrollbar e @keyframes.
 *
 * Passou despercebido na primeira versão e o efeito foi silencioso: sem
 * `button{text-align:left}` os itens da sidebar saíram centralizados, e sem os
 * `@keyframes` (of-rise, of-fade, of-slide, of-pisca) as entradas de popover e
 * gaveta simplesmente não aconteciam. Nada quebra, tudo fica um pouco errado —
 * que é o tipo de divergência mais caro de achar.
 *
 * Sai para um `.css` ao lado, importado pelo componente gerado. */
const estiloDoHelmet = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1]?.trim() ?? "";

// O script do protótipo sai inteiro para um arquivo ao lado: é lógica, e é
// onde os dados de exemplo precisam virar os dados reais.
const script = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(html);
const semScript = html.replace(/<script[\s\S]*?<\/script>/g, "");
const corpo = /<body[^>]*>([\s\S]*)<\/body>/i.exec(semScript)?.[1] ?? semScript;

const nome = nomeDado
  || basename(entrada).replace(/\.dc\.html$/, "").replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase());

const jsx = gerar(tokenizar(corpo));

/* Ordenado para o arquivo gerado não mudar de ordem a cada execução — diff de
   regeração deve mostrar só o que o desenho mudou. */
const topo = [...identificadoresDeTopo].sort();

writeFileSync(saida, `"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   ${basename(entrada)}
 *
 * O markup é conversão MECÂNICA do desenho — não foi transcrito à mão, então
 * não há divergência de transcrição para procurar. Reveja a ligação com o
 * dado, não o estilo.
 *
 * Para regerar depois de um desenho novo, rode o conversor de novo e refaça só
 * a ligação. NÃO edite o markup aqui à mão: a próxima geração sobrescreve.
 */

import { Fragment } from "react";
import { estilo, foco, hover } from "./proto-runtime";
${estiloDoHelmet ? `import "./${basename(saida).replace(/\.tsx$/, ".css")}";` : ""}

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDe${nome} {
${topo.map((n) => `  ${n}: any;`).join("\n")}
}

export function ${nome}(vals: ValoresDe${nome}) {
  const { ${topo.join(", ")} } = vals;
  return (
    <>
${jsx}
    </>
  );
}
`, "utf8");

if (estiloDoHelmet) {
  const destinoCss = saida.replace(/\.tsx$/, ".css");
  writeFileSync(destinoCss, `/* GERADO por scripts/dc-para-tsx.mjs — o <style> do <helmet> de
   ${basename(entrada)}: reset, scrollbar e @keyframes.

   Sem ele a tela fica "quase certa": botão com texto centralizado em vez de à
   esquerda, e popover/gaveta sem animação de entrada. */\n\n${estiloDoHelmet}\n`, "utf8");
  console.log(`estilo do helmet → ${destinoCss}`);
}

if (script) {
  const destinoScript = saida.replace(/\.tsx$/, ".logica.txt");
  writeFileSync(destinoScript, script[1], "utf8");
  console.log(`lógica do protótipo → ${destinoScript} (portar à mão, ligando nos dados reais)`);
}

console.log(`${nome} → ${saida}`);
if (avisos.length) console.log(avisos.join("\n"));
