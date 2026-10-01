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
