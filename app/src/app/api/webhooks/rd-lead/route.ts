import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, organizacoes, statusChanges, notas, metaLeadStaging } from "@/lib/db/schema";
import { and, eq, or, desc, sql } from "drizzle-orm";
import {
  parseRdLead,
  isCallfaceLead,
  type ParsedRdLead,
} from "@/lib/integrations/rd-station";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";
import { garantirAtividadePrimeiroContato, resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";
import { telefoneUsavel } from "@/lib/whatsapp/phone-utils";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";
import { resolverEmpresaId, dominioCorporativo } from "@/lib/crm/resolver-empresa";

/**
 * Busca IDs reais da Meta deixados em staging pelo webhook /api/webhooks/meta-lead-ids
 * (chega antes do lead existir, já que RD Station processa em paralelo, sem ordem
 * garantida — ver comentário grande no route.ts de meta-lead-ids). Marca como usado
 * pra não ser reaproveitado por outro lead.
 */
async function buscarMetaIdsStaging(
  email: string | undefined,
  telefone: string | undefined
): Promise<{ adId?: string; adsetId?: string; campaignId?: string; telefone?: string } | null> {
  if (!email && !telefone) return null;
  const condicoes = [];
  if (email) condicoes.push(eq(metaLeadStaging.email, email));
  if (telefone) condicoes.push(eq(metaLeadStaging.telefone, telefone));
  const [row] = await db
    .select()
    .from(metaLeadStaging)
    .where(and(eq(metaLeadStaging.usado, false), or(...condicoes)))
    .orderBy(desc(metaLeadStaging.createdAt))
    .limit(1);
  if (!row) return null;
  await db.update(metaLeadStaging).set({ usado: true }).where(eq(metaLeadStaging.id, row.id));
  return {
    adId: row.adId ?? undefined,
    adsetId: row.adsetId ?? undefined,
    campaignId: row.campaignId ?? undefined,
    // A Meta manda o telefone certo aqui. O RD nem sempre (ver backfill abaixo).
    telefone: telefoneUsavel(row.telefone) ?? undefined,
  };
}

/**
 * Webhook de ingestão de leads do RD Station.
 *
 * POST /api/webhooks/rd-lead?token=<secret>
 *
 * Recebe o payload do RD (`body.leads[]`), filtra os que são da Callface,
 * parseia (nome, contato, origem, UTMs) e cria o lead direto no board de
 * pré-vendas (tipo='lead', status='novo', sdrStatus='pending'). NÃO cria
 * negócio: a oportunidade só nasce quando a SDR qualifica e converte (decisão
 * do fluxo Callface, ver callface/crm-callface-status.md).
 *
 * Dedup por email (e telefone) dentro da org. Quem já é cliente é preservado.
 */

const ORG_SLUG = "scott-studio"; // slug interno da org Callface
// FAIL-CLOSED (14/09): o default era um secret literal escrito neste
// arquivo — público pra quem tem o repositório, ou seja, sem proteção
// nenhuma quando a variável não estava setada. Mesmo padrão do webhook
// de Stripe e do de Callface: sem segredo configurado, não processa.
const SECRET = process.env.RD_WEBHOOK_SECRET || "";

interface RdPayloadLead {
  email?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  // Auth simples por token (query ?token= ou header x-webhook-secret)
  const token =
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("x-webhook-secret");
  if (!SECRET) {
    console.error("[RdLeadWebhook] RD_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
    return NextResponse.json({ ok: false, error: "webhook secret not configured" }, { status: 503 });
  }
  if (token !== SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Aceita body.leads[] (formato RD), body.lead, array cru ou objeto único
  const b = body as { leads?: RdPayloadLead[]; lead?: RdPayloadLead };
  const rdLeads: RdPayloadLead[] = Array.isArray(b?.leads)
    ? b.leads
    : b?.lead
    ? [b.lead]
    : Array.isArray(body)
    ? (body as RdPayloadLead[])
    : body
    ? [body as RdPayloadLead]
    : [];

  if (rdLeads.length === 0) {
    return NextResponse.json({ ok: true, message: "no leads in payload" });
  }

  // Resolve org Callface
  const [org] = await db
    .select({ id: organizacoes.id })
    .from(organizacoes)
    .where(eq(organizacoes.slug, ORG_SLUG))
    .limit(1);
  if (!org) {
    return NextResponse.json(
      { ok: false, error: "org not found" },
      { status: 500 }
    );
  }

  // O dono vem da política da organização; não existe nome de pessoa gravado
  // no webhook. Sem política válida o lead continua visível na fila sem dono.
  const responsavelInboundId = await resolverResponsavelInbound(org.id);
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const results: Array<{ status: string; leadId?: string; email?: string }> = [];

  for (const rd of rdLeads) {
    try {
      if (!isCallfaceLead(rd)) {
        results.push({ status: "skipped:not-callface", email: rd.email });
        continue;
      }

      const p: ParsedRdLead = parseRdLead(rd);
      const metaIds = await buscarMetaIdsStaging(p.email, p.telefone);

      // Telefone: a fonte boa é a Meta, não o RD. A ponte Meta→RD lê o campo do
      // formulário pelo nome e, quando o form usa outro nome, grava lixo na
      // conversão ("undefined", e num caso real "Brazil" — leu o campo de país).
      // O mesmo lead chega íntegro no meta_lead_staging, então quando o RD não
      // trouxe telefone usável a gente pega o da Meta. Isso roda ANTES do dedup
      // de propósito: com o número certo o lead casa com quem ele é de verdade.
      if (!p.telefone && metaIds?.telefone) p.telefone = metaIds.telefone;

      // Campos do formulário que não têm coluna própria vão pro camposCustom
      // (Tipo de negócio e Tamanho da base vêm nas tags do RD).
      const formCampos: Record<string, unknown> = {};
      if (p.tipoNegocio) formCampos.tipoNegocio = p.tipoNegocio;
      if (p.tamanhoBase) formCampos.tamanhoBase = p.tamanhoBase;

      // Nota com o que o lead preencheu no form (sempre visível na ficha).
      const notaLinhas = [
        "Lead recebido pela Landing Page (formulário).",
        p.empresa ? `• Empresa: ${p.empresa}` : null,
        p.tipoNegocio || p.cargo ? `• Tipo de negócio: ${p.tipoNegocio || p.cargo}` : null,
        p.tamanhoBase ? `• Tamanho da base: ${p.tamanhoBase}` : null,
        p.telefone ? `• WhatsApp: ${p.telefone}` : null,
        p.email ? `• E-mail: ${p.email}` : null,
        p.utmCampaign ? `• Campanha: ${p.utmCampaign}` : null,
      ].filter(Boolean);
      const notaConteudo = notaLinhas.join("\n");
      const temFormData = !!(p.tipoNegocio || p.tamanhoBase || p.empresa);

      // Dedup por email (depois telefone) dentro da org
      let existing:
        | { id: string; tipo: string; camposCustom: unknown; responsavelId: string | null; empresaId: string | null }
        | undefined;
      if (p.email) {
        [existing] = await db
          .select({ id: leads.id, tipo: leads.tipo, camposCustom: leads.camposCustom, responsavelId: leads.responsavelId, empresaId: leads.empresaId })
          .from(leads)
          .where(
            and(eq(leads.organizacaoId, org.id), eq(leads.email, p.email))
          )
          // Prefere o lead do pipeline sobre o registro de cliente, pra uma
          // reconversão de cliente atualizar o lead em vez de empilhar duplicata.
          .orderBy(sql`case when ${leads.tipo} = 'cliente' then 1 else 0 end`)
          .limit(1);
      }
      if (!existing && p.telefone) {
        [existing] = await db
          .select({ id: leads.id, tipo: leads.tipo, camposCustom: leads.camposCustom, responsavelId: leads.responsavelId, empresaId: leads.empresaId })
          .from(leads)
          .where(
            and(
              eq(leads.organizacaoId, org.id),
              eq(leads.telefone, p.telefone)
            )
          )
          .orderBy(sql`case when ${leads.tipo} = 'cliente' then 1 else 0 end`)
          .limit(1);
      }

      // Empresa como entidade, não só texto: sem isso o lead cai no drawer como
      // "Sem cadastro — clique pra criar e vincular" e alguém tem que vincular à mão.
      const empresaIdResolvida = await resolverEmpresaId({
        organizacaoId: org.id,
        nome: p.empresa,
        website: dominioCorporativo(p.email),
      });

      // Já existe como lead/prospect no pipeline (não-cliente): atualiza, não duplica.
      if (existing && existing.tipo !== "cliente") {
        // Mescla camposCustom pra não apagar qualificação/custom já preenchidos.
        const mergedCampos = {
          ...((existing.camposCustom as Record<string, unknown>) || {}),
          ...formCampos,
        };
        // FIRST-TOUCH preservado (pré-requisito ENG-667): reconversão NÃO sobrescreve
        // a origem/UTM original do lead — a atribuição de receita usa a campanha que
        // TROUXE o lead, não a última página que ele visitou. Só preenche o que está vazio.
        await db
          .update(leads)
          .set({
            empresa: p.empresa,
            // Não rouba o vínculo já feito (inclusive o manual, no drawer): só preenche se estiver vazio.
            ...(empresaIdResolvida
              ? { empresaId: sql`COALESCE(${leads.empresaId}, ${empresaIdResolvida}::uuid)` }
              : {}),
            cargo: p.cargo,
            origem: sql`COALESCE(NULLIF(${leads.origem}, ''), ${p.origem ?? null})`,
            utmSource: sql`COALESCE(NULLIF(${leads.utmSource}, ''), ${p.utmSource ?? null})`,
            utmMedium: sql`COALESCE(NULLIF(${leads.utmMedium}, ''), ${p.utmMedium ?? null})`,
            utmCampaign: sql`COALESCE(NULLIF(${leads.utmCampaign}, ''), ${p.utmCampaign ?? null})`,
            utmTerm: sql`COALESCE(NULLIF(${leads.utmTerm}, ''), ${p.utmTerm ?? null})`,
            utmContent: sql`COALESCE(NULLIF(${leads.utmContent}, ''), ${p.utmContent ?? null})`,
            ...(metaIds?.adId ? { metaAdId: sql`COALESCE(NULLIF(${leads.metaAdId}, ''), ${metaIds.adId})` } : {}),
            ...(metaIds?.adsetId ? { metaAdsetId: sql`COALESCE(NULLIF(${leads.metaAdsetId}, ''), ${metaIds.adsetId})` } : {}),
            ...(metaIds?.campaignId ? { metaCampaignId: sql`COALESCE(NULLIF(${leads.metaCampaignId}, ''), ${metaIds.campaignId})` } : {}),
            landingPage: p.landingPage,
            camposCustom: mergedCampos,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, existing.id));
        if (temFormData) {
          await db.insert(notas).values({
            organizacaoId: org.id,
            leadId: existing.id,
            conteudo: notaConteudo,
          });
        }
        await syncPessoaFromLead(existing.id); // F1/dual-write, best-effort
        await garantirAtividadePrimeiroContato({
          organizacaoId: org.id,
          leadId: existing.id,
          empresaId: existing.empresaId,
          responsavelId: existing.responsavelId ?? responsavelInboundId,
        });
        results.push({ status: "updated", leadId: existing.id, email: p.email });
        continue;
      }

      // Já é cliente (ou não existe ainda): NÃO bloqueia. Um cliente que converte
      // na LP quer upgrade / novo produto (ex.: White Label) → tem que ir pro
      // board de pré-vendas como lead novo, SEM mexer no registro de cliente.
      // Sinaliza na nota pra SDR saber que é um cliente atual.
      const jaCliente = existing?.tipo === "cliente";

      // Cria lead novo direto no board de pré-vendas (sem negócio)
      const [newLead] = await db
        .insert(leads)
        .values({
          organizacaoId: org.id,
          nome: p.nome,
          sobrenome: p.sobrenome,
          email: p.email,
          telefone: p.telefone,
          empresa: p.empresa,
          empresaId: empresaIdResolvida,
          cargo: p.cargo,
          origem: p.origem,
          utmSource: p.utmSource,
          utmMedium: p.utmMedium,
          utmCampaign: p.utmCampaign,
          utmTerm: p.utmTerm,
          utmContent: p.utmContent,
          metaAdId: metaIds?.adId,
          metaAdsetId: metaIds?.adsetId,
          metaCampaignId: metaIds?.campaignId,
          landingPage: p.landingPage,
          camposCustom: formCampos,
          ipAddress,
          userAgent,
          tipo: "lead",
          status: "novo",
          sdrStatus: "pending",
          responsavelId: responsavelInboundId,
        })
        .returning({ id: leads.id });

      // CUTOVER (fase 16): o mesmo fato entra no modelo canônico. A escrita
      // legada acima continua porque as telas ainda leem `leads`; esta chamada
      // sai na fase 25, junto com ela. Best-effort: falha aqui não derruba a
      // captação de um lead de campanha paga.
      await garantirEntradaCanonica({
        organizacaoId: org.id,
        tipo: "INBOUND",
        origem: p.origem ?? "RD Station",
        provider: "rd-station",
        pessoa: { nome: p.nome, sobrenome: p.sobrenome, email: p.email, telefone: p.telefone, cargo: p.cargo },
        empresa: p.empresa ? { nome: p.empresa } : null,
        atribuicao: {
          utmSource: p.utmSource, utmMedium: p.utmMedium, utmCampaign: p.utmCampaign,
          utmTerm: p.utmTerm, utmContent: p.utmContent, landingPage: p.landingPage,
          campaignId: metaIds?.campaignId, adsetId: metaIds?.adsetId, adId: metaIds?.adId,
        },
        responsavelId: responsavelInboundId ?? null,
        idempotencyKey: p.email ? `rd:${org.id}:${p.email}` : null,
      }, newLead.id);

      // Timeline inicial (sem negócio vinculado)
      await db.insert(statusChanges).values({
        leadId: newLead.id,
        negocioId: null,
        deStatus: null,
        paraStatus: "novo",
      });

      await garantirAtividadePrimeiroContato({
        organizacaoId: org.id,
        leadId: newLead.id,
        empresaId: null,
        responsavelId: responsavelInboundId,
      });

      // Nota com o que foi preenchido no form (sempre visível na ficha).
      // Se já é cliente, prefixa um aviso pra SDR (possível upgrade/novo produto).
      if (temFormData || jaCliente) {
        const conteudo = jaCliente
          ? `⚠️ Este contato JÁ É CLIENTE Callface — converteu de novo na LP (possível upgrade / novo produto).\n\n${notaConteudo}`
          : notaConteudo;
        await db.insert(notas).values({
          organizacaoId: org.id,
          leadId: newLead.id,
          conteudo,
        });
      }

      await syncPessoaFromLead(newLead.id); // F1/dual-write, best-effort

      results.push({
        status: jaCliente ? "created:client-upgrade" : "created",
        leadId: newLead.id,
        email: p.email,
      });
    } catch (err) {
      console.error("rd-lead webhook error for lead:", err);
      results.push({ status: "error:" + String(err), email: rd.email });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped")).length;

  return NextResponse.json({
    ok: true,
    received: rdLeads.length,
    created,
    updated,
    skipped,
    results,
  });
}

// Healthcheck simples (GET) pra validar que o endpoint está no ar
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "rd-lead webhook", method: "POST" });
}
