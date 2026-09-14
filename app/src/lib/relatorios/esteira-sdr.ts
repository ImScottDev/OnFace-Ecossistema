/**
 * Fonte ÚNICA da esteira de pré-vendas (SDR) pra relatórios.
 * Antes da auditoria de 21/07, /sdr-esteira e o funil de pré-vendas do /marketing
 * calculavam isso separadamente com definições diferentes de "Qualificado"
 * (board logic × sdr_status puro), dando 77 vs 68 no mesmo período. Agora os dois
 * consomem daqui.
 *
 * Classificação = espelho do board de Pré-vendas (sdrBoardColumn):
 * disqualified > tem negócio (qualificado) > estagnação > sdr_status.
 * Coorte = leads CRIADOS na janela (movimentação do período da SDR).
 */
import { db } from "@/lib/db";
import { leads, negocios } from "@/lib/db/schema";
import { and, eq, gte, lt, isNotNull } from "drizzle-orm";

export interface TallySdr {
  novo: number;
  emContato: number;
  qualificando: number;
  qualificado: number;
  desqualificado: number;
  estagnados: number;
}

export interface EsteiraSdr {
  geral: TallySdr;
  porResponsavel: Map<string, TallySdr>;
  totalLeads: number; // todos os leads da coorte (inclui estagnados)
  totalEsteira: number; // fora estagnados
  trabalhados: number; // saiu de "Novo" (inclui desqualificados)
  funil: { stage: string; label: string; total: number }[];
}

const STAGNATION = ["sdr_sem_retorno", "sdr_sem_interesse", "sdr_retomar_depois"];

const tally = (): TallySdr => ({ novo: 0, emContato: 0, qualificando: 0, qualificado: 0, desqualificado: 0, estagnados: 0 });

export async function getEsteiraSdr(orgId: string, since: Date, until: Date): Promise<EsteiraSdr> {
  const leadRows = await db
    .select({ id: leads.id, sdrStatus: leads.sdrStatus, responsavelId: leads.responsavelId })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, since), lt(leads.createdAt, until)));

  // Lead que virou negócio = qualificado pela SDR (marcou reunião e foi pro closer)
  const leadsNeg = await db
    .selectDistinct({ leadId: negocios.leadId })
    .from(negocios)
    .where(and(eq(negocios.organizacaoId, orgId), isNotNull(negocios.leadId)));
  const comNegocio = new Set(leadsNeg.map((n) => n.leadId));

  const coluna = (l: { id: string; sdrStatus: string | null }) => {
    const s = l.sdrStatus || "pending";
    if (s === "disqualified") return "desqualificado";
    if (comNegocio.has(l.id)) return "qualificado";
    // SQL sem oportunidade (01/09): a SDR pode marcar Qualificado (SQL) sem
    // agendar reunião nem criar negócio. Sem esta linha o lead caía no
    // fallback e era contado como "Novo" no funil — subnotificando
    // qualificação e inflando a entrada.
    if (s === "qualified") return "qualificado";
    if (STAGNATION.includes(s)) return "estagnados";
    if (s === "contacted") return "emContato";
    if (s === "qualifying") return "qualificando";
    return "novo";
  } ;

  const geral = tally();
  const porResponsavel = new Map<string, TallySdr>();
  for (const l of leadRows) {
    const col = coluna(l) as keyof TallySdr;
    geral[col]++;
    if (l.responsavelId) {
      const m = porResponsavel.get(l.responsavelId) ?? tally();
      m[col]++;
      porResponsavel.set(l.responsavelId, m);
    }
  }

  const { novo, emContato, qualificando, qualificado, desqualificado } = geral;
  const totalEsteira = novo + emContato + qualificando + qualificado + desqualificado;
  const trabalhados = emContato + qualificando + qualificado + desqualificado;

  // Funil cumulativo. "Em contato" INCLUI desqualificados (quem foi desqualificado
  // foi contatado) — antes o card "Trabalhados 75,5%" e a barra "Em contato 50%"
  // divergiam na MESMA tela por causa disso (auditoria item 4). Agora barra = card.
  const funil = [
    { stage: "novo", label: "Novo", total: totalEsteira },
    { stage: "contacted", label: "Em contato", total: trabalhados },
    { stage: "qualifying", label: "Qualificando", total: qualificando + qualificado },
    { stage: "qualified", label: "Qualificado", total: qualificado },
  ];

  return { geral, porResponsavel, totalLeads: leadRows.length, totalEsteira, trabalhados, funil };
}
