"use client";

/* Paleta de blocos: busca + categorias com contagem (contrato §7.2). Abre
 * pelo "+" do canto do canvas (bloco solto) e pelo "+" de uma saída (bloco já
 * ligado). Arrastar um item para o canvas também cria o bloco. Enter adiciona
 * o primeiro resultado; Esc fecha. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { CATALOGO_NOS, CATEGORIAS, TIPOS_NO, type CategoriaNo, type TipoNo } from "@/lib/automacoes/grafo";
import { iconeDe } from "./icones";
import { DND_TIPO } from "./Canvas";

const TIPOS = TIPOS_NO.filter((t) => t !== "gatilho");

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Paleta({ contexto, aoEscolher, aoFechar }: {
  /** "Depois de Condição › Sim" quando veio de uma saída. */
  contexto: string | null;
  aoEscolher: (tipo: TipoNo) => void;
  aoFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaNo | "todas">("todas");
  const [ativo, setAtivo] = useState(0);
  const buscaRef = useRef<HTMLInputElement>(null);
  useEffect(() => { buscaRef.current?.focus(); }, []);

  const termo = normalizar(busca.trim());
  const casam = useMemo(() => TIPOS.filter((t) => {
    const m = CATALOGO_NOS[t];
    return !termo || normalizar(`${m.rotulo} ${m.descricao}`).includes(termo);
  }), [termo]);
  const visiveis = casam.filter((t) => categoria === "todas" || CATALOGO_NOS[t].categoria === categoria);
  const ativoSeguro = Math.min(ativo, Math.max(0, visiveis.length - 1));

  const teclado = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); aoFechar(); }
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((i) => Math.min(i + 1, visiveis.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && visiveis[ativoSeguro]) { e.preventDefault(); aoEscolher(visiveis[ativoSeguro]); }
  };

  return (
    <div className="ofx-paleta" role="dialog" aria-label="Adicionar bloco" onKeyDown={teclado}>
      <div className="ofx-paleta-topo">
        <div>
          <strong>Adicionar bloco</strong>
          <span>{contexto ?? "Clique para adicionar ou arraste para o desenho"}</span>
        </div>
        <button type="button" className="oa-icone" onClick={aoFechar} aria-label="Fechar"><X size={15} /></button>
      </div>
      <label className="ofx-paleta-busca">
        <Search size={14} aria-hidden />
        <input ref={buscaRef} value={busca} onChange={(e) => { setBusca(e.target.value); setAtivo(0); }} placeholder="Buscar bloco: tarefa, WhatsApp, esperar…" aria-label="Buscar bloco" />
      </label>
      <div className="ofx-paleta-cats" role="tablist" aria-label="Categorias">
        <button type="button" role="tab" aria-selected={categoria === "todas"} onClick={() => setCategoria("todas")}>Todas <b>{casam.length}</b></button>
        {CATEGORIAS.map((c) => {
          const n = casam.filter((t) => CATALOGO_NOS[t].categoria === c.id).length;
          return (
            <button key={c.id} type="button" role="tab" aria-selected={categoria === c.id} onClick={() => { setCategoria(c.id); setAtivo(0); }} disabled={!n}>
              {c.rotulo} <b>{n}</b>
            </button>
          );
        })}
      </div>
      <ul className="ofx-paleta-lista">
        {visiveis.length === 0 && <li className="ofx-paleta-vazio">Nenhum bloco com “{busca}”. Tente outra palavra.</li>}
        {visiveis.map((t, i) => {
          const m = CATALOGO_NOS[t];
          const Icone = iconeDe(m.icone);
          return (
            <li key={t}>
              <button
                type="button"
                className="ofx-paleta-item"
                data-categoria={m.categoria}
                data-ativo={i === ativoSeguro ? "true" : undefined}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData(DND_TIPO, t); e.dataTransfer.effectAllowed = "copy"; }}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => aoEscolher(t)}
              >
                <span className="ofx-no-icone"><Icone size={14} strokeWidth={2.2} aria-hidden /></span>
                <span className="ofx-paleta-texto">
                  <strong>{m.rotulo}</strong>
                  <span>{m.descricao}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
