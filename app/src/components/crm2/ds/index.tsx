import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowRight, ChevronRight } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Cf2AvatarGrupo } from "@/components/crm2/ds/Avatar";

/**
 * DESIGN SYSTEM DO CRM2 — fonte única de verdade visual (30/08).
 *
 * POR QUE ISTO EXISTE: até aqui cada tela escrevia raio, padding e tamanho de
 * fonte na mão. O resultado inevitável foi drift — a Visão Geral de Vendas
 * saiu com card de 16px onde a Home usa 28px, título 15px onde a Home usa 14px,
 * etc. Valor repetido à mão diverge; valor importado, não.
 *
 * A REFERÊNCIA CANÔNICA É A TELA `/inicio`. Todos os números abaixo foram
 * extraídos dela, não inventados. Se um valor precisar mudar, muda AQUI e vale
 * pra todas as telas.
 *
 * REGRA PRA TELA NOVA: componha com estas primitivas. Não escreva
 * `rounded-[...]`, padding de card nem tamanho de fonte de KPI direto na tela.
 */

// ── Escalas canônicas ───────────────────────────────────────────────────

/** Raios. Card=28, hero=32, linha interna=20, ícone grande=14, pequeno=10. */
export const RAIO = {
  hero: "rounded-[32px]",
  card: "rounded-[28px]",
  linha: "rounded-[20px]",
  iconeGrande: "rounded-[14px]",
  iconePequeno: "rounded-[10px]",
  pilula: "rounded-full",
} as const;

/** Espaçamentos de composição. */
export const ESPACO = {
  /** Gap entre as seções de uma página. */
  pagina: "gap-6",
  /** Gap interno de uma seção. */
  secao: "gap-4",
  /** Gap entre cards de uma grade. */
  grade: "gap-3",
  /** Padding da faixa escura (hero / bloco de destaque). */
  faixa: "px-4 sm:px-6 pt-5 sm:pt-6 pb-6",
  /** Header de card claro. */
  cardHeader: "pt-4 px-5 pb-2",
  /** Corpo de card claro. */
  cardCorpo: "p-2.5 gap-2.5",
} as const;

/**
 * Tipografia. Cada entrada é `{ classe, estilo }` porque o letter-spacing do
 * desenho não tem utilitário Tailwind equivalente e precisa ir inline.
 */
export const TIPO = {
  /** Título de card claro — 14px, SEM bold. */
  tituloCard: { classe: "text-[14px]", estilo: { letterSpacing: "-0.5px" } },
  /** Rótulo de seção sobre faixa escura. */
  tituloSecao: { classe: "text-[15px]", estilo: { letterSpacing: "-0.61px" } },
  /** Rótulo de KPI (uppercase, bem pequeno). */
  rotuloKpi: { classe: "text-[9.5px] uppercase", estilo: { letterSpacing: "0.62px" } },
  /** Valor de KPI padrão. */
  valorKpi: {
    classe: "text-[18px] sm:text-[20px] font-semibold leading-none",
    estilo: { letterSpacing: "-0.7px", fontFamily: "var(--cf2-font-heading)" },
  },
  /** Valor grande (métrica de destaque dentro de faixa escura). */
  valorDestaque: {
    classe: "text-[28px] font-semibold leading-none",
    estilo: { letterSpacing: "-1.2px", fontFamily: "var(--cf2-font-heading)" },
  },
  /** Valor do KPI herói. */
  valorHero: {
    classe: "text-[38px] font-semibold leading-none",
    estilo: { letterSpacing: "-1.2px", fontFamily: "var(--cf2-font-heading)" },
  },
  /** Título de linha de lista. */
  itemTitulo: { classe: "text-[13.5px] font-medium", estilo: {} },
  /** Texto de apoio / subtítulo. */
  corpo: { classe: "text-[12px]", estilo: {} },
  /** Rodapé de KPI, legendas. */
  apoio: { classe: "text-[11px]", estilo: {} },
} as const;

/** Cores semânticas por tom (claro e escuro compartilham a mesma chave). */
export const TOM = {
  positivo: "var(--cf2-home-positive)",
  danger: "var(--cf2-home-danger)",
  warning: "var(--cf2-home-warning)",
  info: "var(--cf2-home-info)",
  lime: "var(--cf2-home-lime)",
  limeSuave: "var(--cf2-home-lime-soft)",
} as const;

