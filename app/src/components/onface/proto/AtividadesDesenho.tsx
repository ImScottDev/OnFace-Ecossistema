"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Atividades.dc.html
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
import "./AtividadesDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeAtividadesDesenho {
  abrirPicker: any;
  agenda: any;
  agendaData: any;
  agendaN: any;
  agendaVazia: any;
  agrupos: any;
  busca: any;
  colStyle: any;
  colunas: any;
  dash: any;
  declinadasDica: any;
  declinadasLbl: any;
  dt: any;
  ed: any;
  ehGeral: any;
  ehLista: any;
  ehQuadro: any;
  fd2: any;
  feed: any;
  filtros: any;
  grupos: any;
  listaVazia: any;
  naoGeral: any;
  novaAtv: any;
  nx: any;
  ov: any;
  parar: any;
  sem: any;
  setBusca: any;
  temLateral: any;
  toggleDeclinadas: any;
  visoes: any;
}

export function AtividadesDesenho(vals: ValoresDeAtividadesDesenho) {
  const { abrirPicker, agenda, agendaData, agendaN, agendaVazia, agrupos, busca, colStyle, colunas, dash, declinadasDica, declinadasLbl, dt, ed, ehGeral, ehLista, ehQuadro, fd2, feed, filtros, grupos, listaVazia, naoGeral, novaAtv, nx, ov, parar, sem, setBusca, temLateral, toggleDeclinadas, visoes } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", overflow: "hidden" }}>
<div style={estilo(colStyle)}>
<div data-r="toolbar" data-stagger="35" data-stagger-tipo="blur" style={{ flex: "0 0 auto", padding: "14px 14px 0", display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "34px", flex: "1 1 200px", maxWidth: "280px", minWidth: "150px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={busca} onChange={setBusca} placeholder="Atividade, empresa ou pessoa" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0" }} />
</div>
{(filtros ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div data-at-filtro="1" style={{ position: "relative", flex: "0 0 auto" }}>
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
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
</div>
</div>
</Fragment>
))}
<span style={{ flex: "1", minWidth: "8px" }} />
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px", flex: "0 0 auto", height: "34px", alignItems: "stretch" }}>
{(visoes ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.onClick} style={estilo(v.style)}>
{v.l}
</button>
</Fragment>
))}
</div>
<button onClick={novaAtv} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 14px", borderRadius: "9px", background: "#d93c1a", fontSize: "13px", fontWeight: "500", color: "#fff", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Nova atividade
</button>
</div>
{(naoGeral) ? (<>

</>) : null}
{(ehGeral) ? (<>
<div style={{ flex: "0 0 auto", padding: "14px 14px 20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
<div data-stagger="45" data-stagger-tipo="rise" style={{ flex: "1000 1 600px", minWidth: "0", display: "grid", gridTemplateColumns: "repeat(12,minmax(0,1fr))", gap: "12px" }}>
<div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "flex-end", gap: "16px 32px", flexWrap: "wrap", padding: "4px 4px 6px" }}>
<div style={{ flex: "1 1 340px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "500", color: "#67787c" }}>
{dash.dataTxt}
</span>
<span style={{ display: "block", marginTop: "4px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "34px", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.05", color: "#12171d" }}>
{dash.saud}
</span>
<span style={{ display: "block", marginTop: "8px", fontSize: "14px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{dash.frase}
</span>
</div>
</div>
<section style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,145px),1fr))", background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(dash.kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<button onClick={k.onClick} style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "0", padding: "16px 18px 14px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", boxShadow: "inset -1px 0 0 #eef1f1,inset 0 -1px 0 #eef1f1" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
<span style={{ minWidth: "0", fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.l}
</span>
<span style={{ flex: "1" }} />
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 17 17 7M8 7h9v9" />
</svg>
</span>
<span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
<span style={estilo(k.vStyle)}>
{k.v}
</span>
{(k.temDelta) ? (<>
<span style={estilo(k.dStyle)}>
{k.delta}
</span>
</>) : null}
</span>
<span style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "2px", height: "20px", width: "100%", maxWidth: "240px", overflow: "hidden" }}>
{(k.barras ?? []).map((b: any, i2: number) => (
<Fragment key={b?.id ?? b?.chave ?? i2}>
<span style={estilo(b)} />
</Fragment>
))}
</span>
<span style={{ display: "block", width: "100%", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.sub}
</span>
</button>
</Fragment>
))}
</section>
<section style={estilo(`${ov.c7 ?? ""};align-self:start;background:#fff;border-radius:14px;box-shadow:inset 0 0 0 1px #e3e7e8;padding:16px 14px 10px;min-width:0;display:flex;flex-direction:column`)}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "0 4px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap" }}>
Foco de hoje
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "12.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{dash.focoResumo}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", marginTop: "10px" }}>
{(dash.focoVazio) ? (<>
<div style={{ margin: "4px", padding: "34px 16px", borderRadius: "12px", background: "#fafafa", textAlign: "center", fontSize: "13px", color: "#8b949e" }}>
{dash.focoVazioTxt}
</div>
</>) : null}
{(dash.grupos ?? []).map((gp: any, i1: number) => (
<Fragment key={gp?.id ?? gp?.chave ?? i1}>
<button onClick={gp.alternar} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", marginTop: "6px", padding: "8px 6px", border: "0", borderRadius: "8px", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(gp.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={estilo(gp.dot)} />
<span style={{ fontSize: "12.5px", fontWeight: "500", color: "#12171d" }}>
{gp.l}
</span>
<span style={estilo(gp.nStyle)}>
{gp.n}
</span>
<span style={{ flex: "1", height: "1px", background: "#eef1f1", marginLeft: "4px" }} />
</button>
{(gp.aberto) ? (<>
{(gp.itens ?? []).map((c: any, i2: number) => (
<Fragment key={c?.id ?? c?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 6px", borderRadius: "10px", boxShadow: "inset 0 -1px 0 #f1f3f3" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<button onClick={c.abrir} style={{ flex: "1", minWidth: "0", padding: "0", border: "0", background: "transparent", textAlign: "left", cursor: "pointer" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
<span style={{ fontSize: "13.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.titulo}
</span>
{(c.temPrio) ? (<>
<span title={c.prioDica} style={estilo(c.prioStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
<path d="M5 21V4h11l-2 4 2 4H7v9z" />
</svg>
</span>
</>) : null}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.vincTxt}
</span>
</button>
<span data-r="esconde-mobile" style={estilo(c.prazoPill)}>
{c.prazo}
</span>
<button onClick={c.acao} style={{ flex: "0 0 auto", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#f3f4f4", fontSize: "12px", fontWeight: "500", color: "#12171d", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#12171d;color:#fff")].filter(Boolean).join(" ")}>
{c.acaoTxt}
</button>
</div>
</Fragment>
))}
{(gp.temMais) ? (<>
<button onClick={gp.verMais} style={{ display: "block", margin: "4px 0 2px 34px", padding: "4px 8px", border: "0", borderRadius: "7px", background: "transparent", fontSize: "12px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f3f4f4;color:#12171d")].filter(Boolean).join(" ")}>
{gp.mais}
</button>
</>) : null}
</>) : null}
</Fragment>
))}
</div>
<button onClick={dash.verLista} style={{ alignSelf: "center", marginTop: "8px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f3f4f4;color:#12171d")].filter(Boolean).join(" ")}>
{dash.verListaTxt}
</button>
</section>
<section style={estilo(`${ov.c5 ?? ""};background:#fff;border-radius:14px;box-shadow:inset 0 0 0 1px #e3e7e8;padding:16px 14px 6px;min-width:0;display:flex;flex-direction:column;max-height:560px`)}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 4px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap" }}>
Minha timeline
</span>
<span style={{ flex: "1" }} />
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "500", color: "#1f7256" }}>
<span style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "#1f7256" }} />
Ao vivo
</span>
</div>
<span style={{ display: "block", marginTop: "4px", padding: "0 4px", fontSize: "12.5px", color: "#67787c", textWrap: "pretty" }}>
{dash.tlResumo}
</span>
<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "10px", padding: "0 4px" }}>
{(dash.tlFiltros ?? []).map((tf: any, i1: number) => (
<Fragment key={tf?.id ?? tf?.chave ?? i1}>
<button onClick={tf.onClick} style={estilo(tf.style)}>
{tf.l}
</button>
</Fragment>
))}
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", marginTop: "6px", padding: "0 4px" }}>
{(dash.tlVazio) ? (<>
<div style={{ margin: "8px 0", padding: "28px 16px", borderRadius: "12px", background: "#fafafa", textAlign: "center", fontSize: "13px", color: "#8b949e" }}>
Nada por aqui ainda.
</div>
</>) : null}
{(dash.tl ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div style={{ position: "sticky", top: "0", zIndex: "2", background: "#fff", padding: "10px 0 6px", fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
{g.l}
</div>
{(g.itens ?? []).map((ti: any, i2: number) => (
<Fragment key={ti?.id ?? ti?.chave ?? i2}>
<button onClick={ti.ir} style={{ display: "flex", alignItems: "flex-start", gap: "10px", width: "100%", padding: "4px 6px 16px 0", border: "0", borderRadius: "10px", background: "transparent", textAlign: "left", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "38px", paddingTop: "8px", fontSize: "11.5px", fontWeight: "500", color: "#8b949e", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
{ti.hora}
</span>
<span style={{ position: "relative", flex: "0 0 auto", alignSelf: "stretch", width: "30px", display: "flex", justifyContent: "center" }}>
<span style={estilo(ti.linha)} />
<span style={estilo(ti.icoStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={ti.ico} />
</svg>
</span>
</span>
<span style={{ flex: "1", minWidth: "0", paddingTop: "2px" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#12171d", lineHeight: "1.4", textWrap: "pretty" }}>
{ti.acao}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ti.alvo}
</span>
{(ti.temMeta) ? (<>
<span style={{ display: "inline-block", maxWidth: "100%", marginTop: "6px", padding: "5px 9px", borderRadius: "8px", background: "#f6f6f3", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4" }}>
{ti.meta}
</span>
</>) : null}
</span>
</button>
</Fragment>
))}
</Fragment>
))}
</div>
</section>
<div style={estilo(`grid-column:1 / -1;display:grid;${dash.linhaCols ?? ""};gap:12px`)}>
{(ov.radares ?? []).map((rd: any, i1: number) => (
<Fragment key={rd?.id ?? rd?.chave ?? i1}>
<section style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "18px 20px 16px", minWidth: "0", display: "flex", flexDirection: "column" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap" }}>
{rd.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rd.desc}
</span>
{(rd.ehBarra) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px", marginTop: "14px" }}>
{(rd.stats ?? []).map((st: any, i2: number) => (
<Fragment key={st?.id ?? st?.chave ?? i2}>
<div style={{ minWidth: "0", padding: "10px 12px", borderRadius: "11px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #f1f3f3" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<span style={estilo(st.dot)} />
{st.l}
</span>
<span style={estilo(st.vStyle)}>
{st.v}
</span>
</div>
</Fragment>
))}
</div>
<div onMouseLeave={rd.sair} style={{ position: "relative", height: "190px", marginTop: "14px" }}>
<span style={estilo(rd.hojeBand)} />
<svg viewBox="0 0 700 180" preserveAspectRatio="none" style={{ position: "absolute", inset: "0 0 0 0", width: "100%", height: "170px", overflow: "visible" }}>
<defs>
<linearGradient id="gSemC" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#fe4f2b" stopOpacity=".22" />
<stop offset="1" stopColor="#1f7256" stopOpacity="0" />
</linearGradient>
<linearGradient id="gSemP" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stopColor="#12171d" stopOpacity=".07" />
<stop offset="1" stopColor="#12171d" stopOpacity="0" />
</linearGradient>
</defs>
<path d="M0 20H700M0 66.7H700M0 113.3H700M0 160H700" stroke="#eef1f1" strokeWidth="1" vectorEffect="non-scaling-stroke" />
<path d={rd.planA} fill="url(#gSemP)" style={{ transition: "d .6s cubic-bezier(.16,1,.3,1)" }} />
<path d={rd.planL} fill="none" stroke="#12171d" strokeWidth="1.6" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" style={{ transition: "d .6s cubic-bezier(.16,1,.3,1)" }} />
<path d={rd.concA} fill="url(#gSemC)" style={{ transition: "d .6s cubic-bezier(.16,1,.3,1)" }} />
<path d={rd.concL} fill="none" stroke="#fe4f2b" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ transition: "d .6s cubic-bezier(.16,1,.3,1)" }} />
</svg>
{(rd.pts ?? []).map((pt: any, i2: number) => (
<Fragment key={pt?.id ?? pt?.chave ?? i2}>
<span style={estilo(pt.s)} />
</Fragment>
))}
{(rd.temDica) ? (<>
<span style={estilo(rd.cruz)} />
</>) : null}
<div style={{ position: "absolute", left: "0", right: "0", top: "0", height: "170px", display: "flex" }}>
{(rd.cols ?? []).map((co: any, i2: number) => (
<Fragment key={co?.id ?? co?.chave ?? i2}>
<span onMouseEnter={co.entrar} onClick={co.entrar} style={{ flex: "1", cursor: "crosshair" }} />
</Fragment>
))}
</div>
<div style={{ position: "absolute", left: "0", right: "0", bottom: "0", display: "flex" }}>
{(rd.cols ?? []).map((co: any, i2: number) => (
<Fragment key={co?.id ?? co?.chave ?? i2}>
<span style={estilo(co.lStyle)}>
{co.l}
</span>
</Fragment>
))}
</div>
{(rd.temDica) ? (<>
<div style={estilo(rd.dicaPos)}>
<span style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
{rd.dicaT}
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
{(rd.dica ?? []).map((dl: any, i2: number) => (
<Fragment key={dl?.id ?? dl?.chave ?? i2}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap" }}>
<span style={estilo(dl.dot)} />
<span style={{ flex: "1" }}>
{dl.l}
</span>
<strong style={{ marginLeft: "14px", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{dl.v}
</strong>
</span>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
</>) : null}
{(rd.ehLista) ? (<>
<div onMouseLeave={rd.rosSair} style={{ position: "relative", width: "100%", maxWidth: "280px", margin: "12px auto 0", aspectRatio: "2 / 1.12" }}>
<svg viewBox="0 0 240 134" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
<path d="M22 122 A98 98 0 0 1 218 122" fill="none" stroke="#f1f3f3" strokeWidth="20" strokeLinecap="round" />
{(rd.arcos ?? []).map((ar: any, i2: number) => (
<Fragment key={ar?.id ?? ar?.chave ?? i2}>
<path d="M22 122 A98 98 0 0 1 218 122" fill="none" stroke={ar.cor} strokeWidth={ar.sw} pathLength="100" strokeDasharray={ar.da} strokeDashoffset={ar.off} onMouseEnter={ar.entrar} style={{ transition: "stroke-width .15s,stroke-dasharray .7s cubic-bezier(.16,1,.3,1),stroke-dashoffset .7s cubic-bezier(.16,1,.3,1)", cursor: "default" }} />
</Fragment>
))}
</svg>
<div style={{ position: "absolute", left: "0", right: "0", bottom: "2px", textAlign: "center", pointerEvents: "none" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "34px", fontWeight: "800", letterSpacing: "-.04em", lineHeight: "1", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{rd.gN}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "12px", color: "#67787c" }}>
{rd.gL}
</span>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: "4px 10px", marginTop: "14px" }}>
{(rd.ros ?? []).map((ro: any, i2: number) => (
<Fragment key={ro?.id ?? ro?.chave ?? i2}>
<div onMouseEnter={ro.entrar} onMouseLeave={rd.rosSair} style={estilo(ro.row)}>
<span style={estilo(ro.dot)} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ro.l}
</span>
<strong style={{ fontSize: "12.5px", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{ro.n}
</strong>
</div>
</Fragment>
))}
</div>
<span style={{ display: "block", marginTop: "14px", fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
Por tipo
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
{(rd.linhas ?? []).map((ln: any, i2: number) => (
<Fragment key={ln?.id ?? ln?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ flex: "0 0 76px", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ln.l}
</span>
<span style={{ flex: "1", minWidth: "30px", height: "8px", borderRadius: "9999px", background: "#f1f3f3", overflow: "hidden", display: "flex", gap: "2px" }}>
<span style={estilo(ln.bCon)} />
<span style={estilo(ln.bAnd)} />
<span style={estilo(ln.bAtr)} />
</span>
<span style={{ flex: "0 0 auto", width: "40px", textAlign: "right", fontSize: "12px", fontWeight: "500", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{ln.txt}
</span>
</div>
</Fragment>
))}
{(rd.semLinhas) ? (<>
<div style={{ padding: "20px 10px", textAlign: "center", fontSize: "12.5px", color: "#8b949e" }}>
Nada com prazo neste mês.
</div>
</>) : null}
</div>
</>) : null}
{(rd.ehRadar) ? (<>
<div onMouseLeave={rd.sair} style={{ position: "relative", width: "calc(100% - 64px)", maxWidth: "270px", aspectRatio: "1", margin: "10px auto 0" }}>
<svg viewBox="0 0 240 240" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
<path d={rd.grade} fill="none" stroke="#e3e7e8" strokeWidth="1" />
<path d={rd.raios} fill="none" stroke="#e3e7e8" strokeWidth="1" />
{(rd.series ?? []).map((se: any, i2: number) => (
<Fragment key={se?.id ?? se?.chave ?? i2}>
<path d={se.d} fill={se.cor} fillOpacity={se.fo} stroke={se.cor} strokeOpacity={se.so} strokeWidth="1.5" strokeLinejoin="round" style={{ transition: "d .5s cubic-bezier(.16,1,.3,1)" }} />
</Fragment>
))}
<path d={rd.raioOn} fill="none" stroke="#12171d" strokeOpacity=".35" strokeWidth="1" strokeDasharray="3 3" />
{(rd.pontos ?? []).map((pt: any, i2: number) => (
<Fragment key={pt?.id ?? pt?.chave ?? i2}>
<circle cx={pt.x} cy={pt.y} r={pt.r} fill={pt.cor} style={{ transition: "cx .5s,cy .5s,r .15s" }} />
</Fragment>
))}
{(rd.alvos ?? []).map((hv: any, i2: number) => (
<Fragment key={hv?.id ?? hv?.chave ?? i2}>
<path d={hv.d} fill="transparent" onMouseEnter={hv.entrar} onClick={hv.entrar} style={{ cursor: "default" }} />
</Fragment>
))}
</svg>
{(rd.rotulos ?? []).map((rt: any, i2: number) => (
<Fragment key={rt?.id ?? rt?.chave ?? i2}>
<span style={estilo(rt.s)}>
{rt.t}
</span>
</Fragment>
))}
{(rd.temDica) ? (<>
<div style={estilo(rd.dicaPos)}>
<span style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
{rd.dicaT}
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
{(rd.dica ?? []).map((dl: any, i2: number) => (
<Fragment key={dl?.id ?? dl?.chave ?? i2}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap" }}>
<span style={estilo(dl.dot)} />
<span style={{ flex: "1" }}>
{dl.l}
</span>
<strong style={{ marginLeft: "14px", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{dl.v}
</strong>
</span>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
</>) : null}
<div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap", marginTop: "6px" }}>
{(rd.legenda ?? []).map((lg: any, i2: number) => (
<Fragment key={lg?.id ?? lg?.chave ?? i2}>
<button onClick={lg.onClick} title="Mostrar ou ocultar" style={estilo(lg.style)}>
<span style={estilo(lg.dot)} />
{lg.l}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", marginTop: "12px", textAlign: "center" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "500", color: "#12171d" }}>
{rd.rodape}
<span style={estilo(rd.trendStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={rd.trendD} />
</svg>
</span>
</span>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
{rd.periodo}
</span>
</div>
</section>
</Fragment>
))}
<section style={estilo(`${dash.nexoCol ?? ""};position:relative;overflow:hidden;background:#12171d;color:#fff;border-radius:14px;padding:18px;min-width:0;display:flex;flex-direction:column`)}>
<span style={{ position: "absolute", right: "-80px", top: "-90px", width: "240px", height: "200px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".16", filter: "blur(60px)", pointerEvents: "none" }} />
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
<img src="/proto/oni-avatar.png" alt="NEXO" style={{ width: "32px", height: "32px", borderRadius: "10px", objectFit: "cover" }} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "800", letterSpacing: "-.01em" }}>
NEXO
</span>
<span style={{ height: "20px", padding: "0 7px", borderRadius: "6px", background: "#fe4f2b", color: "#fff", fontSize: "10.5px", fontWeight: "500", display: "grid", placeItems: "center" }}>
IA
</span>
</div>
<span style={{ position: "relative", display: "block", marginTop: "14px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.015em", lineHeight: "1.35", textWrap: "pretty" }}>
{dash.nexoInsight}
</span>
<span style={{ position: "relative", display: "block", marginTop: "6px", fontSize: "12.5px", color: "#a3aab0", lineHeight: "1.5" }}>
{dash.nexoSub}
</span>
<div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", marginTop: "14px" }}>
{(dash.sugestoes ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onClick={sg.onClick} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 11px", borderRadius: "11px", border: "0", background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)", color: "#fff", cursor: "pointer", textAlign: "left" }} className={[hover("background:rgba(255,255,255,.11)")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", background: "rgba(254,79,43,.18)", color: "#ff8a70", display: "grid", placeItems: "center" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={sg.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "500", lineHeight: "1.35", textWrap: "pretty" }}>
{sg.t}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a3aab0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1", minHeight: "12px" }} />
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "44px", marginTop: "12px", padding: "0 5px 0 14px", borderRadius: "9999px", background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
<input value={ov.pergunta} onChange={ov.setPergunta} onKeyDown={ov.teclaPergunta} placeholder="Peça algo ao NEXO" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13.5px", color: "#fff" }} />
<button onClick={ov.perguntar} title="Enviar" style={{ width: "34px", height: "34px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
</section>
</div>
</div>
<aside style={{ flex: "1 1 290px", minWidth: "0", maxWidth: "100%", position: "sticky", top: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
<section style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 16px 14px", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap" }}>
Calendário
</span>
<button onClick={ov.calendario} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#f6f6f3", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "12px", fontWeight: "500", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Abrir agenda
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "14px 0 8px" }}>
<button onClick={ov.mesAnt} style={{ width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
</button>
<span style={{ flex: "1", textAlign: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap" }}>
{ov.mesTxt}
</span>
<button onClick={ov.mesProx} style={{ width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "2px", textAlign: "center" }}>
{(ov.semCab ?? []).map((sc: any, i1: number) => (
<Fragment key={sc?.id ?? sc?.chave ?? i1}>
<span style={{ fontSize: "11px", fontWeight: "500", color: "#8b949e", paddingBottom: "6px" }}>
{sc}
</span>
</Fragment>
))}
{(ov.cal ?? []).map((cd: any, i1: number) => (
<Fragment key={cd?.id ?? cd?.chave ?? i1}>
<button onClick={cd.onClick} style={estilo(cd.style)}>
<span>
{cd.n}
</span>
<span style={estilo(cd.dot)} />
</button>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 16px 10px", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap" }}>
Reuniões
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{ov.diaSelTxt} · {ov.reuResumo}
</span>
</span>
<button onClick={ov.novaReu} title="Nova reunião" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
{(ov.semReu) ? (<>
<div style={{ margin: "12px 0 6px", padding: "22px 10px", borderRadius: "12px", background: "#fafafa", textAlign: "center", fontSize: "12.5px", color: "#8b949e" }}>
Nenhuma reunião neste dia.
</div>
</>) : null}
{(ov.temDestaque) ? (<>
<div style={{ position: "relative", overflow: "hidden", marginTop: "12px", padding: "14px", borderRadius: "13px", background: "#12171d", color: "#fff" }}>
<span style={{ position: "absolute", right: "-50px", top: "-60px", width: "150px", height: "130px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".2", filter: "blur(40px)", pointerEvents: "none" }} />
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(ov.dst.pill)}>
{ov.dst.quando}
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "12px", color: "#a3aab0", fontVariantNumeric: "tabular-nums" }}>
{ov.dst.faixa}
</span>
</div>
<button onClick={ov.dst.abrir} style={{ position: "relative", display: "block", width: "100%", marginTop: "10px", padding: "0", border: "0", background: "transparent", textAlign: "left", cursor: "pointer", color: "#fff" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", lineHeight: "1.3", textWrap: "pretty" }}>
{ov.dst.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#a3aab0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ov.dst.sub}
</span>
</button>
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
<span style={{ display: "flex", paddingLeft: "6px" }}>
{(ov.dst.part ?? []).map((pp: any, i1: number) => (
<Fragment key={pp?.id ?? pp?.chave ?? i1}>
<span title={pp.n} style={{ width: "24px", height: "24px", marginLeft: "-6px", borderRadius: "9999px", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "500", background: "#2a3139", color: "#e7eaec", boxShadow: "0 0 0 2px #12171d" }}>
{pp.ini}
</span>
</Fragment>
))}
</span>
<span style={{ flex: "1" }} />
{(ov.dst.temEntrar) ? (<>
<button onClick={ov.dst.entrar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12px", fontWeight: "500", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m16 10 5-3v10l-5-3zM4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
</svg>
Entrar
</button>
</>) : null}
</div>
</div>
</>) : null}
<div style={{ display: "flex", flexDirection: "column", marginTop: "8px" }}>
{(ov.reuLista ?? []).map((ru: any, i1: number) => (
<Fragment key={ru?.id ?? ru?.chave ?? i1}>
<button onClick={ru.abrir} style={{ display: "flex", alignItems: "stretch", gap: "12px", width: "100%", padding: "9px 4px", border: "0", borderRadius: "10px", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "40px", display: "flex", flexDirection: "column", alignItems: "flex-end", paddingTop: "1px" }}>
<span style={estilo(ru.hStyle)}>
{ru.h}
</span>
<span style={{ fontSize: "11px", color: "#a3a8a4", fontVariantNumeric: "tabular-nums" }}>
{ru.fimH}
</span>
</span>
<span style={estilo(ru.barra)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={estilo(ru.tStyle)}>
{ru.titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ru.sub2}
</span>
</span>
{(ru.temRes) ? (<>
<span style={estilo(ru.resStyle)}>
{ru.res}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
<button onClick={ov.calendario} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", marginTop: "4px", padding: "10px 0 4px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("color:#12171d")].filter(Boolean).join(" ")}>
Ver agenda completa
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</section>
</aside>
</div>
</>) : null}
{(ehQuadro) ? (<>
<div data-r="board" style={{ flex: "1", minHeight: "0", overflow: "auto", padding: "12px 14px 14px", display: "flex", gap: "10px", alignItems: "stretch" }}>
{(colunas ?? []).map((col: any, i1: number) => (
<Fragment key={col?.id ?? col?.chave ?? i1}>
<section data-r="coluna" onDragOver={col.sobre} onDragLeave={col.sair} onDrop={col.soltar} style={estilo(col.box)}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 6px 8px" }}>
<span style={estilo(col.ico)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
<path d={col.d} />
</svg>
</span>
<span style={{ minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{col.l}
</span>
<span style={{ minWidth: "22px", height: "20px", padding: "0 6px", borderRadius: "9999px", background: "#fff", color: "#4a5560", fontSize: "11px", fontWeight: "500", display: "grid", placeItems: "center" }}>
{col.n}
</span>
<span style={{ flex: "1" }} />
<button onClick={col.nova} title="Nova atividade aqui" style={{ width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fff;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "0 2px 4px" }}>
{(col.vazia) ? (<>
<div style={{ padding: "18px 10px", borderRadius: "10px", border: "1.5px dashed #d7dada", textAlign: "center", fontSize: "12px", color: "#8b949e" }}>
{col.vazioTxt}
</div>
</>) : null}
{(col.cards ?? []).map((c: any, i2: number) => (
<Fragment key={c?.id ?? c?.chave ?? i2}>
<button draggable="true" onDragStart={c.arrastar} onDragEnd={c.fimArraste} onClick={c.abrir} style={estilo(c.style)} className={[hover(c.hover)].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
<span style={estilo(c.tipoK)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={c.tipoD} />
</svg>
{c.tipo}
</span>
<span style={{ flex: "1" }} />
{(c.temAlta) ? (<>
<span title="Prioridade alta" style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "20px", padding: "0 7px", borderRadius: "6px", background: "#fdeeea", color: "#c2330f", fontSize: "11px", fontWeight: "500" }}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
<path d="M5 21V4h11l-2 4 2 4H7v9z" />
</svg>
Alta
</span>
</>) : null}
</span>
<span style={{ display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", width: "100%", marginTop: "9px", fontSize: "13.5px", fontWeight: "500", color: "#12171d", lineHeight: "1.38", textAlign: "left" }}>
{c.titulo}
</span>
{(c.temVinc) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", marginTop: "6px", fontSize: "12px", color: "#67787c", textAlign: "left", minWidth: "0" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
</svg>
<span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.vincK}
</span>
</span>
</>) : null}
<span style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", marginTop: "12px" }}>
<span style={estilo(c.prazoK)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
{c.prazo}
</span>
{(c.temSub) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: "500", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
{c.subTxt}
</span>
</>) : null}
{(c.temComs) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: "500", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
</svg>
{c.nComs}
</span>
</>) : null}
<span style={{ flex: "1" }} />
{(c.deOutro) ? (<>
<span title={c.resp} style={estilo(c.respAv)}>
{c.respIni}
</span>
</>) : null}
</span>
</button>
</Fragment>
))}
</div>
</section>
</Fragment>
))}
<button onClick={toggleDeclinadas} style={{ flex: "0 0 44px", borderRadius: "14px", border: "0", background: "#eeeff3", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "12px 0", color: "#67787c" }} title={declinadasDica} className={[hover("background:#e6e8ea;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
<span style={{ writingMode: "vertical-rl", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap" }}>
{declinadasLbl}
</span>
</button>
</div>
</>) : null}
{(ehLista) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "12px 14px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
<span style={{ fontSize: "12px", fontWeight: "500", color: "#67787c" }}>
Agrupar por
</span>
{(agrupos ?? []).map((ag: any, i1: number) => (
<Fragment key={ag?.id ?? ag?.chave ?? i1}>
<button onClick={ag.onClick} style={estilo(ag.style)}>
{ag.l}
</button>
</Fragment>
))}
</div>
<div data-stagger="40" data-stagger-tipo="rise" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
{(grupos ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<section style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<button onClick={g.alternar} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 16px", border: "0", background: "#fafaf8", cursor: "pointer", textAlign: "left" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(g.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={estilo(g.dot)} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{g.l}
</span>
<span style={{ fontSize: "12px", fontWeight: "500", color: "#8b949e" }}>
{g.n}
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{g.sub}
</span>
</button>
{(g.aberto) ? (<>
{(g.itens ?? []).map((c: any, i2: number) => (
<Fragment key={c?.id ?? c?.chave ?? i2}>
<button onClick={c.abrir} style={{ display: "grid", gridTemplateColumns: "20px minmax(0,2fr) minmax(0,1.3fr) 118px 150px 110px", gap: "12px", alignItems: "center", width: "100%", minHeight: "56px", padding: "10px 16px", border: "0", background: "#fff", cursor: "pointer", textAlign: "left", boxShadow: "inset 0 1px 0 #f1f3f3" }} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span onClick={c.concluir} title={c.checkDica} style={estilo(c.check)}>
{(c.feita) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
<span style={estilo(c.tituloStyle)}>
{c.titulo}
</span>
{(c.temPrio) ? (<>
<span title={c.prioDica} style={estilo(c.prioStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
<path d="M5 21V4h11l-2 4 2 4H7v9z" />
</svg>
</span>
</>) : null}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
<span style={estilo(c.tipoStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={c.tipoD} />
</svg>
{c.tipo}
</span>
{(c.temSub) ? (<>
<span style={{ fontSize: "11px", fontWeight: "500", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{c.subTxt} subtarefas
</span>
</>) : null}
</span>
</span>
<span style={{ minWidth: "0", fontSize: "12.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.vinc}
</span>
<span style={estilo(c.prazoStyle)}>
{c.prazo}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
<span style={estilo(c.respAv)}>
{c.respIni}
</span>
<span style={{ fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.resp}
</span>
</span>
<span style={estilo(c.sitStyle)}>
{c.sit}
</span>
</button>
</Fragment>
))}
</>) : null}
</section>
</Fragment>
))}
{(listaVazia) ? (<>
<div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#8b949e" }}>
Nenhuma atividade com esses filtros.
</div>
</>) : null}
</div>
</div>
</>) : null}
</div>
{(temLateral) ? (<>
<aside data-r="esconde-mobile" style={{ flex: "0 0 330px", minHeight: "0", display: "flex", flexDirection: "column", gap: "12px", padding: "14px 14px 14px 0", overflowY: "auto" }}>
<section style={{ background: "#12171d", color: "#fff", borderRadius: "16px", padding: "16px 16px 14px", position: "relative", overflow: "hidden" }}>
<span style={{ position: "absolute", right: "-70px", top: "-80px", width: "220px", height: "180px", borderRadius: "9999px", background: "#fe4f2b", opacity: ".14", filter: "blur(50px)", pointerEvents: "none" }} />
<div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: "8px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
Esta semana
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11.5px", color: "#8b949e" }}>
{sem.periodo}
</span>
</div>
<div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px", marginTop: "12px" }}>
{(sem.kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<div style={{ minWidth: "0" }}>
<span style={estilo(k.vStyle)}>
{k.v}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{k.l}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: "5px", height: "56px", marginTop: "14px" }}>
{(sem.dias ?? []).map((dd: any, i1: number) => (
<Fragment key={dd?.id ?? dd?.chave ?? i1}>
<div title={dd.dica} style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", height: "100%", justifyContent: "flex-end" }}>
<div style={{ display: "flex", flexDirection: "column-reverse", width: "100%", maxWidth: "22px", height: "40px", borderRadius: "5px", background: "#1f252c", overflow: "hidden" }}>
<span style={estilo(dd.feitas)} />
<span style={estilo(dd.abertas)} />
</div>
<span style={estilo(dd.lblStyle)}>
{dd.l}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ position: "relative", display: "flex", gap: "12px", marginTop: "10px", fontSize: "11px", color: "#a3aab0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
<span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#3ecf8e" }} />
Feitas
</span>
<span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
<span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#fe4f2b" }} />
Em aberto
</span>
</div>
<div style={{ position: "relative", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #2a3139" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
Em aberto por tipo
</span>
<div style={{ display: "flex", height: "8px", marginTop: "9px", borderRadius: "9999px", overflow: "hidden", gap: "2px", background: "#1f252c" }}>
{(sem.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<span title={tp.dica} style={estilo(tp.style)} />
</Fragment>
))}
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: "8px" }}>
{(sem.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#a3aab0", whiteSpace: "nowrap" }}>
<span style={estilo(tp.dot)} />
{tp.l}
<strong style={{ color: "#fff" }}>
{tp.n}
</strong>
</span>
</Fragment>
))}
</div>
</div>
</section>
<section style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9", padding: "14px 14px 10px" }}>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Agenda de hoje
</span>
<span style={{ flex: "1", fontSize: "12px", color: "#8b949e" }}>
{agendaData}
</span>
<span style={{ minWidth: "22px", height: "20px", padding: "0 6px", borderRadius: "9999px", background: "#fff6f4", color: "#c2330f", fontSize: "11px", fontWeight: "500", display: "grid", placeItems: "center" }}>
{agendaN}
</span>
</div>
{(agendaVazia) ? (<>
<span style={{ display: "block", padding: "12px 0", fontSize: "12.5px", color: "#8b949e" }}>
Nada com horário hoje.
</span>
</>) : null}
{(agenda ?? []).map((ag: any, i1: number) => (
<Fragment key={ag?.id ?? ag?.chave ?? i1}>
<button onClick={ag.abrir} style={estilo(ag.style)} className={[hover("background:#fafaf8")].filter(Boolean).join(" ")}>
<span style={estilo(ag.horaStyle)}>
{ag.hora}
</span>
<span style={estilo(ag.ico)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={ag.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ag.t}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ag.s}
</span>
</span>
</button>
</Fragment>
))}
</section>
<section style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 0 0 1px #e6e9e9", padding: "14px 14px 8px" }}>
<span style={{ display: "block", marginBottom: "10px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Menções e atualizações
</span>
{(feed ?? []).map((fd: any, i1: number) => (
<Fragment key={fd?.id ?? fd?.chave ?? i1}>
<button onClick={fd.abrir} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "10px", width: "100%", padding: "8px 4px 12px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={estilo(fd.linha)} />
<span style={estilo(fd.av)}>
{fd.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", color: "#1f252c", lineHeight: "1.45", textWrap: "pretty" }}>
<strong style={{ fontWeight: "700", color: "#12171d" }}>
{fd.quem}
</strong>
 {fd.acao}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{fd.onde}
</span>
{(fd.temTrecho) ? (<>
<span style={{ display: "block", marginTop: "6px", padding: "8px 10px", borderRadius: "9px", background: "#fafaf8", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "12px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
{fd.trecho}
</span>
</>) : null}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11px", color: "#a3a8a4", whiteSpace: "nowrap" }}>
{fd.quando}
</span>
</button>
</Fragment>
))}
</section>
</aside>
</>) : null}
{(nx.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={nx.fechar} style={{ position: "fixed", inset: "0", zIndex: "65", background: "rgba(18,23,29,.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: "20px" }}>
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
<button onClick={nx.novo} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", height: "44px", marginTop: "22px", padding: "0 14px", borderRadius: "11px", border: "0", background: "#12171d", color: "#fff", fontSize: "13.5px", fontWeight: "500", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
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
<input value={nx.busca} onChange={nx.setBusca} placeholder="Buscar conversas" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
<span style={{ display: "block", margin: "22px 4px 8px", fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
Conversas recentes
</span>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
{(nx.recentes ?? []).map((rc: any, i1: number) => (
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
<button onClick={nx.fechar} title="Fechar" style={{ position: "absolute", zIndex: "2", top: "16px", right: "16px", width: "34px", height: "34px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("color:#12171d;background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
{(nx.vazio) ? (<>
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
{nx.intro}
</span>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px" }}>
{(nx.cards ?? []).map((cd: any, i1: number) => (
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
{(nx.temMsgs) ? (<>
<div ref={nx.ref} style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px", padding: "60px 28px 16px" }}>
{(nx.msgs ?? []).map((m: any, i1: number) => (
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
{(nx.pensando) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "30px", height: "30px", borderRadius: "10px", objectFit: "cover" }} />
<span style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "13px", color: "#8b949e" }}>
NEXO está olhando suas atividades…
</span>
</div>
</>) : null}
</div>
</>) : null}
<div style={{ flex: "0 0 auto", margin: "0 22px", padding: "12px 12px 10px", borderRadius: "16px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8,0 14px 34px -22px rgba(18,23,29,.35)" }}>
<input value={nx.rasc} onChange={nx.setRasc} onKeyDown={nx.tecla} autoFocus={true} placeholder="Digite sua mensagem para o NEXO…" style={{ width: "100%", height: "36px", padding: "0 6px", border: "0", outline: "0", background: "transparent", fontSize: "14.5px", color: "#12171d" }} />
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
Contexto: Atividades
</span>
<span style={{ flex: "1" }} />
<button title="Falar" style={{ width: "36px", height: "36px", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f3f4f4;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
</svg>
</button>
<button onClick={nx.enviar} title="Enviar" style={estilo(nx.enviarStyle)} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
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
O NEXO consulta suas atividades, agenda e oportunidades para responder.
</span>
</div>
</div>
</div>
</>) : null}
{(dash.pop.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={dash.pop.fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(640px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "12px", padding: "20px 22px 12px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{dash.pop.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "13px", color: "#67787c" }}>
{dash.pop.sub}
</span>
</span>
<button onClick={dash.pop.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "0 16px 12px" }}>
{(dash.pop.vazio) ? (<>
<div style={{ margin: "6px", padding: "34px 16px", borderRadius: "12px", background: "#fafafa", textAlign: "center", fontSize: "13px", color: "#8b949e" }}>
{dash.pop.vazioTxt}
</div>
</>) : null}
{(dash.pop.naoReu) ? (<>
{(dash.pop.itens ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 6px", borderRadius: "10px", boxShadow: "inset 0 -1px 0 #f1f3f3" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<button onClick={c.abrir} style={{ flex: "1", minWidth: "0", padding: "0", border: "0", background: "transparent", textAlign: "left", cursor: "pointer" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.vincTxt}
</span>
</button>
<span style={estilo(c.prazoPill)}>
{c.prazo}
</span>
<button onClick={c.acao} style={{ flex: "0 0 auto", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#f3f4f4", fontSize: "12px", fontWeight: "500", color: "#12171d", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#12171d;color:#fff")].filter(Boolean).join(" ")}>
{c.acaoTxt}
</button>
</div>
</Fragment>
))}
</>) : null}
{(dash.pop.ehReu) ? (<>
{(dash.pop.reus ?? []).map((ru: any, i1: number) => (
<Fragment key={ru?.id ?? ru?.chave ?? i1}>
<button onClick={ru.abrir} style={{ display: "flex", alignItems: "center", gap: "14px", width: "100%", padding: "12px 8px", border: "0", borderRadius: "10px", background: "transparent", cursor: "pointer", textAlign: "left", boxShadow: "inset 0 -1px 0 #f1f3f3" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(ru.hStyle)}>
{ru.h}
</span>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "10px", display: "grid", placeItems: "center", background: "#fff6f4", color: "#c2330f" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="m22 8-6 4 6 4V8zM2 6h14v12H2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ru.titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ru.sub} · {ru.fmt}
</span>
</span>
{(ru.temTag) ? (<>
<span style={estilo(ru.tagStyle)}>
{ru.tag}
</span>
</>) : null}
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</Fragment>
))}
</>) : null}
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={dash.pop.fechar} style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Fechar
</button>
{(dash.pop.naoReu) ? (<>
<button onClick={dash.pop.lista} style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "500", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Abrir na lista
</button>
</>) : null}
{(dash.pop.ehReu) ? (<>
<button onClick={dash.pop.novaReu} style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "500", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Nova reunião
</button>
</>) : null}
</div>
</div>
</div>
</>) : null}
{(fd2.aberto) ? (<>
<div data-at-filtro="1" data-in="drop" style={estilo(fd2.pos)}>
<div style={{ fontSize: "11px", fontWeight: "500", color: "#4a5560", letterSpacing: ".04em", padding: "6px 6px 4px" }}>
{fd2.titulo}
</div>
{(fd2.opcoes ?? []).map((o: any, i1: number) => (
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
<button onClick={fd2.limpar} style={{ width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "12.5px", fontWeight: "500", color: "#c2330f" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Limpar
</button>
</div>
</>) : null}
{(dt.aberto) ? (<>
<div data-in="fade" onClick={dt.fechar} style={{ position: "fixed", inset: "0", zIndex: "40", background: "rgba(12,16,21,.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
<div style={{ position: "fixed", inset: "0", zIndex: "41", display: "grid", placeItems: "center", padding: "16px 12px", pointerEvents: "none" }}>
<div data-in="pop" data-r="drawer" style={{ pointerEvents: "auto", width: "min(1120px,100%)", height: "min(760px,100%)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "20px", boxShadow: "0 40px 90px -30px rgba(12,16,21,.6)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderBottom: "1px solid #eef1f1" }}>
<span style={estilo(dt.tipoStyle)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={dt.tipoD} />
</svg>
{dt.tipo}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dt.origem}
</span>
<button onClick={dt.toggleSeguir} style={estilo(dt.seguirStyle)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
</svg>
{dt.seguirTxt}
</button>
<button onClick={dt.editar} title="Editar" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
</svg>
</button>
<button onClick={dt.fechar} title="Fechar" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "1.6 1 520px", minWidth: "0", minHeight: "0", maxHeight: "100%", overflowY: "auto", padding: "22px 26px 26px" }}>
{(dt.naSub) ? (<>
<button onClick={dt.voltarMae} style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px 0 6px", margin: "-6px 0 12px -6px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
{dt.maeTxt}
</button>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", fontSize: "11.5px", fontWeight: "500", color: "#4a5560" }}>
Subtarefa {dt.sbPos}
</span>
<input value={dt.sbT} onChange={dt.sbSetT} style={{ display: "block", width: "100%", marginTop: "10px", padding: "2px 0", border: "0", outline: "0", background: "transparent", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "24px", fontWeight: "800", letterSpacing: "-.03em", color: "#12171d" }} />
<div style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: "12px 16px", alignItems: "center", marginTop: "18px" }}>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Status
</span>
<span>
<button onClick={dt.sbTog} style={estilo(dt.sbStStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{dt.sbSt}
</button>
</span>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Responsável
</span>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "8px", justifySelf: "start", height: "34px", padding: "0 12px 0 5px", borderRadius: "9999px", background: "#f3f4f4", cursor: "pointer" }}>
<span style={estilo(dt.sbAv)}>
{dt.sbIni}
</span>
<span style={{ fontSize: "13px", fontWeight: "500", color: "#12171d" }}>
{dt.sbResp}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={dt.sbRespV} onChange={dt.sbSetResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(dt.equipeSub ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Prazo
</span>
<input type="date" value={dt.sbFim} onChange={dt.sbSetFim} style={{ justifySelf: "start", height: "34px", padding: "0 10px", borderRadius: "9px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "13px", fontWeight: "500", color: "#12171d" }} />
</div>
<span style={{ display: "block", marginTop: "20px", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Descrição
</span>
<div style={{ marginTop: "6px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }} onBlur={dt.sbSalvarDesc}>
<div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap", padding: "5px 6px", borderBottom: "1px solid #eef1f1" }}>
{(dt.fmtSb ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onMouseDown={fm.onClick} title={fm.l} style={{ width: "30px", height: "30px", borderRadius: "7px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={fm.d} />
</svg>
</button>
</Fragment>
))}
</div>
<div ref={dt.sbDescRef} contentEditable="true" suppressContentEditableWarning={true} style={{ minHeight: "110px", maxHeight: "320px", overflowY: "auto", padding: "10px 14px 12px", fontSize: "14px", lineHeight: "1.6", color: "#1f252c", outline: "0", wordBreak: "break-word" }} />
</div>
</>) : null}
{(dt.naMae) ? (<>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "26px", fontWeight: "800", letterSpacing: "-.03em", lineHeight: "1.15", color: "#12171d", textWrap: "balance" }}>
{dt.titulo}
</span>
{(dt.temNexo) ? (<>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "12px", padding: "10px 12px", borderRadius: "12px", background: "#fff8f5", boxShadow: "inset 0 0 0 1px #f6d9cf" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "22px", height: "22px", borderRadius: "7px", objectFit: "cover" }} />
<span style={{ fontSize: "12.5px", color: "#7a2a12", lineHeight: "1.5" }}>
<strong style={{ fontWeight: "700" }}>
Criada pelo NEXO.
</strong>
 {dt.nexoMotivo}
</span>
</div>
</>) : null}
{(dt.naFila) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", padding: "10px 12px", borderRadius: "12px", background: "#e8f0fb", boxShadow: "inset 0 0 0 1px #c9daf2" }}>
<span style={{ flex: "1", fontSize: "12.5px", color: "#1d4a80", lineHeight: "1.5" }}>
<strong style={{ fontWeight: "700" }}>
Na fila de {dt.fila}.
</strong>
 Enviada por {dt.criadoPor}. Qualquer pessoa do setor pode pegar.
</span>
<button onClick={dt.pegar} style={{ flex: "0 0 auto", height: "30px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "500", cursor: "pointer" }}>
Pegar para mim
</button>
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: "12px 16px", alignItems: "center", marginTop: "20px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
Status
</span>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(dt.sits ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<button onClick={s.onClick} style={estilo(s.style)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d={s.d} />
</svg>
{s.l}
</button>
</Fragment>
))}
</div>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
</svg>
Responsáveis
</span>
<div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
{(dt.assignees ?? []).map((as: any, i1: number) => (
<Fragment key={as?.id ?? as?.chave ?? i1}>
<span style={{ flex: "0 0 auto", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 4px 0 4px", borderRadius: "9999px", background: "#f3f4f4" }}>
<span style={estilo(as.av)}>
{as.ini}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "500", color: "#12171d" }}>
{as.nome}
</span>
<button onClick={as.remover} title="Remover" style={{ width: "20px", height: "20px", borderRadius: "9999px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 11px", borderRadius: "9999px", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Pessoa
<select value="" onChange={dt.addResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(dt.equipeOpc ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
Datas
</span>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<label style={estilo(`${dt.iniStyle ?? ""};position:relative;cursor:pointer`)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
{dt.iniTxt}
<input type="date" value={dt.iniIso} onChange={dt.setIni} onClick={abrirPicker} style={{ position: "absolute", inset: "0", opacity: "0", cursor: "pointer", border: "0" }} />
</label>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
<label style={estilo(`${dt.fimStyle ?? ""};position:relative;cursor:pointer`)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
{dt.fimTxt}
<input type="date" value={dt.fimIso} onChange={dt.setFim} onClick={abrirPicker} style={{ position: "absolute", inset: "0", opacity: "0", cursor: "pointer", border: "0" }} />
</label>
</div>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 21V4h11l-2 4 2 4H7" />
</svg>
Prioridade
</span>
<div style={{ display: "flex", gap: "5px" }}>
{(dt.prios ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.onClick} style={estilo(p.style)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
<path d="M5 21V4h11l-2 4 2 4H7v9z" />
</svg>
{p.l}
</button>
</Fragment>
))}
</div>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 3h18v18H3zM3 9h18M9 21V9" />
</svg>
Área e fila
</span>
<span style={{ fontSize: "13px", fontWeight: "500", color: "#12171d" }}>
{dt.areaTxt}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
</svg>
Criada por
</span>
<span style={{ fontSize: "13px", color: "#1f252c" }}>
{dt.criadoPor}
</span>
</div>
{(dt.temJanela) ? (<>
<div style={{ marginTop: "16px" }}>
<div style={{ position: "relative", height: "8px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(dt.jBarra)} />
</div>
<span style={{ display: "block", marginTop: "6px", fontSize: "11.5px", color: "#8b949e" }}>
{dt.jTxt}
</span>
</div>
</>) : null}
{(dt.temVinculos) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "18px" }}>
{(dt.vinculos ?? []).map((vn: any, i1: number) => (
<Fragment key={vn?.id ?? vn?.chave ?? i1}>
<button onClick={vn.ir} style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "32px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fafaf8", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", fontSize: "12.5px" }} className={[hover("box-shadow:inset 0 0 0 1px #12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={vn.d} />
</svg>
<span style={{ color: "#8b949e" }}>
{vn.l}
</span>
<strong style={{ fontWeight: "600", color: "#12171d" }}>
{vn.v}
</strong>
</button>
</Fragment>
))}
</div>
</>) : null}
<div style={{ marginTop: "18px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }} onBlur={dt.salvarDesc}>
<div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap", padding: "5px 6px", borderBottom: "1px solid #eef1f1" }}>
{(dt.fmt ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onMouseDown={fm.onClick} title={fm.l} style={{ width: "30px", height: "30px", borderRadius: "7px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={fm.d} />
</svg>
</button>
</Fragment>
))}
</div>
<div style={{ position: "relative" }}>
{(dt.descVazia) ? (<>
<span style={{ position: "absolute", left: "14px", top: "11px", fontSize: "14px", color: "#a3a8a4", pointerEvents: "none" }}>
Adicione uma descrição
</span>
</>) : null}
<div ref={dt.descRef} contentEditable="true" suppressContentEditableWarning={true} onInput={dt.digitaDesc} style={{ minHeight: "80px", maxHeight: "320px", overflowY: "auto", padding: "10px 14px 12px", fontSize: "14px", lineHeight: "1.6", color: "#1f252c", outline: "0", wordBreak: "break-word" }} />
</div>
</div>
{(dt.temAnexos) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
{(dt.anexos ?? []).map((ax: any, i1: number) => (
<Fragment key={ax?.id ?? ax?.chave ?? i1}>
<a href={ax.url} download={ax.nome} style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 10px 0 4px", borderRadius: "9px", background: "#f3f4f4", fontSize: "12px", fontWeight: "500", color: "#1f252c", textDecoration: "none", maxWidth: "240px" }}>
{(ax.temImg) ? (<>
<span style={estilo(ax.thumb)} />
</>) : null}
{(ax.semImg) ? (<>
<span style={{ width: "26px", height: "26px", borderRadius: "6px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "8px", fontWeight: "500" }}>
{ax.ext}
</span>
</>) : null}
<span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ax.nome}
</span>
</a>
</Fragment>
))}
</div>
</>) : null}
<div style={{ marginTop: "22px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
Subtarefas
</span>
<span style={{ flex: "0 0 110px", height: "6px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(dt.subBarra)} />
</span>
<span style={{ fontSize: "12px", fontWeight: "500", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{dt.subPct}
</span>
</div>
<div style={{ borderRadius: "12px", boxShadow: "0 0 0 1px #eef1f1", overflow: "hidden" }}>
<div style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) 160px 90px 24px", gap: "10px", padding: "8px 12px", background: "#fafaf8", fontSize: "11px", fontWeight: "700", letterSpacing: ".05em", textTransform: "uppercase", color: "#8b949e" }}>
<span />
<span>
Nome
</span>
<span>
Responsável
</span>
<span>
Prazo
</span>
<span />
</div>
{(dt.subs ?? []).map((sb: any, i1: number) => (
<Fragment key={sb?.id ?? sb?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) 160px 90px 24px", gap: "10px", alignItems: "center", padding: "9px 12px", boxShadow: "inset 0 1px 0 #f3f5f5" }}>
<button onClick={sb.tog} style={estilo(sb.check)}>
{(sb.feita) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
<button onClick={sb.abrir} style={{ minWidth: "0", border: "0", padding: "0", background: "transparent", textAlign: "left", cursor: "pointer" }}>
<span style={estilo(sb.tStyle)}>
{sb.t}
</span>
{(sb.temDesc) ? (<>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sb.desc}
</span>
</>) : null}
</button>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px", minWidth: "0", cursor: "pointer" }}>
<span style={estilo(sb.av)}>
{sb.ini}
</span>
<span style={{ minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sb.resp}
</span>
<select value={sb.respV} onChange={sb.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(dt.equipeSub ?? []).map((op: any, i2: number) => (
<Fragment key={op?.id ?? op?.chave ?? i2}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
<span style={estilo(sb.prazoStyle)}>
{sb.prazo}
</span>
<button onClick={sb.remover} title="Remover" style={{ width: "22px", height: "22px", borderRadius: "6px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", boxShadow: "inset 0 1px 0 #f3f5f5" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<input value={dt.novaSub} onChange={dt.setNovaSub} onKeyDown={dt.teclaSub} placeholder="Adicionar subtarefa e apertar Enter" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
</div>
</div>
</>) : null}
</div>
<div style={{ flex: "1 1 340px", minWidth: "0", minHeight: "0", maxHeight: "100%", display: "flex", flexDirection: "column", background: "#fafaf8", boxShadow: "inset 1px 0 0 #eef1f1" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "16px 18px 10px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
Atividade
</span>
<span style={{ fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{dt.feedN}
</span>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "4px 18px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
{(dt.feed ?? []).map((fx: any, i1: number) => (
<Fragment key={fx?.id ?? fx?.chave ?? i1}>
<div style={estilo(fx.box)}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(fx.av)}>
{fx.ini}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }}>
{fx.autor}
</span>
<span style={{ fontSize: "11px", color: "#a3a8a4", whiteSpace: "nowrap" }}>
{fx.quando}
</span>
</div>
<span style={estilo(fx.txtStyle)}>
{(fx.partes ?? []).map((pt: any, i2: number) => (
<Fragment key={pt?.id ?? pt?.chave ?? i2}>
<span style={estilo(pt.s)}>
{pt.t}
</span>
</Fragment>
))}
</span>
{(fx.temAnx) ? (<>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px" }}>
{(fx.anx ?? []).map((ax: any, i2: number) => (
<Fragment key={ax?.id ?? ax?.chave ?? i2}>
{(ax.temImg) ? (<>
<span style={estilo(ax.big)} />
</>) : null}
<span style={estilo(ax.chip)}>
align-items:center;gap:6px;height:28px;padding:0 9px 0 4px;border-radius:7px;background:#f3f4f4;font-size:11.5px;font-weight:500;color:#1f252c"{">"}
<span style={{ width: "20px", height: "20px", borderRadius: "5px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "7.5px", fontWeight: "500" }}>
{ax.ext}
</span>
{ax.nome}
</span>
</Fragment>
))}
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
<div style={{ flex: "0 0 auto", padding: "12px 14px 14px", borderTop: "1px solid #eef1f1", background: "#fff" }}>
{(dt.temMencao) ? (<>
<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
{(dt.mencoes ?? []).map((mn: any, i1: number) => (
<Fragment key={mn?.id ?? mn?.chave ?? i1}>
<button onMouseDown={mn.escolher} style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 10px 0 4px", borderRadius: "9999px", border: "0", background: "#f3f4f4", cursor: "pointer", fontSize: "12px", fontWeight: "500", color: "#12171d" }}>
<span style={{ width: "20px", height: "20px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "500" }}>
{mn.ini}
</span>
{mn.nome}
</button>
</Fragment>
))}
</div>
</>) : null}
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #dbdede", background: "#fff" }}>
<textarea value={dt.comentario} onChange={dt.setComentario} onKeyDown={dt.teclaCom} onPaste={dt.colar} rows={2} placeholder="Comentar · use @ para marcar alguém" style={{ width: "100%", padding: "10px 12px 4px", border: "0", outline: "0", resize: "none", background: "transparent", fontSize: "13px", lineHeight: "1.5", color: "#12171d" }} />
{(dt.temAnx) ? (<>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap", padding: "0 10px 6px" }}>
{(dt.anx ?? []).map((ax: any, i1: number) => (
<Fragment key={ax?.id ?? ax?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 4px 0 4px", borderRadius: "8px", background: "#f3f4f4", fontSize: "11.5px", fontWeight: "500", color: "#1f252c" }}>
{(ax.temImg) ? (<>
<span style={estilo(ax.thumb)} />
</>) : null}
{ax.nome}
<button onClick={ax.remover} style={{ width: "18px", height: "18px", borderRadius: "5px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px 8px 8px" }}>
<label title="Anexar arquivo" style={{ position: "relative", width: "28px", height: "28px", borderRadius: "7px", display: "grid", placeItems: "center", color: "#67787c", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
</svg>
<input type="file" multiple={true} onChange={dt.anexar} style={{ position: "absolute", inset: "0", opacity: "0", cursor: "pointer" }} />
</label>
<button onClick={dt.arroba} title="Mencionar" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer", fontSize: "14px", fontWeight: "500" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
@
</button>
<span style={{ flex: "1", fontSize: "11px", color: "#a3a8a4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Marcados passam a seguir
</span>
<button onClick={dt.enviar} style={estilo(dt.enviarStyle)}>
Comentar
</button>
</div>
</div>
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1" }}>
<button onClick={dt.concluir} style={estilo(dt.concluirStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{dt.concluirTxt}
</button>
</div>
</div>
</div>
</>) : null}
{(ed.aberto) ? (<>
<div data-in="fade" onClick={ed.fechar} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(12,16,21,.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
<div style={{ position: "fixed", inset: "0", zIndex: "61", display: "grid", placeItems: "center", padding: "16px 12px", pointerEvents: "none" }}>
<div data-in="pop" data-r="drawer" style={{ pointerEvents: "auto", width: "min(820px,100%)", maxHeight: "100%", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "20px", boxShadow: "0 40px 90px -30px rgba(12,16,21,.6)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", background: "#f3f4f4", borderRadius: "10px", padding: "3px", gap: "2px" }}>
{(ed.destinos ?? []).map((ds: any, i1: number) => (
<Fragment key={ds?.id ?? ds?.chave ?? i1}>
<button onClick={ds.onClick} style={estilo(ds.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={ds.d} />
</svg>
{ds.l}
</button>
</Fragment>
))}
</div>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "12px", color: "#a3a8a4", whiteSpace: "nowrap" }}>
{ed.sub}
</span>
<button onClick={ed.fechar} style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "20px 26px 22px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
<div style={{ display: "flex", background: "#f3f4f4", borderRadius: "9px", padding: "3px", gap: "2px" }}>
{(ed.naturezas ?? []).map((nt: any, i1: number) => (
<Fragment key={nt?.id ?? nt?.chave ?? i1}>
<button onClick={nt.onClick} style={estilo(nt.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={nt.d} />
</svg>
{nt.l}
</button>
</Fragment>
))}
</div>
<span style={{ width: "1px", height: "20px", background: "#e3e7e8", margin: "0 2px" }} />
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={ed.tipoD} />
</svg>
<span style={{ color: "#67787c", fontWeight: "500" }}>
Tipo
</span>
<span>
{ed.tipo}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={ed.tipo} onChange={ed.setTipo} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(ed.tiposOpc ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<span style={estilo(ed.sitDot)} />
<span>
{ed.sitL}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={ed.sit} onChange={ed.setSit} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(ed.sitsOpc ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
{(ed.criandoTipo) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "30px", padding: "0 4px 0 10px", borderRadius: "8px", boxShadow: "inset 0 0 0 1.5px #12171d" }}>
<input value={ed.novoTipo} onChange={ed.setNovoTipo} onKeyDown={ed.teclaTipo} placeholder="Nome do tipo" autoFocus={true} style={{ width: "120px", border: "0", outline: "0", background: "transparent", fontSize: "12.5px" }} />
<button onClick={ed.salvarTipo} style={{ height: "22px", padding: "0 9px", borderRadius: "6px", border: "0", background: "#12171d", color: "#fff", fontSize: "11.5px", fontWeight: "500", cursor: "pointer" }}>
Criar
</button>
</span>
</>) : null}
</div>
<input value={ed.tit} onChange={ed.setTit} placeholder="Nome da atividade" autoFocus={true} style={estilo(ed.titInp)} />
<div style={{ marginTop: "10px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap", padding: "5px 6px", borderBottom: "1px solid #eef1f1" }}>
{(ed.fmt ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
{(fm.sep) ? (<>
<span style={{ width: "1px", height: "18px", margin: "0 4px", background: "#e3e7e8" }} />
</>) : null}
<button onMouseDown={fm.onClick} title={fm.l} style={{ width: "30px", height: "30px", borderRadius: "7px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={fm.d} />
</svg>
</button>
</Fragment>
))}
<span style={{ width: "1px", height: "18px", margin: "0 4px", background: "#e3e7e8" }} />
<label title="Anexar arquivo" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 9px", borderRadius: "7px", color: "#4a5560", fontSize: "12.5px", fontWeight: "500", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
</svg>
Anexar
<input type="file" multiple={true} onChange={ed.anexar} style={{ position: "absolute", inset: "0", opacity: "0", cursor: "pointer", width: "100%" }} />
</label>
</div>
<div style={{ position: "relative" }}>
{(ed.descVazia) ? (<>
<span style={{ position: "absolute", left: "14px", top: "11px", fontSize: "14px", color: "#a3a8a4", pointerEvents: "none" }}>
Adicione uma descrição, contexto ou o que combinar
</span>
</>) : null}
<div ref={ed.descRef} contentEditable="true" suppressContentEditableWarning={true} onInput={ed.setDescHtml} onPaste={ed.colarDesc} style={{ minHeight: "96px", maxHeight: "280px", overflowY: "auto", padding: "10px 14px 12px", fontSize: "14px", lineHeight: "1.6", color: "#1f252c", outline: "0", wordBreak: "break-word" }} />
</div>
{(ed.temAnexos) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "0 10px 10px" }}>
{(ed.anexos ?? []).map((ax: any, i1: number) => (
<Fragment key={ax?.id ?? ax?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 4px 0 4px", borderRadius: "9px", background: "#f3f4f4", fontSize: "12px", fontWeight: "500", color: "#1f252c", maxWidth: "240px" }}>
{(ax.temImg) ? (<>
<span style={estilo(ax.thumb)} />
</>) : null}
{(ax.semImg) ? (<>
<span style={{ width: "26px", height: "26px", borderRadius: "6px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "8px", fontWeight: "500" }}>
{ax.ext}
</span>
</>) : null}
<span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ax.nome}
</span>
<button onClick={ax.remover} title="Remover" style={{ width: "22px", height: "22px", borderRadius: "6px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
</div>
</>) : null}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: "12px 28px", marginTop: "14px", paddingTop: "16px", borderTop: "1px solid #f1f3f3" }}>
<div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "8px", alignItems: "center" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
Datas
</span>
<span style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }} data-comment-anchor="fd254bbf7a-span">
<input type="date" value={ed.iniD} onChange={ed.setIniD} onClick={abrirPicker} title="Início (opcional)" style={{ height: "30px", padding: "0 8px", borderRadius: "8px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }} />
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
<input type="date" value={ed.fimD} onChange={ed.setFimD} onClick={abrirPicker} title="Prazo" style={{ height: "30px", padding: "0 8px", borderRadius: "8px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }} />
<input type="time" value={ed.fimH} onChange={ed.setFimH} title="Hora do prazo" style={{ height: "30px", padding: "0 8px", borderRadius: "8px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d", width: "86px" }} />
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "8px", alignItems: "center" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 21V4h11l-2 4 2 4H7" />
</svg>
Prioridade
</span>
<span>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={estilo(ed.prioCor)}>
<path d="M5 21V4h11l-2 4 2 4H7v9z" />
</svg>
<span>
{ed.prio}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={ed.prio} onChange={ed.setPrio} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(ed.priosOpc ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</span>
</div>
{(ed.paraOutro) ? (<>
<div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "8px", alignItems: "start" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
</svg>
Para quem
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<input value={ed.buscaPessoa ?? ""} onChange={ed.setBuscaPessoa} placeholder="Buscar pessoa pelo nome" aria-label="Buscar pessoa" style={{ height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", outline: "0", boxShadow: "inset 0 0 0 1px #dbdede", background: "#fff", fontSize: "12.5px", color: "#12171d" }} />
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", maxHeight: "132px", overflowY: "auto" }}>
{(ed.pessoas ?? []).map((ps: any, i1: number) => (
<Fragment key={ps?.id ?? ps?.chave ?? i1}>
<button onClick={ps.onClick} style={estilo(ps.style)}>
<span style={estilo(ps.av)}>
{ps.ini}
</span>
{ps.l}
</button>
</Fragment>
))}
</div>
<span style={{ fontSize: "11.5px", color: "#8b949e" }}>
{ed.paraTxt}
</span>
</div>
</div>
</>) : null}
<div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "8px", alignItems: "center" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
</svg>
Vínculo
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<span>
{ed.vincTipoL}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={ed.vincTipo} onChange={ed.setVincTipo} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(ed.vincTiposOpc ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
{(ed.temVincAlvo) ? (<>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<span>
{ed.vincL}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={ed.vincV} onChange={ed.setVinc} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(ed.vincOpc ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</>) : null}
<span style={{ fontSize: "11.5px", color: "#a3a8a4", whiteSpace: "nowrap" }}>
opcional
</span>
</span>
</div>
</div>
<div style={{ marginTop: "20px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Subtarefas
</span>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{ed.subsN}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{(ed.subs ?? []).map((sb: any, i1: number) => (
<Fragment key={sb?.id ?? sb?.chave ?? i1}>
<div data-comment-anchor="e94ed73d40-div" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 10px 10px 14px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<span style={{ flex: "0 0 auto", width: "18px", height: "18px", marginTop: "1px", borderRadius: "6px", boxShadow: "inset 0 0 0 1.5px #c4c9ca" }} />
<span style={{ flex: "1", minWidth: "0" }}>
<input value={sb.t} onChange={sb.set} placeholder="Título da subtarefa" style={{ width: "100%", border: "0", outline: "0", background: "transparent", fontSize: "13.5px", fontWeight: "500", color: "#12171d" }} />
<input value={sb.desc} onChange={sb.setDesc} placeholder="Descrição (opcional)" style={{ width: "100%", marginTop: "3px", border: "0", outline: "0", background: "transparent", fontSize: "12.5px", color: "#67787c" }} />
</span>
<button onClick={sb.remover} title="Remover subtarefa" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingLeft: "28px" }}>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "7px", height: "30px", padding: "0 10px 0 4px", borderRadius: "9999px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<span style={estilo(sb.av)}>
{sb.ini}
</span>
<span>
{sb.respL}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={sb.respV} onChange={sb.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(ed.equipeSub ?? []).map((op: any, i2: number) => (
<Fragment key={op?.id ?? op?.chave ?? i2}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
<label style={estilo(sb.fimStyle)} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
<span>
{sb.fimTxt}
</span>
<input type="date" value={sb.fimD} onChange={sb.setFim} onClick={abrirPicker} style={{ position: "absolute", inset: "0", width: "100%", opacity: "0", cursor: "pointer", border: "0" }} />
</label>
</div>
</div>
</Fragment>
))}
<div style={{ display: "flex", alignItems: "center", gap: "8px", height: "46px", padding: "0 6px 0 14px", borderRadius: "12px", border: "1.5px dashed #d7dada", background: "#fafafa" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<input value={ed.novaSub} onChange={ed.setNovaSub} onKeyDown={ed.teclaSub} placeholder="Nova subtarefa · Enter para adicionar" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
<button onClick={ed.addSub} style={{ flex: "0 0 auto", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "500", cursor: "pointer" }}>
Adicionar
</button>
</div>
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafaf8" }}>
{(ed.temErro) ? (<>
<span style={{ fontSize: "12.5px", fontWeight: "500", color: "#c2330f" }}>
{ed.erro}
</span>
</>) : null}
<span style={{ flex: "1" }} />
<button onClick={ed.fechar} style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "transparent", fontSize: "13px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={ed.salvar} style={{ height: "40px", padding: "0 18px", borderRadius: "10px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "13.5px", fontWeight: "500", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
{ed.salvarTxt}
</button>
</div>
</div>
</div>
</>) : null}
</div>


    </>
  );
}
