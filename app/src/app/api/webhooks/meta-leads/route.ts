import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { credenciaisLeadAds, type LeadAdsBruto } from "@onface/integrations-meta";
import { abrirEntrega, chaveDaMeta } from "@/lib/captacao/entregas";
import { processarLeadMeta } from "@/lib/captacao/processar-meta";

/**
 * Entrada DIRETA de Lead Ads da Meta (SPEC §20).
 *
 * O caminho que isto substitui:
 *
 *     Meta → n8n → RD Station → /api/webhooks/rd-lead → CRM
 *     Meta → n8n → /api/webhooks/meta-lead-ids → tabela de staging
 *
 * Dois webhooks para o mesmo lead, chegando fora de ordem, com uma tabela de
 * staging existindo só para segurar o que chegou antes. E o caminho tem um
 * ponto único de falha fora de casa: em julho o token do n8n expirou e 125
 * leads pagos ficaram presos, descobertos dias depois.
 *
 * Aqui a pessoa e o anúncio chegam no MESMO fato, e o fato entra pela porta
 * canônica de aquisição — a mesma do formulário do site e do Apollo.
 *
 * O webhook antigo continua de pé: desligá-lo é decisão de operação, não efeito
 * colateral desta rota. Enquanto os dois existirem, a idempotência por
 * `leadgen_id` garante que o mesmo lead não vire dois.
 */

const ORG_SLUG = process.env.META_WEBHOOK_ORG_SLUG || "scott-studio";

/** Verificação de assinatura da Meta: `X-Hub-Signature-256: sha256=<hmac>`. */
function assinaturaConfere(corpoBruto: string, cabecalho: string | null): boolean {
  const { appSecret } = credenciaisLeadAds();
  if (!appSecret || !cabecalho?.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", appSecret).update(corpoBruto).digest("hex");
  const recebido = cabecalho.slice(7);
  if (esperado.length !== recebido.length) return false;
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

/** Handshake de assinatura do webhook, feito uma vez pela Meta. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const { verifyToken: VERIFY_TOKEN } = credenciaisLeadAds();
  if (!VERIFY_TOKEN) {
    console.error("[MetaLeads] META_WEBHOOK_VERIFY_TOKEN não configurado — recusando verificação");
    return new NextResponse("verify token not configured", { status: 503 });
  }
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const bruto = await req.text();

  // Fail-closed, igual aos webhooks de Stripe e Callface: sem segredo
  // configurado não se processa nada. Um webhook aberto é uma porta de escrita
  // pública no CRM.
  const cred = credenciaisLeadAds();
  if (!cred.appSecret) {
    console.error("[MetaLeads] META_APP_SECRET não configurado — recusando evento (fail-closed)");
    return NextResponse.json({ ok: false, error: "app secret not configured" }, { status: 503 });
  }
  if (!assinaturaConfere(bruto, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: false, error: "assinatura inválida" }, { status: 401 });
  }

  let payload: { entry?: Array<{ changes?: Array<{ field?: string; value?: LeadAdsBruto }> }> };
  try {
    payload = JSON.parse(bruto);
  } catch {
    return NextResponse.json({ ok: false, error: "json inválido" }, { status: 400 });
  }

  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id FROM organizacoes WHERE slug = ${ORG_SLUG} LIMIT 1`);
  if (!org) {
    console.error(`[MetaLeads] organização "${ORG_SLUG}" não encontrada`);
    return NextResponse.json({ ok: false, error: "organização não encontrada" }, { status: 500 });
  }

  /* O dono é decidido POR LEAD e DEPOIS da deduplicação (lib/captacao/distribuir.ts).
   * Antes era resolvido uma vez aqui, antes do laço: o lote inteiro ia para a
   * mesma pessoa e cada reentrega gastava uma vez do rodízio. */

  const resultados: Array<{ metaLeadId: string | null; ok: boolean; motivo?: string }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== "leadgen") continue;
      if (!change.value) continue;

      // BUSCA NA GRAPH API — não é otimização, é obrigatório.
      //
      // O webhook de leadgen NÃO traz os dados do lead: ele avisa que existe um
      // lead e entrega o `leadgen_id`. Nome, e-mail, telefone e as respostas do
      // formulário só aparecem depois de buscar em `/{leadgen_id}`.
      //
      // Assumir `field_data` no payload funciona com o integrador que já buscou
      // por nós, e falha em silêncio quando a Meta chama direto.
      const leadgenId = String(change.value.leadgen_id ?? "");

      // Caixa de entrada (0131): a entrega fica guardada como chegou, ANTES de
      // qualquer busca. Reentrega de um leadgen já processado não busca na
      // Graph, não toca no lead e não gasta vez de rodízio.
      const entrega = await abrirEntrega({
        organizacaoId: org.id, canal: "meta",
        chave: chaveDaMeta(change.value as unknown as Record<string, unknown>), payload: change.value,
      });
      if (entrega.duplicada) {
        resultados.push({ metaLeadId: leadgenId || null, ok: true, motivo: "reentrega" });
        continue;
      }

      resultados.push(await processarLeadMeta({ organizacaoId: org.id, valor: change.value, entregaId: entrega.id, accessToken: cred.accessToken }));
    }
  }

  // A Meta reentrega quando não recebe 200 rápido, e reentrega do mesmo fato é
  // o mesmo lead — a idempotência já trata. Responder 200 aqui evita fila de
  // retentativa por um lead que nós é que não conseguimos processar.
  /* Lead que chegou e NÃO entrou é incidente, não rotina.
   *
   * Antes isto devolvia sempre 200 com `ok:true`. A Meta lê 200 como entregue
   * e nunca retenta — então retrieval falhando por permissão da Página, ou
   * formulário com nome de campo fora dos sinônimos, matava o lead em
   * silêncio: nenhum contador subia, nenhum alerta saía, e a descoberta vinha
   * quando alguém perguntasse por que o board estava vazio. Foi assim que se
   * perderam 125 leads em julho.
   *
   * Devolver 500 faz a Meta RETENTAR, o que dá tempo de corrigir a permissão
   * sem perder o lead. E o erro fica no log com o motivo de cada um. */
  const perdidos = resultados.filter((x) => !x.ok);
  if (perdidos.length > 0) {
    console.error(
      `[MetaLeads] ${perdidos.length} de ${resultados.length} lead(s) NÃO entraram:`,
      perdidos.map((x) => `${x.metaLeadId}: ${x.motivo ?? "sem motivo"}`).join(" | "),
    );
    return NextResponse.json(
      { ok: false, processados: resultados.length, perdidos: perdidos.length, resultados },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, processados: resultados.length, resultados });
}
