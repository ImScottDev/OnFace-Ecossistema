"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Pessoa.dc.html
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
import "./PessoaDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDePessoaDesenho {
  abaAtv: any;
  abaOpp: any;
  abaVisao: any;
  abas: any;
  abrirEmpresa: any;
  abrirResp: any;
  abrirTag: any;
  abrirVinc2: any;
  acaoNota: any;
  acaoTitulo: any;
  anexarNota: any;
  atvEsc: any;
  atvFiltros: any;
  atvLista: any;
  atvVazia: any;
  atvVaziaTitulo: any;
  blurNota: any;
  cad: any;
  canais: any;
  cancelarNota: any;
  cargo: any;
  chamada: any;
  chamadaTempo: any;
  colegas: any;
  criarOpp: any;
  criarTag: any;
  ed: any;
  editarResumo: any;
  empFatos: any;
  empIniciais: any;
  empMeta: any;
  empTitulo: any;
  empresa: any;
  empresaTopo: any;
  empresaTopoClick: any;
  empresaTopoStyle: any;
  encerrar: any;
  etapa: any;
  etapaSelo: any;
  exc: any;
  extras: any;
  focoNota: any;
  gridStyle: any;
  iniciais: any;
  interEsc: any;
  interTitulo: any;
  interacoes: any;
  ligar: any;
  mais: any;
  maisAberto: any;
  maisItens: any;
  maisStyle: any;
  mencaoAberta: any;
  mencaoOpcoes: any;
  mencaoStyle: any;
  mencaoVazia: any;
  meta: any;
  mostraInteracoes: any;
  nome: any;
  notaAnexos: any;
  notaAtiva: any;
  notaBtnStyle: any;
  notaCaixaStyle: any;
  notaLinhas: any;
  notaRef: any;
  notaTexto: any;
  notas: any;
  notasConta: any;
  novaAtv: any;
  obs: any;
  obsAutor: any;
  obsStyle: any;
  opps: any;
  origemC: any;
  origemSelo: any;
  respostasForm: any;
  temRespostasForm: any;
  parar: any;
  primeiroNome: any;
  principal: any;
  qualif: any;
  registrar: any;
  relAtivas: any;
  resp: any;
  respAberto: any;
  respBtnStyle: any;
  respChevron: any;
  respIniciais: any;
  respMenuStyle: any;
  respOpcoes: any;
  resumo: any;
  salvarNota: any;
  semAcao: any;
  semEmpresa: any;
  semInteracoes: any;
  semOpps: any;
  setNota: any;
  setTagNova: any;
  tagAberto: any;
  tagMenuStyle: any;
  tagNova: any;
  tagOpcoes: any;
  tags: any;
  teclaNota: any;
  teclaTag: any;
  temAcao: any;
  temEmpresa: any;
  temEtapa: any;
  temExtras: any;
  temNotaAnexos: any;
  toques: any;
  v2: any;
  verAcao: any;
  vincularEmpresa: any;
  visor: any;
}

