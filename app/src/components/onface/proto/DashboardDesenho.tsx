"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Dashboard.dc.html
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

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeDashboardDesenho {
  areaPath: any;
  arrowAmount: any;
  arrowCustomer: any;
  arrowDate: any;
  arrowStatus: any;
  chargeOpen: any;
  chartReady: any;
  chartRef: any;
  chartViewBox: any;
  clearFilters: any;
  clientCount: any;
  clients: any;
  closeCharge: any;
  closeDrawer: any;
  closePalette: any;
  confirming: any;
  copyId: any;
  crossStyle: any;
  dotStyle: any;
  exportCsv: any;
  failTotal: any;
  failures: any;
  formAmount: any;
  formError: any;
  formName: any;
  goClients: any;
  goOverview: any;
  goPayments: any;
  gridLines: any;
  hasMore: any;
  hasSelected: any;
  hasToast: any;
  hoverActive: any;
  isClients: any;
  isEmpty: any;
  isOverview: any;
  isPayments: any;
  kpis: any;
  loadMore: any;
  loading: any;
  mainPath: any;
  methodOptions: any;
  methods: any;
  metricBtns: any;
  metricDelta: any;
  metricDeltaStyle: any;
  metricSub: any;
  metricTitle: any;
  metricValue: any;
  navStyles: any;
  onChartLeave: any;
  onChartMove: any;
  onPaletteKey: any;
  openCharge: any;
  openPalette: any;
  paletteEmpty: any;
  paletteOpen: any;
  paletteQuery: any;
  paletteRef: any;
  paletteResults: any;
  prevBtnStyle: any;
  prevOpacity: any;
  prevPath: any;
  query: any;
  rangeBtns: any;
  recent: any;
  refundBtnStyle: any;
  refundCancel: any;
  refundConfirm: any;
  refundLabel: any;
  refundStart: any;
  resultLabel: any;
  rows: any;
  sel: any;
  setFormAmount: any;
  setFormName: any;
  setPaletteQuery: any;
  setQuery: any;
  showActions: any;
  soon: any;
  sortAmount: any;
  sortCustomer: any;
  sortDate: any;
  sortStatus: any;
  statusChips: any;
  stop: any;
  submitCharge: any;
  submitLabel: any;
  submitting: any;
  tip: any;
  tipStyle: any;
  toastDotStyle: any;
  toastText: any;
  togglePrev: any;
  totalPayments: any;
  viewMeta: any;
  viewTitle: any;
  xLabels: any;
}

