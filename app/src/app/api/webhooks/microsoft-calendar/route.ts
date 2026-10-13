import { NextRequest, NextResponse } from "next/server";
import { processarNotificacoes, type NotificacaoGraph } from "@/lib/calendario/volta";

/**
 * POST /api/webhooks/microsoft-calendar
 * Change notifications do Microsoft Graph (assinatura em /me/events): o Outlook
 * mudou ou apagou um evento -> a reunião do ONFACE acompanha.
 *
 * Contrato do Graph:
 *  - Ao criar a assinatura ele faz POST com `?validationToken=...` e exige o
 *    token de volta em text/plain, 200, em até 10 s.
 *  - Notificações chegam em lote e pedem 202 em poucos segundos; o trabalho
 *    roda depois da resposta. Se uma se perder, a delta do worker (5 min) cobre.
 *
 * Segurança: FAIL-CLOSED. Sem MICROSOFT_CALENDAR_CLIENT_STATE no ambiente a
 * rota recusa tudo (503), inclusive a validação. Cada notificação traz o
 * `clientState` que gravamos ao assinar; o que não bate é descartado.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const clientState = process.env.MICROSOFT_CALENDAR_CLIENT_STATE;
  if (!clientState) {
    console.error("[MicrosoftCalendarWebhook] MICROSOFT_CALENDAR_CLIENT_STATE não configurado — recusando (fail-closed)");
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  let lote: NotificacaoGraph[];
  try {
    lote = ((await request.json()) as { value?: NotificacaoGraph[] }).value ?? [];
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  // Nenhuma notificação com o segredo certo: 401 (o Graph não reenvia o que não é dele).
  if (!lote.some((n) => n.clientState === clientState)) {
    return NextResponse.json({ error: "invalid clientState" }, { status: 401 });
  }

  void processarNotificacoes(lote, clientState).catch((e) =>
    console.error("[MicrosoftCalendarWebhook] falha ao processar o lote:", e instanceof Error ? e.message : e));
  return new NextResponse(null, { status: 202 });
}
