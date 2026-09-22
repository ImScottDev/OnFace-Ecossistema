"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle, ArrowRight, ArrowUpRight, Bell, Briefcase, CalendarDays,
  CheckCircle2, ChevronRight, CircleDashed, Clock, DollarSign, Headphones,
  Copy, LifeBuoy, ListChecks, MessageCircle, MoreVertical, Plus, Rocket, Sprout,
  TrendingUp, UserPlus, Users, Video, Wallet, Wrench, X,
} from "lucide-react";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "../shell/OnfacePage";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type {
  AbaPainel, Agenda, CompromissoAgenda, DadosVisaoGeral, EstadoEtapa, Grafico,
  JornadaChave, MetaMes, Metrica, Operacao, Pendencia, Pendencias,
} from "./types";
import "./visao-geral.css";

const ICONES_METRICA = {
  receita: TrendingUp,
  operacoes: Briefcase,
  clientes: Users,
  faturamento: Wallet,
} as const;

const ICONES_AREA = {
  operacao: Briefcase,
  comercial: Users,
  financeiro: TrendingUp,
  suporte: Bell,
} as const;


const COR_SERIE = { coral: "#fe4f2b", azul: "#3b82f6", cinza: "#8b949e" } as const;

/* Selos padronizados.
 *
 * O ícone da etapa vem do ESTADO, não do nome da etapa: `pipelines.stages` é
 * configurável por tenant, então mapear ícone por nome de etapa quebraria na
 * primeira instância que renomeasse "Proposta". A jornada, essa sim, é um
 * conjunto fechado e pode ter ícone próprio. */
const ICONES_ESTADO = {
  andamento: CircleDashed,
  aguardando: Clock,
  alerta: AlertCircle,
  concluida: CheckCircle2,
} as const;

const ICONES_JORNADA = {
  "Pré-vendas": Headphones,
  Vendas: Briefcase,
  "Implantação": Wrench,
  Onboarding: Rocket,
  Financeiro: DollarSign,
} as const;

/** A marca do Nexo onde ele fala. Círculo laranja vazio não identifica
 * ninguém: quando é o assistente, é o rosto dele que aparece. */
function MarcaNexo({ tamanho = "md" }: { tamanho?: "sm" | "md" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ovg-marca-nexo" data-tamanho={tamanho} src="/onface/oni/oni-avatar.png" alt="" aria-hidden />
  );
}

function SeloEtapa({ etapa, estado }: { etapa: string; estado: EstadoEtapa }) {
  const Icone = ICONES_ESTADO[estado];
  return (
    <span className="ovg-selo" data-estado={estado}>
      <Icone className="ovg-selo-icone" size={13} strokeWidth={2} aria-hidden />
      {etapa}
    </span>
  );
}

function SeloJornada({ jornada }: { jornada: JornadaChave }) {
  const Icone = ICONES_JORNADA[jornada] ?? ListChecks;
  return (
    <span className="ovg-selo" data-variante="jornada">
      <Icone className="ovg-selo-icone" size={13} strokeWidth={2} aria-hidden />
      {jornada}
    </span>
  );
}

/** Curva de Catmull-Rom convertida em Bézier: a referência traz linhas com
 * inflexões suaves, não polilinhas duras. */
