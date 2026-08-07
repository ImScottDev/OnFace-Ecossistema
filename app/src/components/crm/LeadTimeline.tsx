"use client";

import {
  FileText,
  Phone,
  Mail,
  Calendar,
  Send,
  RefreshCw,
  ArrowRight,
  Globe,
  MousePointer,
  MessageCircle,
} from "lucide-react";

interface TimelineItem {
  id: string;
  timelineType: string;
  tipo?: string;
  titulo?: string;
  descricao?: string;
  deStatus?: string;
  paraStatus?: string;
  pagina?: string;
  usuarioNome?: string | null;
  dados?: { canal?: string; rotulo?: string; ordem?: number } | null;
  createdAt: string;
}

const activityIcons: Record<string, typeof FileText> = {
  nota: FileText,
  ligacao: Phone,
  email: Mail,
  reuniao: Calendar,
  proposta_enviada: Send,
  follow_up: RefreshCw,
  diagnostico: MousePointer,
  whatsapp: MessageCircle,
  tarefa: RefreshCw,
  cadencia: Send,
};

const canalIcons: Record<string, typeof FileText> = {
  whatsapp: MessageCircle,
  email: Mail,
  ligacao: Phone,
};

const activityLabels: Record<string, string> = {
  nota: "Nota",
  ligacao: "Ligação",
  email: "Email",
  reuniao: "Reunião",
  proposta_enviada: "Proposta enviada",
  follow_up: "Follow-up",
  diagnostico: "Diagnóstico",
  whatsapp: "WhatsApp",
  tarefa: "Tarefa",
  cadencia: "Cadência",
};

const eventLabels: Record<string, string> = {
  page_view: "Visitou página",
  form_start: "Iniciou formulário",
  form_submit: "Enviou formulário",
  whatsapp_click: "Clicou no WhatsApp",
  call_click: "Clicou em ligar",
};

export function LeadTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-white/40">Nenhuma atividade registrada</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const date = new Date(item.createdAt);
        const dateStr = date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        const timeStr = date.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        if (item.timelineType === "atividade") {
          const canal = item.dados?.canal;
          const Icon =
            (item.tipo === "cadencia" && canal ? canalIcons[canal] : undefined) ||
            activityIcons[item.tipo || "nota"] ||
            FileText;
          const isGreen = item.tipo === "whatsapp" || canal === "whatsapp";
          const isLigacao = item.tipo === "ligacao";
          return (
            <div key={item.id} className="flex gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isGreen ? "bg-emerald-500/15" : "bg-blue-500/15"}`}>
                <Icon className={`w-4 h-4 ${isGreen ? "text-emerald-400" : "text-blue-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {item.usuarioNome && <span className="text-white/50">{item.usuarioNome} · </span>}
                  {item.titulo || activityLabels[item.tipo || ""] || item.tipo}
                </p>
                {/* Ligação: o resumo de IA completo já vive na aba Ligações (com tabs, transcrição, etc.) —
                    aqui só um atalho, sem duplicar o texto inteiro na timeline. */}
                {isLigacao ? (
                  item.descricao && (
                    <a href="#ligacoes" className="inline-flex items-center gap-1 text-xs text-blue-400/70 hover:text-blue-400 mt-0.5 transition-colors">
                      Ver resumo completo em Ligações ↑
                    </a>
                  )
                ) : (
                  item.descricao && (
                    <p className="text-sm text-white/50 mt-0.5 whitespace-pre-wrap">{item.descricao}</p>
                  )
                )}
                <p className="text-xs text-white/30 mt-1">
                  {dateStr} {timeStr}
                </p>
              </div>
            </div>
          );
        }

        // Mudança de estágio: é rastro/breadcrumb, não conteúdo — menor destaque que nota/ligação/reunião.
        if (item.timelineType === "status_change") {
          return (
            <div key={item.id} className="flex items-center gap-2.5 pl-1">
              <div className="flex-shrink-0 w-5 h-5 bg-purple-500/10 rounded-full flex items-center justify-center">
                <ArrowRight className="w-3 h-3 text-purple-400/70" />
              </div>
              <p className="text-xs text-white/40 flex-1">
                Status: <span className="text-white/60">{item.deStatus || "—"}</span>
                {" → "}
                <span className="text-white/60">{item.paraStatus}</span>
                <span className="text-white/25 ml-2">{dateStr} {timeStr}</span>
              </p>
            </div>
          );
        }

        // Evento de tracking (visita, clique): mesmo tratamento discreto de breadcrumb.
        if (item.timelineType === "evento") {
          return (
            <div key={item.id} className="flex items-center gap-2.5 pl-1">
              <div className="flex-shrink-0 w-5 h-5 bg-white/[0.04] rounded-full flex items-center justify-center">
                <Globe className="w-3 h-3 text-white/30" />
              </div>
              <p className="text-xs text-white/35 flex-1">
                {eventLabels[item.tipo || ""] || item.tipo}
                {item.pagina && <span className="text-white/25 ml-1">({item.pagina})</span>}
                <span className="text-white/25 ml-2">{dateStr} {timeStr}</span>
              </p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
