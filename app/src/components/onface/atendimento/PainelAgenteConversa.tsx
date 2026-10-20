"use client";

/* Gaveta "Agente nesta conversa": estado completo, ações, retomadas, contexto e memória.
 * Aberta pelo botão IA do Atendimento. Lê /atribuicoes/conversa/:contatoId (atribuição +
 * retomadas pendentes), /contexto, /memoria e os casos de aprovação da conversa (ai_cases);
 * todo botão chama a rota de operação e recarrega do servidor, então o que se vê é o que persistiu. */
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AO, AprovacoesPendentes, FormDelegar, SeloEstadoAgente, AUTONOMIAS, api, enviar, linkExecucao, quando, rotuloMotivo, useAprovacoesDaConversa,
  type AtribuicaoOp, type CompromissoOp,
} from "./agente-operacao";

type Fato = { id: string; tipo: string; chave: string; valor: string; fonte: string; confirmado: boolean; status: string };
type Contexto = { texto: string; secoes: { titulo?: string; nome?: string }[]; tokensAprox: number };
type Estado = {
  estado: string; motivo: string; aviso: string | null; semResposta: string | null; agente: { id: string | null; nome: string } | null;
  /** Atribuição como a rota /ia devolve: traz o NOME de quem está com a conversa (`humano`). */
  atribuicao?: { humano: string | null; motivoEstado: string | null } | null;
};

const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2 border-t border-linha pt-4">
    <h3 className="text-corpo font-semibold text-tinta">{titulo}</h3>
    {children}
  </section>
);

