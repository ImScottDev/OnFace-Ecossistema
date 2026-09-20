"use client";

/** DataGrid — a tabela do ONFACE.
 *
 * Existe UMA tabela no produto. Leads, Clientes, Propostas e Contratos são a
 * mesma grade com colunas diferentes: quem inventa `<table>` na tela quebra
 * ordenação, seleção, densidade e teclado de um jeito só dela, e o usuário
 * aprende quatro tabelas em vez de uma.
 *
 * O motor é @tanstack/react-table (headless): ele cuida de ordenação, filtro,
 * faceta, paginação e seleção; aqui só mora a aparência e o comportamento de
 * teclado. Os recursos são ligados por prop porque uma tela de Contratos não
 * precisa de ação em massa, e grade com botão morto é pior que grade simples.
 *
 * Colunas utilitárias (seleção, expandir, ações) são injetadas aqui, não
 * pedidas ao consumidor: são contrato do componente, não decisão de tela. */

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Columns3,
  Inbox,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import "./datagrid.css";

/** Alinhamento vive no `meta` da coluna: é decisão da coluna (moeda alinha à
 * direita), não do consumidor lembrar de passar classe em cada célula. */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    alinhamento?: "direita";
  }
}

export type Densidade = "compacta" | "padrao" | "confortavel";
export type EstadoDados = "pronto" | "carregando" | "erro";

/** Uma faceta é sempre uma coluna existente: a contagem por valor sai do
 * próprio modelo facetado, então filtro e tabela nunca divergem. */
export type Faceta = { id: string; rotulo: string };

export type OpcaoFaceta = { valor: string; contagem: number };

export type FacetaViva = Faceta & {
  opcoes: OpcaoFaceta[];
  selecionados: string[];
  aoAlternar: (valor: string) => void;
  aoLimpar: () => void;
};

const TAMANHOS_PAGINA = [10, 25, 50] as const;

/** Moeda é formatação de apresentação, então mora no componente. Importar o
 * `brl()` de `dados.ts` (fixture do laboratório) amarraria a grade do produto
 * aos dados de exemplo. */
const MOEDA_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/* ═══ Células tipadas ═════════════════════════════════════════════════════
 * A tela escolhe o TIPO da célula, não o CSS dela. É o que mantém a mesma
 * coluna de moeda igual em Propostas e em Contratos. */

export function CelulaPrincipal({
  iniciais,
  titulo,
  subtitulo,
}: {
  iniciais: string;
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <span className="ds-grid-celula-principal">
      <Avatar aria-hidden>
        <AvatarFallback className="ds-grid-avatar-marca">{iniciais}</AvatarFallback>
      </Avatar>
      <span className="ds-grid-principal-texto">
        <strong>{titulo}</strong>
        {subtitulo ? <small>{subtitulo}</small> : null}
      </span>
    </span>
  );
}

export type TomEtapa = "neutro" | "acento" | "ok" | "risco";

export function CelulaEtapa({ etapa, tom = "neutro" }: { etapa: string; tom?: TomEtapa }) {
  return (
    <Badge variant="secondary" className="ds-grid-etapa" data-tom={tom}>
      {etapa}
    </Badge>
  );
}

export function CelulaMoeda({ valor }: { valor: number }) {
  return <span className="ds-grid-num">{MOEDA_BRL.format(valor)}</span>;
}

export function CelulaResponsavel({ nome, iniciais }: { nome: string; iniciais: string }) {
  return (
    <span className="ds-grid-resp">
      <Avatar size="sm" aria-hidden>
        <AvatarFallback>{iniciais}</AvatarFallback>
      </Avatar>
      {nome}
    </span>
  );
}

export type SituacaoCelula = "no-prazo" | "hoje" | "atrasado" | "sem-tarefa";

/** Bolinha antes do texto: a situação é lida de relance na varredura vertical,
 * sem precisar ler a data de cada linha. */
export function CelulaSituacao({
  texto,
  situacao,
}: {
  texto: string;
  situacao: SituacaoCelula;
}) {
  return (
    <span className="ds-grid-situacao" data-situacao={situacao}>
      <i aria-hidden />
      {texto}
    </span>
  );
}

/* ═══ Barra de filtros ════════════════════════════════════════════════════ */

/** Separada do DataGrid de propósito: a mesma barra serve lista em cartão e
 * quadro. Ela não conhece a tabela — recebe valores e devolve intenção. */
