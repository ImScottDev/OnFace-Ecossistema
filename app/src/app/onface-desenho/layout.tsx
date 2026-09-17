import { notFound } from "next/navigation";
import { DesenhoProviders } from "./providers";

/**
 * Casca do banco de desenho.
 *
 * Reproduz o shell oficial (topbar + tema) sem exigir sessão, para validar as
 * telas com dado real em desenvolvimento. Só existe fora de produção.
 */
export default function DesenhoLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesenhoProviders>{children}</DesenhoProviders>;
}
