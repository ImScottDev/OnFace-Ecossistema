"use client";

import { AlertTriangle, Clock, Flag, RefreshCw, Search, ShieldAlert, TrendingUp, Users, Wallet } from "lucide-react";

/**
 * Faixa de contexto + pulso da carteira.
 *
 * Adota a linguagem do Hero da Home (fundo escuro, radius 32, micro-labels
 * em caixa alta, lime como acento) em vez de inventar uma quinta estética
 * pro produto — é o padrão premium que o CRM2 já tem, e a consistência entre
 * Home e CS é o que faz as duas parecerem o mesmo produto.
 *
 * Hierarquia deliberada: MRR e clientes são o CONTEXTO (grandes, neutros);
 * os seis indicadores operacionais são o TRABALHO (compactos, coloridos só
 * quando há problema). Oito caixas iguais, como estava antes, não dizem ao
 * olho o que olhar primeiro.
 */

export interface PulsoCs {
  clientesAtivos: number; mrrCarteira: number; emOnboarding: number; emImplantacao: number;
  emRisco: number; inadimplentes: number; renovacoesProximas: number; expansoesAbertas: number;
  tarefasVencidas: number; checkpointsAtrasados: number; semProximaAcao: number; semDono: number;
}

export type Escopo = "todos" | "me" | "sem_dono";

export interface IndicadorCs {
  chave: string;
  label: string;
  valor: number;
  icone: React.ElementType;
  /** Problema: pinta o número. Sem isso, tudo vermelho vira nada vermelho. */
  alerta: boolean;
  rodape: string;
}

