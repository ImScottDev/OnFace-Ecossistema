"use client";

/**
 * SegmentedControl e Timeline — dois padrões do Once UI que o Kauã apontou e
 * que o produto já precisava, adaptados aos nossos tokens (31/08).
 */
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * SegmentedControl — troca entre poucas visões MUTUAMENTE EXCLUSIVAS de um
 * mesmo conteúdo ("Meus / Do time / Todos", "Mês / Trimestre / Ano").
 *
 * Existe separado das Tabs de propósito: Tabs troca de SEÇÃO (conteúdos
 * diferentes), segmented troca de RECORTE (mesmo conteúdo, outro filtro).
 * Misturar os dois é o que faz uma tela ter três barras parecidas fazendo
 * coisas diferentes.
 *
 * O indicador é um bloco que desliza — sem isso, a troca é um pisca seco e a
 * pessoa perde de onde veio.
 */
export function Cf2SegmentedControl<T extends string>({
  opcoes,
  valor,
  aoMudar,
  fillWidth = false,
  className,
}: {
  opcoes: { valor: T; rotulo: string; icone?: React.ElementType }[];
  valor: T;
  aoMudar: (v: T) => void;
  fillWidth?: boolean;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicador, setIndicador] = React.useState<{ left: number; width: number } | null>(null);

  // Medição relativa ao CONTAINER, não offsetLeft (31/08 — com fillWidth o
  // offsetLeft do botão dava posição errada e o indicador saía do lugar).
  // O ResizeObserver observa o container: quando ele muda de largura, todos os
  // botões flex mudam junto e o indicador precisa remedir.
  React.useLayoutEffect(() => {
    const medir = () => {
      const cont = containerRef.current;
      const el = refs.current[valor];
      if (!cont || !el) return;
      const c = cont.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      setIndicador({ left: b.left - c.left, width: b.width });
    };
    medir();
    const cont = containerRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(medir);
    ro.observe(cont);
    // Fontes carregam depois do primeiro paint e mudam a largura do texto.
    document.fonts?.ready.then(medir).catch(() => {});
    return () => ro.disconnect();
  }, [valor, opcoes.length]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative p-1 rounded-control bg-superficie-alt",
        // Grid quando ocupa a largura toda: com flex os botões não encolhiam
        // e o último era cortado. Colunas iguais resolvem e ainda deixam os
        // segmentos com a mesma largura, que é o comportamento esperado.
        fillWidth ? "grid w-full" : "inline-flex items-center",
        className
      )}
      style={fillWidth ? { gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` } : undefined}
    >
      {indicador && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-chip bg-superficie shadow-repouso cf2-transicao pointer-events-none"
          style={{ left: indicador.left, width: indicador.width }}
        />
      )}
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        const Icone = o.icone;
        return (
          <button
            key={o.valor}
            ref={(el) => { refs.current[o.valor] = el; }}
            role="tab"
            type="button"
            aria-selected={ativo}
            onClick={() => aoMudar(o.valor)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 px-3 h-7 rounded-chip min-w-0",
              "text-corpo font-medium cf2-transicao",
              ativo ? "text-tinta" : "text-tinta-suave hover:text-tinta"
            )}
          >
            {Icone && <Icone className="size-3.5 shrink-0" />}
            <span className="truncate">{o.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Timeline — histórico de uma entidade (atividades do lead, etapas do
 * onboarding, mudanças de um negócio).
 *
 * A linha vertical é contínua e o marcador ancora no topo do item, não no
 * meio: com itens de alturas diferentes, marcador centralizado faz a linha
 * parecer torta. O último item não desenha a linha, senão ela "vaza" pra
 * baixo do conteúdo e sugere que falta algo.
 */
export type ItemTimeline = {
  id: string;
  titulo: string;
  descricao?: string;
  /** Rótulo curto e relativo: "hoje, 14:32", "26/08". */
  quando: string;
  /** Data/hora completa — vai no title, para o valor exato sob o cursor. */
  quandoCompleto?: string;
  /** Quem fez. Num CRM, "quem" é metade da informação de um histórico. */
  responsavel?: string;
  icone?: React.ElementType;
  tom?: "neutro" | "positivo" | "negativo" | "atencao" | "marca";
};

/* Ícone do marcador: cor MEDIDA contra o próprio fundo suave (31/08 — o
   ícone estava com o mesmo tom do fundo e sumia). Todos acima de 3:1, que é
   o mínimo do WCAG para elemento gráfico. `marca` usa o verde escuro, não a
   tinta da marca, porque tinta escura sobre verde-50 fica pesada demais. */
const TOM_MARCADOR: Record<NonNullable<ItemTimeline["tom"]>, string> = {
  neutro: "bg-superficie-alt text-tinta-suave border-linha",
  positivo: "bg-positivo-suave text-positivo-foreground border-positivo-weak",
  negativo: "bg-negativo-suave text-negativo-foreground border-negativo-weak",
  atencao: "bg-atencao-suave text-atencao-foreground border-atencao-weak",
  marca: "bg-marca-suave text-positivo-foreground border-marca-weak",
};

export function Cf2Timeline({ itens, className }: { itens: ItemTimeline[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {itens.map((item, i) => {
        const Icone = item.icone;
        const ultimo = i === itens.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!ultimo && (
              <span
                aria-hidden
                className="absolute left-[15px] top-8 bottom-1 w-px bg-linha"
              />
            )}
            <span
              className={cn(
                "relative z-10 shrink-0 size-8 rounded-full border grid place-items-center",
                TOM_MARCADOR[item.tom ?? "neutro"]
              )}
            >
              {Icone ? <Icone className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-item font-medium text-tinta min-w-0">{item.titulo}</p>
                {/* Data relativa à vista, exata no title: "26/08" responde
                    rápido, "26/08/2026 14:32" responde quando importa. */}
                <time
                  className="text-apoio text-tinta-fraca shrink-0 tabular-nums"
                  title={item.quandoCompleto}
                >
                  {item.quando}
                </time>
              </div>
              {item.descricao && (
                <p className="text-corpo text-tinta-suave mt-0.5">{item.descricao}</p>
              )}
              {item.responsavel && (
                <p className="text-apoio text-tinta-fraca mt-1">por {item.responsavel}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
