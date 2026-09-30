"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Contatos.dc.html
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
import "./ContatosDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeContatosDesenho {
  abas: any;
  abrirImportar: any;
  abrirNovo: any;
  abrirVisoes: any;
  cabCheck: any;
  cancelarVisao: any;
  cardSub: any;
  cardTitulo: any;
  cardTotal: any;
  confirmarVisao: any;
  confirmarVisaoStyle: any;
  fecharModal: any;
  fecharPainel: any;
  filtros: any;
  gradeCab: any;
  limparFiltros: any;
  limparQ: any;
  limparSelecao: any;
  linhas: any;
  m: any;
  marcarPagina: any;
  massaExportar: any;
  massaResp: any;
  massaTag: any;
  naoSalvando: any;
  nomeVisao: any;
  nomesEmpresas: any;
  novoChev: any;
  novoStyle: any;
  ordenarNome: any;
  ordenarUltima: any;
  p: any;
  paginaMarcada: any;
  paginaParcial: any;
  painelStyle: any;
  parar: any;
  pop: any;
  popVisStyle: any;
  q: any;
  salvando: any;
  salvarVisao: any;
  salvarVisaoDica: any;
  salvarVisaoStyle: any;
  salvas: any;
  selecaoTexto: any;
  setNomeVisao: any;
  setQ: any;
  setaNome: any;
  setaUltima: any;
  teclaVisao: any;
  temFiltro: any;
  temModal: any;
  temPainel: any;
  temPop: any;
  temPopVis: any;
  temQ: any;
  temSalvas: any;
  temSelecao: any;
  vazio: any;
  visBtn: any;
  visoes: any;
}

