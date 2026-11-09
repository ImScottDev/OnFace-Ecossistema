"use client";

/**
 * Busca, responsável, estado e recortes do board.
 *
 * Nada aqui é estado de filtro: cada controle LÊ a URL (via `filtros`, que o
 * servidor já resolveu) e ESCREVE a URL. O único estado local é o texto da
 * busca enquanto a pessoa digita — e ele só existe até o debounce empurrar
 * para a URL.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import type { EstadoDoProjeto, FiltrosDoBoard, Usuario } from "@/lib/pos-venda/contrato";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADO_DO_PROJETO } from "../formatos";
import { hrefDoBoard, RECORTES, temFiltro } from "../parametros";

/** Radix Select não aceita value vazio: um sentinela diz "sem filtro". */
const TODOS = "__todos__";
const ESTADOS: EstadoDoProjeto[] = ["EM_ANDAMENTO", "AGUARDANDO", "EM_VALIDACAO", "NAO_INICIADO", "CONCLUIDO", "CANCELADO"];

export function BarraDeFiltros({ filtros, responsaveis, total }: { filtros: FiltrosDoBoard; responsaveis: Usuario[]; total: number }) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [texto, setTexto] = useState(filtros.busca ?? "");
  const enviado = useRef(filtros.busca ?? "");

  const ir = (mudar: Partial<FiltrosDoBoard>) => comecar(() => router.replace(hrefDoBoard(filtros, mudar), { scroll: false }));

  // A URL mudou por fora (limpar filtros, voltar do navegador): o campo acompanha.
  useEffect(() => {
    const naUrl = filtros.busca ?? "";
    if (naUrl !== enviado.current) {
      enviado.current = naUrl;
      setTexto(naUrl);
    }
  }, [filtros.busca]);

  // Debounce: a URL só recebe o texto quando a pessoa para de digitar.
  useEffect(() => {
    const limpo = texto.trim();
    if (limpo === enviado.current) return;
    const t = setTimeout(() => {
      enviado.current = limpo;
      comecar(() => router.replace(hrefDoBoard(filtros, { busca: limpo || null }), { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [texto, filtros, router]);

  const recorteAtivo = RECORTES.find((r) => r.valor === filtros.recorte);
  const responsavelAtivo = responsaveis.find((r) => r.id === filtros.responsavelId);
  const limpar = hrefDoBoard({ tipo: null, familia: filtros.familia, responsavelId: null, estado: null, recorte: null, busca: null });

  return (
    <div className="pv-filtros" role="search" aria-busy={pendente}>
      <label className="pv-busca">
        <span className="pv-sr-only">Buscar empresa</span>
        <Search aria-hidden />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar empresa"
          autoComplete="off"
          maxLength={80}
        />
      </label>

      <Select value={filtros.responsavelId ?? TODOS} onValueChange={(v) => ir({ responsavelId: v === TODOS ? null : v })}>
        <SelectTrigger className="pv-filtros-ctl" aria-label="Filtrar por responsável">
          <SelectValue placeholder="Responsável">{filtros.responsavelId ? (responsavelAtivo?.nome ?? "Responsável escolhido") : "Todos os responsáveis"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os responsáveis</SelectItem>
          {responsaveis.map((r) => (
            <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
          ))}
          {/* Quem está na URL mas não está mais nos cartões continua escolhível,
              senão o select mostraria o sentinela enquanto o filtro segue ligado. */}
          {filtros.responsavelId && !responsavelAtivo ? <SelectItem value={filtros.responsavelId}>Responsável escolhido</SelectItem> : null}
        </SelectContent>
      </Select>

      <Select value={filtros.estado ?? TODOS} onValueChange={(v) => ir({ estado: v === TODOS ? null : (v as EstadoDoProjeto) })}>
        <SelectTrigger className="pv-filtros-ctl" aria-label="Filtrar por estado">
          <SelectValue placeholder="Estado">{filtros.estado ? ESTADO_DO_PROJETO[filtros.estado].rotulo : "Em aberto"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Em aberto</SelectItem>
          {ESTADOS.map((e) => (
            <SelectItem key={e} value={e}>{ESTADO_DO_PROJETO[e].rotulo}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {recorteAtivo ? (
        <span className="pv-recortes">
          <Link className="pv-recorte" href={hrefDoBoard(filtros, { recorte: null })} aria-label={`Remover recorte ${recorteAtivo.rotulo}`}>
            {recorteAtivo.rotulo}
            <X aria-hidden />
          </Link>
        </span>
      ) : null}

      {temFiltro(filtros) ? (
        <Link className="pv-limpar" href={limpar}>Limpar filtros</Link>
      ) : null}

      <span className="pv-resultado" role="status">
        {pendente ? <Loader2 className="animate-spin" aria-label="Atualizando" /> : null}
        {total} {total === 1 ? "projeto" : "projetos"}
      </span>
    </div>
  );
}
