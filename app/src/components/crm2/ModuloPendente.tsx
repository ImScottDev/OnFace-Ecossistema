import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { PaginaCabecalho } from "@/components/onface/shell/Pagina";

/**
 * Destino estrutural de um módulo que a árvore de navegação já prevê e o
 * produto ainda não construiu.
 *
 * Existe para que o menu congelado em 16/09 não tenha link morto. A página não
 * simula funcionalidade nem mostra número inventado: ela diz o que o módulo vai
 * ser e de onde o dado virá quando existir. Quando o módulo for construído, a
 * rota deixa de usar este componente.
 */
export async function ModuloPendente({ titulo, resumo, dependencias, enquanto }: {
  titulo: string;
  resumo: string;
  dependencias: string[];
  /** Onde o trabalho acontece HOJE, enquanto o módulo não existe. Vazio que
   *  ensina o próximo passo, em vez de beco sem saída. */
  enquanto?: { texto: string; href: string; rotulo: string };
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    // O nome do módulo e o resumo vivem no cabeçalho da página, como em toda
    // tela do produto. Antes apareciam DUAS vezes: o cabeçalho dizia "Fluxos"
    // e o cartão logo abaixo dizia "Fluxos" de novo, com a área ("Automações")
    // como micro-label em cima — que é a terceira vez, porque a trilha da
    // topbar já diz o grupo. Sobrou o que é único desta tela: a lista do que
    // precisa acontecer antes.
    <>
      <PaginaCabecalho titulo={titulo} descricao={resumo} />

      <div>
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

          {/* O contrato desta tela é não fingir. Em vez de um gráfico vazio ou
              um número inventado, ela mostra o que falta acontecer antes. */}
          <p className="text-micro font-semibold uppercase opacity-55" style={{ letterSpacing: "0.14em" }}>
            Ainda não existe. Depende de
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
        {enquanto ? (
          <p className="mt-4 flex max-w-2xl flex-wrap items-center gap-3 text-corpo" style={{ color: "var(--text-muted)" }}>
            <span>{enquanto.texto}</span>
            <Link
              href={enquanto.href}
              className="inline-flex h-8 items-center rounded-control px-3 text-[13px] font-semibold transition-colors bg-[#d93c1a] hover:bg-[#c2330f]"
              // Cor inline: a regra de link da página (coral) vencia o `text-white`
              // e o rótulo sumia sobre o fundo coral — botão vazio na tela.
              style={{ color: "#fff" }}
            >
              {enquanto.rotulo}
            </Link>
          </p>
        ) : null}
      </div>
    </>
  );
}