const TOM_BG = {
  danger: "var(--cf2-home-danger-bg)",
  warning: "var(--cf2-home-warning-bg)",
  info: "var(--cf2-home-info-bg)",
  positivo: "var(--cf2-home-lime-bg)",
} as const;

/* Texto das pílulas coloridas. Vem em hex fixo, e não das variáveis de `TOM`,
   porque a pílula é uma ilha de fundo CLARO que pode estar dentro de um card
   escuro — onde `[data-cf2-superficie="escura"]` reescreve os tokens pros
   tons de alto brilho. Sem isto, o KPI de Vendas mostrava vermelho claro
   sobre rosa claro, 2.6:1. O fundo já é fixo pelo mesmo motivo. */
const TOM_FG_EM_PILULA = {
  danger: "#b91c1c",
  warning: "#b45309",
  info: "#2542a8",
  positivo: "#15803d",
} as const;

export const AVATAR_CORES = [
  "var(--cf2-avatar-1)", "var(--cf2-avatar-2)", "var(--cf2-avatar-3)",
  "var(--cf2-avatar-4)", "var(--cf2-avatar-5)",
];

// ── Superfícies ─────────────────────────────────────────────────────────

/** Faixa ESCURA de seção (hero e blocos de destaque). */
export function Cf2Faixa({
  hero = false, className = "", children, ...props
}: React.ComponentProps<"section"> & { hero?: boolean }) {
  return (
    <section
      className={`flex flex-col ${ESPACO.secao} ${ESPACO.faixa} ${hero ? RAIO.hero : RAIO.card} ${className}`}
      data-cf2-superficie="escura"
      style={{ background: "var(--cf2-home-hero-bg)" }}
      {...props}
    >
      {children}
    </section>
  );
}

/** Cabeçalho de faixa escura: título + subtítulo à esquerda, ações à direita. */
export function Cf2FaixaHeader({
  titulo, subtitulo, direita,
}: {
  titulo: string;
  subtitulo?: string;
  direita?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="flex flex-col gap-1 min-w-0">
        <p className={TIPO.tituloSecao.classe} style={{ ...TIPO.tituloSecao.estilo, color: "var(--cf2-home-text-strong)" }}>
          {titulo}
        </p>
        {subtitulo && (
          <p className={TIPO.corpo.classe} style={{ color: "var(--cf2-home-text-muted)" }}>{subtitulo}</p>
        )}
      </div>
      {direita}
    </div>
  );
}

/**
 * Card CLARO — a casca padrão de conteúdo do CRM2 (extraída da
 * `Cf2PrecisaAtencao` da Home). `link` renderiza o rodapé de navegação.
 */
