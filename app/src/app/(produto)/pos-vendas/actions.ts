"use server";

/**
 * Commands do painel de Onboarding.
 *
 * Server actions, e não `fetch` para /api/fulfillments: em produção o /api é
 * servido pelo Hono, em dev pelo Next, e chamar do cliente reabre o problema
 * dos dois servidores. A regra é a MESMA das rotas Hono de fulfillments.ts;
 * onde a rota tinha um helper privado (recalcularStatusMacro), ele é repetido
 * aqui em SQL, com o mesmo critério.
 */
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { entregarParaImplantacao } from "@/lib/pos-venda/handoff-implantacao";
import { ehImplantacao } from "@/lib/crm/politica-familia";
import type { MotivoDaEspera } from "@/lib/pos-venda/contrato";
import { acoes, type Ator } from "./fonte";

export type ResultadoOnb = { ok: true; msg?: string } | { ok: false; erro: string };

const ROTA = "/pos-vendas";

/** Mesmo critério de `recalcularStatusMacro` (api-server/routes/fulfillments.ts). */
async function recalcularStatus(fulfillmentId: string) {
  await db.execute(sql`
    UPDATE fulfillments f SET updated_at = now(), status = (
      SELECT CASE
        WHEN count(*) > 0 AND bool_and(status IN ('DONE','NOT_APPLICABLE')) THEN 'READY_FOR_VALIDATION'
        WHEN bool_or(status = 'BLOCKED') THEN 'BLOCKED_' || coalesce((array_agg(blocker_type) FILTER (WHERE status = 'BLOCKED'))[1], 'INTERNAL')
        WHEN bool_or(status IN ('IN_PROGRESS','DONE','VALIDATION')) THEN 'IN_PROGRESS'
        ELSE 'NOT_STARTED' END
      FROM fulfillment_itens WHERE fulfillment_id = f.id)
    WHERE f.id = ${fulfillmentId}::uuid`);
}

export async function acaoConcluirItem(itemId: string): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  try {
    const [it] = await db.execute<{ fulfillment_id: string }>(sql`
      UPDATE fulfillment_itens
         SET status = 'DONE', completed_at = now(), completed_by = ${ctx.userId}::uuid, updated_at = now(),
             blocker_type = NULL, blocker_reason = NULL, blocker_impact = NULL, blocked_at = NULL
       WHERE id = ${itemId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
       RETURNING fulfillment_id::text`);
    if (!it) return { ok: false, erro: "Tarefa não encontrada." };
    await recalcularStatus(it.fulfillment_id);
    revalidatePath(ROTA);
    return { ok: true };
  } catch (e) {
    console.error("[pos-vendas] concluir item falhou:", e);
    return { ok: false, erro: "Não consegui concluir a tarefa. Tente de novo." };
  }
}

/** Handoff Onboarding → Implantação. O gate é do command, não da tela. */
export async function acaoHandoff(fulfillmentId: string, implantadorId: string | null): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  try {
    const r = await entregarParaImplantacao({
      organizacaoId: ctx.organizacaoId, fulfillmentId, implantadorId, atorId: ctx.userId,
    });
    if (!r.ok) return { ok: false, erro: r.erro ?? "Handoff recusado." };
    revalidatePath(ROTA);
    return { ok: true, msg: r.jaExistia ? "A implantação deste serviço já existia." : undefined };
  } catch (e) {
    console.error("[pos-vendas] handoff falhou:", e);
    return { ok: false, erro: "Não consegui fazer o handoff. Tente de novo." };
  }
}

