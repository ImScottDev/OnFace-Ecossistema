/**
 * O mapa de fase precisa cobrir o checklist que ele agrupa.
 *
 * Os dois vivem no mesmo arquivo e mudam por motivos diferentes: alguém
 * acrescenta um passo ao processo real e o mapa fica para trás. O item novo
 * então cai no fallback e a entrega aparece em "Planejamento" para sempre —
 * sem erro, sem log, sem ninguém perceber.
 *
 * Foi exatamente assim que o White Label passou semanas devolvendo `fase: null`
 * e `etapa_atual: null`: o comentário na rota dizia "zero registro real hoje" e
 * já havia registro com checklist preenchido no banco.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PABX_CHECKLIST, WHITE_LABEL_CHECKLIST, AI_CHECKLIST_BASE,
  FASE_PABX_POR_WORKSTREAM, FASE_WHITE_LABEL_POR_WORKSTREAM, MARCO_AI_POR_WORKSTREAM,
} from "@/lib/crm/pos-venda-checklists";

const CASOS = [
  ["PABX", PABX_CHECKLIST, FASE_PABX_POR_WORKSTREAM],
  ["White Label", WHITE_LABEL_CHECKLIST, FASE_WHITE_LABEL_POR_WORKSTREAM],
  ["Callface AI", AI_CHECKLIST_BASE, MARCO_AI_POR_WORKSTREAM],
] as const;

test("todo workstream do checklist tem fase ou marco", () => {
  for (const [nome, checklist, mapa] of CASOS) {
    const semMapa = [...new Set(checklist.map((i) => i.workstream))]
      .filter((w) => !(w in mapa));
    assert.deepEqual(semMapa, [],
      `${nome}: workstream sem fase/marco (${semMapa.join(", ")}). ` +
      `Cai no fallback e a entrega trava na primeira coluna sem erro nenhum.`);
  }
});

test("o mapa não inventa workstream que o checklist não tem", () => {
  // O contrário também mente: fase apontando para trabalho que não existe
  // sugere um passo do processo que ninguém executa.
  for (const [nome, checklist, mapa] of CASOS) {
    const reais = new Set(checklist.map((i) => i.workstream));
    const fantasmas = Object.keys(mapa).filter((w) => !reais.has(w));
    assert.deepEqual(fantasmas, [], `${nome}: mapa cita workstream inexistente (${fantasmas.join(", ")})`);
  }
});

test("o board que cobre as três famílias tem alguém que o abra", () => {
  // `Cf2EntregaWorkspace` sem `familiaFixa` sempre cobriu as três famílias e
  // passou meses sem um único link ("uso interno, não mais linkado nos tabs do
  // módulo", dizia o comentário). Peça pronta sem chamador é o defeito
  // recorrente deste repo, e neste caso custava ver a entrega do produto errado.
  // O board mudou de casa em 01/10: Implantação virou aba do painel de
  // Pós-vendas (`/pos-vendas?aba=imp`), e `/clientes/implantacao` é hoje um
  // redirect que leva o recorte de família adiante. A trava continua valendo —
  // só mudou onde o chamador mora.
  const redirect = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "(crm2)", "clientes", "implantacao", "page.tsx"), "utf8");
  assert.match(redirect, /\/pos-vendas\?aba=imp/,
    "o endereço antigo de Implantação precisa levar ao painel que hoje a hospeda");

  const painel = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "(crm2)", "pos-vendas", "page.tsx"), "utf8");
  assert.match(painel, /familiaInicial=\{[^}]*:\s*null\}/,
    "o painel de Pós-vendas precisa abrir sem família fixa — é a visão que cobre as três");
  assert.match(painel, /abaInicial=/,
    "sem `?aba=`, o redirect de Implantação cairia na aba errada");
});

test("o vocabulário de fase não volta para o arquivo que importa db", () => {
  // Client Component que importasse `lib/crm/fulfillment` arrastaria `db` e
  // quebraria o build — foi por isso que a tela mantinha uma CÓPIA do mapa.
  const puro = fs.readFileSync(path.join(process.cwd(), "src", "lib", "crm", "pos-venda-checklists.ts"), "utf8");
  assert.doesNotMatch(puro, /from\s+"@\/lib\/db/,
    "pos-venda-checklists precisa continuar puro: é o módulo que as telas importam");
  const detalhe = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "crm2", "clientes", "OnboardingDetail.tsx"), "utf8");
  assert.doesNotMatch(detalhe, /const MARCO_POR_WORKSTREAM: Record/,
    "a cópia local do mapa de marcos voltou");
});
