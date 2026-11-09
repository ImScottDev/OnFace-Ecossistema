"use client";

/**
 * Filtros do board, numa barra só, em duas linhas com função diferente:
 *
 *   1. ONDE olhar: busca, jornada (tipo), responsável e estado.
 *   2. O QUE olhar: recortes de um toque e a forma de ler (ordem e visão).
 *
 * Nada aqui é estado de filtro: cada controle LÊ a URL (via `filtros`, que o
 * servidor já resolveu) e ESCREVE a URL. O único estado local é o texto da
 * busca enquanto a pessoa digita, e ele só existe até o debounce empurrar
 * para a URL.
 *
 * Cada filtro ligado aparece como etiqueta removível no fim, com o resultado
 * ("12 de 56"): quem olha sabe o que está ativo sem abrir menu nenhum.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LayoutGrid, ListFilter, Loader2, Rows3, Search, UserRound, X } from "lucide-react";
import type { EstadoDoProjeto, FiltrosDoBoard, TipoDeProjeto, Usuario } from "@/lib/pos-venda/contrato";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADO_DO_PROJETO, primeiroNome, TIPO } from "../formatos";
import { hrefDoBoard, ORDENS, RECORTES, type Ordem, type Vista } from "../parametros";
import { Avatar } from "../pecas";

const ESTADOS: EstadoDoProjeto[] = ["EM_ANDAMENTO", "AGUARDANDO", "EM_VALIDACAO", "NAO_INICIADO", "CONCLUIDO", "CANCELADO"];
const TIPOS: Array<{ valor: TipoDeProjeto | null; rotulo: string }> = [
  { valor: null, rotulo: "Ambas" },
  { valor: "ONBOARDING", rotulo: TIPO.ONBOARDING },
  { valor: "IMPLEMENTATION", rotulo: TIPO.IMPLEMENTATION },
];

export function BarraDeFiltros({
  filtros, vista, responsaveis, total, universo,
}: {
  filtros: FiltrosDoBoard;
  vista: Vista;
  responsaveis: Usuario[];
  /** Quantos projetos o recorte mostra. */
  total: number;
  /** Quantos existem antes do recorte de estado/recorte (o "de 56"). */
  universo: number;
}) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [texto, setTexto] = useState(filtros.busca ?? "");
  const enviado = useRef(filtros.busca ?? "");

  const ir = (mudar: Partial<FiltrosDoBoard>, v: Vista = vista) => comecar(() => router.replace(hrefDoBoard(filtros, mudar, v), { scroll: false }));

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
      comecar(() => router.replace(hrefDoBoard(filtros, { busca: limpo || null }, vista), { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [texto, filtros, router, vista]);

  const responsavelAtivo = responsaveis.find((r) => r.id === filtros.responsavelId);
  const recorteAtivo = RECORTES.find((r) => r.valor === filtros.recorte);
  type Ativo = { chave: string; rotulo: string; tirar: Partial<FiltrosDoBoard> };
  const ativos: Array<Ativo | null> = [
    filtros.tipo ? { chave: "tipo", rotulo: TIPO[filtros.tipo], tirar: { tipo: null } } : null,
    filtros.responsavelId ? { chave: "resp", rotulo: responsavelAtivo ? primeiroNome(responsavelAtivo.nome) : "Responsável escolhido", tirar: { responsavelId: null } } : null,
    filtros.estado ? { chave: "estado", rotulo: ESTADO_DO_PROJETO[filtros.estado].rotulo, tirar: { estado: null } } : null,
    recorteAtivo ? { chave: "recorte", rotulo: recorteAtivo.rotulo, tirar: { recorte: null } } : null,
    filtros.busca ? { chave: "busca", rotulo: `“${filtros.busca}”`, tirar: { busca: null } } : null,
  ];
  const ativosLigados = ativos.filter((x): x is Ativo => x !== null);
  const limpar = hrefDoBoard({ tipo: null, familia: filtros.familia, responsavelId: null, estado: null, recorte: null, busca: null }, {}, vista);

  return (
    <div className="pv-barra-filtros" role="search" aria-busy={pendente}>
      <div className="pv-filtros">
        <label className="pv-busca">
          <span className="pv-sr-only">Buscar empresa</span>
          <Search aria-hidden />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar empresa" autoComplete="off" maxLength={80} />
        </label>

        <div className="pv-segmentos" role="group" aria-label="Jornada">
          {TIPOS.map((t) => (
            <button key={t.rotulo} type="button" className="pv-segmento" aria-pressed={filtros.tipo === t.valor} onClick={() => ir({ tipo: t.valor })}>
              {t.rotulo}
            </button>
          ))}
        </div>

        <Popover>
          <PopoverTrigger className="pv-gatilho" data-ligado={filtros.responsavelId ? "true" : undefined} aria-label="Filtrar por responsável">
            <UserRound aria-hidden />
            {responsavelAtivo ? primeiroNome(responsavelAtivo.nome) : "Responsável"}
            <ChevronDown aria-hidden className="pv-gatilho-seta" />
          </PopoverTrigger>
          <PopoverContent align="start" className="pv-menu">
            <OpcaoDeMenu ativo={!filtros.responsavelId && filtros.recorte !== "sem_responsavel"} aoEscolher={() => ir({ responsavelId: null })}>Todos</OpcaoDeMenu>
            <OpcaoDeMenu ativo={filtros.recorte === "sem_responsavel"} aoEscolher={() => ir({ recorte: filtros.recorte === "sem_responsavel" ? null : "sem_responsavel", responsavelId: null })}>
              <span className="pv-menu-vazio">Sem responsável</span>
            </OpcaoDeMenu>
            {responsaveis.map((r) => (
              <OpcaoDeMenu key={r.id} ativo={filtros.responsavelId === r.id} aoEscolher={() => ir({ responsavelId: filtros.responsavelId === r.id ? null : r.id })}>
                <Avatar quem={r} tamanho="sm" titulo={false} decorativo />
                {r.nome}
              </OpcaoDeMenu>
            ))}
            {/* Quem está na URL mas não está na equipe lida continua visível, senão o filtro ficaria ligado sem rosto. */}
            {filtros.responsavelId && !responsavelAtivo ? (
              <OpcaoDeMenu ativo aoEscolher={() => ir({ responsavelId: null })}>Responsável escolhido</OpcaoDeMenu>
            ) : null}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className="pv-gatilho" data-ligado={filtros.estado ? "true" : undefined} aria-label="Filtrar por estado">
            <ListFilter aria-hidden />
            {filtros.estado ? ESTADO_DO_PROJETO[filtros.estado].rotulo : "Estado"}
            <ChevronDown aria-hidden className="pv-gatilho-seta" />
          </PopoverTrigger>
          <PopoverContent align="start" className="pv-menu">
            <OpcaoDeMenu ativo={!filtros.estado} aoEscolher={() => ir({ estado: null })}>Todos os estados</OpcaoDeMenu>
            {ESTADOS.map((e) => (
              <OpcaoDeMenu key={e} ativo={filtros.estado === e} aoEscolher={() => ir({ estado: filtros.estado === e ? null : e, recorte: null })}>
                <span className="pv-menu-ponto" data-pv-tom={ESTADO_DO_PROJETO[e].tom} aria-hidden />
                {ESTADO_DO_PROJETO[e].rotulo}
              </OpcaoDeMenu>
            ))}
          </PopoverContent>
        </Popover>

        <span className="pv-resultado" role="status">
          {pendente ? <Loader2 className="animate-spin" aria-label="Atualizando" /> : null}
          {total === universo ? <><b>{total}</b> {total === 1 ? "projeto" : "projetos"}</> : <><b>{total}</b> de {universo}</>}
        </span>
      </div>

      <div className="pv-filtros pv-filtros-2">
        <div className="pv-recortes" role="group" aria-label="Recortes rápidos">
          {RECORTES.map((r) => {
            const ligado = filtros.recorte === r.valor;
            return (
              <button key={r.valor} type="button" className="pv-chip" aria-pressed={ligado} onClick={() => ir({ recorte: ligado ? null : r.valor, estado: null })}>
                {ligado ? <Check aria-hidden /> : null}
                {r.rotulo}
              </button>
            );
          })}
        </div>

        <div className="pv-leitura">
          <Select value={vista.ordem} onValueChange={(v) => ir({}, { ...vista, ordem: v as Ordem })}>
            <SelectTrigger className="pv-gatilho pv-gatilho-ordem" aria-label="Ordenar projetos">
              <SelectValue>{ORDENS.find((o) => o.valor === vista.ordem)?.rotulo}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ORDENS.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="pv-segmentos pv-segmentos-icone" role="group" aria-label="Forma de ver">
            <button type="button" className="pv-segmento" aria-pressed={vista.visao === "lista"} aria-label="Ver em lista" title="Lista" onClick={() => ir({}, { ...vista, visao: "lista" })}><Rows3 aria-hidden /></button>
            <button type="button" className="pv-segmento" aria-pressed={vista.visao === "cartoes"} aria-label="Ver em cartões" title="Cartões" onClick={() => ir({}, { ...vista, visao: "cartoes" })}><LayoutGrid aria-hidden /></button>
          </div>
        </div>
      </div>

      {ativosLigados.length > 0 ? (
        <div className="pv-ativos" aria-label="Filtros ligados">
          {ativosLigados.map((a) => (
            <button key={a.chave} type="button" className="pv-ativo" onClick={() => ir(a.tirar)} aria-label={`Remover filtro ${a.rotulo}`}>
              {a.rotulo}
              <X aria-hidden />
            </button>
          ))}
          <Link className="pv-limpar" href={limpar}>Limpar tudo</Link>
        </div>
      ) : null}
    </div>
  );
}

function OpcaoDeMenu({ ativo, aoEscolher, children }: { ativo: boolean; aoEscolher: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="pv-menu-opcao" data-ativo={ativo || undefined} aria-pressed={ativo} onClick={aoEscolher}>
      <span className="pv-menu-rotulo">{children}</span>
      {ativo ? <Check aria-hidden /> : null}
    </button>
  );
}