export function Cf2Painel({
  titulo, icone, direita, link, corpoSemPadding = false, children,
}: {
  titulo: string;
  icone?: React.ReactNode;
  direita?: React.ReactNode;
  link?: { label: string; href: string };
  /** Pra conteúdo que gerencia o próprio padding (tabela, gráfico). */
  corpoSemPadding?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col ${RAIO.card} overflow-hidden h-full`}
      style={{ background: "#ffffff", border: "1px solid var(--cf2-home-panel-border)" }}
    >
      <div className={`flex items-center justify-between gap-3 ${ESPACO.cardHeader}`}>
        <div className="flex items-center gap-2 min-w-0">
          {icone && <span className="shrink-0" style={{ color: "var(--cf2-home-ink)" }}>{icone}</span>}
          <p
            className={`${TIPO.tituloCard.classe} truncate`}
            style={{ ...TIPO.tituloCard.estilo, color: "var(--cf2-home-ink)" }}
          >
            {titulo}
          </p>
        </div>
        {direita}
      </div>

      <div className={`flex flex-col flex-1 ${corpoSemPadding ? "gap-2.5" : ESPACO.cardCorpo}`}>{children}</div>

      {link && (
        <Link
          href={link.href}
          className="flex items-center justify-center gap-1.5 px-5 pb-4 pt-1 text-[12px] font-medium hover:underline"
          style={{ color: "var(--cf2-home-lime-deep)" }}
        >
          {link.label} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

/**
 * Estado vazio — usa o `empty` do shadcn/ui (não uma `<p>` centralizada
 * improvisada), então título, descrição e ícone têm hierarquia de verdade.
 */
export function Cf2Vazio({
  titulo, descricao, icone,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  icone?: React.ReactNode;
}) {
  return (
    <Empty className="flex-1 py-8">
      <EmptyHeader>
        {icone && <EmptyMedia variant="icon">{icone}</EmptyMedia>}
        <EmptyTitle className="text-[13px]">{titulo}</EmptyTitle>
        {descricao && <EmptyDescription className="text-[12px]">{descricao}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}

/** Divisória — reexporta o `separator` do shadcn com o nome do projeto. */
export { Separator as Cf2Divisoria };

// ── Métricas ────────────────────────────────────────────────────────────

/** Variação percentual (seta + número). `invertido` = subir é ruim. */
export function Cf2Tendencia({
  pct, invertido = false, sufixo,
}: {
  pct: number | null | undefined;
  invertido?: boolean;
  sufixo?: string;
}) {
  if (pct == null || !isFinite(pct)) return null;
  const bom = invertido ? pct <= 0 : pct >= 0;
  const Seta = pct >= 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className="flex items-center gap-[3px] text-[11px] whitespace-nowrap"
      style={{ color: bom ? TOM.positivo : TOM.danger }}
    >
      <Seta className="w-[11px] h-[11px]" />
      {Math.abs(pct).toFixed(0)}%{sufixo ? ` ${sufixo}` : ""}
    </span>
  );
}

/** Pílula de contagem/status. */
export function Cf2Pilula({
  children, tom, escuro = false,
}: {
  children: React.ReactNode;
  tom?: keyof typeof TOM_BG;
  escuro?: boolean;
}) {
  const fundo = tom ? TOM_BG[tom] : escuro ? "var(--cf2-home-dark-overlay)" : "var(--cf2-home-neutral-surface)";
  const cor = tom ? TOM_FG_EM_PILULA[tom] : escuro ? "var(--cf2-home-text-muted)" : "var(--cf2-home-ink-soft)";

  // Uma pílula com `tom` tem fundo de pastilha CLARA e pode estar dentro de um
  // card escuro, onde `[data-cf2-superficie="escura"]` reescreveu os tokens
  // pros tons de alto brilho. Ela reabre o contexto claro pra si e pra quem
  // vier dentro — o `Cf2Tendencia` aninhado saía em vermelho claro sobre rosa
  // claro (2.6:1) nos KPIs de Vendas. Vai como custom property inline, e não
  // como regra CSS de escopo, porque o build descarta seletores de atributo
  // que só declaram variáveis.
  const escopoClaro: React.CSSProperties = tom
    ? ({
        "--cf2-home-danger": "#b91c1c",
        "--cf2-home-warning": "#b45309",
        "--cf2-home-positive": "#15803d",
        "--cf2-home-positive-alt": "#047857",
        "--cf2-home-info": "#2542a8",
      } as React.CSSProperties)
    : {};

  return (
    <span
      className={`flex items-center gap-1.5 py-1 px-2.5 ${RAIO.pilula} text-[12px] font-medium shrink-0 whitespace-nowrap`}
      style={{ ...escopoClaro, background: fundo, color: cor }}
    >
      {children}
    </span>
  );
}

/** Caixa de ícone. `grande` = 36px/raio 14; padrão = 28px/raio 10. */
export function Cf2CaixaIcone({
  children, grande = false, fundo, className = "",
}: {
  children: React.ReactNode;
  grande?: boolean;
  fundo?: string;
  className?: string;
}) {
  return (
    <span
      className={`flex items-center justify-center shrink-0 ${
        grande ? `w-9 h-9 ${RAIO.iconeGrande}` : `w-7 h-7 ${RAIO.iconePequeno}`
      } ${className}`}
      style={{ background: fundo ?? "var(--cf2-home-dark-overlay)" }}
    >
      {children}
    </span>
  );
}

/** Card de KPI sobre fundo escuro. */
export function Cf2Kpi({
  rotulo, valor, apoio, icone, tendencia, progresso, href,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  icone?: React.ReactNode;
  tendencia?: number | null;
  /** 0–100 → barra de progresso. */
  progresso?: number | null;
  href?: string;
}) {
  const conteudo = (
    <>
      <div className="flex items-center justify-between gap-2">
        {icone && <Cf2CaixaIcone>{icone}</Cf2CaixaIcone>}
        <Cf2Tendencia pct={tendencia} />
      </div>
      <div className="flex flex-col gap-[3px] min-w-0">
        <p className={TIPO.rotuloKpi.classe} style={{ ...TIPO.rotuloKpi.estilo, color: "var(--cf2-home-text-muted)" }}>
          {rotulo}
        </p>
        <p
          className={`${TIPO.valorKpi.classe} truncate`}
          style={{ ...TIPO.valorKpi.estilo, color: "var(--cf2-home-text-strong)" }}
        >
          {valor}
        </p>
        {progresso != null && (
          <div className="h-1 w-full rounded-full overflow-hidden my-0.5" style={{ background: "var(--cf2-home-dark-overlay)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(progresso, 100)}%`, background: TOM.lime }} />
          </div>
        )}
        {apoio && (
          <p className={`${TIPO.apoio.classe} truncate`} style={{ color: "var(--cf2-home-text-muted)" }}>{apoio}</p>
        )}
      </div>
    </>
  );

  const classe = `flex flex-col gap-2.5 min-w-0 p-4 ${RAIO.card} transition-transform hover:-translate-y-0.5`;
  const estilo = { background: "var(--cf2-home-kpi-bg)" };

  return href
    ? <Link href={href} className={classe} style={estilo} data-cf2-superficie="escura">{conteudo}</Link>
    : <div className={classe} style={estilo} data-cf2-superficie="escura">{conteudo}</div>;
}

