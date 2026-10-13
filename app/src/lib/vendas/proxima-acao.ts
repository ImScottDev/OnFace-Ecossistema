import { sql, type SQL } from "drizzle-orm";

/* "Próxima ação" tem UMA definição: o compromisso aberto de prazo mais próximo,
   seja tarefa em aberto ou reunião agendada. Cartão do quadro, detalhe da
   oportunidade, Pré-vendas e a fila de loops leem daqui; olhar só tarefa fazia
   a reunião marcada aparecer como "Nenhuma ação agendada". */

export const STATUS_TAREFA_ABERTA = ["a_fazer", "em_andamento", "aguardando"] as const;

/** Compromissos abertos de um negócio/lead (`ref` é a coluna, ex.: "n.id"), como linhas (titulo, vence_em). */
export function compromissosAbertos(chave: "negocio_id" | "lead_id", ref: SQL): SQL {
  const col = sql.raw(chave);
  return sql`
    SELECT titulo, COALESCE(vence_em, data_vencimento::timestamptz) AS vence_em
      FROM tarefas WHERE ${col} = ${ref} AND status IN ('a_fazer','em_andamento','aguardando')
    UNION ALL
    SELECT titulo, data AS vence_em
      FROM reunioes WHERE ${col} = ${ref} AND status = 'agendada'`;
}

/** A próxima: ordena pelo prazo, sem prazo por último. */
export function proximoCompromisso(chave: "negocio_id" | "lead_id", ref: SQL): SQL {
  return sql`SELECT titulo, vence_em FROM (${compromissosAbertos(chave, ref)}) c ORDER BY vence_em NULLS LAST LIMIT 1`;
}

/** Predicado: há ao menos um compromisso aberto. */
export function temCompromissoAberto(chave: "negocio_id" | "lead_id", ref: SQL): SQL {
  return sql`EXISTS (${compromissosAbertos(chave, ref)})`;
}