export function DashboardDesenho(vals: ValoresDeDashboardDesenho) {
  const { areaPath, arrowAmount, arrowCustomer, arrowDate, arrowStatus, chargeOpen, chartReady, chartRef, chartViewBox, clearFilters, clientCount, clients, closeCharge, closeDrawer, closePalette, confirming, copyId, crossStyle, dotStyle, exportCsv, failTotal, failures, formAmount, formError, formName, goClients, goOverview, goPayments, gridLines, hasMore, hasSelected, hasToast, hoverActive, isClients, isEmpty, isOverview, isPayments, kpis, loadMore, loading, mainPath, methodOptions, methods, metricBtns, metricDelta, metricDeltaStyle, metricSub, metricTitle, metricValue, navStyles, onChartLeave, onChartMove, onPaletteKey, openCharge, openPalette, paletteEmpty, paletteOpen, paletteQuery, paletteRef, paletteResults, prevBtnStyle, prevOpacity, prevPath, query, rangeBtns, recent, refundBtnStyle, refundCancel, refundConfirm, refundLabel, refundStart, resultLabel, rows, sel, setFormAmount, setFormName, setPaletteQuery, setQuery, showActions, soon, sortAmount, sortCustomer, sortDate, sortStatus, statusChips, stop, submitCharge, submitLabel, submitting, tip, tipStyle, toastDotStyle, toastText, togglePrev, totalPayments, viewMeta, viewTitle, xLabels } = vals;
  return (
    <>
<div style={{ display: "flex", minHeight: "100vh", background: "#F6F7F9" }}>
<aside style={{ width: "236px", flex: "0 0 236px", background: "#FFFFFF", borderRight: "1px solid #E4E7EC", display: "flex", flexDirection: "column", position: "sticky", top: "0", height: "100vh" }}>
<div style={{ height: "60px", display: "flex", alignItems: "center", gap: "10px", padding: "0 18px", borderBottom: "1px solid #EFF1F4" }}>
<div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#0E7C6B", color: "#fff", display: "grid", placeItems: "center", fontWeight: "700", fontSize: "14px", letterSpacing: "-.02em" }}>
O
</div>
<div style={{ fontWeight: "600", fontSize: "15px", letterSpacing: "-.015em" }}>
OnFace
</div>
<div style={{ marginLeft: "auto", fontSize: "10px", fontWeight: "600", color: "#0E7C6B", background: "#E6F4F1", padding: "3px 6px", borderRadius: "5px", letterSpacing: ".04em" }}>
TESTE
</div>
</div>
<nav style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".06em", padding: "8px 10px 6px" }}>
OPERAÇÃO
</div>
<button onClick={goOverview} style={estilo(navStyles.overview)} className={[hover("background:#F4F6F8")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
<rect x="2" y="2" width="5" height="5" rx="1.4" />
<rect x="9" y="2" width="5" height="5" rx="1.4" />
<rect x="2" y="9" width="5" height="5" rx="1.4" />
<rect x="9" y="9" width="5" height="5" rx="1.4" />
</svg>
<span>
Visão geral
</span>
</button>
<button onClick={goPayments} style={estilo(navStyles.payments)} className={[hover("background:#F4F6F8")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
<rect x="1.8" y="3.5" width="12.4" height="9" rx="1.6" />
<path d="M1.8 6.6h12.4" />
</svg>
<span>
Pagamentos
</span>
<span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", color: "#667085" }}>
{totalPayments}
</span>
</button>
<button onClick={goClients} style={estilo(navStyles.clients)} className={[hover("background:#F4F6F8")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
<circle cx="8" cy="5.5" r="2.6" />
<path d="M2.8 13.6c.6-2.6 2.7-3.8 5.2-3.8s4.6 1.2 5.2 3.8" />
</svg>
<span>
Clientes
</span>
</button>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".06em", padding: "16px 10px 6px" }}>
FINANCEIRO
</div>
<button onClick={soon} style={estilo(navStyles.balances)} className={[hover("background:#F4F6F8")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
<path d="M2.4 5.2 8 2.2l5.6 3-5.6 3z" />
<path d="M2.4 8.4 8 11.4l5.6-3" />
<path d="M2.4 11.2 8 14.2l5.6-3" />
</svg>
<span>
Saldos
</span>
</button>
<button onClick={soon} style={estilo(navStyles.reports)} className={[hover("background:#F4F6F8")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
<path d="M2.6 13.4V8.8M6.8 13.4V4.2M11 13.4v-6" />
</svg>
<span>
Relatórios
</span>
</button>
<button onClick={soon} style={estilo(navStyles.settings)} className={[hover("background:#F4F6F8")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
<circle cx="8" cy="8" r="2.2" />
<path d="M8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3" />
</svg>
<span>
Configurações
</span>
</button>
</nav>
<div style={{ marginTop: "auto", padding: "12px" }}>
<div style={{ border: "1px solid #E4E7EC", borderRadius: "10px", padding: "12px", background: "#FBFCFD" }}>
<div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
Ativar conta real
</div>
<div style={{ fontSize: "11.5px", color: "#667085", lineHeight: "1.45", marginBottom: "9px" }}>
Envie os documentos para receber de verdade.
</div>
<button onClick={soon} style={{ width: "100%", textAlign: "center", background: "#0F1419", color: "#fff", fontSize: "12px", fontWeight: "600", padding: "7px 0", borderRadius: "7px" }} className={[hover("background:#242A33")].filter(Boolean).join(" ")}>
Continuar
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "12px 6px 4px" }}>
<div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#DDE3EA", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "600", color: "#475467" }}>
RS
</div>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "12.5px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
Rafael Scott
</div>
<div style={{ fontSize: "11px", color: "#667085" }}>
Administrador
</div>
</div>
</div>
</div>
</aside>
<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column" }}>
<header style={{ height: "60px", background: "rgba(255,255,255,.88)", backdropFilter: "blur(8px)", borderBottom: "1px solid #E4E7EC", display: "flex", alignItems: "center", gap: "12px", padding: "0 24px", position: "sticky", top: "0", zIndex: "20" }}>
<div style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-.015em", whiteSpace: "nowrap", flex: "0 0 auto" }}>
{viewTitle}
</div>
<div style={{ fontSize: "12px", color: "#667085", fontFamily: "'IBM Plex Mono',monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: "0" }}>
{viewMeta}
</div>
<div style={{ flex: "1", minWidth: "8px" }} />
<button onClick={openPalette} style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E4E7EC", background: "#fff", borderRadius: "8px", padding: "6px 8px 6px 10px", fontSize: "13px", color: "#667085", flex: "0 1 200px", minWidth: "40px", overflow: "hidden" }} className={[hover("border-color:#D0D5DD;color:#475467")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ flex: "0 0 auto" }}>
<circle cx="7" cy="7" r="4.4" />
<path d="m10.4 10.4 3 3" />
</svg>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Buscar ou executar…
</span>
<span style={{ marginLeft: "auto", flex: "0 0 auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", border: "1px solid #E4E7EC", borderRadius: "4px", padding: "1px 5px", color: "#667085" }}>
⌘K
</span>
</button>
<button onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: "7px", border: "1px solid #E4E7EC", background: "#fff", borderRadius: "8px", padding: "7px 11px", fontSize: "13px", fontWeight: "500", flex: "0 0 auto", whiteSpace: "nowrap" }} className={[hover("background:#F7F8FA;border-color:#D0D5DD")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ flex: "0 0 auto" }}>
<path d="M8 2.6v7.2M5.2 7.4 8 10.2l2.8-2.8M2.8 12.8h10.4" />
</svg>
<span style={{ whiteSpace: "nowrap" }}>
Exportar
</span>
</button>
<button onClick={openCharge} style={{ display: "flex", alignItems: "center", gap: "7px", background: "#0E7C6B", color: "#fff", borderRadius: "8px", padding: "7px 12px", fontSize: "13px", fontWeight: "600", boxShadow: "0 1px 2px rgba(14,124,107,.3)", flex: "0 0 auto", whiteSpace: "nowrap" }} className={[hover("background:#0A6558")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flex: "0 0 auto" }}>
<path d="M8 3.4v9.2M3.4 8h9.2" />
</svg>
<span style={{ whiteSpace: "nowrap" }}>
Nova cobrança
</span>
</button>
</header>
{(isOverview) ? (<>
<main style={{ padding: "24px", maxWidth: "1320px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(214px,1fr))", gap: "14px" }}>
{(kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<button onClick={k.onClick} style={estilo(k.cardStyle)}>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
<div style={{ fontSize: "12.5px", fontWeight: "500", color: "#667085" }}>
{k.label}
</div>
<div style={estilo(k.deltaStyle)}>
{k.delta}
</div>
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "24px", fontWeight: "500", letterSpacing: "-.03em", lineHeight: "1.1" }}>
{k.value}
</div>
<div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "10px", marginTop: "12px" }}>
<div style={{ fontSize: "11.5px", color: "#667085" }}>
{k.sub}
</div>
<svg width="88" height="28" viewBox="0 0 88 28" fill="none" style={{ overflow: "visible", flex: "0 0 auto" }}>
<polyline points={k.spark} fill="none" stroke={k.sparkColor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
</svg>
</div>
</button>
</Fragment>
))}
</div>
<section style={{ background: "#fff", border: "1px solid #E4E7EC", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
<div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "flex-start", gap: "18px", flexWrap: "wrap" }}>
<div>
<div style={{ fontSize: "12.5px", color: "#667085", fontWeight: "500", marginBottom: "6px" }}>
{metricTitle}
</div>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "30px", fontWeight: "500", letterSpacing: "-.035em", lineHeight: "1" }}>
{metricValue}
</div>
<div style={estilo(metricDeltaStyle)}>
{metricDelta}
</div>
</div>
<div style={{ fontSize: "12px", color: "#667085", marginTop: "7px" }}>
{metricSub}
</div>
</div>
<div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<button onClick={togglePrev} style={estilo(prevBtnStyle)}>
<span style={{ width: "14px", height: "0", borderTop: "2px dashed currentColor", display: "inline-block" }} />
<span>
Comparar
</span>
</button>
<div style={{ display: "flex", background: "#F4F6F8", borderRadius: "8px", padding: "2px", gap: "2px" }}>
{(rangeBtns ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<button onClick={r.onClick} style={estilo(r.style)}>
{r.label}
</button>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ padding: "0 20px 8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(metricBtns ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)}>
{m.label}
</button>
</Fragment>
))}
</div>
{(loading) ? (<>
<div style={{ height: "300px", margin: "8px 20px 20px", borderRadius: "10px", background: "linear-gradient(100deg,#F4F6F8 20%,#EDF0F3 40%,#F4F6F8 60%)", backgroundSize: "460px 100%", animation: "om-shim 1.1s linear infinite" }} />
</>) : null}
{(chartReady) ? (<>
<div style={{ position: "relative", padding: "8px 20px 18px" }}>
<div ref={chartRef} style={{ position: "relative", height: "300px", animation: "om-fade .45s ease-out both" }}>
{(gridLines ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div style={estilo(g.style)} />
</Fragment>
))}
{(gridLines ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div style={estilo(g.labelStyle)}>
{g.label}
</div>
</Fragment>
))}
<svg width="100%" height="300" viewBox={chartViewBox} preserveAspectRatio="none" style={{ display: "block", position: "absolute", inset: "0", overflow: "visible" }}>
<defs>
<linearGradient id="onfaceArea" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#0E7C6B" stopOpacity=".16" />
<stop offset="100%" stopColor="#0E7C6B" stopOpacity="0" />
</linearGradient>
</defs>
<path d={areaPath} fill="url(#onfaceArea)" />
<path d={prevPath} fill="none" stroke="#B9C0CB" strokeWidth="1.6" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" opacity={prevOpacity} />
<path d={mainPath} fill="none" stroke="#0E7C6B" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: "4600", animation: "om-draw 1.15s cubic-bezier(.22,1,.36,1) both" }} />
</svg>
{(hoverActive) ? (<>
<div style={estilo(crossStyle)} />
</>) : null}
{(hoverActive) ? (<>
<div style={estilo(dotStyle)} />
</>) : null}
<div onMouseMove={onChartMove} onMouseLeave={onChartLeave} style={{ position: "absolute", inset: "0", cursor: "crosshair" }} />
{(hoverActive) ? (<>
<div style={estilo(tipStyle)}>
<div style={{ fontSize: "11.5px", color: "#667085", marginBottom: "7px", fontWeight: "500" }}>
{tip.label}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
<span style={{ width: "7px", height: "7px", borderRadius: "2px", background: "#0E7C6B" }} />
<span style={{ fontSize: "12px", color: "#475467" }}>
Período atual
</span>
<span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", fontWeight: "500" }}>
{tip.value}
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ width: "7px", height: "7px", borderRadius: "2px", background: "#B9C0CB" }} />
<span style={{ fontSize: "12px", color: "#475467" }}>
Anterior
</span>
<span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#667085" }}>
{tip.prev}
</span>
</div>
<div style={{ borderTop: "1px solid #EFF1F4", marginTop: "8px", paddingTop: "7px", fontSize: "11.5px", color: "#667085" }}>
{tip.extra}
</div>
</div>
</>) : null}
</div>
<div style={{ position: "relative", height: "18px", marginTop: "6px" }}>
{(xLabels ?? []).map((x: any, i1: number) => (
<Fragment key={x?.id ?? x?.chave ?? i1}>
<div style={estilo(x.style)}>
{x.label}
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
</section>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "16px" }}>
<section style={{ background: "#fff", border: "1px solid #E4E7EC", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", padding: "18px 20px 20px" }}>
<div style={{ fontSize: "13.5px", fontWeight: "600", marginBottom: "3px" }}>
Meios de pagamento
</div>
<div style={{ fontSize: "12px", color: "#667085", marginBottom: "16px" }}>
Participação no volume do período
</div>
<div style={{ display: "flex", height: "8px", borderRadius: "5px", overflow: "hidden", gap: "2px", marginBottom: "18px" }}>
{(methods ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<div style={estilo(m.segStyle)} />
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
{(methods ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={estilo(m.dotStyle)} />
<span style={{ fontSize: "13px", fontWeight: "500" }}>
{m.name}
</span>
<span style={{ fontSize: "12px", color: "#667085", fontFamily: "'IBM Plex Mono',monospace" }}>
{m.share}
</span>
<span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px" }}>
{m.value}
</span>
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E4E7EC", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", padding: "18px 20px 20px" }}>
<div style={{ fontSize: "13.5px", fontWeight: "600", marginBottom: "3px" }}>
Motivos de recusa
</div>
<div style={{ fontSize: "12px", color: "#667085", marginBottom: "16px" }}>
{failTotal} tentativas recusadas
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
{(failures ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
<span style={{ fontSize: "13px" }}>
{f.name}
</span>
<span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#475467" }}>
{f.count}
</span>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11.5px", color: "#667085", width: "44px", textAlign: "right" }}>
{f.share}
</span>
</div>
<div style={{ height: "6px", background: "#F1F3F6", borderRadius: "4px", overflow: "hidden" }}>
<div style={estilo(f.barStyle)} />
</div>
</div>
</Fragment>
))}
</div>
</section>
</div>
<section style={{ background: "#fff", border: "1px solid #E4E7EC", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #EFF1F4" }}>
<div style={{ fontSize: "13.5px", fontWeight: "600" }}>
Pagamentos recentes
</div>
<button onClick={goPayments} style={{ marginLeft: "auto", fontSize: "12.5px", fontWeight: "600", color: "#0E7C6B", display: "flex", alignItems: "center", gap: "5px" }} className={[hover("color:#0A6558")].filter(Boolean).join(" ")}>
<span>
Ver todos
</span>
<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
<path d="m6 3.5 4.5 4.5L6 12.5" />
</svg>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 130px 128px 120px", gap: "12px", padding: "10px 20px", background: "#FBFCFD", borderBottom: "1px solid #EFF1F4", fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".04em" }}>
<div>
CLIENTE
</div>
<div style={{ textAlign: "right" }}>
VALOR
</div>
<div>
STATUS
</div>
<div style={{ textAlign: "right" }}>
DATA
</div>
</div>
{(recent ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.open} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 130px 128px 120px", gap: "12px", padding: "13px 20px", width: "100%", borderBottom: "1px solid #F4F6F8", alignItems: "center" }} className={[hover("background:#FBFCFD")].filter(Boolean).join(" ")}>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "13px", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{p.customer}
</div>
<div style={{ fontSize: "11.5px", color: "#667085", fontFamily: "'IBM Plex Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{p.id}
</div>
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", textAlign: "right" }}>
{p.amount}
</div>
<div>
<span style={estilo(p.pillStyle)}>
{p.status}
</span>
</div>
<div style={{ fontSize: "12.5px", color: "#667085", textAlign: "right" }}>
{p.date}
</div>
</button>
</Fragment>
))}
</section>
</main>
</>) : null}
{(isPayments) ? (<>
<main style={{ padding: "24px", maxWidth: "1320px", width: "100%", margin: "0 auto", animation: "om-fade .3s ease-out both" }}>
<section style={{ background: "#fff", border: "1px solid #E4E7EC", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", overflow: "hidden" }}>
<div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", borderBottom: "1px solid #EFF1F4" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E4E7EC", borderRadius: "8px", padding: "7px 10px", background: "#fff", minWidth: "250px", flex: "1", maxWidth: "340px" }}>
<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#98A2B3" strokeWidth="1.6">
<circle cx="7" cy="7" r="4.4" />
<path d="m10.4 10.4 3 3" />
</svg>
<input value={query} onChange={setQuery} placeholder="Cliente, e-mail ou ID" style={{ border: "0", outline: "0", width: "100%", fontSize: "13px", background: "transparent" }} />
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(statusChips ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<button onClick={c.onClick} style={estilo(c.style)}>
{c.label}
</button>
</Fragment>
))}
</div>
<div style={{ marginLeft: "auto", fontSize: "12px", color: "#667085", fontFamily: "'IBM Plex Mono',monospace" }}>
{resultLabel}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 140px 130px 150px 130px 28px", gap: "12px", padding: "10px 20px", background: "#FBFCFD", borderBottom: "1px solid #EFF1F4", fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".04em" }}>
<button onClick={sortCustomer} style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".04em" }} className={[hover("color:#475467")].filter(Boolean).join(" ")}>
CLIENTE{arrowCustomer}
</button>
<button onClick={sortAmount} style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".04em", textAlign: "right" }} className={[hover("color:#475467")].filter(Boolean).join(" ")}>
VALOR{arrowAmount}
</button>
<button onClick={sortStatus} style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".04em" }} className={[hover("color:#475467")].filter(Boolean).join(" ")}>
STATUS{arrowStatus}
</button>
<div>
MÉTODO
</div>
<button onClick={sortDate} style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".04em", textAlign: "right" }} className={[hover("color:#475467")].filter(Boolean).join(" ")}>
DATA{arrowDate}
</button>
<div />
</div>
{(rows ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.open} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 140px 130px 150px 130px 28px", gap: "12px", padding: "13px 20px", width: "100%", borderBottom: "1px solid #F4F6F8", alignItems: "center" }} className={[hover("background:#FBFCFD")].filter(Boolean).join(" ")}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
<span style={estilo(p.avatarStyle)}>
{p.initials}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{p.customer}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#667085", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{p.email}
</span>
</span>
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", textAlign: "right" }}>
{p.amount}
</div>
<div>
<span style={estilo(p.pillStyle)}>
{p.status}
</span>
</div>
<div style={{ fontSize: "12.5px", color: "#475467", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{p.method}
</div>
<div style={{ fontSize: "12.5px", color: "#667085", textAlign: "right" }}>
{p.date}
</div>
<div style={{ color: "#C6CDD6", display: "flex", justifyContent: "flex-end" }}>
<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
<path d="m6 3.5 4.5 4.5L6 12.5" />
</svg>
</div>
</button>
</Fragment>
))}
{(isEmpty) ? (<>
<div style={{ padding: "64px 20px", textAlign: "center" }}>
<div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#F4F6F8", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#98A2B3" strokeWidth="1.6">
<circle cx="7" cy="7" r="4.4" />
<path d="m10.4 10.4 3 3" />
</svg>
</div>
<div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "5px" }}>
Nenhum pagamento encontrado
</div>
<div style={{ fontSize: "12.5px", color: "#667085", marginBottom: "16px" }}>
Ajuste a busca ou limpe os filtros.
</div>
<button onClick={clearFilters} style={{ border: "1px solid #E4E7EC", borderRadius: "8px", padding: "7px 14px", fontSize: "12.5px", fontWeight: "500" }} className={[hover("background:#F7F8FA")].filter(Boolean).join(" ")}>
Limpar filtros
</button>
</div>
</>) : null}
{(hasMore) ? (<>
<div style={{ padding: "14px 20px", display: "flex", justifyContent: "center" }}>
<button onClick={loadMore} style={{ border: "1px solid #E4E7EC", borderRadius: "8px", padding: "8px 16px", fontSize: "12.5px", fontWeight: "500", background: "#fff" }} className={[hover("background:#F7F8FA;border-color:#D0D5DD")].filter(Boolean).join(" ")}>
Carregar mais
</button>
</div>
</>) : null}
</section>
</main>
</>) : null}
{(isClients) ? (<>
<main style={{ padding: "24px", maxWidth: "1320px", width: "100%", margin: "0 auto", animation: "om-fade .3s ease-out both" }}>
<section style={{ background: "#fff", border: "1px solid #E4E7EC", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", overflow: "hidden" }}>
<div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #EFF1F4" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E4E7EC", borderRadius: "8px", padding: "7px 10px", minWidth: "250px", flex: "1", maxWidth: "340px" }}>
<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#98A2B3" strokeWidth="1.6">
<circle cx="7" cy="7" r="4.4" />
<path d="m10.4 10.4 3 3" />
</svg>
<input value={query} onChange={setQuery} placeholder="Buscar cliente" style={{ border: "0", outline: "0", width: "100%", fontSize: "13px", background: "transparent" }} />
</div>
<div style={{ marginLeft: "auto", fontSize: "12px", color: "#667085", fontFamily: "'IBM Plex Mono',monospace" }}>
{clientCount}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 120px 150px 150px", gap: "12px", padding: "10px 20px", background: "#FBFCFD", borderBottom: "1px solid #EFF1F4", fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".04em" }}>
<div>
CLIENTE
</div>
<div style={{ textAlign: "right" }}>
PAGAMENTOS
</div>
<div style={{ textAlign: "right" }}>
TOTAL GASTO
</div>
<div style={{ textAlign: "right" }}>
ÚLTIMA COMPRA
</div>
</div>
{(clients ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 120px 150px 150px", gap: "12px", padding: "13px 20px", borderBottom: "1px solid #F4F6F8", alignItems: "center" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
<span style={estilo(c.avatarStyle)}>
{c.initials}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{c.name}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#667085", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{c.email}
</span>
</span>
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", textAlign: "right" }}>
{c.count}
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", textAlign: "right" }}>
{c.total}
</div>
<div style={{ fontSize: "12.5px", color: "#667085", textAlign: "right" }}>
{c.last}
</div>
</div>
</Fragment>
))}
</section>
</main>
</>) : null}
</div>
{(hasSelected) ? (<>
<div onClick={closeDrawer} style={{ position: "fixed", inset: "0", background: "rgba(15,20,25,.28)", zIndex: "40", animation: "om-veil .2s ease-out both" }} />
</>) : null}
{(hasSelected) ? (<>
<aside style={{ position: "fixed", top: "0", right: "0", bottom: "0", width: "430px", maxWidth: "92vw", background: "#fff", borderLeft: "1px solid #E4E7EC", zIndex: "41", display: "flex", flexDirection: "column", animation: "om-slide .32s cubic-bezier(.22,1,.36,1) both", boxShadow: "-12px 0 40px rgba(16,24,40,.1)" }}>
<div style={{ padding: "18px 20px", borderBottom: "1px solid #EFF1F4", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "26px", fontWeight: "500", letterSpacing: "-.03em" }}>
{sel.amount}
</div>
<span style={estilo(sel.pillStyle)}>
{sel.status}
</span>
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#667085" }}>
{sel.id}
</div>
</div>
<button onClick={closeDrawer} style={{ marginLeft: "auto", width: "30px", height: "30px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#667085" }} className={[hover("background:#F4F6F8;color:#0F1419")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
<path d="M4 4l8 8M12 4l-8 8" />
</svg>
</button>
</div>
<div style={{ flex: "1", overflowY: "auto", padding: "20px" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".06em", marginBottom: "12px" }}>
DETALHES
</div>
<div style={{ display: "grid", gridTemplateColumns: "118px 1fr", gap: "11px 12px", fontSize: "13px", marginBottom: "26px" }}>
<div style={{ color: "#667085" }}>
Cliente
</div>
<div style={{ fontWeight: "500" }}>
{sel.customer}
</div>
<div style={{ color: "#667085" }}>
E-mail
</div>
<div>
{sel.email}
</div>
<div style={{ color: "#667085" }}>
Método
</div>
<div>
{sel.method}
</div>
<div style={{ color: "#667085" }}>
Data
</div>
<div>
{sel.fullDate}
</div>
<div style={{ color: "#667085" }}>
Taxa
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{sel.fee}
</div>
<div style={{ color: "#667085" }}>
Líquido
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: "500" }}>
{sel.net}
</div>
<div style={{ color: "#667085" }}>
Risco
</div>
<div>
{sel.risk}
</div>
</div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#667085", letterSpacing: ".06em", marginBottom: "14px" }}>
LINHA DO TEMPO
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
{(sel.timeline ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: "12px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
<span style={estilo(t.dotStyle)} />
<span style={estilo(t.lineStyle)} />
</div>
<div style={{ paddingBottom: "16px" }}>
<div style={{ fontSize: "13px", fontWeight: "500", marginBottom: "2px" }}>
{t.title}
</div>
<div style={{ fontSize: "11.5px", color: "#667085", fontFamily: "'IBM Plex Mono',monospace" }}>
{t.time}
</div>
</div>
</div>
</Fragment>
))}
</div>
</div>
{(confirming) ? (<>
<div style={{ padding: "16px 20px", borderTop: "1px solid #EFF1F4", background: "#FFF7F8", animation: "om-fade .2s ease-out both" }}>
<div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
Reembolsar {sel.amount}?
</div>
<div style={{ fontSize: "12px", color: "#667085", lineHeight: "1.5", marginBottom: "12px" }}>
O valor volta ao cliente em até 5 dias úteis. A taxa não é devolvida.
</div>
<div style={{ display: "flex", gap: "8px" }}>
<button onClick={refundConfirm} style={{ flex: "1", textAlign: "center", background: "#C0334A", color: "#fff", fontSize: "13px", fontWeight: "600", padding: "9px 0", borderRadius: "8px", whiteSpace: "nowrap" }} className={[hover("background:#A62A3F")].filter(Boolean).join(" ")}>
Confirmar reembolso
</button>
<button onClick={refundCancel} style={{ border: "1px solid #E4E7EC", borderRadius: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: "500", background: "#fff", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#F7F8FA")].filter(Boolean).join(" ")}>
Cancelar
</button>
</div>
</div>
</>) : null}
{(showActions) ? (<>
<div style={{ padding: "14px 20px", borderTop: "1px solid #EFF1F4", display: "flex", gap: "8px" }}>
<button onClick={refundStart} style={estilo(refundBtnStyle)}>
{refundLabel}
</button>
<button onClick={copyId} style={{ border: "1px solid #E4E7EC", borderRadius: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: "500", background: "#fff", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#F7F8FA")].filter(Boolean).join(" ")}>
Copiar ID
</button>
</div>
</>) : null}
</aside>
</>) : null}
{(chargeOpen) ? (<>
<div onClick={closeCharge} style={{ position: "fixed", inset: "0", background: "rgba(15,20,25,.32)", zIndex: "50", display: "grid", placeItems: "center", padding: "24px", animation: "om-veil .18s ease-out both" }}>
<div onClick={stop} style={{ width: "440px", maxWidth: "100%", background: "#fff", borderRadius: "14px", boxShadow: "0 24px 64px rgba(16,24,40,.22)", animation: "om-scale .24s cubic-bezier(.22,1,.36,1) both", overflow: "hidden" }}>
<div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #EFF1F4" }}>
<div style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-.01em" }}>
Nova cobrança
</div>
<div style={{ fontSize: "12.5px", color: "#667085", marginTop: "3px" }}>
Gera um link de pagamento para enviar ao cliente.
</div>
</div>
<div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#475467", marginBottom: "6px" }}>
Valor
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E4E7EC", borderRadius: "9px", padding: "9px 12px" }} className={[foco("border-color:#0E7C6B")].filter(Boolean).join(" ")}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", color: "#667085" }}>
R$
</span>
<input value={formAmount} onChange={setFormAmount} placeholder="0,00" style={{ border: "0", outline: "0", width: "100%", fontFamily: "'IBM Plex Mono',monospace", fontSize: "15px", background: "transparent" }} />
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#475467", marginBottom: "6px" }}>
Cliente
</div>
<input value={formName} onChange={setFormName} placeholder="Nome completo" style={{ border: "1px solid #E4E7EC", borderRadius: "9px", padding: "10px 12px", width: "100%", fontSize: "13.5px", outline: "0" }} />
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#475467", marginBottom: "6px" }}>
Método
</div>
<div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
{(methodOptions ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
{(formError) ? (<>
<div style={{ fontSize: "12.5px", color: "#C0334A", background: "#FFF1F3", border: "1px solid #FBD5DA", borderRadius: "8px", padding: "9px 11px" }}>
Informe um valor e o nome do cliente.
</div>
</>) : null}
</div>
<div style={{ padding: "14px 20px", borderTop: "1px solid #EFF1F4", display: "flex", gap: "8px", justifyContent: "flex-end", background: "#FBFCFD" }}>
<button onClick={closeCharge} style={{ border: "1px solid #E4E7EC", borderRadius: "8px", padding: "9px 15px", fontSize: "13px", fontWeight: "500", background: "#fff", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#F4F6F8")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={submitCharge} style={{ background: "#0E7C6B", color: "#fff", borderRadius: "8px", padding: "9px 17px", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#0A6558")].filter(Boolean).join(" ")}>
{(submitting) ? (<>
<span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "om-spin .7s linear infinite" }} />
</>) : null}
<span>
{submitLabel}
</span>
</button>
</div>
</div>
</div>
</>) : null}
{(paletteOpen) ? (<>
<div onClick={closePalette} style={{ position: "fixed", inset: "0", background: "rgba(15,20,25,.34)", zIndex: "60", display: "flex", justifyContent: "center", padding: "96px 24px 24px", animation: "om-veil .16s ease-out both" }}>
<div onClick={stop} style={{ width: "560px", maxWidth: "100%", height: "max-content", background: "#fff", borderRadius: "14px", boxShadow: "0 28px 70px rgba(16,24,40,.26)", overflow: "hidden", animation: "om-scale .2s cubic-bezier(.22,1,.36,1) both" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderBottom: "1px solid #EFF1F4" }}>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#98A2B3" strokeWidth="1.6">
<circle cx="7" cy="7" r="4.4" />
<path d="m10.4 10.4 3 3" />
</svg>
<input value={paletteQuery} onChange={setPaletteQuery} onKeyDown={onPaletteKey} ref={paletteRef} placeholder="Buscar páginas, clientes e ações…" style={{ border: "0", outline: "0", width: "100%", fontSize: "14.5px", background: "transparent" }} />
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", border: "1px solid #E4E7EC", borderRadius: "4px", padding: "2px 6px", color: "#667085" }}>
ESC
</span>
</div>
<div style={{ maxHeight: "340px", overflowY: "auto", padding: "8px" }}>
{(paletteResults ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<button onClick={r.onClick} onMouseEnter={r.onHover} style={estilo(r.style)}>
<span style={estilo(r.badgeStyle)}>
{r.kind}
</span>
<span style={{ fontSize: "13.5px", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
{r.label}
</span>
<span style={{ marginLeft: "auto", fontSize: "11.5px", color: "#667085", fontFamily: "'IBM Plex Mono',monospace" }}>
{r.hint}
</span>
</button>
</Fragment>
))}
{(paletteEmpty) ? (<>
<div style={{ padding: "34px 16px", textAlign: "center", fontSize: "13px", color: "#667085" }}>
Nada encontrado para essa busca.
</div>
</>) : null}
</div>
<div style={{ padding: "9px 14px", borderTop: "1px solid #EFF1F4", background: "#FBFCFD", display: "flex", gap: "16px", fontSize: "11.5px", color: "#667085" }}>
<span>
↑↓ navegar
</span>
<span>
↵ abrir
</span>
<span>
⌘K fechar
</span>
</div>
</div>
</div>
</>) : null}
{(hasToast) ? (<>
<div style={{ position: "fixed", bottom: "22px", left: "50%", transform: "translateX(-50%)", zIndex: "70", background: "#0F1419", color: "#fff", borderRadius: "10px", padding: "11px 16px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 12px 32px rgba(16,24,40,.28)", animation: "om-toast .26s cubic-bezier(.22,1,.36,1) both" }}>
<span style={estilo(toastDotStyle)} />
<span style={{ fontSize: "13px", fontWeight: "500" }}>
{toastText}
</span>
</div>
</>) : null}
</div>
    </>
  );
}
