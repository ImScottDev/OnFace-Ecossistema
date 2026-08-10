import { Hono } from "hono";
import { db } from "@/lib/db";
import { reunioes, usuarios, leads, negocios, empresas, emailContas } from "@/lib/db/schema";
import { eq, and, or, gte, lte, ne, sql, asc, inArray } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { isAdminView } from "@/lib/auth/roles";
import { getBusyTimes } from "@/lib/email/microsoft";

const app = new Hono();

/**
 * Central de Calendário (CRM 2.0, Figma nós 79:*) — mês/semana/dia/equipe
 * sobre `reunioes` real. Não depende de nenhuma view nova de banco: tudo
 * aqui é leitura direta, o dado é o mesmo que `/agenda` e o board já usam.
 */

const EVENTO_SELECT = {
  id: reunioes.id,
  negocioId: reunioes.negocioId,
  leadId: reunioes.leadId,
  titulo: reunioes.titulo,
  data: reunioes.data,
  duracao: reunioes.duracao,
  tipo: reunioes.tipo,
  status: reunioes.status,
  link: reunioes.link,
  responsavelId: reunioes.responsavelId,
  responsavelNome: usuarios.nome,
  leadNome: leads.nome,
  empresaNome: empresas.nome,
  empresaLegacy: leads.empresa,
  negocioTitulo: negocios.titulo,
  negocioValor: negocios.valorTotal,
};

function scopeResponsavel(ctx: Awaited<ReturnType<typeof getCtx>>, responsavelIdQuery: string | null) {
  const isAdmin = isAdminView(ctx.userRole);
  if (responsavelIdQuery && isAdmin) return responsavelIdQuery;
  return ctx.userId;
}

// ─── GET /calendario/eventos ─────────────────────────────────────────
app.get("/calendario/eventos", async (c) => {
  const ctx = await getCtx(c);
  const from = c.req.query("from");
  const to = c.req.query("to");
  const responsavelIdQuery = c.req.query("responsavelId") ?? null;
  const tipo = c.req.query("tipo") ?? null;
  const status = c.req.query("status") ?? null;
  if (!from || !to) return c.json({ error: "Informe from e to" }, 400);

  const responsavelId = scopeResponsavel(ctx, responsavelIdQuery);

  const conditions = [
    eq(reunioes.organizacaoId, ctx.organizacaoId),
    eq(reunioes.responsavelId, responsavelId),
    gte(reunioes.data, new Date(from)),
    lte(reunioes.data, new Date(to)),
  ];
  if (tipo) conditions.push(eq(reunioes.tipo, tipo));
  if (status) conditions.push(eq(reunioes.status, status));

  const rows = await db
    .select(EVENTO_SELECT)
    .from(reunioes)
    .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
    .leftJoin(leads, eq(reunioes.leadId, leads.id))
    .leftJoin(empresas, eq(leads.empresaId, empresas.id))
    .leftJoin(negocios, eq(reunioes.negocioId, negocios.id))
    .where(and(...conditions))
    .orderBy(asc(reunioes.data));

  return c.json(rows.map((r) => ({ ...r, empresaNome: r.empresaNome ?? r.empresaLegacy ?? null })));
});

