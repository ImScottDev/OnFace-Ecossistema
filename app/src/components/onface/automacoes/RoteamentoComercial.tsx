"use client";

/* Roteamento comercial: regras família/campanha -> closer, rodízio e simulador.
 * Escrita pelas rotas /api/automacoes/agentes-op/roteamento (ai.configure). Sem a permissão a tela
 * continua legível e os botões ficam desligados dizendo por quê. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { DadosRoteamento, RegraDaTela } from "@/lib/automacoes/roteamento-tela";
import "./agentes.css";
import "./roteamento.css";

const BASE = "/api/automacoes/agentes-op/roteamento";
const FAMILIA: Record<string, string> = { CALLFACE_AI: "Callface AI", WHITE_LABEL: "White Label", PABX: "PABX" };
const FALLBACK: Record<string, string> = { fila_humana: "Fila humana", rodizio: "Rodízio entre as closers" };
const TZ = "America/Sao_Paulo";
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }) : null);
const diaInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }) : "");

async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) toast.error(String(json.error ?? json.message ?? "Não foi possível concluir a ação"));
    return { ok: r.ok, json };
  } catch {
    toast.error("Sem conexão com o servidor. Tente de novo.");
    return { ok: false, json: {} };
  }
}

function vigencia(r: RegraDaTela): { texto: string; fora: boolean } {
  const agora = Date.now();
  const de = r.vigenteDe, ate = r.vigenteAte;
  if (!de && !ate) return { texto: "Sempre", fora: false };
  const fora = (!!de && new Date(de).getTime() > agora) || (!!ate && new Date(ate).getTime() < agora);
  return { texto: `${de ? `de ${dia(de)}` : "desde sempre"}${ate ? ` até ${dia(ate)}` : ""}`, fora };
}

type Form = { nome: string; familia: string; campanha: string; prioridade: string; destino: string; fallback: string; de: string; ate: string; ativa: boolean };
const VAZIO: Form = { nome: "", familia: "", campanha: "", prioridade: "100", destino: "", fallback: "fila_humana", de: "", ate: "", ativa: true };

function EditorRegra({ regra, closers, onClose, onSalvo }: { regra: RegraDaTela | "nova" | null; closers: DadosRoteamento["closers"]; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = React.useState<Form>(VAZIO);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  React.useEffect(() => {
    setErro(null);
    if (regra && regra !== "nova") setF({ nome: regra.nome, familia: regra.familia ?? "", campanha: regra.campanha ?? "", prioridade: String(regra.prioridade), destino: regra.destinoUsuarioId ?? "", fallback: regra.fallback, de: diaInput(regra.vigenteDe), ate: diaInput(regra.vigenteAte), ativa: regra.ativa });
    else setF(VAZIO);
  }, [regra]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const prioridade = Number(f.prioridade);
    if (!f.nome.trim()) return setErro("Dê um nome à regra.");
    if (!Number.isInteger(prioridade) || prioridade < 0 || prioridade > 100000) return setErro("A prioridade é um número inteiro de 0 a 100000.");
    if (f.de && f.ate && f.ate < f.de) return setErro("A vigência termina antes de começar.");
    setErro(null); setEnviando(true);
    const corpo = {
      nome: f.nome.trim(), familia: f.familia || null, campanha: f.campanha.trim() || null, prioridade, ativa: f.ativa,
      destinoUsuarioId: f.destino || null, fallback: f.fallback,
      vigenteDe: f.de ? `${f.de}T00:00:00-03:00` : null, vigenteAte: f.ate ? `${f.ate}T23:59:59-03:00` : null,
    };
    const r = regra === "nova" ? await api(BASE, "POST", corpo) : await api(`${BASE}/${(regra as RegraDaTela).id}`, "PATCH", corpo);
    setEnviando(false);
    if (r.ok) { toast.success(regra === "nova" ? "Regra criada." : "Regra salva."); onSalvo(); }
  }

  return (
    <Dialog open={regra !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rot-dialogo">
        <DialogHeader>
          <DialogTitle>{regra === "nova" ? "Nova regra de roteamento" : "Editar regra"}</DialogTitle>
          <DialogDescription>Vale para os próximos leads. Quem já foi atribuído não muda.</DialogDescription>
        </DialogHeader>
        <form className="agn-form" onSubmit={salvar} noValidate>
          <label>Nome<input value={f.nome} onChange={(e) => set("nome", e.target.value)} maxLength={120} placeholder="Ex.: Callface AI para a Mayra" autoFocus required /></label>
          <div className="agn-duas">
            <label>Família
              <select value={f.familia} onChange={(e) => set("familia", e.target.value)}>
                <option value="">Qualquer família</option>
                {Object.entries(FAMILIA).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            </label>
            <label>Campanha (contém)<input value={f.campanha} onChange={(e) => set("campanha", e.target.value)} maxLength={120} placeholder="Vazio = qualquer campanha" /></label>
          </div>
          <label>Prioridade
            <input type="number" min={0} max={100000} value={f.prioridade} onChange={(e) => set("prioridade", e.target.value)} />
            <span className="rot-ajuda">Maior vence. No empate, a regra mais específica vence: campanha e família antes de só família.</span>
          </label>
          <div className="agn-duas">
            <label>Closer de destino
              <select value={f.destino} onChange={(e) => set("destino", e.target.value)}>
                <option value="">Sem closer fixa: rodízio</option>
                {closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Se a closer estiver indisponível
              <select value={f.fallback} onChange={(e) => set("fallback", e.target.value)}>
                {Object.entries(FALLBACK).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="agn-duas">
            <label>Vigência a partir de<input type="date" value={f.de} onChange={(e) => set("de", e.target.value)} /></label>
            <label>Vigência até<input type="date" value={f.ate} onChange={(e) => set("ate", e.target.value)} /></label>
          </div>
          <label className="rot-check"><input type="checkbox" checked={f.ativa} onChange={(e) => set("ativa", e.target.checked)} /> Regra ativa</label>
          {erro ? <p className="rot-erro" role="alert">{erro}</p> : null}
          <div className="rot-rodape">
            <button type="button" className="agn-secundario" onClick={onClose}>Cancelar</button>
            <button type="submit" className="agn-primario" disabled={enviando}>{enviando ? "Salvando…" : "Salvar regra"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Simulacao = { familia: string | null; campanha: string | null; resultado: { tipo: string; nome?: string; motivo?: string; regra: { id: string; nome: string } | null } };

function Simulador() {
  const [familia, setFamilia] = React.useState("");
  const [campanha, setCampanha] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [achados, setAchados] = React.useState<{ id: string; nome: string }[]>([]);
  const [lead, setLead] = React.useState<{ id: string; nome: string } | null>(null);
  const [res, setRes] = React.useState<Simulacao | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    const q = busca.trim();
    if (q.length < 2 || lead) { setAchados([]); return; }
    let vivo = true;
    const t = setTimeout(() => {
      fetch(`/api/leads?search=${encodeURIComponent(q)}&limit=6`).then((r) => r.json()).then((j) => {
        if (vivo) setAchados(((j.leads ?? []) as { id: string; nome: string }[]).map((l) => ({ id: l.id, nome: l.nome })));
      }).catch(() => vivo && setAchados([]));
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca, lead]);

  async function simular(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    const p = new URLSearchParams();
    if (lead) p.set("leadId", lead.id); else { if (familia) p.set("familia", familia); if (campanha.trim()) p.set("campanha", campanha.trim()); }
    const r = await fetch(`${BASE}/simular?${p}`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setOcupado(false);
    if (!r || !r.ok) { setRes(null); setErro(j?.error || "Não foi possível simular"); return; }
    setRes(j as Simulacao);
  }

  const r = res?.resultado;
  return (
    <section className="agn-cartao rot-bloco" aria-labelledby="rot-sim">
      <div className="agn-cartao-topo"><h2 id="rot-sim">Para onde este lead iria?</h2><span>usa as mesmas regras da agenda</span></div>
      <form className="agn-form rot-sim-form" onSubmit={simular}>
        <label className="rot-lead">Lead (opcional)
          <input value={lead ? lead.nome : busca} onChange={(e) => { setLead(null); setBusca(e.target.value); setRes(null); }} placeholder="Busque pelo nome" autoComplete="off" />
          {achados.length > 0 ? (
            <ul className="rot-achados" aria-label="Leads encontrados">
              {achados.map((l) => <li key={l.id}><button type="button" onClick={() => { setLead(l); setAchados([]); }}>{l.nome}</button></li>)}
            </ul>
          ) : null}
        </label>
        <div className="agn-duas">
          <label>Família
            <select value={familia} onChange={(e) => setFamilia(e.target.value)} disabled={!!lead}>
              <option value="">Não informada</option>
              {Object.entries(FAMILIA).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </label>
          <label>Campanha<input value={campanha} onChange={(e) => setCampanha(e.target.value)} disabled={!!lead} placeholder="Nome da campanha" /></label>
        </div>
        <button type="submit" className="agn-secundario rot-sim-botao" disabled={ocupado}>{ocupado ? "Simulando…" : "Simular"}</button>
      </form>
      {erro ? <p className="rot-erro" role="alert">{erro}</p> : null}
      {res && r ? (
        <div className="rot-resultado" role="status" data-tipo={r.tipo}>
          <strong>{r.tipo === "fila_humana" ? "Fila humana" : r.tipo === "rodizio" ? `Rodízio: ${r.nome}` : r.nome}</strong>
          <span>
            {res.familia ? FAMILIA[res.familia] : "Família não identificada"}{res.campanha ? ` · campanha “${res.campanha}”` : ""}
            {r.regra ? ` · regra “${r.regra.nome}”` : " · nenhuma regra casou"}
          </span>
          {r.tipo === "fila_humana" ? <span>Motivo: {r.motivo}</span> : r.tipo === "rodizio" ? <span>Sem closer fixa disponível: a próxima da fila de rodízio recebe.</span> : <span>Closer da regra, disponível agora.</span>}
        </div>
      ) : null}
    </section>
  );
}

export function RoteamentoComercial({ dados, podeConfigurar }: { dados: DadosRoteamento; podeConfigurar: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = React.useState<RegraDaTela | "nova" | null>(null);
  const [removendo, setRemovendo] = React.useState<RegraDaTela | null>(null);
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const motivo = podeConfigurar ? undefined : "Editar o roteamento exige a permissão de configurar IA";

  async function alternar(r: RegraDaTela) {
    setOcupado(r.id);
    const x = await api(`${BASE}/${r.id}`, "PATCH", { ativa: !r.ativa });
    setOcupado(null);
    if (x.ok) { toast.success(r.ativa ? "Regra desativada." : "Regra ativada."); router.refresh(); }
  }
  async function remover() {
    if (!removendo) return;
    setOcupado(removendo.id);
    const x = await api(`${BASE}/${removendo.id}`, "DELETE");
    setOcupado(null); setRemovendo(null);
    if (x.ok) { toast.success("Regra removida."); router.refresh(); }
  }

  return (
    <div className="rot">
      <div className="rot-barra">
        <p>Maior prioridade vence; no empate, a regra mais específica (campanha e família) vence. Se a closer estiver inativa ou com a agenda pausada, o lead não é trocado em silêncio: vai para a fila humana ou para o rodízio, conforme a regra.</p>
        {!podeConfigurar ? <span className="agn-motivo">{motivo}</span> : null}
        <button type="button" className="agn-primario" disabled={!podeConfigurar} title={motivo} onClick={() => setEditando("nova")}><Plus size={14} strokeWidth={2.3} /> Nova regra</button>
      </div>

      <section className="agn-cartao rot-bloco" aria-labelledby="rot-regras">
        <div className="agn-cartao-topo"><h2 id="rot-regras">Regras</h2><span>{dados.regras.length} {dados.regras.length === 1 ? "regra" : "regras"}</span></div>
        {dados.regras.length === 0 ? (
          <div className="agn-vazio">
            <strong>Nenhuma regra de roteamento</strong>
            <span>Sem regra, todo lead vai para a fila humana. Crie a primeira: escolha a família, a closer de destino e o que fazer se ela estiver indisponível.</span>
            {podeConfigurar ? <button type="button" className="agn-primario" style={{ marginTop: 14 }} onClick={() => setEditando("nova")}><Plus size={14} /> Nova regra</button> : null}
          </div>
        ) : (
          <div className="rot-rolagem">
            <table className="rot-tabela">
              <thead><tr><th scope="col">Regra</th><th scope="col">Escopo</th><th scope="col">Prioridade</th><th scope="col">Vigência</th><th scope="col">Destino</th><th scope="col">Se indisponível</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {dados.regras.map((r) => {
                  const v = vigencia(r);
                  return (
                    <tr key={r.id} data-inativa={!r.ativa ? "true" : undefined}>
                      <th scope="row">
                        <strong>{r.nome}</strong>
                        <span className="agn-selo" data-tom={r.ativa && !v.fora ? "ok" : undefined}><i />{!r.ativa ? "Desativada" : v.fora ? "Fora da vigência" : "Ativa"}</span>
                      </th>
                      <td>{r.familia ? FAMILIA[r.familia] : "Qualquer família"}{r.campanha ? <span className="rot-sub">campanha contém “{r.campanha}”</span> : <span className="rot-sub">qualquer campanha</span>}</td>
                      <td className="agn-num">{r.prioridade}</td>
                      <td>{v.texto}</td>
                      <td>{r.destino ?? <span className="rot-sub">Rodízio (sem closer fixa)</span>}</td>
                      <td>{FALLBACK[r.fallback] ?? r.fallback}</td>
                      <td>
                        <span className="agn-acoes">
                          <button type="button" className="agn-acao" disabled={!podeConfigurar || ocupado === r.id} title={motivo} onClick={() => setEditando(r)} aria-label={`Editar ${r.nome}`}>Editar</button>
                          <button type="button" className="agn-acao" disabled={!podeConfigurar || ocupado === r.id} title={motivo} onClick={() => alternar(r)} aria-label={`${r.ativa ? "Desativar" : "Ativar"} ${r.nome}`}>{r.ativa ? "Desativar" : "Ativar"}</button>
                          <button type="button" className="agn-acao" disabled={!podeConfigurar || ocupado === r.id} title={motivo} onClick={() => setRemovendo(r)} aria-label={`Remover ${r.nome}`}>Remover</button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rot-duas">
        <section className="agn-cartao rot-bloco" aria-labelledby="rot-rodizio">
          <div className="agn-cartao-topo"><h2 id="rot-rodizio">Rodízio</h2><span>quem recebe sem closer fixa</span></div>
          {dados.rodizio.length === 0 ? (
            <div className="agn-vazio"><strong>Nenhuma closer ativa</strong><span>Sem closer ativa, o rodízio não distribui e o lead cai na fila humana.</span></div>
          ) : (
            <ol className="rot-fila">
              {dados.rodizio.map((c) => (
                <li key={c.id} data-pausada={c.pausado ? "true" : undefined}>
                  <span className="agn-num">{c.posicao ?? "–"}</span>
                  <strong>{c.nome}</strong>
                  <span className="agn-selo" data-tom={c.proxima ? "ok" : undefined}>{c.pausado ? "Agenda pausada: fora do rodízio" : c.proxima ? "Próxima da vez" : "Na fila"}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="rot-nota">A ordem segue a última reunião criada. Closer pausada ou sem agenda configurada não entra.</p>
        </section>
        <Simulador />
      </div>

      <EditorRegra regra={editando} closers={dados.closers} onClose={() => setEditando(null)} onSalvo={() => { setEditando(null); router.refresh(); }} />

      <AlertDialog open={!!removendo} onOpenChange={(o) => !o && setRemovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a regra “{removendo?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>Os próximos leads deixam de seguir esta regra. Quem já foi atribuído não muda. Para só pausar, use Desativar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remover}>Remover regra</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
