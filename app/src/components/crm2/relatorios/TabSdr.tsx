"use client";

import { useQuery } from "@tanstack/react-query";
import { ChartCard } from "./charts/ChartCard";
import { FunnelChart } from "@/components/crm/FunnelChart";
import { AlertasCard, type AlertaUi } from "./AlertasCard";
import { HeroBand, Stat, Secao } from "./kit";
import {
  CalendarCheck, CheckCircle2, CalendarX, Users, PhoneCall, Filter, MessageCircle,
  XCircle, PauseCircle, Timer, ArrowDownUp, Archive,
} from "lucide-react";
import { ESCALA_FUNIL } from "./paleta";

interface FunilStage {
  stage: string;
  label: string;
  total: number;
}

interface PorResponsavel {
  usuarioId: string;
  nome: string;
  role: string;
  total: number;
  novo: number;
  emContato: number;
  qualificando: number;
  qualificado: number;
  desqualificado: number;
  taxaQualificacao: number;
}

interface QualificacaoResponsavel {
  usuarioId: string | null;
  nome: string;
  papel: string; // sdr | closer | vendedor | ia | outro
  viaReuniao: number;
  direta: number;
  total: number;
}

interface SlaBase {
  n: number;
  mediaHoras: number;
  medianaHoras: number;
}

interface OrigemGrupo {
  novos: number;
  trabalhados: number;
  qualificados: number;
  taxaQualificacao: number;
}

interface BaseParadaEstagio {
  estagio: string;
  label: string;
  total: number;
  ate7d: number;
  de7a30d: number;
  mais30d: number;
}

interface ContagemReunioes {
  agendadas: number;
  realizadas: number;
  noShow: number;
  compareceram: number;
  taxaComparecimento: number;
}

interface SdrEsteiraData {
  funil: FunilStage[];
  desqualificado: number;
  estagnados: number;
  estagnadosFlag: number;
  estagnadosParados: number;
  estagnadoDias: number;
  qualificandoAtual: number;
  novosLeads: number;
  totalEsteira: number;
  trabalhados: number;
  taxaContato: number;
  taxaQualificacao: number;
  reunioes: ContagemReunioes;
  reunioesClosers: ContagemReunioes | null;
  porResponsavel: PorResponsavel[];
  qualificadosDetalhe: { viaReuniao: number; direta: number };
  qualificacoesPorResponsavel: QualificacaoResponsavel[];
  sla: { coorte: SlaBase; fluxo: SlaBase };
  origem: { inbound: OrigemGrupo; outbound: OrigemGrupo };
  baseParada: { total: number; porEstagio: BaseParadaEstagio[]; antigosTrabalhadosPeriodo: number } | null;
}

// Funil em rampa de cinza — cor (lima) só no estágio de SUCESSO (disciplina 21/07)
const FUNIL_COLORS: Record<string, string> = {
  Novo: ESCALA_FUNIL[1],
  "Em contato": ESCALA_FUNIL[2],
  Qualificando: "var(--cf2-text-secondary)",
  Qualificado: "var(--cf2-success-text)",
};

const PAPEL_LABEL: Record<string, string> = {
  sdr: "SDR",
  closer: "Closer",
  vendedor: "Closer",
  ia: "Agente IA",
  outro: "—",
};

