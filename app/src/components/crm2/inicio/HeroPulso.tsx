import Link from "next/link";
import {
  Plus, Flag, CalendarDays, Inbox, Sparkles, ArrowUp, ArrowDown,
  Wallet, Layers, Building2, Rocket, Server,
} from "lucide-react";
import { iniciaisEmpresa, corAvatarEmpresa } from "@/components/crm2/shared/avatar";

/**
 * Hero da Home — saudação + "Pulso da operação" (Figma 559:2304).
 *
 * Reproduz o recorte do desenho: bloco escuro que sangra até as bordas do
 * conteúdo, cantos arredondados só embaixo, e uma "abinha" central que
 * desce abaixo da borda pra abrigar o badge de Equipe. No Figma isso é um
 * path SVG único; aqui é o próprio container + um bloco absoluto de mesma
 * cor logo abaixo — mesma geometria, sem depender de asset exportado que
 * não escala com a largura real da tela.
 */

export interface KpiCard {
  label: string;
  valor: string;
  rodape: string;
  icone: "wallet" | "layers" | "empresa" | "rocket" | "server" | "inbox";
  href: string;
  /** Badge de tendência — omitido quando não há sinal real pra mostrar. */
  tendencia?: { texto: string; direcao: "up" | "down"; tom: "positivo" | "negativo" };
}

const ICONES = {
  wallet: Wallet, layers: Layers, empresa: Building2,
  rocket: Rocket, server: Server, inbox: Inbox,
} as const;

const acaoBase = "flex items-center justify-center gap-2 h-10 rounded-full text-[14px] whitespace-nowrap";

