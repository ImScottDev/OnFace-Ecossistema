"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { formatarMoeda, type Oportunidade } from "./dados";

/**
 * Cartão do quadro.
 *
 * Três elementos, não oito. A versão anterior mostrava família, empresa, seta,
 * valor, próximo passo, avatar, nome do responsável e dias na etapa ao mesmo
 * tempo, e quando tudo está visível nada é importante: o olho não tem onde
 * pousar e a coluna vira ruído.
 *
 * Ficou só o que muda uma decisão na hora de olhar a coluna:
 *  - QUEM é (empresa),
 *  - QUANTO vale,
 *  - se precisa de atenção (um ponto, não duas frases),
 *  - e DE QUEM é (o avatar, sem o nome escrito ao lado).
 *
 * Família, responsável por extenso, próximo passo e tempo parado continuam
 * existindo: moram no painel que abre no clique. É a segunda camada, revelada
 * sob demanda em vez de disputada na primeira.
 *
 * Altura única em todos os cartões, com o nome truncado: coluna de cartões de
 * alturas diferentes obriga o olho a reencontrar o ritmo a cada linha.
 */

export function motivoDeAtencao(item: Oportunidade): string | null {
  if (!item.proximoPasso && item.diasNaEtapa >= 14)
    return `Sem próxima ação e parada há ${item.diasNaEtapa} dias`;
  if (!item.proximoPasso) return "Sem próxima ação";
  if (item.diasNaEtapa >= 14) return `Parada há ${item.diasNaEtapa} dias`;
  return null;
}

export function ConteudoCartao({ item }: { item: Oportunidade }) {
  const atencao = motivoDeAtencao(item);

  return (
    <>
      <div className="flex items-start gap-2">
        <span className="line-clamp-1 flex-1 text-sm font-medium leading-5 text-[var(--tinta-forte)]">
          {item.empresa}
        </span>
        {atencao && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--coral-marca)]"
                aria-label={atencao}
              />
            </TooltipTrigger>
            <TooltipContent className="estudio-portal">{atencao}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums tracking-tight">
          {formatarMoeda(item.valor)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="ml-auto size-5">
              <AvatarFallback className="bg-[var(--muted)] text-[10px] font-medium text-[var(--tinta-media)]">
                {item.iniciais}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent className="estudio-portal">{item.responsavel}</TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}

export function CartaoArrastavel({
  item, aoAbrir,
}: {
  item: Oportunidade;
  aoAbrir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { item } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="estudio-cartao"
      data-arrastando={isDragging || undefined}
      // O cartão inteiro é o alvo: arrastar move, clicar abre. O dnd-kit só
      // considera arrasto depois do limiar de distância definido no sensor,
      // então um clique curto continua sendo clique.
      onClick={aoAbrir}
      {...attributes}
      {...listeners}
    >
      <ConteudoCartao item={item} />
    </div>
  );
}
