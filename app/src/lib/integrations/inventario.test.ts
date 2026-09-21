/**
 * O hub de integrações não pode voltar a ser uma lista fixa.
 *
 * A tela listava três cartões, dois com "(placeholder)" no próprio código,
 * enquanto cinco integrações rodavam em produção sem aparecer: discador
 * Callface (4.918 ligações), Stripe (828 faturas), Meta Lead Ads (797 leads),
 * Callface AI (208 snapshots) e Microsoft 365 (58 reuniões).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { db, fecharConexao } from "@/lib/db";
import { inventarioDeIntegracoes } from "./inventario";

test("toda integração do inventário consegue ser lida", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const inv = await inventarioDeIntegracoes();
    assert.ok(inv.length >= 7, `o inventário encolheu para ${inv.length} integrações`);

    // `volume: null` significa que a CONSULTA falhou. A primeira versão deste
    // arquivo tinha um catch cego que devolvia 0, e com ele duas queries com
    // coluna inexistente passaram meses como "integração sem uso".
    const quebradas = inv.filter((i) => i.volume === null).map((i) => `${i.nome}: ${i.pendencia}`);
    assert.deepEqual(quebradas, [], "consulta de integração quebrada devolvendo estado falso");
  } finally {
    await fecharConexao();
  }
});

test("o estado vem de sinal real, e 'em uso' exige volume", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    for (const i of await inventarioDeIntegracoes()) {
      if (i.estado === "em_uso") {
        assert.ok((i.volume ?? 0) > 0, `${i.nome} diz "em uso" sem nenhum registro`);
        assert.ok(i.ultimoSinal, `${i.nome} diz "em uso" e não sabe dizer quando`);
      }
      if (i.estado === "nao_configurada") {
        assert.ok(i.pendencia, `${i.nome} diz "não configurada" e não diz o que falta`);
      }
    }
  } finally {
    await fecharConexao();
  }
});

test("a tela não voltou a ter cartão de placeholder", () => {
  const tela = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "(crm2)", "ajustes", "integracoes", "page.tsx"), "utf8");
  // O formato exato do defeito: `{/* Meta CAPI (placeholder) */}` rotulando um
  // cartão. O comentário histórico acima cita a palavra de propósito e não
  // pode disparar a trava — por isso o padrão exige o fechamento na MESMA
  // linha, que é o que distingue um rótulo de cartão de um texto explicativo.
  assert.doesNotMatch(tela, /\{\/\*[^\n]*\(placeholder\)[^\n]*\*\/\}/,
    "voltou a existir cartão de integração marcado como placeholder");
  assert.match(tela, /<Inventario \/>/, "a tela precisa listar o inventário real");
});
