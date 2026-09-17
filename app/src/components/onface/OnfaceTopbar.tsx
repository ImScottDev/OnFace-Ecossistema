"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, Bell, ChevronDown, CreditCard, LogOut, Menu, Search,
  Settings, Settings2, Users,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// O menu de perfil continua no Radix: ele é menu de ação, abre por clique e
// se beneficia do foco aprisionado. Só a navegação saiu.
import { Cf2NotificationBell } from "@/components/crm2/NotificationBell";
import {
  MENU_ONFACE, isOnfaceChildActive, isOnfaceNavActive, normalizarPathnameOnface,
  type OnfaceNavItem,
} from "./navigation";

/** Ramo do menu: um destino e, quando tiver, os que vivem dentro dele.
 *
 * A árvore oficial tem três níveis (Operação → Pós-vendas → Implantação →
 * PABX). Os níveis internos ficam dentro do mesmo painel, indentados, em vez
 * de abrirem um flyout lateral: o painel já é o lugar onde a pessoa está
 * olhando, e cada flyout aninhado é mais uma chance de o ponteiro escapar no
 * caminho. */
function RamoMenu({ item, pathname, profundidade, fechar }: {
  item: OnfaceNavItem;
  pathname: string;
  profundidade: number;
  fechar: () => void;
}) {
  const Icon = item.icon;
  const ativo = isOnfaceChildActive(item, pathname);

  const link = (
    <Link
      role="menuitem"
      href={item.href}
      data-nivel={profundidade}
      data-ramo={item.children?.length ? "true" : undefined}
      aria-current={ativo ? "page" : undefined}
      onClick={fechar}
    >
      <Icon aria-hidden />
      {item.label}
    </Link>
  );

  if (!item.children?.length) return link;

  return (
    <div className="onface-menu-ramo" data-nivel={profundidade}>
      {link}
      {item.children.map((filho) => (
        <RamoMenu
          key={filho.href}
          item={filho}
          pathname={pathname}
          profundidade={profundidade + 1}
          fechar={fechar}
        />
      ))}
    </div>
  );
}

/** Uma área macro do menu.
 *
 * Toda área é clicável e leva à própria visão geral, inclusive as que têm
 * destinos internos: o submenu é atalho, não o único caminho. Por isso o menu
 * abre no hover e o clique navega.
 *
 * O submenu é ancorado no próprio item, sem portal e sem o DropdownMenu do
 * Radix. O motivo é concreto: o Radix gera `id` por `useId`, e a contagem
 * divergia entre servidor e cliente, o que fazia o React acusar hidratação a
 * cada carga. Um menu de navegação não precisa de portal nem de foco
 * aprisionado; precisa abrir, fechar e deixar clicar. */
