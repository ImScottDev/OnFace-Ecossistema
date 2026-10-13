import Link from "next/link";

/* As cinco entradas do grupo Automações na sidebar (navegacao.ts), na mesma
   ordem, mais Roteamento: administração das regras de closer. A árvore do menu
   está congelada, então Roteamento é só aba (a rota herda "Agentes" na sidebar
   por ROTA_HERDA_DESTINO). */
const ABAS = [
  { href: "/automacoes", l: "Visão geral" },
  { href: "/automacoes/fluxos", l: "Fluxos" },
  { href: "/automacoes/cadencias", l: "Cadências" },
  { href: "/automacoes/agentes", l: "Agentes especializados" },
  { href: "/automacoes/execucoes", l: "Execuções" },
  { href: "/automacoes/roteamento", l: "Roteamento" },
];

export function AbasAutomacoes({ atual }: { atual: string }) {
  return (
    <nav className="oa-abas" aria-label="Automações">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href} className="oa-aba" aria-current={a.href === atual ? "page" : undefined}>
          {a.l}
        </Link>
      ))}
    </nav>
  );
}
