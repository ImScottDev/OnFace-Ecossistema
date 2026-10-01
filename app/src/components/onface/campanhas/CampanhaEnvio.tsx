"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tag } from "@/components/onface/vendas/ui";
import type { Resultado } from "@/lib/vendas/resultado";
import type { CampanhaCompleta, DestinatarioLinha, StatusDestinatario, Transicao } from "@/lib/automacoes/campanhas";
import { STATUS_DESTINATARIO, statusCampanha } from "./status";
import "@/components/onface/vendas/vendas.css";
import "./campanhas.css";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/**
 * Painel do disparo: em que pé está a campanha e o status de cada
 * destinatário, que é gravado pelo worker (`campanha-sweep`). Enquanto há
 * algo para acontecer (agendada/enviando) a página se atualiza sozinha.
 */
export function CampanhaEnvio({ campanha, linhas, contagem, podeGerir, acaoTransicionar }: {
  campanha: CampanhaCompleta;
  linhas: DestinatarioLinha[];
  contagem: Record<StatusDestinatario, number>;
  podeGerir: boolean;
  acaoTransicionar: (id: string, t: Transicao) => Promise<Resultado>;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [filtro, setFiltro] = useState<StatusDestinatario | "todos">("todos");
  const vivo = campanha.status === "agendada" || campanha.status === "enviando";

  useEffect(() => {
    if (!vivo) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [vivo, router]);

  function transicionar(t: Transicao, pergunta?: string) {
    if (pergunta && !window.confirm(pergunta)) return;
    iniciar(async () => {
      const r = await acaoTransicionar(campanha.id, t);
      if (!r.ok) { toast.error(r.erro); return; }
      toast.success({ cancelar: "Agendamento cancelado: voltou a rascunho", pausar: "Envio pausado", retomar: "Envio retomado" }[t]);
      router.refresh();
    });
  }

  const total = linhas.length;
  const st = statusCampanha(campanha.status);
  const visiveis = filtro === "todos" ? linhas : linhas.filter((l) => l.status === filtro);
  const frase =
    campanha.status === "agendada"
      ? `Agendada para ${quando(campanha.agendadaPara)}. A lista de destinatários é congelada quando o envio começa.`
      : campanha.status === "enviando"
        ? `Enviando desde ${quando(campanha.iniciadaEm)} — ${contagem.enviado + contagem.bloqueado + contagem.falhou} de ${total} processados.`
        : campanha.status === "pausada"
          ? `Pausada com ${contagem.pendente} na fila. Nada sai até retomar.`
          : campanha.status === "concluida"
            ? `Concluída em ${quando(campanha.concluidaEm)}.`
            : "";

  return (
    <section className="cp-bloco cp-envio-painel" aria-labelledby="cp-envio-titulo">
      <div className="cp-envio-topo">
        <h2 id="cp-envio-titulo">Envio <Tag tom={st.tom}>{st.rotulo}</Tag></h2>
        <div className="ov-acoes">
          {podeGerir && campanha.status === "agendada" ? (
            <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
              onClick={() => transicionar("cancelar", "Cancelar o agendamento? A campanha volta a rascunho e nada é enviado.")}>Cancelar agendamento</button>
          ) : null}
          {podeGerir && campanha.status === "enviando" ? (
            <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente} onClick={() => transicionar("pausar")}>Pausar envio</button>
          ) : null}
          {podeGerir && campanha.status === "pausada" ? (
            <button type="button" className="ov-botao" disabled={pendente} onClick={() => transicionar("retomar")}>Retomar envio</button>
          ) : null}
        </div>
      </div>
      <p className="ov-nota" style={{ margin: 0 }}>{frase}</p>

      {total > 0 ? (
        <>
          <div className="cp-barra" role="img" aria-label={`${contagem.enviado} enviados, ${contagem.bloqueado} bloqueados, ${contagem.falhou} falhas de ${total}`}>
            {(["enviado", "bloqueado", "falhou"] as const).map((s) =>
              contagem[s] ? <span key={s} data-s={s} style={{ width: `${(contagem[s] / total) * 100}%` }} /> : null)}
          </div>
          <div className="ov-familias" role="group" aria-label="Filtrar destinatários por status">
            {(["todos", "enviado", "pendente", "bloqueado", "falhou"] as const).map((s) => {
              const n = s === "todos" ? total : contagem[s] + (s === "pendente" ? contagem.enviando : 0);
              if (s !== "todos" && n === 0) return null;
              return (
                <button key={s} type="button" className="ov-familia" data-marcada={filtro === s ? "true" : undefined}
                  aria-pressed={filtro === s} onClick={() => setFiltro(s)}>
                  {s === "todos" ? "Todos" : STATUS_DESTINATARIO[s].rotulo} <span className="cp-contagem">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="ov-tabela-wrap">
            <table className="ov-tabela">
              <colgroup>
                <col style={{ width: "46%" }} /><col style={{ width: "20%" }} /><col style={{ width: "14%" }} /><col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr><th>Destinatário</th><th>{campanha.canal === "whatsapp" ? "Telefone" : "E-mail"}</th><th>Status</th><th>Enviado em</th></tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const s = STATUS_DESTINATARIO[l.status];
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="ov-tabela-principal">
                          {l.leadId ? <Link href={`/pessoas/${l.leadId}`}>{l.nome || "Sem nome"}</Link> : l.nome || "Sem nome"}
                        </div>
                        {l.erro ? <div className="cp-erro-linha">{l.erro}</div> : null}
                      </td>
                      <td className="ov-tabela-apoio">{l.destino}</td>
                      <td><Tag tom={s.tom}>{s.rotulo}</Tag></td>
                      <td className="ov-tabela-apoio">{quando(l.enviadoEm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : campanha.status === "agendada" ? null : (
        <p className="ov-nota" style={{ margin: 0 }}>Nenhum destinatário foi alcançado: as listas não tinham ninguém com {campanha.canal === "whatsapp" ? "telefone" : "e-mail"} no momento do envio.</p>
      )}
    </section>
  );
}
