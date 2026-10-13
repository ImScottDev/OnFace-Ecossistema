/**
 * Liga Empresa do ONFACE à organization do SaaS Callface AI.
 *
 * REGRA (detalhes e testes em `vinculo-regra.ts`): só liga sozinho com sinal
 * DETERMINÍSTICO e 1:1 — CNPJ, stripe_customer_id ou e-mail do dono. A
 * evidência (chave que casou, valor normalizado, quando, origem `auto`) é
 * gravada no vínculo. Todo o resto vira PENDÊNCIA com a melhor sugestão e a
 * razão; nome parecido nunca vira vínculo.
 *
 * A ÂNCORA É A EMPRESA, não o serviço: são centenas de serviços CALLFACE_AI
 * para poucas empresas, e uma empresa tem dezenas de serviços da família. A
 * organization do SaaS é uma só; os serviços da empresa herdam a leitura.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lerComTransacao, lerOrganizacoes, type OrganizacaoCallfaceAi, type TenantCallfaceAi } from "@onface/integrations-callface-ai";
import { decidirVinculos, type AlvoEmpresa, type Decisao, type EmpresaLigada } from "./vinculo-regra";

export interface ResultadoIdentidade {
  ok: boolean;
  avaliadas: number;
  vinculadas: number;
  jaVinculadas: number;
  /** Sinais fortes que apontam para organizações diferentes. */
  contradicoes: number;
  /** Organização disputada por duas empresas. */
  disputadas: number;
  /** Empresas duplicadas no ONFACE (mesmo CNPJ) que ficaram pendentes: a canônica liga, a outra espera unificação. */
  duplicadas: number;
  /** Duplicatas em que nenhuma empresa é claramente a principal (ninguém liga). */
  duplicadasIndecisas: number;
  /** Sinal forte ambíguo (organização repetida no SaaS ou sinal dividido) que ficou pendente com a razão. */
  ambiguas: number;
  /** Empresas sem nenhum sinal forte nem sugestão razoável. */
  semSinal: number;
  /** Empresas sem vínculo que ficaram com sugestão/pendência registrada. */
  pendentes: number;
  erro?: string;
  naoConfigurado?: boolean;
}

interface LinhaAlvo extends Record<string, unknown> {
  empresa_id: string; nome: string; razao_social: string | null; cnpj: string | null;
  website: string | null; stripe_ids: string[] | null; emails: string[] | null;
  servicos_ai: number; assinaturas: number; oportunidades: number; pessoas: number;
}

async function carregarAlvos(organizacaoId: string): Promise<AlvoEmpresa[]> {
  const linhas = await db.execute<LinhaAlvo>(sql`
    SELECT e.id::text AS empresa_id, e.nome, e.razao_social, e.cnpj, e.website,
           to_json(ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[e.stripe_customer_id] || ARRAY(
                   SELECT a.stripe_customer_id FROM assinaturas a WHERE a.empresa_id = e.id)) x
                  WHERE x IS NOT NULL AND x <> '')) AS stripe_ids,
           to_json(ARRAY(SELECT DISTINCT lower(trim(p.email)) FROM pessoas p
                  WHERE p.organizacao_id = e.organizacao_id AND p.email IS NOT NULL AND trim(p.email) <> ''
                    AND (p.empresa_id = e.id OR p.id IN (
                          SELECT v.pessoa_id FROM pessoa_empresa_vinculos v
                           WHERE v.empresa_id = e.id AND v.encerrado_em IS NULL)))) AS emails,
           (SELECT count(*)::int FROM servicos_canonicos s WHERE s.empresa_id = e.id AND s.service_family = 'CALLFACE_AI') AS servicos_ai,
           (SELECT count(*)::int FROM assinaturas a WHERE a.empresa_id = e.id) AS assinaturas,
           (SELECT count(*)::int FROM oportunidades o WHERE o.empresa_id = e.id) AS oportunidades,
           (SELECT count(*)::int FROM pessoas p WHERE p.empresa_id = e.id) AS pessoas
      FROM empresas e
     WHERE e.organizacao_id = ${organizacaoId}::uuid
       AND EXISTS (SELECT 1 FROM servicos_canonicos s
                    WHERE s.empresa_id = e.id AND s.service_family = 'CALLFACE_AI'
                      AND s.organizacao_id = e.organizacao_id)
       AND NOT EXISTS (SELECT 1 FROM callface_ai_external_identities i
                        WHERE i.entity_type = 'empresa' AND i.entity_id = e.id
                          AND i.external_type = 'organization')`);
  return linhas.map((l) => ({
    empresaId: l.empresa_id, nome: l.nome, razaoSocial: l.razao_social, cnpj: l.cnpj, website: l.website,
    stripeIds: l.stripe_ids ?? [], emails: l.emails ?? [],
    peso: { servicosAi: l.servicos_ai, assinaturas: l.assinaturas, oportunidades: l.oportunidades, pessoas: l.pessoas },
  }));
}