function caminhoSuave(pontos: Array<[number, number]>) {
  if (pontos.length < 2) return "";
  let d = `M ${pontos[0][0]} ${pontos[0][1]}`;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const p0 = pontos[i - 1] ?? pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function CartaoMetrica({ metrica, ordem }: { metrica: Metrica; ordem: number }) {
  const Icone = ICONES_METRICA[metrica.icone];
  return (
    <article className="ovg-metric" data-rise style={{ "--ovg-delay": ordem + 1 } as React.CSSProperties}>
      <Icone className="ovg-metric-icon" size={22} strokeWidth={1.75} aria-hidden />
      <p className="ovg-metric-label">{metrica.label}</p>
      <p className="ovg-metric-value">{metrica.valor}</p>
      <div className="ovg-metric-foot">
        {metrica.delta ? (
          <span className="ovg-badge" data-tendencia={metrica.tendencia}>{metrica.delta}</span>
        ) : null}
        <p className="ovg-metric-apoio">{metrica.apoio}</p>
      </div>
    </article>
  );
}

const VB = { w: 640, h: 210, padTop: 12, padBottom: 10 };

function GraficoEvolucao({ grafico, meta }: { grafico: Grafico; meta: MetaMes | null }) {
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [foco, setFoco] = useState<number | null>(null);
  const visiveis = grafico.series.filter((s) => !ocultas.includes(s.chave));
  const passo = VB.w / (grafico.periodos.length - 1);
  const alturaUtil = VB.h - VB.padTop - VB.padBottom;

  const caminhos = useMemo(
    () =>
      grafico.series.map((serie) => ({
        serie,
        d: caminhoSuave(
          serie.pontos.map((valor, i) => [i * passo, VB.padTop + alturaUtil * (1 - valor)] as [number, number]),
        ),
      })),
    [grafico.series, passo, alturaUtil],
  );

  const alternar = (chave: string) =>
    setOcultas((atual) => (atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]));

  const pctFoco = foco === null ? 0 : (foco / (grafico.periodos.length - 1)) * 100;

  return (
    <section className="ovg-panel ovg-chart-card" data-rise style={{ "--ovg-delay": 5 } as React.CSSProperties}>
      <header className="ovg-panel-head">
        <div>
          <h2 className="ovg-panel-title">{grafico.titulo}</h2>
          <p className="ovg-panel-sub">{grafico.subtitulo}</p>
        </div>
        <div className="ovg-chart-legend">
          {grafico.series.map((serie) => (
            <button
              key={serie.chave}
              type="button"
              className="ovg-legend-item"
              data-off={ocultas.includes(serie.chave)}
              onClick={() => alternar(serie.chave)}
              aria-pressed={!ocultas.includes(serie.chave)}
            >
              <span className="ovg-legend-dot" data-cor={serie.cor} aria-hidden />
              {serie.label}
            </button>
          ))}
        </div>
      </header>

      <div className="ovg-chart" onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" role="img" aria-label={`${grafico.titulo}: ${grafico.subtitulo}`}>
          <g className="ovg-chart-grid">
            {[0, 1, 2, 3].map((i) => {
              const y = VB.padTop + (alturaUtil / 3) * i;
              return <line key={i} x1={0} y1={y} x2={VB.w} y2={y} />;
            })}
          </g>
          {caminhos.map(({ serie, d }, i) =>
            ocultas.includes(serie.chave) ? null : (
              <path
                key={serie.chave}
                className="ovg-chart-line"
                data-anim="true"
                d={d}
                stroke={COR_SERIE[serie.cor]}
                strokeDasharray={serie.tracejada ? "6 5" : undefined}
                style={{ "--len": 1400, animationDelay: `${260 + i * 140}ms` } as React.CSSProperties}
              />
            ),
          )}
          {/* Os marcadores existem sempre: eles dizem quantos pontos a série
              tem. O hover só engorda o do mês em foco. */}
          {visiveis.map((serie) =>
            serie.pontos.map((valor, i) => (
              <circle
                key={`${serie.chave}-${i}`}
                cx={i * passo}
                cy={VB.padTop + alturaUtil * (1 - valor)}
                r={foco === i ? 5 : 3.5}
                fill={COR_SERIE[serie.cor]}
                stroke="#161b22"
                strokeWidth={2}
              />
            )),
          )}
        </svg>

        {foco !== null ? <div className="ovg-chart-cursor" style={{ left: `${pctFoco}%` }} aria-hidden /> : null}

        {foco !== null && visiveis.length ? (
          <div
            className="ovg-chart-tooltip"
            style={foco > grafico.periodos.length / 2 ? { right: `${100 - pctFoco + 2}%` } : { left: `${pctFoco + 2}%` }}
          >
            <strong>{grafico.periodos[foco]}</strong>
            <ul>
              {visiveis.map((serie) => (
                <li key={serie.chave}>
                  <span className="ovg-legend-dot" data-cor={serie.cor} aria-hidden />
                  <span>{serie.label}</span>
                  <span>{serie.rotulos[foco]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Uma faixa por mês, centrada no ponto: a faixa dividida em partes
            iguais deslocava o cursor meia célula do rótulo. */}
        <div className="ovg-chart-hit">
          {grafico.periodos.map((periodo, i) => {
            const centro = (i / (grafico.periodos.length - 1)) * 100;
            const meia = 100 / (grafico.periodos.length - 1) / 2;
            return (
              <button
                key={periodo}
                type="button"
                aria-label={`Ver ${periodo}`}
                style={{
                  left: `${Math.max(0, centro - meia)}%`,
                  right: `${Math.max(0, 100 - centro - meia)}%`,
                }}
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
              />
            );
          })}
        </div>
      </div>

      {/* Cada rótulo fica exatamente sob o seu ponto. Distribuir por
          space-between jogava o último mês meia célula para dentro. */}
      <div className="ovg-chart-axis" aria-hidden>
        {grafico.periodos.map((periodo, i) => (
          <span
            key={periodo}
            data-ativo={foco === i}
            style={{ left: `${(i / (grafico.periodos.length - 1)) * 100}%` }}
          >
            {periodo}
          </span>
        ))}
      </div>

      {/* Meta vive junto da receita: número sem alvo não diz se o mês está bom. */}
      {meta ? (
        <div className="ovg-meta">
          <div className="ovg-meta-topo">
            <span className="ovg-meta-titulo">{meta.titulo}</span>
            <span className="ovg-meta-valor">{meta.valor}</span>
            <span className="ovg-meta-pct">{meta.atingidoPct}%</span>
          </div>
          <div
            className="ovg-meta-track"
            role="progressbar"
            aria-label={meta.titulo}
            aria-valuenow={meta.atingidoPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="ovg-meta-fill" style={{ width: `${meta.atingidoPct}%` }} />
          </div>
          <p className="ovg-meta-apoio">{meta.apoio}</p>
        </div>
      ) : null}
    </section>
  );
}

function Assistente({
  dados,
  aoVerPrioridades,
}: {
  dados: DadosVisaoGeral["assistente"];
  aoVerPrioridades: () => void;
}) {
  return (
    <aside className="ovg-assistant" data-rise style={{ "--ovg-delay": 6 } as React.CSSProperties}>
      {/* O mascote faz parte do card: entra à direita, escurecido, cortado
          pelas bordas — não é um avatar solto nem um fundo decorativo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ovg-assistant-mascote" src="/onface/oni/oni-mascote.png" alt="" aria-hidden />

      <header className="ovg-assistant-head">
        <div className="ovg-assistant-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/onface/oni/oni-avatar.png" alt="" aria-hidden />
          <span className="ovg-assistant-online" aria-hidden />
        </div>
        <div>
          <h2 className="ovg-assistant-name">{dados.nome}</h2>
          <p className="ovg-assistant-sign">{dados.assinatura}</p>
        </div>
        {/* A engrenagem de configuração saiu: não tinha handler nenhum e não
            há tela de configuração do NEXO para levar a lugar nenhum. Volta
            quando `/automacoes/nexo` existir. */}
      </header>

      <p className="ovg-assistant-greeting">{dados.saudacao}</p>
      <p className="ovg-assistant-highlight">
        <b>{dados.destaqueQuantidade}</b> {dados.destaqueTexto}
      </p>

      <button type="button" className="ovg-assistant-cta" onClick={aoVerPrioridades}>
        {dados.ctaLabel}
        <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
      </button>

      {/* "Gerar resumo" e "Analisar gargalos" saíram daqui.
       *
       * Eram dois `<button>` sem `onClick`: clicar não fazia nada. Verificado
       * no navegador em 22/09 clicando um a um e observando URL, DOM e rede —
       * nenhum dos três mudava. É a UI cenográfica que o produto proíbe, e
       * doía mais aqui do que em qualquer outro lugar: são as duas ações mais
       * chamativas da tela de entrada.
       *
       * Não têm para onde apontar: as duas dependem do runtime do NEXO, que
       * não existe (mesmo bloqueio registrado na casca e na navegação).
       * `dados.acoes` continua vindo do servidor e volta a ser renderizado
       * junto com as ações de verdade.
       *
       * O CTA principal acima FICA: `aoVerPrioridades` funciona e leva à aba
       * de prioridades, que é dado real. */}
    </aside>
  );
}

/** O card muda de conteúdo conforme o tipo do registro selecionado.
 *
 * O esqueleto é sempre o mesmo (identidade, progresso, sinal, indicadores), o
 * que evita uma tela diferente por tipo; o que muda é o que cada zona mostra.
 * Um lead recém-chegado não tem "progresso por frente", e um cliente em
 * operação não tem "previsão de fechamento". */
function DetalheOperacao({ operacao }: { operacao: Operacao }) {
  const { detalhe } = operacao;
  return (
    <section className="ovg-detail">
      <header className="ovg-detail-head">
        <div>
          <h2 className="ovg-panel-title">{detalhe.tituloCard}</h2>
          <p className="ovg-panel-sub">{detalhe.subtituloCard}</p>
        </div>
        <Link className="ovg-ghost-btn" href="/clientes">
          Abrir registro
          <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </header>

      <div className="ovg-detail-company">
        <div>
          <div className="ovg-detail-company-line">
            <h3 className="ovg-detail-company-name">{operacao.empresa}</h3>
            <span className="ovg-tipo">{detalhe.tipoLabel}</span>
          </div>
          <p className="ovg-detail-company-sub">{detalhe.servico}</p>
        </div>
        <div className="ovg-owner">
          <span className="ovg-owner-avatar" aria-hidden>{detalhe.responsavelIniciais}</span>
          <div>
            <p className="ovg-owner-label">Responsável</p>
            <p className="ovg-owner-name">{detalhe.responsavel}</p>
            <p className="ovg-owner-role">{detalhe.responsavelCargo}</p>
          </div>
        </div>
      </div>

      <div className="ovg-progresso">
        <p className="ovg-progresso-titulo">{detalhe.progresso.titulo}</p>
        <div className="ovg-steps">
          {detalhe.progresso.itens.map((item) => (
            <article key={item.chave} className="ovg-step" data-tom={item.tom ?? "neutro"}>
              <p className="ovg-step-label">{item.label}</p>
              {typeof item.pct === "number" ? (
                <>
                  <p className="ovg-step-value">{item.pct}%</p>
                  <div
                    className="ovg-step-track"
                    role="progressbar"
                    aria-label={item.label}
                    aria-valuenow={item.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="ovg-step-fill" style={{ width: `${item.pct}%` }} />
                  </div>
                </>
              ) : (
                <p className="ovg-step-estado">
                  <span className="ovg-step-dot" aria-hidden />
                  {item.estado}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>

      {/* A faixa do assistente só aparece quando há sinal real. Um aviso que
          aparece sempre deixa de ser aviso. */}
      {detalhe.sinal ? (
        <div className="ovg-insight">
          <MarcaNexo />
          <div>
            <p className="ovg-insight-title">{detalhe.sinal.titulo}</p>
            <p className="ovg-insight-text">{detalhe.sinal.texto}</p>
          </div>
          <Link className="ovg-insight-link" href={detalhe.sinal.acaoHref}>
            {detalhe.sinal.acaoLabel} ›
          </Link>
        </div>
      ) : (
        <p className="ovg-sem-sinal">Nada travando este registro agora.</p>
      )}

      <div className="ovg-detail-foot">
        {detalhe.indicadores.map((indicador) => (
          <div key={indicador.label}>
            <p className="ovg-foot-label">{indicador.label}</p>
            <p className="ovg-foot-value" data-tom={indicador.tom ?? "neutro"}>
              {indicador.tom === "positivo" ? "↑ " : indicador.tom === "negativo" ? "↓ " : ""}
              {indicador.valor}
            </p>
            {indicador.apoio ? <p className="ovg-foot-apoio">{indicador.apoio}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

const ICONES_AREA_PENDENCIA = {
  financeiro: DollarSign,
  vendas: TrendingUp,
  onboarding: Rocket,
  cs: LifeBuoy,
  atendimento: Headphones,
  implantacao: Wrench,
} as const;

const ICONES_COMPROMISSO = {
  reuniao: Video,
  "follow-up": Clock,
  kickoff: Rocket,
  interna: Users,
} as const;

const ROTULO_STATUS = {
  confirmado: "Confirmado",
  pendente: "Aguardando",
  cancelado: "Cancelado",
  "no-show": "No-show",
} as const;

const ESTADO_SELO_STATUS = {
  confirmado: "concluida",
  pendente: "aguardando",
  cancelado: "alerta",
  "no-show": "alerta",
} as const;

type ModoCompromisso = "detalhe" | "reagendar" | "participante" | "lembrete" | "cancelar";

/** Ações de um compromisso.
 *
 * O compromisso vive no calendário do Microsoft 365; esta janela é o controle
 * remoto dele. Cancelamento por parte do cliente não é só "cancelado": é o
 * evento que alimenta a régua de no-show, por isso a pergunta de quem cancelou
 * é obrigatória em vez de opcional. */
function JanelaCompromisso({
  compromisso, aoFechar, aoAtualizar,
}: {
  compromisso: CompromissoAgenda;
  aoFechar: () => void;
  aoAtualizar: (mudanca: Partial<CompromissoAgenda>) => void;
}) {
  const [modo, setModo] = useState<ModoCompromisso>("detalhe");
  const [aviso, setAviso] = useState<string | null>(null);
  const [data, setData] = useState(compromisso.data);
  const [hora, setHora] = useState(compromisso.hora);
  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [quemCancelou, setQuemCancelou] = useState<"cliente" | "equipe">("cliente");

  const contato = compromisso.contatoCliente;
  const encerrado = compromisso.status === "cancelado" || compromisso.status === "no-show";

  const copiarLink = async () => {
    if (!compromisso.linkReuniao) return;
    try {
      await navigator.clipboard.writeText(compromisso.linkReuniao);
      setAviso("Link copiado.");
    } catch {
      setAviso("Não consegui copiar. Copie manualmente pelo campo acima.");
    }
  };

  const mensagemLembrete = contato
    ? `Olá, ${contato.nome.split(" ")[0]}. Passando para confirmar nossa ${compromisso.titulo.toLowerCase()} ${compromisso.data === new Date().toISOString().slice(0, 10) ? "hoje" : "amanhã"} às ${compromisso.hora}.`
    : "";

  const adicionarParticipante = (evento: React.FormEvent) => {
    evento.preventDefault();
    const nome = nomeNovo.trim();
    const email = emailNovo.trim();
    if (!nome || !email) return;
    const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    aoAtualizar({
      participantes: [
        ...compromisso.participantes,
        { id: `p-${Date.now()}`, nome, email, iniciais, externo: !email.endsWith("@callface.ai"), confirmado: false },
      ],
    });
    setNomeNovo("");
    setEmailNovo("");
    setAviso(`Convite para ${nome} enviado pelo calendário.`);
    setModo("detalhe");
  };

  const reagendar = (evento: React.FormEvent) => {
    evento.preventDefault();
    aoAtualizar({ data, hora, status: "pendente" });
    setAviso("Novo horário proposto. Os participantes precisam confirmar de novo.");
    setModo("detalhe");
  };

  const cancelar = (evento: React.FormEvent) => {
    evento.preventDefault();
    aoAtualizar({
      // Cancelamento do cliente é no-show: é esse registro que alimenta a régua
      // de recuperação, e não pode virar um "cancelado" genérico.
      status: quemCancelou === "cliente" ? "no-show" : "cancelado",
      cancelamento: { por: quemCancelou, motivo: motivo.trim() || "Sem motivo informado", quando: "agora" },
    });
    setAviso(
      quemCancelou === "cliente"
        ? "Cancelado pelo cliente e registrado como no-show."
        : "Reunião cancelada. Os participantes serão avisados.",
    );
    setModo("detalhe");
  };

  return (
    <Dialog open onOpenChange={(estado) => { if (!estado) aoFechar(); }}>
      <DialogContent className="ovg-janela" showCloseButton={false}>
        <DialogHeader className="ovg-janela-head">
          <div>
            <span className="ovg-selo" data-estado={ESTADO_SELO_STATUS[compromisso.status]}>
              {ROTULO_STATUS[compromisso.status]}
            </span>
            <DialogTitle className="ovg-janela-titulo">{compromisso.titulo}</DialogTitle>
            <DialogDescription className="ovg-janela-sub">
              {compromisso.cliente} · {compromisso.hora} · {compromisso.duracao}
            </DialogDescription>
          </div>
          <button type="button" className="ovg-fechar" onClick={aoFechar} aria-label="Fechar">
            <X size={15} strokeWidth={2} aria-hidden />
          </button>
        </DialogHeader>

        {compromisso.cancelamento ? (
          <p className="ovg-janela-cancelado">
            {compromisso.cancelamento.por === "cliente" ? "Cancelado pelo cliente" : "Cancelado pela equipe"}
            {" · "}{compromisso.cancelamento.motivo}
          </p>
        ) : (
          <p className="ovg-janela-desc">{compromisso.descricao}</p>
        )}

        {modo === "detalhe" ? (
          <>
            <div className="ovg-janela-participantes">
              <p className="ovg-progresso-titulo">
                Participantes
                <span>{compromisso.participantes.length}</span>
              </p>
              <ul>
                {compromisso.participantes.map((pessoa) => (
                  <li key={pessoa.id}>
                    <span className="ovg-avatar-mini">{pessoa.iniciais}</span>
                    <span className="ovg-part-nome">
                      {pessoa.nome}
                      <small>{pessoa.email}</small>
                    </span>
                    <span className="ovg-part-tag" data-externo={pessoa.externo}>
                      {pessoa.externo ? "Cliente" : "Interno"}
                    </span>
                    <span className="ovg-part-status" data-ok={pessoa.confirmado}>
                      {pessoa.confirmado ? "Confirmou" : "Sem resposta"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {compromisso.linkReuniao ? (
              <div className="ovg-janela-link">
                <span>{compromisso.linkReuniao}</span>
                <button type="button" onClick={copiarLink}>
                  <Copy size={13} strokeWidth={2} aria-hidden />
                  Copiar
                </button>
              </div>
            ) : (
              <p className="ovg-sem-sinal">Compromisso presencial, sem link de reunião.</p>
            )}

            <div className="ovg-janela-acoes">
              {compromisso.linkReuniao && !encerrado ? (
                <a className="ovg-acao-btn" href={compromisso.linkReuniao} target="_blank" rel="noreferrer">
                  <Video size={14} strokeWidth={2} aria-hidden />
                  Entrar na reunião
                </a>
              ) : null}
              <button type="button" className="ovg-ghost-btn" onClick={() => setModo("participante")} disabled={encerrado}>
                <UserPlus size={13} strokeWidth={2} aria-hidden />
                Incluir participante
              </button>
              <button type="button" className="ovg-ghost-btn" onClick={() => setModo("reagendar")} disabled={encerrado}>
                <CalendarDays size={13} strokeWidth={2} aria-hidden />
                Alterar data e hora
              </button>
              {contato ? (
                <button type="button" className="ovg-ghost-btn" onClick={() => setModo("lembrete")} disabled={encerrado}>
                  <MessageCircle size={13} strokeWidth={2} aria-hidden />
                  Lembrete no WhatsApp
                </button>
              ) : null}
              <button type="button" className="ovg-ghost-btn ovg-btn-perigo" onClick={() => setModo("cancelar")} disabled={encerrado}>
                <X size={13} strokeWidth={2} aria-hidden />
                Cancelar reunião
              </button>
            </div>
          </>
        ) : null}

        {modo === "participante" ? (
          <form className="ovg-janela-form" onSubmit={adicionarParticipante}>
            <label>
              Nome
              <input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome de quem entra" />
            </label>
            <label>
              E-mail
              <input value={emailNovo} onChange={(e) => setEmailNovo(e.target.value)} placeholder="email@empresa.com" type="email" />
            </label>
            <div className="ovg-janela-acoes">
              <button type="submit" className="ovg-acao-btn" disabled={!nomeNovo.trim() || !emailNovo.trim()}>Convidar</button>
              <button type="button" className="ovg-ghost-btn" onClick={() => setModo("detalhe")}>Voltar</button>
            </div>
          </form>
        ) : null}

        {modo === "reagendar" ? (
          <form className="ovg-janela-form" onSubmit={reagendar}>
            <label>
              Data
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label>
              Hora
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
            <p className="ovg-janela-nota">
              Ao mudar o horário, o convite volta para aguardando e todo mundo confirma de novo.
            </p>
            <div className="ovg-janela-acoes">
              <button type="submit" className="ovg-acao-btn">Propor novo horário</button>
              <button type="button" className="ovg-ghost-btn" onClick={() => setModo("detalhe")}>Voltar</button>
            </div>
          </form>
        ) : null}

        {modo === "lembrete" && contato ? (
          <div className="ovg-janela-form">
            <p className="ovg-janela-nota">
              Vai para {contato.nome} ({contato.telefone}).
            </p>
            <p className="ovg-janela-preview">{mensagemLembrete}</p>
            <div className="ovg-janela-acoes">
              <a
                className="ovg-acao-btn"
                href={`https://wa.me/${contato.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(mensagemLembrete)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => { setAviso("Lembrete aberto no WhatsApp."); setModo("detalhe"); }}
              >
                <MessageCircle size={14} strokeWidth={2} aria-hidden />
                Abrir no WhatsApp
              </a>
              <button type="button" className="ovg-ghost-btn" onClick={() => setModo("detalhe")}>Voltar</button>
            </div>
          </div>
        ) : null}

        {modo === "cancelar" ? (
          <form className="ovg-janela-form" onSubmit={cancelar}>
            <fieldset className="ovg-janela-escolha">
              <legend>Quem cancelou?</legend>
              <label data-marcado={quemCancelou === "cliente"}>
                <input type="radio" name="quem" checked={quemCancelou === "cliente"} onChange={() => setQuemCancelou("cliente")} />
                O cliente
                <small>Entra como no-show no histórico da conta.</small>
              </label>
              <label data-marcado={quemCancelou === "equipe"}>
                <input type="radio" name="quem" checked={quemCancelou === "equipe"} onChange={() => setQuemCancelou("equipe")} />
                Nós
                <small>Cancelamento interno, sem no-show.</small>
              </label>
            </fieldset>
            <label>
              Motivo
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="O que aconteceu" />
            </label>
            <div className="ovg-janela-acoes">
              <button type="submit" className="ovg-acao-btn ovg-btn-perigo-cheio">Confirmar cancelamento</button>
              <button type="button" className="ovg-ghost-btn" onClick={() => setModo("detalhe")}>Voltar</button>
            </div>
          </form>
        ) : null}

        {aviso ? <p className="ovg-janela-aviso" role="status">{aviso}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Espelho do calendário do Microsoft 365. */
function PainelAgenda({ agenda }: { agenda: Agenda }) {
  const [blocos, setBlocos] = useState(agenda.blocos);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const aberto = blocos.flatMap((b) => b.compromissos).find((c) => c.id === abertoId) ?? null;

  const atualizar = (id: string, mudanca: Partial<CompromissoAgenda>) => {
    setBlocos((atual) =>
      atual.map((bloco) => ({
        ...bloco,
        compromissos: bloco.compromissos.map((c) => (c.id === id ? { ...c, ...mudanca } : c)),
      })),
    );
  };

  return (
    <div className="ovg-agenda">
      <section className="ovg-card ovg-agenda-lista">
        <header className="ovg-card-head">
          <div>
            <h2 className="ovg-card-title">{agenda.titulo}</h2>
            <p className="ovg-card-sub">{agenda.subtitulo}</p>
          </div>
          <Link className="ovg-table-link" href={agenda.linkHref}>{agenda.linkLabel} ›</Link>
        </header>

        <div className="ovg-agenda-blocos">
          {blocos.map((bloco) => (
            <div key={bloco.chave} className="ovg-agenda-bloco">
              <p className="ovg-agenda-dia">
                {bloco.label}
                <span>{bloco.apoio}</span>
              </p>
              {bloco.compromissos.map((item) => {
                const Icone = ICONES_COMPROMISSO[item.tipo];
                const encerrado = item.status === "cancelado" || item.status === "no-show";
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="ovg-compromisso"
                    data-encerrado={encerrado}
                    onClick={() => setAbertoId(item.id)}
                  >
                    <span className="ovg-compromisso-hora">
                      <strong>{item.hora}</strong>
                      <small>{item.duracao}</small>
                    </span>
                    <span className="ovg-compromisso-corpo">
                      <span className="ovg-compromisso-titulo">{item.titulo}</span>
                      <span className="ovg-compromisso-meta">
                        <Icone size={12} strokeWidth={2} aria-hidden />
                        {item.cliente}
                        {item.online ? " · online" : " · presencial"}
                      </span>
                    </span>
                    <span className="ovg-compromisso-gente" aria-hidden>
                      {item.participantes.slice(0, 3).map((pessoa) => (
                        <span key={pessoa.id} className="ovg-avatar-mini">{pessoa.iniciais}</span>
                      ))}
                    </span>
                    <span className="ovg-selo" data-estado={ESTADO_SELO_STATUS[item.status]}>
                      {ROTULO_STATUS[item.status]}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <div className="ovg-agenda-lado">
        {agenda.proximo ? (
          <section className="ovg-detail ovg-proximo">
            <p className="ovg-proximo-rotulo">{agenda.proximo.rotulo}</p>
            <h3 className="ovg-proximo-titulo">{agenda.proximo.titulo}</h3>
            <p className="ovg-proximo-cliente">{agenda.proximo.cliente}</p>
            <p className="ovg-proximo-quando">
              <CalendarDays size={14} strokeWidth={2} aria-hidden />
              {agenda.proximo.quando}
            </p>
            <div className="ovg-proximo-gente">
              {agenda.proximo.participantes.map((pessoa) => (
                <span key={pessoa}>{pessoa}</span>
              ))}
            </div>
            <button type="button" className="ovg-assistant-cta ovg-proximo-cta" onClick={() => setAbertoId("ag-1")}>
              Abrir compromisso
              <ArrowRight size={16} strokeWidth={2.25} aria-hidden />
            </button>
          </section>
        ) : null}

        <section className="ovg-card">
          <h3 className="ovg-card-title">Resumo do dia</h3>
          <div className="ovg-summary">
            {agenda.resumoDia.map((linha) => (
              <div key={linha.label} className="ovg-summary-row">
                <span className="ovg-summary-label">{linha.label}</span>
                <span className="ovg-summary-value" data-tom={linha.tom ?? "neutro"}>{linha.valor}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {aberto ? (
        <JanelaCompromisso
          compromisso={aberto}
          aoFechar={() => setAbertoId(null)}
          aoAtualizar={(mudanca) => atualizar(aberto.id, mudanca)}
        />
      ) : null}
    </div>
  );
}

/** Lista densa de esperas. Sem seleção, a tabela ocupa a largura toda; ao
 * escolher um item ela cede espaço para o resumo da atividade, que é sempre
 * ligada a um registro (lead, negócio, cliente ou entrega). */
function PainelPendencias({ pendencias }: { pendencias: Pendencias }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const item = pendencias.itens.find((p) => p.id === selecionada) ?? null;

  return (
    <div className="ovg-pendencias" data-aberto={item !== null}>
      <section className="ovg-card ovg-pend-tabela">
        <header className="ovg-card-head">
          <div>
            <h2 className="ovg-card-title">{pendencias.titulo}</h2>
            <p className="ovg-card-sub">{pendencias.subtitulo}</p>
          </div>
          <span className="ovg-contador">{pendencias.itens.length}</span>
        </header>

        <div className="ovg-pend-head" aria-hidden>
          <span>Prioridade</span>
          <span>Área</span>
          <span>Item</span>
          <span>Cliente</span>
          <span>Prazo</span>
          <span>Responsável</span>
          <span>Ação</span>
        </div>

        <div className="ovg-pend-linhas">
          {pendencias.itens.map((p) => {
            const IconeArea = ICONES_AREA_PENDENCIA[p.area];
            return (
              <div key={p.id} className="ovg-pend-linha" data-selected={p.id === selecionada}>
                <button
                  type="button"
                  className="ovg-pend-abrir"
                  onClick={() => setSelecionada(p.id === selecionada ? null : p.id)}
                  aria-expanded={p.id === selecionada}
                >
                  <span className="ovg-nivel" data-nivel={p.prioridade}>
                    <span className="ovg-nivel-dot" aria-hidden />
                    {p.prioridade === "critico" ? "Crítico" : p.prioridade === "alto" ? "Alto" : "Moderado"}
                  </span>
                  <span className="ovg-pend-area">
                    <IconeArea size={14} strokeWidth={1.9} aria-hidden />
                    {p.areaLabel}
                  </span>
                  <span className="ovg-pend-item">
                    <span className="ovg-pend-titulo">{p.titulo}</span>
                    <span className="ovg-pend-desc">{p.descricao}</span>
                  </span>
                  <span className="ovg-pend-cliente">{p.cliente}</span>
                  <span className="ovg-pend-prazo" data-tom={p.prazoTom}>
                    <Clock size={12} strokeWidth={2} aria-hidden />
                    {p.prazoTexto}
                  </span>
                  <span className="ovg-pend-dono">
                    {p.responsavelIniciais ? (
                      <>
                        <span className="ovg-avatar-mini">{p.responsavelIniciais}</span>
                        {p.responsavel}
                      </>
                    ) : (
                      <span className="ovg-sem-dono">Sem responsável</span>
                    )}
                  </span>
                </button>
                <span className="ovg-pend-acao">
                  <Link className="ovg-acao-btn" href={p.acaoHref}>{p.acaoLabel}</Link>
                  <span className="ovg-acao-mais" aria-hidden><MoreVertical size={14} strokeWidth={2} /></span>
                </span>
              </div>
            );
          })}
        </div>

        {pendencias.sugestaoNexo ? (
          <footer className="ovg-pend-nexo">
            <MarcaNexo tamanho="sm" />
            <p>Nexo: {pendencias.sugestaoNexo}</p>
            <ArrowRight size={14} strokeWidth={2} aria-hidden />
          </footer>
        ) : null}
      </section>

      {item ? <ResumoAtividade pendencia={item} aoFechar={() => setSelecionada(null)} /> : null}
    </div>
  );
}

function ResumoAtividade({ pendencia, aoFechar }: { pendencia: Pendencia; aoFechar: () => void }) {
  const { detalhe } = pendencia;
  return (
    <aside className="ovg-detail ovg-atividade">
      <header className="ovg-atividade-head">
        <div>
          <p className="ovg-owner-label">Resumo da atividade</p>
          <h3 className="ovg-atividade-titulo">{pendencia.titulo}</h3>
        </div>
        <button type="button" className="ovg-fechar" onClick={aoFechar} aria-label="Fechar resumo">
          <X size={15} strokeWidth={2} aria-hidden />
        </button>
      </header>

      <p className="ovg-atividade-desc">{pendencia.descricao}</p>

      {/* Toda atividade nasce ligada a um registro: é esse vínculo que dá
          sentido a ela, e é por aqui que se chega ao cadastro completo. */}
      <Link className="ovg-vinculo" href={detalhe.vinculo.href}>
        <span className="ovg-vinculo-tipo">{detalhe.vinculo.tipo}</span>
        <span className="ovg-vinculo-nome">{detalhe.vinculo.nome}</span>
        <span className="ovg-vinculo-apoio">{detalhe.vinculo.apoio}</span>
        <ArrowUpRight className="ovg-vinculo-seta" size={15} strokeWidth={2} aria-hidden />
      </Link>

      <div className="ovg-atividade-campos">
        {detalhe.campos.map((campo) => (
          <div key={campo.label}>
            <p className="ovg-foot-label">{campo.label}</p>
            <p className="ovg-foot-value">{campo.valor}</p>
          </div>
        ))}
      </div>

      <div className="ovg-atividade-bloco">
        <p className="ovg-progresso-titulo">Histórico</p>
        <ol className="ovg-historico">
          {detalhe.historico.map((h) => (
            <li key={h.quando}>
              <span className="ovg-historico-quando">{h.quando}</span>
              <span className="ovg-historico-texto">{h.texto}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="ovg-insight">
        <MarcaNexo />
        <div>
          <p className="ovg-insight-title">Próximo passo</p>
          <p className="ovg-insight-text">{detalhe.proximoPasso}</p>
        </div>
      </div>

      <p className="ovg-atividade-rodape">
        Criada em {detalhe.criadaEm} por {detalhe.criadaPor} · atualizada {detalhe.atualizadaEm}
      </p>

      <div className="ovg-atividade-acoes">
        <Link className="ovg-acao-btn" href={pendencia.acaoHref}>{pendencia.acaoLabel}</Link>
        <Link className="ovg-ghost-btn" href={detalhe.vinculo.href}>
          Abrir {detalhe.vinculo.tipo.toLowerCase()} completo
          <ArrowUpRight size={13} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </aside>
  );
}

export function VisaoGeral({ dados }: { dados: DadosVisaoGeral }) {
  const [aba, setAba] = useState<AbaPainel>("prioridades");
  const [selecionada, setSelecionada] = useState(dados.operacoes[0]?.id ?? "");

  const operacaoAtiva = dados.operacoes.find((o) => o.id === selecionada) ?? dados.operacoes[0];

  const verPrioridades = () => {
    setAba("prioridades");
    document.getElementById("operacoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <OnfacePage className="ovg">
      <OnfacePageBand className="ovg-hero">
        <div className="ovg-hero-grid">
          <div className="ovg-hero-main">
            <div className="ovg-hero-top">
              <div className="ovg-greeting" data-rise>
                <div>
                  <h1 className="ovg-greeting-title">{dados.saudacao}</h1>
                  <p className="ovg-greeting-date">{dados.data}</p>
                </div>
                <div className="ovg-greeting-actions">
                  <Link className="ovg-cta" href={dados.ctaPrincipal.href}>
                    <Plus size={15} strokeWidth={2.5} aria-hidden />
                    {dados.ctaPrincipal.label}
                  </Link>
                  <p className="ovg-tagline">
                    {dados.tagline.map((linha) => (
                      <span key={linha}>{linha}</span>
                    ))}
                  </p>
                </div>
              </div>

              {dados.metricas.map((metrica, i) => (
                <CartaoMetrica key={metrica.chave} metrica={metrica} ordem={i} />
              ))}
            </div>

            <div className="ovg-hero-bottom">
              <GraficoEvolucao grafico={dados.grafico} meta={dados.meta} />

              <section className="ovg-panel" data-rise style={{ "--ovg-delay": 6 } as React.CSSProperties}>
                <header className="ovg-panel-head">
                  <div>
                    <h2 className="ovg-panel-title">{dados.areas.titulo}</h2>
                    <p className="ovg-panel-sub">{dados.areas.subtitulo}</p>
                  </div>
                  {dados.areas.linkHref && dados.areas.linkLabel ? (
                    <Link className="ovg-panel-link" href={dados.areas.linkHref}>
                      {dados.areas.linkLabel} ›
                    </Link>
                  ) : null}
                </header>

                <div className="ovg-areas-grid">
                  {dados.areas.itens.map((area) => {
                    const Icone = ICONES_AREA[area.icone];
                    return (
                      <Link key={area.chave} className="ovg-area" data-destaque={area.destaque ?? false} href={area.href}>
                        <Icone className="ovg-area-icon" size={20} strokeWidth={1.75} aria-hidden />
                        <div>
                          <p className="ovg-area-label">{area.label}</p>
                          <p className="ovg-area-state">{area.estado} ›</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <Assistente dados={dados.assistente} aoVerPrioridades={verPrioridades} />
        </div>
      </OnfacePageBand>

      <div className="ovg-filters-wrap">
        {/* As abas trocam o assunto do painel, não filtram a mesma lista. */}
        <div className="ovg-filters" role="tablist" aria-label="Painel da operação">
          {dados.abas.map((item) => (
            <button
              key={item.chave}
              type="button"
              role="tab"
              className="ovg-filter"
              data-active={aba === item.chave}
              aria-selected={aba === item.chave}
              onClick={() => setAba(item.chave)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <OnfacePageSurface className="ovg-board" id="operacoes" sobreposto>
        {aba === "prioridades" ? (
          <div className="ovg-board-grid">
            {operacaoAtiva ? <DetalheOperacao operacao={operacaoAtiva} /> : null}

            {operacaoAtiva ? (
              <section className="ovg-card">
                <h2 className="ovg-card-title">Resumo</h2>
                <p className="ovg-card-sub">Informações principais da operação.</p>
                <div className="ovg-summary">
                  {operacaoAtiva.detalhe.resumo.map((linha) => (
                    <div key={linha.label} className="ovg-summary-row">
                      <span className="ovg-summary-label">{linha.label}</span>
                      {linha.selo ? (
                        <span className="ovg-chip" data-selo={linha.selo}>{linha.valor}</span>
                      ) : (
                        <span className="ovg-summary-value">{linha.valor}</span>
                      )}
                    </div>
                  ))}
                  <div className="ovg-summary-row">
                    <span className="ovg-summary-label">Tags</span>
                    <span className="ovg-tags">
                      {operacaoAtiva.detalhe.tags.map((tag) => (
                        <span key={tag} className="ovg-tag">{tag}</span>
                      ))}
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="ovg-card">
              <h2 className="ovg-card-title">Operações prioritárias</h2>
              <p className="ovg-card-sub">Suas operações mais relevantes no momento.</p>

              <div className="ovg-table">
                <div className="ovg-table-head" aria-hidden>
                  <span>Empresa</span>
                  <span>Etapa</span>
                  <span>Jornada</span>
                  <span />
                </div>

                <div className="ovg-rows">
                  {dados.operacoes.map((operacao) => (
                    <button
                      key={operacao.id}
                      type="button"
                      className="ovg-row"
                      data-selected={operacao.id === operacaoAtiva?.id}
                      onClick={() => setSelecionada(operacao.id)}
                    >
                      <span className="ovg-row-company">{operacao.empresa}</span>
                      <span>
                        <SeloEtapa etapa={operacao.etapa} estado={operacao.etapaEstado} />
                      </span>
                      <span>
                        <SeloJornada jornada={operacao.jornada} />
                      </span>
                      <ChevronRight className="ovg-row-chevron" size={16} strokeWidth={2} aria-hidden />
                    </button>
                  ))}
                </div>

                <footer className="ovg-table-foot">
                  <span className="ovg-table-contagem">
                    {dados.operacoes.length} operações em acompanhamento
                  </span>
                  <Link className="ovg-table-link" href={dados.listaCompleta.href}>
                    {dados.listaCompleta.label} ›
                  </Link>
                </footer>
              </div>
            </section>
          </div>
        ) : null}

        {aba === "agenda" ? <PainelAgenda agenda={dados.agenda} /> : null}
        {aba === "pendencias" ? <PainelPendencias pendencias={dados.pendencias} /> : null}
      </OnfacePageSurface>
    </OnfacePage>
  );
}
