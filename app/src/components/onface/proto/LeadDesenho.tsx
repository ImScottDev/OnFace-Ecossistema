"use client";

/* Derivado de OportunidadeDesenho.tsx: o markup foi COPIADO e ADAPTADO (não há
 * .dc.html do Lead no handoff). Saíram o stepper/avanço de pipeline, "Produtos e
 * valores", "Propostas" e as abas Arquivos e Propostas; entraram as faixas de
 * SLA, a Qualificação editável, os banners de nutrição/desqualificado/oportunidade,
 * Próxima ação, Cadência, Respostas do formulário e Relações.
 *
 * Como o da Oportunidade, é só markup: tudo que ele mostra entra por
 * `ValoresDeLeadDesenho`, preenchido por `LeadLiga` a partir do dado real. */

import { Fragment } from "react";
import { estilo, hover } from "./proto-runtime";
import "./LeadDesenho.css";

/** A FRONTEIRA entre o desenho e o produto. */
export interface ValoresDeLeadDesenho {
  abaAtv: any;
  abaGeral: any;
  abaTl: any;
  abas: any;
  abrirEmpresa: any;
  abrirPessoa: any;
  atvFiltros: any;
  atvMaisGeral: any;
  atvVazia: any;
  atvs: any;
  atvsGeral: any;
  cad: any;
  contatoAcoes: any;
  equipe: any;
  etapasAberto: any;
  etapasItens: any;
  fecharMenus: any;
  formulario: any;
  irAtividades: any;
  irTimeline: any;
  maisAberto: any;
  maisItens: any;
  menuAberto: any;
  notaRef: any;
  novaAberto: any;
  novaItens: any;
  nt: any;
  o: any;
  orig: any;
  prox: any;
  qual: any;
  qualAberto: any;
  qualItens: any;
  qualPrincipal: any;
  registrar: any;
  rel: any;
  semAtvs: any;
  semL: any;
  setResp: any;
  sla: any;
  temL: any;
  tg: any;
  tlResumo: any;
  tlTudo: any;
  toggleEtapas: any;
  toggleMais: any;
  toggleNova: any;
  toggleQual: any;
  voltar: any;
}

