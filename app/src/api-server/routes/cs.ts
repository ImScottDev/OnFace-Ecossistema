/**
 * API do módulo CS.
 *
 * Complementa `clientes-crm2.ts` (que já entrega Carteira e Cliente 360)
 * com o que é operação de Customer Success: fila de ação, jornada, risco,
 * renovação, expansão e churn. Nada aqui recalcula MRR, serviço ou
 * entrega — isso continua vindo de `servicos_canonicos` e `fulfillments`.
 */
import { Hono } from "hono";
import { db } from "@/lib/db";
import {
  csMarcos, csRiscos, csRenovacoes, csCancelamentos, clientes, empresas,
  tarefas, usuarios, servicosCanonicos, negocios, atividades, contratos, leads,
} from "@/lib/db/schema";
import { and, eq, desc, sql, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { temPermissao } from "@/lib/auth/permissoes";
import { montarFila, pulsoCarteira, type MotivoFila } from "@/lib/cs/fila";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { iniciarJornadaCs, cicloAtual } from "@/lib/cs/jornada";
import {
  PLAYBOOK_RELACIONAMENTO, CHECKLIST_RENOVACAO, definicaoMarco, rotuloRegua,
  QUESTIONARIO_HEALTH_CHECK, SCRIPT_HEALTH_CHECK, SCRIPTS_OPERACIONAIS,
} from "@/lib/cs/playbooks";
import { marcarRiscoManual, resolverRisco, ROTULO_RISCO, type Severidade } from "@/lib/cs/riscos";
import { executarCheckpoint } from "@/lib/cs/checkpoint";
import { registrarHealthCheck, historicoHealthCheck } from "@/lib/cs/health-check";
import { billingDaConta } from "@/lib/cs/billing";
import { metricasCs } from "@/lib/cs/metricas";
import { agendaCs } from "@/lib/cs/agenda";
import { painelCs } from "@/lib/cs/painel";
import { decidirRenovacao } from "@/lib/cs/renovacao";
import { registrarPedidoCancelamento, pedidoEmAberto, atualizarCancelamento, MOTIVOS_CANCELAMENTO } from "@/lib/cs/cancelamento";
import { criarTarefaCs, registrarInteracao } from "@/lib/cs/tarefas";
import { rodarSweepCs } from "@/lib/cs/sweep";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// QA pós-venda 06/10: `:id` que não é uuid chegava ao Postgres e estourava 500
// ("invalid input syntax for type uuid"). Um guarda só, para todas as rotas de
// recurso por id deste arquivo, devolve 404 como qualquer id que não existe.
for (const rota of ["/cs/riscos/:id/*", "/cs/renovacoes/:id", "/cs/cancelamentos/:id", "/cs/marcos/:id/*"]) {
  app.use(rota, async (c, next) => {
    if (!UUID_RE.test(c.req.param("id") ?? "")) return c.json({ error: "Não encontrado" }, 404);
    await next();
  });
}

/** `me` como valor de responsável evita o front ter que saber o próprio id. */
function resolverResponsavel(valor: string | undefined, userId: string) {
  if (!valor) return { responsavelId: null as string | null, semDono: false };
  if (valor === "me") return { responsavelId: userId, semDono: false };
  if (valor === "sem_dono") return { responsavelId: null, semDono: true };
  return { responsavelId: UUID_RE.test(valor) ? valor : null, semDono: false };
}

// ─── Fila de ação + pulso ───────────────────────────────────────

app.get("/cs/fila", async (c) => {
  const ctx = await getCtx(c);
  const { responsavelId, semDono } = resolverResponsavel(c.req.query("responsavel"), ctx.userId);
  const motivosParam = (c.req.query("motivos") ?? "").split(",").filter(Boolean) as MotivoFila[];

  const itens = await montarFila({
    organizacaoId: ctx.organizacaoId,
    responsavelId,
    semDono,
    motivos: motivosParam.length ? motivosParam : undefined,
    limite: Math.min(Number(c.req.query("limite") ?? 200), 500),
  });
  return c.json({ itens, total: itens.length });
});

app.get("/cs/pulso", async (c) => {
  const ctx = await getCtx(c);
  const { responsavelId } = resolverResponsavel(c.req.query("responsavel"), ctx.userId);
  return c.json(await pulsoCarteira(ctx.organizacaoId, responsavelId));
});

/** Usuários que podem ser CS owner — alimenta os selects de atribuição. */
app.get("/cs/usuarios", async (c) => {
  const ctx = await getCtx(c);
  const rows = await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true)))
    .orderBy(usuarios.nome);
  return c.json({ usuarios: rows });
});

// ─── Carteira / ownership ───────────────────────────────────────

/**
 * Atribuição em massa. O caso real é "acabou de entrar um CS no time,
 * distribui 40 contas" — fazer isso conta a conta na UI é inviável.
 */
const atribuirSchema = z.object({
  empresaIds: z.array(z.string().uuid()).min(1).max(500),
  responsavelId: z.string().uuid().nullable(),
});

