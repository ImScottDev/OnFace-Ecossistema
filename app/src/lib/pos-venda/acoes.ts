/**
 * As ações do projeto de pós-venda.
 *
 * Nada aqui escreve em `tarefas` por SQL próprio: tudo passa pelas portas
 * canônicas (`lib/tarefas/portas`, `lib/tarefas/detalhe`), que já publicam o
 * evento de domínio, avisam o novo responsável e registram a remarcação. Um
 * UPDATE direto pularia os três — e "mais um escritor sem porta" é a dívida
 * central deste repositório.
 *
 * Toda ação devolve `Resultado`, nunca lança: a tela precisa mostrar o erro,
 * e exceção crua vira modal mudo (foi o defeito do "adicionar pessoa" no
 * Cliente 360).
 *
 * Escopo: além do isolamento por organização que as portas já fazem, cada
 * ação confere que a tarefa pertence ao projeto informado. Sem isso, um id
 * de outra jornada passaria.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, tarefaSubtarefas, usuarios, notas, notificacoes, fulfillments, servicosCanonicos, empresas } from "@/lib/db/schema";
import { alterarTarefa } from "@/lib/tarefas/portas";
import { alterarSubtarefa } from "@/lib/tarefas/detalhe";
import type { Levantamento, Resultado, Usuario } from "./contrato";
import { dataDe, iniciaisDe } from "./regras";
import type { MotivoDaEspera } from "./contrato";
import { iniciarEspera, encerrarEspera } from "./espera";

export interface AtorPV {
  organizacaoId: string;
  userId: string;
  userRole: string;
}

const ator = (a: AtorPV) => ({ ...a, via: "pos-venda" });

/**
 * Exceção das portas vira mensagem legível. `RegraDeNegocio` já carrega texto
 * pronto para o usuário; o resto cai na frase genérica.
 *
 * Genérica porque o ramo de erro serve a qualquer `Resultado<T>`: sem isso,
 * uma ação que devolve dado no sucesso não aceita este retorno.
 */
function falha<T = void>(e: unknown): Resultado<T> {
  const m = e as { message?: string; codigo?: string };
  return { ok: false, erro: m?.message || "Não consegui concluir esta ação.", codigo: m?.codigo };
}

const ok = <T,>(dados: T): Resultado<T> => ({ ok: true, dados });

/**
 * A tarefa é mesmo deste projeto? Duas formas de pertencer:
 * a chave de idempotência do motor (`ORIGEM:{projeto}:{passo}`), ou o serviço
 * canônico da jornada, para as tarefas antigas que nasceram sem chave.
 */
