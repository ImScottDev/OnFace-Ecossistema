/**
 * Montagem comum ao projeto e ao board: relógios, ordem das tarefas, progresso.
 * Aqui mora a decisão de COMO preencher quando o dado não existe (projeto anterior ao motor).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Familia, Relogios, TarefaDoProjeto } from "./contrato";
import type { LinhaBase } from "./leitura-base";
import type { PlaybookDoMotor } from "./playbook";
import type { TarefaComProjeto } from "./tarefas-do-projeto";
import { calcularRelogios, dataDe, estadoDoProjeto, type PeriodoDeEspera } from "./regras";

/** Prazo padrão por família (contrato.ts: 15 Callface AI, 30 White Label, 25 PABX). Só entra sem playbook nem `due_at`. */
export const PRAZO_PADRAO: Record<Familia, number> = { CALLFACE_AI: 15, WHITE_LABEL: 30, PABX: 25 };

export function prazoDoProjeto(l: LinhaBase, playbook: PlaybookDoMotor | null): number {
  const entrou = dataDe(l.entrouEm);
  const due = dataDe(l.dueAt);
  if (entrou && due && due > entrou) return Math.max(1, Math.round((due.getTime() - entrou.getTime()) / 86_400_000));
  return playbook?.prazoTotalDias ?? PRAZO_PADRAO[l.familia];
}

/**
 * O projeto tem prazo DE VERDADE, ou o número é inferido?
 *
 * Só o motor grava `due_at`. Os 74 projetos que existiam antes dele nasceram
 * sem prazo nenhum — e aplicar o padrão da família neles produz atraso
 * fabricado: medido em homologação, o board abria com 17 "atrasados" que eram
 * só registros velhos, com até 31 dias de atraso que nunca existiu como regra.
 *
 * Alarme falso é pior que alarme nenhum: ensina o time a ignorar o vermelho.
 * Sem `due_at`, o prazo vira desconhecido e o projeto não conta como atrasado.
 */
export const temPrazoReal = (l: LinhaBase): boolean => {
  const entrou = dataDe(l.entrouEm);
  const due = dataDe(l.dueAt);
  return Boolean(entrou && due && due > entrou);
};

export function relogiosDe(l: LinhaBase, playbook: PlaybookDoMotor | null, esperas: PeriodoDeEspera[], agora: Date): Relogios {
  const entrou = dataDe(l.entrouEm) ?? agora;
  const r = calcularRelogios({ entrouEm: entrou, concluidoEm: dataDe(l.concluidoEm), agora, prazoDias: prazoDoProjeto(l, playbook), esperas });
  // Tempo decorrido é fato e continua. O que some é o julgamento sobre um
  // prazo que ninguém combinou: vencimento, atraso e consumo do prazo.
  const comPrazo = temPrazoReal(l) ? r : { ...r, venceEm: null, diasDeAtraso: null, consumoDoPrazo: null };
  return { ...comPrazo, venceEmOriginal: prazoOriginal(l) };
}

/**
 * O prazo que valia antes de alguém remarcar: `target_at`, o alvo que o motor
 * gravou. `due_at` é o prazo vigente, que a ação de editar prazo move.
 *
 * Null quando os dois são iguais (prazo nunca mudou) ou quando não há alvo:
 * mostrar "era 25/11" ao lado de "vence 25/11" é ruído, não histórico.
 */
function prazoOriginal(l: LinhaBase): Date | null {
  const alvo = dataDe(l.targetAt);
  const vigente = dataDe(l.dueAt);
  if (!alvo || !vigente) return null;
  return alvo.getTime() === vigente.getTime() ? null : alvo;
}

/** Tarefas na ordem do playbook (passo desconhecido vai depois, por data de criação). */
export function ordenarTarefas(brutas: TarefaComProjeto[], playbook: PlaybookDoMotor | null, condicional: (passo: string) => boolean = () => false): TarefaDoProjeto[] {
  const ordemDe = new Map((playbook?.passos ?? []).map((p) => [p.passo, p.ordem]));
  const sorted = [...brutas].sort((a, b) => {
    const oa = ordemDe.get(a.passo) ?? Number.MAX_SAFE_INTEGER, ob = ordemDe.get(b.passo) ?? Number.MAX_SAFE_INTEGER;
    return oa - ob || (a.criadaEm?.getTime() ?? 0) - (b.criadaEm?.getTime() ?? 0);
  });
  return sorted.map((t, i) => ({ ...t.tarefa, ordem: ordemDe.get(t.passo) ?? 1000 + i, condicional: condicional(t.passo) }));
}

export const seAplica = (t: Pick<TarefaDoProjeto, "estado">) => t.estado !== "NAO_SE_APLICA";

/**
 * Progresso 0..1 sobre as tarefas que se aplicam. Sem nenhuma tarefa (projeto anterior ao motor) cai no
 * checklist de `fulfillment_itens`; sem nem isso, concluído = 1 e o resto = 0 (a tela sabe que há 0 tarefas).
 */
export function progressoDe(tarefas: Array<Pick<TarefaDoProjeto, "estado">>, itens: { feitos: number; total: number } | undefined, concluido: boolean): number {
  const aplicam = tarefas.filter(seAplica);
  if (aplicam.length > 0) return Math.round((aplicam.filter((t) => t.estado === "CONCLUIDA").length / aplicam.length) * 100) / 100;
  if (itens && itens.total > 0) return Math.round((itens.feitos / itens.total) * 100) / 100;
  return concluido ? 1 : 0;
}

export async function itensDeChecklist(organizacaoId: string, ids: string[]): Promise<Map<string, { feitos: number; total: number }>> {
  const m = new Map<string, { feitos: number; total: number }>();
  if (ids.length === 0) return m;
  const r = await db.execute<{ id: string; feitos: number; total: number }>(sql`
    SELECT fulfillment_id::text AS id, count(*) FILTER (WHERE status = 'DONE')::int AS feitos, count(*)::int AS total
      FROM fulfillment_itens
     WHERE organizacao_id = ${organizacaoId}::uuid AND fulfillment_id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})
     GROUP BY 1`);
  for (const x of r) m.set(x.id, { feitos: x.feitos, total: x.total });
  return m;
}

export const estadoDe = (l: LinhaBase, esperas: PeriodoDeEspera[]) => estadoDoProjeto(l.status, esperas.some((e) => e.fim == null));

/** O cliente é quem segura a bola agora? Espera registrada OU status legado de cliente (antes do registro existir). */
export const aguardandoCliente = (l: LinhaBase, esperas: PeriodoDeEspera[]) =>
  esperas.some((e) => e.fim == null && e.motivo === "cliente") || l.status === "WAITING_CUSTOMER" || l.status === "BLOCKED_CUSTOMER";
