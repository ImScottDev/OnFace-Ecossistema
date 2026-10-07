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
import "./EmpresaDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeEmpresaDesenho {
  abaArq: any;
  abaAtv: any;
  abaOpp: any;
  abaVisao: any;
  abas: any;
  abrirEtapa: any;
  abrirResp: any;
  abrirTag: any;
  acaoNota: any;
  acaoTitulo: any;
  addPessoa: any;
  anexarNota: any;
  arquivos: any;
  atvFiltros: any;
  atvLista: any;
  atvVazia: any;
  atvVaziaTitulo: any;
  atvVinc: any;
  blurNota: any;
  cadEstado: any;
  cadNome: any;
  cadPasso: any;
  cadPassos: any;
  cadSelo: any;
  cancelarNota: any;
  chamada: any;
  chamadaNome: any;
  chamadaTempo: any;
  criarOpp: any;
  criarTag: any;
  criarTagStyle: any;
  edAberto: any;
  edBotao: any;
  edCampos: any;
  edFechar: any;
  edIcone: any;
  edSalvar: any;
  edSub: any;
  edTitulo: any;
  editarQualif: any;
  editarResumo: any;
  encerrar: any;
  enr: any;
  enviarArquivo: any;
  etapa: any;
  etapaAberto: any;
  etapaMenuStyle: any;
  etapaOpcoes: any;
  etapaPontoTopo: any;
  etapaSelo: any;
  exc: any;
  focoNota: any;
  gridStyle: any;
  iniciais: any;
  irNota: any;
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
  mostraPessoas: any;
  mostraTimeline: any;
  no: any;
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
  opps: any;
  origem: any;
  origemSelo: any;
  parar: any;
  pausar: any;
  pausarLabel: any;
  pessoas: any;
  pulso: any;
  qualif: any;
  qualificar: any;
  registrar: any;
  relAtivas: any;
  relTopo: any;
  relTopoStyle: any;
  removerCad: any;
  resp: any;
  respAberto: any;
  respBtnStyle: any;
  respChevron: any;
  respIniciais: any;
  respMenuStyle: any;
  respOpcoes: any;
  resumo: any;
  formularios: any;
  temFormularios: any;
  salvarNota: any;
  semOpps: any;
  setNota: any;
  setTagNova: any;
  tagAberto: any;
  tagMenuStyle: any;
  tagNova: any;
  tagOpcoes: any;
  tagsTopo: any;
  teclaNota: any;
  teclaTag: any;
  temCad: any;
  temEtapaTopo: any;
  temNotaAnexos: any;
  timeline: any;
  tlAlternar: any;
  tlBotao: any;
  tlChevron: any;
  tlTemMais: any;
  tlVinc: any;
  trocarCad: any;
  trocarLabel: any;
  verAcao: any;
  verTodasAtv: any;
  visor: any;
}

