import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { Cf2CalendarioConfiguracoes } from "@/components/crm2/calendario/Configuracoes";

export const metadata = { title: "Configurações do calendário" };

/* Casca ONFACE (01/10): cabeçalho compacto da Pagina no lugar do título de
   28px e do link solto em cima — a trilha da topbar já diz "Calendário", e a
   volta virou a ação do cabeçalho. */
export default async function CalendarioConfiguracoesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Configurações do calendário"
        descricao="Horário de trabalho, pausa e bloqueios que valem para os agendamentos com você."
        acoes={
          <Link
            href="/calendario"
            className="inline-flex h-8 items-center rounded-control px-3 text-[13px] font-semibold"
            style={{ color: "var(--of-tinta-forte)", boxShadow: "inset 0 0 0 1px var(--of-linha)" }}
          >
            Voltar ao calendário
          </Link>
        }
      />
      <Cf2CalendarioConfiguracoes />
    </Pagina>
  );
}
