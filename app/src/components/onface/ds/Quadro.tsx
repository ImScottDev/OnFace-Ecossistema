"use client";

/** Quadro — o funil visto de lado.
 *
 * Um kanban de verdade: arrasta entre etapas, reordena dentro da etapa, e o
 * estado muda de fato. A regra que sustenta o componente inteiro é a fonte
 * única: a coluna de um negócio É `negocio.etapa` e a ordem dentro da coluna É
 * a ordem no array. Não existe estrutura paralela de colunas, então quadro e
 * lista nunca divergem — mover o cartão é a mesma escrita que a lista faria.
 *
 * Controlado de propósito (`negocios` + `aoMudar`): quem monta a tela é dono do
 * dado. Assim o mesmo quadro serve o funil de vendas, a fila de cobrança e o
 * onboarding sem cada tela guardar uma cópia divergente do board.
 */

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  Announcements,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "motion/react";
import {
  ArrowRightLeft,
  CalendarPlus,
  EllipsisVertical,
  Inbox,
  Phone,
  SquareArrowOutUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TomEstado } from "./crm";
import { ETAPAS_QUADRO, brl, compacto, type Etapa, type Negocio } from "./dados";
/* A etiqueta do cartão é a mesma `.of-status` da tela de registro, então o
   quadro carrega o CSS dela mesmo quando é montado fora da família de CRM. */
import "./crm.css";
import "./quadro.css";

/* ── Etiquetas ──────────────────────────────────────────────────────────── */
/* A etiqueta do cartão é a mesma da lista e a mesma do cabeçalho de entidade:
   mesma palavra, mesmo par superfície/texto. O `Badge variant="outline"` que
   estava aqui não pintava o rótulo (texto herdado, ~1.1:1 no efetivo) e era
   justamente o sinal de SLA, a informação pela qual se olha o quadro.

   Regra de sinal: cinza é informativo (o prazo está de pé), coral é "exige
   ação agora" (vence hoje, ou o negócio está sem próxima tarefa) e vermelho é
   prazo estourado. Verde não aparece no funil: negócio ganho sai do quadro. */
const ETIQUETA: Record<Negocio["situacao"], { rotulo: string; tom: TomEstado }> = {
  "no-prazo": { rotulo: "No prazo", tom: "neutro" },
  hoje: { rotulo: "Hoje", tom: "acento" },
  atrasado: { rotulo: "Atrasada", tom: "risco" },
  "sem-tarefa": { rotulo: "Sem tarefa", tom: "acento" },
};

const eUrgente = (n: Negocio) => n.situacao === "atrasado" || n.situacao === "hoje";

/* ── Identidade das colunas ─────────────────────────────────────────────── */
/* A coluna precisa ser droppable com id próprio, senão coluna vazia não recebe
   cartão. O prefixo distingue "soltei sobre a coluna" de "soltei sobre um
   cartão", que é a única informação que o dnd-kit devolve em `over`. */
const PREFIXO_COLUNA = "coluna:";
const idDaColuna = (etapa: Etapa) => `${PREFIXO_COLUNA}${etapa}`;

function colunaDe(id: UniqueIdentifier, negocios: Negocio[]): Etapa | null {
  const bruto = String(id);
  if (bruto.startsWith(PREFIXO_COLUNA)) return bruto.slice(PREFIXO_COLUNA.length) as Etapa;
  return negocios.find((n) => n.id === bruto)?.etapa ?? null;
}

/** Move o negócio para outra etapa, entrando na posição do cartão sob o cursor.
 *  Sem cartão embaixo (coluna vazia), entra no fim da coluna. */
function moverParaColuna(
  negocios: Negocio[],
  idAtivo: string,
  destino: Etapa,
  idSobre: UniqueIdentifier,
): Negocio[] {
  const atual = negocios.find((n) => n.id === idAtivo);
  if (!atual) return negocios;

  const restante = negocios.filter((n) => n.id !== idAtivo);
  const alvo = restante.findIndex((n) => n.id === String(idSobre));
  const indice = alvo >= 0 ? alvo : restante.length;
  return [...restante.slice(0, indice), { ...atual, etapa: destino }, ...restante.slice(indice)];
}