/** Concluir onboarding (Callface AI → CS). Mesma regra de PATCH /fulfillments/:id/concluir. */
export async function acaoConcluirOnboarding(fulfillmentId: string): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  try {
    const [f] = await db.execute<{ status: string; service_family: string; lead_id: string | null }>(sql`
      SELECT f.status, f.service_family, sc.lead_id::text
        FROM fulfillments f JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
       WHERE f.id = ${fulfillmentId}::uuid AND f.organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!f) return { ok: false, erro: "Projeto não encontrado." };
    if (f.status !== "READY_FOR_VALIDATION") {
      return { ok: false, erro: "Ainda há itens do checklist pendentes — conclua ou marque como não aplicável antes de concluir." };
    }
    await db.execute(sql`
      UPDATE fulfillments SET status = 'COMPLETED', completed_at = now(), updated_at = now()
       WHERE id = ${fulfillmentId}::uuid`);
    if (f.lead_id) {
      const pabxOuWl = ehImplantacao(f.service_family as string | null);
      const rotulo = pabxOuWl ? "Implantação concluída" : "Onboarding concluído";
      await db.execute(sql`
        INSERT INTO atividades (organizacao_id, lead_id, usuario_id, tipo, titulo, descricao, dados)
        SELECT ${ctx.organizacaoId}::uuid, ${f.lead_id}::uuid, ${ctx.userId}::uuid,
               ${pabxOuWl ? "implantacao_concluida" : "onboarding_concluido"}, ${rotulo},
               ${rotulo} || ' por ' || coalesce((SELECT nome FROM usuarios WHERE id = ${ctx.userId}::uuid), 'usuário') || '.',
               ${JSON.stringify({ fulfillmentId })}::jsonb`);
    }
    revalidatePath(ROTA);
    return { ok: true };
  } catch (e) {
    console.error("[pos-vendas] concluir onboarding falhou:", e);
    return { ok: false, erro: "Não consegui concluir o onboarding. Tente de novo." };
  }
}

/** Nota do projeto: vira `atividades` com `dados.fulfillmentId` (é o elo que a timeline do projeto já lê). */
export async function acaoNotaDoProjeto(fulfillmentId: string, texto: string): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  const t = texto.trim();
  if (!t) return { ok: false, erro: "Escreva a nota antes de salvar." };
  try {
    const [f] = await db.execute<{ lead_id: string | null; empresa_id: string | null }>(sql`
      SELECT sc.lead_id::text, sc.empresa_id::text
        FROM fulfillments f JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
       WHERE f.id = ${fulfillmentId}::uuid AND f.organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!f) return { ok: false, erro: "Projeto não encontrado." };
    await db.execute(sql`
      INSERT INTO atividades (organizacao_id, lead_id, empresa_id, usuario_id, tipo, titulo, descricao, dados)
      VALUES (${ctx.organizacaoId}::uuid, ${f.lead_id}::uuid, ${f.empresa_id}::uuid, ${ctx.userId}::uuid, 'nota_projeto',
              ${"Nota: " + (t.length > 90 ? t.slice(0, 90) + "…" : t)}, ${t},
              ${JSON.stringify({ fulfillmentId })}::jsonb)`);
    revalidatePath(`/projetos/${fulfillmentId}`);
    return { ok: true };
  } catch (e) {
    console.error("[pos-vendas] nota do projeto falhou:", e);
    return { ok: false, erro: "Não consegui salvar a nota. Tente de novo." };
  }
}

/** Libera o bloqueio do projeto: itens BLOCKED voltam a PENDING e o status macro é recalculado. */
export async function acaoLiberarBloqueio(fulfillmentId: string): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  try {
    const r = await db.execute<{ id: string }>(sql`
      UPDATE fulfillment_itens SET status = 'PENDING', blocker_type = NULL, blocker_reason = NULL,
             blocker_impact = NULL, blocked_at = NULL, updated_at = now()
       WHERE fulfillment_id = ${fulfillmentId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid AND status = 'BLOCKED'
       RETURNING id::text`);
    if (!r.length) return { ok: false, erro: "Este projeto não tem bloqueio aberto." };
    await recalcularStatus(fulfillmentId);
    await db.execute(sql`
      INSERT INTO atividades (organizacao_id, usuario_id, tipo, titulo, descricao, dados)
      VALUES (${ctx.organizacaoId}::uuid, ${ctx.userId}::uuid, 'bloqueio_liberado', 'Bloqueio resolvido',
              ${r.length + (r.length > 1 ? " tarefas desbloqueadas" : " tarefa desbloqueada")}, ${JSON.stringify({ fulfillmentId })}::jsonb)`);
    revalidatePath(ROTA); revalidatePath(`/projetos/${fulfillmentId}`);
    return { ok: true };
  } catch (e) {
    console.error("[pos-vendas] liberar bloqueio falhou:", e);
    return { ok: false, erro: "Não consegui liberar o bloqueio." };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TELAS NOVAS DO PÓS-VENDA (`/pos-vendas` e `/pos-vendas/[id]`)
//
// Tudo abaixo conversa com `./fonte`, a costura única com o motor. As ações
// acima (`acaoConcluirItem` e companhia) são do painel antigo e saem junto com
// `OnboardingProto`/`ProjetoProto` quando as telas novas forem ligadas.
//
// Toda ação devolve `ResultadoOnb`, nunca lança: a tela mostra o motivo.
// ─────────────────────────────────────────────────────────────────────────

const ID = /^[\w-]{1,64}$/;
const MOTIVOS: readonly MotivoDaEspera[] = ["cliente", "operadora", "interno"];

/**
 * O ator vai inteiro para a ação, não só a organização: as portas canônicas
 * precisam de QUEM agiu para publicar o evento de domínio, avisar o
 * responsável novo e conferir permissão. Passar só a organização perdia os três.
 */
async function comProjeto(
  projetoId: string,
  executar: (ator: Ator) => Promise<{ ok: true } | { ok: false; erro: string }>,
): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  if (!ID.test(projetoId)) return { ok: false, erro: "Projeto inválido." };
  try {
    const r = await executar({ organizacaoId: ctx.organizacaoId, userId: ctx.userId, userRole: ctx.userRole });
    if (!r.ok) return { ok: false, erro: r.erro };
    revalidatePath(`${ROTA}/${projetoId}`);
    revalidatePath(ROTA);
    return { ok: true };
  } catch (e) {
    console.error("[pos-vendas] ação do projeto falhou:", e);
    return { ok: false, erro: "Não consegui concluir a ação. Tente de novo." };
  }
}

