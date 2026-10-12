/**
 * Resolve QUAL atendimento uma entidade do CRM representa (lead, contato, negócio,
 * oportunidade, cliente, serviço, empresa). Fonte única para automação, Atendimento e retomadas:
 * evita tratar todo registro como lead (o defeito do evento de tag) e evita tratar cliente como lead novo.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";

export interface AlvoDoAtendimento {
  leadId: string | null;
  contatoId: string | null;
  negocioId: string | null;
  empresaId: string | null;
  ehCliente: boolean;
}

const uuid = (v: string | null | undefined) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export async function alvoDaEntidade(organizacaoId: string, tipo: string, id: string): Promise<AlvoDoAtendimento | null> {
  const vazio: AlvoDoAtendimento = { leadId: null, contatoId: null, negocioId: null, empresaId: null, ehCliente: false };
  const entidade = uuid(id);
  if (!entidade) return null;
  const org = organizacaoId;
  let a = { ...vazio };
  switch (tipo) {
    case "lead": a.leadId = entidade; break;
    case "contato": {
      const [c] = await db.select({ leadId: contatos.leadId }).from(contatos).where(and(eq(contatos.id, entidade), eq(contatos.organizacaoId, org))).limit(1);
      if (!c) return null; a.contatoId = entidade; a.leadId = c.leadId ?? null; break;
    }
    case "negocio": {
      const [n] = await db.execute<{ lead_id: string | null; empresa_id: string | null }>(sql`SELECT lead_id::text, empresa_id::text FROM negocios WHERE id = ${entidade}::uuid AND organizacao_id = ${org}::uuid`);
      if (!n) return null; a = { ...a, negocioId: entidade, leadId: n.lead_id, empresaId: n.empresa_id }; break;
    }
    case "oportunidade": {
      const [o] = await db.execute<{ negocio_id: string | null; lead_id: string | null; empresa_id: string | null }>(sql`
        SELECT negocio_id_legado::text AS negocio_id, coalesce(lead_id, (SELECT lead_id FROM negocios WHERE id = negocio_id_legado))::text AS lead_id, empresa_id::text
          FROM oportunidades WHERE id = ${entidade}::uuid AND organizacao_id = ${org}::uuid`);
      if (!o) return null; a = { ...a, negocioId: o.negocio_id, leadId: o.lead_id, empresaId: o.empresa_id }; break;
    }
    case "cliente": {
      const [c] = await db.execute<{ lead_id: string | null; empresa_id: string | null }>(sql`
        SELECT coalesce(c.lead_id_legado, p.lead_id_legado)::text AS lead_id, c.empresa_id::text FROM clientes c LEFT JOIN pessoas p ON p.id = c.pessoa_principal_id
         WHERE c.id = ${entidade}::uuid AND c.organizacao_id = ${org}::uuid`);
      if (!c) return null; a = { ...a, leadId: c.lead_id, empresaId: c.empresa_id, ehCliente: true }; break;
    }
    case "servico": {
      const [s] = await db.execute<{ lead_id: string | null; empresa_id: string | null }>(sql`SELECT lead_id::text, empresa_id::text FROM servicos_canonicos WHERE id = ${entidade}::uuid AND organizacao_id = ${org}::uuid`);
      if (!s) return null; a = { ...a, leadId: s.lead_id, empresaId: s.empresa_id, ehCliente: true }; break;
    }
    case "empresa": {
      const [l] = await db.execute<{ lead_id: string | null }>(sql`
        SELECT coalesce((SELECT lead_id_legado FROM pessoas WHERE empresa_id = ${entidade}::uuid AND lead_id_legado IS NOT NULL ORDER BY created_at LIMIT 1),
                        (SELECT id FROM leads WHERE empresa_id = ${entidade}::uuid AND organizacao_id = ${org}::uuid ORDER BY created_at DESC LIMIT 1))::text AS lead_id
         WHERE EXISTS (SELECT 1 FROM empresas WHERE id = ${entidade}::uuid AND organizacao_id = ${org}::uuid)`);
      if (!l) return null; a = { ...a, empresaId: entidade, leadId: l.lead_id }; break;
    }
    default: return null;
  }
  if (a.leadId && !a.contatoId) {
    const [c] = await db.select({ id: contatos.id }).from(contatos).where(and(eq(contatos.organizacaoId, org), eq(contatos.leadId, a.leadId))).orderBy(sql`${contatos.ultimaMsgAt} DESC NULLS LAST`).limit(1);
    a.contatoId = c?.id ?? null;
  }
  if (a.leadId) {
    const [l] = await db.execute<{ empresa_id: string | null; tipo: string | null }>(sql`SELECT empresa_id::text, tipo FROM leads WHERE id = ${a.leadId}::uuid AND organizacao_id = ${org}::uuid`);
    if (!l) return null; // lead de outra organização: não existe para esta
    a.empresaId = a.empresaId ?? l.empresa_id;
    if (l.tipo === "cliente") a.ehCliente = true;
  }
  if (!a.ehCliente && a.empresaId) {
    const [c] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM servicos_canonicos WHERE empresa_id = ${a.empresaId}::uuid AND organizacao_id = ${org}::uuid AND commercial_lifecycle = 'ACTIVE'`);
    a.ehCliente = (c?.n ?? 0) > 0;
  }
  return a;
}
