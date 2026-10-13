/**
 * Disponibilidade da EQUIPE para agentes (Lia/SDR e NEXO): uma função, uma regra.
 *
 * Cada closer entra com a própria grade (horário comercial e almoço de
 * `closer_disponibilidade`), menos reuniões e bloqueios do CRM, menos o
 * ocupado real do Outlook dela (getSchedule), com a antecedência mínima de
 * `horariosLivres`. Tudo em America/Sao_Paulo. Closer sem agenda verificada
 * não oferece nada: "não consegui ver" não é "livre".
 *
 * O closer de cada horário sai do rodízio existente (`getFilaClosers`): quando
 * duas pessoas estão livres no mesmo instante, ganha a que está mais perto da
 * vez. Uma regra comercial que fixa o closer restringe `closerIds` a ele.
 */
import { db } from "@/lib/db";
import { getFilaClosers } from "@/lib/crm/agenda-closers";
import { horariosLivres, type SlotLivre } from "./agendar-agente";

export interface SlotEquipe extends SlotLivre { closerId: string; closerNome: string }
export interface DisponibilidadeEquipe {
  /** Pelo menos uma closer teve a agenda verificada. */
  verificado: boolean;
  fuso: "America/Sao_Paulo";
  closers: { id: string; nome: string; verificado: boolean; motivo?: string }[];
  slots: SlotEquipe[];
}

export async function horariosLivresEquipe(o: {
  organizacaoId: string;
  /** Só estas closers (regra que fixa o destino). Vazio/ausente = todas as ativas no rodízio. */
  closerIds?: string[];
  /** Vai na frente do rodízio (a closer sugerida pela regra). */
  preferidoId?: string | null;
  duracaoMin?: number;
  dias?: number;
  maxSlots?: number;
  exigirOutlook?: boolean;
}): Promise<DisponibilidadeEquipe> {
  const fila = (await getFilaClosers(db, o.organizacaoId)).filter((c) => !c.pausado || o.closerIds?.includes(c.id));
  let ordem = fila.filter((c) => !o.closerIds?.length || o.closerIds.includes(c.id));
  if (o.preferidoId) ordem = [...ordem.filter((c) => c.id === o.preferidoId), ...ordem.filter((c) => c.id !== o.preferidoId)];

  const porCloser = await Promise.all(ordem.map(async (c) => ({
    c, d: await horariosLivres({ organizacaoId: o.organizacaoId, closerId: c.id, duracaoMin: o.duracaoMin, dias: o.dias, maxSlots: 500, porDia: 24, exigirOutlook: o.exigirOutlook }),
  })));

  // Um horário por instante; o closer é o primeiro da ordem que está livre nele.
  const porInstante = new Map<string, SlotEquipe>();
  for (const { c, d } of porCloser) {
    for (const s of d.slots) if (!porInstante.has(s.inicioISO)) porInstante.set(s.inicioISO, { ...s, closerId: c.id, closerNome: c.nome });
  }
  const todos = [...porInstante.values()].sort((a, b) => a.inicioISO.localeCompare(b.inicioISO));

  // Oferta enxuta: no máximo 2 por dia, para cobrir dias diferentes.
  const dia = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const contagem = new Map<string, number>();
  const slots: SlotEquipe[] = [];
  for (const s of todos) {
    const k = dia(s.inicioISO), n = contagem.get(k) ?? 0;
    if (n >= 2 || slots.length >= (o.maxSlots ?? 6)) continue;
    contagem.set(k, n + 1);
    slots.push(s);
  }
  return {
    verificado: porCloser.some(({ d }) => d.verificado),
    fuso: "America/Sao_Paulo",
    closers: porCloser.map(({ c, d }) => ({ id: c.id, nome: c.nome, verificado: d.verificado, ...(d.motivoNaoVerificado ? { motivo: d.motivoNaoVerificado } : {}) })),
    slots,
  };
}