function brlCompacto(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1000)}k`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function indicadoresDoPulso(p: PulsoCs, exigemAtencao: number): IndicadorCs[] {
  return [
    { chave: "atencao", label: "Exigem atenção", valor: exigemAtencao, icone: AlertTriangle, alerta: exigemAtencao > 0, rodape: "clientes na fila" },
    { chave: "risco", label: "Em risco", valor: p.emRisco, icone: ShieldAlert, alerta: p.emRisco > 0, rodape: "sinal aberto" },
    { chave: "financeiro", label: "Inadimplentes", valor: p.inadimplentes, icone: Wallet, alerta: p.inadimplentes > 0, rodape: "cobrança irregular" },
    { chave: "checkpoint", label: "Checkpoints", valor: p.checkpointsAtrasados, icone: Flag, alerta: p.checkpointsAtrasados > 0, rodape: "atrasados" },
    { chave: "renovacao", label: "Renovações", valor: p.renovacoesProximas, icone: RefreshCw, alerta: false, rodape: "na janela" },
    { chave: "expansao", label: "Expansões", valor: p.expansoesAbertas, icone: TrendingUp, alerta: false, rodape: "em aberto" },
  ];
}

export function Cf2CsHero({
  pulso, exigemAtencao, escopo, onEscopo, busca, onBusca, segmentoAtivo, onSegmento,
}: {
  pulso?: PulsoCs;
  exigemAtencao: number;
  escopo: Escopo;
  onEscopo: (e: Escopo) => void;
  busca: string;
  onBusca: (v: string) => void;
  segmentoAtivo: string | null;
  onSegmento: (s: string | null) => void;
}) {
  const indicadores = pulso ? indicadoresDoPulso(pulso, exigemAtencao) : [];

  return (
    <div
      className="flex flex-col gap-4 px-5 sm:px-6 pt-5 pb-5"
      data-cf2-superficie="escura"
      style={{ background: "var(--cf2-home-hero-bg)", borderRadius: "28px" }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "1.6px", fontFamily: "var(--cf2-font-heading)" }}
          >
            Customer Success
          </p>
          <h1
            className="text-[22px] font-semibold leading-tight"
            style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-0.32px", fontFamily: "var(--cf2-font-heading)" }}
          >
            Visão operacional da carteira
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: "var(--cf2-home-dark-overlay)" }}>
            {([["todos", "Toda a carteira"], ["me", "Minha carteira"], ["sem_dono", "Sem responsável"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => onEscopo(k)}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors"
                style={{
                  background: escopo === k ? "var(--cf2-home-lime)" : "transparent",
                  color: escopo === k ? "var(--cf2-home-lime-ink)" : "var(--cf2-home-text-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-home-text-muted)" }} />
            <input
              value={busca}
              onChange={(e) => onBusca(e.target.value)}
              placeholder="Buscar cliente..." aria-label="Buscar cliente"
              className="h-9 pl-9 pr-3 rounded-full text-[12.5px] outline-none w-[190px]"
              style={{ background: "var(--cf2-home-dark-overlay)", color: "var(--cf2-home-text-strong)", border: "1px solid transparent" }}
            />
          </div>
        </div>
      </div>

      <div className="h-px w-full" style={{ background: "var(--cf2-home-dark-overlay)" }} />

      {/* Contexto (grande) + trabalho (compacto). */}
      <div className="flex flex-col xl:flex-row items-stretch gap-3">
        <div
          className="flex items-center gap-5 shrink-0 w-full xl:w-[365px] px-5 py-4 rounded-[22px]"
          data-cf2-superficie="escura"
          style={{ background: "var(--cf2-home-kpi-bg)" }}
        >
          <div className="min-w-0">
            <p className="text-[9.5px] uppercase" style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "0.62px" }}>MRR da carteira</p>
            <p
              className="text-[32px] font-semibold leading-none mt-1 whitespace-nowrap"
              style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-1.2px", fontFamily: "var(--cf2-font-heading)" }}
            >
              {pulso ? brlCompacto(pulso.mrrCarteira) : "—"}
            </p>
          </div>
          <div className="w-px self-stretch my-1" style={{ background: "var(--cf2-home-dark-overlay)" }} />
          <div className="min-w-0">
            <p className="text-[9.5px] uppercase" style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "0.62px" }}>Clientes</p>
            <p
              className="text-[32px] font-semibold leading-none mt-1"
              style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-1.2px", fontFamily: "var(--cf2-font-heading)" }}
            >
              {pulso ? pulso.clientesAtivos : "—"}
            </p>
            <p className="text-[10.5px] mt-1 whitespace-nowrap" style={{ color: "var(--cf2-home-text-muted)" }}>
              {pulso ? `${pulso.emOnboarding} onboarding · ${pulso.emImplantacao} implantação` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 xl:flex xl:flex-1 gap-2 min-w-0">
          {indicadores.map((ind) => {
            const Icone = ind.icone;
            const ativo = segmentoAtivo === ind.chave;
            return (
              <button
                key={ind.chave}
                onClick={() => onSegmento(ativo ? null : ind.chave)}
                className="flex flex-col gap-1.5 xl:flex-1 min-w-0 px-3 py-3 rounded-[18px] text-left transition-transform hover:-translate-y-0.5"
                // Selecionado, o fundo vira lime CLARO — aí a superfície deixa
                // de ser escura e os tokens não podem ser reescritos.
                data-cf2-superficie={ativo ? undefined : "escura"}
                style={{
                  background: ativo ? "var(--cf2-home-lime)" : "var(--cf2-home-kpi-bg)",
                  outline: ativo ? "none" : undefined,
                }}
              >
                <Icone
                  className="w-3.5 h-3.5"
                  style={{ color: ativo ? "var(--cf2-home-lime-ink)" : ind.alerta ? "var(--cf2-home-danger)" : "var(--cf2-home-text-muted)" }}
                />
                <p
                  className="text-[20px] font-semibold leading-none"
                  style={{
                    color: ativo ? "var(--cf2-home-lime-ink)" : ind.alerta ? "var(--cf2-home-danger)" : "var(--cf2-home-text-strong)",
                    fontFamily: "var(--cf2-font-heading)", letterSpacing: "-0.7px",
                  }}
                >
                  {ind.valor}
                </p>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium truncate" style={{ color: ativo ? "var(--cf2-home-lime-ink)" : "var(--cf2-home-text-strong)" }}>{ind.label}</p>
                  <p className="text-[9.5px] truncate" style={{ color: ativo ? "var(--cf2-home-lime-ink)" : "var(--cf2-home-text-muted)", opacity: ativo ? 0.75 : 1 }}>{ind.rodape}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
