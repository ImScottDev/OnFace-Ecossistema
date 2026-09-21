/**
 * A leitura que o produto usa. Modelo LOCAL, sempre.
 *
 * Cliente 360, Customer Success, automações, NEXO, Hermes, API pública e n8n
 * entram por aqui. Nenhum deles conhece credencial, schema ou disponibilidade
 * do banco do SaaS — se o sync estiver parado há três dias, esta função devolve
 * o último snapshot conhecido E diz que ele é de três dias atrás, em vez de
 * falhar ou de mentir que é de agora.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface UsoNaJanela {
  janelaDias: number;
  chamadasTotal: number;
  chamadasFinalizadas: number;
  /** Chamadas que PODEM ser desta conta e ficaram de fora do total. */
  chamadasAmbiguas: number;
  taxaConexao: number | null;
  minutos: number;
  usuariosComAtividade: number;
  campanhasAtivas: number;
  campanhasConcluidas: number;
  sessoesCopilot: number;
  reunioes: number;
}

export interface UsoCallfaceAiDaEmpresa {
  conectado: boolean;
  organizationId: string | null;
  confidence: string | null;
  source: string | null;
  verifiedAt: string | null;
  coletadoEm: string | null;
  /** Quantos dias o dado tem. Nulo quando nunca houve coleta. */
  idadeDias: number | null;
  syncStatus: string | null;
  usuariosTotal: number | null;
  usuariosAtivos: number | null;
  usuariosPendentes: number | null;
  licencasAtivas: number | null;
  agentesProntos: number | null;
  contatosBase: number | null;
  ultimaAtividadeEm: string | null;
  diasSemAtividade: number | null;
  uso: UsoNaJanela[];
}

const iso = (d: Date | string | null | undefined): string | null =>
  d ? (d instanceof Date ? d.toISOString() : String(d)) : null;

export async function lerUsoCallfaceAi(empresaId: string): Promise<UsoCallfaceAiDaEmpresa> {
  const [ident] = await db.execute<{
    id: string; external_id: string; confidence: string; source: string | null; verified_at: Date | null;
  }>(sql`
    SELECT id::text, external_id, confidence, source, verified_at
      FROM callface_ai_external_identities
     WHERE entity_type = 'empresa' AND entity_id = ${empresaId}::uuid
       AND provider = 'callface_ai' AND external_type = 'organization'
     LIMIT 1`);

  const vazio: UsoCallfaceAiDaEmpresa = {
    conectado: false, organizationId: null, confidence: null, source: null, verifiedAt: null,
    coletadoEm: null, idadeDias: null, syncStatus: null,
    usuariosTotal: null, usuariosAtivos: null, usuariosPendentes: null,
    licencasAtivas: null, agentesProntos: null, contatosBase: null,
    ultimaAtividadeEm: null, diasSemAtividade: null, uso: [],
  };
  if (!ident) return vazio;

  // O snapshot MAIS RECENTE de cada janela. Snapshot velho não é erro: é o que
  // existe, e a idade vai junto para quem lê decidir se confia.
  const linhas = await db.execute<{
    janela_dias: number; chamadas_total: number; chamadas_finalizadas: number;
    chamadas_ambiguas: number; minutos_uso: string; usuarios_com_atividade: number;
    campanhas_ativas: number; campanhas_concluidas: number; sessoes_copilot: number;
    reunioes: number; usuarios_total: number; usuarios_ativos: number;
    usuarios_pendentes: number; licencas_ativas: number; agentes_prontos: number;
    contatos_base: number; ultima_atividade_em: Date | null; coletado_em: Date | null;
    dias_sem_atividade: number | null; idade_dias: number | null;
  }>(sql`
    SELECT DISTINCT ON (janela_dias)
           janela_dias, chamadas_total, chamadas_finalizadas, chamadas_ambiguas,
           minutos_uso, usuarios_com_atividade, campanhas_ativas, campanhas_concluidas,
           sessoes_copilot, reunioes, usuarios_total, usuarios_ativos, usuarios_pendentes,
           licencas_ativas, agentes_prontos, contatos_base, ultima_atividade_em, coletado_em,
           EXTRACT(day FROM now() - ultima_atividade_em)::int AS dias_sem_atividade,
           EXTRACT(day FROM now() - coalesce(coletado_em, snapshot_at))::int AS idade_dias
      FROM callface_ai_tenant_snapshots
     WHERE external_identity_id = ${ident.id}::uuid
     ORDER BY janela_dias, snapshot_at DESC`);

  const [estado] = await db.execute<{ status: string }>(sql`
    SELECT status FROM integracao_sync_estado
     WHERE provider = 'callface_ai' AND recurso = 'tenant_snapshot'
     ORDER BY ultimo_sync_em DESC NULLS LAST LIMIT 1`);

  const base = linhas[0];
  return {
    conectado: true,
    organizationId: ident.external_id,
    confidence: ident.confidence,
    source: ident.source,
    verifiedAt: iso(ident.verified_at),
    coletadoEm: iso(base?.coletado_em ?? null),
    idadeDias: base?.idade_dias ?? null,
    syncStatus: estado?.status ?? null,
    usuariosTotal: base?.usuarios_total ?? null,
    usuariosAtivos: base?.usuarios_ativos ?? null,
    usuariosPendentes: base?.usuarios_pendentes ?? null,
    licencasAtivas: base?.licencas_ativas ?? null,
    agentesProntos: base?.agentes_prontos ?? null,
    contatosBase: base?.contatos_base ?? null,
    ultimaAtividadeEm: iso(base?.ultima_atividade_em ?? null),
    diasSemAtividade: base?.dias_sem_atividade ?? null,
    uso: linhas.map((l) => ({
      janelaDias: l.janela_dias,
      chamadasTotal: l.chamadas_total,
      chamadasFinalizadas: l.chamadas_finalizadas,
      chamadasAmbiguas: l.chamadas_ambiguas,
      // Taxa de conexão só existe se houve chamada. Dividir por zero e mostrar
      // 0% faria cliente sem uso parecer cliente com problema de qualidade.
      taxaConexao: l.chamadas_total > 0
        ? Math.round((l.chamadas_finalizadas / l.chamadas_total) * 1000) / 10
        : null,
      minutos: Number(l.minutos_uso ?? 0),
      usuariosComAtividade: l.usuarios_com_atividade,
      campanhasAtivas: l.campanhas_ativas,
      campanhasConcluidas: l.campanhas_concluidas,
      sessoesCopilot: l.sessoes_copilot,
      reunioes: l.reunioes,
    })),
  };
}
