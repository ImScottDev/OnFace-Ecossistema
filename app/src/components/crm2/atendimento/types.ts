export type ConversaItem = {
  id: string;
  tipo: "whatsapp" | "email" | "ligacao";
  nome: string;
  empresaNome: string | null;
  preview: string;
  timestamp: string | null;
  naoLidas: number;
  leadId: string | null;
  responsavelId: string | null;
  handoffStatus: string | null;
  duracaoSegundos: number | null;
  callStatus: string | null;
  emailThreadId: string | null;
  telefone: string | null;
  // Resumo gerado pela IA (Carol) da conversa — só existe quando o Agente
  // SDR já rodou nesse contato (ai_sdr_contato_state.conversation_summary).
  // null é o caso comum hoje: não é "carregando", é "ainda não tem resumo".
  conversationSummary: string | null;
  status: string;
  snoozedUntil: string | null;
};

export type Cascata =
  | { tipo: "negocio"; id: string; titulo: string; valor: string | null; etapa: string }
  | { tipo: "proposta"; id: string; numero: number; valor: string | null; dataEmissao: string | null }
  | { tipo: "reuniao"; titulo: string; data: string; link: string | null }
  | { tipo: "nenhum" };

export type Contexto = {
  pessoa: { nome: string; cargo: string | null; telefone: string | null; email: string | null } | null;
  empresa: { id: string | null; nome: string; setor: string | null; cnpj: string | null; porte: string | null } | null;
  isCliente: boolean;
  cascata: Cascata;
  proximasAtividades: { id: string; titulo: string; data: string }[];
};

export function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/**
 * Achado real 24/08 ("visão lixo"): ~40% dos contatos de WhatsApp não têm
 * nome de perfil capturado — `contatos.nome` nasce como o próprio telefone
 * cru (ex: "70626509336638"). Não fabrica nome nenhum (dado que não existe
 * não existe) — só formata o número pra ficar legível em vez de um blob de
 * dígitos, mesmo tratamento que o resto do CRM2 já dá a telefone.
 */
export function nomeExibicao(nome: string, telefone?: string | null): string {
  if (!/^\d+$/.test(nome)) return nome;
  const digitos = (telefone || nome).replace(/\D/g, "");
  if (digitos.length === 12 || digitos.length === 13) {
    const semPais = digitos.slice(2);
    const ddd = semPais.slice(0, 2);
    const numero = semPais.slice(2);
    const corte = numero.length === 9 ? 5 : 4;
    return `+55 (${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
  }
  return digitos.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatarHora(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function brl(v: string | number | null) {
  if (v === null || v === undefined) return "R$ 0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n || Number.isNaN(n)) return "R$ 0";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