/** Reordena dentro da etapa preservando as posições que a coluna já ocupa no
 *  array: só o conteúdo dessas casas muda, o resto do funil fica parado. */
function reordenarColuna(negocios: Negocio[], etapa: Etapa, ordem: string[]): Negocio[] {
  const porId = new Map(negocios.map((n) => [n.id, n]));
  let cursor = 0;
  return negocios.map((n) => (n.etapa === etapa ? (porId.get(ordem[cursor++]) ?? n) : n));
}

/* ── Cartão ─────────────────────────────────────────────────────────────── */
type PropsCorpo = {
  negocio: Negocio;
  mostrarValor: boolean;
  marcarUrgentes: boolean;
};

/** Conteúdo visual do cartão. Compartilhado com o DragOverlay para o cartão
 *  levantado ser o mesmo objeto, não uma imitação que envelhece sozinha. */
function CorpoCartao({ negocio, mostrarValor, acao }: PropsCorpo & { acao?: React.ReactNode }) {
  const etiqueta = ETIQUETA[negocio.situacao];
  return (
    <>
      <div className="qd-cartao-topo">
        <span className="qd-cartao-titulo">
          <strong>{negocio.titulo}</strong>
          <small>{negocio.empresa}</small>
        </span>
        {acao}
      </div>
      <div className="ds-quadro-cartao-rodape">
        <span className="of-status" data-tom={etiqueta.tom}>
          {etiqueta.rotulo}
        </span>
        <span className="qd-cartao-meta">
          {mostrarValor ? <span className="qd-valor">{brl(negocio.valor)}</span> : null}
          <span className="qd-pessoa" title={negocio.responsavel.nome} aria-hidden="true">
            {negocio.responsavel.iniciais}
          </span>
        </span>
      </div>
    </>
  );
}

