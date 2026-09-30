"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Pipeline.dc.html
 *
 * O markup é conversão MECÂNICA do desenho — não foi transcrito à mão, então
 * não há divergência de transcrição para procurar. Reveja a ligação com o
 * dado, não o estilo.
 *
 * Para regerar depois de um desenho novo, rode o conversor de novo e refaça só
 * a ligação. NÃO edite o markup aqui à mão: a próxima geração sobrescreve.
 */

import { Fragment } from "react";
import { estilo, foco, hover } from "./proto-runtime";
import "./PipelineDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDePipelineDesenho {
  arqRef: any;
  av: any;
  busca: any;
  colunas: any;
  d: any;
  ehLista: any;
  ehQuadro: any;
  exp: any;
  expRef: any;
  exportMenu: any;
  exportMenuStyle: any;
  fecharDrawer: any;
  fecharModal: any;
  filtros: any;
  grupos: any;
  m: any;
  naturezas: any;
  parar: any;
  recolhidas: any;
  reu: any;
  rv: any;
  setBusca: any;
  temDrawer: any;
  temModal: any;
  toggleExportMenu: any;
  visoes: any;
}

export function PipelineDesenho(vals: ValoresDePipelineDesenho) {
  const { arqRef, av, busca, colunas, d, ehLista, ehQuadro, exp, expRef, exportMenu, exportMenuStyle, fecharDrawer, fecharModal, filtros, grupos, m, naturezas, parar, recolhidas, reu, rv, setBusca, temDrawer, temModal, toggleExportMenu, visoes } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-r="toolbar" data-stagger="45" data-stagger-tipo="blur" style={{ flex: "0 0 auto", padding: "14px 14px 0", display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "34px", flex: "1 1 200px", maxWidth: "270px", minWidth: "140px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={busca} onChange={setBusca} placeholder="Empresa ou pessoa" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0" }} />
</div>
{(filtros ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div data-pl-filtro="1" style={{ position: "relative", flex: "0 0 auto" }}>
<div style={estilo(f.grupo)}>
<button onClick={f.abrir} style={estilo(f.corpo)} className={[hover(f.hover)].filter(Boolean).join(" ")}>
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
<span style={estilo(f.div)} />
<button onClick={f.abrir} title="Abrir opções" style={estilo(f.seta)} className={[hover(f.hover)].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={estilo(f.chev)}>
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
</div>
{(f.aberto) ? (<>
<div data-in="drop" style={{ position: "absolute", top: "calc(100% + 5px)", left: "0", minWidth: "220px", zIndex: "35", borderRadius: "10px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 10px 26px -6px rgba(0,0,0,.2),0 2px 4px -2px rgba(0,0,0,.1)", padding: "5px" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "6px 6px 4px" }}>
{f.titulo}
</div>
{(f.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(o.caixa)}>
{(o.on) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{o.label}
</span>
<span style={{ fontSize: "11px", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{o.n}
</span>
</button>
</Fragment>
))}
<div style={{ height: "1px", background: "#eef1f1", margin: "4px -5px" }} />
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
<div data-of-expmenu="1" ref={expRef} style={{ position: "relative", flex: "0 0 auto" }}>
<button onClick={toggleExportMenu} style={{ display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 11px 0 13px", borderRadius: "9px", background: "#d93c1a", fontSize: "13px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
<span>
Exportar
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", opacity: ".85" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
</div>
{(ehQuadro) ? (<>
<div data-r="board" style={{ flex: "1", minHeight: "0", overflowX: "auto", overflowY: "hidden", padding: "14px" }}>
<div data-stagger="90" data-stagger-tipo="curtain" data-delay="120" style={{ display: "flex", gap: "10px", alignItems: "stretch", height: "100%", minHeight: "0" }}>
{(colunas ?? []).map((col: any, i1: number) => (
<Fragment key={col?.id ?? col?.chave ?? i1}>
<section data-r="coluna" onDragOver={col.sobre} onDragLeave={col.sai} onDrop={col.solta} style={estilo(col.style)}>
<div style={{ flex: "0 0 auto", padding: "6px 6px 10px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(col.ponto)} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "-.01em", whiteSpace: "nowrap", color: "#12171d" }}>
{col.label}
</span>
{(col.temGate) ? (<>
<span title={col.gate} style={{ display: "inline-flex", color: "#8b949e" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
<rect x="4" y="11" width="16" height="10" rx="2" />
<path d="M8 11V7a4 4 0 0 1 8 0v4" />
</svg>
</span>
</>) : null}
<span style={{ flex: "1" }} />
<span style={{ fontSize: "12px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{col.conta}
</span>
{(col.recolhivel) ? (<>
<button onClick={col.fechar} title="Recolher coluna" style={{ width: "22px", height: "22px", borderRadius: "6px", display: "grid", placeItems: "center", color: "#4a5560", border: "0", background: "transparent", cursor: "pointer" }} className={[hover("background:#e3e7e8;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
</button>
</>) : null}
</div>
<div style={{ fontSize: "11.5px", color: "#67787c", marginTop: "3px", paddingLeft: "15px", fontVariantNumeric: "tabular-nums" }}>
{col.total}
</div>
</div>
<div data-stagger="70" data-stagger-tipo="spring" data-delay={col.atraso} data-stagger-filhos-tilt="7" style={{ flex: "1", minHeight: "56px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "2px 3px 8px", margin: "0 -3px" }}>
{(col.cards ?? []).map((k: any, i2: number) => (
<Fragment key={k?.id ?? k?.chave ?? i2}>
<div draggable={k.arrastavel} onDragStart={k.pega} onDragEnd={k.larga} onClick={k.abrir} tabIndex={0} style={estilo(k.style)}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontSize: "13.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.empresa}
</div>
<div style={{ fontSize: "11.5px", color: "#6d747e", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.pessoa}
</div>
{(k.temTipo) ? (<>
<span style={estilo(k.tipoStyle)}>
{k.tipo}
</span>
</>) : null}
</div>
<span style={estilo(k.famStyle)}>
{k.familia}
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "9px", minWidth: "0" }}>
<span style={estilo(k.propStyle)}>
<span style={estilo(k.propPonto)} />
<span>
{k.proposta}
</span>
</span>
<span style={{ flex: "1" }} />
{(k.temValor) ? (<>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{k.valorCurto}
</span>
</>) : null}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "10px", paddingTop: "9px", borderTop: "1px solid #f3f5f5" }}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "9999px", background: "#12171d", color: "#fff", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{k.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "11.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.resp}
</span>
<span title="Dias nesta etapa" style={estilo(k.diasStyle)}>
{k.dias}
</span>
</div>
</div>
</Fragment>
))}
{(col.vazia) ? (<>
<div style={{ padding: "16px 10px", textAlign: "center", fontSize: "11.5px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{col.vazio}
</div>
</>) : null}
</div>
</section>
</Fragment>
))}
{(recolhidas ?? []).map((rc: any, i1: number) => (
<Fragment key={rc?.id ?? rc?.chave ?? i1}>
<button onClick={rc.abrir} onDragOver={rc.sobre} onDragLeave={rc.sai} onDrop={rc.solta} title={rc.label} style={estilo(rc.style)}>
<span style={estilo(rc.ponto)} />
<span style={{ fontSize: "12px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{rc.conta}
</span>
<span style={{ writingMode: "vertical-rl", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12.5px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap" }}>
{rc.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
{(ehLista) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px 14px 16px" }}>
<div data-in="rise" style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "900px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.6fr) 118px 150px 150px 160px 72px", gap: "10px", padding: "8px 14px", background: "#fafafa", borderBottom: "1px solid #eef1f1", fontSize: "10.5px", fontWeight: "600", color: "#4a5560", letterSpacing: ".05em" }}>
<div>
EMPRESA · PESSOA
</div>
<div>
FAMÍLIA
</div>
<div>
VALOR
</div>
<div>
PROPOSTA
</div>
<div>
RESPONSÁVEL
</div>
<div style={{ textAlign: "right" }}>
NA ETAPA
</div>
</div>
{(grupos ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div>
<button onClick={g.alternar} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "9px 14px", background: "#fbfbfb", border: "0", borderBottom: "1px solid #eef1f1", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(g.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={estilo(g.ponto)} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12.5px", fontWeight: "700", color: "#12171d" }}>
{g.label}
</span>
<span style={{ minWidth: "19px", height: "18px", paddingInline: "5px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#4a5560", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{g.conta}
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{g.total}
</span>
</button>
{(g.aberto) ? (<>
<div data-stagger="36" data-stagger-tipo="swing">
{(g.linhas ?? []).map((r: any, i2: number) => (
<Fragment key={r?.id ?? r?.chave ?? i2}>
<div onClick={r.abrir} style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.6fr) 118px 150px 150px 160px 72px", gap: "10px", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f3f5f5", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.empresa}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.pessoa}
</span>
</span>
<span>
<span style={estilo(r.famStyle)}>
{r.familia}
</span>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{r.valorLinha}
</span>
{(r.temUnico) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{r.unico}
</span>
</>) : null}
</span>
<span>
<span style={estilo(r.propStyle)}>
<span style={estilo(r.propPonto)} />
<span>
{r.proposta}
</span>
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "9999px", background: "#12171d", color: "#fff", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{r.iniciais}
</span>
<span style={{ minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.resp}
</span>
</span>
<span style={estilo(r.diasStyle)}>
{r.dias}
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</div>
</div>
</div>
</>) : null}
{(temDrawer) ? (<>
<div data-in="fade" onClick={fecharDrawer} style={{ position: "fixed", inset: "0", zIndex: "40", background: "rgba(18,23,29,.16)" }} />
<aside data-r="drawer" data-in="slide-left" style={{ position: "fixed", top: "10px", right: "10px", bottom: "10px", width: "min(500px,calc(100vw - 20px))", zIndex: "41", background: "#fff", borderRadius: "14px", boxShadow: "0 0 0 1px #e3e7e8,0 30px 70px -20px rgba(18,23,29,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
{(d.menuAberto) ? (<>
<div onClick={d.fecharMenus} style={{ position: "absolute", inset: "0", zIndex: "5" }} />
</>) : null}
<div style={{ flex: "0 0 auto", padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "13px" }}>
<span style={{ flex: "0 0 auto", width: "52px", height: "52px", borderRadius: "12px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", display: "grid", placeItems: "center", letterSpacing: ".02em" }}>
{d.empIni}
</span>
<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "4px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", lineHeight: "1.2", textWrap: "pretty" }}>
{d.titulo}
</span>
<button onClick={d.abrirEmpresa} style={{ alignSelf: "flex-start", maxWidth: "100%", padding: "0", border: "0", background: "transparent", fontSize: "13.5px", color: "#67787c", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} className={[hover("color:#12171d")].filter(Boolean).join(" ")}>
{d.empresa}
</button>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
<span style={estilo(d.etapaChip)}>
<span style={estilo(d.etapaPonto)} />
<span>
{d.etapaLabel}
</span>
</span>
<span style={{ fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{d.diasTexto}
</span>
</div>
</div>
<div style={{ position: "relative", flex: "0 0 auto", display: "flex", gap: "2px", zIndex: "6" }}>
<button onClick={d.toggleMais} title="Mais ações" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M5 12h.01M12 12h.01M19 12h.01" />
</svg>
</button>
<button onClick={fecharDrawer} title="Fechar" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
{(d.maisAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", right: "0", zIndex: "6", minWidth: "220px", padding: "5px", borderRadius: "11px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 14px 34px -10px rgba(18,23,29,.3)", display: "flex", flexDirection: "column", gap: "1px" }}>
{(d.maisItens ?? []).map((mi: any, i1: number) => (
<Fragment key={mi?.id ?? mi?.chave ?? i1}>
<button onClick={mi.onClick} style={estilo(mi.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(mi.dot)} />
<span style={{ flex: "1", minWidth: "0" }}>
{mi.label}
</span>
{(mi.atual) ? (<>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<button onClick={d.registrar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap", flex: "1 1 0", minWidth: "0" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
</svg>
<span>
Registrar atividade
</span>
</button>
<span style={{ flex: "0 0 auto", width: "1px", height: "22px", background: "#e3e7e8" }} />
<button onClick={d.toggleEditar} style={estilo(d.editarStyle)} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
{d.editarLabel}
</span>
</button>
{(d.aberta) ? (<>
<div style={{ position: "relative", flex: "0 0 auto", display: "flex", zIndex: "6" }}>
<button onClick={d.avancar} title={d.avancarDica} style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "36px", padding: "0 12px", borderRadius: "9px 0 0 9px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#e8431f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
<span style={{ minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.avancarLabel}
</span>
</button>
<button onClick={d.toggleEtapas} title="Escolher etapa" style={{ flex: "0 0 auto", width: "34px", height: "36px", borderRadius: "0 9px 9px 0", border: "0", borderLeft: "1px solid rgba(255,255,255,.28)", background: "#fe4f2b", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#e8431f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(d.etapasAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", right: "0", zIndex: "6", minWidth: "220px", padding: "5px", borderRadius: "11px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 14px 34px -10px rgba(18,23,29,.3)", display: "flex", flexDirection: "column", gap: "1px" }}>
<span style={{ padding: "6px 9px 4px", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Mover para
</span>
{(d.etapasItens ?? []).map((ei: any, i1: number) => (
<Fragment key={ei?.id ?? ei?.chave ?? i1}>
<button onClick={ei.onClick} style={estilo(ei.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(ei.dot)} />
<span style={{ flex: "1", minWidth: "0" }}>
{ei.label}
</span>
{(ei.atual) ? (<>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</>) : null}
</div>
{(d.fechada) ? (<>
<div style={estilo(d.fechoStyle)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={d.fechoIco} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700" }}>
{d.fechoTitulo}
</span>
<span style={{ display: "block", fontSize: "12px", marginTop: "1px", opacity: ".85" }}>
{d.fechoSub}
</span>
</span>
<button onClick={d.reabrir} style={{ flex: "0 0 auto", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", fontSize: "12px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Reabrir
</button>
</div>
</>) : null}
</div>
<div data-stagger="55" data-stagger-tipo="rise" style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "4px 18px 22px", display: "flex", flexDirection: "column", gap: "20px" }}>
<section style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "14px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ display: "inline-flex", color: "#4a5560" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01" />
</svg>
</span>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Informações principais
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Etapa
</span>
<span style={estilo(d.etapaTexto)}>
<span style={estilo(d.etapaPonto)} />
<span>
{d.etapaLabel}
</span>
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Valor
</span>
<span style={estilo(d.valorStyle)}>
{d.valor}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Responsável
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "9999px", background: "linear-gradient(180deg,#f6f6f3,#eceeee)", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#1f252c", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{d.respIni}
</span>
{(d.editando) ? (<>
<select value={d.resp} onChange={d.setResp} style={{ height: "30px", padding: "0 10px", borderRadius: "9999px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#12171d", cursor: "pointer" }}>
{(d.equipe ?? []).map((eq: any, i1: number) => (
<Fragment key={eq?.id ?? eq?.chave ?? i1}>
<option value={eq}>
{eq}
</option>
</Fragment>
))}
</select>
</>) : null}
{(d.lendo) ? (<>
<span style={{ fontSize: "13.5px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.resp}
</span>
</>) : null}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Produto
</span>
<span style={{ display: "flex", minWidth: "0" }}>
{(d.editando) ? (<>
<select value={d.familia} onChange={d.setFamilia} style={{ height: "30px", padding: "0 10px", borderRadius: "9999px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#12171d", cursor: "pointer" }}>
{(d.familias ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<option value={fm.v}>
{fm.l}
</option>
</Fragment>
))}
</select>
</>) : null}
{(d.lendo) ? (<>
<span style={{ fontSize: "13.5px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.produto}
</span>
</>) : null}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px", padding: "3px 0" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Tags
</span>
<span style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", minWidth: "0" }}>
{(d.tags ?? []).map((tg: any, i1: number) => (
<Fragment key={tg?.id ?? tg?.chave ?? i1}>
<span style={estilo(tg.style)}>
{(tg.auto) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
</>) : null}
{tg.nome}
</span>
</Fragment>
))}
<button onClick={d.abrirTags} style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "24px", padding: "0 9px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Tag
</button>
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Previsão de fechamento
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0", color: "#4a5560" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
{(d.editando) ? (<>
<input type="date" value={d.previsao} onChange={d.setPrevisao} style={{ height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", color: "#12171d" }} />
</>) : null}
{(d.lendo) ? (<>
<span style={estilo(d.previsaoStyle)}>
{d.previsaoTexto}
</span>
</>) : null}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Origem
</span>
<span style={{ fontSize: "13.5px", color: "#12171d", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.origem}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Empresa vinculada
</span>
<button onClick={d.abrirEmpresa} style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0", padding: "0", border: "0", background: "transparent", color: "#c2330f", fontSize: "13.5px", fontWeight: "500", cursor: "pointer", textAlign: "left" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", color: "#4a5560" }}>
<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
</svg>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.empresa}
</span>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Contato principal
</span>
<button onClick={d.abrirPessoa} style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0", padding: "0", border: "0", background: "transparent", color: "#c2330f", fontSize: "13.5px", fontWeight: "500", cursor: "pointer", textAlign: "left" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", color: "#4a5560" }}>
<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
</svg>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.pessoa}
</span>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Origem da oportunidade
</span>
<span title="Como a oportunidade avança" style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0", fontSize: "13.5px", color: "#12171d" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", color: "#4a5560" }}>
<path d={d.viaIco} />
</svg>
<span>
{d.viaLabel}
</span>
</span>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: "8px", marginTop: "4px" }}>
{(d.canais ?? []).map((cn: any, i1: number) => (
<Fragment key={cn?.id ?? cn?.chave ?? i1}>
<button onClick={cn.onClick} title={cn.dica} style={estilo(cn.style)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={cn.d} />
</svg>
<span style={{ whiteSpace: "nowrap" }}>
{cn.label}
</span>
{(cn.temSelo) ? (<>
<span title="Reunião agendada" style={{ flex: "0 0 auto", width: "7px", height: "7px", borderRadius: "9999px", background: "#fe4f2b" }} />
</>) : null}
</button>
</Fragment>
))}
</div>
</section>
<section style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "14px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<button onClick={d.toggleProx} style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "8px", height: "28px", padding: "0", border: "0", background: "transparent", cursor: "pointer", color: "#4a5560", textAlign: "left" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(d.proxChev)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".08em", textTransform: "uppercase" }}>
Próxima ação
</span>
</button>
</div>
{(d.proxAberta) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "36px" }}>
{(d.temProx) ? (<>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "24px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>
{d.prox.tipo}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "14px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.prox.texto}
</span>
<button onClick={d.prox.ver} style={{ flex: "0 0 auto", height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Ver
</button>
</>) : null}
{(d.semProx) ? (<>
<span style={{ flex: "1", minWidth: "0", fontSize: "13.5px", fontWeight: "500", color: "#c2330f" }}>
Nenhuma ação agendada
</span>
</>) : null}
<button onClick={d.registrar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova
</span>
</button>
</div>
</>) : null}
</section>
<section style={{ display: "flex", flexDirection: "column", paddingTop: "16px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Atividades
</span>
<button onClick={d.registrar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova atividade
</span>
</button>
</div>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "#eeeff3", marginBottom: "10px", width: "fit-content" }}>
{(d.atvFiltros ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(d.atvs ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.ver} title="Ver atividade" style={estilo(a.linhaStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(a.marca)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.meta}
</span>
</span>
<span style={estilo(a.seloStyle)}>
{a.situacao}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", minWidth: "64px", textAlign: "right" }}>
{a.quando}
</span>
</button>
</Fragment>
))}
{(d.semAtvs) ? (<>
<div style={{ padding: "14px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#67787c" }}>
{d.atvVaziaTitulo}
</div>
</>) : null}
{(d.atvMais) ? (<>
<button onClick={d.atvAlternar} style={{ alignSelf: "flex-start", marginTop: "6px", height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
{d.atvLabel}
</button>
</>) : null}
</div>
</section>
<section style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "14px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<button onClick={d.toggleTl} style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "8px", height: "28px", padding: "0", border: "0", background: "transparent", cursor: "pointer", color: "#4a5560", textAlign: "left" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(d.tlChev)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".08em", textTransform: "uppercase" }}>
Timeline
</span>
</button>
{(d.tlMais) ? (<>
<button onClick={d.tlAlternar} style={{ flex: "0 0 auto", height: "28px", padding: "0 4px", border: "0", background: "transparent", fontSize: "13px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
{d.tlLabel}
</button>
</>) : null}
</div>
{(d.tlAberta) ? (<>
<div style={{ display: "flex", flexDirection: "column", paddingTop: "4px" }}>
{(d.timeline ?? []).map((tl: any, i1: number) => (
<Fragment key={tl?.id ?? tl?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "82px 14px minmax(0,1fr)", columnGap: "12px" }}>
<span style={{ fontSize: "12.5px", color: "#67787c", textAlign: "right", paddingTop: "2px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{tl.hora}
</span>
<span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
<span style={estilo(tl.dot)} />
<span style={estilo(tl.linha)} />
</span>
<span style={{ minWidth: "0", paddingBottom: "14px" }}>
<span style={{ display: "block", fontSize: "14px", color: "#12171d", lineHeight: "1.35", textWrap: "pretty" }}>
{tl.t}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#67787c", marginTop: "3px" }}>
{tl.autor}
</span>
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
</section>
<section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", gap: "2px", borderBottom: "1px solid #e3e7e8", overflowX: "auto", scrollbarWidth: "none" }}>
{(d.abas ?? []).map((ab: any, i1: number) => (
<Fragment key={ab?.id ?? ab?.chave ?? i1}>
<button onClick={ab.onClick} style={estilo(ab.style)} className={[hover("color:#12171d")].filter(Boolean).join(" ")}>
<span>
{ab.label}
</span>
{(ab.temN) ? (<>
<span style={estilo(ab.nStyle)}>
{ab.n}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
{(d.abaArq) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(d.arquivos ?? []).map((aq: any, i1: number) => (
<Fragment key={aq?.id ?? aq?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "9px 10px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#fdeeea", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{aq.nome}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "1px" }}>
{aq.meta}
</span>
</span>
</div>
</Fragment>
))}
{(d.semArq) ? (<>
<div style={{ padding: "14px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "13px", color: "#67787c" }}>
Nenhum arquivo. Propostas geradas aparecem aqui.
</div>
</>) : null}
<input ref={arqRef} type="file" multiple={true} onChange={d.anexou} style={{ display: "none" }} />
<button onClick={d.anexar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "32px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap", alignSelf: "flex-start" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
</svg>
<span>
Anexar arquivo
</span>
</button>
</div>
</>) : null}
{(d.abaProp) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
<div style={{ display: "flex", alignItems: "center" }}>
<span style={{ flex: "1", fontSize: "13px", color: "#67787c" }}>
{d.propTitulo}
</span>
<button onClick={d.novaProposta} style={{ display: "flex", alignItems: "center", gap: "4px", height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
{d.novaPropTxt}
</span>
</button>
</div>
{(d.semProposta) ? (<>
<div style={{ padding: "14px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{d.semPropostaTexto}
</div>
</>) : null}
{(d.propostas ?? []).map((pr: any, i1: number) => (
<Fragment key={pr?.id ?? pr?.chave ?? i1}>
<div style={{ borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "4px 8px" }}>
<button onClick={pr.alternar} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "8px 4px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", borderRadius: "8px" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(pr.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={estilo(pr.codStyle)}>
{pr.codigo}
</span>
<span style={estilo(pr.statusStyle)}>
{pr.status}
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "12.5px", color: "#4a5560", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pr.total}
</span>
</button>
{(pr.aberta) ? (<>
<div style={{ margin: "2px 4px 0 26px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
{(pr.itens ?? []).map((it: any, i2: number) => (
<Fragment key={it?.id ?? it?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "3px 0" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.nome}
</span>
<span style={{ fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{it.natureza}
</span>
<span style={{ fontSize: "12.5px", color: "#4a5560", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.valor}
</span>
</div>
</Fragment>
))}
<div style={{ height: "1px", background: "#e3e7e8", margin: "8px 0" }} />
<div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
<span style={{ flex: "1", fontSize: "12px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{pr.rec}
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{pr.totalLinha}
</span>
</div>
<div style={{ fontSize: "11.5px", color: "#8b949e", marginTop: "6px" }}>
{pr.meta}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", margin: "8px 4px 6px 26px" }}>
{(pr.acoes ?? []).map((pa: any, i2: number) => (
<Fragment key={pa?.id ?? pa?.chave ?? i2}>
<button onClick={pa.onClick} style={estilo(pa.style)}>
{pa.label}
</button>
</Fragment>
))}
<span style={{ flex: "1" }} />
<button onClick={pr.verCompleta} style={{ height: "28px", padding: "0 8px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Ver proposta completa
</button>
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</>) : null}
{(d.abaProd) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(d.produtos ?? []).map((pd: any, i1: number) => (
<Fragment key={pd?.id ?? pd?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 12px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pd.nome}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "1px" }}>
{pd.natureza}
</span>
</span>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pd.valor}
</span>
</div>
</Fragment>
))}
{(d.temProdutos) ? (<>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "4px 12px 0" }}>
<span style={{ flex: "1", fontSize: "12.5px", color: "#67787c" }}>
{d.prodRec}
</span>
<span style={{ fontSize: "13.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{d.prodTotal}
</span>
</div>
</>) : null}
{(d.semProdutos) ? (<>
<div style={{ padding: "14px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "13px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
Os produtos entram pela proposta. Crie uma na aba Propostas.
</div>
</>) : null}
</div>
</>) : null}
</section>
<section style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "16px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ display: "inline-flex", color: "#4a5560" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
</svg>
</span>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Relacionamentos
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "10px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Empresa
</span>
<button onClick={d.abrirEmpresa} style={{ display: "flex", alignItems: "center", gap: "11px", minWidth: "0", padding: "11px", borderRadius: "11px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "10px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{d.empIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.empresa}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.empSub}
</span>
</span>
<span style={{ display: "inline-flex", color: "#8b949e" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
</svg>
</span>
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Contato principal
</span>
<button onClick={d.abrirPessoa} style={{ display: "flex", alignItems: "center", gap: "11px", minWidth: "0", padding: "11px", borderRadius: "11px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "9999px", background: "linear-gradient(180deg,#f6f6f3,#eceeee)", color: "#1f252c", boxShadow: "inset 0 0 0 1px #e3e7e8", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{d.pesIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.pessoa}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.cargo}
</span>
</span>
<span style={{ display: "inline-flex", color: "#8b949e" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
</svg>
</span>
</button>
</div>
</div>
</section>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fff", display: "flex", gap: "8px" }}>
<button onClick={d.abrirOpp} style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
</svg>
<span>
Abrir oportunidade
</span>
</button>
</div>
</aside>
</>) : null}
{(exportMenu) ? (<>
<div data-of-expmenu="1" style={estilo(exportMenuStyle)}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "7px 8px 5px" }}>
EXPORTAR
</div>
<button onClick={exp.abrirVisao} style={{ display: "flex", alignItems: "flex-start", gap: "9px", width: "100%", padding: "8px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", color: "#1f252c" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M3 3h18v18H3zM3 9h18M9 21V9" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", lineHeight: "1.35" }}>
Exportar esta visão
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4", marginTop: "1px", textWrap: "pretty" }}>
{exp.resumoVisao}
</span>
</span>
</button>
<button onClick={exp.abrirEtapa} style={{ display: "flex", alignItems: "flex-start", gap: "9px", width: "100%", padding: "8px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", color: "#1f252c" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", lineHeight: "1.35" }}>
Oportunidades de uma etapa
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4", marginTop: "1px", textWrap: "pretty" }}>
Escolha a etapa e ajuste as colunas
</span>
</span>
</button>
<button onClick={exp.abrirCriterios} style={{ display: "flex", alignItems: "flex-start", gap: "9px", width: "100%", padding: "8px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", color: "#1f252c" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M22 3H2l8 9.5V19l4 2v-8.5z" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", lineHeight: "1.35" }}>
Escolher critérios
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4", marginTop: "1px", textWrap: "pretty" }}>
Etapas, closer, produto, proposta, colunas e formato
</span>
</span>
</button>
</div>
</>) : null}
{(exp.aberto) ? (<>
<div data-r="modal-fundo" onClick={exp.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "54", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "520px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "13px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
<div style={{ flex: "0 0 auto", padding: "15px 18px 13px", borderBottom: "1px solid #e3e7e8", display: "flex", alignItems: "flex-start", gap: "10px" }}>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", marginBottom: "3px" }}>
Exportar oportunidades
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
Gera uma planilha com as oportunidades que atendem aos critérios abaixo.
</div>
</div>
<button onClick={exp.fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", border: "0", background: "transparent", cursor: "pointer", borderRadius: "8px", display: "grid", placeItems: "center", color: "#4a5560" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "7px" }}>
Escopo
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
{(exp.escopos ?? []).map((e: any, i1: number) => (
<Fragment key={e?.id ?? e?.chave ?? i1}>
<button onClick={e.onClick} style={estilo(e.style)}>
<span style={estilo(e.radio)} />
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{e.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4", textWrap: "pretty" }}>
{e.nota}
</span>
</span>
<span style={{ flex: "0 0 auto", fontSize: "12px", fontWeight: "700", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{e.conta}
</span>
</button>
</Fragment>
))}
</div>
</div>
{(exp.mostraFiltros) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
{(exp.grupos ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560" }}>
{g.titulo}
</span>
{(g.ativo) ? (<>
<button onClick={g.limpar} style={{ fontSize: "11px", fontWeight: "500", color: "#c2330f", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("color:#9c3210")].filter(Boolean).join(" ")}>
limpar
</button>
</>) : null}
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(g.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
</Fragment>
))}
</div>
</>) : null}
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "7px" }}>
Colunas da planilha
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(exp.colunas ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<button onClick={c.onClick} style={estilo(c.style)}>
<span style={estilo(c.caixa)}>
{(c.on) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span>
{c.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "7px" }}>
Formato
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(exp.formatos ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<button onClick={f.onClick} style={estilo(f.style)}>
{f.label}
</button>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "9px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", lineHeight: "1.4", textWrap: "pretty" }}>
<strong style={{ fontWeight: "700" }}>
{exp.total}
</strong>
 {exp.totalLabel}
</span>
<button onClick={exp.fechar} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", border: "0", cursor: "pointer", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={exp.gerar} style={estilo(exp.gerarStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
<span>
{exp.gerarLabel}
</span>
</button>
</div>
</div>
</div>
</>) : null}

{(av.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={av.fechar} style={{ position: "fixed", inset: "0", zIndex: "62", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={av.parar} style={{ width: "min(460px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "14px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "15px 18px 13px", borderBottom: "1px solid #e3e7e8", display: "flex", alignItems: "flex-start", gap: "10px" }}>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", flexWrap: "wrap" }}>
<span style={estilo(av.situacaoSelo)}>
{av.situacao}
</span>
<span style={estilo(av.tipoSelo)}>
{av.tipo}
</span>
</div>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15.5px", fontWeight: "700", letterSpacing: "-.012em", lineHeight: "1.3", marginBottom: "3px", textWrap: "pretty", color: "#12171d" }}>
{av.tituloVisto}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{av.contexto}
</div>
</div>
<button onClick={av.fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", display: "grid", placeItems: "center", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "15px" }}>
{(av.ehVer) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M8 2v4M16 2v4M3 8h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
</svg>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "2px" }}>
Quando
</div>
<div style={{ fontSize: "13px", fontWeight: "500", color: "#12171d" }}>
{av.quando}
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "2px" }}>
Responsável
</div>
<div style={{ fontSize: "13px", fontWeight: "500", color: "#12171d" }}>
{av.resp}
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M4 6h16M4 12h16M4 18h10" />
</svg>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "3px" }}>
Descrição
</div>
<div style={estilo(av.descStyle)}>
{av.descVista}
</div>
</div>
</div>
</div>
</>) : null}
{(av.ehEditar) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Situação
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(av.situacoes ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<button onClick={s.onClick} style={estilo(s.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={s.d} />
</svg>
<span>
{s.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Tipo
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(av.tipos ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={t.d} />
</svg>
<span>
{t.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Título
</div>
<input value={av.titulo} onChange={av.setTitulo} placeholder="O que precisa ser feito" style={estilo(av.tituloInp)} />
{(av.tituloErro) ? (<>
<div style={{ marginTop: "5px", fontSize: "11.5px", fontWeight: "600", color: "#c2330f" }}>
Dê um título para a atividade.
</div>
</>) : null}
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Descrição
</div>
<textarea value={av.desc} onChange={av.setDesc} rows={3} placeholder="Contexto, roteiro da ligação, o que combinar" style={{ width: "100%", padding: "9px 11px", borderRadius: "8px", background: "#fff", border: "1px solid #dbdede", outline: "0", fontSize: "13px", lineHeight: "1.5", resize: "vertical", fontFamily: "inherit" }} />
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 118px", gap: "9px" }}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Data
</div>
<input value={av.data} onChange={av.setData} type="date" style={{ width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", background: "#fff", border: "1px solid #dbdede", outline: "0", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Hora
</div>
<input value={av.hora} onChange={av.setHora} type="time" style={{ width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", background: "#fff", border: "1px solid #dbdede", outline: "0", fontSize: "13px" }} />
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Responsável
</div>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "7px", width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", cursor: "pointer" }}>
<span style={{ flex: "0 0 auto", width: "20px", height: "20px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "700" }}>
{av.respIniciais}
</span>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{av.resp}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={av.resp} onChange={av.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(av.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
</div>
</>) : null}
</div>
{(av.ehVer) ? (<>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap" }}>
<button onClick={av.concluir} style={estilo(av.concluirStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
<span>
{av.concluirLabel}
</span>
</button>
<button onClick={av.declinar} style={estilo(av.declinarStyle)}>
{av.declinarLabel}
</button>
<span style={{ flex: "1", minWidth: "0" }} />
<button onClick={av.editar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
</svg>
<span>
Editar
</span>
</button>
</div>
</>) : null}
{(av.ehEditar) ? (<>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
<button onClick={av.cancelarEdicao} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={av.salvar} style={{ height: "34px", padding: "0 15px", borderRadius: "8px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Salvar
</button>
</div>
</>) : null}
</div>
</div>
</>) : null}
{(rv.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={rv.fechar} style={{ position: "fixed", inset: "0", zIndex: "63", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={rv.parar} style={{ width: "min(580px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "20px 22px 16px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "42px", height: "42px", borderRadius: "11px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", textWrap: "balance" }}>
{rv.titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", color: "#67787c" }}>
{rv.sub}
</span>
</span>
<button onClick={rv.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px 18px", flexWrap: "wrap", marginTop: "16px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "600", color: "#12171d" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span>
{rv.dataTxt}
</span>
<span style={{ fontWeight: "500", color: "#4a5560" }}>
{rv.horaTxt}
</span>
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 10px", borderRadius: "9999px", background: "#eeeff3", fontSize: "12px", fontWeight: "600", color: "#1f252c" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={rv.formatoD} />
</svg>
{rv.formato}
</span>
</div>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "11.5px", color: "#1f7256" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{rv.sync}
</span>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "0 22px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
{(rv.temLink) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "12px 14px", borderRadius: "12px", background: "#12171d", color: "#fff" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "rgba(255,255,255,.1)", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="m22 8-6 4 6 4V8zM2 6h14v12H2z" />
</svg>
</span>
<span style={{ flex: "1 1 180px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700" }}>
Microsoft Teams
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#a3aab0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rv.linkCurto}
</span>
</span>
<button onClick={rv.copiar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:rgba(255,255,255,.18)")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 9h11v11H9zM5 15H4V4h11v1" />
</svg>
Copiar
</button>
<button onClick={rv.entrar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Entrar na reunião
</button>
</div>
</>) : null}
{(rv.temLocal) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={rv.formatoD} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e" }}>
{rv.localL}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{rv.localV}
</span>
</span>
</div>
</>) : null}
<div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
<span style={{ fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Participantes
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rv.rsResumo}
</span>
<button onClick={rv.abrirAdd} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Incluir
</button>
</div>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#fafafa" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "700" }}>
{rv.orgIni}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{rv.organizador}
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
Organizador
</span>
</div>
{(rv.part ?? []).map((pt: any, i1: number) => (
<Fragment key={pt?.id ?? pt?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", boxShadow: "inset 0 1px 0 #f1f3f3" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "700" }}>
{pt.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pt.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pt.email}
</span>
</span>
<span style={estilo(pt.stStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
<path d={pt.d} />
</svg>
{pt.st}
</span>
{(pt.removivel) ? (<>
<button onClick={pt.remover} title="Remover do convite" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</>) : null}
</div>
</Fragment>
))}
{(rv.addAberto) ? (<>
<div style={{ display: "flex", gap: "8px", padding: "10px 12px", boxShadow: "inset 0 1px 0 #f1f3f3", background: "#fafafa" }}>
<input value={rv.add} onChange={rv.setAdd} onKeyDown={rv.teclaAdd} type="email" placeholder="email@empresa.com.br" autoFocus={true} style={estilo(rv.addInp)} />
<button onClick={rv.confirmaAdd} style={{ flex: "0 0 auto", height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>
Enviar convite
</button>
</div>
</>) : null}
</div>
{(rv.addErro) ? (<>
<span style={{ display: "block", marginTop: "6px", fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
E-mail inválido.
</span>
</>) : null}
</div>
{(rv.temPauta) ? (<>
<div>
<span style={{ display: "block", marginBottom: "6px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Pauta
</span>
<span style={{ display: "block", fontSize: "13.5px", color: "#1f252c", lineHeight: "1.55", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
{rv.pauta}
</span>
</div>
</>) : null}
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Situação
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(rv.sits ?? []).map((st: any, i1: number) => (
<Fragment key={st?.id ?? st?.chave ?? i1}>
<button onClick={st.onClick} style={estilo(st.style)}>
{st.label}
</button>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={rv.fechar} style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Fechar
</button>
<button onClick={rv.editar} style={{ display: "flex", alignItems: "center", gap: "7px", height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
</svg>
Editar ou reagendar
</button>
</div>
</div>
</div>
</>) : null}
{(reu.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={reu.fechar} style={{ position: "fixed", inset: "0", zIndex: "64", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={reu.parar} style={{ width: "min(560px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "20px 22px 16px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "11px", background: "#e6f4ee", color: "#1f7256", boxShadow: "inset 0 0 0 1px #c9e5d8", display: "grid", placeItems: "center" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{reu.tituloModal}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", color: "#4a5560" }}>
A reunião entra na agenda do closer e nas atividades da oportunidade.
</span>
</span>
<button onClick={reu.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "14px", padding: "11px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: "700" }}>
{reu.iniE}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.empresa}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.sub}
</span>
</span>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "24px", padding: "0 9px", borderRadius: "7px", background: "#fff6f4", color: "#c2330f", fontSize: "12px", fontWeight: "600" }}>
{reu.familia}
</span>
</div>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "18px 22px 20px", display: "flex", flexDirection: "column", gap: "18px" }}>
<div style={{ padding: "12px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: "700" }}>
{reu.iniP}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{reu.pessoa}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.email}
</span>
</span>
<button onClick={reu.abrirAdd} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Convidado
</span>
</button>
</div>
{(reu.temConv) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(reu.conv ?? []).map((cv: any, i1: number) => (
<Fragment key={cv?.id ?? cv?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 6px 0 10px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#1f252c" }}>
{cv.email}
<button onClick={cv.remover} title="Remover" style={{ width: "18px", height: "18px", borderRadius: "9999px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
</div>
</>) : null}
{(reu.addAberto) ? (<>
<div style={{ display: "flex", gap: "8px" }}>
<input value={reu.novoConv} onChange={reu.setNovo} onKeyDown={reu.teclaConv} type="email" placeholder="email@empresa.com.br" autoFocus={true} style={estilo(reu.convInp)} />
<button onClick={reu.addConv} style={{ flex: "0 0 auto", height: "42px", padding: "0 14px", borderRadius: "10px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
Adicionar
</button>
</div>
{(reu.convErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
E-mail inválido.
</span>
</>) : null}
</>) : null}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "16px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Data
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input type="date" value={reu.data} onChange={reu.setData} style={estilo(reu.dataInp)} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Horário
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input type="time" value={reu.hora} onChange={reu.setHora} step={900} style={estilo(reu.horaInp)} />
</label>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Duração
</span>
<div style={{ display: "flex", gap: "8px" }}>
{(reu.duracoes ?? []).map((du: any, i1: number) => (
<Fragment key={du?.id ?? du?.chave ?? i1}>
<button onClick={du.onClick} style={estilo(du.style)}>
{du.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Closer
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "42px", padding: "0 12px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "14px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.closer}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={reu.closer} onChange={reu.setCloser} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(reu.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
</div>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Tipo
</span>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{(reu.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={estilo(tp.style)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={tp.d} />
</svg>
<span>
{tp.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
{(reu.ehPresencial) ? (<>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Local
</span>
<input value={reu.local} onChange={reu.setLocal} placeholder="Endereço ou sala" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", fontSize: "14px", color: "#12171d", boxShadow: "inset 0 0 0 1px #dbdede" }} />
</label>
</>) : null}
{(reu.ehVideo) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#f6f6f3", fontSize: "12.5px", color: "#4a5560" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
{reu.linkTxt}
</span>
</span>
</>) : null}
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Título
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input value={reu.titulo} onChange={reu.setTitulo} style={estilo(reu.tituloInp)} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Pauta
</span>
<textarea value={reu.pauta} onChange={reu.setPauta} rows={3} placeholder="O que vai ser discutido, materiais, próximos passos esperados" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", lineHeight: "1.5", color: "#12171d" }} />
</label>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "14px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<span style={{ flex: "1 1 180px", minWidth: "0", display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", color: "#4a5560" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.resumo}
</span>
</span>
<button onClick={reu.fechar} style={{ flex: "0 0 auto", height: "42px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={reu.salvar} style={estilo(reu.salvarStyle)}>
{reu.salvarTxt}
</button>
</div>
</div>
</div>
</>) : null}
{(temModal) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fecharModal} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(500px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "14px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 0" }}>
<span style={estilo(m.icoStyle)}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={m.d} />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
{m.titulo}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "2px", textWrap: "pretty" }}>
{m.sub}
</div>
</div>
<button onClick={fecharModal} title="Fechar" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflow: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
{(m.temResumo) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(m.resumo ?? []).map((rs: any, i1: number) => (
<Fragment key={rs?.id ?? rs?.chave ?? i1}>
<div style={estilo(rs.style)}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{rs.valor}
</div>
<div style={{ fontSize: "11px", color: "#67787c", marginTop: "2px" }}>
{rs.label}
</div>
</div>
</Fragment>
))}
</div>
</>) : null}
{(m.temAviso) ? (<>
<div style={estilo(m.avisoStyle)}>
{m.aviso}
</div>
</>) : null}
{(m.temVer) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d", textWrap: "pretty" }}>
{m.ver.titulo}
</div>
<div style={estilo(m.ver.descStyle)}>
{m.ver.desc}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "10px", paddingTop: "10px", borderTop: "1px solid #eef1f1" }}>
{(m.ver.meta ?? []).map((vm: any, i1: number) => (
<Fragment key={vm?.id ?? vm?.chave ?? i1}>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "11px", color: "#67787c" }}>
{vm.label}
</div>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{vm.valor}
</div>
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
{(m.grupos ?? []).map((gp: any, i1: number) => (
<Fragment key={gp?.id ?? gp?.chave ?? i1}>
<div>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
{gp.label}
{(gp.obrig) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(gp.opcoes ?? []).map((op: any, i2: number) => (
<Fragment key={op?.id ?? op?.chave ?? i2}>
<button onClick={op.onClick} style={estilo(op.style)}>
{op.label}
</button>
</Fragment>
))}
</div>
{(gp.temErro) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "5px" }}>
{gp.erro}
</span>
</>) : null}
</div>
</Fragment>
))}
{(m.temItens) ? (<>
<div>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Itens
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(m.itens ?? []).map((mi: any, i1: number) => (
<Fragment key={mi?.id ?? mi?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) 92px 50px 30px", gap: "6px" }}>
<input value={mi.nome} onChange={mi.setNome} placeholder="Ex: Callface AI · Full" style={estilo(mi.nomeStyle)} />
<select value={mi.natureza} onChange={mi.setNat} style={{ minWidth: "0", height: "34px", padding: "0 8px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d", cursor: "pointer" }}>
{(naturezas ?? []).map((na: any, i2: number) => (
<Fragment key={na?.id ?? na?.chave ?? i2}>
<option value={na.v}>
{na.l}
</option>
</Fragment>
))}
</select>
<input value={mi.valor} onChange={mi.setValor} placeholder="R$" inputMode="decimal" style={estilo(mi.valorStyle)} />
<input value={mi.qtd} onChange={mi.setQtd} placeholder="Qtd" inputMode="numeric" style={{ minWidth: "0", height: "34px", padding: "0 6px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d", textAlign: "center" }} />
<button onClick={mi.remover} title="Remover" style={{ width: "30px", height: "34px", borderRadius: "8px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
<button onClick={m.addItem} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar item
</span>
</button>
</div>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "8px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "1", fontSize: "12px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{m.itensRec}
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{m.itensTotal}
</span>
</div>
</div>
</>) : null}
{(m.campos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<label style={{ display: "block" }}>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
{c.label}
{(c.obrig) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
{(c.longo) ? (<>
<textarea value={c.valor} onChange={c.set} placeholder={c.dica} rows={3} style={estilo(c.style)} />
</>) : null}
{(c.curto) ? (<>
<input value={c.valor} onChange={c.set} placeholder={c.dica} style={estilo(c.style)} />
</>) : null}
{(c.temErro) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "4px" }}>
{c.erro}
</span>
</>) : null}
</label>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", boxShadow: "inset 0 1px 0 #eef1f1", flexWrap: "wrap" }}>
<button onClick={fecharModal} style={{ height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
{m.cancelarLabel}
</button>
{(m.temSecundario) ? (<>
<button onClick={m.secundario} style={{ height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #12171d", fontSize: "12.5px", fontWeight: "600", color: "#12171d", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
{m.secundarioLabel}
</button>
</>) : null}
<button onClick={m.salvar} style={estilo(m.salvarStyle)}>
{m.salvarLabel}
</button>
</div>
</div>
</div>
</>) : null}
</div>


    </>
  );
}
