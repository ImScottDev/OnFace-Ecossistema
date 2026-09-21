/**
 * Liga Empresa/Serviço da ONFACE à organization do SaaS Callface AI.
 *
 * REGRA: só liga sozinho com sinal DETERMINÍSTICO. Nome parecido nunca vira
 * vínculo — vira candidato para alguém decidir.
 *
 * Medido contra produção em 21/09/2026, sobre as 174 empresas que têm serviço
 * CALLFACE_AI no ONFACE:
 *
 *     resolvidas por CNPJ ............... 86
 *     resolvidas por stripe_customer_id . 78
 *     os dois sinais, CONCORDAM ......... 39
 *     os dois sinais, CONTRADIZEM ....... 0
 *     resolvidas por pelo menos um ..... 125  (71,8%)
 *     sem sinal determinístico .......... 49  (28,2%)
 *
 * Nenhum CNPJ casou com mais de uma organization. Os dois sinais nunca se
 * contradisseram — mas o código trata a contradição mesmo assim, porque o dado
 * muda e o dia em que contradisser não pode virar vínculo errado em silêncio.
 *
 * As 49 sem sinal NÃO recebem palpite. Elas ficam registradas como pendência:
 * ligar por semelhança de nome é como uma base ganha vínculo errado que ninguém
 * mais consegue auditar.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lerComTransacao, lerTenants, type TenantCallfaceAi } from "@onface/integrations-callface-ai";

export type Confianca = "deterministic" | "verified" | "candidate";

export interface ResultadoIdentidade {
  ok: boolean;
  avaliadas: number;
  vinculadas: number;
  jaVinculadas: number;
  contradicoes: number;
  /** Organização já vinculada a OUTRA empresa: disputa, não vínculo. */
  disputadas: number;
  semSinal: number;
  erro?: string;
  naoConfigurado?: boolean;
}

interface AlvoOnface extends Record<string, unknown> {
  empresa_id: string;
  cnpj: string | null;
  stripe_customer_id: string | null;
}

