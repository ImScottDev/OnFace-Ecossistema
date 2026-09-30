"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Atendimento.dc.html
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
import "./AtendimentoDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeAtendimentoDesenho {
  abaAtual: any;
  alternarPainel: any;
  anexar: any;
  arquivoEscolhido: any;
  atalhoEnviar: any;
  atalhoLinha: any;
  busca: any;
  cad: any;
  caixa: any;
  chatRef: any;
  cit: any;
  colado: any;
  colar: any;
  composerRef: any;
  composerStyle: any;
  contatoAcoes: any;
  convRef: any;
  cv: any;
  digitando: any;
  enc: any;
  encerrarAbrir: any;
  enviar: any;
  enviarStyle: any;
  enviarTitulo: any;
  fileRef: any;
  filtroBtn: any;
  fora: any;
  grav: any;
  historico: any;
  ia: any;
  iaM: any;
  largo: any;
  lib: any;
  lig: any;
  lista: any;
  listaStyle: any;
  listaVazia: any;
  mPane: any;
  mail: any;
  modoEscrever: any;
  modoHist: any;
  modoMsg: any;
  modos: any;
  msgs: any;
  naoLidasBtn: any;
  nexo: any;
  nexoAcoes: any;
  nl: any;
  nova: any;
  painelBtnStyle: any;
  painelR: any;
  painelRef: any;
  painelStyle: any;
  painelTitulo: any;
  placeholder: any;
  podePainel: any;
  pontos: any;
  pontosClaros: any;
  pop: any;
  pops: any;
  ret: any;
  reu: any;
  setBusca: any;
  setTexto: any;
  sug: any;
  teclaTexto: any;
  texto: any;
  tplRef: any;
  tr: any;
  vinc: any;
  voltarLista: any;
}