function MacroItem({ item, pathname }: { item: OnfaceNavItem; pathname: string }) {
  const active = isOnfaceNavActive(item, pathname);
  const Icon = item.icon;
  const [aberto, setAberto] = useState(false);
  // O ponteiro atravessa um vão entre o item e o menu; fechar na hora faria o
  // menu piscar no caminho.
  const fechamento = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarFechamento = () => {
    if (fechamento.current) {
      clearTimeout(fechamento.current);
      fechamento.current = null;
    }
  };
  const abrir = () => { cancelarFechamento(); setAberto(true); };
  const agendarFechamento = () => {
    cancelarFechamento();
    fechamento.current = setTimeout(() => setAberto(false), 140);
  };

  useEffect(() => cancelarFechamento, []);

  if (!item.children?.length) {
    return (
      <Link
        className="onface-nav-item"
        data-active={active}
        href={item.href}
        title={item.label}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="onface-nav-icon" aria-hidden />
        <span className="onface-nav-label">{item.label}</span>
      </Link>
    );
  }

  return (
    <div
      className="onface-nav-anchor"
      onMouseEnter={abrir}
      onMouseLeave={agendarFechamento}
      onKeyDown={(evento) => { if (evento.key === "Escape") setAberto(false); }}
    >
      <Link
        className="onface-nav-item"
        data-active={active}
        data-state={aberto ? "open" : "closed"}
        href={item.href}
        title={item.label}
        aria-current={active ? "page" : undefined}
        aria-expanded={aberto}
        onFocus={abrir}
        onKeyDown={(evento) => {
          if (evento.key === "ArrowDown") {
            evento.preventDefault();
            setAberto(true);
          }
        }}
      >
        <Icon className="onface-nav-icon" aria-hidden />
        <span className="onface-nav-label">{item.label}</span>
        <ChevronDown className="onface-nav-chevron" aria-hidden />
      </Link>

      {aberto ? (
        <div className="onface-menu onface-menu-ancorado" role="menu" aria-label={item.label}>
          <p className="onface-menu-label">{item.label}</p>
          {item.children.map((child) => (
            <RamoMenu
              key={child.href}
              item={child}
              pathname={pathname}
              profundidade={0}
              fechar={() => setAberto(false)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Mesmo ramo da árvore, na folha mobile. A indentação vem do nível, então
 * três níveis continuam legíveis sem nenhum menu que abre por cima de outro
 * numa tela de telefone. */
function RamoSheet({ item, pathname, profundidade }: {
  item: OnfaceNavItem;
  pathname: string;
  profundidade: number;
}) {
  const Icon = item.icon;
  const ativo = isOnfaceChildActive(item, pathname);
  return (
    <>
      <SheetClose asChild>
        <Link
          className="onface-sheet-link onface-sheet-child"
          data-active={ativo}
          data-nivel={profundidade}
          href={item.href}
          aria-current={ativo ? "page" : undefined}
        >
          <Icon aria-hidden />
          {item.label}
        </Link>
      </SheetClose>
      {item.children?.map((filho) => (
        <RamoSheet key={filho.href} item={filho} pathname={pathname} profundidade={profundidade + 1} />
      ))}
    </>
  );
}

export function OnfaceTopbar() {
  const pathname = usePathname();
  const activePathname = normalizarPathnameOnface(pathname);
  const { data: session } = useSession();
  const name = session?.user?.name || "Usuário";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const openSearch = () => window.dispatchEvent(new CustomEvent("open-command-palette"));

  return (
    <header className="onface-topbar">
      <div className="onface-topbar-inner">
        <Sheet>
          <SheetTrigger className="onface-utility onface-burger" aria-label="Abrir navegação">
            <Menu aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="onface-sheet" showCloseButton>
            <div className="onface-sheet-head">
              <div>
                <SheetTitle className="onface-sheet-title">Navegação</SheetTitle>
                <SheetDescription className="onface-sheet-copy">
                  {name} · Administrador
                </SheetDescription>
              </div>
            </div>
            <nav className="onface-sheet-nav" aria-label="Navegação principal">
              {MENU_ONFACE.map((item) => {
                const Icon = item.icon;
                const active = isOnfaceNavActive(item, activePathname);
                return (
                  <div className="onface-sheet-group" key={item.href}>
                    <SheetClose asChild>
                      <Link
                        className="onface-sheet-link"
                        data-active={active}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon aria-hidden />
                        {item.label}
                      </Link>
                    </SheetClose>
                    {item.children?.map((child) => (
                      <RamoSheet key={child.href} item={child} pathname={activePathname} profundidade={1} />
                    ))}
                  </div>
                );
              })}
            </nav>
            <div className="onface-sheet-foot">
              <SheetClose asChild>
                <Link className="onface-sheet-link" href="/ajustes">
                  <Settings2 aria-hidden />
                  Ajustes
                </Link>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/inicio" className="onface-brand" aria-label="ONFACE, ir para início">
          {/* Official negative lockup. */}
          <img className="onface-brand-lockup" src="/onface/onface-lockup-negativa.svg" alt="ONFACE" />
          <span className="onface-brand-rule" aria-hidden />
          <span className="onface-brand-descriptor">
            Business
            <br />
            Operating System
          </span>
        </Link>

        <nav className="onface-nav" aria-label="Navegação principal">
          {MENU_ONFACE.map((item) => (
            <MacroItem key={item.href} item={item} pathname={activePathname} />
          ))}
        </nav>

        <div className="onface-actions">
          {/* Search names its action and shows its shortcut instead of hiding
              behind an icon; it collapses to a circle when width is scarce. */}
          <button type="button" className="onface-search" onClick={openSearch} aria-label="Buscar no CRM">
            <Search aria-hidden />
            <span className="onface-search-label">Buscar</span>
            <kbd className="onface-search-kbd" aria-hidden>⌘K</kbd>
          </button>

          <Cf2NotificationBell variant="onface" />

          {/* `modal={false}`: no modo modal o Radix trava o scroll do body e
              compensa a barra, o que faz a página inteira deslocar ao abrir. */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="onface-utility" data-utility="settings" aria-label="Abrir ajustes">
              <Settings aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="onface-menu">
              <DropdownMenuLabel className="onface-menu-label">Ajustes</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/ajustes"><Settings2 aria-hidden />Visão geral</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ajustes/membros"><Users aria-hidden />Membros</Link>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><CreditCard aria-hidden />Administração</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="onface-menu">
                    <DropdownMenuItem asChild>
                      <Link href="/ajustes/integracoes">Integrações</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/design">Design system</Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="onface-rule" aria-hidden />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="onface-profile" aria-label={`Abrir menu de ${name}`}>
              <span className="onface-avatar" aria-hidden>{initials}</span>
              <span className="onface-profile-meta">
                <strong>{name}</strong>
                <small>Administrador</small>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="onface-menu onface-menu-profile">
              <div className="onface-menu-profile-header">
                <span className="onface-avatar" aria-hidden>{initials}</span>
                <span>
                  <strong>{name}</strong>
                  <small>Administrador</small>
                </span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/perfil"><BadgeCheck aria-hidden />Meu perfil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ajustes"><Settings2 aria-hidden />Preferências</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ajustes"><Bell aria-hidden />Notificações</Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  void signOut({ callbackUrl: "/login" });
                }}
              >
                <LogOut aria-hidden />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
