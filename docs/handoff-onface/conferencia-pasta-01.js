/**
 * Conferidor da Pasta 01 — Casca + Pré-vendas.
 *
 * Roda DENTRO do navegador (Playwright `evaluate`) contra a implementação e
 * compara cada valor com o que `OnFace Casca.dc.html` e
 * `OnFace Pre-vendas.dc.html` DECLARAM. Cada linha da tabela abaixo saiu do
 * fonte do protótipo, não de leitura de tela.
 *
 * Existe porque conferir por amostragem sempre deixa item para trás: cada
 * rodada eu corrigia o que tinha sido apontado e o resto seguia divergente.
 * Aqui a lista é fechada e o resultado é uma contagem.
 *
 * Uso: `node scripts/conferir-pasta-01.mjs` copia este arquivo para
 * `app/public/` e o navegador o importa. Ele não altera nada — só mede.
 */
/* O navegador do Playwright roda com devicePixelRatio 0.8, então o motor
   encaixa cada comprimento na grade de meio device-pixel: 34px vira 33.99 e
   uma borda de 1px vira 0.625. Comparar texto puro reprovaria uma dúzia de
   valores corretos. A folga de 0.4 absorve o encaixe e ainda reprova a menor
   divergência de verdade que existe aqui, que é meio pixel (12.5 × 13). */
const FOLGA = 0.4;
const NUM = /-?\d+(?:\.\d+)?/g;

export function equivalente(a, b) {
  if (a === b) return true;
  const na = a.match(NUM);
  const nb = b.match(NUM);
  if (!na || !nb || na.length !== nb.length) return false;
  if (a.replace(NUM, "#") !== b.replace(NUM, "#")) return false;
  return na.every((v, i) => Math.abs(Number(v) - Number(nb[i])) <= FOLGA);
}

