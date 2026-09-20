"use client";

/** Agenda do ONFACE.
 *
 * Quatro peças que resolvem a mesma pergunta em recortes diferentes: onde tem
 * compromisso no mês (`CalendarioMes`), o que acontece no dia escolhido
 * (`AgendaDoDia`), quando marcar o retorno com o lead (`Agendador`) e qual
 * janela da semana está livre (`FaixaDeHorarios`).
 *
 * As referências que o Scott mandou (schedule-3 e schedule-8 do reui) entraram
 * como estudo de COMPOSIÇÃO e comportamento: mês compacto com ponto de
 * categoria, chips de filtro, lista de horários ao lado do calendário, selects
 * de duração/recorrência e switches de convite/lembrete. O código é nosso,
 * escrito sobre os nossos tokens; a biblioteca de origem é paga e responde 401
 * sem licença, então nada de lá foi baixado ou reconstruído a partir do fonte.
 *
 * Por que a grade do mês é escrita aqui em vez de usar o `Calendar` do repo: o
 * `Calendar` é o react-day-picker com classes Tailwind em rem, e o que a agenda
 * precisa é ponto de categoria por dia, célula dimensionada em `--onface-u` e
 * foco itinerante dentro da grade. Fazer isso pelo `Calendar` seria sobrescrever
 * quase todo o mapa de `classNames` e ainda assim herdar o dimensionamento dele.
 * O `Calendar` continua sendo a escolha certa para campo de data em formulário;
 * aqui a grade é a visualização, não o input. */

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  RefreshCw,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIAS_UTEIS, HORAS, NEGOCIOS } from "./dados";
import { CURVA, DURACAO } from "./motion";
import "./agenda.css";

/* ═══ Domínio ════════════════════════════════════════════════════════════ */

export type CategoriaAgenda = "reuniao" | "ligacao" | "follow-up" | "implantacao";

/** Reunião é a categoria coral: é o compromisso que move o negócio e o que a
 *  pessoa procura quando abre o mês. O resto é apoio, em série de gráfico —
 *  `--chart-4` fica de fora de propósito, é o cinza de linha e sumiria num
 *  ponto de 6u. */
export const CATEGORIAS: Record<
  CategoriaAgenda,
  { rotulo: string; icone: LucideIcon; serie: string }
> = {
  reuniao: { rotulo: "Reunião", icone: Users, serie: "var(--chart-1)" },
  ligacao: { rotulo: "Ligação", icone: Phone, serie: "var(--chart-3)" },
  "follow-up": { rotulo: "Follow-up", icone: RefreshCw, serie: "var(--chart-2)" },
  implantacao: { rotulo: "Implantação", icone: Wrench, serie: "var(--chart-5)" },
};

export const ORDEM_CATEGORIAS: CategoriaAgenda[] = [
  "reuniao",
  "ligacao",
  "follow-up",
  "implantacao",
];

export type Participante = { nome: string; iniciais: string };

export type EventoAgenda = {
  id: string;
  /** Data local no formato `AAAA-MM-DD`. String em vez de `Date` porque o que a
   *  agenda compara é o dia civil, e `Date` arrasta fuso para dentro da chave. */
  dia: string;
  /** `HH:MM` em 24h. */
  inicio: string;
  minutos: number;
  categoria: CategoriaAgenda;
  titulo: string;
  empresa: string;
  participantes: Participante[];
};

/** "Hoje" é fixo de propósito: a documentação precisa mostrar sempre a mesma
 *  sexta cheia. Em produto isso vira `new Date()`; aqui viraria uma página que
 *  esvazia sozinha quando o mês vira. */
export const HOJE = "2026-09-18";

const MAYARA: Participante = { nome: "Mayara Ribeiro", iniciais: "MR" };
const RICARDO: Participante = { nome: "Ricardo Alves", iniciais: "RA" };
const JULIANA: Participante = { nome: "Juliana Pires", iniciais: "JP" };
const MARCOS: Participante = { nome: "Marcos Yamada", iniciais: "MY" };
const LUCAS: Participante = { nome: "Lucas Pacheco", iniciais: "LP" };

/** A empresa sai de `dados.ts` pelo id do negócio: a agenda não inventa conta
 *  que o funil não tem, e renomear um cliente lá reflete aqui. */
const POR_NEGOCIO = new Map(NEGOCIOS.map((n) => [n.id, n]));
function empresaDe(idNegocio: string) {
  return POR_NEGOCIO.get(idNegocio)?.empresa ?? "Callface";
}

