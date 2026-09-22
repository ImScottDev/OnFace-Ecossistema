/**
 * Arquivo marcado como ÓRFÃO não pode ter chamador.
 *
 * Em 22/09 mapeei ~3.000 linhas do CRM2 sem nenhum chamador: a Visão Geral de
 * Vendas inteira (a rota `/vendas` virou a Central de Trabalho Comercial em
 * algum ponto e deixou de renderizá-la) e o compositor de proposta anterior.
 * Nada foi removido — remoção de legado exige autorização explícita.
 *
 * O aviso no topo desses arquivos existe por um risco concreto: eles compilam,
 * passam no tsc e parecem vivos, então alguém pode abrir um deles e consertar a
 * tela errada. Eu quase fiz isso.
 *
 * Um aviso que envelhece é pior que nenhum. Esta trava fecha as duas pontas:
 *
 *   - o arquivo marcado ÓRFÃO continua sem chamador (senão o aviso mente e
 *     manda a pessoa para longe de código vivo);
 *   - quem religar um deles tem que tirar a marca no mesmo commit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");
const MARCA = "ÓRFÃO — mapeado";

function todosOsArquivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) todosOsArquivos(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

test("arquivo marcado como órfão continua sem chamador", () => {
  const arquivos = todosOsArquivos(SRC);
  const marcados = arquivos.filter((f) => fs.readFileSync(f, "utf8").includes(MARCA));
  assert.ok(marcados.length > 0, "a marcação de órfão sumiu — o inventário do CP40 se perdeu");

  const religados: string[] = [];
  const ehOrfao = new Set(marcados);
  for (const orfao of marcados) {
    const nome = path.basename(orfao).replace(/\.tsx?$/, "");
    const pasta = path.basename(path.dirname(orfao));
    // O caminho tem que entrar no padrão, não só o nome do arquivo: existem
    // DOIS `Blocos.tsx` no projeto — `crm2/vendas/Blocos.tsx`, que é o órfão, e
    // `crm2/design/Blocos.tsx`, que é usado pela página de design. Casar só pelo
    // basename acusava o órfão por causa dos chamadores do homônimo vivo.
    const alvo = new RegExp(`from\\s+["'][^"']*${pasta}/${nome}["']`);
    const chamadores = arquivos.filter((f) => {
      if (f === orfao) return false;
      if (/\.test\.tsx?$/.test(f)) return false;
      if (f.includes(`${path.sep}scripts${path.sep}`)) return false;
      // Órfão importar órfão não é religar: o conjunto todo está morto junto, e
      // é assim que ele foi mapeado — os três componentes da Visão Geral de
      // Vendas importam o `vendas-visao-geral` que também não tem chamador.
      if (ehOrfao.has(f)) return false;
      const conteudo = fs.readFileSync(f, "utf8");
      // O próprio aviso cita o nome de arquivos irmãos; comentário não é uso.
      return alvo.test(conteudo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
    });
    if (chamadores.length) {
      religados.push(`${path.relative(SRC, orfao)} ← ${chamadores.map((c) => path.relative(SRC, c)).join(", ")}`);
    }
  }

  assert.deepEqual(religados, [],
    "arquivo marcado como ÓRFÃO ganhou chamador. Tire o aviso do topo e atualize o " +
    "inventário do CP40 — um aviso que mente manda a pessoa para longe de código vivo:\n  " +
    religados.join("\n  "));
});
