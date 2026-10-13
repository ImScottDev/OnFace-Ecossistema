/**
 * Grava a SAÚDE DIÁRIA do cliente no espelho local.
 *
 * Junta o que só o SaaS sabe (`lerSaude`: última atividade sem janela,
 * vencimento, copiloto, cancelamento) com o que o espelho já tem (licenças do
 * detalhe, série diária de minutos, usuários ativos) e roda `avaliarSaude`, a
 * ÚNICA função de semáforo. Uma linha por cliente por dia; reexecutar no mesmo
 * dia atualiza a linha.
 *
 * Mudança de semáforo vira fato na linha do tempo da empresa, pela porta de
 * eventos (`publicarEvento`, que o projetor da timeline já consome).
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { SaudeRdsCallfaceAi } from "@onface/integrations-callface-ai";
import { publicarEvento } from "@/lib/events/outbox";
import { avaliarSaude, type MotivoSaude, type Semaforo } from "@/lib/callface-ai/saude-regras";
import { resumoLicencas } from "@/lib/callface-ai/uso-regras";
import { diaCivil } from "./calendario-sp";

export interface MudancaDeSemaforo { empresaId: string; de: Semaforo | null; para: Semaforo; motivos: MotivoSaude[] }

interface LinhaLocal extends Record<string, unknown> {
  identity_id: string; empresa_id: string; org: string;
  licencas: { porPlano?: Array<{ motivo: string; qtd: number; atribuidas: number; minutos: number; semLimite: boolean }> } | null;
  org_desativada_em: Date | null;
  com_atividade_30d: number | null; usuarios_total: number | null; usuarios_ativos: number | null;
  min_mes: string; min_14: string; min_14_ant: string;
  anterior: string | null;
}

export async function gravarSaudeDoDia(
  organizacaoId: string, rds: SaudeRdsCallfaceAi[], agora = new Date(),
): Promise<{ linhas: number; mudancas: MudancaDeSemaforo[]; falhas: number }> {
  const hoje = diaCivil(agora, 0);
  const mes = `${hoje.slice(0, 7)}-01`;
  const porOrg = new Map(rds.map((x) => [x.organizationId, x]));
  if (!porOrg.size) return { linhas: 0, mudancas: [], falhas: 0 };

  const locais = await db.execute<LinhaLocal>(sql`
    SELECT i.id::text AS identity_id, i.entity_id::text AS empresa_id, i.external_id AS org,
           d.licencas, d.org_desativada_em,
           (SELECT s.usuarios_com_atividade FROM callface_ai_tenant_snapshots s
             WHERE s.external_identity_id = i.id AND s.janela_dias = 30 ORDER BY s.snapshot_at DESC LIMIT 1) AS com_atividade_30d,
           (SELECT s.usuarios_total FROM callface_ai_tenant_snapshots s
             WHERE s.external_identity_id = i.id AND s.janela_dias = 30 ORDER BY s.snapshot_at DESC LIMIT 1) AS usuarios_total,
           (SELECT s.usuarios_ativos FROM callface_ai_tenant_snapshots s
             WHERE s.external_identity_id = i.id AND s.janela_dias = 30 ORDER BY s.snapshot_at DESC LIMIT 1) AS usuarios_ativos,
           coalesce((SELECT sum(x.minutos) FROM callface_ai_uso_diario x
                      WHERE x.external_identity_id = i.id AND x.dia >= ${mes}::date), 0)::text AS min_mes,
           -- 14 dias COMPLETOS (ontem para trás) contra os 14 anteriores: o dia de hoje está pela metade.
           coalesce((SELECT sum(x.minutos) FROM callface_ai_uso_diario x
                      WHERE x.external_identity_id = i.id AND x.dia >= ${hoje}::date - 14 AND x.dia < ${hoje}::date), 0)::text AS min_14,
           coalesce((SELECT sum(x.minutos) FROM callface_ai_uso_diario x
                      WHERE x.external_identity_id = i.id AND x.dia >= ${hoje}::date - 28 AND x.dia < ${hoje}::date - 14), 0)::text AS min_14_ant,
           (SELECT h.semaforo FROM callface_ai_saude_diaria h
             WHERE h.external_identity_id = i.id ORDER BY h.dia DESC, h.calculado_em DESC LIMIT 1) AS anterior
      FROM callface_ai_external_identities i
      JOIN empresas e ON e.id = i.entity_id AND e.organizacao_id = ${organizacaoId}::uuid
      LEFT JOIN callface_ai_tenant_detalhe d ON d.external_identity_id = i.id
     WHERE i.entity_type = 'empresa' AND i.external_type = 'organization' AND i.provider = 'callface_ai'`);

  const mudancas: MudancaDeSemaforo[] = [];
  let linhas = 0, falhas = 0;
  for (const l of locais) {
    const s = porOrg.get(l.org);
    if (!s) continue;
    const porPlano = (l.licencas?.porPlano ?? []).map((p) => ({ motivo: p.motivo, licencas: p.qtd, atribuidas: p.atribuidas, minutos: p.minutos, semLimite: p.semLimite }));
    const lic = resumoLicencas(porPlano, l.com_atividade_30d ?? 0);
    const contratados = lic.minutosSemLimite || !lic.minutosContratados ? null : lic.minutosContratados;
    const minMes = Number(l.min_mes), min14 = Number(l.min_14), min14ant = Number(l.min_14_ant);
    const r = avaliarSaude({
      agora, ultimaAtividadeEm: s.ultimaAtividadeEm, inicioEm: s.inicioEm, orgDesativadaEm: l.org_desativada_em,
      // Sem detalhe ainda (primeira rodada), usa a contagem de licenças pagas do SaaS.
      licencasPagas: lic.contratadas || s.licencasPagas, licencasEmUso: lic.emUso,
      minutosMes: minMes, minutosContratadosMes: contratados, minutos14d: min14, minutos14dAnteriores: min14ant,
      licencaVenceEm: s.licencaVenceEm, licencasVencendo30d: s.licencasVencendo30d,
      copilotoSessoes30d: s.copilotoSessoes30d, copilotoSugestoes30d: s.copilotoSugestoes30d, copilotoUsadas30d: s.copilotoUsadas30d,
      assinaturasTotal: s.assinaturasTotal, assinaturasCanceladas: s.assinaturasCanceladas,
      canceladaEm: s.canceladaEm, cancelamentoMotivo: s.cancelamentoMotivo,
    });
    try {
      await db.execute(sql`
        INSERT INTO callface_ai_saude_diaria (
          external_identity_id, dia, ultima_atividade_em, ultima_chamada_em, ultima_copiloto_em, ultima_reuniao_em,
          dias_silencio, inicio_em, usuarios_total, usuarios_ativos, licencas_pagas, licencas_em_uso,
          minutos_mes, minutos_contratados_mes, minutos_14d, minutos_14d_anteriores,
          copiloto_sessoes_30d, copiloto_sugestoes_30d, copiloto_usadas_30d,
          assinaturas_total, assinaturas_canceladas, cancelada_em, cancelamento_motivo,
          licenca_vence_em, licencas_vencendo_30d, licencas_vencendo_60d, semaforo, motivos, calculado_em)
        VALUES (
          ${l.identity_id}::uuid, ${hoje}::date, ${s.ultimaAtividadeEm?.toISOString() ?? null}::timestamptz,
          ${s.ultimaChamadaEm?.toISOString() ?? null}::timestamptz, ${s.ultimaCopilotoEm?.toISOString() ?? null}::timestamptz,
          ${s.ultimaReuniaoEm?.toISOString() ?? null}::timestamptz,
          ${r.diasSilencio}, ${s.inicioEm?.toISOString() ?? null}::timestamptz, ${l.usuarios_total}, ${l.usuarios_ativos},
          ${lic.contratadas || s.licencasPagas}, ${lic.emUso},
          ${minMes}, ${contratados}, ${min14}, ${min14ant},
          ${s.copilotoSessoes30d}, ${s.copilotoSugestoes30d}, ${s.copilotoUsadas30d},
          ${s.assinaturasTotal}, ${s.assinaturasCanceladas}, ${s.canceladaEm?.toISOString() ?? null}::timestamptz, ${s.cancelamentoMotivo},
          ${s.licencaVenceEm?.toISOString() ?? null}::timestamptz, ${s.licencasVencendo30d}, ${s.licencasVencendo60d},
          ${r.semaforo}, ${JSON.stringify(r.motivos)}::jsonb, now())
        ON CONFLICT (external_identity_id, dia) DO UPDATE SET
          ultima_atividade_em = EXCLUDED.ultima_atividade_em, ultima_chamada_em = EXCLUDED.ultima_chamada_em,
          ultima_copiloto_em = EXCLUDED.ultima_copiloto_em, ultima_reuniao_em = EXCLUDED.ultima_reuniao_em,
          dias_silencio = EXCLUDED.dias_silencio, inicio_em = EXCLUDED.inicio_em,
          usuarios_total = EXCLUDED.usuarios_total, usuarios_ativos = EXCLUDED.usuarios_ativos,
          licencas_pagas = EXCLUDED.licencas_pagas, licencas_em_uso = EXCLUDED.licencas_em_uso,
          minutos_mes = EXCLUDED.minutos_mes, minutos_contratados_mes = EXCLUDED.minutos_contratados_mes,
          minutos_14d = EXCLUDED.minutos_14d, minutos_14d_anteriores = EXCLUDED.minutos_14d_anteriores,
          copiloto_sessoes_30d = EXCLUDED.copiloto_sessoes_30d, copiloto_sugestoes_30d = EXCLUDED.copiloto_sugestoes_30d,
          copiloto_usadas_30d = EXCLUDED.copiloto_usadas_30d, assinaturas_total = EXCLUDED.assinaturas_total,
          assinaturas_canceladas = EXCLUDED.assinaturas_canceladas, cancelada_em = EXCLUDED.cancelada_em,
          cancelamento_motivo = EXCLUDED.cancelamento_motivo, licenca_vence_em = EXCLUDED.licenca_vence_em,
          licencas_vencendo_30d = EXCLUDED.licencas_vencendo_30d, licencas_vencendo_60d = EXCLUDED.licencas_vencendo_60d,
          semaforo = EXCLUDED.semaforo, motivos = EXCLUDED.motivos, calculado_em = EXCLUDED.calculado_em`);
      linhas++;
    } catch (e) {
      falhas++;
      console.error(`[CallfaceAI] saúde de ${l.org} falhou:`, e instanceof Error ? e.message : e);
      continue;
    }
    const antes = (l.anterior as Semaforo | null) ?? null;
    if (antes !== r.semaforo) mudancas.push({ empresaId: l.empresa_id, de: antes, para: r.semaforo, motivos: r.motivos });
  }

  for (const m of mudancas) await publicarMudanca(organizacaoId, m, hoje);
  return { linhas, mudancas, falhas };
}

const ROTULO: Record<Semaforo, string> = { verde: "verde", amarelo: "amarelo", vermelho: "vermelho", sem_dado: "sem dado" };

/**
 * Primeira leitura (sem estado anterior) NÃO é mudança: sem isto, o primeiro
 * sync de produção lançaria 100+ "ficou vermelho" na timeline de uma vez.
 */
async function publicarMudanca(organizacaoId: string, m: MudancaDeSemaforo, dia: string): Promise<void> {
  if (m.de === null) return;
  const motivos = m.motivos.filter((x) => x.gravidade !== "oportunidade").map((x) => x.rotulo).join(", ");
  await publicarEvento({
    organizacaoId, eventType: "NoteAdded", aggregateType: "empresa", aggregateId: m.empresaId,
    idempotencyKey: `callface-ai-semaforo:${m.empresaId}:${dia}:${m.de}>${m.para}`,
    payload: {
      empresa_id: m.empresaId,
      titulo: `Uso do Callface AI: ${ROTULO[m.de]} → ${ROTULO[m.para]}${motivos ? ` (${motivos})` : ""}`,
      origem: "callface_ai_saude", de: m.de, para: m.para,
      motivos: m.motivos.map((x) => ({ codigo: x.codigo, detalhe: x.detalhe })),
    },
  });
}
