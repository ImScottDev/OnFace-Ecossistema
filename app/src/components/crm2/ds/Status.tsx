import { cn } from "@/lib/utils/cn";

/**
 * Status do CRM (31/08).
 *
 * A primeira versão usava Badge com fundo colorido e caixa alta, e o Kauã
 * cortou: "esses status ficou péssimo, essas cores e estilo". O problema era
 * real — pastilha colorida em CADA linha faz a tabela virar arco-íris, e a
 * cor perde justamente a função de sinalizar. Numa lista de 50 negócios, 50
 * pastilhas coloridas não destacam nada.
 *
 * O desenho agora: PONTO colorido + texto em cor normal. O ponto carrega o
 * significado, o texto se lê como dado. A cor só toma conta do fundo quando
 * o estado é excepcional e precisa saltar (variante `forte`, para "Em risco"
 * e "Atrasado" — os que a pessoa tem que ver de longe).
 *
 * O vocabulário é fechado de propósito: sem isso "Ganho" vira verde numa tela
 * e cinza em outra, que é exatamente o que acontecia.
 */
export type TomStatus = "positivo" | "negativo" | "atencao" | "informativo" | "neutro";

const PONTO: Record<TomStatus, string> = {
  positivo: "bg-positivo",
  negativo: "bg-negativo",
  atencao: "bg-atencao",
  informativo: "bg-informativo",
  neutro: "bg-tinta-fraca",
};

const FORTE: Record<TomStatus, string> = {
  positivo: "bg-positivo-suave text-positivo-foreground",
  negativo: "bg-negativo-suave text-negativo-foreground",
  atencao: "bg-atencao-suave text-atencao-foreground",
  informativo: "bg-informativo-suave text-informativo-foreground",
  neutro: "bg-superficie-alt text-tinta-suave",
};

export function Cf2Status({
  tom = "neutro",
  forte = false,
  children,
  className,
}: {
  tom?: TomStatus;
  /** Preenche o fundo. Reserve para o que precisa saltar na varredura. */
  forte?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (forte) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-apoio font-medium whitespace-nowrap",
          FORTE[tom],
          className
        )}
      >
        <span className={cn("size-1.5 rounded-full shrink-0", PONTO[tom])} />
        {children}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-corpo text-tinta whitespace-nowrap", className)}>
      <span className={cn("size-1.5 rounded-full shrink-0", PONTO[tom])} />
      {children}
    </span>
  );
}

/** Vocabulário fechado de status de negócio — uma resposta só no produto. */
export const STATUS_NEGOCIO = {
  ganho: { rotulo: "Ganho", tom: "positivo" as TomStatus, forte: false },
  perdido: { rotulo: "Perdido", tom: "negativo" as TomStatus, forte: false },
  risco: { rotulo: "Em risco", tom: "atencao" as TomStatus, forte: true },
  novo: { rotulo: "Novo", tom: "informativo" as TomStatus, forte: false },
  aberto: { rotulo: "Em aberto", tom: "neutro" as TomStatus, forte: false },
  semContato: { rotulo: "Sem contato", tom: "neutro" as TomStatus, forte: false },
} as const;
