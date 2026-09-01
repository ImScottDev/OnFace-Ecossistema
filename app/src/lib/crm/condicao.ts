/**
 * Avaliador de condição genérico — extraído de `automacao-engine.ts` (F5)
 * pra ser reusado pelo Cadence Engine (F5, Cadence Builder) também. Mesma
 * gramática nos dois sistemas, uma implementação só — evitar duplicar essa
 * lógica é exatamente a lição da auditoria original (regra de negócio
 * duplicada em 2 lugares foi a causa raiz do bug de MRR).
 */
export interface Condicao {
  campo?: string;
  operador?: "igual" | "diferente" | "contem" | "maior_que" | "menor_que" | "maior_igual" | "menor_igual";
  valor?: string | number | boolean;
}

export function avaliarCondicao(condicao: unknown, campos: Record<string, unknown>): boolean {
  const c = condicao as Condicao | null;
  if (!c || !c.campo || !c.operador) return true; // sem condição = sempre passa
  const valorCampo = campos[c.campo];
  const valorComparar = c.valor;
  switch (c.operador) {
    case "igual": return String(valorCampo ?? "") === String(valorComparar ?? "");
    case "diferente": return String(valorCampo ?? "") !== String(valorComparar ?? "");
    case "contem": return String(valorCampo ?? "").toLowerCase().includes(String(valorComparar ?? "").toLowerCase());
    case "maior_que": return Number(valorCampo) > Number(valorComparar);
    case "menor_que": return Number(valorCampo) < Number(valorComparar);
    case "maior_igual": return Number(valorCampo) >= Number(valorComparar);
    case "menor_igual": return Number(valorCampo) <= Number(valorComparar);
    default: return true;
  }
}
