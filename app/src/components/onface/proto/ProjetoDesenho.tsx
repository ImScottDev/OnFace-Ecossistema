"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Projeto.dc.html
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
import "./ProjetoDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeProjetoDesenho {
  abas: any;
  ac: any;
  arq: any;
  btn: any;
  btnG: any;
  btnP: any;
  card: any;
  ctx: any;
  fechar: any;
  grupos: any;
  h: any;
  hof: any;
  ir: any;
  kick: any;
  mats: any;
  nota: any;
  parar: any;
  pessoas: any;
  play: any;
  prox: any;
  rs: any;
  sl: any;
  tema: any;
  tiles: any;
  tit: any;
  tl: any;
  v: any;
}

export function ProjetoDesenho(vals: ValoresDeProjetoDesenho) {
  const { abas, ac, arq, btn, btnG, btnP, card, ctx, fechar, grupos, h, hof, ir, kick, mats, nota, parar, pessoas, play, prox, rs, sl, tema, tiles, tit, tl, v } = vals;
  return (
    <>
<div style={estilo(tema.vars)}>
<div data-r="pagina" style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: "14px 14px 22px", background: "var(--bg)", color: "var(--tx)", height: "100%" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
<section data-in="rise" style={{ background: "var(--sf)", borderRadius: "16px", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 22px", padding: "20px 22px 16px" }}>
<div style={{ flex: "1 1 340px", minWidth: "0", display: "flex", alignItems: "center", gap: "15px" }}>
<span style={{ flex: "0 0 auto", width: "56px", height: "56px", borderRadius: "16px", display: "grid", placeItems: "center", background: "var(--sf2)", color: "var(--tx)", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "19px", fontWeight: "800", letterSpacing: "-.03em", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{h.ini}
</span>
<span style={{ minWidth: "0", display: "flex", flexDirection: "column", gap: "6px" }}>
<span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 10px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "24px", fontWeight: "800", letterSpacing: "-.03em", lineHeight: "1.05", color: "var(--tx)" }}>
{h.nome}
</span>
<span style={estilo(h.pill)}>
<span style={estilo(h.dotSt)} />
{h.est}
</span>
</span>
<span style={{ fontSize: "13px", color: "var(--tx2)", lineHeight: "1.4" }}>
{h.meta}
</span>
<span style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "#fe4f2b", color: "#fff", fontSize: "11.5px", fontWeight: "600" }}>
{h.tipo}
</span>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "6px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "11.5px", fontWeight: "600" }}>
{h.prod}
</span>
</span>
</span>
</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
{(h.acoes ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} title={a.l} style={{ width: "36px", height: "36px", borderRadius: "9px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx2)", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:var(--hv);color:var(--tx)")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={a.d} />
</svg>
</button>
</Fragment>
))}
<button onClick={ac.nova} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M12 5v14M5 12h14" />
</svg>
Nova tarefa
</button>
<button onClick={ac.reuniao} style={{ display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 13px", borderRadius: "9px", border: "0", background: "var(--pri)", color: "var(--prit)", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}>
Agendar reunião
</button>
{(h.temPronto) ? (<>
<button onClick={h.irHandoff} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
{h.prontoL}
</button>
</>) : null}
</div>
</div>
<div style={{ display: "flex", gap: "24px", padding: "0 22px", overflowX: "auto", boxShadow: "inset 0 1px 0 var(--ln)" }}>
{(abas ?? []).map((ab: any, i1: number) => (
<Fragment key={ab?.id ?? ab?.chave ?? i1}>
<button onClick={ab.onClick} style={estilo(ab.st)}>
{ab.l}
{(ab.temN) ? (<>
<span style={estilo(ab.nSt)}>
{ab.n}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
</section>
{(h.temBloq) ? (<>
<div data-in="rise" style={estilo(`display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;background:${h.bloqBg ?? ""}`)}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", color: "var(--tx)" }}>
<strong style={estilo(`color:${h.bloqCor ?? ""}`)}>
{h.bloqT}
</strong>
 · {h.bloqS}
</span>
<button onClick={h.liberar} style={{ height: "30px", padding: "0 12px", borderRadius: "8px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx)", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }}>
Marcar como resolvido
</button>
</div>
</>) : null}
{(v.geral) ? (<>
<div data-stagger="40" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px" }}>
{(tiles ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div data-in="rise" style={{ padding: "15px 16px", background: "var(--sf)", borderRadius: "14px", boxShadow: "inset 0 0 0 1px var(--ln)", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12px", color: "var(--tx3)" }}>
{t.l}
</span>
<span style={estilo(t.vSt)}>
{t.v}
</span>
<span style={{ display: "block", marginTop: "4px", fontSize: "11.5px", color: "var(--tx3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.s}
</span>
{(t.temBarra) ? (<>
<span style={{ display: "block", height: "4px", marginTop: "9px", borderRadius: "9999px", background: "var(--ln)", overflow: "hidden" }}>
<span style={estilo(t.barra)} />
</span>
</>) : null}
</div>
</Fragment>
))}
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
<div style={{ flex: "1.5 1 420px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
<section data-in="rise" style={estilo(card)}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(tit)}>
Próximas tarefas
</span>
<span style={{ flex: "1" }} />
<button onClick={ir.atividades} style={estilo(btnG)}>
Ver todas
</button>
</div>
{(prox.vazio) ? (<>
<span style={{ padding: "6px 0", fontSize: "12.5px", color: "var(--tx3)" }}>
Nenhuma tarefa aberta.
</span>
</>) : null}
{(prox.itens ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "11px", padding: "10px 0", boxShadow: "inset 0 1px 0 var(--ln)" }}>
<button onClick={t.concluir} title="Concluir" style={{ flex: "0 0 auto", width: "18px", height: "18px", marginTop: "1px", borderRadius: "6px", border: "0", background: "transparent", boxShadow: "inset 0 0 0 1.5px var(--tx3)", cursor: "pointer" }} className={[hover("box-shadow:inset 0 0 0 1.5px var(--ok)")].filter(Boolean).join(" ")} />
<button onClick={t.abrir} style={{ flex: "1", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "var(--tx)" }}>
{t.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "var(--tx3)" }}>
{t.s}
</span>
</button>
<span style={estilo(`font-size:12px;color:${t.qCor ?? ""};white-space:nowrap;padding-top:1px`)}>
{t.q}
</span>
</div>
</Fragment>
))}
</section>
<section data-in="rise" style={estilo(card)}>
<span style={estilo(tit)}>
Contexto da venda
</span>
<div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "10px 18px", fontSize: "12.5px" }}>
{(ctx ?? []).map((c: any, i1: number) => (
<Fragment key={c?.id ?? c?.chave ?? i1}>
<span style={{ color: "var(--tx3)", whiteSpace: "nowrap" }}>
{c.l}
</span>
<span style={{ minWidth: "0", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ color: "var(--tx)", fontWeight: "500" }}>
{c.v}
</span>
{(c.temLink) ? (<>
<button onClick={c.ir} style={estilo(btnG)}>
{c.linkL}
</button>
</>) : null}
</span>
</Fragment>
))}
</div>
</section>
</div>
<div style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
{(hof.tem) ? (<>
<section data-in="rise" style={estilo(card)}>
<span style={estilo(tit)}>
{hof.titulo}
</span>
<span style={{ fontSize: "12.5px", lineHeight: "1.55", color: "var(--tx2)", textWrap: "pretty" }}>
{hof.txt}
</span>
{(hof.temPend) ? (<>
<span style={{ fontSize: "12px", color: "var(--tx3)" }}>
Pendências: {hof.pend}
</span>
</>) : null}
</section>
</>) : null}
<section data-in="rise" style={estilo(card)}>
<span style={estilo(tit)}>
Pessoas envolvidas
</span>
{(pessoas ?? []).map((ps: any, i1: number) => (
<Fragment key={ps?.id ?? ps?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "11px", background: "var(--sf2)" }}>
<span style={{ width: "32px", height: "32px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "var(--sf)", color: "var(--tx2)", fontSize: "11px", fontWeight: "700", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{ps.ini}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--tx)" }}>
{ps.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "var(--tx3)" }}>
{ps.cargo}
</span>
</span>
<span style={{ display: "flex", gap: "4px" }}>
{(ps.acoes ?? []).map((ac: any, i2: number) => (
<Fragment key={ac?.id ?? ac?.chave ?? i2}>
<button onClick={ac.onClick} title={ac.t} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "var(--sf)", boxShadow: "inset 0 0 0 1px var(--ln)", color: "var(--tx2)", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:var(--hv);color:var(--tx)")].filter(Boolean).join(" ")}>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d={ac.d} />
</svg>
</button>
</Fragment>
))}
</span>
</div>
</Fragment>
))}
</section>
</div>
</div>
</>) : null}
{(v.atividades) ? (<>
<section data-in="rise" style={estilo(card)}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ flex: "1 1 240px", minWidth: "0" }}>
<span style={estilo(tit)}>
Tarefas e subtarefas
</span>
<span style={{ display: "block", marginTop: "3px", fontSize: "12px", color: "var(--tx3)" }}>
São as mesmas atividades da Central de Atividades. Concluir aqui ou lá dá no mesmo.
</span>
</span>
<button onClick={ir.quadro} style={estilo(btnG)}>
Abrir no quadro de Atividades
</button>
</div>
</section>
{(grupos ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ padding: "2px 4px 0", fontSize: "11.5px", fontWeight: "600", color: "var(--tx3)" }}>
{g.l} · {g.n}
</span>
{(g.itens ?? []).map((k: any, i2: number) => (
<Fragment key={k?.id ?? k?.chave ?? i2}>
<section data-in="rise" style={{ background: "var(--sf)", borderRadius: "14px", boxShadow: "inset 0 0 0 1px var(--ln)", overflow: "hidden" }}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px" }}>
<button onClick={k.concluir} title={k.concluirDica} style={estilo(k.chk)}>
{k.mark}
</button>
<button onClick={k.abrir} style={{ flex: "1", minWidth: "0", border: "0", background: "transparent", padding: "0", cursor: "pointer", textAlign: "left" }}>
<span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={estilo(k.tSt)}>
{k.t}
</span>
<span style={{ fontSize: "11px", fontWeight: "600", color: "var(--tx2)", padding: "1px 7px", borderRadius: "5px", background: "var(--sf2)" }}>
{k.tipo}
</span>
{(k.temAtual) ? (<>
<span style={{ fontSize: "11px", fontWeight: "600", color: "#c2330f" }}>
Em foco
</span>
</>) : null}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "var(--tx3)" }}>
{k.s}
</span>
</button>
<span style={estilo(`font-size:12px;color:${k.qCor ?? ""};white-space:nowrap`)}>
{k.q}
</span>
<span title={k.resp} style={{ width: "24px", height: "24px", borderRadius: "9999px", display: "grid", placeItems: "center", background: "var(--sf2)", color: "var(--tx2)", fontSize: "9.5px", fontWeight: "700", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{k.respIni}
</span>
<button onClick={k.na} style={estilo(btnG)}>
{k.naL}
</button>
<button onClick={k.toggle} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "var(--tx3)", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:var(--hv)")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(k.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
</div>
{(k.aberta) ? (<>
<div style={{ padding: "0 14px 8px 44px", boxShadow: "inset 0 1px 0 var(--ln)" }}>
{(k.subs ?? []).map((s: any, i3: number) => (
<Fragment key={s?.id ?? s?.chave ?? i3}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", boxShadow: "inset 0 -1px 0 var(--ln)" }}>
<button onClick={s.toggle} style={estilo(s.chk)}>
{s.mark}
</button>
<span style={estilo(s.tSt)}>
{s.t}
</span>
<span style={{ fontSize: "11.5px", color: "var(--tx3)", whiteSpace: "nowrap" }}>
{s.q}
</span>
</div>
</Fragment>
))}
{(k.semSubs) ? (<>
<span style={{ display: "block", padding: "10px 0", fontSize: "12.5px", color: "var(--tx3)" }}>
Sem subtarefas.
</span>
</>) : null}
</div>
</>) : null}
</section>
</Fragment>
))}
</div>
</Fragment>
))}
</>) : null}
{(v.materiais) ? (<>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
<section data-in="rise" style={estilo(`${card ?? ""};flex:1 1 400px;min-width:0`)}>
<span style={estilo(tit)}>
Materiais e links públicos
</span>
{(mats ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "13px", borderRadius: "12px", background: "var(--sf2)" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "var(--tx)" }}>
{m.nome}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "var(--tx3)", lineHeight: "1.45" }}>
{m.desc}
</span>
</span>
<span style={estilo(m.pill)}>
{m.st}
</span>
</div>
<span style={{ fontSize: "11.5px", color: "var(--tx3)", wordBreak: "break-all" }}>
{m.link}
</span>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<button onClick={m.copiar} style={estilo(btn)}>
Copiar link
</button>
<button onClick={m.resp} style={estilo(btn)}>
Ver respostas
</button>
<button onClick={m.enviar} style={estilo(btnP)}>
Enviar ao cliente
</button>
</div>
</div>
</Fragment>
))}
</section>
<section data-in="rise" style={estilo(`${card ?? ""};flex:1 1 400px;min-width:0`)}>
<span style={estilo(tit)}>
Apresentação de kickoff
</span>
<div style={{ aspectRatio: "16/9", borderRadius: "12px", background: "#12171d", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<span style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e" }}>
Kickoff · {kick.cliente}
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(18px,2.4vw,26px)", fontWeight: "800", letterSpacing: "-.03em", lineHeight: "1.1", color: "#fff" }}>
Sua jornada com a Callface
</span>
<span style={{ fontSize: "12px", color: "#a3aab0" }}>
{kick.sub}
</span>
</div>
<span style={{ fontSize: "12px", color: "var(--tx3)", lineHeight: "1.5" }}>
Montada com os dados do projeto: cliente, produtos, responsáveis, canais e a jornada de {kick.prod}.
</span>
<div style={{ display: "flex", gap: "6px" }}>
<button onClick={kick.ver} style={estilo(btn)}>
Visualizar
</button>
<button onClick={kick.apresentar} style={estilo(btnP)}>
Apresentar
</button>
</div>
</section>
</div>
</>) : null}
{(v.comunicacoes) ? (<>
<section data-in="rise" style={estilo(card)}>
<span style={estilo(tit)}>
Playbook de comunicação
</span>
<span style={{ fontSize: "12px", color: "var(--tx3)", lineHeight: "1.5" }}>
Cada mensagem acontece no momento certo da entrega. O envio sai pelo Atendimento e fica registrado na timeline do projeto.
</span>
</section>
<section data-in="rise" style={{ background: "var(--sf)", borderRadius: "16px", boxShadow: "inset 0 0 0 1px var(--ln)", padding: "8px 18px 8px 16px" }}>
{(play ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<div style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: "14px" }}>
<div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
<span style={estilo(s.linha)} />
<span style={estilo(s.no)}>
{s.noT}
</span>
</div>
<div style={{ padding: "14px 0 16px", minWidth: "0", display: "flex", flexDirection: "column", gap: "9px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
<span style={{ fontSize: "14px", fontWeight: "600", color: "var(--tx)" }}>
{s.nome}
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "20px", padding: "0 7px", borderRadius: "5px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "11px", fontWeight: "600", color: "var(--tx2)" }}>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={s.canalD} />
</svg>
{s.canal}
</span>
<span style={estilo(s.stSt)}>
{s.st}
</span>
<span style={{ flex: "1" }} />
<button onClick={s.ver} style={estilo(btnG)}>
{s.verL}
</button>
<button onClick={s.enviar} style={estilo(s.envSt)}>
{s.envL}
</button>
</div>
<span style={{ fontSize: "12px", color: "var(--tx3)" }}>
{s.quando}
</span>
{(s.aberto) ? (<>
<textarea value={s.texto} onChange={s.set} rows={s.linhas} style={{ width: "100%", resize: "vertical", padding: "11px 13px", borderRadius: "10px", border: "0", outline: "0", background: "var(--inp)", boxShadow: "inset 0 0 0 1px var(--ln)", fontSize: "13px", lineHeight: "1.55", color: "var(--tx)" }} />
</>) : null}
</div>
</div>
</Fragment>
))}
</section>
</>) : null}
{(v.arquivos) ? (<>
<section data-in="rise" style={estilo(card)}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={estilo(`flex:1;${tit ?? ""}`)}>
Arquivos do projeto
</span>
<label style={{ display: "flex", alignItems: "center", gap: "7px", height: "34px", padding: "0 13px", borderRadius: "9px", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
Enviar arquivo
<input type="file" multiple={true} onChange={arq.enviar} style={{ display: "none" }} />
</label>
</div>
{(arq.vazio) ? (<>
<span style={{ padding: "16px 0", fontSize: "12.5px", color: "var(--tx3)" }}>
Nenhum arquivo ainda. Contrato, materiais do cliente e atas ficam aqui.
</span>
</>) : null}
{(arq.lista ?? []).map((f: any, i1: number) => (
<Fragment key={f?.id ?? f?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", boxShadow: "inset 0 1px 0 var(--ln)" }}>
<span style={{ width: "34px", height: "34px", borderRadius: "9px", display: "grid", placeItems: "center", background: "var(--sf2)", color: "var(--tx2)", fontSize: "9px", fontWeight: "800", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
{f.ext}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{f.nome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "var(--tx3)" }}>
{f.meta}
</span>
</span>
<button onClick={f.baixar} style={estilo(btn)}>
Baixar
</button>
</div>
</Fragment>
))}
</section>
</>) : null}
{(v.timeline) ? (<>
<section data-in="rise" style={estilo(card)}>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderRadius: "12px", background: "var(--sf2)", boxShadow: "inset 0 0 0 1px var(--ln)" }}>
<textarea value={nota.v} onChange={nota.set} placeholder="Escreva uma nota sobre o projeto…" rows={2} style={{ width: "100%", resize: "vertical", minHeight: "52px", border: "0", outline: "0", background: "transparent", fontSize: "13.5px", lineHeight: "1.5", color: "var(--tx)" }} />
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ flex: "1", fontSize: "11.5px", color: "var(--tx3)" }}>
A nota entra na timeline do projeto.
</span>
<button onClick={nota.salvar} style={estilo(nota.btn)}>
Salvar nota
</button>
</div>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(tl ?? []).map((e: any, i1: number) => (
<Fragment key={e?.id ?? e?.chave ?? i1}>
<div style={{ position: "relative", display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", gap: "11px", alignItems: "start", padding: "9px 0" }}>
<span style={estilo(e.linha)} />
<span style={estilo(e.marca)}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
<path d={e.d} />
</svg>
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--tx)", textWrap: "pretty" }}>
{e.t}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "12px", color: "var(--tx3)", textWrap: "pretty" }}>
{e.meta}
</span>
</span>
<span style={{ paddingTop: "2px", fontSize: "11.5px", color: "var(--tx3)", whiteSpace: "nowrap" }}>
{e.q}
</span>
</div>
</Fragment>
))}
</div>
</section>
</>) : null}
</div>
</div>
{(sl.aberto) ? (<>
<div data-in="fade" style={{ position: "fixed", inset: "0", zIndex: "80", background: "#0c0f13", color: "#eef0f1", display: "flex", flexDirection: "column" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px" }}>
<span style={{ flex: "1", fontSize: "12px", color: "#8b949e" }}>
{sl.pos}
</span>
<button onClick={sl.fechar} style={{ height: "32px", padding: "0 13px", borderRadius: "9px", border: "0", background: "rgba(255,255,255,.09)", color: "#eef0f1", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }}>
Sair (Esc)
</button>
</div>
<div style={{ flex: "1", minHeight: "0", display: "grid", placeItems: "center", padding: "0 clamp(20px,6vw,90px)" }}>
<div data-in="rise" style={{ width: "min(1100px,100%)", display: "flex", flexDirection: "column", gap: "22px" }}>
<span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".14em", textTransform: "uppercase", color: "#fe4f2b" }}>
{sl.kicker}
</span>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(30px,5vw,56px)", fontWeight: "800", letterSpacing: "-.04em", lineHeight: "1.03", color: "#fff" }}>
{sl.titulo}
</span>
<span style={{ maxWidth: "760px", fontSize: "clamp(15px,1.6vw,20px)", lineHeight: "1.5", color: "#a3aab0" }}>
{sl.sub}
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "760px" }}>
{(sl.itens ?? []).map((it: any, i1: number) => (
<Fragment key={it?.id ?? it?.chave ?? i1}>
<div style={estilo(it.st)}>
<span style={estilo(it.dot)} />
<span style={{ flex: "1" }}>
{it.t}
</span>
<span style={{ fontSize: "12px", fontWeight: "600", color: "#fe4f2b", whiteSpace: "nowrap" }}>
{it.tag}
</span>
</div>
</Fragment>
))}
</div>
</div>
</div>
<div style={{ flex: "0 0 auto", display: "flex", justifyContent: "center", gap: "10px", padding: "16px" }}>
<button onClick={sl.ant} style={{ height: "40px", padding: "0 18px", borderRadius: "10px", border: "0", background: "rgba(255,255,255,.09)", color: "#eef0f1", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
← Anterior
</button>
<button onClick={sl.prox} style={{ height: "40px", padding: "0 20px", borderRadius: "10px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
Próximo →
</button>
</div>
</div>
</>) : null}
{(rs.aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "70", background: "rgba(12,16,21,.5)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={estilo(`${tema.vars ?? ""};width:min(500px,100%);background:var(--sf);color:var(--tx);border-radius:16px;box-shadow:0 30px 70px -20px rgba(0,0,0,.55),inset 0 0 0 1px var(--ln);overflow:hidden`)}>
<div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "center", boxShadow: "inset 0 -1px 0 var(--ln)" }}>
<span style={{ flex: "1", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: "700", color: "var(--tx)" }}>
{rs.titulo}
</span>
<button onClick={fechar} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "0", background: "transparent", color: "var(--tx3)", cursor: "pointer" }}>
✕
</button>
</div>
<div style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: "2px" }}>
{(rs.linhas ?? []).map((l: any, i1: number) => (
<Fragment key={l?.id ?? l?.chave ?? i1}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "9px 0", boxShadow: "inset 0 -1px 0 var(--ln)", fontSize: "13px" }}>
<span style={{ color: "var(--tx3)" }}>
{l.l}
</span>
<span style={{ color: "var(--tx)", fontWeight: "600", textAlign: "right" }}>
{l.v}
</span>
</div>
</Fragment>
))}
<span style={{ marginTop: "8px", fontSize: "12px", color: "var(--tx3)", lineHeight: "1.5" }}>
{rs.nota}
</span>
</div>
</div>
</div>
</>) : null}
</div>


    </>
  );
}
