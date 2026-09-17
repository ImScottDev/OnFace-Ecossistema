"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Cf2Painel, Cf2BarraEmpilhada } from "../shared/Pulso";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Distribuição por status, 10/09/2026 — reconstruída sobre `Cf2BarraEmpilhada`
 * (a mesma barra segmentada da fila de cobrança do Financeiro) em vez do
 * doughnut escuro anterior. Era um card dark isolado competindo peso com o
 * pulso; agora é um painel claro de trabalho, com "aguardando ação" como
 * fatia própria — antes o ajuste solicitado pelo cliente não aparecia em
 * NENHUM balde da distribuição (achado real: `ajuste_solicitado` ficava fora
 * dos 4 filtros do backend).
 */
export function Cf2PropostaStatusChart({
  emElaboracao, enviadas, ajusteSolicitado, aceitas, recusadasExpiradas,
}: {
  emElaboracao: number; enviadas: number; ajusteSolicitado: number; aceitas: number; recusadasExpiradas: number;
}) {
  const total = emElaboracao + enviadas + ajusteSolicitado + aceitas + recusadasExpiradas;
  return (
    <Cf2Painel titulo="Distribuição por status" dica={`${total.toLocaleString("pt-BR")} propostas no recorte`} corpoClassName="p-4">
      {total === 0 ? (
        <p className="text-[12px] py-4 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta neste recorte.</p>
      ) : (
        <Cf2BarraEmpilhada
          total={total}
          fatias={[
            { chave: "rascunho", label: "Em rascunho", valor: emElaboracao, tom: "neutro" },
            { chave: "enviada", label: "Aguardando retorno", valor: enviadas, tom: "atencao" },
            { chave: "ajuste", label: "Ajuste solicitado", valor: ajusteSolicitado, tom: "info" },
            { chave: "aceita", label: "Aceitas", valor: aceitas, tom: "ok" },
            { chave: "recusada", label: "Recusadas/expiradas", valor: recusadasExpiradas, tom: "critico" },
          ]}
        />
      )}
    </Cf2Painel>
  );
}

interface PontoSerie { mes: string; enviadas: number; aceitas: number; valorAceito: number }

/**
 * Tendência de envio/aceite — mesmo dado de antes, painel claro no lugar do
 * card dark. Cores das barras vêm dos tokens do sistema (terciário pra
 * enviadas, accent pra aceitas) em vez de cinza/verde fixos de tema escuro.
 */
export function Cf2PropostaSerieChart({ dados }: { dados: PontoSerie[] }) {
  const semDado = dados.every((d) => d.enviadas === 0 && d.aceitas === 0);
  return (
    <Cf2Painel titulo="Enviadas x aceitas" dica="Últimos 6 meses, por data do evento" corpoClassName="p-4">
      {semDado ? (
        <p className="text-[12px] py-4 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta enviada nesse período.</p>
      ) : (
        <div className="w-full h-[188px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
            <BarChart data={dados} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--cf2-border-default)" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--cf2-text-tertiary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--cf2-text-tertiary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [n === "valorAceito" ? brl(Number(v)) : v, n === "enviadas" ? "Enviadas" : n === "aceitas" ? "Aceitas" : "Valor aceito"]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "enviadas" ? "Enviadas" : "Aceitas")} />
              <Bar dataKey="enviadas" fill="var(--cf2-text-tertiary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aceitas" fill="var(--cf2-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Cf2Painel>
  );
}
