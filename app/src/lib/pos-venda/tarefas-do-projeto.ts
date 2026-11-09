/**
 * As tarefas de cada projeto, lidas de `tarefas` (sem lista paralela), com checklist
 * (`tarefa_subtarefas`), contagem de comentários e data original de remarcação.
 *
 * Ligação tarefa -> projeto: a chave `ONBOARDING:{projetoId}:{passo}` que o motor grava.
 * Projeto legado (anterior ao motor) não tem chave: cai nas tarefas de origem ONBOARDING/IMPLANTACAO
 * do serviço principal, com o `tipo` da tarefa no lugar do passo. Tarefa sem ligação nenhuma não aparece
 * (é do cliente, não do projeto).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ItemDaTarefa, Pessoa, TarefaDoProjeto } from "./contrato";
import { dataDe, estadoDaTarefa, iniciaisDe, prioridadeDe } from "./regras";

type Crua = {
  id: string; titulo: string; descricao: string | null; tipo: string; prioridade: string; status: string; concluida: boolean;
  vence_em: string | null; data_vencimento: string | null; concluida_em: string | null; chave: string | null; criada_em: string;
  servico_id: string | null; resp_id: string | null; resp_nome: string | null; resp_email: string | null;
  comentarios: number; original: string | null;
};

export interface TarefaComProjeto { projetoId: string; passo: string; criadaEm: Date | null; tarefa: Omit<TarefaDoProjeto, "ordem" | "condicional"> }

export async function tarefasDosProjetos(
  organizacaoId: string,
  projetos: Array<{ id: string; servicoId: string }>,
): Promise<Map<string, TarefaComProjeto[]>> {
  const mapa = new Map<string, TarefaComProjeto[]>();
  if (projetos.length === 0) return mapa;
  const porServico = new Map(projetos.map((p) => [p.servicoId, p.id]));
  const porId = new Set(projetos.map((p) => p.id));
  const servicos = sql.join([...porServico.keys()].map((i) => sql`${i}::uuid`), sql`, `);

  const linhas = await db.execute<Crua>(sql`
    SELECT t.id::text, t.titulo, t.descricao, t.tipo, t.prioridade, t.status, t.concluida,
           to_json(t.vence_em)#>>'{}' AS vence_em, t.data_vencimento::text, to_json(t.concluida_em)#>>'{}' AS concluida_em,
           t.chave_idempotencia AS chave, to_json(t.created_at)#>>'{}' AS criada_em, t.servico_canonico_id::text AS servico_id,
           u.id::text AS resp_id, u.nome AS resp_nome, u.email AS resp_email,
           (SELECT count(*)::int FROM tarefa_comentarios c WHERE c.tarefa_id = t.id AND c.organizacao_id = t.organizacao_id) AS comentarios,
           (SELECT e.payload->>'de' FROM domain_events e
             WHERE e.organizacao_id = t.organizacao_id AND e.aggregate_type = 'tarefa' AND e.aggregate_id = t.id
               AND e.event_type = 'TaskRescheduled' ORDER BY e.occurred_at ASC LIMIT 1) AS original
      FROM tarefas t
      LEFT JOIN usuarios u ON u.id = t.usuario_id
     WHERE t.organizacao_id = ${organizacaoId}::uuid
       AND ((t.chave_idempotencia LIKE 'ONBOARDING:%' OR t.chave_idempotencia LIKE 'IMPLANTACAO:%')
         OR (t.chave_idempotencia IS NULL AND t.origem IN ('ONBOARDING','IMPLANTACAO') AND t.servico_canonico_id IN (${servicos})))
     ORDER BY t.created_at, t.id`);

  const ids = linhas.map((l) => l.id);
  const itensPorTarefa = new Map<string, ItemDaTarefa[]>();
  if (ids.length) {
    const subs = await db.execute<{ tarefa_id: string; id: string; titulo: string; concluida: boolean; ordem: number }>(sql`
      SELECT tarefa_id::text, id::text, titulo, concluida, ordem FROM tarefa_subtarefas
       WHERE organizacao_id = ${organizacaoId}::uuid AND tarefa_id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})
       ORDER BY ordem, created_at`);
    for (const s of subs) {
      const a = itensPorTarefa.get(s.tarefa_id) ?? [];
      a.push({ id: s.id, titulo: s.titulo, feito: s.concluida, ordem: s.ordem });
      itensPorTarefa.set(s.tarefa_id, a);
    }
  }

  const agora = Date.now();
  for (const l of linhas) {
    let projetoId: string | null = null;
    let passo = l.tipo;
    if (l.chave) {
      const [, pid, ...resto] = l.chave.split(":");
      if (!pid || !porId.has(pid)) continue;
      projetoId = pid; passo = resto.join(":") || l.tipo;
    } else if (l.servico_id) {
      projetoId = porServico.get(l.servico_id) ?? null;
    }
    if (!projetoId) continue;

    const estado = estadoDaTarefa(l.status, l.concluida);
    // `vence_em` é o instante; `data_vencimento` só tem o dia (tarefas antigas).
    const venceEm = dataDe(l.vence_em) ?? dataDe(l.data_vencimento ? `${l.data_vencimento}T23:59:59Z` : null);
    const original = dataDe(l.original);
    // `fichaHref: null` porque quem responde pela tarefa é USUÁRIO do ONFACE, não
    // contato do cliente: não há ficha de pessoa para abrir.
    const resp: Pessoa | null = l.resp_id
      ? { id: l.resp_id, nome: l.resp_nome ?? "Sem nome", email: l.resp_email, telefone: null, cargo: null, iniciais: iniciaisDe(l.resp_nome), fichaHref: null }
      : null;
    const aberta = estado !== "CONCLUIDA" && estado !== "NAO_SE_APLICA";
    const arr = mapa.get(projetoId) ?? [];
    arr.push({
      projetoId, passo, criadaEm: dataDe(l.criada_em),
      tarefa: {
        id: l.id, passo, titulo: l.titulo, playbook: l.descricao, estado, prioridade: prioridadeDe(l.prioridade),
        responsavel: resp, venceEm, venceEmOriginal: original && venceEm && original.getTime() !== venceEm.getTime() ? original : null,
        atrasada: aberta && venceEm != null && venceEm.getTime() < agora,
        concluidaEm: dataDe(l.concluida_em), itens: itensPorTarefa.get(l.id) ?? [], comentarios: l.comentarios,
      },
    });
    mapa.set(projetoId, arr);
  }
  return mapa;
}
