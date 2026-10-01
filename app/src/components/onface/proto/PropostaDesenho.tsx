"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Proposta.dc.html
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
import "./PropostaDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDePropostaDesenho {
  avancar: any;
  avancarD: any;
  avancarLabel: any;
  avancarStyle: any;
  cab: any;
  continuarEdit: any;
  corpoStyle: any;
  ct: any;
  ctRef: any;
  ctm: any;
  dec: any;
  enviado: any;
  esqRef: any;
  expandirD: any;
  expandirDica: any;
  f0: any;
  f1: any;
  f2: any;
  f3: any;
  f4: any;
  fim: any;
  herdado: any;
  irOportunidade: any;
  irPipeline: any;
  modelosP: any;
  mostraEditor: any;
  mostraPrev: any;
  mv: any;
  naoVer: any;
  p0: any;
  p1: any;
  p2: any;
  p3: any;
  p4: any;
  parar: any;
  passos: any;
  pv: any;
  resumoKpi: any;
  salvarRascunho: any;
  salvoPasso: any;
  salvoPop: any;
  salvoTxt: any;
  salvoVoltar: any;
  semO: any;
  temO: any;
  temRodape: any;
  temVistas: any;
  temVoltar: any;
  toggleExpandir: any;
  troca: any;
  ver: any;
  vistas: any;
  voltar: any;
}

