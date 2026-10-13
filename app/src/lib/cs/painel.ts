/**
 * Agregações do painel de CS — só leitura, exclusivamente para a UI.
 *
 * Existe por performance e composição de tela: os blocos laterais do
 * dashboard precisam de 5 recortes diferentes, e buscá-los com 5 chamadas
 * separadas faria a primeira dobra piscar em cascata. Nenhuma regra de
 * negócio nova mora aqui — tudo sai das mesmas tabelas e dos mesmos
 * critérios já usados por fila, riscos, renovação e jornada.
 */
import { doCrm } from "@/lib/financeiro/espelho-crm";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { nomeEmpresaSql } from "@/lib/vendas/texto";
import { ROTULO_RISCO, type TipoRisco } from "./riscos";

/** Tipos de risco que são problema de cobrança — o bloco "Financeiro". */
const TIPOS_FINANCEIROS = ["FATURA_ATRASADA", "PAGAMENTO_FALHOU", "ASSINATURA_INADIMPLENTE"];

export interface PainelCs {
  semOwner: { total: number; mrr: string; top: { empresaId: string; nome: string; mrr: string }[] };
  financeiro: {
    clientes: number;
    mrrImpactado: string;
    valorEmAberto: string;
    porTipo: { tipo: string; rotulo: string; clientes: number; severidade: string }[];
  };
  checkpoints: {
    atrasados: number; hoje: number; semana: number;
    lista: {
      marcoId: string; empresaId: string; empresa: string; codigo: string; titulo: string;
      dueDate: string; ciclo: number; ownerNome: string | null; mrr: string; estado: "atrasado" | "hoje" | "semana";
    }[];
  };
  renovacoes: {
    d30: number; d60: number; d90: number; total: number;
    lista: { id: string; empresaId: string; empresa: string; vencimento: string; dias: number; valor: string | null; status: string }[];
  };
  expansoes: { total: number; valorTotal: string; porStatus: { status: string; n: number; valor: string }[] };
  /**
   * Contexto por empresa para a tabela da Carteira — próximo checkpoint e
   * renovação. Vem daqui em vez de engordar `GET /clientes-crm2`, que é
   * compartilhado com a aba Carteira do módulo Clientes.
   */
  porEmpresa: Record<string, {
    checkpoint: { codigo: string; dueDate: string; atrasado: boolean } | null;
    renovacao: { dias: number; status: string } | null;
    risco: { severidade: string; sinais: number } | null;
  }>;
}

