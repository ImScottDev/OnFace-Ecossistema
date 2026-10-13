/**
 * Escrita auditada dos vínculos empresa <-> organização da Callface AI.
 * Quem chama (server actions em `vinculo-actions.ts`) já resolveu a organização e o ator
 * da SESSÃO. Nada aqui toca o banco do SaaS: só o modelo local.
 *
 * Toda mudança grava em `audit_log` (quem, quando, antes, depois, evidência).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type ResultadoVinculo = { ok: true; estado: "confirmado" | "manual" | "removido"; orgCallfaceId: string | null } | { ok: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function auditar(tx: Tx, organizacaoId: string, atorId: string, acao: string, empresaId: string, antes: unknown, depois: unknown) {
  await tx.execute(sql`
    INSERT INTO audit_log (organizacao_id, actor_id, action, entity_type, entity_id, before, after, source)
    VALUES (${organizacaoId}::uuid, ${atorId}::uuid, ${acao}, 'empresa', ${empresaId}::uuid,
            ${antes ? JSON.stringify(antes) : null}::jsonb, ${depois ? JSON.stringify(depois) : null}::jsonb, 'app')`);
}

async function empresaDaOrg(tx: Tx, organizacaoId: string, empresaId: string) {
  if (!UUID.test(empresaId)) return null;
  const [e] = await tx.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
  return e ?? null;
}

async function identidadeAtual(tx: Tx, empresaId: string) {
  const [i] = await tx.execute<{ id: string; external_id: string; estado: string; evidencia: unknown; org_nome: string | null }>(sql`
    SELECT id::text, external_id, estado, evidencia, org_nome FROM callface_ai_external_identities
     WHERE entity_type = 'empresa' AND entity_id = ${empresaId}::uuid AND provider = 'callface_ai' AND external_type = 'organization'`);
  return i ?? null;
}

async function donoDaOrg(tx: Tx, orgSaasId: string) {
  const [d] = await tx.execute<{ nome: string }>(sql`
    SELECT e.nome FROM callface_ai_external_identities i JOIN empresas e ON e.id = i.entity_id
     WHERE i.provider = 'callface_ai' AND i.external_type = 'organization' AND i.external_id = ${orgSaasId}`);
  return d?.nome ?? null;
}

async function gravarIdentidade(tx: Tx, empresaId: string, orgSaasId: string, orgNome: string | null,
  estado: "confirmado" | "manual", evidencia: unknown) {
  await tx.execute(sql`
    INSERT INTO callface_ai_external_identities
      (entity_type, entity_id, provider, external_type, external_id, confidence, source, verified_at, evidencia, estado, org_nome)
    VALUES ('empresa', ${empresaId}::uuid, 'callface_ai', 'organization', ${orgSaasId}, 'verified',
            ${estado === "confirmado" ? "confirmado_por_pessoa" : "manual"}, now(), ${JSON.stringify(evidencia)}::jsonb, ${estado}, ${orgNome})`);
}

/** Confirma uma sugestão pendente (a pessoa viu a razão e concordou). */
export async function confirmarVinculoPendente(organizacaoId: string, atorId: string, empresaId: string, candidatoId: string): Promise<ResultadoVinculo> {
  if (!UUID.test(candidatoId)) return { ok: false, erro: "Sugestão inválida." };
  return db.transaction(async (tx) => {
    const empresa = await empresaDaOrg(tx, organizacaoId, empresaId);
    if (!empresa) return { ok: false, erro: "Empresa não encontrada." } as const;
    if (await identidadeAtual(tx, empresaId)) return { ok: false, erro: "Esta empresa já tem vínculo; use alterar." } as const;
    const [c] = await tx.execute<{ id: string; org: string; org_nome: string | null; sinal: string; razao: string | null; evidencia: unknown }>(sql`
      SELECT id::text, external_organization_id AS org, org_nome, match_signal AS sinal, razao, evidencia
        FROM callface_ai_reconciliation_candidates
       WHERE id = ${candidatoId}::uuid AND empresa_id = ${empresaId}::uuid AND status = 'pendente' FOR UPDATE`);
    if (!c) return { ok: false, erro: "Sugestão não está mais pendente." } as const;
    const dono = await donoDaOrg(tx, c.org);
    if (dono) return { ok: false, erro: `Esta organização já está vinculada a "${dono}".` } as const;
    const evidencia = {
      origem: "confirmado", regra: c.sinal, sinais: [], decididoEm: new Date().toISOString(), versaoRegra: 1,
      sugestao: { razao: c.razao, evidencia: c.evidencia }, confirmadoPor: atorId,
    };
    await gravarIdentidade(tx, empresaId, c.org, c.org_nome, "confirmado", evidencia);
    await tx.execute(sql`
      UPDATE callface_ai_reconciliation_candidates
         SET status = CASE WHEN id = ${candidatoId}::uuid THEN 'confirmado' ELSE 'resolvido' END,
             decidido_por = ${atorId}::uuid, decidido_em = now(), updated_at = now()
       WHERE empresa_id = ${empresaId}::uuid AND status = 'pendente'`);
    await auditar(tx, organizacaoId, atorId, "callface_ai.vinculo.confirmar", empresaId, null, { organizationId: c.org, orgNome: c.org_nome, evidencia });
    return { ok: true, estado: "confirmado", orgCallfaceId: c.org } as const;
  });
}