export function PropostaDesenho(vals: ValoresDePropostaDesenho) {
  const { avancar, avancarD, avancarLabel, avancarStyle, cab, continuarEdit, corpoStyle, ct, ctRef, ctm, dec, enviado, esqRef, expandirD, expandirDica, f0, f1, f2, f3, f4, fim, herdado, irOportunidade, irPipeline, modelosP, mostraEditor, mostraPrev, mv, naoVer, p0, p1, p2, p3, p4, parar, passos, pv, resumoKpi, salvarRascunho, salvoPasso, salvoPop, salvoTxt, salvoVoltar, semO, temO, temRodape, temVistas, temVoltar, toggleExpandir, troca, ver, vistas, voltar } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
{(ct.aberto) ? (<>
<div onClick={ct.fechar} data-r="modal-fundo" style={{ position: "fixed", inset: "0", zIndex: "91", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div onClick={ct.parar} data-in="pop" data-comment-anchor="4d0ec2163e-div" style={{ width: "min(640px,100%)", height: "min(760px,calc(100vh - 40px))", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.45),inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "18px 20px 14px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "10px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Dados do contrato
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#4a5560", marginTop: "3px", lineHeight: "1.5", textWrap: "pretty" }}>
O que você preencher aqui fica salvo na empresa e no contato. No envio, os dados são congelados nesta versão e usados para gerar o contrato quando o cliente aceitar.
</span>
</span>
<button onClick={ct.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
<span style={estilo(ct.statusStyle)}>
{ct.status}
</span>
<span style={{ flex: "1", height: "4px", borderRadius: "9999px", background: "#eef1f1", overflow: "hidden" }}>
<span style={estilo(ct.barra)} />
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{ct.contagem}
</span>
<button onClick={ct.toggleVars} style={{ flex: "0 0 auto", height: "24px", padding: "0 8px", borderRadius: "6px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
{ct.varsTxt}
</button>
</div>
</div>
<div ref={ctRef} style={{ flex: "1", minHeight: "0", overflowY: "auto", overscrollBehavior: "contain" }}>
{(ct.grupos ?? []).map((cg: any, i1: number) => (
<Fragment key={cg?.id ?? cg?.chave ?? i1}>
<div style={{ borderTop: "1px solid #eef1f1" }}>
<button onClick={cg.toggle} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "11px 14px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={cg.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{cg.titulo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cg.sub}
</span>
</span>
<span style={estilo(cg.badgeStyle)}>
{cg.badge}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(cg.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(cg.aberto) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px", padding: "2px 14px 14px" }}>
{(cg.campos ?? []).map((cf: any, i2: number) => (
<Fragment key={cf?.id ?? cf?.chave ?? i2}>
<div style={estilo(cf.wrap)}>
<span style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
<span style={{ flex: "1", minWidth: "0", display: "flex", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560" }}>
{cf.l}
{(cf.req) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
{(cf.temTag) ? (<>
<span style={estilo(cf.tagStyle)}>
{cf.tag}
</span>
</>) : null}
</span>
{(cf.ehIn) ? (<>
<input value={cf.v} onChange={cf.set} placeholder={cf.dica} inputMode={cf.modo} style={estilo(cf.inStyle)} />
</>) : null}
{(cf.ehTexto) ? (<>
<textarea value={cf.v} onChange={cf.set} placeholder={cf.dica} rows={3} style={estilo(cf.txStyle)} />
</>) : null}
{(cf.ehSel) ? (<>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "36px", padding: "0 10px 0 11px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cf.selLabel}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={cf.v} onChange={cf.set} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(cf.opcoes ?? []).map((op: any, i3: number) => (
<Fragment key={op?.id ?? op?.chave ?? i3}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</>) : null}
{(cf.ehFixo) ? (<>
<span style={{ display: "flex", alignItems: "center", minHeight: "36px", padding: "7px 11px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #f1f3f3", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.4", textWrap: "pretty" }}>
{cf.v}
</span>
</>) : null}
{(ct.verVars) ? (<>
<span style={{ display: "block", marginTop: "4px", fontSize: "10.5px", color: "#8b949e", wordBreak: "break-all" }}>
{cf.var}
</span>
</>) : null}
</div>
</Fragment>
))}
{(cg.temIr) ? (<>
<button onClick={cg.ir} style={{ gridColumn: "1 / -1", justifySelf: "start", height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
{cg.irTxt}
</button>
</>) : null}
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#67787c", lineHeight: "1.4" }}>
{ct.rodape}
</span>
<button onClick={ct.fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
{ct.fecharTxt}
</button>
{(ct.podeEnviar) ? (<>
<button onClick={ct.enviar} style={{ display: "flex", alignItems: "center", gap: "7px", height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#2a323b")].filter(Boolean).join(" ")}>
Enviar proposta
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</>) : null}
</div>
</div>
</div>
</>) : null}
{(dec.aberto) ? (<>
<div onClick={dec.fechar} data-r="modal-fundo" style={{ position: "fixed", inset: "0", zIndex: "93", background: "rgba(18,23,29,.5)", display: "grid", placeItems: "center", padding: "20px" }}>
<div onClick={dec.parar} data-in="pop" style={{ width: "min(460px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.45),inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(dec.form) ? (<>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "22px 22px 18px", display: "grid", gap: "14px", alignContent: "start" }}>
<div>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{dec.titulo}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{dec.sub}
</span>
</div>
{(dec.ehAceite) ? (<>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
{(dec.resumo ?? []).map((dr: any, i1: number) => (
<Fragment key={dr?.id ?? dr?.chave ?? i1}>
<div style={estilo(dr.style)}>
<span style={{ flex: "1", minWidth: "0" }}>
{dr.l}
</span>
<span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{dr.v}
</span>
</div>
</Fragment>
))}
</div>
<button onClick={dec.toggleAceite} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={estilo(dec.caixa)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
<span style={{ fontSize: "12.5px", color: "#1f252c", lineHeight: "1.5" }}>
Li e concordo com os valores e as condições desta proposta.
</span>
</button>
</>) : null}
{(dec.temMotivos) ? (<>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", marginBottom: "6px" }}>
{dec.rotulo}
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<textarea value={dec.texto} onChange={dec.setTexto} placeholder={dec.dica} rows={5} style={estilo(dec.txStyle)} />
<span style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "11.5px" }}>
<span style={estilo(dec.ajudaStyle)}>
{dec.ajuda}
</span>
<span style={{ flex: "1" }} />
<span style={{ color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{dec.contagem}
</span>
</span>
</label>
</>) : null}
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={dec.fechar} style={{ height: "40px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={dec.confirmar} style={estilo(dec.btnStyle)}>
{dec.btnTxt}
</button>
</div>
</>) : null}
{(dec.feito) ? (<>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "34px 26px 26px", textAlign: "center" }}>
<span style={estilo(dec.okIco)}>
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={dec.okD} />
</svg>
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", color: "#12171d" }}>
{dec.okTitulo}
</span>
<span style={{ maxWidth: "340px", fontSize: "13px", color: "#4a5560", lineHeight: "1.55", textWrap: "pretty" }}>
{dec.okSub}
</span>
<span style={{ marginTop: "4px", padding: "8px 12px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "11.5px", color: "#67787c", lineHeight: "1.45", textWrap: "pretty" }}>
{dec.okNota}
</span>
<button onClick={dec.fechar} style={{ marginTop: "8px", height: "40px", padding: "0 18px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#2a323b")].filter(Boolean).join(" ")}>
Fechar
</button>
</div>
</>) : null}
</div>
</div>
</>) : null}
{(mv.aberto) ? (<>
<div onClick={mv.fechar} data-r="modal-fundo" style={{ position: "fixed", inset: "0", zIndex: "92", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div onClick={mv.parar} data-in="pop" style={{ width: "min(560px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.45),inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 20px 14px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "10px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{mv.titulo}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#4a5560", marginTop: "3px" }}>
{mv.sub}
</span>
</span>
<button onClick={mv.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "16px 20px" }}>
{(mv.temDoc) ? (<>
<div style={{ padding: "18px 20px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8b949e" }}>
Contrato nº · gerado no aceite
</span>
<span style={{ display: "block", marginTop: "6px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "800", lineHeight: "1.3", color: "#12171d", textWrap: "balance" }}>
{mv.docTitulo}
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "7px", marginTop: "14px" }}>
{(mv.clausulas ?? []).map((cl: any, i1: number) => (
<Fragment key={cl?.id ?? cl?.chave ?? i1}>
<span style={{ display: "flex", gap: "10px", fontSize: "12.5px", color: "#1f252c", lineHeight: "1.4" }}>
<span style={{ flex: "0 0 auto", width: "22px", fontWeight: "700", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{cl.n}
</span>
<span>
{cl.t}
</span>
</span>
</Fragment>
))}
</div>
</div>
<span style={{ display: "block", margin: "16px 0 8px", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#67787c" }}>
Variáveis que o modelo usa
</span>
<div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
{(mv.vars ?? []).map((vr: any, i1: number) => (
<Fragment key={vr?.id ?? vr?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "11px", fontWeight: "500", whiteSpace: "nowrap" }}>
{vr.t}
</span>
</Fragment>
))}
</div>
</>) : null}
{(mv.semDoc) ? (<>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "32px 20px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", textAlign: "center" }}>
<span style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#fff", color: "#8b949e", display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3-3 3 3" />
</svg>
</span>
<span style={{ fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Modelo ainda não cadastrado
</span>
<span style={{ maxWidth: "340px", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
Quando o documento for cadastrado em Configurações, a prévia com as cláusulas e as variáveis aparece aqui.
</span>
</div>
</>) : null}
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#67787c", lineHeight: "1.4" }}>
Prévia da estrutura. O texto final vem do modelo cadastrado.
</span>
<button onClick={mv.fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Fechar
</button>
<button onClick={mv.usar} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#2a323b")].filter(Boolean).join(" ")}>
{mv.usarTxt}
</button>
</div>
</div>
</div>
</>) : null}
{(ctm.aberto) ? (<>
<div onClick={ctm.fechar} data-r="modal-fundo" style={{ position: "fixed", inset: "0", zIndex: "90", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div onClick={ctm.parar} data-in="pop" style={{ width: "min(440px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.45),inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "20px 20px 0" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "11px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #f6d3c9" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 12v3M12 18h.01" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Esta proposta requer contrato
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#4a5560", marginTop: "4px", lineHeight: "1.5", textWrap: "pretty" }}>
Antes do envio, complete as informações que o ONFACE usa para gerar o contrato automaticamente quando o cliente aceitar.
</span>
</span>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "16px 20px" }}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#67787c", marginBottom: "8px" }}>
{ctm.titulo}
</span>
<div style={{ display: "flex", flexDirection: "column", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
{(ctm.itens ?? []).map((pi: any, i1: number) => (
<Fragment key={pi?.id ?? pi?.chave ?? i1}>
<div style={estilo(pi.style)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d93c1a" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{pi.l}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{pi.g}
</span>
</div>
</Fragment>
))}
</div>
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={ctm.fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={ctm.preencher} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#2a323b")].filter(Boolean).join(" ")}>
Preencher agora
</button>
</div>
</div>
</div>
</>) : null}
{(troca.aberto) ? (<>
<div onClick={troca.fechar} data-r="modal-fundo" style={{ position: "fixed", inset: "0", zIndex: "90", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div onClick={troca.parar} data-in="pop" style={{ width: "min(480px,100%)", maxHeight: "calc(100vh - 40px)", overflowY: "auto", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.45),inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 0" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Proposta de outro produto
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#4a5560", marginTop: "4px", lineHeight: "1.5", textWrap: "pretty" }}>
Cada oportunidade vende um produto. Para oferecer outro, abrimos uma oportunidade nova para a mesma empresa e a proposta nasce nela.
</span>
</span>
<button onClick={troca.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 18px 18px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "11px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={troca.famD} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
Vinculada hoje a
</span>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{troca.oppNome}
</span>
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: "600", color: "#67787c", whiteSpace: "nowrap" }}>
{troca.oppEtapa}
</span>
</div>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Novo produto
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px" }}>
{(troca.familias ?? []).map((tf: any, i1: number) => (
<Fragment key={tf?.id ?? tf?.chave ?? i1}>
<button onClick={tf.onClick} style={estilo(tf.style)}>
<span style={estilo(tf.ico)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={tf.d} />
</svg>
</span>
<span style={{ fontSize: "12.5px", fontWeight: "700" }}>
{tf.label}
</span>
<span style={{ fontSize: "11px", fontWeight: "500", color: "#8b949e" }}>
{tf.sub}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Contato responsável
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{troca.contato}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={troca.contato} onChange={troca.setContato} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(troca.contatos ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Closer
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{troca.resp}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={troca.resp} onChange={troca.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(troca.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
{(troca.temNovo) ? (<>
<div style={{ borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }} data-comment-anchor="26b1ef8010-div">
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #f6d3c9" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={troca.novoD} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
Vai ser criada no Pipeline
</span>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{troca.novoNome}
</span>
</span>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "22px", padding: "0 9px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" }}>
Entrada
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
{(troca.resumo ?? []).map((rs: any, i1: number) => (
<Fragment key={rs?.id ?? rs?.chave ?? i1}>
<div style={estilo(rs.style)}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{rs.l}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rs.v}
</span>
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa", borderRadius: "0 0 16px 16px" }}>
<button onClick={troca.fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={troca.criar} style={estilo(troca.criarStyle)}>
Criar oportunidade e proposta
</button>
</div>
</div>
</div>
</>) : null}
{(semO) ? (<>
<div style={{ flex: "1", display: "grid", placeItems: "center", padding: "24px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", color: "#12171d" }}>
Proposta sem oportunidade
</span>
<span style={{ fontSize: "13px", color: "#67787c", maxWidth: "360px", textWrap: "pretty" }}>
Toda proposta nasce de uma oportunidade. Abra a oportunidade e clique em Criar proposta.
</span>
<button onClick={irPipeline} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
Ir para o Pipeline
</button>
</div>
</div>
</>) : null}
{(temO) ? (<>
<div data-in="blur" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", padding: "14px 16px", borderBottom: "1px solid #e3e7e8", background: "#fff" }}>
<span style={{ flex: "0 0 auto", width: "46px", height: "46px", borderRadius: "11px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #f6d3c9" }}>
<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
</svg>
</span>
<div style={{ flex: "1 1 360px", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
{cab.titulo}
</span>
<span style={estilo(cab.statusStyle)}>
<span style={estilo(cab.statusDot)} />
<span>
{cab.status}
</span>
</span>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "700", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{cab.codigo}
</span>
{(cab.temBase) ? (<>
<span style={{ fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{cab.base}
</span>
</>) : null}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px 16px", flexWrap: "wrap", marginTop: "6px" }}>
{(cab.meta ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={cm.d} />
</svg>
<span style={{ color: "#67787c" }}>
{cm.label}
</span>
<span style={{ fontWeight: "600", color: "#12171d" }}>
{cm.valor}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px" }}>
<span style={estilo(cab.salvoStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d={cab.salvoD} />
</svg>
<span>
{cab.salvo}
</span>
</span>
<button onClick={irOportunidade} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span>
Ver oportunidade
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
</svg>
</button>
</div>
</div>
{(temVistas) ? (<>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "center", padding: "8px 16px", background: "#fff", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "10px", background: "#eeeff3", width: "min(360px,100%)" }}>
{(vistas ?? []).map((vw: any, i1: number) => (
<Fragment key={vw?.id ?? vw?.chave ?? i1}>
<button onClick={vw.onClick} style={estilo(vw.style)}>
{vw.label}
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
<div style={estilo(corpoStyle)}>
{(mostraEditor) ? (<>
<section style={{ minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column", background: "#fff", borderRight: "1px solid #e3e7e8" }}>
<div style={{ flex: "0 0 auto", padding: "14px 18px 12px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
{(passos ?? []).map((ps: any, i1: number) => (
<Fragment key={ps?.id ?? ps?.chave ?? i1}>
<button onClick={ps.onClick} style={{ flex: "1 1 0", minWidth: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "4px 2px", border: "0", background: "transparent", cursor: "pointer" }}>
<span style={{ display: "flex", alignItems: "center", width: "100%" }}>
<span style={estilo(ps.linhaE)} />
<span style={estilo(ps.bola)}>
{(ps.feito) ? (<>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
{(ps.erro) ? (<>
<span>
!
</span>
</>) : null}
{(ps.num) ? (<>
<span>
{ps.n}
</span>
</>) : null}
</span>
<span style={estilo(ps.linhaD)} />
</span>
<span style={estilo(ps.labelStyle)}>
{ps.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div ref={esqRef} style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", padding: "26px clamp(16px,4vw,28px) 40px" }} data-comment-anchor="b12a2dd189-div">
<div style={{ maxWidth: "660px", margin: "0 auto" }}>
{(enviado) ? (<>
<div data-in="pop" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px", padding: "26px 8px 10px" }}>
<span style={{ width: "56px", height: "56px", borderRadius: "9999px", background: "#e6f4ee", color: "#1f7256", display: "grid", placeItems: "center" }}>
<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{fim.titulo}
</span>
<span style={{ fontSize: "13px", color: "#4a5560", maxWidth: "420px", lineHeight: "1.5", textWrap: "pretty" }}>
{fim.sub}
</span>
</div>
<div style={{ display: "flex", alignItems: "flex-start", margin: "16px 0 18px" }}>
{(fim.trilha ?? []).map((ft: any, i1: number) => (
<Fragment key={ft?.id ?? ft?.chave ?? i1}>
<div style={{ flex: "1 1 0", minWidth: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
<span style={{ display: "flex", alignItems: "center", width: "100%" }}>
<span style={estilo(ft.linhaE)} />
<span style={estilo(ft.bola)} />
<span style={estilo(ft.linhaD)} />
</span>
<span style={estilo(ft.labelStyle)}>
{ft.label}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
{fim.link}
</span>
<button onClick={fim.copiar} style={{ flex: "0 0 auto", height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Copiar link
</button>
</div>
<div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "18px", flexWrap: "wrap" }}>
<button onClick={irOportunidade} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Voltar para a oportunidade
</button>
<button onClick={irPipeline} style={{ height: "38px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Ir para o Pipeline
</button>
</div>
</>) : null}
{(p0) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
<div style={{ paddingBottom: "18px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "20px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d" }}>
Dados da proposta
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
O nome que o cliente vê, quem recebe e por quanto tempo a proposta vale.
</span>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Herdado da oportunidade
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", fontWeight: "600", color: "#67787c" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
Não precisa recadastrar
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(herdado ?? []).map((hd: any, i1: number) => (
<Fragment key={hd?.id ?? hd?.chave ?? i1}>
<div style={estilo(hd.style)}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{hd.label}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{hd.valor}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{hd.sub}
</span>
</div>
</Fragment>
))}
</div>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Nome da proposta
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input value={f0.titulo} onChange={f0.setTitulo} placeholder="Ex: Implantação Callface AI · Operações" style={estilo(f0.tituloStyle)} />
</label>
<div data-comment-anchor="e91fe2e5a2-div">
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Produto
</span>
<div style={{ display: "flex", alignItems: "center", gap: "10px", height: "48px", padding: "0 8px 0 8px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={f0.famD} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
{f0.famLabel}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "#8b949e", marginTop: "1px" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
Definido pela oportunidade
</span>
</span>
<button onClick={f0.abrirTroca} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4" />
</svg>
<span>
Outro produto
</span>
</button>
</div>
</div>
<div data-comment-anchor="afdad53a27-div">
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
<span style={{ flex: "1", display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560" }}>
Quem recebe
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
{f0.destResumo}
</span>
</div>
<div style={{ borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(f0.dest ?? []).map((ds: any, i1: number) => (
<Fragment key={ds?.id ?? ds?.chave ?? i1}>
<div style={estilo(ds.linha)}>
<button onClick={ds.toggle} title={ds.dica} style={estilo(ds.check)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</button>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "11px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{ds.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ds.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ds.sub}
</span>
</span>
{(ds.ehPrincipal) ? (<>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "9999px", background: "#12171d", color: "#fff", fontSize: "11px", fontWeight: "600" }}>
Principal
</span>
</>) : null}
{(ds.podePrincipal) ? (<>
<button onClick={ds.tornar} style={{ flex: "0 0 auto", height: "26px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
Tornar principal
</button>
</>) : null}
</div>
</Fragment>
))}
{(f0.extras ?? []).map((ex: any, i1: number) => (
<Fragment key={ex?.id ?? ex?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderTop: "1px solid #eef1f1", background: "#fff" }}>
<span style={{ flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "5px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ex.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ex.valor}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{ex.tipo}
</span>
</span>
<button onClick={ex.remover} title="Remover" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 6px 5px 12px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<input value={f0.novo} onChange={f0.setNovo} onKeyDown={f0.teclaNovo} placeholder="Adicionar e-mail ou WhatsApp de outra pessoa" style={{ flex: "1", minWidth: "0", height: "30px", border: "0", outline: "0", background: "transparent", fontSize: "12.5px", color: "#12171d" }} />
{(f0.temNovo) ? (<>
<button onClick={f0.addNovo} style={{ flex: "0 0 auto", height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
Adicionar
</button>
</>) : null}
</div>
</div>
<span style={{ display: "block", marginTop: "6px", fontSize: "11.5px", color: "#8b949e", lineHeight: "1.45", textWrap: "pretty" }}>
O principal aparece na proposta e assina. Todos marcados recebem o link no envio, por e-mail ou WhatsApp.
</span>
</div>
<div>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
<span style={{ flex: "1", fontSize: "12px", fontWeight: "600", color: "#4a5560" }}>
Validade
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
{f0.validaAte}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "10px", background: "#eeeff3" }}>
{(f0.validades ?? []).map((vd: any, i1: number) => (
<Fragment key={vd?.id ?? vd?.chave ?? i1}>
<button onClick={vd.onClick} style={estilo(vd.style)}>
{vd.label}
</button>
</Fragment>
))}
</div>
</div>
</div>
</>) : null}
{(p1) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
<div style={{ paddingBottom: "18px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "20px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d" }}>
Itens e valores
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
O que o cliente está contratando. Os preços vêm do catálogo e podem ser negociados item a item.
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{(f1.itens ?? []).map((it: any, i1: number) => (
<Fragment key={it?.id ?? it?.chave ?? i1}>
<div style={estilo(it.card)}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(it.ico)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={it.d} />
</svg>
</span>
<input value={it.nome} onChange={it.setNome} placeholder="Nome do item" style={estilo(it.nomeStyle)} />
<label style={estilo(it.natStyle)}>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.natLabel}
</span>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: ".7" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={it.selVal} onChange={it.setSel} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(it.opcoes ?? []).map((na: any, i2: number) => (
<Fragment key={na?.id ?? na?.chave ?? i2}>
<option value={na.v}>
{na.l}
</option>
</Fragment>
))}
</select>
</label>
<button onClick={it.subir} title="Subir" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m18 15-6-6-6 6" />
</svg>
</button>
<button onClick={it.remover} title="Remover item" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
</svg>
</button>
</div>
<input value={it.desc} onChange={it.setDesc} placeholder="Descrição que aparece para o cliente (opcional)" style={{ display: "block", width: "100%", margin: "6px 0 0", padding: "0 0 0 38px", height: "24px", border: "0", outline: "0", background: "transparent", fontSize: "12px", color: "#4a5560" }} />
{(it.temDica) ? (<>
<span style={estilo(it.dicaStyle)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span>
{it.dica}
</span>
</span>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", paddingLeft: "38px", flexWrap: "wrap" }}>
{(it.qtdTravada) ? (<>
<div title="Acompanha a quantidade de licenças" style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 10px", borderRadius: "8px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "13px", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
<span>
{it.qtd}
</span>
</div>
</>) : null}
{(it.qtdLivre) ? (<>
<div style={{ display: "flex", alignItems: "center", height: "32px", borderRadius: "8px", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden", background: "#fff" }}>
<button onClick={it.menos} style={{ width: "28px", height: "32px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "15px", lineHeight: "1" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
−
</button>
<input value={it.qtd} onChange={it.setQtd} inputMode="numeric" style={{ width: "44px", height: "32px", border: "0", outline: "0", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums", background: "#fff" }} />
<button onClick={it.mais} style={{ width: "28px", height: "32px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "15px", lineHeight: "1" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
+
</button>
</div>
</>) : null}
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{it.unidade}
</span>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
×
</span>
<div style={estilo(it.valorCaixa)}>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
R$
</span>
<input value={it.valor} onChange={it.setValor} inputMode="decimal" placeholder="0,00" style={{ width: "84px", height: "30px", border: "0", outline: "0", background: "transparent", fontSize: "13px", fontWeight: "600", color: "#12171d", textAlign: "right", fontVariantNumeric: "tabular-nums" }} />
</div>
<span style={{ flex: "1" }} />
<span style={{ textAlign: "right" }}>
{(it.temBruto) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", textDecoration: "line-through", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.bruto}
</span>
</>) : null}
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.subtotal}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{it.subLabel}
</span>
</span>
</div>
{(it.temDescRow) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px", marginLeft: "38px", padding: "8px 8px 8px 10px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#4a5560" }}>
Desconto
</span>
<div style={{ display: "flex", gap: "2px", padding: "2px", borderRadius: "8px", background: "#eeeff3" }}>
{(it.descTipos ?? []).map((dt: any, i2: number) => (
<Fragment key={dt?.id ?? dt?.chave ?? i2}>
<button onClick={dt.onClick} style={estilo(dt.style)}>
{dt.label}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "3px", height: "30px", padding: "0 8px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede" }}>
<span style={{ fontSize: "12px", color: "#8b949e" }}>
{it.descPre}
</span>
<input value={it.descVal} onChange={it.setDescVal} inputMode="decimal" placeholder="0" style={{ width: "58px", height: "28px", border: "0", outline: "0", background: "transparent", fontSize: "13px", fontWeight: "700", color: "#12171d", textAlign: "right", fontVariantNumeric: "tabular-nums" }} />
<span style={{ fontSize: "12px", fontWeight: "600", color: "#4a5560" }}>
{it.descSuf}
</span>
</div>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.descEquiv}
</span>
<span style={{ flex: "1" }} />
<button onClick={it.tirarDesc} title="Remover desconto" style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "6px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</>) : null}
{(it.semDescRow) ? (<>
<button onClick={it.abrirDesc} style={{ display: "flex", alignItems: "center", gap: "5px", margin: "6px 0 0 34px", height: "24px", padding: "0 6px", borderRadius: "6px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#67787c", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Desconto
</span>
</button>
</>) : null}
</div>
</Fragment>
))}
{(f1.vazio) ? (<>
<div style={{ padding: "18px", borderRadius: "11px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", textAlign: "center", fontSize: "13px", color: "#4a5560" }}>
Nenhum item ainda. Comece pelo catálogo do produto.
</div>
</>) : null}
{(f1.temFixosWl) ? (<>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "11px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #f6d3c9" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#7a2a12", lineHeight: "1.5", textWrap: "pretty" }}>
{f1.fixosWlTxt}
</span>
<button onClick={f1.removerFixosWl} style={{ flex: "0 0 auto", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #f0b4a4", fontSize: "12px", fontWeight: "600", color: "#c2330f", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Remover
</button>
</div>
</>) : null}
{(f1.erroItens) ? (<>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f" }}>
Todo item precisa de nome, quantidade e valor.
</span>
</>) : null}
</div>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<button onClick={f1.toggleCat} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "14px 16px", border: "0", background: "#fff", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Adicionar item do catálogo
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "1px" }}>
{f1.catNome}
</span>
</span>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(f1.catChev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(f1.catAberto) ? (<>
<div style={{ borderTop: "1px solid #eef1f1" }}>
{(f1.catalogo ?? []).map((cg: any, i1: number) => (
<Fragment key={cg?.id ?? cg?.chave ?? i1}>
<button onClick={cg.add} title={cg.dica} style={estilo(cg.linha)} className={[hover(cg.hover)].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cg.nome}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cg.desc}
</span>
</span>
<span style={{ flex: "0 0 auto", textAlign: "right" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{cg.preco}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", marginTop: "2px", whiteSpace: "nowrap" }}>
{cg.precoSub}
</span>
</span>
<span style={estilo(cg.addStyle)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d={cg.addD} />
</svg>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
</>) : null}
{(p2) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
<div style={{ paddingBottom: "18px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "20px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d" }}>
Condições
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
Quando e como cada valor é cobrado.
</span>
</div>
{(f2.temTeste) ? (<>
<div style={estilo(f2.testeCard)} data-comment-anchor="07a2e30700-div">
<button onClick={f2.toggleTeste} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #f6d3c9" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Período de teste
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "2px", textWrap: "pretty" }}>
{f2.testeSub}
</span>
</span>
<span style={estilo(f2.testeTrilho)}>
<span style={estilo(f2.bolaT)} />
</span>
</button>
{(f2.teste) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,150px)", gap: "10px", alignItems: "center", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #eef1f1" }}>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "10px", background: "#eeeff3" }}>
{(f2.testeDias ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onClick={sg.onClick} style={estilo(sg.style)}>
{sg.label}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", height: "38px", borderRadius: "9px", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden", background: "#fff" }}>
<button onClick={f2.stTeste.menos} style={{ flex: "0 0 auto", width: "34px", height: "38px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "16px", lineHeight: "1" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
−
</button>
<input value={f2.stTeste.v} onChange={f2.stTeste.set} inputMode="numeric" style={{ flex: "1", minWidth: "0", width: "36px", height: "38px", border: "0", outline: "0", textAlign: "center", fontSize: "13.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", background: "#fff" }} />
<span style={{ flex: "0 0 auto", paddingRight: "8px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{f2.stTeste.suf}
</span>
<button onClick={f2.stTeste.mais} style={{ flex: "0 0 auto", width: "34px", height: "38px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "16px", lineHeight: "1" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
+
</button>
</div>
</div>
<div style={{ display: "flex", gap: "8px", marginTop: "10px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M2 5h20v14H2zM2 10h20M6 15h4" />
</svg>
<span>
{f2.testeNota}
</span>
</div>
</>) : null}
</div>
</>) : null}
{(f2.temSetup) ? (<>
<div style={{ padding: "14px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Setup
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{f2.setupTotal}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px" }}>
<div style={{ minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Forma
</span>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "10px", background: "#eeeff3" }}>
{(f2.setupFormas ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<button onClick={sg.onClick} style={estilo(sg.style)}>
{sg.label}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ minWidth: "0" }} data-comment-anchor="e9ea40aa47-div">
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Primeira cobrança
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f2.prazoLabel}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={f2.prazo} onChange={f2.setPrazo} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(f2.prazos ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
{(f2.temPrazoData) ? (<>
<input type="date" value={f2.prazoData} onChange={f2.setPrazoData} style={estilo(f2.prazoDataStyle)} />
</>) : null}
</div>
</div>
{(f2.parcelado) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px", alignItems: "end", marginTop: "12px" }}>
<div style={{ minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Parcelas
</span>
<div style={{ display: "flex", alignItems: "center", height: "38px", borderRadius: "9px", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden", background: "#fff" }}>
<button onClick={f2.stParc.menos} style={{ flex: "0 0 auto", width: "34px", height: "38px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "16px", lineHeight: "1" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
−
</button>
<input value={f2.stParc.v} onChange={f2.stParc.set} inputMode="numeric" style={{ flex: "1", minWidth: "0", width: "36px", height: "38px", border: "0", outline: "0", textAlign: "center", fontSize: "13.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", background: "#fff" }} />
<span style={{ flex: "0 0 auto", paddingRight: "8px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{f2.stParc.suf}
</span>
<button onClick={f2.stParc.mais} style={{ flex: "0 0 auto", width: "34px", height: "38px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "16px", lineHeight: "1" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
+
</button>
</div>
</div>
<span style={{ paddingBottom: "10px", fontSize: "12.5px", fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{f2.parcTxt}
</span>
</div>
</>) : null}
</div>
</>) : null}
<div style={{ padding: "14px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }} data-comment-anchor="bfd67da27d-div">
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Recorrência
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{f2.recTotal}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px" }}>
{(f2.naoWl) ? (<>
<div style={{ minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Início da cobrança
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f2.inicioLabel}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={f2.inicio} onChange={f2.setInicio} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(f2.inicios ?? []).map((op: any, i1: number) => (
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
<div style={{ minWidth: "0", gridColumn: "1 / -1" }} data-comment-anchor="40f6782173-div">
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
<span style={{ flex: "1" }}>
{f2.vencLabel}
</span>
<span style={{ fontWeight: "500", color: "#8b949e" }}>
{f2.vencTxt}
</span>
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "10px", background: "#eeeff3" }}>
{(f2.vencAtalhos ?? []).map((va: any, i1: number) => (
<Fragment key={va?.id ?? va?.chave ?? i1}>
<button onClick={va.onClick} style={estilo(va.style)}>
{(va.cal) ? (<>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
</>) : null}
<span>
{va.label}
</span>
</button>
</Fragment>
))}
</div>
{(f2.calAberto) ? (<>
<div data-in="fade-down" style={{ marginTop: "8px", padding: "12px", borderRadius: "11px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "8px" }}>
Escolha o dia do mês
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "4px" }}>
{(f2.calDias ?? []).map((cd: any, i1: number) => (
<Fragment key={cd?.id ?? cd?.chave ?? i1}>
<button onClick={cd.onClick} style={estilo(cd.style)} className={[hover(cd.hover)].filter(Boolean).join(" ")}>
{cd.n}
</button>
</Fragment>
))}
</div>
<span style={{ display: "block", marginTop: "8px", fontSize: "11px", color: "#8b949e", lineHeight: "1.45" }}>
Em meses mais curtos, dias 29 a 31 vencem no último dia do mês.
</span>
</div>
</>) : null}
</div>
{(f2.naoWl) ? (<>
<div style={{ minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Fidelidade
</span>
<div style={{ display: "flex", alignItems: "center", height: "38px", borderRadius: "9px", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden", background: "#fff" }}>
<button onClick={f2.stFid.menos} style={{ flex: "0 0 auto", width: "34px", height: "38px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "16px", lineHeight: "1" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
−
</button>
<input value={f2.stFid.v} onChange={f2.stFid.set} inputMode="numeric" style={{ flex: "1", minWidth: "0", width: "36px", height: "38px", border: "0", outline: "0", textAlign: "center", fontSize: "13.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", background: "#fff" }} />
<span style={{ flex: "0 0 auto", paddingRight: "8px", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{f2.stFid.suf}
</span>
<button onClick={f2.stFid.mais} style={{ flex: "0 0 auto", width: "34px", height: "38px", border: "0", background: "#fafafa", color: "#4a5560", cursor: "pointer", fontSize: "16px", lineHeight: "1" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
+
</button>
</div>
</div>
<div style={{ minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Reajuste anual
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f2.reajLabel}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={f2.reajuste} onChange={f2.setReajuste} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(f2.reajustes ?? []).map((op: any, i1: number) => (
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
</div>
{(f2.ehWl) ? (<>
<div style={{ display: "flex", gap: "8px", marginTop: "10px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
<span>
Dia em que o parceiro prefere pagar. Toda licença ativada entra na fatura desse dia.
</span>
</div>
</>) : null}
{(f2.temData) ? (<>
<div style={{ marginTop: "12px" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Data de início
</span>
<input type="date" value={f2.data} onChange={f2.setData} style={{ height: "38px", padding: "0 10px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", color: "#12171d", width: "200px" }} />
</div>
</>) : null}
</div>
{(f2.aprovacao) ? (<>
<div style={{ padding: "12px 14px", borderRadius: "12px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #f6d3c9" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", fontWeight: "700", color: "#9c3210" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
</svg>
{f2.aprovTxt}
</span>
<textarea value={f2.justif} onChange={f2.setJustif} placeholder="Justifique o desconto para quem vai aprovar" rows={2} style={estilo(f2.justifStyle)} />
</div>
</>) : null}
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Observações comerciais
</span>
<textarea value={f2.obs} onChange={f2.setObs} placeholder="Ex: Inclui suporte dedicado durante a implantação" rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.5", color: "#12171d" }} />
</label>
<div style={{ borderRadius: "12px", background: "#12171d", color: "#fff", padding: "14px 16px" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".08em", textTransform: "uppercase", color: "#a3aab0" }}>
Resumo financeiro
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px", marginTop: "10px" }}>
{(resumoKpi ?? []).map((rk: any, i1: number) => (
<Fragment key={rk?.id ?? rk?.chave ?? i1}>
<div style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", color: "#a3aab0" }}>
{rk.label}
</span>
<span style={estilo(rk.valorStyle)}>
{rk.valor}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", marginTop: "1px" }}>
{rk.sub}
</span>
</div>
</Fragment>
))}
</div>
</div>
</div>
</>) : null}
{(p3) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
<div style={{ paddingBottom: "18px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "20px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d" }}>
Contrato e pagamento
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
O que acontece quando o cliente aceitar.
</span>
</div>
<div data-comment-anchor="ad5b923aab-div">
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d", marginBottom: "10px" }}>
Como essa venda fecha
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{(f3.modelos ?? []).map((md: any, i1: number) => (
<Fragment key={md?.id ?? md?.chave ?? i1}>
<button onClick={md.onClick} style={estilo(md.style)}>
<span style={estilo(md.radio)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
{md.label}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "2px", textWrap: "pretty" }}>
{md.sub}
</span>
</span>
<span style={estilo(md.tagStyle)}>
{md.tag}
</span>
</button>
</Fragment>
))}
</div>
{(f3.soContrato) ? (<>
<span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "#67787c", textWrap: "pretty" }}>
{f3.soContratoTxt}
</span>
</>) : null}
</div>
{(f3.temContrato) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }} data-comment-anchor="fa63de0e66-div">
<div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
<span style={{ flex: "1", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
Modelo de contrato
</span>
<span style={{ fontSize: "11px", color: "#8b949e" }}>
{f3.tipoTxt}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }} data-comment-anchor="1c5288ac56-div">
{(f3.minutas ?? []).map((mn: any, i1: number) => (
<Fragment key={mn?.id ?? mn?.chave ?? i1}>
<div onClick={mn.onClick} style={estilo(mn.style)}>
<span style={estilo(mn.ico)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{mn.l}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", marginTop: "1px" }}>
{mn.s}
</span>
</span>
<button onClick={mn.ver} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
</svg>
<span>
Ver
</span>
</button>
<span style={estilo(mn.radio)} />
</div>
</Fragment>
))}
</div>
</div>
{(f3.ehAditivo) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "14px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Contrato que será aditivado
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(f3.origens ?? []).map((og: any, i1: number) => (
<Fragment key={og?.id ?? og?.chave ?? i1}>
<div onClick={og.onClick} style={estilo(og.style)}>
<span style={estilo(og.radio)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{og.t}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", marginTop: "1px" }}>
{og.s}
</span>
</span>
</div>
</Fragment>
))}
</div>
</div>
<div>
<span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Quando a alteração passa a valer
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(f3.vigencias ?? []).map((vg: any, i1: number) => (
<Fragment key={vg?.id ?? vg?.chave ?? i1}>
<div onClick={vg.onClick} style={estilo(vg.style)}>
<span style={estilo(`${vg.radio ?? ""};margin-top:1px`)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{vg.l}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "2px", lineHeight: "1.45", textWrap: "pretty" }}>
{vg.s}
</span>
</span>
</div>
</Fragment>
))}
</div>
</div>
<div style={{ padding: "4px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
{(f3.adtResumo ?? []).map((ar: any, i1: number) => (
<Fragment key={ar?.id ?? ar?.chave ?? i1}>
<div style={estilo(ar.style)}>
<span style={{ flex: "1", minWidth: "0" }}>
{ar.l}
</span>
<span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{ar.v}
</span>
</div>
</Fragment>
))}
</div>
<span style={{ display: "flex", gap: "7px", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.45" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
</svg>
<span>
{f3.adtNota}
</span>
</span>
</div>
</>) : null}
<div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
<span style={{ flex: "1", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
Assinam pelo cliente
</span>
<button onClick={f3.addSig} style={{ height: "26px", padding: "0 8px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
+ Adicionar
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(f3.sigs ?? []).map((sg: any, i1: number) => (
<Fragment key={sg?.id ?? sg?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) 26px", gap: "6px", alignItems: "center" }}>
<input value={sg.nome} onChange={sg.setNome} placeholder="Nome" style={{ height: "34px", padding: "0 10px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d", minWidth: "0" }} />
<input value={sg.email} onChange={sg.setEmail} placeholder="email@empresa.com.br" style={estilo(sg.emailStyle)} />
<button onClick={sg.remover} title="Remover" style={{ width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
</div>
{(f3.erroSig) ? (<>
<span style={{ display: "block", marginTop: "6px", fontSize: "11.5px", fontWeight: "600", color: "#c2330f" }}>
Informe ao menos um signatário com e-mail válido
</span>
</>) : null}
</div>
<div>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", marginBottom: "6px" }}>
Assinam pela Callface
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }} data-comment-anchor="00b68d6870-div">
{(f3.sigCf ?? []).map((sc: any, i1: number) => (
<Fragment key={sc?.id ?? sc?.chave ?? i1}>
<div style={{ padding: "10px 12px 12px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", fontWeight: "600", color: "#4a5560" }}>
{sc.papel}
</span>
{(sc.temReset) ? (<>
<button onClick={sc.reset} style={{ flex: "0 0 auto", height: "22px", padding: "0 7px", borderRadius: "6px", border: "0", background: "transparent", fontSize: "11px", fontWeight: "600", color: "#67787c", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
Restaurar padrão
</button>
</>) : null}
{(sc.removivel) ? (<>
<button onClick={sc.remover} title="Remover" style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "6px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</>) : null}
</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
<input value={sc.nome} onChange={sc.setNome} placeholder="Nome completo" style={{ flex: "1 1 0", minWidth: "0", height: "36px", padding: "0 11px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", color: "#12171d", flexBasis: "180px" }} />
<input value={sc.email} onChange={sc.setEmail} placeholder="email@callface.ai" type="email" style={{ flex: "1 1 0", minWidth: "0", height: "36px", padding: "0 11px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", color: "#12171d", flexBasis: "220px" }} />
</div>
</div>
</Fragment>
))}
</div>
</div>
{(f3.podeTest) ? (<>
<button onClick={f3.addTest} style={{ display: "flex", alignItems: "center", gap: "6px", alignSelf: "flex-start", height: "30px", padding: "0 10px", marginLeft: "-4px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar segunda testemunha
</span>
</button>
</>) : null}
</div>
</>) : null}
<div data-comment-anchor="7f3d282d5d-div">
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Forma de pagamento
</span>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#67787c" }}>
Cobrança pelo Stripe
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px" }}>
{(f3.formas ?? []).map((fp: any, i1: number) => (
<Fragment key={fp?.id ?? fp?.chave ?? i1}>
<button onClick={fp.onClick} title={fp.dica} style={estilo(fp.style)}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d={fp.d} />
</svg>
<span style={{ fontSize: "12px", fontWeight: "600", lineHeight: "1.25", textWrap: "balance" }}>
{fp.label}
</span>
</button>
</Fragment>
))}
</div>
<span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{f3.formaNota}
</span>
<button onClick={f3.toggleAuto} style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={estilo(f3.autoTrilho)}>
<span style={estilo(f3.autoBola)} />
</span>
<span style={{ fontSize: "12.5px", color: "#12171d" }}>
Cobrança recorrente automática da mensalidade
</span>
</button>
</div>
<div style={{ padding: "14px", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<button onClick={f3.toggleFluxo} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "1", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
Depois do aceite
</span>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{f3.fluxoResumo}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(f3.fluxoChev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(f3.fluxoAberto) ? (<>
<div style={{ marginTop: "12px" }}>
{(f3.fluxo ?? []).map((fx: any, i1: number) => (
<Fragment key={fx?.id ?? fx?.chave ?? i1}>
<div style={{ display: "flex", gap: "10px" }}>
<span style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
<span style={{ width: "22px", height: "22px", borderRadius: "9999px", background: "#fff6f4", color: "#c2330f", fontSize: "11px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{fx.n}
</span>
<span style={estilo(fx.linha)} />
</span>
<span style={{ flex: "1", minWidth: "0", padding: "2px 0 12px" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{fx.t}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", textWrap: "pretty" }}>
{fx.s}
</span>
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
</>) : null}
{(p4) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
<div style={{ paddingBottom: "18px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "20px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d" }}>
Revisão e envio
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
Confira as pendências e escolha por onde a proposta vai.
</span>
</div>
<div>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d", marginBottom: "10px" }}>
Conferência
</span>
<div style={{ borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(f4.checks ?? []).map((ck: any, i1: number) => (
<Fragment key={ck?.id ?? ck?.chave ?? i1}>
<button onClick={ck.onClick} style={estilo(ck.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(ck.bola)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
<path d={ck.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{ck.t}
</span>
<span style={estilo(ck.subStyle)}>
{ck.s}
</span>
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b8bdbb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 6 6 6-6 6" />
</svg>
</button>
</Fragment>
))}
</div>
</div>
{(ct.precisa) ? (<>
<button onClick={ct.abrir} style={estilo(ct.cartao)} className={[hover(ct.cartaoHover)].filter(Boolean).join(" ")}>
<span style={estilo(ct.cartaoIco)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ct.cartaoD} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Contrato requerido
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", marginTop: "2px", lineHeight: "1.45", textWrap: "pretty" }}>
{ct.cartaoSub}
</span>
</span>
<span style={estilo(ct.statusStyle)}>
{ct.status}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 6 6 6-6 6" />
</svg>
</button>
</>) : null}
<div data-comment-anchor="1a9e448d65-div">
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
Envio
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
Marque um ou mais canais
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginBottom: "10px" }}>
{(f4.canais ?? []).map((cn: any, i1: number) => (
<Fragment key={cn?.id ?? cn?.chave ?? i1}>
<button onClick={cn.onClick} style={estilo(cn.style)}>
<span style={estilo(cn.ico)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={cn.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
{cn.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cn.sub}
</span>
</span>
<span style={estilo(cn.check)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px 9px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", marginBottom: "14px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{f4.linkRot}
</span>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f4.link}
</span>
</span>
<button onClick={f4.copiar} style={{ flex: "0 0 auto", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Copiar
</button>
</div>
{(f4.temEmail) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", marginBottom: "12px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" />
</svg>
E-mail
</span>
<label style={{ display: "block" }} data-comment-anchor="ee44705a44-label">
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Para
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input value={f4.para} onChange={f4.setPara} placeholder="email@empresa.com.br" style={estilo(f4.paraStyle)} />
</label>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Cópia
</span>
<div style={estilo(`display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:38px;padding:5px 8px;border-radius:9px;background:#fff;box-shadow:${f4.ccBorda ?? ""}`)}>
{(f4.cc ?? []).map((cc: any, i1: number) => (
<Fragment key={cc?.id ?? cc?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "26px", padding: "0 4px 0 9px", borderRadius: "9999px", background: "#eeeff3", fontSize: "12px", fontWeight: "500", color: "#1f252c", maxWidth: "100%" }}>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cc.m}
</span>
<button onClick={cc.remover} title="Remover" style={{ flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "9999px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#dfe2e6;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
<input value={f4.ccTxt} onChange={f4.setCc} onKeyDown={f4.teclaCc} onBlur={f4.blurCc} placeholder={f4.ccDica} style={{ flex: "1", minWidth: "140px", height: "26px", border: "0", outline: "0", background: "transparent", fontSize: "13px", color: "#12171d" }} />
</div>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Assunto
</span>
<input value={f4.assunto} onChange={f4.setAssunto} style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", color: "#12171d" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Mensagem
</span>
<textarea value={f4.intro} onChange={f4.setIntro} rows={6} style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.55", color: "#12171d" }} />
</label>
<button onClick={f4.togglePrev} style={{ display: "flex", alignItems: "center", gap: "6px", alignSelf: "flex-start", height: "30px", padding: "0 10px", marginLeft: "-4px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
</svg>
<span>
{f4.prevTxt}
</span>
</button>
{(f4.prevAberto) ? (<>
<div>
<div style={{ borderRadius: "12px", background: "#eeeff3", padding: "10px" }}>
<div style={{ borderRadius: "10px", background: "#fff", overflow: "hidden", boxShadow: "0 1px 2px rgba(18,23,29,.06)" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", background: "#12171d" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "800", letterSpacing: "-.02em", color: "#fff" }}>
callface
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11px", fontWeight: "600", color: "#a3aab0", fontVariantNumeric: "tabular-nums" }}>
{f4.emailCod}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px" }}>
<span style={{ display: "block", fontSize: "13px", lineHeight: "1.6", color: "#1f252c", whiteSpace: "pre-wrap" }}>
{f4.intro}
</span>
<div style={{ borderRadius: "10px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
<div style={{ padding: "11px 14px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#c2330f" }}>
Resumo da proposta
</span>
<span style={{ display: "block", marginTop: "3px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{f4.emailTitulo}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
{(f4.emailKpis ?? []).map((ek: any, i1: number) => (
<Fragment key={ek?.id ?? ek?.chave ?? i1}>
<div style={estilo(ek.style)}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{ek.l}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ek.v}
</span>
</div>
</Fragment>
))}
</div>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(f4.emailCond ?? []).map((ec: any, i1: number) => (
<Fragment key={ec?.id ?? ec?.chave ?? i1}>
<span style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#1f252c", lineHeight: "1.45" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1f7256" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
<span>
{ec.t}
</span>
</span>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "7px", padding: "4px 0 2px" }}>
<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "42px", padding: "0 22px", borderRadius: "9px", background: "#fe4f2b", color: "#12171d", fontSize: "13.5px", fontWeight: "700" }}>
Abrir proposta
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</span>
<span style={{ fontSize: "11.5px", color: "#67787c", textAlign: "center", textWrap: "pretty" }}>
Por lá você aceita a proposta ou pede ajustes.
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "12px", borderTop: "1px solid #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{f4.assIni}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#12171d" }}>
{f4.assNome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{f4.assCargo}
</span>
</span>
</div>
</div>
</div>
<span style={{ display: "block", padding: "10px 6px 2px", fontSize: "11px", color: "#67787c", textAlign: "center", lineHeight: "1.5", textWrap: "pretty" }}>
{f4.emailValida}
</span>
</div>
</div>
</>) : null}
</div>
</>) : null}
{(f4.temWa) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", marginBottom: "12px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
</svg>
WhatsApp
</span>
<div>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
<span style={{ flex: "1" }}>
Para
</span>
{(f4.waDoCadastro) ? (<>
<span style={{ fontWeight: "500", color: "#1f7256" }}>
do cadastro do contato
</span>
</>) : null}
</span>
<div style={estilo(`display:flex;align-items:center;gap:10px;height:44px;padding:0 12px 0 8px;border-radius:10px;background:#fff;box-shadow:${f4.waBorda ?? ""}`)}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "11px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{f4.waIni}
</span>
<span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
{f4.waContato}
</span>
<input value={f4.wa} onChange={f4.setWa} placeholder="+55 11 90000-0000" inputMode="tel" style={{ flex: "1", minWidth: "0", height: "36px", border: "0", outline: "0", background: "transparent", textAlign: "right", fontSize: "13px", color: "#4a5560", fontVariantNumeric: "tabular-nums" }} />
</div>
</div>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Mensagem
</span>
<textarea value={f4.msgWa} onChange={f4.setMsgWa} rows={7} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.55", color: "#12171d" }} />
</label>
</div>
</>) : null}
{(f4.soLink) ? (<>
<div style={{ padding: "11px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
Nenhum canal marcado: a proposta é gerada e você envia o link por onde quiser. A visualização do cliente continua sendo acompanhada.
</div>
</>) : null}
</div>
{(f4.temVersoes) ? (<>
<div>
<span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Versões desta oportunidade
</span>
<div style={{ borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(f4.versoes ?? []).map((vs: any, i1: number) => (
<Fragment key={vs?.id ?? vs?.chave ?? i1}>
<div style={estilo(vs.linha)}>
<span style={estilo(vs.codStyle)}>
{vs.codigo}
</span>
<span style={estilo(vs.statusStyle)}>
{vs.status}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{vs.meta}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{vs.total}
</span>
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
</>) : null}
</div>
</div>
{(temRodape) ? (<>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fff", flexWrap: "wrap" }}>
<button onClick={salvarRascunho} style={{ display: "flex", alignItems: "center", gap: "6px", height: "38px", padding: "0 13px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8" />
</svg>
<span>
Salvar rascunho
</span>
</button>
<span style={{ flex: "1" }} />
{(temVoltar) ? (<>
<button onClick={voltar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "38px", padding: "0 13px", borderRadius: "9px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M19 12H5M11 18l-6-6 6-6" />
</svg>
<span>
Voltar
</span>
</button>
</>) : null}
<button onClick={avancar} style={estilo(avancarStyle)}>
<span>
{avancarLabel}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={avancarD} />
</svg>
</button>
</div>
</>) : null}
</section>
</>) : null}
{(mostraPrev) ? (<>
<section style={{ minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column", background: "#eeeff3" }}>
{(ver.on) ? (<>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px 14px", flexWrap: "wrap", padding: "12px 18px", borderBottom: "1px solid #e3e7e8", background: "#fff" }}>
<button onClick={ver.voltar} title="Voltar para a oportunidade" style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M19 12H5M11 18l-6-6 6-6" />
</svg>
</button>
<span style={{ flex: "1 1 240px", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{ver.codigo}
</span>
<span style={estilo(ver.stStyle)}>
{ver.status}
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "22px", padding: "0 8px", borderRadius: "9999px", background: "#eeeff3", fontSize: "11px", fontWeight: "600", color: "#4a5560" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
</svg>
Somente leitura
</span>
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ver.meta}
</span>
</span>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "3px", borderRadius: "9px", background: "#eeeff3" }}>
{(ver.modelos ?? []).map((mp: any, i1: number) => (
<Fragment key={mp?.id ?? mp?.chave ?? i1}>
<button onClick={mp.onClick} style={estilo(mp.style)}>
{mp.label}
</button>
</Fragment>
))}
</div>
{(ver.temAcao) ? (<>
<button onClick={ver.acao} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={ver.acaoD} />
</svg>
<span>
{ver.acaoTxt}
</span>
</button>
</>) : null}
</div>
</div>
</>) : null}
{(naoVer) ? (<>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderBottom: "1px solid #e3e7e8", background: "#f6f6f3" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
</svg>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap" }}>
Pré-visualização
</span>
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
atualiza enquanto você edita
</span>
<span style={{ flex: "1" }} />
<div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "3px", borderRadius: "9px", background: "#eeeff3" }}>
<span style={{ padding: "0 6px 0 7px", fontSize: "11.5px", fontWeight: "600", color: "#67787c", whiteSpace: "nowrap" }}>
Modelo
</span>
{(modelosP ?? []).map((mp: any, i1: number) => (
<Fragment key={mp?.id ?? mp?.chave ?? i1}>
<button onClick={mp.onClick} title={mp.dica} style={estilo(mp.style)}>
{mp.label}
</button>
</Fragment>
))}
</div>
<button onClick={toggleExpandir} title={expandirDica} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={expandirD} />
</svg>
</button>
</div>
</>) : null}
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "22px 18px 30px" }}>
{(pv.layA) ? (<>
<article style={{ maxWidth: "780px", margin: "0 auto", background: "#fff", borderRadius: "8px", boxShadow: "0 1px 2px rgba(18,23,29,.06),0 20px 48px -24px rgba(18,23,29,.32)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
<div style={{ height: "4px", background: "#fe4f2b" }} />
<div style={{ padding: "clamp(22px,5vw,40px) clamp(18px,5vw,40px) 30px", display: "flex", flexDirection: "column", gap: "26px" }}>
<div style={estilo(pv.sec0)}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
<img src="/proto/callface-logo.png" alt="Callface" style={{ display: "block", height: "32px", width: "auto" }} />
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
Telefonia em nuvem, IA e discagem
</span>
</div>
<div style={{ display: "flex", alignItems: "flex-end", gap: "20px", marginTop: "30px", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 280px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".14em", textTransform: "uppercase", color: "#c2330f" }}>
Proposta comercial
</span>
<span style={{ display: "block", marginTop: "8px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "27px", fontWeight: "800", letterSpacing: "-.03em", color: "#12171d", lineHeight: "1.12", textWrap: "balance" }}>
{pv.titulo}
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "12.5px", color: "#67787c" }}>
{pv.familia}
</span>
</div>
<div style={{ flex: "1 1 200px", maxWidth: "320px", minWidth: "0", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
{(pv.meta ?? []).map((pm: any, i1: number) => (
<Fragment key={pm?.id ?? pm?.chave ?? i1}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "7px 14px", fontSize: "11.5px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ color: "#67787c" }}>
{pm.l}
</span>
<span style={{ fontWeight: "600", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{pm.v}
</span>
</div>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1px", marginTop: "24px", borderRadius: "10px", background: "#eef1f1", overflow: "hidden", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ minWidth: "0", padding: "14px 16px", background: "#fafafa" }}>
<span style={{ display: "block", fontSize: "10px", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "#8b949e" }}>
Cliente
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{pv.empresa}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#67787c" }}>
{pv.empresaSub}
</span>
</div>
<div style={{ minWidth: "0", padding: "14px 16px", background: "#fafafa" }}>
<span style={{ display: "block", fontSize: "10px", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "#8b949e" }}>
A/C
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{pv.contato}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#67787c", lineHeight: "1.5" }}>
{pv.contatoSub}
</span>
</div>
</div>
</div>
<div style={estilo(pv.sec1)}>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f", fontVariantNumeric: "tabular-nums" }}>
01
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Escopo e investimento
</span>
</div>
<div style={{ borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 16px", background: "#12171d", color: "#fff", fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase" }}>
<span>
Descrição
</span>
<span>
Valor
</span>
</div>
{(pv.grupos ?? []).map((pg: any, i1: number) => (
<Fragment key={pg?.id ?? pg?.chave ?? i1}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", background: "#fafafa", borderTop: "1px solid #eef1f1", borderBottom: "1px solid #eef1f1" }}>
<span style={{ width: "6px", height: "6px", borderRadius: "2px", background: "#fe4f2b" }} />
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#4a5560" }}>
{pg.label}
</span>
</div>
{(pg.itens ?? []).map((pi: any, i2: number) => (
<Fragment key={pi?.id ?? pi?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "6px 16px", flexWrap: "wrap", padding: "12px 16px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ flex: "1 1 220px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{pi.nome}
</span>
{(pi.temDesc) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", marginTop: "2px", lineHeight: "1.4" }}>
{pi.desc}
</span>
</>) : null}
</span>
<span style={{ flex: "0 0 auto", marginLeft: "auto", textAlign: "right" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pi.sub}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pi.qtd} × {pi.unit}
</span>
</span>
</div>
</Fragment>
))}
</div>
</Fragment>
))}
{(pv.semItens) ? (<>
<div style={{ padding: "22px 14px", fontSize: "12px", color: "#a3a8a4", textAlign: "center" }}>
Os itens aparecem aqui conforme você adiciona.
</div>
</>) : null}
</div>
</div>
<div style={estilo(pv.sec2)}>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f", fontVariantNumeric: "tabular-nums" }}>
02
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Condições e resumo financeiro
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "14px" }}>
<div style={{ minWidth: "0", padding: "6px 16px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
{(pv.condicoes ?? []).map((pc: any, i1: number) => (
<Fragment key={pc?.id ?? pc?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,104px) minmax(0,1fr)", gap: "10px", padding: "9px 0", borderBottom: "1px solid #f3f5f5", fontSize: "11.5px", lineHeight: "1.45" }}>
<span style={{ color: "#67787c" }}>
{pc.l}
</span>
<span style={{ color: "#12171d", fontWeight: "600", textWrap: "pretty" }}>
{pc.v}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ minWidth: "0", display: "flex", flexDirection: "column", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ padding: "12px 16px 10px" }}>
{(pv.fin ?? []).map((pf: any, i1: number) => (
<Fragment key={pf?.id ?? pf?.chave ?? i1}>
<div style={estilo(pf.style)}>
<span>
{pf.l}
</span>
<span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pf.v}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "14px 16px", background: "#12171d", color: "#fff" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#a3aab0" }}>
{pv.totalLabel}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", fontWeight: "500", letterSpacing: "0", textTransform: "none", color: "#a3aab0", textWrap: "pretty" }}>
{pv.totalSub}
</span>
</span>
<span style={{ flex: "0 0 auto", textAlign: "right" }}>
{(pv.temTotalBruto) ? (<>
<span style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#8b949e", textDecoration: "line-through", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pv.totalBruto}
</span>
</>) : null}
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "20px", fontWeight: "800", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "#fff" }}>
{pv.total}
</span>
</span>
</div>
</div>
</div>
{(pv.temObs) ? (<>
<div style={{ marginTop: "12px", padding: "12px 16px", borderRadius: "10px", background: "#fafafa", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.6", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
<span style={{ fontWeight: "700", color: "#12171d" }}>
Observações: 
</span>
{pv.obs}
</div>
</>) : null}
</div>
<div style={estilo(pv.sec3)}>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f", fontVariantNumeric: "tabular-nums" }}>
03
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Fechamento
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "10px" }}>
{(pv.fecho ?? []).map((pz: any, i1: number) => (
<Fragment key={pz?.id ?? pz?.chave ?? i1}>
<div style={{ minWidth: "0", padding: "12px 14px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ display: "block", fontSize: "10.5px", color: "#8b949e" }}>
{pz.l}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "12px", fontWeight: "600", color: "#12171d", lineHeight: "1.4", textWrap: "pretty" }}>
{pz.v}
</span>
</div>
</Fragment>
))}
</div>
</div>
<div style={estilo(pv.sec4)}>
<div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", padding: "18px 20px", borderRadius: "12px", boxShadow: "inset 0 0 0 1.5px #12171d" }}>
<span style={{ flex: "1 1 240px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{pv.decTitulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{pv.posAceite}
</span>
</span>
<div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
<button onClick={pv.ajuste} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", height: "44px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", fontSize: "13px", fontWeight: "600", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Pedir ajuste
</button>
<button onClick={pv.recusar} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", height: "44px", padding: "0 14px", borderRadius: "10px", border: "0", background: "transparent", color: "#67787c", fontSize: "13px", fontWeight: "600", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
Recusar
</button>
<button onClick={pv.aceitar} style={{ flex: "1 0 auto", maxWidth: "240px", display: "inline-flex", alignItems: "center", justifyContent: "center", height: "44px", padding: "0 20px", borderRadius: "10px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "13.5px", fontWeight: "700", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Aceitar proposta
</button>
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px 16px", flexWrap: "wrap", paddingTop: "16px", borderTop: "1px solid #eef1f1" }}>
<span style={{ flex: "1 1 260px", minWidth: "0", fontSize: "10.5px", color: "#8b949e", lineHeight: "1.6" }}>
CALLFACE SOFTWARE E SERVIÇOS LTDA. · CNPJ 39.764.520/0001-06 · callface.ai
<br />
Dúvidas: {pv.vendSub}
</span>
<span style={{ fontSize: "10px", color: "#8b949e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pv.rodape}
</span>
</div>
</div>
</article>
</>) : null}
{(pv.layB) ? (<>
<article style={{ maxWidth: "1140px", margin: "0 auto", background: "#fff", borderRadius: "12px", boxShadow: "0 1px 2px rgba(18,23,29,.06),0 24px 56px -26px rgba(18,23,29,.36)", overflow: "hidden" }}>
<div style={estilo(pv.sec0)}>
<div style={{ padding: "clamp(24px,5vw,44px) clamp(20px,6vw,64px) clamp(32px,5vw,52px)", background: "#12171d", color: "#fff" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<span style={{ display: "inline-flex", alignItems: "center", padding: "7px 12px", borderRadius: "9px", background: "#fff" }}>
<img src="/proto/callface-logo.png" alt="Callface" style={{ display: "block", height: "22px", width: "auto" }} />
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11.5px", color: "#a3aab0", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pv.codigoTxt}
</span>
</div>
<span style={{ display: "block", marginTop: "clamp(36px,6vw,64px)", fontSize: "12px", fontWeight: "700", letterSpacing: ".14em", textTransform: "uppercase", color: "#ff8a70" }}>
{pv.para}
</span>
<span style={{ display: "block", marginTop: "10px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,5vw,46px)", fontWeight: "800", letterSpacing: "-.04em", lineHeight: "1.05", textWrap: "balance", maxWidth: "760px" }}>
{pv.titulo}
</span>
<span style={{ display: "block", marginTop: "14px", fontSize: "15px", color: "#a3aab0", lineHeight: "1.5" }}>
A/C {pv.contato} · {pv.validaTxt}
</span>
</div>
</div>
<div style={{ display: "flex", flexWrap: "wrap" }}>
<div style={{ flex: "999 1 460px", minWidth: "0", padding: "clamp(28px,5vw,52px) clamp(20px,5vw,56px) clamp(32px,5vw,56px)" }}>
<div style={estilo(pv.sec1)}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(19px,2.4vw,22px)", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
O que está incluído
</span>
{(pv.grupos ?? []).map((pg: any, i1: number) => (
<Fragment key={pg?.id ?? pg?.chave ?? i1}>
<div style={{ marginTop: "22px" }}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "#c2330f", marginBottom: "6px" }}>
{pg.label}
</span>
{(pg.itens ?? []).map((pi: any, i2: number) => (
<Fragment key={pi?.id ?? pi?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "6px 20px", flexWrap: "wrap", padding: "16px 0", borderBottom: "1px solid #f1f3f3" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "15px", fontWeight: "600", color: "#12171d" }}>
{pi.nome}
</span>
{(pi.temDesc) ? (<>
<span style={{ display: "block", fontSize: "13px", color: "#67787c", marginTop: "3px", lineHeight: "1.5" }}>
{pi.desc}
</span>
</>) : null}
</span>
<span style={{ flex: "0 0 auto", marginLeft: "auto", textAlign: "right" }}>
<span style={{ display: "block", fontSize: "15px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pi.sub}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#8b949e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pi.qtd} × {pi.unit}
</span>
</span>
</div>
</Fragment>
))}
</div>
</Fragment>
))}
{(pv.semItens) ? (<>
<div style={{ marginTop: "14px", padding: "18px", borderRadius: "10px", background: "#fafafa", fontSize: "12px", color: "#8b949e", textAlign: "center" }}>
Os itens aparecem aqui conforme você adiciona.
</div>
</>) : null}
</div>
<div style={estilo(pv.sec2)}>
<span style={{ display: "block", marginTop: "44px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(19px,2.4vw,22px)", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Condições
</span>
<div style={{ marginTop: "8px" }}>
{(pv.condicoes ?? []).map((pc: any, i1: number) => (
<Fragment key={pc?.id ?? pc?.chave ?? i1}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "4px 24px", flexWrap: "wrap", padding: "14px 0", borderBottom: "1px solid #f1f3f3", fontSize: "14px" }}>
<span style={{ color: "#67787c" }}>
{pc.l}
</span>
<span style={{ color: "#12171d", fontWeight: "600", textWrap: "pretty" }}>
{pc.v}
</span>
</div>
</Fragment>
))}
</div>
{(pv.temObs) ? (<>
<div style={{ marginTop: "18px", fontSize: "13.5px", color: "#4a5560", lineHeight: "1.6", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
<span style={{ fontWeight: "700", color: "#12171d" }}>
Observações: 
</span>
{pv.obs}
</div>
</>) : null}
</div>
</div>
<div style={{ flex: "1 1 340px", minWidth: "0", maxWidth: "100%", background: "#fafafa", boxShadow: "inset 1px 0 0 #eef1f1,inset 0 1px 0 #eef1f1" }}>
<div style={{ position: "sticky", top: "0", padding: "clamp(28px,5vw,48px) clamp(20px,4vw,40px)" }}>
<div style={estilo(pv.sec3)}>
<span style={{ display: "block", fontSize: "12px", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "#8b949e" }}>
Investimento
</span>
<span style={{ display: "flex", alignItems: "baseline", gap: "3px", marginTop: "8px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(30px,3.6vw,38px)", fontWeight: "800", letterSpacing: "-.035em", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pv.mensal}
</span>
<span style={{ fontSize: "14px", fontWeight: "600", color: "#67787c" }}>
{pv.mensalSuf}
</span>
</span>
{(pv.temMensalNota) ? (<>
<span style={{ display: "block", marginTop: "10px", fontSize: "13px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{pv.mensalNota}
</span>
</>) : null}
<div style={{ marginTop: "22px", display: "flex", flexDirection: "column", gap: "4px" }}>
{(pv.fin ?? []).map((pf: any, i1: number) => (
<Fragment key={pf?.id ?? pf?.chave ?? i1}>
<div style={estilo(pf.style)}>
<span>
{pf.l}
</span>
<span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pf.v}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", marginTop: "18px", padding: "16px 18px", borderRadius: "12px", background: "#12171d", color: "#fff" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#a3aab0" }}>
{pv.totalLabel}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", fontWeight: "500", letterSpacing: "0", textTransform: "none", color: "#a3aab0", textWrap: "pretty" }}>
{pv.totalSub}
</span>
</span>
<span style={{ flex: "0 0 auto", textAlign: "right" }}>
{(pv.temTotalBruto) ? (<>
<span style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#8b949e", textDecoration: "line-through", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pv.totalBruto}
</span>
</>) : null}
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "800", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "#fff" }}>
{pv.total}
</span>
</span>
</div>
</div>
<div style={estilo(pv.sec4)}>
<div style={{ display: "grid", gap: "10px", marginTop: "26px" }}>
<button onClick={pv.aceitar} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "48px", borderRadius: "10px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "14px", fontWeight: "700", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Aceitar proposta
</button>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "6px" }}>
<button onClick={pv.ajuste} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "42px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", fontSize: "13px", fontWeight: "600", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Pedir ajuste
</button>
<button onClick={pv.recusar} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "42px", borderRadius: "10px", border: "0", background: "transparent", boxShadow: "inset 0 0 0 1px #eef1f1", color: "#67787c", fontSize: "13px", fontWeight: "600", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
Recusar
</button>
</div>
</div>
<span style={{ display: "block", marginTop: "14px", fontSize: "13px", color: "#67787c", lineHeight: "1.55", textWrap: "pretty" }}>
{pv.posAceite}
</span>
</div>
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "18px clamp(20px,6vw,64px)", borderTop: "1px solid #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "11.5px", color: "#8b949e", lineHeight: "1.6" }}>
CALLFACE SOFTWARE E SERVIÇOS LTDA. · CNPJ 39.764.520/0001-06 · callface.ai · Dúvidas: {pv.vendSub}
</span>
</div>
</article>
</>) : null}
{(pv.layC) ? (<>
<article style={{ maxWidth: "660px", margin: "0 auto", background: "#fff", borderRadius: "12px", boxShadow: "0 1px 2px rgba(18,23,29,.06),0 20px 48px -26px rgba(18,23,29,.3)", padding: "clamp(24px,6vw,44px) clamp(18px,6vw,48px) 34px" }}>
<div style={estilo(pv.sec0)}>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<img src="/proto/callface-logo.png" alt="Callface" style={{ display: "block", height: "28px", width: "auto" }} />
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{pv.validaTxt}
</span>
</div>
<span style={{ display: "block", marginTop: "40px", fontSize: "12.5px", color: "#67787c" }}>
{pv.para} · A/C {pv.contato}
</span>
<span style={{ display: "block", marginTop: "8px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(26px,6vw,36px)", fontWeight: "800", letterSpacing: "-.04em", lineHeight: "1.05", color: "#12171d", textWrap: "balance" }}>
{pv.titulo}
</span>
<div style={{ display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap", marginTop: "22px", paddingBottom: "26px", borderBottom: "1px solid #eef1f1" }}>
<span style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "30px", fontWeight: "800", letterSpacing: "-.03em", color: "#c2330f", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pv.mensal}
</span>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#67787c" }}>
{pv.mensalSuf}
</span>
</span>
<span style={{ fontSize: "13px", color: "#4a5560" }}>
Setup {pv.setupV}
</span>
</div>
{(pv.temMensalNota) ? (<>
<span style={{ display: "block", marginTop: "-12px", paddingBottom: "22px", borderBottom: "1px solid #eef1f1", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.55", textWrap: "pretty" }}>
{pv.mensalNota}
</span>
</>) : null}
</div>
<div style={estilo(pv.sec1)}>
<span style={{ display: "block", marginTop: "26px", fontSize: "11px", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "#8b949e" }}>
Incluído
</span>
{(pv.grupos ?? []).map((pg: any, i1: number) => (
<Fragment key={pg?.id ?? pg?.chave ?? i1}>
<div style={{ marginTop: "14px" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "#c2330f", marginBottom: "4px" }}>
{pg.label}
</span>
{(pg.itens ?? []).map((pi: any, i2: number) => (
<Fragment key={pi?.id ?? pi?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "4px 14px", flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid #f1f3f3" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{pi.nome}
</span>
{(pi.temDesc) ? (<>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "2px", lineHeight: "1.4" }}>
{pi.desc}
</span>
</>) : null}
</span>
<span style={{ flex: "0 0 auto", marginLeft: "auto", textAlign: "right" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pi.sub}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#8b949e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pi.qtd} × {pi.unit}
</span>
</span>
</div>
</Fragment>
))}
</div>
</Fragment>
))}
</div>
<div style={estilo(pv.sec2)}>
<span style={{ display: "block", marginTop: "28px", fontSize: "11px", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "#8b949e" }}>
Condições
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px 24px", marginTop: "12px" }}>
{(pv.condicoes ?? []).map((pc: any, i1: number) => (
<Fragment key={pc?.id ?? pc?.chave ?? i1}>
<div style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e" }}>
{pc.l}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{pc.v}
</span>
</div>
</Fragment>
))}
</div>
</div>
<div style={estilo(pv.sec3)}>
<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginTop: "30px", padding: "18px 0", borderTop: "1.5px solid #12171d", borderBottom: "1px solid #eef1f1" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
{pv.totalLabel}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", fontWeight: "500", letterSpacing: "0", textTransform: "none", color: "#4a5560", textWrap: "pretty" }}>
{pv.totalSub}
</span>
</span>
<span style={{ flex: "0 0 auto", textAlign: "right" }}>
{(pv.temTotalBruto) ? (<>
<span style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#8b949e", textDecoration: "line-through", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pv.totalBruto}
</span>
</>) : null}
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "24px", fontWeight: "800", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "#12171d" }}>
{pv.total}
</span>
</span>
</div>
</div>
<div style={estilo(pv.sec4)}>
<div style={{ display: "grid", gap: "8px", maxWidth: "360px", margin: "28px auto 0" }}>
<button onClick={pv.aceitar} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "48px", borderRadius: "10px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "14px", fontWeight: "700", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Aceitar proposta
</button>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "6px" }}>
<button onClick={pv.ajuste} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "42px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", fontSize: "13px", fontWeight: "600", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Pedir ajuste
</button>
<button onClick={pv.recusar} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "42px", borderRadius: "10px", border: "0", background: "transparent", boxShadow: "inset 0 0 0 1px #eef1f1", color: "#67787c", fontSize: "13px", fontWeight: "600", lineHeight: "1", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
Recusar
</button>
</div>
</div>
<span style={{ display: "block", marginTop: "10px", fontSize: "12px", color: "#67787c", textAlign: "center", lineHeight: "1.5", textWrap: "pretty" }}>
{pv.posAceite}
</span>
</div>
<span style={{ display: "block", marginTop: "34px", fontSize: "10px", color: "#a3aab0", textAlign: "center", lineHeight: "1.6" }}>
CALLFACE SOFTWARE E SERVIÇOS LTDA. · CNPJ 39.764.520/0001-06 · callface.ai
<br />
Dúvidas: {pv.vendSub}
</span>
</article>
</>) : null}
</div>
</section>
</>) : null}
</div>
</>) : null}
</div>
{(salvoPop) ? (<>
<div data-r="modal-fundo" onClick={continuarEdit} style={{ position: "fixed", inset: "0", zIndex: "70", background: "rgba(9,14,20,.45)", display: "grid", placeItems: "center", padding: "20px" }}>
<div onClick={parar} data-in="pop" style={{ width: "420px", maxWidth: "100%", background: "#fff", borderRadius: "14px", boxShadow: "0 24px 64px rgba(18,23,29,.28)", padding: "26px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
<span style={{ width: "48px", height: "48px", borderRadius: "9999px", background: "#fff6f4", color: "#fe4f2b", display: "grid", placeItems: "center" }}>
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
<span style={{ marginTop: "14px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Rascunho salvo
</span>
<span style={{ marginTop: "6px", fontSize: "13px", color: "#4a5560", lineHeight: "1.55", textWrap: "pretty" }}>
{salvoTxt}
</span>
<span style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", height: "24px", padding: "0 9px", borderRadius: "9999px", background: "#eeeff3", fontSize: "11.5px", fontWeight: "600", color: "#4a5560" }}>
{salvoPasso}
</span>
<div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "22px", flexWrap: "wrap" }}>
<button onClick={salvoVoltar} style={{ flex: "1 1 150px", display: "flex", alignItems: "center", justifyContent: "center", height: "40px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Voltar para a oportunidade
</button>
<button onClick={continuarEdit} style={{ flex: "1 1 150px", display: "flex", alignItems: "center", justifyContent: "center", height: "40px", borderRadius: "9px", border: "0", background: "#fe4f2b", fontSize: "13px", fontWeight: "700", color: "#fff", cursor: "pointer" }} className={[hover("background:#ff6a4a")].filter(Boolean).join(" ")}>
Continuar editando
</button>
</div>
</div>
</div>
</>) : null}
    </>
  );
}