export async function pvConcluirTarefa(projetoId: string, tarefaId: string) {
  return comProjeto(projetoId, (a) => acoes.concluirTarefa(a, projetoId, tarefaId));
}
export async function pvReabrirTarefa(projetoId: string, tarefaId: string) {
  return comProjeto(projetoId, (a) => acoes.reabrirTarefa(a, projetoId, tarefaId));
}
export async function pvMarcarItem(projetoId: string, itemId: string, feito: boolean) {
  return comProjeto(projetoId, (a) => acoes.marcarItem(a, projetoId, itemId, feito));
}
export async function pvAtribuirTarefa(projetoId: string, tarefaId: string, usuarioId: string | null) {
  return comProjeto(projetoId, (a) => acoes.atribuirTarefa(a, projetoId, tarefaId, usuarioId));
}
/** `dia` chega como AAAA-MM-DD do calendário de São Paulo. Meio-dia UTC-3 cai no mesmo dia em qualquer fuso. */
export async function pvRemarcarTarefa(projetoId: string, tarefaId: string, dia: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, erro: "Data inválida." } satisfies ResultadoOnb;
  const venceEm = new Date(`${dia}T12:00:00-03:00`);
  if (Number.isNaN(venceEm.getTime())) return { ok: false, erro: "Data inválida." } satisfies ResultadoOnb;
  return comProjeto(projetoId, (a) => acoes.remarcarTarefa(a, projetoId, tarefaId, venceEm));
}

// ── Responsável e prazo DO PROJETO ───────────────────────────────────────
// A tela fecha o `projetoId` e passa só o resto, como nas ações de tarefa.

export async function pvAtribuirProjeto(projetoId: string, usuarioId: string | null) {
  if (usuarioId != null && !ID.test(usuarioId)) return { ok: false, erro: "Responsável inválido." } satisfies ResultadoOnb;
  return comProjeto(projetoId, (a) => acoes.atribuirProjeto(a, projetoId, usuarioId));
}

/**
 * `dia` chega como AAAA-MM-DD do calendário de São Paulo, igual à remarcação de
 * tarefa; `null` apaga o prazo. Meio-dia UTC-3 cai no mesmo dia em qualquer
 * fuso, então o prazo que a pessoa escolheu é o que ela vê de volta.
 */
export async function pvEditarPrazoProjeto(projetoId: string, dia: string | null) {
  if (dia == null) return comProjeto(projetoId, (a) => acoes.editarPrazoProjeto(a, projetoId, null));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, erro: "Data inválida." } satisfies ResultadoOnb;
  const venceEm = new Date(`${dia}T12:00:00-03:00`);
  if (Number.isNaN(venceEm.getTime())) return { ok: false, erro: "Data inválida." } satisfies ResultadoOnb;
  return comProjeto(projetoId, (a) => acoes.editarPrazoProjeto(a, projetoId, venceEm));
}

export async function pvMarcarEspera(projetoId: string, motivo: MotivoDaEspera, detalhe: string) {
  if (!MOTIVOS.includes(motivo)) return { ok: false, erro: "Diga quem está com a bola." } satisfies ResultadoOnb;
  return comProjeto(projetoId, (a) => acoes.marcarEspera(a, projetoId, motivo, detalhe.trim().slice(0, 300) || null));
}
export async function pvEncerrarEspera(projetoId: string) {
  return comProjeto(projetoId, (a) => acoes.encerrarEspera(a, projetoId));
}
export async function pvAdicionarNota(projetoId: string, texto: string) {
  const t = texto.trim();
  if (!t) return { ok: false, erro: "Escreva a nota antes de salvar." } satisfies ResultadoOnb;
  return comProjeto(projetoId, (a) => acoes.adicionarNota(a, projetoId, t.slice(0, 4000)));
}
export async function pvSalvarLevantamento(
  projetoId: string,
  campos: {
    perfilDeUso: string | null;
    crmQueUsa: string | null;
    objetivoComACallface: string | null;
    extras: Array<{ chave: string; rotulo: string; valor: string | null }>;
  },
) {
  const limpo = (v: string | null) => (v && v.trim() ? v.trim().slice(0, 500) : null);
  return comProjeto(projetoId, (a) =>
    acoes.salvarLevantamento(a, projetoId, {
      perfilDeUso: limpo(campos.perfilDeUso),
      crmQueUsa: limpo(campos.crmQueUsa),
      objetivoComACallface: limpo(campos.objetivoComACallface),
      extras: campos.extras.slice(0, 30).map((e) => ({ chave: e.chave.slice(0, 64), rotulo: e.rotulo.slice(0, 120), valor: limpo(e.valor) })),
    }),
  );
}
export async function pvEnviarFormulario(projetoId: string) {
  return comProjeto(projetoId, (a) => acoes.enviarFormulario(a, projetoId));
}
export async function pvEscalarParaImplantacao(projetoId: string) {
  return comProjeto(projetoId, (a) => acoes.escalarParaImplantacao(a, projetoId));
}
export async function pvFazerHandoff(projetoId: string) {
  return comProjeto(projetoId, (a) => acoes.fazerHandoff(a, projetoId));
}
