/**
 * Webhook público dos Fluxos: POST /api/webhooks/automacoes/<token>
 * (docs/produto/automacoes-fluxos.md §3.4).
 *
 * Rota Next, não Hono: no Traefik, /api/webhooks/* é o único prefixo que vai
 * ao Next E fica fora do basic auth do dev.crm. Uma rota Hono ficaria atrás do
 * basic auth em dev e ninguém de fora conseguiria chamar.
 *
 * O token é a credencial (trate como senha). Token desconhecido e automação
 * desligada dão o mesmo 404. Corpo JSON até 256 KB, 60 chamadas/min por
 * automação, `Idempotency-Key` opcional. Responde 202 com o id da execução:
 * o fluxo roda até a primeira espera antes de responder.
 */
import { NextRequest, NextResponse } from "next/server";
import { ErroFluxo, receberWebhook } from "@/lib/automacoes/fluxos-servico";

const LIMITE = 256 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const texto = await req.text();
  if (Buffer.byteLength(texto) > LIMITE) return NextResponse.json({ error: "Corpo maior que 256 KB." }, { status: 413 });
  let corpo: unknown = {};
  if (texto.trim()) {
    try { corpo = JSON.parse(texto); } catch { return NextResponse.json({ error: "O corpo precisa ser JSON." }, { status: 400 }); }
  }
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return NextResponse.json({ error: "O corpo precisa ser um objeto JSON." }, { status: 400 });
  try {
    const r = await receberWebhook(token, corpo as Record<string, unknown>, req.headers.get("idempotency-key"));
    return NextResponse.json(r, { status: 202 });
  } catch (e) {
    if (e instanceof ErroFluxo) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[webhook automacoes] falha:", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