export function PessoaDesenho(vals: ValoresDePessoaDesenho) {
  const { abaAtv, abaOpp, abaVisao, abas, abrirEmpresa, abrirResp, abrirTag, abrirVinc2, acaoNota, acaoTitulo, anexarNota, atvEsc, atvFiltros, atvLista, atvVazia, atvVaziaTitulo, blurNota, cad, canais, cancelarNota, cargo, chamada, chamadaTempo, colegas, criarOpp, criarTag, ed, editarResumo, empFatos, empIniciais, empMeta, empTitulo, empresa, empresaTopo, empresaTopoClick, empresaTopoStyle, encerrar, etapa, etapaSelo, exc, extras, focoNota, gridStyle, iniciais, interEsc, interTitulo, interacoes, ligar, mais, maisAberto, maisItens, maisStyle, mencaoAberta, mencaoOpcoes, mencaoStyle, mencaoVazia, meta, mostraInteracoes, nome, notaAnexos, notaAtiva, notaBtnStyle, notaCaixaStyle, notaLinhas, notaRef, notaTexto, notas, notasConta, novaAtv, obs, obsAutor, obsStyle, opps, origemC, origemSelo, parar, respostasForm, temRespostasForm, primeiroNome, principal, qualif, registrar, relAtivas, resp, respAberto, respBtnStyle, respChevron, respIniciais, respMenuStyle, respOpcoes, resumo, salvarNota, semAcao, semEmpresa, semInteracoes, semOpps, setNota, setTagNova, tagAberto, tagMenuStyle, tagNova, tagOpcoes, tags, teclaNota, teclaTag, temAcao, temEmpresa, temEtapa, temExtras, temNotaAnexos, toques, v2, verAcao, vincularEmpresa, visor } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-in="blur" style={{ flex: "0 0 auto", padding: "16px 16px 0" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
<span style={{ flex: "0 0 auto", width: "60px", height: "60px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{iniciais}
</span>
<div style={{ flex: "1 1 440px", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: "700", letterSpacing: ".09em", color: "#67787c" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<span>
CONTATO
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginTop: "3px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "25px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d", lineHeight: "1.2", textWrap: "balance" }}>
{nome}
</span>
{(principal) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", height: "23px", padding: "0 9px", borderRadius: "7px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap" }}>
Principal
</span>
</>) : null}
{(temEtapa) ? (<>
<span style={estilo(etapaSelo)}>
{etapa}
</span>
</>) : null}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px", fontSize: "13px", color: "#4a5560", flexWrap: "wrap" }}>
<span>
{cargo}
</span>
<span style={{ color: "#c8ccc9" }}>
·
</span>
<button onClick={empresaTopoClick} style={estilo(empresaTopoStyle)} className={[hover("text-decoration-color:#12171d")].filter(Boolean).join(" ")}>
{empresaTopo}
</button>
</div>
<div data-stagger="45" data-stagger-tipo="fade-down" data-delay="200" style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginTop: "9px" }}>
{(meta ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={m.d} />
</svg>
<span>
{m.label}
</span>
<span style={{ fontWeight: "600", color: "#12171d" }}>
{m.valor}
</span>
</span>
</Fragment>
))}
</div>
<div data-stagger="60" data-stagger-tipo="spring" data-delay="300" style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px" }}>
{(toques ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button data-magnet="7" onClick={t.onClick} style={estilo(t.style)} className={[hover(t.hover)].filter(Boolean).join(" ")}>
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
</div>
<div style={{ flex: "0 1 auto", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: "7px" }}>
<button onClick={registrar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 13px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
</svg>
<span>
Registrar atividade
</span>
</button>
<button onClick={editarResumo} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 13px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
Editar
</span>
</button>
<button onClick={criarOpp} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", borderRadius: "9px", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Criar oportunidade
</span>
</button>
<button data-of-pmais="1" onClick={mais} style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "flex", alignItems: "center", justifyContent: "center", border: "0", cursor: "pointer" }} title="Mais ações" className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5h.01M12 12h.01M12 19h.01" />
</svg>
</button>
</div>
</div>
<div style={{ display: "flex", gap: "2px", marginTop: "14px", borderBottom: "1px solid #e3e7e8", overflowX: "auto" }}>
{(abas ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
<span>
{t.label}
</span>
{(t.temConta) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", height: "18px", padding: "0 6px", borderRadius: "5px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "700" }}>
{t.conta}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
</div>
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px 16px 18px" }}>
<div data-r="duas" style={estilo(gridStyle)}>
<div data-stagger="85" data-stagger-tipo="flip" data-delay="120" style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
{(abaVisao) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Resumo do contato
</span>
<button onClick={editarResumo} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
Editar
</span>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "16px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "9px", minWidth: "0" }}>
{(resumo ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "0", minHeight: "22px" }}>
<span style={{ flex: "0 0 78px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
{r.label}
</span>
<span style={estilo(r.valorStyle)}>
{r.valor}
</span>
{(r.temAcao) ? (<>
<button onClick={r.acao} title={r.acaoTitulo} style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "6px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={r.acaoD} />
</svg>
</button>
</>) : null}
</div>
</Fragment>
))}
</div>
<div style={{ borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", padding: "13px 14px", minWidth: "0", display: "flex", flexDirection: "column" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", color: "#67787c", marginBottom: "7px" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />
</svg>
<span>
OBSERVAÇÃO
</span>
</div>
<div style={estilo(obsStyle)}>
{obs}
</div>
<div style={{ fontSize: "11px", color: "#8b949e", marginTop: "auto", paddingTop: "10px" }}>
{obsAutor}
</div>
</div>
</div>
</section>
{(principal) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Qualificação
</span>
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
do lead · {empresa}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "12px" }}>
{(qualif ?? []).map((q: any, i1: number) => (
<Fragment key={q?.id ?? q?.chave ?? i1}>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "11.5px", color: "#67787c", marginBottom: "6px", whiteSpace: "nowrap" }}>
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
</>) : null}
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Tags
</span>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
{(tags ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "3px", height: "26px", padding: "0 4px 0 10px", borderRadius: "7px", background: "#eeeff3", color: "#1f252c", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>
<span>
{g.label}
</span>
<button onClick={g.remover} title="Remover tag" style={{ width: "18px", height: "18px", borderRadius: "9999px", border: "0", padding: "0", background: "transparent", display: "grid", placeItems: "center", color: "#8b949e", cursor: "pointer" }} className={[hover("background:#dcdfe3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
<button data-of-ptag="1" onClick={abrirTag} style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px", borderRadius: "7px", border: "1px dashed #c8ccc9", background: "transparent", color: "#4a5560", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("border-color:#8b949e;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar tag
</span>
</button>
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Próxima ação
</span>
<button onClick={novaAtv} title="Nova atividade" style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", display: "grid", placeItems: "center", flex: "0 0 auto", border: "0", cursor: "pointer", padding: "0" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
{(temAcao) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "11px", borderRadius: "10px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #fadfd8", padding: "12px 13px", flexWrap: "wrap" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" />
</svg>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d", lineHeight: "1.35", textWrap: "pretty" }}>
{acaoTitulo}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", marginTop: "2px" }}>
{acaoNota}
</span>
</span>
<button onClick={verAcao} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "12px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Ver atividade
</button>
<button onClick={ligar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#d93c1a", color: "#fff", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" />
</svg>
<span>
Ligar
</span>
</button>
</div>
</>) : null}
{(semAcao) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", padding: "13px", flexWrap: "wrap" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Nenhuma ação com {primeiroNome}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", marginTop: "2px" }}>
Agende o próximo contato para não esfriar.
</span>
</span>
<button onClick={novaAtv} style={{ flex: "0 0 auto", height: "30px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Agendar
</button>
</div>
</>) : null}
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Cadência
</span>
<span style={estilo(cad.selo)}>
{cad.estado}
</span>
</div>
{(cad.tem) ? (<>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", marginBottom: "9px" }}>
{cad.nome}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "11px" }}>
<span style={{ flex: "1", display: "flex", gap: "3px" }}>
{(cad.passos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<span style={estilo(c.style)} />
</Fragment>
))}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap" }}>
Passo 2 de 5
</span>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<button onClick={cad.pausar} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
{cad.pausarLabel}
</button>
<button onClick={cad.inserir} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Trocar cadência
</button>
<button onClick={cad.remover} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #f0d5cf", color: "#c2330f", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
Remover
</button>
</div>
</>) : null}
{(cad.sem) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", padding: "12px 13px", flexWrap: "wrap" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{primeiroNome} está fora de cadência
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", marginTop: "2px" }}>
Escolha um fluxo e o canal de disparo.
</span>
</span>
<button onClick={cad.inserir} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Inserir em cadência
</span>
</button>
</div>
</>) : null}
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
{notasConta}
</span>
</div>
<div style={estilo(notaCaixaStyle)}>
<textarea data-of-mencao="1" ref={notaRef} value={notaTexto} onChange={setNota} onFocus={focoNota} onBlur={blurNota} onKeyDown={teclaNota} placeholder={`Registro sobre ${primeiroNome} — use @ para mencionar alguém`} rows={notaLinhas} style={{ display: "block", width: "100%", border: "0", outline: "0", resize: "none", background: "transparent", fontSize: "13px", lineHeight: "1.5", color: "#1f252c", padding: "10px 12px 4px" }} />
{(notaAtiva) ? (<>
{(temNotaAnexos) ? (<>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap", padding: "4px 12px 2px" }}>
{(notaAnexos ?? []).map((x: any, i1: number) => (
<Fragment key={x?.id ?? x?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "24px", padding: "0 4px 0 8px", borderRadius: "6px", background: "#eeeff3", color: "#1f252c", fontSize: "11.5px", fontWeight: "500", whiteSpace: "nowrap", maxWidth: "220px" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
</svg>
<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
{x.nome}
</span>
<span style={{ color: "#8b949e" }}>
{x.tam}
</span>
<button onClick={x.remover} style={{ width: "16px", height: "16px", borderRadius: "9999px", border: "0", padding: "0", background: "transparent", display: "grid", placeItems: "center", color: "#67787c", cursor: "pointer" }} title="Remover" className={[hover("background:#dcdfe3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px 8px 8px" }}>
<label title="Anexar arquivo" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "7px", display: "grid", placeItems: "center", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
</svg>
<input type="file" multiple={true} onChange={anexarNota} style={{ display: "none" }} />
</label>
<span style={{ flex: "1", minWidth: "0", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Visível só para o time · ⌘ + Enter para salvar
</span>
<button onClick={cancelarNota} style={{ flex: "0 0 auto", height: "28px", padding: "0 10px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "500", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={salvarNota} style={estilo(notaBtnStyle)}>
Adicionar nota
</button>
</div>
</>) : null}
</div>
<div style={{ display: "flex", flexDirection: "column", marginTop: "6px" }}>
{(notas ?? []).map((n: any, i1: number) => (
<Fragment key={n?.id ?? n?.chave ?? i1}>
<div style={estilo(n.linhaStyle)}>
<span style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{n.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
{n.autor}
</span>
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{n.quando}
</span>
{(n.fixada) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", height: "18px", padding: "0 6px", borderRadius: "5px", background: "#fff6f4", color: "#9c3210", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>
Fixada
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
<button onClick={x.abrir} title="Abrir anexo" style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "32px", padding: "0 9px 0 4px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#1f252c", fontSize: "11.5px", fontWeight: "500", whiteSpace: "nowrap", maxWidth: "260px", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #b9bfbc;background:#fafafa")].filter(Boolean).join(" ")}>
{(x.temThumb) ? (<>
<span style={estilo(x.thumbStyle)} />
</>) : null}
{(x.semThumb) ? (<>
<span style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "5px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", fontSize: "8px", fontWeight: "700" }}>
{x.ext}
</span>
</>) : null}
<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
{x.nome}
</span>
<span style={{ color: "#8b949e" }}>
{x.tam}
</span>
</button>
</Fragment>
))}
</span>
</>) : null}
</span>
<span style={{ flex: "0 0 auto", display: "flex", gap: "2px" }}>
<button onClick={n.fixar} title={n.fixarTitulo} style={estilo(n.fixarStyle)} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 17v5M9 10.8V4h6v6.8l3 3.2v2H6v-2z" />
</svg>
</button>
<button onClick={n.remover} title="Excluir nota" style={{ width: "26px", height: "26px", borderRadius: "6px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fff6f4;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
</svg>
</button>
</span>
</div>
</Fragment>
))}
</div>
</section>
</>) : null}
{(mostraInteracoes) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
{interTitulo}
</span>
<div style={{ display: "flex", gap: "2px", padding: "2px", borderRadius: "8px", background: "#eeeff3" }}>
{(canais ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<button onClick={c.onClick} style={estilo(c.style)}>
{c.label}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,176px) minmax(0,1fr)", gap: "16px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingRight: "12px", boxShadow: "inset -1px 0 0 #eef1f1", alignSelf: "stretch" }}>
<span style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#67787c", padding: "0 10px 6px" }}>
Vínculo
</span>
{(interEsc ?? []).map((vf: any, i1: number) => (
<Fragment key={vf?.id ?? vf?.chave ?? i1}>
<button onClick={vf.onClick} style={estilo(vf.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={vf.d} />
</svg>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{vf.label}
</span>
<span style={estilo(vf.nStyle)}>
{vf.n}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ minWidth: "0" }}>
<div data-stagger="45" data-stagger-tipo="row" data-delay="520" style={{ display: "flex", flexDirection: "column" }}>
{(interacoes ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div onClick={t.onClick} title={t.dica} style={estilo(t.linha)} className={[hover(t.hover)].filter(Boolean).join(" ")}>
<span style={estilo(t.marca)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={t.d} />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.35" }}>
{t.titulo}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", minWidth: "0" }}>
<span style={estilo(t.vincStyle)}>
{t.vinc}
</span>
{(t.temDet) ? (<>
<span style={{ minWidth: "0", fontSize: "11.5px", color: "#67787c", lineHeight: "1.4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.detalhe}
</span>
</>) : null}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", paddingTop: "2px" }}>
<span>
{t.quando}
</span>
{(t.temRel) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", gap: "3px", height: "20px", padding: "0 7px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "11px", fontWeight: "600", color: "#1f252c" }}>
Relatório
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 6 6 6-6 6" />
</svg>
</span>
</>) : null}
</span>
</div>
</Fragment>
))}
{(semInteracoes) ? (<>
<div style={{ padding: "22px 8px", textAlign: "center", fontSize: "12.5px", color: "#67787c" }}>
Nenhuma interação neste canal ainda.
</div>
</>) : null}
</div>
</div>
</div>
</section>
</>) : null}
{(abaAtv) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Atividades
</span>
<button onClick={novaAtv} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova atividade
</span>
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,176px) minmax(0,1fr)", gap: "16px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingRight: "12px", boxShadow: "inset -1px 0 0 #eef1f1", alignSelf: "stretch" }}>
<span style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#67787c", padding: "0 10px 6px" }}>
Vínculo
</span>
{(atvEsc ?? []).map((vf: any, i1: number) => (
<Fragment key={vf?.id ?? vf?.chave ?? i1}>
<button onClick={vf.onClick} style={estilo(vf.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={vf.d} />
</svg>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{vf.label}
</span>
<span style={estilo(vf.nStyle)}>
{vf.n}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ minWidth: "0" }}>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "#eeeff3", marginBottom: "10px", width: "fit-content" }}>
{(atvFiltros ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
<div data-stagger="45" data-stagger-tipo="row" style={{ display: "flex", flexDirection: "column" }}>
{(atvLista ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={estilo(a.linhaStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(a.marca)}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.titulo}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", minWidth: "0" }}>
<span style={estilo(a.vincStyle)}>
{a.vinc}
</span>
<span style={{ minWidth: "0", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.meta}
</span>
</span>
</span>
<span style={estilo(a.seloStyle)}>
{a.situacao}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", minWidth: "78px", textAlign: "right" }}>
{a.quando}
</span>
</button>
</Fragment>
))}
{(atvVazia) ? (<>
<div style={{ padding: "28px 12px", textAlign: "center", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{atvVaziaTitulo}
</div>
<div style={{ fontSize: "12px", color: "#4a5560", marginTop: "4px" }}>
Crie uma atividade para organizar o próximo contato.
</div>
</div>
</>) : null}
</div>
</div>
</div>
</section>
</>) : null}
{(abaOpp) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Oportunidades
</span>
<button onClick={criarOpp} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Nova oportunidade
</button>
</div>
{(opps ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", marginBottom: "6px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{o.titulo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "2px" }}>
{o.meta}
</span>
</span>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#fff6f4", color: "#9c3210", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
{o.etapa}
</span>
</div>
</Fragment>
))}
{(semOpps) ? (<>
<div style={{ padding: "26px 12px", textAlign: "center", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "12.5px", color: "#4a5560" }}>
Nenhuma oportunidade com {primeiroNome} ainda.
</div>
</>) : null}
</section>
</>) : null}
</div>
{(abaVisao) ? (<>
<div data-stagger="85" data-stagger-tipo="swing" data-delay="260" style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Relações em andamento
</span>
<span style={estilo(relAtivas.contaStyle)}>
{relAtivas.conta}
</span>
<button onClick={relAtivas.iniciar} title="Iniciar relação" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Iniciar
</button>
</div>
{(relAtivas.vazio) ? (<>
<div style={{ padding: "14px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#1f252c" }}>
Nada em andamento
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{relAtivas.vazioTxt}
</span>
<button onClick={relAtivas.iniciar} style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "12px", height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
</svg>
Iniciar relação
</button>
</div>
</>) : null}
<div style={{ display: "flex", flexDirection: "column" }}>
{(relAtivas.itens ?? []).map((rl: any, i1: number) => (
<Fragment key={rl?.id ?? rl?.chave ?? i1}>
<button onClick={rl.ir} style={estilo(rl.linha)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(rl.ico)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={rl.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", fontSize: "11px", fontWeight: "700", letterSpacing: ".04em", textTransform: "uppercase", color: "#8b949e" }}>
{rl.tipo}
</span>
<span style={estilo(rl.stStyle)}>
{rl.status}
</span>
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rl.titulo}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rl.sub}
</span>
</span>
<span style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap" }}>
{rl.acao}
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</span>
</button>
</Fragment>
))}
</div>
{(relAtivas.temPerdidas) ? (<>
<span style={{ display: "block", marginTop: "8px", fontSize: "11.5px", color: "#8b949e" }}>
{relAtivas.perdidasTxt}
</span>
</>) : null}
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{empTitulo}
</span>
{(temEmpresa) ? (<>
<button onClick={abrirEmpresa} style={{ height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Abrir empresa
</button>
</>) : null}
</div>
{(temEmpresa) ? (<>
<button onClick={abrirEmpresa} style={{ display: "flex", alignItems: "center", gap: "12px", width: "calc(100% + 8px)", padding: "4px", margin: "-4px", borderRadius: "10px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "44px", height: "44px", borderRadius: "11px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{empIniciais}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#12171d" }}>
{empresa}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{empMeta}
</span>
</span>
</button>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "8px", marginTop: "12px" }}>
{(empFatos ?? []).map((e: any, i1: number) => (
<Fragment key={e?.id ?? e?.chave ?? i1}>
<div style={{ padding: "9px 10px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", minWidth: "0" }}>
<div style={{ fontSize: "11px", color: "#67787c" }}>
{e.label}
</div>
<div style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{e.valor}
</div>
</div>
</Fragment>
))}
</div>
{(temExtras) ? (<>
<div style={{ marginTop: "12px", borderTop: "1px solid #eef1f1", paddingTop: "6px" }}>
{(extras ?? []).map((x: any, i1: number) => (
<Fragment key={x?.id ?? x?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0" }}>
<button onClick={x.abrir} style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "10px", padding: "4px", margin: "-4px", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{x.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{x.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{x.papel}
</span>
</span>
</button>
<button onClick={x.remover} title="Desvincular" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "6px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fff6f4;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
</div>
</>) : null}
<button onClick={abrirVinc2} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", height: "32px", marginTop: "12px", borderRadius: "8px", border: "1px dashed #c8ccc9", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("border-color:#8b949e;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar empresa
</span>
</button>
</>) : null}
{(semEmpresa) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", background: "#fafafa", border: "1px dashed #d3d8d9", flexWrap: "wrap" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#8b949e", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6" />
</svg>
</span>
<span style={{ flex: "1 1 160px", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Sem empresa vinculada
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", marginTop: "2px", textWrap: "pretty" }}>
Vincule a uma empresa existente ou cadastre uma nova.
</span>
</span>
<button onClick={vincularEmpresa} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Vincular / criar
</span>
</button>
</div>
</>) : null}
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }} data-comment-anchor="53da7cc168-section">
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Responsável
</span>
</div>
<button data-of-presp="1" onClick={abrirResp} style={estilo(respBtnStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{respIniciais}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{resp}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(respChevron)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 21v-2a4 4 0 0 0-3-3.9" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Outras pessoas na {empresa}
</span>
</div>
{(colegas ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.abrir} style={{ display: "flex", alignItems: "center", gap: "10px", width: "calc(100% + 12px)", padding: "8px 6px", margin: "0 -6px", border: "0", borderRadius: "8px", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{p.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.cargo}
</span>
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</Fragment>
))}
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Origem do contato
</span>
<span title="Registrada na entrada do contato · não editável" style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "4px", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#67787c", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
 {origemSelo} 
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
<span style={estilo(origemC.icoStyle)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={origemC.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
{origemC.tipo}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "1px", textWrap: "pretty" }}>
{origemC.resumo}
</span>
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
{(origemC.linhas ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "baseline", gap: "12px", minWidth: "0" }}>
<span style={{ flex: "0 0 82px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
{o.label}
</span>
<span style={estilo(o.style)}>
{o.valor}
</span>
</div>
</Fragment>
))}
</div>
</section>
{temRespostasForm ? (
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Respostas do formulário
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
{(respostasForm ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? i1}>
<div style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", textWrap: "pretty" }}>
{r.pergunta}
</span>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "500", color: "#1f252c", marginTop: "2px", textWrap: "pretty" }}>
{r.resposta}
</span>
</div>
</Fragment>
))}
</div>
</section>
) : null}
</div>
</>) : null}
</div>
</div>
{(ed.aberto) ? (<>
<div data-r="modal-fundo" onClick={ed.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "53", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "520px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px -12px rgba(0,0,0,.35)" }}>
<div style={{ flex: "0 0 auto", padding: "18px 20px 14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "10px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Editar contato
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "3px" }}>
Dados de {nome} na {empresa}.
</div>
</div>
<button onClick={ed.fechar} style={{ width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} title="Fechar" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "0 20px 18px" }}>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
{(ed.campos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<label style={estilo(c.celula)}>
<span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
{c.label}
</span>
{(c.linha1) ? (<>
<input value={c.valor} onChange={c.set} placeholder={c.dica} style={{ width: "100%", height: "36px", padding: "0 11px", borderRadius: "8px", border: "0", boxShadow: "inset 0 0 0 1px #dbdede", outline: "0", fontSize: "13px", background: "#fff" }} className={[foco("box-shadow:inset 0 0 0 1.5px #12171d")].filter(Boolean).join(" ")} />
</>) : null}
{(c.area) ? (<>
<textarea value={c.valor} onChange={c.set} placeholder={c.dica} rows={3} style={{ display: "block", width: "100%", padding: "9px 11px", borderRadius: "8px", border: "0", boxShadow: "inset 0 0 0 1px #dbdede", outline: "0", fontSize: "13px", lineHeight: "1.5", background: "#fff", resize: "vertical" }} className={[foco("box-shadow:inset 0 0 0 1.5px #12171d")].filter(Boolean).join(" ")} />
</>) : null}
</label>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 20px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", justifyContent: "flex-end" }}>
<button onClick={ed.fechar} style={{ height: "36px", padding: "0 15px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={ed.salvar} style={{ height: "36px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Salvar
</button>
</div>
</div>
</div>
</>) : null}
{(v2.aberto) ? (<>
<div data-r="modal-fundo" onClick={v2.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "53", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "460px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px -12px rgba(0,0,0,.35)" }}>
<div style={{ flex: "0 0 auto", padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "10px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Adicionar empresa
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "3px" }}>
{nome} continua na {empresa}.
</div>
</div>
<button onClick={v2.fechar} style={{ width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} title="Fechar" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "0 0 auto", padding: "0 20px 12px" }}>
<div style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", background: "#eeeff3" }}>
<button onClick={v2.irExistente} style={estilo(v2.abaExistente)}>
Empresa existente
</button>
<button onClick={v2.irNova} style={estilo(v2.abaNova)}>
Cadastrar nova
</button>
</div>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
{(v2.ehNova) ? (<>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
{(v2.campos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<label style={estilo(c.celula)}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
<span>
{c.label}
</span>
{(c.obrig) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
<input value={c.valor} onChange={c.set} placeholder={c.dica} style={estilo(c.style)} className={[foco("box-shadow:inset 0 0 0 1.5px #12171d")].filter(Boolean).join(" ")} />
</label>
</Fragment>
))}
</div>
</>) : null}
{(v2.ehExistente) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 11px", borderRadius: "9px", boxShadow: "inset 0 0 0 1px #dbdede", color: "#67787c" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20.5 20.5 16 16" />
</svg>
<input value={v2.busca} onChange={v2.setBusca} placeholder="Buscar ou digitar nova empresa" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
{(v2.lista ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", background: "#12171d", color: "#fff", fontSize: "10px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{o.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{o.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{o.meta}
</span>
</span>
{(o.on) ? (<>
<span style={{ width: "18px", height: "18px", borderRadius: "9999px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
</>) : null}
</button>
</Fragment>
))}
{(v2.podeCriar) ? (<>
<button onClick={v2.criar} style={estilo(v2.criarStyle)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "grid", placeItems: "center" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Cadastrar “{v2.busca}”
</span>
</button>
</>) : null}
</div>
</>) : null}
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Papel nessa empresa
</span>
<input value={v2.papel} onChange={v2.setPapel} placeholder="Ex: Conselheira, Sócia, Consultora" style={{ width: "100%", height: "36px", padding: "0 11px", borderRadius: "8px", border: "0", boxShadow: "inset 0 0 0 1px #dbdede", outline: "0", fontSize: "13px", background: "#fff" }} className={[foco("box-shadow:inset 0 0 0 1.5px #12171d")].filter(Boolean).join(" ")} />
</label>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 20px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", justifyContent: "flex-end" }}>
<button onClick={v2.fechar} style={{ height: "36px", padding: "0 15px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={v2.salvar} style={estilo(v2.btn)}>
{v2.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(mencaoAberta) ? (<>
<div data-of-mencao="1" style={estilo(mencaoStyle)}>
<div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c", padding: "7px 8px 5px" }}>
MENCIONAR
</div>
{(mencaoOpcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onMouseDown={o.escolher} style={estilo(o.style)}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "9px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{o.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
{o.nome}
</span>
</button>
</Fragment>
))}
{(mencaoVazia) ? (<>
<div style={{ padding: "8px", fontSize: "12px", color: "#67787c" }}>
Ninguém com esse nome no time.
</div>
</>) : null}
</div>
</>) : null}
{(visor.aberto) ? (<>
<div data-r="modal-fundo" onClick={visor.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.72)", zIndex: "65", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ display: "flex", alignItems: "center", gap: "10px", width: "min(880px,100%)", color: "#fff" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{visor.nome}
</span>
<span style={{ flex: "0 0 auto", fontSize: "12px", color: "#a3aab3" }}>
{visor.tam}
</span>
<a href={visor.src} download={visor.nome} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", background: "#fff", color: "#12171d", fontSize: "12.5px", fontWeight: "600", textDecoration: "none" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
<span>
Baixar
</span>
</a>
<button onClick={visor.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "rgba(255,255,255,.12)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:rgba(255,255,255,.22)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div onClick={parar} role="img" aria-label={visor.nome} style={estilo(visor.imgStyle)} />
</div>
</>) : null}
{(tagAberto) ? (<>
<div data-of-ptag="1" style={estilo(tagMenuStyle)}>
<div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c", padding: "7px 8px 5px" }}>
TAGS DO CONTATO
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto" }}>
{(tagOpcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", height: "34px", padding: "0 8px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={estilo(o.caixa)}>
{(o.on) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
{o.label}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "6px", padding: "8px 4px 4px", marginTop: "4px", borderTop: "1px solid #eef1f1" }}>
<input value={tagNova} onChange={setTagNova} onKeyDown={teclaTag} placeholder="Criar nova tag" style={{ flex: "1", minWidth: "0", height: "32px", padding: "0 10px", borderRadius: "7px", border: "0", boxShadow: "inset 0 0 0 1px #dbdede", outline: "0", fontSize: "12.5px", background: "#fff" }} />
<button onClick={criarTag} style={{ height: "32px", padding: "0 12px", borderRadius: "7px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
Criar
</button>
</div>
</div>
</>) : null}
{(respAberto) ? (<>
<div data-of-presp="1" style={estilo(respMenuStyle)}>
{(respOpcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", height: "36px", padding: "0 8px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "9px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{o.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
{o.nome}
</span>
{(o.on) ? (<>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12171d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
{(exc.aberto) ? (<>
<div data-r="modal-fundo" style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div style={{ width: "100%", maxWidth: "440px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "14px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 14px" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#fff6f4", color: "#d93c1a", display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #fadfd8" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
Excluir contato
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "2px", lineHeight: "1.45", textWrap: "pretty" }}>
O contato sai de todas as listas. A timeline da empresa guarda o registro da exclusão.
</div>
</div>
<button onClick={exc.fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} title="Fechar" className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflow: "auto", padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{exc.iniciais}
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{exc.nome}
</div>
<div style={{ fontSize: "11.5px", color: "#67787c" }}>
{exc.empresa}
</div>
</div>
</div>
{(exc.principal) ? (<>
<div style={{ fontSize: "12px", color: "#9c3210", lineHeight: "1.45", padding: "9px 11px", borderRadius: "9px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #fadfd8", textWrap: "pretty" }}>
Este é o contato principal do lead. Defina outro contato principal na empresa depois de excluir.
</div>
</>) : null}
<div>
<div style={{ display: "flex", gap: "5px", marginBottom: "7px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
MOTIVO
</span>
<span style={{ fontSize: "10.5px", fontWeight: "700", color: "#c2330f" }}>
*
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(exc.motivos ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)}>
<span style={estilo(m.radio)} />
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560", marginBottom: "7px", textTransform: "uppercase" }}>
{exc.obsLabel}
</div>
<textarea value={exc.obs} onChange={exc.setObs} placeholder="Contexto para o time" style={estilo(exc.obsStyle)} />
</div>
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={exc.fechar} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={exc.confirmar} style={estilo(exc.btnStyle)}>
Excluir contato
</button>
</div>
</div>
</div>
</>) : null}
{(maisAberto) ? (<>
<div data-of-pmais="1" style={estilo(maisStyle)}>
{(maisItens ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={m.d} />
</svg>
<span>
{m.label}
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
{(chamada) ? (<>
<div data-r="barra-massa" style={{ position: "fixed", left: "50%", bottom: "22px", transform: "translateX(-50%)", zIndex: "60", display: "flex", alignItems: "center", gap: "12px", padding: "10px 10px 10px 14px", borderRadius: "12px", background: "#12171d", color: "#fff", boxShadow: "0 18px 40px -10px rgba(0,0,0,.45)" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#1f7256", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
Em ligação com {nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#a3aab3", fontVariantNumeric: "tabular-nums" }}>
{chamadaTempo}
</span>
</span>
<button onClick={encerrar} style={{ height: "32px", padding: "0 13px", borderRadius: "8px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Encerrar
</button>
</div>
</>) : null}
</div>


    </>
  );
}
