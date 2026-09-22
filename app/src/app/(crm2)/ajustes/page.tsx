import Link from "next/link";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import {
  UserCog,
  Users,
  Shield,
  ShieldCheck,
  GitBranch,
  SlidersHorizontal,
  Package,
  Tags,
  Inbox,
  Mail,
  MessageSquare,
  Bot,
  Target,
  Sparkles,
  Handshake,
  LineChart,
  Key,
  Bell,
  ChevronRight,
  FileText,
  Tag,
  Layers,
  ScrollText,
  Workflow,
  Blocks,
} from "lucide-react";

export const metadata = { title: "Ajustes" };

/**
 * Hub administrativo do CRM 2.0 (19/08). Item "Ajustes" da navegação macro
 * apontava pra `/configuracoes`, que hoje é só o layout+telas legadas do
 * `(crm)` — sem hub próprio em CRM2. Esta página NÃO reconstrói nenhuma
 * tela de configuração (isso é trabalho grande, fica pra depois): é só a
 * página inicial que organiza links pras telas reais que já existem no
 * legado, mais 2 cards honestos de "em construção" onde não existe tela
 * nenhuma ainda (Permissões, status central de outras integrações).
 *
 * Cada link abaixo foi confirmado batendo em
 * `src/app/(crm)/configuracoes/<pasta>/page.tsx` antes de entrar aqui —
 * nada aponta pra rota que não existe.
 */

interface AjusteCard {
  titulo: string;
  descricao: string;
  href?: string;
  icon: React.ElementType;
}

interface AjusteBloco {
  titulo: string;
  cards: AjusteCard[];
}

