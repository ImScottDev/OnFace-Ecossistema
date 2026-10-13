/**
 * A peça de atividade mostra a gaveta COMPLETA do desenho, com dado real.
 *
 * 1. A fatia (`AtividadeDetalheDesenho`) é o mesmo markup dos blocos `dt`/`ed`
 *    de `AtividadesDesenho` — se o desenho for regerado e a fatia não, falha.
 * 2. A gaveta renderizada com uma atividade real mostra subtarefas (com
 *    progresso), o painel de comentários com @, anexos e o editor — nada
 *    escondido (a versão anterior escondia por CSS: `SEM_DOMINIO`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { itemDaTarefa } from "./atividade-tarefa";

// O desenho importa a folha gerada (.css); no node ela não é módulo.
(require as unknown as { extensions: Record<string, () => void> }).extensions[".css"] = () => {};

const ler = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");

test("a fatia é o mesmo markup dos blocos dt/ed do desenho de Atividades", () => {
  const desenho = ler("AtividadesDesenho.tsx");
  const ini = desenho.indexOf("\n{(dt.aberto) ? (<>");
  const fim = desenho.lastIndexOf("</>) : null}\n</div>");
  assert.ok(ini > 0 && fim > ini, "blocos dt/ed não encontrados em AtividadesDesenho.tsx");
  const fatia = ler("AtividadeDetalheDesenho.tsx");
  const fi = fatia.indexOf("\n{(dt.aberto) ? (<>");
  const ff = fatia.lastIndexOf("</>) : null}\n    </>");
  assert.ok(fatia.slice(fi, ff) === desenho.slice(ini, fim), "AtividadeDetalheDesenho.tsx divergiu de AtividadesDesenho.tsx: recopie os blocos dt/ed");
});

test("a peça não esconde mais nada por CSS", () => {
  const peca = ler("AtividadePecaProto.tsx");
  assert.doesNotMatch(peca, /SEM_DOMINIO|display:\s*none/);
});

test("a gaveta abre com subtarefas, comentários, anexos e o painel lateral", async () => {
  const { AtividadeDetalheLiga } = await import("./AtividadeDetalheLiga");
  const item = itemDaTarefa({
    id: "11111111-1111-1111-1111-111111111111", titulo: "Mandar contrato", tipo: "geral", status: "a_fazer", prioridade: "media",
    responsavelNome: "Ana Souza", empresaNome: "ACME", leadNome: "Bia", dataVencimento: "2026-10-20",
    subtarefas: [{ id: "s1", titulo: "Revisar cláusulas", concluida: true, responsavelNome: "Ana Souza" }, { id: "s2", titulo: "Pegar assinatura", concluida: false }],
    comentarios: [{ id: "c1", autorNome: "Ana Souza", corpo: "@Ana Souza revisa", criadoEm: new Date().toISOString(), anexos: [] }],
    anexos: [{ id: "f1", nome: "minuta.pdf", mime: "application/pdf", url: "/api/arquivos/f1" }],
    log: [{ autor: "Ana Souza", texto: "concluiu a subtarefa “Revisar cláusulas”", em: new Date().toISOString() }],
  });
  const html = renderToStaticMarkup(React.createElement(AtividadeDetalheLiga as any, {
    dados: { atividadesV2: [item], opps: [], leads: [] },
    catalogo: { EQUIPE: ["Ana Souza"], REUNIOES: [], OPORTUNIDADES: [], LEADS: [], AtividadesSeed: [], ProjetosSeed: [], Projetos: [] },
    chave: item.key, usuario: { nome: "Ana Souza" },
    gravar: () => {}, avisou: () => {}, fechar: () => {}, ir: () => {}, abrir: () => {},
  }));
  for (const t of [
    "Mandar contrato", "Subtarefas", "Revisar cláusulas", "Pegar assinatura", "50% · 1 de 2",
    "Adicionar subtarefa e apertar Enter", "Comentar · use @ para marcar alguém", "Anexar arquivo", "Mencionar",
    "minuta.pdf", "/api/arquivos/f1", "concluiu a subtarefa", "revisa", "Marcar como feito",
  ]) assert.ok(html.includes(t), `faltou na gaveta: ${t}`);
});
