"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Empresa.dc.html
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
export interface ValoresDeEmpresaDesenho {
  abas: any;
  acaoNota: any;
  acaoTitulo: any;
  addPessoa: any;
  cadEstado: any;
  cadNome: any;
  cadPasso: any;
  cadPassos: any;
  cadSelo: any;
  editar: any;
  etapa: any;
  etapaSelo: any;
  iniciais: any;
  ligar: any;
  mais: any;
  meta: any;
  nome: any;
  origem: any;
  pausar: any;
  pessoas: any;
  qualif: any;
  qualificar: any;
  registrar: any;
  relacoes: any;
  removerCad: any;
  resp: any;
  respIniciais: any;
  resumo: any;
  tags: any;
  timeline: any;
  trocarCad: any;
  verAcao: any;
}

export function EmpresaDesenho(vals: ValoresDeEmpresaDesenho) {
  const { abas, acaoNota, acaoTitulo, addPessoa, cadEstado, cadNome, cadPasso, cadPassos, cadSelo, editar, etapa, etapaSelo, iniciais, ligar, mais, meta, nome, origem, pausar, pessoas, qualif, qualificar, registrar, relacoes, removerCad, resp, respIniciais, resumo, tags, timeline, trocarCad, verAcao } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "16px 16px 0" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
<span style={{ flex: "0 0 auto", width: "60px", height: "60px", borderRadius: "13px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", letterSpacing: "-.01em", display: "flex", alignItems: "center", justifyContent: "center" }}>
{iniciais}
</span>
<div style={{ flex: "1", minWidth: "220px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: "700", letterSpacing: ".09em", color: "#67787c" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6" />
</svg>
<span>
EMPRESA
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginTop: "3px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "25px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d", lineHeight: "1.1" }}>
{nome}
</span>
<span style={{ display: "inline-flex", alignItems: "center", height: "23px", padding: "0 9px", borderRadius: "7px", background: "#fff6f4", color: "#9c3210", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap" }}>
Lead
</span>
<span style={estilo(etapaSelo)}>
{etapa}
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginTop: "9px" }}>
{(meta ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={m.d} />
</svg>
<span>
{m.label}
</span>
<span style={estilo(m.valorStyle)}>
{m.valor}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "7px" }}>
<button onClick={registrar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 13px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
</svg>
<span>
Registrar atividade
</span>
</button>
<button onClick={qualificar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", borderRadius: "9px", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
<span>
Qualificar
</span>
</button>
<button onClick={mais} style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "flex", alignItems: "center", justifyContent: "center", border: "0", cursor: "pointer", flex: "0 0 auto" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5h.01M12 12h.01M12 19h.01" />
</svg>
</button>
</div>
</div>
<div style={{ display: "flex", gap: "2px", marginTop: "14px", borderBottom: "1px solid #e3e7e8" }}>
{(abas ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px 16px 18px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: "12px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Resumo da empresa
</span>
<button onClick={editar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
Editar
</span>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(224px,1fr))", gap: "10px 26px" }}>
{(resumo ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "baseline", gap: "12px", minWidth: "0" }}>
<span style={{ flex: "0 0 86px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
{r.label}
</span>
{(r.ehTexto) ? (<>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", fontWeight: "500", textWrap: "pretty" }}>
{r.valor}
</span>
</>) : null}
{(r.ehChips) ? (<>
<span style={{ flex: "1", minWidth: "0", display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(r.chips ?? []).map((c: any, i2: number) => (
<Fragment key={c?.id ?? c?.chave ?? i2}>
<span style={estilo(c.style)}>
{c.label}
</span>
</Fragment>
))}
</span>
</>) : null}
{(r.ehLink) ? (<>
<a href={r.href} style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#c2330f", fontWeight: "500", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.valor}
</a>
</>) : null}
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Qualificação
</span>
<button onClick={editar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
Editar
</span>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: "12px" }}>
{(qualif ?? []).map((q: any, i1: number) => (
<Fragment key={q?.id ?? q?.chave ?? i1}>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "11.5px", color: "#67787c", marginBottom: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{q.label}
</div>
<span style={estilo(q.style)}>
{q.valor}
</span>
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 21v-2a4 4 0 0 0-3-3.9" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Pessoas vinculadas
</span>
<button onClick={addPessoa} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar pessoa
</span>
</button>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(pessoas ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<div style={estilo(p.linhaStyle)}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{p.iniciais}
</span>
<span style={{ flex: "1 1 168px", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
{(p.principal) ? (<>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "19px", padding: "0 7px", borderRadius: "5px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap" }}>
Principal
</span>
</>) : null}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", lineHeight: "1.35", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.cargo}
</span>
</span>
<span style={{ flex: "1 1 200px", minWidth: "0", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.email}
</span>
<span style={{ flex: "0 0 auto", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{p.tel}
</span>
<span style={{ flex: "0 0 auto", display: "flex", gap: "4px" }}>
{(p.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#4a5560", display: "flex", alignItems: "center", justifyContent: "center", border: "0", cursor: "pointer", flex: "0 0 auto" }} title={ac.titulo} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={ac.d} />
</svg>
</button>
</Fragment>
))}
</span>
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Timeline
</span>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(timeline ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: "10px", alignItems: "start" }}>
<span style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
<span style={estilo(t.marca)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={t.d} />
</svg>
</span>
{(t.temLinha) ? (<>
<span style={{ flex: "1", width: "1px", background: "#e3e7e8", minHeight: "10px" }} />
</>) : null}
</span>
<span style={{ minWidth: "0", paddingBottom: "13px" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.35", textWrap: "pretty" }}>
{t.titulo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", lineHeight: "1.4", marginTop: "1px" }}>
{t.autor}
</span>
</span>
<span style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", paddingTop: "3px" }}>
{t.quando}
</span>
</div>
</Fragment>
))}
</div>
</section>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Próxima ação
</span>
</div>
<div style={{ borderRadius: "10px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #fadfd8", padding: "12px 13px 13px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d", lineHeight: "1.35", textWrap: "pretty" }}>
{acaoTitulo}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", lineHeight: "1.45", marginTop: "2px", textWrap: "pretty" }}>
{acaoNota}
</span>
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "11px", flexWrap: "wrap" }}>
<span style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "9999px", background: "#fff", color: "#616b78", fontSize: "9.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{respIniciais}
</span>
<span style={{ fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap" }}>
{resp}
</span>
<span style={{ flex: "1", minWidth: "0" }} />
<button onClick={verAcao} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "12px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Ver detalhes
</button>
<button onClick={ligar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#d93c1a", color: "#fff", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7" />
</svg>
<span>
Iniciar ligação
</span>
</button>
</div>
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Responsável &amp; tags
</span>
<button onClick={editar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
Editar
</span>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0", flexWrap: "wrap" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{respIniciais}
</span>
<span style={{ flex: "0 0 auto", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", whiteSpace: "nowrap" }}>
{resp}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", lineHeight: "1.35", marginTop: "1px", whiteSpace: "nowrap" }}>
Gerente de contas
</span>
</span>
<span style={{ flex: "1 1 120px", minWidth: "0", display: "flex", gap: "5px", flexWrap: "wrap", justifyContent: "flex-end" }}>
{(tags ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto" }}>
{g.label}
</span>
</Fragment>
))}
</span>
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Origem
</span>
<button onClick={editar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
Editar
</span>
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
{(origem ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "baseline", gap: "12px", minWidth: "0" }}>
<span style={{ flex: "0 0 78px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
{o.label}
</span>
<span style={estilo(o.valorStyle)}>
{o.valor}
</span>
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Cadência
</span>
<span style={estilo(cadSelo)}>
{cadEstado}
</span>
</div>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", marginBottom: "9px" }}>
{cadNome}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "11px" }}>
<span style={{ flex: "1", display: "flex", gap: "3px" }}>
{(cadPassos ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<span style={estilo(p.style)} />
</Fragment>
))}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap" }}>
{cadPasso}
</span>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<button onClick={pausar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M10 4v16M14 4v16" />
</svg>
<span>
Pausar
</span>
</button>
<button onClick={trocarCad} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Trocar cadência
</button>
<button onClick={removerCad} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #f0d5cf", color: "#c2330f", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
Remover
</button>
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Relacionamentos
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: "8px" }}>
{(relacoes ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<button onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", border: "0", cursor: "pointer", textAlign: "left", minWidth: "0" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={r.d} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d", lineHeight: "1" }}>
{r.conta}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", lineHeight: "1.3", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.label}
</span>
</span>
</button>
</Fragment>
))}
</div>
</section>
</div>
</div>
</div>
</div>

    </>
  );
}
