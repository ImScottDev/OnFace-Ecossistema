"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Pecas.dc.html
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
import "./PecasDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDePecasDesenho {
  atv: any;
  atvAberta: any;
  cad: any;
  confirmarNutrir: any;
  dataRetomada: any;
  dataStyle: any;
  desq: any;
  det: any;
  exigeData: any;
  fecharAtv: any;
  fecharDetalhe: any;
  fecharNutrir: any;
  motivosNutricao: any;
  nutrirBtnLabel: any;
  nutrirBtnStyle: any;
  parar: any;
  qual: any;
  qualificar: any;
  setData: any;
  temDetalhe: any;
  temNutrir: any;
}

export function PecasDesenho(vals: ValoresDePecasDesenho) {
  const { atv, atvAberta, cad, confirmarNutrir, dataRetomada, dataStyle, desq, det, exigeData, fecharAtv, fecharDetalhe, fecharNutrir, motivosNutricao, nutrirBtnLabel, nutrirBtnStyle, parar, qual, qualificar, setData, temDetalhe, temNutrir } = vals;
  return (
    <>
<div style={{ display: "contents" }}>
{(temDetalhe) ? (<>
<div onClick={fecharDetalhe} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.42)", zIndex: "40", animation: "of-fade .18s ease-out both" }} />
</>) : null}
{(temDetalhe) ? (<>
<aside style={{ position: "fixed", top: "10px", right: "10px", bottom: "10px", width: "436px", maxWidth: "calc(100vw - 20px)", background: "#fff", borderRadius: "14px", zIndex: "41", display: "flex", flexDirection: "column", overflow: "hidden", animation: "of-slide .26s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", padding: "15px 16px 13px", borderBottom: "1px solid #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "11px" }}>
<span style={estilo(det.avatarStyle)}>
{det.iniciais}
</span>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.015em", color: "#12171d", lineHeight: "1.25", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{det.pessoa}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.35", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{det.cargo} · {det.empresa}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "1px", marginTop: "6px" }}>
<span style={{ fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{det.telefone}
</span>
<span style={{ fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{det.email}
</span>
</div>
</div>
<button onClick={fecharDetalhe} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#4a5560" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(det.toques ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={t.d} />
</svg>
<span>
{t.label}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Etapa
</div>
<button onClick={det.trocarEtapa} style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", height: "32px", padding: "0 10px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(det.etapaPonto)} />
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>
{det.etapa}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Responsável
</div>
<button onClick={det.trocarResp} style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", height: "32px", padding: "0 10px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(det.respAvatar)}>
{det.respIniciais}
</span>
<span style={estilo(det.respTexto)}>
{det.resp}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
</div>
</div>
{(det.semEmpresa) ? (<>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 16px", background: "#fff6f4", borderBottom: "1px solid #fadfd8" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="2" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<rect x="4" y="11" width="16" height="10" rx="2" />
<path d="M8 11V7a4 4 0 0 1 8 0v4" />
</svg>
<span style={{ fontSize: "12px", color: "#9c3210", lineHeight: "1.45", textWrap: "pretty" }}>
Sem empresa associada: 
<strong style={{ fontWeight: "600" }}>
Criar oportunidade
</strong>
 fica bloqueado.
</span>
</div>
</>) : null}
<div style={{ flex: "1", minHeight: "0", overflowY: "auto" }}>
<div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "13px" }}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Tags
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(det.tags ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto" }}>
{g.label}
</span>
</Fragment>
))}
<div data-of-tagmenu="1" style={{ position: "relative", flex: "0 0 auto" }}>
<button onClick={det.addTag} style={estilo(det.addTagStyle)} title="Adicionar tag" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={estilo(det.addTagIcone)}>
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560" }}>
Origem
</span>
<span style={estilo(det.origemSelo)}>
{det.origem}
</span>
</div>
<div style={{ borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", padding: "9px 11px", display: "flex", flexDirection: "column", gap: "6px" }}>
{(det.origemDetalhe ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "baseline", gap: "9px" }}>
<span style={{ flex: "0 0 74px", fontSize: "11px", color: "#4a5560" }}>
{o.label}
</span>
<span style={estilo(o.valorStyle)}>
{o.valor}
</span>
</div>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ height: "1px", background: "#eef1f1" }} />
<div style={{ padding: "6px 8px 8px" }}>
<button onClick={det.sec.cad.alternar} style={estilo(det.sec.cad.cabStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(det.sec.cad.chevron)}>
<path d="m9 18 6-6-6-6" />
</svg>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", whiteSpace: "nowrap" }}>
CADÊNCIA
</span>
{(det.temCad) ? (<>
<span style={estilo(det.cadSelo)}>
{det.cadEstado}
</span>
</>) : null}
<span style={{ flex: "1", minWidth: "0" }} />
{(det.sec.cad.fechada) ? (<>
<span style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "190px" }}>
{det.cadResumo}
</span>
</>) : null}
</button>
{(det.sec.cad.aberta) ? (<>
<div style={{ padding: "2px 8px 6px" }}>
{(det.temCad) ? (<>
<div>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", marginBottom: "8px" }}>
{det.cadNome}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<div style={{ flex: "1", display: "flex", gap: "3px" }}>
{(det.cadPassos ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<span style={estilo(p.style)} />
</Fragment>
))}
</div>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap" }}>
{det.cadPasso}
</span>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<button onClick={det.pausarCad} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
{det.cadBotao}
</button>
<button onClick={det.abrirPicker} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Trocar cadência
</button>
<button onClick={det.removerCad} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #f0d5cf", color: "#c2330f", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
Remover
</button>
</div>
</div>
</>) : null}
{(det.semCad) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
Fora de cadência — nenhum toque automático sai para este lead.
</span>
<button onClick={det.abrirPicker} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Inserir
</span>
</button>
</div>
</>) : null}
</div>
</>) : null}
</div>
<div style={{ height: "1px", background: "#eef1f1" }} />
<div style={{ padding: "6px 8px 8px" }}>
<button onClick={det.sec.acao.alternar} style={estilo(det.sec.acao.cabStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(det.sec.acao.chevron)}>
<path d="m9 18 6-6-6-6" />
</svg>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", whiteSpace: "nowrap" }}>
PRÓXIMA AÇÃO
</span>
<span style={{ flex: "1", minWidth: "0" }} />
{(det.sec.acao.fechada) ? (<>
<span style={estilo(det.acaoResumoStyle)}>
{det.acaoResumo}
</span>
</>) : null}
</button>
{(det.sec.acao.aberta) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "6px 8px 6px", flexWrap: "wrap" }}>
{(det.semAcao) ? (<>
<span style={{ flex: "0 0 auto", width: "7px", height: "7px", borderRadius: "50%", background: "#fe4f2b" }} />
</>) : null}
{(det.temAcao) ? (<>
<span style={estilo(det.tipoSelo)}>
{det.acaoTipo}
</span>
</>) : null}
<span style={estilo(det.acaoTexto)}>
{det.acao}
</span>
<button onClick={det.verAcao} style={{ flex: "0 0 auto", height: "28px", padding: "0 11px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
{det.acaoBotao}
</button>
<button onClick={det.criarAtv} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }} title="Criar outra atividade" className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova
</span>
</button>
</div>
</>) : null}
</div>
<div style={{ height: "1px", background: "#eef1f1" }} />
<div style={{ padding: "6px 8px 8px" }}>
<button onClick={det.sec.qualif.alternar} style={estilo(det.sec.qualif.cabStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(det.sec.qualif.chevron)}>
<path d="m9 18 6-6-6-6" />
</svg>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", whiteSpace: "nowrap" }}>
QUALIFICAÇÃO
</span>
<span style={{ flex: "1", minWidth: "0" }} />
<span style={estilo(det.qualProgSelo)}>
{det.qualProg}
</span>
</button>
{(det.sec.qualif.aberta) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "11px", padding: "6px 8px 6px" }}>
{(det.qualif ?? []).map((q: any, i1: number) => (
<Fragment key={q?.id ?? q?.chave ?? i1}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560" }}>
{q.label}
</span>
<span style={{ flex: "1" }} />
{(q.temSelo) ? (<>
<span style={estilo(q.seloStyle)}>
{q.selo}
</span>
</>) : null}
</div>
{(q.ehTexto) ? (<>
<input value={q.valor} onChange={q.setTexto} placeholder={q.dica} style={estilo(q.inputStyle)} />
</>) : null}
{(q.ehEscolha) ? (<>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(q.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</>) : null}
{(q.ehNumero) ? (<>
<div style={{ display: "flex", alignItems: "stretch", height: "34px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden" }}>
<button onClick={q.menos} style={{ flex: "0 0 auto", width: "34px", display: "grid", placeItems: "center", background: "#fafafa", border: "0", borderRight: "1px solid #eef1f1", color: "#4a5560", cursor: "pointer" }} title="Diminuir" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M5 12h14" />
</svg>
</button>
<input value={q.valor} onChange={q.setTexto} inputMode="numeric" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", textAlign: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }} />
<span style={{ flex: "0 0 auto", display: "flex", alignItems: "center", paddingRight: "10px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
atendentes
</span>
<button onClick={q.mais} style={{ flex: "0 0 auto", width: "34px", display: "grid", placeItems: "center", background: "#fafafa", border: "0", borderLeft: "1px solid #eef1f1", color: "#4a5560", cursor: "pointer" }} title="Aumentar" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</>) : null}
</div>
<div style={{ height: "1px", background: "#eef1f1" }} />
<div style={{ padding: "6px 8px 14px" }}>
<button onClick={det.sec.timeline.alternar} style={estilo(det.sec.timeline.cabStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(det.sec.timeline.chevron)}>
<path d="m9 18 6-6-6-6" />
</svg>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", whiteSpace: "nowrap" }}>
TIMELINE
</span>
<span style={{ flex: "1", minWidth: "0" }} />
{(det.sec.timeline.fechada) ? (<>
<span style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
{det.timelineConta}
</span>
</>) : null}
{(det.sec.timeline.aberta) ? (<>
<span onClick={det.verTimeline} style={{ fontSize: "12px", fontWeight: "600", color: "#c2330f", whiteSpace: "nowrap", flex: "0 0 auto", cursor: "pointer" }}>
{det.timelineBotao}
</span>
</>) : null}
</button>
{(det.sec.timeline.aberta) ? (<>
<div style={{ display: "flex", flexDirection: "column", padding: "6px 8px 4px" }}>
{(det.timeline ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "52px 14px 1fr", gap: "9px" }}>
<span style={{ fontSize: "11.5px", color: "#4a5560", textAlign: "right", whiteSpace: "nowrap", paddingTop: "1px", fontVariantNumeric: "tabular-nums" }}>
{t.hora}
</span>
<span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
<span style={estilo(t.ponto)} />
<span style={estilo(t.trilho)} />
</span>
<span style={{ paddingBottom: "13px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", color: "#1f252c", lineHeight: "1.4", textWrap: "pretty" }}>
{t.titulo}
</span>
{(t.temAutor) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "3px" }}>
{t.autor}
</span>
</>) : null}
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "11px 16px", borderTop: "1px solid #e3e7e8", display: "flex", gap: "7px", flexWrap: "wrap" }}>
<button onClick={det.abrirEmpresa} style={estilo(det.empresaBtn)} title={det.empresaDica}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 11h.01M16 11h.01" />
</svg>
<span>
Abrir empresa
</span>
</button>
<button onClick={det.abrirContato} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<span>
Abrir contato
</span>
</button>
<span style={{ flex: "1", minWidth: "0" }} />
<div data-of-saida="1" style={{ position: "relative", flex: "0 0 auto" }}>
<div style={{ display: "flex", alignItems: "stretch", height: "34px", borderRadius: "8px", overflow: "hidden", background: "#d93c1a" }}>
<button onClick={qualificar} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0 12px", background: "transparent", border: "0", color: "#fff", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("background:rgba(0,0,0,.14)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
<span>
Qualificar
</span>
</button>
<span style={{ flex: "0 0 auto", width: "1px", background: "rgba(255,255,255,.34)" }} />
<button onClick={det.toggleSaida} style={{ display: "grid", placeItems: "center", width: "27px", background: "transparent", border: "0", color: "#fff", cursor: "pointer" }} title="Outras saídas do lead" className={[hover("background:rgba(0,0,0,.14)")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(det.saidaChevron)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
{(det.saidaMenu) ? (<>
<div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: "0", width: "268px", zIndex: "44", borderRadius: "6px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 -4px 6px -1px rgba(0,0,0,.1),0 -2px 4px -2px rgba(0,0,0,.1)", padding: "4px", animation: "of-rise .12s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "7px 8px 4px" }}>
SAÍDAS DO LEAD
</div>
{(det.saidas ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<button onClick={s.onClick} style={estilo(s.style)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d={s.d} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", lineHeight: "1.35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{s.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4", marginTop: "1px", textWrap: "pretty" }}>
{s.nota}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
</aside>
</>) : null}
{(atvAberta) ? (<>
<div onClick={fecharAtv} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "52", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "452px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "13px", overflow: "hidden", display: "flex", flexDirection: "column", animation: "of-rise .2s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", padding: "15px 18px 13px", borderBottom: "1px solid #e3e7e8", display: "flex", alignItems: "flex-start", gap: "10px" }}>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", flexWrap: "wrap" }}>
<span style={estilo(atv.situacaoSelo)}>
{atv.situacao}
</span>
<span style={estilo(atv.tipoSelo)}>
{atv.tipo}
</span>
</div>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15.5px", fontWeight: "700", letterSpacing: "-.012em", lineHeight: "1.3", marginBottom: "3px", textWrap: "pretty" }}>
{atv.tituloVisto}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{atv.contexto}
</div>
</div>
<button onClick={fecharAtv} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#4a5560" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "15px" }}>
{(atv.ehVer) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M8 2v4M16 2v4M3 8h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
</svg>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "2px" }}>
Quando
</div>
<div style={{ fontSize: "13px", fontWeight: "500", color: "#12171d" }}>
{atv.quando}
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "2px" }}>
Responsável
</div>
<div style={{ fontSize: "13px", fontWeight: "500", color: "#12171d" }}>
{atv.resp}
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M4 6h16M4 12h16M4 18h10" />
</svg>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "3px" }}>
Descrição
</div>
<div style={estilo(atv.descStyle)}>
{atv.descVista}
</div>
</div>
</div>
</div>
</>) : null}
{(atv.ehEditar) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Situação
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(atv.situacoes ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<button onClick={s.onClick} style={estilo(s.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={s.d} />
</svg>
<span>
{s.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Tipo
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(atv.tipos ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={t.d} />
</svg>
<span>
{t.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Título
</div>
<input value={atv.titulo} onChange={atv.setTitulo} placeholder="O que precisa ser feito" style={{ width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", background: "#fff", border: "1px solid #dbdede", outline: "0", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Descrição
</div>
<textarea value={atv.desc} onChange={atv.setDesc} rows={3} placeholder="Contexto, roteiro da ligação, o que combinar" style={{ width: "100%", padding: "9px 11px", borderRadius: "8px", background: "#fff", border: "1px solid #dbdede", outline: "0", fontSize: "13px", lineHeight: "1.5", resize: "vertical", fontFamily: "inherit" }} />
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 118px", gap: "9px" }}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Data
</div>
<input value={atv.data} onChange={atv.setData} type="date" style={{ width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", background: "#fff", border: "1px solid #dbdede", outline: "0", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Hora
</div>
<input value={atv.hora} onChange={atv.setHora} type="time" style={{ width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", background: "#fff", border: "1px solid #dbdede", outline: "0", fontSize: "13px" }} />
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Responsável
</div>
<button onClick={atv.trocarResp} style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "20px", height: "20px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "700" }}>
{atv.respIniciais}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{atv.resp}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
</div>
</>) : null}
</div>
{(atv.ehVer) ? (<>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap" }}>
<button onClick={atv.concluir} style={estilo(atv.concluirStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
<span>
{atv.concluirLabel}
</span>
</button>
<button onClick={atv.declinar} style={estilo(atv.declinarStyle)}>
{atv.declinarLabel}
</button>
<span style={{ flex: "1", minWidth: "0" }} />
<button onClick={atv.editar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
</svg>
<span>
Editar
</span>
</button>
</div>
</>) : null}
{(atv.ehEditar) ? (<>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
<button onClick={atv.cancelarEdicao} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={atv.salvar} style={{ height: "34px", padding: "0 15px", borderRadius: "8px", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Salvar
</button>
</div>
</>) : null}
</div>
</div>
</>) : null}
{(det.tagMenu) ? (<>
<div data-of-tagmenu="1" style={estilo(det.tagMenuStyle)}>
<div style={{ flex: "0 0 auto", fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c", padding: "7px 8px 5px" }}>
TAGS DISPONÍVEIS
</div>
<div style={{ flex: "1", minHeight: "56px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
{(det.tagOpcoes ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<span style={estilo(t.caixa)}>
{(t.on) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.label}
</span>
<span style={estilo(t.notaStyle)}>
{t.nota}
</span>
</span>
{(t.dispara) ? (<>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "2px" }}>
<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
</>) : null}
</button>
</Fragment>
))}
</div>
<div style={{ flex: "0 0 auto", height: "1px", background: "#eef1f1", margin: "5px 3px" }} />
<div style={{ flex: "0 0 auto", display: "flex", gap: "6px", padding: "3px 3px 4px" }}>
<input value={det.tagNova} onChange={det.setTagNova} onKeyDown={det.tagNovaTecla} placeholder="Criar nova tag" style={{ flex: "1", minWidth: "0", height: "32px", padding: "0 10px", borderRadius: "8px", background: "#fff", outline: "0", fontSize: "12.5px", fontFamily: "inherit", border: "1px solid #dbdede" }} />
<button onClick={det.criarTag} style={estilo(det.criarTagStyle)}>
Criar
</button>
</div>
</div>
</>) : null}
{(cad.aberto) ? (<>
<div onClick={cad.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.5)", zIndex: "57", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "840px", maxWidth: "100%", height: "min(580px,calc(100vh - 40px))", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", animation: "of-rise .2s cubic-bezier(.2,0,.2,1) both" }}>
<aside style={{ flex: "0 0 auto", width: "246px", background: "#fafafa", borderRight: "1px solid #e3e7e8", display: "flex", flexDirection: "column" }}>
<div style={{ flex: "0 0 auto", padding: "14px 14px 10px" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Cadências
</div>
<div style={{ fontSize: "11.5px", color: "#67787c", lineHeight: "1.4", marginTop: "2px" }}>
Escolha o fluxo que vai tocar o lead.
</div>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: "3px" }}>
{(cad.lista ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<button onClick={c.onClick} style={estilo(c.style)}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", minWidth: "0" }}>
<span style={estilo(c.ponto)} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>
{c.nome}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", marginTop: "4px", paddingLeft: "14px" }}>
<span style={{ fontSize: "11px", color: "#67787c", whiteSpace: "nowrap" }}>
{c.resumo}
</span>
<span style={{ flex: "1" }} />
<span style={{ display: "flex", gap: "3px", flex: "0 0 auto" }}>
{(c.icones ?? []).map((i: any, i2: number) => (
<Fragment key={i?.id ?? i?.chave ?? i2}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={i.d} />
</svg>
</Fragment>
))}
</span>
</span>
</button>
</Fragment>
))}
</div>
</aside>
<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", background: "#fff" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 17px 13px", borderBottom: "1px solid #e3e7e8" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.015em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cad.nome}
</div>
<div style={{ fontSize: "12px", color: "#4a5560", lineHeight: "1.45", marginTop: "2px", textWrap: "pretty" }}>
{cad.descricao}
</div>
</div>
<button onClick={cad.fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5560", border: "0", background: "transparent", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "15px 17px 17px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c", marginBottom: "10px" }}>
RESUMO DO FLUXO
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(cad.passos ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "54px 22px 1fr", gap: "10px", alignItems: "start" }}>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", textAlign: "right", paddingTop: "5px", whiteSpace: "nowrap" }}>
{p.quando}
</span>
<span style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
<span style={estilo(p.marcaStyle)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={p.d} />
</svg>
</span>
{(p.temLinha) ? (<>
<span style={{ flex: "1", width: "1px", background: "#e3e7e8", minHeight: "12px" }} />
</>) : null}
</span>
<span style={{ minWidth: "0", paddingBottom: "12px" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.35", textWrap: "pretty" }}>
{p.titulo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.45", marginTop: "1px", textWrap: "pretty" }}>
{p.nota}
</span>
</span>
</div>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c", marginBottom: "8px" }}>
ESTE FLUXO USA
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(cad.canais ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<span style={estilo(c.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={c.d} />
</svg>
<span>
{c.label}
</span>
<span style={{ opacity: ".62" }}>
{c.conta}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
<span style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c" }}>
DISPARAR A PARTIR DE
</span>
<span style={{ fontSize: "10px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
{(cad.origens ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
<span style={estilo(o.selo)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={o.d} />
</svg>
</span>
<span style={{ flex: "0 0 96px", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap" }}>
{o.label}
</span>
<span style={{ flex: "1", minWidth: "0", position: "relative" }}>
 {o.campo} 
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</span>
</div>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 17px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "9px", alignItems: "center" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "11.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cad.rodape}
</span>
<button onClick={cad.fechar} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={cad.confirmar} style={estilo(cad.btnStyle)}>
{cad.btnLabel}
</button>
</div>
</div>
</div>
</div>
</>) : null}
{(qual.aberto) ? (<>
<div onClick={qual.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.5)", zIndex: "53", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "476px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", animation: "of-rise .2s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", padding: "16px 19px 14px", borderBottom: "1px solid #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "11px" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9px", background: "#e6f4ee", boxShadow: "inset 0 0 0 1px #bfe3d4", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f7256" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.015em", color: "#12171d", lineHeight: "1.25" }}>
{qual.titulo}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", marginTop: "2px", textWrap: "pretty" }}>
{qual.subtitulo}
</div>
</div>
<button onClick={qual.fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#4a5560", border: "0", background: "transparent", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", marginTop: "12px", padding: "9px 11px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", background: "#eeeff3", color: "#4a5560", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{qual.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{qual.empresa}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", lineHeight: "1.35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{qual.pessoa}
</span>
</span>
<span style={estilo(qual.canalStyle)}>
{qual.canal}
</span>
</div>
</div>
{(qual.passoDados) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "17px 19px 19px", display: "flex", flexDirection: "column", gap: "17px" }}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
INTERESSE
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
<span style={{ flex: "1" }} />
<span style={{ fontSize: "11px", color: "#67787c", whiteSpace: "nowrap" }}>
{qual.interesseConta}
</span>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(qual.interesses ?? []).map((i: any, i1: number) => (
<Fragment key={i?.id ?? i?.chave ?? i1}>
<button onClick={i.onClick} style={estilo(i.style)}>
{(i.on) ? (<>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
<span>
{i.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
TAMANHO DA OPERAÇÃO
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
<span style={{ flex: "1" }} />
<span style={estilo(qual.porteFaixaStyle)}>
{qual.porteFaixa}
</span>
</div>
<div style={{ display: "flex", alignItems: "stretch", height: "42px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden" }}>
<button onClick={qual.menos} style={{ flex: "0 0 auto", width: "40px", display: "grid", placeItems: "center", background: "#fafafa", border: "0", borderRight: "1px solid #eef1f1", color: "#4a5560", cursor: "pointer" }} title="Diminuir" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M5 12h14" />
</svg>
</button>
<input value={qual.porte} onChange={qual.setPorte} inputMode="numeric" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", textAlign: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", fontVariantNumeric: "tabular-nums" }} />
<span style={{ flex: "0 0 auto", display: "flex", alignItems: "center", paddingRight: "12px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
atendentes
</span>
<button onClick={qual.mais} style={{ flex: "0 0 auto", width: "40px", display: "grid", placeItems: "center", background: "#fafafa", border: "0", borderLeft: "1px solid #eef1f1", color: "#4a5560", cursor: "pointer" }} title="Aumentar" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "7px", flexWrap: "wrap" }}>
{(qual.portesRapidos ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.onClick} style={estilo(p.style)}>
{p.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
DOR PRINCIPAL
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<input value={qual.dor} onChange={qual.setDor} placeholder="Ex.: alto custo com telefonia" style={estilo(qual.dorStyle)} />
{(qual.faltaDor) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "6px" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 8v5M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#c2330f" }}>
Escolha uma sugestão abaixo ou escreva a dor
</span>
</div>
</>) : null}
<div style={{ display: "flex", gap: "6px", marginTop: "7px", flexWrap: "wrap" }}>
{(qual.doresRapidas ?? []).map((d: any, i1: number) => (
<Fragment key={d?.id ?? d?.chave ?? i1}>
<button onClick={d.onClick} style={estilo(d.style)}>
{d.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
FIT
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<div style={{ display: "flex", gap: "7px" }}>
{(qual.fits ?? []).map((ft: any, i1: number) => (
<Fragment key={ft?.id ?? ft?.chave ?? i1}>
<button onClick={ft.onClick} style={estilo(ft.style)}>
<span style={estilo(ft.barras)}>
{(ft.niveis ?? []).map((n: any, i2: number) => (
<Fragment key={n?.id ?? n?.chave ?? i2}>
<span style={estilo(n.style)} />
</Fragment>
))}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
{ft.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
</div>
</>) : null}
{(qual.passoOpp) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "17px 19px 19px", display: "flex", flexDirection: "column", gap: "17px" }}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "9px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
COMO ESSA OPORTUNIDADE IRÁ AVANÇAR?
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: "7px" }}>
{(qual.avancos ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.onClick} style={estilo(v.style)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={v.d} />
</svg>
<span style={{ fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
{v.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div style={{ height: "1px", background: "#eef1f1" }} />
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
OPORTUNIDADE
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", padding: "0 12px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M16 20V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{qual.oppNome}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<title>Nome travado</title>
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
RESPONSÁVEL
</span>
</div>
<div style={{ position: "relative" }}>
 {qual.campoResp} 
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
ETAPA INICIAL
</span>
</div>
<div style={{ position: "relative" }}>
 {qual.campoEtapa} 
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</div>
</div>
</div>
</div>
</>) : null}
{(qual.passoReuniao) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "17px 19px 19px", display: "flex", flexDirection: "column", gap: "15px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", background: "#eeeff3", color: "#4a5560", fontSize: "9.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{qual.iniciaisPessoa}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{qual.contatoNome}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", lineHeight: "1.35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{qual.contatoEmail}
</span>
</span>
<button onClick={qual.addConvidado} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Convidado
</span>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
DATA
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<input value={qual.reuData} onChange={qual.setReuData} type="date" style={estilo(qual.inputStyle)} />
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
HORÁRIO
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<input value={qual.reuHora} onChange={qual.setReuHora} type="time" style={estilo(qual.inputStyle)} />
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
DURAÇÃO
</span>
</div>
<div style={{ display: "flex", gap: "6px" }}>
{(qual.duracoes ?? []).map((d: any, i1: number) => (
<Fragment key={d?.id ?? d?.chave ?? i1}>
<button onClick={d.onClick} style={estilo(d.style)}>
{d.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
CLOSER
</span>
</div>
<div style={{ position: "relative" }}>
 {qual.campoCloser} 
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</div>
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
TIPO
</span>
</div>
<div style={{ display: "flex", gap: "7px" }}>
{(qual.tiposReuniao ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={t.d} />
</svg>
<span style={{ fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
{t.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
TÍTULO
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<input value={qual.reuTitulo} onChange={qual.setReuTitulo} placeholder="Ex.: Grupo Aurora x Callface" style={estilo(qual.inputStyle)} />
</div>
</div>
</>) : null}
{(qual.passoTarefa) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "17px 19px 19px", display: "flex", flexDirection: "column", gap: "15px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={estilo(qual.canalSelo)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={qual.tarefaIcone} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
{qual.tarefaDica}
</span>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
TÍTULO
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<input value={qual.tarTitulo} onChange={qual.setTarTitulo} placeholder={qual.tarTituloDica} style={estilo(qual.inputStyle)} />
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
QUANDO
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "7px" }}>
{(qual.quandos ?? []).map((q: any, i1: number) => (
<Fragment key={q?.id ?? q?.chave ?? i1}>
<button onClick={q.onClick} style={estilo(q.style)}>
{q.label}
</button>
</Fragment>
))}
</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
<input value={qual.tarData} onChange={qual.setTarData} type="date" style={estilo(qual.inputStyle)} />
<input value={qual.tarHora} onChange={qual.setTarHora} type="time" style={estilo(qual.inputStyle)} />
</div>
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
OBSERVAÇÃO
</span>
</div>
<input value={qual.tarObs} onChange={qual.setTarObs} placeholder="Ex.: já conversando com o decisor" style={estilo(qual.inputStyle)} />
</div>
</div>
</>) : null}
{(qual.passoOk) ? (<>
<div style={{ flex: "1", minHeight: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "13px", padding: "44px 24px" }}>
<span style={{ width: "56px", height: "56px", borderRadius: "9999px", background: "#e6f4ee", display: "flex", alignItems: "center", justifyContent: "center", animation: "of-pop .32s cubic-bezier(.2,.9,.3,1.3) both" }}>
<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#1f7256" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: "28", strokeDashoffset: "28", animation: "of-tick .34s .16s cubic-bezier(.2,0,.2,1) forwards" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
<div style={{ textAlign: "center" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.015em", color: "#12171d" }}>
{qual.okTitulo}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.5", marginTop: "4px", textWrap: "pretty" }}>
{qual.okNota}
</div>
</div>
</div>
</>) : null}
<div style={{ flex: "0 0 auto", padding: "12px 19px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "9px", alignItems: "center" }}>
{(qual.podeVoltar) ? (<>
<button onClick={qual.voltar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m15 18-6-6 6-6" />
</svg>
<span>
Voltar
</span>
</button>
</>) : null}
{(qual.passoDados) ? (<>
<span style={estilo(qual.statusStyle)}>
{qual.status}
</span>
</>) : null}
<span style={{ flex: "1", minWidth: "0" }} />
{(qual.passoDados) ? (<>
<button onClick={qual.fechar} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<div data-of-qualmenu="1" ref={qual.ancora} style={{ position: "relative", flex: "0 0 auto" }}>
<button onClick={qual.toggleMenu} style={estilo(qual.grupoStyle)} className={[hover(qual.hover)].filter(Boolean).join(" ")}>
<span style={estilo(qual.corpoStyle)}>
Qualificar
</span>
<span style={estilo(qual.divisoria)} />
<span style={estilo(qual.setaStyle)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(qual.chevron)}>
<path d="m6 9 6 6 6-6" />
</svg>
</span>
</button>
</div>
</>) : null}
{(qual.passoOpp) ? (<>
<button onClick={qual.irDetalhe} style={estilo(qual.btnAvancoStyle)}>
{qual.btnAvancoLabel}
</button>
</>) : null}
{(qual.passoDetalhe) ? (<>
<button onClick={qual.concluir} style={estilo(qual.btnFinalStyle)}>
{qual.btnFinalLabel}
</button>
</>) : null}
</div>
</div>
</div>
</>) : null}
{(qual.menu) ? (<>
<div data-of-qualmenu="1" style={estilo(qual.menuStyle)}>
{(qual.opcoesSaida ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d={o.d} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500", lineHeight: "1.35" }}>
{o.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.4", marginTop: "1px", textWrap: "pretty" }}>
{o.nota}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
{(desq.aberto) ? (<>
<div onClick={desq.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "53", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "432px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "13px", overflow: "hidden", display: "flex", flexDirection: "column", animation: "of-rise .2s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", padding: "16px 18px 13px", borderBottom: "1px solid #e3e7e8" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", marginBottom: "3px" }}>
Desqualificar lead
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
{desq.contexto}
</div>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "15px" }}>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "7px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560" }}>
Motivo da desqualificação
</span>
<span style={{ fontSize: "11px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
{(desq.motivos ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)}>
<span style={estilo(m.radio)} />
<span style={{ flex: "1", minWidth: "0", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560" }}>
Observação
</span>
<span style={estilo(desq.obsSelo)}>
{desq.obsRotulo}
</span>
</div>
<textarea value={desq.obs} onChange={desq.setObs} rows={3} placeholder={desq.obsDica} style={estilo(desq.obsStyle)} />
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", justifyContent: "flex-end" }}>
<button onClick={desq.fechar} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={desq.confirmar} style={estilo(desq.btnStyle)}>
{desq.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(temNutrir) ? (<>
<div onClick={fecharNutrir} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "50", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "428px", maxWidth: "100%", background: "#fff", borderRadius: "13px", overflow: "hidden", animation: "of-rise .2s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ padding: "16px 18px 13px", borderBottom: "1px solid #e3e7e8" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", marginBottom: "3px" }}>
Mover para nutrição
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
Nutrição não pode ser lixeira elegante: exige motivo, e a maioria exige data de retomada.
</div>
</div>
<div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
{(motivosNutricao ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)}>
<span style={estilo(m.radio)} />
<span style={{ flex: "1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.label}
</span>
{(m.exige) ? (<>
<span style={{ flex: "0 0 auto", fontSize: "10px", fontWeight: "600", color: "#6e5420", background: "#f7edd8", borderRadius: "4px", padding: "2px 6px", whiteSpace: "nowrap" }}>
data
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#3d4650" }}>
Retomar em
</span>
{(exigeData) ? (<>
<span style={{ fontSize: "10px", fontWeight: "600", color: "#9c3210", background: "#fdeae5", borderRadius: "4px", padding: "2px 6px", whiteSpace: "nowrap" }}>
obrigatório
</span>
</>) : null}
</div>
<input value={dataRetomada} onChange={setData} type="date" style={estilo(dataStyle)} />
<div style={{ fontSize: "11.5px", color: "#4a5560", marginTop: "6px", lineHeight: "1.45", textWrap: "pretty" }}>
Gera tarefa real — o lead reaparece na fila nessa data.
</div>
</div>
</div>
<div style={{ padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafaf8", display: "flex", gap: "7px", justifyContent: "flex-end" }}>
<button onClick={fecharNutrir} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", border: "1px solid #dbdede", background: "#fff", fontSize: "12.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto" }} className={[hover("background:#f2f2f0")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={confirmarNutrir} style={estilo(nutrirBtnStyle)}>
{nutrirBtnLabel}
</button>
</div>
</div>
</div>
</>) : null}
</div>
    </>
  );
}
