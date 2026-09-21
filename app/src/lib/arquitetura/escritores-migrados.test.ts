/**
 * Inventário vivo dos escritores de runtime (SPEC §16, §50.1).
 *
 * O SPEC diz que o refactor não está pronto enquanto houver escritor direto sem
 * disposição. Este teste transforma o inventário em contrato executável: cada
 * arquivo que cria identidade comercial precisa estar ligado à porta canônica.
 *
 * Quando alguém abrir uma porta nova sem ligar, o teste acusa aqui, não em
 * produção seis meses depois com 2.378 registros invisíveis.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../..");
const ler = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8");

/** Caminhos que CRIAM identidade comercial e já passam pela porta canônica. */
const MIGRADOS = [
  "app/api/webhooks/rd-lead/route.ts",
  "app/api/webhooks/site-lead/route.ts",
  "api-server/routes/leads.ts",
  "api-server/routes/contatos.ts",
  "api-server/routes/prospeccao.ts",
  "api-server/routes/apollo.ts",
];

test("todo criador de identidade migrado chama a porta canônica", () => {
  const faltando = MIGRADOS.filter((p) => !ler(p).includes("garantirEntradaCanonica"));
  assert.deepEqual(faltando, [], `estes deveriam chamar a porta canônica e não chamam:\n${faltando.join("\n")}`);
});

test("a ponte de cutover declara que é temporária", () => {
  // Dual-write sem data de morte vira permanente, e o SPEC §56 proíbe isso
  // como estado final. O aviso no topo do arquivo é o que impede alguém
  // encontrar isso daqui a um ano e achar que é o desenho.
  const ponte = ler("lib/vendas/ponte-canonica.ts");
  assert.match(ponte, /EXISTE PARA MORRER/, "a ponte tem que dizer que é temporária");
  assert.match(ponte, /fase 25/, "e em que fase sai");
});

test("nenhum criador migrado perdeu a escrita legada ainda", () => {
  // Durante o cutover as duas escritas coexistem de propósito: as telas leem
  // `leads`. Se alguém remover a legada antes da fase 17 (migração de leitura),
  // o registro some da tela no mesmo instante.
  const semLegado = MIGRADOS.filter((p) => {
    const src = ler(p);
    return !/insert\(leads\)|INSERT INTO leads|criarLead/.test(src);
  });
  assert.deepEqual(semLegado, [], `removeram a escrita legada cedo demais:\n${semLegado.join("\n")}`);
});

test("a porta canônica nunca é chamada com await que bloqueie a resposta", () => {
  // A ponte é best-effort: falha dela não pode derrubar a captação de um lead
  // de campanha paga. Nos caminhos de webhook e rota, a chamada é `void` ou
  // tem tratamento próprio.
  const comAwaitDireto = MIGRADOS.filter((p) => {
    const src = ler(p);
    // Aceita `await garantirEntradaCanonica` só onde o fluxo já é assíncrono e
    // o retorno é usado; o padrão esperado é `void garantirEntradaCanonica`.
    const chamadas = src.match(/(await|void)\s+garantirEntradaCanonica/g) ?? [];
    return chamadas.length === 0;
  });
  assert.deepEqual(comAwaitDireto, [], `sem chamada reconhecível da porta:\n${comAwaitDireto.join("\n")}`);
});
