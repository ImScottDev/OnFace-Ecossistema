/**
 * Agenda do CS — "minha semana", derivada dos dados.
 *
 * Não é um checklist estático de Segunda/Terça: é o que de fato está marcado
 * para cada dia, vindo de tarefa, checkpoint, renovação e health check
 * pendente. Um roteiro fixo envelhece na primeira semana atípica; este
 * reflete a carteira de hoje.
 *
 * Tudo que está atrasado é agrupado num balde "atrasado" no topo, em vez de
 * espalhado nos dias em que venceu — o CS precisa ver o acúmulo, não
 * arqueologia.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export type TipoCompromisso = "TAREFA" | "CHECKPOINT" | "RENOVACAO" | "HEALTH_CHECK";

export interface Compromisso {
  chave: string;
  tipo: TipoCompromisso;
  titulo: string;
  empresaId: string;
  empresaNome: string;
  quando: string | null;
  mrr: string | null;
  prioridade: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  tarefaId: string | null;
  marcoId: string | null;
  renovacaoId: string | null;
  contexto: string | null;
}

export interface DiaAgenda {
  data: string;
  rotulo: string;
  compromissos: Compromisso[];
}

export interface AgendaCs {
  atrasados: Compromisso[];
  dias: DiaAgenda[];
  semData: Compromisso[];
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function rotuloDoDia(iso: string): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (iso === hoje) return "Hoje";
  if (iso === amanha) return "Amanhã";
  const d = new Date(`${iso}T12:00:00`);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

export async function agendaCs(
  organizacaoId: string,
  opts: { responsavelId?: string | null; semDono?: boolean; dias?: number } = {},
): Promise<AgendaCs> {
  const horizonte = opts.dias ?? 7;
  const filtroDono = opts.semDono
    ? sql`AND cli.responsavel_id IS NULL`
    : opts.responsavelId
      ? sql`AND cli.responsavel_id = ${opts.responsavelId}`
      : sql``;

  const conta = sql`
    conta AS (
      SELECT cli.empresa_id, cli.responsavel_id, e.nome AS empresa_nome, u.nome AS responsavel_nome,
             -- Mesmos filtros da métrica canônica mrr_atual, só que por
             -- empresa: ACTIVE + MRR + portfólio. O ciclo de vida faltava, e
             -- sem ele um serviço CHURNED somava no MRR da conta.
             COALESCE((SELECT SUM(sc.current_recurring_value) FROM servicos_canonicos sc
                        WHERE sc.empresa_id = cli.empresa_id AND sc.portfolio_included = true
                          AND sc.revenue_nature = 'MRR'
                          AND sc.commercial_lifecycle = 'ACTIVE'), 0)::text AS mrr
        FROM clientes cli
        JOIN empresas e ON e.id = cli.empresa_id
        LEFT JOIN usuarios u ON u.id = cli.responsavel_id
       WHERE cli.organizacao_id = ${organizacaoId} AND cli.empresa_id IS NOT NULL ${filtroDono}
    )`;

  type Row = Record<string, string | number | null>;
  const itens: Compromisso[] = [];

  const push = (r: Row, extra: Pick<Compromisso, "chave" | "tipo" | "titulo"> & Partial<Compromisso>) => {
    itens.push({
      empresaId: String(r.empresa_id),
      empresaNome: String(r.empresa_nome),
      mrr: (r.mrr as string) ?? null,
      responsavelId: (r.responsavel_id as string) ?? null,
      responsavelNome: (r.responsavel_nome as string) ?? null,
      quando: null, prioridade: null, tarefaId: null, marcoId: null, renovacaoId: null, contexto: null,
      ...extra,
    });
  };

  // Tarefas abertas dentro do horizonte (ou já vencidas).
  const tarefas = await db.execute<Row>(sql`
    WITH ${conta}
    SELECT c.*, t.id AS tarefa_id, t.titulo, t.vence_em::text AS quando,
           t.prioridade, t.origem, t.motivo
      FROM conta c
      JOIN tarefas t ON t.empresa_id = c.empresa_id
     WHERE t.concluida = false
       AND (t.vence_em IS NULL OR t.vence_em <= now() + (${horizonte} || ' days')::interval)`);
  for (const r of tarefas) {
    push(r, {
      chave: `tarefa:${r.tarefa_id}`, tipo: "TAREFA", titulo: String(r.titulo),
      quando: (r.quando as string) ?? null, prioridade: (r.prioridade as string) ?? null,
      tarefaId: String(r.tarefa_id), contexto: (r.motivo as string) ?? String(r.origem).toLowerCase(),
    });
  }

  // Checkpoints previstos que ainda não viraram tarefa.
  const marcos = await db.execute<Row>(sql`
    WITH ${conta}
    SELECT c.*, m.id AS marco_id, m.titulo, m.codigo, m.ciclo, m.due_date::text AS quando
      FROM conta c
      JOIN cs_marcos m ON m.empresa_id = c.empresa_id
     WHERE m.status = 'PENDENTE' AND m.tarefa_id IS NULL
       AND m.due_date <= CURRENT_DATE + (${horizonte})::int`);
  for (const r of marcos) {
    push(r, {
      chave: `marco:${r.marco_id}`, tipo: "CHECKPOINT", titulo: String(r.titulo),
      quando: (r.quando as string) ?? null, marcoId: String(r.marco_id),
      contexto: `checkpoint ${r.codigo}${Number(r.ciclo) > 1 ? ` · ciclo ${r.ciclo}` : ""}`,
    });
  }

  // Renovações com janela aberta.
  const renov = await db.execute<Row>(sql`
    WITH ${conta}
    SELECT c.*, rn.id AS renovacao_id, rn.vencimento::text AS quando, rn.status,
           (rn.vencimento - CURRENT_DATE)::int AS dias
      FROM conta c
      JOIN cs_renovacoes rn ON rn.empresa_id = c.empresa_id
     WHERE rn.status IN ('ABERTA','EM_NEGOCIACAO')`);
  for (const r of renov) {
    push(r, {
      chave: `renov:${r.renovacao_id}`, tipo: "RENOVACAO",
      titulo: `Renovação — ${r.empresa_nome}`,
      quando: (r.quando as string) ?? null, renovacaoId: String(r.renovacao_id),
      contexto: `vence em ${r.dias} dias · ${String(r.status).toLowerCase().replace("_", " ")}`,
    });
  }

  // Health check sugerido: cliente ativo há mais de 90 dias sem nenhum, ou
  // cujo último passou de 180 dias. Não tem data marcada — entra em "quando
  // der", que é justamente o espaço que o CS usa pra encaixar.
  const health = await db.execute<Row>(sql`
    WITH ${conta}
    SELECT c.*, hc.ultimo::text AS ultimo
      FROM conta c
      LEFT JOIN LATERAL (
        SELECT MAX(np.respondido_em) AS ultimo FROM nps_respostas np
         WHERE np.tipo = 'health_check'
           AND (np.empresa_id = c.empresa_id
                OR np.lead_id IN (SELECT l.id FROM leads l WHERE l.empresa_id = c.empresa_id))
      ) hc ON true
     WHERE EXISTS (SELECT 1 FROM servicos_canonicos sc
                    WHERE sc.empresa_id = c.empresa_id AND sc.portfolio_included = true
                      AND sc.created_at < now() - interval '90 days')
       AND (hc.ultimo IS NULL OR hc.ultimo < now() - interval '180 days')
     ORDER BY c.mrr::numeric DESC
     LIMIT 15`);
  for (const r of health) {
    push(r, {
      chave: `health:${r.empresa_id}`, tipo: "HEALTH_CHECK",
      titulo: `Health check — ${r.empresa_nome}`,
      contexto: r.ultimo ? `último há mais de 6 meses` : "nunca teve health check",
    });
  }

  // ─── Distribuição ───
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasados: Compromisso[] = [];
  const semData: Compromisso[] = [];
  const porDia = new Map<string, Compromisso[]>();

  for (const item of itens) {
    if (!item.quando) { semData.push(item); continue; }
    const dia = item.quando.slice(0, 10);
    if (dia < hoje) { atrasados.push(item); continue; }
    const lista = porDia.get(dia) ?? [];
    lista.push(item);
    porDia.set(dia, lista);
  }

  const ordenar = (a: Compromisso, b: Compromisso) => {
    // Dentro do dia, MRR maior primeiro: mesma hora de trabalho, conta maior.
    const pa = a.prioridade === "alta" ? 0 : 1;
    const pb = b.prioridade === "alta" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return Number(b.mrr ?? 0) - Number(a.mrr ?? 0);
  };

  atrasados.sort(ordenar);
  semData.sort(ordenar);

  const dias: DiaAgenda[] = [];
  for (let i = 0; i < horizonte; i++) {
    const d = new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10);
    const compromissos = (porDia.get(d) ?? []).sort(ordenar);
    if (compromissos.length === 0 && i > 1) continue; // dia vazio no futuro não ocupa espaço
    dias.push({ data: d, rotulo: rotuloDoDia(d), compromissos });
  }

  return { atrasados, dias, semData };
}
