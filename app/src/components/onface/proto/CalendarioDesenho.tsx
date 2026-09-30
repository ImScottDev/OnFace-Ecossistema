"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Calendario.dc.html
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
import "./CalendarioDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeCalendarioDesenho {
  agenda: any;
  agendaVazia: any;
  ant: any;
  at: any;
  cabSem: any;
  celulas: any;
  colSem: any;
  det: any;
  diaTxt: any;
  ehMes: any;
  ehSemana: any;
  horas: any;
  irHoje: any;
  mini: any;
  novaAtv: any;
  novaReu: any;
  novaReuDia: any;
  parar: any;
  periodo: any;
  periodoSub: any;
  prox: any;
  railStyle: any;
  refSc: any;
  semCab: any;
  temDiaTodo: any;
  tf: any;
  tipos: any;
  visoes: any;
}

export function CalendarioDesenho(vals: ValoresDeCalendarioDesenho) {
  const { agenda, agendaVazia, ant, at, cabSem, celulas, colSem, det, diaTxt, ehMes, ehSemana, horas, irHoje, mini, novaAtv, novaReu, novaReuDia, parar, periodo, periodoSub, prox, railStyle, refSc, semCab, temDiaTodo, tf, tipos, visoes } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", gap: "14px", padding: "16px", overflow: "hidden" }}>
<div style={{ flex: "1 1 auto", minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
<div data-r="toolbar" style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end", gap: "12px 16px", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 280px", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "28px", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.1", color: "#12171d" }}>
Calendário de atividades
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13.5px", color: "#67787c" }}>
Suas tarefas, reuniões e compromissos em um só lugar.
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<div data-cal-tipos="1" style={estilo(tf.grupo)}>
<button onClick={tf.abrir} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "0 11px", fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap", color: "inherit", background: "transparent", border: "0", cursor: "pointer" }} className={[hover(tf.hover)].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 3H2l8 9.5V19l4 2v-8.5z" />
</svg>
<span>
Tipos
</span>
{(tf.temOff) ? (<>
<span style={estilo(tf.contaStyle)}>
{tf.conta}
</span>
</>) : null}
</button>
<span style={estilo(tf.div)} />
<button onClick={tf.abrir} title="Abrir opções" style={{ display: "grid", placeItems: "center", width: "28px", padding: "0", color: "inherit", background: "transparent", border: "0", cursor: "pointer" }} className={[hover(tf.hover)].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
</div>
<button onClick={irHoje} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#12171d", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
Hoje
</button>
<div style={{ display: "flex", height: "36px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden" }}>
<button onClick={ant} title="Anterior" style={{ width: "36px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f6f7f7;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
</button>
<span style={{ width: "1px", background: "#e3e7e8" }} />
<button onClick={prox} title="Próximo" style={{ width: "36px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f6f7f7;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</div>
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px", height: "36px", alignItems: "stretch" }}>
{(visoes ?? []).map((vs: any, i1: number) => (
<Fragment key={vs?.id ?? vs?.chave ?? i1}>
<button onClick={vs.onClick} style={estilo(vs.style)}>
{vs.l}
</button>
</Fragment>
))}
</div>
<button onClick={novaReu} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#12171d", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Nova reunião
</button>
<button onClick={novaAtv} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#d93c1a", fontSize: "13px", fontWeight: "500", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Nova atividade
</button>
</div>
</div>
<section style={{ flex: "1 1 auto", minHeight: "0", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2px 10px", padding: "16px 18px 12px" }}>
<span style={{ flex: "0 1 auto", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{periodo}
</span>
<span style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: "12.5px", color: "#8b949e" }}>
{periodoSub}
</span>
</div>
{(ehMes) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", boxShadow: "inset 0 1px 0 #eef1f1,inset 0 -1px 0 #eef1f1", background: "#fafafa" }}>
{(semCab ?? []).map((sc: any, i1: number) => (
<Fragment key={sc?.id ?? sc?.chave ?? i1}>
<span style={{ padding: "8px 0", textAlign: "center", fontSize: "11.5px", fontWeight: "500", color: "#67787c" }}>
{sc}
</span>
</Fragment>
))}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>
{(celulas ?? []).map((ce: any, i1: number) => (
<Fragment key={ce?.id ?? ce?.chave ?? i1}>
<div onClick={ce.onClick} style={estilo(ce.style)} className={[hover("background:#fcfbfa")].filter(Boolean).join(" ")}>
<span style={estilo(ce.nStyle)}>
{ce.n}
</span>
{(ce.itens ?? []).map((ch: any, i2: number) => (
<Fragment key={ch?.id ?? ch?.chave ?? i2}>
<button onClick={ch.onClick} title={ch.dica} style={estilo(ch.style)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ch.cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={ch.ico} />
</svg>
{(ch.temH) ? (<>
<span style={{ flex: "0 0 auto", fontSize: "10.5px", fontWeight: "500", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{ch.h}
</span>
</>) : null}
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ch.t}
</span>
</button>
</Fragment>
))}
{(ce.temMais) ? (<>
<button onClick={ce.abrirMais} style={{ alignSelf: "flex-start", height: "20px", padding: "0 6px", borderRadius: "6px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "500", color: "#67787c", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
{ce.mais}
</button>
</>) : null}
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
{(ehSemana) ? (<>
<div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "56px repeat(7,minmax(0,1fr))", overflowY: "hidden", scrollbarGutter: "stable", boxShadow: "inset 0 1px 0 #eef1f1,inset 0 -1px 0 #eef1f1" }}>
<span style={{ alignSelf: "end", padding: "0 6px 8px", fontSize: "10.5px", color: "#a3a8a4", textAlign: "right" }}>
GMT-03
</span>
{(cabSem ?? []).map((cs: any, i1: number) => (
<Fragment key={cs?.id ?? cs?.chave ?? i1}>
<button onClick={cs.onClick} style={estilo(cs.style)}>
<span style={{ fontSize: "12px", fontWeight: "500", color: "#67787c" }}>
{cs.sem}
</span>
<span style={estilo(cs.nStyle)}>
{cs.n}
</span>
</button>
</Fragment>
))}
</div>
{(temDiaTodo) ? (<>
<div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "56px repeat(7,minmax(0,1fr))", overflowY: "hidden", scrollbarGutter: "stable", boxShadow: "inset 0 -1px 0 #eef1f1" }}>
<span style={{ padding: "8px 6px", fontSize: "10.5px", fontWeight: "500", color: "#8b949e", textAlign: "right", lineHeight: "1.2" }}>
Dia todo
</span>
{(colSem ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<div style={estilo(c.diaTodoStyle)}>
{(c.diaTodo ?? []).map((ch: any, i2: number) => (
<Fragment key={ch?.id ?? ch?.chave ?? i2}>
<button onClick={ch.onClick} title={ch.dica} style={estilo(ch.style)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ch.cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={ch.ico} />
</svg>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ch.t}
</span>
</button>
</Fragment>
))}
</div>
</Fragment>
))}
</div>
</>) : null}
<div ref={refSc} style={{ flex: "1", minHeight: "0", overflowY: "auto", scrollbarGutter: "stable" }}>
<div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,minmax(0,1fr))" }}>
<div>
{(horas ?? []).map((h: any, i1: number) => (
<Fragment key={h?.id ?? h?.chave ?? i1}>
<div style={{ position: "relative", height: "56px" }}>
<span style={{ position: "absolute", top: "-7px", right: "8px", fontSize: "11px", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{h}
</span>
</div>
</Fragment>
))}
</div>
{(colSem ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<div onClick={c.slot} style={estilo(c.style)}>
{(c.evs ?? []).map((ev: any, i2: number) => (
<Fragment key={ev?.id ?? ev?.chave ?? i2}>
<button onClick={ev.onClick} style={estilo(ev.style)} className={[hover("filter:brightness(.97)")].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: "0" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ev.cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={ev.ico} />
</svg>
<span style={estilo(ev.tStyle)}>
{ev.t}
</span>
</span>
{(ev.longo) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ev.sub}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{ev.h}
</span>
</>) : null}
</button>
</Fragment>
))}
{(c.temAgora) ? (<>
<span style={estilo(c.agora)}>
<span style={{ position: "absolute", left: "-5px", top: "-4px", width: "9px", height: "9px", borderRadius: "9999px", background: "#fe4f2b" }} />
</span>
</>) : null}
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
</section>
</div>
<aside data-r="esconde-mobile" style={estilo(railStyle)}>
<section style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 16px 12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
<button onClick={mini.ant} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
</button>
<span style={{ flex: "1", textAlign: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", color: "#12171d" }}>
{mini.mes}
</span>
<button onClick={mini.prox} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "2px", textAlign: "center" }}>
{(semCab ?? []).map((sc: any, i1: number) => (
<Fragment key={sc?.id ?? sc?.chave ?? i1}>
<span style={{ fontSize: "10.5px", fontWeight: "500", color: "#8b949e", paddingBottom: "4px" }}>
{sc}
</span>
</Fragment>
))}
{(mini.cel ?? []).map((cd: any, i1: number) => (
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
<section style={{ background: "#fff", borderRadius: "14px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 14px 8px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 2px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
Agenda do dia
</span>
<button onClick={novaReuDia} title="Nova reunião neste dia" style={{ width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
<span style={{ display: "block", margin: "2px 2px 8px", fontSize: "12px", color: "#8b949e" }}>
{diaTxt}
</span>
{(agendaVazia) ? (<>
<div style={{ margin: "4px 0 10px", padding: "22px 10px", borderRadius: "10px", background: "#fafafa", textAlign: "center", fontSize: "12.5px", color: "#8b949e" }}>
Nada marcado neste dia.
</div>
</>) : null}
{(agenda ?? []).map((ag: any, i1: number) => (
<Fragment key={ag?.id ?? ag?.chave ?? i1}>
<button onClick={ag.onClick} style={estilo(ag.row)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(ag.hStyle)}>
{ag.h}
</span>
<span style={estilo(ag.icoBox)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ag.ico} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={estilo(ag.tStyle)}>
{ag.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ag.sub}
</span>
</span>
</button>
</Fragment>
))}
</section>
</aside>
{(tf.aberto) ? (<>
<div data-cal-tipos="1" data-in="drop" style={estilo(tf.pos)}>
<div style={{ fontSize: "11px", fontWeight: "500", color: "#4a5560", letterSpacing: ".04em", padding: "6px 6px 4px" }}>
TIPOS NO CALENDÁRIO
</div>
{(tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(tp.caixa)}>
{(tp.on) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tp.cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={tp.ico} />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", color: "#1f252c" }}>
{tp.l}
</span>
<span style={{ fontSize: "11px", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{tp.n}
</span>
</button>
</Fragment>
))}
<div style={{ height: "1px", background: "#eef1f1", margin: "4px -5px" }} />
<button onClick={tf.todos} style={{ width: "100%", padding: "7px 6px", borderRadius: "6px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "12.5px", fontWeight: "500", color: "#c2330f" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Mostrar todos
</button>
</div>
</>) : null}
{(det.aberto) ? (<>
<div data-cal-pop="1" data-in="drop" style={estilo(det.pos)}>
{(det.ehLista) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 2px 8px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", color: "#12171d" }}>
{det.titulo}
</span>
<button onClick={det.fechar} title="Fechar" style={{ width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
{(det.lista ?? []).map((li: any, i1: number) => (
<Fragment key={li?.id ?? li?.chave ?? i1}>
<button onClick={li.onClick} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 6px", border: "0", borderRadius: "9px", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(li.icoBox)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={li.ico} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{li.t}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{li.sub}
</span>
</span>
</button>
</Fragment>
))}
</>) : null}
{(det.ehItem) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(det.tipoStyle)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={det.ico} />
</svg>
{det.tipo}
</span>
<span style={estilo(det.sitStyle)}>
{det.sit}
</span>
<span style={{ flex: "1" }} />
<button onClick={det.fechar} title="Fechar" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<span style={{ display: "block", marginTop: "10px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", lineHeight: "1.3", color: "#12171d", textWrap: "pretty" }}>
{det.titulo}
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "7px", marginTop: "12px" }}>
{(det.fatos ?? []).map((ft: any, i1: number) => (
<Fragment key={ft?.id ?? ft?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#4a5560" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={ft.d} />
</svg>
<span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ft.t}
</span>
</span>
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
{(det.podeConcluir) ? (<>
<button onClick={det.concluir} style={estilo(det.concluirStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{det.concluirTxt}
</button>
</>) : null}
<button onClick={det.abrir} style={{ flex: "1", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "500", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
{det.abrirTxt}
</button>
</div>
</>) : null}
</div>
</>) : null}
</div>
{(at.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={at.fechar} style={{ position: "fixed", inset: "0", zIndex: "62", background: "rgba(18,23,29,.45)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" data-r="drawer" onClick={parar} style={{ width: "min(640px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "18px", boxShadow: "0 40px 90px -30px rgba(12,16,21,.6)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: "1px solid #eef1f1" }}>
<span style={estilo(at.tipoStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={at.ico} />
</svg>
{at.tipo}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{at.origem}
</span>
<button onClick={at.fechar} title="Fechar" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "18px 22px 20px" }}>
<input value={at.titulo} onChange={at.setTitulo} style={{ width: "100%", padding: "2px 0", border: "0", outline: "0", background: "transparent", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "22px", fontWeight: "800", letterSpacing: "-.03em", color: "#12171d" }} />
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,120px) minmax(0,1fr)", gap: "12px 16px", alignItems: "center", marginTop: "16px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
Status
</span>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(at.sits ?? []).map((st: any, i1: number) => (
<Fragment key={st?.id ?? st?.chave ?? i1}>
<button onClick={st.onClick} style={estilo(st.style)}>
{st.l}
</button>
</Fragment>
))}
</div>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
Prazo
</span>
<span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<input type="date" value={at.data} onChange={at.setData} style={{ height: "32px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }} />
<input type="time" value={at.hora} onChange={at.setHora} style={{ height: "32px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d", width: "96px" }} />
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 21V4h11l-2 4 2 4H7" />
</svg>
Prioridade
</span>
<div style={{ display: "flex", gap: "5px" }}>
{(at.prios ?? []).map((pr: any, i1: number) => (
<Fragment key={pr?.id ?? pr?.chave ?? i1}>
<button onClick={pr.onClick} style={estilo(pr.style)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
<path d="M5 21V4h11l-2 4 2 4H7v9z" />
</svg>
{pr.l}
</button>
</Fragment>
))}
</div>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
</svg>
Responsável
</span>
<span>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 12px 0 5px", borderRadius: "9999px", background: "#f3f4f4", cursor: "pointer" }}>
<span style={{ width: "24px", height: "24px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "9.5px", fontWeight: "500" }}>
{at.respIni}
</span>
<span style={{ fontSize: "13px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
{at.resp}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={at.resp} onChange={at.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(at.equipe ?? []).map((op: any, i1: number) => (
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
{(at.temVinc) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "16px" }}>
{(at.vincs ?? []).map((vn: any, i1: number) => (
<Fragment key={vn?.id ?? vn?.chave ?? i1}>
<button onClick={vn.ir} style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "32px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fafafa", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("box-shadow:inset 0 0 0 1px #12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={vn.d} />
</svg>
{vn.l}
</button>
</Fragment>
))}
</div>
</>) : null}
<span style={{ display: "block", marginTop: "18px", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Descrição
</span>
<textarea value={at.desc} onChange={at.setDesc} rows={3} placeholder="Contexto, combinados, o que precisa ser feito" style={{ width: "100%", marginTop: "6px", padding: "11px 13px", borderRadius: "12px", border: "0", outline: "0", resize: "vertical", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "13.5px", lineHeight: "1.55", color: "#1f252c" }} />
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "18px" }}>
<span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Subtarefas
</span>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{at.subsTxt}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
{(at.subs ?? []).map((sb: any, i1: number) => (
<Fragment key={sb?.id ?? sb?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<button onClick={sb.tog} style={estilo(sb.check)}>
{(sb.feita) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
<span style={estilo(sb.tStyle)}>
{sb.t}
</span>
</div>
</Fragment>
))}
<div style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", padding: "0 12px", borderRadius: "10px", border: "1.5px dashed #d7dada" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<input value={at.novaSub} onChange={at.setNovaSub} onKeyDown={at.teclaSub} placeholder="Nova subtarefa · Enter" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
</div>
<span style={{ display: "block", marginTop: "18px", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Comentários
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
{(at.coms ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ width: "22px", height: "22px", borderRadius: "9999px", background: "#e3e7e8", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "500" }}>
{cm.ini}
</span>
<span style={{ flex: "1", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }}>
{cm.autor}
</span>
<span style={{ fontSize: "11px", color: "#a3a8a4" }}>
{cm.quando}
</span>
</div>
<span style={{ display: "block", marginTop: "6px", fontSize: "13px", color: "#1f252c", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
{cm.t}
</span>
</div>
</Fragment>
))}
<div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
<textarea value={at.com} onChange={at.setCom} rows={2} placeholder="Escreva um comentário" style={{ flex: "1", minWidth: "0", padding: "10px 12px", borderRadius: "12px", border: "0", outline: "0", resize: "none", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.5" }} />
<button onClick={at.comentar} style={{ flex: "0 0 auto", height: "38px", padding: "0 14px", borderRadius: "10px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12.5px", fontWeight: "500", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Comentar
</button>
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={at.irAtv} style={{ height: "40px", padding: "0 12px", borderRadius: "10px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
Ver em Atividades
</button>
<span style={{ flex: "1" }} />
<button onClick={at.concluir} style={estilo(at.concluirStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{at.concluirTxt}
</button>
</div>
</div>
</div>
</>) : null}


    </>
  );
}