function MenuCartao({ negocio, aoAbrir }: { negocio: Negocio; aoAbrir: () => void }) {
  return (
    /* O menu vive dentro de um cartão arrastável: sem parar a propagação, o
       pointerdown viraria arraste e o Espaço pegaria o cartão em vez de abrir
       o menu. */
    <span
      className="qd-acao"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="qd-acao-botao"
            aria-label={`Ações de ${negocio.titulo}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="qd-menu">
          <DropdownMenuLabel>{negocio.empresa}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={aoAbrir}>
            <SquareArrowOutUpRight /> Abrir negócio
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast(`Ligando para ${negocio.empresa}`)}>
            <Phone /> Ligar agora
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast("Tarefa criada para amanhã, 09:00")}>
            <CalendarPlus /> Agendar tarefa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function Cartao({
  negocio,
  mostrarValor,
  marcarUrgentes,
  aoAbrir,
}: PropsCorpo & { aoAbrir: (n: Negocio) => void }) {
  const reduzido = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
    useSortable({
      id: negocio.id,
      /* O leitor de tela anuncia em português: "sortable" não diz nada para
         quem está tocando o funil. */
      attributes: { roleDescription: "cartão de negócio" },
      /* Movimento é orientação, não enfeite: quem pediu menos movimento recebe
         a troca de posição sem a animação de acomodação. */
      transition: reduzido ? null : undefined,
    });

  return (
    <div
      ref={setNodeRef}
      className="ds-quadro-cartao"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-arrastando={isDragging ? "true" : undefined}
      data-urgente={marcarUrgentes && eUrgente(negocio) ? "true" : undefined}
      {...attributes}
      {...listeners}
      onClick={() => aoAbrir(negocio)}
      onKeyDown={(evento) => {
        listeners?.onKeyDown?.(evento);
        /* Espaço é do arraste (KeyboardSensor); Enter fica livre para abrir,
           que é o que o teclado espera de um item de lista. Com arraste em
           curso, Enter não faz nada: abrir a gaveta roubaria o foco de quem
           está no meio de um movimento. */
        if (evento.key === "Enter" && !isSorting) {
          evento.preventDefault();
          aoAbrir(negocio);
        }
      }}
    >
      <CorpoCartao
        negocio={negocio}
        mostrarValor={mostrarValor}
        marcarUrgentes={marcarUrgentes}
        acao={<MenuCartao negocio={negocio} aoAbrir={() => aoAbrir(negocio)} />}
      />
    </div>
  );
}

/* ── Coluna ─────────────────────────────────────────────────────────────── */
function Coluna({
  etapa,
  itens,
  sobre,
  mostrarValor,
  marcarUrgentes,
  aoAbrir,
}: {
  etapa: Etapa;
  itens: Negocio[];
  sobre: boolean;
  mostrarValor: boolean;
  marcarUrgentes: boolean;
  aoAbrir: (n: Negocio) => void;
}) {
  const { setNodeRef } = useDroppable({ id: idDaColuna(etapa) });
  const soma = itens.reduce((total, n) => total + n.valor, 0);

  return (
    <section className="ds-quadro-coluna" data-sobre={sobre ? "true" : undefined}>
      <header className="ds-quadro-topo qd-coluna-topo">
        <strong>{etapa}</strong>
        {/* Contagem e soma saem do próprio estado, então acompanham o arraste
            em tempo real em vez de virar número decorativo. Dinheiro e
            quantidade são duas leituras diferentes: separados, o olho escolhe
            qual quer primeiro em vez de ler "3 · R$ 58k" como um texto só. */}
        <span className="qd-coluna-medida">
          <span className="qd-coluna-soma">{compacto(soma)}</span>
          <span className="qd-coluna-conta" aria-hidden="true">
            {itens.length}
          </span>
          <span className="sr-only">
            {itens.length === 1 ? "1 negócio" : `${itens.length} negócios`}
          </span>
        </span>
      </header>

      <div className="qd-lista" ref={setNodeRef}>
        <SortableContext items={itens.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          {itens.map((negocio) => (
            <Cartao
              key={negocio.id}
              negocio={negocio}
              mostrarValor={mostrarValor}
              marcarUrgentes={marcarUrgentes}
              aoAbrir={aoAbrir}
            />
          ))}
        </SortableContext>
        {itens.length === 0 ? (
          <p className="ds-quadro-vazia">
            <Inbox aria-hidden="true" />
            Arraste um negócio para cá
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ── Quadro ─────────────────────────────────────────────────────────────── */
export type PropsQuadro = {
  negocios: Negocio[];
  /** Ordem das colunas. Ganho e Perdido ficam fora: saída de funil não é etapa
   *  de trabalho, e ninguém arrasta um negócio de volta de "Ganho". */
  etapas?: Etapa[];
  aoMudar: (proximos: Negocio[]) => void;
  mostrarValor?: boolean;
  marcarUrgentes?: boolean;
};

export function Quadro({
  negocios,
  etapas = ETAPAS_QUADRO,
  aoMudar,
  mostrarValor = true,
  marcarUrgentes = true,
}: PropsQuadro) {
  const reduzido = useReducedMotion();
  const idDnd = React.useId();
  const [idAtivo, setIdAtivo] = React.useState<string | null>(null);
  const [colunaSobre, setColunaSobre] = React.useState<Etapa | null>(null);
  const [idAberto, setIdAberto] = React.useState<string | null>(null);
  /* Guardados no início do arraste: no fim, a etapa do cartão já mudou (o
     movimento entre colunas acontece durante o `over`), então sem o retrato
     inicial não dá para saber de onde ele veio nem como desfazer. */
  const inicioRef = React.useRef<{ etapa: Etapa; antes: Negocio[] } | null>(null);

  const sensores = useSensors(
    /* 6px de tolerância: abaixo disso é clique (abre a gaveta), acima é
       arraste. Sem isso, todo clique no cartão viraria um micro-arraste. */
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      /* Enter sai do arraste e fica para abrir o negócio: pegar e soltar é só
         no Espaço. */
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const tituloDe = React.useCallback(
    (id: UniqueIdentifier) => negocios.find((n) => n.id === String(id))?.titulo ?? "negócio",
    [negocios],
  );

  const alvoDe = React.useCallback(
    (id: UniqueIdentifier) => {
      const etapa = colunaDe(id, negocios);
      const bruto = String(id);
      if (bruto.startsWith(PREFIXO_COLUNA)) return `a coluna ${etapa}`;
      return `${tituloDe(id)}, na coluna ${etapa}`;
    },
    [negocios, tituloDe],
  );

  const anuncios: Announcements = React.useMemo(
    () => ({
      onDragStart: ({ active }) =>
        `Negócio ${tituloDe(active.id)} pego. Use as setas para escolher a posição e o espaço para soltar.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${tituloDe(active.id)} sobre ${alvoDe(over.id)}.`
          : `${tituloDe(active.id)} fora de qualquer coluna.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${tituloDe(active.id)} solto em ${alvoDe(over.id)}.`
          : `${tituloDe(active.id)} devolvido à posição original.`,
      onDragCancel: ({ active }) =>
        `Movimentação cancelada. ${tituloDe(active.id)} voltou para o lugar de origem.`,
    }),
    [alvoDe, tituloDe],
  );

  const instrucoes: ScreenReaderInstructions = {
    draggable:
      "Pressione espaço para pegar o negócio. Use as setas para movê-lo dentro da coluna ou para outra etapa. Pressione espaço para soltar ou escape para cancelar.",
  };

  function aoIniciar({ active }: DragStartEvent) {
    const etapa = colunaDe(active.id, negocios);
    if (!etapa) return;
    setIdAtivo(String(active.id));
    setColunaSobre(etapa);
    inicioRef.current = { etapa, antes: negocios };
  }

  /* A troca de coluna acontece aqui, não no fim: o cartão já aparece na coluna
     de destino enquanto o ponteiro está lá, que é o que dá a sensação de
     "encaixou". No `end` sobra só a ordenação dentro da coluna. */
  function aoPassarPor({ active, over }: DragOverEvent) {
    if (!over) {
      setColunaSobre(null);
      return;
    }
    const destino = colunaDe(over.id, negocios);
    setColunaSobre(destino);

    const origem = colunaDe(active.id, negocios);
    if (!destino || !origem || origem === destino) return;
    aoMudar(moverParaColuna(negocios, String(active.id), destino, over.id));
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    const inicio = inicioRef.current;
    setIdAtivo(null);
    setColunaSobre(null);
    inicioRef.current = null;
    if (!over || !inicio) return;

    const destino = colunaDe(over.id, negocios);
    if (!destino) return;

    if (destino === colunaDe(active.id, negocios)) {
      const ids = negocios.filter((n) => n.etapa === destino).map((n) => n.id);
      const de = ids.indexOf(String(active.id));
      const para = ids.indexOf(String(over.id));
      if (de >= 0 && para >= 0 && de !== para) {
        aoMudar(reordenarColuna(negocios, destino, arrayMove(ids, de, para)));
      }
    }

    if (destino !== inicio.etapa) {
      /* Mudança de etapa é escrita de negócio, não ajuste visual: avisa e
         oferece a volta, porque arraste erra fácil. */
      toast.success(`${tituloDe(active.id)} → ${destino}`, {
        description: `Saiu de ${inicio.etapa}.`,
        action: { label: "Desfazer", onClick: () => aoMudar(inicio.antes) },
      });
    }
  }

  function aoCancelar() {
    setIdAtivo(null);
    setColunaSobre(null);
    inicioRef.current = null;
  }

  const arrastado = idAtivo ? (negocios.find((n) => n.id === idAtivo) ?? null) : null;
  const aberto = idAberto ? (negocios.find((n) => n.id === idAberto) ?? null) : null;

  return (
    <>
      <DndContext
        /* Sem id explícito o dnd-kit numera sozinho a partir de um contador de
           módulo: o servidor renderiza `DndDescribedBy-0` e o cliente cai em
           outro número, e o React reclama de hidratação no primeiro paint de
           qualquer tela com quadro. `useId` é estável entre servidor e cliente
           e continua único por instância, que importa porque a mesma tela monta
           mais de um quadro. */
        id={idDnd}
        sensors={sensores}
        collisionDetection={closestCorners}
        modifiers={[restrictToWindowEdges]}
        accessibility={{ announcements: anuncios, screenReaderInstructions: instrucoes }}
        onDragStart={aoIniciar}
        onDragOver={aoPassarPor}
        onDragEnd={aoSoltar}
        onDragCancel={aoCancelar}
      >
        {/* Abaixo de ~150u por coluna o cartão fica ilegível: em vez de espremer,
            o quadro rola na horizontal. */}
        <div className="qd-rolagem">
          <div className="ds-quadro">
            {etapas.map((etapa) => (
              <Coluna
                key={etapa}
                etapa={etapa}
                itens={negocios.filter((n) => n.etapa === etapa)}
                sobre={colunaSobre === etapa && idAtivo !== null}
                mostrarValor={mostrarValor}
                marcarUrgentes={marcarUrgentes}
                aoAbrir={(n) => setIdAberto(n.id)}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={reduzido ? null : undefined}>
          {arrastado ? (
            <div className="ds-quadro-cartao" data-sobreposicao="true">
              <CorpoCartao
                negocio={arrastado}
                mostrarValor={mostrarValor}
                marcarUrgentes={marcarUrgentes}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Sheet open={aberto !== null} onOpenChange={(v) => !v && setIdAberto(null)}>
        <SheetContent className="qd-gaveta">
          {aberto ? <GavetaNegocio negocio={aberto} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ── Gaveta de detalhe ──────────────────────────────────────────────────── */
/* Lê do mesmo array do quadro: a etapa mostrada aqui é a etapa de agora, não a
   que o cartão tinha quando foi aberto. */
function GavetaNegocio({ negocio }: { negocio: Negocio }) {
  const etiqueta = ETIQUETA[negocio.situacao];
  const campos: { rotulo: string; valor: string }[] = [
    { rotulo: "Etapa", valor: negocio.etapa },
    { rotulo: "Valor", valor: brl(negocio.valor, true) },
    { rotulo: "Produto", valor: negocio.produto },
    { rotulo: "Origem", valor: negocio.origem },
    { rotulo: "Responsável", valor: negocio.responsavel.nome },
    { rotulo: "Próxima ação", valor: negocio.proximaAcao },
    {
      rotulo: "Criado em",
      valor: new Date(`${negocio.criadoEm}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    },
  ];

  return (
    <>
      <SheetHeader className="qd-gaveta-topo">
        <SheetTitle className="qd-gaveta-titulo">{negocio.titulo}</SheetTitle>
        <SheetDescription className="qd-gaveta-empresa">{negocio.empresa}</SheetDescription>
        <span className="qd-gaveta-etiquetas">
          <span className="of-status" data-tom={etiqueta.tom}>
            {etiqueta.rotulo}
          </span>
          {/* Etapa é informação, não alerta: pastilha neutra ao lado do sinal
              de SLA, para as duas não brigarem por atenção. */}
          <span className="of-status" data-tom="neutro">
            {negocio.etapa}
          </span>
        </span>
      </SheetHeader>

      <div className="qd-gaveta-corpo">
        <dl className="qd-campos">
          {campos.map((campo) => (
            <div className="qd-campo" key={campo.rotulo}>
              <dt>{campo.rotulo}</dt>
              <dd>{campo.valor}</dd>
            </div>
          ))}
        </dl>

        <div className="ds-linha">
          <Button size="sm">
            <Phone /> Ligar
          </Button>
          <Button variant="outline" size="sm">
            <CalendarPlus /> Agendar
          </Button>
          <Button variant="subtle" size="sm">
            <ArrowRightLeft /> Mudar etapa
          </Button>
        </div>
      </div>
    </>
  );
}
