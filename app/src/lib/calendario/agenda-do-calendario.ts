import { db } from "@/lib/db";
import { reunioes, usuarios, leads, negocios, empresas } from "@/lib/db/schema";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

/** Uma reunião, já com os nomes que o calendário do handoff desenha. */
export interface ReuniaoDaAgenda {
  id: string;
  titulo: string;
  /** ISO. A Liga converte para Date no cliente, no fuso de quem vê. */
  data: string;
  duracao: number | null;
  status: string | null;
  responsavel: string | null;
  empresa: string | null;
  pessoa: string | null;
  negocioId: string | null;
  negocioTitulo: string | null;
  notas: string | null;
}

const empresaDoLead = alias(empresas, "empresa_do_lead");
const empresaDoNegocio = alias(empresas, "empresa_do_negocio");
// Reunião sem lead_id mas com negócio: a pessoa/empresa vem do lead do negócio.
const leadDoNegocio = alias(leads, "lead_do_negocio");
const empresaDoLeadDoNegocio = alias(empresas, "empresa_do_lead_do_negocio");

/**
 * Todas as reuniões da organização (ou só as do usuário, fora da visão gestão).
 *
 * Por que a org inteira para admin: a rota Hono /calendario/eventos escopa por
 * `responsavelId = userId` mesmo para admin, e as 305 reuniões do banco são de
 * quatro closers/SDRs — o calendário de quem gere ficaria vazio sempre. Quem é
 * closer/sdr continua vendo só as próprias.
 *
 * Sem recorte de data porque a Liga navega mês a mês inteiramente no cliente
 * (ant/prox/mini só mexem em `state.ref`; não há refetch).
 * ponytail: carga total (~300 linhas). Janela por mês quando passar de alguns milhares.
 */
export async function reunioesDaAgenda(
  organizacaoId: string,
  userId: string,
  verTudo: boolean,
): Promise<ReuniaoDaAgenda[]> {
  const filtros: SQL[] = [eq(reunioes.organizacaoId, organizacaoId)];
  if (!verTudo) filtros.push(eq(reunioes.responsavelId, userId));

  const linhas = await db
    .select({
      id: reunioes.id,
      titulo: reunioes.titulo,
      data: reunioes.data,
      duracao: reunioes.duracao,
      status: reunioes.status,
      responsavel: usuarios.nome,
      // Empresa: a cadastrada do lead, senão o texto livre do lead, senão a do negócio,
      // senão a do lead do negócio (cadastrada, depois texto livre).
      empresa: sql<string | null>`coalesce(${empresaDoLead.nome}, nullif(${leads.empresa}, ''), ${empresaDoNegocio.nome}, ${empresaDoLeadDoNegocio.nome}, nullif(${leadDoNegocio.empresa}, ''))`,
      pessoa: sql<string | null>`coalesce(${leads.nome}, ${leadDoNegocio.nome})`,
      negocioId: reunioes.negocioId,
      negocioTitulo: negocios.titulo,
      notas: reunioes.notas,
    })
    .from(reunioes)
    .leftJoin(usuarios, eq(usuarios.id, reunioes.responsavelId))
    .leftJoin(leads, eq(leads.id, reunioes.leadId))
    .leftJoin(empresaDoLead, eq(empresaDoLead.id, leads.empresaId))
    .leftJoin(negocios, eq(negocios.id, reunioes.negocioId))
    .leftJoin(empresaDoNegocio, eq(empresaDoNegocio.id, negocios.empresaId))
    .leftJoin(leadDoNegocio, eq(leadDoNegocio.id, negocios.leadId))
    .leftJoin(empresaDoLeadDoNegocio, eq(empresaDoLeadDoNegocio.id, leadDoNegocio.empresaId))
    .where(and(...filtros))
    .orderBy(asc(reunioes.data));

  return linhas.map((l) => ({ ...l, data: l.data.toISOString() }));
}

/** Uma atividade (`tarefas`) com prazo, na forma que o calendário desenha. */
export interface TarefaDaAgenda {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  prioridade: string | null;
  /** Prazo com hora (ISO) quando existe; senão só o dia (YYYY-MM-DD). */
  venceEm: string | null;
  dataVencimento: string | null;
  responsavel: string | null;
  empresa: string | null;
  pessoa: string | null;
  descricao: string | null;
}

/**
 * As atividades do usuário com prazo, para o calendário mostrar a MESMA tabela
 * que a tela de Atividades (uma estrutura só). Só as do próprio usuário: o
 * calendário já filtra por responsável, e a lista da org inteira poluiria o mês.
 * ponytail: janela fixa de -90/+180 dias; passa a ser pedida por mês se crescer.
 */
export async function tarefasDaAgenda(organizacaoId: string, userId: string): Promise<TarefaDaAgenda[]> {
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT t.id::text, t.titulo, t.tipo, t.status, t.prioridade,
           t.vence_em::text AS "venceEm", t.data_vencimento::text AS "dataVencimento",
           u.nome AS responsavel,
           coalesce(e.nome, el.nome, nullif(l.empresa, '')) AS empresa,
           nullif(trim(coalesce(l.nome, '') || ' ' || coalesce(l.sobrenome, '')), '') AS pessoa,
           t.descricao
      FROM tarefas t
      LEFT JOIN usuarios u ON u.id = t.usuario_id
      LEFT JOIN leads l ON l.id = t.lead_id
      LEFT JOIN empresas e ON e.id = t.empresa_id
      LEFT JOIN empresas el ON el.id = l.empresa_id
     WHERE t.organizacao_id = ${organizacaoId}::uuid
       AND t.usuario_id = ${userId}::uuid
       AND coalesce(t.vence_em::date, t.data_vencimento) BETWEEN current_date - 90 AND current_date + 180
     ORDER BY coalesce(t.vence_em, t.data_vencimento::timestamptz)
     LIMIT 1500`);
  return linhas as unknown as TarefaDaAgenda[];
}
