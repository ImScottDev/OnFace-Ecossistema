"use client";

/**
 * O cartão de Pré-vendas.
 *
 * Contrato de leitura: 2 a 3 segundos. Quem passa o olho pela coluna precisa
 * sair sabendo QUEM é, COMO chegou, QUANDO foi tocado pela última vez, QUAL é
 * o próximo passo e SE está passando da hora. O que não responde a uma dessas
 * cinco perguntas não entra — contexto aprofundado é do painel.
 *
 * Três decisões que o cartão anterior não tinha:
 *
 * 1. **Título é o nome que identifica o registro.** Empresa quando ela existe,
 *    pessoa quando não. O cartão antigo era empresa-first puro e liderava com
 *    "Empresa não informada" em boa parte da base — um título que é a mesma
 *    frase em dezenas de cartões não identifica nada, e o nome da pessoa, que
 *    identificava, ficava na linha de apoio.
 *
 * 2. **Próxima ação é a Task real.** Vem de `tarefas`, tem id e leva até ela.
 *    Quando não existe, o cartão DIZ que não existe e oferece criar: "sem
 *    próxima ação" é o estado mais acionável do board e era invisível.
 *
 * 3. **Sinal nunca é só cor.** Atraso carrega ícone e texto; a cor é o terceiro
 *    reforço, não o único. Vale para daltonismo e vale para o monitor ruim.
 */

import Link from "next/link";
import {
  AlarmClock, AlertTriangle, Building2, CalendarClock, CalendarPlus,
  Mail, MessageCircle, MoreHorizontal, Phone, UserPlus,
} from "lucide-react";
import type { CardPreVendas } from "@/lib/vendas/consultas";
import { acaoVencida, estadoSla } from "@/lib/vendas/sla";
import { Avatar, AvatarFallback, IniciaisUsuario, NomeUsuario } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Item, ItemContent, ItemDescription, ItemFooter, ItemTitle } from "@/components/ui/item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tag } from "./ui";
import { decorrido } from "./formato";

/* ── Leitura de tempo ──────────────────────────────────────────────────── */

/**
 * Quando a próxima ação vence, em linguagem de quem opera.
 *
 * "Hoje 15:00" e "Ontem" dizem mais que "22/09 15:00" para uma data a poucos
 * dias — que é a distância em que quase toda próxima ação vive.
 */
