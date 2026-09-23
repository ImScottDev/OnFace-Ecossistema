"use client";

/** Quadro — o funil visto de lado.
 *
 * Um kanban de verdade: arrasta entre etapas, reordena dentro da etapa, e o
 * estado muda de fato. A regra que sustenta o componente inteiro é a fonte
 * única: a coluna de um item É o que `colunaDe` devolve e a ordem dentro da
 * coluna É a ordem no array. Não existe estrutura paralela de colunas, então
 * quadro e lista nunca divergem — mover o cartão é a mesma escrita que a lista
 * faria.
 *
 * Controlado e AGNÓSTICO de dado (`itens` + `aoMudar` + render props): quem
 * monta a tela é dono do tipo. Nasceu preso ao `Negocio` de demonstração do
 * laboratório, o que o deixava impossível de usar no produto — o mesmo defeito
 * que a biblioteca inteira tinha, peça pronta sem consumidor. Agora o mesmo
 * quadro serve Pré-vendas, Pipeline e o catálogo, cada um com o seu cartão.
 *
 * O que ele NÃO faz, de propósito: desenhar o cartão, abrir a gaveta e decidir
 * o que é urgente. Isso é do domínio de cada tela.
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
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import "./crm.css";
import "./quadro.css";

/* ── Identidade das colunas ─────────────────────────────────────────────── */
/* A coluna precisa ser droppable com id próprio, senão coluna vazia não recebe
   cartão. O prefixo distingue "soltei sobre a coluna" de "soltei sobre um
   cartão", que é a única informação que o dnd-kit devolve em `over`. */
const PREFIXO_COLUNA = "coluna:";
const idDaColuna = (chave: string) => `${PREFIXO_COLUNA}${chave}`;

export type ColunaQuadro = {
  chave: string;
  rotulo: string;
  /** Total real da etapa quando a página carregou só parte dela. Sem isto o
   *  cabeçalho contaria o que está na tela e chamaria de total. */
  total?: number;
  /**
   * Coluna de SAÍDA: fica na mesma linha, em faixa estreita, e abre sob clique.
   *
   * Nutrição e Desqualificado são estados reais e precisam estar no board —
   * escondê-las em aba foi o que o Kanban único veio desfazer. Mas elas não
   * são etapas por onde o trabalho PASSA, e ocupando 262u cada sobrava menos
   * de meia coluna de Oportunidade na tela: o operador rolava de lado para
   * chegar onde o dinheiro está.
   *
   * `details` e não estado próprio: abrir, fechar, teclado e leitor de tela
   * são do navegador.
   */
  colapsavel?: boolean;
};

export type PropsQuadro<T> = {
  itens: T[];
  colunas: ColunaQuadro[];
  idDe: (item: T) => string;
  colunaDe: (item: T) => string;
  /** Devolve o item na coluna nova. O quadro não sabe montar o seu tipo. */
  comColuna: (item: T, chave: string) => T;
  renderCartao: (item: T) => React.ReactNode;
  aoMudar: (proximos: T[]) => void;
  /** Abre o detalhe (gaveta, painel, rota). Sem isto o cartão só arrasta. */
  aoAbrir?: (item: T) => void;
  /**
   * Recusa um destino e diz por quê.
   *
   * Existe porque etapa nem sempre é posição no board: em Pré-vendas,
   * Qualificado grava fato histórico, Oportunidade cria entidade no Pipeline e
   * Nutrição/Desqualificação exigem motivo estruturado. Sem esta porta o
   * arraste passaria por cima de regra de negócio, que é pior do que não ter
   * arraste.
   */
  podeSoltar?: (item: T, destino: string) => true | string;
  /** Medida do cabeçalho: soma, contagem, o que a tela quiser. */
  renderMedida?: (itens: T[], coluna: ColunaQuadro) => React.ReactNode;
  renderVazio?: (coluna: ColunaQuadro) => React.ReactNode;
  /** Nome do item em anúncio de leitor de tela e no toast de desfazer. */
  rotuloDe?: (item: T) => string;
  /** Marca visual de item que exige ação agora. */
  eUrgente?: (item: T) => boolean;
  /**
   * Classe do invólucro arrastável.
   *
   * O padrão traz a superfície do quadro (`ds-quadro-cartao`). Quem já monta o
   * próprio cartão passa outra coisa: duas definições da mesma superfície é o
   * bug que o `ov-card` por cima do `Item` já causou, rodapé 30px para fora.
   */
  classeCartao?: string;
};

