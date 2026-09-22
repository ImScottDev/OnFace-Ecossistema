/**
 * Quem move a etapa no legado precisa propagar para o canônico.
 *
 * O board do Pipeline lê `oportunidades.etapa` desde a fase 17. Escrever só em
 * `negocios.status` deixa o negócio andando no legado e a tela mostrando a
 * etapa antiga — e ninguém vê erro, porque as duas escritas "funcionam".
 *
 * Foi o que acontecia no worker até 21/09: lead entra pelo formulário do site,
 * a IA gera o insumo comercial, o worker move o negócio para
 * `reuniao_agendada` e registra em `status_changes`. O board não acompanhava.
 *
 * A divergência medida no banco era zero, porque os 24 negócios em
 * `reuniao_agendada` vieram do backfill e não desse caminho. Defeito latente
 * conta: ele aparece em produção, no primeiro formulário preenchido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

/** Escrever a etapa e propagar são as duas metades. Qualquer uma destas
 *  chamadas fecha o par. */
const PROPAGA = /syncOportunidadeFromNegocio|registrarMudancaDeEtapa|moverEtapaDaOportunidade/;

/** Escreve o estado comercial do negócio: `status`, ganho ou perda. */
const MOVE_ETAPA = /(?:UPDATE\s+negocios\b[\s\S]{0,250}?SET[\s\S]{0,200}?\bstatus\s*=|db\.update\(negocios\)[\s\S]{0,200}?\.set\(\{[\s\S]{0,200}?\bstatus:)/i;

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      return /migrations|node_modules/.test(e.name) ? [] : arquivos(p);
    }
    return /\.ts$/.test(e.name) && !/\.test\.|smoke-|backfill/.test(e.name) ? [p] : [];
  });
}

test("todo caminho que move a etapa do negócio propaga para a oportunidade", () => {
  const infratores: string[] = [];
  let candidatos = 0;
  for (const f of arquivos(SRC)) {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    // `lib/vendas` e `lib/crm` SÃO a porta: propagam por dentro.
    if (rel.startsWith("lib/vendas/") || rel.startsWith("lib/crm/")) continue;
    const txt = fs.readFileSync(f, "utf8");
    if (!MOVE_ETAPA.test(txt)) continue;
    candidatos++;
    if (!PROPAGA.test(txt)) infratores.push(rel);
  }
  // A conta do universo. Sem ela o teste passa verde varrendo zero, e verde de
  // varredura vazia não significa nada: provado no CP56 na trava de tenant.
  assert.ok(candidatos > 0,
    "nenhum arquivo move a etapa do negócio — MOVE_ETAPA deixou de casar com o código");
  assert.deepEqual(infratores, [],
    `movem negocios.status sem propagar para o canônico: ${infratores.join(", ")}. ` +
    `Chame syncOportunidadeFromNegocio depois da escrita, senão o board mostra a etapa antiga.`);
});

test("o caminho do formulário do site continua propagando", () => {
  // O caso concreto: é por onde o lead do site entra.
  const txt = fs.readFileSync(path.join(SRC, "worker", "index.ts"), "utf8");
  const i = txt.indexOf("Insumo comercial gerado via formulario do site");
  assert.ok(i > 0, "o caminho do formulário do site sumiu do worker");
  assert.match(txt.slice(i, i + 700), /syncOportunidadeFromNegocio/,
    "o worker voltou a mover a etapa sem propagar");
});