/** Só dígitos, e só vale como CNPJ com 14. CPF misturado não entra. */
function cnpjNormalizado(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

/**
 * Resolve e grava os vínculos determinísticos.
 *
 * A ÂNCORA É A EMPRESA, e isso mudou depois de medir.
 *
 * A auditoria de agosto recomendou ancorar no Serviço canônico. O banco diz
 * outra coisa: são 231 serviços CALLFACE_AI para 174 empresas, e UMA empresa
 * tem 42 serviços da família. A organization do SaaS é uma só, e não existe
 * sinal que diga a qual dos 42 serviços ela corresponde.
 *
 * Ancorar no serviço fazia o primeiro serviço do laço ganhar o vínculo e os
 * outros 77 ficarem sem, por ordem de execução — que é decidir por acaso.
 * Ancorado na empresa, o vínculo é 1:1 com a organization, determinístico, e
 * os serviços da empresa herdam a leitura.
 */
export async function resolverIdentidades(organizacaoId: string): Promise<ResultadoIdentidade> {
  const alvos = await db.execute<AlvoOnface>(sql`
    SELECT DISTINCT e.id::text AS empresa_id, e.cnpj,
           (SELECT max(a.stripe_customer_id) FROM assinaturas a
             WHERE a.empresa_id = e.id AND a.stripe_customer_id IS NOT NULL) AS stripe_customer_id
      FROM empresas e
     WHERE EXISTS (SELECT 1 FROM servicos_canonicos s
                    WHERE s.empresa_id = e.id AND s.service_family = 'CALLFACE_AI'
                      AND s.organizacao_id = ${organizacaoId}::uuid)
       AND NOT EXISTS (
         SELECT 1 FROM callface_ai_external_identities i
          WHERE i.entity_type = 'empresa' AND i.entity_id = e.id
            AND i.external_type = 'organization')`);

  const jaVinculadas = Number((await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM callface_ai_external_identities
     WHERE entity_type = 'empresa' AND external_type = 'organization'`))[0]?.n ?? 0);

  if (!alvos.length) {
    return { ok: true, avaliadas: 0, vinculadas: 0, jaVinculadas, contradicoes: 0, disputadas: 0, semSinal: 0 };
  }

  const cnpjs = [...new Set(alvos.map((a) => cnpjNormalizado(a.cnpj)).filter((v): v is string => !!v))];
  const stripes = [...new Set(alvos.map((a) => a.stripe_customer_id).filter((v): v is string => !!v))];

  type LinhaCnpj = { doc: string; id: string; n: number };
  type LinhaStripe = { cus: string; id: string; n: number };
  const leitura = await lerComTransacao<{ porCnpj: LinhaCnpj[]; porStripe: LinhaStripe[] }>(async (s) => {
    const porCnpj: LinhaCnpj[] = cnpjs.length
      ? await s<LinhaCnpj[]>`
          SELECT regexp_replace(coalesce(document_number,''), '\\D', '', 'g') AS doc,
                 min(id) AS id, count(*)::int AS n
            FROM organizations
           WHERE regexp_replace(coalesce(document_number,''), '\\D', '', 'g') IN ${s(cnpjs)}
           GROUP BY 1`
      : [];
    const porStripe: LinhaStripe[] = stripes.length
      ? await s<LinhaStripe[]>`
          SELECT stripe_customer_id AS cus, min(id) AS id, count(*)::int AS n
            FROM organizations WHERE stripe_customer_id IN ${s(stripes)}
           GROUP BY 1`
      : [];
    return { porCnpj, porStripe };
  });

  if (!leitura.ok) {
    return {
      ok: false, avaliadas: alvos.length, vinculadas: 0, jaVinculadas,
      contradicoes: 0, disputadas: 0, semSinal: 0,
      erro: leitura.erro, naoConfigurado: "naoConfigurado" in leitura && leitura.naoConfigurado,
    };
  }

  // Sinal que aponta para MAIS DE UMA organization não é determinístico: o
  // mesmo CNPJ em duas contas do SaaS é exatamente o caso que não dá para
  // decidir sozinho.
  const mapaCnpj = new Map(leitura.dados.porCnpj.filter((r) => r.n === 1).map((r) => [r.doc, r.id]));
  const mapaStripe = new Map(leitura.dados.porStripe.filter((r) => r.n === 1).map((r) => [r.cus, r.id]));

  let vinculadas = 0, contradicoes = 0, semSinal = 0, disputadas = 0;

  for (const alvo of alvos) {
    const doc = cnpjNormalizado(alvo.cnpj);
    const porCnpj = doc ? mapaCnpj.get(doc) ?? null : null;
    const porStripe = alvo.stripe_customer_id ? mapaStripe.get(alvo.stripe_customer_id) ?? null : null;

    if (porCnpj && porStripe && porCnpj !== porStripe) {
      contradicoes++;
      await registrarCandidato(alvo.empresa_id, porCnpj, "cnpj");
      await registrarCandidato(alvo.empresa_id, porStripe, "stripe_customer_id");
      continue;
    }

    const orgId = porCnpj ?? porStripe;
    if (!orgId) { semSinal++; continue; }

    const sinal = porCnpj && porStripe ? "cnpj+stripe_customer_id" : porCnpj ? "cnpj" : "stripe_customer_id";
    const criou = await gravarVinculo(alvo.empresa_id, orgId, sinal);
    if (criou) { vinculadas++; continue; }

    // O ON CONFLICT não criou: esta organization já pertence a outra empresa.
    // Duas empresas do ONFACE apontando para o MESMO tenant do SaaS é um
    // conflito de cadastro, não um vínculo a mais. Some em silêncio se a gente
    // só contar o que entrou.
    disputadas++;
    await registrarCandidato(alvo.empresa_id, orgId, `${sinal}:disputada`);
  }

  return { ok: true, avaliadas: alvos.length, vinculadas, jaVinculadas, contradicoes, disputadas, semSinal };
}

/**
 * ON CONFLICT no índice (provider, external_type, external_id): uma
 * organization do SaaS pertence a UM serviço. Reexecutar não duplica, e duas
 * execuções concorrentes não criam dois vínculos para o mesmo tenant.
 */
async function gravarVinculo(empresaId: string, organizationId: string, sinal: string): Promise<boolean> {
  const r = await db.execute<{ id: string }>(sql`
    INSERT INTO callface_ai_external_identities
      (entity_type, entity_id, provider, external_type, external_id, confidence, source, verified_at)
    VALUES ('empresa', ${empresaId}::uuid, 'callface_ai', 'organization',
            ${organizationId}, 'deterministic', ${sinal}, now())
    ON CONFLICT (provider, external_type, external_id) DO NOTHING
    RETURNING id::text`);
  return r.length > 0;
}

async function registrarCandidato(empresaId: string, organizationId: string, sinal: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO callface_ai_reconciliation_candidates
      (empresa_id, external_organization_id, match_signal, score, status)
    VALUES (${empresaId}::uuid, ${organizationId}, ${sinal}, 1.0, 'pendente')
    ON CONFLICT DO NOTHING`).catch(() => undefined);
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
