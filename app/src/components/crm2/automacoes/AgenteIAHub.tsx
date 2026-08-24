import Link from "next/link";
import {
  Bot,
  Repeat,
  PlayCircle,
  FileText,
  Route,
  KeyRound,
  Server,
  BookOpen,
  Brain,
  Puzzle,
  ClipboardList,
  Gauge,
  ChevronRight,
} from "lucide-react";
import { Cf2Badge } from "@/components/crm2/ui/Badge";

/**
 * Hub "Agente de IA" (23/08) — organiza tudo que já é real hoje sob o
 * conceito de produto "Agente de IA" (Callpilot + follow-ups automáticos)
 * e deixa visível, sem fabricar dado nenhum, o que ainda é só conceito.
 * Mesmo padrão visual/estrutural do hub de Ajustes
 * (`src/app/(crm2)/ajustes/page.tsx`, AjusteCardItem) — bloco com título +
 * grid de cards, card sem `href` vira card desabilitado com badge.
 *
 * Os 4 cards reais SÓ linkam pra tela que já existe — zero lógica nova,
 * zero duplicação:
 * - Agentes         -> /automacoes/agentes   (Cf2AgentesWorkspace)
 * - Follow-ups      -> /automacoes/cadencias (Cf2CadenciasWorkspace)
 * - Execuções       -> /automacoes/execucoes
 * - Propostas       -> /propostas
 *
 * Os 8 cards seguintes são conceito de produto sem schema/rota/código
 * ainda (auditoria de 23/08) — aparecem desabilitados, badge "Em breve",
 * sem link. Não remover: o pedido original era deixar visível que existem
 * como conceito, só não implementados.
 */

interface HubCard {
  titulo: string;
  descricao: string;
  href?: string;
  icon: React.ElementType;
}

const REAIS: HubCard[] = [
  {
    titulo: "Agentes",
    descricao: "Catálogo de agentes de IA (Callpilot) configurados na organização.",
    href: "/automacoes/agentes",
    icon: Bot,
  },
  {
    titulo: "Follow-ups",
    descricao: "Cadências automáticas de follow-up — sequência de passos por canal.",
    href: "/automacoes/cadencias",
    icon: Repeat,
  },
  {
    titulo: "Execuções",
    descricao: "Histórico real de execuções dos fluxos, cadências e agentes.",
    href: "/automacoes/execucoes",
    icon: PlayCircle,
  },
  {
    titulo: "Propostas",
    descricao: "Propostas geradas (manual ou por automação) — rascunho até assinatura.",
    href: "/propostas",
    icon: FileText,
  },
];

const EM_BREVE: HubCard[] = [
  {
    titulo: "Roteadores",
    descricao: "Regras de roteamento de conversa/ligação entre agentes e equipe humana.",
    icon: Route,
  },
  {
    titulo: "Credenciais",
    descricao: "Chaves e segredos usados pelos agentes (provedores de IA, telefonia).",
    icon: KeyRound,
  },
  {
    titulo: "Provedores",
    descricao: "Provedores de modelo de IA e de telefonia (Asterisk/SIP) conectados.",
    icon: Server,
  },
  {
    titulo: "Conhecimento",
    descricao: "Base de conhecimento que os agentes consultam para responder.",
    icon: BookOpen,
  },
  {
    titulo: "Memória",
    descricao: "Memória de longo prazo dos agentes por contato/negócio.",
    icon: Brain,
  },
  {
    titulo: "Skills",
    descricao: "Habilidades/ferramentas plugáveis que um agente pode executar.",
    icon: Puzzle,
  },
  {
    titulo: "Casos",
    descricao: "Casos de uso e exemplos que orientam o comportamento do agente.",
    icon: ClipboardList,
  },
  {
    titulo: "Alertas de Uso/Orçamento",
    descricao: "Limites e alertas de consumo/orçamento de IA por organização.",
    icon: Gauge,
  },
];

function Cf2HubCardItem({ card }: { card: HubCard }) {
  const Icon = card.icon;
  const conteudo = (
    <div
      className="flex items-start gap-3 h-full rounded-2xl p-4 transition-colors"
      style={{
        background: "var(--cf2-bg-surface)",
        border: "1px solid var(--cf2-border-default)",
        boxShadow: "var(--cf2-shadow-card-sm)",
        opacity: card.href ? 1 : 0.7,
      }}
    >
      <div
        className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9"
        style={{ background: card.href ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}
      >
        <Icon className="w-4 h-4" style={{ color: card.href ? "var(--cf2-text-on-accent)" : "var(--cf2-text-tertiary)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{card.titulo}</p>
          {!card.href && <Cf2Badge variant="warning">Em breve</Cf2Badge>}
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{card.descricao}</p>
      </div>
      {card.href && <ChevronRight className="w-4 h-4 shrink-0 mt-1" style={{ color: "var(--cf2-text-tertiary)" }} />}
    </div>
  );

  if (!card.href) {
    return <div>{conteudo}</div>;
  }

  return (
    <Link href={card.href} className="block h-full">
      {conteudo}
    </Link>
  );
}

export function Cf2AgenteIAHub() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p
          className="text-[12px] font-bold uppercase tracking-wide"
          style={{ color: "var(--cf2-text-tertiary)", fontFamily: "var(--cf2-font-heading)" }}
        >
          Em produção
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {REAIS.map((card) => (
            <Cf2HubCardItem key={card.titulo} card={card} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p
          className="text-[12px] font-bold uppercase tracking-wide"
          style={{ color: "var(--cf2-text-tertiary)", fontFamily: "var(--cf2-font-heading)" }}
        >
          Em breve
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EM_BREVE.map((card) => (
            <Cf2HubCardItem key={card.titulo} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}