/** Agenda da Mayara na semana de 14 a 25 de setembro.
 *
 * 24/09 está vazio de propósito: é o dia que prova o estado sem evento sem
 * precisar de mock paralelo. Os horários de 18/09 seguem o `proximaAcao` dos
 * negócios n-1 (16:30) e n-8 (18:00). */
export const AGENDA_MAYARA: EventoAgenda[] = [
  { id: "ev-1", dia: "2026-09-16", inicio: "09:00", minutos: 45, categoria: "reuniao", titulo: "Descoberta · migração de 12 PAs", empresa: empresaDe("n-2"), participantes: [JULIANA, MAYARA] },
  { id: "ev-2", dia: "2026-09-16", inicio: "15:00", minutos: 30, categoria: "ligacao", titulo: "Retorno sobre custo de telefonia", empresa: empresaDe("n-6"), participantes: [MAYARA] },
  { id: "ev-3", dia: "2026-09-17", inicio: "10:30", minutos: 30, categoria: "follow-up", titulo: "Follow-up do piloto de 3 meses", empresa: empresaDe("n-3"), participantes: [MARCOS, MAYARA] },
  { id: "ev-4", dia: "2026-09-17", inicio: "14:00", minutos: 60, categoria: "implantacao", titulo: "Kickoff de implantação · 8 ramais", empresa: empresaDe("n-7"), participantes: [LUCAS, MAYARA] },

  { id: "ev-5", dia: HOJE, inicio: "08:30", minutos: 30, categoria: "ligacao", titulo: "Retorno da proposta de 40 ramais", empresa: empresaDe("n-1"), participantes: [RICARDO, MAYARA] },
  { id: "ev-6", dia: HOJE, inicio: "09:30", minutos: 45, categoria: "reuniao", titulo: "Revisão de escopo · 40 ramais", empresa: empresaDe("n-1"), participantes: [RICARDO, JULIANA, MAYARA] },
  { id: "ev-7", dia: HOJE, inicio: "11:00", minutos: 30, categoria: "follow-up", titulo: "Cobrar retorno do TI", empresa: empresaDe("n-3"), participantes: [MARCOS, MAYARA] },
  { id: "ev-8", dia: HOJE, inicio: "14:00", minutos: 60, categoria: "reuniao", titulo: "Demonstração do Callface AI", empresa: empresaDe("n-8"), participantes: [JULIANA, MAYARA] },
  { id: "ev-9", dia: HOJE, inicio: "14:30", minutos: 30, categoria: "ligacao", titulo: "Retorno do contrato de revenda", empresa: empresaDe("n-4"), participantes: [MAYARA] },
  { id: "ev-10", dia: HOJE, inicio: "16:30", minutos: 30, categoria: "reuniao", titulo: "Fechamento · implantação PABX", empresa: empresaDe("n-1"), participantes: [RICARDO, MAYARA] },
  { id: "ev-11", dia: HOJE, inicio: "18:00", minutos: 30, categoria: "follow-up", titulo: "Confirmar envio da proposta", empresa: empresaDe("n-8"), participantes: [MAYARA] },

  { id: "ev-12", dia: "2026-09-21", inicio: "09:00", minutos: 60, categoria: "implantacao", titulo: "Virada de operadora · 30 ramais", empresa: empresaDe("n-9"), participantes: [LUCAS, MAYARA] },
  { id: "ev-13", dia: "2026-09-21", inicio: "11:00", minutos: 30, categoria: "ligacao", titulo: "Retorno de expansão de licenças", empresa: empresaDe("n-5"), participantes: [MAYARA] },
  { id: "ev-14", dia: "2026-09-22", inicio: "10:00", minutos: 45, categoria: "reuniao", titulo: "Apresentação para a diretoria", empresa: empresaDe("n-1"), participantes: [RICARDO, JULIANA, MAYARA] },
  { id: "ev-15", dia: "2026-09-23", inicio: "16:00", minutos: 30, categoria: "follow-up", titulo: "Reativar SDR automatizado", empresa: empresaDe("n-11"), participantes: [MAYARA] },
  { id: "ev-16", dia: "2026-09-25", inicio: "09:30", minutos: 60, categoria: "implantacao", titulo: "Treinamento da equipe de suporte", empresa: empresaDe("n-10"), participantes: [LUCAS, MAYARA] },
];

