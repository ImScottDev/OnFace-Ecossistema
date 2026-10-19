"use client";

/* DERIVADO da gaveta de PecasDesenho.tsx (a de Pré-vendas) e das abas de
 * LeadLiga.tsx. Mesma casca (aside fixo de 436px com cortina), mesmo cabeçalho
 * (avatar, nome, contato, toques), mesmo par Etapa/Responsável, mesmas
 * seções e mesmo rodapé com o botão de saída dividido.
 *
 * O que é próprio da Prospecção: as seis abas pedidas pela spec (Operação,
 * Pessoas, Conversas, Cadência, Histórico, Inteligência) no lugar das seções
 * recolhíveis, e as saídas do prospect no menu do botão principal.
 * Quando o Claude Design entregar a peça de Prospecção, regerar daqui.
 */

import * as React from "react";
import type { DetalheDoProspect } from "@/lib/vendas/prospeccao-detalhe";
import { rotuloDeEvento } from "@/lib/vendas/rotulos-evento";
import { ROTULO_FAMILIA, type EstadoProspeccao } from "@/lib/vendas/dominio";
import { destinosPermitidos } from "@/lib/vendas/prospeccao-transicoes";
import { hover, estilo } from "./proto-runtime";

export const ABAS_PROSPECT = ["Operação", "Pessoas", "Conversas", "Cadência", "Histórico", "Inteligência"] as const;
export type AbaProspect = (typeof ABAS_PROSPECT)[number];

export interface AlvoDoDrawer { leadId: string; empresa: string; estado: EstadoProspeccao; empresaId: string | null }

export interface ValoresDaGaveta {
  detalhe: DetalheDoProspect | null;
  carregando: boolean;
  erro: string | null;
  equipe: Array<{ id: string; nome: string }>;
  fechar: () => void;
  mover: (a: AlvoDoDrawer, para: EstadoProspeccao) => void;
  atribuir: (leadId: string, responsavelId: string | null) => void;
  pausar: (retomar: boolean) => void;
  ir: (rota: string) => void;
  /** Abre a peça global de cadência para ESTE prospect (um lead). */
  inserirEmCadencia: (leadId: string, nome: string) => void;
}

const ACAO: Record<string, { label: string; nota: string; d: string }> = {
  pre_qualificado: { label: "Pré-qualificar", nota: "Entrega a empresa a Pré-vendas, na etapa Novo", d: "M20 6 9 17l-5-5" },
  oportunidade: { label: "Criar oportunidade", nota: "Vai direto ao Pipeline, sem passar por Pré-vendas", d: "M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6M12 10a2 2 0 1 0 2 2M22 2l-10 10M16 2h6v6" },
  em_cadencia: { label: "Adicionar à cadência", nota: "Inicia a abordagem pelo motor de cadências", d: "M4 14h7l-1 7 10-11h-7l1-7z" },
  respondeu: { label: "Registrar resposta", nota: "Exige resposta real ou confirmação manual", d: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" },
  sem_resposta: { label: "Marcar sem resposta", nota: "Encerra a abordagem sem retorno", d: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
  descartado: { label: "Descartar", nota: "Motivo obrigatório, o histórico fica", d: "M18 6 6 18M6 6l12 12" },
};
const COR_ESTADO: Record<string, string> = {
  novo: "#4a5560", em_cadencia: "#4c8fe0", respondeu: "#fe4f2b", pre_qualificado: "#2f9e7a", oportunidade: "#fe4f2b", sem_resposta: "#c8a86a", descartado: "#8b949e",
};
const STATUS_CADENCIA: Record<string, string> = {
  active: "Ativa", waiting: "Aguardando", waiting_reply: "Aguardando resposta", paused: "Pausada", completed: "Concluída", cancelled: "Cancelada", failed: "Falhou",
};
const ICONE = {
  ligacao: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39",
  email: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  mensagem: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
  empresa: "M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 11h.01M16 11h.01",
  pessoa: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  fechar: "M6 6l12 12M18 6L6 18",
  chevron: "m6 9 6 6 6-6",
  lead: "M7 17 17 7M8 7h9v9",
  cadencia: "M4 14h7l-1 7 10-11h-7l1-7z",
};

const iniciais = (n: string | null | undefined) => (n ?? "").split(/\s+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "—";
const dataHora = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const BTN = "display:flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px #dbdede;font-size:12.5px;font-weight:500;white-space:nowrap;flex:0 0 auto";
const ROT = { fontSize: "11px", fontWeight: 600, color: "#4a5560" } as const;

function Icone({ d, t = 14, w = 1.9 }: { d: string; t?: number; w?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d={d} /></svg>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid #eef1f1" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#4a5560", letterSpacing: ".04em", marginBottom: "8px" }}>{titulo.toUpperCase()}</div>
      {children}
    </div>
  );
}
function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "9px", padding: "3px 0" }}>
      <span style={{ flex: "0 0 96px", fontSize: "11.5px", color: "#4a5560" }}>{rotulo}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: "13px", color: children ? "#12171d" : "#a3a8a4", fontWeight: 500, overflowWrap: "anywhere" }}>{children || "—"}</span>
    </div>
  );
}
const Nota = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: "0 0 8px", fontSize: "12.5px", color: "#4a5560", lineHeight: 1.45, textWrap: "pretty" }}>{children}</p>
);
function Botao({ children, onClick, d, primario = false }: { children: React.ReactNode; onClick?: () => void; d?: string; primario?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={estilo(BTN + (primario ? ";background:#d93c1a;color:#fff;box-shadow:none;font-weight:600" : ""))}
      className={hover(primario ? "background:#c2330f" : "background:#f6f7f7")}>
      {d ? <Icone d={d} /> : null}<span>{children}</span>
    </button>
  );
}

