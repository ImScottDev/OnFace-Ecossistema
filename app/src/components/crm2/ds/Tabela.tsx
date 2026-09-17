"use client";

/**
 * Tabela do Callface UI System (31/08).
 *
 * A primeira versão do catálogo levou um "ficou péssima" merecido: era a
 * tabela crua do shadcn, desenhada para documentação, não para uma ferramenta
 * onde o time passa o dia. Os problemas concretos eram densidade de landing
 * page, cabeçalho competindo com o dado, número alinhado à esquerda e nenhuma
 * distinção entre uma tabela de leitura e uma de trabalho.
 *
 * Daí as três densidades: o mesmo componente serve pra um resumo de 5 linhas
 * dentro de um card e pra uma lista de 300 negócios em tela cheia — o que
 * muda é a densidade, não o componente.
 *
 * Regras que ela impõe:
 *  - número SEMPRE à direita e tabular (coluna de valor tem que bater o olho);
 *  - cabeçalho é rótulo, não título: micro, caixa alta, cor fraca;
 *  - linha inteira clicável quando há destino, com foco de teclado;
 *  - ação secundária escondida até hover/foco, para não competir com o dado;
 *  - cabeçalho fixo opcional — lista longa sem cabeçalho fixo é inutilizável.
 */
import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Densidade = "compacta" | "padrao" | "confortavel";

// Altura MÍNIMA da linha. Célula usa py próprio, então conteúdo de duas
// linhas (nome + e-mail) cresce sem estourar — era o que fazia a tabela
// parecer colada mesmo com altura definida.
const ALTURA: Record<Densidade, string> = {
  compacta: "min-h-10",
  padrao: "min-h-14",
  confortavel: "min-h-16",
};

const PADDING_CELULA: Record<Densidade, string> = {
  compacta: "py-2",
  padrao: "py-3",
  confortavel: "py-4",
};

const CtxTabela = React.createContext<{ densidade: Densidade }>({ densidade: "padrao" });

export function Cf2Tabela({
  densidade = "padrao",
  cabecalhoFixo = false,
  zebrada = false,
  className,
  children,
  ...props
}: React.ComponentProps<"table"> & {
  densidade?: Densidade;
  /** Para listas longas: o cabeçalho gruda no topo do container que rola. */
  cabecalhoFixo?: boolean;
  /** Só para tabelas largas de leitura — em tabela curta, zebra é ruído. */
  zebrada?: boolean;
}) {
  return (
    <CtxTabela.Provider value={{ densidade }}>
      <div className="w-full overflow-x-auto">
        <table
          data-cabecalho-fixo={cabecalhoFixo || undefined}
          data-zebrada={zebrada || undefined}
          className={cn(
            "w-full border-collapse text-left",
            "[&[data-zebrada]_tbody_tr:nth-child(even)]:bg-superficie-alt/40",
            "[&[data-cabecalho-fixo]_thead_th]:sticky [&[data-cabecalho-fixo]_thead_th]:top-0 [&[data-cabecalho-fixo]_thead_th]:z-10",
            className
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    </CtxTabela.Provider>
  );
}

export function Cf2TabelaCabecalho({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("bg-superficie border-b border-linha", className)}
      {...props}
    />
  );
}

export function Cf2TabelaCorpo({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-linha", className)} {...props} />;
}

export function Cf2Th({
  numerico = false,
  className,
  ...props
}: React.ComponentProps<"th"> & { numerico?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        // Cabeçalho é RÓTULO, não título: pequeno, espaçado e fraco. Ele
        // orienta a coluna e some da leitura — o dado é que deve pesar.
        "text-[11px] leading-none uppercase font-semibold tracking-[0.06em] text-tinta-fraca",
        "px-4 py-3 whitespace-nowrap bg-superficie",
        // Respiro nas bordas da tabela: célula colada na borda do card é o
        // que fazia a lista parecer apertada mesmo com altura de linha certa.
        "first:pl-5 last:pr-5",
        numerico && "text-right",
        className
      )}
      {...props}
    />
  );
}

export function Cf2Td({
  numerico = false,
  className,
  ...props
}: React.ComponentProps<"td"> & { numerico?: boolean }) {
  const { densidade } = React.useContext(CtxTabela);
  return (
    <td
      className={cn(
        "px-4 text-corpo text-tinta align-middle first:pl-5 last:pr-5",
        PADDING_CELULA[densidade],
        // Número à direita e tabular: sem isso a coluna de valor não alinha
        // na vírgula e comparar duas linhas exige ler dígito por dígito.
        numerico && "text-right tabular-nums font-medium",
        className
      )}
      {...props}
    />
  );
}

export function Cf2Linha({
  aoClicar,
  selecionada = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"tr">, "onClick"> & {
  aoClicar?: () => void;
  selecionada?: boolean;
}) {
  const { densidade } = React.useContext(CtxTabela);
  const clicavel = Boolean(aoClicar);

  return (
    <tr
      className={cn(
        ALTURA[densidade],
        "group cf2-transicao",
        clicavel && "cursor-pointer hover:bg-superficie-alt cf2-foco",
        // Seleção sutil + barra na lateral: pintar a linha inteira com a cor
        // da marca (como estava) deixava a tabela verde e ilegível com tudo
        // marcado. A barra sinaliza sem competir com o dado.
        selecionada && "bg-superficie-alt shadow-[inset_3px_0_0_0_var(--cf2-brand)]",
        className
      )}
      onClick={aoClicar}
      // Linha clicável precisa ser alcançável por teclado — sem isto a tabela
      // inteira fica inacessível pra quem navega por Tab.
      tabIndex={clicavel ? 0 : undefined}
      role={clicavel ? "button" : undefined}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                aoClicar?.();
              }
            }
          : undefined
      }
      {...props}
    >
      {children}
    </tr>
  );
}

