import { test } from "node:test";
import assert from "node:assert/strict";
import { lerEquipes } from "@onface/integrations-callface-ai";

/**
 * Ausência de tabela não é falha de leitura.
 *
 * Medido em homologação (14/10/2026): o sincronismo do retrato registrou
 * `0 equipe(s)/workspace(s)` e ficou `parcial`, com
 * *"equipes: nenhuma das tabelas [teams, organization_teams, workspace_teams,
 * equipes] existe. Tabelas de nome parecido: (nenhuma)"*.
 *
 * Dois problemas num: a plataforma não tem tabela de equipe com nenhum desses
 * nomes — e, por lançar, o bloco levava embora os **workspaces**, que existem e já
 * estavam lidos. Um conceito que a plataforma não tem derrubava um que ela tem.
 */

/** `sql` de mentira: tagged template que devolve a resposta combinada por assunto. */
function sqlFalso(resp: { workspaces: unknown[]; tabelasExistentes: string[]; parecidas: string[] }) {
  const fn = (...args: unknown[]) => {
    // Chamada como função (`sql(lista)` / `sql(nome)`): é interpolação de identificador.
    if (!Array.isArray(args[0]) || !("raw" in (args[0] as object))) return { __ident: args[0] };
    const texto = (args[0] as unknown as string[]).join("?");
    if (texto.includes("information_schema.tables") && texto.includes("table_name IN")) {
      return Promise.resolve(resp.tabelasExistentes.map((t) => ({ table_name: t })));
    }
    if (texto.includes("information_schema.tables")) {
      return Promise.resolve(resp.parecidas.map((t) => ({ table_name: t })));
    }
    if (texto.includes("FROM workspaces")) return Promise.resolve(resp.workspaces);
    return Promise.resolve([]);
  };
  return fn as never;
}

const WS = [{ r: { id: "w1", organization_id: "org-1", name: "Comercial", status: "active" } }];

test("sem tabela de equipe, os workspaces sobrevivem e a ausência vira aviso", async () => {
  const r = await lerEquipes(sqlFalso({ workspaces: WS, tabelasExistentes: [], parecidas: [] }), ["org-1"]);

  assert.equal(r.dados.length, 1, "o workspace existe e não pode ser perdido com a equipe que não existe");
  assert.equal(r.dados[0].tipo, "workspace");
  assert.equal(r.dados[0].nome, "Comercial");
  assert.ok(r.ausenteEquipes?.includes("nenhuma das tabelas"), "a ausência precisa ser dita, não engolida");
  assert.ok(r.ausenteEquipes?.includes("teams"), "e precisa dizer quais nomes foram procurados");
});

test("com tabela de equipe, não há ausência a avisar", async () => {
  const r = await lerEquipes(sqlFalso({ workspaces: WS, tabelasExistentes: ["teams"], parecidas: ["teams"] }), ["org-1"]);
  assert.equal(r.ausenteEquipes, null);
  assert.equal(r.dados.length, 1, "o workspace continua; a tabela de times está vazia neste cenário");
});

test("organização nenhuma: nada a ler e nada a avisar", async () => {
  const r = await lerEquipes(sqlFalso({ workspaces: [], tabelasExistentes: [], parecidas: [] }), []);
  assert.deepEqual(r, { dados: [], ausenteEquipes: null });
});
