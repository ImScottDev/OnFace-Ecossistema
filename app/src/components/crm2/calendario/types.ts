export type Evento = {
  id: string;
  negocioId: string | null;
  leadId: string | null;
  titulo: string;
  data: string;
  duracao: number | null;
  tipo: "call" | "presencial" | "video";
  status: "agendada" | "realizada" | "cancelada" | "no_show";
  link: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  leadNome: string | null;
  empresaNome: string | null;
  negocioTitulo: string | null;
  negocioValor: string | null;
};

export type Resumo = {
  proximos: Evento[];
  atrasados: Evento[];
  conflitos: { a_id: string; a_titulo: string; a_data: string; b_id: string; b_titulo: string; b_data: string }[];
};

export type Membro = { id: string; nome: string; role: string; avatarUrl: string | null; outlookConectado: boolean };

export type Bloqueio = { id: string; inicio: string; fim: string; motivo: string | null };

export type Disponibilidade = {
  horarioTrabalho: { inicio: string; fim: string; diasSemana: number[] } | null;
  pausaAlmoco: { inicio: string; fim: string } | null;
  bloqueios: Bloqueio[];
};

export type EquipeResposta = {
  membros: Membro[];
  eventos: Evento[];
  ocupadoPorMembro: Record<string, { inicio: string; fim: string }[]>;
};

export const TIPO_LABEL: Record<string, string> = {
  call: "Ligação",
  presencial: "Presencial",
  video: "Reunião",
};

export const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "accent" }> = {
  agendada: { label: "AGENDADA", variant: "accent" },
  realizada: { label: "REALIZADA", variant: "success" },
  cancelada: { label: "CANCELADA", variant: "danger" },
  no_show: { label: "NO-SHOW", variant: "warning" },
};

export function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDia(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function brl(v: string | number | null) {
  if (v === null || v === undefined) return "R$ 0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n || Number.isNaN(n)) return "R$ 0";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
