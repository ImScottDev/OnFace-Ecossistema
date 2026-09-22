import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Página não encontrada | ONFACE" };

/**
 * 404 da aplicação.
 *
 * O app não tinha nenhum: uma URL antiga ou digitada errada caía na página
 * padrão do Next, em inglês e sem nenhum caminho de volta. O produto tem 28
 * rotas de redirect vivas justamente porque link antigo circula em favorito e
 * em conversa — quando um deles não for coberto, é aqui que a pessoa chega.
 *
 * Fica na raiz e não dentro do grupo do CRM porque também atende quem não está
 * autenticado. Por isso não desenha a casca: sem sessão não há sidebar.
 */
/** Os tokens semânticos (`--text-muted`, `--surface-page`, `--primary`) moram
 * atrás de `html[data-onface-theme]`. Esta página vive fora das cascas, então
 * ninguém marca o atributo e todos eles resolvem vazio — medido: o texto de
 * apoio e o botão saíram praticamente invisíveis no papel. Marcar aqui, antes
 * do paint, é o mesmo padrão que o layout do CRM já usa. */
const TEMA_ANTES_DO_PAINT = `document.documentElement.setAttribute("data-onface-theme","light")`;

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--surface-page,#f6f6f3)] p-6">
      <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DO_PAINT }} />
      <div className="max-w-md text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.0875em] text-[var(--onface-coral,#fe4f2b)]">
          404
        </p>
        <h1 className="mt-2 text-xl font-bold text-[var(--text-strong,#12171d)]">
          Esta página não existe.
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted,#6d747e)]">
          O endereço pode ter mudado de lugar na reorganização dos módulos.
          A busca global encontra pessoa, empresa, oportunidade e conversa pelo
          nome.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/inicio">Ir para o início</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
