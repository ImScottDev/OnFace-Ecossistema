import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Aceite NÃO é ganho (Bloco 03 §26) e toda alteração comercial deixa registro.
 *
 * Duas travas de fonte, para a regra não voltar por um atalho:
 *
 * 1. O caminho do aceite (`proposta-aceite.ts`) não decide Ganho: não chama o marcador de ganho nem
 *    registra evidência. Ganho é a política da oferta (`won-evidence.ts`), alimentada por contrato
 *    assinado ou pagamento confirmado. E o fallback legado de `won-evidence.ts` não trata "proposta
 *    aceita" como evidência.
 * 2. Todo arquivo de produto que grava as linhas de uma proposta (`inserirItensDaProposta`) também grava a
 *    auditoria (`registrarAlteracaoComercial`): desconto não tem limite nem aprovação, mas nada some.
 */

const SRC = "src";
const ler = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return e.name === "scripts" || e.name === "node_modules" ? [] : fontes(caminho);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [caminho] : [];
  });
}

test("o aceite não decide Ganho", () => {
  const aceite = ler("lib", "crm", "proposta-aceite.ts");
  for (const proibido of ["marcarNegocioGanhoSeAindaNao", "registrarEvidencia", "tentarGanhar", "avaliarEvidenciaWon", "status: \"ganho\""]) {
    assert.ok(!aceite.includes(proibido), `proposta-aceite.ts não pode usar ${proibido}: aceite não é ganho`);
  }
});

test("o fallback legado do Ganho não trata proposta aceita como evidência", () => {
  const won = ler("lib", "crm", "won-evidence.ts");
  assert.ok(!won.includes("fallback_legado_proposta_aceita"), "won-evidence.ts voltou a registrar evidência a partir do ACEITE");
  assert.ok(!/eq\(propostas\.status,\s*"aceita"\)/.test(won), "won-evidence.ts voltou a consultar proposta aceita como evidência");
  assert.ok(!/assinaturaStatus\s*!==\s*"pendente"/.test(won), "contrato recusado, cancelado ou expirado não é contrato assinado");
});

test("quem grava as linhas da proposta grava a auditoria", () => {
  const sem = fontes(SRC)
    .filter((f) => { const t = readFileSync(f, "utf8"); return /\binserirItensDaProposta\(/.test(t) && !/function inserirItensDaProposta/.test(t) && !t.includes("registrarAlteracaoComercial"); });
  assert.deepEqual(sem, [], `arquivos que gravam linhas de proposta sem auditoria: ${sem.join(", ")}`);
  // O próprio núcleo grava a auditoria nos dois escritores (criar e editar).
  const nucleo = ler("lib", "crm", "proposta-criacao.ts");
  assert.equal((nucleo.match(/registrarAlteracaoComercial\(/g) ?? []).length, 2, "criar e editar rascunho precisam auditar");
});