/* ── Cartão ─────────────────────────────────────────────────────────────── */
function Cartao<T>({
  item,
  id,
  urgente,
  classe,
  renderCartao,
  aoAbrir,
}: {
  item: T;
  id: string;
  urgente: boolean;
  classe: string;
  renderCartao: (item: T) => React.ReactNode;
  aoAbrir?: (item: T) => void;
}) {
  const reduzido = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
    useSortable({
      id,
      /* O leitor de tela anuncia em português: "sortable" não diz nada para
         quem está tocando o funil. */
      attributes: { roleDescription: "cartão" },
      /* Movimento é orientação, não enfeite: quem pediu menos movimento recebe
         a troca de posição sem a animação de acomodação. */
      transition: reduzido ? null : undefined,
    });

  return (
    <div
      ref={setNodeRef}
      className={classe}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-arrastando={isDragging ? "true" : undefined}
      data-urgente={urgente ? "true" : undefined}
      {...attributes}
      {...listeners}
      onClick={() => aoAbrir?.(item)}
      onKeyDown={(evento) => {
        listeners?.onKeyDown?.(evento);
        /* Espaço é do arraste (KeyboardSensor); Enter fica livre para abrir,
           que é o que o teclado espera de um item de lista. Com arraste em
           curso, Enter não faz nada: abrir a gaveta roubaria o foco de quem
           está no meio de um movimento. */
        if (evento.key === "Enter" && !isSorting) {
          evento.preventDefault();
          aoAbrir?.(item);
        }
      }}
    >
      {renderCartao(item)}
    </div>
  );
}

/* ── Coluna ─────────────────────────────────────────────────────────────── */
function Coluna<T>({
  coluna,
  itens,
  sobre,
  recusada,
  idDe,
  renderCartao,
  renderMedida,
  renderVazio,
  eUrgente,
  classeCartao,
  aoAbrir,
}: {
  coluna: ColunaQuadro;
  itens: T[];
  sobre: boolean;
  recusada: boolean;
  idDe: (item: T) => string;
  renderCartao: (item: T) => React.ReactNode;
  renderMedida?: (itens: T[], coluna: ColunaQuadro) => React.ReactNode;
  renderVazio?: (coluna: ColunaQuadro) => React.ReactNode;
  eUrgente?: (item: T) => boolean;
  classeCartao: string;
  aoAbrir?: (item: T) => void;
}) {
  const { setNodeRef } = useDroppable({ id: idDaColuna(coluna.chave) });

  const medida = (
    <span className={coluna.colapsavel ? "qd-coluna-medida ds-coluna-fechada-numeros" : "qd-coluna-medida"}>
      {renderMedida ? (
        renderMedida(itens, coluna)
      ) : (
        <span className="qd-coluna-conta" aria-hidden="true">
          {coluna.total != null && coluna.total > itens.length
            ? `${itens.length} de ${coluna.total}`
            : itens.length}
        </span>
      )}
      <span className="sr-only">
        {itens.length === 1 ? "1 item" : `${itens.length} itens`}
      </span>
    </span>
  );

  const lista = (
    <div className="qd-lista">
      <SortableContext items={itens.map(idDe)} strategy={verticalListSortingStrategy}>
        {itens.map((item) => (
          <Cartao
            key={idDe(item)}
            id={idDe(item)}
            item={item}
            urgente={Boolean(eUrgente?.(item))}
            classe={classeCartao}
            renderCartao={renderCartao}
            aoAbrir={aoAbrir}
          />
        ))}
      </SortableContext>
      {itens.length === 0
        ? (renderVazio?.(coluna) ?? (
            <p className="ds-quadro-vazia">
              <Inbox aria-hidden="true" />
              Arraste um cartão para cá
            </p>
          ))
        : null}
    </div>
  );

  /* Coluna de saída: o droppable vai no `details` INTEIRO, não na lista.
     Fechado, a lista não é renderizada pelo navegador, e um alvo que só
     existe quando a coluna está aberta obrigaria a abrir antes de arrastar —
     que é o passo a mais que a faixa estreita existe para evitar. */
  if (coluna.colapsavel) {
    return (
      <details
        ref={setNodeRef as unknown as React.Ref<HTMLDetailsElement>}
        className="ds-quadro-coluna ds-coluna-fechada"
        data-sobre={sobre ? "true" : undefined}
        data-recusada={recusada ? "true" : undefined}
        aria-label={coluna.rotulo}
      >
        <summary className="ds-quadro-topo qd-coluna-topo">
          <strong>{coluna.rotulo}</strong>
          {medida}
        </summary>
        {lista}
      </details>
    );
  }

  return (
    <section
      className="ds-quadro-coluna"
      data-sobre={sobre ? "true" : undefined}
      data-recusada={recusada ? "true" : undefined}
      aria-label={coluna.rotulo}
      ref={setNodeRef}
    >
      <header className="ds-quadro-topo qd-coluna-topo">
        <strong>{coluna.rotulo}</strong>
        {medida}
      </header>
      {lista}
    </section>
  );
}

