"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  Kanban,
  Users,
  MessageCircle,
  Mail,
  SlidersHorizontal,
  Key,
  Bot,
  Package,
  Target,
  Sparkles,
  Bell,
  Handshake,
  LineChart,
  UserCog,
} from "lucide-react";

const tabs = [
  { label: "Geral", href: "/configuracoes", icon: Settings, exact: true },
  { label: "Pipeline", href: "/configuracoes/pipeline", icon: Kanban },
  { label: "Serviços", href: "/configuracoes/servicos", icon: Package },
  { label: "Campos Custom", href: "/configuracoes/campos-custom", icon: SlidersHorizontal },
  { label: "Leads", href: "/configuracoes/leads", icon: Users },
  { label: "ICP", href: "/configuracoes/icp", icon: Target },
  { label: "Enriquecimento", href: "/configuracoes/enriquecimento", icon: Sparkles },
  { label: "WhatsApp", href: "/configuracoes/whatsapp", icon: MessageCircle },
  { label: "Email", href: "/configuracoes/email", icon: Mail },
  { label: "Notificações", href: "/configuracoes/notificacoes", icon: Bell },
  { label: "Handover", href: "/configuracoes/handover", icon: Handshake },
  { label: "Tracking", href: "/configuracoes/tracking", icon: LineChart },
  { label: "Membros", href: "/configuracoes/membros", icon: UserCog },
  { label: "Integrações", href: "/configuracoes/integracoes", icon: Key },
  { label: "AI SDR", href: "/configuracoes/ai-sdr", icon: Bot },
];

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (tab: (typeof tabs)[number]) => {
    if (tab.exact) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  };

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 -mx-1 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 min-w-max px-1">
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={false}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                  active
                    ? "text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
                style={
                  active
                    ? {
                        background: "rgba(226, 55, 82, 0.15)",
                        borderBottom: "2px solid #e23752",
                      }
                    : {}
                }
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="border-b border-white/[0.06] mt-1" />
      </div>

      {/* Tab content */}
      {children}
    </div>
  );
}
