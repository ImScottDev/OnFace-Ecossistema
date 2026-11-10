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
import { tarefas, tarefaSubtarefas, usuarios, notas, empresas } from "@/lib/db/schema";
import { alterarTarefa } from "@/lib/tarefas/portas";
import { alterarSubtarefa } from "@/lib/tarefas/detalhe";
import type { Levantamento, Resultado, Usuario } from "./contrato";
import { iniciaisDe } from "./regras";
import type { MotivoDaEspera } from "./contrato";
import { iniciarEspera, encerrarEspera } from "./espera";
import { linhasBase } from "./leitura-base";

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
/** A mesma resolução da leitura (`linhasBase`): serviço, depois lead, depois oportunidade, sempre a canônica.
 *  Ler só `servicos_canonicos.empresa_id` deixava nota e levantamento sem onde gravar quando o serviço não tinha empresa. */
async function empresaDoProjeto(organizacaoId: string, projetoId: string): Promise<string | null> {
  const [l] = await linhasBase(organizacaoId, [projetoId]);
  return l?.empresa.resolvida ? l.empresa.id : null;
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