async function tarefaDoProjeto(a: AtorPV, projetoId: string, tarefaId: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1
      FROM tarefas t
      JOIN fulfillments f ON f.id = ${projetoId}::uuid AND f.organizacao_id = ${a.organizacaoId}::uuid
     WHERE t.id = ${tarefaId}::uuid
       AND t.organizacao_id = ${a.organizacaoId}::uuid
       AND (
         t.chave_idempotencia LIKE '%:' || ${projetoId} || ':%'
         OR t.servico_canonico_id = f.servico_canonico_id
       )
     LIMIT 1`);
  return r.length > 0;
}

const FORA = { ok: false as const, erro: "Esta tarefa não pertence a este projeto." };

export async function concluirTarefa(a: AtorPV, projetoId: string, tarefaId: string): Promise<Resultado> {
  if (!(await tarefaDoProjeto(a, projetoId, tarefaId))) return FORA;
  try {
    await alterarTarefa(ator(a), tarefaId, { status: "concluida" });
    return ok(undefined);
  } catch (e) { return falha(e); }
}

export async function reabrirTarefa(a: AtorPV, projetoId: string, tarefaId: string): Promise<Resultado> {
  if (!(await tarefaDoProjeto(a, projetoId, tarefaId))) return FORA;
  try {
    await alterarTarefa(ator(a), tarefaId, { status: "a_fazer" });
    return ok(undefined);
  } catch (e) { return falha(e); }
}

/**
 * Remarcar preserva a data original: a porta publica `TaskRescheduled` com o
 * "de" e o "para", e é de lá que a linha do tempo tira a troca. Não se
 * sobrescreve prazo em silêncio.
 */
export async function remarcarTarefa(a: AtorPV, projetoId: string, tarefaId: string, venceEm: Date): Promise<Resultado> {
  if (!(await tarefaDoProjeto(a, projetoId, tarefaId))) return FORA;
  if (Number.isNaN(venceEm.getTime())) return { ok: false, erro: "Data inválida." };
  try {
    await alterarTarefa(ator(a), tarefaId, { venceEm: venceEm.toISOString() });
    return ok(undefined);
  } catch (e) { return falha(e); }
}

export async function atribuirTarefa(a: AtorPV, projetoId: string, tarefaId: string, usuarioId: string | null): Promise<Resultado> {
  if (!(await tarefaDoProjeto(a, projetoId, tarefaId))) return FORA;
  // A porta só atribui; tirar responsável não passa por ela (ela ignora null).
  if (!usuarioId) {
    try {
      await db.update(tarefas).set({ usuarioId: null })
        .where(and(eq(tarefas.id, tarefaId), eq(tarefas.organizacaoId, a.organizacaoId)));
      return ok(undefined);
    } catch (e) { return falha(e); }
  }
  try {
    await alterarTarefa(ator(a), tarefaId, { responsavelId: usuarioId });
    return ok(undefined);
  } catch (e) { return falha(e); }
}

/** O item do checklist é subtarefa. A tela manda só o id do item: a tarefa dona sai daqui. */
export async function marcarItem(a: AtorPV, projetoId: string, itemId: string, feito: boolean): Promise<Resultado> {
  const [sub] = await db.select({ tarefaId: tarefaSubtarefas.tarefaId })
    .from(tarefaSubtarefas)
    .where(and(eq(tarefaSubtarefas.id, itemId), eq(tarefaSubtarefas.organizacaoId, a.organizacaoId)))
    .limit(1);
  if (!sub) return { ok: false, erro: "Item não encontrado." };
  if (!(await tarefaDoProjeto(a, projetoId, sub.tarefaId))) return FORA;
  try {
    await alterarSubtarefa(ator(a), sub.tarefaId, itemId, { concluida: feito });
    return ok(undefined);
  } catch (e) { return falha(e); }
}

// ---------------------------------------------------------------------------
// O PROJETO: responsável e prazo
//
// As portas de tarefa não servem aqui — o alvo é `fulfillments`, não `tarefas`.
// Então estas duas repetem a disciplina de `alterarTarefa` (lib/tarefas/portas.ts)
// no projeto: carregam o estado anterior, validam, gravam uma vez, publicam o
// fato em `domain_events` com o "de" e o "para", e avisam quem passou a ser
// responsável. É de `domain_events` que a linha do tempo tira a troca
// (`timelineDoProjeto`), e é por isso que não existe UPDATE solto aqui.
// ---------------------------------------------------------------------------

type FatoDoProjeto = "ProjectReassigned" | "ProjectDeadlineSet" | "ProjectDeadlineChanged" | "ProjectDeadlineCleared";

/** O fato, no mesmo formato da porta de tarefa, com `aggregate_type = 'fulfillment'`. */
async function registrarFatoDoProjeto(a: AtorPV, projetoId: string, tipo: FatoDoProjeto, payload: Record<string, unknown>) {
  try {
    await db.execute(sql`
      INSERT INTO domain_events (organizacao_id, event_type, aggregate_type, aggregate_id, actor_type, actor_id, source, payload)
      VALUES (${a.organizacaoId}::uuid, ${tipo}, 'fulfillment', ${projetoId}::uuid, 'USER', ${a.userId}::uuid, 'pos-venda',
              ${JSON.stringify(payload)}::jsonb)`);
  } catch (e) {
    // O fato é histórico, não a escrita. Perder o registro não desfaz a troca
    // que a pessoa acabou de fazer — mas tem de aparecer no log.
    console.error(`[pos-venda] fato ${tipo} não registrado no projeto ${projetoId}:`, e);
  }
}

/** Aviso ao novo responsável. Quem se atribui a si mesmo não é avisado (já sabe). */
async function avisarResponsavelDoProjeto(a: AtorPV, usuarioId: string, projetoId: string, empresa: string | null) {
  if (usuarioId === a.userId) return;
  try {
    await db.insert(notificacoes).values({
      usuarioId,
      tipo: "projeto_atribuido",
      titulo: "Novo projeto de pós-venda para você",
      mensagem: empresa ?? "Projeto de pós-venda",
      link: `/pos-vendas/${projetoId}`,
    });
  } catch (e) { console.error("[pos-venda] falha ao notificar responsável do projeto:", e); }
}

type ProjetoEditavel = {
  status: string; responsavel_id: string | null;
  target_at: string | null; due_at: string | null; entrou_em: string | null; empresa: string | null;
};

/** O estado anterior do projeto, que também prova que ele é desta organização. Null = não existe aqui. */
async function projetoEditavel(a: AtorPV, projetoId: string): Promise<ProjetoEditavel | null> {
  const [f] = await db.execute<ProjetoEditavel>(sql`
    SELECT f.status, f.responsavel_id::text,
           to_json(f.target_at)#>>'{}' AS target_at, to_json(f.due_at)#>>'{}' AS due_at,
           to_json(COALESCE(f.started_at, f.created_at))#>>'{}' AS entrou_em,
           e.nome AS empresa
      FROM fulfillments f
      LEFT JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
      LEFT JOIN empresas e ON e.id = sc.empresa_id
     WHERE f.id = ${projetoId}::uuid AND f.organizacao_id = ${a.organizacaoId}::uuid`);
  return f ?? null;
}

const ENCERRADO = (p: ProjetoEditavel) => p.status === "COMPLETED" || p.status === "CANCELED";

/**
 * Troca o responsável do projeto. `null` remove.
 *
 * O responsável nasce da configuração por família (`playbook.responsavel_padrao_id`),
 * e sem esta ação não havia como corrigir depois — a tela mostrava uma pílula de
 * leitura. Medido em produção em 09/11: 7 dos 75 projetos sem dono nenhum, e os
 * 5 playbooks com `responsavel_padrao_id` nulo, então todo projeto novo nasce sem.
 */
export async function atribuirProjeto(a: AtorPV, projetoId: string, usuarioId: string | null): Promise<Resultado> {
  const p = await projetoEditavel(a, projetoId);
  if (!p) return { ok: false, erro: "Projeto não encontrado.", codigo: "nao_encontrado" };
  if (ENCERRADO(p)) return { ok: false, erro: "Projeto encerrado não troca de responsável.", codigo: "encerrado" };
  // Mesmo valor: não grava e não polui a linha do tempo com uma troca que não houve.
  if ((p.responsavel_id ?? null) === usuarioId) return ok(undefined);
  if (usuarioId) {
    const [u] = await db.select({ id: usuarios.id }).from(usuarios)
      .where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizacaoId, a.organizacaoId), eq(usuarios.ativo, true)))
      .limit(1);
    if (!u) return { ok: false, erro: "Responsável não encontrado nesta organização.", codigo: "responsavel_invalido" };
  }
  try {
    await db.execute(sql`
      UPDATE fulfillments SET responsavel_id = ${usuarioId}::uuid, updated_at = now()
       WHERE id = ${projetoId}::uuid AND organizacao_id = ${a.organizacaoId}::uuid`);
    await registrarFatoDoProjeto(a, projetoId, "ProjectReassigned", { de: p.responsavel_id, para: usuarioId, empresa: p.empresa });
    if (usuarioId) await avisarResponsavelDoProjeto(a, usuarioId, projetoId, p.empresa);
    return ok(undefined);
  } catch (e) { return falha(e); }
}

/**
 * Define ou muda o prazo do projeto. `null` apaga.
 *
 * Duas colunas, dois papéis: `due_at` é o prazo vigente, que esta ação move, e
 * `target_at` é o alvo original, que a linha do tempo mostra como "era". Na
 * PRIMEIRA definição os dois nascem juntos — sem isso não haveria original
 * nenhum, e a remarcação seguinte não teria de onde tirar o "de".
 *
 * Consequência que vale saber: `temPrazoReal` (montagem.ts) suprime atraso
 * enquanto não há `due_at`, de propósito. Definir prazo num projeto antigo
 * acende o vermelho na hora, e isso é correto — não é bug da tela.
 */
export async function editarPrazoProjeto(a: AtorPV, projetoId: string, venceEm: Date | null): Promise<Resultado> {
  if (venceEm && Number.isNaN(venceEm.getTime())) return { ok: false, erro: "Data inválida.", codigo: "prazo_invalido" };
  const p = await projetoEditavel(a, projetoId);
  if (!p) return { ok: false, erro: "Projeto não encontrado.", codigo: "nao_encontrado" };
  if (ENCERRADO(p)) return { ok: false, erro: "Projeto encerrado não tem prazo a definir.", codigo: "encerrado" };

  const entrou = dataDe(p.entrou_em);
  if (venceEm && entrou && venceEm.getTime() <= entrou.getTime()) {
    return {
      ok: false,
      erro: `O prazo tem de ser depois da entrada do projeto (${entrou.toISOString().slice(0, 10)}).`,
      codigo: "prazo_antes_da_entrada",
    };
  }
  const antes = dataDe(p.due_at);
  if ((antes?.getTime() ?? null) === (venceEm?.getTime() ?? null)) return ok(undefined);

  const iso = venceEm ? venceEm.toISOString() : null;
  try {
    await db.execute(sql`
      UPDATE fulfillments
         SET due_at = ${iso}::timestamptz,
             target_at = COALESCE(target_at, ${iso}::timestamptz),
             updated_at = now()
       WHERE id = ${projetoId}::uuid AND organizacao_id = ${a.organizacaoId}::uuid`);
    const tipo: FatoDoProjeto = venceEm == null ? "ProjectDeadlineCleared" : antes == null ? "ProjectDeadlineSet" : "ProjectDeadlineChanged";
    await registrarFatoDoProjeto(a, projetoId, tipo, { de: antes?.toISOString() ?? null, para: iso, empresa: p.empresa });
    return ok(undefined);
  } catch (e) { return falha(e); }
}

/** Quem pode receber uma tarefa. O contrato não previa esta leitura; a tela precisa dela. */
export async function equipeDaOrganizacao(organizacaoId: string): Promise<Usuario[]> {
  const linhas = await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true)))
    .orderBy(usuarios.nome);
  return linhas.map((u) => ({
    id: u.id,
    nome: u.nome ?? u.email ?? "Sem nome",
    email: u.email ?? null,
    iniciais: iniciaisDe(u.nome ?? u.email),
  }));
}

/** A empresa do projeto. A nota pendura nela, e é por isso que aparece no Cliente 360. */
async function empresaDoProjeto(organizacaoId: string, projetoId: string): Promise<string | null> {
  const [r] = await db.select({ empresaId: servicosCanonicos.empresaId })
    .from(fulfillments)
    .innerJoin(servicosCanonicos, eq(servicosCanonicos.id, fulfillments.servicoCanonicoId))
    .where(and(eq(fulfillments.id, projetoId), eq(fulfillments.organizacaoId, organizacaoId)))
    .limit(1);
  return r?.empresaId ?? null;
}

export async function adicionarNota(a: AtorPV, projetoId: string, texto: string): Promise<Resultado<{ id: string }>> {
  const limpo = texto.trim();
  if (!limpo) return { ok: false, erro: "A nota está vazia." };
  const empresaId = await empresaDoProjeto(a.organizacaoId, projetoId);
  if (!empresaId) return { ok: false, erro: "Este projeto não tem empresa resolvida, então a nota não teria onde morar." };
  try {
    const [n] = await db.insert(notas).values({
      organizacaoId: a.organizacaoId,
      empresaId,
      conteudo: limpo,
      autorId: a.userId,
    }).returning({ id: notas.id });
    return ok({ id: n.id });
  } catch (e) { return falha(e); }
}

/**
 * O levantamento mora na EMPRESA, não no projeto: o segundo onboarding da
 * mesma empresa não pode ter outra resposta para "qual CRM usa". O projeto é
 * só a tela onde se preenche.
 */
export async function salvarLevantamento(a: AtorPV, projetoId: string, campos: Partial<Levantamento>): Promise<Resultado> {
  const empresaId = await empresaDoProjeto(a.organizacaoId, projetoId);
  if (!empresaId) return { ok: false, erro: "Este projeto não tem empresa resolvida." };
  const patch: Record<string, unknown> = {};
  if (campos.perfilDeUso !== undefined) patch.perfilDeUso = campos.perfilDeUso;
  if (campos.crmQueUsa !== undefined) patch.crmQueUsa = campos.crmQueUsa;
  if (campos.objetivoComACallface !== undefined) patch.objetivoComACallface = campos.objetivoComACallface;
  if (campos.extras !== undefined) patch.extras = campos.extras;
  if (!Object.keys(patch).length) return ok(undefined);
  try {
    await db.update(empresas)
      .set({
        camposCustom: sql`jsonb_set(coalesce(${empresas.camposCustom}, '{}'::jsonb), '{levantamento}',
          coalesce(${empresas.camposCustom} -> 'levantamento', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb, true)`,
      })
      .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, a.organizacaoId)));
    return ok(undefined);
  } catch (e) { return falha(e); }
}

export async function marcarEspera(a: AtorPV, projetoId: string, motivo: MotivoDaEspera, detalhe: string | null): Promise<Resultado> {
  const r = await iniciarEspera({ organizacaoId: a.organizacaoId, fulfillmentId: projetoId, motivo, detalhe, usuarioId: a.userId });
  return r.ok ? ok(undefined) : { ok: false, erro: r.erro, codigo: r.codigo };
}

export async function pararEspera(a: AtorPV, projetoId: string): Promise<Resultado> {
  const r = await encerrarEspera({ organizacaoId: a.organizacaoId, fulfillmentId: projetoId, usuarioId: a.userId });
  return r.ok ? ok(undefined) : { ok: false, erro: r.erro, codigo: r.codigo };
}
