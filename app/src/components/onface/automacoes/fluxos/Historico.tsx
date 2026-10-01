"use client";

/* Aba Versões: cada Publicar grava uma versão que não muda mais. Escolher uma
 * mostra o grafo dela no canvas em modo leitura; restaurar copia para o
 * rascunho e não publica (contrato §0, Versão). */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { apiFluxos } from "./api";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function Historico({ fluxoId, versaoVista, aoVer, publicadaEm }: {
  fluxoId: string;
  versaoVista: string | null;
  aoVer: (versaoId: string) => void;
  /** Muda a cada publicação: refaz a lista. */
  publicadaEm: string | null;
}) {
  const q = useQuery({ queryKey: ["fluxo-versoes", fluxoId, publicadaEm], queryFn: () => apiFluxos.versoes(fluxoId) });

  return (
    <div className="ofx-teste">
      <p className="ofx-teste-explica">Cada <b>Publicar</b> grava uma versão que não muda mais. Abra uma para ver como estava; restaurar copia para o rascunho, sem publicar.</p>
      {q.isLoading && <p className="oa-dica">Carregando versões…</p>}
      {q.isError && (
        <div className="ofx-aviso">
          <AlertTriangle size={14} aria-hidden />
          <span>{(q.error as Error).message}</span>
          <button type="button" className="oa-btn oa-btn-secundario" onClick={() => q.refetch()}>Tentar de novo</button>
        </div>
      )}
      {q.data?.length === 0 && <p className="oa-dica">Nenhuma versão publicada ainda. O que você edita fica no rascunho até publicar.</p>}
      <ul className="ofx-execs-lista">
        {q.data?.map((v) => (
          <li key={v.id}>
            <button type="button" className="ofx-exec" aria-current={versaoVista === v.id ? "true" : undefined} onClick={() => aoVer(v.id)}>
              <span className="ofx-versao-num">v{v.versao}</span>
              <span className="ofx-exec-corpo">
                <strong>Versão {v.versao}{v.atual && <span className="oa-selo oa-ok">Em uso</span>}</strong>
                <span>{fmt(v.publicadaEm)}{v.publicadaPor ? ` · ${v.publicadaPor}` : ""}</span>
              </span>
              <ChevronRight size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
