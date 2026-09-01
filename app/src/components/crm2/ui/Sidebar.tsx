"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Cf2Sheet, Cf2SheetContent } from "@/components/crm2/ui/Sheet";

/**
 * Primitivas de Sidebar (30/08) — estrutura do `shadcn/ui sidebar` portada à
 * mão pra convenção `Cf2*` do projeto, que não usa o shadcn CLI
 * (`components.json`). Pedido do Kauã: adotar essa estrutura de referência.
 *
 * O que isso resolve de verdade em relação ao sidebar antigo (que era uma
 * coluna fixa de 236px sempre visível): **colapso real** (ícones), **modo
 * mobile** (vira um Sheet lateral, em vez de comer 60% da tela de 390px, que
 * era o bloqueio de responsividade do sistema inteiro), **persistência** da
 * preferência em cookie e **atalho de teclado** (⌘B / Ctrl+B).
 *
 * Cores saem dos tokens `--cf2-chrome-*` (o chrome escuro do App Shell), não
 * dos tokens de tema do shadcn — o sidebar é escuro por contrato visual,
 * independente do tema da página.
 */

const COOKIE_NAME = "cf2_sidebar_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const LARGURA = "236px";
const LARGURA_ICONE = "64px";
const ATALHO = "b";

type ContextoSidebar = {
  state: "expanded" | "collapsed";
  /** Estado fixado (pin) pelo botão do usuário — persiste em cookie. */
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  /** Hover-to-peek (30/08): props pra colocar no wrapper da barra fixa —
   * expande transitoriamente no mouse-enter, recolhe no mouse-leave, sem
   * mexer no `open` fixado nem no layout (o espaçador continua na largura
   * do `open`, então o peek sobrepõe o conteúdo em vez de empurrar). */
  peekHandlers: { onMouseEnter: () => void; onMouseLeave: () => void };
};

const SidebarContext = React.createContext<ContextoSidebar | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar precisa estar dentro de <Cf2SidebarProvider>");
  return ctx;
}

/** Breakpoint de mobile — mesmo `md` do Tailwind usado no resto do projeto. */
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return !!isMobile;
}

