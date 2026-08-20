"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Bot, Users, Activity, Settings2 } from "lucide-react";
import { Cf2Badge } from "../ui/Badge";
import { Cf2EmptyState, Cf2ErrorState, Cf2Skeleton } from "../ui/States";

/**
 * Catálogo de Agentes de IA do módulo Automações (19/08). Achado real: hoje
 * existe só 1 agente de fato (AI SDR, config única por org em
 * `ai_sdr_config`) — não há Recovery/Collection/CS Agent ainda. Esta tela é
 * a 1ª entrada da lista, lendo dado real da rota `/api/automacoes/agentes`.
 * Config do AI SDR não é duplicada aqui — link direto pra tela real em
 * `(crm)/configuracoes/ai-sdr`.
 */

interface AgenteResumo {
  id: string;
  tipo: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  configurado: boolean;
  modelo: string | null;
  atualizadoEm: string | null;
  leads: { total: number; porStatus: Record<string, number> };
  execucoes24h: number;
  configHref: string;
}

interface AgentesResponse {
  agentes: AgenteResumo[];
  planejados: string[];
}

const STATUS_LABEL: Record<string, string> = {
  ai_handling: "com a IA",
  human_required: "aguardando humano",
  human_assigned: "com humano",
};

function AgenteCard({ agente }: { agente: AgenteResumo }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "var(--cf2-shadow-card-sm)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: "var(--cf2-accent)" }}>
            <Bot className="w-4 h-4" style={{ color: "var(--cf2-text-on-accent)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{agente.nome}</p>
            <p className="text-[12px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{agente.descricao}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Cf2Badge variant={agente.ativo ? "success" : "neutral"}>{agente.ativo ? "Ativo" : "Inativo"}</Cf2Badge>
          <Link
            href={agente.configHref}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full font-medium"
            style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}
          >
            <Settings2 className="w-3 h-3" /> Configurar
          </Link>
        </div>
      </div>

      {!agente.configurado ? (
        <p className="text-[12px] mt-3 pl-12" style={{ color: "var(--cf2-text-tertiary)" }}>Ainda não configurado nesta organização.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pl-12">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <div>
              <p className="text-[15px] font-bold leading-none" style={{ color: "var(--cf2-text-primary)" }}>{agente.leads.total}</p>
              <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>leads sob gestão</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <div>
              <p className="text-[15px] font-bold leading-none" style={{ color: "var(--cf2-text-primary)" }}>{agente.execucoes24h}</p>
              <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>execuções (24h)</p>
            </div>
          </div>
          {agente.modelo && (
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <div>
                <p className="text-[12px] font-semibold leading-none truncate" style={{ color: "var(--cf2-text-primary)" }}>{agente.modelo}</p>
                <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>modelo</p>
              </div>
            </div>
          )}
        </div>
      )}

      {agente.configurado && Object.keys(agente.leads.porStatus).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-3 pl-12">
          {Object.entries(agente.leads.porStatus).map(([status, n]) => (
            <span key={status} className="text-[11px] px-2 py-1 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
              {n} {STATUS_LABEL[status] || status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Cf2AgentesWorkspace() {
  const { data, isLoading, isError } = useQuery<AgentesResponse>({
    queryKey: ["automacoes", "agentes"],
    queryFn: async () => {
      const r = await fetch("/api/automacoes/agentes");
      if (!r.ok) throw new Error("Erro ao carregar agentes");
      return r.json();
    },
  });

  return (
    <div className="page-scroll space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Agentes</h1>
        <p className="text-xs mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Catálogo de agentes de IA rodando na sua operação. Hoje só o AI SDR — próximos agentes entram aqui quando existirem de verdade.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Cf2Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <Cf2ErrorState message="Não foi possível carregar os agentes." />
      ) : !data || data.agentes.length === 0 ? (
        <Cf2EmptyState title="Nenhum agente configurado ainda" description="Configure o AI SDR pra ver ele aparecer aqui." />
      ) : (
        <div className="space-y-3">
          {data.agentes.map((agente) => <AgenteCard key={agente.id} agente={agente} />)}
        </div>
      )}
    </div>
  );
}
