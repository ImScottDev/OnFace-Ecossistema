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
  /** Organização dona da reunião. */
  organizacaoId?: string;
}): Promise<ResultadoOutlook> {
  // DELEGA ao CalendarProvider (Módulo 09).
  //
  // Esta função foi escrita para deduplicar três call sites que chamavam o
  // Graph direto, e terminou sem NENHUM chamador — o defeito recorrente de
  // peça pronta sem caller. Em vez de apagá-la ou de manter uma quarta cópia
  // da lógica, ela virou a ponte: quem a chamar entra no provider, que grava
  // provider, event id e estado de sincronização.
  const { criarNaAgenda } = await import("@/lib/calendario/sincronizar");

  let organizacaoId = opts.organizacaoId ?? null;
  if (!organizacaoId) {
    const [r] = await db.select({ organizacaoId: reunioes.organizacaoId })
      .from(reunioes).where(eq(reunioes.id, opts.reuniaoId)).limit(1);
    organizacaoId = r?.organizacaoId ?? null;
  }
  if (!organizacaoId) return { criado: false, motivo: "erro_graph" };

  const res = await criarNaAgenda(organizacaoId, opts.reuniaoId);
  if (res.sincronizado) return { criado: true, motivo: opts.attendeeEmail ? null : "lead_sem_email" };

  // Traduz o motivo do provider para o vocabulário que esta função já
  // devolvia, para nenhum chamador quebrar.
  const aviso = res.aviso ?? "";
  const motivo: MotivoOutlook = /não tem calendário conectado/i.test(aviso) ? "sem_outlook"
    : /expirou/i.test(aviso) ? "token_expirado"
    : "erro_graph";
  console.warn(`[${opts.origem ?? "Reuniao"}] evento não entrou na agenda (${motivo}): ${aviso}`);
  return { criado: false, motivo };
}