/* ═══ Datas sem biblioteca ═══════════════════════════════════════════════ */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function paraIso(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** `new Date("2026-09-18")` é lido como UTC e, a oeste de Greenwich, volta 17.
 *  Por isso a data é montada por partes, sempre local. */
function deIso(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function somaDias(iso: string, dias: number) {
  const data = deIso(iso);
  data.setDate(data.getDate() + dias);
  return paraIso(data);
}

function emMinutos(hhmm: string) {
  const [hora, minuto] = hhmm.split(":").map(Number);
  return hora * 60 + minuto;
}

function emHora(minutos: number) {
  const hora = Math.floor(minutos / 60);
  return `${String(hora).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function rotuloDia(iso: string) {
  const data = deIso(iso);
  return `${SEMANA_CURTA[data.getDay()]}, ${data.getDate()} de ${MESES[data.getMonth()]}`;
}

function rotuloCurto(iso: string) {
  const data = deIso(iso);
  return `${SEMANA_CURTA[data.getDay()]}, ${data.getDate()} ${MESES[data.getMonth()].slice(0, 3)}`;
}

function duracaoLegivel(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

function fimDoEvento(evento: EventoAgenda) {
  return emMinutos(evento.inicio) + evento.minutos;
}

function porHora(a: EventoAgenda, b: EventoAgenda) {
  return emMinutos(a.inicio) - emMinutos(b.inicio);
}

/* ═══ Estados compartilhados ═════════════════════════════════════════════ */

/** Erro de agenda não é "algo deu errado": é um bloco com o que falhou e o
 *  botão que refaz a busca, porque sem a agenda a pessoa não trabalha. */
function Erro({ texto, aoTentarDeNovo }: { texto: string; aoTentarDeNovo?: () => void }) {
  return (
    <div className="ag-erro" role="alert">
      <span className="ag-erro-figura" aria-hidden>
        <TriangleAlert />
      </span>
      <div className="ag-erro-corpo">
        <strong>Não deu para carregar a agenda</strong>
        <p>{texto}</p>
      </div>
      {aoTentarDeNovo ? (
        <Button variant="outline" size="sm" onClick={aoTentarDeNovo}>
          <RefreshCw aria-hidden />
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

/* ═══ 01 · Calendário do mês ═════════════════════════════════════════════ */

export function CalendarioMes({
  eventos = AGENDA_MAYARA,
  selecionado,
  aoSelecionar,
  hoje = HOJE,
  categorias = ORDEM_CATEGORIAS,
  mostrarPontos = true,
  carregando = false,
  erro = null,
  aoTentarDeNovo,
}: {
  eventos?: EventoAgenda[];
  selecionado: string;
  aoSelecionar: (dia: string) => void;
  hoje?: string;
  /** Categorias visíveis. Filtro apaga o ponto, nunca o dia. */
  categorias?: CategoriaAgenda[];
  mostrarPontos?: boolean;
  carregando?: boolean;
  erro?: string | null;
  aoTentarDeNovo?: () => void;
}) {
  /** Único estado da grade: o dia que tem o foco itinerante. O mês visível é
   *  derivado dele, então seta que atravessa a borda e botão de navegação usam
   *  o mesmo caminho e não podem sair de sincronia. */
  const [focado, setFocado] = React.useState(selecionado);
  const [ecoSelecionado, setEcoSelecionado] = React.useState(selecionado);
  const grade = React.useRef<HTMLDivElement>(null);
  /** Só devolve o foco ao DOM quando o movimento veio do teclado. Sem isso a
   *  grade rouba o foco de quem está digitando em outro campo da tela. */
  const moverFoco = React.useRef(false);

  /* Ajuste de estado durante a renderização (padrão do React para prop que
     muda): se o pai selecionou outro dia, o foco e o mês vão junto. Em efeito
     isso viraria render em cascata e um quadro com o mês errado. */
  if (ecoSelecionado !== selecionado) {
    setEcoSelecionado(selecionado);
    setFocado(selecionado);
  }

  const visivel = React.useMemo(() => {
    const data = deIso(focado);
    return { ano: data.getFullYear(), mes: data.getMonth() };
  }, [focado]);

  React.useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    grade.current?.querySelector<HTMLButtonElement>(`[data-dia="${focado}"]`)?.focus();
  }, [focado]);

  const porDia = React.useMemo(() => {
    const mapa = new Map<string, CategoriaAgenda[]>();
    for (const evento of eventos) {
      if (!categorias.includes(evento.categoria)) continue;
      const atuais = mapa.get(evento.dia) ?? [];
      if (!atuais.includes(evento.categoria)) atuais.push(evento.categoria);
      mapa.set(evento.dia, atuais);
    }
    return mapa;
  }, [eventos, categorias]);

  /** Semanas de sete células. A grade ARIA exige linha entre a grade e a
   *  célula; sem isso o leitor de tela anuncia 35 células soltas e some com a
   *  noção de semana. As linhas usam `display: contents` para não atrapalhar o
   *  grid CSS. */
  const semanas = React.useMemo(() => {
    const primeiro = new Date(visivel.ano, visivel.mes, 1);
    const totalDias = new Date(visivel.ano, visivel.mes + 1, 0).getDate();
    const vazias: null[] = Array.from({ length: primeiro.getDay() }, () => null);
    const dias = Array.from({ length: totalDias }, (_, i) =>
      paraIso(new Date(visivel.ano, visivel.mes, i + 1)),
    );
    const celulas: (string | null)[] = [...vazias, ...dias];
    while (celulas.length % 7 !== 0) celulas.push(null);
    return Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
  }, [visivel]);

  /** Trocar de mês move o foco itinerante para o dia 1. Sem isso nenhum botão
   *  da grade visível fica com `tabIndex = 0` e o mês novo some do Tab. */
  function irParaMes(passo: number) {
    setFocado(paraIso(new Date(visivel.ano, visivel.mes + passo, 1)));
  }

  /** Navegação por teclado da grade. Quando a seta atravessa a borda do mês, o
   *  mês visível acompanha o foco: parar na borda deixaria o dia 1 sem caminho
   *  para o mês anterior. */
  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    };
    let destino: string | null = null;

    if (evento.key in passos) destino = somaDias(focado, passos[evento.key]);
    else if (evento.key === "Home") destino = somaDias(focado, -deIso(focado).getDay());
    else if (evento.key === "End") destino = somaDias(focado, 6 - deIso(focado).getDay());
    else if (evento.key === "PageUp" || evento.key === "PageDown") {
      const atual = deIso(focado);
      const passo = evento.key === "PageUp" ? -1 : 1;
      const limite = new Date(atual.getFullYear(), atual.getMonth() + passo + 1, 0).getDate();
      destino = paraIso(
        new Date(atual.getFullYear(), atual.getMonth() + passo, Math.min(atual.getDate(), limite)),
      );
    }
    if (!destino) return;

    evento.preventDefault();
    moverFoco.current = true;
    setFocado(destino);
  }

  if (erro) return <Erro texto={erro} aoTentarDeNovo={aoTentarDeNovo} />;
  if (carregando) return <EsqueletoMes />;

  const nomeDoMes = `${MESES[visivel.mes]} de ${visivel.ano}`;

  return (
    <div className="ag-mes">
      <div className="ag-mes-topo">
        <strong className="ag-mes-nome">{nomeDoMes}</strong>
        <div className="ag-mes-nav">
          <Button variant="ghost" size="icon-sm" onClick={() => irParaMes(-1)} aria-label="Mês anterior">
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => irParaMes(1)} aria-label="Próximo mês">
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="ag-mes-semana" aria-hidden>
        {SEMANA_CURTA.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>

      <div
        className="ag-mes-grade"
        role="grid"
        aria-label={`Calendário de ${nomeDoMes}`}
        ref={grade}
        onKeyDown={aoTeclar}
      >
        {semanas.map((semana, linha) => (
          <div key={`semana-${linha}`} className="ag-mes-linha" role="row">
            {semana.map((dia, coluna) =>
              dia === null ? (
                <span key={`vazia-${linha}-${coluna}`} className="ag-dia-vazia" role="gridcell" />
              ) : (
                <button
                  key={dia}
                  type="button"
                  role="gridcell"
                  className="ag-dia"
                  data-dia={dia}
                  data-hoje={dia === hoje ? "true" : undefined}
                  data-selecionado={dia === selecionado ? "true" : undefined}
                  tabIndex={dia === focado ? 0 : -1}
                  aria-selected={dia === selecionado}
                  aria-label={`${rotuloDia(dia)}${
                    porDia.get(dia)?.length
                      ? `, ${porDia.get(dia)?.length} tipo de compromisso`
                      : ", sem compromisso"
                  }`}
                  onClick={() => {
                    setFocado(dia);
                    aoSelecionar(dia);
                  }}
                >
                  <span className="ag-dia-numero">{deIso(dia).getDate()}</span>
                  {mostrarPontos ? (
                    <span className="ag-dia-pontos" aria-hidden>
                      {(porDia.get(dia) ?? [])
                        .slice()
                        .sort((a, b) => ORDEM_CATEGORIAS.indexOf(a) - ORDEM_CATEGORIAS.indexOf(b))
                        .map((categoria) => (
                          <i key={categoria} style={{ background: CATEGORIAS[categoria].serie }} />
                        ))}
                    </span>
                  ) : null}
                </button>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** O esqueleto tem a forma da grade: sete colunas, seis linhas e o cabeçalho.
 *  Retângulo único avisaria "carregando" e ainda faria a página pular quando o
 *  mês chegasse. */
function EsqueletoMes() {
  return (
    <div className="ag-mes" role="status">
      <span className="sr-only">Carregando calendário</span>
      <div className="ag-mes-topo" aria-hidden>
        <Skeleton className="ag-esq-titulo" />
        <Skeleton className="ag-esq-nav" />
      </div>
      <div className="ag-mes-semana" aria-hidden>
        {SEMANA_CURTA.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>
      <div className="ag-mes-grade" aria-hidden>
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="ag-esq-dia" />
        ))}
      </div>
    </div>
  );
}

/** Legenda dos pontos. Ponto sem legenda é enfeite: ninguém adivinha que coral
 *  é reunião. */
export function LegendaCategorias({
  ativas,
  aoAlternar,
}: {
  /** Sem `ativas` a legenda é só leitura; com `ativas` ela vira filtro. */
  ativas?: CategoriaAgenda[];
  aoAlternar?: (categoria: CategoriaAgenda) => void;
}) {
  return (
    <div className="ag-legenda">
      {ORDEM_CATEGORIAS.map((categoria) => {
        const info = CATEGORIAS[categoria];
        const ligada = !ativas || ativas.includes(categoria);
        if (!aoAlternar) {
          return (
            <span key={categoria} className="ag-legenda-item">
              <i style={{ background: info.serie }} aria-hidden />
              {info.rotulo}
            </span>
          );
        }
        return (
          <button
            key={categoria}
            type="button"
            className="ds-chip-filtro ag-chip"
            data-ativo={ligada ? "true" : undefined}
            aria-pressed={ligada}
            onClick={() => aoAlternar(categoria)}
          >
            {/* Chip desligado perde a cor junto com o resto: ponto colorido em
                chip apagado sugere que o filtro continua valendo. */}
            <i
              className="ag-chip-ponto"
              style={{ background: ligada ? info.serie : "var(--onface-line)" }}
              aria-hidden
            />
            {info.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/* ═══ 02 · Agenda do dia ═════════════════════════════════════════════════ */

/** Agrupa eventos que dividem a mesma janela.
 *
 * O grupo é o que permite mostrar conflito lado a lado em vez de empilhar um
 * por cima do outro: dois compromissos às 14h são dois cartões visíveis, não um
 * cartão e um problema escondido. */
function agrupaSobrepostos(eventos: EventoAgenda[]) {
  const ordenados = [...eventos].sort(porHora);
  const grupos: EventoAgenda[][] = [];
  let fimDoGrupo = -1;

  for (const evento of ordenados) {
    const grupoAtual = grupos[grupos.length - 1];
    if (grupoAtual && emMinutos(evento.inicio) < fimDoGrupo) {
      grupoAtual.push(evento);
      fimDoGrupo = Math.max(fimDoGrupo, fimDoEvento(evento));
    } else {
      grupos.push([evento]);
      fimDoGrupo = fimDoEvento(evento);
    }
  }
  return grupos;
}

export function AgendaDoDia({
  dia,
  eventos = AGENDA_MAYARA,
  categorias = ORDEM_CATEGORIAS,
  aoAbrir,
  aoAgendar,
  carregando = false,
  erro = null,
  aoTentarDeNovo,
}: {
  dia: string;
  eventos?: EventoAgenda[];
  categorias?: CategoriaAgenda[];
  aoAbrir?: (evento: EventoAgenda) => void;
  aoAgendar?: () => void;
  carregando?: boolean;
  erro?: string | null;
  aoTentarDeNovo?: () => void;
}) {
  const reduzido = useReducedMotion();
  const doDia = eventos.filter((e) => e.dia === dia && categorias.includes(e.categoria));
  const grupos = agrupaSobrepostos(doDia);
  const ocupacao = doDia.reduce((soma, e) => soma + e.minutos, 0);

  if (erro) return <Erro texto={erro} aoTentarDeNovo={aoTentarDeNovo} />;

  return (
    <div className="ag-dia-painel">
      <div className="ag-dia-topo">
        <div>
          <strong className="ag-dia-titulo">{rotuloDia(dia)}</strong>
          <p className="ag-dia-apoio">
            {carregando
              ? "Carregando compromissos…"
              : doDia.length === 0
                ? "Nenhum compromisso"
                : `${doDia.length} compromissos · ${duracaoLegivel(ocupacao)} ocupados`}
          </p>
        </div>
        {aoAgendar ? (
          <Button variant="outline" size="sm" onClick={aoAgendar}>
            <CalendarDays aria-hidden />
            Agendar
          </Button>
        ) : null}
      </div>

      {carregando ? (
        <div className="ag-dia-lista" role="status">
          <span className="sr-only">Carregando agenda do dia</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="ag-evento" aria-hidden>
              <Skeleton className="ag-esq-hora" />
              <div className="ag-esq-corpo">
                <Skeleton className="ag-esq-linha" />
                <Skeleton className="ag-esq-linha ag-esq-linha-curta" />
              </div>
            </div>
          ))}
        </div>
      ) : doDia.length === 0 ? (
        <div className="ds-vazio">
          <span className="ds-vazio-figura">
            <CalendarX2 aria-hidden />
          </span>
          <strong>Dia livre</strong>
          <p>
            Nenhum compromisso em {rotuloDia(dia)}. Bom dia para puxar os negócios parados na etapa
            Proposta antes que eles esfriem.
          </p>
          {aoAgendar ? (
            <div className="ds-linha" style={{ marginTop: "var(--space-8)" }}>
              <Button size="sm" onClick={aoAgendar}>
                <CalendarDays aria-hidden />
                Agendar retorno
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="ag-dia-lista">
          {grupos.map((grupo) => (
            <li
              key={grupo[0].id}
              className="ag-grupo"
              data-conflito={grupo.length > 1 ? "true" : undefined}
            >
              {grupo.length > 1 ? (
                <p className="ag-conflito-aviso">
                  <TriangleAlert aria-hidden />
                  {grupo.length} compromissos na mesma janela
                </p>
              ) : null}
              <div className="ag-grupo-itens" data-colunas={Math.min(grupo.length, 2)}>
                {grupo.map((evento, indice) => (
                  <motion.article
                    key={evento.id}
                    className="ag-evento"
                    data-categoria={evento.categoria}
                    initial={reduzido ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: DURACAO.base,
                      ease: CURVA.entrada,
                      delay: reduzido ? 0 : indice * 0.03,
                    }}
                  >
                    <div className="ag-evento-hora">
                      <strong>{evento.inicio}</strong>
                      <span>{duracaoLegivel(evento.minutos)}</span>
                    </div>
                    <div className="ag-evento-corpo">
                      <span className="ag-evento-tipo">
                        <i style={{ background: CATEGORIAS[evento.categoria].serie }} aria-hidden />
                        {CATEGORIAS[evento.categoria].rotulo}
                      </span>
                      <strong className="ag-evento-titulo">{evento.titulo}</strong>
                      <small className="ag-evento-empresa">{evento.empresa}</small>
                      <div className="ag-evento-rodape">
                        <span className="ag-avatares">
                          {evento.participantes.map((pessoa) => (
                            <i key={pessoa.nome} title={pessoa.nome} aria-hidden>
                              {pessoa.iniciais}
                            </i>
                          ))}
                          <span className="sr-only">
                            Participantes: {evento.participantes.map((p) => p.nome).join(", ")}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            aoAbrir
                              ? aoAbrir(evento)
                              : toast.message(evento.titulo, {
                                  description: `${rotuloCurto(evento.dia)} · ${evento.inicio} · ${evento.empresa}`,
                                })
                          }
                        >
                          Abrir
                        </Button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ═══ 03 · Agendador ═════════════════════════════════════════════════════ */

const DURACOES = [15, 30, 45, 60] as const;
type Duracao = (typeof DURACOES)[number];

const RECORRENCIAS = {
  nunca: "Não repete",
  semanal: "Toda semana",
  quinzenal: "A cada 15 dias",
} as const;
type Recorrencia = keyof typeof RECORRENCIAS;

const EXPEDIENTE_INICIO = emMinutos("08:00");
const EXPEDIENTE_FIM = emMinutos("18:30");
const PASSO_SLOT = 30;

/** Horários que cabem na duração escolhida sem bater em compromisso existente.
 *  Recalcular por duração é o ponto: 60 min oferece bem menos janela que 15, e
 *  mostrar slot que não cabe é convidar para o conflito. */
function horariosLivres(dia: string, duracao: number, eventos: EventoAgenda[], reservados: string[]) {
  const ocupados = eventos.filter((e) => e.dia === dia);
  const livres: string[] = [];

  for (let inicio = EXPEDIENTE_INICIO; inicio + duracao <= EXPEDIENTE_FIM; inicio += PASSO_SLOT) {
    const fim = inicio + duracao;
    const colide = ocupados.some((e) => inicio < fimDoEvento(e) && fim > emMinutos(e.inicio));
    const hora = emHora(inicio);
    if (!colide && !reservados.includes(`${dia}|${hora}`)) livres.push(hora);
  }
  return livres;
}

export function Agendador({
  eventos = AGENDA_MAYARA,
  diaInicial = HOJE,
}: {
  eventos?: EventoAgenda[];
  diaInicial?: string;
}) {
  const [dia, setDia] = React.useState(diaInicial);
  const [duracao, setDuracao] = React.useState<Duracao>(30);
  const [recorrencia, setRecorrencia] = React.useState<Recorrencia>("nunca");
  const [convite, setConvite] = React.useState(true);
  const [lembrete, setLembrete] = React.useState(true);
  const [escolhido, setEscolhido] = React.useState<string | null>(null);
  /** Chave `dia|hora`: o horário some da lista do dia em que foi marcado, não
   *  de todos os dias. */
  const [reservados, setReservados] = React.useState<string[]>([]);
  const grupoHorarios = React.useRef<HTMLDivElement>(null);

  const livres = horariosLivres(dia, duracao, eventos, reservados);

  /** Radiogroup de verdade: quem chegou aqui pelo Tab escolhe com as setas, sem
   *  precisar sair e voltar. Mover o foco já marca a opção, que é o
   *  comportamento esperado de rádio. */
  function navegarHorarios(evento: React.KeyboardEvent<HTMLDivElement>) {
    const passo =
      evento.key === "ArrowRight" || evento.key === "ArrowDown"
        ? 1
        : evento.key === "ArrowLeft" || evento.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0) return;

    evento.preventDefault();
    const atual = escolhido ? livres.indexOf(escolhido) : -1;
    const proximo =
      atual === -1 ? livres[0] : livres[(atual + passo + livres.length) % livres.length];
    if (!proximo) return;
    setEscolhido(proximo);
    grupoHorarios.current?.querySelector<HTMLButtonElement>(`[data-hora="${proximo}"]`)?.focus();
  }

  /* Trocar de dia ou de duração invalida a escolha anterior: o slot das 14:30
     de 30 min pode nem existir em 60 min. Limpar no próprio handler evita o
     quadro intermediário em que o resumo mostra um horário que sumiu da lista. */
  function trocarDia(novo: string) {
    setDia(novo);
    setEscolhido(null);
  }
  function trocarDuracao(nova: Duracao) {
    setDuracao(nova);
    setEscolhido(null);
  }

  function confirmar() {
    if (!escolhido) return;
    const resumo = [
      rotuloCurto(dia),
      escolhido,
      duracaoLegivel(duracao),
      recorrencia === "nunca" ? null : RECORRENCIAS[recorrencia].toLowerCase(),
      convite ? "convite enviado" : "sem convite",
      lembrete ? "lembrete 1h antes" : "sem lembrete",
    ]
      .filter(Boolean)
      .join(" · ");

    setReservados((atuais) => [...atuais, `${dia}|${escolhido}`]);
    setEscolhido(null);
    toast.success("Retorno agendado", { description: resumo });
  }

  return (
    <div className="ag-agendador">
      <div className="ag-agendador-calendario">
        <CalendarioMes eventos={eventos} selecionado={dia} aoSelecionar={trocarDia} />
      </div>

      <div className="ag-agendador-painel">
        <div className="ag-campo">
          <span className="ag-campo-rotulo" id="ag-horarios-rotulo">
            Horários livres em {rotuloCurto(dia)}
          </span>
          {livres.length === 0 ? (
            <p className="ag-sem-horario">
              Nenhuma janela de {duracaoLegivel(duracao)} neste dia. Reduza a duração ou escolha
              outra data no calendário.
            </p>
          ) : (
            <div
              className="ag-horarios"
              role="radiogroup"
              aria-labelledby="ag-horarios-rotulo"
              ref={grupoHorarios}
              onKeyDown={navegarHorarios}
            >
              {livres.map((hora) => (
                <button
                  key={hora}
                  type="button"
                  role="radio"
                  data-hora={hora}
                  aria-checked={escolhido === hora}
                  tabIndex={escolhido === hora || (!escolhido && hora === livres[0]) ? 0 : -1}
                  className="ag-horario"
                  onClick={() => setEscolhido(hora)}
                >
                  {hora}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ag-agendador-linha">
          <div className="ag-campo">
            <Label htmlFor="ag-duracao" className="ag-campo-rotulo">
              Duração
            </Label>
            <Select
              value={String(duracao)}
              onValueChange={(valor) => trocarDuracao(Number(valor) as Duracao)}
            >
              <SelectTrigger id="ag-duracao" size="sm" className="ag-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURACOES.map((valor) => (
                  <SelectItem key={valor} value={String(valor)}>
                    {duracaoLegivel(valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ag-campo">
            <Label htmlFor="ag-recorrencia" className="ag-campo-rotulo">
              Recorrência
            </Label>
            <Select
              value={recorrencia}
              onValueChange={(valor) => setRecorrencia(valor as Recorrencia)}
            >
              <SelectTrigger id="ag-recorrencia" size="sm" className="ag-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RECORRENCIAS) as Recorrencia[]).map((chave) => (
                  <SelectItem key={chave} value={chave}>
                    {RECORRENCIAS[chave]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="ag-opcoes">
          <span className="ag-opcao">
            <Switch id="ag-convite" checked={convite} onCheckedChange={setConvite} />
            <Label htmlFor="ag-convite">Enviar convite por e-mail</Label>
          </span>
          <span className="ag-opcao">
            <Switch id="ag-lembrete" checked={lembrete} onCheckedChange={setLembrete} />
            <Label htmlFor="ag-lembrete">Lembrete 1h antes</Label>
          </span>
        </div>

        <div className="ag-agendador-rodape">
          <p className="ag-resumo">
            <Clock aria-hidden />
            {escolhido
              ? `${rotuloCurto(dia)} · ${escolhido} · ${duracaoLegivel(duracao)}`
              : "Escolha um horário para confirmar"}
          </p>
          <Button size="sm" disabled={!escolhido} onClick={confirmar}>
            Confirmar retorno
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══ 04 · Faixa de horários da semana ═══════════════════════════════════ */

/** Leitura semanal: cinco dias contra as faixas de hora do expediente.
 *
 * Serve para escolher janela antes de escolher horário exato — é a pergunta
 * "quando essa semana aguenta uma reunião de uma hora", que o mês não responde
 * e a agenda do dia responde tarde demais. */
export function FaixaDeHorarios({
  eventos = AGENDA_MAYARA,
  /** Segunda-feira da semana mostrada. */
  inicioSemana = somaDias(HOJE, -4),
  aoEscolher,
}: {
  eventos?: EventoAgenda[];
  inicioSemana?: string;
  aoEscolher?: (dia: string, hora: string) => void;
}) {
  const [janela, setJanela] = React.useState<{ dia: string; hora: string } | null>(null);

  const dias = DIAS_UTEIS.map((rotulo, indice) => ({
    rotulo,
    iso: somaDias(inicioSemana, indice),
  }));

  function ocupadoEm(dia: string, faixa: string) {
    const inicio = Number(faixa.replace("h", "")) * 60;
    const fim = inicio + 60;
    return eventos.some(
      (e) => e.dia === dia && inicio < fimDoEvento(e) && fim > emMinutos(e.inicio),
    );
  }

  return (
    <div className="ag-faixa">
      <div
        className="ag-faixa-grade"
        style={{ "--ag-colunas": dias.length } as React.CSSProperties}
      >
        <span className="ag-faixa-canto" aria-hidden />
        {dias.map((dia) => (
          <span key={dia.iso} className="ag-faixa-dia">
            {dia.rotulo}
            <small>{deIso(dia.iso).getDate()}</small>
          </span>
        ))}

        {HORAS.map((faixa) => (
          <React.Fragment key={faixa}>
            <span className="ag-faixa-hora">{faixa}</span>
            {dias.map((dia) => {
              const ocupado = ocupadoEm(dia.iso, faixa);
              const escolhida = janela?.dia === dia.iso && janela.hora === faixa;
              return (
                <button
                  key={`${dia.iso}-${faixa}`}
                  type="button"
                  className="ag-faixa-celula"
                  data-ocupado={ocupado ? "true" : undefined}
                  data-escolhida={escolhida ? "true" : undefined}
                  disabled={ocupado}
                  aria-pressed={escolhida}
                  aria-label={`${rotuloCurto(dia.iso)}, ${faixa}, ${ocupado ? "ocupado" : "livre"}`}
                  onClick={() => {
                    setJanela({ dia: dia.iso, hora: faixa });
                    aoEscolher?.(dia.iso, faixa);
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <p className="ag-faixa-rodape" aria-live="polite">
        {janela
          ? `Janela escolhida: ${rotuloCurto(janela.dia)}, ${janela.hora}`
          : "Clique em uma faixa livre para escolher a janela."}
      </p>
    </div>
  );
}
