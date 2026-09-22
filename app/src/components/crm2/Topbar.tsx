import Link from "next/link";
import { Plus } from "lucide-react";
import { PaginaCabecalho } from "@/components/onface/shell/Pagina";

/**
 * Cabeçalho de página do CRM 2.0 — agora um adaptador sobre `PaginaCabecalho`.
 *
 * O componente já vinha encolhendo: em 18/09 saíram daqui o trigger da barra
 * lateral, a busca ⌘K e o sino, que passaram a viver na casca. Sobrou título,
 * contexto e ações — que é exatamente o que `PaginaCabecalho` faz.
 *
 * Manter duas implementações da mesma coisa significava duas tipografias, dois
 * espaçamentos e dois jeitos de posicionar a ação primária, em 26 telas contra
 * 5. Em vez de migrar as 26 uma a uma, este arquivo passa a delegar: cada
 * página continua chamando `<Cf2Topbar title=... actions=... />` e recebe o
 * padrão novo.
 *
 * O que muda de verdade na tela:
 *
 * - **O hero de 28px sai.** Duas páginas ainda o usavam (sem `compactTitle`),
 *   com saudação e data. Título de 28px dentro de software operacional é hero,
 *   e a trilha da topbar já diz onde a pessoa está.
 * - **`variant="dark"` sai.** Nenhuma página passa mais: era do hero escuro da
 *   Home antiga, que deixou de existir quando `/inicio` virou a Visão Geral.
 * - **A tipografia do título vira a mesma das telas de vendas**, em vez de
 *   15px com `--cf2-font-heading`.
 *
 * `orgNome` continua na assinatura e continua sendo o fallback do título,
 * para não tocar em 26 chamadas por causa de um parâmetro.
 */
export function Cf2Topbar({
  orgNome,
  title,
  subtitle,
  ctaLabel = "Novo negócio",
  ctaHref = "/negocios/novo",
  actions,
  compact = false,
}: {
  orgNome: string;
  /** Aceita nó, e não só string: `/ajustes` passa o próprio seletor de seção
   * no lugar do título. */
  title?: React.ReactNode;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Substitui o CTA padrão. `actions={null}` remove o CTA; ausente mantém o
   * "Novo negócio". A checagem é por `undefined` porque um Fragment vazio
   * vindo de Server Component chega como `null` e cairia no fallback. */
  actions?: React.ReactNode;
  /** Workspace de detalhe que desenha o próprio cabeçalho abaixo: só as ações. */
  compact?: boolean;
  /** Aceito e ignorado: todo cabeçalho é compacto agora. Fica na assinatura
   * para as 24 chamadas que ainda o passam não quebrarem. */
  compactTitle?: boolean;
  /** Aceito e ignorado: nenhuma página passa mais `dark`. */
  variant?: "light" | "dark";
}) {
  const acoes =
    actions !== undefined ? (
      actions
    ) : (
      <Link
        href={ctaHref}
        aria-label={ctaLabel}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[13px] font-semibold transition-[background-color] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
          outlineColor: "var(--ring)",
        }}
      >
        <Plus className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{ctaLabel}</span>
      </Link>
    );

  // Detalhe que desenha o próprio título: só a faixa de ações, alinhada à
  // direita como estava.
  if (compact) {
    return <div className="flex w-full items-center justify-end gap-2">{acoes}</div>;
  }

  // Título que não é texto (o seletor de seção de /ajustes) não cabe no `h1`
  // do cabeçalho: HTML inválido e leitor de tela confuso. Vai solto, com a
  // mesma linha de ações ao lado.
  if (title !== undefined && title !== null && typeof title !== "string") {
    return (
      <div className="mb-3.5 flex w-full items-start justify-between gap-4">
        {title}
        <div className="flex shrink-0 items-center gap-2">{acoes}</div>
      </div>
    );
  }

  return (
    <PaginaCabecalho
      titulo={(title as string | undefined) ?? orgNome}
      descricao={subtitle}
      acoes={acoes}
    />
  );
}
