"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de cartão do CRM 2.0 sobre o `Card` do shadcn.
 *
 * Eram três `<div>` próprios com cor, borda, raio e sombra inline, enquanto o
 * `Card` do shadcn estava instalado no repo com ZERO importadores. São 74
 * chamadas de `Cf2Card` e 16 de `Cf2SectionHeader`; trocar o miolo migra
 * todas de uma vez.
 *
 * **Uma concessão declarada:** `Cf2Card` aceita `padding` como string livre, e
 * 20 das 74 chamadas passam a sua ("14px", "0px", "16px", "12px"). O `Card` do
 * shadcn traz `py-6` e delega o lado ao `CardContent`. Manter o prop obriga a
 * neutralizar o padding da biblioteca e reaplicá-lo inline, então por ora o
 * cartão é shadcn na SUPERFÍCIE (fundo, borda, raio, `data-slot`) e ainda não
 * no espaçamento. Tirar o prop é trabalho por chamada, não por componente, e
 * vem depois — está escrito aqui para não parecer esquecimento.
 */

export function Cf2Card({
  children,
  className = "",
  padding = "20px",
  highlight,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  /** Padding livre. Ver a concessão no topo do arquivo. */
  padding?: string;
  /** Borda com SIGNIFICADO, não decorativa. */
  highlight?: "success" | "danger";
  style?: React.CSSProperties;
}) {
  return (
    <Card
      className={cn(
        // `p-0` e `gap-0` desligam o ritmo do shadcn porque o padding vem do
        // prop. `shadow-none` porque a superfície do ONFACE é definida por
        // hairline, não por elevação.
        "gap-0 p-0 shadow-none",
        highlight === "success" && "border-[1.5px] border-[var(--cf2-accent-border)]",
        highlight === "danger" && "border-[1.5px] border-[var(--cf2-danger-border)]",
        className,
      )}
      style={{ padding, ...style }}
    >
      {children}
    </Card>
  );
}

/** Título de seção. `CardHeader` do shadcn traz grade própria e padding
 * lateral, que aqui atrapalha: este cabeçalho é usado solto, fora de cartão,
 * em 16 lugares. Usa `CardTitle`/`CardDescription`, que são só tipografia. */
export function Cf2SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <CardTitle className="text-lg">{title}</CardTitle>
      {subtitle ? <CardDescription className="text-[13px]">{subtitle}</CardDescription> : null}
    </div>
  );
}

/**
 * Micro-label em caixa alta acima de um título.
 *
 * O piso de qualidade do produto PROÍBE este padrão: rótulo em cima do título
 * quase sempre repete o que o título ou a trilha já dizem, e foi o que saiu do
 * índice de Ajustes, do `ModuloPendente`, do `AgentesWorkspace` e do catálogo
 * do Design System nesta mesma leva. Sobraram 4 usos.
 *
 * Fica aqui, sem alarde visual e sem cor de marca, para os 4 não quebrarem.
 * Não usar em tela nova: se o texto acrescenta algo, ele é subtítulo; se não
 * acrescenta, ele não existe.
 */
export function Cf2Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export { CardHeader };
