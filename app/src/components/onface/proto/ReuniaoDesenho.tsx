"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Reuniao.dc.html
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
export interface ValoresDeReuniaoDesenho {
  parar: any;
  reu: any;
  rv: any;
}

export function ReuniaoDesenho(vals: ValoresDeReuniaoDesenho) {
  const { parar, reu, rv } = vals;
  return (
    <>
{(rv.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={rv.fechar} style={{ position: "fixed", inset: "0", zIndex: "63", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(580px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "20px 22px 16px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "42px", height: "42px", borderRadius: "11px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", textWrap: "balance" }}>
{rv.titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", color: "#67787c" }}>
{rv.sub}
</span>
</span>
<button onClick={rv.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px 18px", flexWrap: "wrap", marginTop: "16px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "600", color: "#12171d" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span>
{rv.dataTxt}
</span>
<span style={{ fontWeight: "500", color: "#4a5560" }}>
{rv.horaTxt}
</span>
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 10px", borderRadius: "9999px", background: "#eeeff3", fontSize: "12px", fontWeight: "600", color: "#1f252c" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={rv.formatoD} />
</svg>
{rv.formato}
</span>
</div>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "11.5px", color: "#1f7256" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
{rv.sync}
</span>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "0 22px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
{(rv.temLink) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "12px 14px", borderRadius: "12px", background: "#12171d", color: "#fff" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "rgba(255,255,255,.1)", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="m22 8-6 4 6 4V8zM2 6h14v12H2z" />
</svg>
</span>
<span style={{ flex: "1 1 180px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700" }}>
Microsoft Teams
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#a3aab0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rv.linkCurto}
</span>
</span>
<button onClick={rv.copiar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:rgba(255,255,255,.18)")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 9h11v11H9zM5 15H4V4h11v1" />
</svg>
Copiar
</button>
<button onClick={rv.entrar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Entrar na reunião
</button>
</div>
</>) : null}
{(rv.temLocal) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={rv.formatoD} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e" }}>
{rv.localL}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{rv.localV}
</span>
</span>
</div>
</>) : null}
<div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
<span style={{ fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Participantes
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rv.rsResumo}
</span>
<button onClick={rv.abrirAdd} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Incluir
</button>
</div>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#fafafa" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "700" }}>
{rv.orgIni}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{rv.organizador}
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
Organizador
</span>
</div>
{(rv.part ?? []).map((pt: any, i1: number) => (
<Fragment key={pt?.id ?? pt?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", boxShadow: "inset 0 1px 0 #f1f3f3" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "700" }}>
{pt.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pt.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pt.email}
</span>
</span>
<span style={estilo(pt.stStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
<path d={pt.d} />
</svg>
{pt.st}
</span>
{(pt.removivel) ? (<>
<button onClick={pt.remover} title="Remover do convite" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</>) : null}
</div>
</Fragment>
))}
{(rv.addAberto) ? (<>
<div style={{ display: "flex", gap: "8px", padding: "10px 12px", boxShadow: "inset 0 1px 0 #f1f3f3", background: "#fafafa" }}>
<input value={rv.add} onChange={rv.setAdd} onKeyDown={rv.teclaAdd} type="email" placeholder="email@empresa.com.br" autoFocus={true} style={estilo(rv.addInp)} />
<button onClick={rv.confirmaAdd} style={{ flex: "0 0 auto", height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>
Enviar convite
</button>
</div>
</>) : null}
</div>
{(rv.addErro) ? (<>
<span style={{ display: "block", marginTop: "6px", fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
E-mail inválido.
</span>
</>) : null}
</div>
{(rv.temPauta) ? (<>
<div>
<span style={{ display: "block", marginBottom: "6px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Pauta
</span>
<span style={{ display: "block", fontSize: "13.5px", color: "#1f252c", lineHeight: "1.55", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
{rv.pauta}
</span>
</div>
</>) : null}
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Situação
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(rv.sits ?? []).map((st: any, i1: number) => (
<Fragment key={st?.id ?? st?.chave ?? i1}>
<button onClick={st.onClick} style={estilo(st.style)}>
{st.label}
</button>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={rv.fechar} style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Fechar
</button>
<button onClick={rv.editar} style={{ display: "flex", alignItems: "center", gap: "7px", height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
</svg>
Editar ou reagendar
</button>
</div>
</div>
</div>
</>) : null}
{(reu.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={reu.fechar} style={{ position: "fixed", inset: "0", zIndex: "64", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(560px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "20px 22px 16px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "11px", background: "#e6f4ee", color: "#1f7256", boxShadow: "inset 0 0 0 1px #c9e5d8", display: "grid", placeItems: "center" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{reu.tituloModal}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", color: "#4a5560" }}>
{reu.subModal}
</span>
</span>
<button onClick={reu.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
{(reu.temCartao) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "14px", padding: "11px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: "700" }}>
{reu.iniE}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.empresa}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.sub}
</span>
</span>
{(reu.temFam) ? (<>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "24px", padding: "0 9px", borderRadius: "7px", background: "#fff6f4", color: "#c2330f", fontSize: "12px", fontWeight: "600" }}>
{reu.familia}
</span>
</>) : null}
</div>
</>) : null}
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "18px 22px 20px", display: "flex", flexDirection: "column", gap: "18px" }}>
{(reu.escolhe) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Oportunidade
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "42px", padding: "0 12px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "14px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.oppL}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={reu.oppId} onChange={reu.setOpp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(reu.oppsOpc ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
{(reu.semOpp) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px", alignItems: "start" }}>
<div style={{ position: "relative", minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Empresa
</span>
<div style={{ position: "relative" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: "12px", top: "14px", pointerEvents: "none" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={reu.empresaIn} onChange={reu.setEmpresa} onFocus={reu.focoempresa} onBlur={reu.sair} onKeyDown={reu.teclaempresa} placeholder="Buscar empresa" autoComplete="off" style={estilo(reu.empresaInp)} />
{(reu.empresaOk) ? (<>
<button onMouseDown={reu.limparempresa} title="Limpar" style={{ position: "absolute", right: "8px", top: "10px", width: "22px", height: "22px", borderRadius: "6px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</>) : null}
</div>
{(reu.empresaLista) ? (<>
<div data-in="drop" style={{ marginTop: "6px", maxHeight: "220px", overflowY: "auto", padding: "4px", borderRadius: "10px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 12px 28px -12px rgba(18,23,29,.35)" }}>
{(reu.empresaSug ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onMouseDown={sg.escolher} style={estilo(sg.style)} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "10px", fontWeight: "700" }}>
{sg.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sg.l}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sg.sub}
</span>
</span>
<span style={estilo(sg.relStyle)}>
{sg.rel}
</span>
</button>
</Fragment>
))}
{(reu.empresaNada) ? (<>
<span style={{ display: "block", padding: "10px 10px", fontSize: "12.5px", color: "#8b949e" }}>
{reu.empresaNadaTxt}
</span>
</>) : null}
</div>
</>) : null}
</div>
<div style={{ position: "relative", minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Contato
</span>
<div style={{ position: "relative" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: "12px", top: "14px", pointerEvents: "none" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={reu.pessoaIn} onChange={reu.setPessoa} onFocus={reu.focopessoa} onBlur={reu.sair} onKeyDown={reu.teclapessoa} placeholder="Buscar contato" autoComplete="off" style={estilo(reu.pessoaInp)} />
{(reu.pessoaOk) ? (<>
<button onMouseDown={reu.limparpessoa} title="Limpar" style={{ position: "absolute", right: "8px", top: "10px", width: "22px", height: "22px", borderRadius: "6px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</>) : null}
</div>
{(reu.pessoaLista) ? (<>
<div data-in="drop" style={{ marginTop: "6px", maxHeight: "220px", overflowY: "auto", padding: "4px", borderRadius: "10px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 12px 28px -12px rgba(18,23,29,.35)" }}>
{(reu.pessoaSug ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onMouseDown={sg.escolher} style={estilo(sg.style)} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "10px", fontWeight: "700" }}>
{sg.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sg.l}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sg.sub}
</span>
</span>
<span style={estilo(sg.relStyle)}>
{sg.rel}
</span>
</button>
</Fragment>
))}
{(reu.pessoaNada) ? (<>
<span style={{ display: "block", padding: "10px 10px", fontSize: "12.5px", color: "#8b949e" }}>
{reu.pessoaNadaTxt}
</span>
</>) : null}
</div>
</>) : null}
</div>
</div>
</>) : null}
</div>
</>) : null}
<div style={{ padding: "12px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: "700" }}>
{reu.iniP}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{reu.pessoa}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "12.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.email}
</span>
</span>
<button onClick={reu.abrirAdd} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Convidado
</span>
</button>
</div>
{(reu.temConv) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(reu.conv ?? []).map((cv: any, i1: number) => (
<Fragment key={cv?.id ?? cv?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 6px 0 10px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#1f252c" }}>
{cv.email}
<button onClick={cv.remover} title="Remover" style={{ width: "18px", height: "18px", borderRadius: "9999px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
</div>
</>) : null}
{(reu.addAberto) ? (<>
<div style={{ display: "flex", gap: "8px" }}>
<input value={reu.novoConv} onChange={reu.setNovo} onKeyDown={reu.teclaConv} type="email" placeholder="email@empresa.com.br" autoFocus={true} style={estilo(reu.convInp)} />
<button onClick={reu.addConv} style={{ flex: "0 0 auto", height: "42px", padding: "0 14px", borderRadius: "10px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
Adicionar
</button>
</div>
{(reu.convErro) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
E-mail inválido.
</span>
</>) : null}
</>) : null}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "16px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Data
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input type="date" value={reu.data} onChange={reu.setData} style={estilo(reu.dataInp)} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Horário
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input type="time" value={reu.hora} onChange={reu.setHora} step={900} style={estilo(reu.horaInp)} />
</label>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Duração
</span>
<div style={{ display: "flex", gap: "8px" }}>
{(reu.duracoes ?? []).map((du: any, i1: number) => (
<Fragment key={du?.id ?? du?.chave ?? i1}>
<button onClick={du.onClick} style={estilo(du.style)}>
{du.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Organizador
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "42px", padding: "0 12px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "14px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.closer}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={reu.closer} onChange={reu.setCloser} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(reu.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
</div>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Formato
</span>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{(reu.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={estilo(tp.style)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={tp.d} />
</svg>
<span>
{tp.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
{(reu.ehPresencial) ? (<>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Local
</span>
<input value={reu.local} onChange={reu.setLocal} placeholder="Endereço ou sala" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", fontSize: "14px", color: "#12171d", boxShadow: "inset 0 0 0 1px #dbdede" }} />
</label>
</>) : null}
{(reu.ehVideo) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#f6f6f3", fontSize: "12.5px", color: "#4a5560" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
{reu.linkTxt}
</span>
</span>
</>) : null}
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Título
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input value={reu.titulo} onChange={reu.setTitulo} placeholder={reu.tituloPh} style={estilo(reu.tituloInp)} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", marginBottom: "7px" }}>
Pauta
</span>
<textarea value={reu.pauta} onChange={reu.setPauta} rows={3} placeholder="O que vai ser discutido, materiais, próximos passos esperados" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", lineHeight: "1.5", color: "#12171d" }} />
</label>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "14px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<span style={{ flex: "1 1 180px", minWidth: "0", display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", color: "#4a5560" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={estilo(reu.resumoStyle)}>
{reu.resumo}
</span>
</span>
<button onClick={reu.fechar} style={{ flex: "0 0 auto", height: "42px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={reu.salvar} style={estilo(reu.salvarStyle)}>
{reu.salvarTxt}
</button>
</div>
</div>
</div>
</>) : null}
    </>
  );
}
