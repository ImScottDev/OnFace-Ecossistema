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

      <div className="pt-6">
        {/* Cara ONFACE (18/09, F1): grafite como moldura, coral só no fio que
            marca o estado, tipografia display no título. O coral aqui é sinal,
            não decoração — é o único ponto colorido da tela, e diz "isto ainda
            não existe". Sombra neutra, sem gradiente.

            Aviso pra quem mexer depois: a escala de ESPAÇO deste projeto é a
            numérica do Tailwind e vai até `p-6`. Nem `p-7` nem os nomes
            semânticos do DS
            (`--spacing-secao` e irmãos, cf2-design-system.css:79) geram CSS —
            viram classe sem regra, o cartão sai com padding 0 e o texto vaza
            pela borda. Medido no navegador em 18/09; os nomes de TAMANHO
            (`text-titulo`, `text-corpo`) e de RAIO (`rounded-card`) funcionam
            normalmente. */}
        <div
          className="relative max-w-2xl overflow-hidden rounded-card p-6"
          style={{
            background: "var(--onface-graphite-surface)",
            color: "var(--onface-branco-logo)",
            boxShadow: "var(--cf2-shadow-card-sm)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: "var(--onface-coral)" }}
          />

          <p
            className="text-micro font-semibold uppercase"
            style={{ color: "var(--onface-coral)", letterSpacing: "0.14em" }}
          >
            {area}
          </p>
          <h1
            className="mt-2 text-titulo font-semibold leading-tight"
            style={{ fontFamily: "var(--font-onface-display), ui-sans-serif, system-ui, sans-serif" }}
          >
            {titulo}
          </h1>
          <p className="mt-3 max-w-prose text-corpo leading-relaxed opacity-80">{resumo}</p>

          {/* O contrato desta tela é não fingir. Em vez de um gráfico vazio ou
              um número inventado, ela mostra o que falta acontecer antes. */}
          <p className="mt-6 text-micro font-semibold uppercase opacity-55" style={{ letterSpacing: "0.14em" }}>
            Depende de
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-corpo">
            {dependencias.map((item) => (
              <li key={item} className="flex gap-3 leading-relaxed">
                <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--onface-coral)" }} />
                <span className="opacity-85">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
