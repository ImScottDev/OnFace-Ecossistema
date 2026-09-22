"use client";

import * as React from "react";
import {
  BuildingIcon, MailIcon, MoreHorizontalIcon, PhoneIcon, PlusIcon,
  SearchIcon, TrashIcon, UserPlusIcon, UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { CONTATOS_AMOSTRA, ROTULO_SITUACAO, type Contato, type Situacao } from "./dados";

/* Escrita segundo as regras da skill oficial do shadcn:
   - cor só por token semântico (`text-muted-foreground`, `text-destructive`),
     nunca `text-[var(--x)]` nem hex;
   - `className` só para layout;
   - nenhum arquivo CSS próprio;
   - ícone em Button leva `data-icon` e nenhuma classe de tamanho;
   - conjunto de 2 a 7 opções usa ToggleGroup, não Button com estado manual;
   - `cn()` para classe condicional;
   - Empty, Badge, Separator e Table da biblioteca, nada de div estilizada. */

/** Situação vira variante de Badge, não cor escrita na tela. */
const VARIANTE_SITUACAO: Record<Situacao, React.ComponentProps<typeof Badge>["variant"]> = {
  ativo: "secondary",
  novo: "default",
  "sem-dono": "outline",
  inativo: "outline",
};

const FILTROS: Array<{ valor: string; rotulo: string }> = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "sem-dono", rotulo: "Sem dono" },
  { valor: "novo", rotulo: "Novos" },
  { valor: "ativo", rotulo: "Ativos" },
];

function LinhaDetalhe({
  icone: Icone, rotulo, children,
}: {
  icone: React.ComponentType;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Icone />
        {rotulo}
      </span>
      <span className="truncate text-sm font-medium">{children}</span>
    </div>
  );
}

export function Lista({ contatos = CONTATOS_AMOSTRA }: { contatos?: Contato[] }) {
  const [filtro, setFiltro] = React.useState("todos");
  const [busca, setBusca] = React.useState("");
  const [selecionados, setSelecionados] = React.useState<string[]>([]);
  const [aberto, setAberto] = React.useState<Contato | null>(null);

  const visiveis = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      const passaFiltro =
        filtro === "todos" ||
        (filtro === "sem-dono" ? c.dono === null : c.situacao === filtro);
      const passaBusca =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.empresa.toLowerCase().includes(termo);
      return passaFiltro && passaBusca;
    });
  }, [contatos, filtro, busca]);

  const todosMarcados = visiveis.length > 0 && selecionados.length === visiveis.length;

  function alternarTodos() {
    setSelecionados(todosMarcados ? [] : visiveis.map((c) => c.id));
  }

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar pessoa ou empresa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </InputGroup>

        <ToggleGroup
          type="single"
          value={filtro}
          onValueChange={(v) => v && setFiltro(v)}
          variant="outline"
          size="sm"
        >
          {FILTROS.map((f) => (
            <ToggleGroupItem key={f.valor} value={f.valor} aria-label={f.rotulo}>
              {f.rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Button size="sm" className="ml-auto">
          <PlusIcon data-icon="inline-start" />
          Novo contato
        </Button>
      </div>

      {/* Barra de seleção: só existe quando há seleção, e diz o que vai
          acontecer com quantos. */}
      {selecionados.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2">
          <span className="text-sm font-medium tabular-nums">
            {selecionados.length} selecionados
          </span>
          <Separator orientation="vertical" className="h-4" />
          <Button variant="ghost" size="sm">
            <UserPlusIcon data-icon="inline-start" />
            Atribuir dono
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive">
            <TrashIcon data-icon="inline-start" />
            Descartar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelecionados([])}
          >
            Limpar
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        {visiveis.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum contato encontrado</EmptyTitle>
              <EmptyDescription>
                Nenhum contato corresponde à busca ou ao filtro selecionado.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusca("");
                  setFiltro("todos");
                }}
              >
                Limpar filtros
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={todosMarcados}
                    onCheckedChange={alternarTodos}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead className="hidden md:table-cell">Empresa</TableHead>
                <TableHead className="hidden lg:table-cell">Dono</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Última interação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {visiveis.map((c) => (
                <TableRow
                  key={c.id}
                  onClick={() => setAberto(c)}
                  className={cn("cursor-pointer", selecionados.includes(c.id) && "bg-muted/50")}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selecionados.includes(c.id)}
                      onCheckedChange={() => alternar(c.id)}
                      aria-label={`Selecionar ${c.nome}`}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{c.iniciais}</AvatarFallback>
                      </Avatar>
                      <div className="grid min-w-0">
                        <span className="truncate font-medium">{c.nome}</span>
                        <span className="truncate text-sm text-muted-foreground">{c.cargo}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <span className="truncate">{c.empresa}</span>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell">
                    {c.dono ?? <span className="text-muted-foreground">Não atribuído</span>}
                  </TableCell>

                  <TableCell>
                    <Badge variant={VARIANTE_SITUACAO[c.situacao]}>
                      {ROTULO_SITUACAO[c.situacao]}
                    </Badge>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-right text-muted-foreground">
                    {c.ultimaInteracao}
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${c.nome}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => setAberto(c)}>
                            <UsersIcon />
                            Abrir contato
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => toast.success(`Dono atribuído a ${c.nome}`)}
                          >
                            <UserPlusIcon />
                            Atribuir dono
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem variant="destructive">
                            <TrashIcon />
                            Descartar
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet open={aberto !== null} onOpenChange={(o) => !o && setAberto(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {aberto && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback>{aberto.iniciais}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0">
                    <SheetTitle className="truncate">{aberto.nome}</SheetTitle>
                    <SheetDescription className="truncate">{aberto.cargo}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
                <Separator />

                <div className="flex flex-col gap-3">
                  <LinhaDetalhe icone={BuildingIcon} rotulo="Empresa">
                    {aberto.empresa}
                  </LinhaDetalhe>
                  <LinhaDetalhe icone={MailIcon} rotulo="E-mail">
                    {aberto.email}
                  </LinhaDetalhe>
                  <LinhaDetalhe icone={PhoneIcon} rotulo="Telefone">
                    {aberto.telefone}
                  </LinhaDetalhe>
                  <LinhaDetalhe icone={UsersIcon} rotulo="Dono">
                    {aberto.dono ?? "Não atribuído"}
                  </LinhaDetalhe>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Situação</span>
                  <Badge variant={VARIANTE_SITUACAO[aberto.situacao]}>
                    {ROTULO_SITUACAO[aberto.situacao]}
                  </Badge>
                </div>

                {/* Contato sem dono não é erro, é fila: o estado vazio nomeia a
                    consequência em vez de só dizer que falta dado. */}
                {aberto.dono === null && (
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UserPlusIcon />
                      </EmptyMedia>
                      <EmptyTitle>Sem dono</EmptyTitle>
                      <EmptyDescription>
                        Contato sem responsável não entra em nenhuma fila de trabalho.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        size="sm"
                        onClick={() => toast.success(`Dono atribuído a ${aberto.nome}`)}
                      >
                        Atribuir agora
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
              </div>

              <SheetFooter>
                <Button>
                  <PhoneIcon data-icon="inline-start" />
                  Ligar
                </Button>
                <SheetClose asChild>
                  <Button variant="outline">Fechar</Button>
                </SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
