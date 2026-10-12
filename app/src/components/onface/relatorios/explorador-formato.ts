/** Formatação e navegação do explorador de métricas. Puro: roda no cliente e no teste. */
import { moeda, moedaExata } from "@/components/onface/vendas/formato";

export const COLUNAS_OCULTAS = new Set(["negocio_id", "empresa_id", "id"]);

export const ROTULOS: Record<string, string> = {
  titulo: "Oportunidade", empresa: "Empresa", produto: "Produto", familia: "Família", valor: "Valor", mrr: "MRR",
  ganho_at: "Ganho em", status: "Status", emitida_em: "Emitida em", metodo: "Método", paid_at: "Pago em",
  servicos_ativos: "Serviços ativos", etapa: "Etapa", previsao_fechamento: "Previsão", origem: "Origem da linha",
};

export const VALOR_FAMILIA: Record<string, string> = {
  CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Sem família",
};
export const VALOR_ORIGEM: Record<string, string> = {
  fechamento: "Competência fechada", assinatura: "Assinatura sem fechamento",
};

export function rotuloValor(coluna: string, v: string): string {
  if (coluna === "familia") return VALOR_FAMILIA[v] ?? v;
  if (coluna === "origem") return VALOR_ORIGEM[v] ?? v;
  return v;
}

export function dinheiro(v: number | null | undefined, unidade: string) {
  if (v === null || v === undefined) return "—";
  return unidade === "BRL" ? moedaExata(v) : v.toLocaleString("pt-BR");
}
export function dinheiroCurto(v: number, unidade: string) {
  if (unidade !== "BRL") return v.toLocaleString("pt-BR");
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 10_000) return `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
  return moeda(v);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `inicio` vem como YYYY-MM-DD (calendário de São Paulo). */
export function rotuloPonto(inicio: string, granularidade: "dia" | "mes"): string {
  const [a, m, d] = inicio.split("-").map(Number);
  return granularidade === "mes" ? `${MESES[m - 1]}/${String(a).slice(2)}` : `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Fim exclusivo do ponto, em YYYY-MM-DD. */
export function fimDoPonto(inicio: string, granularidade: "dia" | "mes"): string {
  const [a, m, d] = inicio.split("-").map(Number);
  const f = granularidade === "mes" ? new Date(Date.UTC(a, m, 1)) : new Date(Date.UTC(a, m - 1, d + 1));
  return f.toISOString().slice(0, 10);
}

export function formatarCelula(coluna: string, v: unknown, unidade: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (coluna === "valor" || coluna === "mrr") return moedaExata(Number(v));
  if (coluna === "familia" || coluna === "origem") return rotuloValor(coluna, String(v));
  if (/_at$|_em$|previsao/.test(coluna)) {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  void unidade;
  return String(v);
}

/** Para onde a linha leva. Nunca devolve um caminho que não existe (preferir sem link a 404). */
export function destinoDaLinha(codigo: string, coluna: string, l: Record<string, unknown>): string | null {
  const empresa = l.empresa_id ?? (codigo === "mrr_atual" || codigo === "clientes_ativos" ? l.id : null);
  if (coluna === "titulo" && l.negocio_id) return `/pipeline/${l.negocio_id}`;
  if (coluna === "empresa" && empresa) return `/empresas/${empresa}`;
  return null;
}