/** Célula de ações: só aparece no hover ou com foco de teclado. */
export function Cf2TdAcoes({ className, children, ...props }: React.ComponentProps<"td">) {
  return (
    <td className={cn("px-2 w-px last:pr-3", className)} {...props}>
      <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 group-focus-within:opacity-100 cf2-transicao">
        {children}
      </div>
    </td>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Estrutura completa: toolbar, seleção em lote e paginação.
   Padrões absorvidos de uma referência de datatable que o Kauã mandou
   (31/08). Não copiei o arquivo — ele trazia `Card` que não temos e cor crua
   (bg-green-50), o que reintroduziria justamente a divergência que a
   fundação existe pra eliminar. O que valia era a ESTRUTURA:
   seleção múltipla → ação em lote, toolbar acima, paginação abaixo.

   Ação em lote é o ganho real num CRM: transferir 10 leads de responsável
   sem abrir 10 telas.
   ────────────────────────────────────────────────────────────────────────── */

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Barra acima da tabela: busca/filtros à esquerda, ações à direita. */
export function Cf2TabelaToolbar({
  className, children, acoes,
}: {
  className?: string;
  children?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-linha", className)}>
      <div className="flex items-center gap-2 flex-wrap min-w-0">{children}</div>
      {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
    </div>
  );
}

/**
 * Barra de seleção — SUBSTITUI a toolbar enquanto houver itens marcados, em
 * vez de aparecer empilhada abaixo dela. Duas barras simultâneas fazem a
 * tabela pular verticalmente a cada clique no checkbox.
 */
export function Cf2TabelaSelecao({
  quantidade, aoLimpar, children, className,
}: {
  quantidade: number;
  aoLimpar: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  if (quantidade === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-linha bg-superficie-alt", className)}>
      <div className="flex items-center gap-2">
        <span className="text-corpo font-medium text-tinta">
          {quantidade} {quantidade === 1 ? "selecionado" : "selecionados"}
        </span>
        <Button size="xs" variant="subtle" onClick={aoLimpar}>Limpar</Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

export function Cf2ThSelecao({
  todosMarcados, algunsMarcados, aoAlternar,
}: {
  todosMarcados: boolean;
  algunsMarcados: boolean;
  aoAlternar: () => void;
}) {
  return (
    <th scope="col" className="w-px pl-5 pr-2 bg-superficie">
      <Checkbox
        // "indeterminate" quando há seleção parcial: sem isso o checkbox do
        // cabeçalho mente, mostrando vazio com 3 de 10 itens marcados.
        checked={todosMarcados ? true : algunsMarcados ? "indeterminate" : false}
        onCheckedChange={aoAlternar}
        aria-label="Selecionar todos"
      />
    </th>
  );
}

export function Cf2TdSelecao({
  marcado, aoAlternar, rotulo,
}: {
  marcado: boolean;
  aoAlternar: () => void;
  rotulo: string;
}) {
  return (
    <td
      className="w-px pl-5 pr-2"
      // O clique no checkbox não pode disparar o clique da linha (que abre o
      // detalhe): marcar item abriria a tela do item.
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox checked={marcado} onCheckedChange={aoAlternar} aria-label={`Selecionar ${rotulo}`} />
    </td>
  );
}

/** Identidade: avatar + título e subtítulo. O par mais repetido do CRM. */
export function Cf2CelulaEntidade({
  avatar, titulo, subtitulo, className,
}: {
  avatar?: React.ReactNode;
  titulo: string;
  subtitulo?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      {avatar}
      <div className="min-w-0">
        <p className="text-item font-medium text-tinta truncate">{titulo}</p>
        {subtitulo && <p className="text-apoio text-tinta-fraca truncate">{subtitulo}</p>}
      </div>
    </div>
  );
}

export function Cf2TabelaPaginacao({
  pagina, porPagina, total, aoMudarPagina, className,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  aoMudarPagina: (p: number) => void;
  className?: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const de = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ate = Math.min(pagina * porPagina, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-linha", className)}>
      {/* Mostrar o intervalo, não só o número da página: "41–60 de 312"
          responde "quanto falta", que é a pergunta real de quem varre lista. */}
      <p className="text-apoio text-tinta-fraca">
        {de}–{ate} de {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="icon-sm" variant="outline" aria-label="Página anterior"
          disabled={pagina <= 1} onClick={() => aoMudarPagina(pagina - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="text-corpo text-tinta-suave px-2 tabular-nums">
          {pagina} / {paginas}
        </span>
        <Button
          size="icon-sm" variant="outline" aria-label="Próxima página"
          disabled={pagina >= paginas} onClick={() => aoMudarPagina(pagina + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
