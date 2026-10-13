/** Parte pura (sem banco) da evolução de faturamento por natureza; ver faturamento-mensal.ts. */

export type BucketFaturamento = "mrr" | "avulso" | "debito" | "semClasse";

/** O balde "avulso" das telas = SETUP + ONE_TIME + USAGE (continua assim). Por dentro, cada um é um conceito. */
export type DetalheAvulso = "setup" | "pontual" | "uso";

/** Fase 3.2: abre o balde "avulso" em implantação (SETUP), pontual (ONE_TIME) e consumo (USAGE). */
export function detalheDoAvulso(natureza: string | null | undefined): DetalheAvulso | null {
  switch (natureza) {
    case "SETUP": return "setup";
    case "ONE_TIME": return "pontual";
    case "USAGE": return "uso";
    default: return null;
  }
}

/** revenue_nature (MRR | SETUP | ONE_TIME | USAGE | DEBITO_RECUPERADO | UNKNOWN) → bucket da tela. */
export function bucketDaNatureza(natureza: string | null | undefined): BucketFaturamento {
  switch (natureza) {
    case "MRR": return "mrr";
    case "SETUP": case "ONE_TIME": case "USAGE": return "avulso";
    case "DEBITO_RECUPERADO": return "debito";
    default: return "semClasse";
  }
}

export interface FaturamentoMes {
  /** "YYYY-MM" */
  competencia: string;
  mrr: number;
  /** Balde antigo: setup + pontual + uso. As telas que já leem `avulso` continuam lendo o mesmo número. */
  avulso: number;
  /** Partes do `avulso` (setup + pontual + uso = avulso). */
  setup: number;
  pontual: number;
  uso: number;
  debito: number;
  semClasse: number;
  total: number;
}

const vazio = (competencia: string): FaturamentoMes => ({ competencia, mrr: 0, avulso: 0, setup: 0, pontual: 0, uso: 0, debito: 0, semClasse: 0, total: 0 });

/** Os `n` meses terminando em `ate` ("YYYY-MM"), do mais antigo ao mais novo. */
export function ultimosMeses(ate: string, n: number): string[] {
  const [a, m] = ate.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Linhas (competência, natureza, valor) → série completa, com mês sem linha = 0. */
export function montarSerie(
  linhas: { competencia: string; natureza: string | null; valor: number }[],
  meses: string[],
): FaturamentoMes[] {
  const porMes = new Map(meses.map((m) => [m, vazio(m)]));
  for (const l of linhas) {
    const mes = porMes.get(l.competencia);
    if (!mes) continue;
    mes[bucketDaNatureza(l.natureza)] += l.valor;
    const parte = detalheDoAvulso(l.natureza);
    if (parte) mes[parte] += l.valor;
    mes.total += l.valor;
  }
  return meses.map((m) => porMes.get(m)!);
}

