export type PrioridadeItem = {
  id: string;
  tipo: "negocio_parado" | "tarefa_atrasada" | "reuniao_proxima" | "aguardando_resposta" | "proposta_sem_followup";
  titulo: string;
  subtitulo: string | null;
  score: number;
  urgencia: "alta" | "media" | "baixa";
  motivos: string[];
  link: string | null;
};

export type Briefing = {
  prioridades: number;
  reunioesHoje: number;
  negociosAtencao: number;
  tarefasAtrasadas: number;
  pipelineAtivo: number;
  fechadoOntem: number;
};

export type Performance = {
  pipeline: { total: number; negociosAbertos: number };
  fechadoMes: { receita: number; ganhos: number };
  fechadoMesAnterior: { receita: number; ganhos: number };
};

export const URGENCIA_COR: Record<PrioridadeItem["urgencia"], string> = {
  alta: "var(--cf2-danger-text)",
  media: "var(--cf2-warning-text)",
  baixa: "var(--cf2-text-tertiary)",
};

export const TIPO_ICONE: Record<PrioridadeItem["tipo"], string> = {
  negocio_parado: "💤",
  tarefa_atrasada: "⏰",
  reuniao_proxima: "📅",
  aguardando_resposta: "💬",
  proposta_sem_followup: "📄",
};

export function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Guia de poses oficial da Carol (Figma node 98:4) — cada pose comunica um tom;
// variar conforme o conteúdo da resposta, nunca usar só uma pose fixa.
export type CarolPose = "padrao" | "venda-fechada" | "dica" | "alerta" | "pensando" | "meta-batida" | "aprovado" | "ate-logo";

export const CAROL_POSE_SRC: Record<CarolPose, string> = {
  padrao: "/carol/padrao.png",
  "venda-fechada": "/carol/venda-fechada.png",
  dica: "/carol/dica.png",
  alerta: "/carol/alerta.png",
  pensando: "/carol/pensando.png",
  "meta-batida": "/carol/meta-batida.png",
  aprovado: "/carol/aprovado.png",
  "ate-logo": "/carol/ate-logo.png",
};

export type CarolMensagem = {
  id: string;
  pose: CarolPose;
  texto: string;
  itens?: PrioridadeItem[];
  stats?: { label: string; valor: string; sub?: string }[];
};