/** Nome e CNPJ das empresas que já têm vínculo: reconhece a candidata que é duplicata de uma delas. */
async function carregarEmpresasLigadas(organizacaoId: string): Promise<Map<string, EmpresaLigada>> {
  const linhas = await db.execute<{ id: string; nome: string; cnpj: string | null }>(sql`
    SELECT e.id::text AS id, e.nome, e.cnpj FROM empresas e
     WHERE e.organizacao_id = ${organizacaoId}::uuid
       AND EXISTS (SELECT 1 FROM callface_ai_external_identities i
                    WHERE i.entity_type = 'empresa' AND i.entity_id = e.id AND i.external_type = 'organization')`);
  return new Map(linhas.map((l) => [l.id, { nome: l.nome, cnpj: l.cnpj }] as const));
}

export interface DecisoesDeIdentidade {
  alvos: AlvoEmpresa[];
  decisoes: Decisao[];
  nomePorOrg: Map<string, string>;
  jaVinculadas: number;
}

/**
 * Lê (SELECT no ONFACE e no SaaS) e decide, SEM gravar nada. É a mesma decisão
 * do sync e do script de simulação, para os dois nunca divergirem.
 */
export async function decidirIdentidades(organizacaoId: string): Promise<
  | ({ ok: true } & DecisoesDeIdentidade)
  | { ok: false; avaliadas: number; jaVinculadas: number; erro?: string; naoConfigurado?: boolean }
