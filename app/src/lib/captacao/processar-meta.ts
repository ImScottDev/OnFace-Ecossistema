/**
 * Processamento de UM lead da Meta (Lead Ads), depois que a entrega já foi
 * aberta na caixa de entrada (`captacao_entregas`).
 *
 * Extraído de `app/api/webhooks/meta-leads/route.ts` sem mudar o que faz:
 * o webhook chama isto para cada `change` de leadgen, e o reprocessamento
 * manual de uma entrega que falhou (`reprocessar.ts`) chama o MESMO código,
 * com o payload guardado. Mudou aqui, muda nos dois.
 *
 * Fecha a entrega com o desfecho. Exceção inesperada fecha como "falhou" e
 * sobe para quem chamou (o webhook responde 500 e a Meta retenta).
 */
import { db } from "@/lib/db";
import { sql, eq } from "drizzle-orm";
import { leads, statusChanges } from "@/lib/db/schema";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";
import { garantirAtividadePrimeiroContato, resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";
import { resolverEmpresaId, dominioCorporativo } from "@/lib/crm/resolver-empresa";
import {
  normalizarLeadAds, chaveDeIdempotencia, buscarLeadNaGraph, combinar, camposRastreioMeta,
  type LeadAdsBruto,
} from "@onface/integrations-meta";
import { garantirEntradaCanonica, travarEntrada, acharLeadPorContato } from "@/lib/vendas/ponte-canonica";
import { fecharEntrega } from "./entregas";
import { colunasDaDistribuicao, distribuirLeadCaptado } from "./distribuir";
import { registrarEvento } from "@/lib/vendas/eventos";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";

export type ResultadoLeadMeta = { metaLeadId: string | null; ok: boolean; motivo?: string };

export async function processarLeadMeta(p: {
  organizacaoId: string;
  /** `change.value` do webhook, como chegou (e como ficou guardado na entrega). */
  valor: LeadAdsBruto;
  entregaId: string | null;
  /** Token da Graph (credenciaisLeadAds().accessToken). Sem ele, segue sem buscar os dados. */
  accessToken: string | null;
}): Promise<ResultadoLeadMeta> {
  const { organizacaoId, valor, entregaId, accessToken } = p;
  const leadgenId = String(valor.leadgen_id ?? "");
  let bruto = valor;
  if (leadgenId) {
    const busca = await buscarLeadNaGraph(leadgenId, accessToken);
    if (busca.ok && busca.lead) {
      bruto = combinar(valor, busca.lead);
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
    await fecharEntrega(entregaId, { status: "falhou", erro: "sem e-mail e sem telefone (retrieval na Graph não trouxe a pessoa?)" });
    return { metaLeadId: n.metaLeadId, ok: false, motivo: "sem identificador" };
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
  const soltar = await travarEntrada(organizacaoId, n.email, n.telefone);
  try {
  let leadId: string | null = null;
  let jaExistia = false;
  let erroLegado: unknown = null;
  // Dono que a aquisição canônica recebe: o do lead existente, ou o decidido para o novo.
  let dono: string | null = null;
  let regraId: string | null = null;
  try {
    const [primeiro, ...resto] = (n.nome ?? "").trim().split(/\s+/).filter(Boolean);
    const nome = primeiro || n.email?.split("@")[0] || "Lead Meta";
    const sobrenome = resto.join(" ") || null;
    const respostas = { ...(n.respostas ?? {}), ...camposRastreioMeta(bruto) };
    const a = n.atribuicao;

    const existing = await acharLeadPorContato(organizacaoId, n.email, n.telefone);

    const empresaIdResolvida = await resolverEmpresaId({
      organizacaoId, nome: n.empresa, website: dominioCorporativo(n.email),
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
      jaExistia = true;
      // Lead que já existia não passa pela distribuição: ganha dono novo só
      // quem nasce agora. Sem dono, a tarefa vai para a política de inbound.
      dono = existing.responsavelId ?? await resolverResponsavelInbound(organizacaoId);
      await garantirAtividadePrimeiroContato({
        organizacaoId, leadId, empresaId: existing.empresaId,
        responsavelId: dono,
      });
    } else {
      // Não existe (ou é cliente, que não se toca): lead novo no board.
      const dist = await distribuirLeadCaptado({
        organizacaoId,
        atribuicao: {
          origem: "Mídia Paga", utmSource: a.utmSource, utmCampaign: a.utmCampaign,
          metaCampaignId: a.campaignId, formulario: bruto.form_id ?? null,
        },
      });
      dono = dist.responsavelId;
      regraId = dist.regraId;
      const [novo] = await db.insert(leads).values({
        organizacaoId, nome, sobrenome,
        email: n.email, telefone: n.telefone,
        empresa: n.empresa, empresaId: empresaIdResolvida, cargo: n.cargo,
        origem: "Mídia Paga",
        utmSource: a.utmSource, utmMedium: a.utmMedium, utmCampaign: a.utmCampaign,
        utmTerm: a.utmTerm, utmContent: a.utmContent,
        metaAdId: a.adId, metaAdsetId: a.adsetId, metaCampaignId: a.campaignId,
        camposCustom: respostas,
        tipo: "lead", status: "novo", sdrStatus: "pending", estagioPreVendas: "novo",
        ...colunasDaDistribuicao(dist),
      }).returning({ id: leads.id });
      leadId = novo.id;
      await db.insert(statusChanges).values({ leadId, negocioId: null, deStatus: null, paraStatus: "novo" });
      await garantirAtividadePrimeiroContato({
        organizacaoId, leadId, empresaId: null, responsavelId: dono,
      });
      // Mesmo evento que criarLead grava: a atribuição deixa de ser muda.
      if (dono) {
        await registrarEvento({
          organizacaoId, tipo: "LeadAssigned", ator: ATOR_SISTEMA, leadId,
          contexto: { responsavelId: dono, origemAtribuicao: dist.via, regraId: dist.regraId, motivo: dist.motivo, sessaoWhatsappId: dist.sessaoWhatsappId, canal: "meta" },
        }).catch((e) => console.error(`[MetaLeads] LeadAssigned não gravado (${n.metaLeadId}):`, e));
      }
    }
    await syncPessoaFromLead(leadId); // dual-write, best-effort
  } catch (e) {
    erroLegado = e;
    console.error(`[MetaLeads] lead legado não gravado (${n.metaLeadId}); canônico segue sem vínculo:`, e);
  }

  const r = await garantirEntradaCanonica({
    organizacaoId,
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
    responsavelId: dono,
    idempotencyKey: chaveDeIdempotencia(n),
    ocorridoEm: n.ocorridoEm,
  }, leadId);

  // A ponte só grava o vínculo quando CRIA a aquisição. Reentrega ou
  // aquisição já aberta devolve a existente sem lead_legado_id; vincula aqui
  // sem tomar um vínculo já feito.
  if (r.ok && leadId) {
    await db.execute(sql`
      UPDATE aquisicoes SET lead_legado_id = ${leadId}::uuid
       WHERE id = ${r.aquisicaoId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND lead_legado_id IS NULL
    `).catch((e) => console.error(`[MetaLeads] vínculo lead↔aquisição não gravado (${n.metaLeadId}):`, e));
  }

  const resultado: ResultadoLeadMeta = { metaLeadId: n.metaLeadId, ok: r.ok, motivo: r.erro };
  if (!r.ok) console.error(`[MetaLeads] lead ${n.metaLeadId} não entrou: ${r.erro}`);
  await fecharEntrega(entregaId, r.ok
    ? { status: jaExistia ? "duplicada" : "processada", leadId, regraId, erro: erroLegado ? `lead legado não gravado: ${String(erroLegado)}` : null }
    : { status: "falhou", leadId, regraId, erro: r.erro ?? "entrada canônica recusou" });
  return resultado;
  } catch (e) {
    await fecharEntrega(entregaId, { status: "falhou", erro: e });
    throw e;
  } finally { soltar(); }
}
