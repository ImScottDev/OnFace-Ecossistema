import { db } from "@/lib/db";
import { emailContas, reunioes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createOutlookEvent } from "@/lib/email/microsoft";

/**
 * Motivo pelo qual a reunião NÃO entrou na agenda do Outlook. Sempre devolvido
 * pra UI: "reunião agendada" sem dizer que o evento não foi criado é mentira —
 * a pessoa fecha a tela achando que o cliente recebeu convite.
 */
export type MotivoOutlook =
  | "sem_outlook"       // o dono da reunião não tem conta Microsoft conectada
  | "lead_sem_email"    // evento criado, mas sem convidado (cliente não recebe convite)
  | "token_expirado"    // conta conectada, mas o refresh token morreu
  | "erro_graph"        // qualquer outra falha na chamada ao Graph
  | null;

export type ResultadoOutlook = { criado: boolean; motivo: MotivoOutlook };

export const MOTIVO_LABEL: Record<NonNullable<MotivoOutlook>, string> = {
  sem_outlook: "Reunião criada no CRM, mas NÃO entrou na agenda do Outlook: conecte sua conta Microsoft em Configurações > E-mail.",
  lead_sem_email: "Reunião criada na agenda, mas o cliente NÃO foi convidado: o lead está sem e-mail cadastrado.",
  token_expirado: "Reunião criada no CRM, mas NÃO entrou na agenda: sua conexão com a Microsoft expirou. Reconecte em Configurações > E-mail.",
  erro_graph: "Reunião criada no CRM, mas NÃO entrou na agenda do Outlook (falha ao falar com a Microsoft).",
};

/**
 * Cria o evento da reunião no calendário Outlook do dono dela e grava o
 * `outlookEventId` de volta na linha de `reunioes`.
 *
 * Existia duplicado literalmente em `api-server/routes/leads.ts` (conversão em
 * oportunidade) e `lib/integrations/callface.ts` (auto-agendamento pelo webhook
 * da ligação). O terceiro call site — o `POST /reunioes` que o Onboarding e o
 * NegocioDrawer usam — simplesmente NÃO tinha o bloco: o front mandava
 * `attendeeEmail`, o Zod descartava o campo em silêncio e a reunião nascia só
 * na tabela. Nenhum evento, nenhum convite, nenhum erro na tela (10/09/2026).
 *
 * Gravar o `outlookEventId` não é detalhe: o `OutlookReuniaoSync` só enxerga
 * reunião que tem esse id, então sem ele a reunião também nunca sincroniza
 * cancelamento/reagendamento feito do lado do Outlook.
 */
export async function criarEventoOutlookParaReuniao(opts: {
  reuniaoId: string;
  /** Dono da agenda — de quem é o calendário que recebe o evento. */
  usuarioId: string;
  /** E-mail do cliente. Sem ele o evento é criado, mas ninguém é convidado. */
  attendeeEmail?: string | null;
  /** Contexto pro log quando falhar (ex: "Onboarding", "NegocioDrawer"). */
  origem?: string;
}): Promise<ResultadoOutlook> {
  const { reuniaoId, usuarioId, attendeeEmail, origem = "Reuniao" } = opts;

  const [conta] = await db
    .select({ id: emailContas.id })
    .from(emailContas)
    .where(and(
      eq(emailContas.usuarioId, usuarioId),
      eq(emailContas.tipo, "microsoft"),
      eq(emailContas.syncStatus, "active"),
    ))
    .limit(1);

  if (!conta) return { criado: false, motivo: "sem_outlook" };

  try {
    const [reuniao] = await db
      .select({ titulo: reunioes.titulo, data: reunioes.data, duracao: reunioes.duracao, notas: reunioes.notas })
      .from(reunioes)
      .where(eq(reunioes.id, reuniaoId))
      .limit(1);

    if (!reuniao) return { criado: false, motivo: "erro_graph" };

    const inicio = new Date(reuniao.data);
    const fim = new Date(inicio.getTime() + (reuniao.duracao || 30) * 60000);
    const attendee = attendeeEmail || null;

    const evento = await createOutlookEvent({
      contaId: conta.id,
      titulo: reuniao.titulo,
      inicioISO: inicio.toISOString(),
      fimISO: fim.toISOString(),
      attendeeEmail: attendee,
      corpo: reuniao.notas || null,
    });

    await db
      .update(reunioes)
      .set({
        link: evento.joinUrl || evento.webLink,
        outlookEventId: evento.eventId,
        participantes: attendee ? [attendee] : undefined,
        updatedAt: new Date(),
      })
      .where(eq(reunioes.id, reuniaoId));

    return { criado: true, motivo: attendee ? null : "lead_sem_email" };
  } catch (e) {
    const msg = String(e);
    console.error(`[${origem}] falha ao criar evento no Outlook (usuário ${usuarioId}, reunião ${reuniaoId}):`, e);
    return {
      criado: false,
      motivo: /401|invalid_grant|token|expirad/i.test(msg) ? "token_expirado" : "erro_graph",
    };
  }
}
