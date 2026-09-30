"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Oportunidade.dc.html
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
import "./OportunidadeDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeOportunidadeDesenho {
  abaArq: any;
  abaAtv: any;
  abaGeral: any;
  abaProp: any;
  abaTl: any;
  abas: any;
  abrirEmpresa: any;
  abrirPessoa: any;
  addPessoa: any;
  anexar: any;
  anexou: any;
  arqRef: any;
  arquivos: any;
  atvFiltros: any;
  atvMaisGeral: any;
  atvVazia: any;
  atvs: any;
  atvsGeral: any;
  avancar: any;
  avancarDica: any;
  avancarLabel: any;
  cancelarResumo: any;
  contatoAcoes: any;
  derivar: any;
  editarResumo: any;
  envolvidos: any;
  equipe: any;
  etapasAberto: any;
  etapasItens: any;
  fecharMenus: any;
  fecharModal: any;
  irAtividades: any;
  irPipeline: any;
  irPropostas: any;
  irTimeline: any;
  itens: any;
  m: any;
  maisAberto: any;
  maisItens: any;
  menuAberto: any;
  nEnvolvidos: any;
  naturezas: any;
  notaRef: any;
  novaAberto: any;
  novaItens: any;
  novaProposta: any;
  novaPropostaLabel: any;
  nt: any;
  o: any;
  orig: any;
  pa: any;
  papeis: any;
  parar: any;
  prodFonte: any;
  prodRec: any;
  prodTotal: any;
  propResumo: any;
  propTitulo: any;
  propostas: any;
  reabrir: any;
  registrar: any;
  relTiles: any;
  resEditando: any;
  resLendo: any;
  resumo: any;
  salvarResumo: any;
  semArq: any;
  semAtvs: any;
  semEnvolvidos: any;
  semItens: any;
  semO: any;
  semPropostas: any;
  setResp: any;
  temEnvolvidos: any;
  temItens: any;
  temModal: any;
  temO: any;
  tg: any;
  tlResumo: any;
  tlTudo: any;
  toggleEtapas: any;
  toggleMais: any;
  toggleNova: any;
}

