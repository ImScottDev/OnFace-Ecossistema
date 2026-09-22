"use client";

import * as React from "react";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCorners,
  useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Building2, CalendarClock, Mail, Phone, Plus, Search, SlidersHorizontal, User } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";

import { CartaoArrastavel, ConteudoCartao, motivoDeAtencao } from "./Cartao";
import { ROTULO_ETAPA, formatarMoeda, type Coluna, type Etapa, type Oportunidade } from "./dados";

const FILTROS = ["Sem próxima ação", "Parados 14d+", "Minhas"] as const;

function ColunaKanban({
  coluna, fatia, aoAbrir,
}: {
  coluna: Coluna;
  fatia: number;
  aoAbrir: (o: Oportunidade) => void;
}) {
  // A lista inteira é zona de soltura, não só os cartões: soltar no espaço
  // vazio abaixo do último precisa funcionar, senão etapa vazia não recebe.
  const { setNodeRef, isOver } = useDroppable({ id: coluna.etapa });
  const restantes = coluna.total - coluna.itens.length;
  const pct = Math.round(fatia * 100);

  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-2.5" aria-label={ROTULO_ETAPA[coluna.etapa]}>
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold tracking-tight text-[var(--tinta-forte)]">
            {ROTULO_ETAPA[coluna.etapa]}
          </h2>
          <Badge variant="secondary" className="shrink-0 tabular-nums">{coluna.total}</Badge>
          <span className="ml-auto shrink-0 text-xs font-medium tabular-nums text-[var(--tinta-media)]">
            {formatarMoeda(coluna.valorTotal)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1 bg-[var(--muted)]" />
          <span className="shrink-0 text-xs tabular-nums text-[var(--tinta-fraca)]">{pct}%</span>
        </div>
      </header>

      <div ref={setNodeRef} className="estudio-coluna-lista" data-recebendo={isOver || undefined}>
        <SortableContext items={coluna.itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {coluna.itens.length === 0 ? (
            <Empty className="border border-dashed border-[var(--fio)] p-4">
              <EmptyHeader>
                <EmptyTitle className="text-xs">Nada aqui</EmptyTitle>
                <EmptyDescription className="text-xs">
                  Arraste uma oportunidade para esta etapa.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            coluna.itens.map((item) => (
              <CartaoArrastavel key={item.id} item={item} aoAbrir={() => aoAbrir(item)} />
            ))
          )}
        </SortableContext>

        {restantes > 0 && (
          <Button variant="ghost" size="sm" className="shrink-0 text-xs tabular-nums text-[var(--tinta-fraca)]">
            Mais {restantes}
          </Button>
        )}
      </div>
    </section>
  );
}

function LinhaDetalhe({ icone: Icone, rotulo, valor }: { icone: typeof User; rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--tinta-fraca)]">
        <Icone className="size-3.5" aria-hidden />
        {rotulo}
      </span>
      <span className="truncate text-sm font-medium tabular-nums text-[var(--tinta-forte)]">{valor}</span>
    </div>
  );
}