app.post("/cs/carteira/atribuir", async (c) => {
  const ctx = await getCtx(c);
  const parsed = atribuirSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);

  // QA carteira: responsável inexistente/de outra org estourava FK em 500; agora é 400.
  if (parsed.data.responsavelId) {
    const [u] = await db.select({ id: usuarios.id }).from(usuarios)
      .where(and(eq(usuarios.id, parsed.data.responsavelId), eq(usuarios.organizacaoId, ctx.organizacaoId))).limit(1);
    if (!u) return c.json({ error: "Responsável não encontrado na organização" }, 400);
  }

  const anteriores = await db.select({ empresaId: clientes.empresaId, responsavelId: clientes.responsavelId })
    .from(clientes)
    .where(and(eq(clientes.organizacaoId, ctx.organizacaoId), inArray(clientes.empresaId, parsed.data.empresaIds)));
  const antesPorEmpresa = new Map(anteriores.map((a) => [a.empresaId, a.responsavelId]));

  // `returning` dá a contagem REAL: empresa sem linha em clientes não é atualizada
  // e antes o endpoint respondia "atualizados: N" (N pedido) e auditava a conta fantasma.
  const atualizadas = await db.update(clientes)
    // As duas colunas de dono: o 360 e a tela de CS leem COALESCE(responsavel_cs_id, responsavel_id),
    // então gravar só uma deixava a outra mandando com o nome antigo.
    .set({ responsavelId: parsed.data.responsavelId, responsavelCsId: parsed.data.responsavelId, updatedAt: new Date() })
    .where(and(eq(clientes.organizacaoId, ctx.organizacaoId), inArray(clientes.empresaId, parsed.data.empresaIds)))
    .returning({ empresaId: clientes.empresaId });
  const idsAtualizados = [...new Set(atualizadas.map((r) => r.empresaId).filter((x): x is string => !!x))];

  // Auditoria por conta, não uma linha "mexi em 40" — quem investiga depois
  // pergunta por UMA conta.
  for (const empresaId of idsAtualizados) {
    await registrarMudancaResponsavel({
      organizacaoId: ctx.organizacaoId,
      actorId: ctx.userId,
      entityType: "cliente",
      entityId: empresaId,
      previousOwnerId: antesPorEmpresa.get(empresaId) ?? null,
      newOwnerId: parsed.data.responsavelId,
    }).catch(() => {});
  }

  return c.json({ atualizados: idsAtualizados.length, ignorados: parsed.data.empresaIds.length - idsAtualizados.length });
});

// ─── Jornada / marcos ───────────────────────────────────────────

/**
 * Toda a biblioteca de playbook do módulo num lugar só. A UI consome daqui —
 * nenhum script ou pergunta é escrito dentro de componente, porque o passo
 * seguinte é tornar isto editável por organização.
 */
app.get("/cs/playbooks", (c) => c.json({
  relacionamento: PLAYBOOK_RELACIONAMENTO.map((m) => ({ ...m, rotuloRegua: rotuloRegua(m.codigo) })),
  checklistRenovacao: CHECKLIST_RENOVACAO,
  motivosCancelamento: MOTIVOS_CANCELAMENTO,
  rotulosRisco: ROTULO_RISCO,
  questionarioHealthCheck: QUESTIONARIO_HEALTH_CHECK,
  scriptHealthCheck: SCRIPT_HEALTH_CHECK,
  scriptsOperacionais: SCRIPTS_OPERACIONAIS,
}));

app.get("/cs/clientes/:empresaId/jornada", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);

  const marcos = await db.select().from(csMarcos)
    .where(and(eq(csMarcos.organizacaoId, ctx.organizacaoId), eq(csMarcos.empresaId, empresaId)))
    .orderBy(csMarcos.ciclo, csMarcos.dueDate);

  const renovacoes = await db.select({
    id: csRenovacoes.id, vencimento: csRenovacoes.vencimento, status: csRenovacoes.status,
    valorAtual: csRenovacoes.valorAtual, servicoCanonicoId: csRenovacoes.servicoCanonicoId,
    empresaId: csRenovacoes.empresaId,
    familia: servicosCanonicos.serviceFamily, produto: servicosCanonicos.canonicalProduct,
  })
    .from(csRenovacoes)
    .leftJoin(servicosCanonicos, eq(servicosCanonicos.id, csRenovacoes.servicoCanonicoId))
    .where(and(eq(csRenovacoes.organizacaoId, ctx.organizacaoId), eq(csRenovacoes.empresaId, empresaId)))
    .orderBy(csRenovacoes.vencimento);

  const [conta] = await db.select({
    responsavelId: clientes.responsavelId, entrouCarteiraEm: clientes.entrouCarteiraEm,
    jornadaIniciadaEm: clientes.jornadaIniciadaEm, observacoesCs: clientes.observacoesCs,
    csSemEvidencia: clientes.csSemEvidencia,
  }).from(clientes).where(and(eq(clientes.organizacaoId, ctx.organizacaoId), eq(clientes.empresaId, empresaId))).limit(1);

  // Agrupado por ciclo: a régua 3/6/9/12 é permanente, e o CS precisa
  // conseguir consultar o que aconteceu no ano passado sem sair da tela.
  const ciclos = [...new Set(marcos.map((m) => m.ciclo))].sort((a, b) => a - b).map((numero) => {
    const doCiclo = marcos.filter((m) => m.ciclo === numero);
    return {
      numero,
      inicio: doCiclo[0]?.dueDate ?? null,
      fim: doCiclo[doCiclo.length - 1]?.dueDate ?? null,
      encerrado: doCiclo.some((m) => m.codigo === "M12" && m.status === "CONCLUIDO"),
      marcos: doCiclo.map((m) => {
        const def = definicaoMarco(m.codigo);
        return {
          ...m,
          rotuloRegua: rotuloRegua(m.codigo),
          checklist: def?.checklist ?? [],
          perguntas: def?.perguntas ?? [],
          script: def?.script ?? null,
          sinais: def?.sinais ?? [],
        };
      }),
    };
  });

  return c.json({
    ciclos,
    cicloAtual: await cicloAtual(empresaId),
    // Achatado também, pra não quebrar quem já consumia `marcos`.
    marcos: ciclos.flatMap((c2) => c2.marcos),
    renovacoes,
    conta: conta ?? null,
  });
});