export function OportunidadeDesenho(vals: ValoresDeOportunidadeDesenho) {
  const { abaArq, abaAtv, abaGeral, abaProp, abaTl, abas, abrirEmpresa, abrirPessoa, addPessoa, anexar, anexou, arqRef, arquivos, atvFiltros, atvMaisGeral, atvVazia, atvs, atvsGeral, avancar, avancarDica, avancarLabel, cancelarResumo, contatoAcoes, derivar, editarResumo, envolvidos, equipe, etapasAberto, etapasItens, fecharMenus, fecharModal, irAtividades, irPipeline, irPropostas, irTimeline, itens, m, maisAberto, maisItens, menuAberto, nEnvolvidos, naturezas, notaRef, novaAberto, novaItens, novaProposta, novaPropostaLabel, nt, o, orig, pa, papeis, parar, prodFonte, prodRec, prodTotal, propResumo, propTitulo, propostas, reabrir, registrar, relTiles, resEditando, resLendo, resumo, salvarResumo, semArq, semAtvs, semEnvolvidos, semItens, semO, semPropostas, setResp, temEnvolvidos, temItens, temModal, temO, tg, tlResumo, tlTudo, toggleEtapas, toggleMais, toggleNova } = vals;
  return (
    <>
<div style={{ flex: "1", minHeight: "0", background: "#f6f6f3", display: "flex", flexDirection: "column", overflow: "hidden" }}>
{(menuAberto) ? (<>
<div onClick={fecharMenus} style={{ position: "fixed", inset: "0", zIndex: "30" }} />
</>) : null}
{(semO) ? (<>
<div style={{ flex: "1", display: "grid", placeItems: "center", padding: "24px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", color: "#12171d" }}>
Oportunidade não encontrada
</span>
<span style={{ fontSize: "13px", color: "#67787c" }}>
Ela pode ter sido removida ou o link está incompleto.
</span>
<button onClick={irPipeline} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#12171d", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
Voltar ao Pipeline
</button>
</div>
</div>
</>) : null}
{(temO) ? (<>
<div data-in="blur" style={{ flex: "0 0 auto", padding: "16px 16px 0" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
<span style={{ flex: "0 0 auto", width: "60px", height: "60px", borderRadius: "13px", background: "#fe4f2b", color: "#fff", display: "grid", placeItems: "center" }}>
<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6M12 10a2 2 0 1 0 2 2M22 2l-10 10M16 2h6v6" />
</svg>
</span>
<div style={{ flex: "1", minWidth: "240px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: "700", letterSpacing: ".09em", color: "#67787c" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6" />
</svg>
<span>
OPORTUNIDADE
</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginTop: "3px" }}>
<span style={{ flex: "0 1 auto", minWidth: "0", display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "25px", fontWeight: "700", letterSpacing: "-.025em", color: "#12171d", lineHeight: "1.15", textWrap: "balance" }}>
{o.titulo}
</span>
<span style={estilo(o.etapaChip)}>
<span style={estilo(o.etapaPonto)} />
<span>
{o.etapaLabel}
</span>
</span>
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
</div>
</div>
<div data-r="toolbar" style={{ flex: "0 1 auto", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: "7px" }}>
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
<button onClick={derivar} title="Abrir outra oportunidade para outro produto, na mesma empresa" style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 13px", borderRadius: "9px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9" />
</svg>
<span>
Derivar oportunidade
</span>
</button>
{(o.aberta) ? (<>
<div style={{ position: "relative", display: "flex", zIndex: "31" }}>
<button onClick={avancar} title={avancarDica} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px 0 0 9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#12171d", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
<span>
{avancarLabel}
</span>
</button>
<button onClick={toggleEtapas} title="Escolher etapa" style={{ width: "32px", height: "36px", marginLeft: "-1px", borderRadius: "0 9px 9px 0", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#4a5560", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(etapasAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", right: "0", minWidth: "220px", padding: "5px", borderRadius: "11px", background: "#fff", boxShadow: "0 0 0 1px #e3e7e8,0 14px 34px -10px rgba(18,23,29,.3)", display: "flex", flexDirection: "column", gap: "1px" }}>
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
</>) : null}
<button onClick={novaProposta} style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", height: "36px", padding: "0 16px 0 12px", borderRadius: "9px", border: "0", background: "linear-gradient(180deg,#ff6241 0%,#fe4f2b 55%,#ef4522 100%)", color: "#fff", fontSize: "13px", fontWeight: "700", letterSpacing: "-.005em", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.12),0 1px 2px rgba(194,51,15,.35),0 6px 16px -6px rgba(254,79,43,.65)" }} className={[hover("background:linear-gradient(180deg,#ff6c4d 0%,#ff5733 55%,#f24a26 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.32),inset 0 -1px 0 rgba(0,0,0,.12),0 2px 4px rgba(194,51,15,.35),0 10px 22px -8px rgba(254,79,43,.8);transform:translateY(-1px)")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "6px", background: "rgba(255,255,255,.2)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)", display: "grid", placeItems: "center" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6" />
</svg>
</span>
<span>
{novaPropostaLabel}
</span>
</button>
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
{(o.fechada) ? (<>
<div style={estilo(o.fechoStyle)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={o.fechoIco} />
</svg>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "700" }}>
{o.fechoTitulo}
</span>
<span style={{ display: "block", fontSize: "12px", marginTop: "1px", opacity: ".85" }}>
{o.fechoSub}
</span>
</span>
<button onClick={reabrir} style={{ flex: "0 0 auto", height: "30px", padding: "0 11px", borderRadius: "8px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", fontSize: "12px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
Reabrir
</button>
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
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M4 6h16M4 12h16M4 18h10" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Resumo da oportunidade
</span>
{(resLendo) ? (<>
<button onClick={editarResumo} style={{ display: "flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
</svg>
<span>
Editar
</span>
</button>
</>) : null}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(resumo ?? []).map((rs: any, i1: number) => (
<Fragment key={rs?.id ?? rs?.chave ?? i1}>
<div style={estilo(rs.linha)}>
<span style={{ fontSize: "12.5px", color: "#67787c", paddingTop: "2px" }}>
{rs.label}
</span>
{(resLendo) ? (<>
<span style={estilo(rs.valorStyle)}>
{rs.valor}
</span>
</>) : null}
{(resEditando) ? (<>
<textarea value={rs.draft} onChange={rs.set} placeholder={rs.dica} rows={2} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "0", outline: "0", resize: "vertical", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", lineHeight: "1.5", color: "#12171d" }} />
</>) : null}
</div>
</Fragment>
))}
</div>
{(resEditando) ? (<>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "10px" }}>
<button onClick={cancelarResumo} style={{ height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={salvarResumo} style={{ height: "32px", padding: "0 14px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Salvar resumo
</button>
</div>
</>) : null}
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Produtos e valores
</span>
<span style={{ fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap" }}>
{prodFonte}
</span>
</div>
{(temItens) ? (<>
<div style={{ overflowX: "auto" }}>
<div style={{ minWidth: "460px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,2.2fr) minmax(0,1fr) 70px minmax(0,1fr) minmax(0,1fr)", gap: "10px", padding: "8px 10px", borderRadius: "8px", background: "#fafafa", fontSize: "11.5px", fontWeight: "600", color: "#67787c" }}>
<span>
Produto / serviço
</span>
<span>
Natureza
</span>
<span style={{ textAlign: "center" }}>
Qtd
</span>
<span style={{ textAlign: "right" }}>
Valor unitário
</span>
<span style={{ textAlign: "right" }}>
Valor total
</span>
</div>
{(itens ?? []).map((it: any, i1: number) => (
<Fragment key={it?.id ?? it?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,2.2fr) minmax(0,1fr) 70px minmax(0,1fr) minmax(0,1fr)", gap: "10px", alignItems: "center", padding: "10px", borderBottom: "1px solid #f3f5f5" }}>
<span style={{ minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.nome}
</span>
<span style={{ fontSize: "12.5px", color: "#4a5560" }}>
{it.natureza}
</span>
<span style={{ fontSize: "12.5px", color: "#4a5560", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
{it.qtd}
</span>
<span style={{ fontSize: "12.5px", color: "#4a5560", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.unit}
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.total}
</span>
</div>
</Fragment>
))}
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "12px 10px 2px" }}>
<span style={{ flex: "1", fontSize: "12.5px", color: "#67787c" }}>
{prodRec}
</span>
<span style={{ fontSize: "12.5px", fontWeight: "600", color: "#4a5560" }}>
Total
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "17px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{prodTotal}
</span>
</div>
</div>
</div>
</>) : null}
{(semItens) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", borderRadius: "10px", background: "#fafafa" }}>
<span style={{ flex: "1", fontSize: "13px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
O valor nasce na proposta. Crie a primeira para registrar produtos e valores.
</span>
<button onClick={novaProposta} style={{ flex: "0 0 auto", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
Criar proposta
</button>
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
<label title="Anexar arquivo" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "7px", display: "grid", placeItems: "center", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
</svg>
<input type="file" multiple={true} onChange={nt.anexar} style={{ display: "none" }} />
</label>
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
<button onClick={n.fixar} title={n.fixarTitulo} style={estilo(n.fixarStyle)} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 17v5M9 10.8V4h6v6.8l3 3.2v2H6v-2z" />
</svg>
</button>
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
Timeline
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
Empresa vinculada
</span>
<button onClick={abrirEmpresa} style={{ height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Ver empresa
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
Contato principal
</span>
<button onClick={addPessoa} title="Vincular pessoa à oportunidade" style={{ order: "2", width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
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
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", height: "20px", padding: "0 7px", borderRadius: "6px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "700" }}>
Principal
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
<div style={{ marginTop: "16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
<span style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".07em", textTransform: "uppercase", color: "#67787c" }}>
Também na negociação
</span>
{(temEnvolvidos) ? (<>
<span style={{ display: "inline-grid", placeItems: "center", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "10.5px", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
{nEnvolvidos}
</span>
</>) : null}
</div>
<div style={{ borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(envolvidos ?? []).map((ev: any, i1: number) => (
<Fragment key={ev?.id ?? ev?.chave ?? i1}>
<div style={estilo(ev.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<button onClick={ev.abrir} title="Abrir contato" style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "10px", padding: "0", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9999px", background: "linear-gradient(180deg,#f6f6f3,#eceeee)", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#1f252c", fontSize: "11.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{ev.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ev.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{ev.sub}
</span>
</span>
</button>
<label title="Papel na negociação" style={estilo(ev.papelStyle)}>
<span>
{ev.papel}
</span>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", opacity: ".7" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={ev.papel} onChange={ev.setPapel} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(papeis ?? []).map((pp: any, i2: number) => (
<Fragment key={pp?.id ?? pp?.chave ?? i2}>
<option value={pp}>
{pp}
</option>
</Fragment>
))}
</select>
</label>
<button onClick={ev.remover} title="Desvincular da oportunidade" style={{ flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "7px", border: "0", background: "transparent", color: "#b8bdbb", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
{(semEnvolvidos) ? (<>
<div style={{ padding: "12px", fontSize: "12px", color: "#67787c", textWrap: "pretty" }}>
Só o contato principal por enquanto. Vincule decisor, financeiro ou técnico.
</div>
</>) : null}
<button onClick={addPessoa} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", border: "0", borderTop: "1px solid #eef1f1", background: "#fff", cursor: "pointer", textAlign: "left", color: "#4a5560", fontSize: "12.5px", fontWeight: "600" }} className={[hover("background:#fafafa;color:#12171d")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9999px", border: "1.5px dashed #c8ccc9", display: "grid", placeItems: "center", boxSizing: "border-box" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</span>
<span>
Vincular pessoa
</span>
</button>
</div>
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
Origem da oportunidade
</span>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "5px", height: "24px", padding: "0 9px", borderRadius: "7px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "600", whiteSpace: "nowrap" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
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
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 14px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Propostas
</span>
<button onClick={irPropostas} style={{ height: "28px", padding: "0 9px", borderRadius: "7px", border: "0", background: "transparent", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", cursor: "pointer" }} className={[hover("background:#eeeff3")].filter(Boolean).join(" ")}>
Ver todas
</button>
<button onClick={novaProposta} title="Nova proposta" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", color: "#1f252c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(propResumo ?? []).map((pr: any, i1: number) => (
<Fragment key={pr?.id ?? pr?.chave ?? i1}>
<button onClick={irPropostas} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #eef1f1", cursor: "pointer", textAlign: "left" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", background: "#fdeeea", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={estilo(pr.codStyle)}>
{pr.codigo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pr.meta}
</span>
</span>
<span style={estilo(pr.statusStyle)}>
{pr.status}
</span>
<span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pr.total}
</span>
</button>
</Fragment>
))}
{(semPropostas) ? (<>
<div style={{ padding: "12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#67787c" }}>
Nenhuma proposta ainda.
</div>
</>) : null}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
</svg>
<span style={{ flex: "1", minWidth: "0", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
Relacionamentos
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" }}>
{(relTiles ?? []).map((rt: any, i1: number) => (
<Fragment key={rt?.id ?? rt?.chave ?? i1}>
<button onClick={rt.onClick} style={estilo(rt.linha)} className={[hover("background:#fafafa")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", background: "#f3f4f4", color: "#4a5560", display: "grid", placeItems: "center" }}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d={rt.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{rt.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{rt.acao}
</span>
</span>
<span style={{ flex: "0 0 auto", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{rt.n}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b8bdbb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 6 6 6-6 6" />
</svg>
</button>
</Fragment>
))}
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
{(abaArq) ? (<>
<section style={{ maxWidth: "980px", background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13.5px", fontWeight: "700", color: "#12171d" }}>
Arquivos
</span>
<input ref={arqRef} type="file" multiple={true} onChange={anexou} style={{ display: "none" }} />
<button onClick={anexar} style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: "600", color: "#1f252c", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
</svg>
<span>
Anexar arquivo
</span>
</button>
</div>
{(arquivos ?? []).map((aq: any, i1: number) => (
<Fragment key={aq?.id ?? aq?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 12px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "9px", background: "#fdeeea", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{aq.nome}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#67787c", marginTop: "1px" }}>
{aq.meta}
</span>
</span>
</div>
</Fragment>
))}
{(semArq) ? (<>
<div style={{ padding: "16px 12px", borderRadius: "10px", background: "#fafafa", fontSize: "12.5px", color: "#67787c" }}>
Nenhum arquivo. Propostas geradas e anexos aparecem aqui.
</div>
</>) : null}
</section>
</>) : null}
{(abaProp) ? (<>
<section style={{ maxWidth: "980px", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "13px", color: "#67787c" }}>
{propTitulo}
</span>
<button onClick={novaProposta} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", borderRadius: "8px", border: "0", background: "#12171d", color: "#fff", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }} className={[hover("background:#1f252c")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
{novaPropostaLabel}
</span>
</button>
</div>
{(semPropostas) ? (<>
<div style={{ padding: "18px 16px", borderRadius: "12px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", fontSize: "13px", color: "#4a5560", lineHeight: "1.5" }}>
O valor nasce na proposta. Crie a primeira para a oportunidade poder seguir para Proposta.
</div>
</>) : null}
{(propostas ?? []).map((pr: any, i1: number) => (
<Fragment key={pr?.id ?? pr?.chave ?? i1}>
<div style={{ background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", padding: "6px 12px" }}>
<button onClick={pr.alternar} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 2px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left" }}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(pr.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
<span style={estilo(pr.codStyle)}>
{pr.codigo}
</span>
<span style={estilo(pr.statusStyle)}>
{pr.status}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pr.meta}
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{pr.total}
</span>
</button>
{(pr.aberta) ? (<>
<div style={{ margin: "2px 0 0 25px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
{(pr.itens ?? []).map((it: any, i2: number) => (
<Fragment key={it?.id ?? it?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "3px 0" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{it.nome}
</span>
<span style={{ fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap" }}>
{it.natureza}
</span>
<span style={{ fontSize: "12.5px", color: "#4a5560", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{it.valor}
</span>
</div>
</Fragment>
))}
<div style={{ height: "1px", background: "#e3e7e8", margin: "8px 0" }} />
<div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
<span style={{ flex: "1", fontSize: "12px", color: "#67787c" }}>
{pr.rec}
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{pr.totalLinha}
</span>
</div>
</div>
{(pr.temAceite) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "10px 0 0 25px", padding: "10px 12px", borderRadius: "10px", background: "#e6f4ee", fontSize: "12.5px", fontWeight: "600", color: "#1f7256" }}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M20 6 9 17l-5-5" />
</svg>
<span style={{ minWidth: "0", textWrap: "pretty" }}>
{pr.aceiteTxt}
</span>
</div>
</>) : null}
{(pr.temResp) ? (<>
<div style={{ margin: "10px 0 0 25px" }}>
<div style={estilo(pr.respStyle)}>
<span style={estilo(pr.respTitStyle)}>
{pr.respTit}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#1f252c", lineHeight: "1.55", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
{pr.respTxt}
</span>
</div>
</div>
</>) : null}
{(pr.temLog) ? (<>
<div style={{ margin: "12px 0 0 25px", padding: "12px 14px", borderRadius: "10px", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
<span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#67787c" }}>
Acompanhamento
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pr.logResumo}
</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(pr.log ?? []).map((lg: any, i2: number) => (
<Fragment key={lg?.id ?? lg?.chave ?? i2}>
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", minHeight: "24px" }}>
<span style={estilo(lg.linha)} />
<span style={estilo(lg.ico)}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d={lg.d} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{lg.t}
</span>
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#8b949e", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
{lg.quando}
</span>
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
<div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", margin: "12px 0 8px 25px" }}>
{(pr.acoes ?? []).map((pa: any, i2: number) => (
<Fragment key={pa?.id ?? pa?.chave ?? i2}>
<button onClick={pa.onClick} style={estilo(pa.style)}>
{pa.label}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</Fragment>
))}
</section>
</>) : null}
</div>
</>) : null}

{(pa.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={pa.fechar} style={{ position: "fixed", inset: "0", zIndex: "62", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(460px,100%)", background: "#fff", borderRadius: "14px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={estilo(pa.icoStyle)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={pa.icoD} />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d" }}>
{pa.titulo}
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{pa.sub}
</span>
</span>
</div>
{(pa.rec) ? (<>
<label style={{ display: "block" }}>
<span style={{ display: "flex", gap: "3px", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", marginBottom: "6px" }}>
Motivo informado pelo cliente
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<textarea value={pa.txt} onChange={pa.setTxt} rows={4} placeholder="Ex: fechou com outro fornecedor com mensalidade menor." style={estilo(pa.txStyle)} />
<span style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "11.5px" }}>
{(pa.erro) ? (<>
<span style={{ color: "#c2330f", fontWeight: "600" }}>
Escreva pelo menos 10 caracteres.
</span>
</>) : null}
<span style={{ flex: "1" }} />
<span style={{ color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
{pa.contagem}
</span>
</span>
</label>
</>) : null}
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<button onClick={pa.fechar} style={{ height: "38px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={pa.confirmar} style={estilo(pa.confStyle)}>
{pa.confTxt}
</button>
</div>
</div>
</div>
</>) : null}
{(temModal) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fecharModal} style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(540px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "14px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 18px 0" }}>
<span style={estilo(m.icoStyle)}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={m.d} />
</svg>
</span>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", letterSpacing: "-.01em", color: "#12171d" }}>
{m.titulo}
</div>
<div style={{ fontSize: "12.5px", color: "#4a5560", marginTop: "2px", textWrap: "pretty" }}>
{m.sub}
</div>
</div>
<button onClick={fecharModal} title="Fechar" style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#eeeff3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1", minHeight: "0", overflow: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
{(m.temVer) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "12px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "#12171d", textWrap: "pretty" }}>
{m.ver.titulo}
</div>
<div style={estilo(m.ver.descStyle)}>
{m.ver.desc}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "10px", paddingTop: "10px", borderTop: "1px solid #eef1f1" }}>
{(m.ver.meta ?? []).map((vm: any, i1: number) => (
<Fragment key={vm?.id ?? vm?.chave ?? i1}>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "11px", color: "#67787c" }}>
{vm.label}
</div>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#12171d", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{vm.valor}
</div>
</div>
</Fragment>
))}
</div>
</div>
</>) : null}
{(m.ehDerivar) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 28px minmax(0,1fr)", alignItems: "center", gap: "6px" }}>
<div style={{ minWidth: "0", padding: "11px 12px", borderRadius: "11px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#8b949e" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
Origem
</span>
<span style={{ display: "block", marginTop: "5px", fontSize: "13px", fontWeight: "600", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.dv.origem}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.dv.origemSub}
</span>
</div>
<span style={{ display: "grid", placeItems: "center", color: "#b8bdbb" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 12h14M13 6l6 6-6 6" />
</svg>
</span>
<div style={{ minWidth: "0", padding: "11px 12px", borderRadius: "11px", background: "#fff", boxShadow: "inset 0 0 0 1.5px #12171d" }}>
<span style={{ display: "block", fontSize: "10.5px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#c2330f" }}>
Nova
</span>
<span style={{ display: "block", marginTop: "5px", fontSize: "13px", fontWeight: "700", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.dv.nova}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.dv.novaSub}
</span>
</div>
</div>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Produto
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px" }}>
{(m.dv.produtos ?? []).map((pd: any, i1: number) => (
<Fragment key={pd?.id ?? pd?.chave ?? i1}>
<button onClick={pd.onClick} title={pd.dica} style={estilo(pd.style)}>
<span style={estilo(pd.ico)}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={pd.d} />
</svg>
</span>
<span style={{ display: "block", marginTop: "10px", fontSize: "13px", fontWeight: "700", color: "inherit" }}>
{pd.label}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e" }}>
{pd.sub}
</span>
</button>
</Fragment>
))}
</div>
{(m.dv.temAviso) ? (<>
<span style={{ display: "block", marginTop: "7px", fontSize: "11.5px", fontWeight: "600", color: "#c2330f" }}>
{m.dv.aviso}
</span>
</>) : null}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" }}>
<div style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Responsável
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", height: "46px", padding: "0 12px 0 7px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{m.dv.respIni}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.dv.resp}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={m.dv.resp} onChange={m.dv.setResp} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(m.dv.equipe ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op}>
{op}
</option>
</Fragment>
))}
</select>
</label>
</div>
<div style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Contato principal
</span>
<label style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", height: "46px", padding: "0 12px 0 7px", borderRadius: "10px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1px #a9b1b4")].filter(Boolean).join(" ")}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#eeeff3", color: "#4a5560", fontSize: "11.5px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{m.dv.pesIni}
</span>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.dv.pessoa}
</span>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
<select value={m.dv.pessoa} onChange={m.dv.setPessoa} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(m.dv.pessoas ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op}>
{op}
</option>
</Fragment>
))}
</select>
</label>
</div>
</div>
<div>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Etapa inicial
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "2px", padding: "3px", borderRadius: "10px", background: "#eeeff3" }}>
{(m.dv.etapas ?? []).map((et: any, i1: number) => (
<Fragment key={et?.id ?? et?.chave ?? i1}>
<button onClick={et.onClick} style={estilo(et.style)}>
<span style={estilo(et.dot)} />
<span>
{et.label}
</span>
</button>
</Fragment>
))}
</div>
</div>
<div>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />
</svg>
<span>
Nota interna
</span>
<span style={{ color: "#c2330f" }}>
*
</span>
<span style={{ flex: "1" }} />
<span style={{ fontWeight: "500", color: "#8b949e" }}>
Entra nas notas da nova oportunidade
</span>
</span>
<div style={estilo(m.dv.notaCaixa)}>
<textarea value={m.dv.motivo} onChange={m.dv.setMotivo} placeholder="Por que derivar? Contexto para quem vai tocar — use @ para mencionar" rows={3} style={{ display: "block", width: "100%", border: "0", outline: "0", resize: "none", background: "transparent", fontSize: "13px", lineHeight: "1.5", color: "#1f252c", padding: "10px 12px 8px" }} />
{(m.dv.temMencao) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", padding: "4px 8px 2px" }}>
<span style={{ fontSize: "11px", color: "#8b949e", padding: "0 4px" }}>
Mencionar
</span>
{(m.dv.mencoes ?? []).map((mc: any, i1: number) => (
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
</div>
{(m.dv.erroMotivo) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "4px" }}>
Deixe uma nota com o contexto para quem for tocar a nova oportunidade
</span>
</>) : null}
</div>
</div>
</>) : null}
{(m.temVinc) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", background: "#12171d", color: "#fff", fontSize: "11px", fontWeight: "700", display: "grid", placeItems: "center" }}>
{m.vinc.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.vinc.titulo}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.vinc.sub}
</span>
</span>
<span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "600", color: "#67787c", whiteSpace: "nowrap" }}>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
</svg>
Herdado
</span>
</div>
</>) : null}
{(m.temAviso) ? (<>
<div style={{ padding: "10px 12px", borderRadius: "10px", background: "#fff6f4", color: "#9c3210", fontSize: "12.5px", fontWeight: "600", lineHeight: "1.45" }}>
{m.aviso}
</div>
</>) : null}
{(m.grupos ?? []).map((gp: any, i1: number) => (
<Fragment key={gp?.id ?? gp?.chave ?? i1}>
<div>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
{gp.label}
{(gp.obrig) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(gp.opcoes ?? []).map((op: any, i2: number) => (
<Fragment key={op?.id ?? op?.chave ?? i2}>
<button onClick={op.onClick} style={estilo(op.style)}>
{op.label}
</button>
</Fragment>
))}
</div>
{(gp.temErro) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "5px" }}>
Escolha uma opção
</span>
</>) : null}
</div>
</Fragment>
))}
{(m.temItens) ? (<>
<div>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
Itens
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(m.itens ?? []).map((mi: any, i1: number) => (
<Fragment key={mi?.id ?? mi?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) 92px 50px 30px", gap: "6px" }}>
<input value={mi.nome} onChange={mi.setNome} placeholder="Ex: Callface AI · 20 agentes" style={estilo(mi.nomeStyle)} />
<select value={mi.natureza} onChange={mi.setNat} style={{ minWidth: "0", height: "34px", padding: "0 8px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d", cursor: "pointer" }}>
{(naturezas ?? []).map((na: any, i2: number) => (
<Fragment key={na?.id ?? na?.chave ?? i2}>
<option value={na.v}>
{na.l}
</option>
</Fragment>
))}
</select>
<input value={mi.valor} onChange={mi.setValor} placeholder="R$" inputMode="decimal" style={estilo(mi.valorStyle)} />
<input value={mi.qtd} onChange={mi.setQtd} placeholder="Qtd" inputMode="numeric" style={{ minWidth: "0", height: "34px", padding: "0 6px", borderRadius: "8px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", color: "#12171d", textAlign: "center" }} />
<button onClick={mi.remover} title="Remover" style={{ width: "30px", height: "34px", borderRadius: "8px", border: "0", background: "transparent", color: "#a3a8a4", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#fdeeea;color:#c2330f")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
</Fragment>
))}
<button onClick={m.addItem} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", borderRadius: "8px", border: "0", background: "transparent", fontSize: "12.5px", fontWeight: "600", color: "#c2330f", cursor: "pointer" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Adicionar item
</span>
</button>
</div>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "8px", padding: "10px 12px", borderRadius: "10px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1" }}>
<span style={{ flex: "1", fontSize: "12px", color: "#67787c" }}>
{m.itensRec}
</span>
<span style={{ fontSize: "13px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{m.itensTotal}
</span>
</div>
</div>
</>) : null}
{(m.temData) ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "8px 10px" }}>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Início 
<span style={{ fontWeight: "500", color: "#8b949e" }}>
opcional
</span>
</span>
<input type="date" value={m.iniD} onChange={m.setIniD} style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", color: "#12171d" }} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Prazo
<span style={{ color: "#c2330f" }}>
*
</span>
</span>
<input type="date" value={m.fimD} onChange={m.setFimD} style={estilo(m.fimDStyle)} />
</label>
<label style={{ display: "block" }}>
<span style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
Hora 
<span style={{ fontWeight: "500", color: "#8b949e" }}>
opcional
</span>
</span>
<input type="time" value={m.fimH} onChange={m.setFimH} style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "9px", border: "0", outline: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", color: "#12171d" }} />
</label>
</div>
{(m.temErroData) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "5px" }}>
Escolha o prazo
</span>
</>) : null}
</>) : null}
{(m.campos ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<label style={{ display: "block" }}>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "5px" }}>
{c.label}
{(c.obrig) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
{(c.longo) ? (<>
<textarea value={c.valor} onChange={c.set} placeholder={c.dica} rows={3} style={estilo(c.style)} />
</>) : null}
{(c.curto) ? (<>
<input value={c.valor} onChange={c.set} placeholder={c.dica} style={estilo(c.style)} />
</>) : null}
{(c.temErro) ? (<>
<span style={{ display: "block", fontSize: "11px", color: "#c2330f", marginTop: "4px" }}>
Obrigatório
</span>
</>) : null}
</label>
</Fragment>
))}
{(m.grupos2 ?? []).map((gp: any, i1: number) => (
<Fragment key={gp?.id ?? gp?.chave ?? i1}>
<div>
<span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11.5px", fontWeight: "600", color: "#4a5560", marginBottom: "6px" }}>
{gp.label}
{(gp.obrig) ? (<>
<span style={{ color: "#c2330f" }}>
*
</span>
</>) : null}
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(gp.opcoes ?? []).map((op: any, i2: number) => (
<Fragment key={op?.id ?? op?.chave ?? i2}>
<button onClick={op.onClick} style={estilo(op.style)}>
<span style={estilo(op.radio)} />
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d" }}>
{op.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", marginTop: "1px" }}>
{op.sub}
</span>
</span>
</button>
</Fragment>
))}
</div>
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", boxShadow: "inset 0 1px 0 #eef1f1", flexWrap: "wrap" }}>
<button onClick={fecharModal} style={{ flex: "0 0 auto", whiteSpace: "nowrap", height: "34px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f6f6f3")].filter(Boolean).join(" ")}>
{m.cancelarLabel}
</button>
<button onClick={m.salvar} style={estilo(m.salvarStyle)}>
{m.salvarLabel}
</button>
</div>
</div>
</div>
</>) : null}
</div>
    </>
  );
}
