/**
 * Máquina de estados da Prospecção (Bloco 04 §3), em função pura.
 *
 * Existe separada do motor para que UI e backend leiam a MESMA regra: a tela
 * usa `transicao()` para decidir qual diálogo abrir ao soltar um cartão, e o
 * comando de domínio usa a mesma função para recusar o que a tela não deveria
 * ter oferecido. A autoridade é o backend; a tela só antecipa a pergunta.
 *
 *   NOVO → EM CADÊNCIA → RESPONDEU
 *   desfechos: PRÉ-QUALIFICADO, OPORTUNIDADE DIRETA, SEM RESPOSTA, DESCARTADO
 *
 * Os desfechos continuam sendo valores de `prospeccao_estado` (já existiam no
 * banco); a visão Kanban é que os trata como filas derivadas, não colunas.
 */
import type { EstadoProspeccao } from "./dominio";

/** O que o backend exige antes de aceitar a transição. */
export type Exigencia =
  | "cadencia"                 // escolher uma cadência válida
  | "evidencia_ou_confirmacao" // resposta real registrada OU confirmação manual auditada
  | "motivo"                   // motivo estruturado de descarte
  | "familia_e_responsavel"    // fluxo de criação de oportunidade
  | null;

export type Transicao =
  | { permitida: true; exige: Exigencia }
  | { permitida: false; motivo: string; igual?: boolean };

/** Estados em que o outbound ainda opera. Os demais já saíram da prospecção. */
export const ESTADOS_ABERTOS: readonly EstadoProspeccao[] = ["novo", "em_cadencia", "respondeu", "sem_resposta"];
export const ESTADOS_DE_SAIDA: readonly EstadoProspeccao[] = ["pre_qualificado", "oportunidade", "descartado"];

const SAIDA_JA_FEITA: Record<string, string> = {
  pre_qualificado: "Esta empresa já foi entregue a Pré-vendas. Daqui em diante ela segue a jornada de qualificação lá.",
  oportunidade: "Esta empresa já virou oportunidade direta no Pipeline.",
  descartado: "Esta empresa foi descartada. O histórico fica preservado.",
};

/** Origem → destino → exigência. Ausente = proibido. */
const MATRIZ: Partial<Record<EstadoProspeccao, Partial<Record<EstadoProspeccao, Exigencia>>>> = {
  novo: {
    em_cadencia: "cadencia", pre_qualificado: null, oportunidade: "familia_e_responsavel", descartado: "motivo",
  },
  em_cadencia: {
    respondeu: "evidencia_ou_confirmacao", sem_resposta: null,
    pre_qualificado: null, oportunidade: "familia_e_responsavel", descartado: "motivo",
  },
  respondeu: {
    pre_qualificado: null, oportunidade: "familia_e_responsavel", descartado: "motivo",
  },
  // Spec §14: sem resposta pode voltar numa nova cadência, ser retomada ou sair.
  sem_resposta: {
    em_cadencia: "cadencia", respondeu: "evidencia_ou_confirmacao",
    pre_qualificado: null, oportunidade: "familia_e_responsavel", descartado: "motivo",
  },
};

const MOTIVO_NEGADO: Partial<Record<EstadoProspeccao, Partial<Record<EstadoProspeccao, string>>>> = {
  novo: {
    respondeu: "Resposta só vale para quem foi abordado. Inclua a empresa em uma cadência primeiro.",
    sem_resposta: "Sem resposta só existe depois de uma cadência. Inclua a empresa em uma cadência primeiro.",
  },
  respondeu: {
    em_cadencia: "Quem respondeu não volta para a cadência. Decida entre pré-qualificar, criar oportunidade ou descartar.",
    sem_resposta: "Esta empresa já respondeu. Decida entre pré-qualificar, criar oportunidade ou descartar.",
    novo: "Uma empresa que já foi abordada não volta para Novo.",
  },
  em_cadencia: { novo: "Uma empresa que já foi abordada não volta para Novo." },
  sem_resposta: { novo: "Uma empresa que já foi abordada não volta para Novo." },
};

export function transicao(de: EstadoProspeccao | null | undefined, para: EstadoProspeccao): Transicao {
  if (!de) return { permitida: false, motivo: "Este registro não está na base de prospecção." };
  if (de === para) return { permitida: false, igual: true, motivo: "A empresa já está neste estado." };
  if (ESTADOS_DE_SAIDA.includes(de)) return { permitida: false, motivo: SAIDA_JA_FEITA[de] };

  const exige = MATRIZ[de]?.[para];
  if (exige === undefined) {
    return { permitida: false, motivo: MOTIVO_NEGADO[de]?.[para] ?? "Esta mudança de estado não é permitida." };
  }
  return { permitida: true, exige };
}

/** Destinos aceitos a partir de um estado — alimenta o menu "Mover para". */
export function destinosPermitidos(de: EstadoProspeccao): EstadoProspeccao[] {
  return Object.keys(MATRIZ[de] ?? {}) as EstadoProspeccao[];
}
