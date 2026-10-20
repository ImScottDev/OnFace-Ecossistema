/**
 * Caixa de entrada da captação vista pela gestão: listar as entregas e
 * reprocessar, à mão, uma que falhou.
 *
 * Reprocessar roda o MESMO processamento do webhook de origem
 * (`processar-meta.ts`, `processar-rd.ts`, `processar-site.ts`) com o payload
 * guardado na entrega. Nada de caminho paralelo: o lead nasce (ou é
 * atualizado) exatamente como teria nascido se a entrega não tivesse falhado.
 *
 * A entrega é tomada numa escrita só (falhou, ou presa em "recebida" além do
 * tempo de uma requisição → "recebida" agora): duas pessoas clicando juntas,
 * ou o integrador reentregando no mesmo instante, não processam duas vezes.
 *
 * A entrega da API pública (`canal = 'api'`) não se reprocessa aqui: o
 * processamento dela é a própria rota de criação de lead (com negócio e
 * resposta ao integrador). Quem reenvia é o integrador.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { credenciaisLeadAds, type LeadAdsBruto } from "@onface/integrations-meta";
import { resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";
import { fecharEntrega, type StatusEntrega } from "./entregas";
import { processarLeadMeta } from "./processar-meta";
import { processarLeadRd } from "./processar-rd";
import { clean, lerFormularioSite, processarFormularioSite } from "./processar-site";

export const STATUS_ENTREGA: StatusEntrega[] = ["recebida", "processada", "duplicada", "falhou"];
export const CANAIS_REPROCESSAVEIS = ["meta", "rd", "site"] as const;

/** Mesmo limite de `entregas.ts`: "recebida" mais nova que isto ainda está em processamento. */
const EM_ANDAMENTO_SEGUNDOS = 120;

export class EntregaRecusada extends Error {
  constructor(public codigo: "nao_encontrada" | "nao_reprocessavel" | "canal_sem_reprocesso", mensagem: string) {
    super(mensagem);
    this.name = "EntregaRecusada";
  }
}

export type EntregaListada = {
  id: string; canal: string; status: string; erro: string | null; entregas: number;
  leadId: string | null; lead: string | null; regraId: string | null;
  createdAt: string; ultimaEntregaEm: string; processadaEm: string | null;
  /** Nome/e-mail que vieram no payload, para reconhecer a entrega sem abrir o JSON. */
  resumo: string | null;
};

export async function listarEntregas(organizacaoId: string, filtro: { id?: string; status?: StatusEntrega; canal?: string; limite?: number } = {}): Promise<EntregaListada[]> {
  const limite = Math.min(Math.max(filtro.limite ?? 100, 1), 500);
  const linhas = await db.execute<{
    id: string; canal: string; status: string; erro: string | null; entregas: number; lead_id: string | null; lead: string | null;
    regra_id: string | null; created_at: string; ultima_entrega_em: string; processada_em: string | null; resumo: string | null;
  }>(sql`
    SELECT e.id::text, e.canal, e.status, e.erro, e.entregas, e.lead_id::text, l.nome AS lead, e.regra_id::text,
           e.created_at::text, e.ultima_entrega_em::text, e.processada_em::text,
           NULLIF(concat_ws(' · ', COALESCE(e.payload->>'nome', e.payload->>'name', e.payload->>'full_name'), e.payload->>'email', e.payload->>'leadgen_id'), '') AS resumo
      FROM captacao_entregas e
      LEFT JOIN leads l ON l.id = e.lead_id AND l.organizacao_id = e.organizacao_id
     WHERE e.organizacao_id = ${organizacaoId}::uuid
       ${filtro.id ? sql`AND e.id = ${filtro.id}::uuid` : sql``}
       ${filtro.status ? sql`AND e.status = ${filtro.status}` : sql``}
       ${filtro.canal ? sql`AND e.canal = ${filtro.canal}` : sql``}
     ORDER BY e.created_at DESC
     LIMIT ${limite}`);
  return linhas.map((l) => ({
    id: l.id, canal: l.canal, status: l.status, erro: l.erro, entregas: l.entregas, leadId: l.lead_id, lead: l.lead, regraId: l.regra_id,
    createdAt: l.created_at, ultimaEntregaEm: l.ultima_entrega_em, processadaEm: l.processada_em, resumo: l.resumo,
  }));
}

