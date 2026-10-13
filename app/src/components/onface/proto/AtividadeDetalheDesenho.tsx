"use client";

/* FATIA de `AtividadesDesenho.tsx` (gerado de OnFace Atividades.dc.html):
 * os blocos `dt` (a gaveta da atividade — detalhe, subtarefas e o painel
 * lateral de comentários) e `ed` (o editor), copiados SEM edição.
 *
 * Por que existe: a peça de atividade (`verAtividade`) abre por cima de
 * qualquer tela, e a gaveta do desenho só existia dentro da tela inteira de
 * Atividades. Renderizar a tela inteira para mostrar a gaveta não dá; recriar
 * a gaveta à mão é o que o protocolo proíbe. A fatia é o mesmo markup.
 *
 * `atividade-detalhe-desenho.test.ts` falha se esta fatia divergir do bloco
 * correspondente em `AtividadesDesenho.tsx`. Regerou o desenho? Recopie o
 * trecho de `{(dt.aberto) ? (<>` até o fim do bloco `ed` (o `</>) : null}`
 * antes do `</div>` final) para dentro do fragmento abaixo.
 */

import { Fragment } from "react";
import { estilo, hover } from "./proto-runtime";

export interface ValoresDeAtividadeDetalheDesenho {
  abrirPicker: any;
  dt: any;
  ed: any;
}

export function AtividadeDetalheDesenho(vals: ValoresDeAtividadeDetalheDesenho) {
  const { abrirPicker, dt, ed } = vals;
  return (
    <>
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
    </>
  );
}
