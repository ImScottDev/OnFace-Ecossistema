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