export function Cf2SidebarProvider({
  defaultOpen = false, className, style, children, ...props
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [open, _setOpen] = React.useState(defaultOpen);
  // Transitório, não persistido — é só o "espiar" do hover.
  const [peeking, setPeeking] = React.useState(false);

  const setOpen = React.useCallback((value: boolean) => {
    _setOpen(value);
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}`;
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((v) => !v);
    else setOpen(!open);
  }, [isMobile, open, setOpen]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ATALHO && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const peekHandlers = React.useMemo(
    () => ({ onMouseEnter: () => setPeeking(true), onMouseLeave: () => setPeeking(false) }),
    [],
  );

  const valor = React.useMemo<ContextoSidebar>(
    () => ({
      state: open || peeking ? "expanded" : "collapsed",
      open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, peekHandlers,
    }),
    [open, peeking, setOpen, isMobile, openMobile, toggleSidebar, peekHandlers],
  );

  return (
    <SidebarContext.Provider value={valor}>
      <div
        data-slot="sidebar-wrapper"
        className={cn("flex h-dvh w-full overflow-hidden", className)}
        style={{ "--cf2-sidebar-w": LARGURA, "--cf2-sidebar-w-icon": LARGURA_ICONE, ...style } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Cf2Sidebar({ className, children, ...props }: React.ComponentProps<"div">) {
  const { isMobile, state, openMobile, setOpenMobile, peekHandlers } = useSidebar();

  // Mobile: vira painel deslizante em vez de coluna fixa.
  if (isMobile) {
    return (
      <Cf2Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <Cf2SheetContent
          side="left"
          className="w-[var(--cf2-sidebar-w)] p-0 [&>button]:hidden"
          style={{ background: "var(--cf2-chrome-bg)", border: "none" }}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </Cf2SheetContent>
      </Cf2Sheet>
    );
  }

  return (
    <div
      className="group peer hidden md:block shrink-0"
      data-state={state}
      data-collapsible={state === "collapsed" ? "icon" : ""}
    >
      {/* Espaçador: segue o `state` (fixado OU espiando), então o conteúdo da
          página acompanha o hover — a barra nunca passa por cima, ela empurra.
          O conteúdo fica "encaixado" ao lado da barra em qualquer estado. */}
      <div
        className="relative bg-transparent transition-[width] duration-200 ease-linear"
        style={{ width: state === "collapsed" ? LARGURA_ICONE : LARGURA }}
      />
      <div
        className={cn("fixed inset-y-0 left-0 z-20 hidden md:flex transition-[width] duration-200 ease-linear", className)}
        style={{
          width: state === "collapsed" ? LARGURA_ICONE : LARGURA,
          background: "var(--cf2-chrome-bg)",
        }}
        onMouseEnter={peekHandlers.onMouseEnter}
        onMouseLeave={peekHandlers.onMouseLeave}
        {...props}
      >
        <div className="flex h-full w-full flex-col">{children}</div>
      </div>
    </div>
  );
}

export function Cf2SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      aria-label="Alternar menu lateral"
      title="Alternar menu lateral (⌘B)"
      onClick={(e) => { onClick?.(e); toggleSidebar(); }}
      className={cn("inline-flex items-center justify-center size-8 rounded-lg transition-colors cursor-pointer", className)}
      style={{ color: "var(--cf2-chrome-text-secondary)" }}
      {...props}
    >
      <PanelLeft className="size-4" />
    </button>
  );
}

export function Cf2SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-3 shrink-0", className)} {...props} />;
}
export function Cf2SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-3 mt-auto shrink-0", className)} {...props} />;
}
export function Cf2SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden cf2-hide-scrollbar px-2", className)}
      {...props}
    />
  );
}
export function Cf2SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("relative flex w-full min-w-0 flex-col", className)} {...props} />;
}

export function Cf2SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  const { state, isMobile } = useSidebar();
  // No mobile a barra é um painel sobreposto em largura cheia: o estado
  // "collapsed" do desktop não vale ali, senão o menu abre só com ícones.
  if (state === "collapsed" && !isMobile) return null;
  return (
    <div
      className={cn("px-2 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider", className)}
      style={{ color: "var(--cf2-chrome-text-secondary)" }}
      {...props}
    />
  );
}

export function Cf2SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex w-full min-w-0 flex-col gap-0.5", className)} {...props} />;
}
export function Cf2SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("group/menu-item relative", className)} {...props} />;
}

const menuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2.5 overflow-hidden rounded-lg text-left outline-none transition-colors cursor-pointer disabled:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      size: {
        default: "h-9 px-2.5 text-[13px]",
        sm: "h-8 px-2.5 text-[12px]",
      },
    },
    defaultVariants: { size: "default" },
  },
);

/**
 * Item de menu. `isActive` pinta com o accent da marca; quando o sidebar
 * está colapsado o label é escondido por CSS (não desmontado), pra transição
 * não piscar o conteúdo.
 */
export function Cf2SidebarMenuButton({
  asChild, isActive = false, destaque = false, size, className, style, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof menuButtonVariants> & {
  asChild?: boolean; isActive?: boolean; destaque?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  const { state, isMobile } = useSidebar();
  const colapsado = state === "collapsed" && !isMobile;
  const cor = isActive
    ? "var(--cf2-text-on-accent)"
    : destaque
      ? "var(--cf2-accent)"
      : "var(--cf2-chrome-text-secondary)";
  return (
    <Comp
      data-active={isActive}
      data-collapsed={colapsado}
      className={cn(
        menuButtonVariants({ size }),
        // Esconde só o que está marcado como rótulo — o ícone também é um
        // <span> (por causa do badge de área legada posicionado sobre ele),
        // então um seletor genérico de filho apagaria os dois.
        colapsado && "justify-center px-0 [&_[data-sb-label]]:hidden",
        !isActive && "hover:bg-[var(--cf2-chrome-surface-active)]",
        className,
      )}
      style={{ background: isActive ? "var(--cf2-accent)" : undefined, color: cor, ...style }}
      {...props}
    />
  );
}

export function Cf2SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  const { state, isMobile } = useSidebar();
  if (state === "collapsed" && !isMobile) return null;
  return (
    <ul
      className={cn("ml-[18px] flex min-w-0 flex-col gap-0.5 border-l pl-2 py-0.5", className)}
      style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}
      {...props}
    />
  );
}

export function Cf2SidebarMenuSubButton({
  asChild, isActive = false, className, style, ...props
}: React.ComponentProps<"a"> & { asChild?: boolean; isActive?: boolean }) {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      data-active={isActive}
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-[12px] outline-none transition-colors cursor-pointer",
        !isActive && "hover:bg-[var(--cf2-chrome-surface-active)]",
        className,
      )}
      style={{
        background: isActive ? "var(--cf2-chrome-surface-active)" : undefined,
        color: isActive ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)",
        fontWeight: isActive ? 600 : 400,
        ...style,
      }}
      {...props}
    />
  );
}