// ─── GET /calendario/resumo — próximos, atrasados, conflitos reais ──
app.get("/calendario/resumo", async (c) => {
  const ctx = await getCtx(c);
  const responsavelIdQuery = c.req.query("responsavelId") ?? null;
  const responsavelId = scopeResponsavel(ctx, responsavelIdQuery);
  const agora = new Date();
  const daqui7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [proximos, atrasados] = await Promise.all([
    db
      .select(EVENTO_SELECT)
      .from(reunioes)
      .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
      .leftJoin(leads, eq(reunioes.leadId, leads.id))
      .leftJoin(empresas, eq(leads.empresaId, empresas.id))
      .leftJoin(negocios, eq(reunioes.negocioId, negocios.id))
      .where(and(
        eq(reunioes.organizacaoId, ctx.organizacaoId),
        eq(reunioes.responsavelId, responsavelId),
        eq(reunioes.status, "agendada"),
        gte(reunioes.data, agora),
        lte(reunioes.data, daqui7dias),
      ))
      .orderBy(asc(reunioes.data))
      .limit(10),
    db
      .select(EVENTO_SELECT)
      .from(reunioes)
      .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
      .leftJoin(leads, eq(reunioes.leadId, leads.id))
      .leftJoin(empresas, eq(leads.empresaId, empresas.id))
      .leftJoin(negocios, eq(reunioes.negocioId, negocios.id))
      .where(and(
        eq(reunioes.organizacaoId, ctx.organizacaoId),
        eq(reunioes.responsavelId, responsavelId),
        eq(reunioes.status, "agendada"),
        sql`${reunioes.data} < ${agora.toISOString()}`,
      ))
      .orderBy(asc(reunioes.data))
      .limit(10),
  ]);

  // Conflito real: dois eventos "agendada" do mesmo responsável cujos
  // intervalos [data, data+duracao] se cruzam. Duração ausente = 30min
  // (mesmo default usado na criação do evento no Outlook).
  const conflitos = await db.execute(sql`
    SELECT a.id AS a_id, a.titulo AS a_titulo, a.data AS a_data,
           b.id AS b_id, b.titulo AS b_titulo, b.data AS b_data
    FROM reunioes a
    JOIN reunioes b ON a.responsavel_id = b.responsavel_id AND a.id < b.id
    WHERE a.organizacao_id = ${ctx.organizacaoId}
      AND a.responsavel_id = ${responsavelId}
      AND a.status = 'agendada' AND b.status = 'agendada'
      AND a.data < ${daqui7dias.toISOString()}::timestamptz
      AND b.data >= ${agora.toISOString()}::timestamptz
      AND a.data < (b.data + (COALESCE(b.duracao, 30) || ' minutes')::interval)
      AND b.data < (a.data + (COALESCE(a.duracao, 30) || ' minutes')::interval)
    LIMIT 10
  `);

  return c.json({
    proximos: proximos.map((r) => ({ ...r, empresaNome: r.empresaNome ?? r.empresaLegacy ?? null })),
    atrasados: atrasados.map((r) => ({ ...r, empresaNome: r.empresaNome ?? r.empresaLegacy ?? null })),
    conflitos,
  });
});

// ─── GET /calendario/equipe — visão agregada real (admin) ───────────
// Reuniões do CRM (reais, com título/contexto) + blocos "Ocupado" do
// Outlook de quem já conectou a própria conta (token de cada um, sem
// precisar de nenhum consentimento cross-user — ver ADR). Quem não
// conectou aparece só com o que o CRM registrou.
app.get("/calendario/equipe", async (c) => {
  const ctx = await getCtx(c);
  if (!isAdminView(ctx.userRole)) return c.json({ error: "Sem permissão" }, 403);

  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) return c.json({ error: "Informe from e to" }, 400);

  const membros = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role, avatarUrl: usuarios.avatarUrl })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true), ne(usuarios.role, "leitor")));

  const membroIds = membros.map((m) => m.id);
  if (membroIds.length === 0) return c.json({ membros: [], eventos: [] });

  const [eventos, contas] = await Promise.all([
    db
      .select(EVENTO_SELECT)
      .from(reunioes)
      .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
      .leftJoin(leads, eq(reunioes.leadId, leads.id))
      .leftJoin(empresas, eq(leads.empresaId, empresas.id))
      .leftJoin(negocios, eq(reunioes.negocioId, negocios.id))
      .where(and(
        eq(reunioes.organizacaoId, ctx.organizacaoId),
        inArray(reunioes.responsavelId, membroIds),
        gte(reunioes.data, new Date(from)),
        lte(reunioes.data, new Date(to)),
        ne(reunioes.status, "cancelada"),
      ))
      .orderBy(asc(reunioes.data)),
    db
      .select({ id: emailContas.id, usuarioId: emailContas.usuarioId })
      .from(emailContas)
      .where(and(inArray(emailContas.usuarioId, membroIds), eq(emailContas.tipo, "microsoft"), eq(emailContas.syncStatus, "active"))),
  ]);

  // Blocos "Ocupado" reais do Outlook — só de quem conectou, best-effort
  // (token expirado de um closer não derruba os outros).
  const ocupadoPorMembro: Record<string, { inicio: string; fim: string }[]> = {};
  await Promise.all(
    contas.map(async (conta) => {
      try {
        const busy = await getBusyTimes(conta.id, from, to);
        ocupadoPorMembro[conta.usuarioId!] = busy.map((b) => ({ inicio: b.inicio.toISOString(), fim: b.fim.toISOString() }));
      } catch {
        ocupadoPorMembro[conta.usuarioId!] = [];
      }
    })
  );

  return c.json({
    membros: membros.map((m) => ({ ...m, outlookConectado: contas.some((cta) => cta.usuarioId === m.id) })),
    eventos: eventos.map((r) => ({ ...r, empresaNome: r.empresaNome ?? r.empresaLegacy ?? null })),
    ocupadoPorMembro,
  });
});

export const calendarioRoutes = app;
