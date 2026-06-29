"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

/**
 * Bloco "Alertas Urgentes" do dashboard — recolhível (pedido Scott 12/jun).
 * Estado persiste em localStorage pra não reabrir a cada visita.
 */

interface NegocioAlerta { id: string; titulo: string; createdAt?: string | Date }
interface ContratoAlerta { id: string; mrr: string | null; vencimento: string | null }

export function AlertasUrgentes({
  negociosNovosAntigos,
  negociosPropSemResposta,
  contratosVencendo,
  total,
}: {
  negociosNovosAntigos: NegocioAlerta[];
  negociosPropSemResposta: NegocioAlerta[];
  contratosVencendo: ContratoAlerta[];
  total: number;
}) {
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    // padrão recolhido (estilo Murilo: 1 linha); só expande se o usuário expandiu antes
    setCollapsed(localStorage.getItem("dashboard-alertas-collapsed") !== "0");
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("dashboard-alertas-collapsed", c ? "0" : "1");
      return !c;
    });
  };

  if (total === 0) return null;

  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
      <button onClick={toggle} className="w-full flex items-center justify-between group">
        <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Alertas Urgentes ({total})
        </h2>
        <ChevronDown
          className={`w-4 h-4 text-red-400/60 group-hover:text-red-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>
      {!collapsed && (
        <>
          <p className="text-[10px] text-white/25 mt-0.5">
            Negócios sem interação há mais de 2h, propostas sem resposta e contratos próximos do vencimento.
          </p>
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin pr-1">
            {negociosNovosAntigos.map((n) => {
              const mins = Math.floor((Date.now() - new Date(n.createdAt as string).getTime()) / 60000);
              const timeStr = mins >= 60 ? `há ${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60) + "min" : ""}` : `há ${mins}min`;
              return (
                <Link key={n.id} href={`/negocios/${n.id}`} className="block text-sm text-red-400 hover:text-red-300 transition-colors">
                  Negócio sem contato: <strong>{n.titulo}</strong> — {timeStr}
                </Link>
              );
            })}
            {negociosPropSemResposta.map((n) => (
              <Link key={n.id} href={`/negocios/${n.id}`} className="block text-sm text-amber-400 hover:text-amber-300 transition-colors">
                Proposta sem resposta: <strong>{n.titulo}</strong>
              </Link>
            ))}
            {contratosVencendo.map((c) => (
              <Link key={c.id} href={`/contratos`} className="block text-sm text-amber-400 hover:text-amber-300 transition-colors">
                Contrato vencendo: MRR R$ {c.mrr} — venc. {c.vencimento}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