/** Célula de métrica dentro de card claro (bordered, raio de linha). */
export function Cf2Celula({
  valor, rotulo, tendencia, invertido, tom, nota, children,
}: {
  valor?: React.ReactNode;
  rotulo: string;
  tendencia?: number | null;
  invertido?: boolean;
  tom?: keyof typeof TOM;
  nota?: string;
  /** Substitui a linha de variação (ex: métrica indisponível). */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-[3px] p-3 ${RAIO.linha} min-w-0`}
      style={{ border: "1px solid var(--cf2-home-panel-border)" }}
    >
      {valor !== undefined && (
        <p
          className={`${TIPO.valorKpi.classe} truncate`}
          style={{ ...TIPO.valorKpi.estilo, color: tom ? TOM[tom] : "var(--cf2-home-ink)" }}
        >
          {valor}
        </p>
      )}
      <p className={`${TIPO.apoio.classe} leading-tight`} style={{ color: "var(--cf2-home-ink-soft)" }}>{rotulo}</p>
      {children ?? (nota
        ? <p className={`${TIPO.apoio.classe} font-medium`} style={{ color: TOM.danger }}>{nota}</p>
        : <Cf2Tendencia pct={tendencia} invertido={invertido} />)}
    </div>
  );
}

/** Linha de lista clicável (padrão de "Precisa de atenção"). */
export function Cf2LinhaLista({
  titulo, detalhe, tom, icone, href,
}: {
  titulo: string;
  detalhe?: React.ReactNode;
  tom: keyof typeof TOM_BG;
  icone: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3.5 p-3 ${RAIO.linha} transition-colors hover:bg-[var(--cf2-bg-surface-muted)]`}
    >
      <span className="w-1 h-9 rounded-full shrink-0" style={{ background: TOM[tom] }} />
      <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: TOM_BG[tom] }}>
        {icone}
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className={`${TIPO.itemTitulo.classe} truncate`} style={{ color: "var(--cf2-home-ink)" }}>{titulo}</span>
        {detalhe && (
          <span className={`${TIPO.corpo.classe} truncate pt-0.5`} style={{ color: "var(--cf2-home-ink-faint)" }}>
            {detalhe}
          </span>
        )}
      </span>
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-home-ink-faint)" }} />
    </Link>
  );
}

/** Rótulo + pilha de avatares (o grupo em si vem do shadcn, via Cf2AvatarGrupo). */
export function Cf2Avatares({ nomes, rotulo = "Equipe" }: { nomes: string[]; rotulo?: string }) {
  if (nomes.length === 0) return null;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className={TIPO.corpo.classe} style={{ color: "var(--cf2-home-text-muted)" }}>{rotulo}</span>
      <Cf2AvatarGrupo nomes={nomes} size="sm" />
    </div>
  );
}

/** Barra de progresso com legenda (usada em metas). */
export function Cf2Progresso({ pct, legenda, escuro = true }: { pct: number; legenda: string; escuro?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: escuro ? "var(--cf2-home-dark-overlay)" : "var(--cf2-home-neutral-surface)" }}
      >
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: TOM.lime }} />
      </div>
      <p className={TIPO.apoio.classe} style={{ color: escuro ? "var(--cf2-home-text-muted)" : "var(--cf2-home-ink-soft)" }}>
        {legenda}
      </p>
    </div>
  );
}