export function ProspeccaoGaveta(v: ValoresDaGaveta) {
  const [aba, setAba] = React.useState<AbaProspect>("Operação");
  const [menu, setMenu] = React.useState<null | "resp" | "saida">(null);
  const d = v.detalhe;

  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") v.fechar(); };
    const fora = (e: MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest("[data-of-dropmenu],[data-of-saida]")) setMenu(null); };
    document.addEventListener("keydown", esc); document.addEventListener("mousedown", fora);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("mousedown", fora); };
  }, [v]);

  const nome = d?.lead.empresa.nome ?? "Prospect";
  const pessoa = d?.lead.pessoa;
  const alvo: AlvoDoDrawer | null = d ? { leadId: d.leadId, empresa: d.lead.empresa.nome, estado: d.estado, empresaId: d.lead.empresa.id } : null;
  const destinos = d ? destinosPermitidos(d.estado) : [];
  const saiu = d ? ["pre_qualificado", "oportunidade", "descartado"].includes(d.estado) : false;
  const principal = destinos.includes("pre_qualificado") ? "pre_qualificado" : destinos[0];
  const outras = destinos.filter((x) => x !== principal);
  const tel = pessoa?.telefone || pessoa?.whatsapp;
  const semEmpresa = !!d && !d.lead.empresa.id;
  const opp = d?.lead.oportunidades[0];

  return (
    <>
      <div onClick={v.fechar} style={{ position: "fixed", inset: 0, background: "rgba(9,14,20,.42)", zIndex: 40, animation: "of-fade .18s ease-out both" }} />
      <aside data-r="drawer" role="dialog" aria-label={`Prospect ${nome}`}
        style={{ position: "fixed", top: "10px", right: "10px", bottom: "10px", width: "436px", maxWidth: "calc(100vw - 20px)", background: "#fff", borderRadius: "14px", zIndex: 41, display: "flex", flexDirection: "column", overflow: "hidden", animation: "of-slide .26s cubic-bezier(.2,0,.2,1) both" }}>
        <div style={{ flex: "0 0 auto", padding: "15px 16px 0", borderBottom: "1px solid #e3e7e8" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "11px" }}>
            <span style={estilo("flex:0 0 auto;width:38px;height:38px;border-radius:9999px;display:grid;place-items:center;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;background:#eeeff3;color:#4a5560")}>{iniciais(nome)}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "16px", fontWeight: 700, letterSpacing: "-.015em", color: "#12171d", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
              <div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: 1.35, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {pessoa ? `${pessoa.nome}${pessoa.cargo ? " · " + pessoa.cargo : ""}` : v.carregando ? "Carregando…" : ""}
              </div>
              {pessoa ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", marginTop: "6px" }}>
                  <span style={{ fontSize: "12px", color: "#4a5560", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pessoa.telefone || pessoa.whatsapp || "Sem telefone"}</span>
                  <span style={{ fontSize: "12px", color: "#4a5560", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pessoa.email || "Sem e-mail"}</span>
                </div>
              ) : null}
            </div>
            <button type="button" onClick={v.fechar} aria-label="Fechar" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#4a5560" }} className={hover("background:#f1f3f3;color:#12171d")}>
              <Icone d={ICONE.fechar} t={15} w={2} />
            </button>
          </div>

          {d ? (
            <>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <Botao d={ICONE.ligacao} onClick={() => { if (tel) window.location.href = `tel:${tel.replace(/[^\d+]/g, "")}`; }}>Ligar</Botao>
                <Botao d={ICONE.mensagem} onClick={() => v.ir(`/atendimento?canal=whatsapp&leadId=${d.leadId}`)}>WhatsApp</Botao>
                <Botao d={ICONE.email} onClick={() => v.ir(`/atendimento?canal=email&leadId=${d.leadId}`)}>E-mail</Botao>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
                <div>
                  <div style={{ ...ROT, marginBottom: "5px" }}>Estado</div>
                  <div style={estilo(BTN.replace("flex:0 0 auto", "width:100%"))}>
                    <span style={estilo("flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + COR_ESTADO[d.estado])} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{d.estadoRotulo}</span>
                  </div>
                </div>
                <div data-of-dropmenu="1" style={{ position: "relative" }}>
                  <div style={{ ...ROT, marginBottom: "5px" }}>Responsável</div>
                  <button type="button" onClick={() => setMenu(menu === "resp" ? null : "resp")} style={estilo(BTN.replace("flex:0 0 auto", "width:100%"))} className={hover("background:#f6f7f7")}>
                    <span style={estilo("flex:0 0 auto;width:20px;height:20px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:700;background:#eeeff3;color:#616b78")}>{iniciais(d.lead.responsavel.nome)}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", textAlign: "left", color: d.lead.responsavel.nome ? undefined : "#c2330f" }}>{d.lead.responsavel.nome ?? "Sem responsável"}</span>
                    <Icone d={ICONE.chevron} t={12} w={2.2} />
                  </button>
                  {menu === "resp" ? (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 46, borderRadius: "6px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 8px 20px -4px rgba(0,0,0,.18),0 2px 4px -2px rgba(0,0,0,.12)", padding: "4px", maxHeight: "220px", overflowY: "auto" }}>
                      {[...v.equipe.map((e) => ({ id: e.id as string | null, nome: e.nome })), { id: null, nome: "Sem responsável" }].map((o) => (
                        <button key={o.id ?? "sem"} type="button" onClick={() => { setMenu(null); if (o.id !== d.lead.responsavel.id) v.atribuir(d.leadId, o.id); }}
                          style={{ display: "flex", alignItems: "center", width: "100%", padding: "6px", borderRadius: "6px", fontSize: "12.5px", fontWeight: o.id === d.lead.responsavel.id ? 600 : 400, textAlign: "left" }} className={hover("background:#f6f7f7")}>{o.nome}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          <div role="tablist" aria-label="Seções do prospect" className="pp-abas-drawer" style={{ display: "flex", gap: "0", overflowX: "auto", marginTop: "10px", scrollbarWidth: "none" }}>
            {ABAS_PROSPECT.map((a) => (
              <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
                style={estilo("flex:0 0 auto;display:flex;align-items:center;height:38px;padding:0 6px;border:0;background:transparent;cursor:pointer;font-size:12px;white-space:nowrap;margin-bottom:-1px;" + (aba === a ? "font-weight:600;color:#12171d;box-shadow:inset 0 -2px 0 #fe4f2b" : "font-weight:500;color:#67787c"))}>{a}</button>
            ))}
          </div>
        </div>

        {semEmpresa ? (
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 16px", background: "#fff6f4", borderBottom: "1px solid #fadfd8" }}>
            <span style={{ fontSize: "12px", color: "#9c3210", lineHeight: 1.45 }}>Sem empresa associada: <strong style={{ fontWeight: 600 }}>Pré-qualificar</strong> e <strong style={{ fontWeight: 600 }}>Criar oportunidade</strong> ficam bloqueados.</span>
          </div>
        ) : null}

        <div role="tabpanel" aria-label={aba} style={{ flex: 1, minHeight: 0, overflowY: "auto", opacity: v.carregando && d ? 0.6 : 1 }}>
          {v.erro ? <div style={{ padding: "14px 16px", fontSize: "12.5px", color: "#c2330f" }} role="alert">{v.erro}</div> : null}
          {!d && !v.erro ? <div style={{ padding: "14px 16px", fontSize: "12.5px", color: "#4a5560" }} role="status">Carregando…</div> : null}
          {d && aba === "Operação" ? (
            <>
              {d.descarte ? <Secao titulo="Descarte"><Nota>Descartado em {dataHora(d.descarte.em)}. Motivo: {d.descarte.motivo ?? "não informado"}. O histórico foi preservado.</Nota></Secao> : null}
              {d.estado === "pre_qualificado" ? <Secao titulo="Saída"><Nota>Entregue a Pré-vendas, na etapa Novo. Daqui em diante a jornada de qualificação acontece lá.</Nota></Secao> : null}
              {d.estado === "oportunidade" ? <Secao titulo="Saída"><Nota>Virou oportunidade direta no Pipeline. A prospecção desta empresa terminou.</Nota></Secao> : null}
              <Secao titulo="Prospecção">
                <Linha rotulo="Origem">Outbound</Linha>
                <Linha rotulo="Fonte">{d.fonte && d.fonte.toLowerCase() !== "outbound" ? d.fonte : null}</Linha>
                <Linha rotulo="Lista">{d.lista}</Linha>
                <Linha rotulo="Cadência">{d.cadencia ? `${d.cadencia.nome}${d.cadencia.passoAtual ? ` · passo ${d.cadencia.passoAtual} de ${d.cadencia.totalPassos}` : ""}` : null}</Linha>
                <Linha rotulo="Próxima ação">{d.cadencia?.proximaAcaoEm ? dataHora(d.cadencia.proximaAcaoEm) : d.lead.proximaAcao?.titulo ?? null}</Linha>
                <Linha rotulo="Entrou em">{dataHora(d.lead.criadoEm)}</Linha>
              </Secao>
              <Secao titulo="Empresa">
                <Linha rotulo="Setor">{d.lead.empresa.setor}</Linha>
                <Linha rotulo="Porte">{d.lead.empresa.porte}</Linha>
                <Linha rotulo="Cidade">{d.lead.empresa.cidade}</Linha>
                <Linha rotulo="Site">{d.lead.empresa.website}</Linha>
              </Secao>
              {d.lead.oportunidades.length > 0 ? (
                <Secao titulo="Oportunidades">
                  {d.lead.oportunidades.map((o) => (
                    <button key={o.id} type="button" onClick={() => v.ir(`/pipeline/${o.id}`)} style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#c2330f", padding: "3px 0", textAlign: "left" }}>
                      {o.titulo}{o.familia ? ` · ${ROTULO_FAMILIA[o.familia as keyof typeof ROTULO_FAMILIA] ?? o.familia}` : ""} · {o.etapaRotulo}
                    </button>
                  ))}
                </Secao>
              ) : null}
            </>
          ) : null}
          {d && aba === "Pessoas" ? (
            <>
              <Secao titulo="Pessoa principal">
                <Linha rotulo="Nome">{pessoa?.nome}</Linha><Linha rotulo="Cargo">{pessoa?.cargo}</Linha>
                <Linha rotulo="E-mail">{pessoa?.email}</Linha><Linha rotulo="Telefone">{pessoa?.telefone}</Linha>
                <Linha rotulo="WhatsApp">{pessoa?.whatsapp}</Linha><Linha rotulo="LinkedIn">{pessoa?.linkedin}</Linha>
                {!tel && !pessoa?.email ? <div style={{ marginTop: "6px" }}><Nota>Sem telefone nem e-mail: enriqueça ou edite o contato para abordar.</Nota></div> : null}
              </Secao>
              <Secao titulo="Outras pessoas da empresa">
                {d.outrasPessoas.length === 0 ? <Nota>Nenhuma outra pessoa associada a esta empresa ainda.</Nota> : d.outrasPessoas.map((o) => (
                  <div key={o.id} style={{ padding: "4px 0", fontSize: "13px", color: "#12171d" }}>
                    <strong style={{ fontWeight: 600 }}>{o.nome}</strong>
                    <span style={{ color: "#4a5560" }}>{[o.cargo, o.email, o.telefone].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                  </div>
                ))}
              </Secao>
            </>
          ) : null}
          {d && aba === "Conversas" ? (
            <Secao titulo="Conversas">
              {d.conversas.total === 0 ? <Nota>Nenhuma mensagem trocada com este prospect ainda.</Nota> : (
                <>
                  <Nota>{d.conversas.total} {d.conversas.total === 1 ? "mensagem" : "mensagens"}: {d.conversas.recebidas} recebidas, {d.conversas.enviadas} enviadas.</Nota>
                  <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "10px" }}>
                    {d.conversas.ultimas.map((m) => (
                      <div key={`${m.canal}-${m.id}`} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "11.5px", color: "#67787c" }}>{m.canal} · {m.direcao === "in" ? "recebida" : m.direcao === "out" ? "enviada" : "—"} · {dataHora(m.em)}</span>
                        <span style={{ fontSize: "13px", color: "#0e1415", fontWeight: 500, lineHeight: 1.4, overflowWrap: "anywhere" }}>{m.resumo || "(sem texto)"}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Botao d={ICONE.lead} onClick={() => v.ir(d.conversas.hrefAtendimento)}>Abrir no Atendimento</Botao>
            </Secao>
          ) : null}
          {d && aba === "Cadência" ? (
            d.cadencia ? (
              <Secao titulo={d.cadencia.nome}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ flex: 1, display: "flex", gap: "3px" }}>
                    {d.cadencia.passos.map((p) => (
                      <span key={p.id} title={p.titulo} style={estilo("flex:1;height:5px;border-radius:3px;background:" + (p.situacao === "executado" ? "#2f9e7a" : p.situacao === "atual" ? "#fe4f2b" : p.situacao === "erro" ? "#c2330f" : "#e3e7e8"))} />
                    ))}
                  </div>
                  <span style={{ flex: "0 0 auto", fontSize: "11.5px", fontWeight: 600, color: "#4a5560", whiteSpace: "nowrap" }}>{d.cadencia.passoAtual != null ? `Passo ${d.cadencia.passoAtual} de ${d.cadencia.totalPassos}` : `${d.cadencia.totalPassos} passos`}</span>
                </div>
                <Linha rotulo="Status">{STATUS_CADENCIA[d.cadencia.status] ?? d.cadencia.status}</Linha>
                <Linha rotulo="Próxima ação">{d.cadencia.proximaAcaoEm ? dataHora(d.cadencia.proximaAcaoEm) : null}</Linha>
                <Linha rotulo="Última execução">{d.cadencia.ultimaExecucaoEm ? dataHora(d.cadencia.ultimaExecucaoEm) : null}</Linha>
                <Linha rotulo="Iniciada em">{dataHora(d.cadencia.iniciadaEm)}</Linha>
                <Linha rotulo="Responsável">{d.lead.responsavel.nome}</Linha>
                {d.cadencia.motivoDeParada ? <div style={{ marginTop: "6px" }}><Nota>Motivo: {d.cadencia.motivoDeParada}</Nota></div> : null}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "10px 0 14px" }}>
                  {["active", "waiting", "waiting_reply"].includes(d.cadencia.status) && d.estado === "em_cadencia" ? <Botao onClick={() => v.pausar(false)}>Pausar cadência</Botao> : null}
                  {d.cadencia.status === "paused" && d.estado === "em_cadencia" ? <Botao onClick={() => v.pausar(true)}>Retomar cadência</Botao> : null}
                  {destinos.includes("em_cadencia") && alvo ? <Botao onClick={() => v.mover(alvo, "em_cadencia")}>Nova cadência</Botao> : null}
                </div>
                <div style={{ ...ROT, marginBottom: "6px" }}>Passos</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {d.cadencia.passos.map((p) => (
                    <div key={p.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "8px", fontSize: "13px", color: p.situacao === "pendente" ? "#8b949e" : "#12171d" }}>
                      <span style={{ minWidth: "18px", color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>{p.ordem}</span>
                      <span style={{ fontWeight: p.situacao === "atual" ? 600 : 400, color: p.situacao === "atual" ? "#c2330f" : undefined }}>{p.titulo}</span>
                      <span />
                      <span style={{ fontSize: "11.5px", color: "#67787c" }}>{{ executado: "Feito", atual: "Próximo", pendente: "Pendente", erro: "Erro" }[p.situacao]}{p.quando ? ` · ${dataHora(p.quando)}` : ""}</span>
                    </div>
                  ))}
                </div>
              </Secao>
            ) : (
              <Secao titulo="Cadência">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", color: "#4a5560", lineHeight: 1.45 }}>Fora de cadência — nenhum toque automático sai para esta empresa.</span>
                  {destinos.includes("em_cadencia") && alvo ? <Botao d="M12 5v14M5 12h14" onClick={() => v.mover(alvo, "em_cadencia")}>Inserir</Botao> : null}
                </div>
              </Secao>
            )
          ) : null}
          {d && aba === "Histórico" ? (
            <Secao titulo="Histórico">
              {d.historico.length === 0 ? <Nota>Nenhum evento registrado ainda.</Nota> : d.historico.map((e, i, arr) => (
                <div key={e.id} style={{ display: "flex", gap: "10px" }}>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={estilo("flex:0 0 auto;width:9px;height:9px;border-radius:9999px;margin-top:5px;box-sizing:border-box;" + (i === 0 ? "background:#fe4f2b" : "background:#fff;border:1.5px solid #b8bdbb"))} />
                    <span style={estilo("flex:1;width:1.5px;margin-top:4px;background:" + (i < arr.length - 1 ? "#e3e7e8" : "transparent"))} />
                  </span>
                  <span style={{ paddingBottom: "12px", minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "12.5px", color: "#1f252c", lineHeight: 1.4 }}>{e.titulo || rotuloDeEvento(e.tipo)}</span>
                    <span style={{ display: "block", fontSize: "11px", color: "#4a5560", marginTop: "2px" }}>{e.usuarioNome ?? "Sistema"} · {dataHora(e.ocorridoEm)}</span>
                  </span>
                </div>
              ))}
            </Secao>
          ) : null}
          {d && aba === "Inteligência" ? (
            <>
              <Secao titulo="Sinais">
                {d.inteligencia.sinais.length === 0 ? <Nota>Nenhum sinal registrado ainda. Eles aparecem quando houver resposta, abordagem executada ou dado enriquecido.</Nota> : d.inteligencia.sinais.map((s) => <Linha key={s.rotulo} rotulo={s.rotulo}>{s.valor}</Linha>)}
              </Secao>
              <Secao titulo="Dados a completar">
                {d.inteligencia.faltando.length === 0 ? <Nota>Cadastro completo.</Nota> : <Nota>{d.inteligencia.faltando.join(", ")}.</Nota>}
              </Secao>
              {d.inteligencia.empresa && (d.inteligencia.empresa.funcionarios || d.inteligencia.empresa.faturamento || d.inteligencia.empresa.tecnologias) ? (
                <Secao titulo="Empresa enriquecida">
                  <Linha rotulo="Funcionários">{d.inteligencia.empresa.funcionarios}</Linha>
                  <Linha rotulo="Faturamento">{d.inteligencia.empresa.faturamento}</Linha>
                  <Linha rotulo="Tecnologias">{d.inteligencia.empresa.tecnologias}</Linha>
                </Secao>
              ) : null}
            </>
          ) : null}
        </div>

        <div style={{ flex: "0 0 auto", padding: "11px 16px", borderTop: "1px solid #e3e7e8", display: "flex", gap: "7px", flexWrap: "wrap" }}>
          {d ? (
            <>
              {saiu && d.estado === "pre_qualificado" ? <Botao d={ICONE.lead} onClick={() => v.ir(`/pre-vendas/${d.leadId}`)}>Abrir em Pré-vendas</Botao> : null}
              {saiu && d.estado === "oportunidade" ? <Botao d={ICONE.lead} onClick={() => v.ir(opp ? `/pipeline/${opp.id}` : "/pipeline")}>Abrir no Pipeline</Botao> : null}
              <Botao d={ICONE.empresa} onClick={() => { if (d.lead.empresa.id) v.ir(`/empresas/${d.lead.empresa.id}`); }}>{d.lead.empresa.id ? "Abrir empresa" : "Sem empresa"}</Botao>
              <Botao d={ICONE.pessoa} onClick={() => v.ir(`/pessoas/${d.leadId}`)}>Abrir contato</Botao>
              {/* A peça ÚNICA de cadência, a mesma do Pipeline e da ficha: aqui
                  o registro aberto é um LEAD (`d.leadId` é o id de `leads`, o
                  mesmo que a gaveta usa em /pessoas e nas ações de prospecção). */}
              <Botao d={ICONE.cadencia} onClick={() => v.inserirEmCadencia(d.leadId, d.lead.empresa.nome || d.lead.pessoa.nome || "Prospect")}>Inserir em cadência</Botao>
              <span style={{ flex: 1, minWidth: 0 }} />
              {principal && alvo ? (
                <div data-of-saida="1" style={{ position: "relative", flex: "0 0 auto" }}>
                  <div style={{ display: "flex", alignItems: "stretch", height: "34px", borderRadius: "8px", overflow: "hidden", background: "#d93c1a" }}>
                    <button type="button" onClick={() => v.mover(alvo, principal)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0 12px", background: "transparent", color: "#fff", fontSize: "12.5px", fontWeight: 600, whiteSpace: "nowrap" }} className={hover("background:rgba(0,0,0,.14)")}>
                      <Icone d={ACAO[principal].d} t={14} w={2.2} /><span>{ACAO[principal].label}</span>
                    </button>
                    {outras.length > 0 ? (
                      <>
                        <span style={{ flex: "0 0 auto", width: "1px", background: "rgba(255,255,255,.34)" }} />
                        <button type="button" onClick={() => setMenu(menu === "saida" ? null : "saida")} title="Outras saídas do prospect" aria-label="Outras saídas do prospect" style={{ display: "grid", placeItems: "center", width: "27px", background: "transparent", color: "#fff" }} className={hover("background:rgba(0,0,0,.14)")}>
                          <Icone d={ICONE.chevron} t={12} w={2.2} />
                        </button>
                      </>
                    ) : null}
                  </div>
                  {menu === "saida" ? (
                    <div role="menu" style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, width: "268px", zIndex: 44, borderRadius: "6px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 -4px 6px -1px rgba(0,0,0,.1),0 -2px 4px -2px rgba(0,0,0,.1)", padding: "4px", animation: "of-rise .12s cubic-bezier(.2,0,.2,1) both" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#4a5560", letterSpacing: ".04em", padding: "7px 8px 4px" }}>SAÍDAS DO PROSPECT</div>
                      {outras.map((p) => (
                        <button key={p} role="menuitem" type="button" onClick={() => { setMenu(null); v.mover(alvo, p); }} style={{ display: "flex", alignItems: "flex-start", gap: "9px", width: "100%", padding: "8px", borderRadius: "6px", textAlign: "left", color: p === "descartado" ? "#c2330f" : "#1f252c" }} className={hover("background:#f1f3f3")}>
                          <span style={{ marginTop: "1px" }}><Icone d={ACAO[p].d} t={16} w={1.8} /></span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: "13.5px", fontWeight: 500, lineHeight: 1.35 }}>{ACAO[p].label}</span>
                            <span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: 1.4, marginTop: "1px" }}>{ACAO[p].nota}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
