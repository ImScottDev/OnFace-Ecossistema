"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Propostas.dc.html
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
import "./PropostasDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDePropostasDesenho {
  busca: any;
  fc: any;
  fd: any;
  fecharPainel: any;
  filtros: any;
  fp: any;
  linhas: any;
  novaAbrir: any;
  nv: any;
  p: any;
  pagAnt: any;
  pagAntStyle: any;
  pagProx: any;
  pagProxStyle: any;
  paginas: any;
  painelSobre: any;
  painelStyle: any;
  parar: any;
  rodape: any;
  setBusca: any;
  temPainel: any;
  vazio: any;
}

export function PropostasDesenho(vals: ValoresDePropostasDesenho) {
  const { busca, fc, fd, fecharPainel, filtros, fp, linhas, novaAbrir, nv, p, pagAnt, pagAntStyle, pagProx, pagProxStyle, paginas, painelSobre, painelStyle, parar, rodape, setBusca, temPainel, vazio } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", overflow: "hidden" }}>
<div style={{ flex: "1 1 auto", minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-in="rise" style={{ flex: "0 0 auto", padding: "14px 14px 0" }}>
<div style={estilo(`position:relative;overflow:hidden;display:grid;grid-template-columns:${fc.cols ?? ""};gap:${fc.gap ?? ""};padding:${fc.pad ?? ""};border-radius:18px;background:#12171d;color:#fff;box-shadow:0 1px 2px rgba(12,16,21,.12)`)}>
<span style={{ position: "absolute", left: "30%", top: "-120px", width: "420px", height: "260px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".1", filter: "blur(70px)", pointerEvents: "none" }} />
<div style={{ position: "relative", minWidth: "0", display: "flex", flexDirection: "column" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{fc.rotulo}
</span>
<span style={{ position: "relative", flex: "0 0 auto", display: "inline-flex" }} onMouseEnter={fc.infoOn} onMouseLeave={fc.infoOff}>
<button onClick={fc.abrirPop} title="O que é o forecast" style={{ width: "18px", height: "18px", borderRadius: "9999px", border: "0", padding: "0", background: "rgba(255,255,255,.1)", color: "#a3aab0", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:rgba(255,255,255,.18);color:#fff")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 16v-5M12 8h.01" />
</svg>
</button>
{(fc.infoAberto) ? (<>
<span style={{ position: "absolute", left: "-8px", top: "26px", zIndex: "5", width: "280px", padding: "12px 14px", borderRadius: "12px", background: "#fff", color: "#1f252c", boxShadow: "0 16px 40px -12px rgba(0,0,0,.5)", fontSize: "12.5px", lineHeight: "1.5", textTransform: "none", letterSpacing: "0", fontWeight: "500", whiteSpace: "normal" }}>
<strong style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d", marginBottom: "4px" }}>
O que é o forecast
</strong>
<strong style={{ fontWeight: "700" }}>
Ponderado:
</strong>
 soma das propostas que o cliente já visualizou ou pediu ajuste. 
<strong style={{ fontWeight: "700" }}>
Completo:
</strong>
 soma também as enviadas que ainda não foram abertas. Expiradas, recusadas e aceitas não entram (aceitas viram ganho). 
<span style={{ display: "block", marginTop: "8px", fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
Clique para ver a composição
</span>
</span>
</>) : null}
</span>
</span>
<span onClick={fc.abrirPop} title="Ver composição do forecast" style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0 6px", marginTop: "10px", cursor: "pointer" }}>
<span style={{ whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(32px,3.4vw,42px)", fontWeight: "800", letterSpacing: "-.045em", lineHeight: "1", fontVariantNumeric: "tabular-nums" }}>
{fc.valor}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
<span style={estilo(fc.deltaStyle)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
<path d={fc.deltaD} />
</svg>
{fc.delta}
</span>
{(fc.largo) ? (<>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{fc.deltaTxt}
</span>
</>) : null}
</span>
<div style={estilo(fc.modosBox)}>
<div style={{ display: "flex", gap: "4px" }}>
{(fc.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={estilo(tp.style)}>
{tp.l}
</button>
</Fragment>
))}
</div>
<span style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "30px", padding: "0 12px 0 10px", borderRadius: "9999px", background: "rgba(62,207,142,.1)", boxShadow: "inset 0 0 0 1px rgba(62,207,142,.22)", fontSize: "12.5px", fontWeight: "600", color: "#bff0d8", whiteSpace: "nowrap" }}>
<span style={{ width: "14px", height: "0", borderTop: "2px dotted #3ecf8e" }} />
{fc.ganhoTxt}
</span>
</div>
</div>
<div style={estilo(fc.chartCol)} onMouseLeave={fc.sair}>
<div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px 12px" }}>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "rgba(255,255,255,.06)" }}>
{(fc.vistas ?? []).map((vw: any, i1: number) => (
<Fragment key={vw?.id ?? vw?.chave ?? i1}>
<button onClick={vw.onClick} style={estilo(vw.style)}>
{vw.l}
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1" }} />
{(fc.legenda ?? []).map((lg: any, i1: number) => (
<Fragment key={lg?.id ?? lg?.chave ?? i1}>
<span style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#a3aab0" }}>
<span style={estilo(lg.marca)} />
{lg.l}
</span>
</Fragment>
))}
</div>
<span style={{ fontSize: "12px", color: "#8b949e", lineHeight: "1.4" }}>
{fc.pergunta}
</span>
<div style={{ display: "flex", gap: "8px", flex: "1", minHeight: "0" }}>
<div style={{ position: "relative", flex: "0 0 auto", width: "44px", fontSize: "10.5px", color: "#67787c", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
{(fc.yLabels ?? []).map((yl: any, i1: number) => (
<Fragment key={yl?.id ?? yl?.chave ?? i1}>
<span style={estilo(yl.style)}>
{yl.t}
</span>
</Fragment>
))}
</div>
<div style={estilo(fc.chartBox)}>
<svg viewBox="0 0 600 140" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
<defs>
<linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#fe4f2b" stopOpacity=".34" />
<stop offset="1" stopColor="#fe4f2b" stopOpacity="0" />
</linearGradient>
</defs>
<path d="M0 139.5H600" stroke="#2a3139" strokeWidth="1" vectorEffect="non-scaling-stroke" />
<path d="M0 74H600M0 8H600" stroke="#1f252c" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
{(fc.ehReceita) ? (<>
<path d={fc.dArea} fill="url(#fcFill)" style={{ transition: "d .7s cubic-bezier(.16,1,.3,1)", transformOrigin: "50% 100%", animation: "fcArea 1s .3s cubic-bezier(.16,1,.3,1) both" }} />
<path d={fc.dGanho} fill="none" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 5" vectorEffect="non-scaling-stroke" style={{ transition: "d .7s cubic-bezier(.16,1,.3,1)", animation: "fcArea .9s .6s cubic-bezier(.16,1,.3,1) both" }} />
<path d={fc.dLinha} pathLength="1" fill="none" stroke="#fe4f2b" strokeWidth="2.4" strokeLinejoin="round" strokeDasharray="1" vectorEffect="non-scaling-stroke" style={{ transition: "d .7s cubic-bezier(.16,1,.3,1)", animation: "fcDraw 1.3s .15s cubic-bezier(.65,0,.35,1) both" }} />
</>) : null}
{(fc.ehVolume) ? (<>
{(fc.barras ?? []).map((br: any, i1: number) => (
<Fragment key={br?.id ?? br?.chave ?? i1}>
<rect x={br.x} width={br.w} rx="2" style={estilo(br.style)} />
</Fragment>
))}
</>) : null}
<path d={fc.dGuia} stroke="#fe4f2b" strokeOpacity=".45" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" style={{ transition: "d .15s ease" }} />
</svg>
{(fc.ehReceita) ? (<>
<span style={estilo(fc.ponto)} />
</>) : null}
<div style={{ position: "absolute", inset: "0", display: "flex" }}>
{(fc.alvos ?? []).map((av: any, i1: number) => (
<Fragment key={av?.id ?? av?.chave ?? i1}>
<span onMouseEnter={av.entrar} style={{ flex: "1", height: "100%", cursor: "crosshair" }} />
</Fragment>
))}
</div>
<div style={estilo(fc.tipStyle)}>
<span style={{ display: "block", fontSize: "10.5px", color: "#8b949e" }}>
{fc.tipSem}
</span>
{(fc.tipLinhas ?? []).map((tl: any, i1: number) => (
<Fragment key={tl?.id ?? tl?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "12px", color: "#d7dbde" }}>
<span style={estilo(tl.dot)} />
{tl.l}
<strong style={{ marginLeft: "auto", paddingLeft: "10px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", color: "#fff", fontVariantNumeric: "tabular-nums" }}>
{tl.v}
</strong>
</span>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "52px", fontSize: "10.5px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{(fc.eixo ?? []).map((ex: any, i1: number) => (
<Fragment key={ex?.id ?? ex?.chave ?? i1}>
<span>
{ex}
</span>
</Fragment>
))}
</div>
</div>
<div style={estilo(fc.dirCol)}>
<div style={estilo(fc.funilBox)}>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
Funil
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "right", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{fc.funilTxt}
</span>
</div>
<div style={{ display: "flex", gap: "3px", height: "10px", marginTop: "12px", borderRadius: "9999px", overflow: "hidden", background: "#1f252c" }}>
{(fc.funil ?? []).map((fn: any, i1: number) => (
<Fragment key={fn?.id ?? fn?.chave ?? i1}>
<button onClick={fn.onClick} title={fn.dica} style={estilo(fn.style)} />
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "4px 6px", flexWrap: "wrap", marginTop: "8px", marginLeft: "-6px" }}>
{(fc.funil ?? []).map((fn: any, i1: number) => (
<Fragment key={fn?.id ?? fn?.chave ?? i1}>
<button onClick={fn.onClick} style={estilo(fn.chip)} className={[hover("background:rgba(255,255,255,.08)")].filter(Boolean).join(" ")}>
<span style={estilo(fn.dot)} />
{fn.l}
<strong style={{ color: "#fff", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
{fn.n}
</strong>
</button>
</Fragment>
))}
</div>
</div>
<div style={estilo(fc.kpiGrid)}>
{(fc.kpis ?? []).map((kp: any, i1: number) => (
<Fragment key={kp?.id ?? kp?.chave ?? i1}>
<button onClick={kp.onClick} style={{ padding: "11px 12px", border: "0", background: "#161c22", color: "#fff", textAlign: "left", cursor: "pointer", minWidth: "0" }} className={[hover("background:#1b2229")].filter(Boolean).join(" ")}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{kp.l}
</span>
<span style={estilo(kp.vStyle)}>
{kp.v}
</span>
</button>
</Fragment>
))}
</div>
</div>
</div>
</div>
<div data-r="toolbar" data-stagger="40" data-stagger-tipo="blur" style={{ flex: "0 0 auto", padding: "16px 14px 0", display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "34px", flex: "1 1 220px", maxWidth: "320px", minWidth: "160px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={busca} onChange={setBusca} placeholder="Proposta, empresa ou contato" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0" }} />
</div>
{(filtros ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div data-pp-filtro="1" style={{ position: "relative", flex: "0 0 auto" }}>
<div style={estilo(f.grupo)}>
<button onClick={f.abrir} data-pp-ancora="1" style={estilo(f.corpo)} className={[hover(f.hover)].filter(Boolean).join(" ")}>
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
</div>
</Fragment>
))}
<span style={{ flex: "1", minWidth: "8px" }} />
<button onClick={novaAbrir} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 14px", borderRadius: "9px", background: "#d93c1a", fontSize: "13px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova proposta
</span>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", padding: "12px 14px 14px", display: "flex", flexDirection: "column" }}>
<div style={{ flex: "0 1 auto", maxHeight: "100%", minHeight: "0", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9,0 1px 2px rgba(18,23,29,.04),0 12px 32px -24px rgba(18,23,29,.25)", overflow: "hidden" }}>
<div style={{ flex: "1", minHeight: "0", overflow: "auto" }}>
<div style={{ minWidth: "1100px" }}>
<div style={{ position: "sticky", top: "0", zIndex: "2", display: "grid", gridTemplateColumns: "minmax(210px,1.5fr) minmax(170px,1.2fr) 130px 150px 160px 160px 150px 96px", gap: "14px", padding: "12px 20px", background: "rgba(250,250,248,.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: "1px solid #eef1f1", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
<span>
Proposta
</span>
<span>
Empresa
</span>
<span>
Produto
</span>
<span style={{ textAlign: "right" }}>
Valor
</span>
<span>
Fechamento
</span>
<span>
Status
</span>
<span>
Responsável
</span>
<span>
Atualização
</span>
</div>
{(vazio) ? (<>
<div style={{ padding: "48px 20px", textAlign: "center" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#1f252c" }}>
Nenhuma proposta aqui
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "12.5px", color: "#67787c" }}>
Ajuste os filtros ou crie uma proposta a partir de uma oportunidade.
</span>
</div>
</>) : null}
<div data-stagger="22" data-stagger-tipo="rise">
{(linhas ?? []).map((l: any, i1: number) => (
<Fragment key={l?.id ?? l?.chave ?? i1}>
<button onClick={l.abrir} style={estilo(l.style)} className={[hover(l.hover)].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "0" }}>
<span style={estilo(l.famIco)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={l.famD} />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{l.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", fontWeight: "500", color: "#8b949e", fontVariantNumeric: "tabular-nums", letterSpacing: ".01em" }}>
{l.codigo}
</span>
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{l.empresa}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{l.pessoa}
</span>
</span>
</span>
<span style={estilo(l.famStyle)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={estilo(l.famDot)}>
<path d={l.famD} />
</svg>
{l.familia}
</span>
<span style={{ textAlign: "right", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{l.valor}
<span style={{ fontFamily: "Inter,sans-serif", fontSize: "11.5px", fontWeight: "600", color: "#8b949e" }}>
{l.valorSuf}
</span>
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
{l.valorSub}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
{l.fech}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{l.fechSub}
</span>
</span>
</span>
<span style={{ minWidth: "0" }}>
<span style={estilo(l.stStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(l.stDot)}>
<path d={l.stD} />
</svg>
{l.status}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={estilo(l.respAv)}>
{l.respIni}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{l.resp}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", minWidth: "0" }}>
<span style={estilo(l.atStyle)}>
{l.atualizado}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c9ca" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</span>
</button>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "12px 20px", background: "#fafaf8" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#67787c" }}>
{rodape}
</span>
<div style={{ display: "flex", alignItems: "center", gap: "6px", flex: "0 0 auto" }}>
<button onClick={pagAnt} style={estilo(pagAntStyle)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}>
<path d="m15 18-6-6 6-6" />
</svg>
Anterior
</button>
{(paginas ?? []).map((pg: any, i1: number) => (
<Fragment key={pg?.id ?? pg?.chave ?? i1}>
<button onClick={pg.onClick} style={estilo(pg.style)}>
{pg.n}
</button>
</Fragment>
))}
<button onClick={pagProx} style={estilo(pagProxStyle)}>
Próxima
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "4px" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</div>
</div>
</div>
</div>
</div>
{(temPainel) ? (<>
{(painelSobre) ? (<>
<div data-in="fade" onClick={fecharPainel} style={{ position: "fixed", inset: "0", zIndex: "39", background: "rgba(18,23,29,.34)" }} />
</>) : null}
<aside data-r="drawer" data-in="slide-left" style={estilo(painelStyle)}>
<div style={{ flex: "0 0 auto", padding: "16px 18px 14px", display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16.5px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", textWrap: "balance" }}>
{p.titulo}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
<span style={{ fontSize: "12px", color: "#8b949e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{p.codigo}
</span>
<span style={estilo(p.stStyle)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d={p.stD} />
</svg>
{p.status}
</span>
</span>
</span>
<button onClick={fecharPainel} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "16px 18px 22px", display: "grid", gridAutoRows: "max-content", alignContent: "start", gap: "16px" }}>
<button onClick={p.irEmpresa} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 14px", borderRadius: "12px", border: "0", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "10px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700" }}>
{p.empIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.empresa}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.pessoa}
</span>
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</button>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "1px", borderRadius: "12px", background: "#eef1f1", overflow: "hidden", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
{(p.kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<div style={{ background: "#fff", padding: "11px 12px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{k.l}
</span>
<span style={estilo(k.vStyle)}>
{k.v}
</span>
{(k.temSub) ? (<>
<span style={estilo(k.subStyle)}>
{k.sub}
</span>
</>) : null}
</div>
</Fragment>
))}
</div>
{(p.temResp) ? (<>
<div style={estilo(p.respBox)}>
<span style={estilo(p.respTit)}>
{p.respTitulo}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#1f252c", lineHeight: "1.55", textWrap: "pretty" }}>
{p.respTxt}
</span>
</div>
</>) : null}
<div style={{ padding: "14px", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
</svg>
<span style={{ flex: "1", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
Link público
</span>
<span style={estilo(p.linkSelo)}>
{p.linkEstado}
</span>
</div>
<span style={estilo(p.linkUrlStyle)}>
{p.link}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "11.5px", color: "#8b949e", lineHeight: "1.45" }}>
{p.linkNota}
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px" }}>
<button onClick={p.verProposta} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
</svg>
Ver proposta
</button>
{(p.linkAtivo) ? (<>
<button onClick={p.copiar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 9h11v11H9zM5 15H4V4h11v1" />
</svg>
Copiar link
</button>
</>) : null}
<button onClick={p.irOpp} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Abrir oportunidade
</button>
</div>
{(p.temAcoes) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
{(p.acoes ?? []).map((ac: any, i1: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i1}>
<button onClick={ac.onClick} style={estilo(ac.style)}>
{ac.label}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
{(p.temLog) ? (<>
<div>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
Acompanhamento
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.logResumo}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{(p.log ?? []).map((lg: any, i1: number) => (
<Fragment key={lg?.id ?? lg?.chave ?? i1}>
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", minHeight: "26px" }}>
<span style={estilo(lg.linha)} />
<span style={estilo(lg.ico)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d={lg.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{lg.t}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{lg.quando}
</span>
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
<div>
<span style={{ display: "block", marginBottom: "10px", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
Depois do aceite
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
{(p.fluxo ?? []).map((fx: any, i1: number) => (
<Fragment key={fx?.id ?? fx?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<span style={estilo(fx.bola)}>
{fx.n}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{fx.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e" }}>
{fx.s}
</span>
</span>
</div>
</Fragment>
))}
</div>
</div>
{(p.temVersoes) ? (<>
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
Versões
</span>
<div style={{ borderRadius: "11px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
{(p.versoes ?? []).map((vs: any, i1: number) => (
<Fragment key={vs?.id ?? vs?.chave ?? i1}>
<button onClick={vs.abrir} style={estilo(vs.style)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{vs.codigo}
</span>
<span style={estilo(vs.stStyle)}>
{vs.status}
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{vs.valor}
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
</aside>
</>) : null}
{(fd.aberto) ? (<>
<div data-pp-filtro="1" data-in="drop" style={estilo(`${fd.pos ?? ""};min-width:220px;border-radius:10px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 10px 26px -6px rgba(0,0,0,.2),0 2px 4px -2px rgba(0,0,0,.1);padding:5px`)}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "6px 6px 4px" }}>
{fd.titulo}
</div>
{(fd.opcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
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
<button onClick={fd.limpar} style={{ width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "12.5px", fontWeight: "600", color: "#c2330f" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Limpar
</button>
</div>
</>) : null}
{(fp.aberto) ? (<>
<div data-in="fade" onClick={fp.fechar} style={{ position: "fixed", inset: "0", zIndex: "64", background: "rgba(12,16,21,.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
<div style={{ position: "fixed", inset: "0", zIndex: "65", display: "grid", placeItems: "center", padding: "20px 12px", pointerEvents: "none" }}>
<div data-in="pop" style={{ pointerEvents: "auto", width: "min(1000px,100%)", height: "min(680px,100%)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "22px", boxShadow: "0 40px 90px -30px rgba(12,16,21,.6)", overflow: "hidden" }}>
<div style={{ position: "relative", overflow: "hidden", flex: "0 0 auto", padding: "clamp(14px,2.6vh,22px) 26px", background: "#12171d", color: "#fff" }}>
<span style={{ position: "absolute", right: "-80px", top: "-120px", width: "360px", height: "260px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".14", filter: "blur(60px)", pointerEvents: "none" }} />
<div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "16px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
{fp.rotulo}
</span>
<span style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 10px", marginTop: "8px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,5vh,38px)", fontWeight: "800", letterSpacing: "-.045em", lineHeight: "1", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{fp.valor}
</span>
</span>
</span>
<div style={{ flex: "0 0 auto", display: "flex", gap: "4px", alignSelf: "center" }}>
{(fp.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={estilo(tp.style)}>
{tp.l}
</button>
</Fragment>
))}
</div>
<button onClick={fp.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "10px", border: "0", background: "rgba(255,255,255,.08)", color: "#d7dbde", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:rgba(255,255,255,.16)")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "1px", marginTop: "clamp(10px,2vh,18px)", borderRadius: "12px", background: "#2a3139", overflow: "hidden" }}>
{(fp.resumo ?? []).map((rs: any, i1: number) => (
<Fragment key={rs?.id ?? rs?.chave ?? i1}>
<span style={{ display: "block", padding: "11px 14px", background: "#161c22", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{rs.l}
</span>
<span style={estilo(rs.vStyle)}>
{rs.v}
</span>
{(rs.temSub) ? (<>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#a3aab0", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{rs.sub}
</span>
</>) : null}
</span>
</Fragment>
))}
</div>
<div style={{ position: "relative", marginTop: "16px" }}>
<div style={{ display: "flex", height: "10px", borderRadius: "9999px", overflow: "hidden", background: "#1f252c", gap: "2px" }}>
{(fp.comp ?? []).map((cp: any, i1: number) => (
<Fragment key={cp?.id ?? cp?.chave ?? i1}>
<span title={cp.dica} style={estilo(cp.style)} />
</Fragment>
))}
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: "9px" }}>
{(fp.comp ?? []).map((cp: any, i1: number) => (
<Fragment key={cp?.id ?? cp?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#a3aab0", whiteSpace: "nowrap" }}>
<span style={estilo(cp.dot)} />
{cp.l}
<strong style={{ color: "#fff", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{cp.v}
</strong>
</span>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ flex: "1", minHeight: "0", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "0 0 220px", maxWidth: "100%", minHeight: "0", maxHeight: "100%", padding: "12px 10px", borderRight: "1px solid #eef1f1", display: "flex", flexDirection: "column", gap: "3px", overflowY: "auto" }}>
{(fp.abas ?? []).map((ab: any, i1: number) => (
<Fragment key={ab?.id ?? ab?.chave ?? i1}>
<button onClick={ab.onClick} style={estilo(ab.style)} className={[hover(ab.hover)].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={estilo(ab.icoStyle)}>
<path d={ab.d} />
</svg>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ab.l}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{ab.sub}
</span>
{(ab.temSub2) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#a3a8a4", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{ab.sub2}
</span>
</>) : null}
</span>
<span style={estilo(ab.nStyle)}>
{ab.n}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ flex: "1 1 400px", minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column" }}>
<div style={{ flex: "0 0 auto", padding: "16px 20px 10px" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
{fp.abaT}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{fp.abaS}
</span>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "0 20px 18px" }}>
{(fp.vazia) ? (<>
<div style={{ padding: "36px 0", textAlign: "center", fontSize: "13px", color: "#8b949e" }}>
Nenhuma proposta nesta situação.
</div>
</>) : null}
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(fp.itens ?? []).map((it: any, i1: number) => (
<Fragment key={it?.id ?? it?.chave ?? i1}>
<button onClick={it.abrir} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr) auto", alignItems: "center", gap: "14px", width: "100%", padding: "12px 14px", borderRadius: "13px", border: "0", background: "#fff", boxShadow: "0 0 0 1px #e8ebeb", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:0 0 0 1.5px #12171d")].filter(Boolean).join(" ")}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.empresa}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.meta}
</span>
</span>
<span style={{ minWidth: "0", display: "flex", flexDirection: "column", gap: "5px" }}>
<span style={estilo(it.prazoStyle)}>
{it.prazo}
</span>
<span style={{ display: "block", height: "4px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(it.barra)} />
</span>
</span>
<span style={{ textAlign: "right" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.valor}
</span>
{(it.valorSub) ? (<>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{it.valorSub}
</span>
</>) : null}
<span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{it.contrib}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
</div>
</div>
</div>
</div>
</>) : null}
{(nv.aberto) ? (<>
<div onClick={nv.fechar} data-in="fade" style={{ position: "fixed", inset: "0", zIndex: "62", background: "rgba(12,16,21,.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
<div style={{ position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "63", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
<div data-in="rise-up" onClick={parar} style={{ pointerEvents: "auto", width: "min(1080px,calc(100vw - 20px))", height: "min(780px,calc(100vh - 48px))", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "26px 26px 0 0", boxShadow: "0 -1px 0 rgba(255,255,255,.6),0 -30px 80px -24px rgba(12,16,21,.55)", overflow: "hidden" }}>
<button onClick={nv.fechar} title="Fechar" style={{ flex: "0 0 auto", alignSelf: "center", width: "72px", height: "18px", marginTop: "6px", border: "0", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center" }}>
<span style={{ width: "44px", height: "5px", borderRadius: "9999px", background: "#d7dada" }} />
</button>
<div style={{ flex: "0 0 auto", padding: "8px 36px 20px", display: "flex", alignItems: "flex-end", gap: "20px", flexWrap: "wrap" }}>
<span style={{ flex: "1 1 320px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(22px,2.6vw,28px)", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.1", color: "#12171d" }}>
{nv.titulo}
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "14px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
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
<div data-stagger="60" data-stagger-tipo="rise" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "14px" }}>
{(nv.caminhos ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<button onClick={cm.onClick} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", minHeight: "176px", padding: "22px 22px 20px", borderRadius: "20px", border: "0", background: "#fff", boxShadow: "0 0 0 1px #e8ebeb,0 1px 2px rgba(18,23,29,.04)", cursor: "pointer", textAlign: "left", transition: "transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s ease" }} className={[hover("transform:translateY(-3px);box-shadow:0 0 0 1.5px #12171d,0 18px 36px -18px rgba(18,23,29,.35)")].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
<span style={estilo(cm.ico)}>
<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={cm.d} />
</svg>
</span>
<span style={{ flex: "1" }} />
{(cm.temN) ? (<>
<span style={{ flex: "0 0 auto", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", height: "26px", padding: "0 10px", borderRadius: "9999px", background: "#f3f4f4", fontSize: "12px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{cm.n}
</span>
</>) : null}
</span>
<span style={{ display: "block", marginTop: "6px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{cm.l}
</span>
<span style={{ display: "block", maxWidth: "360px", fontSize: "13.5px", color: "#67787c", lineHeight: "1.55", textWrap: "pretty" }}>
{cm.s}
</span>
<span style={{ position: "absolute", right: "20px", bottom: "20px", width: "34px", height: "34px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</span>
{(cm.temNota) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "auto", height: "24px", padding: "0 9px", borderRadius: "9999px", background: "#fff6f4", fontSize: "11.5px", fontWeight: "600", color: "#c2330f" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 5v14M5 12h14" />
</svg>
{cm.nota}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
{(nv.eBusca) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
{(nv.temTipos) ? (<>
<div>
<span style={{ display: "flex", gap: "3px", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Tipo da venda
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "8px" }}>
{(nv.tiposCli ?? []).map((tc: any, i1: number) => (
<Fragment key={tc?.id ?? tc?.chave ?? i1}>
<button onClick={tc.onClick} style={estilo(tc.style)}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700" }}>
{tc.l}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", fontWeight: "500", opacity: ".8", lineHeight: "1.4" }}>
{tc.s}
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
{(nv.temFiltroBase) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(nv.filtroBase ?? []).map((fb: any, i1: number) => (
<Fragment key={fb?.id ?? fb?.chave ?? i1}>
<button onClick={fb.onClick} style={estilo(fb.style)}>
{fb.l}
</button>
</Fragment>
))}
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "10px", height: "52px", padding: "0 18px", borderRadius: "9999px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 8px 24px -16px rgba(18,23,29,.35)" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={nv.q} onChange={nv.setQ} placeholder={nv.buscaPh} autoFocus={true} style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "15px" }} />
</div>
<div data-stagger="25" data-stagger-tipo="rise" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "10px" }}>
{(nv.itens ?? []).map((it: any, i1: number) => (
<Fragment key={it?.id ?? it?.chave ?? i1}>
<button onClick={it.onClick} style={estilo(it.style)} className={[hover(it.hover)].filter(Boolean).join(" ")}>
<span style={estilo(it.ico)}>
{it.ini}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.s}
</span>
</span>
{(it.temSelo) ? (<>
<span style={estilo(it.seloStyle)}>
{it.selo}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
{(nv.semItens) ? (<>
<span style={{ padding: "24px 0", fontSize: "13px", color: "#8b949e", textAlign: "center" }}>
Nada encontrado com essa busca.
</span>
</>) : null}
</div>
</>) : null}
{(nv.eConfirma) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "22px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", borderRadius: "18px", background: "#fff", boxShadow: "0 0 0 1px #e8ebeb,0 10px 26px -18px rgba(18,23,29,.35)" }}>
<span style={{ flex: "0 0 auto", width: "42px", height: "42px", borderRadius: "11px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700" }}>
{nv.alvoIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
{nv.alvoT}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", color: "#67787c" }}>
{nv.alvoS}
</span>
</span>
<button onClick={nv.trocarAlvo} style={{ flex: "0 0 auto", height: "32px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
Trocar
</button>
</div>
{(nv.pedeEmpresa) ? (<>
<div>
<span style={{ display: "flex", gap: "3px", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Empresa do contato
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<span style={{ display: "block", margin: "-2px 0 8px", fontSize: "12px", color: "#c2330f" }}>
Este contato não tem empresa. Proposta precisa de empresa.
</span>
<input value={nv.empNova} onChange={nv.setEmpNova} placeholder="Nome da empresa" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "14px", color: "#12171d" }} />
</div>
</>) : null}
{(nv.pedeContato) ? (<>
<div>
<span style={{ display: "flex", gap: "3px", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Contato que recebe
<span style={{ color: "#c2330f" }}>
*
</span>
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
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e" }}>
{ct.cargo}
</span>
</span>
</button>
</Fragment>
))}
{(nv.semContato) ? (<>
<span style={{ fontSize: "12px", color: "#c2330f", fontWeight: "600" }}>
Esta empresa ainda não tem contato. Cadastre quem vai receber.
</span>
</>) : null}
{(nv.novoContatoAberto) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "8px" }}>
<input value={nv.ncNome} onChange={nv.setNcNome} placeholder="Nome completo" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "14px", color: "#12171d" }} />
<input value={nv.ncEmail} onChange={nv.setNcEmail} type="email" placeholder="email@empresa.com.br" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "14px", color: "#12171d" }} />
</div>
</>) : null}
{(nv.podeNovoContato) ? (<>
<button onClick={nv.abrirNovoContato} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 10px", marginLeft: "-4px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Outro contato
</button>
</>) : null}
</div>
</div>
</>) : null}
{(nv.pedeProduto) ? (<>
<div>
<span style={{ display: "flex", gap: "3px", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Produto
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(nv.familias ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onClick={fm.onClick} style={estilo(fm.style)}>
{fm.l}
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
{(nv.pedeCloser) ? (<>
<div>
<span style={{ display: "flex", gap: "3px", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Closer
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "42px", padding: "0 12px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "14px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{nv.closer}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={nv.closer} onChange={nv.setCloser} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(nv.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
</>) : null}
{(nv.temSubst) ? (<>
<div style={{ padding: "14px", borderRadius: "12px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #f6d3c9" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#9c3210" }}>
{nv.substT}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "12.5px", color: "#7a2a12", lineHeight: "1.5", textWrap: "pretty" }}>
{nv.substS}
</span>
</div>
</>) : null}
</div>
<div style={{ position: "relative", overflow: "hidden", padding: "22px", borderRadius: "20px", background: "#12171d", color: "#fff", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 24px 48px -24px rgba(12,16,21,.7)" }}>
<span style={{ position: "absolute", right: "-60px", top: "-60px", width: "180px", height: "180px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".16", filter: "blur(40px)" }} />
<span style={{ fontSize: "11.5px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#a3aab0" }}>
O que vai acontecer
</span>
{(nv.efeitos ?? []).map((ef: any, i1: number) => (
<Fragment key={ef?.id ?? ef?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "10px", background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)", display: "grid", placeItems: "center" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff8a70" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={ef.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", lineHeight: "1.35", textWrap: "pretty" }}>
{ef.t}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#a3aab0", lineHeight: "1.45", textWrap: "pretty" }}>
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
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "16px 36px", borderTop: "1px solid #eef1f1", background: "#fff" }}>
{(nv.temVoltar) ? (<>
<button onClick={nv.voltar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "46px", padding: "0 18px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
Voltar
</button>
</>) : null}
{(nv.temErro) ? (<>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#c2330f" }}>
{nv.erro}
</span>
</>) : null}
<span style={{ flex: "1" }} />
<button onClick={nv.fechar} style={{ flex: "0 0 auto", height: "42px", padding: "0 16px", borderRadius: "10px", border: "0", background: "transparent", fontSize: "13.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Cancelar
</button>
{(nv.temCriar) ? (<>
<button onClick={nv.criar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", height: "46px", padding: "0 22px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxShadow: "0 10px 24px -12px rgba(254,79,43,.8)" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
{nv.criarTxt}
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</>) : null}
</div>
</div>
</div>
</>) : null}
</div>
    </>
  );
}