/**
 * Semear a jornada da CARTEIRA, não de uma conta por vez.
 *
 * `semearJornadaEmLote` existia desde 08/09 e **nenhuma rota ou tela a
 * expunha**. A única porta era `POST /cs/clientes/:id/jornada/iniciar`, uma
 * empresa por clique — e com 275 contas ninguém clicou 275 vezes. Medido em
 * 21/09: `cs_marcos` **vazia**, 0 de 275 clientes com jornada iniciada, e o
 * `processarMarcosVencidos` do sweep rodando sobre nada.
 *
 * `dryRun` é o padrão DE PROPÓSITO. Semear a carteira é escrita em massa e
 * decisão de operação: a rota mostra quantas contas seriam alcançadas, e só
 * grava quando o chamador pede explicitamente. `iniciarJornadaCs` é idempotente
 * por marco, então repetir só acrescenta o que falta.
 */
app.post("/cs/jornada/semear", async (c) => {
  const ctx = await getCtx(c);
  if (!(await temPermissao(
    { usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" },
    "cs.manage",
  ))) return c.json({ error: "Sem permissão para semear a jornada da carteira" }, 403);

  const corpo = await c.req.json().catch(() => ({}));
  const aplicar = corpo?.aplicar === true;
  const limite = Number.isFinite(corpo?.limite) ? Math.min(Number(corpo.limite), 1000) : undefined;
  const incluirJaIniciadas = corpo?.incluirJaIniciadas === true;

  const { semearJornadaEmLote } = await import("@/lib/cs/jornada");

  if (!aplicar) {
    // Simulação: conta os alvos pelo MESMO critério do lote, sem escrever.
    const [alvo] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM clientes
       WHERE organizacao_id = ${ctx.organizacaoId}::uuid
         AND empresa_id IS NOT NULL
         ${incluirJaIniciadas ? sql`` : sql`AND jornada_iniciada_em IS NULL`}`);
    return c.json({
      simulacao: true,
      contasAlcancadas: alvo?.n ?? 0,
      aviso: "Nada foi gravado. Repita com { aplicar: true } para semear de verdade.",
    });
  }

  const r = await semearJornadaEmLote(ctx.organizacaoId, { limite, incluirJaIniciadas });
  return c.json({ simulacao: false, ...r });
});

app.post("/cs/clientes/:empresaId/jornada/iniciar", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  return c.json(await iniciarJornadaCs(empresaId));
});

/**
 * Execução de checkpoint. É o formulário do mini-playbook: checklist,
 * respostas, sinais observados e — se a conversa produziu — health check,
 * risco, expansão e próxima ação, tudo numa transação de intenção só.
 */
const checkpointSchema = z.object({
  resultado: z.object({
    checklist: z.record(z.string(), z.boolean()).optional(),
    respostas: z.record(z.string(), z.string()).optional(),
    sinaisObservados: z.array(z.string()).optional(),
    nota: z.string().trim().max(8000).optional(),
  }).default({}),
  pular: z.boolean().optional(),
  healthCheck: z.object({
    nps: z.number().int().min(0).max(10).optional(),
    valor_percebido: z.number().int().min(1).max(5).optional(),
    adocao: z.number().int().min(1).max(5).optional(),
    satisfacao_suporte: z.number().int().min(1).max(5).optional(),
    intencao_continuidade: z.boolean().optional(),
    dificuldades: z.string().trim().max(4000).optional(),
    subir_um_ponto: z.string().trim().max(4000).optional(),
  }).nullable().optional(),
  risco: z.object({
    severidade: z.enum(["ATENCAO", "EM_RISCO", "CRITICO"]),
    motivo: z.string().trim().min(3).max(1000),
  }).nullable().optional(),
  expansao: z.object({
    titulo: z.string().trim().min(3).max(200),
    tipo: z.string().trim().max(40),
    servicoOrigemId: z.string().uuid().nullable().optional(),
    valorEstimado: z.string().nullable().optional(),
  }).nullable().optional(),
  proximaAcao: z.object({
    titulo: z.string().trim().min(2).max(200),
    venceEm: z.string().datetime(),
    prioridade: z.enum(["alta", "media", "baixa"]).optional(),
  }).nullable().optional(),
});

app.post("/cs/marcos/:id/concluir", async (c) => {
  const ctx = await getCtx(c);
  const parsed = checkpointSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);

  const saida = await executarCheckpoint({
    marcoId: c.req.param("id"),
    organizacaoId: ctx.organizacaoId,
    usuarioId: ctx.userId,
    ...parsed.data,
  });
  if (!saida) return c.json({ error: "Checkpoint não encontrado ou já registrado" }, 404);

  return c.json(saida);
});

// ─── Health check ───────────────────────────────────────────────

const healthCheckSchema = z.object({
  nps: z.number().int().min(0).max(10).optional(),
  valor_percebido: z.number().int().min(1).max(5).optional(),
  adocao: z.number().int().min(1).max(5).optional(),
  satisfacao_suporte: z.number().int().min(1).max(5).optional(),
  intencao_continuidade: z.boolean().optional(),
  dificuldades: z.string().trim().max(4000).optional(),
  subir_um_ponto: z.string().trim().max(4000).optional(),
});

app.post("/cs/clientes/:empresaId/health-check", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const parsed = healthCheckSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);
  if (Object.keys(parsed.data).length === 0) return c.json({ error: "Responda ao menos uma pergunta" }, 400);

  return c.json(await registrarHealthCheck({
    organizacaoId: ctx.organizacaoId, empresaId,
    respostas: parsed.data, registradoPor: ctx.userId,
  }), 201);
});

app.get("/cs/clientes/:empresaId/health-check", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  return c.json({ historico: await historicoHealthCheck(ctx.organizacaoId, empresaId) });
});

// ─── Billing na visão do CS ─────────────────────────────────────

/**
 * Só leitura. Mudança comercial (preço, quantidade, plano) NÃO acontece aqui:
 * vira expansão/redução → proposta → Won → serviço atualizado.
 */
app.get("/cs/clientes/:empresaId/billing", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  return c.json(await billingDaConta(ctx.organizacaoId, empresaId));
});

// ─── Agenda e métricas ──────────────────────────────────────────

app.get("/cs/agenda", async (c) => {
  const ctx = await getCtx(c);
  const { responsavelId, semDono } = resolverResponsavel(c.req.query("responsavel"), ctx.userId);
  return c.json(await agendaCs(ctx.organizacaoId, {
    responsavelId, semDono,
    dias: Math.min(Number(c.req.query("dias") ?? 7), 30),
  }));
});

/** Agregações dos blocos laterais do dashboard. Só leitura, só para a UI. */
app.get("/cs/painel", async (c) => {
  const ctx = await getCtx(c);
  const { responsavelId, semDono } = resolverResponsavel(c.req.query("responsavel"), ctx.userId);
  return c.json(await painelCs(ctx.organizacaoId, responsavelId, semDono));
});

app.get("/cs/metricas", async (c) => {
  const ctx = await getCtx(c);
  const janela = Math.min(Math.max(Number(c.req.query("janela") ?? 90), 7), 365);
  return c.json({ janelaDias: janela, metricas: await metricasCs(ctx.organizacaoId, janela) });
});

// ─── Risco ──────────────────────────────────────────────────────

// GET /cs/riscos — a carteira inteira, para a tela de Risco / Churn.
// Existia só a versão por empresa; a visão de cima não tinha rota, e por isso
// a tela era um placeholder.
app.get("/cs/riscos", async (c) => {
  const ctx = await getCtx(c);
  const { carteiraEmRisco } = await import("@/lib/cs/carteira-em-risco");
  // Closer/CS vê a própria carteira; gestão vê tudo. Mesma regra das outras
  // leituras do módulo.
  const responsavelId = c.req.query("meus") === "1" ? ctx.userId : null;
  return c.json(await carteiraEmRisco(ctx.organizacaoId, responsavelId));
});

app.get("/cs/clientes/:empresaId/riscos", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);

  const rows = await db.select({
    risco: csRiscos,
    responsavelNome: usuarios.nome,
  })
    .from(csRiscos)
    .leftJoin(usuarios, eq(usuarios.id, csRiscos.responsavelId))
    .where(and(eq(csRiscos.organizacaoId, ctx.organizacaoId), eq(csRiscos.empresaId, empresaId)))
    .orderBy(desc(csRiscos.abertoEm));

  return c.json({
    riscos: rows.map((r) => ({
      ...r.risco,
      rotulo: ROTULO_RISCO[r.risco.tipo as keyof typeof ROTULO_RISCO] ?? r.risco.tipo,
      responsavelNome: r.responsavelNome,
    })),
  });
});

const riscoManualSchema = z.object({
  severidade: z.enum(["ATENCAO", "EM_RISCO", "CRITICO"]),
  motivo: z.string().trim().min(3).max(1000),
  servicoCanonicoId: z.string().uuid().nullable().optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  prazo: z.string().datetime().nullable().optional(),
  criarTarefa: z.boolean().optional(),
});

app.post("/cs/clientes/:empresaId/riscos", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const parsed = riscoManualSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);

  const risco = await marcarRiscoManual({
    organizacaoId: ctx.organizacaoId,
    empresaId,
    servicoCanonicoId: parsed.data.servicoCanonicoId ?? null,
    severidade: parsed.data.severidade as Severidade,
    motivo: parsed.data.motivo,
    responsavelId: parsed.data.responsavelId ?? null,
    abertoPor: ctx.userId,
    criarTarefa: parsed.data.criarTarefa,
    prazo: parsed.data.prazo ? new Date(parsed.data.prazo) : null,
  });

  await registrarInteracao({
    organizacaoId: ctx.organizacaoId, empresaId, tipo: "cs_risco",
    titulo: `Risco marcado (${parsed.data.severidade})`, descricao: parsed.data.motivo,
    usuarioId: ctx.userId, dados: { riscoId: risco.id },
  });

  return c.json(risco, 201);
});

app.post("/cs/riscos/:id/resolver", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json().catch(() => ({})) as { resolucao?: string };
  if (!body.resolucao?.trim()) return c.json({ error: "Descreva como o risco foi resolvido" }, 400);

  const row = await resolverRisco(c.req.param("id"), ctx.organizacaoId, body.resolucao.trim(), ctx.userId);
  if (!row) return c.json({ error: "Risco não encontrado ou já resolvido" }, 404);

  if (row.tarefaId) {
    await db.update(tarefas).set({ concluida: true, concluidaEm: new Date() }).where(eq(tarefas.id, row.tarefaId));
  }
  await registrarInteracao({
    organizacaoId: ctx.organizacaoId, empresaId: row.empresaId, tipo: "cs_risco",
    titulo: "Risco resolvido", descricao: body.resolucao.trim(), usuarioId: ctx.userId,
    dados: { riscoId: row.id },
  });
  return c.json(row);
});

// ─── Renovação ──────────────────────────────────────────────────

app.get("/cs/renovacoes", async (c) => {
  const ctx = await getCtx(c);
  const { responsavelId } = resolverResponsavel(c.req.query("responsavel"), ctx.userId);
  const rows = await db.select({
    renovacao: csRenovacoes,
    empresaNome: empresas.nome,
    familia: servicosCanonicos.serviceFamily,
    produto: servicosCanonicos.canonicalProduct,
    responsavelNome: usuarios.nome,
    diasRestantes: sql<number>`(${csRenovacoes.vencimento} - CURRENT_DATE)::int`,
  })
    .from(csRenovacoes)
    .innerJoin(empresas, eq(empresas.id, csRenovacoes.empresaId))
    .leftJoin(servicosCanonicos, eq(servicosCanonicos.id, csRenovacoes.servicoCanonicoId))
    .leftJoin(clientes, eq(clientes.empresaId, csRenovacoes.empresaId))
    .leftJoin(usuarios, eq(usuarios.id, clientes.responsavelId))
    .where(and(
      eq(csRenovacoes.organizacaoId, ctx.organizacaoId),
      responsavelId ? eq(clientes.responsavelId, responsavelId) : undefined,
    ))
    .orderBy(csRenovacoes.vencimento);
  return c.json({ renovacoes: rows });
});

const decidirSchema = z.object({
  status: z.enum(["EM_NEGOCIACAO", "RENOVADA", "NAO_RENOVADA"]),
  valorProposto: z.string().optional().nullable(),
  novoVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  novoPrazoMeses: z.number().int().positive().optional().nullable(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  motivoNaoRenovacao: z.string().trim().max(1000).optional().nullable(),
});

app.patch("/cs/renovacoes/:id", async (c) => {
  const ctx = await getCtx(c);
  const parsed = decidirSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);
  if (parsed.data.status === "RENOVADA" && !parsed.data.novoVencimento) {
    return c.json({ error: "Renovação precisa do novo vencimento — sem ele o ciclo seguinte não abre" }, 400);
  }
  if (parsed.data.status === "NAO_RENOVADA" && !parsed.data.motivoNaoRenovacao?.trim()) {
    return c.json({ error: "Informe o motivo da não renovação" }, 400);
  }

  // QA pós-venda 06/10: decidir de novo a mesma renovação (duplo clique) regravava
  // a decisão e duplicava a interação na timeline. Mesma decisão final = 409.
  if (parsed.data.status !== "EM_NEGOCIACAO" && UUID_RE.test(c.req.param("id"))) {
    const [atual] = await db.select({ status: csRenovacoes.status }).from(csRenovacoes)
      .where(and(eq(csRenovacoes.id, c.req.param("id")), eq(csRenovacoes.organizacaoId, ctx.organizacaoId))).limit(1);
    if (atual?.status === parsed.data.status) return c.json({ error: "Renovação já decidida" }, 409);
  }

  const row = await decidirRenovacao({ id: c.req.param("id"), organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId, ...parsed.data });
  if (!row) return c.json({ error: "Renovação não encontrada" }, 404);

  await registrarInteracao({
    organizacaoId: ctx.organizacaoId, empresaId: row.empresaId, tipo: "cs_renovacao",
    titulo: `Renovação: ${row.status.toLowerCase().replace("_", " ")}`,
    descricao: parsed.data.observacoes ?? parsed.data.motivoNaoRenovacao ?? null,
    usuarioId: ctx.userId, dados: { renovacaoId: row.id, status: row.status },
  });
  return c.json(row);
});

// ─── Expansão ───────────────────────────────────────────────────

/**
 * Expansão NÃO altera serviço direto: cria uma oportunidade comercial de
 * verdade (`negocios` com commercial_motion = 'EXPANSION'), que percorre o
 * mesmo fluxo de proposta/contrato/Won. O serviço só muda depois do Won,
 * pelo motor de pós-venda que já existe.
 */
const expansaoSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  tipo: z.enum(["upgrade", "usuarios", "licencas", "minutos", "addon", "nova_familia", "hardware", "projeto"]),
  servicoOrigemId: z.string().uuid().nullable().optional(),
  valorEstimado: z.string().optional().nullable(),
  descricao: z.string().trim().max(4000).optional().nullable(),
  pipelineId: z.string().uuid().optional().nullable(),
  /** Closer que assume a expansão; vazio = quem criou. */
  responsavelId: z.string().uuid().optional().nullable(),
});

app.post("/cs/clientes/:empresaId/expansao", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const parsed = expansaoSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);

  const [empresa] = await db.select({ id: empresas.id, nome: empresas.nome })
    .from(empresas).where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!empresa) return c.json({ error: "Empresa não encontrada" }, 404);

  // Família herdada do serviço de origem — o negócio já nasce classificado,
  // que é o que o pós-venda usa depois pra decidir a trilha de entrega.
  let serviceFamily: string | null = null;
  if (parsed.data.servicoOrigemId) {
    const [s] = await db.select({ f: servicosCanonicos.serviceFamily })
      .from(servicosCanonicos).where(eq(servicosCanonicos.id, parsed.data.servicoOrigemId)).limit(1);
    serviceFamily = s?.f ?? null;
  }

  // Lead da própria empresa: o Ganho manual só gera contrato e materializa o serviço novo
  // quando o negócio tem lead. Expansão nascia com leadId NULL, então ganhava sem criar
  // contrato nem serviço (QA 06/10) e o cliente não recebia o que foi vendido.
  const [leadDaEmpresa] = await db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.empresaId, empresaId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .orderBy(desc(leads.updatedAt)).limit(1);

  let responsavelId = ctx.userId;
  if (parsed.data.responsavelId) {
    const [u] = await db.select({ id: usuarios.id }).from(usuarios)
      .where(and(eq(usuarios.id, parsed.data.responsavelId), eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true))).limit(1);
    if (!u) return c.json({ error: "Closer não encontrado na equipe" }, 400);
    responsavelId = u.id;
  }

  const [negocio] = await db.insert(negocios).values({
    organizacaoId: ctx.organizacaoId,
    empresaId,
    leadId: leadDaEmpresa?.id ?? null,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao ?? null,
    status: "reuniao_agendada",
    // Etapa canônica junto do status legado: sem ela o negócio ficava com
    // etapa NULL e sumia dos contadores/telas que filtram por etapa.
    etapa: "entrada",
    origemNegocio: "carteira",
    commercialMotion: "EXPANSION",
    servicoOrigemId: parsed.data.servicoOrigemId ?? null,
    serviceFamily,
    valorTotal: parsed.data.valorEstimado ?? null,
    responsavelId,
    pipelineId: parsed.data.pipelineId ?? null,
    camposCustom: { tipoExpansao: parsed.data.tipo, origemCs: true },
  }).returning();

  // A expansão precisa existir no canônico como qualquer outra oportunidade.
  //
  // O comentário logo acima diz o que este bloco decidiu: "expansão é
  // oportunidade comercial de verdade, nunca alteração de serviço por anotação
  // de checkpoint". Faltava a outra metade dessa frase, que é o negócio chegar
  // em `oportunidades` — sem ela, a expansão nasce só no legado e some das
  // leituras canônicas (pipeline, relatórios, política de Ganho).
  //
  // Hoje o banco tem ZERO negócios com `commercial_motion = 'EXPANSION'`: o
  // caminho nunca foi exercido. Por isso o buraco não aparece em contagem
  // nenhuma, e por isso ele é barato de fechar agora, antes do primeiro uso,
  // em vez de virar backfill depois.
  await syncOportunidadeFromNegocio(negocio.id);

  await registrarInteracao({
    organizacaoId: ctx.organizacaoId, empresaId, tipo: "cs_expansao",
    titulo: `Oportunidade de expansão criada: ${parsed.data.titulo}`,
    descricao: `Tipo: ${parsed.data.tipo}`, usuarioId: ctx.userId,
    dados: { negocioId: negocio.id, tipo: parsed.data.tipo },
  });

  return c.json({ negocio }, 201);
});

app.get("/cs/expansoes", async (c) => {
  const ctx = await getCtx(c);
  const rows = await db.select({
    id: negocios.id, titulo: negocios.titulo, status: negocios.status,
    valorTotal: negocios.valorTotal, createdAt: negocios.createdAt,
    empresaId: negocios.empresaId, empresaNome: empresas.nome,
    // Mesma cadeia do resto do produto: o legado manda onde tem valor, e o
    // canônico completa onde ele é nulo. Hoje nenhum negócio de expansão está
    // nesse caso (medido), mas deixar este leitor fora da cadeia faria o
    // próximo a copiá-lo repetir o buraco que os outros seis tinham.
    //
    // Subconsulta em vez de JOIN: bundle cria oportunidades irmãs do mesmo
    // negócio, e um JOIN duplicaria a linha da expansão.
    familia: sql<string | null>`COALESCE(${negocios.serviceFamily},
      (SELECT o.service_family FROM oportunidades o
        WHERE o.negocio_id_legado = ${negocios.id} LIMIT 1))`,
    responsavelNome: usuarios.nome,
  })
    .from(negocios)
    .innerJoin(empresas, eq(empresas.id, negocios.empresaId))
    .leftJoin(usuarios, eq(usuarios.id, negocios.responsavelId))
    .where(and(
      eq(negocios.organizacaoId, ctx.organizacaoId),
      eq(negocios.commercialMotion, "EXPANSION"),
    ))
    .orderBy(desc(negocios.createdAt))
    .limit(200);
  return c.json({ expansoes: rows });
});

// ─── Cancelamento / churn ───────────────────────────────────────

app.get("/cs/clientes/:empresaId/cancelamentos", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const rows = await db.select().from(csCancelamentos)
    .where(and(eq(csCancelamentos.organizacaoId, ctx.organizacaoId), eq(csCancelamentos.empresaId, empresaId)))
    .orderBy(desc(csCancelamentos.solicitadoEm));
  return c.json({ cancelamentos: rows });
});

const pedidoSchema = z.object({
  motivo: z.string().trim().min(1),
  motivoDetalhe: z.string().trim().max(4000).optional().nullable(),
  servicoCanonicoId: z.string().uuid().nullable().optional(),
  contratoId: z.string().uuid().nullable().optional(),
  canal: z.string().trim().max(80).optional().nullable(),
  dataDesejada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

app.post("/cs/clientes/:empresaId/cancelamentos", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const parsed = pedidoSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);
  if (parsed.data.motivo === "outro" && !parsed.data.motivoDetalhe?.trim()) {
    return c.json({ error: 'Com "Outro", o detalhe é obrigatório' }, 400);
  }

  // QA pós-venda 06/10: empresa inexistente estourava 500 (FK); serviço de outra
  // empresa/organização gravava processo apontando para dado alheio; e pedir
  // duas vezes abria dois processos e duas tarefas de retenção.
  if (!(await empresaDaOrg(ctx.organizacaoId, empresaId))) return c.json({ error: "Empresa não encontrada" }, 404);
  if (parsed.data.servicoCanonicoId) {
    const [sv] = await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos)
      .where(and(eq(servicosCanonicos.id, parsed.data.servicoCanonicoId), eq(servicosCanonicos.empresaId, empresaId), eq(servicosCanonicos.organizacaoId, ctx.organizacaoId))).limit(1);
    if (!sv) return c.json({ error: "Serviço não pertence a esta empresa" }, 404);
  }
  const jaAberto = await pedidoEmAberto(ctx.organizacaoId, empresaId, parsed.data.servicoCanonicoId ?? null);
  if (jaAberto) return c.json({ error: "Já existe um pedido de cancelamento em andamento para este serviço", id: jaAberto.id }, 409);

  // Contrato do serviço, quando não veio explícito — é o que habilita as
  // checagens de multa/vigência sem o CS ter que caçar o id.
  let contratoId = parsed.data.contratoId ?? null;
  if (!contratoId && parsed.data.servicoCanonicoId) {
    const [s] = await db.select({ c: servicosCanonicos.contratoId })
      .from(servicosCanonicos).where(eq(servicosCanonicos.id, parsed.data.servicoCanonicoId)).limit(1);
    contratoId = s?.c ?? null;
  }

  const processo = await registrarPedidoCancelamento({
    organizacaoId: ctx.organizacaoId, empresaId,
    servicoCanonicoId: parsed.data.servicoCanonicoId ?? null,
    contratoId,
    motivo: parsed.data.motivo,
    motivoDetalhe: parsed.data.motivoDetalhe ?? null,
    canal: parsed.data.canal ?? null,
    dataDesejada: parsed.data.dataDesejada ?? null,
    solicitadoPor: ctx.userId,
  });
  return c.json(processo, 201);
});

const atualizarCancelSchema = z.object({
  status: z.enum(["SOLICITADO", "EM_RETENCAO", "RETIDO", "APROVADO", "EFETIVADO"]).optional(),
  tentativaRetencao: z.string().trim().max(4000).optional().nullable(),
  ofertaRetencao: z.string().trim().max(4000).optional().nullable(),
  equipamentosPendentes: z.string().trim().max(2000).optional().nullable(),
  dataEfetiva: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  motivoFinal: z.string().trim().max(120).optional().nullable(),
  motivoFinalDetalhe: z.string().trim().max(4000).optional().nullable(),
});

app.patch("/cs/cancelamentos/:id", async (c) => {
  const ctx = await getCtx(c);
  const parsed = atualizarCancelSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);
  if (parsed.data.status === "EFETIVADO" && !parsed.data.motivoFinal) {
    return c.json({ error: "Registre o motivo final antes de efetivar o cancelamento" }, 400);
  }
  const row = await atualizarCancelamento({ id: c.req.param("id"), organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId, ...parsed.data });
  if (!row) return c.json({ error: "Processo não encontrado" }, 404);
  return c.json(row);
});

// ─── Tarefas e interações no eixo do cliente ────────────────────

app.get("/cs/clientes/:empresaId/tarefas", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);

  const rows = await db.select({
    tarefa: tarefas, responsavelNome: usuarios.nome,
  })
    .from(tarefas)
    .leftJoin(usuarios, eq(usuarios.id, tarefas.usuarioId))
    .where(and(eq(tarefas.organizacaoId, ctx.organizacaoId), eq(tarefas.empresaId, empresaId)))
    .orderBy(sql`${tarefas.concluida} ASC, ${tarefas.venceEm} ASC NULLS LAST`)
    .limit(200);
  return c.json({ tarefas: rows.map((r) => ({ ...r.tarefa, responsavelNome: r.responsavelNome })) });
});

const novaTarefaSchema = z.object({
  titulo: z.string().trim().min(2).max(200),
  descricao: z.string().trim().max(4000).optional().nullable(),
  tipo: z.string().trim().max(60).default("cs_followup"),
  prioridade: z.enum(["alta", "media", "baixa"]).default("media"),
  venceEm: z.string().datetime().optional().nullable(),
  usuarioId: z.string().uuid().optional().nullable(),
  servicoCanonicoId: z.string().uuid().optional().nullable(),
});

/**
 * QA pós-venda 06/10: empresa inexistente (ou de outra organização) estourava
 * 500 por violação de FK no insert. A empresa precisa ser da organização do
 * usuário, e o erro correto é 404.
 */
async function empresaDaOrg(organizacaoId: string, empresaId: string): Promise<boolean> {
  const [e] = await db.select({ id: empresas.id }).from(empresas)
    .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, organizacaoId))).limit(1);
  return !!e;
}

app.post("/cs/clientes/:empresaId/tarefas", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const parsed = novaTarefaSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);
  if (!(await empresaDaOrg(ctx.organizacaoId, empresaId))) return c.json({ error: "Empresa não encontrada" }, 404);

  const { id } = await criarTarefaCs({
    organizacaoId: ctx.organizacaoId, empresaId,
    titulo: parsed.data.titulo, descricao: parsed.data.descricao ?? null,
    tipo: parsed.data.tipo, origem: "MANUAL", prioridade: parsed.data.prioridade,
    venceEm: parsed.data.venceEm ? new Date(parsed.data.venceEm) : null,
    usuarioId: parsed.data.usuarioId ?? ctx.userId,
    servicoCanonicoId: parsed.data.servicoCanonicoId ?? null,
  });
  return c.json({ id }, 201);
});

/**
 * Concluir tarefa registra na timeline e, opcionalmente, já cria a próxima
 * ação — é o momento natural de decidir o próximo passo, e é o que impede
 * a conta de cair em "sem próxima ação" no sweep seguinte.
 */
const concluirTarefaSchema = z.object({
  nota: z.string().trim().max(4000).optional(),
  proximaAcao: z.object({
    titulo: z.string().trim().min(2).max(200),
    venceEm: z.string().datetime(),
    prioridade: z.enum(["alta", "media", "baixa"]).default("media"),
  }).optional(),
});

app.post("/cs/tarefas/:id/concluir", async (c) => {
  const ctx = await getCtx(c);
  const parsed = concluirTarefaSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400);

  const tarefaId = c.req.param("id");
  if (!UUID_RE.test(tarefaId)) return c.json({ error: "Tarefa não encontrada" }, 404);

  // QA pós-venda 06/10: concluir duas vezes (duplo clique, retry) gravava a
  // interação e criava a próxima ação em duplicidade. Só a primeira conclusão
  // age: o UPDATE exige `concluida = false`; a segunda devolve 409 sem efeito.
  const [tarefa] = await db.update(tarefas)
    .set({ concluida: true, concluidaEm: new Date() })
    .where(and(eq(tarefas.id, tarefaId), eq(tarefas.organizacaoId, ctx.organizacaoId), eq(tarefas.concluida, false)))
    .returning();
  if (!tarefa) {
    const [existe] = await db.select({ id: tarefas.id }).from(tarefas)
      .where(and(eq(tarefas.id, tarefaId), eq(tarefas.organizacaoId, ctx.organizacaoId))).limit(1);
    return existe
      ? c.json({ error: "Tarefa já concluída" }, 409)
      : c.json({ error: "Tarefa não encontrada" }, 404);
  }

  if (tarefa.empresaId) {
    await registrarInteracao({
      organizacaoId: ctx.organizacaoId, empresaId: tarefa.empresaId, tipo: "tarefa",
      titulo: `Tarefa concluída: ${tarefa.titulo}`, descricao: parsed.data.nota ?? null,
      usuarioId: ctx.userId, dados: { tarefaId: tarefa.id, origem: tarefa.origem },
    });

    if (parsed.data.proximaAcao) {
      await criarTarefaCs({
        organizacaoId: ctx.organizacaoId, empresaId: tarefa.empresaId,
        titulo: parsed.data.proximaAcao.titulo, tipo: "cs_followup", origem: "MANUAL",
        prioridade: parsed.data.proximaAcao.prioridade,
        venceEm: new Date(parsed.data.proximaAcao.venceEm),
        usuarioId: tarefa.usuarioId ?? ctx.userId,
        servicoCanonicoId: tarefa.servicoCanonicoId,
      });
    }
  }
  return c.json(tarefa);
});

app.post("/cs/tarefas/:id/reagendar", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json().catch(() => ({})) as { venceEm?: string };
  if (!body.venceEm) return c.json({ error: "Informe a nova data" }, 400);
  const nova = new Date(body.venceEm);
  // QA pós-venda 06/10: data lixo gerava Invalid Date e `toISOString()` lançava
  // (500); id fora do formato de uuid também estourava 500 no cast do Postgres.
  if (Number.isNaN(nova.getTime())) return c.json({ error: "Data inválida" }, 400);
  if (!UUID_RE.test(c.req.param("id"))) return c.json({ error: "Tarefa não encontrada" }, 404);
  const [row] = await db.update(tarefas)
    .set({ venceEm: nova, dataVencimento: nova.toISOString().slice(0, 10) })
    .where(and(eq(tarefas.id, c.req.param("id")), eq(tarefas.organizacaoId, ctx.organizacaoId)))
    .returning();
  if (!row) return c.json({ error: "Tarefa não encontrada" }, 404);
  return c.json(row);
});

const interacaoSchema = z.object({
  tipo: z.enum(["ligacao", "reuniao", "whatsapp", "email", "nota"]),
  titulo: z.string().trim().max(200).optional().nullable(),
  descricao: z.string().trim().min(1).max(8000),
});

app.post("/cs/clientes/:empresaId/interacoes", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const parsed = interacaoSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);
  if (!(await empresaDaOrg(ctx.organizacaoId, empresaId))) return c.json({ error: "Empresa não encontrada" }, 404);

  const r = await registrarInteracao({
    organizacaoId: ctx.organizacaoId, empresaId,
    tipo: parsed.data.tipo, titulo: parsed.data.titulo ?? null,
    descricao: parsed.data.descricao, usuarioId: ctx.userId,
  });
  return c.json(r, 201);
});

/** Observações da conta — contexto que não é interação nem tarefa. */
app.patch("/cs/clientes/:empresaId/conta", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const body = await c.req.json().catch(() => ({})) as { observacoesCs?: string };
  const [row] = await db.update(clientes)
    .set({ observacoesCs: body.observacoesCs ?? null, updatedAt: new Date() })
    .where(and(eq(clientes.organizacaoId, ctx.organizacaoId), eq(clientes.empresaId, empresaId)))
    .returning();
  // Antes devolvia 200 com null para conta inexistente — a tela mostrava "salvo".
  if (!row) return c.json({ error: "Conta não encontrada" }, 404);
  return c.json(row);
});

/** Roda o sweep sob demanda — usado no teste e quando o CS quer ver o efeito agora. */
app.post("/cs/sweep", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") return c.json({ error: "Sem permissão" }, 403);
  return c.json(await rodarSweepCs(ctx.organizacaoId));
});

export const csRoutes = app;
