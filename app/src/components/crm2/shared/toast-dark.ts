import { toast } from "sonner";
import type { CSSProperties } from "react";

/**
 * O `<Toaster>` global do CRM2 (`Providers.tsx`) é fixo em `theme="light"`
 * pra todo o app "cf2" — certo pra maioria das telas, mas o toast aparecia
 * com fundo claro flutuando sobre as telas escuras (Pipeline, Propostas),
 * achado real 25/08 (Kauã: "fundo branco aleatório"). Sonner aceita `style`
 * por chamada, que sobrescreve o default do Toaster — isso usa esse
 * mecanismo em vez de duplicar um 2º `<Toaster>` (só um por app).
 */
const DARK_STYLE: CSSProperties = {
  background: "#1a1d24",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
};

export const toastDark = {
  success: (msg: string) => toast.success(msg, { style: DARK_STYLE }),
  error: (msg: string) => toast.error(msg, { style: DARK_STYLE }),
  warning: (msg: string) => toast.warning(msg, { style: DARK_STYLE }),
};
