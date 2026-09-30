"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Onboarding.dc.html
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
import "./OnboardingDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeOnboardingDesenho {
  acoes: any;
  dr: any;
  f: any;
  fechar: any;
  fecharDr: any;
  gl: any;
  hoje: any;
  ir: any;
  kpis: any;
  mh: any;
  mn: any;
  nx: any;
  parar: any;
  tabs: any;
  tema: any;
  ws: any;
}

export function OnboardingDesenho(vals: ValoresDeOnboardingDesenho) {
  const { acoes, dr, f, fechar, fecharDr, gl, hoje, ir, kpis, mh, mn, nx, parar, tabs, tema, ws } = vals;
  return (
    <>
<div style={estilo(tema.vars)}>
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: "14px 14px 22px", background: "var(--bg)", color: "var(--tx)", height: "100%" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<div data-in="rise" style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: "12px 20px" }}>
<div style={{ flex: "1 1 320px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(22px,2.4vw,28px)", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.05", color: "var(--tx)" }}>
Onboarding &amp; Implantação
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "13.5px", color: "var(--tx2)", textWrap: "pretty" }}>
Da venda ao go-live, com processos organizados e visibilidade total da operação.
</span>
</div>
<div data-r="toolbar" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "10px", padding: "3px", gap: "2px", height: "38px", alignItems: "stretch", maxWidth: "100%", overflowX: "auto" }}>
{(tabs ?? []).map((tb: any, i1: number) => (
<Fragment key={tb?.id ?? tb?.chave ?? i1}>
<button onClick={tb.onClick} style={estilo(tb.st)}>
{tb.l}
<span style={estilo(tb.nSt)}>
{tb.n}
</span>
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1", minWidth: "8px" }} />
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", height: "38px", padding: "0 11px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", flex: "0 1 240px", minWidth: "150px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={f.q} onChange={f.setQ} placeholder="Buscar cliente" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0", color: "#12171d" }} />
</div>
<button onClick={acoes.novo} style={{ display: "flex", alignItems: "center", gap: "7px", height: "38px", padding: "0 15px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Novo projeto
</button>
</div>
<div style={{ display: "flex", flexWrap: "wrap", flexDirection: "row-reverse", gap: "12px", alignItems: "flex-start", width: "100%", minWidth: "0", maxWidth: "100%" }}>
<div style={{ flex: "1 1 300px", maxWidth: "100%", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
<section data-in="rise" style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", borderRadius: "16px", background: "var(--sf)", boxShadow: "inset 0 0 0 1.5px #f6c9bc" }}>
<span style={{ position: "absolute", right: "-50px", top: "-70px", width: "220px", height: "170px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".16", filter: "blur(46px)", pointerEvents: "none" }} />
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
<img src="/proto/oni-avatar.png" alt="NEXO" width="38" height="38" style={{ display: "block", flex: "0 0 auto", borderRadius: "11px" }} />
<span style={{ minWidth: "0", flex: "1" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "800", letterSpacing: "-.02em", color: "var(--tx)" }}>
NEXO
</span>
<span style={{ height: "17px", padding: "0 6px", borderRadius: "5px", background: "#fe4f2b", color: "#fff", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
IA
</span>
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "var(--tx2)" }}>
Seu copiloto nas implantações
</span>
</span>
</div>
<span style={{ position: "relative", fontSize: "13.5px", lineHeight: "1.55", color: "var(--tx)", textWrap: "pretty" }}>
{nx.headline}
</span>
<div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
{(nx.botoes ?? []).map((b: any, i1: number) => (
<Fragment key={b?.id ?? b?.chave ?? i1}>
<button onClick={b.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", minHeight: "36px", padding: "0 12px", borderRadius: "10px", border: "0", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fff6f4;box-shadow:inset 0 0 0 1px #f6c9bc")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "9999px", background: "#fe4f2b" }} />
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{b.l}
</span>
</button>
</Fragment>
))}
</div>
{(nx.temRes) ? (<>
<div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", padding: "11px 12px", borderRadius: "11px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--tx)" }}>
{nx.resT}
</span>
{(nx.resL ?? []).map((rl: any, i1: number) => (
<Fragment key={rl?.id ?? rl?.chave ?? i1}>
<button onClick={rl.onClick} style={{ display: "block", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left", fontSize: "12.5px", lineHeight: "1.5", color: "var(--tx2)" }} className={[hover("color:var(--tx)")].filter(Boolean).join(" ")}>
• {rl.t}
</button>
</Fragment>
))}
{(nx.temAplicar) ? (<>
<div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
<button onClick={nx.aplicar} style={estilo(nx.aplicarSt)}>
{nx.aplicarL}
</button>
<button onClick={nx.fechar} style={{ height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", background: "transparent", color: "var(--tx3)", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }}>
Agora não
</button>
</div>
</>) : null}
</div>
</>) : null}
</section>
<section data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "14px 16px", borderRadius: "16px", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", color: "var(--tx)" }}>
Hoje
</span>
<button onClick={ir.agenda} style={{ height: "26px", padding: "0 9px", borderRadius: "7px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx2)", fontSize: "11.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
Ver agenda
</button>
</div>
{(hoje.vazio) ? (<>
<span style={{ padding: "6px 0", fontSize: "12.5px", color: "var(--tx3)" }}>
Nenhuma atividade de entrega para hoje.
</span>
</>) : null}
{(hoje.itens ?? []).map((h: any, i1: number) => (
<Fragment key={h?.id ?? h?.chave ?? i1}>
<button onClick={h.onClick} style={{ display: "grid", gridTemplateColumns: "44px 10px minmax(0,1fr)", gap: "10px", alignItems: "start", width: "calc(100% + 12px)", margin: "0 -6px", padding: "8px 6px", border: "0", borderRadius: "9px", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
<span style={{ fontSize: "12px", fontWeight: "600", color: "var(--tx3)", fontVariantNumeric: "tabular-nums", paddingTop: "1px" }}>
{h.h}
</span>
<span style={{ width: "8px", height: "8px", marginTop: "5px", borderRadius: "9999px", background: "#fe4f2b" }} />
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--tx)", textWrap: "pretty" }}>
{h.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "var(--tx3)" }}>
{h.s}
</span>
</span>
</button>
</Fragment>
))}
</section>
<section data-in="rise" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px 16px", borderRadius: "16px", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", color: "var(--tx)" }}>
Go-lives desta semana
</span>
<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "28px", fontWeight: "800", letterSpacing: "-.04em", lineHeight: "1", color: "var(--tx)" }}>
{gl.n}
<span style={{ fontSize: "14px", fontWeight: "600", color: "var(--tx3)", letterSpacing: "0" }}>
 de {gl.total}
</span>
</span>
<span style={{ display: "block", marginTop: "5px", fontSize: "12px", color: "var(--tx2)" }}>
previstos para os próximos 7 dias
</span>
</span>
<span style={{ position: "relative", flex: "0 0 auto", width: "76px", height: "76px" }}>
<svg width="76" height="76" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
<circle cx="42" cy="42" r="35" fill="none" stroke="var(--ln)" strokeWidth="8" />
<circle cx="42" cy="42" r="35" fill="none" stroke="#fe4f2b" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={gl.dash} />
</svg>
<span style={{ position: "absolute", inset: "0", display: "grid", placeItems: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "800", color: "var(--tx)" }}>
{gl.pct}%
</span>
</span>
</div>
{(gl.itens ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<button onClick={g.onClick} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", boxShadow: "inset 0 1px 0 var(--ln)" }}>
<span style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "7px", display: "grid", placeItems: "center", background: "#12171d", color: "#fff", fontSize: "9px", fontWeight: "700" }}>
{g.ini}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{g.nome}
</span>
<span style={{ fontSize: "11.5px", color: "var(--tx3)", whiteSpace: "nowrap" }}>
{g.quando}
</span>
</button>
</Fragment>
))}
</section>
</div>
<div style={{ flex: "3 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
<div data-in="rise" style={{ display: "flex", background: "var(--sf)", borderRadius: "16px", boxShadow: "inset 0 0 0 1px var(--ln)", overflowX: "auto" }}>
{(kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<button onClick={k.onClick} style={estilo(k.st)} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
<span style={estilo(k.tile)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={k.d} />
</svg>
</span>
<span style={{ minWidth: "0", textAlign: "left" }}>
<span style={estilo(k.vSt)}>
{k.v}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", color: "var(--tx2)", lineHeight: "1.25", whiteSpace: "nowrap" }}>
{k.l}
</span>
</span>
</button>
</Fragment>
))}
</div>
<div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,430px),1fr))", alignItems: "start" }}>
{(ws ?? []).map((w: any, i1: number) => (
<Fragment key={w?.id ?? w?.chave ?? i1}>
<section data-in="rise" style={{ minWidth: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "var(--sf)", borderRadius: "16px", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<span style={estilo(w.icoSt)}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={w.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "800", letterSpacing: "-.02em", color: "var(--tx)" }}>
{w.titulo}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--tx3)", fontVariantNumeric: "tabular-nums" }}>
{w.n}
</span>
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "var(--tx2)", lineHeight: "1.4" }}>
{w.sub}
</span>
</span>
{(w.mostraVer) ? (<>
<button onClick={w.verTodos} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
Ver todos
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</>) : null}
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", padding: "9px 12px", borderRadius: "10px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{(w.stats ?? []).map((s: any, i2: number) => (
<Fragment key={s?.id ?? s?.chave ?? i2}>
<button onClick={s.onClick} style={{ display: "flex", alignItems: "center", gap: "6px", border: "0", background: "transparent", padding: "0", cursor: "pointer", fontSize: "12px", color: "var(--tx2)", whiteSpace: "nowrap" }}>
<span style={estilo(s.dot)} />
<strong style={{ color: "var(--tx)", fontVariantNumeric: "tabular-nums" }}>
{s.n}
</strong>
{s.l}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)", alignSelf: "flex-start", flexWrap: "wrap" }}>
{(w.chips ?? []).map((c: any, i2: number) => (
<Fragment key={c?.id ?? c?.chave ?? i2}>
<button onClick={c.onClick} style={estilo(c.st)}>
{c.l}
<span style={{ fontSize: "11px", opacity: ".6" }}>
{c.n}
</span>
</button>
</Fragment>
))}
</div>
{(w.vazio) ? (<>
<div style={{ padding: "30px 12px", borderRadius: "12px", border: "1.5px dashed var(--ln)", textAlign: "center", fontSize: "12.5px", color: "var(--tx3)" }}>
{w.vazioTxt}
</div>
</>) : null}
<div data-stagger="35" style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
{(w.linhas ?? []).map((r: any, i2: number) => (
<Fragment key={r?.id ?? r?.chave ?? i2}>
<div data-in="rise" style={estilo(r.card)} className={[hover("box-shadow:inset 0 0 0 1px #c9cfd1,0 10px 24px -18px rgba(18,23,29,.35)")].filter(Boolean).join(" ")}>
<span style={estilo(r.bar)} />
<button onClick={r.abrir} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: "12px", alignItems: "stretch", width: "100%", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={{ minWidth: "0", display: "flex", flexDirection: "column", gap: "9px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "11px", display: "grid", placeItems: "center", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12px", fontWeight: "700" }}>
{r.ini}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.nome}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "3px" }}>
<span style={{ display: "inline-flex", alignItems: "center", height: "19px", padding: "0 7px", borderRadius: "5px", background: "#fff6f4", color: "#c2330f", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap" }}>
{r.prod}
</span>
<span style={{ display: "inline-flex", alignItems: "center", height: "19px", padding: "0 7px", borderRadius: "5px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx2)", fontSize: "10.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
{r.tipo}
</span>
</span>
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", height: "5px", borderRadius: "9999px", background: "var(--ln)", overflow: "hidden" }}>
<span style={estilo(r.barra)} />
</span>
<span style={{ fontSize: "12px", fontWeight: "700", color: "var(--tx)", fontVariantNumeric: "tabular-nums" }}>
{r.pct}%
</span>
</span>
<span style={{ fontSize: "12px", color: "var(--tx2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.fase}
</span>
</span>
<span style={{ minWidth: "0", display: "flex", flexDirection: "column", gap: "5px", padding: "10px 12px", borderRadius: "11px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<span style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--tx3)" }}>
Próxima ação
</span>
<span style={{ whiteSpace: "normal", lineHeight: "1.3" }}>
{r.px}
</span>
<span style={{ fontSize: "11.5px", color: "var(--tx2)", lineHeight: "1.35", textWrap: "pretty" }}>
{r.pxSub}
</span>
</span>
</button>
{(r.temHerd) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--ok)" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{r.herd}
</span>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingTop: "9px", boxShadow: "inset 0 1px 0 var(--ln)" }}>
<span style={estilo(r.pill)}>
<span style={estilo(r.dotSt)} />
{r.est}
</span>
<span style={{ fontSize: "11.5px", color: "var(--tx3)", whiteSpace: "nowrap" }}>
{r.prazo}
</span>
<span style={{ flex: "1" }} />
<span title={r.resp} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--tx2)" }}>
<span style={{ width: "22px", height: "22px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx2)", fontSize: "9px", fontWeight: "700" }}>
{r.respIni}
</span>
</span>
{(r.pronto) ? (<>
<button onClick={r.acaoPronto} style={{ height: "28px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
{r.acaoPronL}
</button>
</>) : null}
</div>
</div>
</Fragment>
))}
</div>
</section>
</Fragment>
))}
</div>
</div>
</div>
</div>
</div>
{(dr.aberto) ? (<>
<div onClick={fecharDr} data-in="fade" style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(12,16,21,.45)" }} />
<aside data-r="drawer" data-in="slide-left" style={{ position: "fixed", top: "0", right: "0", bottom: "0", zIndex: "61", width: "min(480px,100vw)", display: "flex", flexDirection: "column", background: "var(--sf)", color: "var(--tx)", boxShadow: "-24px 0 60px -24px rgba(0,0,0,.45),inset 1px 0 0 var(--ln)" }}>
<div style={{ flex: "0 0 auto", padding: "18px 20px 14px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "inset 0 -1px 0 var(--ln)" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "12px", display: "grid", placeItems: "center", background: "var(--sf2)", color: "var(--tx)", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: "700", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{dr.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "var(--tx)" }}>
{dr.nome}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "var(--tx3)" }}>
{dr.tipo} · {dr.prod} · {dr.oferta}
</span>
</span>
<button onClick={fecharDr} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "var(--tx3)", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:var(--hv);color:var(--tx)")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={estilo(dr.pill)}>
<span style={estilo(dr.dotSt)} />
{dr.est}
</span>
<span style={{ flex: "1", height: "4px", borderRadius: "9999px", background: "var(--ln)", overflow: "hidden" }}>
<span style={estilo(dr.barra)} />
</span>
<span style={{ fontSize: "12px", fontWeight: "700", color: "var(--tx)", fontVariantNumeric: "tabular-nums" }}>
{dr.pct}%
</span>
</div>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "16px 20px 18px", display: "flex", flexDirection: "column", gap: "18px" }}>
{(dr.temBloq) ? (<>
<div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "11px 12px", borderRadius: "11px", background: "{{ dr.bloqBg }}" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "{{ dr.bloqCor }}" }}>
{dr.bloqT}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "var(--tx2)" }}>
{dr.bloqS}
</span>
</span>
<button onClick={dr.liberar} style={{ flex: "0 0 auto", height: "28px", padding: "0 10px", borderRadius: "8px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
Resolvido
</button>
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "1px", borderRadius: "12px", background: "var(--ln)", overflow: "hidden" }}>
<div style={{ minWidth: "0", padding: "12px 13px", background: "var(--sf)" }}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--tx3)" }}>
Próxima ação
</span>
<span style={{ display: "block", marginTop: "5px", fontSize: "13px", fontWeight: "600", color: "var(--tx)", lineHeight: "1.35" }}>
{dr.proxT}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "{{ dr.proxCor }}" }}>
{dr.proxQ}
</span>
</div>
<div style={{ minWidth: "0", padding: "12px 13px", background: "var(--sf)" }}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--tx3)" }}>
Responsável
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "var(--sf2)", color: "var(--tx2)", fontSize: "9px", fontWeight: "700", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{dr.respIni}
</span>
<span style={{ minWidth: "0", fontSize: "13px", fontWeight: "600", color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dr.resp}
</span>
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "{{ dr.prazoCor }}" }}>
{dr.prazo}
</span>
</div>
</div>
{(dr.temHandoffInfo) ? (<>
<div>
<span style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--tx3)", marginBottom: "6px" }}>
Contexto recebido
</span>
<span style={{ display: "block", fontSize: "12.5px", lineHeight: "1.55", color: "var(--tx2)", textWrap: "pretty" }}>
{dr.handoffTxt}
</span>
</div>
</>) : null}
<div style={{ display: "flex", flexDirection: "column" }}>
<div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
<span style={{ flex: "1", fontSize: "11px", fontWeight: "600", color: "var(--tx3)" }}>
Tarefas abertas · {dr.nAbertas}
</span>
<button onClick={dr.verAtv} style={{ border: "0", background: "transparent", padding: "0", fontSize: "12px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }}>
Ver em Atividades
</button>
</div>
{(dr.semAbertas) ? (<>
<span style={{ fontSize: "12.5px", color: "var(--tx3)" }}>
Nenhuma tarefa aberta.
</span>
</>) : null}
{(dr.abertas ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", boxShadow: "inset 0 1px 0 var(--ln)" }}>
<button onClick={t.concluir} title="Concluir tarefa" style={{ flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "6px", border: "0", background: "transparent", boxShadow: "inset 0 0 0 1.5px var(--tx3)", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1.5px var(--ok)")].filter(Boolean).join(" ")} />
<button onClick={t.abrir} style={{ flex: "1", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }} className={[hover("text-decoration:underline")].filter(Boolean).join(" ")}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--tx)" }}>
{t.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "var(--tx3)" }}>
{t.s}
</span>
</button>
<span style={{ fontSize: "11.5px", color: "{{ t.qCor }}", whiteSpace: "nowrap" }}>
{t.q}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "var(--tx3)" }}>
Pessoas envolvidas
</span>
{(dr.pessoas ?? []).map((ps: any, i1: number) => (
<Fragment key={ps?.id ?? ps?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "11px", background: "var(--sf2)" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "var(--sf)", color: "var(--tx2)", fontSize: "10.5px", fontWeight: "700", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{ps.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ps.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "var(--tx3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ps.cargo}
</span>
</span>
<span style={{ display: "flex", gap: "4px" }}>
{(ps.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} title={ac.t} style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx2)", display: "grid", placeItems: "center", border: "0", cursor: "pointer" }} className={[hover("color:var(--tx);background:var(--hv)")].filter(Boolean).join(" ")}>
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
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "var(--tx3)" }}>
Últimos eventos
</span>
{(dr.timeline ?? []).map((e: any, i1: number) => (
<Fragment key={e?.id ?? e?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "10px", padding: "5px 0" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", color: "var(--tx)", textWrap: "pretty" }}>
{e.t}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "var(--tx3)" }}>
{e.meta}
</span>
</span>
<span style={{ fontSize: "11px", color: "var(--tx3)", whiteSpace: "nowrap" }}>
{e.q}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(dr.links ?? []).map((lk: any, i1: number) => (
<Fragment key={lk?.id ?? lk?.chave ?? i1}>
<button onClick={lk.onClick} style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 10px", borderRadius: "8px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx2)", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:var(--hv);color:var(--tx)")].filter(Boolean).join(" ")}>
{lk.l}
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 17 17 7M9 7h8v8" />
</svg>
</button>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", gap: "8px", padding: "12px 20px", boxShadow: "inset 0 1px 0 var(--ln)", background: "var(--sf2)" }}>
{(dr.pronto) ? (<>
<button onClick={dr.acaoPronto} style={{ flex: "1 1 0", height: "40px", borderRadius: "10px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
{dr.acaoPronL}
</button>
</>) : null}
<button onClick={dr.completo} style={estilo(dr.completoSt)}>
Ver projeto completo
</button>
{(dr.podeAguardar) ? (<>
<button onClick={dr.aguardar} title="Marcar como aguardando cliente" style={{ flex: "0 0 auto", height: "40px", padding: "0 12px", borderRadius: "10px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
Aguardando cliente
</button>
</>) : null}
</div>
</aside>
</>) : null}
{(mh.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "70", background: "rgba(12,16,21,.5)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(620px,100%)", maxHeight: "100%", display: "flex", flexDirection: "column", background: "var(--sf)", color: "var(--tx)", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(0,0,0,.55),inset 0 0 0 1px var(--ln)", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "10px", boxShadow: "inset 0 -1px 0 var(--ln)" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx3)" }}>
Onboarding
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d93c1a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
<span style={{ color: "#d93c1a" }}>
{mh.destino}
</span>
</span>
<span style={{ display: "block", marginTop: "6px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.015em", color: "var(--tx)" }}>
{mh.titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "var(--tx3)" }}>
{mh.sub}
</span>
</span>
<button onClick={fechar} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "var(--tx3)", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
{(mh.gate ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", color: "var(--tx)" }}>
<span style={{ width: "18px", height: "18px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "var(--okbg)", color: "var(--ok)" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
{g.n}
</span>
</Fragment>
))}
</div>
{(mh.ehCS) ? (<>
<span style={{ fontSize: "12.5px", color: "var(--tx2)", lineHeight: "1.5" }}>
A régua de CS começa aqui: contexto comercial, objetivo, responsáveis, stakeholders e pendências seguem com o cliente.
</span>
</>) : null}
{(mh.ehImp) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr .8fr", gap: "10px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Responsável da implantação
</span>
<select value={mh.resp} onChange={mh.setResp} style={{ width: "100%", height: "38px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", color: "var(--tx)" }}>
{(mh.equipe ?? []).map((eq: any, i1: number) => (
<Fragment key={eq?.id ?? eq?.chave ?? i1}>
<option value={eq}>
{eq}
</option>
</Fragment>
))}
</select>
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Primeira reunião
</span>
<input type="date" value={mh.data} onChange={mh.setData} style={{ width: "100%", height: "38px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", color: "var(--tx)" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Hora
</span>
<input type="time" value={mh.hora} onChange={mh.setHora} style={{ width: "100%", height: "38px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", color: "var(--tx)" }} />
</label>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Resumo do kickoff
</span>
<textarea value={mh.resumo} onChange={mh.setResumo} rows={3} style={{ width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", lineHeight: "1.5", color: "var(--tx)" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Pendências
</span>
<textarea value={mh.pend} onChange={mh.setPend} rows={2} placeholder="Uma por linha" style={{ width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", lineHeight: "1.5", color: "var(--tx)" }} />
</label>
<div style={{ padding: "11px 12px", borderRadius: "11px", background: "var(--sf2)" }}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--tx3)", marginBottom: "5px" }}>
O que acontece ao confirmar
</span>
{(mh.efeitos ?? []).map((ef: any, i1: number) => (
<Fragment key={ef?.id ?? ef?.chave ?? i1}>
<span style={{ display: "block", padding: "2px 0", fontSize: "12.5px", color: "var(--tx2)" }}>
• {ef}
</span>
</Fragment>
))}
</div>
</>) : null}
{(mh.temErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "var(--err)" }}>
{mh.erro}
</span>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", boxShadow: "inset 0 1px 0 var(--ln)", background: "var(--sf2)" }}>
<button onClick={fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={mh.confirmar} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
{mh.confirmarL}
</button>
</div>
</div>
</div>
</>) : null}
{(mn.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "70", background: "rgba(12,16,21,.5)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(580px,100%)", maxHeight: "100%", display: "flex", flexDirection: "column", background: "var(--sf)", color: "var(--tx)", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(0,0,0,.55),inset 0 0 0 1px var(--ln)", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "10px", boxShadow: "inset 0 -1px 0 var(--ln)" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", color: "var(--tx)" }}>
Novo onboarding
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "var(--tx3)" }}>
Vendas ganhas no Pipeline entram sozinhas. Use para casos manuais ou expansões.
</span>
</span>
<button onClick={fechar} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "var(--tx3)", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Cliente
<span style={{ color: "#d93c1a" }}>
*
</span>
</span>
<select value={mn.empresa} onChange={mn.setEmpresa} style={{ width: "100%", height: "38px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", color: "var(--tx)" }}>
<option value="">
Escolher cliente
</option>
{(mn.clientes ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<option value={c}>
{c}
</option>
</Fragment>
))}
</select>
</label>
<div>
<span style={{ display: "block", marginBottom: "6px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Serviço
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(mn.fams ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onClick={fm.onClick} style={estilo(fm.st)}>
{fm.l}
</button>
</Fragment>
))}
</div>
</div>
{(mn.temPrev) ? (<>
<div style={{ padding: "11px 12px", borderRadius: "11px", background: "var(--warnbg)" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "var(--warn)" }}>
Este cliente já passou por onboarding de {mn.famL}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "var(--tx2)", lineHeight: "1.45" }}>
{mn.prevTxt} As tarefas desmarcadas abaixo entram como reaproveitadas e ficam fora do progresso.
</span>
</div>
</>) : null}
<div>
<span style={{ display: "block", marginBottom: "6px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Tarefas que precisam rodar
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(mn.fases ?? []).map((fs: any, i1: number) => (
<Fragment key={fs?.id ?? fs?.chave ?? i1}>
<button onClick={fs.onClick} style={estilo(fs.st)}>
{fs.l}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Responsável
</span>
<select value={mn.resp} onChange={mn.setResp} style={{ width: "100%", height: "38px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", color: "var(--tx)" }}>
{(mn.equipe ?? []).map((eq: any, i1: number) => (
<Fragment key={eq?.id ?? eq?.chave ?? i1}>
<option value={eq}>
{eq}
</option>
</Fragment>
))}
</select>
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", marginBottom: "5px", fontSize: "11.5px", fontWeight: "600", color: "var(--tx2)" }}>
Prazo (dias)
</span>
<input value={mn.prazo} onChange={mn.setPrazo} inputMode="numeric" style={{ width: "100%", height: "38px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", color: "var(--tx)" }} />
</label>
</div>
{(mn.temErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "var(--err)" }}>
{mn.erro}
</span>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", boxShadow: "inset 0 1px 0 var(--ln)", background: "var(--sf2)" }}>
<button onClick={fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={mn.criar} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Criar onboarding
</button>
</div>
</div>
</div>
</>) : null}
</div>


</div>
    </>
  );
}