export default async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
  const cx = (el) => (el ? el.getBoundingClientRect() : null);
  const arred = (n) => Math.round(n * 100) / 100;

  const achados = [];
  let total = 0;

  /** Um item da conferência. `real` é medido, `esperado` vem do protótipo. */
  function conferir(area, o_que, real, esperado) {
    total += 1;
    const bate = equivalente(String(real), String(esperado));
    if (!bate) achados.push({ area, o_que, real: String(real), esperado: String(esperado) });
    return bate;
  }

  function px(el, prop) {
    const v = g(el, prop);
    return v == null ? "ausente" : v;
  }
  function tam(el) {
    const r = cx(el);
    return r ? `${arred(r.width)}x${arred(r.height)}` : "ausente";
  }

  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];

  /* ── CASCA ─────────────────────────────────────────────────────────── */

  const moldura = q('[data-slot="sidebar-wrapper"]');
  const coluna = q('.onface-sidebar[data-slot="sidebar-container"]');
  const cartao = q(".onface-conteudo");
  const topo = q(".onface-topbar-v2");

  conferir("casca", "moldura grafite", g(moldura, "backgroundColor"), "rgb(9, 14, 20)");
  conferir("casca", "moldura padding", g(moldura, "padding"), "10px");
  conferir("casca", "moldura não rola", document.documentElement.scrollHeight <= innerHeight + 1, true);
  conferir("casca", "coluna largura", coluna ? arred(cx(coluna).width) : "ausente", 226);
  conferir("casca", "coluna x,y", coluna ? `${arred(cx(coluna).x)},${arred(cx(coluna).y)}` : "ausente", "10,10");
  conferir("casca", "cartão fundo", g(cartao, "backgroundColor"), "rgb(255, 255, 255)");
  conferir("casca", "cartão raio", g(cartao, "borderRadius"), "14px");
  conferir("casca", "topo altura", topo ? arred(cx(topo).height) : "ausente", 52);
  conferir("casca", "topo recuo", g(topo, "padding"), "0px 13px");
  conferir("casca", "topo fio", g(topo, "borderBottomColor"), "rgb(227, 231, 232)");

  const marca = q(".onface-sidebar-marca");
  const lockup = q(".onface-sidebar-lockup");
  conferir("casca", "marca altura", marca ? arred(cx(marca).height) : "ausente", 38);
  conferir("casca", "lockup", tam(lockup), "93x16");
  conferir("casca", "lockup margem", px(lockup, "marginLeft"), "9px");

  const criar = q(".onface-sidebar-criar");
  conferir("casca", "Criar altura", criar ? arred(cx(criar).height) : "ausente", 34);
  conferir("casca", "Criar raio", px(criar, "borderRadius"), "9px");
  conferir("casca", "Criar fundo", px(criar, "backgroundColor"), "rgb(217, 60, 26)");
  conferir("casca", "Criar fonte", `${px(criar, "fontSize")}/${px(criar, "fontWeight")}`, "13.5px/600");
  conferir("casca", "Criar gap", px(criar, "gap"), "9px");
  conferir("casca", "Criar recuo", px(criar, "padding"), "0px 12px");
  conferir("casca", "Criar margem topo", px(criar, "marginTop"), "12px");

  const area = qa(".onface-nav").find((e) => e.getAttribute("data-active") !== "true");
  const areaAtiva = qa(".onface-nav").find((e) => e.getAttribute("data-active") === "true");
  conferir("casca", "área recuo", px(area, "padding"), "7px 9px");
  conferir("casca", "área gap", px(area, "gap"), "11px");
  conferir("casca", "área raio", px(area, "borderRadius"), "8px");
  conferir("casca", "área fonte", `${px(area, "fontSize")}/${px(area, "fontWeight")}`, "13.5px/500");
  conferir("casca", "área tinta", px(area, "color"), "rgb(185, 193, 202)");
  conferir("casca", "área ativa fundo", px(areaAtiva, "backgroundColor"), "rgb(31, 40, 51)");
  conferir("casca", "área ativa tinta", px(areaAtiva, "color"), "rgb(238, 239, 243)");
  conferir("casca", "área ativa peso", px(areaAtiva, "fontWeight"), "600");
  conferir("casca", "ícone da área", tam(area?.querySelector("svg")), "17x17");

  const sub = q(".onface-sidebar-submenu");
  const filho = qa(".onface-nav-sub").find((e) => e.getAttribute("data-active") !== "true");
  const filhoAtivo = q('.onface-nav-sub[data-active="true"]');
  conferir("casca", "submenu margem", px(sub, "margin"), "2px 0px 6px 17px");
  conferir("casca", "submenu recuo", px(sub, "padding"), "0px 0px 0px 18px");
  conferir("casca", "submenu trilho", px(sub, "borderLeft"), "1px solid rgb(36, 44, 54)");
  conferir("casca", "filho recuo", px(filho, "padding"), "6px 9px");
  conferir("casca", "filho raio", px(filho, "borderRadius"), "7px");
  conferir("casca", "filho fonte", px(filho, "fontSize"), "12.5px");
  conferir("casca", "filho tinta", px(filho, "color"), "rgb(154, 164, 174)");
  conferir("casca", "filho ativo fundo", px(filhoAtivo, "backgroundColor"), "rgb(26, 34, 44)");

  const grupo = q(".onface-sidebar-grupo");
  conferir("casca", "rótulo de seção", `${px(grupo, "fontSize")}/${px(grupo, "fontWeight")}`, "10.5px/600");
  conferir("casca", "rótulo tinta", px(grupo, "color"), "rgb(126, 136, 148)");
  conferir("casca", "rótulo recuo", px(grupo, "padding"), "15px 9px 6px");

  const nexo = q(".onface-nexo");
  conferir("casca", "NEXO raio", px(nexo, "borderRadius"), "10px");
  conferir("casca", "NEXO fundo", px(nexo, "backgroundColor"), "rgb(22, 29, 38)");
  conferir("casca", "NEXO recuo", px(nexo, "padding"), "8px");
  conferir("casca", "NEXO margem topo", px(nexo, "marginTop"), "8px");
  conferir("casca", "NEXO avatar", tam(q(".onface-nexo-avatar")), "26x26");

  const titulo = q(".onface-titulo-nome");
  const apoio = q(".onface-titulo-apoio");
  conferir("casca", "título da página", `${px(titulo, "fontSize")}/${px(titulo, "fontWeight")}`, "14.5px/700");
  conferir("casca", "título família", (px(titulo, "fontFamily") || "").split(",")[0], '"Plus Jakarta Sans"');
  conferir("casca", "apoio fonte", px(apoio, "fontSize"), "12.5px");
  conferir("casca", "apoio tinta", px(apoio, "color"), "rgb(74, 85, 96)");

  const regua = q(".onface-topbar-v2-regua");
  conferir("casca", "régua", tam(regua), "1x18");
  conferir("casca", "régua cor", px(regua, "backgroundColor"), "rgb(228, 228, 225)");

  const utilidade = q(".onface-topbar-v2 .onface-utility");
  conferir("casca", "botão de utilidade", tam(utilidade), "30x30");
  conferir("casca", "utilidade raio", px(utilidade, "borderRadius"), "8px");
  conferir("casca", "utilidade tinta", px(utilidade, "color"), "rgb(92, 102, 114)");

  const perfil = q(".onface-perfil");
  conferir("casca", "perfil altura", perfil ? arred(cx(perfil).height) : "ausente", 34);
  conferir("casca", "perfil raio", px(perfil, "borderRadius"), "9px");
  conferir("casca", "perfil recuo", px(perfil, "padding"), "0px 7px 0px 3px");
  conferir("casca", "perfil avatar", tam(q(".onface-perfil-avatar")), "28x28");
  conferir("casca", "perfil nome", `${px(q(".onface-perfil-nome"), "fontSize")}/${px(q(".onface-perfil-nome"), "fontWeight")}`, "12.5px/600");
  conferir("casca", "perfil org", px(q(".onface-perfil-org"), "fontSize"), "11px");
  conferir("casca", "perfil org tinta", px(q(".onface-perfil-org"), "color"), "rgb(103, 120, 124)");

  /* ── PRÉ-VENDAS: barra de controles ───────────────────────────────── */

  const tela = q(".pv-tela");
  conferir("pré-vendas", "papel da tela", px(tela, "backgroundColor"), "rgb(246, 246, 243)");
  conferir("pré-vendas", "controles recuo", px(q(".pv-controles"), "padding"), "14px 14px 0px");
  conferir("pré-vendas", "controles gap", px(q(".pv-controles"), "gap"), "7px");

  const busca = q(".pv-busca");
  conferir("pré-vendas", "busca altura", busca ? arred(cx(busca).height) : "ausente", 34);
  conferir("pré-vendas", "busca largura máx", px(busca, "maxWidth"), "270px");
  conferir("pré-vendas", "busca raio", px(busca, "borderRadius"), "9px");
  conferir("pré-vendas", "busca campo", px(busca?.querySelector("input"), "fontSize"), "13px");

  const grupoFiltro = q(".pv-filtro-grupo");
  conferir("pré-vendas", "filtro altura", grupoFiltro ? arred(cx(grupoFiltro).height) : "ausente", 34);
  conferir("pré-vendas", "filtro raio", px(grupoFiltro, "borderRadius"), "9px");
  conferir("pré-vendas", "filtro corpo fonte", px(q(".pv-filtro-corpo"), "fontSize"), "13px");
  conferir("pré-vendas", "filtro seta largura", q(".pv-filtro-seta") ? arred(cx(q(".pv-filtro-seta")).width) : "ausente", 28);
  conferir("pré-vendas", "quantos filtros", qa(".pv-filtro-grupo").length, 4);

  const maisFiltros = q(".pv-mais-filtros");
  conferir("pré-vendas", "Filtros tracejado", px(maisFiltros, "borderStyle"), "dashed");
  conferir("pré-vendas", "Filtros cor da borda", px(maisFiltros, "borderColor"), "rgb(200, 204, 201)");
  conferir("pré-vendas", "Filtros altura", maisFiltros ? arred(cx(maisFiltros).height) : "ausente", 34);

  const visoes = q(".pv-visoes");
  conferir("pré-vendas", "trilho de visão", px(visoes, "backgroundColor"), "rgb(238, 239, 243)");
  conferir("pré-vendas", "trilho raio", px(visoes, "borderRadius"), "9px");
  conferir("pré-vendas", "trilho recuo", px(visoes, "padding"), "3px");
  conferir("pré-vendas", "visão ativa", px(q('.pv-visoes button[data-ativo="true"]'), "backgroundColor"), "rgb(255, 255, 255)");
  conferir("pré-vendas", "visão ativa raio", px(q('.pv-visoes button[data-ativo="true"]'), "borderRadius"), "7px");

  const novo = q(".pv-novo");
  conferir("pré-vendas", "Novo lead fundo", px(novo, "backgroundColor"), "rgb(217, 60, 26)");
  conferir("pré-vendas", "Novo lead altura", novo ? arred(cx(novo).height) : "ausente", 34);
  conferir("pré-vendas", "Novo lead raio", px(novo, "borderRadius"), "9px");
  conferir("pré-vendas", "Novo lead seta", q(".pv-novo-seta") ? arred(cx(q(".pv-novo-seta")).width) : "ausente", 28);
  conferir("pré-vendas", "Novo lead fio", px(q(".pv-novo-fio"), "backgroundColor"), "rgba(255, 255, 255, 0.34)");

  const ind = q(".pv-indicadores");
  conferir("pré-vendas", "indicadores gap", px(ind, "gap"), "18px");
  conferir("pré-vendas", "indicadores recuo", px(ind, "padding"), "13px 16px 12px");
  conferir("pré-vendas", "indicador rótulo", `${px(q(".pv-indicador-rotulo"), "fontSize")}/${px(q(".pv-indicador-rotulo"), "fontWeight")}`, "10.5px/600");
  conferir("pré-vendas", "indicador rótulo tinta", px(q(".pv-indicador-rotulo"), "color"), "rgb(103, 120, 124)");
  conferir("pré-vendas", "indicador valor", px(q(".pv-indicador-valor"), "fontSize"), "11.5px");
  conferir("pré-vendas", "indicador valor tinta", px(q(".pv-indicador-valor"), "color"), "rgb(163, 168, 164)");
  /* Os cinco nomes do protótipo, nesta ordem (linhas 677-683 do fonte). Medir
     só a tipografia deixava passar uma faixa com outros três indicadores. */
  conferir(
    "pré-vendas",
    "os cinco indicadores",
    qa(".pv-indicador-rotulo").map((e) => e.textContent.trim()).join("|"),
    "Leads ativos|Sem primeiro contato|Sem próxima ação|Qualificados no mês|Tempo até 1º contato",
  );
  conferir(
    "pré-vendas",
    "os quatro filtros",
    qa(".pv-filtro-corpo").map((e) => e.textContent.trim().replace(/\d+$/, "")).join("|"),
    "Responsável|Origem|Interesse|SLA",
  );

  /* ── PRÉ-VENDAS: quadro ───────────────────────────────────────────── */

  const quadro = q(".pv-quadro");
  const col = q(".pv-coluna");
  conferir("quadro", "quadro recuo", px(quadro, "padding"), "0px 14px 14px");
  conferir("quadro", "trilho gap", px(q(".pv-trilho"), "gap"), "10px");
  conferir("quadro", "coluna largura", col ? arred(cx(col).width) : "ausente", 288);
  conferir("quadro", "coluna calha", px(col, "backgroundColor"), "rgb(238, 239, 243)");
  conferir("quadro", "coluna raio", px(col, "borderRadius"), "12px");
  conferir("quadro", "coluna recuo", px(col, "padding"), "6px 8px 12px");
  conferir("quadro", "cabeçalho recuo", px(q(".pv-coluna-topo"), "padding"), "6px 6px 9px");
  conferir("quadro", "nome da coluna", `${px(q(".pv-coluna-nome"), "fontSize")}/${px(q(".pv-coluna-nome"), "fontWeight")}`, "14px/700");
  conferir("quadro", "ponto da etapa", tam(q(".pv-ponto")), "7x7");
  conferir("quadro", "contador", `${px(q(".pv-coluna-conta"), "fontSize")}/${px(q(".pv-coluna-conta"), "fontWeight")}`, "12px/600");
  conferir("quadro", "lista gap", px(q(".pv-coluna-lista"), "gap"), "8px");

  // Cartão em repouso: o selecionado troca borda e revela o seletor, e medir
  // um cartão marcado de uma rodada anterior aponta divergência que não existe.
  const card = q('.pv-card:not([data-sel="1"])');
  conferir("cartão", "raio", px(card, "borderRadius"), "8px");
  conferir("cartão", "fundo", px(card, "backgroundColor"), "rgb(255, 255, 255)");
  conferir("cartão", "recuo", px(card, "padding"), "9px 12px 10px");
  conferir("cartão", "borda", px(card, "border"), "1px solid rgb(219, 222, 222)");
  conferir("cartão", "arrastável", card?.getAttribute("draggable"), "true");
  conferir("cartão", "cursor", px(card, "cursor"), "grab");
  conferir("cartão", "empresa", `${px(q(".pv-card-empresa"), "fontSize")}/${px(q(".pv-card-empresa"), "fontWeight")}`, "13.5px/600");
  conferir("cartão", "empresa recuo dir", px(q(".pv-card-empresa"), "paddingRight"), "22px");
  conferir("cartão", "pessoa", px(q(".pv-card-pessoa"), "fontSize"), "11.5px");
  conferir("cartão", "pessoa tinta", px(q(".pv-card-pessoa"), "color"), "rgb(109, 116, 126)");
  conferir("cartão", "selo de origem altura", q(".pv-selo-origem") ? arred(cx(q(".pv-selo-origem")).height) : "ausente", 19);
  conferir("cartão", "selo raio", px(q(".pv-selo-origem"), "borderRadius"), "6px");
  conferir("cartão", "selo fonte", `${px(q(".pv-selo-origem"), "fontSize")}/${px(q(".pv-selo-origem"), "fontWeight")}`, "10.5px/600");
  conferir("cartão", "ação fonte", px(q(".pv-card-acao-texto"), "fontSize"), "11.5px");
  conferir("cartão", "rodapé fio", px(q(".pv-card-rodape"), "borderTop"), "1px solid rgb(243, 245, 245)");
  conferir("cartão", "avatar", tam(q(".pv-avatar")), "22x22");
  conferir("cartão", "tempo", `${px(q(".pv-card-tempo"), "fontSize")}/${px(q(".pv-card-tempo"), "fontWeight")}`, "11.5px/600");

  const check = q(".pv-check");
  conferir("cartão", "seletor", tam(check), "18x18");
  conferir("cartão", "seletor escondido em repouso", px(check, "opacity"), "0");
  conferir("cartão", "seletor posição", `${px(check, "top")},${px(check, "right")}`, "9px,9px");

  const recolhida = q(".pv-recolhida");
  conferir("quadro", "coluna recolhida largura", recolhida ? arred(cx(recolhida).width) : "ausente", 46);
  conferir("quadro", "recolhida raio", px(recolhida, "borderRadius"), "12px");
  conferir("quadro", "recolhida calha", px(recolhida, "backgroundColor"), "rgb(238, 239, 243)");
  conferir("quadro", "recolhida vertical", px(q(".pv-recolhida-nome"), "writingMode"), "vertical-rl");
  conferir("quadro", "quantas recolhidas", qa(".pv-recolhida").length, 2);

  /* ── PRÉ-VENDAS: lista ────────────────────────────────────────────── */

  const irPara = (nome) => {
    const b = qa(".pv-visoes button").find((x) => x.textContent.trim() === nome);
    b?.click();
  };
  irPara("Lista");
  await esperar(500);

  const listaCartao = q(".pv-lista-cartao");
  conferir("lista", "cartão raio", px(listaCartao, "borderRadius"), "12px");
  conferir("lista", "cartão anel", px(listaCartao, "boxShadow"), "rgb(227, 231, 232) 0px 0px 0px 1px inset");
  conferir("lista", "topo recuo", px(q(".pv-lista-topo"), "padding"), "11px 14px");
  conferir("lista", "topo fio", px(q(".pv-lista-topo"), "borderBottom"), "1px solid rgb(238, 241, 241)");
  conferir("lista", "título", `${px(q(".pv-lista-titulo"), "fontSize")}/${px(q(".pv-lista-titulo"), "fontWeight")}`, "13px/700");
  conferir("lista", "explicação", px(q(".pv-lista-explica"), "fontSize"), "12px");
  conferir("lista", "alternar tinta", px(q(".pv-lista-alternar"), "color"), "rgb(194, 51, 15)");
  conferir("lista", "largura mínima", px(q(".pv-lista-largura"), "minWidth"), "916px");
  conferir("lista", "grade", px(q(".pv-lista-grade"), "gridTemplateColumns").split(" ").length, 6);
  conferir("lista", "grade recuo", px(q(".pv-lista-cabecalho"), "padding"), "8px 14px");
  conferir("lista", "cabeçalho fundo", px(q(".pv-lista-cabecalho"), "backgroundColor"), "rgb(250, 250, 250)");
  conferir("lista", "cabeçalho fonte", `${px(q(".pv-lista-cabecalho"), "fontSize")}/${px(q(".pv-lista-cabecalho"), "fontWeight")}`, "10.5px/600");

  const grupoCab = q(".pv-grupo-cabecalho");
  conferir("lista", "grupo recuo", px(grupoCab, "padding"), "9px 14px");
  conferir("lista", "grupo fundo", px(grupoCab, "backgroundColor"), "rgb(251, 251, 251)");
  conferir("lista", "grupo nome", `${px(q(".pv-grupo-nome"), "fontSize")}/${px(q(".pv-grupo-nome"), "fontWeight")}`, "12.5px/700");
  conferir("lista", "grupo nome família", (px(q(".pv-grupo-nome"), "fontFamily") || "").split(",")[0], '"Plus Jakarta Sans"');
  conferir("lista", "grupo contador altura", q(".pv-grupo-conta") ? arred(cx(q(".pv-grupo-conta")).height) : "ausente", 18);
  conferir("lista", "grupo contador fundo", px(q(".pv-grupo-conta"), "backgroundColor"), "rgb(255, 255, 255)");
  conferir("lista", "grupo alerta tinta", px(q(".pv-grupo-alerta"), "color"), "rgb(156, 50, 16)");

  const linha = q(".pv-linha");
  conferir("lista", "linha recuo", px(linha, "padding"), "10px 14px");
  conferir("lista", "linha fio", px(linha, "borderBottom"), "1px solid rgb(243, 245, 245)");
  conferir("lista", "linha cursor", px(linha, "cursor"), "pointer");
  conferir("lista", "linha empresa", `${px(q(".pv-linha-empresa"), "fontSize")}/${px(q(".pv-linha-empresa"), "fontWeight")}`, "13px/600");
  conferir("lista", "linha pessoa", px(q(".pv-linha-pessoa"), "fontSize"), "11.5px");
  conferir("lista", "linha pessoa tinta", px(q(".pv-linha-pessoa"), "color"), "rgb(74, 85, 96)");
  conferir("lista", "responsável é botão", q(".pv-linha-resp")?.tagName === "BUTTON" || !!q(".pv-linha-resp button"), true);
  conferir("lista", "origem fonte", px(qa(".pv-linha > div").at(-2), "fontSize"), "12px");
  conferir("lista", "parado fonte", `${px(q(".pv-linha-tempo"), "fontSize")}/${px(q(".pv-linha-tempo"), "fontWeight")}`, "12px/600");

  irPara("Quadro");
  await esperar(400);

  return {
    total,
    divergencias: achados.length,
    conformidade: `${total - achados.length}/${total}`,
    achados,
  };
};

