import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  normalizarLeadAds, chaveDeIdempotencia, buscarLeadNaGraph, combinar,
  credenciaisLeadAds, type LeadAdsBruto,
} from "@onface/integrations-meta";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";

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
      let bruto = change.value;
      if (leadgenId) {
        const busca = await buscarLeadNaGraph(leadgenId, cred.accessToken);
        if (busca.ok && busca.lead) {
          bruto = combinar(change.value, busca.lead);
        } else {
          // Config ausente e permissão pendente NÃO são bug: são estado
          // conhecido, e precisam aparecer como tal no log para ninguém
          // procurar defeito onde não tem.
          const tipo = busca.semCredencial ? "sem credencial"
            : busca.semPermissao ? "permissão da Página pendente"
            : "falha";
          console.warn(`[MetaLeads] retrieval do lead ${leadgenId} não ocorreu (${tipo}): ${busca.erro}`);
        }
      }

      const n = normalizarLeadAds(bruto);

      // Sem e-mail nem telefone não há identidade, e sem identidade a porta
      // canônica recusa — de propósito. Inventar identificador para a entrada
      // passar seria trocar um lead perdido por um registro que ninguém
      // consegue contatar, que é pior.
      if (!n.email && !n.telefone) {
        console.warn(`[MetaLeads] lead ${n.metaLeadId} sem e-mail e sem telefone; não entrou`);
        resultados.push({ metaLeadId: n.metaLeadId, ok: false, motivo: "sem identificador" });
        continue;
      }

      const r = await garantirEntradaCanonica({
        organizacaoId: org.id,
        tipo: "INBOUND",
        origem: "Mídia Paga",
        provider: "meta",
        pessoa: { nome: n.nome, email: n.email, telefone: n.telefone, cargo: n.cargo },
        empresa: n.empresa ? { nome: n.empresa } : null,
        atribuicao: {
          utmSource: n.atribuicao.utmSource,
          utmMedium: n.atribuicao.utmMedium,
          utmCampaign: n.atribuicao.utmCampaign,
          utmContent: n.atribuicao.utmContent,
          utmTerm: n.atribuicao.utmTerm,
          metaLeadId: n.atribuicao.metaLeadId,
          adId: n.atribuicao.adId,
          adsetId: n.atribuicao.adsetId,
          campaignId: n.atribuicao.campaignId,
        },
        idempotencyKey: chaveDeIdempotencia(n),
        ocorridoEm: n.ocorridoEm,
      });

      resultados.push({ metaLeadId: n.metaLeadId, ok: r.ok, motivo: r.erro });
      if (!r.ok) console.error(`[MetaLeads] lead ${n.metaLeadId} não entrou: ${r.erro}`);
    }
  }

  // A Meta reentrega quando não recebe 200 rápido, e reentrega do mesmo fato é
  // o mesmo lead — a idempotência já trata. Responder 200 aqui evita fila de
  // retentativa por um lead que nós é que não conseguimos processar.
  return NextResponse.json({ ok: true, processados: resultados.length, resultados });
}
