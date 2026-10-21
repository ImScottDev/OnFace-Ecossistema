import assert from "node:assert/strict";
import { test } from "node:test";
import { decomporVenda } from "./receita-fechada";

test("recorrência não perde o setup nem conta valor_total duplicado", () => {
  assert.deepEqual(decomporVenda({tipoReceita:"recorrente",mrrFechado:900,valorSetup:400,valorTotal:1300}),
    {recorrente:900,avulso:400,total:1300});
});
test("projeto avulso usa valor cheio uma só vez", () => {
  assert.deepEqual(decomporVenda({tipoReceita:"projeto",mrrFechado:0,valorSetup:200,valorTotal:1800}),
    {recorrente:0,avulso:1800,total:1800});
});
test("projeto sem valor total usa fallback de setup", () => {
  assert.deepEqual(decomporVenda({tipoReceita:"avulso",mrrFechado:0,valorSetup:300,valorTotal:0}),
    {recorrente:0,avulso:300,total:300});
});
test("ausência de campos não transforma mensalidade em receita duplicada", () => {
  assert.deepEqual(decomporVenda({tipoReceita:null,mrrFechado:250,valorSetup:null,valorTotal:5000}),
    {recorrente:250,avulso:0,total:250});
});