/**
 * Terceira bateria: a GAVETA DE DETALHE.
 *
 * Os valores vêm de `OnFace Pecas.dc.html` (bloco `temDetalhe`). Ela ficou de
 * fora das duas primeiras porque o fonte da peça não está na pasta 01 — e o
 * resultado foi medir 221 valores da tela e nenhum da peça que mais se abre.
 */
export async function gaveta() {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const achados = [];
  let total = 0;

  function conferir(area, o_que, real, esperado) {
    total += 1;
    if (!equivalente(String(real), String(esperado))) {
      achados.push({ area, o_que, real: String(real), esperado: String(esperado) });
    }
  }
  const g = (sel, prop) => {
    const e = q(sel);
    return e ? getComputedStyle(e)[prop] : "ausente";
  };
  const cx = (sel) => {
    const e = q(sel);
    return e ? `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}` : "ausente";
  };

  // Abre pelo cartão, que é como o protótipo abre (`OnFaceEstado.abrir`).
  q(".pv-card-empresa")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await esperar(1600);
  conferir("gaveta", "abriu", !!q(".gv"), true);
  if (!q(".gv")) return { total, divergencias: achados.length, conformidade: `${total - achados.length}/${total}`, achados };

  /* ── Moldura ───────────────────────────────────────────────────────── */
  const gv = q(".gv");
  const cr = gv.getBoundingClientRect();
  conferir("moldura", "largura", Math.round(cr.width), 436);
  conferir("moldura", "raio", g(".gv", "borderRadius"), "14px");
  /* A borda direita do viewport de um `fixed` não é `clientWidth`: com o html
     em `overflow:hidden` o Chromium ainda reserva a calha da barra de rolagem,
     e medir por `clientWidth` acusava 16px onde o CSS diz 10. A sonda devolve
     a borda de verdade em qualquer ambiente. */
  const sonda = document.createElement("div");
  sonda.style.cssText = "position:fixed;top:0;right:0;width:1px;height:1px";
  document.body.appendChild(sonda);
  const bordaDireita = sonda.getBoundingClientRect().right;
  sonda.remove();
  conferir("moldura", "flutua 10px da direita", Math.round(bordaDireita - cr.right), 10);
  conferir("moldura", "flutua 10px do topo", Math.round(cr.top), 10);
  conferir("moldura", "véu", g(".gv-veu", "backgroundColor"), "rgba(9, 14, 20, 0.42)");

  /* ── Cabeçalho ─────────────────────────────────────────────────────── */
  conferir("cabeçalho", "recuo", g(".gv-topo", "padding"), "15px 16px 13px");
  conferir("cabeçalho", "fio", g(".gv-topo", "borderBottom"), "1px solid rgb(227, 231, 232)");
  conferir("cabeçalho", "avatar", cx(".gv-avatar"), "38x38");
  conferir("cabeçalho", "avatar fonte", `${g(".gv-avatar", "fontSize")}/${g(".gv-avatar", "fontWeight")}`, "13px/700");
  conferir("cabeçalho", "nome", `${g(".gv-identidade h2", "fontSize")}/${g(".gv-identidade h2", "fontWeight")}`, "16px/700");
  conferir("cabeçalho", "nome família", (g(".gv-identidade h2", "fontFamily") || "").split(",")[0], '"Plus Jakarta Sans"');
  conferir("cabeçalho", "nome espacejamento", g(".gv-identidade h2", "letterSpacing"), "-0.24px");
  conferir("cabeçalho", "cargo · empresa", g(".gv-papel", "fontSize"), "12.5px");
  conferir("cabeçalho", "contatos fonte", g(".gv-contatos span", "fontSize"), "12px");
  conferir("cabeçalho", "contatos margem", g(".gv-contatos", "marginTop"), "6px");
  /* O telefone do protótipo sai legível (`+55 11 98813-3597`); o banco guarda
     a string crua, e treze dígitos colados ninguém lê nem confere. */
  conferir("cabeçalho", "telefone legível", /^\+55 \d{2} \d{4,5}-\d{4}$/.test(q(".gv-contatos span")?.textContent ?? ""), true);
  conferir("cabeçalho", "X de fechar", cx(".gv-fechar"), "28x28");
  conferir("cabeçalho", "X raio", g(".gv-fechar", "borderRadius"), "8px");
  conferir("cabeçalho", "X tinta", g(".gv-fechar", "color"), "rgb(74, 85, 96)");

  const toque = q(".gv-canais button");
  conferir("toques", "quantos", qa(".gv-canais button").length, 3);
  conferir("toques", "altura", toque ? Math.round(toque.getBoundingClientRect().height) : "ausente", 32);
  conferir("toques", "recuo", g(".gv-canais button", "padding"), "0px 11px");
  conferir("toques", "raio", g(".gv-canais button", "borderRadius"), "8px");
  conferir("toques", "anel", g(".gv-canais button", "boxShadow"), "rgb(219, 222, 222) 0px 0px 0px 1px inset");
  conferir("toques", "fonte", `${g(".gv-canais button", "fontSize")}/${g(".gv-canais button", "fontWeight")}`, "12.5px/500");
  conferir("toques", "gap", g(".gv-canais", "gap"), "6px");

  /* Botão, não `<select>`: o select nativo desenha o próprio chevron ao lado
     do nosso — dois chevrons — e acende um anel de foco que não existe lá. */
  conferir("campos", "sem select nativo", qa(".gv select").length, 0);
  conferir("campos", "etapa é botão", q(".gv-campo")?.tagName, "BUTTON");
  conferir("campos", "grade", g(".gv-par", "gridTemplateColumns").split(" ").length, 2);
  conferir("campos", "grade gap", g(".gv-par", "gap"), "10px");
  conferir("campos", "grade margem", g(".gv-par", "marginTop"), "14px");
  conferir("campos", "altura", cx(".gv-campo").split("x")[1], "32");
  conferir("campos", "recuo", g(".gv-campo", "padding"), "0px 10px");
  conferir("campos", "raio", g(".gv-campo", "borderRadius"), "8px");
  conferir("campos", "anel", g(".gv-campo", "boxShadow"), "rgb(219, 222, 222) 0px 0px 0px 1px inset");
  conferir("campos", "fonte", `${g(".gv-campo", "fontSize")}/${g(".gv-campo", "fontWeight")}`, "12.5px/500");
  conferir("campos", "rótulo", `${g(".gv-rotulo", "fontSize")}/${g(".gv-rotulo", "fontWeight")}`, "11px/600");
  conferir("campos", "rótulo margem", g(".gv-rotulo", "marginBottom"), "5px");
  conferir("campos", "ponto da etapa", cx(".gv-ponto-etapa"), "7x7");
  conferir("campos", "avatar do responsável", cx(".gv-resp-avatar"), "20x20");
  conferir("campos", "seta", cx(".gv-campo-seta"), "12x12");

  /* ── Corpo: tags e origem ──────────────────────────────────────────── */
  conferir("corpo", "recuo", g(".gv-bloco", "padding"), "14px 16px");
  conferir("corpo", "gap", g(".gv-bloco", "gap"), "13px");
  /* Sem tag o protótipo não põe chip nenhum, só o "+": um chip escrito
     "Sem tag" parece uma tag chamada "Sem tag". */
  conferir("tags", "sem chip de vazio", !!q(".gv-tag-vazia"), false);
  conferir("tags", "botão +", cx(".gv-tag-mais"), "22x22");
  conferir("tags", "gap", g(".gv-tags", "gap"), "5px");
  conferir("origem", "selo altura", cx(".gv-selo-origem").split("x")[1], "19");
  conferir("origem", "selo fonte", `${g(".gv-selo-origem", "fontSize")}/${g(".gv-selo-origem", "fontWeight")}`, "11px/700");
  conferir("origem", "bloco fundo", g(".gv-atribuicao", "backgroundColor"), "rgb(250, 250, 250)");
  conferir("origem", "bloco raio", g(".gv-atribuicao", "borderRadius"), "9px");
  conferir("origem", "bloco recuo", g(".gv-atribuicao", "padding"), "9px 11px");
  conferir("origem", "bloco gap", g(".gv-atribuicao", "gap"), "6px");
  conferir("origem", "coluna do rótulo", g(".gv-atribuicao dt", "flexBasis"), "74px");
  conferir("origem", "rótulo fonte", g(".gv-atribuicao dt", "fontSize"), "11px");
  /* `19 set 2026 · 09:14`. Em pt-BR o `toLocaleDateString` devolve
     "13 de mai. de 2026": dois "de" e um ponto de abreviação numa coluna de
     74px, e sem a hora, que é o que separa dois leads do mesmo dia. */
  conferir(
    "origem",
    "entrada com data e hora",
    /^\d{2} \w{3} \d{4} · \d{2}:\d{2}$/.test(qa(".gv-atribuicao dd")[0]?.textContent ?? ""),
    true,
  );

  /* ── Seções ────────────────────────────────────────────────────────── */
  const nomes = qa(".gv-secao-nome").map((e) => e.textContent.trim());
  conferir("seções", "as quatro, nesta ordem", nomes.join("|"), "CADÊNCIA|PRÓXIMA AÇÃO|QUALIFICAÇÃO|TIMELINE");
  /* `{ cad: true, acao: true, qualif: false, timeline: false }`. Eu abria a
     QUALIFICAÇÃO e fechava a CADÊNCIA — o inverso: a gaveta abria numa parede
     de campos vazios e escondia se o lead recebe toque automático. */
  conferir(
    "seções",
    "quais abrem por padrão",
    qa(".gv-secao-cab").map((e) => e.dataset.aberta).join("|"),
    "true|true|false|false",
  );
  conferir("seções", "título fonte", `${g(".gv-secao-nome", "fontSize")}/${g(".gv-secao-nome", "fontWeight")}`, "11px/600");
  conferir("seções", "título tinta", g(".gv-secao-nome", "color"), "rgb(74, 85, 96)");
  conferir("seções", "título espacejamento", g(".gv-secao-nome", "letterSpacing"), "0.44px");
  conferir("seções", "cabeçalho recuo", g(".gv-secao-cab", "padding"), "8px");
  conferir("seções", "cabeçalho gap", g(".gv-secao-cab", "gap"), "8px");
  conferir("seções", "chevron", cx(".gv-secao-chevron"), "13x13");
  conferir("seções", "chevron tinta", g(".gv-secao-chevron", "color"), "rgb(103, 120, 124)");
  conferir("seções", "fio entre seções", g(".gv-fio", "backgroundColor"), "rgb(238, 241, 241)");

  const selo = q(".gv-secao-selo");
  conferir("selo", "altura", selo ? Math.round(selo.getBoundingClientRect().height) : "ausente", 18);
  conferir("selo", "recuo", g(".gv-secao-selo", "padding"), "0px 7px");
  conferir("selo", "raio", g(".gv-secao-selo", "borderRadius"), "5px");
  conferir("selo", "fonte", `${g(".gv-secao-selo", "fontSize")}/${g(".gv-secao-selo", "fontWeight")}`, "10.5px/700");
  /* Três tons no protótipo: cheio verde, vazio âmbar, meio cinza. Com só dois
     tons, "0 de 4" saía igual a "3 de 4" — o vazio é o que pede ação. */
  conferir("selo", "vazio é âmbar", selo?.dataset.tom === "aviso" ? g(".gv-secao-selo", "backgroundColor") : "não-vazio", "rgb(247, 237, 216)");
  /* O `cadSelo` vem ANTES do espaçador e o `qualProgSelo` DEPOIS: um fica
     colado ao nome, o outro na direita. Eu colava os dois no nome. */
  const cabQual = qa(".gv-secao-cab").find((e) => e.textContent.includes("QUALIFICAÇÃO"));
  const seloQual = cabQual?.querySelector(".gv-secao-selo");
  const espaco = cabQual?.querySelector(".gv-secao-espaco");
  conferir(
    "selo",
    "o da qualificação fica na direita",
    seloQual && espaco ? espaco.compareDocumentPosition(seloQual) === Node.DOCUMENT_POSITION_FOLLOWING : "ausente",
    true,
  );
  /* A contagem JÁ é o resumo da seção; mostrar os dois punha "0 de 4 campos"
     ao lado de "Sem critério apurado", dizendo a mesma coisa duas vezes. */
  conferir("selo", "sem resumo além do selo", !!cabQual?.querySelector(".gv-secao-resumo"), false);

  /* ── Rodapé ────────────────────────────────────────────────────────── */
  conferir("rodapé", "recuo", g(".gv-rodape", "padding"), "11px 16px");
  conferir("rodapé", "fio", g(".gv-rodape", "borderTop"), "1px solid rgb(227, 231, 232)");
  conferir("rodapé", "gap", g(".gv-rodape", "gap"), "7px");
  conferir("rodapé", "Qualificar coral", g(".gv-saida-grupo", "backgroundColor"), "rgb(217, 60, 26)");
  conferir("rodapé", "Qualificar altura", cx(".gv-saida-grupo").split("x")[1], "34");
  conferir("rodapé", "divisória do botão dividido", g(".gv-saida-fio", "backgroundColor"), "rgba(255, 255, 255, 0.34)");

  /* ── Comportamento ─────────────────────────────────────────────────── */
  q(".gv-campo")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await esperar(320);
  conferir("comportamento", "campo abre menu", !!q(".gv-campo-menu"), true);
  conferir("comportamento", "menu tem as três etapas livres", qa(".gv-campo-menu button").length, 3);
  q(".gv-campo")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await esperar(260);

  const cabQualif = qa(".gv-secao-cab").find((e) => e.textContent.includes("QUALIFICAÇÃO"));
  cabQualif?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await esperar(320);
  conferir("comportamento", "seção abre no clique", cabQualif?.dataset.aberta, "true");

  q(".gv-fechar")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await esperar(360);
  conferir("comportamento", "X fecha", !!q(".gv"), false);

  return {
    total,
    divergencias: achados.length,
    conformidade: `${total - achados.length}/${total}`,
    achados,
  };
}