export function EmpresaDesenho(vals: ValoresDeEmpresaDesenho) {
  const { abaArq, abaAtv, abaOpp, abaVisao, abas, abrirEtapa, abrirResp, abrirTag, acaoNota, acaoTitulo, addPessoa, anexarNota, arquivos, atvFiltros, atvLista, atvVazia, atvVaziaTitulo, atvVinc, blurNota, cadEstado, cadNome, cadPasso, cadPassos, cadSelo, cancelarNota, chamada, chamadaNome, chamadaTempo, criarOpp, criarTag, criarTagStyle, edAberto, edBotao, edCampos, edFechar, edIcone, edSalvar, edSub, edTitulo, editarQualif, editarResumo, encerrar, enr, enviarArquivo, etapa, etapaAberto, etapaMenuStyle, etapaOpcoes, etapaPontoTopo, etapaSelo, exc, focoNota, gridStyle, iniciais, irNota, ligar, mais, maisAberto, maisItens, maisStyle, mencaoAberta, mencaoOpcoes, mencaoStyle, mencaoVazia, meta, mostraPessoas, mostraTimeline, no, nome, notaAnexos, notaAtiva, notaBtnStyle, notaCaixaStyle, notaLinhas, notaRef, notaTexto, notas, notasConta, novaAtv, opps, origem, origemSelo, parar, pausar, pausarLabel, pessoas, pulso, qualif, qualificar, registrar, relAtivas, relTopo, relTopoStyle, removerCad, resp, respAberto, respBtnStyle, respChevron, respIniciais, respMenuStyle, respOpcoes, resumo, formularios, temFormularios, salvarNota, semOpps, setNota, setTagNova, tagAberto, tagMenuStyle, tagNova, tagOpcoes, tagsTopo, teclaNota, teclaTag, temCad, temEtapaTopo, temNotaAnexos, timeline, tlAlternar, tlBotao, tlChevron, tlTemMais, tlVinc, trocarCad, trocarLabel, verAcao, verTodasAtv, visor } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-in="blur" style={{ flex: "0 0 auto", padding: "16px 16px 0" }}>
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
<span style={estilo(relTopoStyle)}>
{relTopo}
</span>
{(temEtapaTopo) ? (<>
<span style={estilo(etapaSelo)}>
{etapa}
</span>
</>) : null}
<span style={{ width: "1px", height: "16px", background: "#e3e7e8", margin: "0 2px" }} />
{(tagsTopo ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "3px", height: "23px", padding: "0 4px 0 9px", borderRadius: "7px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
<span>
{g.label}
</span>
<button onClick={g.remover} title="Remover tag" style={{ width: "16px", height: "16px", borderRadius: "9999px", border: "0", padding: "0", background: "transparent", display: "grid", placeItems: "center", color: "#8b949e", cursor: "pointer" }} className={[hover("background:#dcdfe3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
<button data-of-etag="1" onClick={abrirTag} style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "23px", padding: "0 8px", borderRadius: "7px", border: "1px dashed #c8ccc9", background: "transparent", color: "#4a5560", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("border-color:#8b949e;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Tag
</span>
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
<span style={estilo(m.valorStyle)}>
{m.valor}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "0 1 auto", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: "7px" }} data-comment-anchor="77a78452d7-div">
<button onClick={registrar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 13px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
</svg>
<span>
Registrar atividade
</span>
</button>
<button onClick={enr.abrir} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 13px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M21 5c0 1.66-4 3-9 3S3 6.66 3 5s4-3 9-3 9 1.34 9 3zM3 5v14c0 1.66 4 3 9 3M21 5v6M3 12c0 1.66 4 3 9 3M18 15v6M15 18h6" />
</svg>
<span>
Enriquecer
</span>
</button>
<button data-of-eetapa="1" onClick={abrirEtapa} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 11px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={estilo(etapaPontoTopo)} />
<span>
Mover etapa
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
<button onClick={irNota} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 13px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15h6" />
</svg>
<span>
Adicionar nota
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
<button data-of-emais="1" onClick={mais} style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "flex", alignItems: "center", justifyContent: "center", border: "0", cursor: "pointer", flex: "0 0 auto" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
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
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px 16px 18px" }}>
<div data-r="duas" style={estilo(gridStyle)}>
<div data-stagger="85" data-stagger-tipo="flip" data-delay="120" style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
{(abaVisao) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Resumo da empresa
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
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(224px,1fr))", gap: "10px 26px" }}>
{(resumo ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "baseline", gap: "12px", minWidth: "0" }}>
<span style={{ flex: "0 0 86px", display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap" }}>
<span>
{r.label}
</span>
{(r.apollo) ? (<>
<span title="Dado trazido pelo Apollo" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "3px", height: "16px", padding: "0 5px", borderRadius: "4px", background: "#eeeff3", color: "#67787c", fontSize: "9.5px", fontWeight: "700", letterSpacing: ".02em" }}>
<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 5c0 1.66-4 3-9 3S3 6.66 3 5s4-3 9-3 9 1.34 9 3zM3 5v14c0 1.66 4 3 9 3M21 5v14c0 1.66-4 3-9 3" />
</svg>
 APOLLO 
</span>
</>) : null}
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
{temFormularios ? (
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
{/* Recolhível: cada lead da empresa pode ter um formulário de até dez perguntas. */}
<details>
<summary style={{ cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Respostas do formulário
</summary>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
{(formularios ?? []).map((f: any) => (
<div key={f.id} style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
<div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#67787c" }}>
<span style={{ flex: "1", minWidth: "0" }}>{f.titulo}</span>
{f.adHref ? (<a href={f.adHref} target="_blank" rel="noreferrer" style={{ color: "#c2330f", textDecoration: "underline" }}>Ver anúncio</a>) : null}
</div>
{(f.linhas ?? []).map((r: any, i: number) => (
<div key={i} style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", textWrap: "pretty" }}>{r.pergunta}</span>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "500", color: "#1f252c", marginTop: "2px", textWrap: "pretty" }}>{r.resposta}</span>
</div>
))}
</div>
))}
</div>
</details>
</section>
) : null}
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Qualificação
</span>
<button onClick={editarQualif} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
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
</>) : null}
{(mostraPessoas) ? (<>
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
<button onClick={p.abrir} title="Abrir pessoa" style={{ flex: "1 1 200px", minWidth: "0", display: "flex", alignItems: "center", gap: "11px", padding: "4px 6px 4px 0", margin: "-4px 0", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{p.iniciais}
</span>
<span style={{ flex: "1 1 auto", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: "underline", textDecorationColor: "transparent", textUnderlineOffset: "3px" }} className={[hover("text-decoration-color:#12171d")].filter(Boolean).join(" ")}>
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
</button>
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
</>) : null}
{(abaVisao) ? (<>
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
<textarea data-of-mencao="1" ref={notaRef} value={notaTexto} onChange={setNota} onFocus={focoNota} onBlur={blurNota} onKeyDown={teclaNota} placeholder="Escreva uma nota para o time — use @ para mencionar alguém" rows={notaLinhas} style={{ display: "block", width: "100%", border: "0", outline: "0", resize: "none", background: "transparent", fontSize: "13px", lineHeight: "1.5", color: "#1f252c", padding: "10px 12px 4px" }} />
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
{(mostraTimeline) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Timeline
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,176px) minmax(0,1fr)", gap: "16px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingRight: "12px", boxShadow: "inset -1px 0 0 #eef1f1", alignSelf: "stretch" }}>
<span style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#67787c", padding: "0 10px 6px" }}>
Vínculo
</span>
{(tlVinc ?? []).map((vf: any, i1: number) => (
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
{(timeline ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div onClick={t.onClick} title={t.dica} style={estilo(t.linha)} className={[hover(t.hover)].filter(Boolean).join(" ")}>
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
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", minWidth: "0" }}>
<span style={estilo(t.vincStyle)}>
{t.vinc}
</span>
{(t.temAutor) ? (<>
<span style={{ minWidth: "0", fontSize: "11.5px", color: "#67787c", lineHeight: "1.4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.autor}
</span>
</>) : null}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", paddingTop: "3px" }}>
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
</div>
{(tlTemMais) ? (<>
<button onClick={tlAlternar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", height: "32px", marginTop: "2px", borderRadius: "8px", border: "0", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<span>
{tlBotao}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(tlChevron)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</>) : null}
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
{(atvVinc ?? []).map((vf: any, i1: number) => (
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
<div style={{ display: "flex", flexDirection: "column" }}>
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
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M16 20V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Oportunidades
</span>
<button onClick={criarOpp} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Criar oportunidade
</span>
</button>
</div>
{(opps ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", flexWrap: "wrap" }}>
<span style={{ flex: "1 1 200px", minWidth: "0" }}>
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
<div style={{ padding: "28px 12px", textAlign: "center", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Nenhuma oportunidade ainda
</div>
<div style={{ fontSize: "12px", color: "#4a5560", marginTop: "4px", textWrap: "pretty" }}>
Qualifique o lead e crie a oportunidade para ela seguir ao Pipeline.
</div>
</div>
</>) : null}
</section>
</>) : null}
{(abaArq) ? (<>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Arquivos
</span>
</div>
{(arquivos ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 4px", borderBottom: "1px solid #f3f5f5" }}>
<button onClick={a.abrir} title="Abrir arquivo" style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "10px", padding: "4px 6px 4px 4px", margin: "-4px 0", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(a.thumbStyle)}>
{a.extVisivel}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{a.meta}
</span>
</span>
</button>
<button onClick={a.remover} style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} title="Remover" className={[hover("background:#f1f3f3;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
<label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginTop: "10px", padding: "26px 12px", borderRadius: "10px", border: "1.5px dashed #d3d8d9", cursor: "pointer", textAlign: "center" }} className={[hover("background:#fafafa;border-color:#8b949e")].filter(Boolean).join(" ")}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
</svg>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
Enviar arquivo
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
Proposta, contrato, apresentação
</span>
<input type="file" multiple={true} onChange={enviarArquivo} style={{ display: "none" }} />
</label>
</section>
</>) : null}
</div>
{(abaVisao) ? (<>
<div data-stagger="85" data-stagger-tipo="swing" data-delay="260" style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Próxima ação
</span>
<button onClick={verTodasAtv} style={{ height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap", flex: "0 0 auto", cursor: "pointer" }} data-comment-anchor="28cf7a60ce-button" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
Ver todas
</button>
<button onClick={novaAtv} title="Nova atividade" style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", display: "grid", placeItems: "center", flex: "0 0 auto", border: "0", cursor: "pointer", padding: "0" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
<div style={{ borderRadius: "10px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #fadfd8", padding: "12px 13px 13px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" />
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
Ver atividade
</button>
<button onClick={ligar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#d93c1a", color: "#fff", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" />
</svg>
<span>
Iniciar ligação
</span>
</button>
</div>
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Responsável
</span>
</div>
<button data-of-eresp="1" onClick={abrirResp} style={estilo(respBtnStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
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
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "13px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9" />
</svg>
<span style={{ flex: "1 1 auto", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Origem
</span>
<span title="Registrada na entrada do lead · não editável" style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "4px", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#67787c", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
 {origemSelo} 
</span>
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
{(temCad) ? (<>
<button onClick={pausar} style={{ display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M10 4v16M14 4v16" />
</svg>
<span>
{pausarLabel}
</span>
</button>
</>) : null}
<button onClick={trocarCad} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
{trocarLabel}
</button>
{(temCad) ? (<>
<button onClick={removerCad} style={{ height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #f0d5cf", color: "#c2330f", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
Remover
</button>
</>) : null}
</div>
</section>
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
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 12px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Pulso da conta
</span>
<span style={estilo(pulso.seloStyle)}>
{pulso.selo}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
{(pulso.sinais ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<div style={estilo(s.caixa)}>
<span style={estilo(s.ponto)} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", lineHeight: "1.4", textWrap: "pretty" }}>
{s.texto}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap", color: "#4a5560" }}>
{s.valor}
</span>
</div>
</Fragment>
))}
</div>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#8b949e", marginBottom: "4px" }}>
ÚLTIMO TOQUE POR PESSOA
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(pulso.pessoas ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.abrir} style={estilo(p.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ position: "relative", flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "9.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
 {p.iniciais} 
<span style={estilo(p.ponto)} />
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.ultimo}
</span>
</span>
<span style={estilo(p.quandoStyle)}>
{p.quando}
</span>
</button>
</Fragment>
))}
</div>
</section>
</div>
</>) : null}
</div>
</div>
{(enr.aberto) ? (<>
<div data-r="modal-fundo" onClick={enr.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "54", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "600px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px -12px rgba(0,0,0,.35)", animation: "of-rise .18s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", padding: "18px 20px 14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "10px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 5c0 1.66-4 3-9 3S3 6.66 3 5s4-3 9-3 9 1.34 9 3zM3 5v14c0 1.66 4 3 9 3M21 5v6M3 12c0 1.66 4 3 9 3M18 15v6M15 18h6" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", lineHeight: "1.25" }}>
Enriquecer {nome}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", marginTop: "3px" }}>
{enr.sub}
</div>
</div>
<button onClick={enr.fechar} style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} title="Fechar" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: "0 20px 18px" }}>
{(enr.passoConfig) ? (<>
<div style={{ borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(enr.itens ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={estilo(o.bloco)}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "13px 14px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={o.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", lineHeight: "1.3" }}>
{o.label}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "2px", lineHeight: "1.4", textWrap: "pretty" }}>
{o.nota}
</span>
</span>
<span style={estilo(o.trilho)}>
<span style={estilo(o.bolinha)} />
</span>
</button>
{(o.temFiltros) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px", padding: "0 14px 14px 58px" }}>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Áreas
</div>
<button data-of-earea="1" onClick={enr.abrirAreas} style={estilo(enr.areasBtn)} className={[hover("box-shadow:inset 0 0 0 1px #b9bfbc")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", textAlign: "left", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{enr.areasResumo}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Senioridade
</div>
<button data-of-enivel="1" onClick={enr.abrirNivel} style={estilo(enr.nivelBtn)} className={[hover("box-shadow:inset 0 0 0 1px #b9bfbc")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", textAlign: "left", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{enr.nivelResumo}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</>) : null}
{(enr.passoBusca) ? (<>
<div style={{ padding: "44px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
<div style={{ width: "180px", height: "4px", borderRadius: "9999px", background: "#eeeff3", overflow: "hidden" }}>
<div style={estilo(enr.barra)} />
</div>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{enr.etapaBusca}
</div>
<div style={{ fontSize: "12px", color: "#67787c" }}>
Consultando Apollo por {nome}
</div>
</div>
</>) : null}
{(enr.passoConfirmar) ? (<>
<div style={{ display: "flex", alignItems: "flex-start", gap: "11px", padding: "14px", borderRadius: "12px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #fadfd8", marginBottom: "14px" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
{enr.avisoTitulo}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", lineHeight: "1.5", marginTop: "3px", textWrap: "pretty" }}>
Créditos consumidos não são devolvidos, mesmo que o dado revelado esteja desatualizado.
</span>
</span>
</div>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(enr.resumoCusto ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<div style={estilo(r.linha)}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c" }}>
{r.label}
</span>
<span style={{ flex: "0 0 auto", fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{r.conta}
</span>
<span style={{ flex: "0 0 64px", textAlign: "right", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{r.total}
</span>
</div>
</Fragment>
))}
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", borderTop: "1px solid #e3e7e8", background: "#fafafa" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "700", color: "#12171d" }}>
Total
</span>
<span style={{ flex: "0 0 auto", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#c2330f", whiteSpace: "nowrap" }}>
{enr.custoTxt}
</span>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", padding: "12px 14px", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#4a5560" }}>
Saldo Apollo
</span>
<span style={{ flex: "0 0 auto", fontSize: "13px", fontWeight: "600", color: "#67787c", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{enr.saldoAntes}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
<span style={{ flex: "0 0 auto", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{enr.saldoDepois}
</span>
</div>
</>) : null}
{(enr.passoResultado) ? (<>
{(enr.temCampos) ? (<>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "2px 0 8px" }}>
<span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
Dados da empresa
</span>
<span style={{ flex: "1" }} />
<span style={{ minWidth: "0", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{enr.camposConta}
</span>
</div>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden", marginBottom: "16px" }}>
{(enr.campos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<button onClick={c.onClick} style={estilo(c.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(c.caixa)}>
{(c.on) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "0 0 108px", fontSize: "12px", color: "#67787c", textAlign: "left" }}>
{c.label}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.novo}
</span>
{(c.temAtual) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: "line-through" }}>
{c.atual}
</span>
</>) : null}
</span>
<span style={estilo(c.seloStyle)}>
{c.selo}
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
{(enr.temContatos) ? (<>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "2px 0 8px" }}>
<span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
Contatos encontrados
</span>
<span style={{ flex: "1" }} />
<span style={{ minWidth: "0", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{enr.contatosConta}
</span>
</div>
{(enr.semContatos) ? (<>
<div style={{ padding: "22px 12px", textAlign: "center", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Nenhum contato novo encontrado
</div>
<div style={{ fontSize: "12px", color: "#4a5560", marginTop: "4px", textWrap: "pretty" }}>
Todos os contatos dessas áreas já estão vinculados. Tente outras áreas ou senioridade.
</div>
<button onClick={enr.reiniciar} style={{ marginTop: "12px", height: "30px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Reiniciar demonstração
</button>
</div>
</>) : null}
<div style={estilo(enr.listaContatosStyle)}>
{(enr.contatos ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.onClick} style={estilo(p.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(p.caixa)}>
{(p.on) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#eeeff3", color: "#616b78", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{p.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.cargo}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", minWidth: "0" }}>
<span style={estilo(p.emailStyle)}>
{p.emailTxt}
</span>
<span style={estilo(p.telStyle)}>
{p.telTxt}
</span>
</span>
</span>
<span style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
<span style={estilo(p.seloStyle)}>
{p.selo}
</span>
<span style={{ display: "flex", gap: "4px" }}>
<span onClick={p.revEmail} style={estilo(p.revEmailStyle)}>
{p.revEmailLabel}
</span>
<span onClick={p.revTel} style={estilo(p.revTelStyle)}>
{p.revTelLabel}
</span>
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</>) : null}
</div>
<div style={{ flex: "0 0 auto", padding: "12px 20px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
<span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
{enr.creditos} créditos
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
Apollo
</span>
{(enr.podeReiniciar) ? (<>
<button onClick={enr.reiniciar} title="Remove os contatos e dados trazidos do Apollo e devolve os créditos" style={{ flex: "0 0 auto", height: "20px", padding: "0 6px", borderRadius: "5px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#67787c", whiteSpace: "nowrap", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }} className={[hover("color:#12171d;background:#f1f3f3")].filter(Boolean).join(" ")}>
Reiniciar demo
</button>
</>) : null}
</span>
<span style={{ fontSize: "11px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{enr.rodape}
</span>
</span>
{(enr.podeVoltar) ? (<>
<button onClick={enr.voltar} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Voltar
</button>
</>) : null}
<button onClick={enr.fechar} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={enr.acao} style={estilo(enr.acaoStyle)}>
{enr.acaoLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(enr.areasAberto) ? (<>
<div data-of-earea="1" style={estilo(enr.areasMenuStyle)}>
{(enr.areas ?? []).map((o: any, i1: number) => (
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
</>) : null}
{(enr.nivelAberto) ? (<>
<div data-of-enivel="1" style={estilo(enr.nivelMenuStyle)}>
{(enr.niveis ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", height: "34px", padding: "0 8px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
{o.label}
</span>
{(o.on) ? (<>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12171d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
{(edAberto) ? (<>
<div data-r="modal-fundo" onClick={edFechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "53", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "520px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px -12px rgba(0,0,0,.35)", animation: "of-rise .18s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", padding: "18px 20px 14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "10px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={edIcone} />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d", lineHeight: "1.25" }}>
{edTitulo}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", marginTop: "3px", textWrap: "pretty" }}>
{edSub}
</div>
</div>
<button onClick={edFechar} style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} title="Fechar" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "0 20px 18px" }}>
<div style={{ borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(edCampos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<div style={estilo(c.linha)}>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{c.label}
</span>
<span style={{ flex: "1", minWidth: "0" }} />
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{c.ajuda}
</span>
</div>
{(c.ehTexto) ? (<>
<input value={c.valor} onChange={c.set} placeholder={c.dica} style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "9px", border: "0", boxShadow: "inset 0 0 0 1px #dbdede", outline: "0", fontSize: "13px", background: "#fff" }} className={[foco("box-shadow:inset 0 0 0 1.5px #12171d")].filter(Boolean).join(" ")} />
</>) : null}
{(c.ehSeg) ? (<>
<div style={estilo(c.segGrid)}>
{(c.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<button onClick={o.onClick} style={estilo(o.segStyle)}>
{o.label}
</button>
</Fragment>
))}
</div>
</>) : null}
{(c.ehChips) ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(c.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<button onClick={o.onClick} style={estilo(o.chipStyle)}>
<span style={estilo(o.caixa)}>
{(o.on) ? (<>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span>
{o.label}
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 20px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", justifyContent: "flex-end" }}>
<button onClick={edFechar} style={{ height: "36px", padding: "0 15px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={edSalvar} style={{ height: "36px", padding: "0 16px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
{edBotao}
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
<div data-of-etag="1" style={estilo(tagMenuStyle)}>
<div style={{ flex: "0 0 auto", fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c", padding: "7px 8px 5px" }}>
TAGS DA EMPRESA
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
{(tagOpcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", minHeight: "36px", padding: "6px 8px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={estilo(o.caixa)}>
{(o.on) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
{o.label}
</span>
{(o.temFluxo) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
<span>
Dispara {o.fluxo}
</span>
</span>
</>) : null}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ flex: "0 0 auto", display: "flex", gap: "6px", padding: "8px 4px 4px", marginTop: "4px", borderTop: "1px solid #eef1f1" }}>
<input value={tagNova} onChange={setTagNova} onKeyDown={teclaTag} placeholder="Criar nova tag" style={{ flex: "1", minWidth: "0", height: "32px", padding: "0 10px", borderRadius: "7px", border: "0", boxShadow: "inset 0 0 0 1px #dbdede", outline: "0", fontSize: "12.5px", background: "#fff" }} />
<button onClick={criarTag} style={estilo(criarTagStyle)}>
Criar
</button>
</div>
</div>
</>) : null}
{(etapaAberto) ? (<>
<div data-of-eetapa="1" style={estilo(etapaMenuStyle)}>
<div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#67787c", padding: "7px 8px 5px" }}>
MOVER PARA
</div>
{(etapaOpcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", minHeight: "34px", padding: "6px 8px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={estilo(o.ponto)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }}>
{o.label}
</span>
{(o.temNota) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap" }}>
{o.nota}
</span>
</>) : null}
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
{(respAberto) ? (<>
<div data-of-eresp="1" style={estilo(respMenuStyle)}>
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
{(maisAberto) ? (<>
<div data-of-emais="1" style={estilo(maisStyle)}>
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
{(no.aberto) ? (<>
<div data-r="modal-fundo" onClick={no.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "56", display: "grid", placeItems: "center", padding: "20px" }}>
<div onClick={parar} data-in="pop" style={{ width: "560px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(18,23,29,.28)" }}>
<div style={{ flex: "0 0 auto", padding: "18px 20px 12px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
Nova oportunidade
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#4a5560" }}>
{no.sub}
</span>
</span>
<button onClick={no.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "4px 20px 18px", display: "grid", gap: "16px", alignContent: "start" }}>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Tipo
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
{(no.tipos ?? []).map((tp: any, i1: number) => (
<Fragment key={tp?.id ?? tp?.chave ?? i1}>
<button onClick={tp.onClick} style={estilo(tp.style)}>
<span style={estilo(tp.ico)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={tp.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#12171d" }}>
{tp.l}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "11.5px", color: "#67787c", lineHeight: "1.4", textWrap: "pretty" }}>
{tp.s}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
{(no.temOrigem) ? (<>
<div>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Contrato de origem
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{no.origemT}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e", marginTop: "1px" }}>
{no.origemS}
</span>
</span>
</div>
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px" }}>
<div style={{ minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Produto
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{no.famLabel}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={no.familia} onChange={no.setFamilia} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(no.familias ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
<div style={{ minWidth: "0" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Closer
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{no.resp}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={no.resp} onChange={no.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(no.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
<div style={{ minWidth: "0", gridColumn: "1 / -1" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Contato
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 12px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{no.contato}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={no.contato} onChange={no.setContato} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(no.contatos ?? []).map((op: any, i1: number) => (
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
<span style={{ display: "flex", gap: "3px", fontSize: "12px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
O que o cliente quer
</span>
<textarea value={no.nota} onChange={no.setNota} placeholder={no.notaDica} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.5", color: "#12171d" }} />
</label>
{(no.temAviso) ? (<>
<span style={{ display: "flex", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span>
{no.aviso}
</span>
</span>
</>) : null}
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={no.fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={no.criar} style={estilo(no.criarStyle)}>
{no.criarTxt}
</button>
</div>
</div>
</div>
</>) : null}
{(exc.aberto) ? (<>
<div data-r="modal-fundo" onClick={exc.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.45)", zIndex: "55", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "460px", maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "13px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px -12px rgba(0,0,0,.35)" }}>
<div style={{ flex: "0 0 auto", padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: "11px" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15.5px", fontWeight: "700", letterSpacing: "-.015em", color: "#12171d" }}>
Excluir registro
</div>
<div style={{ fontSize: "12px", color: "#4a5560", lineHeight: "1.45", marginTop: "2px", textWrap: "pretty" }}>
Essa ação não pode ser desfeita.
</div>
</div>
<button onClick={exc.fechar} style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} title="Fechar" className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div>
<div style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
O que excluir *
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(exc.alvos ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
<span style={estilo(o.radio)} />
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{o.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", marginTop: "2px", lineHeight: "1.4", textWrap: "pretty" }}>
{o.nota}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Motivo *
</div>
<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
{(exc.motivos ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)}>
{m.label}
</button>
</Fragment>
))}
</div>
{(exc.erroMotivo) ? (<>
<div style={{ fontSize: "11.5px", color: "#c2330f", marginTop: "5px" }}>
Escolha um motivo.
</div>
</>) : null}
</div>
<div>
<div style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
{exc.obsLabel}
</div>
<textarea value={exc.obs} onChange={exc.setObs} rows={2} placeholder="Detalhe para o histórico" style={estilo(exc.obsStyle)} />
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "7px", justifyContent: "flex-end" }}>
<button onClick={exc.fechar} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", border: "0", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={exc.confirmar} style={{ height: "34px", padding: "0 15px", borderRadius: "8px", border: "0", background: "#c2330f", color: "#fff", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap", cursor: "pointer" }} className={[hover("background:#9c3210")].filter(Boolean).join(" ")}>
{exc.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(chamada) ? (<>
<div data-r="barra-massa" style={{ position: "fixed", left: "50%", bottom: "22px", transform: "translateX(-50%)", zIndex: "60", display: "flex", alignItems: "center", gap: "12px", padding: "10px 10px 10px 14px", borderRadius: "12px", background: "#12171d", color: "#fff", boxShadow: "0 18px 40px -10px rgba(0,0,0,.45)", animation: "of-fade .16s ease-out both" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "#1f7256", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
{chamadaNome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#a3aab3", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{chamadaTempo}
</span>
</span>
<button onClick={encerrar} style={{ flex: "0 0 auto", height: "32px", padding: "0 13px", borderRadius: "8px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Encerrar
</button>
</div>
</>) : null}
</div>



    </>
  );
}
