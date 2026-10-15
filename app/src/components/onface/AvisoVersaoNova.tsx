"use client";

/**
 * "O sistema foi atualizado" — o aviso que faltava quando um deploy acontece com
 * o time trabalhando.
 *
 * O Next assina cada Server Action com um hash do build. Quem está com a página
 * aberta de um build anterior e clica num botão recebe
 * `Failed to find Server Action "<hash>"`: a ação não existe mais no servidor.
 * Sem tratamento, o botão simplesmente MORRE — nada salva, nada avisa, e a
 * pessoa conclui que o sistema está quebrado.
 *
 * Medido em produção em 14/10/2026: 5 ocorrências em 45 minutos, enquanto o time
 * usava o CRM e eu publiquei três vezes no mesmo dia.
 *
 * Não recarrega sozinho de propósito: recarregar com um formulário preenchido
 * joga fora o trabalho de quem está digitando. Quem decide é a pessoa — o aviso
 * fica fixo até ela clicar.
 */

import * as React from "react";
import { toast } from "sonner";
import { ehAcaoDeOutroBuild } from "@/lib/acao-de-outro-build";



export function AvisoVersaoNova() {
  React.useEffect(() => {
    let avisado = false;

    const avisar = (motivo: unknown) => {
      if (avisado || !ehAcaoDeOutroBuild(motivo)) return;
      avisado = true; // uma vez por página: a pessoa pode clicar em vários botões mortos.
      toast.error("O sistema foi atualizado e esta página ficou para trás.", {
        description: "O que você clicou não chegou a ser salvo. Recarregue para continuar.",
        duration: Infinity,
        action: { label: "Recarregar", onClick: () => window.location.reload() },
      });
    };

    const naPromessa = (e: PromiseRejectionEvent) => avisar(e.reason);
    const noErro = (e: ErrorEvent) => avisar(e.error ?? e.message);

    window.addEventListener("unhandledrejection", naPromessa);
    window.addEventListener("error", noErro);
    return () => {
      window.removeEventListener("unhandledrejection", naPromessa);
      window.removeEventListener("error", noErro);
    };
  }, []);

  return null;
}
