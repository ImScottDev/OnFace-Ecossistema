// Os modelos de PDF da proposta. "padrao" é o PDF de sempre e é o que vale quando ninguém escolhe:
// nenhuma proposta existente muda de aparência sem alguém escolher outro.
export const MODELOS_PDF = ["padrao", "enxuto", "completo", "white_label"] as const;
export type ModeloPdf = (typeof MODELOS_PDF)[number];

export const ROTULO_MODELO_PDF: Record<ModeloPdf, string> = {
  padrao: "Padrão (como sempre foi)",
  enxuto: "Enxuto, uma página",
  completo: "Completo, com escopo e entregas",
  white_label: "White Label / parceria",
};

export function modeloPdfValido(v: unknown): ModeloPdf | null {
  return typeof v === "string" && (MODELOS_PDF as readonly string[]).includes(v) ? (v as ModeloPdf) : null;
}
