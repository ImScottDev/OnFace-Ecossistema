"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { FileText, TrendingUp } from "lucide-react";
import { Cf2ChromeCard } from "../shared/ChromeCard";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Distribuição por status (25/08, pedido do Kauã pra trocar os cards de KPI
 * planos por gráfico — mesma referência visual de dashboard/KPI que o resto
 * do CRM2 usa: shadcndashboard, card elevado com ícone + gráfico + legenda
 * com valor). Doughnut em vez de radar (que era a referência literal citada)
 * porque é status categórico de um total, não série multi-eixo — radar não
 * representa essa forma de dado.
 */
export function Cf2PropostaStatusChart({ emElaboracao, enviadas, aceitas, recusadasExpiradas }: {
  emElaboracao: number; enviadas: number; aceitas: number; recusadasExpiradas: number;
}) {
  const dados = [
    { label: "Em rascunho", valor: emElaboracao, cor: "var(--cf2-chrome-text-secondary)" },
    { label: "Aguardando retorno", valor: enviadas, cor: "#fbbf24" },
    { label: "Aceitas", valor: aceitas, cor: "#4ade80" },
    { label: "Recusadas/Expiradas", valor: recusadasExpiradas, cor: "#f87171" },
  ];
  const total = dados.reduce((s, d) => s + d.valor, 0);

  return (
    <Cf2ChromeCard padding="20px">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center rounded-lg w-8 h-8" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cf2-chrome-text-secondary)" }}><FileText className="w-4 h-4" /></span>
        <p className="text-[14px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Distribuição por status</p>
      </div>
      {total === 0 ? (
        <p className="text-[12px] py-8 text-center" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhuma proposta ainda.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-[120px] h-[120px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dados} dataKey="valor" nameKey="label" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
                  {dados.map((d) => <Cell key={d.label} fill={d.cor} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} proposta${Number(v) === 1 ? "" : "s"}`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {dados.filter((d) => d.valor > 0).map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.cor }} />
                  <span className="truncate" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{d.label}</span>
                </span>
                <span className="font-bold shrink-0" style={{ color: "var(--cf2-chrome-text-primary)" }}>{d.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Cf2ChromeCard>
  );
}

interface PontoSerie { mes: string; enviadas: number; aceitas: number; valorAceito: number }

/**
 * Tendência de envio/aceite nos últimos 6 meses — mesma referência de
 * "métricas SaaS ao longo do tempo" que o Kauã citou, feita com recharts
 * (já dependência do projeto) em vez do componente pago do shadcndashboard
 * (`@shadcn-dashboard/saas-metrics-chart` exige licença — CLI confirmou
 * "License required", não dá pra puxar sem credencial; ver decisão de não
 * fazer scraping do tema pago registrada antes nesta mesma sessão).
 */
export function Cf2PropostaSerieChart({ dados }: { dados: PontoSerie[] }) {
  const semDado = dados.every((d) => d.enviadas === 0 && d.aceitas === 0);
  return (
    <Cf2ChromeCard padding="20px">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center rounded-lg w-8 h-8" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cf2-chrome-text-secondary)" }}><TrendingUp className="w-4 h-4" /></span>
        <p className="text-[14px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Enviadas x Aceitas (6 meses)</p>
      </div>
      {semDado ? (
        <p className="text-[12px] py-8 text-center" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhuma proposta enviada nesse período.</p>
      ) : (
        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
            <BarChart data={dados} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--cf2-chrome-border-subtle)" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--cf2-chrome-text-secondary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--cf2-chrome-text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v, n) => [n === "valorAceito" ? brl(Number(v)) : v, n === "enviadas" ? "Enviadas" : n === "aceitas" ? "Aceitas" : "Valor aceito"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "enviadas" ? "Enviadas" : "Aceitas")} />
              <Bar dataKey="enviadas" fill="var(--cf2-accent-border)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aceitas" fill="#4ade80" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Cf2ChromeCard>
  );
}