export function Quadro({ colunas: iniciais }: { colunas: Coluna[] }) {
  const [colunas, setColunas] = React.useState(iniciais);
  const [aberta, setAberta] = React.useState<Oportunidade | null>(null);
  const [arrastando, setArrastando] = React.useState<Oportunidade | null>(null);
  const [ativos, setAtivos] = React.useState<string[]>([]);

  // Limiar de 6px antes de virar arrasto: sem ele todo clique no cartão vira um
  // micro-arrasto e o painel de detalhe nunca abre.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalAberto = colunas.reduce((s, c) => s + c.valorTotal, 0) || 1;

  function etapaDe(id: string): Etapa | null {
    const col = colunas.find((c) => c.itens.some((i) => i.id === id));
    if (col) return col.etapa;
    return colunas.some((c) => c.etapa === id) ? (id as Etapa) : null;
  }

  function aoSoltar(e: DragEndEvent) {
    setArrastando(null);
    const { active, over } = e;
    if (!over) return;

    const origem = etapaDe(String(active.id));
    const destino = etapaDe(String(over.id));
    if (!origem || !destino || origem === destino) return;

    const item = colunas.find((c) => c.etapa === origem)?.itens.find((i) => i.id === active.id);
    if (!item) return;

    // Total e valor da etapa acompanham o movimento: deixar o cabeçalho parado
    // enquanto o cartão muda de coluna faz a tela mentir bem na hora em que a
    // pessoa está olhando para ela.
    setColunas((atual) =>
      atual.map((c) => {
        if (c.etapa === origem)
          return {
            ...c,
            itens: c.itens.filter((i) => i.id !== item.id),
            total: c.total - 1,
            valorTotal: c.valorTotal - (item.valor ?? 0),
          };
        if (c.etapa === destino)
          return {
            ...c,
            itens: [item, ...c.itens],
            total: c.total + 1,
            valorTotal: c.valorTotal + (item.valor ?? 0),
          };
        return c;
      }),
    );

    toast(`${item.empresa} foi para ${ROTULO_ETAPA[destino]}`, {
      description: "No produto isto passa pelo motor de Vendas, que valida o gate da etapa.",
    });
  }

  const alternar = (f: string) =>
    setAtivos((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]));

  return (
    <div className="estudio-entrada estudio-quadro flex w-full flex-col gap-3">
      {/* Filtros sempre visíveis: numa tela de operação diária o estado do
          filtro é parte do que a pessoa lê, não algo a descobrir num menu. */}
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 min-w-0 flex-1 border-[var(--fio)] bg-transparent shadow-none sm:max-w-[16rem]">
          <InputGroupAddon>
            <Search className="text-[var(--tinta-fraca)]" />
          </InputGroupAddon>
          <InputGroupInput placeholder="Buscar empresa" className="text-sm placeholder:text-[var(--tinta-fraca)]" />
        </InputGroup>

        <ButtonGroup className="shrink-0">
          {FILTROS.map((f) => (
            <Toggle
              key={f}
              size="sm"
              pressed={ativos.includes(f)}
              onPressedChange={() => alternar(f)}
              className="estudio-filtro h-8 border border-[var(--fio)] px-2.5 text-xs"
            >
              {f}
            </Toggle>
          ))}
        </ButtonGroup>

        <Button variant="ghost" size="sm" className="shrink-0 text-[var(--tinta-media)]">
          <SlidersHorizontal />
          Mais filtros
        </Button>

        <Button size="sm" className="ml-auto shrink-0 shadow-none">
          <Plus />
          Nova oportunidade
        </Button>
      </div>

      <DndContext
        // `id` explícito: sem ele o dnd-kit cai no `useId()` do React para o
        // `aria-describedby` de cada item, e o valor diverge entre servidor e
        // cliente, derrubando a hidratação de todos os cartões.
        id="quadro-pipeline"
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setArrastando((e.active.data.current?.item as Oportunidade) ?? null)}
        onDragEnd={aoSoltar}
        onDragCancel={() => setArrastando(null)}
      >
        <div className="estudio-trilho">
          {colunas.map((coluna) => (
            <ColunaKanban
              key={coluna.etapa}
              coluna={coluna}
              fatia={coluna.valorTotal / totalAberto}
              aoAbrir={setAberta}
            />
          ))}
        </div>

        {/* O cartão arrastado segue o ponteiro numa camada própria: é o que faz
            o gesto parecer que a pessoa pegou o cartão, e não que empurrou uma
            lista. */}
        <DragOverlay dropAnimation={null}>
          {arrastando && (
            <div className="estudio-cartao estudio-cartao-voando">
              <ConteudoCartao item={arrastando} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Sheet open={aberta !== null} onOpenChange={(o) => !o && setAberta(null)}>
        <SheetContent side="right" className="estudio-portal w-full gap-0 sm:max-w-md">
          {aberta && (
            <>
              <SheetHeader className="gap-1.5">
                <span className="text-xs text-[var(--tinta-fraca)]">{aberta.familia}</span>
                <SheetTitle className="text-base leading-snug">{aberta.empresa}</SheetTitle>
                <SheetDescription className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--tinta-forte)]">
                  {formatarMoeda(aberta.valor)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
                <Separator className="bg-[var(--fio)]" />

                {/* A segunda camada, que saiu do cartão para o olho descansar
                    na coluna. */}
                <div className="flex flex-col gap-2.5">
                  <LinhaDetalhe icone={User} rotulo="Responsável" valor={aberta.responsavel} />
                  <LinhaDetalhe icone={CalendarClock} rotulo="Nesta etapa há" valor={`${aberta.diasNaEtapa} dias`} />
                  <LinhaDetalhe icone={Building2} rotulo="Família" valor={aberta.familia} />
                </div>

                <Separator className="bg-[var(--fio)]" />

                <div className="flex flex-col gap-1.5">
                  <span className="estudio-rotulo">Próxima ação</span>
                  {aberta.proximoPasso ? (
                    <p className="text-sm text-[var(--tinta-media)]">{aberta.proximoPasso}</p>
                  ) : (
                    <Empty className="border border-dashed border-[var(--fio)] p-4">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
                        <EmptyTitle className="text-sm">Sem próxima ação</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          {motivoDeAtencao(aberta) ?? "Oportunidade sem passo agendado não avança sozinha."}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </div>

              <SheetFooter className="mt-auto gap-2 border-t border-[var(--fio)]">
                <ButtonGroup className="w-full">
                  <Button variant="outline" size="sm" className="flex-1 shadow-none"><Phone />Ligar</Button>
                  <Button variant="outline" size="sm" className="flex-1 shadow-none"><Mail />E-mail</Button>
                </ButtonGroup>
                <Button size="sm" className="w-full shadow-none">Agendar próximo passo</Button>
                <SheetClose asChild>
                  <Button variant="ghost" size="sm" className="w-full text-[var(--tinta-fraca)]">Fechar</Button>
                </SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
