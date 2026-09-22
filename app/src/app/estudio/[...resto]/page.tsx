import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Destino da árvore que ainda não foi desenhado no estúdio.
 *
 * O menu está congelado, então todo item leva a algum lugar. O honesto é dizer
 * que a tela ainda não existe NESTE preview, e não inventar funcionalidade nem
 * devolver 404. */
export default async function DestinoNaoDesenhado({
  params,
}: {
  params: Promise<{ resto: string[] }>;
}) {
  const { resto } = await params;
  const caminho = "/" + resto.join("/");

  return (
    <div className="estudio-entrada mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--muted)]">
        <Compass className="size-5 text-[var(--tinta-fraca)]" aria-hidden />
      </span>

      <h1 className="text-[1.0625rem] font-semibold tracking-[-0.015em]">Ainda não desenhada aqui</h1>

      <p className="text-[0.875rem] leading-relaxed text-[var(--tinta-media)]">
        <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-[0.8125rem]">{caminho}</code>{" "}
        existe no menu e funciona no produto. Neste preview só Pipeline e
        Atendimento foram construídas.
      </p>

      <Button asChild size="sm" variant="outline" className="mt-1">
        <Link href="/estudio">Voltar ao estúdio</Link>
      </Button>
    </div>
  );
}