/* ── Quadro ─────────────────────────────────────────────────────────────── */
export function Quadro<T>({
  itens,
  colunas,
  idDe,
  colunaDe,
  comColuna,
  renderCartao,
  aoMudar,
  aoAbrir,
  podeSoltar,
  renderMedida,
  renderVazio,
  rotuloDe,
  eUrgente,
  classeCartao = "ds-quadro-cartao",
}: PropsQuadro<T>) {
  const reduzido = useReducedMotion();
  const idDnd = React.useId();
  const [idAtivo, setIdAtivo] = React.useState<string | null>(null);
  const [colunaSobre, setColunaSobre] = React.useState<string | null>(null);
  const [recusa, setRecusa] = React.useState<string | null>(null);
  /* Guardados no início do arraste: no fim, a coluna do cartão já mudou (o
     movimento entre colunas acontece durante o `over`), então sem o retrato
     inicial não dá para saber de onde ele veio nem como desfazer. */
  const inicioRef = React.useRef<{ chave: string; antes: T[] } | null>(null);

  const sensores = useSensors(
    /* 6px de tolerância: abaixo disso é clique (abre o detalhe), acima é
       arraste. Sem isso, todo clique no cartão viraria um micro-arraste. */
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      /* Enter sai do arraste e fica para abrir o item: pegar e soltar é só no
         Espaço. */
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const itemPorId = React.useCallback(
    (id: UniqueIdentifier) => itens.find((i) => idDe(i) === String(id)) ?? null,
    [itens, idDe],
  );

  /** Resolve um id do dnd-kit (cartão ou coluna) na chave de coluna. */
  const chaveDe = React.useCallback(
    (id: UniqueIdentifier): string | null => {
      const bruto = String(id);
      if (bruto.startsWith(PREFIXO_COLUNA)) return bruto.slice(PREFIXO_COLUNA.length);
      const item = itemPorId(id);
      return item ? colunaDe(item) : null;
    },
    [itemPorId, colunaDe],
  );

  const rotulo = React.useCallback(
    (id: UniqueIdentifier) => {
      const item = itemPorId(id);
      return item ? (rotuloDe?.(item) ?? idDe(item)) : "cartão";
    },
    [itemPorId, rotuloDe, idDe],
  );

  const rotuloColuna = React.useCallback(
    (chave: string | null) => colunas.find((c) => c.chave === chave)?.rotulo ?? chave ?? "",
    [colunas],
  );

  const alvoDe = React.useCallback(
    (id: UniqueIdentifier) => {
      const chave = chaveDe(id);
      const bruto = String(id);
      if (bruto.startsWith(PREFIXO_COLUNA)) return `a coluna ${rotuloColuna(chave)}`;
      return `${rotulo(id)}, na coluna ${rotuloColuna(chave)}`;
    },
    [chaveDe, rotulo, rotuloColuna],
  );

  const anuncios: Announcements = React.useMemo(
    () => ({
      onDragStart: ({ active }) =>
        `${rotulo(active.id)} pego. Use as setas para escolher a posição e o espaço para soltar.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${rotulo(active.id)} sobre ${alvoDe(over.id)}.`
          : `${rotulo(active.id)} fora de qualquer coluna.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${rotulo(active.id)} solto em ${alvoDe(over.id)}.`
          : `${rotulo(active.id)} devolvido à posição original.`,
      onDragCancel: ({ active }) =>
        `Movimentação cancelada. ${rotulo(active.id)} voltou para o lugar de origem.`,
    }),
    [alvoDe, rotulo],
  );

  const instrucoes: ScreenReaderInstructions = {
    draggable:
      "Pressione espaço para pegar o cartão. Use as setas para movê-lo dentro da coluna ou para outra etapa. Pressione espaço para soltar ou escape para cancelar.",
  };

  /** Move o item para outra coluna, entrando na posição do cartão sob o cursor.
   *  Sem cartão embaixo (coluna vazia), entra no fim. */
  function moverParaColuna(idAtivoStr: string, destino: string, idSobre: UniqueIdentifier): T[] {
    const atual = itens.find((i) => idDe(i) === idAtivoStr);
    if (!atual) return itens;
    const restante = itens.filter((i) => idDe(i) !== idAtivoStr);
    const alvo = restante.findIndex((i) => idDe(i) === String(idSobre));
    const indice = alvo >= 0 ? alvo : restante.length;
    return [...restante.slice(0, indice), comColuna(atual, destino), ...restante.slice(indice)];
  }

  /** Reordena dentro da coluna preservando as posições que ela já ocupa no
   *  array: só o conteúdo dessas casas muda, o resto do funil fica parado. */
  function reordenarColuna(chave: string, ordem: string[]): T[] {
    const porId = new Map(itens.map((i) => [idDe(i), i]));
    let cursor = 0;
    return itens.map((i) => (colunaDe(i) === chave ? (porId.get(ordem[cursor++]) ?? i) : i));
  }

  function aoIniciar({ active }: DragStartEvent) {
    const chave = chaveDe(active.id);
    if (!chave) return;
    setIdAtivo(String(active.id));
    setColunaSobre(chave);
    setRecusa(null);
    inicioRef.current = { chave, antes: itens };
  }

  /* A troca de coluna acontece aqui, não no fim: o cartão já aparece na coluna
     de destino enquanto o ponteiro está lá, que é o que dá a sensação de
     "encaixou". No `end` sobra só a ordenação dentro da coluna. */
  function aoPassarPor({ active, over }: DragOverEvent) {
    if (!over) {
      setColunaSobre(null);
      setRecusa(null);
      return;
    }
    const destino = chaveDe(over.id);
    const origem = chaveDe(active.id);
    const item = itemPorId(active.id);
    setColunaSobre(destino);

    if (!destino || !origem || !item || origem === destino) {
      setRecusa(null);
      return;
    }

    /* Destino recusado pela regra: a coluna acende como bloqueada e o cartão
       NÃO entra nela. Deixar entrar e desfazer depois ensina o movimento
       errado. */
    const veredito = podeSoltar?.(item, destino) ?? true;
    if (veredito !== true) {
      setRecusa(destino);
      return;
    }

    setRecusa(null);
    aoMudar(moverParaColuna(String(active.id), destino, over.id));
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    const inicio = inicioRef.current;
    const destinoRecusado = recusa;
    setIdAtivo(null);
    setColunaSobre(null);
    setRecusa(null);
    inicioRef.current = null;
    if (!over || !inicio) return;

    const item = itemPorId(active.id);
    const destino = chaveDe(over.id);

    /* Soltou em cima de uma coluna que a regra recusa: diz o motivo em vez de
       simplesmente não acontecer nada.
     *
     * A checagem é refeita AQUI e não só lida do estado de `recusa`. Pelo
     * teclado o `onDragOver` não chega numa coluna vazia, então o estado
     * transitório fica nulo e a pessoa só via o cartão não sair do lugar, sem
     * explicação nenhuma. Regra de negócio não pode depender de um evento de
     * ponteiro ter acontecido. */
    const alvoRecusado = destinoRecusado ?? destino;
    if (item && alvoRecusado) {
      const motivo = podeSoltar?.(item, alvoRecusado);
      if (typeof motivo === "string") {
        toast.error(`${rotulo(active.id)} não vai para ${rotuloColuna(alvoRecusado)}`, {
          description: motivo,
        });
        /* Se o `over` chegou a mover o cartão antes da recusa, devolve. */
        if (inicio.antes !== itens) aoMudar(inicio.antes);
        return;
      }
    }

    if (!destino) return;

    if (destino === chaveDe(active.id)) {
      const ids = itens.filter((i) => colunaDe(i) === destino).map(idDe);
      const de = ids.indexOf(String(active.id));
      const para = ids.indexOf(String(over.id));
      if (de >= 0 && para >= 0 && de !== para) {
        aoMudar(reordenarColuna(destino, arrayMove(ids, de, para)));
      }
    }

    if (destino !== inicio.chave) {
      /* Mudança de etapa é escrita de negócio, não ajuste visual: avisa e
         oferece a volta, porque arraste erra fácil. */
      const antes = inicio.antes;
      toast.success(`${rotulo(active.id)} → ${rotuloColuna(destino)}`, {
        description: `Saiu de ${rotuloColuna(inicio.chave)}.`,
        action: { label: "Desfazer", onClick: () => aoMudar(antes) },
      });
    }
  }

  function aoCancelar() {
    setIdAtivo(null);
    setColunaSobre(null);
    setRecusa(null);
    inicioRef.current = null;
  }

  const arrastado = idAtivo ? itens.find((i) => idDe(i) === idAtivo) : undefined;

  return (
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
          {colunas.map((coluna) => (
            <Coluna
              key={coluna.chave}
              coluna={coluna}
              itens={itens.filter((i) => colunaDe(i) === coluna.chave)}
              sobre={colunaSobre === coluna.chave && idAtivo !== null}
              recusada={recusa === coluna.chave}
              idDe={idDe}
              renderCartao={renderCartao}
              renderMedida={renderMedida}
              renderVazio={renderVazio}
              eUrgente={eUrgente}
              classeCartao={classeCartao}
              aoAbrir={aoAbrir}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={reduzido ? null : undefined}>
        {arrastado ? (
          <div className={classeCartao} data-sobreposicao="true">
            {renderCartao(arrastado)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