export function ContatosDesenho(vals: ValoresDeContatosDesenho) {
  const { abas, abrirImportar, abrirNovo, abrirVisoes, cabCheck, cancelarVisao, cardSub, cardTitulo, cardTotal, confirmarVisao, confirmarVisaoStyle, fecharModal, fecharPainel, filtros, gradeCab, limparFiltros, limparQ, limparSelecao, linhas, m, marcarPagina, massaExportar, massaResp, massaTag, naoSalvando, nomeVisao, nomesEmpresas, novoChev, novoStyle, ordenarNome, ordenarUltima, p, paginaMarcada, paginaParcial, painelStyle, parar, pop, popVisStyle, q, salvando, salvarVisao, salvarVisaoDica, salvarVisaoStyle, salvas, selecaoTexto, setNomeVisao, setQ, setaNome, setaUltima, teclaVisao, temFiltro, temModal, temPainel, temPop, temPopVis, temQ, temSalvas, temSelecao, vazio, visBtn, visoes } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<div data-r="toolbar" data-stagger="40" data-stagger-tipo="fade-down" style={{ flex: "0 0 auto", padding: "14px 14px 0", display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
<div data-ct-pop="1" style={estilo(visBtn.grupo)}>
<button onClick={abrirVisoes} style={estilo(visBtn.corpo)} className={[hover(visBtn.hover)].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={visBtn.d} />
</svg>
<span style={{ whiteSpace: "nowrap", maxWidth: "190px", overflow: "hidden", textOverflow: "ellipsis" }}>
{visBtn.label}
</span>
</button>
<span style={estilo(visBtn.div)} />
<button onClick={abrirVisoes} title="Trocar visão" style={estilo(visBtn.seta)} className={[hover(visBtn.hover)].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={estilo(visBtn.chev)}>
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
</div>
<div data-r="busca" style={{ display: "flex", alignItems: "center", gap: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", borderRadius: "9px", padding: "0 11px", height: "34px", flex: "1 1 200px", maxWidth: "290px", minWidth: "150px" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={q} onChange={setQ} placeholder="Nome, empresa, e-mail ou telefone" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "13px", minWidth: "0" }} />
{(temQ) ? (<>
<button onClick={limparQ} title="Limpar busca" style={{ flex: "0 0 auto", width: "20px", height: "20px", borderRadius: "9999px", border: "0", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</>) : null}
</div>
{(filtros ?? []).map((fl: any, i1: number) => (
<Fragment key={fl?.id ?? fl?.chave ?? i1}>
<div data-ct-pop="1" style={estilo(fl.grupo)}>
<button onClick={fl.onClick} style={estilo(fl.corpo)} className={[hover(fl.hover)].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={fl.d} />
</svg>
<span style={{ whiteSpace: "nowrap" }}>
{fl.label}
</span>
{(fl.temN) ? (<>
<span style={estilo(fl.conta)}>
{fl.n}
</span>
</>) : null}
</button>
<span style={estilo(fl.div)} />
<button onClick={fl.onClick} title="Abrir opções" style={estilo(fl.seta)} className={[hover(fl.hover)].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={estilo(fl.chev)}>
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
</div>
</Fragment>
))}
{(temFiltro) ? (<>
<button onClick={limparFiltros} style={{ height: "34px", padding: "0 10px", borderRadius: "9px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
Limpar
</button>
</>) : null}
<span style={{ flex: "1", minWidth: "8px" }} />
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px", flex: "0 0 auto", height: "34px", alignItems: "stretch" }}>
{(abas ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={estilo(a.style)}>
<span>
{a.label}
</span>
<span style={estilo(a.nStyle)}>
{a.n}
</span>
</button>
</Fragment>
))}
</div>
<button onClick={abrirImportar} title="Importar CSV" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 12px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
</svg>
<span>
Importar
</span>
</button>
<button data-ct-pop="1" onClick={abrirNovo} style={estilo(novoStyle)} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Novo
</span>
<span style={{ width: "1px", alignSelf: "stretch", margin: "8px 1px", background: "rgba(255,255,255,.34)" }} />
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={estilo(novoChev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", display: "flex", gap: "12px", padding: "12px 14px 14px", position: "relative" }}>
<div data-in="rise" data-delay="80" style={{ flex: "1 1 auto", minWidth: "0", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "9px", padding: "11px 14px", borderBottom: "1px solid #eef1f1", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap" }}>
{cardTitulo}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cardSub}
</span>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap", flex: "0 0 auto" }}>
{cardTotal}
</span>
</div>
<div style={{ flex: "1", minHeight: "0", overflow: "auto" }}>
<div data-stagger="28" style={{ minWidth: "1060px" }}>
<div style={estilo(gradeCab)}>
<button onClick={marcarPagina} title="Selecionar todos" style={estilo(cabCheck)}>
{(paginaMarcada) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
{(paginaParcial) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round">
<path d="M6 12h12" />
</svg>
</>) : null}
</button>
<button onClick={ordenarNome} style={{ display: "flex", alignItems: "center", gap: "5px", border: "0", background: "transparent", padding: "0", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".05em", color: "#4a5560", cursor: "pointer" }}>
<span>
NOME
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={estilo(setaNome)}>
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
<span>
RELACIONAMENTO
</span>
<span>
VÍNCULO
</span>
<span>
RESPONSÁVEL
</span>
<span>
ORIGEM
</span>
<button onClick={ordenarUltima} style={{ display: "flex", alignItems: "center", gap: "5px", border: "0", background: "transparent", padding: "0", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".05em", color: "#4a5560", cursor: "pointer" }}>
<span>
ÚLTIMA INTERAÇÃO
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={estilo(setaUltima)}>
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
<span />
</div>
{(linhas ?? []).map((r: any, i1: number) => (
<Fragment key={r?.id ?? r?.chave ?? i1}>
<div onClick={r.abrir} onMouseEnter={r.entrar} onMouseLeave={r.sair} style={estilo(r.linha)}>
<button onClick={r.marcar} style={estilo(r.check)}>
{(r.marcado) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
<span style={estilo(r.nomeCel)}>
{(r.aninhado) ? (<>
<span style={estilo(r.galho)} />
</>) : null}
<span style={estilo(r.avatar)}>
{r.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={estilo(r.nomeStyle)}>
{r.nome}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: "#67787c", marginTop: "1px", minWidth: "0" }}>
{(r.ehEmpresa) ? (<>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
</svg>
</>) : null}
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.sub}
</span>
</span>
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: "0" }}>
<span style={estilo(r.relStyle)}>
{r.rel}
</span>
{(r.temOpp) ? (<>
<span title={r.oppDica} style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "6px", background: "#e6f4ee", color: "#1f7256", display: "grid", placeItems: "center" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
</svg>
</span>
</>) : null}
</span>
<span style={{ display: "flex", alignItems: "center", minWidth: "0" }}>
{(r.temEmp) ? (<>
<button onClick={r.irEmpresa} style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0", height: "28px", padding: "0 8px 0 3px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f3f4f4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "6px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "9px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{r.empIni}
</span>
<span style={{ minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.emp}
</span>
</button>
</>) : null}
{(r.temExp) ? (<>
<button onClick={r.expandir} style={estilo(r.expStyle)} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
</svg>
<span>
{r.expLabel}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(r.expChev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</>) : null}
{(r.semVinc) ? (<>
<span style={{ fontSize: "12.5px", color: "#a3a8a4", paddingLeft: "4px" }}>
{r.vincVazio}
</span>
</>) : null}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<span style={estilo(r.respAvatar)}>
{r.respIni}
</span>
<span style={estilo(r.respStyle)}>
{r.resp}
</span>
</span>
<span style={{ fontSize: "12.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.origem}
</span>
<span style={{ display: "flex", alignItems: "center", minWidth: "0" }}>
{(r.semHover) ? (<>
<span style={{ fontSize: "12.5px", color: "#4a5560", whiteSpace: "nowrap" }}>
{r.ultima}
</span>
</>) : null}
{(r.comHover) ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "4px", animation: "ctIn .12s ease-out both" }}>
{(r.rapidas ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} title={ac.label} style={{ width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#12171d;color:#fff;box-shadow:none")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ac.d} />
</svg>
</button>
</Fragment>
))}
</span>
</>) : null}
</span>
<button data-ct-pop="1" onClick={r.menu} title="Ações" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
<circle cx="5" cy="12" r="1.6" />
<circle cx="12" cy="12" r="1.6" />
<circle cx="19" cy="12" r="1.6" />
</svg>
</button>
</div>
</Fragment>
))}
{(vazio) ? (<>
<div style={{ padding: "56px 16px", textAlign: "center" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
Nada encontrado
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "4px" }}>
Ajuste a busca, a visão ou limpe os filtros.
</div>
</div>
</>) : null}
</div>
</div>
</div>
{(temPainel) ? (<>
<aside data-r="drawer" data-in="slide-left" style={estilo(painelStyle)}>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden" }}>
<div style={{ padding: "14px 16px 14px", background: "#fe4f2b" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={p.tipoD} />
</svg>
<span style={{ flex: "1", fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#fff" }}>
{p.tipo}
</span>
<button onClick={fecharPainel} title="Fechar" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:rgba(120,25,5,.32)")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
<span style={estilo(p.avatar)}>
{p.ini}
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#fff", lineHeight: "1.2", textWrap: "balance" }}>
{p.nome}
</div>
<div style={{ fontSize: "12.5px", fontWeight: "500", color: "#fff", marginTop: "3px" }}>
{p.sub}
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
<span style={estilo(p.relStyle)}>
{p.rel}
</span>
</div>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "6px", marginTop: "14px" }}>
{(p.acoes ?? []).map((ac: any, i1: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i1}>
<button onClick={ac.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", height: "58px", minWidth: "0", padding: "0 6px", borderRadius: "10px", border: "0", background: "rgba(120,25,5,.2)", boxShadow: "none", fontSize: "11.5px", fontWeight: "600", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fff;color:#c2330f;transform:translateY(-2px);box-shadow:0 8px 18px -8px rgba(120,25,5,.45)")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d={ac.d} />
</svg>
<span>
{ac.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div style={{ background: "#fe4f2b", padding: "0 16px 16px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", background: "rgba(120,25,5,.2)", borderRadius: "12px" }}>
{(p.resumo ?? []).map((rs: any, i1: number) => (
<Fragment key={rs?.id ?? rs?.chave ?? i1}>
<div style={estilo(rs.style)}>
<div data-count="1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
{rs.valor}
</div>
<div style={{ fontSize: "11px", color: "rgba(255,255,255,.86)", marginTop: "2px", whiteSpace: "nowrap" }}>
{rs.label}
</div>
</div>
</Fragment>
))}
</div>
</div>
<div data-stagger="45" data-stagger-tipo="rise" style={{ padding: "18px 16px 16px", display: "flex", flexDirection: "column", gap: "18px" }}>
{(p.ehPessoa) ? (<>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: ".05em", textTransform: "uppercase", color: "#67787c", marginBottom: "7px" }}>
Empresa vinculada
</div>
{(p.temEmp) ? (<>
<button onClick={p.irEmpresa} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#12171d", color: "#12171d", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "12px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{p.empIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.emp}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{p.segmento}
</span>
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</>) : null}
{(p.semEmp) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", border: "1px dashed #dbdede", fontSize: "12.5px", color: "#4a5560" }}>
Sem empresa vinculada
</div>
</>) : null}
</div>
</>) : null}
{(p.ehEmpresa) ? (<>
<div>
<div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
<span style={{ flex: "1", fontSize: "11px", fontWeight: "600", letterSpacing: ".05em", textTransform: "uppercase", color: "#67787c" }}>
{p.pessoasTitulo}
</span>
<button onClick={p.addPessoa} style={{ display: "flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 8px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#12171d", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar
</span>
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(p.pessoas ?? []).map((pp: any, i1: number) => (
<Fragment key={pp?.id ?? pp?.chave ?? i1}>
<button onClick={pp.abrir} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 10px", border: "0", background: "transparent", boxShadow: "inset 0 -1px 0 #eef1f1", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa;box-shadow:inset 0 0 0 1px #eef1f1")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", background: "linear-gradient(180deg,#f6f6f3,#eceeee)", color: "#1f252c", boxShadow: "inset 0 0 0 1px #e3e7e8", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{pp.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pp.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{pp.cargo}
</span>
</span>
<span style={estilo(pp.relStyle)}>
{pp.rel}
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
<div>
<div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: ".05em", textTransform: "uppercase", color: "#67787c", marginBottom: "4px" }}>
Contato
</div>
{(p.dados ?? []).map((dd: any, i1: number) => (
<Fragment key={dd?.id ?? dd?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "34px", boxShadow: "inset 0 -1px 0 #eef1f1" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={dd.d} />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{dd.valor}
</span>
{(dd.copia) ? (<>
<button onClick={dd.copiar} title="Copiar" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "6px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 9h11v11H9zM5 15H4V4h11v1" />
</svg>
</button>
</>) : null}
</div>
</Fragment>
))}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
<button data-ct-pop="1" onClick={p.trocarResp} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "7px", padding: "10px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", textAlign: "left", minWidth: "0" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "4px", width: "100%", fontSize: "11px", fontWeight: "600", color: "#67787c" }}>
<span style={{ flex: "1" }}>
Responsável
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0", width: "100%" }}>
<span style={estilo(p.respAvatar)}>
{p.respIni}
</span>
<span style={estilo(p.respStyle)}>
{p.resp}
</span>
</span>
</button>
<div style={{ display: "flex", flexDirection: "column", gap: "7px", padding: "10px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", minWidth: "0" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#67787c" }}>
Origem
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.origem}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "1px" }}>
{p.campanha}
</span>
</span>
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: ".05em", textTransform: "uppercase", color: "#67787c", marginBottom: "7px" }}>
Próxima ação
</div>
<div onClick={p.verAcao} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{p.acao}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{p.acaoQuando}
</span>
</span>
<button onClick={p.acaoBtn} style={estilo(p.acaoBtnStyle)} className={[hover(p.acaoBtnHover)].filter(Boolean).join(" ")}>
{p.acaoBtnLabel}
</button>
</div>
</div>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: ".05em", textTransform: "uppercase", color: "#67787c", marginBottom: "6px" }}>
{p.oppTitulo}
</div>
{(p.opps ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{op.titulo}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#12171d", fontWeight: "700" }}>
{op.etapa}
</span>
</div>
</Fragment>
))}
{(p.semOpps) ? (<>
<div style={{ fontSize: "12.5px", color: "#67787c" }}>
Nenhuma oportunidade aberta.
</div>
</>) : null}
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", padding: "12px 16px", boxShadow: "inset 0 1px 0 #eef1f1" }}>
<button onClick={p.abrirPagina} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", width: "100%", height: "36px", borderRadius: "9px", border: "0", background: "#12171d", fontSize: "12.5px", fontWeight: "600", color: "#fff", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<span style={{ whiteSpace: "nowrap" }}>
{p.abrirLabel}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
</aside>
</>) : null}
</div>
{(temSelecao) ? (<>
<div data-r="barra-massa" style={{ position: "fixed", left: "50%", bottom: "22px", transform: "translateX(-50%)", zIndex: "40", display: "flex", alignItems: "center", gap: "4px", padding: "5px 5px 5px 14px", borderRadius: "12px", background: "#12171d", boxShadow: "0 18px 40px -12px rgba(18,23,29,.45)" }} data-in="rise-up">
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", paddingRight: "8px" }}>
{selecaoTexto}
</span>
<button data-ct-pop="1" onClick={massaResp} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 11px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "500", color: "#eeeff3", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
</svg>
<span>
Alterar responsável
</span>
</button>
<button data-ct-pop="1" onClick={massaTag} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 11px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "500", color: "#eeeff3", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01" />
</svg>
<span>
Adicionar tag
</span>
</button>
<button onClick={massaExportar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 11px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "500", color: "#eeeff3", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
<span>
Exportar
</span>
</button>
<span style={{ width: "1px", height: "18px", background: "#2c343d", margin: "0 4px" }} />
<button onClick={limparSelecao} title="Limpar seleção" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#9aa4ae", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#1f252c;color:#fff")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</>) : null}
{(temPopVis) ? (<>
<div data-ct-pop="1" data-in="drop" style={estilo(popVisStyle)}>
<div style={{ padding: "8px 10px 6px", fontSize: "11px", fontWeight: "600", letterSpacing: ".04em", color: "#4a5560" }}>
Visões
</div>
{(visoes ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.onClick} style={estilo(v.style)} className={[hover(v.hover)].filter(Boolean).join(" ")}>
<span style={estilo(v.tile)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d={v.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.nota}
</span>
</span>
<span style={estilo(v.nStyle)}>
{v.n}
</span>
</button>
</Fragment>
))}
{(temSalvas) ? (<>
<div style={{ height: "1px", background: "#eef1f1", margin: "6px -6px" }} />
<div style={{ padding: "6px 10px 6px", fontSize: "11px", fontWeight: "600", letterSpacing: ".04em", color: "#4a5560" }}>
Salvas por você
</div>
{(salvas ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
<button onClick={v.onClick} style={estilo(v.style)} className={[hover(v.hover)].filter(Boolean).join(" ")}>
<span style={estilo(v.tile)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.nota}
</span>
</span>
</button>
<button onClick={v.remover} title="Excluir visão" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
</svg>
</button>
</div>
</Fragment>
))}
</>) : null}
<div style={{ height: "1px", background: "#eef1f1", margin: "6px -6px" }} />
{(salvando) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "6px 6px 4px" }}>
<input value={nomeVisao} onChange={setNomeVisao} onKeyDown={teclaVisao} placeholder="Nome da visão" autoFocus={true} style={{ width: "100%", height: "36px", padding: "0 11px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #12171d", fontSize: "13px", color: "#12171d" }} />
<div style={{ display: "flex", gap: "6px" }}>
<button onClick={cancelarVisao} style={{ flex: "1", height: "34px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={confirmarVisao} style={estilo(confirmarVisaoStyle)}>
Salvar visão
</button>
</div>
</div>
</>) : null}
{(naoSalvando) ? (<>
<button onClick={salvarVisao} title={salvarVisaoDica} style={estilo(salvarVisaoStyle)} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Salvar visão atual
</span>
</button>
</>) : null}
</div>
</>) : null}
{(temPop) ? (<>
<div data-ct-pop="1" data-in="drop" style={estilo(pop.style)}>
{(pop.temTitulo) ? (<>
<div style={{ padding: "6px 8px 4px", fontSize: "11px", fontWeight: "600", color: "#67787c" }}>
{pop.titulo}
</div>
</>) : null}
{(pop.itens ?? []).map((it: any, i1: number) => (
<Fragment key={it?.id ?? it?.chave ?? i1}>
<button onClick={it.onClick} style={estilo(it.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
{(it.temCheck) ? (<>
<span style={estilo(it.check)}>
{(it.on) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
</>) : null}
{(it.temIco) ? (<>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={it.d} />
</svg>
</>) : null}
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.label}
</span>
{(it.temNota) ? (<>
<span style={estilo(it.notaStyle)}>
{it.nota}
</span>
</>) : null}
</span>
{(it.temN) ? (<>
<span style={{ fontSize: "11px", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{it.n}
</span>
</>) : null}
</button>
</Fragment>
))}
{(pop.temCriar) ? (<>
<div style={{ marginTop: "4px", padding: "6px 4px 2px", boxShadow: "inset 0 1px 0 #eef1f1", display: "flex", gap: "6px" }}>
<input value={pop.novaTag} onChange={pop.setNovaTag} onKeyDown={pop.teclaNova} placeholder="Criar nova tag" style={{ flex: "1", minWidth: "0", height: "32px", padding: "0 10px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d" }} />
<button onClick={pop.criar} style={estilo(pop.criarStyle)}>
Criar
</button>
</div>
</>) : null}
{(pop.temLimpar) ? (<>
<div style={{ marginTop: "4px", paddingTop: "4px", boxShadow: "inset 0 1px 0 #eef1f1" }}>
<button onClick={pop.limpar} style={{ width: "100%", height: "30px", borderRadius: "6px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f6f6f3;color:#12171d")].filter(Boolean).join(" ")}>
Limpar seleção
</button>
</div>
</>) : null}
</div>
</>) : null}
{(temModal) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fecharModal} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(520px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "14px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 0" }}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "9px", background: "#eeeff3", color: "#1f252c", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d={m.d} />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
{m.titulo}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "2px" }}>
{m.sub}
</div>
</div>
<button onClick={fecharModal} title="Fechar" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflow: "auto", padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px" }}>
{(m.passo2) ? (<>
<div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560" }}>
Para onde vai?
</span>
<div data-stagger="55" data-stagger-tipo="rise" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{(m.destinos ?? []).map((dt: any, i1: number) => (
<Fragment key={dt?.id ?? dt?.chave ?? i1}>
<button onClick={dt.onClick} style={estilo(dt.style)} className={[hover(dt.hover)].filter(Boolean).join(" ")}>
<span style={estilo(dt.ico)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d={dt.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{dt.label}
</span>
<span style={estilo(dt.relStyle)}>
{dt.rel}
</span>
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", marginTop: "2px", textWrap: "pretty" }}>
{dt.desc}
</span>
</span>
<span style={estilo(dt.radio)}>
{(dt.on) ? (<>
<span style={{ width: "8px", height: "8px", borderRadius: "9999px", background: "#fff" }} />
</>) : null}
</span>
</button>
</Fragment>
))}
</div>
{(m.temConfig) ? (<>
<div style={{ height: "1px", background: "#eef1f1", margin: "6px 0 2px" }} />
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560" }}>
{m.configTitulo}
</span>
</>) : null}
</div>
</>) : null}
{(m.campos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<label style={estilo(c.wrap)}>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
{c.label}
{(c.obrig) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
{(c.ehTexto) ? (<>
<input value={c.valor} onChange={c.set} placeholder={c.dica} list={c.lista} style={estilo(c.inputStyle)} />
</>) : null}
{(c.ehEscolha) ? (<>
<select value={c.valor} onChange={c.set} style={estilo(c.inputStyle)}>
{(c.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<option value={o.v}>
{o.l}
</option>
</Fragment>
))}
</select>
</>) : null}
{(c.temErro) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "4px" }}>
{c.erro}
</span>
</>) : null}
</label>
</Fragment>
))}
{(m.temPessoas) ? (<>
<div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "11.5px", fontWeight: "600", color: "#4a5560" }}>
{m.pessoasTitulo}
</span>
<button onClick={m.addPessoa} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar pessoa
</span>
</button>
</div>
{(m.pessoas ?? []).map((pz: any, i1: number) => (
<Fragment key={pz?.id ?? pz?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) auto", gap: "8px", padding: "10px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<input value={pz.nome} onChange={pz.setNome} placeholder="Nome *" style={estilo(pz.nomeStyle)} />
<input value={pz.cargo} onChange={pz.setCargo} placeholder="Cargo" style={{ width: "100%", height: "34px", padding: "0 10px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d" }} />
<button onClick={pz.remover} title="Remover pessoa" style={{ width: "34px", height: "34px", borderRadius: "8px", border: "0", background: "transparent", color: "#8b949e", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
</svg>
</button>
<input value={pz.email} onChange={pz.setEmail} placeholder="E-mail" style={{ width: "100%", height: "34px", padding: "0 10px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d" }} />
<input value={pz.tel} onChange={pz.setTel} placeholder="Telefone" style={{ width: "100%", height: "34px", padding: "0 10px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d" }} />
<span />
</div>
</Fragment>
))}
{(m.semPessoas) ? (<>
<button onClick={m.addPessoa} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "44px", borderRadius: "10px", border: "1px dashed #c9cfd1", background: "#fff", fontSize: "12.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("border-color:#12171d;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />
</svg>
<span>
Cadastrar pessoas junto com a empresa
</span>
</button>
</>) : null}
</div>
</>) : null}
{(m.temMapa) ? (<>
<div style={{ gridColumn: "1/-1", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px", padding: "8px 12px", background: "#fafafa", borderBottom: "1px solid #eef1f1", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".05em", color: "#4a5560" }}>
<span>
COLUNA DO ARQUIVO
</span>
<span>
CAMPO NO ONFACE
</span>
</div>
{(m.mapLinhas ?? []).map((ml: any, i1: number) => (
<Fragment key={ml?.id ?? ml?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ml.col}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ml.ex}
</span>
</span>
<select value={ml.valor} onChange={ml.set} style={estilo(ml.selStyle)}>
{(ml.opcoes ?? []).map((o: any, i2: number) => (
<Fragment key={o?.id ?? o?.chave ?? i2}>
<option value={o.v}>
{o.l}
</option>
</Fragment>
))}
</select>
</div>
</Fragment>
))}
</div>
</>) : null}
{(m.temRevisao) ? (<>
<div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px" }}>
{(m.stats ?? []).map((st: any, i1: number) => (
<Fragment key={st?.id ?? st?.chave ?? i1}>
<button onClick={st.onClick} style={estilo(st.style)}>
<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={estilo(st.ponto)} />
<span style={{ fontSize: "11.5px", fontWeight: "600", color: "#4a5560" }}>
{st.label}
</span>
</span>
<span data-count="1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "22px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", marginTop: "4px" }}>
{st.n}
</span>
<span style={{ fontSize: "11px", color: "#67787c", textWrap: "pretty" }}>
{st.nota}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 128px", gap: "10px", padding: "8px 12px", background: "#fafafa", borderBottom: "1px solid #eef1f1", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".05em", color: "#4a5560" }}>
<span>
{m.revTitulo}
</span>
<span>
CONTATO
</span>
<span>
SITUAÇÃO
</span>
</div>
<div data-stagger="24" style={{ maxHeight: "240px", overflowY: "auto" }}>
{(m.revLinhas ?? []).map((rl: any, i1: number) => (
<Fragment key={rl?.id ?? rl?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 128px", gap: "10px", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rl.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rl.emp}
</span>
</span>
<span style={{ minWidth: "0", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rl.contato}
</span>
<span style={{ minWidth: "0" }}>
<span style={estilo(rl.selo)}>
{rl.status}
</span>
{(rl.temMotivo) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={rl.motivo}>
{rl.motivo}
</span>
</>) : null}
</span>
</div>
</Fragment>
))}
{(m.revVazio) ? (<>
<div style={{ padding: "18px 12px", fontSize: "12.5px", color: "#67787c", textAlign: "center" }}>
Nada nesta categoria.
</div>
</>) : null}
</div>
</div>
{(m.temDup) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "180px", fontSize: "12.5px", color: "#1f252c" }}>
{m.dupTexto}
</span>
<div style={{ display: "flex", background: "#eeeff3", borderRadius: "9px", padding: "3px", gap: "2px" }}>
{(m.dupOps ?? []).map((dp: any, i1: number) => (
<Fragment key={dp?.id ?? dp?.chave ?? i1}>
<button onClick={dp.onClick} style={estilo(dp.style)}>
{dp.label}
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
</>) : null}
{(m.temResps) ? (<>
<div style={{ gridColumn: "1/-1" }}>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "3px" }}>
Responsáveis
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginBottom: "7px" }}>
{m.respsNota}
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(m.resps ?? []).map((rp: any, i1: number) => (
<Fragment key={rp?.id ?? rp?.chave ?? i1}>
<button onClick={rp.onClick} style={estilo(rp.style)}>
<span style={estilo(rp.av)}>
{rp.ini}
</span>
<span>
{rp.nome}
</span>
{(rp.on) ? (<>
<span style={{ fontSize: "11px", fontWeight: "700", opacity: ".75", fontVariantNumeric: "tabular-nums" }}>
{rp.qtd}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
{(m.respsErro) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "5px" }}>
Escolha pelo menos um responsável
</span>
</>) : null}
</div>
</>) : null}
{(m.temResumo) ? (<>
<div style={{ gridColumn: "1/-1", display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: "1px" }}>
<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />
</svg>
<span style={{ fontSize: "12.5px", color: "#1f252c", lineHeight: "1.5", textWrap: "pretty" }}>
{m.resumo}
</span>
</div>
</>) : null}
{(m.ehImportar) ? (<>
<div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "11px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<span style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "10px", background: "#e6f4ee", color: "#1f7256", display: "grid", placeItems: "center" }}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Planilha modelo
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", textWrap: "pretty" }}>
Colunas de pessoa e empresa já no formato certo · uma linha por pessoa
</span>
</span>
<button onClick={m.baixarModelo} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
</svg>
<span>
Baixar modelo
</span>
</button>
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
{(m.colunasModelo ?? []).map((cm: any, i1: number) => (
<Fragment key={cm?.id ?? cm?.chave ?? i1}>
<span style={estilo(cm.style)}>
{cm.label}
</span>
</Fragment>
))}
</div>
<label onDragOver={m.arrastando} onDrop={m.soltar} style={estilo(m.zona)}>
<input type="file" accept=".csv,text/csv" onChange={m.escolher} style={{ display: "none" }} />
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
</svg>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{m.zonaTitulo}
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
{m.zonaSub}
</span>
</label>
{(m.previa ?? []).map((pv: any, i1: number) => (
<Fragment key={pv?.id ?? pv?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.2fr)", gap: "8px", padding: "7px 10px", borderRadius: "8px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "12px" }}>
<span style={{ fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pv.nome}
</span>
<span style={{ color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pv.empresa}
</span>
<span style={{ color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pv.email}
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
</div>
<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", boxShadow: "inset 0 1px 0 #eef1f1" }}>
{(m.temPassos) ? (<>
<span style={{ flex: "1", fontSize: "12px", color: "#67787c" }}>
{m.passoTexto}
</span>
</>) : null}
<button onClick={m.voltar} style={{ height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
{m.voltarLabel}
</button>
<button onClick={m.salvar} style={estilo(m.salvarStyle)}>
{m.salvarLabel}
</button>
</div>
</div>
</div>
</>) : null}
<datalist id="ct-empresas">
{(nomesEmpresas ?? []).map((ne: any, i1: number) => (
<Fragment key={ne?.id ?? ne?.chave ?? i1}>
<option value={ne} />
</Fragment>
))}
</datalist>
</div>

    </>
  );
}