> {
  const alvos = await carregarAlvos(organizacaoId);
  const jaVinculadas = Number((await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM callface_ai_external_identities i
      JOIN empresas e ON e.id = i.entity_id
     WHERE i.entity_type = 'empresa' AND i.external_type = 'organization'
       AND e.organizacao_id = ${organizacaoId}::uuid`))[0]?.n ?? 0);
  if (!alvos.length) return { ok: true, alvos, decisoes: [], nomePorOrg: new Map(), jaVinculadas };

  const leitura = await lerComTransacao<OrganizacaoCallfaceAi[]>((s) => lerOrganizacoes(s));
  if (!leitura.ok) {
    return { ok: false, avaliadas: alvos.length, jaVinculadas, erro: leitura.erro,
      naoConfigurado: "naoConfigurado" in leitura && leitura.naoConfigurado };
  }
  const orgs = leitura.dados;
  const nomePorOrg = new Map(orgs.map((o) => [o.id, o.nome]));

  const ligadas = new Map((await db.execute<{ org: string; empresa: string }>(sql`
    SELECT external_id AS org, entity_id::text AS empresa FROM callface_ai_external_identities
     WHERE entity_type = 'empresa' AND external_type = 'organization' AND provider = 'callface_ai'`))
    .map((r) => [r.org, r.empresa] as const));
  const rejeitados = new Set((await db.execute<{ k: string }>(sql`
    SELECT empresa_id::text || '|' || external_organization_id AS k
      FROM callface_ai_reconciliation_candidates WHERE status = 'rejeitado'`)).map((r) => r.k));

  const decisoes = decidirVinculos(alvos, orgs, ligadas, rejeitados, new Date(), await carregarEmpresasLigadas(organizacaoId));
  return { ok: true, alvos, decisoes, nomePorOrg, jaVinculadas };
}

/** Resolve e grava os vínculos automáticos e as pendências. */
export async function resolverIdentidades(organizacaoId: string): Promise<ResultadoIdentidade> {
  const d = await decidirIdentidades(organizacaoId);
  const zero = { avaliadas: 0, vinculadas: 0, jaVinculadas: d.ok ? d.jaVinculadas : d.jaVinculadas, contradicoes: 0, disputadas: 0, duplicadas: 0, duplicadasIndecisas: 0, ambiguas: 0, semSinal: 0, pendentes: 0 };
  if (!d.ok) {
    return { ok: false, ...zero, avaliadas: d.avaliadas, erro: d.erro, naoConfigurado: d.naoConfigurado };
  }
  if (!d.alvos.length) return { ok: true, ...zero };

  const { decisoes, nomePorOrg } = d;
  const r = { ...zero, avaliadas: d.alvos.length };
  const comPendencia = new Set<string>();

  for (const x of decisoes) {
    if (x.tipo === "auto") {
      const criou = await gravarVinculoAuto(organizacaoId, x.empresaId, x.orgId, nomePorOrg.get(x.orgId) ?? null, x.evidencia);
      if (criou) r.vinculadas++;
    } else if (x.tipo === "pendente") {
      comPendencia.add(x.empresaId);
      if (x.sinal === "contradicao") r.contradicoes++;
      if (x.sinal === "disputada") r.disputadas++;
      if (x.sinal === "duplicada") r.duplicadas++;
      if (x.sinal === "duplicada_indecisa") r.duplicadasIndecisas++;
      if (x.sinal === "ambigua") r.ambiguas++;
      await registrarPendencia(x.empresaId, x.orgId, nomePorOrg.get(x.orgId) ?? null, x.sinal, x.score, x.razao, x.evidencia);
    } else {
      r.semSinal++;
    }
  }
  r.pendentes = comPendencia.size;
  return { ok: true, ...r };
}

/**
 * ON CONFLICT no índice (provider, external_type, external_id): uma
 * organization do SaaS pertence a UMA empresa. Reexecutar não duplica, e duas
 * execuções concorrentes não criam dois vínculos para o mesmo tenant.
 */
export async function gravarVinculoAuto(
  organizacaoId: string, empresaId: string, orgSaasId: string, orgNome: string | null, evidencia: unknown,
  ex: Pick<typeof db, "execute"> = db,
): Promise<boolean> {
  const regra = (evidencia as { regra: string }).regra;
  const r = await ex.execute<{ id: string }>(sql`
    INSERT INTO callface_ai_external_identities
      (entity_type, entity_id, provider, external_type, external_id, confidence, source,
       verified_at, evidencia, estado, org_nome)
    VALUES ('empresa', ${empresaId}::uuid, 'callface_ai', 'organization', ${orgSaasId},
            'deterministic', ${regra}, now(), ${JSON.stringify(evidencia)}::jsonb, 'auto', ${orgNome})
    ON CONFLICT (provider, external_type, external_id) DO NOTHING
    RETURNING id::text`);
  if (!r.length) return false;
  await ex.execute(sql`
    UPDATE callface_ai_reconciliation_candidates SET status = 'resolvido', updated_at = now()
     WHERE empresa_id = ${empresaId}::uuid AND status = 'pendente'`);
  await ex.execute(sql`
    INSERT INTO audit_log (organizacao_id, actor_id, action, entity_type, entity_id, before, after, source)
    VALUES (${organizacaoId}::uuid, NULL, 'callface_ai.vinculo.auto', 'empresa', ${empresaId}::uuid, NULL,
            ${JSON.stringify({ organizationId: orgSaasId, orgNome, evidencia })}::jsonb, 'worker')`);
  return true;
}

/** Só atualiza a sugestão enquanto ninguém decidiu: confirmado/rejeitado não voltam a pendente. */
async function registrarPendencia(
  empresaId: string, orgSaasId: string, orgNome: string | null, sinal: string, score: number,
  razao: string, evidencia: Record<string, unknown>,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO callface_ai_reconciliation_candidates
      (empresa_id, external_organization_id, match_signal, score, status, evidencia, razao, org_nome)
    VALUES (${empresaId}::uuid, ${orgSaasId}, ${sinal}, ${score}, 'pendente',
            ${JSON.stringify(evidencia)}::jsonb, ${razao}, ${orgNome})
    ON CONFLICT (empresa_id, external_organization_id) DO UPDATE SET
      match_signal = EXCLUDED.match_signal, score = EXCLUDED.score, evidencia = EXCLUDED.evidencia,
      razao = EXCLUDED.razao, org_nome = EXCLUDED.org_nome, updated_at = now()
      WHERE callface_ai_reconciliation_candidates.status = 'pendente'`);
}

/** Os tenants que já têm vínculo, para o sync saber o que ler. */
export async function tenantsVinculados(organizacaoId: string): Promise<Array<{
  identityId: string; empresaId: string; organizationId: string;
}>> {
  const linhas = await db.execute<{ identity_id: string; empresa_id: string; organization_id: string }>(sql`
    SELECT i.id::text AS identity_id, i.entity_id::text AS empresa_id, i.external_id AS organization_id
      FROM callface_ai_external_identities i
      JOIN empresas e ON e.id = i.entity_id
     WHERE i.entity_type = 'empresa' AND i.external_type = 'organization'
       AND i.provider = 'callface_ai' AND e.organizacao_id = ${organizacaoId}::uuid`);
  return linhas.map((l) => ({
    identityId: l.identity_id, empresaId: l.empresa_id, organizationId: l.organization_id,
  }));
}

export type { TenantCallfaceAi };
