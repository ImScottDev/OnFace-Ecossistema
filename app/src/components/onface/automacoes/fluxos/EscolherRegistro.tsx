"use client";

/* Escolha do registro para Ensaiar e Rodar agora: busca no tenant por
 * GET /automacoes/fluxos/entidades (até 20). Sem registro escolhido, o
 * ensaio de um fluxo que precisa de um não tem o que ler. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { ROTULO_ENTIDADE, type TipoEntidade } from "@/lib/automacoes/grafo";
import { apiFluxos } from "./api";

export interface RegistroEscolhido { tipo: TipoEntidade; id: string; nome: string }

export function EscolherRegistro({ tipo, valor, aoEscolher }: {
  tipo: TipoEntidade;
  valor: RegistroEscolhido | null;
  aoEscolher: (r: RegistroEscolhido | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => { const t = setTimeout(() => setTermo(busca.trim()), 250); return () => clearTimeout(t); }, [busca]);

  const q = useQuery({
    queryKey: ["fluxos-entidades", tipo, termo],
    queryFn: () => apiFluxos.entidades(tipo, termo),
    enabled: !valor,
    staleTime: 30_000,
  });

  if (valor) {
    return (
      <div className="ofx-registro-escolhido">
        <Check size={14} aria-hidden />
        <span><em>{ROTULO_ENTIDADE[valor.tipo]}</em>{valor.nome}</span>
        <button type="button" className="oa-icone" onClick={() => aoEscolher(null)} aria-label="Trocar registro" title="Trocar"><X size={13} /></button>
      </div>
    );
  }

  return (
    <div className="ofx-registro">
      <label className="ofx-paleta-busca">
        <Search size={13} aria-hidden />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${ROTULO_ENTIDADE[tipo].toLowerCase()} pelo nome`} aria-label={`Buscar ${ROTULO_ENTIDADE[tipo]}`} />
      </label>
      <ul className="ofx-registro-lista">
        {q.isLoading && <li className="oa-dica">Buscando…</li>}
        {q.isError && <li className="oa-dica oa-alerta">{(q.error as Error).message}</li>}
        {q.data?.length === 0 && <li className="oa-dica">Nenhum {ROTULO_ENTIDADE[tipo].toLowerCase()} {termo ? `com “${termo}”` : "encontrado"}.</li>}
        {q.data?.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => aoEscolher({ tipo, id: r.id, nome: r.nome })}>
              <strong>{r.nome}</strong>
              {r.detalhe && <span>{r.detalhe}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