export function Cf2HeroPulso({
  eyebrow, saudacao, subtitulo, kpiHero, kpis, equipe,
}: {
  eyebrow: string;
  saudacao: string;
  subtitulo: string;
  kpiHero: KpiCard;
  kpis: KpiCard[];
  equipe: { id: string; nome: string }[];
}) {
  const IconeHero = ICONES[kpiHero.icone];

  return (
    <div className="relative">
      <div
        className="flex flex-col gap-4 px-4 sm:px-6 pt-5 sm:pt-6 pb-6"
        style={{ background: "var(--cf2-home-hero-bg)", borderRadius: "32px" }}
      >
        {/* ── Saudação + ações ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <p
              className="text-[10px] sm:text-[11px] font-semibold uppercase truncate"
              style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "1.6px", fontFamily: "var(--cf2-font-heading)" }}
            >
              {eyebrow}
            </p>
            <h1
              className="text-[22px] sm:text-[28px] font-semibold leading-tight sm:leading-[35px]"
              style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-0.32px", fontFamily: "var(--cf2-font-heading)" }}
            >
              {saudacao}
            </h1>
            <p className="text-[12.5px] sm:text-[13.5px]" style={{ color: "var(--cf2-home-text-muted)" }}>{subtitulo}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link
              href="/negocios/novo"
              className={`${acaoBase} px-4 font-semibold`}
              style={{
                background: "var(--cf2-home-lime)", color: "var(--cf2-home-lime-ink)",
                boxShadow: "0px 2px 5px rgba(166,230,53,0.5)",
              }}
            >
              <Plus className="w-4 h-4" /> Novo negócio
            </Link>
            <Link
              href="/tarefas"
              className={`${acaoBase} px-4`}
              style={{ background: "#ffffff", border: "1px solid #e2e4e8", color: "var(--cf2-home-ink)" }}
            >
              <Flag className="w-[15px] h-[15px]" /> Criar tarefa
            </Link>
            <Link
              href="/calendario" aria-label="Abrir calendário"
              className={`${acaoBase} w-10`}
              style={{ background: "#ffffff", border: "1px solid #e2e4e8", color: "var(--cf2-home-ink)" }}
            >
              <CalendarDays className="w-[17px] h-[17px]" />
            </Link>
            <Link
              href="/atendimento" aria-label="Abrir atendimento"
              className={`${acaoBase} w-10`}
              style={{ background: "#ffffff", border: "1px solid #e2e4e8", color: "var(--cf2-home-ink)" }}
            >
              <Inbox className="w-[17px] h-[17px]" />
            </Link>
          </div>
        </div>

        <div className="h-px w-full" style={{ background: "var(--cf2-home-dark-overlay)" }} />

        {/* ── Label da seção ── */}
        <div className="flex items-center gap-2.5">
          <span
            className="flex items-center justify-center w-6 h-6 rounded-xl shrink-0"
            style={{ background: "var(--cf2-home-dark-overlay)" }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--cf2-home-text-muted)" }} />
          </span>
          <p className="text-[15px]" style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-0.61px" }}>Pulso da operação</p>
          <p className="text-[12px] truncate" style={{ color: "var(--cf2-home-text-muted)" }}>· Visão da empresa inteira · clique para abrir</p>
        </div>

        {/* ── KPIs ── No desktop é a faixa única do desenho (hero fixo +
            5 compactos); abaixo de xl vira grade, senão os 6 cards ficariam
            espremidos a ponto de cortar os valores. ── */}
        <div className="flex flex-col xl:flex-row items-stretch gap-3">
          <Link
            href={kpiHero.href}
            className="flex flex-col gap-1 shrink-0 w-full xl:w-[350px] pt-[15px] px-5 sm:px-6 pb-5 sm:pb-6 rounded-[28px] transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--cf2-home-kpi-bg)" }}
          >
            <div className="flex items-center justify-between">
              <span
                className="flex items-center justify-center w-9 h-9 rounded-[14px]"
                style={{ background: "var(--cf2-home-dark-overlay)" }}
              >
                <IconeHero className="w-4 h-4" style={{ color: "var(--cf2-home-lime-soft)" }} />
              </span>
              {kpiHero.tendencia && (
                <span
                  className="flex items-center gap-1 py-1 px-2.5 rounded-[20px] text-[12px] font-medium"
                  style={{ background: "rgba(182,240,74,0.1)", color: "var(--cf2-home-lime-soft)" }}
                >
                  {kpiHero.tendencia.direcao === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {kpiHero.tendencia.texto}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              <p className="text-[10px] uppercase" style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "0.62px" }}>{kpiHero.label}</p>
              <p
                className="text-[38px] font-semibold leading-none"
                style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-1.2px", fontFamily: "var(--cf2-font-heading)" }}
              >
                {kpiHero.valor}
              </p>
              <p className="text-[12px]" style={{ color: "var(--cf2-home-text-muted)" }}>{kpiHero.rodape}</p>
            </div>
          </Link>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:flex xl:flex-1 gap-3 min-w-0">
            {kpis.map((k) => {
              const Icone = ICONES[k.icone];
              const tomCor = k.tendencia?.tom === "negativo" ? "var(--cf2-home-danger)" : "var(--cf2-home-positive)";
              return (
                <Link
                  key={k.label}
                  href={k.href}
                  className="flex flex-col gap-2.5 xl:flex-1 min-w-0 p-4 rounded-[28px] transition-transform hover:-translate-y-0.5"
                  style={{ background: "var(--cf2-home-kpi-bg)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-[10px] shrink-0"
                      style={{ background: "var(--cf2-home-dark-overlay)" }}
                    >
                      <Icone className="w-3.5 h-3.5" style={{ color: "var(--cf2-home-text-muted)" }} />
                    </span>
                    {k.tendencia && (
                      <span className="flex items-center gap-[3px] text-[11px] whitespace-nowrap" style={{ color: tomCor }}>
                        {k.tendencia.direcao === "up" ? <ArrowUp className="w-[11px] h-[11px]" /> : <ArrowDown className="w-[11px] h-[11px]" />}
                        {k.tendencia.texto}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-[3px] min-w-0">
                    <p className="text-[9.5px] uppercase" style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "0.62px" }}>{k.label}</p>
                    <p
                      className="text-[18px] sm:text-[20px] font-semibold leading-none"
                      style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-0.7px", fontFamily: "var(--cf2-font-heading)" }}
                    >
                      {k.valor}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--cf2-home-text-muted)" }}>{k.rodape}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Abinha central com o badge de Equipe (geometria do header-bg do
          Figma: 182×33, cantos inferiores 20px, mesma cor do hero) ── */}
      {equipe.length > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full flex items-center justify-center gap-2.5 h-[33px] px-4"
          style={{ background: "var(--cf2-home-hero-bg)", borderRadius: "0 0 20px 20px" }}
        >
          <span className="text-[12px] font-semibold" style={{ color: "#ffffff" }}>Equipe</span>
          <div className="flex items-center">
            {equipe.map((u, i) => (
              <span
                key={u.id}
                title={u.nome}
                className="flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold"
                style={{
                  background: corAvatarEmpresa(u.id),
                  border: "2px solid #ffffff",
                  color: "#0f172a",
                  marginRight: i < equipe.length - 1 ? -14 : 0,
                  zIndex: equipe.length - i,
                }}
              >
                {iniciaisEmpresa(u.nome)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