export function AtendimentoDesenho(vals: ValoresDeAtendimentoDesenho) {
  const { abaAtual, alternarPainel, anexar, arquivoEscolhido, atalhoEnviar, atalhoLinha, busca, cad, caixa, chatRef, cit, colado, colar, composerRef, composerStyle, contatoAcoes, convRef, cv, digitando, enc, encerrarAbrir, enviar, enviarStyle, enviarTitulo, fileRef, filtroBtn, fora, grav, historico, ia, iaM, largo, lib, lig, lista, listaStyle, listaVazia, mPane, mail, modoEscrever, modoHist, modoMsg, modos, msgs, naoLidasBtn, nexo, nexoAcoes, nl, nova, painelBtnStyle, painelR, painelRef, painelStyle, painelTitulo, placeholder, podePainel, pontos, pontosClaros, pop, pops, ret, reu, setBusca, setTexto, sug, teclaTexto, texto, tplRef, tr, vinc, voltarLista } = vals;
  return (
    <>
<div data-r="at" data-mpane={mPane} data-stagger="110" data-stagger-tipo="blur" style={{ flex: "1", minHeight: "0", display: "flex", background: "#f6f6f3", overflow: "hidden" }}>
<aside data-r="at-lista" style={estilo(listaStyle)}>
<div style={{ flex: "0 0 auto", padding: "14px 14px 0", display: "flex", flexDirection: "column", gap: "11px" }}>
<div style={{ display: "flex", alignItems: "stretch", gap: "6px" }}>
<button data-of-atpop="1" onClick={pops.caixas} style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px 8px 8px", borderRadius: "12px", border: "0", background: "#fafafa", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(caixa.icoStyle)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={caixa.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{caixa.nome}
</span>
{(caixa.ehIa) ? (<>
<span style={{ flex: "0 0 auto", height: "18px", padding: "0 6px", borderRadius: "5px", background: "#12171d", color: "#fff", fontSize: "10px", fontWeight: "700", display: "inline-flex", alignItems: "center" }}>
NEXO
</span>
</>) : null}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
{caixa.num}
</span>
</span>
{(caixa.temNaoLidas) ? (<>
<span style={{ flex: "0 0 auto", minWidth: "20px", height: "20px", padding: "0 6px", borderRadius: "9999px", background: "#fe4f2b", color: "#fff", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{caixa.naoLidas}
</span>
</>) : null}
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
</svg>
</button>
<button onClick={nova.abrir} title="Nova conversa" style={{ flex: "0 0 auto", width: "52px", borderRadius: "12px", border: "0", background: "#fe4f2b", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#d93c1a")].filter(Boolean).join(" ")}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
</svg>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<div style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "8px", height: "36px", padding: "0 11px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m20 20-3.5-3.5" />
</svg>
<input value={busca} onChange={setBusca} placeholder="Buscar nome, empresa ou mensagem" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
<button data-of-atpop="1" onClick={pops.filtro} title="Filtrar por tipo" style={estilo(filtroBtn.style)} className={[hover("filter:brightness(.97)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M3 6h18M7 12h10M10 18h4" />
</svg>
<span>
{filtroBtn.label}
</span>
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", paddingBottom: "12px", borderBottom: "1px solid #eef1f1", margin: "0 -14px", paddingLeft: "14px", paddingRight: "14px" }}>
<button data-of-atpop="1" onClick={pops.abas} style={{ flex: "1 1 0", minWidth: "0", display: "flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 10px 0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(abaAtual.dot)} />
<span style={{ flex: "1", minWidth: "0", textAlign: "left", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{abaAtual.label}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11px", fontWeight: "700", padding: "1px 7px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560" }}>
{abaAtual.conta}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
<button onClick={naoLidasBtn.onClick} title="Mostrar só não lidas" style={estilo(naoLidasBtn.style)}>
<span>
Não lidas
</span>
<span style={estilo(naoLidasBtn.contaStyle)}>
{naoLidasBtn.conta}
</span>
</button>
</div>
</div>
<div data-stagger="38" data-stagger-tipo="swing" data-delay="180" style={{ flex: "1 1 0", minHeight: "0", overflowY: "auto", overscrollBehavior: "contain", padding: "0 8px 12px" }}>
<div style={{ height: "6px" }} />
{(lista ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<button onClick={c.onClick} style={estilo(c.style)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ position: "relative", flex: "0 0 auto", width: "42px", height: "42px" }}>
<span style={estilo(c.avStyle)}>
{c.iniciais}
</span>
<span style={estilo(c.badgeStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d={c.canalD} />
</svg>
</span>
</span>
<span style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "1px" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={estilo(c.nomeStyle)}>
{c.nome}
</span>
<span style={estilo(c.horaStyle)}>
{c.hora}
</span>
</span>
<span title={c.viaTitulo} style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{c.empresa} · via {c.via}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
<span style={estilo(c.previaStyle)}>
{c.previa}
</span>
{(c.temNaoLidas) ? (<>
<span style={{ flex: "0 0 auto", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "9999px", background: "#fe4f2b", color: "#fff", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{c.naoLidas}
</span>
</>) : null}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px" }}>
<span style={estilo(c.statusStyle)}>
<span style={estilo(c.statusDot)} />
{c.statusLabel}
</span>
<span style={{ flex: "1" }} />
</span>
</span>
</button>
</Fragment>
))}
{(listaVazia) ? (<>
<div style={{ padding: "40px 16px", textAlign: "center" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Nenhuma conversa aqui
</div>
<div style={{ fontSize: "12px", color: "#67787c", marginTop: "4px" }}>
Ajuste a busca, o canal ou a aba.
</div>
</div>
</>) : null}
</div>
</aside>
<section data-r="at-chat" style={{ flex: "1", minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column", background: "#fff", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "11px", padding: "11px 14px", borderBottom: "1px solid #eef1f1" }}>
<button data-r="so-mobile" onClick={voltarLista} title="Voltar às conversas" style={{ display: "none", flex: "0 0 auto", width: "36px", height: "36px", marginLeft: "-6px", borderRadius: "9999px", border: "0", background: "transparent", color: "#12171d", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m15 18-6-6 6-6" />
</svg>
</button>
<span style={{ position: "relative", flex: "0 0 auto", width: "42px", height: "42px" }}>
<span style={estilo(cv.avStyle)}>
{cv.iniciais}
</span>
<span style={estilo(cv.badgeStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d={cv.canalD} />
</svg>
</span>
</span>
<div style={{ flex: "1 1 0", minWidth: "80px", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
<button onClick={cv.verPessoa} style={{ border: "0", background: "transparent", padding: "0", cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: "0" }} className={[hover("text-decoration:underline;text-underline-offset:3px")].filter(Boolean).join(" ")}>
{cv.nome}
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", minWidth: "0" }}>
<span title={cv.viaTitulo} style={{ flex: "0 1 auto", minWidth: "0", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: "5px", height: "22px", padding: "0 8px 0 6px", borderRadius: "9999px", background: "#e6f4ee", color: "#1f7256", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d={cv.canalD} />
</svg>
<span style={{ flex: "0 0 auto" }}>
{cv.via}
</span>
{(largo) ? (<>
<span style={{ minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "500", color: "#2f7a5f", fontVariantNumeric: "tabular-nums" }}>
{cv.viaNum}
</span>
</>) : null}
</span>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px" }}>
<button onClick={ia.btnClick} title={ia.btnTitulo} style={estilo(ia.btnStyle)} className={[hover("filter:brightness(.97)")].filter(Boolean).join(" ")}>
<img src="/proto/oni-avatar.png" alt="" style={{ flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "6px", objectFit: "cover", background: "#1f252c" }} />
{(largo) ? (<>
<span>
{ia.btnLabel}
</span>
</>) : null}
{(ia.ativa) ? (<>
<span style={{ flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "9999px", background: "#2f9e7a", animation: "ofPulse 1.8s infinite" }} />
</>) : null}
</button>
<button onClick={tr.abrir} title="Transferir" style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 11px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", fontSize: "12.5px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />
</svg>
{(largo) ? (<>
<span>
Transferir
</span>
</>) : null}
</button>
<button onClick={encerrarAbrir} title={cv.encerrarLabel} style={estilo(cv.encerrarStyle)} className={[hover("filter:brightness(.95)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3" />
</svg>
{(largo) ? (<>
<span>
{cv.encerrarLabel}
</span>
</>) : null}
</button>
<button data-of-atpop="1" onClick={pops.mais} title="Mais ações" style={{ width: "34px", height: "34px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", display: "grid", placeItems: "center", color: "#4a5560" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5h.01M12 12h.01M12 19h.01" />
</svg>
</button>
{(podePainel) ? (<>
<button onClick={alternarPainel} title={painelTitulo} style={estilo(painelBtnStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<rect x="3" y="3" width="18" height="18" rx="2" />
<path d="M15 3v18" />
</svg>
</button>
</>) : null}
</div>
</div>
{(cv.desconhecido) ? (<>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", background: "#fff6f4", borderBottom: "1px solid #fadfd8" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2330f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#9c3210", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
<span style={{ fontWeight: "600" }}>
Contato novo
</span>
 · {cv.desconhecidoInfo}
</span>
<button onClick={nl.abrir} style={{ flex: "0 0 auto", height: "28px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#d93c1a")].filter(Boolean).join(" ")}>
Criar lead
</button>
<button data-of-atpop="1" onClick={pops.vincular} style={{ flex: "0 0 auto", height: "28px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #fadfd8", color: "#9c3210", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fffaf8")].filter(Boolean).join(" ")}>
Vincular
</button>
</div>
</>) : null}
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", padding: "7px 14px", borderBottom: "1px solid #eef1f1", overflowX: "auto", scrollbarWidth: "none", whiteSpace: "nowrap" }}>
<button data-of-atpop="1" onClick={pops.status} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "7px", height: "30px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#12171d" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(cv.statusDot)} />
<span>
{cv.statusLabel}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
<div ref={chatRef} data-stagger="40" data-stagger-tipo="spring" data-delay="300" style={{ flex: "1 1 0", minHeight: "120px", overflowY: "auto", overscrollBehavior: "contain", padding: "14px 22px 16px", display: "block", background: "#fafafa" }}>
{(lig.ativo) ? (<>
<div style={{ maxWidth: "640px", margin: "6px auto 8px", lineHeight: "1.4" }}>
<div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#67787c", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", borderRadius: "9999px", padding: "3px 10px" }}>
{lig.quando}
</span>
</div>
<div style={{ background: "#fff", borderRadius: "16px", boxShadow: "inset 0 0 0 1px #e3e7e8,0 1px 2px rgba(18,23,29,.04)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px" }}>
<span style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "11px", background: "#12171d", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{lig.tipo} · {lig.duracao}
</div>
<div style={{ fontSize: "12px", color: "#67787c", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{lig.atendente}
</div>
</div>
<div style={{ flex: "0 0 auto", textAlign: "right" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "22px", fontWeight: "800", letterSpacing: "-.02em", lineHeight: "1", color: "#12171d" }}>
{lig.chance}
<span style={{ fontSize: "12px", color: "#67787c" }}>
%
</span>
</div>
<div style={{ fontSize: "10.5px", color: "#67787c", marginTop: "3px" }}>
chance de fechar
</div>
</div>
</div>
<div onClick={lig.seek} style={{ display: "flex", alignItems: "center", gap: "2px", height: "30px", padding: "0 16px", cursor: "pointer" }}>
{(lig.onda ?? []).map((b: any, i1: number) => (
<Fragment key={b?.id ?? b?.chave ?? i1}>
<span style={estilo(b.style)} />
</Fragment>
))}
</div>
<div style={{ padding: "12px 16px 14px", borderTop: "1px solid #f3f5f5", marginTop: "10px" }}>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", color: "#4a5560" }}>
EM UMA FRASE
</div>
<div style={{ fontSize: "13px", lineHeight: "1.5", color: "#1f252c", marginTop: "5px", textWrap: "pretty" }}>
{lig.objetivo}
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", padding: "9px 11px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "9999px", background: "#fe4f2b" }} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{lig.passoPrincipal}
</span>
</div>
</div>
<div style={{ display: "flex", gap: "6px", padding: "0 16px 14px" }}>
<button onClick={lig.play} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
<path d={lig.playD} />
</svg>
<span>
{lig.tempo}
</span>
</button>
<button onClick={lig.abrirRel} style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "34px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<span>
Abrir relatório da ligação
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</button>
</div>
</div>
</div>
</>) : null}
{(lig.nao) ? (<>
{(cv.ehEmail) ? (<>
<div style={{ maxWidth: "760px", margin: "4px auto 6px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", textWrap: "pretty" }}>
{cv.assunto}
</div>
<div style={{ fontSize: "12px", color: "#67787c", marginTop: "3px" }}>
{cv.threadInfo}
</div>
</div>
</div>
</>) : null}
{(msgs ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
{(m.temDia) ? (<>
<div style={{ display: "flex", justifyContent: "center", margin: "10px 0 4px" }}>
<span style={{ height: "22px", padding: "0 10px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "11px", fontWeight: "600", color: "#4a5560", display: "inline-flex", alignItems: "center" }}>
{m.dia}
</span>
</div>
</>) : null}
{(m.temNovas) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0 2px" }}>
<span style={{ flex: "1", height: "1px", background: "#fadfd8" }} />
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#c2330f" }}>
{m.novasLabel}
</span>
<span style={{ flex: "1", height: "1px", background: "#fadfd8" }} />
</div>
</>) : null}
{(m.ehSis) ? (<>
<div style={{ display: "flex", justifyContent: "center", margin: "10px 0 2px" }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#67787c" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
</svg>
<span>
{m.t}
</span>
<span>
· {m.h}
</span>
</span>
</div>
</>) : null}
{(m.ehNota) ? (<>
<div style={estilo(m.notaStyle)}>
<div style={estilo(m.notaTopo)}>
{(m.notaIa) ? (<>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "14px", height: "14px", borderRadius: "4px", objectFit: "cover" }} />
</>) : null}
{(m.notaHumana) ? (<>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<rect x="4" y="11" width="16" height="10" rx="2" />
<path d="M8 11V7a4 4 0 0 1 8 0v4" />
</svg>
</>) : null}
<span>
NOTA INTERNA · {m.autor}
</span>
<span style={{ flex: "1" }} />
<span style={{ fontWeight: "500", letterSpacing: "0" }}>
{m.h}
</span>
</div>
<div style={{ fontSize: "13px", color: "#1f252c", lineHeight: "1.45", textWrap: "pretty" }}>
{m.t}
</div>
</div>
</>) : null}
{(m.ehEmailCard) ? (<>
<div style={{ maxWidth: "760px", margin: "10px auto 0", background: "#fff", borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden", animation: "ofIn .2s ease both" }}>
<div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "12px 16px", borderBottom: "1px solid #f3f5f5" }}>
<span style={estilo(m.mailAv)}>
{m.avIni}
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: "0" }}>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }}>
{m.mailNome}
</span>
<span style={{ fontSize: "12px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
&lt;{m.mailEnd}&gt;
</span>
</div>
<div style={{ fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
para {m.mailPara}
</div>
</div>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
{m.dia}, {m.h}
</span>
<button onClick={m.responder} title="Responder" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 14 4 9l5-5" />
<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
</svg>
</button>
</div>
<div style={{ padding: "14px 16px 16px" }}>
{(m.temTexto) ? (<>
<div style={estilo(m.mailCorpo)}>
{m.t}
</div>
</>) : null}
{(m.temImg) ? (<>
 {m.imgMail} 
</>) : null}
{(m.temArq) ? (<>
<div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginTop: "12px", padding: "8px 12px 8px 8px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "36px", borderRadius: "6px", background: "#fff6f4", color: "#d93c1a", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "800", boxShadow: "inset 0 0 0 1px #fadfd8" }}>
{m.ext}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{m.arq}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{m.tam}
</span>
</span>
</div>
</>) : null}
{(m.ehOut) ? (<>
<div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid #f3f5f5", fontSize: "12px", lineHeight: "1.5", color: "#67787c" }}>
{m.assinatura}
</div>
</>) : null}
</div>
</div>
</>) : null}
{(m.ehBalao) ? (<>
<div onMouseEnter={m.enter} onMouseLeave={m.leave} style={estilo(m.linha)}>
{(m.ehIn) ? (<>
<span style={estilo(m.avSlot)}>
{m.avIni}
</span>
</>) : null}
<div style={estilo(m.coluna)}>
{(m.hov) ? (<>
<div data-of-reagir="1" style={estilo(m.barraStyle)}>
<button onClick={m.responder} title="Responder" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M9 14 4 9l5-5" />
<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
</svg>
</button>
<button data-of-reagir="1" onClick={m.abrirReagir} title="Reagir" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="12" r="10" />
<path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
</svg>
</button>
<button onClick={m.copiar} title="Copiar" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<rect x="9" y="9" width="13" height="13" rx="2" />
<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
</svg>
</button>
<button onClick={m.atividade} title="Criar atividade" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 14v4M10 16h4" />
</svg>
</button>
{(m.podeApagar) ? (<>
<span style={{ width: "1px", height: "18px", background: "#e3e7e8", margin: "0 2px", alignSelf: "center" }} />
<button onClick={m.apagar} title="Apagar para todos" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#c2330f", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#fff6f4;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
</svg>
</button>
</>) : null}
</div>
</>) : null}
{(m.reagindo) ? (<>
<div data-of-reagir="1" style={estilo(m.pickerStyle)}>
{(m.reacoes ?? []).map((e: any, i2: number) => (
<Fragment key={e?.id ?? e?.chave ?? i2}>
<button data-of-reagir="1" onClick={e.onClick} title={e.titulo} style={estilo(e.style)} className={[hover("background:#f1f3f3;transform:scale(1.15)")].filter(Boolean).join(" ")}>
{e.emoji}
</button>
</Fragment>
))}
</div>
</>) : null}
<div style={estilo(m.balao)}>
{(m.temCit) ? (<>
<div style={estilo(m.citStyle)}>
<div style={{ fontSize: "11px", fontWeight: "700", color: "#12171d" }}>
{m.citQuem}
</div>
<div style={{ fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.citT}
</div>
</div>
</>) : null}
{(m.temImg) ? (<>
 {m.imgWa} 
</>) : null}
{(m.temArq) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "2px 2px 4px", minWidth: "200px" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "40px", borderRadius: "6px", background: "#fff6f4", color: "#d93c1a", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "800", boxShadow: "inset 0 0 0 1px #fadfd8" }}>
{m.ext}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.arq}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{m.tam}
</span>
</span>
</div>
</>) : null}
{(m.temAudio) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "230px", padding: "2px 0" }}>
<button onClick={m.tocar} title={m.playTitulo} style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
<path d={m.playD} />
</svg>
</button>
<span style={{ flex: "1", display: "flex", alignItems: "center", gap: "2px", height: "26px" }}>
{(m.barras ?? []).map((b: any, i2: number) => (
<Fragment key={b?.id ?? b?.chave ?? i2}>
<span style={estilo(b.style)} />
</Fragment>
))}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#4a5560", fontVariantNumeric: "tabular-nums" }}>
{m.tempoAudio}
</span>
</div>
</>) : null}
{(m.temTexto) ? (<>
<span style={estilo(m.txtStyle)}>
{m.t}
</span>
</>) : null}
<span style={estilo(m.meta)}>
{(m.ehIa) ? (<>
<span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontWeight: "700", color: "#1f7256" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "12px", height: "12px", borderRadius: "4px", objectFit: "cover" }} />
NEXO ·
</span>
</>) : null}
<span>
{m.h}
</span>
{(m.ehOut) ? (<>
<svg width="14" height="12" viewBox="0 0 26 24" fill="none" stroke={m.tickCor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M18 6 7 17l-5-5M24 6 13 17" />
</svg>
</>) : null}
</span>
</div>
{(m.temReacao) ? (<>
<button onClick={m.tirarReacao} title="Você reagiu · clique para remover" style={estilo(m.reacaoStyle)} className={[hover("box-shadow:0 1px 3px rgba(18,23,29,.12),inset 0 0 0 1px #c4c9cb")].filter(Boolean).join(" ")}>
<span style={{ fontSize: "13px", lineHeight: "1" }}>
{m.reacao}
</span>
</button>
</>) : null}
</div>
{(m.ehOut) ? (<>
<span style={estilo(m.avSlot)}>
{m.avIni}
</span>
</>) : null}
</div>
</>) : null}
</Fragment>
))}
{(digitando) ? (<>
<div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginTop: "10px", animation: "ofIn .2s ease both" }}>
<span style={estilo(cv.avMini)}>
{cv.iniciais}
</span>
<div style={{ padding: "11px 14px", borderRadius: "14px 14px 14px 4px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
{pontos}
</div>
</div>
</>) : null}
</>) : null}
</div>
{(lig.ativo) ? (<>
<div style={{ flex: "0 0 auto", borderTop: "1px solid #eef1f1", background: "#fff", padding: "10px 14px 12px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ flex: "1 1 200px", minWidth: "0", fontSize: "12px", color: "#67787c", textWrap: "pretty" }}>
{lig.rodape}
</span>
<button onClick={lig.criarAtv} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
<span>
Criar atividade
</span>
</button>
<button onClick={lig.enviarWa} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
</svg>
<span>
Resumo no WhatsApp
</span>
</button>
<button onClick={lig.religar} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#d93c1a")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
</svg>
<span>
Ligar de volta
</span>
</button>
</div>
</>) : null}
{(lig.nao) ? (<>
<div style={{ flex: "0 0 auto", borderTop: "1px solid #eef1f1", background: "#fff" }}>
{(ia.ativa) ? (<>
<div style={{ margin: "10px 14px 0", display: "flex", alignItems: "center", gap: "10px", padding: "8px 8px 8px 10px", borderRadius: "12px", background: "#12171d", color: "#fff", animation: "ofIn .2s ease both" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "8px", objectFit: "cover", background: "#1f252c" }} />
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontSize: "12.5px", fontWeight: "600" }}>
NEXO está respondendo esta conversa
</div>
<div style={{ fontSize: "11.5px", color: "#a3a8a4", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ia.resumo}
</div>
</div>
<button onClick={ia.editar} style={{ flex: "0 0 auto", height: "30px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#1f252c", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer", boxShadow: "inset 0 0 0 1px #2e363f" }} className={[hover("background:#2a323b")].filter(Boolean).join(" ")}>
Ajustar
</button>
<button onClick={ia.assumir} style={{ flex: "0 0 auto", height: "30px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fff", color: "#12171d", fontSize: "12px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Assumir conversa
</button>
</div>
</>) : null}
{(sug.carregando) ? (<>
<div style={{ margin: "10px 14px 0", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "12px", background: "#12171d", color: "#a3a8a4", fontSize: "12px", animation: "ofIn .2s ease both" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "7px", objectFit: "cover", background: "#1f252c" }} />
 {pontosClaros} 
<span>
Lendo a conversa…
</span>
</div>
</>) : null}
{(sug.visivel) ? (<>
<div style={{ margin: "10px 14px 0", display: "flex", alignItems: "center", gap: "10px", padding: "8px 8px 8px 10px", borderRadius: "12px", background: "#12171d", color: "#fff", animation: "ofIn .25s ease both" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "7px", objectFit: "cover", background: "#1f252c" }} />
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#a3a8a4" }}>
NEXO SUGERE
</div>
<div style={{ fontSize: "12.5px", lineHeight: "1.4", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sug.texto}
</div>
</div>
<button onClick={sug.usar} style={{ flex: "0 0 auto", height: "28px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#d93c1a")].filter(Boolean).join(" ")}>
Usar
</button>
<button onClick={sug.dispensar} title="Dispensar" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", border: "0", background: "transparent", color: "#a3a8a4", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#1f252c;color:#fff")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "0 14px" }}>
{(modos ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
{(modoHist) ? (<>
<div style={{ padding: "6px 14px 14px", display: "flex", flexDirection: "column", maxHeight: "200px", overflow: "auto" }}>
{(historico ?? []).map((h: any, i1: number) => (
<Fragment key={h?.id ?? h?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 4px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={h.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{h.titulo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{h.meta}
</span>
</span>
<span style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
{h.quando}
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
{(modoEscrever) ? (<>
<div style={{ padding: "8px 14px 12px" }}>
<div style={estilo(composerStyle)}>
{(cit.ativo) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 8px 0", padding: "7px 8px 7px 10px", borderRadius: "8px", background: "#f6f6f3", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v2" />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#12171d" }}>
Respondendo {cit.quem}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cit.t}
</span>
</span>
<button onClick={cit.cancelar} title="Cancelar" style={{ flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "9999px", border: "0", background: "transparent", color: "#67787c", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</>) : null}
{(mail.ativo) ? (<>
<div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid #eef1f1" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "38px", padding: "4px 12px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ flex: "0 0 52px", fontSize: "12px", color: "#67787c" }}>
Para
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px 0 4px", borderRadius: "9999px", background: "#eeeff3", fontSize: "12px", color: "#1f252c", minWidth: "0" }}>
<span style={estilo(cv.avChip)}>
{cv.iniciais}
</span>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cv.nome} &lt;{mail.para}&gt;
</span>
</span>
<span style={{ flex: "1" }} />
{(mail.semCc) ? (<>
<button onClick={mail.mostrarCc} style={{ flex: "0 0 auto", height: "24px", padding: "0 8px", borderRadius: "6px", border: "0", background: "transparent", fontSize: "12px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cc
</button>
</>) : null}
</div>
{(mail.comCc) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "38px", padding: "4px 12px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ flex: "0 0 52px", fontSize: "12px", color: "#67787c" }}>
Cc
</span>
<input value={mail.cc} onChange={mail.setCc} placeholder="email@empresa.com.br, outro@empresa.com.br" style={{ flex: "1", minWidth: "0", height: "28px", border: "0", outline: "0", background: "transparent", fontSize: "12.5px" }} />
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "38px", padding: "4px 12px" }}>
<span style={{ flex: "0 0 52px", fontSize: "12px", color: "#67787c" }}>
Assunto
</span>
<input value={mail.assunto} onChange={mail.setAssunto} style={{ flex: "1", minWidth: "0", height: "28px", border: "0", outline: "0", background: "transparent", fontSize: "13px", fontWeight: "600", color: "#12171d" }} />
</div>
</div>
</>) : null}
{(colado.tem) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "10px 12px 0", padding: "6px 8px 6px 6px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #e3e7e8" }}>
 {colado.thumb} 
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{colado.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{colado.info}
</span>
</span>
<button onClick={colado.remover} title="Remover imagem" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", border: "0", background: "transparent", display: "grid", placeItems: "center", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</>) : null}
<textarea ref={composerRef} value={texto} onChange={setTexto} onPaste={colar} onKeyDown={teclaTexto} placeholder={placeholder} rows={3} style={{ display: "block", width: "100%", border: "0", outline: "0", resize: "none", background: "transparent", fontSize: "13.5px", lineHeight: "1.5", padding: "12px 14px 6px", minHeight: "76px", maxHeight: "260px", overflowY: "auto" }} />
{(grav.ativo) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 8px 8px 14px", borderTop: "1px solid #f3f5f5" }}>
 {grav.ponto} 
<span style={{ flex: "0 0 auto", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{grav.tempo}
</span>
<span style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "2px", height: "24px", overflow: "hidden" }}>
{(grav.barras ?? []).map((b: any, i1: number) => (
<Fragment key={b?.id ?? b?.chave ?? i1}>
<span style={estilo(b.style)} />
</Fragment>
))}
</span>
<button onClick={grav.cancelar} style={{ flex: "0 0 auto", height: "32px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
Descartar
</button>
<button onClick={grav.enviar} title="Enviar áudio" style={{ flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
</svg>
</button>
</div>
</>) : null}
{(grav.parado) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px 8px" }}>
<input type="file" ref={fileRef} onChange={arquivoEscolhido} style={{ display: "none" }} />
<button onClick={anexar} title="Anexar arquivo" style={{ width: "30px", height: "30px", borderRadius: "9999px", border: "0", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "#4a5560" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
</svg>
</button>
{(modoMsg) ? (<>
<button data-of-atpop="1" onClick={pops.template} style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", fontSize: "12px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
</svg>
<span>
Template
</span>
</button>
<button onClick={sug.pedir} title="NEXO sugere uma resposta com base na conversa" style={estilo(sug.btnStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "16px", height: "16px", borderRadius: "5px", objectFit: "cover", background: "#1f252c" }} />
<span>
Sugerir resposta
</span>
</button>
</>) : null}
<span style={{ flex: "1" }} />
{(largo) ? (<>
<span style={{ fontSize: "11px", color: "#67787c", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10.5px", padding: "1px 5px", borderRadius: "4px", background: "#eeeff3", color: "#4a5560" }}>
{atalhoEnviar}
</span>
<span>
envia
</span>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10.5px", padding: "1px 5px", borderRadius: "4px", background: "#eeeff3", color: "#4a5560", marginLeft: "4px" }}>
{atalhoLinha}
</span>
<span>
quebra linha
</span>
</span>
</>) : null}
{(grav.pode) ? (<>
<button onClick={grav.iniciar} title="Gravar áudio" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", border: "0", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "#4a5560" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
</svg>
</button>
</>) : null}
<button onClick={enviar} title={enviarTitulo} style={estilo(enviarStyle)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
</svg>
</button>
</div>
</>) : null}
</div>
</div>
</>) : null}
</div>
</>) : null}
</section>
<aside data-r={painelR} style={estilo(painelStyle)}>
<button data-r="so-overlay" onClick={alternarPainel} title="Fechar painel" style={{ display: "none", position: "absolute", top: "10px", right: "10px", zIndex: "3", width: "34px", height: "34px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 4px 12px rgba(18,23,29,.12)", color: "#12171d", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
<div ref={painelRef} style={{ width: "340px", flex: "1 1 0", minHeight: "0", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", background: "#f6f6f3" }}>
<div data-stagger="80" data-stagger-tipo="flip" data-delay="360" style={{ padding: "12px", display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: "10px" }}>
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
<span style={estilo(cv.avGrande)}>
{cv.iniciais}
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cv.nome}
</div>
<div style={{ fontSize: "12px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cv.cargo}
</div>
</div>
<button onClick={cv.verPessoa} title="Ver pessoa" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M7 17 17 7M7 7h10v10" />
</svg>
</button>
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
{(contatoAcoes ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} title={a.label} style={{ flex: "1 1 0", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "32px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", fontSize: "12px", fontWeight: "500", color: "#1f252c", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
<span>
{a.label}
</span>
</button>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexDirection: "column", marginTop: "12px", paddingTop: "8px", borderTop: "1px solid #eef1f1" }}>
{(cv.dados ?? []).map((d: any, i1: number) => (
<Fragment key={d?.id ?? d?.chave ?? i1}>
<button onClick={d.onClick} title={d.titulo} style={{ display: "flex", alignItems: "center", gap: "9px", height: "32px", padding: "0 6px", margin: "0 -6px", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={d.d} />
</svg>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{d.valor}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={d.acaoD} />
</svg>
</button>
</Fragment>
))}
</div>
</div>
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Esta conversa
</span>
<span style={{ fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap" }}>
{cv.canal} · {cv.numeroCurto}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "6px" }}>
{(cv.stats ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<div style={{ padding: "9px 10px", borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".07em", color: "#67787c", whiteSpace: "nowrap" }}>
{s.label}
</div>
<div style={estilo(s.valorStyle)}>
{s.valor}
</div>
</div>
</Fragment>
))}
</div>
</div>
{(cv.desconhecido) ? (<>
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "10px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Contato novo
</div>
<div style={{ fontSize: "11.5px", lineHeight: "1.4", color: "#67787c", marginTop: "2px", textWrap: "pretty" }}>
{cv.desconhecidoInfo}
</div>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "6px", marginTop: "12px" }}>
<button onClick={nl.abrir} style={{ minWidth: "0", display: "flex", alignItems: "center", justifyContent: "center", height: "34px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#d93c1a")].filter(Boolean).join(" ")}>
Criar lead
</button>
<button onClick={vinc.alternar} style={estilo(vinc.btnStyle)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
Vincular a lead
</button>
</div>
{(vinc.aberto) ? (<>
<div style={{ marginTop: "10px" }}>
<input value={vinc.busca} onChange={vinc.setBusca} placeholder="Buscar lead, pessoa ou empresa" style={{ width: "100%", height: "34px", padding: "0 12px", borderRadius: "9999px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px" }} />
<div style={{ display: "flex", flexDirection: "column", marginTop: "6px", maxHeight: "220px", overflowY: "auto" }}>
{(vinc.itens ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.onClick} style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "7px 6px", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(v.av)}>
{v.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.sub}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
</>) : null}
{(cv.conhecido) ? (<>
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "11px" }}>
<span style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "7px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
{cv.relTitulo}
</span>
<span style={estilo(cv.relChip)}>
{cv.relArea}
</span>
</span>
<button onClick={cv.abrirRel} style={{ height: "26px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
{cv.relBtn}
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(cv.etapaStyle)}>
<span style={estilo(cv.etapaDot)} />
{cv.etapa}
</span>
{(cv.temTrilha) ? (<>
<span style={{ flex: "1", display: "flex", gap: "3px" }}>
{(cv.trilha ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<span title={t.label} style={estilo(t.style)} />
</Fragment>
))}
</span>
</>) : null}
</div>
<div style={{ display: "grid", gridTemplateColumns: "80px minmax(0,1fr)", rowGap: "8px", columnGap: "10px", fontSize: "12.5px", marginTop: "12px" }}>
{(cv.campos ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<span style={{ color: "#67787c" }}>
{k.label}
</span>
<span style={{ color: "#1f252c", textWrap: "pretty", minWidth: "0" }}>
{k.valor}
</span>
</Fragment>
))}
</div>
{(cv.temEmpresa) ? (<>
<button onClick={cv.verEmpresa} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", marginTop: "12px", padding: "9px 10px", borderRadius: "10px", border: "0", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", cursor: "pointer", textAlign: "left" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", background: "#12171d", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "11px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{cv.empIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cv.empresa}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c" }}>
{cv.segmento}
</span>
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</>) : null}
</div>
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Próxima ação
</span>
<button onClick={cv.acaoBtn} style={{ height: "26px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
{cv.acaoBtnLabel}
</button>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={estilo(cv.acaoIco)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", textWrap: "pretty" }}>
{cv.acao}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{cv.acaoQuando}
</span>
</span>
</div>
</div>
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Cadência
</span>
<button onClick={cad.onClick} style={{ display: "flex", alignItems: "center", gap: "4px", height: "26px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
{cad.btn}
</button>
</div>
{(cad.tem) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9px", background: "#e6f4ee", color: "#1f7256", display: "grid", placeItems: "center" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 12h4l3-8 4 16 3-8h4" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{cad.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{cad.passo}
</span>
</span>
</div>
<div style={{ display: "flex", gap: "3px", marginTop: "10px" }}>
{(cad.barras ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<span style={estilo(p.style)} />
</Fragment>
))}
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
<button onClick={cad.pausar} style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "30px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
<path d={cad.pausarD} />
</svg>
<span>
{cad.pausarLabel}
</span>
</button>
<button onClick={cad.remover} style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "30px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#c2330f", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
<span>
Remover
</span>
</button>
</div>
</>) : null}
{(cad.vazio) ? (<>
<div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45" }}>
Fora de cadência. Inclua para o NEXO agendar os próximos toques.
</div>
<button onClick={cad.onClick} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", height: "34px", marginTop: "10px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Incluir em cadência
</span>
</button>
</>) : null}
</div>
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Tags
</span>
<button data-of-atpop="1" onClick={pops.tags} style={{ display: "flex", alignItems: "center", gap: "4px", height: "26px", padding: "0 10px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar
</span>
</button>
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(cv.tags ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "24px", padding: "0 4px 0 9px", borderRadius: "9999px", background: "#eeeff3", color: "#1f252c", fontSize: "11.5px", fontWeight: "500" }}>
<span>
{t.label}
</span>
<button onClick={t.remover} title="Remover tag" style={{ width: "16px", height: "16px", borderRadius: "9999px", border: "0", background: "transparent", color: "#67787c", cursor: "pointer", display: "grid", placeItems: "center", padding: "0" }} className={[hover("background:#dbdede;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</span>
</Fragment>
))}
{(cv.semTags) ? (<>
<span style={{ fontSize: "12px", color: "#67787c" }}>
Sem tags
</span>
</>) : null}
</div>
</div>
</>) : null}
<div style={{ background: "#fff", borderRadius: "13px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: "#12171d", color: "#fff" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9px", objectFit: "cover", background: "#1f252c" }} />
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700" }}>
NEXO
</span>
<span style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "#2f9e7a" }} />
</div>
<div style={{ fontSize: "11.5px", color: "#a3a8a4", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
Lendo esta conversa com você
</div>
</div>
</div>
<div style={{ padding: "6px" }}>
{(nexoAcoes ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={estilo(a.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(a.icoStyle)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{a.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.desc}
</span>
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</button>
</Fragment>
))}
</div>
{(nexo.carregando) ? (<>
<div style={{ margin: "0 12px 12px", padding: "12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", display: "flex", alignItems: "center", gap: "9px", fontSize: "12px", color: "#4a5560" }}>
{pontos}
<span>
Lendo {nexo.n} mensagens…
</span>
</div>
</>) : null}
{(nexo.temTexto) ? (<>
<div style={{ margin: "0 12px 12px", padding: "11px 12px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", animation: "ofIn .25s ease both" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
<span style={{ flex: "1", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560" }}>
{nexo.titulo}
</span>
<button onClick={nexo.copiar} title="Copiar" style={{ width: "24px", height: "24px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<rect x="9" y="9" width="13" height="13" rx="2" />
<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
</svg>
</button>
<button onClick={nexo.fechar} title="Fechar" style={{ width: "24px", height: "24px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ fontSize: "12.5px", lineHeight: "1.5", color: "#1f252c", textWrap: "pretty" }}>
{nexo.texto}
</div>
</div>
</>) : null}
</div>
</div>
</div>
</aside>
{(pop.aberto) ? (<>
<div data-of-atpop="1" style={estilo(pop.style)}>
{(pop.temTitulo) ? (<>
<div style={{ padding: "6px 9px", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#67787c" }}>
{pop.titulo}
</div>
</>) : null}
{(pop.temCriar) ? (<>
<div style={{ display: "flex", gap: "6px", padding: "4px 4px 6px", borderBottom: "1px solid #eef1f1", marginBottom: "4px" }}>
<input value={pop.novaTag} onChange={pop.setNovaTag} onKeyDown={pop.teclaTag} placeholder="Criar nova tag" style={{ flex: "1", minWidth: "0", height: "32px", padding: "0 10px", borderRadius: "9999px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px" }} />
<button onClick={pop.criarTag} style={estilo(pop.criarStyle)}>
Criar
</button>
</div>
</>) : null}
{(pop.ehCaixas) ? (<>
{(pop.caixas ?? []).map((x: any, i1: number) => (
<Fragment key={x?.id ?? x?.chave ?? i1}>
<button onClick={x.onClick} style={estilo(x.style)} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
<span style={estilo(x.icoStyle)}>
{(x.ia) ? (<>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }} />
</>) : null}
{(x.naoIa) ? (<>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={x.d} />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{x.nome}
</span>
{(x.ia) ? (<>
<span style={{ flex: "0 0 auto", height: "17px", padding: "0 5px", borderRadius: "5px", background: "#12171d", color: "#fff", fontSize: "9.5px", fontWeight: "700", display: "inline-flex", alignItems: "center" }}>
NEXO
</span>
</>) : null}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
{x.num}
</span>
</span>
{(x.temNl) ? (<>
<span style={{ flex: "0 0 auto", minWidth: "20px", height: "20px", padding: "0 6px", borderRadius: "9999px", background: "#fe4f2b", color: "#fff", fontSize: "10.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{x.nl}
</span>
</>) : null}
<span style={{ flex: "0 0 auto", minWidth: "18px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{x.total}
</span>
<span style={estilo(x.checkStyle)}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
</button>
</Fragment>
))}
</>) : null}
{(pop.itens ?? []).map((i: any, i1: number) => (
<Fragment key={i?.id ?? i?.chave ?? i1}>
<button onClick={i.onClick} style={estilo(i.style)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{i.label}
</span>
{(i.temNota) ? (<>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "400", color: "#67787c", marginTop: "1px", whiteSpace: "normal", lineHeight: "1.35" }}>
{i.nota}
</span>
</>) : null}
</span>
{(i.on) ? (<>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12171d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
{(nova.aberto) ? (<>
<div onMouseDown={fora.nova} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "flex", overflow: "auto", padding: "20px" }}>
<div style={{ margin: "auto", width: "100%", maxWidth: "520px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden", animation: "ofIn .18s ease both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 12px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Nova conversa
</div>
<div style={{ fontSize: "12.5px", color: "#67787c", marginTop: "3px" }}>
Escolha o canal, para quem e por qual número
</div>
</div>
<button onClick={nova.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", margin: "-4px -6px 0 0", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Canal
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3" }}>
{(nova.canais ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Para
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
{(nova.temAlvo) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px 9px 12px", borderRadius: "12px", border: "1px solid #e3e7e8" }}>
<span style={estilo(nova.alvoAv)}>
{nova.alvoIni}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{nova.alvoNome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{nova.alvoSub}
</span>
</span>
<button onClick={nova.limparAlvo} title="Trocar" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "9999px", border: "0", background: "transparent", color: "#67787c", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</>) : null}
{(nova.semAlvo) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3", marginBottom: "8px" }}>
{(nova.modosPara ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</>) : null}
{(nova.digitando) ? (<>
<div style={{ display: "flex", gap: "6px" }}>
<div style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", height: "36px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", overflow: "hidden" }}>
{(nova.ehWa) ? (<>
<span style={{ flex: "0 0 auto", height: "100%", display: "flex", alignItems: "center", padding: "0 10px", background: "#fafafa", borderRight: "1px solid #eef1f1", fontSize: "13px", fontWeight: "600", color: "#4a5560" }}>
+55
</span>
</>) : null}
<input value={nova.digito} onChange={nova.setDigito} onKeyDown={nova.teclaDigito} placeholder={nova.digitoDica} style={{ flex: "1", minWidth: "0", height: "100%", padding: "0 12px", border: "0", outline: "0", background: "transparent", fontSize: "13.5px", fontVariantNumeric: "tabular-nums" }} />
</div>
<button onClick={nova.usarDigito} style={estilo(nova.usarStyle)}>
Usar
</button>
</div>
</>) : null}
{(nova.buscando) ? (<>
<input value={nova.busca} onChange={nova.setBusca} placeholder={nova.buscaDica} style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
<div style={{ display: "flex", flexDirection: "column", marginTop: "6px", borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden" }}>
{(nova.resultados ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.onClick} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "0", borderTop: "1px solid #eef1f1", marginTop: "-1px", background: "#fff", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(v.av)}>
{v.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{v.sub}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Enviar por
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(nova.origens ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} title={o.titulo} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
{(nova.ehMail) ? (<>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Assunto
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<input value={nova.assunto} onChange={nova.setAssunto} placeholder="Ex: Proposta Callface AI" style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
</>) : null}
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
{nova.msgRotulo}
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3", marginBottom: "8px" }}>
{(nova.modosMsg ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
{(nova.escrevendo) ? (<>
<textarea value={nova.texto} onChange={nova.setTexto} placeholder={nova.textoDica} style={{ display: "block", width: "100%", minHeight: "110px", padding: "10px 12px", borderRadius: "12px", outline: "0", resize: "vertical", fontSize: "13px", lineHeight: "1.5", background: "#fff", border: "0", boxShadow: "inset 0 0 0 1px #dbdede" }} />
</>) : null}
{(nova.comTemplate) ? (<>
<div style={{ display: "flex", flexDirection: "column", borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden" }}>
{(nova.tpls ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(t.radio)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{t.nome}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#4a5560", marginTop: "2px", lineHeight: "1.45", textWrap: "pretty" }}>
{t.previa}
</span>
</span>
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={nova.fechar} style={{ height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={nova.criar} style={estilo(nova.btnStyle)}>
{nova.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(nl.aberto) ? (<>
<div onMouseDown={fora.nl} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "flex", overflow: "auto", padding: "20px" }}>
<div style={{ margin: "auto", width: "100%", maxWidth: "520px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden", animation: "ofIn .18s ease both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 12px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Criar lead
</div>
<div style={{ fontSize: "12.5px", color: "#67787c", marginTop: "3px" }}>
{nl.sub}
</div>
</div>
<button onClick={nl.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", margin: "-4px -6px 0 0", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Nome
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<input value={nl.nome} onChange={nl.setNome} placeholder="Nome da pessoa" style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Cargo
</div>
<input value={nl.cargo} onChange={nl.setCargo} placeholder="Ex: Diretor de operações" style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Telefone
</div>
<input value={nl.tel} onChange={nl.setTel} placeholder="+55 11 90000-0000" style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
E-mail
</div>
<input value={nl.email} onChange={nl.setEmail} placeholder="nome@empresa.com.br" style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Empresa
</div>
<input value={nl.empresa} onChange={nl.setEmpresa} placeholder="Buscar empresa ou digitar uma nova" style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
{(nl.temSugestoes) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
{(nl.sugestoes ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<button onClick={s.onClick} style={{ height: "28px", padding: "0 11px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", fontSize: "12px", color: "#1f252c" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
{s.nome}
</button>
</Fragment>
))}
</div>
</>) : null}
<div style={{ fontSize: "11.5px", color: "#67787c", marginTop: "6px" }}>
{nl.empresaInfo}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Interesse
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(nl.interesses ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} title={o.titulo} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Responsável
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(nl.resps ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} title={o.titulo} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", fontSize: "12px", color: "#4a5560" }}>
<span>
Entra em
</span>
<span style={{ fontWeight: "600", color: "#12171d" }}>
Pré-vendas · Novo
</span>
<span>
com origem
</span>
<span style={{ fontWeight: "600", color: "#12171d" }}>
{nl.origem}
</span>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={nl.fechar} style={{ height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={nl.criar} style={estilo(nl.btnStyle)}>
Criar lead e vincular
</button>
</div>
</div>
</div>
</>) : null}
{(lib.aberto) ? (<>
<div onMouseDown={fora.lib} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "flex", overflow: "auto", padding: "20px" }}>
<div style={{ margin: "auto", width: "100%", maxWidth: "980px", height: "min(660px,calc(100vh - 40px))", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden", animation: "ofIn .18s ease both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px 14px 20px", borderBottom: "1px solid #eef1f1" }}>
<div style={{ flex: "0 0 auto" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Templates
</div>
<div style={{ fontSize: "12px", color: "#67787c", marginTop: "1px" }}>
{lib.sub}
</div>
</div>
<div style={{ flex: "1", minWidth: "0", display: "flex", justifyContent: "center" }}>
<div style={{ width: "100%", maxWidth: "360px", display: "flex", alignItems: "center", gap: "8px", height: "36px", padding: "0 12px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m20 20-3.5-3.5" />
</svg>
<input value={lib.busca} onChange={lib.setBusca} placeholder="Buscar por nome ou texto" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13px" }} />
</div>
</div>
<button onClick={lib.novo} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px 0 11px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Novo template
</span>
</button>
<button onClick={lib.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", display: "grid", gridTemplateColumns: "200px minmax(0,1fr) minmax(0,340px)" }}>
<div style={{ minHeight: "0", overflowY: "auto", padding: "12px 10px", background: "#fafafa", borderRight: "1px solid #eef1f1" }}>
<div style={{ padding: "4px 8px 6px", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#67787c" }}>
TIMES
</div>
{(lib.times ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.label}
</span>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#67787c" }}>
{t.conta}
</span>
</button>
</Fragment>
))}
<div style={{ padding: "14px 8px 6px", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#67787c" }}>
CATEGORIAS
</div>
{(lib.cats ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.label}
</span>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#67787c" }}>
{t.conta}
</span>
</button>
</Fragment>
))}
</div>
{(lib.modoLista) ? (<>
<div style={{ minHeight: "0", overflowY: "auto", padding: "10px" }}>
{(lib.itens ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.nome}
</span>
<span style={estilo(t.escopoStyle)}>
{t.escopo}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "11.5px", color: "#67787c" }}>
<span>
{t.time}
</span>
<span>
·
</span>
<span>
{t.cat}
</span>
</span>
<span style={{ display: "-webkit-box", marginTop: "6px", fontSize: "12px", lineHeight: "1.45", color: "#4a5560", overflow: "hidden", WebkitLineClamp: "2", WebkitBoxOrient: "vertical" }}>
{t.previa}
</span>
</button>
</Fragment>
))}
{(lib.vazio) ? (<>
<div style={{ padding: "48px 16px", textAlign: "center" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Nenhum template aqui
</div>
<div style={{ fontSize: "12px", color: "#67787c", marginTop: "4px" }}>
Ajuste a busca ou crie um novo.
</div>
</div>
</>) : null}
</div>
<div style={{ minHeight: "0", overflowY: "auto", borderLeft: "1px solid #eef1f1", padding: "18px", display: "flex", flexDirection: "column" }}>
{(lib.temSel) ? (<>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
{lib.sel.nome}
</div>
<div style={{ fontSize: "11.5px", color: "#67787c", marginTop: "3px" }}>
{lib.sel.meta}
</div>
<div style={{ marginTop: "14px", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#67787c" }}>
PRÉVIA COM {lib.sel.para}
</div>
<div style={{ marginTop: "7px", padding: "10px 12px 8px", borderRadius: "12px 12px 4px 12px", background: "#e6f4ee", boxShadow: "inset 0 0 0 1px #d2e9df", fontSize: "13px", lineHeight: "1.5", color: "#12171d", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
{lib.sel.previa}
</div>
{(lib.sel.temVars) ? (<>
<div style={{ marginTop: "14px", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#67787c" }}>
VARIÁVEIS
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "7px" }}>
{(lib.sel.vars ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "6px", background: "#eeeff3", color: "#1f252c", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", display: "inline-flex", alignItems: "center" }}>
{v.nome}
</span>
</Fragment>
))}
</div>
</>) : null}
<span style={{ flex: "1", minHeight: "16px" }} />
<div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
{(lib.sel.meu) ? (<>
<button onClick={lib.sel.editar} style={{ height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Editar
</button>
<button onClick={lib.sel.excluir} title="Excluir" style={{ width: "36px", height: "36px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#c2330f", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
</svg>
</button>
</>) : null}
<button onClick={lib.sel.usar} style={{ flex: "1", height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fe4f2b", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#d93c1a")].filter(Boolean).join(" ")}>
Usar template
</button>
</div>
</>) : null}
{(lib.semSel) ? (<>
<div style={{ margin: "auto", textAlign: "center", fontSize: "12.5px", color: "#67787c" }}>
Escolha um template para ver a prévia.
</div>
</>) : null}
</div>
</>) : null}
{(lib.modoForm) ? (<>
<div style={{ gridColumn: "span 2", minHeight: "0", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)" }}>
<div style={{ minHeight: "0", overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d" }}>
{lib.form.titulo}
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Nome
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<input value={lib.form.nome} onChange={lib.form.setNome} placeholder="Ex: Follow-up pós-demo" style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px" }} />
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Time
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3" }}>
{(lib.form.times ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Categoria
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
{(lib.form.cats ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<button onClick={c.onClick} style={estilo(c.style)}>
{c.label}
</button>
</Fragment>
))}
<input value={lib.form.catNova} onChange={lib.form.setCatNova} placeholder="+ Nova categoria" style={estilo(lib.form.catNovaStyle)} />
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Quem pode usar
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "6px" }}>
{(lib.form.escopos ?? []).map((e: any, i1: number) => (
<Fragment key={e?.id ?? e?.chave ?? i1}>
<button onClick={e.onClick} style={estilo(e.style)}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600" }}>
{e.label}
</span>
<span style={estilo(e.notaStyle)}>
{e.nota}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "7px" }}>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c" }}>
Mensagem
<span style={{ color: "#c2330f" }}>
 *
</span>
</span>
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
Clique numa variável para inserir onde está o cursor
</span>
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
{(lib.form.vars ?? []).map((v: any, i1: number) => (
<Fragment key={v?.id ?? v?.chave ?? i1}>
<button onClick={v.inserir} title={v.label} style={{ height: "26px", padding: "0 9px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", color: "#1f252c" }} className={[hover("background:#f6f6f3;box-shadow:inset 0 0 0 1px #c4c9cb")].filter(Boolean).join(" ")}>
{v.nome}
</button>
</Fragment>
))}
</div>
<textarea ref={tplRef} value={lib.form.texto} onChange={lib.form.setTexto} placeholder="Oi, {primeiro_nome}! ..." style={{ display: "block", width: "100%", minHeight: "150px", padding: "11px 12px", borderRadius: "12px", outline: "0", resize: "vertical", fontSize: "13px", lineHeight: "1.5", background: "#fff", border: "0", boxShadow: "inset 0 0 0 1px #dbdede" }} />
</div>
</div>
<div style={{ minHeight: "0", overflowY: "auto", borderLeft: "1px solid #eef1f1", padding: "18px", display: "flex", flexDirection: "column", background: "#fafafa" }}>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#67787c" }}>
PRÉVIA COM {lib.form.para}
</div>
<div style={{ marginTop: "8px", padding: "10px 12px 8px", borderRadius: "12px 12px 4px 12px", background: "#e6f4ee", boxShadow: "inset 0 0 0 1px #d2e9df", fontSize: "13px", lineHeight: "1.5", color: "#12171d", whiteSpace: "pre-wrap", textWrap: "pretty", minHeight: "44px" }}>
{lib.form.previa}
</div>
<span style={{ flex: "1", minHeight: "16px" }} />
<div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
<button onClick={lib.form.cancelar} style={{ height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={lib.form.salvar} style={estilo(lib.form.btnStyle)}>
{lib.form.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
</div>
</div>
</div>
</>) : null}
{(reu.aberto) ? (<>
<div onMouseDown={fora.reu} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "flex", overflow: "auto", padding: "20px" }}>
<div style={{ margin: "auto", width: "100%", maxWidth: "480px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden", animation: "ofIn .18s ease both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 12px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Agendar reunião
</div>
<div style={{ fontSize: "12.5px", color: "#67787c", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.sub}
</div>
</div>
<button onClick={reu.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", margin: "-4px -6px 0 0", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Título
</div>
<input value={reu.titulo} onChange={reu.setTitulo} style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13.5px", fontWeight: "600", color: "#12171d" }} />
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,.9fr) minmax(0,1.4fr)", gap: "8px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Data
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<input type="date" value={reu.data} onChange={reu.setData} style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Horário
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<input type="time" value={reu.hora} onChange={reu.setHora} style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Duração 
<span style={{ fontWeight: "500", color: "#67787c" }}>
(min)
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "2px", padding: "3px", height: "36px", borderRadius: "9999px", background: "#eeeff3" }}>
{(reu.durs ?? []).map((d: any, i1: number) => (
<Fragment key={d?.id ?? d?.chave ?? i1}>
<button onClick={d.onClick} style={estilo(d.style)}>
{d.label}
</button>
</Fragment>
))}
</div>
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Tipo
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3" }}>
{(reu.tipos ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Participantes
</div>
<div style={{ borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px" }}>
<span style={estilo(cv.avMini)}>
{cv.iniciais}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
{cv.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{reu.email}
</span>
</span>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#67787c" }}>
Contato
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderTop: "1px solid #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", background: "#12171d", color: "#fff", fontSize: "10px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{reu.respIni}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", fontWeight: "600", color: "#12171d" }}>
Quem conduz
</span>
<button data-of-atpop="1" onClick={pops.conduz} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 10px 0 12px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer", fontSize: "12.5px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span>
{reu.resp}
</span>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
{(reu.convidados ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderTop: "1px solid #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", display: "grid", placeItems: "center" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{g.email}
</span>
<button onClick={g.remover} title="Remover" style={{ width: "24px", height: "24px", borderRadius: "9999px", border: "0", background: "transparent", color: "#67787c", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
{(reu.addFechado) ? (<>
<button onClick={reu.abrirAdd} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", border: "0", borderTop: "1px solid #eef1f1", background: "#fff", cursor: "pointer", textAlign: "left", fontSize: "12.5px", fontWeight: "600", color: "#1f252c" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</span>
<span>
Adicionar convidado
</span>
</button>
</>) : null}
{(reu.addAberto) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 8px 8px 12px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<input ref={convRef} type="email" value={reu.conv} onChange={reu.setConv} onKeyDown={reu.teclaConv} placeholder="nome@empresa.com.br" style={estilo(reu.convStyle)} />
<button onClick={reu.addConv} style={{ flex: "0 0 auto", height: "32px", padding: "0 12px", borderRadius: "9999px", border: "0", background: "#12171d", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Adicionar
</button>
<button onClick={reu.fecharAdd} title="Cancelar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", border: "0", background: "transparent", color: "#67787c", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</>) : null}
</div>
{(reu.erroConv) ? (<>
<div style={{ fontSize: "11.5px", color: "#d93c1a", marginTop: "6px" }}>
E-mail inválido.
</div>
</>) : null}
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Pauta
</div>
<textarea value={reu.desc} onChange={reu.setDesc} placeholder="O que vai ser tratado na reunião" style={{ display: "block", width: "100%", minHeight: "64px", padding: "10px 12px", borderRadius: "12px", outline: "0", resize: "vertical", fontSize: "13px", lineHeight: "1.45", background: "#fff", border: "0", boxShadow: "inset 0 0 0 1px #dbdede" }} />
</div>
<button onClick={reu.alternarEnviar} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 14px", borderRadius: "12px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Mandar o convite nesta conversa
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{reu.enviarNota}
</span>
</span>
<span style={estilo(reu.trilho)}>
<span style={{ width: "16px", height: "16px", borderRadius: "9999px", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
</span>
</button>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={reu.fechar} style={{ height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={reu.confirmar} style={estilo(reu.btnStyle)}>
Agendar reunião
</button>
</div>
</div>
</div>
</>) : null}
{(ret.aberto) ? (<>
<div onMouseDown={fora.ret} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "flex", overflow: "auto", padding: "20px" }}>
<div style={{ margin: "auto", width: "100%", maxWidth: "440px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden", animation: "ofIn .18s ease both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 12px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Retornar depois
</div>
<div style={{ fontSize: "12.5px", color: "#67787c", marginTop: "3px" }}>
A conversa sai da fila e volta no horário marcado.
</div>
</div>
<button onClick={ret.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", margin: "-4px -6px 0 0", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Quando volta
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "6px" }}>
{(ret.opcoes ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600" }}>
{o.label}
</span>
<span style={estilo(o.notaStyle)}>
{o.nota}
</span>
</button>
</Fragment>
))}
</div>
{(ret.escolher) ? (<>
<div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
<input type="date" value={ret.data} onChange={ret.setData} style={{ flex: "1", minWidth: "0", height: "36px", padding: "0 12px", borderRadius: "9999px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
<input type="time" value={ret.hora} onChange={ret.setHora} style={{ flex: "0 0 110px", height: "36px", padding: "0 12px", borderRadius: "9999px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
</div>
</>) : null}
</div>
<div style={{ borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden" }}>
<button onClick={ret.alternarAtv} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 14px", border: "0", background: "#fff", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Criar atividade para não esquecer
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
Aparece na sua agenda e na próxima ação do lead
</span>
</span>
<span style={estilo(ret.trilho)}>
<span style={{ width: "16px", height: "16px", borderRadius: "9999px", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
</span>
</button>
{(ret.atv) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "2px 14px 14px", borderTop: "1px solid #eef1f1", paddingTop: "12px" }}>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(ret.tipos ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<button onClick={t.onClick} style={estilo(t.style)}>
{t.label}
</button>
</Fragment>
))}
</div>
<input value={ret.titulo} onChange={ret.setTitulo} placeholder="Título da atividade" style={{ height: "36px", padding: "0 12px", borderRadius: "10px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px" }} />
<textarea value={ret.desc} onChange={ret.setDesc} placeholder="Descrição (opcional)" style={{ minHeight: "62px", padding: "9px 12px", borderRadius: "10px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.45" }} />
</div>
</>) : null}
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={ret.fechar} style={{ height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={ret.confirmar} style={estilo(ret.btnStyle)}>
{ret.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(iaM.aberto) ? (<>
<div onMouseDown={fora.iaM} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "flex", overflow: "auto", padding: "20px" }}>
<div style={{ margin: "auto", width: "100%", maxWidth: "500px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden", animation: "ofIn .18s ease both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", padding: "16px 18px", background: "#12171d", color: "#fff" }}>
<img src="/proto/oni-avatar.png" alt="" style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "11px", objectFit: "cover", background: "#1f252c" }} />
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em" }}>
Deixar o NEXO responder
</div>
<div style={{ fontSize: "12.5px", color: "#a3a8a4", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{iaM.sub}
</div>
</div>
<button onClick={iaM.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "9999px", border: "0", background: "transparent", color: "#a3a8a4", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#1f252c;color:#fff")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: "18px" }}>
<div style={{ padding: "12px 14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.4", textWrap: "pretty" }}>
Antes de responder, o NEXO lê a conversa e o contexto do lead e da empresa para continuar de onde você parou.
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
{(iaM.contexto ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 10px 0 8px", borderRadius: "9999px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "11.5px", color: "#1f252c", whiteSpace: "nowrap" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1f7256" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
<span style={{ fontWeight: "600" }}>
{c.label}
</span>
<span style={{ color: "#67787c" }}>
{c.valor}
</span>
</span>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Até quando
</div>
<div style={{ borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden" }}>
{(iaM.ates ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<div style={estilo(o.linha)}>
<button onClick={o.onClick} style={{ display: "flex", alignItems: "center", gap: "11px", width: "100%", padding: "10px 12px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={estilo(o.radio)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{o.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{o.nota}
</span>
</span>
</button>
{(o.temHora) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 12px 11px 39px" }}>
<input type="time" value={iaM.hora} onChange={iaM.setHora} style={{ height: "32px", padding: "0 10px", borderRadius: "9999px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontVariantNumeric: "tabular-nums" }} />
<span style={{ fontSize: "11.5px", color: "#67787c" }}>
de hoje
</span>
</div>
</>) : null}
</div>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "2px" }}>
O que o NEXO deve fazer
</div>
<div style={{ fontSize: "11.5px", color: "#67787c", marginBottom: "8px" }}>
Escolha um ou mais objetivos
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(iaM.objetivos ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "2px" }}>
Tom
</div>
<div style={{ fontSize: "11.5px", color: "#67787c", marginBottom: "8px" }}>
{iaM.tomNota}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3" }}>
{(iaM.tons ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Limites
</div>
<div style={{ borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden" }}>
{(iaM.limites ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{o.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{o.nota}
</span>
</span>
<span style={estilo(o.trilho)}>
<span style={{ width: "16px", height: "16px", borderRadius: "9999px", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Instruções extras
</div>
<textarea value={iaM.instr} onChange={iaM.setInstr} placeholder={iaM.instrDica} style={{ display: "block", width: "100%", minHeight: "70px", padding: "10px 12px", borderRadius: "12px", outline: "0", resize: "vertical", fontSize: "13px", lineHeight: "1.45", background: "#fff", border: "0", boxShadow: "inset 0 0 0 1px #dbdede" }} />
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
{(iaM.editando) ? (<>
<button onClick={iaM.desativar} style={{ height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "transparent", fontSize: "13px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fff6f4")].filter(Boolean).join(" ")}>
Desativar
</button>
</>) : null}
<span style={{ flex: "1" }} />
<button onClick={iaM.fechar} style={{ height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={iaM.confirmar} style={estilo(iaM.btnStyle)}>
{iaM.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(tr.aberto) ? (<>
<div onMouseDown={fora.tr} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "flex", overflow: "auto", padding: "20px" }}>
<div style={{ margin: "auto", width: "100%", maxWidth: "460px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden", animation: "ofIn .18s ease both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 14px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Transferir conversa
</div>
<div style={{ fontSize: "12.5px", color: "#67787c", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{tr.sub}
</div>
</div>
<button onClick={tr.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "30px", height: "30px", margin: "-4px -6px 0 0", borderRadius: "9999px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<div style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c", marginBottom: "7px" }}>
Para quem
<span style={{ color: "#c2330f" }}>
 *
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3", marginBottom: "8px" }}>
{(tr.abas ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={estilo(a.style)}>
{a.label}
</button>
</Fragment>
))}
</div>
{(tr.temDica) ? (<>
<div style={{ fontSize: "11.5px", color: "#67787c", margin: "0 2px 8px", lineHeight: "1.4" }}>
{tr.dica}
</div>
</>) : null}
<div style={{ borderRadius: "12px", border: "1px solid #e3e7e8", overflow: "hidden" }}>
{(tr.pessoas ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<button onClick={p.onClick} style={estilo(p.style)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ position: "relative", flex: "0 0 auto", display: "flex" }}>
<span style={estilo(p.av)}>
{(p.temImg) ? (<>
<img src="/proto/oni-avatar.png" alt="" style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }} />
</>) : null}
{(p.temIco) ? (<>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={p.d} />
</svg>
</>) : null}
{(p.temIni) ? (<>
<span>
{p.ini}
</span>
</>) : null}
</span>
<span style={estilo(p.presenca)} />
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.info}
</span>
</span>
<span style={estilo(p.check)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</span>
</button>
</Fragment>
))}
</div>
{(tr.erroPessoa) ? (<>
<div style={{ fontSize: "11.5px", color: "#d93c1a", marginTop: "6px" }}>
Escolha quem vai receber a conversa.
</div>
</>) : null}
</div>
<div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "7px" }}>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#1f252c" }}>
Nota para quem recebe
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", height: "18px", padding: "0 6px", borderRadius: "5px", background: "#fff6f4", color: "#9c3210", fontSize: "10.5px", fontWeight: "600" }}>
<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
<rect x="4" y="11" width="16" height="10" rx="2" />
<path d="M8 11V7a4 4 0 0 1 8 0v4" />
</svg>
 Interna 
</span>
</div>
<textarea value={tr.nota} onChange={tr.setNota} placeholder={tr.notaDica} style={{ display: "block", width: "100%", minHeight: "76px", padding: "10px 12px", borderRadius: "12px", outline: "0", resize: "vertical", fontSize: "13px", lineHeight: "1.45", background: "#fff", border: "0", boxShadow: "inset 0 0 0 1px #dbdede" }} />
</div>
<div style={{ borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "12px 12px 12px 14px" }}>
<button onClick={tr.alternarHist} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
Levar histórico
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{tr.histResumo}
</span>
</span>
<span style={estilo(tr.switchTrilho)}>
<span style={estilo(tr.switchBola)} />
</span>
</button>
{(tr.comHist) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "9999px", background: "#eeeff3", marginTop: "12px" }}>
{(tr.periodos ?? []).map((o: any, i1: number) => (
<Fragment key={o?.id ?? o?.chave ?? i1}>
<button onClick={o.onClick} style={estilo(o.style)}>
{o.label}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={tr.fechar} style={{ height: "36px", padding: "0 16px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={tr.confirmar} style={estilo(tr.btnStyle)}>
{tr.btnLabel}
</button>
</div>
</div>
</div>
</>) : null}
{(enc.aberto) ? (<>
<div data-r="modal-fundo" onMouseDown={fora.enc} style={{ position: "fixed", inset: "0", zIndex: "80", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div style={{ width: "100%", maxWidth: "440px", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "14px", boxShadow: "0 24px 60px -12px rgba(18,23,29,.35),inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 12px" }}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
Encerrar atendimento
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "2px" }}>
{enc.sub}
</div>
</div>
<button onClick={enc.fechar} title="Fechar" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#4a5560", cursor: "pointer", display: "grid", placeItems: "center" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflow: "auto", padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
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
{(enc.motivos ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={estilo(m.style)}>
<span style={estilo(m.radio)} />
<span style={{ flex: "1", minWidth: "0" }}>
{m.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".07em", color: "#4a5560", marginBottom: "7px" }}>
{enc.obsLabel}
</div>
<textarea value={enc.obs} onChange={enc.setObs} placeholder="Contexto para o time" style={estilo(enc.obsStyle)} />
</div>
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={enc.fechar} style={{ height: "36px", padding: "0 14px", borderRadius: "9999px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "500", color: "#1f252c", cursor: "pointer" }}>
Cancelar
</button>
<button onClick={enc.confirmar} style={estilo(enc.btnStyle)}>
Encerrar
</button>
</div>
</div>
</div>
</>) : null}
</div>

    </>
  );
}
