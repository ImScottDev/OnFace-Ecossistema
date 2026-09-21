/**
 * Enriquecimento não reseta o relógio do lead.
 *
 * `leads.updated_at` e `negocios.updated_at` não são "quando a linha mudou":
 * o board de Pré-vendas ordena por eles e o badge "Xd na etapa" sai deles. Na
 * prática são **quando alguém trabalhou este lead**.
 *
 * Por isso a divisão importa:
 *
 *   FATO REAL (pode e deve bumpar): ligação atendida, mensagem trocada,
 *   mudança de status, troca de responsável.
 *
 *   ENRIQUECIMENTO (não pode): preencher UTM, cargo, setor, CNPJ, empresa.
 *   Descobrir de qual anúncio o lead veio não é trabalho feito nele.
 *
 * Já custou caro duas vezes. Um backfill bumpou 216 leads e o board passou a
 * mostrar "17min" em tudo. E em 21/09 mediu-se que `rd-criativo` alcançaria
 * 2.253 leads, 2.006 deles parados há mais de 14 dias, jogando todos para o
 * topo do board de uma vez.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

/** Bumps legítimos, com o fato que os justifica. Crescer esta lista é uma
 *  decisão consciente, e é isso que o teste força. */
const BUMP_JUSTIFICADO: Record<string, string> = {
  "lib/integrations/callface.ts": "ligação atendida é atividade real no lead",
  "lib/integrations/stripe-sync.ts": "muda o status do contrato/assinatura junto",
};

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.ts$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

test("nenhuma integração nova bumpa updated_at sem justificativa registrada", () => {
  const infratores: string[] = [];
  for (const f of arquivos(path.join(SRC, "lib", "integrations"))) {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    if (!/updatedAt:\s*new Date\(\)/.test(fs.readFileSync(f, "utf8"))) continue;
    if (!(rel in BUMP_JUSTIFICADO)) infratores.push(rel);
  }
  assert.deepEqual(infratores, [],
    `estes bumpam updated_at e não estão na lista justificada: ${infratores.join(", ")}. ` +
    `Se é fato real, registre o porquê em BUMP_JUSTIFICADO. Se é enriquecimento, tire o bump.`);
});

test("o enriquecimento de criativo RD continua sem bumpar", () => {
  // O caso concreto que motivou a trava: 2.006 leads parados saltariam para o
  // topo do board de Pré-vendas por causa de um campo de UTM.
  const txt = fs.readFileSync(path.join(SRC, "lib", "integrations", "rd-criativo.ts"), "utf8");
  assert.doesNotMatch(txt, /updatedAt:\s*new Date\(\)/,
    "rd-criativo voltou a bumpar updated_at: o board de Pré-vendas perde a ordem");
  assert.match(txt, /NÃO toca .updatedAt./,
    "a nota que explica o porquê sumiu, e sem ela alguém devolve o bump achando que é bug");
});

/** Tabelas cujo `updated_at` significa "quando alguém trabalhou isto" — o board
 *  ordena por elas e o badge de dias na etapa sai delas. Bumpar em backfill
 *  apaga o histórico de toda a base de uma vez. */
const RELOGIO_DE_TRABALHO = ["oportunidades", "leads", "negocios", "aquisicoes"];

test("nenhum backfill reseta o relógio de trabalho", () => {
  // Backfill roda na VIRADA, sobre a base inteira. Medido em 21/09: o
  // backfill 08 deixou as 126 oportunidades abertas com família todas com a
  // mesma data, enquanto as 401 sem família mantêm datas de 09/02 a 21/09.
  // Em produção isso atingiria 477 de uma vez.
  // Todo backfill, esteja na pasta ou solto em `scripts/` com o nome no
  // arquivo. `backfill-valor-negocios.ts` mora fora da pasta e escapou da
  // primeira versão desta trava.
  const alvos: string[] = [];
  const raiz = path.join(SRC, "scripts");
  for (const e of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (e.isDirectory() && e.name === "backfill") {
      alvos.push(...fs.readdirSync(path.join(raiz, "backfill"))
        .filter((f) => /\.ts$/.test(f)).map((f) => path.join(raiz, "backfill", f)));
    } else if (e.isFile() && /backfill.*\.ts$/.test(e.name)) {
      alvos.push(path.join(raiz, e.name));
    }
  }
  const infratores: string[] = [];
  for (const arq of alvos) {
    const nome = path.relative(raiz, arq);
    const txt = fs.readFileSync(arq, "utf8");
    for (const tabela of RELOGIO_DE_TRABALHO) {
      // `UPDATE <tabela> ... updated_at = now()` na mesma instrução.
      const re = new RegExp(`UPDATE\\s+${tabela}\\b[\\s\\S]{0,400}?updated_at\\s*=\\s*now\\(\\)`, "i");
      if (re.test(txt)) infratores.push(`${nome} → ${tabela}`);
    }
  }
  assert.deepEqual(infratores, [],
    `backfill resetando o relógio de trabalho: ${infratores.join(", ")}. ` +
    `Use o valor de origem (ex.: \`updated_at = a.updated_at\`) em vez de now().`);
});