/** Toma a entrega para reprocessar, numa escrita só. Sem linha devolvida = não pode agora (ver o motivo depois). */
async function tomarEntrega(organizacaoId: string, entregaId: string) {
  const [r] = await db.execute<{ id: string; canal: string; payload: unknown }>(sql`
    UPDATE captacao_entregas
       SET status = 'recebida', ultima_entrega_em = now()
     WHERE id = ${entregaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
       AND canal IN ('meta', 'rd', 'site')
       AND (status = 'falhou' OR (status = 'recebida' AND ultima_entrega_em < now() - make_interval(secs => ${EM_ANDAMENTO_SEGUNDOS})))
    RETURNING id::text, canal, payload`);
  return r ?? null;
}

export type ResultadoReprocesso = { entrega: EntregaListada; resultado: unknown };

export async function reprocessarEntrega(p: { organizacaoId: string; entregaId: string; usuarioId: string | null }): Promise<ResultadoReprocesso> {
  const tomada = await tomarEntrega(p.organizacaoId, p.entregaId);
  if (!tomada) {
    const [atual] = await db.execute<{ status: string; canal: string }>(sql`
      SELECT status, canal FROM captacao_entregas WHERE id = ${p.entregaId}::uuid AND organizacao_id = ${p.organizacaoId}::uuid`);
    if (!atual) throw new EntregaRecusada("nao_encontrada", "Entrega não encontrada.");
    if (!(CANAIS_REPROCESSAVEIS as readonly string[]).includes(atual.canal)) {
      throw new EntregaRecusada("canal_sem_reprocesso", "Entrega da API pública não se reprocessa aqui: o integrador reenvia.");
    }
    throw new EntregaRecusada("nao_reprocessavel", atual.status === "recebida"
      ? "Esta entrega está sendo processada agora. Espere um pouco e veja de novo."
      : `Só entrega que falhou é reprocessada (esta está "${atual.status}").`);
  }

  let resultado: unknown;
  try {
    if (tomada.canal === "meta") {
      resultado = await processarLeadMeta({
        organizacaoId: p.organizacaoId, valor: tomada.payload as LeadAdsBruto, entregaId: tomada.id,
        accessToken: credenciaisLeadAds().accessToken,
      });
    } else if (tomada.canal === "rd") {
      // IP e user agent eram do request original e não ficam na entrega.
      resultado = await processarLeadRd({
        organizacaoId: p.organizacaoId, rd: (tomada.payload ?? {}) as Record<string, unknown>, entregaId: tomada.id, ipAddress: null, userAgent: null,
      });
    } else {
      const body = (tomada.payload ?? {}) as Record<string, unknown>;
      const lido = lerFormularioSite(body);
      if (!lido.ok) {
        await fecharEntrega(tomada.id, { status: "falhou", erro: `corpo do formulário não passa na validação: ${JSON.stringify(lido.resposta.corpo)}` });
        resultado = lido.resposta.corpo;
      } else {
        const responsavelInboundId = await resolverResponsavelInbound(p.organizacaoId);
        resultado = (await processarFormularioSite({
          organizacaoId: p.organizacaoId, body, campos: lido.campos, entregaId: tomada.id, responsavelInboundId,
          ipAddress: null, userAgent: null, landingPage: clean(body.landingPage),
        })).corpo;
      }
    }
  } catch (e) {
    // Fecha como "falhou" com o erro (o processamento normalmente já fechou; antes da trava, não) e não derruba a rota.
    console.error(`[captacao] reprocessamento da entrega ${tomada.id} falhou:`, e);
    await fecharEntrega(tomada.id, { status: "falhou", erro: e });
    resultado = { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }

  // Mesmo formato da lista (lead, resumo): a tela troca a linha no lugar.
  const [entrega] = await listarEntregas(p.organizacaoId, { id: tomada.id, limite: 1 });
  await db.insert(auditLog).values({
    organizacaoId: p.organizacaoId, actorId: p.usuarioId, action: "captacao.entrega_reprocessada", entityType: "captacao_entrega",
    entityId: tomada.id, after: { canal: tomada.canal, status: entrega?.status ?? null, leadId: entrega?.leadId ?? null, erro: entrega?.erro ?? null }, source: "api",
  }).catch((e) => console.error("[captacao] auditoria do reprocessamento não gravada:", e));
  return { entrega, resultado };
}
