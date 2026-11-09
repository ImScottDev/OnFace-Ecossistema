/**
 * Retrato do uso do cliente no Callface AI, a partir de `callface_ai_tenant_snapshots` (o sincronismo
 * roda todo dia; `callface_ai_usage_events` está vazia e não serve).
 *
 * Junção: callface_ai_external_identities (entity = empresa) -> snapshots da identidade, janela de 30 dias.
 *
 * Decisões:
 *  - Identidade `probable` (200 das 472 linhas) é tratada como INDISPONÍVEL. O retrato é a evidência de uma
 *    baixa sem NPS; um vínculo provável pode ser de outra empresa, e número de outra empresa numa evidência
 *    é pior do que dizer "não temos". Só `deterministic` e `verified` valem.
 *  - Snapshot com mais de 3 dias é INDISPONÍVEL (o espelho está defasado; a tela diz isso em vez de mostrar).
 *  - `primeiroAcessoEm` fica null: a tabela não guarda isso, e o snapshot mais antigo marca quando o
 *    SINCRONISMO começou, não quando o cliente acessou.
 *  - `ligacoesFeitas` é `chamadas_finalizadas` DA JANELA DE 30 DIAS do snapshot (não o total histórico).
 *  - Indisponível devolve os números como null, nunca zero.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { RetratoDeUso } from "./contrato";
import { dataDe } from "./regras";

export const IDADE_MAXIMA_SNAPSHOT_MS = 3 * 86_400_000;
const CONFIAVEIS = new Set(["deterministic", "verified"]);

export interface SnapshotDeUso {
  snapshotAt: Date | null; confianca: string | null; chamadasFinalizadas: number | null;
  campanhasConcluidas: number | null; campanhasAtivas: number | null; agentesProntos: number | null; ultimaAtividadeEm: Date | null;
}

/** Pura: transforma o snapshot (ou a falta dele) no contrato. */
export function montarRetrato(s: SnapshotDeUso | null, agora: Date): RetratoDeUso {
  const vazio: RetratoDeUso = { capturadoEm: agora, primeiroAcessoEm: null, ultimoAcessoEm: null, ligacoesFeitas: null, campanhasDisparadas: null, agenteConfigurado: null, indisponivel: true };
  if (!s || !s.snapshotAt) return vazio;
  if (!s.confianca || !CONFIAVEIS.has(s.confianca)) return vazio;
  if (agora.getTime() - s.snapshotAt.getTime() > IDADE_MAXIMA_SNAPSHOT_MS) return { ...vazio, capturadoEm: s.snapshotAt };
  return {
    capturadoEm: s.snapshotAt, primeiroAcessoEm: null, ultimoAcessoEm: s.ultimaAtividadeEm,
    ligacoesFeitas: s.chamadasFinalizadas,
    campanhasDisparadas: s.campanhasConcluidas == null && s.campanhasAtivas == null ? null : (s.campanhasConcluidas ?? 0) + (s.campanhasAtivas ?? 0),
    agenteConfigurado: s.agentesProntos == null ? null : s.agentesProntos > 0,
    indisponivel: false,
  };
}

export async function retratoDeUso(organizacaoId: string, empresaId: string, agora: Date = new Date()): Promise<RetratoDeUso> {
  if (!empresaId) return montarRetrato(null, agora);
  const [r] = await db.execute<{
    snapshot_at: string; confidence: string | null; chamadas_finalizadas: number | null; campanhas_concluidas: number | null;
    campanhas_ativas: number | null; agentes_prontos: number | null; ultima_atividade_em: string | null;
  }>(sql`
    SELECT to_json(t.snapshot_at)#>>'{}' AS snapshot_at, i.confidence, t.chamadas_finalizadas, t.campanhas_concluidas,
           t.campanhas_ativas, t.agentes_prontos, to_json(t.ultima_atividade_em)#>>'{}' AS ultima_atividade_em
      FROM callface_ai_external_identities i
      JOIN callface_ai_tenant_snapshots t ON t.external_identity_id = i.id AND t.janela_dias = 30
     WHERE i.entity_type = 'empresa' AND i.provider = 'callface_ai' AND i.external_type = 'organization'
       AND i.entity_id IN (SELECT e.id FROM empresas e
                            WHERE e.organizacao_id = ${organizacaoId}::uuid AND (e.id = ${empresaId}::uuid OR e.canonical_empresa_id = ${empresaId}::uuid))
     -- identidade confiável primeiro; dentro dela, o snapshot mais recente
     ORDER BY (i.confidence IN ('deterministic','verified')) DESC, t.snapshot_at DESC
     LIMIT 1`);
  if (!r) return montarRetrato(null, agora);
  return montarRetrato({
    snapshotAt: dataDe(r.snapshot_at), confianca: r.confidence, chamadasFinalizadas: r.chamadas_finalizadas,
    campanhasConcluidas: r.campanhas_concluidas, campanhasAtivas: r.campanhas_ativas, agentesProntos: r.agentes_prontos,
    ultimaAtividadeEm: dataDe(r.ultima_atividade_em),
  }, agora);
}
