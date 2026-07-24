"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Phone, Mail, FileText, Clock, AlertTriangle, Video, MapPin, Link2, ChevronRight } from "lucide-react";

interface Tarefa {
  id: string;
  leadId: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  dataVencimento: string | null;
  concluida: boolean;
}

interface AgendaItem {
  id: string;
  titulo: string;
  data: string;
  duracao: number | null;
  tipo: string | null;
  link: string | null;
  negocioId: string | null;
  leadId: string | null;
  leadNome: string | null;
  leadEmpresa: string | null;
}

const agendaTipoIcon: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  presencial: <MapPin className="w-3.5 h-3.5" />,
};

function agendaDiaHora(iso: string): { dia: string; hora: string } {
  const d = new Date(iso);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d); alvo.setHours(0, 0, 0, 0);
  const dif = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  const dia = dif === 0 ? "Hoje" : dif === 1 ? "Amanhã" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { dia, hora };
}

function Agenda({ agenda }: { agenda: AgendaItem[] }) {
  if (!agenda || agenda.length === 0) return null;
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <h2 className="text-sm font-semibold text-white/70 mb-3">Agenda ({agenda.length})</h2>
      <div className="space-y-2">
        {agenda.map((r) => {
          const { dia, hora } = agendaDiaHora(r.data);
          const href = r.negocioId ? `/negocios/${r.negocioId}` : r.leadId ? `/contatos/${r.leadId}` : null;
          const quem = r.leadEmpresa || r.leadNome || "";
          const card = (
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.06] transition-colors group">
              <div className="flex flex-col items-center w-12 shrink-0">
                <span className="text-[10px] uppercase text-white/40 leading-none">{dia}</span>
                <span className="text-sm font-bold text-white tabular-nums leading-tight">{hora}</span>
              </div>
              <span className="text-white/40 shrink-0">{agendaTipoIcon[r.tipo || "call"] || <Clock className="w-3.5 h-3.5" />}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white truncate block group-hover:text-[#e23752] transition-colors">{r.titulo}</span>
                {quem && <span className="text-xs text-white/40 truncate block">{quem}</span>}
              </div>
              {r.link && (
                <a
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Abrir link da reunião"
                  className="text-white/40 hover:text-[#8e27ef] shrink-0 transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                </a>
              )}
              {href && <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />}
            </div>
          );
          return href ? <Link key={r.id} href={href} className="block">{card}</Link> : <div key={r.id}>{card}</div>;
        })}
      </div>
    </div>
  );
}

const tipoIcons: Record<string, React.ReactNode> = {
  ligar: <Phone className="w-4 h-4" />,
  follow_up: <Mail className="w-4 h-4" />,
  enviar_proposta: <FileText className="w-4 h-4" />,
  diagnostico: <Clock className="w-4 h-4" />,
  renovacao: <AlertTriangle className="w-4 h-4" />,
};

const prioridadeCores: Record<string, string> = {
  urgente: "text-red-400 bg-red-500/15",
  alta: "text-amber-400 bg-amber-500/15",
  media: "text-yellow-400 bg-yellow-500/15",
  baixa: "text-white/40 bg-white/[0.06]",
};

export function MeuDiaClient({ tarefasIniciais, agenda }: { tarefasIniciais: Tarefa[]; agenda: AgendaItem[] }) {
  const [tarefasList, setTarefasList] = useState(tarefasIniciais);

  async function toggleTarefa(id: string) {
    try {
      const res = await fetch(`/api/tarefas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concluida: true }),
      });
      if (res.ok) {
        setTarefasList((prev) => prev.filter((t) => t.id !== id));
        toast.success("Tarefa concluída");
      }
    } catch {
      toast.error("Erro ao concluir tarefa");
    }
  }

  return (
    <div className="space-y-4">
      <Agenda agenda={agenda} />
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
        <h2 className="text-sm font-semibold text-white/70 mb-3">
          Tarefas do Dia{tarefasList.length > 0 ? ` (${tarefasList.length})` : ""}
        </h2>
        {tarefasList.length === 0 ? (
          <p className="text-sm text-white/40">Nenhuma tarefa pendente. Bom trabalho!</p>
        ) : (
          <div className="space-y-2">
            {tarefasList.map((tarefa) => {
          const isOverdue = tarefa.dataVencimento && new Date(tarefa.dataVencimento) < new Date();
          return (
            <div
              key={tarefa.id}
              className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.06] transition-colors ${isOverdue ? "bg-red-500/10" : ""}`}
            >
              <button
                onClick={() => toggleTarefa(tarefa.id)}
                className="w-5 h-5 rounded border-2 border-white/20 hover:border-[#e23752] hover:bg-[#e23752]/20 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <Check className="w-3 h-3 text-transparent" />
              </button>
              <span className="text-white/40 flex-shrink-0">
                {tipoIcons[tarefa.tipo] || <Clock className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                {tarefa.leadId ? (
                  <Link href={`/contatos/${tarefa.leadId}`} className="text-sm text-white hover:text-[#e23752] truncate block transition-colors">
                    {tarefa.titulo}
                  </Link>
                ) : (
                  <span className="text-sm text-white truncate block">{tarefa.titulo}</span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadeCores[tarefa.prioridade] || "text-white/40 bg-white/[0.06]"}`}>
                {tarefa.prioridade}
              </span>
              {isOverdue && (
                <span className="text-xs text-red-400 font-medium">atrasada</span>
              )}
            </div>
          );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
