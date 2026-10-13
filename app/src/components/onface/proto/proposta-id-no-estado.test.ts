import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comIdGravado, idAoAbrir, semIdNoEditor } from "./proposta-id-no-estado";

const link = (d: { id?: string }) => (d.id ? "https://x/p/" + d.id : "");

test("proposta nova: sem id não há link; com o id devolvido pelo servidor, há", () => {
  const d = { codigo: "nova", versao: 1 } as any;
  assert.equal(link(d), "");
  assert.equal(link(comIdGravado(d, "abc")), "https://x/p/abc");
});

test("nova versão nasce sem id (não herda o da anterior) e ganha o novo ao gravar", () => {
  const v1 = { id: "id-v1", codigo: "1564", versao: 1 };
  assert.equal(idAoAbrir("versao", v1), undefined);
  const editorGravadoDaV1 = semIdNoEditor({ ...v1 });
  assert.equal("id" in editorGravadoDaV1, false);
  const v2 = comIdGravado({ ...editorGravadoDaV1, versao: 2 } as any, "id-v2");
  assert.equal(link(v2), "https://x/p/id-v2");
});

test("editar rascunho e ver usam o id da própria proposta", () => {
  assert.equal(idAoAbrir("editar", { id: "r1" }), "r1");
  assert.equal(idAoAbrir("ver", { id: "r1" }), "r1");
  assert.equal(idAoAbrir("novo", { id: "r1" }), undefined);
});

test("sem id do servidor o estado não muda", () => {
  const d = { a: 1 };
  assert.equal(comIdGravado(d, undefined), d);
});

test("trava: o Builder devolve o id gravado ao estado e a Liga tira o id do editor", () => {
  const proto = readFileSync(new URL("./PropostaProto.tsx", import.meta.url), "utf8");
  const liga = readFileSync(new URL("./PropostaLiga.tsx", import.meta.url), "utf8");
  assert.match(proto, /comIdGravado\(s\.d, id\)/);
  assert.match(proto, /alvo\?\.aoGravar\?\.\(id\)/);
  assert.match(liga, /semIdNoEditor\(d\)/);
});
