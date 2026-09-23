#!/usr/bin/env node
/**
 * Inventário do protótipo ONFACE.
 *
 * Lê os `.dc.html` do handoff em `docs/handoff-onface/` e extrai TODO valor de
 * estilo que eles declaram: cor, tamanho, peso, raio, altura, espaçamento,
 * sombra, duração e curva. Escreve `docs/handoff-onface/inventario.md`.
 *
 * Por que existe: até aqui eu transcrevia valor por valor à mão, de
 * `style="…"` inline para CSS, tela a tela. Transcrição à mão sobre 386 estilos
 * inline e 70 cores soltas deriva sempre — cada tela mede certo isolada e o
 * conjunto sai inconsistente. Este script é a diferença entre "eu li e copiei"
 * e "o valor veio do arquivo".
 *
 * Uso: node scripts/inventario-handoff.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PASTA = path.join(RAIZ, "docs/handoff-onface");
const SAIDA = path.join(PASTA, "inventario.md");

/** As telas e a moldura. `design_handoff_pre_vendas/` é cópia do recorte
 *  anterior e fica de fora para não contar valor duas vezes. */
const ARQUIVOS = [
  "OnFace Casca.dc.html",
  "OnFace Pecas.dc.html",
  "OnFace Pre-vendas.dc.html",
  "OnFace Empresa.dc.html",
  "OnFace Dashboard.dc.html",
  "OnFace DS Lab.dc.html",
];

/** Propriedades que carregam decisão de desenho. O resto (display, flex,
 *  position…) é mecânica de layout e não entra no sistema de tokens. */
const PROPRIEDADES = [
  "color", "background", "background-color", "border", "border-color",
  "border-top", "border-bottom", "border-left", "border-right",
  "box-shadow", "outline", "fill", "stroke",
  "font-size", "font-weight", "font-family", "letter-spacing", "line-height",
  "border-radius", "width", "height", "min-height", "max-height",
  "min-width", "max-width", "padding", "margin", "gap",
  "padding-inline", "stroke-width", "transition", "animation", "opacity",
];

const ehCor = (v) => /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(v);

/**
 * Pares `prop:valor` de um bloco de estilo.
 *
 * Divide por `;` e não por regex global porque valor pode conter `;` dentro de
 * `url()` ou de uma sombra composta — e porque `cubic-bezier(.2,0,.2,1)` tem
 * vírgula, não ponto e vírgula.
 */
function pares(bloco) {
  const saida = [];
  for (const pedaco of bloco.split(";")) {
    const corte = pedaco.indexOf(":");
    if (corte < 1) continue;
    const prop = pedaco.slice(0, corte).trim().toLowerCase();
    const valor = pedaco.slice(corte + 1).trim();
    if (!prop || !valor) continue;
    // `{{ x }}` é interpolação do runtime do protótipo, não valor.
    if (valor.includes("{{") || valor.includes("}}")) continue;
    if (!PROPRIEDADES.includes(prop)) continue;
    saida.push([prop, valor]);
  }
  return saida;
}

/** Todo trecho de estilo de um arquivo, venha de onde vier. */
function blocosDe(fonte) {
  const blocos = [];

  // 1. `style="…"` e `style-hover="…"` no markup.
  for (const m of fonte.matchAll(/\bstyle(?:-hover)?="([^"]*)"/g)) blocos.push(m[1]);

  // 2. `<style>…</style>` do helmet: cada corpo de regra.
  for (const m of fonte.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const regra of m[1].matchAll(/\{([^{}]*)\}/g)) blocos.push(regra[1]);
  }

  // 3. Strings de estilo montadas no JS (`corpoStyle: "display:flex;…"`).
  //    Uma string só entra se PARECE CSS: tem `prop:valor` de uma propriedade
  //    conhecida. Sem esse filtro, todo texto da interface entraria.
  for (const m of fonte.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const s = m[1];
    if (!s.includes(":")) continue;
    if (PROPRIEDADES.some((p) => new RegExp(`(^|;)\\s*${p}\\s*:`).test(s))) blocos.push(s);
  }

  return blocos;
}

const porPropriedade = new Map();
const porArquivo = new Map();

for (const nome of ARQUIVOS) {
  const caminho = path.join(PASTA, nome);
  if (!fs.existsSync(caminho)) {
    console.warn(`  ! faltando: ${nome}`);
    continue;
  }
  const fonte = fs.readFileSync(caminho, "utf8");
  const blocos = blocosDe(fonte);
  let total = 0;
  for (const bloco of blocos) {
    for (const [prop, valor] of pares(bloco)) {
      total += 1;
      if (!porPropriedade.has(prop)) porPropriedade.set(prop, new Map());
      const valores = porPropriedade.get(prop);
      if (!valores.has(valor)) valores.set(valor, { n: 0, onde: new Set() });
      const reg = valores.get(valor);
      reg.n += 1;
      reg.onde.add(nome.replace(/^OnFace |\.dc\.html$/g, ""));
    }
  }
  porArquivo.set(nome, { blocos: blocos.length, declaracoes: total });
}

