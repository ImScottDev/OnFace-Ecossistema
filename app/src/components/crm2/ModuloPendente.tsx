import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { getTenantContext } from "@/lib/auth/tenant";
import { Cf2Topbar } from "@/components/crm2/Topbar";

/**
 * Destino estrutural de um módulo que a árvore de navegação já prevê e o
 * produto ainda não construiu.
 *
 * Existe para que o menu congelado em 16/09 não tenha link morto. A página não
 * simula funcionalidade nem mostra número inventado: ela diz o que o módulo vai
 * ser e de onde o dado virá quando existir. Quando o módulo for construído, a
 * rota deixa de usar este componente.
 */
export async function ModuloPendente({ titulo, area, resumo, dependencias }: {
  titulo: string;
  area: string;
  resumo: string;
  dependencias: string[];
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db
    .select({ nome: organizacoes.nome })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b"
        style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}
      >
        <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title={titulo} compactTitle actions={null} />
      </div>

      <div className="pt-3">
        <div
          className="max-w-2xl rounded-2xl border p-6"
          style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>
            {area}
          </p>
          <h1 className="mt-1 text-lg font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
            {titulo}
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--cf2-text-tertiary)" }}>
            {resumo}
          </p>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>
            Depende de
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm" style={{ color: "var(--cf2-text-secondary)" }}>
            {dependencias.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
