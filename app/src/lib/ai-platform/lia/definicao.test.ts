/**
 * Ferramenta habilitada e nunca nomeada é token desperdiçado: no provider de produção
 * (claude_subscription) o catálogo vai ao modelo como texto, e o modelo não procura o que
 * o prompt não convida. Em 21/10/2026 nove das 23 ferramentas da Lia estavam nesse estado,
 * com zero chamadas em 22 execuções. Este teste é a trava: habilitou ferramenta de escrita,
 * escreva o gatilho dela no prompt (ou tire da lista).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { compilarPrompt } from "@/lib/ai/agente-escopo";
import { LIA_FERRAMENTAS, LIA_FERRAMENTAS_SO_LEITURA, LIA_VERSAO } from "./definicao";

const promptCompilado = compilarPrompt(LIA_VERSAO);

test("toda ferramenta de escrita da Lia é nomeada no prompt compilado", () => {
  const semConvite = LIA_FERRAMENTAS
    .filter((id) => !(LIA_FERRAMENTAS_SO_LEITURA as readonly string[]).includes(id))
    .filter((id) => !promptCompilado.includes(id.replace(".", "_")));
  assert.deepEqual(semConvite, [], `ferramentas habilitadas sem gatilho no prompt: ${semConvite.join(", ")}`);
});

test("a Lia não carrega ferramenta comercial de mover etapa", () => {
  for (const id of ["lead.update_status", "deal.advance"]) {
    assert.ok(!(LIA_FERRAMENTAS as readonly string[]).includes(id), `${id} voltou à lista da Lia`);
  }
});
