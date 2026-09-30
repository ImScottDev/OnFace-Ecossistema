"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Iniciar Relacao.dc.html
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
export interface ValoresDeIniciarRelacaoDesenho {
  aberto: any;
  avancar: any;
  avancarStyle: any;
  avancarTxt: any;
  cadencias: any;
  caminhos: any;
  contatos: any;
  efeitos: any;
  ehOpp: any;
  ehPv: any;
  equipe: any;
  erro: any;
  etapas: any;
  familias: any;
  fechar: any;
  interesses: any;
  lbl: any;
  motivo: any;
  motivoStyle: any;
  origens: any;
  p1: any;
  p2: any;
  p3: any;
  parar: any;
  passos: any;
  relAlvo: any;
  relDe: any;
  relDeStyle: any;
  relMantem: any;
  relMuda: any;
  relPara: any;
  resp: any;
  selBox: any;
  setMotivo: any;
  setResp: any;
  sub: any;
  temAvancar: any;
  temErro: any;
  temVoltar: any;
  tipos: any;
  titulo: any;
  voltar: any;
}

export function IniciarRelacaoDesenho(vals: ValoresDeIniciarRelacaoDesenho) {
  const { aberto, avancar, avancarStyle, avancarTxt, cadencias, caminhos, contatos, efeitos, ehOpp, ehPv, equipe, erro, etapas, familias, fechar, interesses, lbl, motivo, motivoStyle, origens, p1, p2, p3, parar, passos, relAlvo, relDe, relDeStyle, relMantem, relMuda, relPara, resp, selBox, setMotivo, setResp, sub, temAvancar, temErro, temVoltar, tipos, titulo, voltar } = vals;
  return (
    <>
{(aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "66", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(640px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "20px 22px 14px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "11px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
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
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px" }}>
{(passos ?? []).map((ps: any, i1: number) => (
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
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "18px 22px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
{(p1) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
{(caminhos ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<button onClick={cm.onClick} style={estilo(cm.style)}>
<span style={estilo(cm.ico)}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={cm.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontSize: "14.5px", fontWeight: "700", color: "#12171d" }}>
{cm.l}
</span>
<span style={estilo(cm.relStyle)}>
{cm.rel}
</span>
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{cm.s}
</span>
<span style={{ display: "block", marginTop: "6px", fontSize: "11.5px", color: "#8b949e" }}>
{cm.quando}
</span>
</span>
{(cm.bloqueado) ? (<>
<span style={{ flex: "0 0 auto", alignSelf: "center", height: "22px", padding: "0 8px", borderRadius: "9999px", background: "#eeeff3", color: "#67787c", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center" }}>
Em breve
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
{(p2) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<span style={estilo(lbl)}>
Contato
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(contatos ?? []).map((ct: any, i1: number) => (
<Fragment key={ct?.id ?? ct?.chave ?? i1}>
<button onClick={ct.onClick} style={estilo(ct.style)}>
<span style={estilo(ct.radio)} />
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "700" }}>
{ct.ini}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{ct.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ct.cargo}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
{(ehPv) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<span style={estilo(lbl)}>
Origem
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(origens ?? []).map((og: any, i1: number) => (
<Fragment key={og?.id ?? og?.chave ?? i1}>
<button onClick={og.onClick} style={estilo(og.style)}>
{og.l}
</button>
</Fragment>
))}
</div>
<span style={{ display: "block", marginTop: "6px", fontSize: "11.5px", color: "#8b949e" }}>
Pré-vendas recebe só inbound. Para outbound, use Prospecção.
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px" }}>
<div>
<span style={estilo(lbl)}>
Entra em
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(etapas ?? []).map((et: any, i1: number) => (
<Fragment key={et?.id ?? et?.chave ?? i1}>
<button onClick={et.onClick} style={estilo(et.style)}>
{et.l}
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={estilo(lbl)}>
Responsável (SDR)
</span>
<label style={estilo(selBox)}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13.5px", color: "#12171d" }}>
{resp}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={resp} onChange={setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(equipe ?? []).map((op: any, i1: number) => (
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
<span style={estilo(lbl)}>
Interesse
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(interesses ?? []).map((it: any, i1: number) => (
<Fragment key={it?.id ?? it?.chave ?? i1}>
<button onClick={it.onClick} style={estilo(it.style)}>
{it.l}
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={estilo(lbl)}>
Cadência
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(cadencias ?? []).map((cd: any, i1: number) => (
<Fragment key={cd?.id ?? cd?.chave ?? i1}>
<button onClick={cd.onClick} style={estilo(cd.style)}>
{cd.l}
</button>
</Fragment>
))}
</div>
</div>
</div>
</>) : null}
{(ehOpp) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<span style={estilo(lbl)}>
Tipo
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={estilo(tp.style)}>
{tp.l}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px" }}>
<div>
<span style={estilo(lbl)}>
Produto
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(familias ?? []).map((fm: any, i1: number) => (
<Fragment key={fm?.id ?? fm?.chave ?? i1}>
<button onClick={fm.onClick} style={estilo(fm.style)}>
{fm.l}
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={estilo(lbl)}>
Closer
</span>
<label style={estilo(selBox)}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13.5px", color: "#12171d" }}>
{resp}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
<select value={resp} onChange={setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(equipe ?? []).map((op: any, i1: number) => (
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
<label style={{ display: "block" }}>
<span style={estilo(lbl)}>
Por que já vai para o Pipeline?
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<textarea value={motivo} onChange={setMotivo} rows={3} placeholder="Ex: indicação do Grupo Aurora, já conversou com o decisor e pediu proposta" style={estilo(motivoStyle)} />
<span style={{ display: "block", marginTop: "5px", fontSize: "11.5px", color: "#8b949e" }}>
Vira a primeira nota interna da oportunidade.
</span>
</label>
</div>
</>) : null}
{(temErro) ? (<>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#c2330f" }}>
{erro}
</span>
</>) : null}
</div>
</>) : null}
{(p3) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
{(relMuda) ? (<>
<span style={estilo(relDeStyle)}>
{relDe}
</span>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</>) : null}
<span style={{ display: "inline-flex", alignItems: "center", height: "26px", padding: "0 10px", borderRadius: "9999px", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "700" }}>
{relPara}
</span>
{(relMantem) ? (<>
<span style={{ fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
sem mudança
</span>
</>) : null}
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#4a5560", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{relAlvo}
</span>
</div>
<span style={{ fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
O que vai acontecer
</span>
<div style={{ display: "flex", flexDirection: "column" }}>
{(efeitos ?? []).map((ef: any, i1: number) => (
<Fragment key={ef?.id ?? ef?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 0", boxShadow: "inset 0 -1px 0 #f1f3f3" }}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={ef.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{ef.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "#67787c", lineHeight: "1.45", textWrap: "pretty" }}>
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
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "14px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
{(temVoltar) ? (<>
<button onClick={voltar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "40px", padding: "0 14px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
Voltar
</button>
</>) : null}
<span style={{ flex: "1" }} />
<button onClick={fechar} style={{ flex: "0 0 auto", height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "transparent", fontSize: "13px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Cancelar
</button>
{(temAvancar) ? (<>
<button onClick={avancar} style={estilo(avancarStyle)}>
{avancarTxt}
</button>
</>) : null}
</div>
</div>
</div>
</>) : null}
    </>
  );
}
