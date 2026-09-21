/**
 * Rotas de CONFIGURAÇÃO exigem permissão (SPEC §31).
 *
 * A varredura de 21/09/2026 encontrou 181 de 210 rotas de escrita sem gate de
 * autorização — só `getCtx`, que autentica e não autoriza. Nem todas são
 * problema, e por isso este teste distingue três tipos:
 *
 * **Operação** (criar lead, mover negócio, mandar WhatsApp): quem está no CRM é
 * do time comercial e trabalha. Exigir permissão granular em cada uma seria
 * paranoia que ninguém mantém, e o gate real dessas é a autenticação.
 *
 * **Pública por desenho** (aceitar proposta por link, webhook): o cliente não
 * tem login. O gate delas é token e assinatura, coberto por outros testes.
 *
 * **Configuração**: muda o que o sistema PODE fazer — credencial de provedor,
 * teto de permissão de agente, regra de automação, orçamento. Estas não podem
 * ficar abertas, e a razão é concreta: a configuração é o caminho mais curto
 * para contornar todo o resto. Quem edita a versão de um agente edita o teto de
 * permissão dele; quem cria uma automação faz por regra o que o papel não
 * permite fazer direto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROTAS = path.resolve(import.meta.dirname, "routes");

/** Arquivos cujas rotas de escrita são todas de configuração. */
const SO_CONFIGURACAO = [
  "automacoes.ts",
  "automacoes-cadencias.ts",
  "automacoes-agentes.ts",
  "automacoes-tags.ts",
  "ai-platform.ts",
];

const GATES = /exigirCtx\(c,|getGestaoCtx\(c\)|getSuperCtx\(c\)|isAdminView/;

test("toda rota de escrita de configuração exige autorização", () => {
  const abertas: string[] = [];
  for (const arquivo of SO_CONFIGURACAO) {
    const src = fs.readFileSync(path.join(ROTAS, arquivo), "utf8");
    for (const m of src.matchAll(/app\.(post|patch|put|delete)\("([^"]*)"/g)) {
      const corpo = src.slice(m.index, m.index + 700);
      if (!GATES.test(corpo)) abertas.push(`${arquivo}: ${m[1].toUpperCase()} ${m[2] || "/"}`);
    }
  }
  assert.deepEqual(
    abertas, [],
    "rota de configuração sem autorização — é o caminho mais curto para contornar o RBAC",
  );
});

test("configurar a IA e usar a IA são permissões diferentes", () => {
  const src = fs.readFileSync(path.join(ROTAS, "ai-platform.ts"), "utf8");

  // Mexer no que o agente PODE fazer é configuração; trabalhar a fila dele é
  // uso. Dar as duas juntas faria quem só conversa com o agente poder também
  // ampliar o poder dele.
  assert.match(src, /exigirCtx\(c, "ai\.configure"\)/, "credenciais e provedores exigem ai.configure");
  assert.match(src, /exigirCtx\(c, "ai\.use"\)/, "trabalhar caso e alerta exige só ai.use");

  // A credencial de provedor é o item mais sensível do arquivo.
  const credenciais = src.slice(src.indexOf('app.post("/automacoes/ai/credentials"'));
  assert.match(
    credenciais.slice(0, 400), /exigirCtx\(c, "ai\.configure"\)/,
    "criar credencial de provedor de IA sem gate deixa qualquer um ligar um modelo por conta da empresa",
  );
});

test("o levantamento de rotas abertas continua visível", () => {
  // Este teste NÃO exige que as 181 sejam fechadas: exige que o número não
  // cresça em silêncio. Rota de escrita nova sem gate aparece aqui, e quem a
  // escreveu decide em qual dos três tipos ela cai.
  let escritas = 0;
  let semGate = 0;
  for (const f of fs.readdirSync(ROTAS)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const src = fs.readFileSync(path.join(ROTAS, f), "utf8");
    for (const m of src.matchAll(/app\.(post|patch|put|delete)\("([^"]*)"/g)) {
      escritas++;
      const corpo = src.slice(m.index, m.index + 700);
      if (!GATES.test(corpo)) semGate++;
    }
  }
  assert.ok(escritas > 150, "a varredura precisa estar encontrando as rotas");
  assert.ok(
    semGate <= 170,
    `${semGate} rotas de escrita sem autorização (medido em 21/09/2026: 166 depois de fechar ` +
    "automação, agente e plataforma de IA). Se cresceu, uma rota nova entrou aberta.",
  );
});
