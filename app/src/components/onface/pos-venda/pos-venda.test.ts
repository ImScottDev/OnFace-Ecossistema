/**
 * Pós-venda: o que dá para provar sem navegador.
 *
 * Três coisas: a formatação (que erra em silêncio quando erra), o recorte da
 * URL (que não pode divergir entre servidor e cliente) e uma renderização de
 * ponta a ponta de cada tela com a fixture, procurando os defeitos que "passam
 * no tipo": NaN na tela, "undefined" escrito, `href="#"`, e o mock vazando.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { FiltrosDoBoard } from "@/lib/pos-venda/contrato";
import { boardDev, projetoDev } from "@/lib/pos-venda/fixture-dev";
import { chaveDoDia, diasDeCalendario, duracao, haQuanto, moeda, prazo, percentual } from "./formatos";
import { hrefDoBoard, lerFiltros, temFiltro } from "./parametros";
import { BoardView } from "./board/BoardView";
import { Markdown } from "./Markdown";
import { ProjetoTela } from "./projeto/ProjetoTela";
import type { AcoesDaTela } from "./projeto/acoes";

const roteador = { back() {}, forward() {}, prefetch() {}, push() {}, replace() {}, refresh() {} };
const noRoteador = (el: Parameters<typeof h>[1] extends never ? never : ReturnType<typeof h>) =>
  renderToStaticMarkup(h(AppRouterContext.Provider, { value: roteador as never }, el));

const SEM_FILTRO: FiltrosDoBoard = { tipo: null, familia: null, responsavelId: null, estado: null, recorte: null, busca: null };
const ok = async () => ({ ok: true as const });
const ACOES: AcoesDaTela = {
  concluirTarefa: ok, reabrirTarefa: ok, marcarItem: ok, atribuirTarefa: ok, remarcarTarefa: ok, marcarEspera: ok,
  encerrarEspera: ok, adicionarNota: ok, salvarLevantamento: ok, enviarFormulario: ok, escalarParaImplantacao: ok, fazerHandoff: ok,
};

const DEFEITOS = [/NaN/, /undefined/, /\[object /, /href="#"/, /Invalid Date/, /null</];

function semDefeito(html: string, onde: string) {
  for (const re of DEFEITOS) assert.doesNotMatch(html, re, `${onde}: a tela escreveu ${re}`);
}

// ─── Formatação ────────────────────────────────────────────────────────────

test("duração: minutos, horas, e dias com resto", () => {
  assert.equal(duracao(0), "0 min");
  assert.equal(duracao(0.5), "30 min");
  assert.equal(duracao(26), "26 h");
  assert.equal(duracao(76), "3 d 4 h");
  assert.equal(duracao(72), "3 d");
  assert.equal(duracao(-1), "—");
  assert.equal(duracao(Number.NaN), "—");
});

test("dia de calendário é do fuso de São Paulo, não da máquina", () => {
  // 01h UTC de 10/nov ainda é 22h de 9/nov em São Paulo.
  const a = new Date("2026-11-10T01:00:00Z");
  const b = new Date("2026-11-10T15:00:00Z");
  assert.equal(chaveDoDia(a), "2026-11-09");
  assert.equal(chaveDoDia(b), "2026-11-10");
  assert.equal(diasDeCalendario(a, b), 1);
});

test("prazo: vence, venceu e ausência com motivo", () => {
  const agora = new Date("2026-11-09T15:00:00Z");
  assert.deepEqual(prazo(new Date("2026-11-09T20:00:00Z"), agora), { texto: "Vence hoje", tom: "neutro" });
  assert.deepEqual(prazo(new Date("2026-11-10T15:00:00Z"), agora), { texto: "Vence amanhã", tom: "neutro" });
  assert.deepEqual(prazo(new Date("2026-11-06T15:00:00Z"), agora), { texto: "Venceu há 3 dias", tom: "risco" });
  assert.deepEqual(prazo(null, agora, "Prazo começa no T0"), { texto: "Prazo começa no T0", tom: "neutro" });
});

test("moeda: ausente é null, não R$ 0,00", () => {
  assert.equal(moeda(null), null);
  assert.match(moeda(1490) ?? "", /1\.490,00/);
});

test("percentual limita 0-100 e aguenta lixo", () => {
  assert.equal(percentual(1.7), 100);
  assert.equal(percentual(-1), 0);
  assert.equal(percentual(Number.NaN), 0);
  assert.equal(percentual(0.666), 67);
});

test("haQuanto: hoje em minutos, depois em dias", () => {
  const agora = new Date("2026-11-09T15:00:00Z");
  assert.equal(haQuanto(new Date("2026-11-09T14:30:00Z"), agora), "há 30 min");
  assert.equal(haQuanto(new Date("2026-11-08T14:00:00Z"), agora), "ontem");
  assert.equal(haQuanto(new Date("2026-11-04T14:00:00Z"), agora), "há 5 dias");
});

// ─── URL ───────────────────────────────────────────────────────────────────

test("a URL vira filtro e o filtro vira a mesma URL", () => {
  const f = lerFiltros({ familia: "PABX", estado: "AGUARDANDO", recorte: "atrasados", responsavel: "u-ana", q: "praça" });
  assert.equal(f.familia, "PABX");
  assert.equal(f.estado, "AGUARDANDO");
  assert.equal(f.busca, "praça");
  assert.equal(lerFiltros(Object.fromEntries(new URL(`http://x${hrefDoBoard(f)}`).searchParams)).busca, "praça");
});

test("valor desconhecido na URL vira 'sem filtro', nunca erro", () => {
  const f = lerFiltros({ familia: "XPTO", estado: "??", recorte: "inventado", q: "   " });
  assert.deepEqual(f, SEM_FILTRO);
  assert.equal(temFiltro(f), false);
  assert.equal(hrefDoBoard(f), "/pos-vendas");
});

// ─── Fixture: o recorte funciona de verdade ────────────────────────────────

test("board da fixture: abertos por padrão, e cada recorte pega o que diz", () => {
  const base = boardDev(SEM_FILTRO);
  assert.ok(base.cartoes.length > 0);
  assert.ok(base.cartoes.every((c) => c.estado !== "CONCLUIDO" && c.estado !== "CANCELADO"));
  assert.equal(base.total, base.cartoes.length);

  const atrasados = boardDev({ ...SEM_FILTRO, recorte: "atrasados" });
  assert.ok(atrasados.cartoes.every((c) => (c.relogios.diasDeAtraso ?? 0) > 0));
  assert.equal(atrasados.cartoes.length, base.indicadores.atrasados);

  const aguardando = boardDev({ ...SEM_FILTRO, recorte: "aguardando_cliente" });
  assert.ok(aguardando.cartoes.every((c) => c.relogios.esperando?.motivo === "cliente"));

  const pabx = boardDev({ ...SEM_FILTRO, familia: "PABX" });
  assert.ok(pabx.cartoes.every((c) => c.familia === "PABX"));
  // As abas contam sem aplicar a própria família.
  assert.equal(pabx.porFamilia.CALLFACE_AI, base.porFamilia.CALLFACE_AI);

  const busca = boardDev({ ...SEM_FILTRO, busca: "praca" });
  assert.equal(busca.cartoes.length, 1);
  assert.equal(busca.cartoes[0].empresa.nome, "Mercado Praça Viva");

  assert.equal(boardDev({ ...SEM_FILTRO, busca: "zzzz" }).cartoes.length, 0);
});

// ─── Renderização ──────────────────────────────────────────────────────────

test("board renderiza sem NaN, undefined nem link morto, e com os seis indicadores", () => {
  const board = boardDev(SEM_FILTRO);
  const html = noRoteador(h(BoardView, { board, agora: new Date(), equipe: [] }));
  semDefeito(html, "board");
  assert.equal((html.match(/class="pv-kpi"/g) ?? []).length, 6);
  for (const c of board.cartoes) assert.ok(html.includes(c.empresa.nome), `faltou ${c.empresa.nome}`);
  assert.ok(html.includes('href="/pos-vendas?recorte=atrasados"'), "o indicador de atrasados deve ser um recorte na URL");
  assert.ok(html.includes('aria-current="page"'), "a aba da família ativa se anuncia");
});

test("board com recorte vazio mostra saída, não lista em branco", () => {
  const board = boardDev({ ...SEM_FILTRO, busca: "zzzz" });
  const html = noRoteador(h(BoardView, { board, agora: new Date(), equipe: [] }));
  semDefeito(html, "board vazio");
  assert.match(html, /Nenhum projeto com esse recorte/);
  assert.match(html, /Limpar filtros/);
});

test("todo projeto da fixture renderiza inteiro, em toda aba", () => {
  const ids = ["p-aurora", "p-meridian", "p-torre", "p-lume", "p-no", "p-vexa", "p-orbita", "p-praca", "p-pedra", "p-vitta"];
  for (const id of ids) {
    const projeto = projetoDev(id);
    assert.ok(projeto, id);
    for (const aba of ["visao", "tarefas", "levantamento", "materiais", "tempo"] as const) {
      const html = noRoteador(h(ProjetoTela, { projeto, equipe: [], agora: new Date(), acoes: ACOES, abaInicial: aba }));
      semDefeito(html, `${id}/${aba}`);
      assert.ok(html.includes(projeto.empresa.nome));
    }
  }
});

test("link que não existe não vira botão", () => {
  const projeto = projetoDev("p-no");
  assert.ok(projeto && projeto.links.stripe === null && projeto.links.proposta === null);
  const html = noRoteador(h(ProjetoTela, { projeto, equipe: [], agora: new Date(), acoes: ACOES, abaInicial: "visao" }));
  assert.doesNotMatch(html, /Stripe/);
  assert.doesNotMatch(html, />Proposta</);
  assert.match(html, /Cliente 360/);
});

test("espera em curso diz quem segura a bola e desde quando", () => {
  const projeto = projetoDev("p-praca");
  assert.ok(projeto?.relogios.esperando);
  const html = noRoteador(h(ProjetoTela, { projeto, equipe: [], agora: new Date(), acoes: ACOES, abaInicial: "visao" }));
  assert.match(html, /A bola está com a operadora/);
  assert.match(html, /portabilidade da Vivo/);
  assert.match(html, /Encerrar espera/);
  assert.match(html, /congelado/);
});

test("PABX antes do T0 diz que o prazo ainda não começou, em vez de inventar data", () => {
  const projeto = projetoDev("p-orbita");
  assert.ok(projeto);
  const html = noRoteador(h(ProjetoTela, { projeto, equipe: [], agora: new Date(), acoes: ACOES, abaInicial: "visao" }));
  semDefeito(html, "orbita");
});

test("o playbook é markdown renderizado, e HTML solto não passa", () => {
  const html = renderToStaticMarkup(
    h(Markdown, { fonte: "### Passo\n- **forte** e `codigo`\n- <script>alert(1)</script>\n\n[ruim](javascript:alert(1)) e [bom](https://exemplo.com)" }),
  );
  assert.match(html, /<h4>Passo<\/h4>/);
  assert.match(html, /<strong>forte<\/strong>/);
  assert.match(html, /<code>codigo<\/code>/);
  assert.doesNotMatch(html, /<script>/, "o texto do script vira texto escapado, nunca marcação");
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /href="https:\/\/exemplo.com"/);
});

test("a tarefa aberta mostra o playbook do passo, e a atrasada é sinalizada", () => {
  const projeto = projetoDev("p-pedra");
  assert.ok(projeto);
  const html = noRoteador(h(ProjetoTela, { projeto, equipe: [], agora: new Date(), acoes: ACOES, abaInicial: "tarefas" }));
  assert.match(html, /Playbook/);
  assert.match(html, /Checklist/);
  assert.match(html, /Venceu há \d+ dias?/);
});
