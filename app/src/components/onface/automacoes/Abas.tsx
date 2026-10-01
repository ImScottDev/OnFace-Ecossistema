import Link from "next/link";

/* As mesmas cinco entradas do grupo Automações na sidebar (navegacao.ts),
   na mesma ordem: a aba é atalho entre irmãs, não uma segunda árvore. */
const ABAS = [
  { href: "/automacoes", l: "Visão geral" },
  { href: "/automacoes/fluxos", l: "Fluxos" },
  { href: "/automacoes/cadencias", l: "Cadências" },
  { href: "/automacoes/agentes", l: "Agentes IA" },
  { href: "/automacoes/execucoes", l: "Execuções" },
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
