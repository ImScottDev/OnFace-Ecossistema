"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Devolve eventos do dead-letter do outbox para a fila.
 *
 * Chama o endpoint que já existe no Hono (POST /api/admin/event-outbox/reprocessar),
 * que valida papel (admin/super_admin), filtra por organização e grava audit_log.
 * Sem `ids` ele reenfileira todas as falhas da org, que é o "Reprocessar todas".
 *
 * Quem não tem papel vê o botão desabilitado com o motivo: esconder faria
 * parecer que não há o que fazer, quando há e depende de outra pessoa.
 */
export function ReprocessarBotao({
  ids,
  rotulo,
  permitido,
  variante = "secundario",
}: {
  ids?: string[];
  rotulo: string;
  permitido: boolean;
  variante?: "primario" | "secundario";
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function reprocessar() {
    setMsg(null);
    try {
      const r = await fetch("/api/admin/event-outbox/reprocessar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      if (!r.ok) throw new Error(r.status === 403 ? "Sem permissão para reprocessar." : `Falha ao reprocessar (${r.status}).`);
      const res = (await r.json()) as { reenfileirados: number };
      setMsg({ tipo: "ok", texto: `${res.reenfileirados} reenfileirado(s) para o próximo ciclo do worker.` });
      // Relê no servidor: o evento sai de "erro" e passa a "pendente".
      iniciar(() => router.refresh());
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao reprocessar." });
    }
  }

  return (
    <span className="exe-reproc">
      <button
        type="button"
        className={variante === "primario" ? "exe-btn exe-btn-primario" : "exe-btn"}
        onClick={reprocessar}
        disabled={!permitido || pendente}
        title={permitido ? undefined : "Só admin reprocessa eventos da fila"}
      >
        {pendente ? "Reprocessando…" : rotulo}
      </button>
      {!permitido ? <span className="exe-reproc-motivo">Só admin reprocessa</span> : null}
      {msg ? <span className="exe-reproc-msg" data-tipo={msg.tipo} role="status">{msg.texto}</span> : null}
    </span>
  );
}
