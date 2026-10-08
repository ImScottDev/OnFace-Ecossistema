"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Atividade.dc.html
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
export interface ValoresDeAtividadeDesenho {
  fechar: any;
  nv: any;
  parar: any;
  vr: any;
}

export function AtividadeDesenho(vals: ValoresDeAtividadeDesenho) {
  const { fechar, nv, parar, vr } = vals;
  return (
    <>
{(nv.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "62", background: "rgba(18,23,29,.45)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" data-r="drawer" onClick={parar} style={{ width: "min(760px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "18px", boxShadow: "0 40px 90px -30px rgba(12,16,21,.6)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "14px 18px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", background: "#f3f4f4", borderRadius: "9px", padding: "3px", gap: "2px" }}>
{(nv.naturezas ?? []).map((nt: any, i1: number) => (
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
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 10px", borderRadius: "8px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#eceeee")].filter(Boolean).join(" ")}>
<span style={{ color: "#67787c" }}>
Tipo
</span>
<span style={{ fontWeight: "600" }}>
{nv.tipo}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={nv.tipo} onChange={nv.setTipo} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(nv.tipos ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op}>
{op}
</option>
</Fragment>
))}
</select>
</label>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "12px", color: "#a3a8a4", whiteSpace: "nowrap" }}>
Nova atividade
</span>
<button onClick={fechar} title="Fechar" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "18px 22px 20px" }}>
<input value={nv.titulo} onChange={nv.setTitulo} placeholder="Nome da atividade" autoFocus={true} style={estilo(nv.titInp)} />
<div style={{ marginTop: "10px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap", padding: "5px 6px", borderBottom: "1px solid #eef1f1" }}>
{(nv.fmt ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
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
<input type="file" multiple={true} onChange={nv.anexar} style={{ position: "absolute", inset: "0", opacity: "0", cursor: "pointer", width: "100%" }} />
</label>
</div>
<div style={{ position: "relative" }}>
{(nv.descVazia) ? (<>
<span style={{ position: "absolute", left: "14px", top: "11px", fontSize: "14px", color: "#a3a8a4", pointerEvents: "none" }}>
Adicione uma descrição, contexto ou o que combinar
</span>
</>) : null}
<div ref={nv.descRef} contentEditable="true" suppressContentEditableWarning={true} onInput={nv.setDesc} style={{ minHeight: "90px", maxHeight: "240px", overflowY: "auto", padding: "10px 14px 12px", fontSize: "14px", lineHeight: "1.6", color: "#1f252c", outline: "0", wordBreak: "break-word" }} />
</div>
{(nv.temAnexos) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "0 10px 10px" }}>
{(nv.anexos ?? []).map((ax: any, i1: number) => (
<Fragment key={ax?.id ?? ax?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "32px", padding: "0 4px 0 10px", borderRadius: "9px", background: "#f3f4f4", fontSize: "12px", fontWeight: "500", color: "#1f252c", maxWidth: "240px" }}>
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
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,110px) minmax(0,1fr)", gap: "12px 16px", alignItems: "center", marginTop: "16px" }}>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Prazo
</span>
<span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<input type="date" value={nv.fimD} onChange={nv.setFimD} style={{ height: "32px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }} />
<input type="time" value={nv.fimH} onChange={nv.setFimH} style={{ height: "32px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d", width: "96px" }} />
</span>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Prioridade
</span>
<div style={{ display: "flex", gap: "5px" }}>
{(nv.prios ?? []).map((pr: any, i1: number) => (
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
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Responsável
</span>
<span>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "8px", height: "32px", padding: "0 12px 0 4px", borderRadius: "9999px", background: "#f3f4f4", cursor: "pointer" }}>
<span style={{ width: "24px", height: "24px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "9.5px", fontWeight: "600" }}>
{nv.respIni}
</span>
<span style={{ fontSize: "13px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
{nv.resp}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={nv.resp} onChange={nv.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(nv.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op}>
{op}
</option>
</Fragment>
))}
</select>
</label>
</span>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Vínculo
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
{(nv.temVinc) ? (<>
{(nv.vincs ?? []).map((vn: any, i1: number) => (
<Fragment key={vn?.id ?? vn?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "32px", padding: "0 6px 0 11px", borderRadius: "9999px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={vn.d} />
</svg>
{vn.l}
<button onClick={vn.tirar} title="Tirar" style={{ width: "20px", height: "20px", borderRadius: "9999px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
</>) : null}
{(nv.semVinc) ? (<>
<span style={{ fontSize: "12.5px", color: "#a3a8a4" }}>
Sem vínculo
</span>
</>) : null}
{nv.seletor}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "20px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Subtarefas
</span>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{nv.subsN}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
{(nv.subs ?? []).map((sb: any, i1: number) => (
<Fragment key={sb?.id ?? sb?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "11px 10px 10px 14px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "6px", boxShadow: "inset 0 0 0 1.5px #c4c9ca" }} />
<input value={sb.t} onChange={sb.set} placeholder="Título da subtarefa" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13.5px", fontWeight: "500", color: "#12171d" }} />
<button onClick={sb.remover} title="Remover" style={{ width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingLeft: "28px" }}>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "9999px", background: "#f3f4f4", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
<span>
{sb.resp}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={sb.resp} onChange={sb.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(nv.equipe ?? []).map((op: any, i2: number) => (
<Fragment key={op?.id ?? op?.chave ?? i2}>
<option value={op}>
{op}
</option>
</Fragment>
))}
</select>
</label>
<input type="date" value={sb.fimD} onChange={sb.setFim} style={{ height: "30px", padding: "0 9px", borderRadius: "9999px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }} />
</div>
</div>
</Fragment>
))}
<div style={{ display: "flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 6px 0 14px", borderRadius: "12px", border: "1.5px dashed #d7dada", background: "#fafafa" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<input value={nv.novaSub} onChange={nv.setNovaSub} onKeyDown={nv.teclaSub} placeholder="Nova subtarefa · Enter para adicionar" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
<button onClick={nv.addSub} style={{ height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
Adicionar
</button>
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
{(nv.temErro) ? (<>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#c2330f" }}>
{nv.erro}
</span>
</>) : null}
<span style={{ flex: "1" }} />
<button onClick={fechar} style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "transparent", fontSize: "13px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={nv.salvar} style={{ height: "40px", padding: "0 18px", borderRadius: "10px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "13.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Criar atividade
</button>
</div>
</div>
</div>
</>) : null}
{(vr.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "62", background: "rgba(18,23,29,.45)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" data-r="drawer" onClick={parar} style={{ width: "min(640px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "18px", boxShadow: "0 40px 90px -30px rgba(12,16,21,.6)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: "1px solid #eef1f1" }}>
<span style={estilo(vr.tipoStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={vr.ico} />
</svg>
{vr.tipo}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{vr.origem}
</span>
<button onClick={fechar} title="Fechar" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "18px 22px 20px" }}>
<input value={vr.titulo} onChange={vr.setTitulo} style={{ width: "100%", padding: "2px 0", border: "0", outline: "0", background: "transparent", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "22px", fontWeight: "800", letterSpacing: "-.03em", color: "#12171d" }} />
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,110px) minmax(0,1fr)", gap: "12px 16px", alignItems: "center", marginTop: "16px" }}>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Status
</span>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(vr.sits ?? []).map((st: any, i1: number) => (
<Fragment key={st?.id ?? st?.chave ?? i1}>
<button onClick={st.onClick} style={estilo(st.style)}>
{st.l}
</button>
</Fragment>
))}
</div>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Prazo
</span>
<span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<input type="date" value={vr.data} onChange={vr.setData} style={{ height: "32px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d" }} />
<input type="time" value={vr.hora} onChange={vr.setHora} style={{ height: "32px", padding: "0 9px", borderRadius: "9px", border: "0", outline: "0", background: "#f3f4f4", fontSize: "12.5px", fontWeight: "500", color: "#12171d", width: "96px" }} />
</span>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Prioridade
</span>
<div style={{ display: "flex", gap: "5px" }}>
{(vr.prios ?? []).map((pr: any, i1: number) => (
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
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
Responsável
</span>
<span>
<label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "8px", height: "32px", padding: "0 12px 0 4px", borderRadius: "9999px", background: "#f3f4f4", cursor: "pointer" }}>
<span style={{ width: "24px", height: "24px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "9.5px", fontWeight: "600" }}>
{vr.respIni}
</span>
<span style={{ fontSize: "13px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
{vr.resp}
</span>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={vr.resp} onChange={vr.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(vr.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op}>
{op}
</option>
</Fragment>
))}
</select>
</label>
</span>
</div>
{(vr.temVinc) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "16px" }}>
{(vr.vincs ?? []).map((vn: any, i1: number) => (
<Fragment key={vn?.id ?? vn?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "32px", padding: "0 12px", borderRadius: "9999px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "12.5px", fontWeight: "500", color: "#12171d", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={vn.d} />
</svg>
{vn.l}
</span>
</Fragment>
))}
</div>
</>) : null}
{(vr.temDesc) ? (<>
<div ref={vr.descRef} style={{ marginTop: "18px", padding: "13px 15px", borderRadius: "12px", background: "#fafaf8", fontSize: "14px", color: "#1f252c", lineHeight: "1.6", wordBreak: "break-word" }} />
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "18px" }}>
<span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Subtarefas
</span>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{vr.subsTxt}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
{(vr.subs ?? []).map((sb: any, i1: number) => (
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
<input value={vr.novaSub} onChange={vr.setNovaSub} onKeyDown={vr.teclaSub} placeholder="Nova subtarefa · Enter" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
</div>
<span style={{ display: "block", marginTop: "18px", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Comentários
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
{(vr.coms ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{cm.autor}
</span>
<span style={{ fontSize: "11px", color: "#a3a8a4" }}>
{cm.quando}
</span>
</div>
<span style={{ display: "block", marginTop: "5px", fontSize: "13px", color: "#1f252c", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
{cm.t}
</span>
</div>
</Fragment>
))}
<div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
<textarea value={vr.com} onChange={vr.setCom} rows={2} placeholder="Escreva um comentário" style={{ flex: "1", minWidth: "0", padding: "10px 12px", borderRadius: "12px", border: "0", outline: "0", resize: "none", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.5" }} />
<button onClick={vr.comentar} style={{ flex: "0 0 auto", height: "38px", padding: "0 14px", borderRadius: "10px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Comentar
</button>
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<span style={{ flex: "1" }} />
{vr.slotExcluir}
<button onClick={vr.concluir} style={estilo(vr.concluirStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{vr.concluirTxt}
</button>
</div>
</div>
</div>
</>) : null}
    </>
  );
}
