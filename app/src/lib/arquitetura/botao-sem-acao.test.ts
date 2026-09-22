import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { globSync } from "node:fs";

/**
 * Botão que não faz nada é UI cenográfica, e o produto a proíbe.
 *
 * O achado que motivou esta trava: três chips no painel de conversa
 * ("Nota", "Tarefa", "MRR") e três controles no painel do assistente da tela
 * de entrada eram `<button>` com rótulo, ícone e `title` — e nenhum handler.
 * Ficavam ao lado de botões que funcionavam, então o grupo inteiro parecia
 * funcionar. Ninguém percebeu porque nada quebrava: o clique simplesmente não
 * fazia nada.
 *
 * Um `<button>` só é aceito aqui quando pode agir. As formas legítimas:
 *
 * - tem um handler de evento (`onClick`, `onMouseEnter`, `onKeyDown`, ...);
 * - é `type="submit"` dentro de um form, que age pelo `onSubmit`;
 * - está `disabled`, que é um estado declarado e não um botão morto;
 * - é filho de um `Trigger asChild` (Radix), que injeta o handler de fora.
 *
 * Qualquer outra forma é um botão que promete e não cumpre.
 */

/** Percorre a tag de abertura respeitando aspas e chaves aninhadas.
 *
 * Um regex simples não serve: `ref={(el) => { ... }}` tem chaves dentro de
 * chaves e `>` dentro de arrow function, e foi exatamente isso que produziu
 * falso positivo nas primeiras versões desta varredura. */
function tagDeAbertura(fonte: string, inicio: number): { fim: number; atributos: string } | null {
  let i = inicio;
  let chaves = 0;
  let aspas: string | null = null;
  while (i < fonte.length) {
    const c = fonte[i];
    const anterior = fonte[i - 1];
    if (aspas) {
      if (c === aspas && anterior !== "\\") aspas = null;
    } else if (c === '"' || c === "'" || c === "`") {
      aspas = c;
    } else if (c === "{") {
      chaves++;
    } else if (c === "}") {
      chaves--;
    } else if (c === ">" && chaves === 0) {
      return { fim: i, atributos: fonte.slice(inicio, i) };
    }
    i++;
  }
  return null;
}

/** Remove comentários antes de varrer.
 *
 * Sem isto a própria trava se acusava: os comentários que explicam POR QUE um
 * botão morto foi removido contêm a palavra `<button>`, e viravam achado. */
function semComentarios(fonte: string): string {
  // preserva o comprimento para as linhas continuarem batendo
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

/** O `asChild` do pai fica na linha acima, ou até três acima quando o trigger
 * é quebrado em várias linhas. */
function dentroDeTriggerAsChild(fonte: string, posicao: number): boolean {
  const antes = fonte.slice(0, posicao).split("\n").slice(-4).join("\n");
  return /asChild/.test(antes);
}

/**
 * Superfícies fora do caminho do produto.
 *
 * Cada uma está aqui com motivo e com destino, não porque dá trabalho
 * arrumar. Remover arquivo é decisão do Kauã (remoção de legado exige
 * autorização), então a dívida fica registrada em vez de escondida.
 */
const FORA_DO_PRODUTO = [
  // Protótipo estático, ZERO referências no código. Nasceu como preview e
  // nunca foi ligado a rota alguma do menu. Pendente de remoção.
  "src/app/estudio/",
  // Componente com ZERO importadores — só é citado num comentário. É o
  // padrão "peça pronta sem chamador": existe, compila, e nenhuma tela usa.
  // Pendente de remoção.
  "src/components/crm2/leads/PaginaCompleta.tsx",
  // Vitrine do Design System em /design. Os botões ali são EXEMPLOS de
  // composição, não ações — o que a página ensina é o arranjo. Ficam de fora
  // da trava porque a regra é sobre o produto; se um dia virarem interativos
  // de verdade, entram.
  "src/components/onface/ds/secoes/",
];

test("nenhum botão promete ação que não pode cumprir", () => {
  const arquivos = globSync("src/{app,components}/**/*.tsx", { cwd: process.cwd() })
    .filter((f) => !f.includes(".test."))
    .filter((f) => !FORA_DO_PRODUTO.some((fora) => f.includes(fora)));

  const mortos: string[] = [];

  for (const arquivo of arquivos) {
    const fonte = semComentarios(readFileSync(arquivo, "utf8"));
    for (let i = fonte.indexOf("<button"); i !== -1; i = fonte.indexOf("<button", i + 1)) {
      // `<buttonish` não é `<button`
      if (/[A-Za-z0-9_]/.test(fonte[i + 7] ?? "")) continue;
      const tag = tagDeAbertura(fonte, i + 7);
      if (!tag) continue;
      const a = tag.atributos;

      if (/\bon[A-Z]\w*\s*=/.test(a)) continue;
      if (/type=\{?["']submit/.test(a)) continue;
      if (/\bdisabled\b/.test(a)) continue;
      if (/\{\.\.\./.test(a)) continue; // props espalhadas trazem o handler
      if (dentroDeTriggerAsChild(fonte, i)) continue;

      const linha = fonte.slice(0, i).split("\n").length;
      const rotulo =
        /aria-label=[{"'`]([^"'`}]{0,40})/.exec(a)?.[1] ??
        /className="([^"]{0,40})/.exec(a)?.[1] ??
        "?";
      mortos.push(`${relative(process.cwd(), arquivo)}:${linha}  ${rotulo}`);
    }
  }

  assert.deepEqual(
    mortos,
    [],
    `estes <button> não têm como agir — sem handler, sem submit, sem disabled e sem trigger asChild:\n    ${mortos.join("\n    ")}`,
  );
});
