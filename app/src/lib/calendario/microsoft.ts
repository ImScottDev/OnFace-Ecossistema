/**
 * Adapter Microsoft do CalendarProvider.
 *
 * REUSA o cliente Graph que já existia (`lib/email/microsoft.ts`) em vez de
 * escrever outro: ali já moram a troca de token, o refresh e o tratamento de
 * 404. O que faltava era só `updateOutlookEvent`, que entrou no mesmo arquivo.
 *
 * A conta da agenda é a conexão Microsoft ATIVA do usuário dono da reunião —
 * é ela que garante o isolamento: ninguém escreve no calendário de outro.
 */
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  createOutlookEvent, updateOutlookEvent, deleteOutlookEvent, getBusyTimes,
} from "@/lib/email/microsoft";
import type {
  CalendarProvider, EventoParaCriar, EventoParaAtualizar, ResultadoProvider, MotivoFalha,
} from "./provider";

/** Token morto e falha de rede pedem reações diferentes: uma reconecta, a outra repete. */
function classificar(e: unknown): { motivo: MotivoFalha; tentarDeNovo: boolean; detalhe: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid_grant|refresh|401|unauthor/i.test(msg)) {
    return { motivo: "token_expirado", tentarDeNovo: false, detalhe: msg.slice(0, 300) };
  }
  const transitorio = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|503|502|429/i.test(msg);
  return { motivo: "erro_provedor", tentarDeNovo: transitorio, detalhe: msg.slice(0, 300) };
}

export const microsoftCalendar: CalendarProvider = {
  nome: "microsoft",

  configurado() {
    return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
  },

  async contaDoUsuario(usuarioId: string): Promise<string | null> {
    const [conta] = await db
      .select({ id: emailContas.id })
      .from(emailContas)
      .where(and(
        eq(emailContas.usuarioId, usuarioId),
        eq(emailContas.tipo, "microsoft"),
        eq(emailContas.syncStatus, "active"),
      ))
      .limit(1);
    return conta?.id ?? null;
  },

  async criar(contaId: string, ev: EventoParaCriar): Promise<ResultadoProvider> {
    try {
      const criado = await createOutlookEvent({
        contaId,
        titulo: ev.titulo,
        inicioISO: ev.inicioISO,
        fimISO: ev.fimISO,
        corpo: ev.corpo ?? undefined,
        attendeeEmail: ev.convidadoEmail ?? undefined,
        semTeams: ev.online === false,
      });
      return { ok: true, eventId: criado.eventId, link: criado.webLink, joinUrl: criado.joinUrl };
    } catch (e) {
      const c = classificar(e);
      return { ok: false, ...c };
    }
  },

  async atualizar(contaId: string, eventId: string, m: EventoParaAtualizar): Promise<ResultadoProvider> {
    try {
      const r = await updateOutlookEvent({
        contaId, eventId,
        titulo: m.titulo, inicioISO: m.inicioISO, fimISO: m.fimISO, corpo: m.corpo,
      });
      // Evento apagado no Outlook não é erro de integração: é estado. Quem
      // chama decide se recria em vez de repetir um PATCH que nunca vai passar.
      if (r.naoExiste) return { ok: true, eventId: null, naoExiste: true };
      return { ok: true, eventId };
    } catch (e) {
      return { ok: false, ...classificar(e) };
    }
  },

  async ocupados(contaId: string, inicioISO: string, fimISO: string) {
    try {
      return { ok: true as const, faixas: await getBusyTimes(contaId, inicioISO, fimISO) };
    } catch (e) {
      const { motivo, detalhe } = classificar(e);
      return { ok: false as const, motivo, detalhe };
    }
  },

  async cancelar(contaId: string, eventId: string): Promise<ResultadoProvider> {
    try {
      await deleteOutlookEvent(contaId, eventId);
      return { ok: true, eventId };
    } catch (e) {
      return { ok: false, ...classificar(e) };
    }
  },
};