/** Horas → texto curto: até 48h em horas, acima em dias (pt-BR). */
function fmtHoras(h: number): string {
  if (!h || h <= 0) return "—";
  if (h < 48) return `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
  return `${(h / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}d`;
}

export default function TabSdr({ periodo }: { periodo: string }) {
  const { data, isLoading } = useQuery<SdrEsteiraData>({
    queryKey: ["sdr-esteira", periodo],
    queryFn: () =>
      fetch(`/api/relatorios/sdr-esteira?periodo=${periodo}`).then((r) => r.json()),
  });

  const funilChartData =
    data?.funil.map((f) => ({
      name: f.label,
      value: f.total,
      color: FUNIL_COLORS[f.label] ?? "#6B7280",
    })) ?? [];

  const qualificados = data?.funil.find((f) => f.label === "Qualificado")?.total ?? 0;
  const isEmpty = !isLoading && (data?.totalEsteira ?? 0) === 0;
  const detalhe = data?.qualificadosDetalhe;
  const quemQualificou = data?.qualificacoesPorResponsavel ?? [];
  const totalQualificacoes = quemQualificou.reduce((s, q) => s + q.total, 0);

  // ── Alertas acionáveis da operação de pré-vendas ──
  const alertas: AlertaUi[] = [];
  if (data && !isEmpty) {
    if ((data.taxaContato ?? 0) < 50 && (data.novosLeads ?? 0) >= 20) {
      alertas.push({ nivel: "vermelho", texto: `Só ${data.taxaContato}% dos leads do período foram trabalhados — tem lead novo esperando primeiro contato.` });
    }
    const agClosers = data.reunioesClosers?.agendadas ?? 0;
    const agSdr = data.reunioes?.agendadas ?? 0;
    if (agClosers > agSdr && agClosers >= 5) {
      alertas.push({ nivel: "amarelo", texto: `Closers agendaram ${agClosers} reuniões por fora no período (SDR: ${agSdr}) — a meta da SDR sozinha não conta a atividade toda.` });
    }
    const totalComEstagnados = (data.totalEsteira ?? 0) + (data.estagnados ?? 0);
    if (totalComEstagnados > 0 && (data.estagnados ?? 0) / totalComEstagnados > 0.15) {
      alertas.push({ nivel: "amarelo", texto: `${data.estagnados} leads do período parados (${data.estagnadoDias}+ dias sem atividade ou flag manual) — agendar retomada.` });
    }
    const ag = data.reunioes?.agendadas ?? 0;
    const ns = data.reunioes?.noShow ?? 0;
    if (ag >= 8 && ns / ag > 0.25) {
      alertas.push({ nivel: "vermelho", texto: `No-show em ${Math.round((ns / ag) * 100)}% das reuniões — confirmar presença na véspera e no dia.` });
    }
    if ((data.origem?.outbound?.novos ?? 0) >= 30 && (data.origem?.outbound?.qualificados ?? 0) === 0) {
      alertas.push({ nivel: "amarelo", texto: `Outbound: ${data.origem.outbound.novos} leads no período e nenhum qualificado — revisar abordagem ou lista.` });
    }
    const sdrsComVolume = (data.porResponsavel ?? []).filter((r) => r.total >= 10);
    if (sdrsComVolume.length >= 2) {
      const melhor = [...sdrsComVolume].sort((a, b) => b.taxaQualificacao - a.taxaQualificacao)[0];
      alertas.push({ nivel: "verde", texto: `Melhor taxa de qualificação: ${melhor.nome} (${melhor.taxaQualificacao}%).` });
    }
  }

  return (
    <div className="space-y-4">
      <AlertasCard alertas={alertas} loading={isLoading} />

      {/* Faixa-herói: reuniões agendadas = a meta da SDR */}
      <HeroBand
        label="Reuniões agendadas · meta da SDR"
        value={isLoading ? "…" : data?.reunioes?.agendadas ?? 0}
        sub={
          isLoading
            ? ""
            : `${data?.reunioes?.taxaComparecimento ?? 0}% dos agendados avançaram no funil${
                (data?.reunioesClosers?.agendadas ?? 0) > 0 ? ` · closers agendaram +${data?.reunioesClosers?.agendadas} por fora` : ""
              }`
        }
        icon={CalendarCheck}
      >
        <Stat label="Realizadas" value={isLoading ? "…" : data?.reunioes?.realizadas ?? 0} sub="avançaram após a entrada" cor="ganho" icon={CheckCircle2} />
        <Stat label="No-show" value={isLoading ? "…" : data?.reunioes?.noShow ?? 0} sub="a call não aconteceu" cor="critico" icon={CalendarX} />
        <Stat label="Novos leads" value={isLoading ? "…" : data?.novosLeads ?? 0} sub="entraram no período" icon={Users} />
        <Stat label="Trabalhados" value={isLoading ? "…" : data?.trabalhados ?? 0} sub={isLoading ? "" : `${data?.taxaContato ?? 0}% contatados`} icon={PhoneCall} />
      </HeroBand>

      {/* Esteira */}
      <Secao cor="funil" hint="dos leads que entraram no período">Esteira de qualificação</Secao>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Qualificados"
          value={isLoading ? "…" : qualificados}
          sub={
            isLoading || !detalhe
              ? ""
              : `${data?.taxaQualificacao ?? 0}% dos trabalhados · ${detalhe.viaReuniao} via reunião · ${detalhe.direta} diretas`
          }
          cor="ganho"
          destaque
          icon={Filter}
        />
        <Stat label="Qualificando" value={isLoading ? "…" : data?.qualificandoAtual ?? 0} sub="em conversa agora" icon={MessageCircle} />
        <Stat label="Desqualificados" value={isLoading ? "…" : data?.desqualificado ?? 0} sub="fora do processo" icon={XCircle} />
        <Stat
          label="Estagnados"
          value={isLoading ? "…" : data?.estagnados ?? 0}
          sub={isLoading ? "" : `sem atividade há ${data?.estagnadoDias ?? 7}+ dias ou marcados na esteira`}
          cor="atencao"
          icon={PauseCircle}
        />
      </div>

      <ChartCard
        title="Funil de pré-qualificação"
        subtitle="Cumulativo: cada etapa conta quem chegou nela ou além (desqualificados contam como contatados)"
        loading={isLoading}
        empty={isEmpty || funilChartData.length === 0}
        emptyText="Nenhum lead na esteira no período selecionado"
        delay={0.18}
      >
        <FunnelChart data={funilChartData} />
      </ChartCard>

      {/* Quem qualificou — por quem EXECUTOU a qualificação, não pelo dono do lead */}
      <Secao cor="neutro" hint="quem executou a qualificação — SDR, closer cobrindo ou agente IA">Quem qualificou</Secao>
      <div
        className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-hidden"
        style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.2s" }}
      >
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[var(--cf2-text-tertiary)] text-sm">Carregando...</div>
        ) : quemQualificou.length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--cf2-text-tertiary)] text-sm">Nenhuma qualificação no período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-[var(--cf2-border-default)] text-[10px] uppercase tracking-wider text-[var(--cf2-text-tertiary)] bg-[var(--cf2-bg-surface)]">
                  <th className="text-left font-medium px-4 py-2.5">Responsável</th>
                  <th className="text-left font-medium px-3 py-2.5">Papel</th>
                  <th className="text-right font-medium px-3 py-2.5">Via reunião</th>
                  <th className="text-right font-medium px-3 py-2.5">Direta</th>
                  <th className="text-right font-medium px-3 py-2.5">Total</th>
                  <th className="text-right font-medium px-4 py-2.5">% do total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {quemQualificou.map((q) => (
                  <tr key={q.usuarioId ?? "ia"} className="hover:bg-[var(--cf2-bg-surface)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--cf2-text-primary)] font-medium truncate max-w-[180px]">{q.nome}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--cf2-border-default)] text-[var(--cf2-text-secondary)]">
                        {PAPEL_LABEL[q.papel] ?? q.papel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--cf2-text-secondary)]">{q.viaReuniao}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--cf2-text-secondary)]">{q.direta}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--cf2-success-text)" }}>{q.total}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--cf2-text-secondary)]">
                      {totalQualificacoes > 0 ? Math.round((q.total / totalQualificacoes) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SLA + Inbound × Outbound */}
      <Secao cor="neutro" hint="tempo entre entrada do lead e qualificação — mediana primeiro, média distorce com outliers">Velocidade e origem</Secao>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="SLA · leads do período"
          value={isLoading ? "…" : fmtHoras(data?.sla?.coorte?.medianaHoras ?? 0)}
          sub={isLoading ? "" : `mediana · média ${fmtHoras(data?.sla?.coorte?.mediaHoras ?? 0)} · ${data?.sla?.coorte?.n ?? 0} qualificados`}
          icon={Timer}
        />
        <Stat
          label="SLA · fluxo do período"
          value={isLoading ? "…" : fmtHoras(data?.sla?.fluxo?.medianaHoras ?? 0)}
          sub={isLoading ? "" : `inclui leads antigos · média ${fmtHoras(data?.sla?.fluxo?.mediaHoras ?? 0)} · ${data?.sla?.fluxo?.n ?? 0} qualificações`}
          icon={Timer}
        />
        <Stat
          label="Inbound"
          value={isLoading ? "…" : data?.origem?.inbound?.qualificados ?? 0}
          sub={isLoading ? "" : `qualificados de ${data?.origem?.inbound?.novos ?? 0} novos · taxa ${data?.origem?.inbound?.taxaQualificacao ?? 0}%`}
          cor="ganho"
          icon={ArrowDownUp}
        />
        <Stat
          label="Outbound"
          value={isLoading ? "…" : data?.origem?.outbound?.qualificados ?? 0}
          sub={isLoading ? "" : `qualificados de ${data?.origem?.outbound?.novos ?? 0} novos · taxa ${data?.origem?.outbound?.taxaQualificacao ?? 0}%`}
          cor={!isLoading && (data?.origem?.outbound?.novos ?? 0) >= 30 && (data?.origem?.outbound?.qualificados ?? 0) === 0 ? "atencao" : "neutro"}
          icon={ArrowDownUp}
        />
      </div>

      {/* Base parada — fora da coorte do período (admin/gerente) */}
      {data?.baseParada && (
        <>
          <Secao cor="neutro" hint="toda a base sem negócio, independente do período selecionado">Base parada · funil completo</Secao>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Stat
              label="Leads parados na base"
              value={isLoading ? "…" : data.baseParada.total.toLocaleString("pt-BR")}
              sub="sem negócio, aguardando trabalho ou retomada"
              cor="atencao"
              destaque
              icon={Archive}
            />
            <Stat
              label="Parados há 30+ dias"
              value={isLoading ? "…" : data.baseParada.porEstagio.reduce((s, e) => s + e.mais30d, 0).toLocaleString("pt-BR")}
              sub="sem nenhuma atividade há mais de um mês"
              icon={PauseCircle}
            />
            <Stat
              label="Antigos trabalhados no período"
              value={isLoading ? "…" : data.baseParada.antigosTrabalhadosPeriodo.toLocaleString("pt-BR")}
              sub="leads de antes do período que tiveram movimento agora (não contam na coorte acima)"
              icon={PhoneCall}
            />
          </div>
          <div
            className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-hidden"
            style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.24s" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-[var(--cf2-border-default)] text-[10px] uppercase tracking-wider text-[var(--cf2-text-tertiary)] bg-[var(--cf2-bg-surface)]">
                    <th className="text-left font-medium px-4 py-2.5">Estágio</th>
                    <th className="text-right font-medium px-3 py-2.5">Total</th>
                    <th className="text-right font-medium px-3 py-2.5">Ativos (&lt;7d)</th>
                    <th className="text-right font-medium px-3 py-2.5">7–30 dias</th>
                    <th className="text-right font-medium px-4 py-2.5">30+ dias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.baseParada.porEstagio.map((e) => (
                    <tr key={e.estagio} className="hover:bg-[var(--cf2-bg-surface)] transition-colors">
                      <td className="px-4 py-2.5 text-[var(--cf2-text-primary)] font-medium">{e.label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[var(--cf2-text-secondary)]">{e.total.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[var(--cf2-text-secondary)]">{e.ate7d.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--cf2-warning-text)" }}>{e.de7a30d.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--cf2-danger-text)" }}>{e.mais30d.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Por SDR — esteira por responsável do lead (papel sdr) */}
      <Secao cor="neutro" hint="esteira por responsável do lead — volume e taxa por agente">Por SDR</Secao>
      <div
        className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-hidden"
        style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.28s" }}
      >
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[var(--cf2-text-tertiary)] text-sm">Carregando...</div>
        ) : isEmpty || (data?.porResponsavel ?? []).length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--cf2-text-tertiary)] text-sm">
            Nenhum responsável encontrado no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-[var(--cf2-border-default)] text-[10px] uppercase tracking-wider text-[var(--cf2-text-tertiary)] bg-[var(--cf2-bg-surface)]">
                  <th className="text-left font-medium px-4 py-2.5">Responsável</th>
                  <th className="text-right font-medium px-3 py-2.5">Na esteira</th>
                  <th className="text-right font-medium px-3 py-2.5">Em contato</th>
                  <th className="text-right font-medium px-3 py-2.5">Qualificando</th>
                  <th className="text-right font-medium px-3 py-2.5">Qualificado</th>
                  <th className="text-right font-medium px-3 py-2.5">Desqualificado</th>
                  <th className="text-right font-medium px-4 py-2.5">Taxa qualif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(data?.porResponsavel ?? []).map((r) => (
                  <tr key={r.usuarioId} className="hover:bg-[var(--cf2-bg-surface)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--cf2-text-primary)] font-medium truncate max-w-[160px]">
                      {r.nome}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--cf2-text-secondary)] tabular-nums">{r.total}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "#3B82F6" }}>
                      {r.emContato}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--cf2-warning-text)" }}>
                      {r.qualificando}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--cf2-success-text)" }}>
                      {r.qualificado}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--cf2-text-tertiary)] tabular-nums">{r.desqualificado}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span
                        className="font-semibold"
                        style={{
                          color:
                            r.taxaQualificacao >= 30
                              ? "var(--cf2-success-text)"
                              : r.taxaQualificacao > 0
                              ? "var(--cf2-warning-text)"
                              : "var(--cf2-text-tertiary)",
                        }}
                      >
                        {r.taxaQualificacao}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
