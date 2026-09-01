#!/usr/bin/env node
/**
 * Verificador do Callface UI System.
 *
 * Por que existe: a auditoria de 30/08 encontrou 13 raios e 24 tamanhos de
 * fonte diferentes no (crm2). A causa não foi desleixo — era que nada
 * impedia. Criar a escala sem criar a trava significa refatorar 5 módulos e
 * ver a divergência voltar na semana seguinte.
 *
 * Uso:
 *   node scripts/verificar-design-system.mjs          # relatório
 *   node scripts/verificar-design-system.mjs --strict # sai 1 se houver violação (CI)
 *
 * NÃO está plugado no `build` de propósito: hoje existem ~1.000 ocorrências
 * herdadas e travar o build agora bloquearia o deploy. A trava entra quando o
 * placar zerar, módulo a módulo.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();
const ALVOS = ["src/app/(crm2)", "src/components/crm2"];
// O catálogo mostra os tokens; ele precisa citar os valores literais.
const ISENTOS = ["src/components/crm2/design/", "src/components/crm2/ds/"];

const REGRAS = [
  {
    nome: "raio-fora-da-escala",
    // Tailwind default (rounded-lg/xl/2xl...) e pixel solto. A escala é
    // rounded-hero|card|inner|control|chip|full.
    re: /\brounded(-[trbl]{1,2})?-(sm|md|lg|xl|2xl|3xl|4xl|\[[^\]]+\])/g,
    dica: "use rounded-hero | rounded-card | rounded-inner | rounded-control | rounded-chip | rounded-full",
  },
  {
    nome: "fonte-fora-da-escala",
    re: /\btext-\[[0-9.]+px\]/g,
    dica: "use text-hero | text-destaque | text-kpi | text-titulo | text-item | text-corpo | text-apoio | text-micro",
  },
  {
    nome: "cor-literal",
    // Hex cru no JSX. Cor tem que vir de token, senão dark mode não existe.
    re: /(?:className|style)[^\n]*?#[0-9a-fA-F]{3,8}\b/g,
    dica: "use um token: text-tinta, bg-superficie, var(--cf2-*)",
  },
];

function arquivos(dir) {
  const saida = [];
  let itens;
  try { itens = readdirSync(dir); } catch { return saida; }
  for (const item of itens) {
    const caminho = join(dir, item);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (/\.tsx?$/.test(item)) saida.push(caminho);
  }
  return saida;
}

const porRegra = new Map(REGRAS.map((r) => [r.nome, []]));
let total = 0;

for (const alvo of ALVOS) {
  for (const caminho of arquivos(join(RAIZ, alvo))) {
    const rel = relative(RAIZ, caminho);
    if (ISENTOS.some((i) => rel.startsWith(i))) continue;
    const linhas = readFileSync(caminho, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      for (const regra of REGRAS) {
        regra.re.lastIndex = 0;
        const achados = linha.match(regra.re);
        if (achados) {
          porRegra.get(regra.nome).push({ arquivo: rel, linha: i + 1, trecho: achados[0].trim().slice(0, 60) });
          total += achados.length;
        }
      }
    });
  }
}

console.log("\n  Callface UI System — verificação\n");
for (const regra of REGRAS) {
  const lista = porRegra.get(regra.nome);
  const marca = lista.length === 0 ? "OK  " : "FALHA";
  console.log(`  ${marca} ${regra.nome}: ${lista.length} ocorrência(s)`);
  if (lista.length) {
    console.log(`        ${regra.dica}`);
    const porArquivo = new Map();
    for (const o of lista) porArquivo.set(o.arquivo, (porArquivo.get(o.arquivo) ?? 0) + 1);
    [...porArquivo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .forEach(([a, n]) => console.log(`        ${String(n).padStart(4)}x  ${a}`));
    if (porArquivo.size > 8) console.log(`        … e mais ${porArquivo.size - 8} arquivo(s)`);
  }
  console.log("");
}
console.log(`  Total: ${total} violação(ões) herdada(s). O placar zera módulo a módulo.\n`);

if (process.argv.includes("--strict") && total > 0) process.exit(1);