export function quandoVence(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "Sem prazo";

  const hoje = new Date();
  const diaDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((diaDe(data) - diaDe(hoje)) / 86_400_000);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (dias === 0) return `Hoje ${hora}`;
  if (dias === 1) return `Amanhã ${hora}`;
  if (dias === -1) return `Ontem ${hora}`;
  // Abreviado porque a célula do cartão tem uma linha: "64 dias atrás" chegava
  // truncado como "64 dias at", que além de feio parecia dado corrompido.
  if (dias < -1) return `há ${Math.abs(dias)}d`;
  if (dias <= 6) return `${data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")} ${hora}`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/* ── Sinal de SLA ──────────────────────────────────────────────────────── */

const ROTULO_SLA: Record<string, string> = {
  vencendo: "SLA vencendo",
  vencido: "SLA vencido",
};

/**
 * O sinal operacional do cartão.
 *
 * Um só, e o mais grave vence. O cartão com quatro alertas empilhados não tem
 * prioridade nenhuma: vira ruído que a pessoa aprende a ignorar.
 */
function SinalDoCartao({ card }: { card: CardPreVendas }) {
  const sla = estadoSla(card.etapa, card.horasSemInteracao);
  const atrasada = acaoVencida(card.proximaAcao?.venceEm);

  if (atrasada) {
    return (
      <Badge variant="danger" className="gap-1 text-[10px] font-semibold">
        <AlarmClock className="size-3" aria-hidden />
        Ação vencida
      </Badge>
    );
  }
  if (sla === "vencido") {
    return (
      <Badge variant="danger" className="gap-1 text-[10px] font-semibold">
        <AlertTriangle className="size-3" aria-hidden />
        {ROTULO_SLA.vencido}
      </Badge>
    );
  }
  if (sla === "vencendo") {
    return (
      <Badge variant="warning" className="gap-1 text-[10px] font-semibold">
        <AlertTriangle className="size-3" aria-hidden />
        {ROTULO_SLA.vencendo}
      </Badge>
    );
  }
  return null;
}

/* ── Ações rápidas ─────────────────────────────────────────────────────── */

/**
 * As ações que aparecem no hover.
 *
 * Em repouso o cartão é leitura; sob o ponteiro ele vira superfície de
 * trabalho. Elas existem no DOM o tempo todo — escondidas por opacidade, não
 * por `display` — para continuarem alcançáveis pelo teclado, que não tem
 * hover. `stopPropagation` em todas: clicar em WhatsApp é clicar em WhatsApp,
 * não em "abrir o painel deste cartão".
 */
function AcoesRapidas({ card, aoAgir }: {
  card: CardPreVendas;
  aoAgir: (acao: "whatsapp" | "ligar" | "tarefa" | "mais", card: CardPreVendas) => void;
}) {
  const botoes = [
    { chave: "whatsapp" as const, icone: MessageCircle, rotulo: "WhatsApp", ativo: card.temWhatsapp },
    { chave: "ligar" as const, icone: Phone, rotulo: "Ligar", ativo: card.temTelefone },
    { chave: "tarefa" as const, icone: CalendarPlus, rotulo: "Nova tarefa", ativo: true },
    { chave: "mais" as const, icone: MoreHorizontal, rotulo: "Mais ações", ativo: true },
  ];

  return (
    <div className="pv-card-acoes" data-acoes>
      {botoes.filter((b) => b.ativo).map((b) => (
        <Tooltip key={b.chave}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6"
              aria-label={b.rotulo}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); aoAgir(b.chave, card); }}
            >
              <b.icone className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{b.rotulo}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/* ── Cartão ────────────────────────────────────────────────────────────── */

export function CardAquisicao({
  card, selecionado, marcado, emSelecao, aoMarcar, aoAgir,
}: {
  card: CardPreVendas;
  /** Aberto no painel. */
  selecionado: boolean;
  /** Marcado para ação em massa. */
  marcado: boolean;
  /** Board em modo de seleção: o checkbox deixa de depender do hover. */
  emSelecao: boolean;
  aoMarcar: (leadId: string, marcado: boolean) => void;
  aoAgir: (acao: "whatsapp" | "ligar" | "tarefa" | "mais", card: CardPreVendas) => void;
}) {
  const temEmpresa = card.empresa !== "Empresa não informada";
  // Empresa quando ela existe; pessoa quando não. Um título que se repete em
  // dezenas de cartões não identifica registro nenhum.
  const titulo = temEmpresa ? card.empresa : (card.pessoa ?? "Contato sem nome");
  const apoio = temEmpresa
    ? (card.pessoa ? `${card.pessoa}${card.cargo ? ` · ${card.cargo}` : ""}` : "Sem contato associado")
    : (card.cargo ?? "Empresa não informada");

  const procedencia = [card.origem, card.campanha].filter(Boolean).join(" · ");
  const acaoAtrasada = acaoVencida(card.proximaAcao?.venceEm);

  return (
    <Item
      variant="outline"
      size="sm"
      className="pv-card w-full gap-2 px-3 py-2.5 text-left data-[selecionado]:ring-2 data-[selecionado]:ring-[var(--onface-coral)]"
      data-selecionado={selecionado || undefined}
      data-marcado={marcado || undefined}
      data-em-selecao={emSelecao || undefined}
    >
      {/* Fora do fluxo, no canto: no fluxo elas comiam a largura do título. */}
      <AcoesRapidas card={card} aoAgir={aoAgir} />

      {/* ── Cabeçalho: quem é ───────────────────────────────────────────── */}
      <ItemContent className="basis-full gap-0.5">
        <div className="flex items-start gap-2">
          <span
            className="pv-card-marcar"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={marcado}
              onCheckedChange={(v) => aoMarcar(card.leadId, v === true)}
              aria-label={`Selecionar ${titulo}`}
            />
          </span>

          <div className="min-w-0 flex-1">
            <ItemTitle className="font-[family-name:var(--font-onface-display)] text-[13.5px] leading-tight font-bold [overflow-wrap:break-word] [hyphens:auto]">
              {/* Nome da empresa leva à empresa, e não ao painel: a spec §11
                  separa "trabalhar este registro" de "investigar esta conta". */}
              {temEmpresa && card.empresaId ? (
                <Link
                  href={`/empresas/${card.empresaId}`}
                  className="hover:underline"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {titulo}
                </Link>
              ) : (
                titulo
              )}
            </ItemTitle>
            <ItemDescription className="line-clamp-2 text-[11.5px] leading-snug [overflow-wrap:break-word]">
              {apoio}
            </ItemDescription>
          </div>
        </div>
      </ItemContent>

      {/* ── Procedência e interesse ─────────────────────────────────────── */}
      {procedencia || card.servicos?.length ? (
        <div className="flex min-w-0 basis-full flex-col gap-0.5">
          {procedencia ? (
            <span className="truncate text-[11px] text-muted-foreground" title={procedencia}>
              {procedencia}
            </span>
          ) : null}
          {card.servicos?.length ? (
            <span className="truncate text-[11px] font-medium" title={card.servicos.join(", ")}>
              {card.servicos.join(", ")}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ── Etiquetas de fato, não de estado de tempo ───────────────────── */}
      <div className="flex min-w-0 basis-full flex-wrap items-center gap-1 empty:hidden">
        {/* O fato Qualificado acompanha o cartão mesmo fora da coluna
            Qualificado — é o ponto da spec: ele sobrevive à etapa. */}
        {card.qualificado && card.etapa !== "qualificado" ? <Tag tom="sucesso">Qualificado</Tag> : null}
        {card.preQualificado ? <Tag tom="neutro-escuro">Pré-qualificado</Tag> : null}
        {card.nutricaoRetomarEm ? (
          <Tag tom="alerta">Retomar {new Date(card.nutricaoRetomarEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</Tag>
        ) : null}
        {card.desqualificacaoMotivo ? <Tag tom="neutro-escuro">{card.desqualificacaoMotivo}</Tag> : null}
      </div>

      {/* ── As duas linhas de tempo ─────────────────────────────────────── */}
      <dl className="pv-card-tempos basis-full">
        <div>
          <dt>Última interação</dt>
          <dd className="tabular-nums">{decorrido(card.horasSemInteracao)}</dd>
        </div>
        <div data-atrasada={acaoAtrasada || undefined} data-ausente={!card.proximaAcao || undefined}>
          <dt>Próxima ação</dt>
          <dd>
            {card.proximaAcao ? (
              // Clicar na próxima ação abre a TAREFA, não o painel do lead.
              <Link
                href={`/tarefas?tarefa=${card.proximaAcao.id}`}
                className="inline-flex items-center gap-1 hover:underline"
                title={card.proximaAcao.titulo}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <CalendarClock className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{quandoVence(card.proximaAcao.venceEm)}</span>
              </Link>
            ) : (
              <button
                type="button"
                className="pv-card-definir"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); aoAgir("tarefa", card); }}
              >
                Definir
              </button>
            )}
          </dd>
        </div>
      </dl>

      {/* ── Rodapé: dono e o sinal ──────────────────────────────────────── */}
      <ItemFooter className="gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {card.responsavelIniciais ? (
            <>
              <Avatar className="size-5">
                <AvatarFallback className="text-[9px] font-semibold">
                  <IniciaisUsuario nome={card.responsavel} iniciais={card.responsavelIniciais} />
                </AvatarFallback>
              </Avatar>
              {card.responsavel ? <NomeUsuario nome={card.responsavel.split(" ")[0]} ehAgente={undefined} className="truncate" /> : null}
            </>
          ) : (
            // Sem dono é estado acionável, não um vazio: ícone + texto, porque
            // cor sozinha não comunica.
            <span className="inline-flex items-center gap-1 text-[var(--onface-coral-texto)]">
              <UserPlus className="size-3" aria-hidden />
              Sem responsável
            </span>
          )}
        </span>

        <span className="inline-flex shrink-0 items-center gap-2">
          {card.temWhatsapp ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <MessageCircle className="size-3" aria-label="Tem WhatsApp" />
              </TooltipTrigger>
              <TooltipContent>Tem WhatsApp</TooltipContent>
            </Tooltip>
          ) : null}
          {card.temEmail ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Mail className="size-3" aria-label="Tem e-mail" />
              </TooltipTrigger>
              <TooltipContent>Tem e-mail</TooltipContent>
            </Tooltip>
          ) : null}
          {!card.empresaId ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Building2 className="size-3 opacity-40" aria-label="Sem empresa associada" />
              </TooltipTrigger>
              <TooltipContent>Sem empresa associada</TooltipContent>
            </Tooltip>
          ) : null}
          <SinalDoCartao card={card} />
        </span>
      </ItemFooter>
    </Item>
  );
}
