/**
 * Processamento de UM lead do RD Station, depois que a entrega já foi aberta
 * na caixa de entrada (`captacao_entregas`).
 *
 * Extraído de `app/api/webhooks/rd-lead/route.ts` sem mudar o que faz: o
 * webhook chama isto para cada lead da Callface do lote, e o reprocessamento
 * manual de uma entrega que falhou (`reprocessar.ts`) chama o MESMO código com
 * o payload guardado. Mudou aqui, muda nos dois.
 *
 * Fecha a entrega com o desfecho; erro vira "falhou" e volta no resultado
 * (o lote segue, como sempre seguiu).
 */
import { db } from "@/lib/db";
import { leads, statusChanges, notas, metaLeadStaging } from "@/lib/db/schema";
import { and, eq, or, desc, sql } from "drizzle-orm";
import { parseRdLead, type ParsedRdLead } from "@/lib/integrations/rd-station";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";
import { garantirAtividadePrimeiroContato, resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";
import { telefoneUsavel } from "@/lib/whatsapp/phone-utils";
import { garantirEntradaCanonica, travarEntrada, acharLeadPorContato } from "@/lib/vendas/ponte-canonica";
import { resolverEmpresaId, dominioCorporativo } from "@/lib/crm/resolver-empresa";
import { fecharEntrega } from "./entregas";
import { colunasDaDistribuicao, distribuirLeadCaptado } from "./distribuir";
import { registrarEvento } from "@/lib/vendas/eventos";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";
import {
  buscarLeadNaGraph, normalizarLeadAds, camposRastreioMeta, credenciaisLeadAds,
} from "@onface/integrations-meta";

export type ResultadoLeadRd = { status: string; leadId?: string; email?: string };

/**
 * Busca IDs reais da Meta deixados em staging pelo webhook /api/webhooks/meta-lead-ids
 * (chega antes do lead existir, já que RD Station processa em paralelo, sem ordem
 * garantida — ver comentário grande no route.ts de meta-lead-ids). Marca como usado
 * pra não ser reaproveitado por outro lead.
 */
async function buscarMetaIdsStaging(
  email: string | undefined,
  telefone: string | undefined
): Promise<{ fbLeadId?: string; adId?: string; adsetId?: string; campaignId?: string; telefone?: string } | null> {
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
    // O id do lead na Meta é a ÚNICA chave que permite buscar o que a pessoa
    // respondeu no formulário. Ele chegava aqui e era descartado.
    fbLeadId: row.fbLeadId ?? undefined,
    adId: row.adId ?? undefined,
    adsetId: row.adsetId ?? undefined,
    campaignId: row.campaignId ?? undefined,
    // A Meta manda o telefone certo aqui. O RD nem sempre (ver backfill abaixo).
    telefone: telefoneUsavel(row.telefone) ?? undefined,
  };
}

