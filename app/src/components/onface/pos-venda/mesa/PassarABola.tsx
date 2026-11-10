"use client";

/**
 * Passar e retomar a bola direto da mesa, sem abrir o projeto (spec §6.2).
 * Sempre visível: ação escondida no hover não existe no touch nem no leitor de tela.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pvEncerrarEspera, pvMarcarEspera } from "@/app/(produto)/pos-vendas/actions";
import type { MotivoDaEspera } from "@/lib/pos-venda/contrato";

export function PassarABola({ projetoId, esperando, pabx }: { projetoId: string; esperando: MotivoDaEspera | null; pabx: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>) =>
    iniciar(async () => {
      setErro(null);
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo. Tente de novo.");
      else router.refresh();
    });

  if (esperando) {
    return (
      <div className="pvm-bola">
        <button type="button" className="pvm-botao" disabled={pendente} onClick={() => rodar(() => pvEncerrarEspera(projetoId))}>
          Retomar a bola
        </button>
        {erro && <span role="alert" className="pvm-erro">{erro}</span>}
      </div>
    );
  }

  const motivos: Array<{ m: MotivoDaEspera; rotulo: string }> = [
    { m: "cliente", rotulo: "Cliente" },
    ...(pabx ? [{ m: "operadora" as const, rotulo: "Operadora" }] : []),
  ];
  return (
    <div className="pvm-bola" role="group" aria-label="Passar a bola para">
      <span className="pvm-bola-rotulo">Passar para</span>
      {motivos.map(({ m, rotulo }) => (
        <button key={m} type="button" className="pvm-botao" disabled={pendente} onClick={() => rodar(() => pvMarcarEspera(projetoId, m, ""))}>
          {rotulo}
        </button>
      ))}
      {erro && <span role="alert" className="pvm-erro">{erro}</span>}
    </div>
  );
}
