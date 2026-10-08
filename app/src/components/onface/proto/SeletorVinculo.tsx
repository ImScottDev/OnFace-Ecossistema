"use client";

/* Seletor de vínculo do modal único de atividade: busca pessoa, empresa e
 * oportunidade pela mesma ação e devolve o item escolhido. Mora fora do
 * arquivo gerado do desenho; o desenho só reserva o lugar (`nv.seletor`). */

import * as React from "react";

import type { VinculoBuscado } from "@/app/(produto)/contatos/actions";

const ROTULO = { pessoa: "Pessoa", empresa: "Empresa", opp: "Oportunidade" } as const;

export function SeletorVinculo({ buscar, aoEscolher }: {
  buscar: (termo: string) => Promise<VinculoBuscado[]>;
  aoEscolher: (v: VinculoBuscado) => void;
}) {
  const [q, setQ] = React.useState("");
  const [itens, setItens] = React.useState<VinculoBuscado[]>([]);
  const [aberto, setAberto] = React.useState(false);
  const raiz = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (itens.length) raiz.current?.scrollIntoView({ block: "nearest" }); }, [itens]);

  React.useEffect(() => {
    if (q.trim().length < 2) { setItens([]); return; }
    let vivo = true;
    const t = setTimeout(() => { buscar(q).then((r) => { if (vivo) setItens(r); }).catch(() => { if (vivo) setItens([]); }); }, 220);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, buscar]);

  return (
    <div ref={raiz} style={{ flex: "1 1 100%", minWidth: 0 }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Vincular pessoa, empresa ou oportunidade"
        aria-label="Buscar vínculo"
        style={{ height: 32, width: 280, padding: "0 12px", borderRadius: 9999, border: 0, outline: 0, background: "var(--of-neutro)", fontSize: "var(--of-t-corpo)", color: "var(--of-tinta-forte)" }}
      />
      {aberto && q.trim().length >= 2 ? (
        <div style={{ marginTop: 6, maxHeight: 200, overflowY: "auto", background: "var(--of-papel)", borderRadius: 12, boxShadow: "inset 0 0 0 1px var(--of-linha)", padding: 4 }}>
          {itens.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: "var(--of-t-corpo)", color: "var(--of-tinta-3)" }}>Nada encontrado.</div>
          ) : itens.map((v) => (
            <button
              key={v.tipo + v.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); aoEscolher(v); setQ(""); setItens([]); setAberto(false); }}
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "7px 10px", border: 0, borderRadius: 8, background: "transparent", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ flex: "0 0 auto", fontSize: "var(--of-t-meta)", color: "var(--of-tinta-3)", width: 84 }}>{ROTULO[v.tipo]}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: "var(--of-t-corpo)", fontWeight: 500, color: "var(--of-tinta-forte)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.rotulo}</span>
              {v.apoio ? <span style={{ fontSize: "var(--of-t-meta)", color: "var(--of-tinta-4)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.apoio}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