/** Toda cor que aparece em qualquer propriedade, com onde ela é usada.
 *
 * Cor mora em `color`, `background`, `border`, `box-shadow`, `fill`, `stroke` e
 * dentro de shorthand — contá-la só por propriedade esconderia metade. */
const cores = new Map();
for (const [prop, valores] of porPropriedade) {
  for (const [valor, reg] of valores) {
    for (const m of valor.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
      const cor = m[0].toLowerCase();
      if (!cores.has(cor)) cores.set(cor, { n: 0, props: new Set(), onde: new Set() });
      const c = cores.get(cor);
      c.n += reg.n;
      c.props.add(prop);
      for (const o of reg.onde) c.onde.add(o);
    }
  }
}

function tabela(prop, { soNumerico = false } = {}) {
  const valores = porPropriedade.get(prop);
  if (!valores) return "_nenhum_\n";
  let linhas = [...valores.entries()]
    .filter(([v]) => (soNumerico ? !ehCor(v) : true))
    .sort((a, b) => b[1].n - a[1].n);
  if (!linhas.length) return "_nenhum_\n";
  return [
    "| valor | usos | telas |",
    "|---|---:|---|",
    ...linhas.map(([v, r]) => `| \`${v}\` | ${r.n} | ${[...r.onde].join(", ")} |`),
    "",
  ].join("\n");
}

const agora = new Date().toISOString().slice(0, 10);
const linhas = [];
linhas.push("# Inventário do protótipo ONFACE");
linhas.push("");
linhas.push(`Gerado por \`scripts/inventario-handoff.mjs\` em ${agora}. **Não editar à mão.**`);
linhas.push("");
linhas.push("Fonte: os `.dc.html` de `docs/handoff-onface/`. Este arquivo é o que a");
linhas.push("camada de token tem de cobrir — cada valor aqui ou vira papel, ou é declarado");
linhas.push("uso único. Valor que não está aqui não existe no desenho.");
linhas.push("");

linhas.push("## Arquivos lidos");
linhas.push("");
linhas.push("| arquivo | blocos de estilo | declarações |");
linhas.push("|---|---:|---:|");
let somaBlocos = 0;
let somaDecl = 0;
for (const [nome, r] of porArquivo) {
  linhas.push(`| ${nome} | ${r.blocos} | ${r.declaracoes} |`);
  somaBlocos += r.blocos;
  somaDecl += r.declaracoes;
}
linhas.push(`| **total** | **${somaBlocos}** | **${somaDecl}** |`);
linhas.push("");

linhas.push(`## Cores — ${cores.size} distintas`);
linhas.push("");
linhas.push("Ordenadas por uso. As do fim da lista, com um ou dois usos, são candidatas");
linhas.push("a uso único em vez de papel no sistema.");
linhas.push("");
linhas.push("| cor | usos | propriedades | telas |");
linhas.push("|---|---:|---|---|");
for (const [cor, r] of [...cores.entries()].sort((a, b) => b[1].n - a[1].n)) {
  linhas.push(`| \`${cor}\` | ${r.n} | ${[...r.props].join(", ")} | ${[...r.onde].join(", ")} |`);
}
linhas.push("");

for (const [titulo, prop, opcoes] of [
  ["Tamanho de fonte", "font-size", {}],
  ["Peso", "font-weight", {}],
  ["Espaçamento entre letras", "letter-spacing", {}],
  ["Altura de linha", "line-height", {}],
  ["Raio", "border-radius", {}],
  ["Altura", "height", { soNumerico: true }],
  ["Largura", "width", { soNumerico: true }],
  ["Espaço entre itens", "gap", {}],
  ["Recuo", "padding", {}],
  ["Sombra", "box-shadow", {}],
  ["Transição", "transition", {}],
  ["Animação", "animation", {}],
  ["Traço de ícone", "stroke-width", {}],
]) {
  const t = tabela(prop, opcoes);
  linhas.push(`## ${titulo} (\`${prop}\`)`);
  linhas.push("");
  linhas.push(t);
}

/* ── Divergência de paleta entre telas ────────────────────────────────────
 *
 * A pergunta que a lista de cores sozinha não responde: as telas usam a MESMA
 * paleta? Aqui isso vira número. */
const telasComCor = new Set();
for (const r of cores.values()) for (const t of r.onde) telasComCor.add(t);
const exclusivas = new Map();
for (const t of telasComCor) {
  const so = [...cores.entries()].filter(([, r]) => r.onde.size === 1 && r.onde.has(t));
  if (so.length) exclusivas.set(t, so);
}
const nucleo = [...cores.entries()].filter(([, r]) => r.onde.size >= 3);