const BLOCOS: AjusteBloco[] = [
  {
    titulo: "Organização & Acesso",
    cards: [
      {
        titulo: "Usuários & Organização",
        descricao: "Dados da organização (nome, slug, domínio) e lista de usuários do CRM.",
        href: "/ajustes/geral",
        icon: UserCog,
      },
      {
        titulo: "Equipe, papéis e metas",
        descricao: "Quem tem acesso, o papel de cada pessoa e a meta mensal — é aqui que se define a meta que a Home cobra.",
        href: "/ajustes/membros",
        icon: Users,
      },
      {
        titulo: "Permissões",
        descricao: "Hoje o papel de cada usuário só é exibido — ainda não existe tela para editar o que cada papel pode fazer.",
        icon: Shield,
      },
    ],
  },
  {
    titulo: "Comercial",
    cards: [
      {
        titulo: "Pipeline & Etapas",
        descricao: "Etapas do funil de vendas, etapas de fechamento e motivos de perda do negócio.",
        href: "/ajustes/pipeline",
        icon: GitBranch,
      },
      {
        titulo: "Modelos Comerciais",
        descricao: "Condições comerciais e modelos de proposta padrão por família de serviço.",
        icon: Layers,
      },
      {
        titulo: "Campos customizados",
        descricao: "Campos extras nos formulários de lead e negócio.",
        href: "/ajustes/campos-custom",
        icon: SlidersHorizontal,
      },
      {
        titulo: "Catálogo de Serviços",
        descricao: "Produtos por família comercial (Callface AI/PABX/White Label) — semântica declarada, nunca inferida por nome.",
        href: "/ajustes/catalogo",
        icon: Package,
      },
      {
        titulo: "Classificação de Leads",
        descricao: "Setores e origens usados para classificar leads.",
        href: "/ajustes/leads",
        icon: Tags,
      },
      {
        titulo: "Contratos",
        descricao: "Templates de contrato — variáveis, versão, preview com dados fictícios.",
        href: "/ajustes/contratos",
        icon: FileText,
      },
    ],
  },
  {
    titulo: "Comunicação",
    cards: [
      {
        titulo: "Contas de E-mail",
        descricao: "Conexão e sincronização das caixas de e-mail da equipe.",
        href: "/ajustes/email",
        icon: Inbox,
      },
      {
        titulo: "Templates de E-mail",
        descricao: "Modelos de e-mail usados em disparos e follow-ups.",
        href: "/ajustes/email/templates",
        icon: Mail,
      },
      {
        titulo: "WhatsApp",
        descricao: "Sessões de WhatsApp conectadas ao CRM.",
        href: "/ajustes/whatsapp",
        icon: MessageSquare,
      },
      {
        titulo: "Scripts de Atendimento",
        descricao: "Roteiros de ligação e mensagem usados por SDR e Closer — distinto de template de e-mail.",
        icon: ScrollText,
      },
    ],
  },
  {
    titulo: "IA & Growth",
    cards: [
      {
        titulo: "AI SDR",
        descricao: "SDR virtual (Groq) que qualifica leads automaticamente.",
        href: "/ajustes/ai-sdr",
        icon: Bot,
      },
      {
        titulo: "Políticas de Automação",
        descricao: "Regras gerais de automação (fluxos, cadências, agentes) além da configuração do AI SDR.",
        icon: Workflow,
      },
      {
        titulo: "ICP",
        descricao: "Perfil de Cliente Ideal usado para qualificação e priorização de leads.",
        href: "/ajustes/icp",
        icon: Target,
      },
      {
        titulo: "Enriquecimento Automático",
        descricao: "Enriquecimento automático de dados de leads.",
        href: "/ajustes/enriquecimento",
        icon: Sparkles,
      },
      {
        titulo: "Handover",
        descricao: "O que acontece automaticamente quando um negócio é ganho.",
        href: "/ajustes/handover",
        icon: Handshake,
      },
      {
        titulo: "Tracking & Conversões",
        descricao: "Pixels e conversões offline (Meta CAPI, Google Ads).",
        href: "/ajustes/tracking",
        icon: LineChart,
      },
    ],
  },
  {
    titulo: "Integrações",
    cards: [
      {
        titulo: "Apollo.io",
        descricao: "Chave de API do Apollo.io, usada em enriquecimento e prospecção.",
        href: "/ajustes/integracoes",
        icon: Key,
      },
      {
        titulo: "Outras integrações",
        descricao: "Stripe, WhatsApp Business, Outlook e Mixpanel já rodam no CRM, mas ainda sem uma tela central de status.",
        icon: Package,
      },
    ],
  },
  {
    titulo: "Sistema",
    cards: [
      {
        titulo: "Notificações",
        descricao: "Regras de notificação (SLA, alertas, resumo diário).",
        href: "/ajustes/notificacoes",
        icon: Bell,
      },
      {
        titulo: "Tags",
        descricao: "Etiquetas genéricas aplicadas a qualquer registro — diferente da Classificação de Leads (setor/origem).",
        icon: Tag,
      },
      {
        titulo: "Qualidade de dados",
        descricao: "Dez verificações só-leitura contra o banco real, mais o relatório de duplicidade de contratos.",
        href: "/ajustes/qualidade-dados",
        icon: ShieldCheck,
      },
      {
        titulo: "Elementos Globais",
        descricao: "Campos e listas compartilhados entre módulos (não específicos de lead ou negócio).",
        icon: Blocks,
      },
    ],
  },
];

function AjusteCardItem({ card }: { card: AjusteCard }) {
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
      {/* Ícone solto, sem o quadradinho arredondado.
       *
       * Medido nesta tela: 18 chips coral de uma vez. Coral é a cor de
       * "isto exige atenção"; pintada em todo item de uma lista de
       * configuração, ela deixa de significar qualquer coisa — e índice de
       * ajustes não tem nada que exija atenção. O ícone continua ajudando a
       * varrer a lista, agora sem competir com o título que está ao lado. */}
      <Icon
        className="w-[18px] h-[18px] shrink-0 mt-px"
        style={{ color: "var(--text-muted)" }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{card.titulo}</p>
          {!card.href && <Cf2Badge variant="neutral">Em construção</Cf2Badge>}
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

export default async function AjustesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db
    .select({ nome: organizacoes.nome })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-8">
        {BLOCOS.map((bloco) => (
          <section key={bloco.titulo} className="flex flex-col gap-3">
            <p
              className="text-[12px] font-bold uppercase tracking-wide"
              style={{ color: "var(--cf2-text-tertiary)", fontFamily: "var(--cf2-font-heading)" }}
            >
              {bloco.titulo}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bloco.cards.map((card) => (
                <AjusteCardItem key={card.titulo} card={card} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