export function PainelAgenteConversa({ contatoId, aberto, aoFechar, estado, aoMudar, alternarLegado, modoInicial }: {
  contatoId: string | null;
  /** "assumir" abre já com o resumo da passagem para confirmar. */
  modoInicial?: "assumir" | null;
  aberto: boolean;
  aoFechar: () => void;
  /** Estado da IA vindo de /atendimento/conversas/:id/ia (já carregado pela tela). */
  estado: Estado | undefined;
  /** Recarrega o estado da conversa na tela depois de cada ação. */
  aoMudar: () => void;
  /** Liga/pausa a resposta automática do SDR clássico, quando não há atribuição. */
  alternarLegado?: (ativa: boolean) => void;
}) {
  const [atrib, setAtrib] = React.useState<AtribuicaoOp | null>(null);
  const [comp, setComp] = React.useState<CompromissoOp[]>([]);
  const [fatos, setFatos] = React.useState<Fato[] | null>(null);
  const [ctx, setCtx] = React.useState<Contexto | null>(null);
  const [ctxCarregando, setCtxCarregando] = React.useState(false);
  const [carregando, setCarregando] = React.useState(true);
  const [ocupado, setOcupado] = React.useState(false);
  const [modo, setModo] = React.useState<null | "assumir" | "trocar" | "analisar">(null);
  const [resumo, setResumo] = React.useState<string | null>(null);
  const [pedido, setPedido] = React.useState("");
  const [editando, setEditando] = React.useState<{ id: string; valor: string } | null>(null);
  const [excluindo, setExcluindo] = React.useState<string | null>(null);
  const [reagendando, setReagendando] = React.useState<{ id: string; quando: string } | null>(null);
  const aprov = useAprovacoesDaConversa(contatoId, aberto);
  const recarregarAprov = aprov.recarregar;

  const carregar = React.useCallback(async () => {
    if (!contatoId) return;
    try {
      const [a, m] = await Promise.all([
        api<{ atribuicao: AtribuicaoOp | null; compromissos?: CompromissoOp[] }>(`${AO}/atribuicoes/conversa/${contatoId}`),
        api<{ fatos: Fato[] }>(`${AO}/memoria?contatoId=${contatoId}`),
      ]);
      setAtrib(a.atribuicao); setComp(a.compromissos ?? []); setFatos(m.fatos);
    } catch (e) { toast.error((e as Error).message); } finally { setCarregando(false); }
    void recarregarAprov();
  }, [contatoId, recarregarAprov]);

  React.useEffect(() => {
    if (!aberto) return;
    setCarregando(true); setModo(modoInicial ?? null); setResumo(null); setCtx(null); setEditando(null); setExcluindo(null); setReagendando(null);
    void carregar();
  }, [aberto, carregar, modoInicial]);

  const rodar = async (fazer: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try { await fazer(); toast.success(ok); setModo(null); setReagendando(null); await carregar(); aoMudar(); }
    catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  };

  const MOTIVOS: Record<string, string> = {
    canal_desconectado: "o número de WhatsApp está desconectado",
    numero_nao_autorizado_para_o_agente: "este número não está autorizado para o agente",
    humano_responsavel: "uma pessoa é a responsável", agente_pausado: "o agente está pausado", execucao_em_andamento: "já há uma execução em andamento",
  };
  /* A rota devolve o resultado da execução: só diz "análise pedida" quando o agente de fato rodou. */
  const solicitarAnalise = async () => {
    if (!at) return;
    setOcupado(true);
    try {
      const r = await enviar<{ resultado: string; motivo?: string }>(`${AO}/atribuicoes/${at.id}/acionar`, "POST", { objetivo: pedido.trim(), modo: "analisar" });
      if (["bloqueado", "falhou", "pausado", "ocupado"].includes(r.resultado)) toast.warning(`O agente não analisou: ${r.motivo ? (MOTIVOS[r.motivo] ?? r.motivo) : r.resultado}.`);
      else toast.success("Análise concluída. A nota aparece na conversa.");
      setPedido(""); setModo(null); await carregar(); aoMudar();
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  };

  const verContexto = async () => {
    if (!contatoId) return;
    setCtxCarregando(true);
    try { setCtx(await api<Contexto>(`${AO}/contexto?contatoId=${contatoId}${atrib ? `&agentId=${atrib.agentId}` : ""}`)); }
    catch (e) { toast.error((e as Error).message); } finally { setCtxCarregando(false); }
  };

  /* Resumo sugerido para quem assume: o que o agente registrou, ou o que dá para montar com objetivo e memória. */
  const resumoSugerido = () => {
    if (atrib?.resumoHandoff) return atrib.resumoHandoff;
    const partes = [atrib?.objetivo ? `Objetivo do agente: ${atrib.objetivo}` : null,
      ...(fatos ?? []).slice(0, 4).map((f) => `${f.chave}: ${f.valor}`),
      comp[0] ? `Retomada combinada: ${quando(comp[0].dueAt)} (${comp[0].motivo})` : null];
    return partes.filter(Boolean).join("\n");
  };

  const at = atrib;
  const st = at?.status ?? estado?.estado ?? "sem_agente";
  const vivo = !!at && at.status !== "encerrada";

  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <SheetContent className="agp w-full gap-0 sm:max-w-md" aria-describedby="painel-agente-desc">
        <SheetHeader>
          <SheetTitle>Agente nesta conversa</SheetTitle>
          <SheetDescription id="painel-agente-desc">Quem conduz, o que combinou e o que sabe. O histórico da conversa é um só.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          {carregando ? <p className="text-corpo text-tinta-suave">Carregando…</p> : (
            <>
              <div className="flex flex-col gap-2" data-testid="agente-estado">
                <div className="flex flex-wrap items-center gap-2">
                  <SeloEstadoAgente estado={st} conversa={{ humano: estado?.atribuicao?.humano ?? null, motivo: at?.motivoEstado ?? estado?.atribuicao?.motivoEstado ?? null }} />
                  {(at?.agente ?? estado?.agente?.nome) && <span className="text-micro text-tinta-suave">Agente: <strong className="text-tinta">{at?.agente ?? estado?.agente?.nome}</strong></span>}
                </div>
                {estado?.motivo && <p className="text-corpo text-tinta-suave">{estado.motivo}</p>}
                {estado?.aviso && <p className="text-corpo text-tinta-suave">{estado.aviso}</p>}
                {estado?.semResposta && <p className="text-corpo text-tinta-suave">{estado.semResposta}</p>}
                {at?.objetivo && <p className="text-corpo text-tinta"><span className="font-medium">Objetivo:</span> {at.objetivo}</p>}
                {at?.autonomia && <p className="text-micro text-tinta-suave">Autonomia: {AUTONOMIAS[at.autonomia] ?? at.autonomia}</p>}
                {at && (
                  <p className="text-micro text-tinta-suave">
                    {at.ultimaExecucaoEm ? `Última execução em ${quando(at.ultimaExecucaoEm)}. ` : ""}
                    <Link className="underline" href={linkExecucao(at.ultimoRunId)}>Ver execução</Link>
                  </p>
                )}
              </div>

              {vivo && (st === "humano" || at?.resumoHandoff) && (
                <div className="rounded-lg border border-linha bg-superficie-alt p-3" data-testid="agente-handoff">
                  <h3 className="text-corpo font-semibold text-tinta">{st === "humano" ? "Resumo da passagem" : "Resumo da última passagem"}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-corpo text-tinta">{at?.resumoHandoff || "O agente não deixou resumo. Veja o contexto e a memória abaixo."}</p>
                  {st === "humano" && at?.motivoEstado && <p className="mt-2 text-micro text-tinta-suave">Motivo: {rotuloMotivo(at.motivoEstado)}</p>}
                </div>
              )}

              {/* Aprovações pendentes: o agente preparou e espera uma pessoa decidir. */}
              {(aprov.erro || (aprov.casos?.length ?? 0) > 0) && (
                <section className="flex flex-col gap-2" aria-label="Aprovações pendentes">
                  <h3 className="text-corpo font-semibold text-tinta">Aguardando sua aprovação{aprov.casos?.length ? ` (${aprov.casos.length})` : ""}</h3>
                  <AprovacoesPendentes casos={aprov.casos} erro={aprov.erro} aoDecidir={async () => { await carregar(); aoMudar(); }} />
                </section>
              )}

              {/* Ações */}
              {vivo ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {st === "humano" && <Button size="sm" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${at!.id}/retomar`, "POST"), "Agente voltou a conduzir.")}>Devolver ao agente</Button>}
                    {(st === "pausada" || st === "falha") && <Button size="sm" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${at!.id}/retomar`, "POST"), "Agente retomado.")}>Retomar agente</Button>}
                    {(st === "ativa" || st === "aguardando_aprovacao") && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${at!.id}/pausar`, "POST", { motivo: "Pausado por uma pessoa" }), "Agente pausado.")}>Pausar agente</Button>}
                    {st !== "humano" && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => { setResumo(null); setModo(modo === "assumir" ? null : "assumir"); }}>Assumir conversa</Button>}
                    <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setModo(modo === "trocar" ? null : "trocar")}>Trocar agente</Button>
                    {st !== "humano" && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setModo(modo === "analisar" ? null : "analisar")}>Solicitar análise</Button>}
                    <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${at!.id}/encerrar`, "POST", { motivo: "Encerrado por uma pessoa" }), "Atuação do agente encerrada.")}>Encerrar atuação</Button>
                  </div>

                  {modo === "assumir" && (
                    <div className="flex flex-col gap-2 rounded-lg border border-linha p-3">
                      <label className="flex flex-col gap-1 text-corpo font-medium text-tinta">Resumo para quem assume
                        <Textarea value={resumo ?? resumoSugerido()} onChange={(e) => setResumo(e.target.value)} rows={5} maxLength={2000} />
                      </label>
                      <p className="text-micro text-tinta-suave">O agente para de responder e o histórico fica. Você pode devolver depois.</p>
                      <Button size="sm" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${at!.id}/transferir`, "POST", { motivo: "Pessoa assumiu o atendimento", resumo: (resumo ?? resumoSugerido()).trim() || undefined }), "Você assumiu a conversa.")}>Confirmar e assumir</Button>
                    </div>
                  )}
                  {modo === "trocar" && (
                    <div className="rounded-lg border border-linha p-3">
                      <FormDelegar alvo={{ contatoId }} trocar rotulo="Trocar agente" aoConcluir={() => { setModo(null); void carregar(); aoMudar(); }} />
                    </div>
                  )}
                  {modo === "analisar" && (
                    <div className="flex flex-col gap-2 rounded-lg border border-linha p-3">
                      <label className="flex flex-col gap-1 text-corpo font-medium text-tinta">O que você quer saber?
                        <Textarea value={pedido} onChange={(e) => setPedido(e.target.value)} rows={3} maxLength={600} placeholder="Ex.: o que falta para fechar essa venda?" />
                      </label>
                      <p className="text-micro text-tinta-suave">O agente só registra uma nota interna. Nada é enviado ao contato.</p>
                      <Button size="sm" disabled={ocupado || pedido.trim().length < 3} onClick={solicitarAnalise}>Solicitar análise</Button>
                    </div>
                  )}
                </div>
              ) : (
                <Secao titulo="Delegar a um agente">
                  <FormDelegar alvo={{ contatoId }} aoConcluir={() => { void carregar(); aoMudar(); }} />
                  {alternarLegado && (st === "desligada" || st === "pausada" || st === "ativa") && (
                    <Button size="sm" variant="ghost" className="self-start" onClick={() => alternarLegado(st !== "ativa")}>
                      {st === "ativa" ? "Pausar resposta automática do SDR" : "Ligar resposta automática do SDR"}
                    </Button>
                  )}
                </Secao>
              )}

              {/* Retomadas e compromissos */}
              {vivo && (
                <Secao titulo="Retomadas e compromissos">
                  {comp.length === 0 ? <p className="text-corpo text-tinta-suave">Nenhuma retomada pendente. O agente agenda quando combinar algo com o contato.</p> : (
                    <ul className="flex flex-col gap-2">
                      {comp.map((c) => (
                        <li key={c.id} className="flex flex-col gap-1 rounded-lg border border-linha p-3" data-testid="agente-compromisso">
                          <span className="text-corpo font-medium text-tinta">{quando(c.dueAt)}{c.status === "bloqueado" ? " (bloqueada)" : ""}</span>
                          <span className="text-corpo text-tinta-suave">{c.motivo}</span>
                          {c.bloqueioMotivo && <span className="text-micro text-tinta-suave">{c.bloqueioMotivo}</span>}
                          {reagendando?.id === c.id ? (
                            <div className="flex gap-2">
                              <Input type="datetime-local" value={reagendando.quando} onChange={(e) => setReagendando({ id: c.id, quando: e.target.value })} aria-label="Nova data e hora" />
                              <Button size="sm" disabled={ocupado || !reagendando.quando} onClick={() => rodar(() => enviar(`${AO}/compromissos/${c.id}/reagendar`, "POST", { quando: new Date(reagendando.quando).toISOString() }), "Retomada reagendada.")}>Salvar</Button>
                              <Button size="sm" variant="ghost" onClick={() => setReagendando(null)}>Voltar</Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button size="xs" variant="outline" onClick={() => setReagendando({ id: c.id, quando: "" })}>Reagendar</Button>
                              <Button size="xs" variant="ghost" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/compromissos/${c.id}/cancelar`, "POST", { motivo: "cancelado por uma pessoa" }), "Retomada cancelada.")}>Cancelar</Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Secao>
              )}

              {/* Contexto */}
              <Secao titulo="O que o agente sabe agora">
                {ctx ? (
                  <>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-superficie-alt p-3 text-micro text-tinta" data-testid="agente-contexto">{ctx.texto || "Sem contexto registrado ainda."}</pre>
                    <span className="text-micro text-tinta-suave">Mesmo contexto que o agente recebe a cada execução (cerca de {ctx.tokensAprox} tokens).</span>
                  </>
                ) : <Button size="sm" variant="outline" className="self-start" disabled={ctxCarregando} onClick={verContexto}>{ctxCarregando ? "Carregando…" : "Consultar contexto"}</Button>}
              </Secao>

              {/* Memória */}
              <Secao titulo="Memória sobre este contato">
                {!fatos?.length ? <p className="text-corpo text-tinta-suave">O agente ainda não guardou fatos. Quando guardar, você corrige ou apaga aqui.</p> : (
                  <ul className="flex flex-col gap-2">
                    {fatos.map((f) => (
                      <li key={f.id} className="flex flex-col gap-1 rounded-lg border border-linha p-3" data-testid="agente-fato">
                        <span className="text-micro text-tinta-suave">{f.chave} · {f.tipo} · fonte {f.fonte}{f.confirmado ? " · confirmado" : ""}</span>
                        {editando?.id === f.id ? (
                          <div className="flex flex-col gap-2">
                            <Textarea value={editando.valor} onChange={(e) => setEditando({ id: f.id, valor: e.target.value })} rows={2} maxLength={1500} aria-label="Valor do fato" />
                            <div className="flex gap-2">
                              <Button size="sm" disabled={ocupado || !editando.valor.trim()} onClick={() => rodar(() => enviar(`${AO}/memoria/${f.id}`, "PATCH", { valor: editando.valor.trim() }).then(() => setEditando(null)), "Fato corrigido.")}>Salvar</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Voltar</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-corpo text-tinta">{f.valor}</span>
                            <div className="flex gap-2">
                              <Button size="xs" variant="outline" onClick={() => setEditando({ id: f.id, valor: f.valor })}>Corrigir</Button>
                              {excluindo === f.id ? (
                                <Button size="xs" variant="destructive" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/memoria/${f.id}`, "DELETE").then(() => setExcluindo(null)), "Fato excluído.")}>Confirmar exclusão</Button>
                              ) : <Button size="xs" variant="ghost" onClick={() => setExcluindo(f.id)}>Excluir</Button>}
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
