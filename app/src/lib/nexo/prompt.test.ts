import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPromptNexo } from "./prompt";

const base = {
  hoje: "terça-feira, 13 de outubro de 2026 09:00",
  usuario: { nome: "Ana", papel: "closer", pessoal: true },
  tela: { rota: "/pipeline", area: "Vendas", entidade: null, classificacao: null },
  historico: "", pergunta: "Bom dia",
};

test("o prompt leva identidade e orientação, não dado do CRM", () => {
  const p = montarPromptNexo(base);
  assert.match(p, /Ana \(closer\)/);
  assert.match(p, /só os registros dele/);
  assert.match(p, /\/pipeline/);
  assert.match(p, /PERGUNTA: Bom dia/);
  // O que antes ia sempre e agora só vem por ferramenta.
  for (const chave of ["leadsAbertos", "semProximaAcao", "maisEsquecidos", "loopsAbertos", "oportunidadesAbertas", "valorEmAberto", "usoCallfaceAi"]) assert.doesNotMatch(p, new RegExp(chave), chave);
  // E o modelo sabe onde buscar.
  for (const f of ["nexo_panorama", "nexo_lembrar", "nexo_anotar"]) assert.match(p, new RegExp(f));
});

test("histórico só entra quando há conversa; gestão vê a organização inteira", () => {
  assert.doesNotMatch(montarPromptNexo(base), /CONVERSA ATÉ AQUI/);
  const p = montarPromptNexo({ ...base, usuario: { nome: "Zé", papel: "admin", pessoal: false }, historico: "Usuário: oi" });
  assert.match(p, /CONVERSA ATÉ AQUI:\nUsuário: oi/);
  assert.match(p, /organização inteira/);
});

test("o prompt de um cumprimento é curto", () => {
  // Teto de regressão: se alguém empilhar contexto fixo de novo, quebra aqui.
  assert.ok(montarPromptNexo(base).length < 5200, `${montarPromptNexo(base).length} caracteres`);
});
