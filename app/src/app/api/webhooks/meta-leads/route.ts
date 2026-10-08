import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sql, and, eq } from "drizzle-orm";
import { leads, statusChanges } from "@/lib/db/schema";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";
import { garantirAtividadePrimeiroContato, resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";
import { resolverEmpresaId, dominioCorporativo } from "@/lib/crm/resolver-empresa";
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

  // Mesmo dono que a rota do RD resolve: regra de distribuição, senão a política da org.
  const { resolverPorRegra } = await import("@/lib/agentes/distribuicao");
  const responsavelInboundId = (await resolverPorRegra({ organizacaoId: org.id, etapa: "novo" }))?.responsavelId
    ?? await resolverResponsavelInbound(org.id);

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

      /* O LEGADO PRIMEIRO, como a ponte exige (ver ponte-canonica.ts).
       *
       * As telas (board de pré-vendas, listas) ainda leem `leads`. Sem gravar
       * aqui, o lead da Meta nascia só como pessoa + aquisição e não aparecia
       * em tela nenhuma. Espelha a rota do RD (rd-lead/route.ts): dedup por
       * e-mail e depois telefone, first-touch preservado, lead novo no board
       * de pré-vendas sem negócio. Mudou lá, confira aqui.
       *
       * Falha aqui não derruba a captação: sem `leadId` a ponte ainda garante
       * o canônico, e o backfill reconcilia o vínculo. */
      let leadId: string | null = null;
      try {
        const [primeiro, ...resto] = (n.nome ?? "").trim().split(/\s+/).filter(Boolean);
        const nome = primeiro || n.email?.split("@")[0] || "Lead Meta";
        const sobrenome = resto.join(" ") || null;
        const respostas = n.respostas ?? {};
        const a = n.atribuicao;

        let existing: { id: string; tipo: string; camposCustom: unknown; responsavelId: string | null; empresaId: string | null } | undefined;
        const cols = { id: leads.id, tipo: leads.tipo, camposCustom: leads.camposCustom, responsavelId: leads.responsavelId, empresaId: leads.empresaId };
        for (const [coluna, valor] of [[leads.email, n.email], [leads.telefone, n.telefone]] as const) {
          if (existing || !valor) continue;
          [existing] = await db.select(cols).from(leads)
            .where(and(eq(leads.organizacaoId, org.id), eq(coluna, valor)))
            .orderBy(sql`case when ${leads.tipo} = 'cliente' then 1 else 0 end`)
            .limit(1);
        }

        const empresaIdResolvida = await resolverEmpresaId({
          organizacaoId: org.id, nome: n.empresa, website: dominioCorporativo(n.email),
        });

        if (existing && existing.tipo !== "cliente") {
          // Atualiza sem sobrescrever first-touch/UTM (mesmo COALESCE do RD).
          const keep = (col: unknown, v: string | null | undefined) => sql`COALESCE(NULLIF(${col}, ''), ${v ?? null})`;
          await db.update(leads).set({
            ...(n.empresa ? { empresa: n.empresa } : {}),
            ...(empresaIdResolvida ? { empresaId: sql`COALESCE(${leads.empresaId}, ${empresaIdResolvida}::uuid)` } : {}),
            ...(n.cargo ? { cargo: n.cargo } : {}),
            origem: keep(leads.origem, "Mídia Paga"),
            utmSource: keep(leads.utmSource, a.utmSource),
            utmMedium: keep(leads.utmMedium, a.utmMedium),
            utmCampaign: keep(leads.utmCampaign, a.utmCampaign),
            utmTerm: keep(leads.utmTerm, a.utmTerm),
            utmContent: keep(leads.utmContent, a.utmContent),
            ...(a.adId ? { metaAdId: keep(leads.metaAdId, a.adId) } : {}),
            ...(a.adsetId ? { metaAdsetId: keep(leads.metaAdsetId, a.adsetId) } : {}),
            ...(a.campaignId ? { metaCampaignId: keep(leads.metaCampaignId, a.campaignId) } : {}),
            // Respostas novas entram por cima; o que já estava preenchido e não veio, fica.
            camposCustom: { ...((existing.camposCustom as Record<string, unknown>) || {}), ...respostas },
            updatedAt: new Date(),
          }).where(eq(leads.id, existing.id));
          leadId = existing.id;
          await garantirAtividadePrimeiroContato({
            organizacaoId: org.id, leadId, empresaId: existing.empresaId,
            responsavelId: existing.responsavelId ?? responsavelInboundId,
          });
        } else {
          // Não existe (ou é cliente, que não se toca): lead novo no board.
          const [novo] = await db.insert(leads).values({
            organizacaoId: org.id, nome, sobrenome,
            email: n.email, telefone: n.telefone,
            empresa: n.empresa, empresaId: empresaIdResolvida, cargo: n.cargo,
            origem: "Mídia Paga",
            utmSource: a.utmSource, utmMedium: a.utmMedium, utmCampaign: a.utmCampaign,
            utmTerm: a.utmTerm, utmContent: a.utmContent,
            metaAdId: a.adId, metaAdsetId: a.adsetId, metaCampaignId: a.campaignId,
            camposCustom: respostas,
            tipo: "lead", status: "novo", sdrStatus: "pending",
            responsavelId: responsavelInboundId,
          }).returning({ id: leads.id });
          leadId = novo.id;
          await db.insert(statusChanges).values({ leadId, negocioId: null, deStatus: null, paraStatus: "novo" });
          await garantirAtividadePrimeiroContato({
            organizacaoId: org.id, leadId, empresaId: null, responsavelId: responsavelInboundId,
          });
        }
        await syncPessoaFromLead(leadId); // dual-write, best-effort
      } catch (e) {
        console.error(`[MetaLeads] lead legado não gravado (${n.metaLeadId}); canônico segue sem vínculo:`, e);
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
        responsavelId: responsavelInboundId ?? null,
        idempotencyKey: chaveDeIdempotencia(n),
        ocorridoEm: n.ocorridoEm,
      }, leadId);

      // A ponte só grava o vínculo quando CRIA a aquisição. Reentrega ou
      // aquisição já aberta devolve a existente sem lead_legado_id; vincula aqui
      // sem tomar um vínculo já feito.
      if (r.ok && leadId) {
        await db.execute(sql`
          UPDATE aquisicoes SET lead_legado_id = ${leadId}::uuid
           WHERE id = ${r.aquisicaoId}::uuid AND organizacao_id = ${org.id}::uuid AND lead_legado_id IS NULL
        `).catch((e) => console.error(`[MetaLeads] vínculo lead↔aquisição não gravado (${n.metaLeadId}):`, e));
      }

      resultados.push({ metaLeadId: n.metaLeadId, ok: r.ok, motivo: r.erro });
      if (!r.ok) console.error(`[MetaLeads] lead ${n.metaLeadId} não entrou: ${r.erro}`);
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
