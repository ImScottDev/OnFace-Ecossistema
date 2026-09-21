/**
 * Layout das telas de pós-venda.
 *
 * Existe por um motivo só: carregar o design system cf2 (o mesmo do CRM 2.0)
 * apenas nestas rotas, sem tocar no globals.css de produção. `data-cf2-theme`
 * pinta o container; os tokens também vivem no :root (ver cf2-tokens.css)
 * porque Dialog/DropdownMenu renderizam em portal, fora desta árvore.
 */
import "@/app/cf2-tokens.css";
import "@/app/cf2-design-system.css";

export default function PosVendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-cf2-theme="light"
      className="h-full overflow-y-auto p-6"
      style={{ background: "var(--cf2-bg-page)", color: "var(--cf2-text-primary)" }}
    >
      {children}
    </div>
  );
}
