"use server";

/* Leituras da peça de reunião (OnFace Reuniao.dc.html), aberta por cima de
 * qualquer tela. Só leitura: criar, editar e cancelar vão pela rota que o
 * Calendário e o CRM já usam (/api/reunioes), que sincroniza com o Outlook.
 * Tenant e usuário vêm sempre da sessão. */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { nomeCompleto } from "@/lib/vendas/texto";

export type ReuniaoDaPeca = {
  id: string;
  titulo: string;
  data: string;
  duracao: number | null;
  tipo: string | null;
  status: string | null;
  participantes: string[] | null;
  link: string | null;
  notas: string | null;
  responsavelId: string | null;
  responsavel: string | null;
  negocioId: string | null;
  leadId: string | null;
  pessoa: string | null;
  email: string | null;
  empresa: string | null;
  temEvento: boolean;
  syncStatus: string | null;
  syncErro: string | null;
  syncEm: string | null;
  /** Resposta de cada convidado lida do Outlook: {email: accepted | declined | tentativelyAccepted | none}. */
  respostas: Record<string, string>;
}

export type MembroDaPeca = { id: string; nome: string; outlook: boolean }
export type OppDaPeca = {
  id: string; titulo: string; empresa: string; pessoa: string; cargo: string;
  leadId: string | null; email: string | null; resp: string | null;
}
export type LeadDaPeca = { id: string; pessoa: string; empresa: string; email: string | null; cargo: string }

const UUID = /^[0-9a-f-]{36}$/i;

export async function acaoReuniaoDaPeca(id: string): Promise<ReuniaoDaPeca | null> {
  const ctx = await getTenantContext();
  if (!ctx || !UUID.test(id)) return null;
  const [r] = await db.execute<ReuniaoDaPeca>(sql`
    SELECT r.id::text, r.titulo, to_char(r.data AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS data,
           r.duracao, r.tipo, r.status, coalesce(to_jsonb(r.participantes), '[]'::jsonb) AS participantes, r.link, r.notas,
           r.responsavel_id::text AS "responsavelId", u.nome AS responsavel,
           r.negocio_id::text AS "negocioId", coalesce(l.id, ln.id)::text AS "leadId",
           coalesce(l.nome, ln.nome) AS pessoa, coalesce(l.email, ln.email) AS email,
           coalesce(el.nome, nullif(l.empresa, ''), en.nome, eln.nome, nullif(ln.empresa, '')) AS empresa,
           (r.outlook_event_id IS NOT NULL OR r.calendar_event_id IS NOT NULL) AS "temEvento",
           r.calendar_sync_status AS "syncStatus", r.calendar_sync_erro AS "syncErro",
           to_char(r.calendar_sync_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "syncEm",
           r.participantes_respostas AS respostas
      FROM reunioes r
      LEFT JOIN usuarios u ON u.id = r.responsavel_id
      LEFT JOIN leads l ON l.id = r.lead_id
      LEFT JOIN empresas el ON el.id = l.empresa_id
      LEFT JOIN negocios n ON n.id = r.negocio_id
      LEFT JOIN empresas en ON en.id = n.empresa_id
      LEFT JOIN leads ln ON ln.id = n.lead_id
      LEFT JOIN empresas eln ON eln.id = ln.empresa_id
     WHERE r.id = ${id}::uuid AND r.organizacao_id = ${ctx.organizacaoId}::uuid
  `);
  return r ?? null;
}

/**
 * Equipe (com quem tem Outlook conectado), oportunidades abertas e os leads
 * do contexto. Oportunidades seguem o RBAC do pipeline: gestão vê todas,
 * os demais só as próprias — mais a do contexto, se for da organização.
 */
/* `leads.nome` é só o primeiro nome (sobrenome em coluna própria): a peça casa o contato pelo
   nome inteiro que a tela mostra, então devolve o nome inteiro. */
function comNomeCompleto<T extends { pessoa: string; sobrenome?: string | null }>({ sobrenome, ...r }: T) {
  return { ...r, pessoa: nomeCompleto(r.pessoa, sobrenome) };
}