export function LeadDesenho(vals: ValoresDeLeadDesenho) {
  const { abaAtv, abaGeral, abaTl, abas, abrirEmpresa, abrirPessoa, atvFiltros, atvMaisGeral, atvVazia, atvs, atvsGeral, cad, contatoAcoes, equipe, etapasAberto, etapasItens, fecharMenus, formulario, irAtividades, irTimeline, maisAberto, maisItens, menuAberto, notaRef, novaAberto, novaItens, nt, o, orig, prox, qual, qualAberto, qualItens, qualPrincipal, registrar, rel, semAtvs, semL, setResp, sla, temL, tg, tlResumo, tlTudo, toggleEtapas, toggleMais, toggleNova, toggleQual, voltar } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
{(menuAberto) ? (<>
<div onClick={fecharMenus} style={{ position: "fixed", inset: "0", zIndex: "30" }} />
</>) : null}
{(semL) ? (<>
<div style={{ flex: "1", display: "grid", placeItems: "center", padding: "24px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", color: "#12171d" }}>
Lead não encontrado
</span>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Ele pode ter sido removido ou o link está incompleto.
</span>
<button onClick={voltar} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
Voltar
</button>
</div>
</div>
</>) : null}
{(temL) ? (<>
<div data-in="blur" style={{ flex: "0 0 auto", padding: "16px 16px 0" }}>
<button onClick={voltar} style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "26px", padding: "0 9px 0 4px", marginBottom: "8px", border: "0", borderRadius: "7px", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
<span>
{o.moduloRotulo}
</span>
</button>
<div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
<span style={{ flex: "0 0 auto", width: "60px", height: "60px", borderRadius: "13px", background: "#fe4f2b", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "240px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: "700", letterSpacing: ".09em", color: "#67787c" }}>
<span>
LEAD
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginTop: "3px" }}>
<span style={{ flex: "0 1 auto", minWidth: "0", display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "25px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d", lineHeight: "1.15", textWrap: "balance" }}>
{o.titulo}
</span>
<div style={{ position: "relative", zIndex: "31" }}>
<button onClick={toggleEtapas} title={o.etapaDica} style={estilo(o.etapaChip)} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={estilo(o.etapaPonto)} />
<span>
{o.etapaLabel}
</span>
{(o.etapaMovivel) ? (<>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
</>) : null}
</button>
{(etapasAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", left: "0", minWidth: "220px", padding: "5px", borderRadius: "11px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 14px 34px -10px rgba(18,23,29,.3)", display: "flex", flexDirection: "column", gap: "1px" }}>
<span style={{ padding: "6px 9px 4px", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
Mover para
</span>
{(etapasItens ?? []).map((ei: any, i1: number) => (
<Fragment key={ei?.id ?? ei?.chave ?? i1}>
<button onClick={ei.onClick} style={estilo(ei.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(ei.dot)} />
<span style={{ flex: "1", minWidth: "0" }}>
{ei.label}
</span>
{(ei.atual) ? (<>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
<span style={{ fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap" }}>
{o.diasTexto}
</span>
</div>
<div data-stagger="45" data-stagger-tipo="fade-down" data-delay="200" style={{ display: "flex", alignItems: "center", gap: "8px 16px", flexWrap: "wrap", marginTop: "9px" }}>
{(o.meta ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={m.d} />
</svg>
<span style={{ color: "#67787c" }}>
{m.label}
</span>
<span style={estilo(m.valorStyle)}>
{m.valor}
</span>
</button>
</Fragment>
))}
{(o.tagsCab ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<span style={estilo(t.style)}>
{t.nome}
</span>
</Fragment>
))}
</div>
</div>
<div data-r="toolbar" style={{ flex: "0 1 auto", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: "7px" }}>
{(contatoAcoes ?? []).map((ca: any, i1: number) => (
<Fragment key={ca?.id ?? ca?.chave ?? i1}>
<button onClick={ca.onClick} title={ca.dica} aria-disabled={ca.off ? true : undefined} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: ca.off ? "not-allowed" : "pointer", opacity: ca.off ? ".5" : "1" }} className={[hover(ca.off ? "" : "background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={ca.d} />
</svg>
<span>
{ca.label}
</span>
</button>
</Fragment>
))}
<div style={{ position: "relative", zIndex: "31" }}>
<button onClick={toggleNova} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(novaAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", left: "0", width: "250px", padding: "5px", borderRadius: "11px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 14px 34px -10px rgba(18,23,29,.3)", display: "flex", flexDirection: "column", gap: "1px" }}>
{(novaItens ?? []).map((ni: any, i1: number) => (
<Fragment key={ni?.id ?? ni?.chave ?? i1}>
<button onClick={ni.onClick} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 9px", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ni.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{ni.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{ni.sub}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
{(o.mostrarSaidas) ? (<>
<div style={{ position: "relative", display: "flex", zIndex: "31" }}>
<button onClick={qualPrincipal.onClick} title={qualPrincipal.dica} style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "36px", padding: "0 14px", borderRadius: "9px 0 0 9px", border: "0", background: "linear-gradient(180deg,#ff6241 0%,#fe4f2b 55%,#ef4522 100%)", color: "#fff", fontSize: "13px", fontWeight: "700", letterSpacing: "-.005em", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.12),0 1px 2px rgba(194,51,15,.35)" }}>
<span>
{qualPrincipal.label}
</span>
</button>
<button onClick={toggleQual} title="Outras saídas do lead" style={{ width: "32px", height: "36px", marginLeft: "-1px", borderRadius: "0 9px 9px 0", border: "0", background: "linear-gradient(180deg,#ff6241 0%,#fe4f2b 55%,#ef4522 100%)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "inset 1px 0 0 rgba(255,255,255,.28),inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.12)" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(qualAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", right: "0", width: "280px", padding: "5px", borderRadius: "11px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 14px 34px -10px rgba(18,23,29,.3)", display: "flex", flexDirection: "column", gap: "1px" }}>
{(qualItens ?? []).map((qi: any, i1: number) => (
<Fragment key={qi?.id ?? qi?.chave ?? i1}>
<button onClick={qi.onClick} title={qi.dica} aria-disabled={qi.off ? true : undefined} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 9px", borderRadius: "8px", border: "0", background: "transparent", cursor: qi.off ? "not-allowed" : "pointer", opacity: qi.off ? ".5" : "1", textAlign: "left" }} className={[hover(qi.off ? "" : "background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(qi.icoStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={qi.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{qi.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{qi.sub}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</>) : null}
<div style={{ position: "relative", zIndex: "31" }}>
<button onClick={toggleMais} title="Mais ações" style={{ width: "36px", height: "36px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M12 5h.01M12 12h.01M12 19h.01" />
</svg>
</button>
{(maisAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", right: "0", minWidth: "230px", padding: "5px", borderRadius: "11px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 14px 34px -10px rgba(18,23,29,.3)", display: "flex", flexDirection: "column", gap: "1px" }}>
{(maisItens ?? []).map((mi: any, i1: number) => (
<Fragment key={mi?.id ?? mi?.chave ?? i1}>
<button onClick={mi.onClick} style={estilo(mi.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
{mi.label}
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
</div>
{(o.temBanner) ? (<>
<div style={estilo(o.bannerStyle)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={o.bannerIco} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700" }}>
{o.bannerTitulo}
</span>
<span style={{ display: "block", fontSize: "12px", marginTop: "1px", opacity: ".85" }}>
{o.bannerSub}
</span>
</span>
{(o.bannerAcaoLabel) ? (<>
<button onClick={o.bannerAcao} style={{ flex: "0 0 auto", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", fontSize: "12px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
{o.bannerAcaoLabel}
</button>
</>) : null}
</div>
</>) : null}
<div style={{ display: "flex", gap: "2px", marginTop: "14px", borderBottom: "1px solid #e3e7e8", overflowX: "auto", scrollbarWidth: "none" }}>
{(abas ?? []).map((ab: any, i1: number) => (
<Fragment key={ab?.id ?? ab?.chave ?? i1}>
<button onClick={ab.onClick} style={estilo(ab.style)} className={[hover("color:#12171d")].filter(Boolean).join(" ")}>
<span>
{ab.label}
</span>
{(ab.temN) ? (<>
<span style={estilo(ab.nStyle)}>
{ab.n}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
</div>
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px 16px 18px" }}>
{(abaGeral) ? (<>
<div data-r="duas" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: "14px", alignItems: "start" }}>
<div data-stagger="70" data-stagger-tipo="rise" style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: "0" }}>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "12px 14px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "10px" }}>
{(sla ?? []).map((st: any, i1: number) => (
<Fragment key={st?.id ?? st?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "0", padding: "9px 11px", borderRadius: "10px", background: "#fafafa" }}>
<span style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
{st.label}
</span>
<span style={estilo(st.valorStyle)}>
{st.valor}
</span>
<span style={{ fontSize: "11.5px", color: "#67787c", lineHeight: "1.35", textWrap: "pretty" }}>
{st.sub}
</span>
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M4 6h16M4 12h16M4 18h10" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Qualificação
</span>
<span style={estilo(qual.seloStyle)}>
{qual.progresso}
</span>
<button onClick={qual.salvar} title={qual.salvarDica} aria-disabled={qual.salvarOff ? true : undefined} style={estilo(qual.salvarStyle)}>
{qual.salvarLabel}
</button>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(qual.campos ?? []).map((qc: any, i1: number) => (
<Fragment key={qc?.id ?? qc?.chave ?? i1}>
<div style={estilo(qc.linha)}>
<span style={{ fontSize: "12.5px", color: "#67787c", paddingTop: "6px" }}>
{qc.label}
</span>
<span style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
{(qc.ehChips) ? (<>
<span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(qc.opcoes ?? []).map((op: any, i2: number) => (
<Fragment key={op?.id ?? op?.chave ?? i2}>
<button onClick={op.onClick} aria-pressed={op.on} style={estilo(op.style)}>
{op.label}
</button>
</Fragment>
))}
</span>
</>) : null}
{(qc.ehNumero) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<input value={qc.valor} onChange={qc.set} onBlur={qc.blur} inputMode="numeric" placeholder={qc.dica} aria-label={qc.label} style={estilo(qc.inputStyle)} />
{(qc.temSelo) ? (<>
<span style={estilo(qc.seloStyle)}>
{qc.selo}
</span>
</>) : null}
</span>
</>) : null}
{(qc.ehTexto) ? (<>
<textarea value={qc.valor} onChange={qc.set} onBlur={qc.blur} placeholder={qc.dica} aria-label={qc.label} rows={2} style={estilo(qc.inputStyle)} />
</>) : null}
</span>
</div>
</Fragment>
))}
</div>
{(qual.erro) ? (<>
<div role="alert" style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "8px", background: "#fdeeea", color: "#9c3210", fontSize: "12px", fontWeight: "600" }}>
{qual.erro}
</div>
</>) : null}
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Atividades
</span>
{(atvMaisGeral) ? (<>
<button onClick={irAtividades} style={{ height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Ver todas
</button>
</>) : null}
<button onClick={registrar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova atividade
</span>
</button>
</div>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "#eeeff3", marginBottom: "10px", width: "fit-content" }}>
{(atvFiltros ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(atvsGeral ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.ver} title="Ver atividade" style={estilo(a.linhaStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(a.marca)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.meta}
</span>
</span>
<span style={estilo(a.seloStyle)}>
{a.situacao}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", minWidth: "72px", textAlign: "right" }}>
{a.quando}
</span>
</button>
</Fragment>
))}
{(semAtvs) ? (<>
<div style={{ padding: "16px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#67787c" }}>
{atvVazia}
</div>
</>) : null}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Notas internas
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
{nt.conta}
</span>
</div>
<div style={estilo(nt.caixa)}>
<textarea ref={notaRef} value={nt.texto} onChange={nt.set} onFocus={nt.foco} onKeyDown={nt.tecla} placeholder="Escreva uma nota para o time — use @ para mencionar alguém" rows={nt.linhas} style={{ display: "block", width: "100%", border: "0", outline: "0", resize: "none", background: "transparent", fontSize: "13px", lineHeight: "1.5", color: "#1f252c", padding: "10px 12px 4px" }} />
{(nt.temMencao) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", padding: "4px 8px 2px" }}>
<span style={{ fontSize: "11px", color: "#8b949e", padding: "0 4px" }}>
Mencionar
</span>
{(nt.mencoes ?? []).map((mc: any, i1: number) => (
<Fragment key={mc?.id ?? mc?.chave ?? i1}>
<button onMouseDown={mc.escolher} style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 9px 0 3px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#12171d", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #12171d")].filter(Boolean).join(" ")}>
<span style={{ width: "20px", height: "20px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "9px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{mc.ini}
</span>
<span>
{mc.nome}
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
{(nt.ativa) ? (<>
{(nt.temAnexos) ? (<>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap", padding: "4px 12px 2px" }}>
{(nt.anexos ?? []).map((x: any, i1: number) => (
<Fragment key={x?.id ?? x?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "24px", padding: "0 4px 0 8px", borderRadius: "6px", background: "#eeeff3", color: "#1f252c", fontSize: "11.5px", fontWeight: "500", whiteSpace: "nowrap", maxWidth: "220px" }}>
<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
{x.nome}
</span>
<button onClick={x.remover} title="Remover" style={{ width: "16px", height: "16px", borderRadius: "9999px", border: "0", padding: "0", background: "transparent", display: "grid", placeItems: "center", color: "#67787c", cursor: "pointer" }} className={[hover("background:#dcdfe3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px 8px" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Visível só para o time · ⌘ + Enter para salvar
</span>
<button onClick={nt.cancelar} style={{ flex: "0 0 auto", height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={nt.salvar} style={estilo(nt.btn)}>
Adicionar nota
</button>
</div>
</>) : null}
</div>
<div style={{ display: "flex", flexDirection: "column", marginTop: "6px" }}>
{(nt.lista ?? []).map((n: any, i1: number) => (
<Fragment key={n?.id ?? n?.chave ?? i1}>
<div style={estilo(n.linha)}>
{(n.humano) ? (<>
<span style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{n.ini}
</span>
</>) : null}
{(n.sistema) ? (<>
<span style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "8px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
</svg>
</span>
</>) : null}
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
{n.autor}
</span>
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{n.quando}
</span>
{(n.fixada) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", height: "18px", padding: "0 6px", borderRadius: "5px", background: "#fff6f4", color: "#9c3210", fontSize: "10px", fontWeight: "700" }}>
Fixada
</span>
</>) : null}
{(n.temTag) ? (<>
<span style={estilo(n.tagStyle)}>
{n.tag}
</span>
</>) : null}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#1f252c", lineHeight: "1.5", marginTop: "3px", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
{(n.partes ?? []).map((t: any, i2: number) => (
<Fragment key={t?.id ?? t?.chave ?? i2}>
<span style={estilo(t.style)}>
{t.txt}
</span>
</Fragment>
))}
</span>
{(n.temAnexos) ? (<>
<span style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "6px" }}>
{(n.anexos ?? []).map((x: any, i2: number) => (
<Fragment key={x?.id ?? x?.chave ?? i2}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 9px 0 4px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "11.5px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap", maxWidth: "240px" }}>
<span style={{ flex: "0 0 auto", width: "20px", height: "20px", borderRadius: "5px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "7.5px", fontWeight: "700" }}>
{x.ext}
</span>
<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
{x.nome}
</span>
</span>
</Fragment>
))}
</span>
</>) : null}
</span>
<span style={{ flex: "0 0 auto", display: "flex", gap: "2px" }}>
{(n.humano) ? (<>
<button onClick={n.remover} title="Excluir nota" style={{ width: "26px", height: "26px", borderRadius: "6px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fff6f4;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
</svg>
</button>
</>) : null}
</span>
</div>
</Fragment>
))}
{(nt.vazia) ? (<>
<div style={{ padding: "10px 2px 0", fontSize: "12px", color: "#8b949e" }}>
Nenhuma nota ainda. Registre o contexto para o time.
</div>
</>) : null}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Últimas interações
</span>
<button onClick={irTimeline} style={{ height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Ver tudo
</button>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(tlResumo ?? []).map((tl: any, i1: number) => (
<Fragment key={tl?.id ?? tl?.chave ?? i1}>
<div style={{ display: "flex", gap: "12px" }}>
<span style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
<span style={estilo(tl.bolha)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={tl.d} />
</svg>
</span>
<span style={estilo(tl.linha)} />
</span>
<span style={{ flex: "1", minWidth: "0", padding: "5px 0 14px" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{tl.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "2px" }}>
{tl.autor}
</span>
</span>
<span style={{ flex: "0 0 auto", paddingTop: "6px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
{tl.quando}
</span>
</div>
</Fragment>
))}
</div>
</section>
</div>
<div data-stagger="70" data-stagger-tipo="slide-left" data-delay="120" style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: "0" }}>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Próxima ação
</span>
<button onClick={prox.acao} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
{prox.acaoLabel}
</button>
</div>
{(prox.tem) ? (<>
<button onClick={prox.ver} title="Abrir a atividade" style={{ display: "flex", alignItems: "center", gap: "11px", width: "100%", padding: "10px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={estilo(prox.marca)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{prox.titulo}
</span>
<span style={estilo(prox.subStyle)}>
{prox.sub}
</span>
</span>
</button>
</>) : null}
{(prox.sem) ? (<>
<div style={{ padding: "12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
Sem próxima ação. Lead sem ação marcada fica parado: defina o próximo passo e o prazo.
</div>
</>) : null}
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Tags
</span>
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{tg.nota}
</span>
</div>
<span style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", minWidth: "0" }}>
{(tg.tags ?? []).map((tg: any, i1: number) => (
<Fragment key={tg?.id ?? tg?.chave ?? i1}>
<span style={estilo(tg.style)}>
{(tg.auto) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
</>) : null}
{tg.nome}
</span>
</Fragment>
))}
<button onClick={tg.abrirTags} style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "24px", padding: "0 9px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Tag
</button>
</span>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Empresa
</span>
<button onClick={abrirEmpresa} style={{ height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
{o.empresaAcao}
</button>
</div>
<button onClick={abrirEmpresa} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "0 0 auto", width: "46px", height: "46px", borderRadius: "11px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{o.empIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{o.empresa}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#67787c", marginTop: "2px" }}>
{o.empSub}
</span>
</span>
</button>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }} data-comment-anchor="c608a9725a-section">
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Contato
</span>
<button onClick={abrirPessoa} style={{ height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Ver contato
</button>
</div>
<button onClick={abrirPessoa} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "0 0 auto", width: "46px", height: "46px", borderRadius: "9999px", background: "linear-gradient(180deg,#f6f6f3,#eceeee)", color: "#1f252c", boxShadow: "inset 0 0 0 1px #e3e7e8", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{o.pesIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{o.pessoa}
</span>
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#67787c", marginTop: "2px" }}>
{o.cargo}
</span>
</span>
</button>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "6px", marginTop: "12px" }}>
{(contatoAcoes ?? []).map((ca: any, i1: number) => (
<Fragment key={ca?.id ?? ca?.chave ?? i1}>
<button onClick={ca.onClick} title={ca.dica} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", minWidth: "0", height: "34px", padding: "0 10px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={ca.d} />
</svg>
<span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ca.label}
</span>
</button>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Responsável
</span>
</div>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", height: "48px", padding: "0 12px 0 7px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "12px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{o.respIni}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{o.resp}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={o.resp} onChange={setResp} title="Trocar responsável" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(equipe ?? []).map((eq: any, i1: number) => (
<Fragment key={eq?.id ?? eq?.chave ?? i1}>
<option value={eq}>
{eq}
</option>
</Fragment>
))}
</select>
</label>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Origem do lead
</span>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "5px", height: "24px", padding: "0 9px", borderRadius: "7px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
<span>
{orig.selo}
</span>
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "10px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={orig.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#12171d" }}>
{orig.titulo}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#67787c", marginTop: "2px", textWrap: "pretty" }}>
{orig.sub}
</span>
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
{(orig.linhas ?? []).map((ol: any, i1: number) => (
<Fragment key={ol?.id ?? ol?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,110px) minmax(0,1fr)", gap: "10px", alignItems: "baseline" }}>
<span style={{ fontSize: "12.5px", color: "#67787c" }}>
{ol.label}
</span>
<span style={estilo(ol.valorStyle)}>
{ol.valor}
</span>
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Cadência
</span>
<button onClick={cad.acaoPrincipal} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
{cad.acaoPrincipalLabel}
</button>
</div>
{(cad.tem) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cad.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{cad.estado}
</span>
</span>
<button onClick={cad.pausar} style={{ flex: "0 0 auto", height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
{cad.pausarLabel}
</button>
<button onClick={cad.remover} title="Tirar o lead da cadência" style={{ flex: "0 0 auto", height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
Remover
</button>
</div>
</>) : null}
{(cad.sem) ? (<>
<div style={{ padding: "12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#67787c", lineHeight: "1.5" }}>
Fora de cadência. A cadência agenda os toques de WhatsApp, e-mail e ligação sem depender de lembrar.
</div>
</>) : null}
</section>
{(formulario.tem) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Respostas do formulário
</span>
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{formulario.conta}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
{(formulario.linhas ?? []).map((fl: any, i1: number) => (
<Fragment key={fl?.id ?? fl?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
<span style={{ fontSize: "12px", color: "#67787c" }}>
{fl.pergunta}
</span>
<span style={{ fontSize: "13px", fontWeight: "500", color: "#12171d", lineHeight: "1.45", textWrap: "pretty", overflowWrap: "anywhere" }}>
{fl.resposta}
</span>
</div>
</Fragment>
))}
</div>
</section>
</>) : null}
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Relações em andamento
</span>

</div>
<div style={{ display: "flex", flexDirection: "column", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(rel.itens ?? []).map((ri: any, i1: number) => (
<Fragment key={ri?.id ?? ri?.chave ?? i1}>
<button onClick={ri.onClick} style={estilo(ri.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "20px", padding: "0 7px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "700" }}>
{ri.tipo}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ri.titulo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ri.sub}
</span>
</span>
<span style={estilo(ri.statusStyle)}>
{ri.status}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b8bdbb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 6 6 6-6 6" />
</svg>
</button>
</Fragment>
))}
{(rel.vazio) ? (<>
<div style={{ padding: "12px", fontSize: "12.5px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{rel.vazioTxt}
</div>
</>) : null}
</div>
</section>
</div>
</div>
</>) : null}
{(abaAtv) ? (<>
<section style={{ maxWidth: "980px", background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Atividades
</span>
<button onClick={registrar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova atividade
</span>
</button>
</div>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "#eeeff3", marginBottom: "10px", width: "fit-content" }}>
{(atvFiltros ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(atvs ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.ver} title="Ver atividade" style={estilo(a.linhaStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(a.marca)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.meta}
</span>
</span>
<span style={estilo(a.seloStyle)}>
{a.situacao}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", minWidth: "72px", textAlign: "right" }}>
{a.quando}
</span>
</button>
</Fragment>
))}
{(semAtvs) ? (<>
<div style={{ padding: "16px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#67787c" }}>
{atvVazia}
</div>
</>) : null}
</div>
</section>
</>) : null}
{(abaTl) ? (<>
<section style={{ maxWidth: "980px", background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px 16px 6px" }}>
<div style={{ display: "flex", flexDirection: "column" }}>
{(tlTudo ?? []).map((tl: any, i1: number) => (
<Fragment key={tl?.id ?? tl?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "82px 14px minmax(0,1fr)", columnGap: "12px" }}>
<span style={{ fontSize: "12.5px", color: "#67787c", textAlign: "right", paddingTop: "2px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{tl.quando}
</span>
<span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
<span style={estilo(tl.dot)} />
<span style={estilo(tl.linhaFina)} />
</span>
<span style={{ minWidth: "0", paddingBottom: "16px" }}>
<span style={{ display: "block", fontSize: "14px", color: "#12171d", lineHeight: "1.35", textWrap: "pretty" }}>
{tl.t}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#67787c", marginTop: "3px" }}>
{tl.autor}
</span>
</span>
</div>
</Fragment>
))}
</div>
</section>
</>) : null}
</div>
</>) : null}
</div>
    </>
  );
}
