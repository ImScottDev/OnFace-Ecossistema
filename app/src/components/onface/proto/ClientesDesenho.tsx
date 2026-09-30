"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Clientes.dc.html
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
import "./ClientesDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeClientesDesenho {
  abrirNexo: any;
  busca: any;
  cresc: any;
  dr: any;
  evo: any;
  hero: any;
  insights: any;
  menu: any;
  nc: any;
  nc2: any;
  nx: any;
  pagRef: any;
  parar: any;
  row3a: any;
  semInsight: any;
  setBusca: any;
  tab: any;
  tick: any;
  topProd: any;
}

export function ClientesDesenho(vals: ValoresDeClientesDesenho) {
  const { abrirNexo, busca, cresc, dr, evo, hero, insights, menu, nc, nc2, nx, pagRef, parar, row3a, semInsight, setBusca, tab, tick, topProd } = vals;
  return (
    <>
<div ref={pagRef} style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: "14px 14px 18px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<div data-in="rise" style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "{{ hero.cols }}", gap: "24px", padding: "22px 24px", borderRadius: "18px", background: "#12171d", color: "#fff", boxShadow: "0 1px 2px rgba(12,16,21,.12)" }}>
<span style={{ position: "absolute", left: "30%", top: "-120px", width: "420px", height: "260px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".1", filter: "blur(70px)", pointerEvents: "none" }} />
<div style={{ position: "relative", minWidth: "0", display: "flex", flexDirection: "column" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e", whiteSpace: "nowrap" }}>
Receita recorrente
</span>
<span style={{ display: "block", marginTop: "10px", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(32px,3.4vw,42px)", fontWeight: "800", letterSpacing: "-.045em", lineHeight: "1", fontVariantNumeric: "tabular-nums" }}>
{hero.mrr}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
<span style={estilo(hero.dStyle)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
<path d={hero.dIco} />
</svg>
{hero.dt}
</span>
<span style={{ fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{hero.dTxt}
</span>
</span>
<span style={{ display: "block", marginTop: "auto", paddingTop: "18px", fontSize: "12.5px", color: "#a3aab0", lineHeight: "1.5" }}>
{hero.resumo}
</span>
</div>
<div onMouseLeave={evo.sair} style={{ position: "relative", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px 12px" }}>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "rgba(255,255,255,.06)" }}>
{(evo.pers ?? []).map((ep: any, i1: number) => (
<Fragment key={ep?.id ?? ep?.chave ?? i1}>
<button onClick={ep.onClick} style={estilo(ep.style)}>
{ep.l}
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1" }} />
{(evo.legenda ?? []).map((lg: any, i1: number) => (
<Fragment key={lg?.id ?? lg?.chave ?? i1}>
<button onClick={lg.onClick} style={estilo(lg.st)}>
<span style={estilo(lg.dot)} />
{lg.l}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "8px" }}>
<div style={{ flex: "0 0 auto", width: "44px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "170px", marginTop: "-5px" }}>
{(evo.eixo ?? []).map((ex: any, i1: number) => (
<Fragment key={ex?.id ?? ex?.chave ?? i1}>
<span style={{ fontSize: "10.5px", lineHeight: "10px", color: "#67787c", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
{ex.l}
</span>
</Fragment>
))}
</div>
<div style={{ position: "relative", flex: "1", minWidth: "0" }}>
<div style={{ position: "relative", height: "170px", backgroundImage: "linear-gradient(#1f252c 1px,transparent 1px)", backgroundSize: "100% 42.5px", boxShadow: "inset 0 -1px 0 #2a3139" }}>
<svg viewBox="0 0 1000 220" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "170px", overflow: "visible", pointerEvents: "none" }}>
<defs>
{(evo.camadas ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<linearGradient id={cm.gid} x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor={cm.cor} stopOpacity=".42" />
<stop offset="1" stopColor={cm.cor} stopOpacity=".02" />
</linearGradient>
</Fragment>
))}
</defs>
{(evo.camadas ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<path d={cm.area} fill={cm.fill} />
</Fragment>
))}
{(evo.camadas ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<path d={cm.linha} fill="none" stroke={cm.cor} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
</Fragment>
))}
</svg>
<div style={{ position: "absolute", inset: "0", display: "flex" }}>
{(evo.cols ?? []).map((co: any, i1: number) => (
<Fragment key={co?.id ?? co?.chave ?? i1}>
<div onMouseEnter={co.entrar} style={{ flex: "1", minWidth: "0", height: "100%", cursor: "crosshair" }} />
</Fragment>
))}
</div>
{(evo.temDica) ? (<>
<span style={estilo(evo.guia)} />
{(evo.pts ?? []).map((pt: any, i1: number) => (
<Fragment key={pt?.id ?? pt?.chave ?? i1}>
<span style={estilo(pt.st)} />
</Fragment>
))}
<div style={estilo(evo.dicaPos)}>
<span style={{ display: "block", fontSize: "10.5px", color: "#8b949e" }}>
{evo.dicaT}
</span>
{(evo.dicaL ?? []).map((dl: any, i1: number) => (
<Fragment key={dl?.id ?? dl?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "12px", color: "#d7dbde", whiteSpace: "nowrap" }}>
<span style={estilo(dl.dot)} />
{dl.l}
<strong style={{ marginLeft: "auto", paddingLeft: "12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", color: "#fff", fontVariantNumeric: "tabular-nums" }}>
{dl.v}
</strong>
</span>
</Fragment>
))}
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #2a3139", fontSize: "12px", color: "#d7dbde", whiteSpace: "nowrap" }}>
Total
<strong style={{ marginLeft: "auto", paddingLeft: "12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", color: "#fff", fontVariantNumeric: "tabular-nums" }}>
{evo.dicaTot}
</strong>
</span>
</div>
</>) : null}
</div>
<div style={{ position: "relative", height: "16px", marginTop: "7px" }}>
{(evo.rot ?? []).map((rt: any, i1: number) => (
<Fragment key={rt?.id ?? rt?.chave ?? i1}>
<span style={estilo(rt.st)}>
{rt.l}
</span>
</Fragment>
))}
</div>
</div>
</div>
</div>
<div style={{ position: "relative", minWidth: "0", display: "flex", flexDirection: "column", gap: "14px{{ hero.dirCol }}" }}>
<div>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
<span style={{ flex: "0 0 auto", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
Por produto
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "right", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{hero.prodTxt}
</span>
</div>
<div style={{ display: "flex", gap: "3px", height: "10px", marginTop: "12px", borderRadius: "9999px", overflow: "hidden", background: "#1f252c" }}>
{(hero.prod ?? []).map((hp: any, i1: number) => (
<Fragment key={hp?.id ?? hp?.chave ?? i1}>
<span title={hp.dica} style={estilo(hp.barra)} />
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "7px", marginTop: "10px" }}>
{(hero.prod ?? []).map((hp: any, i1: number) => (
<Fragment key={hp?.id ?? hp?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "#a3aab0" }}>
<span style={estilo(hp.dot)} />
<span style={{ flex: "1", minWidth: "0" }}>
{hp.l}
</span>
<strong style={{ color: "#fff", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
{hp.v}
</strong>
<span style={{ width: "34px", textAlign: "right", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{hp.pct}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "1px", borderRadius: "12px", background: "#2a3139", overflow: "hidden" }}>
{(hero.kpis ?? []).map((kp: any, i1: number) => (
<Fragment key={kp?.id ?? kp?.chave ?? i1}>
<div style={{ padding: "11px 12px", background: "#161c22", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{kp.l}
</span>
<span style={estilo(kp.vStyle)}>
{kp.v}
</span>
</div>
</Fragment>
))}
</div>
</div>
</div>
<div data-stagger="50" style={estilo(row3a)}>
<section data-in="rise" style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "14px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<span style={{ display: "block" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Crescimento da base
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c" }}>
{cresc.periodo}
</span>
</span>
<div onMouseLeave={cresc.sair} style={{ flex: "1", display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px", paddingRight: "34px", backgroundImage: "linear-gradient(90deg,#eef1f1 1px,transparent 1px)", backgroundSize: "25% 100%" }}>
{(cresc.linhas ?? []).map((cl: any, i1: number) => (
<Fragment key={cl?.id ?? cl?.chave ?? i1}>
<div onMouseEnter={cl.entrar} title={cl.dica} style={{ position: "relative", display: "flex", alignItems: "center", height: "30px" }}>
<span style={estilo(cl.barra)}>
<span style={estilo(cl.lbl)}>
{cl.mes}
</span>
</span>
<span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{cl.n}
</span>
{(cl.temNovos) ? (<>
<span style={{ marginLeft: "6px", fontSize: "11px", fontWeight: "600", color: "#1f7256", whiteSpace: "nowrap" }}>
{cl.novos}
</span>
</>) : null}
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "5px", paddingTop: "12px", borderTop: "1px solid #eef1f1" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{cresc.rodape}
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={cresc.cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={cresc.ico} />
</svg>
</span>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{cresc.rodape2}
</span>
</div>
</section>
<section data-in="rise" style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "14px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Clientes ativos por produto
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
{(topProd ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<span style={estilo(tp.ico)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={tp.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{tp.l}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "700", color: "#12171d" }}>
{tp.pct}
</span>
</span>
<span style={{ display: "block", height: "6px", marginTop: "7px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(tp.barra)} />
</span>
<span style={{ display: "block", marginTop: "5px", fontSize: "11.5px", color: "#8b949e" }}>
{tp.n}
</span>
</span>
</div>
</Fragment>
))}
</div>
</section>
<section data-in="rise" style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Ticket médio por produto
</span>
<div style={{ display: "flex", gap: "8px" }}>
<div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "160px", marginTop: "-5px" }}>
{(tick.eixo ?? []).map((ex: any, i1: number) => (
<Fragment key={ex?.id ?? ex?.chave ?? i1}>
<span style={{ fontSize: "10.5px", lineHeight: "10px", color: "#8b949e", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
{ex.l}
</span>
</Fragment>
))}
</div>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ height: "160px", display: "flex", alignItems: "flex-end", gap: "10px", backgroundImage: "linear-gradient(#eef1f1 1px,transparent 1px)", backgroundSize: "100% 40px", boxShadow: "inset 0 -1px 0 #e3e7e8" }}>
{(tick.cols ?? []).map((tc: any, i1: number) => (
<Fragment key={tc?.id ?? tc?.chave ?? i1}>
<div title={tc.l} style={{ flex: "1", minWidth: "0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: "5px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{tc.v}
</span>
<span style={estilo(tc.b)} />
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "10px", paddingTop: "7px" }}>
{(tick.cols ?? []).map((tc: any, i1: number) => (
<Fragment key={tc?.id ?? tc?.chave ?? i1}>
<span style={{ flex: "1", minWidth: "0", textAlign: "center", fontSize: "10.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{tc.l}
</span>
</Fragment>
))}
</div>
</div>
</div>
</section>
<section data-in="rise" style={{ flex: "1 1 300px", minWidth: "0", minHeight: "300px", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", overflow: "hidden" }}>
<div style={{ position: "relative", overflow: "hidden", flex: "0 0 auto", padding: "14px 14px 12px", background: "#12171d", color: "#fff" }}>
<span style={{ position: "absolute", right: "-70px", top: "-90px", width: "220px", height: "180px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".18", filter: "blur(50px)", pointerEvents: "none" }} />
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
<img src="/proto/oni-avatar.png" alt="NEXO" width="32" height="32" style={{ display: "block", flex: "0 0 auto", borderRadius: "9px" }} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em" }}>
Insights do NEXO
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#a3aab0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{nx.sub}
</span>
</span>
<button onClick={abrirNexo} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "8px", border: "0", background: "#fff", color: "#12171d", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Perguntar
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
<div style={{ position: "relative", display: "flex", gap: "14px", marginTop: "10px", flexWrap: "wrap" }}>
{(nx.stats ?? []).map((st: any, i1: number) => (
<Fragment key={st?.id ?? st?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: "0" }}>
<span style={estilo(st.vStyle)}>
{st.v}
</span>
<span style={{ fontSize: "11px", color: "#a3aab0", whiteSpace: "nowrap" }}>
{st.l}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div style={{ position: "relative", flex: "1", minHeight: "0" }}>
<div style={{ position: "absolute", inset: "0", overflowY: "auto", padding: "6px 8px 8px" }}>
{(semInsight) ? (<>
<span style={{ display: "block", padding: "14px 8px", fontSize: "12.5px", color: "#8b949e" }}>
Tudo tranquilo na carteira agora.
</span>
</>) : null}
{(insights ?? []).map((ig: any, i1: number) => (
<Fragment key={ig?.id ?? ig?.chave ?? i1}>
<div style={estilo(ig.box)}>
<button onClick={ig.alternar} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={estilo(ig.icoP)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={ig.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ig.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#67787c", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ig.valor}
</span>
</span>
<span style={estilo(ig.selo)}>
{ig.n}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(ig.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(ig.aberto) ? (<>
<div data-in="fade-down" style={{ padding: "0 6px 10px 44px", display: "flex", flexDirection: "column", gap: "3px" }}>
<span style={{ display: "block", marginBottom: "4px", fontSize: "11.5px", color: "#67787c", lineHeight: "1.45", textWrap: "pretty" }}>
{ig.s}
</span>
{(ig.clientes ?? []).map((cl: any, i2: number) => (
<Fragment key={cl?.id ?? cl?.chave ?? i2}>
<button onClick={cl.abrir} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 8px", borderRadius: "7px", border: "0", background: "#fafaf8", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cl.nome}
</span>
<span style={{ fontSize: "11px", color: "#67787c", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{cl.mrr}
</span>
</button>
</Fragment>
))}
<button onClick={ig.agir} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "5px", height: "30px", borderRadius: "8px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
{ig.agirTxt}
</button>
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</div>
</section>
</div>
<section data-in="rise" style={{ minWidth: "0", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "16px 20px 12px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 21v-2a4 4 0 0 0-3-3.9" />
</svg>
<span style={{ flex: "1 1 220px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Base de clientes
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c" }}>
{tab.sub}
</span>
</span>
<button onClick={nc.abrir} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 14px", borderRadius: "9px", background: "#d93c1a", fontSize: "13px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Novo cliente
</button>
</div>
<div data-r="toolbar" style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", padding: "0 20px 14px" }}>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "34px", flex: "1 1 220px", maxWidth: "300px", minWidth: "160px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={busca} onChange={setBusca} placeholder="Cliente ou segmento" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0" }} />
</div>
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px", height: "34px", alignItems: "stretch" }}>
{(tab.filtros ?? []).map((tf: any, i1: number) => (
<Fragment key={tf?.id ?? tf?.chave ?? i1}>
<button onClick={tf.onClick} style={estilo(tf.style)}>
{tf.l}
</button>
</Fragment>
))}
</div>
<select value={tab.fProd} onChange={tab.setProd} style={{ height: "34px", padding: "0 10px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
<option value="">
Todos os produtos
</option>
{(tab.prods ?? []).map((po: any, i1: number) => (
<Fragment key={po?.id ?? po?.chave ?? i1}>
<option value={po.v}>
{po.l}
</option>
</Fragment>
))}
</select>
<select value={tab.fResp} onChange={tab.setResp} style={{ height: "34px", padding: "0 10px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
<option value="">
Todos os responsáveis
</option>
{(tab.resps ?? []).map((ro: any, i1: number) => (
<Fragment key={ro?.id ?? ro?.chave ?? i1}>
<option value={ro.v}>
{ro.l}
</option>
</Fragment>
))}
</select>
{(tab.temFiltro) ? (<>
<button onClick={tab.limparFiltros} style={{ height: "34px", padding: "0 10px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer", whiteSpace: "nowrap" }}>
Limpar filtros
</button>
</>) : null}
<span style={{ flex: "1", minWidth: "8px" }} />
{(tab.temSel) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 5px 0 11px", borderRadius: "9px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #f6d9cf" }}>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#9c3210", whiteSpace: "nowrap" }}>
{tab.selTxt}
</span>
<button onClick={tab.exportarSel} style={{ height: "24px", padding: "0 9px", borderRadius: "6px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #f0c3b3", fontSize: "11.5px", fontWeight: "600", color: "#9c3210", cursor: "pointer" }}>
Exportar
</button>
<button onClick={tab.limparSel} title="Limpar seleção" style={{ width: "24px", height: "24px", borderRadius: "6px", border: "0", background: "transparent", color: "#9c3210", display: "grid", placeItems: "center", cursor: "pointer" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</>) : null}
</div>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "1080px" }}>
<div style={{ display: "grid", gridTemplateColumns: "20px minmax(220px,1.6fr) 120px 110px minmax(130px,.9fr) 100px 120px minmax(150px,1fr) 28px", gap: "14px", alignItems: "center", padding: "11px 20px", background: "#fafaf8", boxShadow: "inset 0 1px 0 #eef1f1,inset 0 -1px 0 #eef1f1", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
<button onClick={tab.togAll} title="Selecionar página" style={estilo(tab.checkAll)}>
{(tab.allOn) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
<button onClick={tab.cab.nome.onClick} style={estilo(tab.cab.nome.st)}>
{tab.cab.nome.l}
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(tab.cab.nome.setaSt)}>
<path d={tab.cab.nome.seta} />
</svg>
</button>
<span>
Produto
</span>
<button onClick={tab.cab.mrr.onClick} style={estilo(tab.cab.mrr.st)}>
{tab.cab.mrr.l}
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(tab.cab.mrr.setaSt)}>
<path d={tab.cab.mrr.seta} />
</svg>
</button>
<button onClick={tab.cab.saude.onClick} style={estilo(tab.cab.saude.st)}>
{tab.cab.saude.l}
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(tab.cab.saude.setaSt)}>
<path d={tab.cab.saude.seta} />
</svg>
</button>
<button onClick={tab.cab.desde.onClick} style={estilo(tab.cab.desde.st)}>
{tab.cab.desde.l}
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(tab.cab.desde.setaSt)}>
<path d={tab.cab.desde.seta} />
</svg>
</button>
<button onClick={tab.cab.ultima.onClick} style={estilo(tab.cab.ultima.st)}>
{tab.cab.ultima.l}
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(tab.cab.ultima.setaSt)}>
<path d={tab.cab.ultima.seta} />
</svg>
</button>
<button onClick={tab.cab.resp.onClick} style={estilo(tab.cab.resp.st)}>
{tab.cab.resp.l}
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(tab.cab.resp.setaSt)}>
<path d={tab.cab.resp.seta} />
</svg>
</button>
<span />
</div>
<div data-stagger="25">
{(tab.linhas ?? []).map((ln: any, i1: number) => (
<Fragment key={ln?.id ?? ln?.chave ?? i1}>
<div data-in="fade" style={{ display: "grid", gridTemplateColumns: "20px minmax(220px,1.6fr) 120px 110px minmax(130px,.9fr) 100px 120px minmax(150px,1fr) 28px", gap: "14px", alignItems: "center", minHeight: "58px", padding: "8px 20px", boxShadow: "inset 0 -1px 0 #f1f3f3", fontSize: "13px" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<button onClick={ln.tog} style={estilo(ln.check)}>
{(ln.sel) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
<button onClick={ln.abrir} style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={estilo(ln.av)}>
{ln.ini}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.nome}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.segmento}
</span>
</span>
</button>
<span style={estilo(ln.pStyle)}>
{ln.produto}
</span>
<span style={{ textAlign: "right", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{ln.mrr}
</span>
<span style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
<span style={estilo(ln.saudeCor)}>
{ln.saudeTxt2}
</span>
<span style={{ fontSize: "11.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{ln.saudeN}
</span>
</span>
<span style={{ display: "block", height: "4px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(ln.saudeBar)} />
</span>
</span>
<span style={{ color: "#4a5560", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{ln.desde}
</span>
<span style={estilo(ln.ultStyle)}>
{ln.ultima}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "9999px", display: "grid", placeItems: "center", fontSize: "9.5px", fontWeight: "700", background: "#eeeff3", color: "#4a5560" }}>
{ln.respIni}
</span>
<span style={{ minWidth: "0", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.resp}
</span>
</span>
<button onClick={ln.abrirMenu} data-cl-menu="1" title="Ações" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
<circle cx="12" cy="5" r="1.8" />
<circle cx="12" cy="12" r="1.8" />
<circle cx="12" cy="19" r="1.8" />
</svg>
</button>
</div>
</Fragment>
))}
</div>
{(tab.vazia) ? (<>
<div style={{ padding: "34px", textAlign: "center", fontSize: "13px", color: "#67787c" }}>
Nenhum cliente com esses filtros.
</div>
</>) : null}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "12px 20px", boxShadow: "inset 0 1px 0 #eef1f1", background: "#fafaf8" }}>
<span style={{ fontSize: "12.5px", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{tab.pagTxt}
</span>
<label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#67787c" }}>
Por página
<select value={tab.porPag} onChange={tab.setPorPag} style={{ height: "30px", padding: "0 6px", borderRadius: "7px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c" }}>
<option value="10">
10
</option>
<option value="25">
25
</option>
<option value="50">
50
</option>
</select>
</label>
<span style={{ flex: "1" }} />
<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
<button onClick={tab.ant} title="Página anterior" style={estilo(tab.antSt)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
</button>
{(tab.pags ?? []).map((pgn: any, i1: number) => (
<Fragment key={pgn?.id ?? pgn?.chave ?? i1}>
<button onClick={pgn.onClick} style={estilo(pgn.st)}>
{pgn.l}
</button>
</Fragment>
))}
<button onClick={tab.prox} title="Próxima página" style={estilo(tab.proxSt)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</div>
</div>
</section>
</div>
</div>
{(nc2.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={nc2.fechar} style={{ position: "fixed", inset: "0", zIndex: "65", background: "rgba(18,23,29,.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" data-r="drawer" onClick={parar} style={{ width: "min(980px,100%)", height: "min(680px,100%)", display: "flex", background: "#fff", borderRadius: "20px", boxShadow: "0 40px 90px -30px rgba(12,16,21,.6)", overflow: "hidden" }}>
<aside data-r="esconde-mobile" style={{ flex: "0 0 250px", minWidth: "0", display: "flex", flexDirection: "column", padding: "26px 18px 18px", background: "#fbfbfa", boxShadow: "inset -1px 0 0 #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "28px", fontWeight: "800", letterSpacing: "-.04em", lineHeight: "1", color: "#12171d" }}>
NEXO
</span>
<span style={{ height: "22px", padding: "0 7px", borderRadius: "6px", background: "#fe4f2b", color: "#fff", fontSize: "11px", fontWeight: "500", display: "grid", placeItems: "center" }}>
IA
</span>
</div>
<span style={{ display: "block", marginTop: "8px", fontSize: "13.5px", color: "#4a5560" }}>
<span style={{ color: "#d93c1a", fontWeight: "600" }}>
Sempre ON
</span>
 com você.
</span>
<button onClick={nc2.novo} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", height: "44px", marginTop: "22px", padding: "0 14px", borderRadius: "11px", border: "0", background: "#12171d", color: "#fff", fontSize: "13.5px", fontWeight: "500", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 5v14M5 12h14" />
</svg>
Novo chat
</button>
<div style={{ display: "flex", alignItems: "center", gap: "9px", height: "40px", marginTop: "8px", padding: "0 12px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", background: "#fff", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={nc2.busca} onChange={nc2.setBusca} placeholder="Buscar conversas" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
<span style={{ display: "block", margin: "22px 4px 8px", fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
Conversas recentes
</span>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
{(nc2.recentes ?? []).map((rc: any, i1: number) => (
<Fragment key={rc?.id ?? rc?.chave ?? i1}>
<button onClick={rc.onClick} style={estilo(rc.style)} className={[hover("background:#fff;box-shadow:inset 2px 0 0 #fe4f2b,0 0 0 1px #eef1f1")].filter(Boolean).join(" ")}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rc.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e" }}>
{rc.q}
</span>
</button>
</Fragment>
))}
</div>
</aside>
<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", position: "relative", background: "linear-gradient(165deg,#fff2ec 0%,#fff 48%)" }}>
<button onClick={nc2.fechar} title="Fechar" style={{ position: "absolute", zIndex: "2", top: "16px", right: "16px", width: "34px", height: "34px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("color:#12171d;background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
{(nc2.vazio) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: "26px", padding: "40px 28px 12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "26px", flexWrap: "wrap" }}>
<img src="/proto/oni-avatar.png" alt="NEXO" style={{ flex: "0 0 auto", width: "132px", height: "132px", borderRadius: "34px", objectFit: "cover", boxShadow: "0 24px 50px -22px rgba(254,79,43,.55)" }} />
<div style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontSize: "15px", fontWeight: "500", color: "#d93c1a" }}>
Oi, eu sou o
</span>
<span style={{ display: "block", marginTop: "2px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "44px", fontWeight: "800", letterSpacing: "-.045em", lineHeight: "1", color: "#12171d" }}>
NEXO
<span style={{ color: "#fe4f2b" }}>
.
</span>
</span>
<span style={{ display: "block", marginTop: "10px", fontSize: "14.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{nc2.intro}
</span>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px" }}>
{(nc2.cards ?? []).map((cd: any, i1: number) => (
<Fragment key={cd?.id ?? cd?.chave ?? i1}>
<button onClick={cd.onClick} style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "0", padding: "14px", borderRadius: "14px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1,0 8px 20px -16px rgba(18,23,29,.3)", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1.5px #fe4f2b,0 12px 24px -16px rgba(18,23,29,.35)")].filter(Boolean).join(" ")}>
<span style={estilo(cd.ico)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={cd.d} />
</svg>
</span>
<span style={{ fontSize: "13.5px", fontWeight: "500", color: "#12171d", lineHeight: "1.3" }}>
{cd.t}
</span>
<span style={{ fontSize: "12px", color: "#8b949e", lineHeight: "1.4", textWrap: "pretty" }}>
{cd.s}
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
{(nc2.temMsgs) ? (<>
<div ref={nc2.ref} style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px", padding: "60px 28px 16px" }}>
{(nc2.msgs ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<div style={estilo(m.linha)}>
{(m.ehNexo) ? (<>
<img src="/proto/oni-avatar.png" alt="" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "10px", objectFit: "cover" }} />
</>) : null}
<div style={{ maxWidth: "78%", minWidth: "0", display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={estilo(m.bolha)}>
{m.t}
</span>
{(m.temAcoes) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(m.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} style={{ height: "32px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #f0c3b6", fontSize: "12.5px", fontWeight: "500", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
{ac.l}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
</Fragment>
))}
{(nc2.pensando) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "30px", height: "30px", borderRadius: "10px", objectFit: "cover" }} />
<span style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "13px", color: "#8b949e" }}>
NEXO está olhando sua carteira…
</span>
</div>
</>) : null}
</div>
</>) : null}
<div style={{ flex: "0 0 auto", margin: "0 22px", padding: "12px 12px 10px", borderRadius: "16px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8,0 14px 34px -22px rgba(18,23,29,.35)" }}>
<input value={nc2.rasc} onChange={nc2.setRasc} onKeyDown={nc2.tecla} autoFocus={true} placeholder="Digite sua mensagem para o NEXO…" style={{ width: "100%", height: "36px", padding: "0 6px", border: "0", outline: "0", background: "transparent", fontSize: "14.5px", color: "#12171d" }} />
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
<button title="Anexar" style={{ width: "34px", height: "34px", borderRadius: "9px", border: "0", background: "#f3f4f4", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eceeee;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 11px", borderRadius: "9px", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "12.5px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
Buscar na ONFACE
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 11px", borderRadius: "9px", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "12.5px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
Contexto: Clientes
</span>
<span style={{ flex: "1" }} />
<button title="Falar" style={{ width: "36px", height: "36px", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f3f4f4;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
</svg>
</button>
<button onClick={nc2.enviar} title="Enviar" style={estilo(nc2.enviarStyle)} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
</div>
<span style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 24px 16px", fontSize: "11.5px", color: "#8b949e" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="#fe4f2b">
<path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" />
</svg>
O NEXO consulta clientes, receita, saúde e atividades para responder.
</span>
</div>
</div>
</div>
</>) : null}
{(dr.aberto) ? (<>
<div data-in="fade" onClick={dr.fechar} style={{ position: "fixed", inset: "0", zIndex: "40", background: "rgba(18,23,29,.16)" }} />
<aside data-r="drawer" data-in="slide-left" style={{ position: "fixed", top: "10px", right: "10px", bottom: "10px", width: "min(480px,calc(100vw - 20px))", zIndex: "41", background: "#fff", borderRadius: "14px", boxShadow: "0 0 0 1px #e3e7e8,0 30px 70px -20px rgba(18,23,29,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "13px" }}>
<span style={{ position: "relative", flex: "0 0 auto", width: "52px", height: "52px", borderRadius: "12px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{dr.ini}
<span style={{ position: "absolute", right: "-3px", bottom: "-3px", width: "12px", height: "12px", borderRadius: "9999px", background: "#fe4f2b", boxShadow: "0 0 0 2.5px #fff" }} />
</span>
<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "4px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", lineHeight: "1.2" }}>
{dr.nome}
</span>
<span style={{ fontSize: "13px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dr.sub}
</span>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
<span style={estilo(dr.stStyle)}>
<span style={estilo(dr.stDot)} />
{dr.stTxt}
</span>
<span style={{ fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{dr.desde}
</span>
</div>
</div>
<button onClick={dr.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<button onClick={dr.novaAtv} style={{ flex: "1 1 0", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
</svg>
Nova atividade
</button>
<button onClick={dr.ir360} style={{ flex: "1 1 0", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#e8431f")].filter(Boolean).join(" ")}>
Abrir Cliente 360
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
</div>
<div data-stagger="55" style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "4px 18px 22px", display: "flex", flexDirection: "column", gap: "20px" }}>
<div data-in="rise" style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", borderRadius: "12px", background: "#eef1f1", overflow: "hidden", boxShadow: "0 0 0 1px #eef1f1" }}>
{(dr.tiles ?? []).map((dt: any, i1: number) => (
<Fragment key={dt?.id ?? dt?.chave ?? i1}>
<div style={{ padding: "11px 13px", background: "#fafaf8", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{dt.l}
</span>
<span style={estilo(dt.vStyle)}>
{dt.v}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dt.s}
</span>
</div>
</Fragment>
))}
</div>
<span data-in="rise" style={{ flex: "0 0 auto", display: "block", height: "6px", marginTop: "-10px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(dr.saudeBarra)} />
</span>
<section data-in="rise" style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "8px", paddingTop: "14px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01" />
</svg>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Informações principais
</span>
<button onClick={dr.irProd} style={{ height: "26px", padding: "0 9px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Produtos
</button>
</div>
{(dr.fatos ?? []).map((df: any, i1: number) => (
<Fragment key={df?.id ?? df?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,150px) minmax(0,1fr)", alignItems: "center", gap: "12px", minHeight: "30px" }}>
<span style={{ fontSize: "13px", color: "#67787c" }}>
{df.l}
</span>
<span style={{ fontSize: "13px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{df.v}
</span>
</div>
</Fragment>
))}
</section>
<section data-in="rise" style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "6px", paddingTop: "14px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Próximas atividades
</span>
</div>
{(dr.semProx) ? (<>
<span style={{ display: "block", padding: "6px 0", fontSize: "12.5px", color: "#8b949e" }}>
Nada agendado com a conta.
</span>
</>) : null}
{(dr.prox ?? []).map((dp: any, i1: number) => (
<Fragment key={dp?.id ?? dp?.chave ?? i1}>
<button onClick={dp.onClick} style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 -8px", width: "calc(100% + 16px)", padding: "8px", borderRadius: "9px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", background: "#fff6f4", color: "#c2330f" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={dp.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dp.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dp.s}
</span>
</span>
<span style={estilo(dp.diaSt)}>
{dp.dia}
</span>
</button>
</Fragment>
))}
</section>
<section data-in="rise" style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "6px", paddingTop: "14px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z" />
</svg>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Em andamento
</span>
</div>
{(dr.semRel) ? (<>
<span style={{ display: "block", padding: "6px 0", fontSize: "12.5px", color: "#8b949e" }}>
Nenhuma oportunidade ou proposta aberta.
</span>
</>) : null}
{(dr.rel ?? []).map((drr: any, i1: number) => (
<Fragment key={drr?.id ?? drr?.chave ?? i1}>
<button onClick={drr.ir} style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 -8px", width: "calc(100% + 16px)", padding: "8px", borderRadius: "9px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{drr.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{drr.s}
</span>
</span>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "9999px", background: "#eeeff3", color: "#1f252c", fontSize: "11px", fontWeight: "600" }}>
{drr.status}
</span>
</button>
</Fragment>
))}
</section>
<button data-in="rise" onClick={dr.irFin} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 14px", borderRadius: "12px", border: "0", background: "#fafaf8", boxShadow: "inset 0 0 0 1px #eef1f1", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1.5px #fe4f2b")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4" />
</svg>
<span style={{ flex: "1", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Faturas, Stripe e contratos
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
</aside>
</>) : null}
{(menu.aberto) ? (<>
<div data-cl-menu="1" data-in="drop" style={estilo(menu.pos)}>
{(menu.itens ?? []).map((mi: any, i1: number) => (
<Fragment key={mi?.id ?? mi?.chave ?? i1}>
<button onClick={mi.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "8px 9px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "13px", color: "#1f252c" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={mi.d} />
</svg>
{mi.l}
</button>
</Fragment>
))}
</div>
</>) : null}
{(nc.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={nc.fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(460px,100%)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
Novo cliente
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
Cadastrar uma conta já ativa direto na carteira
</span>
</span>
<button onClick={nc.fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ position: "relative" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Empresa
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input value={nc.busca} onChange={nc.setBusca} placeholder="Buscar empresa" style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
{(nc.temSugestoes) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 4px)", left: "0", right: "0", zIndex: "5", maxHeight: "160px", overflowY: "auto", background: "#fff", borderRadius: "10px", boxShadow: "0 0 0 1px #e3e7e8,0 12px 26px -10px rgba(18,23,29,.25)", padding: "5px" }}>
{(nc.sugestoes ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onClick={sg.onClick} style={{ display: "block", width: "100%", padding: "8px 9px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "13px", color: "#1f252c" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
{sg.l}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Produto
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(nc.produtos ?? []).map((pp: any, i1: number) => (
<Fragment key={pp?.id ?? pp?.chave ?? i1}>
<button onClick={pp.onClick} style={estilo(pp.style)}>
{pp.l}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
MRR
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input value={nc.mrr} onChange={nc.setMrr} placeholder="Ex: 4200" inputMode="numeric" style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Cliente desde
</span>
<input type="month" value={nc.inicio} onChange={nc.setInicio} style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
</div>
{(nc.temErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
{nc.erro}
</span>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafaf8" }}>
<button onClick={nc.fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={nc.salvar} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
Adicionar cliente
</button>
</div>
</div>
</div>
</>) : null}
</div>


    </>
  );
}