/**
 * Segunda bateria: ESTADOS e INTERAÇÕES.
 *
 * A primeira mede a tela parada, e tela parada esconde metade do protótipo —
 * menu que não abre, seletor que não aparece no hover, gaveta que não sobe,
 * coluna recolhida que não expande. Aqui cada item é um clique seguido de uma
 * aferição, e o que não acontece conta como divergência.
 */
export async function estados() {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const achados = [];
  let total = 0;

  function conferir(area, o_que, real, esperado) {
    total += 1;
    if (!equivalente(String(real), String(esperado))) {
      achados.push({ area, o_que, real: String(real), esperado: String(esperado) });
    }
  }

  const clicar = async (el, ms = 260) => {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await esperar(ms);
    return true;
  };
  const porTexto = (sel, texto) => qa(sel).find((e) => e.textContent.trim().startsWith(texto));

  /* ── Filtros ───────────────────────────────────────────────────────── */

  const filtro = q(".pv-filtro-seta");
  await clicar(filtro);
  conferir("filtro", "menu abre no clique da seta", !!q(".pv-filtro-menu"), true);
  conferir("filtro", "menu tem título", !!q(".pv-filtro-titulo"), true);
  conferir("filtro", "menu tem opções", qa(".pv-filtro-opcao").length > 0, true);
  /* O menu do filtro é o de raio 6 e sombra rasa (linha 62 do fonte). O de
     raio 10 e sombra funda é o painel da barra de seleção — trocar um pelo
     outro foi erro meu de leitura, não da tela. */
  const menuFiltro = q(".pv-filtro-menu");
  const cmf = menuFiltro ? getComputedStyle(menuFiltro) : null;
  conferir("filtro", "menu raio", cmf?.borderRadius ?? "ausente", "6px");
  conferir("filtro", "menu largura mínima", cmf?.minWidth ?? "ausente", "220px");
  conferir("filtro", "menu recuo", cmf?.padding ?? "ausente", "4px");
  conferir("filtro", "menu borda", cmf?.border ?? "ausente", "1px solid rgb(227, 231, 232)");
  const tf = q(".pv-filtro-titulo") ? getComputedStyle(q(".pv-filtro-titulo")) : null;
  conferir("filtro", "título fonte", tf ? `${tf.fontSize}/${tf.fontWeight}` : "ausente", "11px/600");
  conferir("filtro", "título recuo", tf?.padding ?? "ausente", "6px 6px 4px");
  conferir("filtro", "lista limite", q(".pv-filtro-opcoes") ? getComputedStyle(q(".pv-filtro-opcoes")).maxHeight : "ausente", "260px");
  const of = getComputedStyle(q(".pv-filtro-opcao"));
  conferir("filtro", "opção recuo", of.padding, "7px 6px");
  conferir("filtro", "opção gap", of.gap, "9px");
  conferir("filtro", "Limpar em coral", q(".pv-filtro-limpar") ? getComputedStyle(q(".pv-filtro-limpar")).color : "ausente", "rgb(194, 51, 15)");
  conferir("filtro", "tem divisória antes do Limpar", !!q(".pv-filtro-divisoria"), true);

  /* Fechar por clique fora é `pointerdown` no documento, como no protótipo
     (`document.addEventListener("pointerdown", …)`): um `click` sintético em
     `body` não fecharia, e reprovar aqui seria defeito do conferidor. */
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await esperar(200);
  conferir("filtro", "clique fora fecha", !!q(".pv-filtro-menu"), false);

  /* ── Menu de exportação ────────────────────────────────────────────── */

  await clicar(q(".pv-exportar"));
  conferir("exportar", "menu abre", !!q(".pv-exportar-menu"), true);
  conferir("exportar", "três caminhos", qa(".pv-exportar-item").length, 3);
  await clicar(porTexto(".pv-exportar-item", "Escolher critérios"), 320);
  conferir("exportar", "modal de critérios abre", !!q(".ex"), true);
  conferir("exportar", "três escopos", qa(".ex-escopo").length, 3);
  conferir("exportar", "treze colunas", qa(".ex-coluna").length, 13);
  conferir("exportar", "escopo inicial é a visão", q('.ex-escopo[data-on="true"]')?.textContent.startsWith("Visão atual"), true);
  conferir("exportar", "rodapé conta o total", !!q(".ex-total strong"), true);
  await clicar(q(".ex-fechar"), 260);
  conferir("exportar", "fecha no X", !!q(".ex"), false);

  /* ── Seleção em massa ──────────────────────────────────────────────── */

  const alvo = q('.pv-card:not([data-sel="1"]) .pv-check');
  await clicar(alvo, 300);
  conferir("seleção", "cartão fica marcado", qa('.pv-card[data-sel="1"]').length, 1);
  conferir("seleção", "barra aparece", !!q(".bs-barra"), true);
  conferir("seleção", "quatro ações", qa(".bs-acao").length, 4);
  conferir("seleção", "rótulos", qa(".bs-acao").map((b) => b.textContent.trim()).join("|"), "Responsável|Cadência|Tag|Mover etapa");
  conferir("seleção", "contagem", q(".bs-conta")?.textContent, "1");

  await clicar(porTexto(".bs-acao", "Responsável"), 400);
  conferir("seleção", "painel abre", !!q(".bs-painel"), true);
  conferir("seleção", "título do painel", q(".bs-painel-titulo")?.textContent, "ATRIBUIR RESPONSÁVEL");
  conferir("seleção", "ação aberta inverte", q('.bs-acao[data-on="true"]') ? getComputedStyle(q('.bs-acao[data-on="true"]')).backgroundColor : "ausente", "rgb(238, 239, 243)");
  await clicar(porTexto(".bs-acao", "Mover etapa"), 400);
  conferir("seleção", "troca de painel", q(".bs-painel-titulo")?.textContent, "MOVER PARA ETAPA");

  await clicar(q(".bs-limpar"), 300);
  conferir("seleção", "limpar some com a barra", !!q(".bs-barra"), false);
  conferir("seleção", "e desmarca o cartão", qa('.pv-card[data-sel="1"]').length, 0);

  /* ── Busca ─────────────────────────────────────────────────────────── */

  conferir("busca", "texto de apoio", q(".pv-busca input")?.placeholder, "Empresa, pessoa ou e-mail");

  /* ── Coluna recolhida ──────────────────────────────────────────────── */

  const antesRecolhidas = qa(".pv-recolhida").length;
  await clicar(q(".pv-recolhida"), 320);
  conferir("quadro", "recolhida expande no clique", qa(".pv-recolhida").length, antesRecolhidas - 1);
  await clicar(qa(".pv-coluna-fechar").at(-1), 320);
  conferir("quadro", "e volta a recolher", qa(".pv-recolhida").length, antesRecolhidas);

  /* ── Abertura do detalhe ───────────────────────────────────────────── */

  await clicar(q(".pv-card-empresa"), 700);
  conferir("gaveta", "cartão abre a gaveta", !!q(".gv"), true);
  const gv = q(".gv");
  conferir("gaveta", "largura", gv ? Math.round(gv.getBoundingClientRect().width) : "ausente", 436);
  conferir("gaveta", "raio", gv ? getComputedStyle(gv).borderRadius : "ausente", "14px");
  conferir("gaveta", "tem rodapé de saídas", !!q(".gv-rodape"), true);
  /* A gaveta em si é da Pasta 02 (`OnFace Pecas`); o que a Pasta 01 especifica
     é que o cartão abre o detalhe. Aferir aqui o conteúdo de uma seção seria
     cobrar da Pasta 01 o que ela delega — mede-se que as seções existem e que
     a fechada anuncia o que guarda. */
  conferir("gaveta", "quatro seções", qa(".gv-secao").length, 4);
  conferir("gaveta", "seção fechada anuncia o conteúdo", !!q(".gv-secao-resumo"), true);
  await clicar(q(".gv-fechar"), 320);
  conferir("gaveta", "fecha no X", !!q(".gv"), false);

  /* ── Quadro ↔ Lista ────────────────────────────────────────────────── */

  const visao = (nome) => qa(".pv-visoes button").find((x) => x.textContent.trim() === nome);
  await clicar(visao("Lista"), 500);
  conferir("visão", "Lista troca a tela", !!q(".pv-lista-cartao") && !q(".pv-quadro"), true);
  conferir("visão", "botão da Lista fica ativo", visao("Lista")?.dataset.ativo, "true");

  const resp = q(".pv-linha-resp");
  const rBotao = resp.getBoundingClientRect();
  await clicar(resp, 320);
  conferir("lista", "responsável abre menu", !!q(".pv-resp-menu"), true);
  conferir("lista", "menu tem Sem responsável", qa(".pv-resp-menu button").some((b) => b.textContent.includes("Sem responsável")), true);
  conferir("lista", "menu largura mínima", q(".pv-resp-menu") ? getComputedStyle(q(".pv-resp-menu")).minWidth : "ausente", "208px");
  /* O README avisa que um ancestral com `transform` vira bloco de contenção e
     desloca o `fixed`. Aferir a posição é o que detecta isso: o menu tem de
     nascer colado ao botão que o abriu, e não no canto da tela. */
  const rMenu = q(".pv-resp-menu")?.getBoundingClientRect();
  conferir("lista", "menu alinhado ao botão", rMenu ? Math.abs(rMenu.left - rBotao.left) <= 2 : "ausente", true);
  conferir("lista", "menu logo abaixo do botão", rMenu ? Math.abs(rMenu.top - (rBotao.bottom + 4)) <= 2 : "ausente", true);
  await clicar(q(".pv-resp-fora"), 300);
  conferir("lista", "clique fora fecha o menu", !!q(".pv-resp-menu"), false);

  conferir("lista", "a lista rola sozinha na horizontal", getComputedStyle(q(".pv-lista-rolagem")).overflowX, "auto");

  const grupo = q(".pv-grupo-cabecalho");
  const antesLinhas = qa(".pv-linha").length;
  await clicar(grupo, 320);
  conferir("lista", "grupo recolhe", qa(".pv-linha").length < antesLinhas, true);
  await clicar(grupo, 320);
  conferir("lista", "e abre de novo", qa(".pv-linha").length, antesLinhas);

  await clicar(visao("Quadro"), 500);
  conferir("visão", "Quadro volta", !!q(".pv-quadro"), true);

  /* ── Arrasto ───────────────────────────────────────────────────────── */

  /* Por último, porque um arrasto sintético deixa estado para trás e
     atrapalharia os cliques seguintes. O visual do cartão pego é medido
     aplicando o atributo: é a REGRA que interessa, e um `dragstart` forjado
     nem sempre chega ao React. O comportamento medido de verdade é o
     `dragend`, que é onde estava o defeito. */
  const carta = q(".pv-card");
  const coluna = q(".pv-coluna");
  carta.setAttribute("data-arrastando", "true");
  await esperar(260); // a sombra tem transição de .12s; ler antes pega o meio dela
  const arr = getComputedStyle(carta);
  conferir("arrasto", "cartão gira ao ser pego", arr.getPropertyValue("rotate"), "-1.2deg");
  conferir("arrasto", "e cresce um pouco", arr.getPropertyValue("scale"), "1.02");
  conferir("arrasto", "ganha sombra de peso", arr.boxShadow, "rgba(9, 14, 20, 0.12) 0px 2px 6px 0px, rgba(9, 14, 20, 0.26) 0px 18px 36px 0px");
  carta.removeAttribute("data-arrastando");

  const dt = () => new DataTransfer();
  coluna.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt() }));
  await esperar(250);
  conferir("arrasto", "coluna sob o cursor se realça", qa('.pv-coluna[data-sobre="true"]').length, 1);
  // Relê o cartão e a coluna do DOM em vez de usar os nós guardados: o
  // `dragover` re-renderiza o quadro, e um nó de antes já não é o que carrega
  // o handler — disparar nele é disparar no vazio.
  q(".pv-card").dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt() }));
  await esperar(800);
  conferir("arrasto", "soltar fora apaga o realce", qa('.pv-coluna[data-sobre="true"]').length, 0);

  /* ── Responsividade ────────────────────────────────────────────────── */

  const larguraDeRolagem = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
  conferir("responsivo", "sem rolagem horizontal na página", larguraDeRolagem() <= 1, true);
  conferir("responsivo", "o quadro é que rola", getComputedStyle(q(".pv-quadro")).overflowX, "auto");

  return {
    total,
    divergencias: achados.length,
    conformidade: `${total - achados.length}/${total}`,
    achados,
  };
}
