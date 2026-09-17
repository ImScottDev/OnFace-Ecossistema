import assert from "node:assert/strict";
import test from "node:test";

import { acoesEmMassaDisponiveis } from "./prospeccao-acoes";

test("Prospecção expõe somente ações em massa que a infraestrutura já suporta", () => {
  assert.deepEqual(
    acoesEmMassaDisponiveis(),
    [
      "Atribuir responsável",
      "Adicionar à lista",
      "Adicionar à cadência",
      "Adicionar tag",
      "Enriquecer",
      "Pausar cadência",
    ],
  );
});