/**
 * Troca (ou cria) o vínculo apontando para outra organização. A organização precisa ser
 * CONHECIDA (apareceu como sugestão para alguma empresa): o app não consulta o SaaS na hora.
 * O par anterior fica "rejeitado", para o sync automático não o refazer.
 */
export async function alterarVinculoManual(organizacaoId: string, atorId: string, empresaId: string, orgCallfaceId: string, motivo: string): Promise<ResultadoVinculo> {
  const m = motivo.trim();
  if (m.length < 5) return { ok: false, erro: "Explique o motivo (mínimo 5 caracteres)." };
  if (!orgCallfaceId || orgCallfaceId.length > 80) return { ok: false, erro: "Organização inválida." };
  return db.transaction(async (tx) => {
    const empresa = await empresaDaOrg(tx, organizacaoId, empresaId);
    if (!empresa) return { ok: false, erro: "Empresa não encontrada." } as const;
    const [conhecida] = await tx.execute<{ org_nome: string | null }>(sql`
      SELECT c.org_nome FROM callface_ai_reconciliation_candidates c JOIN empresas e ON e.id = c.empresa_id
       WHERE c.external_organization_id = ${orgCallfaceId} AND e.organizacao_id = ${organizacaoId}::uuid LIMIT 1`);
    const atual = await identidadeAtual(tx, empresaId);
    const nomeConhecido = conhecida?.org_nome ?? (atual?.external_id === orgCallfaceId ? atual.org_nome : null);
    if (!conhecida && atual?.external_id !== orgCallfaceId) return { ok: false, erro: "Organização desconhecida. Ela precisa aparecer entre as sugestões (rode o sync)." } as const;
    const dono = await donoDaOrg(tx, orgCallfaceId);
    if (dono && atual?.external_id !== orgCallfaceId) return { ok: false, erro: `Esta organização já está vinculada a "${dono}".` } as const;
    if (atual) {
      await tx.execute(sql`DELETE FROM callface_ai_external_identities WHERE id = ${atual.id}::uuid`);
      await tx.execute(sql`
        INSERT INTO callface_ai_reconciliation_candidates (empresa_id, external_organization_id, match_signal, status, razao, org_nome, decidido_por, decidido_em)
        VALUES (${empresaId}::uuid, ${atual.external_id}, 'manual', 'rejeitado', ${`Trocado por pessoa: ${m}`}, ${atual.org_nome}, ${atorId}::uuid, now())
        ON CONFLICT (empresa_id, external_organization_id) DO UPDATE SET status = 'rejeitado', razao = EXCLUDED.razao, decidido_por = EXCLUDED.decidido_por, decidido_em = now(), updated_at = now()`);
    }
    const evidencia = { origem: "manual", regra: "escolha_manual", sinais: [], decididoEm: new Date().toISOString(), versaoRegra: 1, motivo: m, decididoPor: atorId };
    await gravarIdentidade(tx, empresaId, orgCallfaceId, nomeConhecido, "manual", evidencia);
    await tx.execute(sql`
      UPDATE callface_ai_reconciliation_candidates SET status = 'resolvido', decidido_por = ${atorId}::uuid, decidido_em = now(), updated_at = now()
       WHERE empresa_id = ${empresaId}::uuid AND status = 'pendente'`);
    await auditar(tx, organizacaoId, atorId, "callface_ai.vinculo.alterar", empresaId,
      atual ? { organizationId: atual.external_id, orgNome: atual.org_nome, estado: atual.estado, evidencia: atual.evidencia } : null,
      { organizationId: orgCallfaceId, orgNome: nomeConhecido, evidencia });
    return { ok: true, estado: "manual", orgCallfaceId } as const;
  });
}

/** Remove o vínculo (e o dado sincronizado dele). O par fica "rejeitado": o sync não o refaz. */
export async function removerVinculoDaEmpresa(organizacaoId: string, atorId: string, empresaId: string, motivo: string): Promise<ResultadoVinculo> {
  const m = motivo.trim();
  if (m.length < 5) return { ok: false, erro: "Explique o motivo (mínimo 5 caracteres)." };
  return db.transaction(async (tx) => {
    const empresa = await empresaDaOrg(tx, organizacaoId, empresaId);
    if (!empresa) return { ok: false, erro: "Empresa não encontrada." } as const;
    const atual = await identidadeAtual(tx, empresaId);
    if (!atual) return { ok: false, erro: "Esta empresa não tem vínculo." } as const;
    await tx.execute(sql`DELETE FROM callface_ai_external_identities WHERE id = ${atual.id}::uuid`);
    await tx.execute(sql`
      INSERT INTO callface_ai_reconciliation_candidates (empresa_id, external_organization_id, match_signal, status, razao, org_nome, decidido_por, decidido_em)
      VALUES (${empresaId}::uuid, ${atual.external_id}, 'manual', 'rejeitado', ${`Removido por pessoa: ${m}`}, ${atual.org_nome}, ${atorId}::uuid, now())
      ON CONFLICT (empresa_id, external_organization_id) DO UPDATE SET status = 'rejeitado', razao = EXCLUDED.razao, decidido_por = EXCLUDED.decidido_por, decidido_em = now(), updated_at = now()`);
    await auditar(tx, organizacaoId, atorId, "callface_ai.vinculo.remover", empresaId,
      { organizationId: atual.external_id, orgNome: atual.org_nome, estado: atual.estado, evidencia: atual.evidencia, motivo: m }, null);
    return { ok: true, estado: "removido", orgCallfaceId: null } as const;
  });
}
