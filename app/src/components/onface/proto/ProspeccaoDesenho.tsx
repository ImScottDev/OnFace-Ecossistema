"use client";

/* DERIVADO de PreVendasDesenho.tsx (que é gerado por scripts/dc-para-tsx.mjs
 * a partir de OnFace Pre-vendas.dc.html).
 *
 * Não existe desenho do Claude Design para a Prospecção. Em vez de recriar a
 * tela com componentes próprios (o que divergia do resto do produto), este
 * arquivo é o markup do board de Pré-vendas ADAPTADO, no mesmo caminho que
 * LeadDesenho fez a partir da Oportunidade: mesma toolbar, mesmas colunas e
 * cartões, mesma lista, mesma barra de seleção em massa e mesmos estilos.
 *
 * Mudanças em relação a PreVendasDesenho (e só elas):
 *   - o botão Exportar e seu modal saíram; entram `topoAcoes` (Adicionar
 *     empresa, Importar, Apollo) com o mesmo estilo de botão;
 *   - `ehOutra` + `corpoOutro`: as visões Operação, Campanhas e Inteligência
 *     ocupam o corpo, com a toolbar de Pré-vendas em cima;
 *   - o cartão ganha o menu "Mover para" (teclado e toque, sem arrastar) e a
 *     coluna ganha "Ver mais" (carregar mais cartões, como em Pré-vendas);
 *   - a lista ganha cabeçalhos ordenáveis e paginação (a consulta é paginada
 *     no servidor), e a linha mostra o estado em chip.
 *
 * Quando o Claude Design entregar a tela de Prospecção, regerar daqui.
 */

import { Fragment } from "react";
import { estilo, foco, hover } from "./proto-runtime";
import "./PreVendasDesenho.css";
import "./ProspeccaoDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeProspeccaoDesenho {
  acoesMassa: any;
  alternarTodos: any;
  alternarTodosLabel: any;
  busca: any;
  placeholderBusca: any;
  colunas: any;
  ehFila: any;
  ehQuadro: any;
  ehOutra: any;
  corpoOutro: any;
  filtros: any;
  limparSelecao: any;
  listaGrupos: any;
  listaVazia: any;
  listaVazioTitulo: any;
  listaVazioTexto: any;
  tituloLista: any;
  subtituloLista: any;
  cabLista: any;
  paginacao: any;
  painelAberto: any;
  painelOpcoes: any;
  painelTitulo: any;
  parar: any;
  qtdSelecao: any;
  recolhidas: any;
  rotuloSelecao: any;
  setBusca: any;
  temSelecao: any;
  topoAcoes: any;
  totalLista: any;
  visoes: any;
}