export async function painelCs(organizacaoId: string, responsavelId?: string | null, semDono?: boolean): Promise<PainelCs> {
  const filtroDono = semDono
    ? sql`AND cli.responsavel_id IS NULL`
    : responsavelId
      ? sql`AND cli.responsavel_id = ${responsavelId}`
      : sql``;

  // Base compartilhada: conta de CS + MRR real do portfólio.
  const conta = sql`
    conta AS (
      SELECT cli.empresa_id, cli.responsavel_id, ${nomeEmpresaSql("e.nome")} AS empresa_nome, u.nome AS owner_nome,
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

  // ─── Sem responsável ───
  const semOwnerRows = await db.execute<{ empresa_id: string; empresa_nome: string; mrr: string }>(sql`
    WITH ${conta}
    SELECT empresa_id, empresa_nome, mrr FROM conta
     WHERE responsavel_id IS NULL
     ORDER BY mrr::numeric DESC`);

  // ─── Financeiro ───
  const finRows = await db.execute<{ tipo: string; severidade: string; clientes: number }>(sql`
    WITH ${conta}
    SELECT r.tipo,
           MIN(CASE r.severidade WHEN 'CRITICO' THEN 'CRITICO' WHEN 'EM_RISCO' THEN 'EM_RISCO' ELSE 'ZATENCAO' END) AS severidade,
           COUNT(DISTINCT r.empresa_id)::int AS clientes
      FROM cs_riscos r JOIN conta c ON c.empresa_id = r.empresa_id
     WHERE r.status = 'ABERTO' AND r.tipo IN ('FATURA_ATRASADA','PAGAMENTO_FALHOU','ASSINATURA_INADIMPLENTE')
     GROUP BY r.tipo
     ORDER BY 3 DESC`);

  const [finTotal] = await db.execute<{ clientes: string; mrr: string; aberto: string }>(sql`
    WITH ${conta},
    afetadas AS (
      SELECT DISTINCT r.empresa_id FROM cs_riscos r JOIN conta c ON c.empresa_id = r.empresa_id
       WHERE r.status = 'ABERTO' AND r.tipo IN ('FATURA_ATRASADA','PAGAMENTO_FALHOU','ASSINATURA_INADIMPLENTE')
    )
    SELECT
      (SELECT COUNT(*) FROM afetadas)::text AS clientes,
      -- MRR sob risco: o da conta inteira, não o da fatura. É o que se perde
      -- se a inadimplência virar churn, que é a pergunta que o CS faz.
      COALESCE((SELECT SUM(c.mrr::numeric) FROM conta c JOIN afetadas a ON a.empresa_id = c.empresa_id), 0)::text AS mrr,
      COALESCE((SELECT SUM(f.valor) FROM faturas f JOIN afetadas a ON a.empresa_id = f.empresa_id
                 WHERE ${doCrm("f")} AND f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()), 0)::text AS aberto`);

  // ─── Checkpoints ───
  const checkRows = await db.execute<Record<string, string | number | null>>(sql`
    WITH ${conta}
    SELECT m.id AS marco_id, m.empresa_id, c.empresa_nome, m.codigo, m.titulo, m.ciclo,
           m.due_date::text AS due_date, c.owner_nome, c.mrr,
           CASE WHEN m.due_date < CURRENT_DATE THEN 'atrasado'
                WHEN m.due_date = CURRENT_DATE THEN 'hoje'
                ELSE 'semana' END AS estado
      FROM cs_marcos m JOIN conta c ON c.empresa_id = m.empresa_id
     WHERE m.status = 'PENDENTE' AND m.due_date <= CURRENT_DATE + 7
     ORDER BY m.due_date ASC, c.mrr::numeric DESC
     LIMIT 40`);

  const [checkTotais] = await db.execute<Record<string, string>>(sql`
    WITH ${conta}
    SELECT
      COUNT(*) FILTER (WHERE m.due_date < CURRENT_DATE)::text  AS atrasados,
      COUNT(*) FILTER (WHERE m.due_date = CURRENT_DATE)::text  AS hoje,
      COUNT(*) FILTER (WHERE m.due_date > CURRENT_DATE AND m.due_date <= CURRENT_DATE + 7)::text AS semana
      FROM cs_marcos m JOIN conta c ON c.empresa_id = m.empresa_id
     WHERE m.status = 'PENDENTE'`);

  // ─── Renovações ───
  const renovRows = await db.execute<Record<string, string | number | null>>(sql`
    WITH ${conta}
    SELECT rn.id, rn.empresa_id, c.empresa_nome, rn.vencimento::text, rn.status,
           rn.valor_atual::text AS valor, (rn.vencimento - CURRENT_DATE)::int AS dias
      FROM cs_renovacoes rn JOIN conta c ON c.empresa_id = rn.empresa_id
     WHERE rn.status IN ('ABERTA','EM_NEGOCIACAO','FUTURA')
     ORDER BY rn.vencimento ASC
     LIMIT 20`);

  // ─── Expansões ───
  const expRows = await db.execute<{ status: string; n: number; valor: string }>(sql`
    WITH ${conta}
    SELECT n.status, COUNT(*)::int AS n, COALESCE(SUM(n.valor_total), 0)::text AS valor
      FROM negocios n JOIN conta c ON c.empresa_id = n.empresa_id
     WHERE n.organizacao_id = ${organizacaoId} AND n.commercial_motion = 'EXPANSION'
       AND n.status NOT IN ('perdido')
     GROUP BY n.status
     ORDER BY 2 DESC`);

  const renovacoes = renovRows.map((r) => ({
    id: String(r.id), empresaId: String(r.empresa_id), empresa: String(r.empresa_nome),
    vencimento: String(r.vencimento), dias: Number(r.dias),
    valor: (r.valor as string) ?? null, status: String(r.status),
  }));

  const expansoes = expRows.map((r) => ({ status: r.status, n: Number(r.n), valor: r.valor }));

  // ─── Contexto por empresa (tabela da Carteira) ───
  const contextoRows = await db.execute<Record<string, string | number | null>>(sql`
    WITH ${conta}
    SELECT c.empresa_id,
      (SELECT jsonb_build_object('codigo', m.codigo, 'dueDate', m.due_date::text,
                                 'atrasado', m.due_date < CURRENT_DATE)
         FROM cs_marcos m
        WHERE m.empresa_id = c.empresa_id AND m.status = 'PENDENTE'
        ORDER BY m.due_date ASC LIMIT 1) AS checkpoint,
      (SELECT jsonb_build_object('dias', (rn.vencimento - CURRENT_DATE)::int, 'status', rn.status)
         FROM cs_renovacoes rn
        WHERE rn.empresa_id = c.empresa_id AND rn.status IN ('ABERTA','EM_NEGOCIACAO','FUTURA')
        ORDER BY rn.vencimento ASC LIMIT 1) AS renovacao,
      (SELECT jsonb_build_object(
                'severidade', (SELECT r2.severidade FROM cs_riscos r2
                                WHERE r2.empresa_id = c.empresa_id AND r2.status = 'ABERTO'
                                ORDER BY CASE r2.severidade WHEN 'CRITICO' THEN 0 WHEN 'EM_RISCO' THEN 1 ELSE 2 END
                                LIMIT 1),
                'sinais', COUNT(*)::int)
         FROM cs_riscos r
        WHERE r.empresa_id = c.empresa_id AND r.status = 'ABERTO') AS risco
      FROM conta c`);

  const porEmpresa: PainelCs["porEmpresa"] = {};
  for (const r of contextoRows) {
    const risco = r.risco as unknown as { severidade: string | null; sinais: number } | null;
    porEmpresa[String(r.empresa_id)] = {
      checkpoint: (r.checkpoint as unknown as PainelCs["porEmpresa"][string]["checkpoint"]) ?? null,
      renovacao: (r.renovacao as unknown as PainelCs["porEmpresa"][string]["renovacao"]) ?? null,
      risco: risco && risco.severidade ? { severidade: risco.severidade, sinais: risco.sinais } : null,
    };
  }

  return {
    porEmpresa,
    semOwner: {
      total: semOwnerRows.length,
      mrr: semOwnerRows.reduce((s, r) => s + Number(r.mrr || 0), 0).toFixed(2),
      top: semOwnerRows.slice(0, 5).map((r) => ({ empresaId: r.empresa_id, nome: r.empresa_nome, mrr: r.mrr })),
    },
    financeiro: {
      clientes: Number(finTotal?.clientes ?? 0),
      mrrImpactado: finTotal?.mrr ?? "0",
      valorEmAberto: finTotal?.aberto ?? "0",
      porTipo: finRows.map((r) => ({
        tipo: r.tipo,
        rotulo: ROTULO_RISCO[r.tipo as TipoRisco] ?? r.tipo,
        clientes: Number(r.clientes),
        // MIN sobre os rótulos normalizados devolve 'ZATENCAO' pro caso mais
        // fraco — só um truque de ordenação, o valor exposto é o real.
        severidade: r.severidade === "ZATENCAO" ? "ATENCAO" : r.severidade,
      })),
    },
    checkpoints: {
      atrasados: Number(checkTotais?.atrasados ?? 0),
      hoje: Number(checkTotais?.hoje ?? 0),
      semana: Number(checkTotais?.semana ?? 0),
      lista: checkRows.map((r) => ({
        marcoId: String(r.marco_id), empresaId: String(r.empresa_id), empresa: String(r.empresa_nome),
        codigo: String(r.codigo), titulo: String(r.titulo), dueDate: String(r.due_date),
        ciclo: Number(r.ciclo), ownerNome: (r.owner_nome as string) ?? null, mrr: String(r.mrr ?? "0"),
        estado: String(r.estado) as "atrasado" | "hoje" | "semana",
      })),
    },
    renovacoes: {
      total: renovacoes.length,
      d30: renovacoes.filter((r) => r.dias <= 30).length,
      d60: renovacoes.filter((r) => r.dias > 30 && r.dias <= 60).length,
      d90: renovacoes.filter((r) => r.dias > 60 && r.dias <= 90).length,
      lista: renovacoes.slice(0, 6),
    },
    expansoes: {
      total: expansoes.reduce((s, e) => s + e.n, 0),
      valorTotal: expansoes.reduce((s, e) => s + Number(e.valor || 0), 0).toFixed(2),
      porStatus: expansoes,
    },
  };
}

export { TIPOS_FINANCEIROS };