export function BarraFiltros({
  busca,
  aoBuscar,
  placeholder = "Buscar",
  facetas = [],
  aoLimparTudo,
  extras,
}: {
  busca: string;
  aoBuscar: (valor: string) => void;
  placeholder?: string;
  facetas?: FacetaViva[];
  aoLimparTudo?: () => void;
  extras?: React.ReactNode;
}) {
  const temFiltro = busca.length > 0 || facetas.some((f) => f.selecionados.length > 0);

  return (
    // A barra troca de superfície quando há filtro ligado: o usuário vê que a
    // lista abaixo não é a base inteira antes de ler chip nenhum.
    <div className="ds-grid-barra" data-filtrado={temFiltro ? "true" : undefined}>
      <div className="ds-grid-barra-lado">
        <span className="ds-grid-busca">
          <Search aria-hidden />
          <Input
            type="search"
            value={busca}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => aoBuscar(e.target.value)}
          />
        </span>

        {facetas.map((faceta) => (
          <Popover key={faceta.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="ds-chip-filtro"
                data-ativo={faceta.selecionados.length > 0 ? "true" : undefined}
              >
                <Plus aria-hidden />
                {faceta.rotulo}
                {faceta.selecionados.length > 0 ? (
                  <span className="ds-grid-chip-contagem">{faceta.selecionados.length}</span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent className="ds-grid-pop" align="start">
              <Command>
                <CommandInput placeholder={faceta.rotulo} />
                <CommandList>
                  <CommandEmpty>Nenhum valor.</CommandEmpty>
                  <CommandGroup>
                    {faceta.opcoes.map((opcao) => {
                      const marcado = faceta.selecionados.includes(opcao.valor);
                      return (
                        <CommandItem
                          key={opcao.valor}
                          value={opcao.valor}
                          onSelect={() => faceta.aoAlternar(opcao.valor)}
                        >
                          <span className="ds-grid-faceta-marca" data-marcado={marcado}>
                            <Check aria-hidden />
                          </span>
                          {opcao.valor}
                          <span className="ds-grid-faceta-contagem">{opcao.contagem}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  {faceta.selecionados.length > 0 ? (
                    <>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem onSelect={faceta.aoLimpar}>
                          Limpar {faceta.rotulo.toLowerCase()}
                        </CommandItem>
                      </CommandGroup>
                    </>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ))}

        {/* Chip por valor escolhido: o filtro ativo fica legível e sai com um
            clique, sem reabrir o popover para descobrir o que está ligado.
            `data-aplicado` em vez de `data-ativo` separa os dois papéis: o
            gatilho da faceta continua coral rebaixado, o valor já aplicado vai
            para grafite, que é o degrau de contraste mais forte da barra. */}
        {facetas.flatMap((faceta) =>
          faceta.selecionados.map((valor) => (
            <button
              key={`${faceta.id}-${valor}`}
              type="button"
              className="ds-chip-filtro"
              data-aplicado="true"
              onClick={() => faceta.aoAlternar(valor)}
              aria-label={`Remover filtro ${faceta.rotulo}: ${valor}`}
            >
              <span className="ds-grid-chip-rotulo">{faceta.rotulo}</span>
              {valor}
              <X aria-hidden />
            </button>
          )),
        )}

        {temFiltro && aoLimparTudo ? (
          <Button variant="subtle" size="sm" onClick={aoLimparTudo}>
            <X aria-hidden />
            Limpar
          </Button>
        ) : null}
      </div>

      {extras ? <div className="ds-grid-barra-lado">{extras}</div> : null}
    </div>
  );
}

/* ═══ DataGrid ════════════════════════════════════════════════════════════ */

export type DataGridProps<TData> = {
  dados: TData[];
  colunas: ColumnDef<TData, unknown>[];
  /** Chave estável da linha. Sem ela, a seleção anda junto quando a ordem muda. */
  idDaLinha: (linha: TData) => string;
  /** Plural do que está listado: "negócios", "contratos". Usado nos contadores. */
  entidade?: string;
  estado?: EstadoDados;
  selecionavel?: boolean;
  expansivel?: boolean;
  facetas?: Faceta[];
  placeholderBusca?: string;
  /** Densidade controlada. Sem ela o componente guarda a própria. */
  densidade?: Densidade;
  aoMudarDensidade?: (densidade: Densidade) => void;
  detalhe?: (linha: TData) => React.ReactNode;
  /** Itens de menu por linha. A tela decide quais, inclusive o destrutivo. */
  acoesLinha?: (linha: TData) => React.ReactNode;
  acoesMassa?: (selecionadas: TData[], limparSelecao: () => void) => React.ReactNode;
  aoNovo?: () => void;
  aoTentarDeNovo?: () => void;
};

/** Filtro de faceta: valor da coluna precisa estar na lista escolhida.
 * Os filtros embutidos do TanStack esperam array do lado da LINHA, não do
 * lado do filtro, então este é o que serve para multi-seleção. */
function filtroFacetado<TData>(linha: Row<TData>, idColuna: string, valor: unknown): boolean {
  if (!Array.isArray(valor) || valor.length === 0) return true;
  return valor.includes(String(linha.getValue(idColuna)));
}

function idDaColuna<TData>(coluna: ColumnDef<TData, unknown>): string | undefined {
  if (coluna.id) return coluna.id;
  const comChave = coluna as { accessorKey?: string | number };
  return comChave.accessorKey === undefined ? undefined : String(comChave.accessorKey);
}

export function DataGrid<TData>({
  dados,
  colunas,
  idDaLinha,
  entidade = "registros",
  estado = "pronto",
  selecionavel = false,
  expansivel = false,
  facetas,
  placeholderBusca = "Buscar",
  densidade,
  aoMudarDensidade,
  detalhe,
  acoesLinha,
  acoesMassa,
  aoNovo,
  aoTentarDeNovo,
}: DataGridProps<TData>) {
  const semMovimento = useReducedMotion();
  const [ordenacao, setOrdenacao] = React.useState<SortingState>([]);
  const [busca, setBusca] = React.useState("");
  const [filtros, setFiltros] = React.useState<ColumnFiltersState>([]);
  const [visibilidade, setVisibilidade] = React.useState<VisibilityState>({});
  const [selecao, setSelecao] = React.useState<RowSelectionState>({});
  const [expandidas, setExpandidas] = React.useState<ExpandedState>({});
  const [paginacao, setPaginacao] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [densidadeInterna, setDensidadeInterna] = React.useState<Densidade>("padrao");
  const densidadeAtual = densidade ?? densidadeInterna;

  function mudarDensidade(nova: Densidade) {
    setDensidadeInterna(nova);
    aoMudarDensidade?.(nova);
  }

  const idsFacetados = React.useMemo(
    () => new Set((facetas ?? []).map((f) => f.id)),
    [facetas],
  );

  const colunasFinais = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    const conteudo = colunas.map((coluna) => {
      const chave = idDaColuna(coluna);
      // O filtro certo é injetado aqui para a tela não ter de lembrar dele.
      return chave && idsFacetados.has(chave) ? { ...coluna, filterFn: filtroFacetado } : coluna;
    });

    const utilitariasAntes: ColumnDef<TData, unknown>[] = [];
    if (selecionavel) {
      utilitariasAntes.push({
        id: "selecao",
        enableSorting: false,
        enableHiding: false,
        enableGlobalFilter: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Selecionar todas as linhas da página"
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Selecionar linha"
            checked={row.getIsSelected()}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
          />
        ),
      });
    }
    if (expansivel) {
      utilitariasAntes.push({
        id: "expandir",
        enableSorting: false,
        enableHiding: false,
        enableGlobalFilter: false,
        header: () => <span className="sr-only">Detalhe</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="ds-grid-expandir"
            data-aberta={row.getIsExpanded()}
            aria-expanded={row.getIsExpanded()}
            aria-label={row.getIsExpanded() ? "Fechar detalhe" : "Abrir detalhe"}
            onClick={(e) => {
              e.stopPropagation();
              row.toggleExpanded();
            }}
          >
            <ChevronRight aria-hidden />
          </button>
        ),
      });
    }

    const utilitariasDepois: ColumnDef<TData, unknown>[] = acoesLinha
      ? [
          {
            id: "acoes",
            enableSorting: false,
            enableHiding: false,
            enableGlobalFilter: false,
            header: () => <span className="sr-only">Ações</span>,
            cell: ({ row }) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ações da linha"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{acoesLinha(row.original)}</DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]
      : [];

    return [...utilitariasAntes, ...conteudo, ...utilitariasDepois];
  }, [colunas, idsFacetados, selecionavel, expansivel, acoesLinha]);

  const tabela = useReactTable({
    data: dados,
    columns: colunasFinais,
    getRowId: (linha) => idDaLinha(linha),
    state: {
      sorting: ordenacao,
      globalFilter: busca,
      columnFilters: filtros,
      columnVisibility: visibilidade,
      rowSelection: selecao,
      expanded: expandidas,
      pagination: paginacao,
    },
    enableRowSelection: selecionavel,
    getRowCanExpand: () => expansivel,
    onSortingChange: setOrdenacao,
    onGlobalFilterChange: setBusca,
    onColumnFiltersChange: setFiltros,
    onColumnVisibilityChange: setVisibilidade,
    onRowSelectionChange: setSelecao,
    onExpandedChange: setExpandidas,
    onPaginationChange: setPaginacao,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const facetasVivas: FacetaViva[] = (facetas ?? []).map((faceta) => {
    const coluna = tabela.getColumn(faceta.id);
    const unicos = coluna?.getFacetedUniqueValues();
    const selecionados = (coluna?.getFilterValue() as string[] | undefined) ?? [];
    const opcoes: OpcaoFaceta[] = unicos
      ? Array.from(unicos, (entrada: [unknown, number]) => ({
          valor: String(entrada[0]),
          contagem: entrada[1],
        })).sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR"))
      : [];
    return {
      ...faceta,
      opcoes,
      selecionados,
      aoAlternar: (valor) => {
        const proximos = selecionados.includes(valor)
          ? selecionados.filter((v) => v !== valor)
          : [...selecionados, valor];
        coluna?.setFilterValue(proximos.length > 0 ? proximos : undefined);
      },
      aoLimpar: () => coluna?.setFilterValue(undefined),
    };
  });

  const linhas = tabela.getRowModel().rows;
  const colunasVisiveis = tabela.getVisibleLeafColumns();
  const selecionadas = tabela.getFilteredSelectedRowModel().rows.map((l) => l.original);
  const temFiltro = busca.length > 0 || filtros.length > 0;

  /* Navegação por teclado: uma linha ativa por vez (roving tabindex). Tabela
     grande com 400 paradas de Tab é inoperável no teclado. */
  const [indiceAtivo, setIndiceAtivo] = React.useState<number | null>(null);
  const refAtiva = React.useRef<HTMLTableRowElement>(null);
  const ativo = indiceAtivo === null ? 0 : Math.min(indiceAtivo, Math.max(linhas.length - 1, 0));

  React.useEffect(() => {
    // Só move o foco quando a navegação foi intencional; no primeiro render
    // `indiceAtivo` é null e a grade não rouba o foco da página.
    if (indiceAtivo !== null) refAtiva.current?.focus();
  }, [indiceAtivo]);

  function teclado(evento: React.KeyboardEvent<HTMLTableSectionElement>) {
    // Só a própria linha responde: seta dentro de checkbox ou menu é do menu.
    if ((evento.target as HTMLElement).tagName !== "TR") return;
    if (linhas.length === 0) return;

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAtivo(Math.min(ativo + 1, linhas.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo(Math.max(ativo - 1, 0));
    } else if (evento.key === "Enter" && expansivel) {
      evento.preventDefault();
      linhas[ativo]?.toggleExpanded();
    }
  }

  function limparTudo() {
    setBusca("");
    tabela.resetColumnFilters();
  }

  const transicao = semMovimento
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.2, 0, 0.2, 1] as const };

  const controles = (
    <>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={densidadeAtual}
        aria-label="Densidade das linhas"
        onValueChange={(v) => {
          if (v) mudarDensidade(v as Densidade);
        }}
      >
        <ToggleGroupItem value="compacta" aria-label="Densidade compacta">
          Compacta
        </ToggleGroupItem>
        <ToggleGroupItem value="padrao" aria-label="Densidade padrão">
          Padrão
        </ToggleGroupItem>
        <ToggleGroupItem value="confortavel" aria-label="Densidade confortável">
          Confortável
        </ToggleGroupItem>
      </ToggleGroup>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns3 aria-hidden />
            Colunas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tabela
            .getAllLeafColumns()
            .filter((coluna) => coluna.getCanHide())
            .map((coluna) => (
              <DropdownMenuCheckboxItem
                key={coluna.id}
                checked={coluna.getIsVisible()}
                onCheckedChange={(v) => coluna.toggleVisibility(v === true)}
                onSelect={(e) => e.preventDefault()}
              >
                {rotuloDaColuna(coluna.id)}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div className="ds-grid-wrap">
      <BarraFiltros
        busca={busca}
        aoBuscar={setBusca}
        placeholder={placeholderBusca}
        facetas={facetasVivas}
        aoLimparTudo={limparTudo}
        extras={controles}
      />

      {/* A barra de ações em massa empurra a tabela para baixo em vez de flutuar
          por cima: nada some atrás dela quando 40 linhas estão marcadas. */}
      <AnimatePresence initial={false}>
        {selecionavel && acoesMassa && selecionadas.length > 0 ? (
          <motion.div
            key="massa"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transicao}
            style={{ overflow: "hidden" }}
          >
            <div className="ds-grid-acoes-massa" role="status">
              <strong className="ds-grid-massa-contagem">
                {selecionadas.length} {selecionadas.length === 1 ? "selecionado" : "selecionados"}
              </strong>
              {acoesMassa(selecionadas, () => tabela.resetRowSelection())}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {estado === "erro" ? (
        <div className="ds-grid-erro" role="alert">
          <span className="ds-vazio-figura" data-tom="risco">
            <TriangleAlert aria-hidden />
          </span>
          <strong>Não foi possível carregar {entidade}</strong>
          <p>A consulta falhou. Nada foi perdido: os filtros continuam do jeito que estavam.</p>
          {aoTentarDeNovo ? (
            <Button variant="outline" size="sm" onClick={aoTentarDeNovo}>
              <RotateCcw aria-hidden />
              Tentar de novo
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="ds-grid-rolagem">
          <table className="ds-grid-tabela" data-densidade={densidadeAtual}>
            <thead>
              {tabela.getHeaderGroups().map((grupo) => (
                <tr key={grupo.id}>
                  {grupo.headers.map((header) => {
                    const ordenado = header.column.getIsSorted();
                    const direita = header.column.columnDef.meta?.alinhamento === "direita";
                    return (
                      <th
                        key={header.id}
                        className={direita ? "ds-grid-cel-num" : undefined}
                        data-utilitaria={ehUtilitaria(header.column.id) ? "true" : undefined}
                        aria-sort={
                          ordenado === "asc"
                            ? "ascending"
                            : ordenado === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button type="button" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {ordenado === "asc" ? (
                              <ArrowUp aria-hidden />
                            ) : ordenado === "desc" ? (
                              <ArrowDown aria-hidden />
                            ) : (
                              <ChevronsUpDown aria-hidden />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            {estado === "carregando" ? (
              <tbody>
                {Array.from({ length: Math.min(paginacao.pageSize, 6) }, (_, i) => (
                  <tr key={`esqueleto-${i}`}>
                    {colunasVisiveis.map((coluna, indice) => (
                      <td key={coluna.id}>{formaEsqueleto(coluna.id, indice, selecionavel, expansivel)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ) : linhas.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={colunasVisiveis.length}>
                    <div className="ds-vazio">
                      <span className="ds-vazio-figura">
                        <Inbox aria-hidden />
                      </span>
                      <strong>
                        {temFiltro ? `Nenhum resultado em ${entidade}` : `Sem ${entidade} ainda`}
                      </strong>
                      <p>
                        {temFiltro
                          ? "Os filtros ativos não deixaram nenhuma linha. Solte um deles para voltar a enxergar a base."
                          : "Assim que o primeiro registro entrar, ele aparece aqui com etapa, valor e próxima ação."}
                      </p>
                      <div className="ds-linha ds-grid-vazio-acoes">
                        {temFiltro ? (
                          <Button variant="outline" size="sm" onClick={limparTudo}>
                            <X aria-hidden />
                            Limpar filtros
                          </Button>
                        ) : null}
                        {aoNovo ? (
                          <Button size="sm" onClick={aoNovo}>
                            <Plus aria-hidden />
                            Novo negócio
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody onKeyDown={teclado}>
                {linhas.map((linha, indice) => (
                  <React.Fragment key={linha.id}>
                    <tr
                      ref={indice === ativo ? refAtiva : undefined}
                      tabIndex={indice === ativo ? 0 : -1}
                      data-selecionada={linha.getIsSelected() ? "true" : undefined}
                      data-ativa={indiceAtivo !== null && indice === ativo ? "true" : undefined}
                      onClick={() => setIndiceAtivo(indice)}
                    >
                      {linha.getVisibleCells().map((celula) => (
                        <td
                          key={celula.id}
                          className={
                            celula.column.columnDef.meta?.alinhamento === "direita"
                              ? "ds-grid-cel-num"
                              : undefined
                          }
                          data-utilitaria={ehUtilitaria(celula.column.id) ? "true" : undefined}
                        >
                          {flexRender(celula.column.columnDef.cell, celula.getContext())}
                        </td>
                      ))}
                    </tr>
                    {expansivel && detalhe && linha.getIsExpanded() ? (
                      <tr className="ds-grid-linha-detalhe">
                        <td colSpan={colunasVisiveis.length}>
                          <motion.div
                            className="ds-grid-detalhe"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={transicao}
                          >
                            {detalhe(linha.original)}
                          </motion.div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}

      {estado === "pronto" && linhas.length > 0 ? (
        <div className="ds-grid-rodape">
          <span className="ds-grid-rodape-info">
            <b>{tabela.getFilteredRowModel().rows.length}</b> {entidade}
            {temFiltro ? " com o filtro atual" : ""}
            {selecionavel && selecionadas.length > 0 ? ` · ${selecionadas.length} selecionados` : ""}
          </span>

          <div className="ds-grid-barra-lado">
            <label className="ds-grid-rodape-info" htmlFor="ds-grid-tamanho">
              Linhas
            </label>
            <Select
              value={String(paginacao.pageSize)}
              onValueChange={(v) => tabela.setPageSize(Number(v))}
            >
              <SelectTrigger id="ds-grid-tamanho" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAMANHOS_PAGINA.map((tamanho) => (
                  <SelectItem key={tamanho} value={String(tamanho)}>
                    {tamanho}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="ds-grid-rodape-info">
              Página {paginacao.pageIndex + 1} de {Math.max(tabela.getPageCount(), 1)}
            </span>

            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Primeira página"
              disabled={!tabela.getCanPreviousPage()}
              onClick={() => tabela.setPageIndex(0)}
            >
              <ChevronsLeft aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={!tabela.getCanPreviousPage()}
              onClick={() => tabela.previousPage()}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próxima página"
              disabled={!tabela.getCanNextPage()}
              onClick={() => tabela.nextPage()}
            >
              <ChevronRight aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Última página"
              disabled={!tabela.getCanNextPage()}
              onClick={() => tabela.setPageIndex(tabela.getPageCount() - 1)}
            >
              <ChevronsRight aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ehUtilitaria(id: string) {
  return id === "selecao" || id === "expandir" || id === "acoes";
}

/** Rótulo legível no menu de colunas. O id é técnico (`proximaAcao`); o menu
 * não é lugar de camelCase. */
function rotuloDaColuna(id: string) {
  const mapa: Record<string, string> = {
    principal: "Negócio",
    etapa: "Etapa",
    valor: "Valor",
    responsavel: "Responsável",
    proximaAcao: "Próxima ação",
    origem: "Origem",
    produto: "Produto",
  };
  return mapa[id] ?? id;
}

/** O esqueleto imita a forma da linha, não um retângulo genérico: a página não
 * muda de altura nem de ritmo quando o dado chega. */
function formaEsqueleto(id: string, indice: number, selecionavel: boolean, expansivel: boolean) {
  if (id === "selecao") return <Skeleton className="ds-grid-esq-caixa" />;
  if (id === "expandir" || id === "acoes") return <Skeleton className="ds-grid-esq-icone" />;

  const primeiraDeConteudo = indice === (selecionavel ? 1 : 0) + (expansivel ? 1 : 0);
  if (primeiraDeConteudo) {
    return (
      <span className="ds-grid-celula-principal">
        <Skeleton className="ds-grid-esq-avatar" />
        <span className="ds-grid-esq-pilha">
          <Skeleton className="ds-grid-esq-linha" data-largura="cheia" />
          <Skeleton className="ds-grid-esq-linha" data-largura="curta" />
        </span>
      </span>
    );
  }
  return <Skeleton className="ds-grid-esq-linha" data-largura="media" />;
}
