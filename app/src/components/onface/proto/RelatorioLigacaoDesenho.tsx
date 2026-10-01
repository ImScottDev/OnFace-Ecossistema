"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Relatorio Ligacao.dc.html
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
import "./RelatorioLigacaoDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeRelatorioLigacaoDesenho {
  aberto: any;
  fora: any;
  r: any;
  w: any;
}

export function RelatorioLigacaoDesenho(vals: ValoresDeRelatorioLigacaoDesenho) {
  const { aberto, fora, r, w } = vals;
  return (
    <>
<div style={{ display: "contents" }}>
{(aberto) ? (<>
<div data-r="modal-fundo" onMouseDown={fora} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: "16px", animation: "ofIn .18s ease both" }}>
<div style={{ width: "min(1240px,calc(100vw - 32px))", height: "min(900px,calc(100vh - 32px))", display: "flex", flexDirection: "column", borderRadius: "18px", background: "#f6f6f3", boxShadow: "0 24px 64px rgba(18,23,29,.28),0 0 0 1px rgba(18,23,29,.06)", overflow: "hidden", lineHeight: "1.4", fontFamily: "Inter,system-ui,sans-serif", color: "#12171d", textAlign: "left" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", padding: "16px 20px", borderBottom: "1px solid #eef1f1", background: "#fff" }}>
<span style={{ flex: "0 0 auto", width: "42px", height: "42px", borderRadius: "12px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
</svg>
</span>
<div style={{ flex: "1 1 260px", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", lineHeight: "1.3", color: "#12171d" }}>
{r.titulo}
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "22px", padding: "0 8px", borderRadius: "9999px", background: "#e6f4ee", color: "#1f7256", fontSize: "11px", fontWeight: "700" }}>
<span style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "#1f7256" }} />
{r.status}
</span>
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", marginTop: "5px", fontSize: "12px", lineHeight: "1.5", color: "#67787c", whiteSpace: "nowrap" }}>
<span>
{r.quando}
</span>
<span>
{r.numero}
</span>
<span>
{r.duracao}
</span>
<span>
{r.atendente}
</span>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", gap: "6px" }}>
<button onClick={r.baixar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
<span>
Áudio
</span>
</button>
<button onClick={r.abrirCallface} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
</svg>
<span>
Abrir no Callface
</span>
</button>
<button onClick={r.fecharRel} title="Fechar" style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9999px", border: "0", background: "transparent", display: "grid", placeItems: "center", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</div>
<div style={{ flex: "1 1 0", minHeight: "0", display: "grid", gridTemplateColumns: "minmax(0,1.45fr) minmax(340px,1fr)" }}>
<div style={{ minHeight: "0", overflowY: "auto", overscrollBehavior: "contain", padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "12px" }}>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 18px 14px", display: "flex", flexDirection: "column" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", color: "#4a5560" }}>
CHANCE DE FECHAR
</span>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#1f7256" }}>
{r.chanceNota}
</span>
</div>
<div style={{ position: "relative", width: "100%", maxWidth: "300px", margin: "18px auto 16px", aspectRatio: "2 / 1.08" }}>
<svg viewBox="0 0 200 108" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
{(r.arco ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<line x1={sg.x1} y1={sg.y1} x2={sg.x2} y2={sg.y2} stroke={sg.cor} strokeWidth="5.2" strokeLinecap="round" />
</Fragment>
))}
</svg>
<div style={{ position: "absolute", left: "0", right: "0", bottom: "2px", textAlign: "center" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "40px", fontWeight: "800", letterSpacing: "-.03em", lineHeight: "1", color: "#12171d" }}>
{r.chance}
<span style={{ fontSize: "18px", color: "#67787c", fontWeight: "700", marginLeft: "1px" }}>
%
</span>
</div>
<div style={{ fontSize: "12px", color: "#4a5560", marginTop: "4px" }}>
{r.chanceSub}
</div>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "0", marginTop: "auto", borderTop: "1px solid #eef1f1", paddingTop: "12px" }}>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "11px", color: "#67787c" }}>
Urgência
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{r.urgencia}
</span>
<span style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "14px" }}>
{(r.urgBarras ?? []).map((u: any, i1: number) => (
<Fragment key={u?.id ?? u?.chave ?? i1}>
<span style={estilo(u.style)} />
</Fragment>
))}
</span>
</div>
</div>
<div style={{ minWidth: "0", paddingLeft: "12px", boxShadow: "inset 1px 0 0 #eef1f1" }}>
<div style={{ fontSize: "11px", color: "#67787c" }}>
Sentimento
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", minWidth: "0" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#1f7256", whiteSpace: "nowrap" }}>
{r.sentCurto}
</span>
</div>
</div>
<div style={{ minWidth: "0", paddingLeft: "12px", boxShadow: "inset 1px 0 0 #eef1f1" }}>
<div style={{ fontSize: "11px", color: "#67787c", whiteSpace: "nowrap" }}>
Fala do cliente
</div>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d", marginTop: "4px", whiteSpace: "nowrap" }}>
{r.clPct}
</div>
</div>
</div>
</div>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 18px 14px", display: "flex", flexDirection: "column" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", color: "#4a5560" }}>
QUALIDADE DA LIGAÇÃO
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: "800", color: "#12171d" }}>
{r.notaGeral}
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
/ 10
</span>
</div>
<div style={{ position: "relative", width: "100%", maxWidth: "330px", margin: "8px auto 4px" }}>
<svg viewBox="-56 -22 312 244" width="100%" style={{ display: "block", overflow: "visible" }}>
<defs>
<radialGradient id="ofRadarGrad" cx="100" cy="104" r="80" gradientUnits="userSpaceOnUse">
<stop offset="0" stopColor="#fe4f2b" stopOpacity=".05" />
<stop offset="1" stopColor="#fe4f2b" stopOpacity=".32" />
</radialGradient>
</defs>
<circle cx="100" cy="104" r="80" fill="none" stroke="#e3e7e8" strokeWidth="1" />
<circle cx="100" cy="104" r="53.3" fill="none" stroke="#eef1f1" strokeWidth="1" />
<circle cx="100" cy="104" r="26.6" fill="none" stroke="#eef1f1" strokeWidth="1" />
<polygon points={r.radarTime} fill="none" stroke="#67787c" strokeWidth="1.2" strokeDasharray="3 3" />
<polygon points={r.radarPts} fill="url(#ofRadarGrad)" stroke="#fe4f2b" strokeWidth="2" strokeLinejoin="round" />
{(r.radarEixos ?? []).map((rx: any, i1: number) => (
<Fragment key={rx?.id ?? rx?.chave ?? i1}>
<circle cx={rx.px} cy={rx.py} r="3.4" fill="#fff" stroke="#fe4f2b" strokeWidth="2" />
</Fragment>
))}
</svg>
{(r.radarEixos ?? []).map((rx: any, i1: number) => (
<Fragment key={rx?.id ?? rx?.chave ?? i1}>
<div style={estilo(rx.pos)}>
<div style={{ fontSize: "11.5px", color: "#4a5560", whiteSpace: "nowrap", lineHeight: "1.2" }}>
{rx.nome}
</div>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12px", fontWeight: "700", color: "#12171d", lineHeight: "1.2" }}>
{rx.val}
</div>
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px 14px", flexWrap: "wrap", marginTop: "auto", borderTop: "1px solid #eef1f1", paddingTop: "12px", fontSize: "11.5px", color: "#4a5560" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
<span style={{ width: "14px", height: "2px", borderRadius: "2px", background: "#fe4f2b" }} />
{r.radarQuem}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
<span style={{ width: "14px", height: "0", borderTop: "1.5px dashed #67787c" }} />
Média do time
</span>
<span style={{ flex: "1" }} />
<span style={{ color: "#1f7256", fontWeight: "600", whiteSpace: "nowrap" }}>
{r.radarDestaque}
</span>
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3" }}>
{(r.abas ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={estilo(a.style)}>
{a.label}
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1" }} />
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#67787c" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "16px", height: "16px", borderRadius: "5px", objectFit: "cover", background: "#1f252c" }} />
Análise do Callface AI · {r.geradoEm}
</span>
</div>
{(r.abaResumo) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 18px" }}>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
OBJETIVO DA LIGAÇÃO
</div>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "600", lineHeight: "1.5", color: "#12171d", marginTop: "6px", textWrap: "pretty" }}>
{r.objetivo}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "12px" }}>
{(r.blocos ?? []).map((bl: any, i1: number) => (
<Fragment key={bl?.id ?? bl?.chave ?? i1}>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={estilo(bl.icoStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={bl.d} />
</svg>
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
{bl.titulo}
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11px", fontWeight: "700", color: "#67787c" }}>
{bl.n}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "9px", marginTop: "10px" }}>
{(bl.itens ?? []).map((it: any, i2: number) => (
<Fragment key={it?.id ?? it?.chave ?? i2}>
<div style={{ display: "flex", gap: "8px" }}>
<span style={estilo(bl.bullet)} />
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "13px", lineHeight: "1.45", color: "#1f252c", textWrap: "pretty" }}>
{it.t}
</div>
{(it.temR) ? (<>
<div style={{ fontSize: "12px", lineHeight: "1.45", color: "#1f7256", marginTop: "3px", textWrap: "pretty" }}>
↳ {it.r}
</div>
</>) : null}
</div>
</div>
</Fragment>
))}
</div>
</div>
</Fragment>
))}
</div>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
QUALIFICAÇÃO DETECTADA
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
{r.bantResumo}
</span>
<span style={{ flex: "1" }} />
<button onClick={r.levarQual} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
Levar para a qualificação
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "8px", marginTop: "12px" }}>
{(r.bant ?? []).map((bt: any, i1: number) => (
<Fragment key={bt?.id ?? bt?.chave ?? i1}>
<div style={{ padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={{ flex: "1", fontSize: "12px", fontWeight: "700", color: "#12171d" }}>
{bt.k}
</span>
<span style={estilo(bt.pill)}>
{bt.st}
</span>
</div>
<div style={{ fontSize: "12px", lineHeight: "1.4", color: "#4a5560", marginTop: "5px", textWrap: "pretty" }}>
{bt.ev}
</div>
</div>
</Fragment>
))}
</div>
</div>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 18px" }}>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
RESUMO DA CONVERSA
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
{(r.resumo ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<p style={{ margin: "0", fontSize: "13.5px", lineHeight: "1.65", color: "#1f252c", textWrap: "pretty" }}>
{p.t}
</p>
</Fragment>
))}
</div>
</div>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px" }}>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
PALAVRAS-CHAVE
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
{(r.chaves ?? []).map((kw: any, i1: number) => (
<Fragment key={kw?.id ?? kw?.chave ?? i1}>
<span style={estilo(kw.style)}>
{kw.t}
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#67787c" }}>
{kw.n}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
PRÓXIMOS PASSOS SUGERIDOS
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
{r.passosFeitos}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", marginTop: "6px" }}>
{(r.passos ?? []).map((ps: any, i1: number) => (
<Fragment key={ps?.id ?? ps?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderTop: "1px solid #f3f5f5" }}>
<button onClick={ps.alternar} title={ps.checkTitulo} style={estilo(ps.check)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</button>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={estilo(ps.tStyle)}>
{ps.t}
</div>
<div style={{ fontSize: "11.5px", color: "#67787c", marginTop: "2px" }}>
{ps.meta}
</div>
</div>
<button onClick={ps.onClick} style={estilo(ps.btnStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
{ps.acao}
</button>
</div>
</Fragment>
))}
</div>
</div>
</div>
</>) : null}
{(r.abaMom) ? (<>
<div style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "6px 14px" }}>
{(r.momentos ?? []).map((mo: any, i1: number) => (
<Fragment key={mo?.id ?? mo?.chave ?? i1}>
<div onClick={mo.onClick} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 4px", borderBottom: "1px solid #f3f5f5", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 42px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", paddingTop: "2px" }}>
{mo.h}
</span>
<span style={estilo(mo.chip)}>
{mo.tipo}
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{mo.t}
</div>
<div style={{ fontSize: "12px", lineHeight: "1.45", color: "#4a5560", marginTop: "2px", textWrap: "pretty" }}>
“{mo.fala}”
</div>
</div>
<span style={{ flex: "0 0 auto", color: "#67787c", paddingTop: "2px" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
<path d="M7 4v16l13-8z" />
</svg>
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
</div>
<div style={{ minHeight: "0", display: "flex", flexDirection: "column", background: "#fff", boxShadow: "inset 1px 0 0 #eef1f1" }}>
<div style={{ flex: "0 0 auto", padding: "16px 18px 14px", borderBottom: "1px solid #eef1f1", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", color: "#4a5560" }}>
GRAVAÇÃO
</span>
<div style={{ display: "flex", gap: "2px", padding: "2px", borderRadius: "9999px", background: "#eeeff3" }}>
{(r.vels ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.onClick} style={estilo(v.style)}>
{v.label}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<button onClick={r.play} title={r.playTitulo} style={{ flex: "0 0 auto", width: "44px", height: "44px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 2px 6px rgba(18,23,29,.18)" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
<path d={r.playD} />
</svg>
</button>
<div style={{ flex: "1", minWidth: "0" }}>
<div onClick={r.seek} style={{ position: "relative", display: "flex", alignItems: "center", gap: "2px", height: "44px", cursor: "pointer" }}>
{(r.onda ?? []).map((b: any, i1: number) => (
<Fragment key={b?.id ?? b?.chave ?? i1}>
<span style={estilo(b.style)} />
</Fragment>
))}
<span style={estilo(r.cabeca)} />
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "800", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{r.tAtual}
</span>
<span style={{ fontSize: "12px", color: "#67787c", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
/ {r.tTotal}
</span>
<span style={{ flex: "1" }} />
<span style={estilo(r.falandoDot)} />
<span style={{ minWidth: "0", fontSize: "11.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.falando}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
{(r.speakers ?? []).map((sp: any, i1: number) => (
<Fragment key={sp?.id ?? sp?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(72px,auto) minmax(0,1fr) 38px", alignItems: "center", gap: "10px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
<span style={estilo(sp.dot)} />
<span style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sp.nome}
</span>
</span>
<span style={{ height: "6px", borderRadius: "9999px", background: "#eceef0", overflow: "hidden" }}>
<span style={estilo(`display:block;${sp.bar ?? ""}`)} />
</span>
<span style={{ fontSize: "12px", fontWeight: "700", color: "#12171d", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
{sp.pct}
</span>
</div>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "1 1 0", minHeight: "0", overflowY: "auto", overscrollBehavior: "contain", padding: "12px 14px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 12px", borderRadius: "9999px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m20 20-3.5-3.5" />
</svg>
<input value={r.busca} onChange={r.setBusca} placeholder="Buscar na transcrição" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "12.5px" }} />
<span style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
{r.buscaInfo}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", marginTop: "8px" }}>
{(r.falas ?? []).map((fl: any, i1: number) => (
<Fragment key={fl?.id ?? fl?.chave ?? i1}>
<div onClick={fl.onClick} style={estilo(fl.style)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 36px", fontSize: "11px", fontWeight: "600", color: "#67787c", fontVariantNumeric: "tabular-nums", paddingTop: "3px" }}>
{fl.h}
</span>
<span style={estilo(fl.av)}>
{fl.ini}
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontSize: "11.5px", fontWeight: "700", color: "#12171d" }}>
{fl.quem}
</div>
<div style={{ fontSize: "13px", lineHeight: "1.5", color: "#1f252c", marginTop: "1px", textWrap: "pretty" }}>
{fl.t}
</div>
</div>
</div>
</Fragment>
))}
</div>
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fff" }}>
<span style={{ flex: "1 1 220px", minWidth: "0", fontSize: "12px", color: "#67787c" }}>
{r.rodape}
</span>
<button onClick={r.criarAtv} style={{ flex: "0 0 auto", height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
Criar atividade
</button>
<button onClick={r.enviarWa} style={{ flex: "0 0 auto", height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
Resumo no WhatsApp
</button>
<button onClick={r.religar} style={{ flex: "0 0 auto", height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#d93c1a")].filter(Boolean).join(" ")}>
Ligar de volta
</button>
</div>
</div>
</div>
</>) : null}
{(w.aberto) ? (<>
<div data-r="modal-fundo" onMouseDown={w.fora} style={{ position: "fixed", inset: "0", zIndex: "90", background: "rgba(18,23,29,.35)", display: "grid", placeItems: "center", padding: "16px", animation: "ofIn .15s ease both" }}>
<div style={{ width: "min(520px,100%)", maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", borderRadius: "16px", background: "#fff", boxShadow: "0 24px 64px rgba(18,23,29,.28)", overflow: "hidden", fontFamily: "Inter,system-ui,sans-serif", color: "#12171d", lineHeight: "1.4", textAlign: "left" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 18px 12px" }}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "10px", background: "#e6f4ee", color: "#1f7256", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700" }}>
Resumo no WhatsApp
</div>
<div style={{ fontSize: "12px", color: "#67787c", marginTop: "1px" }}>
Para {w.para}
</div>
</div>
<button onClick={w.cancelar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", border: "0", background: "transparent", display: "grid", placeItems: "center", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "4px 18px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Enviar por
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(w.numeros ?? []).map((n: any, i1: number) => (
<Fragment key={n?.id ?? n?.chave ?? i1}>
<button onClick={n.onClick} style={estilo(n.style)}>
<span style={estilo(n.radio)} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{n.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Mensagem
</div>
<textarea value={w.texto} onChange={w.setTexto} rows={7} style={{ width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: "10px", border: "0", outline: "0", boxShadow: "inset 0 0 0 1px #dbdede", font: "inherit", fontSize: "13px", lineHeight: "1.55", color: "#1f252c", background: "#fff" }} />
<div style={{ fontSize: "11.5px", color: "#67787c", marginTop: "5px" }}>
{w.contagem}
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end", padding: "12px 18px", borderTop: "1px solid #eef1f1" }}>
<button onClick={w.cancelar} style={{ flex: "0 0 auto", height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={w.enviar} style={{ flex: "0 0 auto", height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Enviar resumo
</button>
</div>
</div>
</div>
</>) : null}
</div>
    </>
  );
}