export async function processarLeadRd(entrada: {
  organizacaoId: string;
  /** Lead do RD como chegou (e como ficou guardado na entrega). */
  rd: Record<string, unknown> & { email?: string };
  entregaId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<ResultadoLeadRd> {
  const { organizacaoId, rd, entregaId, ipAddress, userAgent } = entrada;
  let soltar: () => void = () => {};
  try {
    const p: ParsedRdLead = parseRdLead(rd);
    const metaIds = await buscarMetaIdsStaging(p.email, p.telefone);
    soltar = await travarEntrada(organizacaoId, p.email, p.telefone ?? metaIds?.telefone);

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

    /* AS RESPOSTAS DO FORMULÁRIO DA META — causa do "Sem formulário" na ficha.
     *
     * O lead que vem por este caminho (Meta → n8n → RD) nascia sem resposta
     * nenhuma: o RD só repassa nome, contato e UTM. O `fb_lead_id`, única
     * chave que permite buscar o que a pessoa respondeu, chegava no
     * `meta_lead_staging` e era jogado fora aqui. Medido em produção
     * (14/10/2026): 130 dos 136 leads de Meta de outubro sem respostas tinham
     * esse id guardado no nosso próprio banco.
     *
     * A busca é a MESMA do webhook direto da Meta (meta-leads/route.ts), para
     * o lead ter a mesma ficha venha por onde vier. Best-effort: falha aqui
     * não derruba a captação de um lead pago. */
    if (metaIds?.fbLeadId) {
      const busca = await buscarLeadNaGraph(metaIds.fbLeadId, credenciaisLeadAds().accessToken);
      if (busca.ok && busca.lead) {
        Object.assign(formCampos, normalizarLeadAds(busca.lead).respostas, camposRastreioMeta(busca.lead));
      } else {
        console.warn(`[rd-lead] respostas do formulário do lead Meta ${metaIds.fbLeadId} não vieram: ${busca.erro}`);
      }
    }

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
    const existing = await acharLeadPorContato(organizacaoId, p.email, p.telefone);

    // Empresa como entidade, não só texto: sem isso o lead cai no drawer como
    // "Sem cadastro — clique pra criar e vincular" e alguém tem que vincular à mão.
    const empresaIdResolvida = await resolverEmpresaId({
      organizacaoId,
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
          empresa: sql`COALESCE(NULLIF(${leads.empresa}, ''), ${p.empresa ?? null})`,
          // Não rouba o vínculo já feito (inclusive o manual, no drawer): só preenche se estiver vazio.
          ...(empresaIdResolvida
            ? { empresaId: sql`COALESCE(${leads.empresaId}, ${empresaIdResolvida}::uuid)` }
            : {}),
          cargo: sql`COALESCE(NULLIF(${leads.cargo}, ''), ${p.cargo ?? null})`,
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
          organizacaoId,
          leadId: existing.id,
          conteudo: notaConteudo,
        });
      }
      await syncPessoaFromLead(existing.id); // F1/dual-write, best-effort
      // Lead que já existia não passa pela distribuição (não gasta rodízio).
      await garantirAtividadePrimeiroContato({
        organizacaoId,
        leadId: existing.id,
        empresaId: existing.empresaId,
        responsavelId: existing.responsavelId ?? await resolverResponsavelInbound(organizacaoId),
      });
      await fecharEntrega(entregaId, { status: "duplicada", leadId: existing.id });
      return { status: "updated", leadId: existing.id, email: p.email };
    }

    // Já é cliente (ou não existe ainda): NÃO bloqueia. Um cliente que converte
    // na LP quer upgrade / novo produto (ex.: White Label) → tem que ir pro
    // board de pré-vendas como lead novo, SEM mexer no registro de cliente.
    // Sinaliza na nota pra SDR saber que é um cliente atual.
    const jaCliente = existing?.tipo === "cliente";

    const conteudoConversao = (rd.last_conversion as { content?: Record<string, unknown> } | undefined)?.content;
    const dist = await distribuirLeadCaptado({
      organizacaoId,
      atribuicao: {
        origem: p.origem, utmSource: p.utmSource, utmCampaign: p.utmCampaign,
        metaCampaignId: metaIds?.campaignId ?? null,
        formulario: String(conteudoConversao?.conversion_identifier ?? conteudoConversao?.identificador ?? "") || null,
      },
    });
    const responsavelInboundId = dist.responsavelId;

    // Cria lead novo direto no board de pré-vendas (sem negócio)
    const [newLead] = await db
      .insert(leads)
      .values({
        organizacaoId,
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
        estagioPreVendas: "novo",
        ...colunasDaDistribuicao(dist),
      })
      .returning({ id: leads.id });

    // Mesmo evento que criarLead grava: a atribuição deixa de ser muda.
    if (responsavelInboundId) {
      await registrarEvento({
        organizacaoId, tipo: "LeadAssigned", ator: ATOR_SISTEMA, leadId: newLead.id,
        contexto: { responsavelId: responsavelInboundId, origemAtribuicao: dist.via, regraId: dist.regraId, motivo: dist.motivo, sessaoWhatsappId: dist.sessaoWhatsappId, canal: "rd" },
      }).catch((e) => console.error("[rd-lead] LeadAssigned não gravado:", e));
    }

    // CUTOVER (fase 16): o mesmo fato entra no modelo canônico. A escrita
    // legada acima continua porque as telas ainda leem `leads`; esta chamada
    // sai na fase 25, junto com ela. Best-effort: falha aqui não derruba a
    // captação de um lead de campanha paga.
    await garantirEntradaCanonica({
      organizacaoId,
      tipo: "INBOUND",
      origem: p.origem ?? "RD Station",
      provider: "rd-station",
      pessoa: { nome: p.nome, sobrenome: p.sobrenome, email: p.email, telefone: p.telefone, cargo: p.cargo },
      empresa: p.empresa ? { nome: p.empresa } : null,
      atribuicao: {
        utmSource: p.utmSource, utmMedium: p.utmMedium, utmCampaign: p.utmCampaign,
        utmTerm: p.utmTerm, utmContent: p.utmContent, landingPage: p.landingPage,
        campaignId: metaIds?.campaignId, adsetId: metaIds?.adsetId, adId: metaIds?.adId,
        // O clique no anúncio. Sem ele a conversão devolvida pela CAPI chega à
        // Meta e não casa com ninguém: era 0 em 4.270 pontos de contato.
        fbclid: p.fbclid, fbc: p.fbc, metaLeadId: metaIds?.fbLeadId,
      },
      responsavelId: responsavelInboundId ?? null,
      idempotencyKey: p.email ? `rd:${organizacaoId}:${p.email}` : null,
    }, newLead.id);

    // Timeline inicial (sem negócio vinculado)
    await db.insert(statusChanges).values({
      leadId: newLead.id,
      negocioId: null,
      deStatus: null,
      paraStatus: "novo",
    });

    await garantirAtividadePrimeiroContato({
      organizacaoId,
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
        organizacaoId,
        leadId: newLead.id,
        conteudo,
      });
    }

    await syncPessoaFromLead(newLead.id); // F1/dual-write, best-effort
    await fecharEntrega(entregaId, { status: "processada", leadId: newLead.id, regraId: dist.regraId });

    return {
      status: jaCliente ? "created:client-upgrade" : "created",
      leadId: newLead.id,
      email: p.email,
    };
  } catch (err) {
    console.error("rd-lead webhook error for lead:", err);
    await fecharEntrega(entregaId, { status: "falhou", erro: err });
    return { status: "error:" + String(err), email: rd.email };
  } finally {
    soltar();
  }
}
