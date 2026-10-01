import { db } from "@/lib/db";
import { closerDisponibilidade, emailContas, organizacoes, teams, usuarios, whatsappSessao } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";

/**
 * Dados da tela /perfil, lidos no servidor.
 *
 * Por que aqui e não só o GET /api/perfil do Hono: aquele endpoint devolve
 * nome/e-mail/papel e mais nada. As conexões pessoais (caixa de e-mail,
 * WhatsApp, horário de trabalho) moram em três tabelas que a tela antiga nem
 * mostrava — ela só linkava para Ajustes sem dizer se estava conectado. A
 * escrita continua toda nos endpoints existentes do Hono (produção serve /api
 * por lá); isto é só leitura.
 *
 * Toda query filtra por organizacaoId E usuarioId: o perfil é do usuário, mas
 * o filtro de tenant fica explícito para não depender de usuarioId ser único
 * entre organizações.
 */

export type ContaEmail = {
  id: string;
  tipo: string; // google | microsoft | imap
  email: string;
  syncStatus: string; // active | paused | error
  ultimaSync: string | null;
  ultimoErro: string | null;
  padrao: boolean;
};

export type SessaoWhatsapp = {
  id: string;
  rotulo: string | null;
  status: string;
  telefone: string | null;
  ultimaConexao: string | null;
};

export type HorarioTrabalho = {
  inicio: string;
  fim: string;
  diasSemana: number[];
};

export type DadosPerfil = {
  id: string;
  nome: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  criadoEm: string;
  orgNome: string;
  orgSlug: string;
  timeNome: string | null;
  contasEmail: ContaEmail[];
  whatsapp: SessaoWhatsapp[];
  disponibilidade: {
    horarioTrabalho: HorarioTrabalho;
    pausaAlmoco: { inicio: string; fim: string } | null;
    ativo: boolean;
  } | null;
};

export async function carregarPerfil(organizacaoId: string, usuarioId: string): Promise<DadosPerfil | null> {
  const [u] = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      avatarUrl: usuarios.avatarUrl,
      criadoEm: usuarios.createdAt,
      orgNome: organizacoes.nome,
      orgSlug: organizacoes.slug,
      timeNome: teams.nome,
    })
    .from(usuarios)
    .innerJoin(organizacoes, eq(usuarios.organizacaoId, organizacoes.id))
    .leftJoin(teams, and(eq(teams.id, usuarios.teamId), eq(teams.organizacaoId, organizacaoId)))
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizacaoId, organizacaoId)))
    .limit(1);
  if (!u) return null;

  const [contas, sessoes, [disp]] = await Promise.all([
    db
      .select({
        id: emailContas.id,
        tipo: emailContas.tipo,
        email: emailContas.email,
        syncStatus: emailContas.syncStatus,
        ultimaSync: emailContas.lastSyncAt,
        ultimoErro: emailContas.lastError,
        padrao: emailContas.isDefault,
      })
      .from(emailContas)
      .where(and(eq(emailContas.organizacaoId, organizacaoId), eq(emailContas.usuarioId, usuarioId)))
      .orderBy(asc(emailContas.createdAt)),
    db
      .select({
        id: whatsappSessao.id,
        rotulo: whatsappSessao.label,
        status: whatsappSessao.status,
        telefone: whatsappSessao.phoneNumber,
        ultimaConexao: whatsappSessao.lastConnectedAt,
      })
      .from(whatsappSessao)
      .where(and(eq(whatsappSessao.organizacaoId, organizacaoId), eq(whatsappSessao.usuarioId, usuarioId))),
    db
      .select({
        horarioTrabalho: closerDisponibilidade.horarioTrabalho,
        pausaAlmoco: closerDisponibilidade.pausaAlmoco,
        ativo: closerDisponibilidade.ativo,
      })
      .from(closerDisponibilidade)
      .where(and(eq(closerDisponibilidade.organizacaoId, organizacaoId), eq(closerDisponibilidade.usuarioId, usuarioId)))
      .limit(1),
  ]);

  // Datas viram ISO aqui: o componente de cliente recebe só JSON serializável.
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl,
    criadoEm: u.criadoEm.toISOString(),
    orgNome: u.orgNome,
    orgSlug: u.orgSlug,
    timeNome: u.timeNome,
    contasEmail: contas.map((c) => ({ ...c, ultimaSync: iso(c.ultimaSync) })),
    whatsapp: sessoes.map((s) => ({ ...s, ultimaConexao: iso(s.ultimaConexao) })),
    disponibilidade: disp
      ? {
          horarioTrabalho: disp.horarioTrabalho as HorarioTrabalho,
          pausaAlmoco: (disp.pausaAlmoco as { inicio: string; fim: string } | null) ?? null,
          ativo: disp.ativo,
        }
      : null,
  };
}
