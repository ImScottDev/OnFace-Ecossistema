"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace CS.dc.html
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
import "./CsDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeCsDesenho {
  abas: any;
  acoes: any;
  at: any;
  car: any;
  dist: any;
  escopo: any;
  ev: any;
  fechar: any;
  hand: any;
  ir: any;
  kp5: any;
  mP: any;
  mX: any;
  nx: any;
  ori: any;
  parar: any;
  pbs: any;
  rec: any;
  ren: any;
  runs: any;
  sau: any;
  tb: any;
  vida: any;
  vis: any;
}

export function CsDesenho(vals: ValoresDeCsDesenho) {
  const { abas, acoes, at, car, dist, escopo, ev, fechar, hand, ir, kp5, mP, mX, nx, ori, parar, pbs, rec, ren, runs, sau, tb, vida, vis } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: "14px 14px 22px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<div data-r="toolbar" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "10px", padding: "3px", gap: "2px", height: "38px", alignItems: "stretch" }}>
{(abas ?? []).map((ab: any, i1: number) => (
<Fragment key={ab?.id ?? ab?.chave ?? i1}>
<button onClick={ab.onClick} style={estilo(ab.style)}>
{ab.l}
{(ab.temN) ? (<>
<span style={estilo(ab.nStyle)}>
{ab.n}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1", minWidth: "8px" }} />
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px", height: "34px" }}>
{(escopo ?? []).map((es: any, i1: number) => (
<Fragment key={es?.id ?? es?.chave ?? i1}>
<button onClick={es.onClick} style={estilo(es.style)}>
{es.l}
</button>
</Fragment>
))}
</div>
<button onClick={acoes.playbook} style={{ display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 3l14 9-14 9z" />
</svg>
Iniciar playbook
</button>
<button onClick={acoes.expansao} style={{ display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#d93c1a", fontSize: "13px", fontWeight: "600", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 7 13.5 15.5l-5-5L2 17M16 7h6v6" />
</svg>
Sinalizar expansão
</button>
</div>
{(vis.geral) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
<div style={{ flex: "2.4 1 620px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
<div data-in="rise" style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", padding: "18px 22px", borderRadius: "18px", background: "#12171d", color: "#fff" }}>
<span style={{ position: "absolute", right: "-60px", top: "-110px", width: "380px", height: "240px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".16", filter: "blur(60px)", pointerEvents: "none" }} />
<span style={{ position: "relative", flex: "0 0 auto", width: "46px", height: "46px", borderRadius: "14px", display: "grid", placeItems: "center", background: "rgba(255,255,255,.08)" }}>
<span style={{ width: "20px", height: "20px", borderRadius: "9999px", border: "5px solid #fe4f2b" }} />
</span>
<span style={{ position: "relative", flex: "1 1 260px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "24px", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.1" }}>
Customer Success
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#a3aab0" }}>
Saúde da base, renovações, riscos e oportunidades de expansão.
</span>
</span>
<span style={{ position: "relative", display: "flex", gap: "8px", flexWrap: "wrap" }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 12px", borderRadius: "9px", background: "rgba(255,255,255,.08)", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
Últimos 12 meses
</span>
<button onClick={acoes.registrar} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", color: "#12171d", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Nova atividade
</button>
</span>
</div>
<div data-stagger="40" style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))" }}>
{(kp5 ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<button data-in="rise" onClick={k.onClick} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", border: "0", textAlign: "left", cursor: "pointer", minWidth: "0", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }} className={[hover("box-shadow:0 0 0 1.5px #12171d,0 12px 32px -24px rgba(18,23,29,.25)")].filter(Boolean).join(" ")}>
<span style={estilo(k.ico)}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={k.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.l}
</span>
<span style={{ display: "block", marginTop: "3px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "20px", fontWeight: "800", letterSpacing: "-.03em", lineHeight: "1.1", color: "#12171d", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{k.v}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
<span style={estilo(k.dSt)}>
{k.dt}
</span>
<span style={{ fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{k.s}
</span>
</span>
</span>
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "stretch" }}>
<section data-in="rise" onMouseLeave={ev.sair} style={{ flex: "1.5 1 380px", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Evolução da receita (MRR)
</span>
{(ev.legenda ?? []).map((lg: any, i1: number) => (
<Fragment key={lg?.id ?? lg?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#4a5560", whiteSpace: "nowrap" }}>
<span style={estilo(lg.dot)} />
{lg.l}
</span>
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "8px", flex: "1" }}>
<div style={{ flex: "0 0 auto", width: "40px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "150px", marginTop: "-5px" }}>
{(ev.eixo ?? []).map((ex: any, i1: number) => (
<Fragment key={ex?.id ?? ex?.chave ?? i1}>
<span style={{ fontSize: "10.5px", lineHeight: "10px", color: "#8b949e", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
{ex}
</span>
</Fragment>
))}
</div>
<div style={{ position: "relative", flex: "1", minWidth: "0" }}>
<div style={{ position: "relative", height: "150px", display: "flex", alignItems: "flex-end", gap: "6px", backgroundImage: "linear-gradient(#eef1f1 1px,transparent 1px)", backgroundSize: "100% 37.5px", boxShadow: "inset 0 -1px 0 #e3e7e8" }}>
{(ev.cols ?? []).map((co: any, i1: number) => (
<Fragment key={co?.id ?? co?.chave ?? i1}>
<div onMouseEnter={co.entrar} style={{ flex: "1", minWidth: "0", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", cursor: "crosshair" }}>
<div style={estilo(co.barra)}>
{(co.segs ?? []).map((sg: any, i2: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i2}>
<span style={estilo(sg.st)} />
</Fragment>
))}
</div>
</div>
</Fragment>
))}
{(ev.temDica) ? (<>
<div style={estilo(ev.dicaPos)}>
<span style={{ display: "block", fontSize: "10.5px", color: "#8b949e" }}>
{ev.dicaT}
</span>
{(ev.dicaL ?? []).map((dl: any, i1: number) => (
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
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #2a3139", fontSize: "12px", color: "#d7dbde" }}>
Total
<strong style={{ marginLeft: "auto", paddingLeft: "12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", color: "#fff", fontVariantNumeric: "tabular-nums" }}>
{ev.dicaTot}
</strong>
</span>
</div>
</>) : null}
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "7px" }}>
{(ev.cols ?? []).map((co: any, i1: number) => (
<Fragment key={co?.id ?? co?.chave ?? i1}>
<span style={estilo(co.rot)}>
{co.l}
</span>
</Fragment>
))}
</div>
</div>
</div>
</section>
<section data-in="rise" onMouseLeave={dist.sair} style={{ flex: "1 1 280px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Distribuição de receita por produto
</span>
<div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", flex: "1" }}>
<span style={{ position: "relative", flex: "0 0 auto", width: "136px", height: "136px" }}>
<svg width="136" height="136" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
{(dist.arcos ?? []).map((ar: any, i1: number) => (
<Fragment key={ar?.id ?? ar?.chave ?? i1}>
<circle onMouseEnter={ar.entrar} cx="50" cy="50" r="40" fill="none" stroke={ar.cor} strokeWidth={ar.sw} pathLength="100" strokeDasharray={ar.da} strokeDashoffset={ar.off} style={{ transition: "stroke-width .2s,stroke-dasharray .9s cubic-bezier(.16,1,.3,1)", cursor: "pointer" }} />
</Fragment>
))}
</svg>
<span style={{ position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "800", letterSpacing: "-.03em", color: "#12171d", whiteSpace: "nowrap" }}>
{dist.centro}
</span>
<span style={{ fontSize: "10.5px", color: "#8b949e" }}>
{dist.centroL}
</span>
</span>
</span>
<div style={{ flex: "1 1 120px", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
{(dist.lista ?? []).map((dl: any, i1: number) => (
<Fragment key={dl?.id ?? dl?.chave ?? i1}>
<span onMouseEnter={dl.entrar} style={estilo(dl.row)}>
<span style={estilo(dl.dot)} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dl.l}
</span>
<span style={{ fontSize: "12px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{dl.pct}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{dl.v}
</span>
</span>
</Fragment>
))}
</div>
</div>
</section>
</div>
<section data-in="rise" style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px 20px", padding: "12px 18px", borderRadius: "14px", background: "#12171d", color: "#fff" }}>
<span style={{ position: "absolute", left: "-40px", top: "-70px", width: "220px", height: "150px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".14", filter: "blur(45px)", pointerEvents: "none" }} />
<span style={{ position: "relative", flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fe4f2b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
</svg>
Saúde da carteira
</span>
<div style={{ position: "relative", flex: "1 1 200px", minWidth: "140px", display: "flex", gap: "3px", height: "8px", borderRadius: "9999px", overflow: "hidden", background: "#1f252c" }}>
{(sau.segs ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onClick={sg.onClick} title={sg.dica} style={estilo(sg.barra)} />
</Fragment>
))}
</div>
<div style={{ position: "relative", flex: "0 1 auto", display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
{(sau.segs ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onClick={sg.onClick} style={{ display: "flex", alignItems: "center", gap: "6px", border: "0", background: "transparent", padding: "0", cursor: "pointer", color: "#fff", whiteSpace: "nowrap" }}>
<span style={estilo(sg.dot)} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "800", letterSpacing: "-.02em" }}>
{sg.pct}
</span>
<span style={{ fontSize: "11.5px", color: "#a3aab0" }}>
{sg.l} · {sg.n}
</span>
</button>
</Fragment>
))}
</div>
<button onClick={ir.carteira} style={{ position: "relative", flex: "0 0 auto", height: "26px", padding: "0 10px", borderRadius: "7px", border: "0", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: "11.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:rgba(255,255,255,.18)")].filter(Boolean).join(" ")}>
Ver carteira
</button>
</section>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "stretch" }}>
<section data-in="rise" style={{ flex: "1 1 260px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Origem dos clientes
</span>
<div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1" }}>
<span style={{ position: "relative", flex: "0 0 auto", width: "104px", height: "104px" }}>
<svg width="104" height="104" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
{(ori.arcos ?? []).map((ar: any, i1: number) => (
<Fragment key={ar?.id ?? ar?.chave ?? i1}>
<circle cx="50" cy="50" r="40" fill="none" stroke={ar.cor} strokeWidth="12" pathLength="100" strokeDasharray={ar.da} strokeDashoffset={ar.off} style={{ transition: "stroke-dasharray .9s cubic-bezier(.16,1,.3,1)" }} />
</Fragment>
))}
</svg>
<span style={{ position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "800", letterSpacing: "-.03em", color: "#12171d" }}>
{ori.n}
</span>
<span style={{ fontSize: "10.5px", color: "#8b949e" }}>
clientes
</span>
</span>
</span>
<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "7px" }}>
{(ori.lista ?? []).map((ol: any, i1: number) => (
<Fragment key={ol?.id ?? ol?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
<span style={estilo(ol.dot)} />
<span style={{ flex: "1", minWidth: "0", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ol.l}
</span>
<strong style={{ color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{ol.n}
</strong>
</span>
</Fragment>
))}
</div>
</div>
</section>
<section data-in="rise" style={{ flex: "1 1 220px", minWidth: "0", display: "flex", flexDirection: "column", gap: "8px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Tempo médio de vida
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "26px", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1", color: "#12171d" }}>
{vida.v}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
<span style={estilo(vida.dSt)}>
{vida.dt}
</span>
<span style={{ fontSize: "11px", color: "#8b949e" }}>
vs. período anterior
</span>
</span>
<div style={{ position: "relative", flex: "1", minHeight: "64px", marginTop: "auto" }}>
<svg viewBox="0 0 300 70" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
<defs>
<linearGradient id="csVida" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#fe4f2b" stopOpacity=".3" />
<stop offset="1" stopColor="#fe4f2b" stopOpacity="0" />
</linearGradient>
</defs>
<path d={vida.area} fill="url(#csVida)" />
<path d={vida.linha} fill="none" stroke="#fe4f2b" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
</svg>
<span style={estilo(vida.ponto)} />
</div>
<div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#8b949e" }}>
{(vida.rot ?? []).map((vr: any, i1: number) => (
<Fragment key={vr?.id ?? vr?.chave ?? i1}>
<span>
{vr}
</span>
</Fragment>
))}
</div>
</section>
</div>
<section data-in="rise" style={{ minWidth: "0", overflow: "hidden", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "14px 18px 12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Atividades de CS
</span>
<span style={{ fontSize: "13px", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
({tb.n})
</span>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "32px", flex: "1 1 200px", maxWidth: "300px", minWidth: "150px", marginLeft: "8px" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={tb.q} onChange={tb.setQ} placeholder="Buscar atividade ou cliente" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "12.5px", minWidth: "0" }} />
</div>
<span style={{ flex: "1" }} />
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "8px", padding: "3px", gap: "2px" }}>
{(tb.vistas ?? []).map((tv: any, i1: number) => (
<Fragment key={tv?.id ?? tv?.chave ?? i1}>
<button onClick={tv.onClick} style={estilo(tv.style)}>
{tv.l}
</button>
</Fragment>
))}
</div>
{(tb.sels ?? []).map((sl: any, i1: number) => (
<Fragment key={sl?.id ?? sl?.chave ?? i1}>
<select value={sl.v} onChange={sl.set} style={{ height: "32px", padding: "0 9px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
<option value="">
{sl.l}
</option>
{(sl.ops ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<option value={o.v}>
{o.l}
</option>
</Fragment>
))}
</select>
</Fragment>
))}
<button onClick={acoes.registrar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Nova
</button>
</div>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "860px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.6fr) minmax(150px,1fr) 110px 100px 110px minmax(140px,1fr) 28px", gap: "12px", alignItems: "center", padding: "10px 18px", background: "#fafaf8", boxShadow: "inset 0 1px 0 #eef1f1,inset 0 -1px 0 #eef1f1", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
<span>
Atividade
</span>
<span>
Cliente
</span>
<span>
Prazo
</span>
<span>
Prioridade
</span>
<span>
Situação
</span>
<span>
Responsável
</span>
<span />
</div>
<div data-stagger="25">
{(tb.linhas ?? []).map((ln: any, i1: number) => (
<Fragment key={ln?.id ?? ln?.chave ?? i1}>
<div data-in="fade" style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.6fr) minmax(150px,1fr) 110px 100px 110px minmax(140px,1fr) 28px", gap: "12px", alignItems: "center", minHeight: "52px", padding: "6px 18px", boxShadow: "inset 0 -1px 0 #f1f3f3", fontSize: "12.5px" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
<button onClick={ln.concluir} title={ln.chkDica} style={estilo(ln.chk)}>
{(ln.feita) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
<button onClick={ln.abrir} style={{ minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={estilo(ln.tSt)}>
{ln.t}
</span>
{(ln.temPb) ? (<>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.pb}
</span>
</>) : null}
</button>
</span>
<button onClick={ln.abrirCli} style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "7px", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "700", background: "#12171d", color: "#fff" }}>
{ln.cIni}
</span>
<span style={{ minWidth: "0", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
{ln.cli}
</span>
</button>
<span>
<span style={estilo(ln.prazoSt)}>
{ln.prazo}
</span>
</span>
<span>
<span style={estilo(ln.prioSt)}>
<span style={estilo(ln.prioDot)} />
{ln.prio}
</span>
</span>
<span>
<span style={estilo(ln.sitSt)}>
{ln.sit}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "9999px", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "700", background: "#eeeff3", color: "#4a5560" }}>
{ln.rIni}
</span>
<span style={{ minWidth: "0", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.resp}
</span>
</span>
<button onClick={ln.abrir} title="Abrir atividade" style={{ width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</div>
</Fragment>
))}
</div>
{(tb.vazio) ? (<>
<div style={{ padding: "30px", textAlign: "center", fontSize: "13px", color: "#67787c" }}>
Nenhuma atividade de CS nesse filtro.
</div>
</>) : null}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px", boxShadow: "inset 0 1px 0 #eef1f1", background: "#fafaf8" }}>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{tb.rod}
</span>
<span style={{ flex: "1" }} />
<button onClick={ir.atividades} style={{ height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Abrir em Atividades
</button>
</div>
</section>
</div>
<div style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
<section data-in="rise" style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", borderRadius: "16px", background: "#12171d", color: "#fff" }}>
<span style={{ position: "absolute", right: "-70px", top: "-90px", width: "260px", height: "220px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".22", filter: "blur(58px)", pointerEvents: "none" }} />
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "44px", height: "44px", borderRadius: "14px", animation: "nxPulse 2.2s ease-out infinite" }}>
<img src="/proto/oni-avatar.png" alt="NEXO" width="44" height="44" style={{ display: "block", borderRadius: "14px" }} />
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em" }}>
NEXO
</span>
<span style={{ height: "18px", padding: "0 6px", borderRadius: "5px", background: "#fe4f2b", fontSize: "10px", fontWeight: "600", display: "grid", placeItems: "center" }}>
IA
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", fontSize: "11.5px", color: "#a3aab0" }}>
<span style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "#3ecf8e", animation: "nxBlink 1.8s ease-in-out infinite" }} />
{nx.status}
</span>
</span>
</div>
<span style={{ position: "relative", fontSize: "13px", lineHeight: "1.6", color: "#e3e6e8", textWrap: "pretty", minHeight: "62px" }}>
{nx.brief}
{(nx.digitando) ? (<>
<span style={{ display: "inline-block", width: "6px", height: "13px", marginLeft: "2px", verticalAlign: "-2px", background: "#fe4f2b", animation: "nxBlink .8s steps(1) infinite" }} />
</>) : null}
</span>
{(nx.mostraPlano) ? (<>
<div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
Plano do dia
</span>
{(nx.temPend) ? (<>
<button onClick={nx.executarTudo} style={{ display: "flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 10px", borderRadius: "8px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "11.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 3l14 9-14 9z" />
</svg>
{nx.tudoTxt}
</button>
</>) : null}
</div>
{(nx.planoVazio) ? (<>
<span style={{ display: "block", padding: "6px 0", fontSize: "12.5px", color: "#a3aab0" }}>
Nada pedindo ação agora.
</span>
</>) : null}
{(nx.plano ?? []).map((pl: any, i1: number) => (
<Fragment key={pl?.id ?? pl?.chave ?? i1}>
<div style={estilo(pl.row)}>
<span style={estilo(pl.ico)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={pl.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={estilo(pl.tSt)}>
{pl.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pl.sub}
</span>
</span>
<button onClick={pl.onClick} style={estilo(pl.btn)}>
{pl.btnL}
</button>
</div>
</Fragment>
))}
</div>
</>) : null}
{(nx.temMsgs) ? (<>
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
Conversa
</span>
</div>
<div ref={nx.ref} style={{ position: "relative", maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "9px", padding: "2px" }}>
{(nx.msgs ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<div style={estilo(m.linha)}>
<div style={{ maxWidth: "92%", minWidth: "0", display: "flex", flexDirection: "column", gap: "7px" }}>
<span style={estilo(m.bolha)}>
{m.t}
</span>
{(m.temAcoes) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
{(m.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "#fff", color: "#12171d", fontSize: "11.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
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
{(nx.pensando) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#a3aab0" }}>
<span style={{ display: "flex", gap: "3px" }}>
<span style={{ width: "5px", height: "5px", borderRadius: "9999px", background: "#fe4f2b", animation: "nxDot 1.1s infinite" }} />
<span style={{ width: "5px", height: "5px", borderRadius: "9999px", background: "#fe4f2b", animation: "nxDot 1.1s .18s infinite" }} />
<span style={{ width: "5px", height: "5px", borderRadius: "9999px", background: "#fe4f2b", animation: "nxDot 1.1s .36s infinite" }} />
</span>
NEXO está analisando a carteira
</div>
</>) : null}
</div>
</>) : null}
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", padding: "5px 5px 5px 12px", borderRadius: "12px", background: "rgba(255,255,255,.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
<input value={nx.rasc} onChange={nx.setRasc} onKeyDown={nx.tecla} placeholder="Pergunte ou mande o NEXO agir…" style={{ flex: "1", minWidth: "0", height: "34px", border: "0", outline: "0", background: "transparent", color: "#fff", fontSize: "13px" }} />
<button onClick={nx.enviar} title="Enviar" style={estilo(nx.enviarSt)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
<div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(nx.chips ?? []).map((ch: any, i1: number) => (
<Fragment key={ch?.id ?? ch?.chave ?? i1}>
<button onClick={ch.onClick} style={{ display: "inline-flex", alignItems: "center", height: "28px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "rgba(255,255,255,.08)", color: "#d7dbde", fontSize: "11.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }} className={[hover("background:rgba(255,255,255,.14);color:#fff")].filter(Boolean).join(" ")}>
{ch.l}
</button>
</Fragment>
))}
</div>
</section>
<section data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px 14px 10px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 2px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 3H2l8 9.5V19l4 2v-8.5z" />
</svg>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Precisa da sua atenção
</span>
<span style={{ fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{at.sub}
</span>
</div>
{(at.vazio) ? (<>
<span style={{ display: "block", padding: "10px 2px", fontSize: "12.5px", color: "#8b949e" }}>
Nada pendente. Carteira em dia.
</span>
</>) : null}
{(at.cards ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "11px 12px", borderRadius: "12px", background: "#fafaf8", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<span style={estilo(c.icoSt)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={c.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
<button onClick={c.abrir} style={{ border: "0", background: "transparent", padding: "0", fontSize: "13px", fontWeight: "700", color: "#12171d", cursor: "pointer", textAlign: "left" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
{c.nome}
</button>
<span style={estilo(c.catSt)}>
{c.cat}
</span>
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#1f252c", fontWeight: "500" }}>
{c.tag}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", textWrap: "pretty" }}>
{c.desc}
</span>
</span>
<span style={{ flex: "0 0 auto", fontSize: "12px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{c.mrr}
</span>
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
{(c.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} style={estilo(ac.st)}>
{ac.l}
</button>
</Fragment>
))}
<button onClick={c.resolver} title="Marcar como tratado" style={{ height: "28px", padding: "0 8px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#8b949e", cursor: "pointer" }} className={[hover("color:#12171d")].filter(Boolean).join(" ")}>
Tratado
</button>
</div>
</div>
</Fragment>
))}
{(at.temMais) ? (<>
<button onClick={ir.atencao} style={{ alignSelf: "flex-start", height: "28px", padding: "0 4px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }}>
{at.maisTxt}
</button>
</>) : null}
</section>
<section data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "14px 14px 10px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 2px", marginBottom: "4px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Atividades recentes
</span>
<button onClick={ir.atividades} style={{ height: "26px", padding: "0 9px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Ver todas
</button>
</div>
{(rec ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<button onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 -6px", width: "calc(100% + 12px)", padding: "8px 6px", borderRadius: "10px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={estilo(r.ico)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={r.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.s}
</span>
</span>
<span style={{ flex: "0 0 auto", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{r.q}
</span>
</button>
</Fragment>
))}
</section>
<section data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M17 8l4 4-4 4M3 12h18" />
</svg>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Entrando no CS
</span>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{hand.sub}
</span>
</div>
{(hand.vazio) ? (<>
<span style={{ display: "block", padding: "6px 2px", fontSize: "12.5px", color: "#8b949e" }}>
Ninguém em onboarding agora.
</span>
</>) : null}
{(hand.itens ?? []).map((hd: any, i1: number) => (
<Fragment key={hd?.id ?? hd?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", boxShadow: "inset 0 1px 0 #f3f5f5" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{hd.nome}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{hd.s}
</span>
</span>
<button onClick={hd.handoff} style={estilo(hd.st)}>
{hd.l}
</button>
</div>
</Fragment>
))}
</section>
</div>
</div>
</>) : null}
{(vis.carteira) ? (<>
<section data-in="rise" style={{ minWidth: "0", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "16px 20px 10px" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Carteira
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c" }}>
{car.sub}
</span>
</span>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "34px", flex: "0 1 260px", minWidth: "160px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={car.q} onChange={car.setQ} placeholder="Buscar cliente" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0" }} />
</div>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "0 20px 14px" }}>
{(car.views ?? []).map((vw: any, i1: number) => (
<Fragment key={vw?.id ?? vw?.chave ?? i1}>
<button onClick={vw.onClick} style={estilo(vw.style)}>
{vw.l}
<span style={estilo(vw.nSt)}>
{vw.n}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "1180px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(210px,1.5fr) 130px 100px 130px minmax(150px,1fr) 120px 120px minmax(170px,1.1fr) 120px", gap: "12px", alignItems: "center", padding: "11px 20px", background: "#fafaf8", boxShadow: "inset 0 1px 0 #eef1f1,inset 0 -1px 0 #eef1f1", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
<span>
Cliente
</span>
<span>
Produtos
</span>
<span style={{ textAlign: "right" }}>
MRR
</span>
<span>
CS
</span>
<span>
Riscos
</span>
<span>
Financeiro
</span>
<span>
Última interação
</span>
<span>
Próxima ação
</span>
<span>
Renovação
</span>
</div>
<div data-stagger="25">
{(car.linhas ?? []).map((ln: any, i1: number) => (
<Fragment key={ln?.id ?? ln?.chave ?? i1}>
<div data-in="fade" style={{ display: "grid", gridTemplateColumns: "minmax(210px,1.5fr) 130px 100px 130px minmax(150px,1fr) 120px 120px minmax(170px,1.1fr) 120px", gap: "12px", alignItems: "center", minHeight: "58px", padding: "8px 20px", boxShadow: "inset 0 -1px 0 #f1f3f3", fontSize: "12.5px" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<button onClick={ln.abrir} style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9px", display: "grid", placeItems: "center", fontSize: "10px", fontWeight: "700", background: "#12171d", color: "#fff" }}>
{ln.ini}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.nome}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.seg}
</span>
</span>
</button>
<span>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#1f252c", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
{ln.prod}
</span>
</span>
<span style={{ textAlign: "right", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{ln.mrr}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
<span style={estilo(ln.csAv)}>
{ln.csIni}
</span>
<span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1f252c" }}>
{ln.cs}
</span>
</span>
<span style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
{(ln.riscos ?? []).map((rk: any, i2: number) => (
<Fragment key={rk?.id ?? rk?.chave ?? i2}>
<span style={estilo(rk.st)}>
{rk.l}
</span>
</Fragment>
))}
{(ln.semRisco) ? (<>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
—
</span>
</>) : null}
</span>
<span style={estilo(ln.finSt)}>
<span style={estilo(ln.finDot)} />
{ln.fin}
</span>
<span style={estilo(ln.ultSt)}>
{ln.ult}
</span>
<button onClick={ln.proxClick} style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left", fontSize: "12.5px", color: "#12171d" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fe4f2b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
<span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.prox}
</span>
</button>
<span style={estilo(ln.renSt)}>
{ln.ren}
</span>
</div>
</Fragment>
))}
</div>
{(car.vazio) ? (<>
<div style={{ padding: "34px", textAlign: "center", fontSize: "13px", color: "#67787c" }}>
Nenhum cliente nessa visão.
</div>
</>) : null}
</div>
</div>
</section>
</>) : null}
{(vis.renov) ? (<>
<div data-in="rise" style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))" }}>
{(ren.kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<div style={{ padding: "14px 16px", background: "#fff", borderRadius: "14px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04)", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12px", color: "#67787c" }}>
{k.l}
</span>
<span style={estilo(k.vStyle)}>
{k.v}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.s}
</span>
</div>
</Fragment>
))}
</div>
<div data-r="board" style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "6px", alignItems: "flex-start" }}>
{(ren.colunas ?? []).map((col: any, i1: number) => (
<Fragment key={col?.id ?? col?.chave ?? i1}>
<div data-r="coluna" style={{ flex: "0 0 272px", minWidth: "0", display: "flex", flexDirection: "column", gap: "8px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 4px" }}>
<span style={estilo(col.dot)} />
<span style={{ flex: "1", fontSize: "12.5px", fontWeight: "700", color: "#12171d" }}>
{col.l}
</span>
<span style={{ fontSize: "11.5px", color: "#67787c", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{col.tot}
</span>
</div>
<span style={{ fontSize: "11px", color: "#8b949e", padding: "0 4px", lineHeight: "1.4" }}>
{col.s}
</span>
{(col.vazia) ? (<>
<div style={{ padding: "18px 12px", borderRadius: "12px", border: "1.5px dashed #e3e7e8", textAlign: "center", fontSize: "12px", color: "#8b949e" }}>
Ninguém aqui
</div>
</>) : null}
{(col.cards ?? []).map((c: any, i2: number) => (
<Fragment key={c?.id ?? c?.chave ?? i2}>
<div data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "9px", padding: "13px", background: "#fff", borderRadius: "14px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
<button onClick={c.abrir} style={{ flex: "1", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left", fontSize: "13.5px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
{c.nome}
</button>
<span style={estilo(c.diasSt)}>
{c.dias}
</span>
</div>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{c.s}
</span>
<div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px" }}>
<span style={{ color: "#67787c" }}>
Renova {c.data}
</span>
<strong style={{ color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{c.mrr}
</strong>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
{(c.checks ?? []).map((ck: any, i3: number) => (
<Fragment key={ck?.id ?? ck?.chave ?? i3}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11.5px", color: "#4a5560" }}>
<span style={estilo(ck.st)}>
{(ck.ok) ? (<>
<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
{ck.l}
</span>
</Fragment>
))}
</div>
<button onClick={c.acao} style={estilo(c.acaoSt)}>
{c.acaoL}
</button>
</div>
</Fragment>
))}
</div>
</Fragment>
))}
</div>
</>) : null}
{(vis.play) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
<section data-in="rise" style={{ flex: "1.4 1 480px", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
{(pbs.grupos ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<span style={{ display: "block", padding: "6px 4px 0", fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
{g.l}
</span>
<div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))" }}>
{(g.itens ?? []).map((p: any, i2: number) => (
<Fragment key={p?.id ?? p?.chave ?? i2}>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", background: "#fff", borderRadius: "14px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={estilo(p.ico)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={p.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
{p.nome}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c" }}>
{p.gatilho}
</span>
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{p.n}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
{(p.passos ?? []).map((ps: any, i3: number) => (
<Fragment key={ps?.id ?? ps?.chave ?? i3}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#4a5560" }}>
<span style={{ flex: "0 0 auto", minWidth: "34px", height: "18px", padding: "0 5px", borderRadius: "5px", display: "grid", placeItems: "center", background: "#f3f4f4", fontSize: "10.5px", fontWeight: "700", color: "#1f252c", fontVariantNumeric: "tabular-nums" }}>
{ps.q}
</span>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ps.t}
</span>
<span style={{ fontSize: "11px", color: "#8b949e" }}>
{ps.tipo}
</span>
</span>
</Fragment>
))}
</div>
<button onClick={p.iniciar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "32px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 3l14 9-14 9z" />
</svg>
Iniciar para um cliente
</button>
</div>
</Fragment>
))}
</div>
</Fragment>
))}
</section>
<section data-in="rise" style={{ flex: "1 1 320px", minWidth: "0", display: "flex", flexDirection: "column", gap: "8px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", color: "#12171d" }}>
Em andamento
</span>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{runs.sub}
</span>
</div>
{(runs.vazio) ? (<>
<span style={{ display: "block", padding: "10px 2px", fontSize: "12.5px", color: "#8b949e", lineHeight: "1.5" }}>
Nenhum playbook rodando. Cada passo vira uma atividade no motor de Atividades.
</span>
</>) : null}
{(runs.lista ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 0", boxShadow: "inset 0 1px 0 #f3f5f5" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.pb}
</span>
<span style={estilo(r.stSt)}>
{r.st}
</span>
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
{r.cliente} · iniciado {r.inicio} · {r.prog}
</span>
<span style={{ display: "block", height: "4px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(r.barra)} />
</span>
<div style={{ display: "flex", gap: "6px" }}>
<button onClick={r.verAtv} style={{ height: "26px", padding: "0 9px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
Ver atividades
</button>
<button onClick={r.abrir} style={{ height: "26px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }}>
Cliente 360
</button>
</div>
</div>
</Fragment>
))}
</section>
</div>
</>) : null}
</div>
</div>
{(mP.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(560px,100%)", maxHeight: "100%", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
Iniciar playbook
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
Cada passo vira uma atividade de CS ligada ao cliente
</span>
</span>
<button onClick={fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Cliente
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<select value={mP.cli} onChange={mP.setCli} style={{ width: "100%", height: "38px", padding: "0 8px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }}>
<option value="">
Escolher cliente
</option>
{(mP.clientes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<option value={o.v}>
{o.l}
</option>
</Fragment>
))}
</select>
</label>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Playbook
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "5px", maxHeight: "220px", overflowY: "auto" }}>
{(mP.opcoes ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<button onClick={op.onClick} style={estilo(op.style)}>
<span style={estilo(op.radio)} />
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{op.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{op.s}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Responsável
</span>
<select value={mP.resp} onChange={mP.setResp} style={{ width: "100%", height: "38px", padding: "0 8px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }}>
{(mP.equipe ?? []).map((eq: any, i1: number) => (
<Fragment key={eq?.id ?? eq?.chave ?? i1}>
<option value={eq}>
{eq}
</option>
</Fragment>
))}
</select>
</label>
{(mP.temPrev) ? (<>
<div style={{ padding: "11px 12px", borderRadius: "10px", background: "#fafaf8", boxShadow: "inset 0 0 0 1px #eef1f1", display: "flex", flexDirection: "column", gap: "5px" }}>
<span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Vai criar
</span>
{(mP.prev ?? []).map((pv: any, i1: number) => (
<Fragment key={pv?.id ?? pv?.chave ?? i1}>
<span style={{ display: "flex", gap: "8px", fontSize: "12.5px", color: "#1f252c" }}>
<span style={{ flex: "0 0 auto", minWidth: "64px", fontWeight: "600", color: "#c2330f", fontVariantNumeric: "tabular-nums" }}>
{pv.q}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
{pv.t}
</span>
</span>
</Fragment>
))}
</div>
</>) : null}
{(mP.temErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
{mP.erro}
</span>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafaf8" }}>
<button onClick={fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={mP.salvar} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Iniciar playbook
</button>
</div>
</div>
</div>
</>) : null}
{(mX.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(520px,100%)", maxHeight: "100%", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
Sinalizar expansão
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
Cria a oportunidade no Pipeline comercial. O closer conduz; o CS acompanha.
</span>
</span>
<button onClick={fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Cliente
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<select value={mX.cli} onChange={mX.setCli} style={{ width: "100%", height: "38px", padding: "0 8px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }}>
<option value="">
Escolher cliente
</option>
{(mX.clientes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<option value={o.v}>
{o.l}
</option>
</Fragment>
))}
</select>
</label>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Produto
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(mX.fams ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onClick={fm.onClick} style={estilo(fm.style)}>
{fm.l}
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Tipo
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(mX.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={estilo(tp.style)}>
{tp.l}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Closer
</span>
<select value={mX.closer} onChange={mX.setCloser} style={{ width: "100%", height: "38px", padding: "0 8px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }}>
{(mX.equipe ?? []).map((eq: any, i1: number) => (
<Fragment key={eq?.id ?? eq?.chave ?? i1}>
<option value={eq}>
{eq}
</option>
</Fragment>
))}
</select>
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Timing
</span>
<select value={mX.timing} onChange={mX.setTiming} style={{ width: "100%", height: "38px", padding: "0 8px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }}>
<option value="Agora">
Agora
</option>
<option value="Este mês">
Este mês
</option>
<option value="Na renovação">
Na renovação
</option>
</select>
</label>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Contexto para o closer
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<textarea value={mX.ctx} onChange={mX.setCtx} rows={3} placeholder="Ex: pediu mais 15 usuários para a nova filial; decisor é o diretor de operações" style={{ width: "100%", resize: "vertical", padding: "9px 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", lineHeight: "1.45" }} />
</label>
{(mX.temErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
{mX.erro}
</span>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafaf8" }}>
<button onClick={fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={mX.salvar} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Criar oportunidade · via CS
</button>
</div>
</div>
</div>
</>) : null}
</div>


    </>
  );
}
