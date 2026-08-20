export type Kpis = {
  totalPessoas: number;
  leads: number;
  contatos: number;
  clientes: number;
  empresas: number;
};

// "Ex-cliente" (18/08, arquitetura Pessoa/Empresa do Kauã) — cliente=tipo,
// não status; aqui é sempre estado DERIVADO ao vivo (contrato histórico sem
// contrato ativo), nunca gravado como campo.
export type Relacionamento = "cliente" | "ex_cliente" | "qualificado" | "lead";

export type EmpresaLinha = {
  id: string;
  nome: string;
  setor: string | null;
  pessoas: number;
  relacionamento: Relacionamento;
  negocios: number;
  valor: string;
  responsavel_nome: string | null;
  ultima_atividade: string | null;
};

export type StatusComercial = "leads" | "qualificacao" | "oportunidade" | "cliente" | "ex_cliente" | "contato";

export type PessoaLinha = {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  tipo: "contato" | "lead" | "cliente";
  status_comercial: StatusComercial;
  empresa_nome: string | null;
  empresa_id: string | null;
  responsavel_nome: string | null;
  negocios: number;
  negocio_valor: string;
  ultima_interacao: string | null;
  proxima_atividade: string | null;
};

export const RELACIONAMENTO_BADGE: Record<Relacionamento, { label: string; bg: string; text: string }> = {
  cliente: { label: "Cliente", bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)" },
  ex_cliente: { label: "Ex-cliente", bg: "var(--cf2-bg-surface-muted)", text: "var(--cf2-text-secondary)" },
  qualificado: { label: "Com oportunidade", bg: "#dbeafe", text: "#1e40af" },
  lead: { label: "Prospect", bg: "var(--cf2-warning-bg)", text: "var(--cf2-warning-text)" },
};

export const STATUS_COMERCIAL_BADGE: Record<StatusComercial, { label: string; bg: string; text: string }> = {
  leads: { label: "Lead", bg: "var(--cf2-warning-bg)", text: "var(--cf2-warning-text)" },
  qualificacao: { label: "Em qualificação", bg: "#f3e8ff", text: "#8e27ef" },
  oportunidade: { label: "Em oportunidade", bg: "#dbeafe", text: "#1e40af" },
  cliente: { label: "Cliente", bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)" },
  ex_cliente: { label: "Ex-cliente", bg: "var(--cf2-bg-surface-muted)", text: "var(--cf2-text-secondary)" },
  contato: { label: "Contato", bg: "var(--cf2-bg-surface-muted)", text: "var(--cf2-text-secondary)" },
};

export function brl(v: string | number | null) {
  if (v === null || v === undefined) return "R$ 0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n || Number.isNaN(n)) return "R$ 0";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtData(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  const dias = Math.floor((hoje.getTime() - d.getTime()) / 86400000);
  if (dias > 0 && dias < 30) return `Há ${dias} dia${dias === 1 ? "" : "s"}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
