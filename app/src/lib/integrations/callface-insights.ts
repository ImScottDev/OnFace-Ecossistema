import type { Qualificacao } from "@/lib/vendas/dominio";

/**
 * O que a ligação descobriu, buscado na API da Callface.
 *
 * O webhook de saída entrega 17 campos e deixa de fora justamente o que o
 * agente de voz colheu: os campos de Data Collection, a qualificação com
 * motivo e evidência, e os próximos passos. Tudo isso existe em
 * `GET /calls/{id}` → `Transcriptions[].insights` (confirmado em produção em
 * 04/11/2026 numa ligação real de 180s do Agente Mayra).
 *
 * Então, em vez de pedir mudança de contrato, o ONFACE busca o resto logo
 * depois do webhook. O `call_id` vem do `call_link` que o próprio webhook manda.
 */

export interface QualificacaoDaLigacao {
  status?: string;        // Qualificado | Parcial | Não qualificado | Inelegível | Sem Informação
  motivo?: string;
  evidence?: string;
  nivel_interesse?: string;
}

export interface ProximoPassoDaLigacao {
  category?: string;
  status?: string;        // ex.: "Combinado"
  date?: string;
  evidence?: string;
  communication_type?: string;
}

export interface InsightsDaLigacao {
  /** Campos de Data Collection, com a chave já normalizada. */
  campos: Record<string, unknown>;
  qualificacao: QualificacaoDaLigacao | null;
  proximosPassos: ProximoPassoDaLigacao[];
}

/** "Nome do Cliente " e "nome_do_cliente" são a mesma coisa; o agente deixa espaço e acento. */
export function normalizarChave(k: string): string {
  return k.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Separa os três blocos do `insights` cru. O resto das chaves é Data Collection. */
export function lerInsights(bruto: unknown): InsightsDaLigacao | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const campos: Record<string, unknown> = {};
  let qualificacao: QualificacaoDaLigacao | null = null;
  const proximosPassos: ProximoPassoDaLigacao[] = [];

  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    const chave = normalizarChave(k);
    if (chave === "qualificacao") {
      const primeiro = Array.isArray(v) ? v[0] : v;
      if (primeiro && typeof primeiro === "object") qualificacao = primeiro as QualificacaoDaLigacao;
      continue;
    }
    if (chave === "next_steps" || chave === "proximos_passos") {
      if (Array.isArray(v)) for (const p of v) if (p && typeof p === "object") proximosPassos.push(p as ProximoPassoDaLigacao);
      continue;
    }
    if (v !== null && v !== undefined && v !== "" && v !== "nao informado") campos[chave] = v;
  }
  return { campos, qualificacao, proximosPassos };
}

/** A ligação dá a qualificação por escrito; só vale o que a IA de fato extraiu. */
export function qualificacaoDoLead(ins: InsightsDaLigacao): Qualificacao {
  const c = ins.campos;
  const texto = (k: string) => (typeof c[k] === "string" ? (c[k] as string).trim() : undefined);
  const numero = (k: string) => {
    const n = Number(c[k]);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const observacoes = [
    texto("usa_crm") ? `CRM: ${texto("usa_crm")}` : null,
    texto("objecao") ? `Objeção: ${texto("objecao")}` : null,
    texto("nivel_de_interesse") ? `Interesse: ${texto("nivel_de_interesse")}` : null,
    ins.qualificacao?.nivel_interesse ? `Interesse (IA): ${ins.qualificacao.nivel_interesse}` : null,
    ins.qualificacao?.motivo ? `Motivo: ${ins.qualificacao.motivo}` : null,
    texto("melhor_horario_retorno") ? `Retornar: ${texto("melhor_horario_retorno")}` : null,
  ].filter(Boolean).join(" · ");

  const q: Qualificacao = {};
  if (texto("dor_principal")) q.dor = texto("dor_principal");
  if (texto("telefonia_atual")) q.solucaoAtual = texto("telefonia_atual");
  if (texto("foco_da_operacao")) q.cenarioAtual = texto("foco_da_operacao");
  if (numero("usuarios_na_operacao") !== undefined) q.quantidade = numero("usuarios_na_operacao");
  if (c.e_a_pessoa_certa === true) q.decisor = "falou com quem decide";
  if (c.e_a_pessoa_certa === false) q.decisor = "não é quem decide";
  if (observacoes) q.observacoes = observacoes;
  return q;
}

/** Só "Qualificado" qualifica. Parcial, Inelegível e Sem Informação não movem o lead. */
export function ligacaoQualificouOLead(ins: InsightsDaLigacao): boolean {
  const s = normalizarChave(String(ins.qualificacao?.status ?? ""));
  return s === "qualificado";
}

/** A reunião combinada já tem dono: o auto-agendamento do webhook. Aqui só se reconhece. */
export function temReuniaoCombinada(ins: InsightsDaLigacao): boolean {
  return ins.proximosPassos.some((p) => normalizarChave(String(p.status ?? "")) === "combinado");
}