export async function acaoBaseDaPeca(entrada: { negocioId?: string | null; leadId?: string | null; empresaId?: string | null }): Promise<{
  equipe: MembroDaPeca[]; opps: OppDaPeca[]; leads: LeadDaPeca[];
} | null> {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const org = ctx.organizacaoId;
  const negocioId = entrada.negocioId && UUID.test(entrada.negocioId) ? entrada.negocioId : null;
  const leadId = entrada.leadId && UUID.test(entrada.leadId) ? entrada.leadId : null;
  const empresaId = entrada.empresaId && UUID.test(entrada.empresaId) ? entrada.empresaId : null;
  const soMinhas = !isAdminView(ctx.userRole);

  const [equipe, opps, leads] = await Promise.all([
    db.execute<MembroDaPeca>(sql`
      SELECT u.id::text, u.nome,
             EXISTS (SELECT 1 FROM email_contas ec WHERE ec.usuario_id = u.id AND ec.tipo = 'microsoft' AND ec.sync_status = 'active') AS outlook
        FROM usuarios u
       WHERE u.organizacao_id = ${org}::uuid AND u.ativo = true AND u.role <> 'leitor'
       ORDER BY u.nome
    `),
    db.execute<OppDaPeca>(sql`
      SELECT n.id::text, n.titulo,
             coalesce(e.nome, el.nome, nullif(l.empresa, ''), n.titulo) AS empresa,
             coalesce(l.nome, '') AS pessoa, coalesce(l.sobrenome, '') AS sobrenome, coalesce(l.cargo, '') AS cargo,
             l.id::text AS "leadId", l.email, u.nome AS resp
        FROM negocios n
        LEFT JOIN leads l ON l.id = n.lead_id
        LEFT JOIN empresas e ON e.id = n.empresa_id
        LEFT JOIN empresas el ON el.id = l.empresa_id
        LEFT JOIN usuarios u ON u.id = n.responsavel_id
       WHERE n.organizacao_id = ${org}::uuid
         AND (
           (n.status NOT IN ('ganho', 'perdido', 'churned') AND (${!soMinhas} OR n.responsavel_id = ${ctx.userId}::uuid))
           OR n.id = ${negocioId}::uuid
         )
       ORDER BY (n.id = ${negocioId}::uuid) DESC NULLS LAST, n.updated_at DESC
       LIMIT 400
    `),
    db.execute<LeadDaPeca>(sql`
      SELECT l.id::text, l.nome AS pessoa, l.sobrenome, coalesce(e.nome, l.empresa, '') AS empresa, l.email, coalesce(l.cargo, '') AS cargo
        FROM leads l LEFT JOIN empresas e ON e.id = l.empresa_id
       WHERE l.organizacao_id = ${org}::uuid
         AND (l.id = ${leadId}::uuid OR l.empresa_id = ${empresaId}::uuid)
       ORDER BY (l.id = ${leadId}::uuid) DESC NULLS LAST
       LIMIT 30
    `),
  ]);
  return { equipe: [...equipe], opps: opps.map(comNomeCompleto), leads: leads.map(comNomeCompleto) };
}

/** Busca de contato para o autocompletar de empresa/pessoa. */
export async function acaoBuscarContatosDaPeca(q: string): Promise<LeadDaPeca[]> {
  const ctx = await getTenantContext();
  const termo = q.trim();
  if (!ctx || termo.length < 2) return [];
  const like = "%" + termo.replace(/[%_\\]/g, (c) => "\\" + c) + "%";
  const linhas = await db.execute<LeadDaPeca>(sql`
    SELECT l.id::text, l.nome AS pessoa, l.sobrenome, coalesce(e.nome, l.empresa, '') AS empresa, l.email, coalesce(l.cargo, '') AS cargo
      FROM leads l LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE l.organizacao_id = ${ctx.organizacaoId}::uuid
       AND (l.nome ILIKE ${like} OR l.empresa ILIKE ${like} OR e.nome ILIKE ${like} OR l.email ILIKE ${like})
     ORDER BY l.updated_at DESC
     LIMIT 12
  `);
  return linhas.map(comNomeCompleto);
}
