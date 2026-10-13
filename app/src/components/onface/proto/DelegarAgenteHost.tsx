"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  acaoDevolverDelegacao, acaoPrepararDelegacao, type PreparoDelegacao,
} from "@/app/(produto)/pipeline/delegacao-actions";
import {
  AO, AUTONOMIAS, FormDelegar, SeloEstadoAgente, api, enviar, linkExecucao, quando,
  type AtribuicaoOp,
} from "@/components/onface/atendimento/agente-operacao";

/** Evento que o menu "Mais ações" (oportunidade e card) dispara para abrir o diálogo. */
export const EVENTO_DELEGAR_AGENTE = "onface:delegar-agente";
export const pedirDelegacaoAgente = (alvo: { negocioId?: string | null; leadId?: string | null }) =>
  window.dispatchEvent(new CustomEvent(EVENTO_DELEGAR_AGENTE, { detail: alvo }));

type Alvo = { negocioId?: string | null; leadId?: string | null };

/**
 * "Delegar a um agente": o agente assume contexto e objetivo e conduz sozinho, sem cadência de toques.
 * Escolhe agente + objetivo (+ autonomia) e atribui; com atribuição em curso, mostra o estado e deixa
 * pausar, retomar, transferir para uma pessoa ou encerrar. Montado nas telas que têm o menu.
 */
export function DelegarAgenteHost() {
  const router = useRouter();
  const [alvo, setAlvo] = React.useState<Alvo | null>(null);
  const [atrib, setAtrib] = React.useState<AtribuicaoOp | null | undefined>(undefined);
  /* Delegação do modelo antigo (cadência de toques) que ainda esteja em curso: só dá para devolver. */
  const [legado, setLegado] = React.useState<PreparoDelegacao["ativa"]>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const carregar = React.useCallback(async (a: Alvo) => {
    try {
      const q = new URLSearchParams();
      if (a.negocioId) q.set("negocioId", a.negocioId);
      if (a.leadId) q.set("leadId", a.leadId);
      const j = await api<{ atribuicao: AtribuicaoOp | null }>(`${AO}/atribuicoes/alvo?${q}`);
      setAtrib(j.atribuicao && j.atribuicao.status !== "encerrada" ? j.atribuicao : null);
    } catch (e) { toast.error((e as Error).message); setAtrib(null); }
    acaoPrepararDelegacao(a).then((p) => setLegado(p?.ativa ?? null)).catch(() => setLegado(null));
  }, []);

  React.useEffect(() => {
    const abrir = (e: Event) => {
      const a = (e as CustomEvent).detail as Alvo;
      setAlvo(a); setAtrib(undefined); setLegado(null); setMotivo("");
      void carregar(a);
    };
    window.addEventListener(EVENTO_DELEGAR_AGENTE, abrir);
    return () => window.removeEventListener(EVENTO_DELEGAR_AGENTE, abrir);
  }, [carregar]);

  const fechar = () => { if (!ocupado) setAlvo(null); };
  const rodar = async (fazer: () => Promise<unknown>, ok: string, fecha = false) => {
    setOcupado(true);
    try {
      await fazer(); toast.success(ok);
      if (fecha) setAlvo(null); else if (alvo) await carregar(alvo);
      router.refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  };

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="agp max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{atrib ? "Agente nesta oportunidade" : "Delegar a um agente"}</DialogTitle>
          <DialogDescription>
            {atrib ? "Quem conduz o atendimento agora e o que você pode fazer." : "O agente lê o histórico, conduz sozinho e agenda as próprias retomadas. Você pode assumir quando quiser."}
          </DialogDescription>
        </DialogHeader>

        {atrib === undefined ? (
          <p className="text-corpo text-tinta-suave">Carregando…</p>
        ) : atrib ? (
          <div className="flex flex-col gap-3" data-testid="delegar-atribuicao">
            <div className="flex flex-wrap items-center gap-2">
              <SeloEstadoAgente estado={atrib.status} />
              <strong className="text-corpo text-tinta">{atrib.agente}</strong>
            </div>
            {atrib.objetivo && <p className="text-corpo text-tinta"><span className="font-medium">Objetivo:</span> {atrib.objetivo}</p>}
            {atrib.autonomia && <p className="text-micro text-tinta-suave">Autonomia: {AUTONOMIAS[atrib.autonomia] ?? atrib.autonomia}</p>}
            {atrib.motivoEstado && <p className="text-corpo text-tinta-suave">{atrib.motivoEstado}</p>}
            {atrib.status === "humano" && atrib.resumoHandoff && (
              <p className="whitespace-pre-wrap rounded-lg bg-superficie-alt p-3 text-corpo text-tinta">{atrib.resumoHandoff}</p>
            )}
            <p className="text-micro text-tinta-suave">
              Desde {quando(atrib.createdAt)}.{" "}
              {atrib.ultimaExecucaoEm && <>Última execução em {quando(atrib.ultimaExecucaoEm)}. <Link className="underline" href={linkExecucao(atrib.ultimoRunId)}>Ver execução</Link></>}
            </p>
            <div className="flex flex-wrap gap-2">
              {atrib.status === "humano" && <Button size="sm" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${atrib.id}/retomar`, "POST"), "Agente voltou a conduzir.")}>Devolver ao agente</Button>}
              {["pausada", "falha"].includes(atrib.status) && <Button size="sm" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${atrib.id}/retomar`, "POST"), "Agente retomado.")}>Retomar</Button>}
              {["ativa", "aguardando_aprovacao"].includes(atrib.status) && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${atrib.id}/pausar`, "POST", { motivo: "Pausado por uma pessoa" }), "Agente pausado.")}>Pausar</Button>}
              {atrib.status !== "humano" && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${atrib.id}/transferir`, "POST", { motivo: "Pessoa assumiu o atendimento" }), "Você assumiu o atendimento.")}>Assumir (transferir para mim)</Button>}
              <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => rodar(() => enviar(`${AO}/atribuicoes/${atrib.id}/encerrar`, "POST", { motivo: "Encerrado por uma pessoa" }), "Atuação do agente encerrada.", true)}>Encerrar</Button>
            </div>
          </div>
        ) : legado ? (
          <div className="flex flex-col gap-3">
            <p className="text-corpo text-tinta">
              <strong>{legado.agente}</strong> está com um follow-up por toques desde {new Date(legado.desde).toLocaleDateString("pt-BR")} ({legado.toques} de {legado.maxToques}). Motivo: {legado.motivo}
            </p>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo da devolução" aria-label="Motivo da devolução" />
            <Button disabled={ocupado} onClick={async () => {
              setOcupado(true);
              const r = await acaoDevolverDelegacao(legado.id, motivo);
              setOcupado(false);
              if (!r.ok) { toast.error(r.erro); return; }
              toast.success("Devolvido à pessoa responsável."); setAlvo(null); router.refresh();
            }}>Devolver à pessoa</Button>
          </div>
        ) : alvo ? (
          <FormDelegar alvo={alvo} aoConcluir={() => { void carregar(alvo); router.refresh(); }} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
