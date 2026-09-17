import assert from "node:assert/strict";
import test from "node:test";

import * as prospeccao from "./prospeccao-acoes";

type NavegarProspeccao = (href: string, mudancas: Record<string, string | null>) => string;

test("trocar lista navega com o filtro na URL e preserva os demais filtros", () => {
  const navegar = (prospeccao as typeof prospeccao & { montarUrlProspeccao?: NavegarProspeccao }).montarUrlProspeccao;

  assert.equal(typeof navegar, "function", "a troca de lista precisa formar uma URL para a consulta server-side");
  assert.equal(
    navegar?.("http://localhost:3000/onface-preview/prospeccao?busca=acme&estado=novo", { lista: "Consultoria" }),
    "/onface-preview/prospeccao?busca=acme&estado=novo&lista=Consultoria",
  );
});
