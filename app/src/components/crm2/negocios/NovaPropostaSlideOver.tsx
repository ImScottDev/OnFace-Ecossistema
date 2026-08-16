"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Cf2NovaPropostaWorkspace } from "@/components/crm2/propostas/NovaProposta";

/**
 * Painel pra criar proposta SEM sair da página do negócio (pedido explícito
 * do Kauã, item 3 do Commercial Core). Reaproveita o Cf2NovaPropostaWorkspace
 * inteiro (catálogo/carrinho/herança de contexto já testados) em vez de
 * duplicar a lógica de composição de proposta — só empurra `negocioId` pra
 * query string da própria rota do negócio (que é o que o componente já lê
 * via useSearchParams) e apresenta como slide-over em vez de navegação.
 */
export function Cf2NovaPropostaSlideOver({ negocioId, onClose }: { negocioId: string; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("negocioId") !== negocioId) {
      router.replace(`${pathname}?negocioId=${negocioId}`, { scroll: false });
    }
    return () => {
      router.replace(pathname, { scroll: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto"
        style={{ background: "var(--cf2-bg-canvas)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end px-3 pt-3 sticky top-0 z-10" style={{ background: "var(--cf2-bg-canvas)" }}>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }} aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <Cf2NovaPropostaWorkspace />
      </div>
    </div>
  );
}
