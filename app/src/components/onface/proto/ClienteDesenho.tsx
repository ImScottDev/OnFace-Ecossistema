"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Cliente.dc.html
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
import "./ClienteDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeClienteDesenho {
  abas: any;
  acoes: any;
  andSub: any;
  andamento: any;
  cab: any;
  crossTxt: any;
  ctr: any;
  docs: any;
  emp: any;
  fams: any;
  fechar: any;
  fin: any;
  g: any;
  hero: any;
  hist: any;
  ir: any;
  mB: any;
  mD: any;
  mP: any;
  menu: any;
  nota: any;
  nv: any;
  parar: any;
  pesSub: any;
  pesVerTodas: any;
  pessoas: any;
  pessoasTop: any;
  prodSub: any;
  prox: any;
  resp: any;
  saude: any;
  semAnd: any;
  semProx: any;
  stripe: any;
  vis: any;
}

export function ClienteDesenho(vals: ValoresDeClienteDesenho) {
  const { abas, acoes, andSub, andamento, cab, crossTxt, ctr, docs, emp, fams, fechar, fin, g, hero, hist, ir, mB, mD, mP, menu, nota, nv, parar, pesSub, pesVerTodas, pessoas, pessoasTop, prodSub, prox, resp, saude, semAnd, semProx, stripe, vis } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: "14px 14px 22px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<section data-in="rise" style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "18px 24px", padding: "20px 22px 16px" }}>
<div style={{ flex: "1 1 360px", minWidth: "0", display: "flex", alignItems: "center", gap: "16px" }}>
<span style={{ position: "relative", flex: "0 0 auto", width: "62px", height: "62px", borderRadius: "17px", display: "grid", placeItems: "center", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "21px", fontWeight: "800", letterSpacing: "-.03em", boxShadow: "0 14px 28px -16px rgba(18,23,29,.6)" }}>
{cab.ini}
<span style={{ position: "absolute", right: "-3px", bottom: "-3px", width: "15px", height: "15px", borderRadius: "9999px", background: "#fe4f2b", boxShadow: "0 0 0 3px #fff" }} />
</span>
<div style={{ minWidth: "0", display: "flex", flexDirection: "column", gap: "6px" }}>
<div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 10px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "26px", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.05", color: "#12171d" }}>
{cab.nome}
</span>
<span style={estilo(cab.stStyle)}>
<span style={estilo(cab.stDot)} />
{cab.st}
</span>
</div>
<span style={{ fontSize: "13px", color: "#4a5560", lineHeight: "1.4" }}>
{cab.meta}
</span>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#fe4f2b", color: "#fff", fontSize: "11.5px", fontWeight: "600" }}>
Cliente
</span>
{(cab.tags ?? []).map((tg: any, i1: number) => (
<Fragment key={tg?.id ?? tg?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#1f252c", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
{tg.l}
</span>
</Fragment>
))}
</div>
</div>
</div>
<button data-c360-flut="1" onClick={resp.abrir} title="Editar responsável e contato principal" data-r="esconde-mobile" style={{ flex: "0 1 auto", display: "flex", alignItems: "center", gap: "20px", padding: "8px 12px", borderRadius: "12px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", boxShadow: "inset 0 0 0 1px #eef1f1" }} className={[hover("background:#fafaf8;box-shadow:inset 0 0 0 1px #dbdede")].filter(Boolean).join(" ")}>
<span style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#8b949e" }}>
Customer Success
</span>
<span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "#12171d", color: "#fff", fontSize: "11px", fontWeight: "700" }}>
{cab.csmIni}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
{cab.csm}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
Closer: {cab.closer}
</span>
</span>
</span>
</span>
<span style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#8b949e" }}>
Contato principal
</span>
<span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "#fff6f4", color: "#c2330f", fontSize: "11px", fontWeight: "700" }}>
{cab.princIni}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
{cab.princ}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
{cab.princCargo}
</span>
</span>
</span>
</span>
<span style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", display: "grid", placeItems: "center", color: "#67787c", background: "#f3f4f4" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
</svg>
</span>
</button>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<button data-c360-flut="1" onClick={menu.abrir} title="Mais ações" style={{ width: "36px", height: "36px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
<circle cx="5" cy="12" r="1.8" />
<circle cx="12" cy="12" r="1.8" />
<circle cx="19" cy="12" r="1.8" />
</svg>
</button>
<button onClick={acoes.registrar} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
Nova atividade
</button>
<button onClick={acoes.agendar} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#12171d", fontSize: "13px", fontWeight: "600", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="m16 10 5-3v10l-5-3zM4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
</svg>
Agendar reunião
</button>
<button onClick={acoes.oportunidade} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#d93c1a", fontSize: "13px", fontWeight: "600", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Nova oportunidade
</button>
</div>
</div>
<div style={{ display: "flex", gap: "24px", padding: "0 22px", overflowX: "auto", boxShadow: "inset 0 1px 0 #eef1f1" }}>
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
</section>
{(vis.geral) ? (<>
<div data-in="rise" style={{ position: "relative", overflow: "hidden", display: "flex", flexWrap: "wrap", gap: "22px 28px", padding: "22px 24px", borderRadius: "18px", background: "#12171d", color: "#fff", boxShadow: "0 1px 2px rgba(12,16,21,.12)" }}>
<span style={{ position: "absolute", left: "30%", top: "-130px", width: "460px", height: "260px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".12", filter: "blur(70px)", pointerEvents: "none" }} />
<div style={{ position: "relative", flex: "1 1 200px", minWidth: "0", display: "flex", flexDirection: "column" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
MRR atual
</span>
<span style={{ display: "block", marginTop: "10px", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(32px,3.2vw,42px)", fontWeight: "800", letterSpacing: "-.045em", lineHeight: "1", fontVariantNumeric: "tabular-nums" }}>
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
<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto", paddingTop: "18px" }}>
{(hero.fams ?? []).map((hf: any, i1: number) => (
<Fragment key={hf?.id ?? hf?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a3aab0" }}>
<span style={estilo(hf.dot)} />
<span style={{ flex: "1", minWidth: "0" }}>
{hf.l}
</span>
<strong style={{ color: "#fff", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
{hf.v}
</strong>
</span>
</Fragment>
))}
</div>
</div>
<div onMouseLeave={g.sair} style={{ position: "relative", flex: "3 1 420px", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 14px" }}>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "rgba(255,255,255,.06)" }}>
{(g.modos ?? []).map((gm: any, i1: number) => (
<Fragment key={gm?.id ?? gm?.chave ?? i1}>
<button onClick={gm.onClick} style={estilo(gm.style)}>
{gm.l}
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1" }} />
{(g.legenda ?? []).map((lg: any, i1: number) => (
<Fragment key={lg?.id ?? lg?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "11.5px", color: "#a3aab0", whiteSpace: "nowrap" }}>
<span style={estilo(lg.dot)} />
{lg.l}
</span>
</Fragment>
))}
</div>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{g.pergunta}
</span>
<div style={{ display: "flex", gap: "8px" }}>
<div style={{ position: "relative", flex: "0 0 auto", width: "44px", height: "150px" }}>
{(g.yl ?? []).map((yl: any, i1: number) => (
<Fragment key={yl?.id ?? yl?.chave ?? i1}>
<span style={estilo(yl.st)}>
{yl.l}
</span>
</Fragment>
))}
</div>
<div style={{ position: "relative", flex: "1", minWidth: "0" }}>
<div style={{ position: "relative", height: "150px" }}>
<svg viewBox="0 0 600 140" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
<defs>
<linearGradient id="c360Fill" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#fe4f2b" stopOpacity=".38" />
<stop offset="1" stopColor="#fe4f2b" stopOpacity="0" />
</linearGradient>
</defs>
<path d="M0 8H600M0 40H600M0 72H600M0 104H600" stroke="#1f252c" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
<path d="M0 139.5H600" stroke="#2a3139" strokeWidth="1" vectorEffect="non-scaling-stroke" />
{(g.ehTotal) ? (<>
<path d={g.dArea} fill="url(#c360Fill)" style={{ transformOrigin: "50% 100%", animation: "fcArea 1s .3s cubic-bezier(.16,1,.3,1) both" }} />
<path d={g.dAnt} fill="none" stroke="#67787c" strokeWidth="1.6" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" style={{ animation: "fcArea .9s .5s cubic-bezier(.16,1,.3,1) both" }} />
<path d={g.dLinha} pathLength="1" fill="none" stroke="#fe4f2b" strokeWidth="2.4" strokeLinejoin="round" strokeDasharray="1" vectorEffect="non-scaling-stroke" style={{ animation: "fcDraw 1.3s .15s cubic-bezier(.65,0,.35,1) both" }} />
</>) : null}
{(g.ehFam) ? (<>
{(g.camadas ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<path d={cm.d} fill={cm.cor} style={estilo(cm.st)} />
</Fragment>
))}
</>) : null}
<path d={g.dGuia} stroke="#fe4f2b" strokeOpacity=".5" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
</svg>
<span style={estilo(g.ponto)} />
<div style={{ position: "absolute", inset: "0", display: "flex" }}>
{(g.alvos ?? []).map((av: any, i1: number) => (
<Fragment key={av?.id ?? av?.chave ?? i1}>
<span onMouseEnter={av.entrar} style={{ flex: "1", height: "100%", cursor: "crosshair" }} />
</Fragment>
))}
</div>
<div style={estilo(g.tipStyle)}>
<span style={{ display: "block", fontSize: "10.5px", color: "#8b949e" }}>
{g.tipT}
</span>
{(g.tipL ?? []).map((tl: any, i1: number) => (
<Fragment key={tl?.id ?? tl?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "12px", color: "#d7dbde", whiteSpace: "nowrap" }}>
<span style={estilo(tl.dot)} />
{tl.l}
<strong style={{ marginLeft: "auto", paddingLeft: "12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", color: "#fff", fontVariantNumeric: "tabular-nums" }}>
{tl.v}
</strong>
</span>
</Fragment>
))}
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #2a3139", fontSize: "12px", color: "#d7dbde", whiteSpace: "nowrap" }}>
Total
<strong style={{ marginLeft: "auto", paddingLeft: "12px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", color: "#fff", fontVariantNumeric: "tabular-nums" }}>
{g.tipTot}
</strong>
</span>
<span style={estilo(g.tipDStyle)}>
{g.tipD}
</span>
</div>
</div>
<div style={{ position: "relative", height: "16px", marginTop: "7px" }}>
{(g.rot ?? []).map((rt: any, i1: number) => (
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
<div style={{ position: "relative", flex: "1.15 1 250px", minWidth: "0", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "1px", borderRadius: "12px", background: "#2a3139", overflow: "hidden", alignSelf: "stretch" }}>
{(hero.tiles ?? []).map((tl: any, i1: number) => (
<Fragment key={tl?.id ?? tl?.chave ?? i1}>
<button onClick={tl.onClick} style={{ padding: "13px 14px", border: "0", background: "#161c22", color: "#fff", textAlign: "left", cursor: "pointer", minWidth: "0", display: "flex", flexDirection: "column", justifyContent: "center" }} className={[hover("background:#1b2229")].filter(Boolean).join(" ")}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{tl.l}
</span>
<span style={estilo(tl.vStyle)}>
{tl.v}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{tl.s}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div data-stagger="50" style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "stretch" }}>
<section data-in="rise" style={{ flex: "1.4 1 400px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7zM3.3 7 12 12l8.7-5M12 22V12" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Produtos contratados
</span>
<span style={{ fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
{prodSub}
</span>
<button onClick={ir.produtos} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Detalhes
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
{(fams ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "11px 12px", background: "#fafaf8", boxShadow: "inset 0 -1px 0 #eef1f1" }}>
<span style={estilo(f.tile)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={f.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
{f.l}
</span>
<span style={estilo(f.stStyle)}>
{f.st}
</span>
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c" }}>
{f.sub}
</span>
</span>
<span style={{ textAlign: "right" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{f.mrr}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
por mês
</span>
</span>
</div>
{(f.itens ?? []).map((it: any, i2: number) => (
<Fragment key={it?.id ?? it?.chave ?? i2}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 92px", gap: "12px", alignItems: "center", padding: "9px 12px", boxShadow: "inset 0 -1px 0 #f3f5f5", fontSize: "12.5px" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.qn}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.tipoTxt}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ flex: "1", height: "4px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(it.barra)} />
</span>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.usoTxt}
</span>
</span>
<span style={{ textAlign: "right", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.sub}
</span>
</div>
</Fragment>
))}
{(f.temDesc) ? (<>
<div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", fontSize: "12px", color: "#67787c" }}>
<span>
Desconto negociado
</span>
<span style={{ fontWeight: "600", color: "#c2330f", fontVariantNumeric: "tabular-nums" }}>
{f.desc}
</span>
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</section>
<section data-in="rise" style={{ flex: "1 1 290px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Saúde da conta
</span>
<span style={estilo(saude.selo)}>
{saude.l}
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
<span style={{ position: "relative", flex: "0 0 auto", width: "82px", height: "82px" }}>
<svg width="82" height="82" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
<circle cx="42" cy="42" r="35" fill="none" stroke="#f3f4f4" strokeWidth="8" />
<circle cx="42" cy="42" r="35" fill="none" stroke="#fe4f2b" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={saude.da} style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.16,1,.3,1)" }} />
</svg>
<span style={{ position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "22px", fontWeight: "800", letterSpacing: "-.03em", lineHeight: "1", color: "#12171d" }}>
{saude.n}
</span>
<span style={{ marginTop: "2px", fontSize: "10px", color: "#8b949e" }}>
de 100
</span>
</span>
</span>
<span style={{ minWidth: "0", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{saude.txt}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(saude.fatores ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "9px 0", boxShadow: "inset 0 1px 0 #f3f5f5" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9px", display: "grid", placeItems: "center", background: "#f3f4f4", color: "#1f252c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={f.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{f.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c" }}>
{f.s}
</span>
</span>
<span style={estilo(f.dot)} />
</div>
</Fragment>
))}
</div>
</section>
<section data-in="rise" style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Financeiro
</span>
<button onClick={stripe.abrir} title="Abrir cliente no Stripe" style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Stripe
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 17 17 7M9 7h8v8" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
Em aberto
</span>
<span style={estilo(fin.abertoStyle)}>
{fin.aberto}
</span>
<span style={estilo(fin.abertoSubStyle)}>
{fin.abertoSub}
</span>
</span>
{(fin.temCobrar) ? (<>
<button onClick={fin.cobrar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
</svg>
Link de cobrança
</button>
</>) : null}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(fin.ultimas ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<button onClick={ir.financeiro} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 0", border: "0", background: "transparent", boxShadow: "inset 0 1px 0 #f3f5f5", cursor: "pointer", textAlign: "left", fontSize: "12.5px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", color: "#12171d", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f.comp}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e" }}>
{f.vencTxt}
</span>
</span>
<span style={{ fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{f.valor}
</span>
<span style={estilo(f.stStyle)}>
<span style={estilo(f.dot)} />
{f.st}
</span>
</button>
</Fragment>
))}
</div>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "auto", fontSize: "11px", color: "#8b949e" }}>
<span style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "#1f7256" }} />
{stripe.sync}
</span>
</section>
</div>
<div data-stagger="50" style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "stretch" }}>
<section data-in="rise" style={{ flex: "1.3 1 400px", minWidth: "0", display: "flex", flexDirection: "column", padding: "14px 16px 10px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 21v-2a4 4 0 0 0-3-3.9" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Pessoas da conta
</span>
<button onClick={acoes.novaPessoa} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Adicionar pessoa
</button>
</div>
{(pessoasTop ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<div style={estilo(p.linha)}>
<button onClick={p.abrir} title="Abrir pessoa" style={{ flex: "1 1 200px", minWidth: "0", display: "flex", alignItems: "center", gap: "11px", padding: "4px 6px 4px 0", margin: "-4px 0", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "11px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{p.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
{(p.ehPrincipal) ? (<>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "19px", padding: "0 7px", borderRadius: "5px", background: "#fff6f4", color: "#c2330f", fontSize: "10.5px", fontWeight: "700" }}>
Principal
</span>
</>) : null}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.cargoPapel}
</span>
</span>
</button>
<span style={{ flex: "0 0 auto", display: "flex", gap: "4px" }}>
{(p.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} title={ac.titulo} style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#4a5560", display: "grid", placeItems: "center", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ac.d} />
</svg>
</button>
</Fragment>
))}
</span>
</div>
</Fragment>
))}
<button onClick={ir.pessoas} style={{ alignSelf: "flex-start", marginTop: "6px", height: "28px", padding: "0", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }}>
{pesVerTodas}
</button>
</section>
<section data-in="rise" style={{ flex: "1 1 320px", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Contratos
</span>
<button onClick={ir.documentos} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Documentos
</button>
</div>
{(ctr ?? []).map((ct: any, i1: number) => (
<Fragment key={ct?.id ?? ct?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "9px", padding: "12px", borderRadius: "12px", background: "#fafaf8", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
{ct.nome}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c" }}>
{ct.cod}
</span>
</span>
<span style={estilo(ct.stStyle)}>
{ct.st}
</span>
</div>
<span style={{ display: "block", height: "4px", borderRadius: "9999px", background: "#e9ecec", overflow: "hidden" }}>
<span style={estilo(ct.barra)} />
</span>
<span style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11.5px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
<span>
{ct.iniTxt}
</span>
<span style={estilo(ct.renStyle)}>
{ct.renTxt}
</span>
</span>
{ct.arq ? (<button onClick={ct.abrirDoc} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "8px 10px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1.5px #fe4f2b")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", display: "grid", placeItems: "center", background: "#fff6f4", color: "#c2330f", fontSize: "8.5px", fontWeight: "800", letterSpacing: ".02em" }}>
PDF
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ct.arq}
</span>
<span style={{ fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{ct.assin}
</span>
</button>) : null}
</div>
</Fragment>
))}
</section>
<section data-in="rise" style={{ flex: "1 1 290px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Empresa
</span>
<button onClick={emp.abrir} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Abrir empresa
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 17 17 7M9 7h8v8" />
</svg>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "9px 14px", fontSize: "12.5px" }}>
{(emp.fatos ?? []).map((ft: any, i1: number) => (
<Fragment key={ft?.id ?? ft?.chave ?? i1}>
<span style={{ color: "#8b949e", whiteSpace: "nowrap" }}>
{ft.l}
</span>
<span style={{ color: "#1f252c", fontWeight: "500", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ft.v}
</span>
</Fragment>
))}
</div>
</section>
</div>
<div data-stagger="50" style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "stretch" }}>
<section data-in="rise" style={{ flex: "1.7 1 480px", minWidth: "0", display: "flex", flexDirection: "column", gap: "8px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Histórico recente
</span>
<button onClick={ir.historico} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Ver tudo
</button>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(hist.top ?? []).map((e: any, i1: number) => (
<Fragment key={e?.id ?? e?.chave ?? i1}>
<div style={{ position: "relative", display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", gap: "11px", alignItems: "start", padding: "8px 0" }}>
<span style={estilo(e.linha)} />
<span style={estilo(e.marca)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={e.d} />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{e.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c", textWrap: "pretty" }}>
{e.meta}
</span>
</span>
<span style={{ paddingTop: "2px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{e.quando}
</span>
</div>
</Fragment>
))}
</div>
</section>
<div style={{ flex: "1 1 320px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
<section data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Próximas atividades
</span>
<button onClick={acoes.registrar} title="Nova atividade" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
{(semProx) ? (<>
<span style={{ display: "block", padding: "12px 2px", fontSize: "12.5px", color: "#8b949e", lineHeight: "1.5" }}>
Nada agendado com a conta. Uma revisão de uso é um bom próximo passo.
</span>
</>) : null}
{(prox ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={{ display: "flex", alignItems: "center", gap: "11px", margin: "0 -8px", width: "calc(100% + 16px)", padding: "8px", borderRadius: "10px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={estilo(a.data)}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
{a.dia}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "10.5px", opacity: ".8" }}>
{a.hora}
</span>
</span>
<span style={estilo(a.ico)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.s}
</span>
</span>
</button>
</Fragment>
))}
</section>
<section data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Em andamento
</span>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{andSub}
</span>
</div>
{(semAnd) ? (<>
<span style={{ display: "block", padding: "10px 2px", fontSize: "12.5px", color: "#8b949e", lineHeight: "1.5" }}>
Nenhuma oportunidade ou proposta aberta com a conta.
</span>
</>) : null}
{(andamento ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<button onClick={r.ir} style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 -8px", width: "calc(100% + 16px)", padding: "9px 8px", borderRadius: "10px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9px", display: "grid", placeItems: "center", background: "#fff6f4", color: "#c2330f" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={r.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.titulo}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.sub}
</span>
</span>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "9999px", background: "#eeeff3", color: "#1f252c", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" }}>
{r.status}
</span>
</button>
</Fragment>
))}
</section>
</div>
</div>
</>) : null}
{(vis.produtos) ? (<>
<div data-stagger="60" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
{(fams ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<section data-in="rise" style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "16px 20px" }}>
<span style={estilo(f.tileG)}>
<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={f.d} />
</svg>
</span>
<span style={{ flex: "1 1 220px", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{f.l}
</span>
<span style={estilo(f.stStyle)}>
{f.st}
</span>
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c" }}>
{f.contratoTxt}
</span>
</span>
<button onClick={f.upsell} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Adicionar licenças
</button>
<button onClick={f.upgrade} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", fontSize: "12.5px", fontWeight: "600", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 17 17 7M9 7h8v8" />
</svg>
Upgrade de plano
</button>
</div>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "760px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.6fr) 90px 80px minmax(130px,1fr) 110px 110px 100px", gap: "14px", padding: "10px 20px", background: "#fafaf8", boxShadow: "inset 0 1px 0 #eef1f1,inset 0 -1px 0 #eef1f1", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
<span>
Produto
</span>
<span>
Tipo
</span>
<span style={{ textAlign: "right" }}>
Qtd
</span>
<span>
Uso
</span>
<span style={{ textAlign: "right" }}>
Preço un.
</span>
<span style={{ textAlign: "right" }}>
Subtotal
</span>
<span>
Desde
</span>
</div>
{(f.itens ?? []).map((it: any, i2: number) => (
<Fragment key={it?.id ?? it?.chave ?? i2}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.6fr) 90px 80px minmax(130px,1fr) 110px 110px 100px", gap: "14px", alignItems: "center", minHeight: "54px", padding: "8px 20px", boxShadow: "inset 0 -1px 0 #f1f3f3", fontSize: "13px" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontWeight: "600", color: "#12171d" }}>
{it.nome}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e" }}>
{it.sku}
</span>
</span>
<span>
<span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 7px", borderRadius: "5px", background: "#eeeff3", color: "#1f252c", fontSize: "11px", fontWeight: "600" }}>
{it.tipo}
</span>
</span>
<span style={{ textAlign: "right", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{it.qtd}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", height: "5px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(it.barra)} />
</span>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{it.usoTxt}
</span>
</span>
<span style={{ textAlign: "right", color: "#4a5560", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.preco}
</span>
<span style={{ textAlign: "right", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.sub}
</span>
<span style={{ color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{it.desde}
</span>
</div>
</Fragment>
))}
<div style={{ display: "flex", justifyContent: "flex-end", gap: "28px", padding: "12px 20px", fontSize: "12.5px", color: "#4a5560", fontVariantNumeric: "tabular-nums", flexWrap: "wrap" }}>
<span>
Tabela 
<strong style={{ color: "#12171d" }}>
{f.raw}
</strong>
</span>
<span>
Desconto 
<strong style={{ color: "#c2330f" }}>
{f.desc}
</strong>
</span>
<span>
MRR 
<strong style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", color: "#12171d" }}>
{f.mrr}
</strong>
</span>
</div>
</div>
</div>
</section>
</Fragment>
))}
<button onClick={acoes.crossSell} style={{ display: "flex", alignItems: "center", gap: "14px", width: "100%", padding: "18px 20px", borderRadius: "16px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1.5px #f6d9cf", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "42px", height: "42px", borderRadius: "12px", display: "grid", placeItems: "center", background: "#fe4f2b", color: "#fff" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
Oferecer outro produto
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
{crossTxt}
</span>
</span>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
</>) : null}
{(vis.financeiro) ? (<>
<section data-in="rise" style={{ position: "relative", overflow: "hidden", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 26px", padding: "18px 22px", borderRadius: "16px", background: "#12171d", color: "#fff" }}>
<span style={{ position: "absolute", right: "-60px", top: "-90px", width: "260px", height: "200px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".16", filter: "blur(55px)", pointerEvents: "none" }} />
<div style={{ position: "relative", flex: "1 1 260px", minWidth: "0", display: "flex", alignItems: "center", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "11px", display: "grid", placeItems: "center", background: "rgba(255,255,255,.08)" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4" />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700" }}>
Cobrança via Stripe
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#a3aab0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{stripe.linha}
</span>
</span>
</div>
<div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,auto))", gap: "4px 22px", fontSize: "12px" }}>
{(stripe.fatos ?? []).map((sf: any, i1: number) => (
<Fragment key={sf?.id ?? sf?.chave ?? i1}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", color: "#8b949e" }}>
{sf.l}
</span>
<span style={{ display: "block", marginTop: "2px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap" }}>
{sf.v}
</span>
</span>
</Fragment>
))}
</div>
<div style={{ position: "relative", display: "flex", gap: "8px", flexWrap: "wrap" }}>
<button onClick={stripe.portal} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "rgba(255,255,255,.08)", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:rgba(255,255,255,.14)")].filter(Boolean).join(" ")}>
Copiar portal do cliente
</button>
<button onClick={stripe.abrir} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", color: "#12171d", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Abrir no Stripe
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 17 17 7M9 7h8v8" />
</svg>
</button>
</div>
</section>
<div data-stagger="40" style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))" }}>
{(fin.kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<div data-in="rise" style={{ padding: "15px 16px", background: "#fff", borderRadius: "14px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12px", color: "#67787c" }}>
{k.l}
</span>
<span style={estilo(k.vStyle)}>
{k.v}
</span>
<span style={{ display: "block", marginTop: "5px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.s}
</span>
</div>
</Fragment>
))}
</div>
<section data-in="rise" style={{ minWidth: "0", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "16px 20px 12px" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Faturas
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#67787c" }}>
{fin.sub}
</span>
</span>
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px" }}>
{(fin.filtros ?? []).map((ff: any, i1: number) => (
<Fragment key={ff?.id ?? ff?.chave ?? i1}>
<button onClick={ff.onClick} style={estilo(ff.style)}>
{ff.l}
</button>
</Fragment>
))}
</div>
<button onClick={fin.exportar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
Exportar CSV
</button>
</div>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "880px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(170px,1.3fr) 100px 120px 110px 120px minmax(250px,1.2fr)", gap: "14px", alignItems: "center", padding: "11px 20px", background: "#fafaf8", boxShadow: "inset 0 1px 0 #eef1f1,inset 0 -1px 0 #eef1f1", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
<span>
Competência
</span>
<span>
Vencimento
</span>
<span>
Valor
</span>
<span>
Pago em
</span>
<span>
Status
</span>
<span style={{ textAlign: "right" }}>
Ações
</span>
</div>
{(fin.linhas ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(170px,1.3fr) 100px 120px 110px 120px minmax(250px,1.2fr)", gap: "14px", alignItems: "center", minHeight: "56px", padding: "8px 20px", boxShadow: "inset 0 -1px 0 #f1f3f3", fontSize: "13px" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontWeight: "600", color: "#12171d" }}>
{f.comp}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f.ids}
</span>
</span>
<span style={{ color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{f.venc}
</span>
<span style={{ fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{f.valor}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{f.pago}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f.via}
</span>
</span>
<span>
<span style={estilo(f.stStyle)}>
<span style={estilo(f.dot)} />
{f.st}
</span>
</span>
<span style={{ display: "flex", justifyContent: "flex-end", gap: "6px", flexWrap: "wrap" }}>
{(f.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} title={ac.dica} style={estilo(ac.style)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={ac.d} />
</svg>
{ac.l}
</button>
</Fragment>
))}
</span>
</div>
</Fragment>
))}
{(fin.vazia) ? (<>
<div style={{ padding: "34px", textAlign: "center", fontSize: "13px", color: "#67787c" }}>
Nenhuma fatura com esse filtro.
</div>
</>) : null}
</div>
</div>
</section>
</>) : null}
{(vis.pessoas) ? (<>
<section data-in="rise" style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", padding: "14px 18px 8px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 21v-2a4 4 0 0 0-3-3.9" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
Pessoas da conta
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "12px", color: "#67787c" }}>
{pesSub}
</span>
</span>
<button onClick={acoes.novaPessoa} style={{ display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 14px", borderRadius: "9px", background: "#d93c1a", fontSize: "13px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Adicionar pessoa
</button>
</div>
{(pessoas ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<div style={estilo(p.linha)}>
<button onClick={p.abrir} title="Abrir pessoa" style={{ flex: "1 1 220px", minWidth: "0", display: "flex", alignItems: "center", gap: "11px", padding: "4px 6px 4px 0", margin: "-4px 0", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "12px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{p.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ fontSize: "13.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
{(p.ehPrincipal) ? (<>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "19px", padding: "0 7px", borderRadius: "5px", background: "#fff6f4", color: "#c2330f", fontSize: "10.5px", fontWeight: "700" }}>
Principal
</span>
</>) : null}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.cargo}
</span>
</span>
</button>
<span style={{ flex: "0 0 96px" }}>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#1f252c", fontSize: "11.5px", fontWeight: "600" }}>
{p.papel}
</span>
</span>
<span style={{ flex: "1 1 200px", minWidth: "0", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.email}
</span>
<span style={{ flex: "0 0 130px", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{p.tel}
</span>
<span style={{ flex: "0 0 96px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{p.ultimo}
</span>
<span style={{ flex: "0 0 auto", display: "flex", gap: "4px" }}>
{(p.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} title={ac.titulo} style={{ width: "30px", height: "30px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#4a5560", display: "grid", placeItems: "center", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ac.d} />
</svg>
</button>
</Fragment>
))}
<button onClick={p.tornarPrincipal} title={p.princDica} style={estilo(p.princStyle)}>
{p.princTxt}
</button>
</span>
</div>
</Fragment>
))}
</section>
</>) : null}
{(vis.documentos) ? (<>
<section data-in="rise" style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "16px 20px 12px" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
Documentos da conta
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#67787c" }}>
{docs.sub}
</span>
</span>
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px", flexWrap: "wrap" }}>
{(docs.filtros ?? []).map((df: any, i1: number) => (
<Fragment key={df?.id ?? df?.chave ?? i1}>
<button onClick={df.onClick} style={estilo(df.style)}>
{df.l}
</button>
</Fragment>
))}
</div>
<label style={{ display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 14px", borderRadius: "9px", background: "#d93c1a", fontSize: "13px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", cursor: "pointer" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
</svg>
Enviar arquivo
<input type="file" multiple={true} onChange={docs.enviar} style={{ display: "none" }} />
</label>
</div>
<div style={{ display: "flex", flexDirection: "column", padding: "0 12px 10px" }}>
{(docs.lista ?? []).map((d: any, i1: number) => (
<Fragment key={d?.id ?? d?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 8px", borderRadius: "10px", boxShadow: "inset 0 -1px 0 #f3f5f5" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={estilo(d.icoSt)}>
{d.ext}
</span>
<button onClick={d.abrir} style={{ flex: "1", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.nome}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.meta}
</span>
</button>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "5px", background: "#eeeff3", color: "#1f252c", fontSize: "11px", fontWeight: "600" }}>
{d.cat}
</span>
<button onClick={d.abrir} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", border: "0", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
{d.acao}
</button>
{(d.removivel) ? (<>
<button onClick={d.remover} title="Remover arquivo" style={estilo(d.remStyle)}>
{d.remTxt}
</button>
</>) : null}
</div>
</Fragment>
))}
{(docs.vazia) ? (<>
<div style={{ padding: "30px", textAlign: "center", fontSize: "13px", color: "#67787c" }}>
Nenhum documento nessa categoria.
</div>
</>) : null}
</div>
</section>
</>) : null}
{(vis.historico) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
<section data-in="rise" style={{ flex: "2 1 520px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderRadius: "12px", background: "#fafaf8", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<textarea value={nota.v} onChange={nota.set} placeholder="Escreva uma nota sobre a conta…" rows={2} style={{ width: "100%", resize: "vertical", minHeight: "52px", border: "0", outline: "0", background: "transparent", fontSize: "13.5px", lineHeight: "1.5", color: "#12171d" }} />
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "11.5px", color: "#8b949e" }}>
A nota entra no histórico da conta.
</span>
<button onClick={nota.salvar} style={estilo(nota.btn)}>
Salvar nota
</button>
</div>
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(hist.filtros ?? []).map((hf: any, i1: number) => (
<Fragment key={hf?.id ?? hf?.chave ?? i1}>
<button onClick={hf.onClick} style={estilo(hf.style)}>
{hf.l}
<span style={{ fontSize: "11px", fontWeight: "600", opacity: ".65" }}>
{hf.n}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(hist.lista ?? []).map((e: any, i1: number) => (
<Fragment key={e?.id ?? e?.chave ?? i1}>
<div style={{ position: "relative", display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", gap: "11px", alignItems: "start", padding: "9px 0" }}>
<span style={estilo(e.linha)} />
<span style={estilo(e.marca)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={e.d} />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{e.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c", textWrap: "pretty" }}>
{e.meta}
</span>
</span>
<span style={{ paddingTop: "2px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{e.quando}
</span>
</div>
</Fragment>
))}
{(hist.vazia) ? (<>
<div style={{ padding: "28px", textAlign: "center", fontSize: "13px", color: "#67787c" }}>
Nada nesse filtro ainda.
</div>
</>) : null}
</div>
</section>
<section data-in="rise" style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "6px", padding: "16px", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", color: "#12171d" }}>
Próximas atividades
</span>
</div>
{(semProx) ? (<>
<span style={{ display: "block", padding: "12px 2px", fontSize: "12.5px", color: "#8b949e" }}>
Nada agendado com a conta.
</span>
</>) : null}
{(prox ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={{ display: "flex", alignItems: "center", gap: "11px", margin: "0 -8px", width: "calc(100% + 16px)", padding: "8px", borderRadius: "10px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={estilo(a.data)}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
{a.dia}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "10.5px", opacity: ".8" }}>
{a.hora}
</span>
</span>
<span style={estilo(a.ico)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.s}
</span>
</span>
</button>
</Fragment>
))}
<div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
<button onClick={acoes.registrar} style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "34px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Nova atividade
</button>
<button onClick={acoes.agendar} style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "34px", borderRadius: "9px", border: "0", background: "#12171d", fontSize: "12.5px", fontWeight: "600", color: "#fff", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Agendar reunião
</button>
</div>
</section>
</div>
</>) : null}
</div>
</div>
{(menu.aberto) ? (<>
<div data-c360-flut="1" data-in="drop" style={estilo(menu.pos)}>
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
{(resp.aberto) ? (<>
<div data-c360-flut="1" data-in="drop" style={estilo(resp.pos)}>
<span style={{ display: "block", padding: "6px 8px 4px", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
Customer Success
</span>
{(resp.equipe ?? []).map((rq: any, i1: number) => (
<Fragment key={rq?.id ?? rq?.chave ?? i1}>
<button onClick={rq.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "7px 8px", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(rq.radio)} />
<span style={{ width: "26px", height: "26px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "#12171d", color: "#fff", fontSize: "9.5px", fontWeight: "700" }}>
{rq.ini}
</span>
<span style={{ fontSize: "13px", color: "#12171d" }}>
{rq.nome}
</span>
</button>
</Fragment>
))}
<span style={{ display: "block", height: "1px", margin: "6px 4px", background: "#eef1f1" }} />
<span style={{ display: "block", padding: "6px 8px 4px", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
Contato principal
</span>
{(resp.pessoas ?? []).map((rp: any, i1: number) => (
<Fragment key={rp?.id ?? rp?.chave ?? i1}>
<button onClick={rp.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "7px 8px", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(rp.radio)} />
<span style={{ width: "26px", height: "26px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "#eeeff3", color: "#4a5560", fontSize: "9.5px", fontWeight: "700" }}>
{rp.ini}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", color: "#12171d", whiteSpace: "nowrap" }}>
{rp.nome}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{rp.cargo}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
{(mB.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(480px,100%)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
Baixa manual de pagamento
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
{mB.sub}
</span>
</span>
<button onClick={fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<span style={{ display: "flex", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#fff6f4", fontSize: "12px", color: "#9c3210", lineHeight: "1.45" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
</svg>
A fatura será marcada como paga fora do Stripe (paid_out_of_band). Isso não pode ser desfeito por aqui.
</span>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Forma
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(mB.formas ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onClick={fm.onClick} style={estilo(fm.style)}>
{fm.l}
</button>
</Fragment>
))}
</div>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Data do pagamento
</span>
<input type="date" value={mB.data} onChange={mB.setData} style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Comprovante
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<label style={estilo(mB.arqStyle)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M21.4 11.1 12.2 20.3a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
</svg>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{mB.arqTxt}
</span>
<input type="file" accept="image/*,.pdf" onChange={mB.setArq} style={{ display: "none" }} />
</label>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Motivo
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<textarea value={mB.motivo} onChange={mB.setMotivo} rows={2} placeholder="Ex: cliente pagou por Pix direto na conta da Callface" style={{ width: "100%", resize: "vertical", padding: "9px 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", lineHeight: "1.45" }} />
</label>
{(mB.temErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
{mB.erro}
</span>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafaf8" }}>
<button onClick={fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={mB.salvar} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Confirmar baixa
</button>
</div>
</div>
</div>
</>) : null}
{(mD.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.5)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(680px,100%)", maxHeight: "100%", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", display: "grid", placeItems: "center", background: "#fff6f4", color: "#c2330f", fontSize: "9px", fontWeight: "800" }}>
PDF
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{mD.arq}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{mD.meta}
</span>
</span>
<button onClick={mD.baixar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
Baixar
</button>
<button onClick={fechar} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "22px", background: "#eeeff3" }}>
<div style={{ maxWidth: "560px", margin: "0 auto", padding: "34px 38px", background: "#fff", borderRadius: "6px", boxShadow: "0 10px 30px -18px rgba(18,23,29,.4)" }}>
<span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "800", letterSpacing: "-.02em", color: "#12171d" }}>
ON
<span style={{ color: "#fe4f2b" }}>
FACE
</span>
</span>
<span style={{ fontSize: "11px", color: "#8b949e" }}>
{mD.cod}
</span>
</span>
<span style={{ display: "block", marginTop: "22px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "800", letterSpacing: "-.02em", color: "#12171d" }}>
{mD.titulo}
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "12px", color: "#4a5560", lineHeight: "1.6" }}>
{mD.partes}
</span>
<div style={{ marginTop: "18px", borderRadius: "8px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
{(mD.linhas ?? []).map((dl: any, i1: number) => (
<Fragment key={dl?.id ?? dl?.chave ?? i1}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "8px 12px", boxShadow: "inset 0 -1px 0 #f3f5f5", fontSize: "12px" }}>
<span style={{ color: "#1f252c" }}>
{dl.l}
</span>
<span style={{ fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{dl.v}
</span>
</div>
</Fragment>
))}
</div>
<span style={{ display: "block", marginTop: "16px", fontSize: "11.5px", color: "#67787c", lineHeight: "1.6" }}>
{mD.clausula}
</span>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginTop: "28px" }}>
{(mD.assin ?? []).map((as: any, i1: number) => (
<Fragment key={as?.id ?? as?.chave ?? i1}>
<span style={{ display: "block", paddingTop: "8px", boxShadow: "inset 0 1px 0 #1f252c", fontSize: "11px", color: "#4a5560" }}>
<strong style={{ display: "block", color: "#12171d", fontSize: "12px" }}>
{as.nome}
</strong>
{as.papel}
</span>
</Fragment>
))}
</div>
</div>
</div>
</div>
</div>
</>) : null}
{(mP.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(460px,100%)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
Adicionar pessoa
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
{mP.sub}
</span>
</span>
<button onClick={fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Nome
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input value={mP.nome} onChange={mP.setNome} placeholder="Nome completo" style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Cargo
</span>
<input value={mP.cargo} onChange={mP.setCargo} placeholder="Ex: Gerente de TI" style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
E-mail
</span>
<input value={mP.email} onChange={mP.setEmail} placeholder={mP.phEmail} style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Telefone
</span>
<input value={mP.tel} onChange={mP.setTel} placeholder="(11) 90000-0000" style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
</div>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Papel na conta
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(mP.papeis ?? []).map((pp: any, i1: number) => (
<Fragment key={pp?.id ?? pp?.chave ?? i1}>
<button onClick={pp.onClick} style={estilo(pp.style)}>
{pp.l}
</button>
</Fragment>
))}
</div>
</div>
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
Adicionar pessoa
</button>
</div>
</div>
</div>
</>) : null}
{(nv.aberto) ? (<>
<div onClick={fechar} data-in="fade" style={{ position: "fixed", inset: "0", zIndex: "62", background: "rgba(12,16,21,.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
<div style={{ position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "63", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
<div data-in="rise-up" onClick={parar} style={{ pointerEvents: "auto", width: "min(1000px,calc(100vw - 20px))", height: "min(720px,calc(100vh - 48px))", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "26px 26px 0 0", boxShadow: "0 -30px 80px -24px rgba(12,16,21,.55)", overflow: "hidden" }}>
<button onClick={fechar} title="Fechar" style={{ flex: "0 0 auto", alignSelf: "center", width: "72px", height: "18px", marginTop: "6px", border: "0", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center" }}>
<span style={{ width: "44px", height: "5px", borderRadius: "9999px", background: "#d7dada" }} />
</button>
<div style={{ flex: "0 0 auto", padding: "8px 36px 20px", display: "flex", alignItems: "flex-end", gap: "20px", flexWrap: "wrap" }}>
<span style={{ flex: "1 1 320px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(22px,2.6vw,28px)", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.1", color: "#12171d" }}>
{nv.titulo}
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "14px", color: "#67787c", lineHeight: "1.5" }}>
{nv.sub}
</span>
</span>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px" }}>
{(nv.passos ?? []).map((ps: any, i1: number) => (
<Fragment key={ps?.id ?? ps?.chave ?? i1}>
<span style={estilo(ps.wrap)}>
<span style={estilo(ps.num)}>
{ps.n}
</span>
<span style={estilo(ps.lbl)}>
{ps.label}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "0 0 auto", height: "1px", margin: "0 36px", background: "#eef1f1" }} />
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "26px 36px 28px", background: "linear-gradient(180deg,#fff 0,#fafaf8 100%)" }}>
{(nv.e0) ? (<>
<div data-stagger="60" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))", gap: "14px" }}>
{(nv.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button data-in="rise" onClick={tp.onClick} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", minHeight: "160px", padding: "22px 22px 20px", borderRadius: "20px", border: "0", background: "#fff", boxShadow: "0 0 0 1px #e8ebeb,0 1px 2px rgba(18,23,29,.04)", cursor: "pointer", textAlign: "left", transition: "transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s ease" }} className={[hover("transform:translateY(-3px);box-shadow:0 0 0 1.5px #12171d,0 18px 36px -18px rgba(18,23,29,.35)")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "46px", height: "46px", borderRadius: "13px", display: "grid", placeItems: "center", background: "#fff6f4", color: "#c2330f" }}>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={tp.d} />
</svg>
</span>
<span style={{ display: "block", marginTop: "4px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{tp.l}
</span>
<span style={{ display: "block", maxWidth: "340px", fontSize: "13.5px", color: "#67787c", lineHeight: "1.55", textWrap: "pretty" }}>
{tp.s}
</span>
<span style={{ display: "inline-flex", alignItems: "center", marginTop: "auto", height: "24px", padding: "0 9px", borderRadius: "9999px", background: "#f3f4f4", fontSize: "11.5px", fontWeight: "600", color: "#4a5560" }}>
{tp.ctx}
</span>
<span style={{ position: "absolute", right: "20px", bottom: "20px", width: "34px", height: "34px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
{(nv.e1) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "22px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", borderRadius: "18px", background: "#fff", boxShadow: "0 0 0 1px #e8ebeb,0 10px 26px -18px rgba(18,23,29,.35)" }}>
<span style={{ flex: "0 0 auto", width: "42px", height: "42px", borderRadius: "11px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700" }}>
{cab.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
{nv.tipoL} · {cab.nome}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
{nv.alvoS}
</span>
</span>
<button onClick={nv.voltar} style={{ flex: "0 0 auto", height: "32px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
Trocar
</button>
</div>
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Produto
</span>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{(nv.familias ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onClick={fm.onClick} style={estilo(fm.style)}>
{fm.l}
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Contato que recebe
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(nv.contatos ?? []).map((ct: any, i1: number) => (
<Fragment key={ct?.id ?? ct?.chave ?? i1}>
<button onClick={ct.onClick} style={estilo(ct.style)}>
<span style={estilo(ct.radio)} />
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{ct.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{ct.cargo}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "6px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Closer
</span>
<select value={nv.closer} onChange={nv.setCloser} style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }}>
{(nv.equipe ?? []).map((eq: any, i1: number) => (
<Fragment key={eq?.id ?? eq?.chave ?? i1}>
<option value={eq}>
{eq}
</option>
</Fragment>
))}
</select>
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "6px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Valor estimado/mês
</span>
<input value={nv.valor} onChange={nv.setValor} inputMode="numeric" placeholder="Ex: 1500" style={{ width: "100%", height: "40px", padding: "0 11px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</label>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "6px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Contexto para o closer
</span>
<textarea value={nv.obs} onChange={nv.setObs} rows={3} placeholder={nv.obsPh} style={{ width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", lineHeight: "1.5" }} />
</label>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "18px", borderRadius: "18px", background: "#12171d", color: "#fff" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
O que acontece
</span>
{(nv.efeitos ?? []).map((ef: any, i1: number) => (
<Fragment key={ef?.id ?? ef?.chave ?? i1}>
<div style={{ display: "flex", gap: "11px" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9px", display: "grid", placeItems: "center", background: "rgba(254,79,43,.16)", color: "#ff8a70" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={ef.d} />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600" }}>
{ef.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#a3aab0", lineHeight: "1.45" }}>
{ef.s}
</span>
</span>
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
{(nv.e1) ? (<>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "14px 36px", borderTop: "1px solid #eef1f1", background: "#fff", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", color: "#c2330f" }}>
{nv.erro}
</span>
<button onClick={nv.criarOpp} style={{ height: "42px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Criar só a oportunidade
</button>
<button onClick={nv.criarProp} style={{ height: "42px", padding: "0 18px", borderRadius: "10px", border: "0", background: "#d93c1a", fontSize: "13.5px", fontWeight: "700", color: "#fff", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Criar oportunidade e proposta
</button>
</div>
</>) : null}
</div>
</div>
</>) : null}
</div>


    </>
  );
}
