"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Tags Oportunidade.dc.html
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
export interface ValoresDeTagsOportunidadeDesenho {
  aberto: any;
  alcance: any;
  aplicar: any;
  auto: any;
  busca: any;
  buscaLimpa: any;
  comEmp: any;
  comPes: any;
  criar: any;
  empCaixa: any;
  empStyle: any;
  empresa: any;
  fechar: any;
  nada: any;
  org: any;
  parar: any;
  pesBox: any;
  pesCaixa: any;
  pesRotulo: any;
  pessoa: any;
  pessoas: any;
  podeCriar: any;
  resumo: any;
  setBusca: any;
  setPessoa: any;
  sub: any;
  tecla: any;
  temAuto: any;
  temEmp: any;
  temOrg: any;
  temPes: any;
  tiposNova: any;
  titulo: any;
  togEmp: any;
  togPes: any;
}

export function TagsOportunidadeDesenho(vals: ValoresDeTagsOportunidadeDesenho) {
  const { aberto, alcance, aplicar, auto, busca, buscaLimpa, comEmp, comPes, criar, empCaixa, empStyle, empresa, fechar, nada, org, parar, pesBox, pesCaixa, pesRotulo, pessoa, pessoas, podeCriar, resumo, setBusca, setPessoa, sub, tecla, temAuto, temEmp, temOrg, temPes, tiposNova, titulo, togEmp, togPes } = vals;
  return (
    <>
{(aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "66", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(600px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "20px 22px 14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "11px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sub}
</span>
</span>
<button onClick={fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "0 22px 18px", display: "flex", flexDirection: "column", gap: "18px" }}>
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Aplicar também em
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "8px" }}>
{(temEmp) ? (<>
<button onClick={togEmp} style={estilo(empStyle)}>
<span style={estilo(empCaixa)}>
{(comEmp) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
Empresa
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{empresa}
</span>
</span>
</button>
</>) : null}
{(temPes) ? (<>
<div style={estilo(pesBox)}>
<button onClick={togPes} style={{ flex: "0 0 auto", border: "0", background: "transparent", padding: "0", cursor: "pointer", display: "grid", placeItems: "center" }}>
<span style={estilo(pesCaixa)}>
{(comPes) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
</button>
<label style={{ position: "relative", flex: "1", minWidth: "0", cursor: "pointer" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{pesRotulo}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "1px" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pessoa}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</span>
<select value={pessoa} onChange={setPessoa} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(pessoas ?? []).map((op: any, i1: number) => (
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
<span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{alcance}
</span>
</div>
<div style={{ position: "relative" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "13px" }}>
<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
</svg>
<input value={busca} onChange={setBusca} onKeyDown={tecla} placeholder="Buscar ou criar tag" style={{ width: "100%", height: "42px", padding: "0 12px 0 36px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "14px", color: "#12171d" }} />
</div>
{(podeCriar) ? (<>
<div style={{ padding: "12px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", display: "flex", flexDirection: "column", gap: "10px" }}>
<span style={{ fontSize: "13px", color: "#1f252c" }}>
Criar a tag 
<strong style={{ fontWeight: "700" }}>
“{buscaLimpa}”
</strong>
</span>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{(tiposNova ?? []).map((tn: any, i1: number) => (
<Fragment key={tn?.id ?? tn?.chave ?? i1}>
<button onClick={tn.onClick} style={estilo(tn.style)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={tn.d} />
</svg>
<span style={{ textAlign: "left" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "700" }}>
{tn.l}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", fontWeight: "500", opacity: ".8" }}>
{tn.s}
</span>
</span>
</button>
</Fragment>
))}
</div>
<button onClick={criar} style={{ alignSelf: "flex-start", height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>
Criar e aplicar
</button>
</div>
</>) : null}
{(temAuto) ? (<>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
<span style={{ fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560", whiteSpace: "nowrap" }}>
Disparam automação
</span>
</div>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #eef1f1", overflow: "hidden" }}>
{(auto ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(t.caixa)}>
{(t.on) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontSize: "13.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
{t.nome}
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "20px", padding: "0 7px", borderRadius: "9999px", background: "#fff6f4", color: "#c2330f", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
{t.agente}
</span>
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#67787c", lineHeight: "1.45", textWrap: "pretty" }}>
{t.efeito}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
{(temOrg) ? (<>
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Organização
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(org ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.chip)}>
{(t.on) ? (<>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
<span>
{t.nome}
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
{(nada) ? (<>
<span style={{ fontSize: "12.5px", color: "#8b949e" }}>
Nenhuma tag encontrada.
</span>
</>) : null}
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "14px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<span style={{ flex: "1 1 200px", minWidth: "0", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
{resumo}
</span>
<button onClick={fechar} style={{ flex: "0 0 auto", height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={aplicar} style={{ flex: "0 0 auto", whiteSpace: "nowrap", height: "40px", padding: "0 18px", borderRadius: "10px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Aplicar tags
</button>
</div>
</div>
</div>
</>) : null}
    </>
  );
}