export function ProspeccaoDesenho(vals: ValoresDeProspeccaoDesenho) {
  const { acoesMassa, alternarTodos, alternarTodosLabel, busca, placeholderBusca, colunas, ehFila, ehQuadro, ehOutra, corpoOutro, filtros, limparSelecao, listaGrupos, listaVazia, listaVazioTitulo, listaVazioTexto, tituloLista, subtituloLista, cabLista, paginacao, painelAberto, painelOpcoes, painelTitulo, parar, qtdSelecao, recolhidas, rotuloSelecao, setBusca, temSelecao, topoAcoes, totalLista, visoes } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-r="toolbar" data-stagger="45" data-stagger-tipo="blur" style={{ flex: "0 0 auto", padding: "14px 14px 0", display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "34px", flex: "1 1 200px", maxWidth: "270px", minWidth: "140px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={busca} onChange={setBusca} placeholder={placeholderBusca} style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0" }} />
</div>
{(filtros ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div data-of-filtro="1" style={{ position: "relative", flex: "0 0 auto" }}>
<div style={estilo(f.grupoStyle)}>
<button onClick={f.abrir} style={estilo(f.corpoStyle)} className={[hover(f.corpoHover)].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={f.icone} />
</svg>
<span style={{ whiteSpace: "nowrap" }}>
{f.label}
</span>
{(f.temSel) ? (<>
<span style={estilo(f.contaStyle)}>
{f.conta}
</span>
</>) : null}
</button>
<span style={estilo(f.divisoria)} />
<button onClick={f.abrir} style={estilo(f.setaStyle)} title="Abrir opções" className={[hover(f.corpoHover)].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={estilo(f.chevron)}>
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
</div>
{(f.aberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 5px)", left: "0", minWidth: "220px", zIndex: "35", borderRadius: "6px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)", padding: "4px", animation: "of-rise .12s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "6px 6px 4px" }}>
{f.titulo}
</div>
<div style={{ maxHeight: "260px", overflowY: "auto" }}>
{(f.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(o.caixa)}>
{(o.on) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{o.label}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ height: "1px", background: "#eef1f1", margin: "4px -4px" }} />
<button onClick={f.limpar} style={{ width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "12.5px", fontWeight: "600", color: "#c2330f" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Limpar
</button>
</div>
</>) : null}
</div>
</Fragment>
))}
<span style={{ flex: "1", minWidth: "8px" }} />
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px", flex: "0 0 auto", height: "34px", alignItems: "stretch" }}>
{(visoes ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.onClick} style={estilo(v.style)}>
{v.label}
</button>
</Fragment>
))}
</div>
{(topoAcoes ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
{(a.menuOpcoes) ? (<>
<div data-of-saida="1" style={{ position: "relative", flex: "0 0 auto" }}>
<div style={{ display: "flex", alignItems: "stretch", height: "34px", borderRadius: "9px", overflow: "hidden", background: "#d93c1a" }}>
<button onClick={a.onClick} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "0 12px 0 11px", background: "transparent", border: "0", color: "#fff", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("background:rgba(0,0,0,.14)")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={a.d} />
</svg>
<span>
{a.label}
</span>
</button>
<span style={{ flex: "0 0 auto", width: "1px", background: "rgba(255,255,255,.34)" }} />
<button onClick={a.alternarMenu} title="Importar ou buscar empresas" aria-label="Importar ou buscar empresas" style={{ display: "grid", placeItems: "center", width: "28px", background: "transparent", border: "0", color: "#fff", cursor: "pointer" }} className={[hover("background:rgba(0,0,0,.14)")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform .12s cubic-bezier(.2,0,.2,1)", transform: "rotate(" + (a.menuAberto ? 180 : 0) + "deg)" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
{(a.menuAberto) ? (<>
<div role="menu" style={{ position: "absolute", top: "calc(100% + 5px)", right: "0", width: "268px", zIndex: "44", borderRadius: "6px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)", padding: "4px", animation: "of-rise .12s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "7px 8px 4px" }}>
ADICIONAR EMPRESAS
</div>
{(a.menuOpcoes ?? []).map((o: any, i2: number) => (
<Fragment key={i2}>
<button role="menuitem" onClick={o.onClick} style={{ display: "flex", alignItems: "flex-start", gap: "9px", width: "100%", padding: "8px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", color: "#1f252c" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d={o.d} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", lineHeight: "1.35" }}>
{o.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4", marginTop: "1px", textWrap: "pretty" }}>
{o.nota}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</>) : (<>
<button onClick={a.onClick} disabled={a.off} title={a.dica} style={estilo(a.style)} className={[hover(a.hover)].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={a.d} />
</svg>
<span>
{a.label}
</span>
</button>
</>)}
</Fragment>
))}
</div>
{(ehQuadro) ? (<>
<div data-r="board" style={{ flex: "1", minHeight: "0", overflowX: "auto", overflowY: "hidden", padding: "14px 14px 14px" }}>
<div data-stagger="90" data-stagger-tipo="curtain" data-delay="120" style={{ display: "flex", gap: "10px", alignItems: "stretch", height: "100%", minHeight: "0" }}>
{(colunas ?? []).map((col: any, i1: number) => (
<Fragment key={col?.id ?? col?.chave ?? i1}>
<section data-r="coluna" data-estado={col.estado} onDragOver={col.sobre} onDragLeave={col.sai} onDrop={col.solta} style={estilo(col.style)}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "6px 6px 9px" }}>
<span style={estilo(col.ponto)} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "-.01em", whiteSpace: "nowrap", color: "#12171d" }}>
{col.label}
</span>
<span style={{ flex: "1" }} />
{(col.travada) ? (<>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6d747e" strokeWidth="2" strokeLinejoin="round" style={{ flex: "0 0 auto", alignSelf: "center" }}>
<rect x="4" y="11" width="16" height="10" rx="2" />
<path d="M8 11V7a4 4 0 0 1 8 0v4" />
</svg>
</>) : null}
<span style={{ flex: "0 0 auto", fontSize: "12px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{col.conta}
</span>
{(col.recolhivel) ? (<>
<button onClick={col.fechar} style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5560", border: "0", background: "transparent", cursor: "pointer" }} title="Recolher coluna" className={[hover("background:#e3e7e8;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
</button>
</>) : null}
</div>
<div data-stagger="70" data-stagger-tipo="spring" data-delay={col.atrasoEntrada} data-stagger-filhos-tilt="7" style={{ flex: "1", minHeight: "56px", overflowY: "auto", overflowX: "visible", display: "flex", flexDirection: "column", gap: "8px", padding: "2px 3px 8px", margin: "0 -3px" }}>
{(col.cards ?? []).map((k: any, i2: number) => (
<Fragment key={k?.id ?? k?.chave ?? i2}>
<div data-sel={k.selAttr} data-lead={k.leadId} draggable={col.arrastavel} onDragStart={k.pega} onDragEnd={k.larga} onClick={k.abrir} tabIndex={0} style={estilo(k.style)} className="of-card">
<button onClick={k.marcar} style={estilo(k.checkStyle)} title="Selecionar cartão" className="of-check">
{(k.sel) ? (<>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
{(k.temMenu) ? (<>
<div data-of-cardmenu="1" style={{ position: "absolute", top: "8px", right: "32px", zIndex: "2" }}>
<button onClick={k.abrirMenu} title="Mover para…" aria-label={k.menuRotulo} style={estilo(k.menuBtnStyle)} className={["of-check", hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M5 12h.01M12 12h.01M19 12h.01" />
</svg>
</button>
{(k.menuAberto) ? (<>
<div role="menu" style={estilo(k.menuStyle)}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "6px 6px 4px" }}>
MOVER PARA
</div>
{(k.menuOpcoes ?? []).map((o: any, i3: number) => (
<Fragment key={i3}>
<button role="menuitem" onClick={(e: any) => { e.stopPropagation(); o.onClick(e); }} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "13px", color: o.perigo ? "#c2330f" : "#1f252c" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
{o.label}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</>) : null}
<div style={{ fontSize: "13.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", paddingRight: k.temMenu ? "46px" : "22px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.empresa}
</div>
<div style={{ fontSize: "11.5px", color: "#6d747e", lineHeight: "1.35", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.pessoa}
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px" }}>
<span style={estilo(k.origemSelo)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9" />
</svg>
<span>
{k.origem}
</span>
</span>
{(k.temTag) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", height: "19px", padding: "0 7px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto" }}>
{k.tag}
</span>
</>) : null}
{(k.temCadencia) ? (<>
<span title="Passo da cadência" style={{ display: "inline-flex", alignItems: "center", height: "19px", padding: "0 7px", borderRadius: "6px", background: "#e8f0fb", color: "#2c5f9e", fontSize: "10.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.cadencia}
</span>
</>) : null}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "9px" }}>
{(k.urgente) ? (<>
<span style={{ flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "50%", background: "#fe4f2b" }} title="Sem próxima ação" />
</>) : null}
<span style={estilo(k.acaoStyle)}>
{k.acao}
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "10px", paddingTop: "9px", borderTop: "1px solid #f3f5f5" }}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "9.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{k.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "11.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.responsavel}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{k.tempo}
</span>
</div>
</div>
</Fragment>
))}
{(col.vazia) ? (<>
<div style={{ padding: "16px 10px", textAlign: "center" }}>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b9bfc0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 7px", display: "block" }}>
<path d={col.vazioIcone} />
</svg>
<div style={{ fontSize: "11.5px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{col.vazioTexto}
</div>
</div>
</>) : null}
{(col.temMais) ? (<>
<button onClick={col.verMais} style={{ flex: "0 0 auto", height: "32px", borderRadius: "8px", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", textAlign: "center" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Ver mais ({col.restantes})
</button>
</>) : null}
</div>
</section>
</Fragment>
))}
{(recolhidas ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<button onClick={r.abrir} data-estado={r.estado} onDragOver={r.sobre} onDragLeave={r.sai} onDrop={r.solta} style={estilo(r.style)} title={r.label}>
<span style={estilo(r.ponto)} />
<span style={{ fontSize: "12px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{r.conta}
</span>
<span style={{ writingMode: "vertical-rl", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12.5px", fontWeight: "700", letterSpacing: "-.005em", color: "#12171d", whiteSpace: "nowrap" }}>
{r.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
{(ehFila) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "0 16px 16px" }}>
<div style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "11px 14px", borderBottom: "1px solid #eef1f1", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap" }}>
{tituloLista}
</span>
<span style={{ fontSize: "12px", color: "#4a5560", textWrap: "pretty" }}>
{subtituloLista}
</span>
<span style={{ flex: "1", minWidth: "0" }} />
<button onClick={alternarTodos} style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", background: "transparent", cursor: "pointer" }} className={[hover("color:#9c3210")].filter(Boolean).join(" ")}>
{alternarTodosLabel}
</button>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap", flex: "0 0 auto" }}>
{totalLista}
</span>
</div>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "916px" }}>
<div style={{ display: "grid", gridTemplateColumns: "30px minmax(170px,1.7fr) minmax(180px,1.5fr) 176px 108px 66px", gap: "10px", padding: "8px 14px", background: "#fafafa", borderBottom: "1px solid #eef1f1", fontSize: "10.5px", fontWeight: "600", color: "#4a5560", letterSpacing: ".05em" }}>
<div />
{(cabLista ?? []).map((c: any, i1: number) => (
<Fragment key={i1}>
{(c.onClick) ? (<>
<button onClick={c.onClick} aria-sort={c.aria} style={{ fontSize: "10.5px", fontWeight: "600", color: c.ativa ? "#12171d" : "#4a5560", letterSpacing: ".05em", textAlign: c.direita ? "right" : "left", padding: "0", whiteSpace: "nowrap" }} className={[hover("color:#12171d")].filter(Boolean).join(" ")}>
{c.label}{c.seta}
</button>
</>) : (<>
<div style={{ textAlign: c.direita ? "right" : "left" }}>
{c.label}
</div>
</>)}
</Fragment>
))}
</div>
{(listaGrupos ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div>
<button onClick={g.alternar} style={estilo(g.cabecalhoStyle)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(g.chevron)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={estilo(g.ponto)} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12.5px", fontWeight: "700", letterSpacing: "-.005em", color: "#12171d", whiteSpace: "nowrap" }}>
{g.label}
</span>
<span style={{ flex: "0 0 auto", minWidth: "19px", height: "18px", paddingInline: "5px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#4a5560", fontSize: "10.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>
{g.conta}
</span>
<span style={{ flex: "1", minWidth: "0" }} />
{(g.temUrgente) ? (<>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", color: "#9c3210", whiteSpace: "nowrap" }}>
<span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fe4f2b" }} />
<span>
{g.urgentesTexto}
</span>
</span>
</>) : null}
</button>
{(g.aberto) ? (<>
<div data-stagger="38" data-stagger-tipo="swing">
{(g.linhas ?? []).map((r: any, i2: number) => (
<Fragment key={r?.id ?? r?.chave ?? i2}>
<div data-sel={r.selAttr} onClick={r.abrir} style={estilo(r.style)} className={["of-card", hover("background:#fafafa")].filter(Boolean).join(" ")}>
<button onClick={r.marcar} style={estilo(r.checkStyle)} title="Selecionar" className="of-check">
{(r.sel) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.empresa}
</div>
<div style={{ fontSize: "11.5px", color: "#4a5560", lineHeight: "1.35", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.pessoa}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
{(r.urgente) ? (<>
<span style={{ flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "50%", background: "#fe4f2b" }} />
</>) : null}
<span style={estilo(r.acaoStyle)}>
{r.acao}
</span>
</div>
<div data-of-resp="1" style={{ minWidth: "0", position: "relative" }}>
<button onClick={r.abrirResp} style={estilo(r.respBtnStyle)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={estilo(r.avatarStyle)}>
{r.iniciais}
</span>
<span style={estilo(r.respStyle)}>
{r.resp}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }} className="of-chev">
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(r.respMenu) ? (<>
<div data-of-resp="1" style={estilo(r.respMenuStyle)}>
{(r.respOpcoes ?? []).map((o: any, i3: number) => (
<Fragment key={o?.id ?? o?.chave ?? i3}>
<button onClick={o.onClick} style={estilo(o.style)} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(o.avatar)}>
{o.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>
{o.label}
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
<div style={{ minWidth: "0" }}>
<span style={estilo(r.estadoStyle)}>
{r.estado}
</span>
</div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#4a5560", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
{r.dias}
</div>
</div>
</Fragment>
))}
</div>
</>) : null}
</div>
</Fragment>
))}
{(listaVazia) ? (<>
<div style={{ padding: "44px 16px", textAlign: "center" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#3d4650", marginBottom: "5px" }}>
{listaVazioTitulo}
</div>
<div style={{ fontSize: "12px", color: "#4a5560", lineHeight: "1.5" }}>
{listaVazioTexto}
</div>
</div>
</>) : null}
</div>
</div>
{(paginacao) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "9px 14px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<label style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "#4a5560", marginRight: "auto" }}>
Por página
<select value={paginacao.porPagina} onChange={paginacao.mudarPorPagina} style={{ height: "28px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", padding: "0 6px" }}>
{(paginacao.opcoes ?? []).map((n: any) => (
<option key={n} value={n}>{n}</option>
))}
</select>
</label>
<span style={{ fontSize: "12px", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{paginacao.texto}
</span>
<button onClick={paginacao.anterior} disabled={!paginacao.temAnterior} style={estilo(paginacao.botaoStyle(!paginacao.temAnterior))}>
Anterior
</button>
<button onClick={paginacao.proxima} disabled={!paginacao.temProxima} style={estilo(paginacao.botaoStyle(!paginacao.temProxima))}>
Próxima
</button>
</div>
</>) : null}
</div>
</div>
</>) : null}
{(ehOutra) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px 16px 16px" }}>
{corpoOutro}
</div>
</>) : null}
</div>
{(temSelecao) ? (<>
<div data-of-massa="1" data-r="barra-massa" style={{ position: "fixed", bottom: "18px", left: "50%", transform: "translateX(-50%)", zIndex: "55", maxWidth: "calc(100vw - 28px)", animation: "of-rise .16s cubic-bezier(.2,0,.2,1) both" }}>
{(painelAberto) ? (<>
<div style={{ marginBottom: "8px", borderRadius: "10px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 10px 30px -6px rgba(0,0,0,.22)", padding: "4px", minWidth: "264px", animation: "of-rise .12s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "7px 8px 5px" }}>
{painelTitulo}
</div>
<div style={{ maxHeight: "250px", overflowY: "auto" }}>
{(painelOpcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", fontSize: "13.5px", lineHeight: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{o.label}
</span>
{(o.nota) ? (<>
<span style={{ flex: "0 0 auto", fontSize: "10.5px", fontWeight: "600", color: "#6e5420", background: "#f7edd8", borderRadius: "4px", padding: "2px 6px", whiteSpace: "nowrap" }}>
{o.nota}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#12171d", borderRadius: "11px", padding: "6px", boxShadow: "0 10px 30px -6px rgba(0,0,0,.34)", flexWrap: "wrap" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 8px 0 6px", flex: "0 0 auto" }}>
<span style={{ minWidth: "22px", height: "20px", paddingInline: "6px", borderRadius: "9999px", background: "#fe4f2b", color: "#fff", fontSize: "11px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{qtdSelecao}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "500", color: "#eeeff3", whiteSpace: "nowrap" }}>
{rotuloSelecao}
</span>
</span>
<span style={{ flex: "0 0 auto", width: "1px", height: "20px", background: "rgba(255,255,255,.14)", margin: "0 2px" }} />
{(acoesMassa ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={estilo(a.style)} className={[hover("background:rgba(255,255,255,.12)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={a.d} />
</svg>
<span style={{ whiteSpace: "nowrap" }}>
{a.label}
</span>
</button>
</Fragment>
))}
<span style={{ flex: "0 0 auto", width: "1px", height: "20px", background: "rgba(255,255,255,.14)", margin: "0 2px" }} />
<button onClick={limparSelecao} style={{ display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "8px", color: "#a9b2bc", flex: "0 0 auto" }} title="Limpar seleção · Esc" className={[hover("background:rgba(255,255,255,.12);color:#eeeff3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
</div>
</>) : null}

    </>
  );
}