linhas.push("## Divergência de paleta entre telas");
linhas.push("");
linhas.push(`**${nucleo.length} cores** aparecem em três ou mais telas — é o núcleo, e é o`);
linhas.push("que a camada de token cobre. O resto é cauda, e parte dela é uma paleta");
linhas.push("PARALELA: cor que existe em uma tela só e em nenhuma outra.");
linhas.push("");
linhas.push("| tela | cores exclusivas | usos |");
linhas.push("|---|---:|---:|");
for (const [t, so] of [...exclusivas.entries()].sort((a, b) => b[1].length - a[1].length)) {
  linhas.push(`| ${t} | ${so.length} | ${so.reduce((a, [, r]) => a + r.n, 0)} |`);
}
linhas.push("");
for (const [t, so] of [...exclusivas.entries()].sort((a, b) => b[1].length - a[1].length)) {
  if (so.length < 10) continue;
  linhas.push(`### Só em ${t}`);
  linhas.push("");
  linhas.push("| cor | usos | propriedades |");
  linhas.push("|---|---:|---|");
  for (const [cor, r] of so.sort((a, b) => b[1].n - a[1].n)) {
    linhas.push(`| \`${cor}\` | ${r.n} | ${[...r.props].join(", ")} |`);
  }
  linhas.push("");
}

/* ── Proposta de colapso ──────────────────────────────────────────────────
 *
 * Todo valor está na camada de token com o valor do desenho. Colapsar vizinho
 * encolhe a escala, e muda pixel. Aqui está o custo de cada junção, em
 * declarações afetadas, para a decisão ser tomada com número e não com gosto.
 */
function proposta(prop, vizinhanca) {
  const valores = porPropriedade.get(prop);
  if (!valores) return [];
  const num = [...valores.entries()]
    .map(([v, r]) => [parseFloat(v), r.n, v])
    .filter(([n]) => Number.isFinite(n))
    .sort((a, b) => a[0] - b[0]);

  /* Junções são PARES INDEPENDENTES, não corrente.
   *
   * Encadear vizinhos colapsava 24 tamanhos em 4: 9 puxa 9.5, que puxa 10, que
   * puxa 10.5, e no fim a escala inteira desaba num degrau só. Cada valor
   * participa de no máximo uma junção, e o dono do par é sempre o mais usado —
   * assim a conta de custo é real e as junções podem ser escolhidas uma a uma. */
  const usado = new Set();
  const juncoes = [];
  for (let i = 0; i < num.length - 1; i += 1) {
    const [a, na, va] = num[i];
    const [b, nb, vb] = num[i + 1];
    if (usado.has(va) || usado.has(vb)) continue;
    const delta = Math.round((b - a) * 100) / 100;
    if (delta > vizinhanca) continue;
    usado.add(va);
    usado.add(vb);
    const [ganha, perde, custo] = na >= nb ? [va, vb, nb] : [vb, va, na];
    juncoes.push({ perde, ganha, delta, custo });
  }
  return juncoes.sort((a, b) => a.custo - b.custo);
}

linhas.push("## Proposta de colapso da escala");
linhas.push("");
linhas.push("Nada disto foi aplicado. A camada de token preserva todo valor do desenho.");
linhas.push("Cada linha é uma junção possível entre vizinhos a 1px ou menos, e o **custo**");
linhas.push("é quantas declarações mudariam de valor se ela fosse feita.");
linhas.push("");
for (const [titulo, prop, vizinhanca] of [
  ["Tamanho de fonte", "font-size", 0.5],
  ["Raio", "border-radius", 1],
]) {
  const j = proposta(prop, vizinhanca);
  if (!j.length) continue;
  linhas.push(`### ${titulo}`);
  linhas.push("");
  linhas.push("| junção | diferença | declarações afetadas |");
  linhas.push("|---|---:|---:|");
  for (const x of j) linhas.push(`| \`${x.perde}\` → \`${x.ganha}\` | ${x.delta}px | ${x.custo} |`);
  linhas.push("");
  const total = j.reduce((a, x) => a + x.custo, 0);
  linhas.push(`As ${j.length} junções são independentes — dá para aceitar umas e recusar outras.`);
  linhas.push(`Aceitando todas: **${total} declarações** mudam de valor e a escala vai de `);
  linhas.push(`${porPropriedade.get(prop).size} para ${porPropriedade.get(prop).size - j.length} degraus.`);
  linhas.push("");
}

fs.writeFileSync(SAIDA, linhas.join("\n"));

const resumo = {
  arquivos: porArquivo.size,
  blocos: somaBlocos,
  declaracoes: somaDecl,
  cores: cores.size,
  tamanhosDeFonte: porPropriedade.get("font-size")?.size ?? 0,
  raios: porPropriedade.get("border-radius")?.size ?? 0,
  sombras: porPropriedade.get("box-shadow")?.size ?? 0,
  transicoes: porPropriedade.get("transition")?.size ?? 0,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(resumo, null, 2));
} else {
  console.log(`inventario: ${path.relative(RAIZ, SAIDA)}`);
  for (const [k, v] of Object.entries(resumo)) console.log(`  ${k}: ${v}`);
}
