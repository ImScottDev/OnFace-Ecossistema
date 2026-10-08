"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  acaoDelegarAAgente, acaoDevolverDelegacao, acaoPrepararDelegacao, type PreparoDelegacao,
} from "@/app/(produto)/pipeline/delegacao-actions";

/** Evento que o menu "Mais ações" (oportunidade e card) dispara para abrir o diálogo. */
export const EVENTO_DELEGAR_AGENTE = "onface:delegar-agente";
export const pedirDelegacaoAgente = (alvo: { negocioId?: string | null; leadId?: string | null }) =>
  window.dispatchEvent(new CustomEvent(EVENTO_DELEGAR_AGENTE, { detail: alvo }));

const campo: React.CSSProperties = { width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid var(--of-linha-controle)", background: "var(--of-papel)", color: "var(--of-tinta-forte)", font: "inherit", fontSize: 13.5 };
const rotulo: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--of-tinta)" };

/**
 * "Delegar a um agente": atribui a oportunidade (ou lead) a uma agente de IA para ela fazer o
 * follow-up, com motivo e cadência, e permite devolver à pessoa. Montado nas telas que têm o menu.
 */
export function DelegarAgenteHost() {
  const router = useRouter();
  const [alvo, setAlvo] = React.useState<{ negocioId?: string | null; leadId?: string | null } | null>(null);
  const [preparo, setPreparo] = React.useState<PreparoDelegacao | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [agente, setAgente] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [dias, setDias] = React.useState(2);
  const [intervalo, setIntervalo] = React.useState(2);
  const [maxToques, setMaxToques] = React.useState(4);

  React.useEffect(() => {
    const abrir = (e: Event) => {
      const a = (e as CustomEvent).detail as { negocioId?: string | null; leadId?: string | null };
      setAlvo(a); setPreparo(null); setMotivo("");
      acaoPrepararDelegacao(a).then((p) => { setPreparo(p); setAgente(p?.agentes[0]?.usuarioId ?? ""); });
    };
    window.addEventListener(EVENTO_DELEGAR_AGENTE, abrir);
    return () => window.removeEventListener(EVENTO_DELEGAR_AGENTE, abrir);
  }, []);

  if (!alvo) return null;
  const fechar = () => { if (!salvando) setAlvo(null); };

  const delegar = async () => {
    setSalvando(true);
    const r = await acaoDelegarAAgente({ ...alvo, agenteUsuarioId: agente, motivo, diasSemResposta: dias, intervaloDias: intervalo, maxToques });
    setSalvando(false);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Follow-up delegado ao agente.");
    setAlvo(null); router.refresh();
  };
  const devolver = async () => {
    if (!preparo?.ativa) return;
    setSalvando(true);
    const r = await acaoDevolverDelegacao(preparo.ativa.id, motivo);
    setSalvando(false);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Devolvido à pessoa responsável.");
    setAlvo(null); router.refresh();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Delegar a um agente" onClick={fechar}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(18,23,29,.45)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", maxHeight: "92vh", overflow: "auto", background: "var(--of-papel)", borderRadius: 18, padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--of-tinta-forte)", letterSpacing: "-.02em" }}>
          {preparo?.ativa ? "Follow-up delegado" : "Delegar a um agente"}
        </h2>
        {!preparo ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--of-tinta)" }}>Carregando…</p>
        ) : preparo.ativa ? (
          <>
            <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--of-tinta)" }}>
              <strong>{preparo.ativa.agente}</strong> está responsável desde {new Date(preparo.ativa.desde).toLocaleDateString("pt-BR")}.
              Toques feitos: {preparo.ativa.toques} de {preparo.ativa.maxToques}.
              {preparo.ativa.proximoToqueEm ? ` Próximo toque em ${new Date(preparo.ativa.proximoToqueEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.` : ""}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--of-tinta)" }}>Motivo: {preparo.ativa.motivo}</p>
            <label style={rotulo}>Motivo da devolução{preparo.ativa.devolverPara ? ` (volta para ${preparo.ativa.devolverPara})` : ""}
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ex.: cliente pediu para falar comigo" style={campo} />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" disabled={salvando} onClick={devolver} style={{ flex: 1, padding: 11, borderRadius: 10, border: 0, background: "var(--of-coral-acao)", color: "var(--of-papel)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>
                {salvando ? "Devolvendo…" : "Devolver à pessoa"}
              </button>
              <button type="button" onClick={fechar} style={{ padding: "11px 16px", borderRadius: 10, border: 0, background: "transparent", color: "var(--of-tinta)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
            </div>
          </>
        ) : preparo.agentes.length === 0 ? (
          <>
            <p style={{ margin: "8px 0 14px", fontSize: 13, color: "var(--of-tinta)" }}>Nenhum agente de atendimento publicado. Publique um agente em Automações, Agentes (com a ferramenta de preparar mensagem) para poder delegar.</p>
            <button type="button" onClick={fechar} style={{ width: "100%", padding: 11, borderRadius: 10, border: 0, background: "var(--of-neutro)", color: "var(--of-tinta-forte)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
          </>
        ) : (
          <>
            <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--of-tinta)" }}>
              O agente passa a ser o responsável e faz o follow-up pelo WhatsApp. Você pode pedir de volta quando quiser.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={rotulo}>Agente
                <select value={agente} onChange={(e) => setAgente(e.target.value)} style={campo}>
                  {preparo.agentes.map((a) => <option key={a.usuarioId} value={a.usuarioId}>{a.nome} (IA)</option>)}
                </select>
              </label>
              <label style={rotulo}>Motivo (obrigatório)
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: enviei a proposta, acompanhar se o cliente viu e tirar dúvidas" style={campo} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <label style={rotulo}>1º toque após (dias)
                  <input type="number" min={0} max={60} value={dias} onChange={(e) => setDias(Number(e.target.value))} style={campo} />
                </label>
                <label style={rotulo}>A cada (dias)
                  <input type="number" min={1} max={30} value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} style={campo} />
                </label>
                <label style={rotulo}>Máx. toques
                  <input type="number" min={1} max={10} value={maxToques} onChange={(e) => setMaxToques(Number(e.target.value))} style={campo} />
                </label>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--of-tinta)" }}>Sem resposta depois do último toque, volta para você. Se o cliente pedir uma pessoa, também.</p>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" disabled={salvando || !motivo.trim() || !agente} onClick={delegar}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: 0, background: "var(--of-coral-acao)", color: "var(--of-papel)", font: "inherit", fontWeight: 600, cursor: "pointer", opacity: salvando || !motivo.trim() ? 0.5 : 1 }}>
                {salvando ? "Delegando…" : "Delegar"}
              </button>
              <button type="button" onClick={fechar} style={{ padding: "11px 16px", borderRadius: 10, border: 0, background: "transparent", color: "var(--of-tinta)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
