/**
 * Dados da tela de CS do handoff (CsProto) — uma leitura, tudo o que o
 * desenho consome.
 *
 * Arquivo PRÓPRIO da tela de propósito: os critérios são os mesmos de
 * fila.ts/agenda.ts (MRR = servicos_canonicos ACTIVE + MRR + portfólio, nunca
 * contratos.mrr; última interação = atividades da empresa OU do lead dela),
 * mas a forma de saída é a do protótipo, e misturar as duas formas num
 * arquivo compartilhado obrigaria todo consumidor a carregar a outra.
 */
import { doCrm } from "@/lib/financeiro/espelho-crm";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { nomeEmpresaSql } from "@/lib/vendas/texto";
import { faturamentoMensal, type FaturamentoMes } from "@/lib/financeiro/faturamento-mensal";
import { carteiraEmRisco } from "@/lib/cs/carteira-em-risco";
import { ROTULO_ETAPA_PIPELINE, type EtapaPipeline } from "@/lib/vendas/dominio";

type Row = Record<string, any>;
const FAMILIAS = ["PABX", "CALLFACE_AI", "WHITE_LABEL"] as const;
export const INICIO_SEM_EVIDENCIA = "0000-01";

export interface ClienteDaTela {
  id: string;                 // empresa_id — é o que /cs/clientes/:empresaId espera
  nome: string;
  mrr: number;
  /** MRR por família. O desenho atribui a conta inteira a UMA família
      (`produto`); a distribuição por produto é refeita no adaptador com isto,
      senão uma conta PABX + Callface AI somaria tudo em PABX. */
  mrrFam: Record<string, number>;
  produto: string | null;     // família dominante (maior MRR)
  servicoId: string | null;   // serviço dominante — origem de uma expansão
  inicio: string;             // "YYYY-MM": ativoEm() compara string com ym()
  semEvidencia: boolean;
  fim: string | null;
  saude: number;
  ultima: string;
  nunca: boolean;
  resp: string | null;
  segmento: string | null;
  status: string | null;
  principal: string | null;
  inad: { dias: number; valor: number; n: number } | null;
}

export interface TarefaDaTela {
  id: string; titulo: string; tipo: string; situacao: string; prioridade: string;
  resp: string | null; empresa: string; quando: string | null; temHora: boolean;
}

export interface EventoDaTela { empresaId: string; quando: string; t: string; autor: string | null; cat: string }

export interface DadosTelaCs {
  clientes: ClienteDaTela[];
  tarefas: TarefaDaTela[];
  eventos: EventoDaTela[];
  leads: Array<{ id: string | null; empresa: string; origem: string }>;
  expansoes: Array<{ id: string; empresa: string; etapa: string; tipo: "expansao"; itens: any[] }>;
  equipe: Array<{ id: string; nome: string }>;
  /** Faturamento mensal da carteira por natureza (cliente_receita_mensal). */
  faturamento: FaturamentoMes[];
  /** Risco REAL (cs_riscos, a mesma fonte de /clientes/risco): o desenho calculava o seu por heurística de silêncio. */
  risco: { criticoEmRisco: number; mrrCriticoEmRisco: number; atencao: number; semResponsavel: number };
}

/** "Hoje" / "Ontem" / "Há N dias" — o único formato que diasSem() do desenho lê. */
function ultimaDoDesenho(dias: number): string {
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  return `Há ${dias} dias`;
}

export async function dadosTelaCs(organizacaoId: string): Promise<DadosTelaCs> {
  const conta = sql`
    conta AS (
      SELECT cli.empresa_id, ${nomeEmpresaSql("e.nome")} AS nome, e.setor, p.nome AS principal, u.nome AS resp,
             cli.cs_sem_evidencia,
             COALESCE(cli.cliente_desde, cli.entrou_carteira_em, cli.created_at) AS inicio
        FROM clientes cli
        JOIN empresas e ON e.id = cli.empresa_id
        LEFT JOIN pessoas p ON p.id = cli.pessoa_principal_id
        LEFT JOIN usuarios u ON u.id = COALESCE(cli.responsavel_cs_id, cli.responsavel_id)
       WHERE cli.organizacao_id = ${organizacaoId} AND cli.empresa_id IS NOT NULL
    )`;

  const [clientes, tarefas, eventos, leads, expansoes, equipe] = await Promise.all([
    db.execute<Row>(sql`
      WITH ${conta},
      servico AS (
        SELECT sc.empresa_id, sc.id, sc.service_family, sc.current_recurring_value AS mrr,
               (sc.portfolio_included AND sc.revenue_nature = 'MRR' AND sc.commercial_lifecycle = 'ACTIVE') AS ativo
          FROM servicos_canonicos sc JOIN conta c ON c.empresa_id = sc.empresa_id
      ),
      interacao AS (
        SELECT COALESCE(a.empresa_id, l.empresa_id) AS empresa_id, MAX(a.created_at) AS quando
          FROM atividades a LEFT JOIN leads l ON l.id = a.lead_id
         WHERE COALESCE(a.empresa_id, l.empresa_id) IN (SELECT empresa_id FROM conta)
         GROUP BY 1
      ),
      vencidas AS (
        SELECT f.empresa_id, COUNT(*)::int AS n, SUM(f.valor)::float AS valor,
               EXTRACT(DAY FROM now() - MIN(f.vencimento))::int AS dias
          FROM faturas f JOIN conta c ON c.empresa_id = f.empresa_id
         WHERE ${doCrm("f")} AND f.status = 'aberta' AND f.vencimento < now()
         GROUP BY 1
      ),
      health AS (
        SELECT DISTINCT ON (empresa_id) empresa_id, score
          FROM cs_health_snapshots ORDER BY empresa_id, calculated_at DESC
      ),
      /* MRR = o FATURADO como MRR no último fechamento (regra do Scott, 06/10; a mesma de
         mrr_atual e da Carteira). servicos_canonicos.current_recurring_value é o contratado e
         dava R$ 385 mil aqui contra R$ 476 mil no resto do produto. Quem assinou DEPOIS do
         fechamento entra pela assinatura ativa, na família do serviço dele. */
      fat AS (
        SELECT r.empresa_id, r.service_family AS f, SUM(r.valor)::float AS v
          FROM cliente_receita_mensal r
         WHERE r.organizacao_id = ${organizacaoId} AND r.revenue_nature = 'MRR' AND r.empresa_id IN (SELECT empresa_id FROM conta)
           AND r.competencia = (SELECT max(competencia) FROM cliente_receita_mensal WHERE organizacao_id = ${organizacaoId})
         GROUP BY 1, 2
      ),
      pos_fechamento AS (
        SELECT a.empresa_id, SUM(a.mrr)::float AS v
          FROM assinaturas a
         WHERE a.organizacao_id = ${organizacaoId} AND ${doCrm("a")} AND a.status = 'active' AND a.empresa_id IN (SELECT empresa_id FROM conta)
           AND NOT EXISTS (SELECT 1 FROM fat WHERE fat.empresa_id = a.empresa_id)
         GROUP BY 1
      )
      SELECT c.empresa_id AS id, c.nome, c.setor, c.principal, c.resp,
             to_char(c.inicio, 'YYYY-MM') AS inicio, c.cs_sem_evidencia,
             (COALESCE((SELECT SUM(v) FROM fat WHERE fat.empresa_id = c.empresa_id), 0)
              + COALESCE((SELECT v FROM pos_fechamento p WHERE p.empresa_id = c.empresa_id), 0))::float AS mrr,
             (SELECT jsonb_object_agg(x.f, x.v) FROM (
                SELECT fat.f, fat.v FROM fat WHERE fat.empresa_id = c.empresa_id AND fat.f <> 'UNKNOWN'
                UNION ALL
                SELECT (SELECT s.service_family FROM servico s WHERE s.empresa_id = c.empresa_id
                         ORDER BY s.ativo DESC, s.mrr DESC NULLS LAST LIMIT 1), p.v
                  FROM pos_fechamento p WHERE p.empresa_id = c.empresa_id) x
               WHERE x.f IS NOT NULL) AS mrr_fam,
             (SELECT s.id FROM servico s WHERE s.empresa_id = c.empresa_id
               ORDER BY s.ativo DESC, s.mrr DESC NULLS LAST LIMIT 1) AS servico_id,
             (SELECT s.service_family FROM servico s WHERE s.empresa_id = c.empresa_id
               ORDER BY s.ativo DESC, s.mrr DESC NULLS LAST LIMIT 1) AS produto,
             (EXISTS (SELECT 1 FROM servico s WHERE s.empresa_id = c.empresa_id AND s.ativo)
              OR EXISTS (SELECT 1 FROM fat WHERE fat.empresa_id = c.empresa_id)
              OR EXISTS (SELECT 1 FROM pos_fechamento p WHERE p.empresa_id = c.empresa_id)
              -- Ganho recente: ainda sem faturamento nem serviço de portfólio, mas com onboarding em curso.
              OR EXISTS (SELECT 1 FROM fulfillments f JOIN servico s ON s.id = f.servico_canonico_id
                          WHERE s.empresa_id = c.empresa_id AND f.status NOT IN ('COMPLETED','CANCELED'))) AS tem_ativo,
             EXISTS (SELECT 1 FROM fulfillments f JOIN servico s ON s.id = f.servico_canonico_id
                      WHERE s.empresa_id = c.empresa_id AND f.status NOT IN ('COMPLETED','CANCELED')) AS em_implantacao,
             i.quando IS NULL AS nunca,
             EXTRACT(DAY FROM now() - COALESCE(i.quando, c.inicio))::int AS dias_sem,
             h.score, v.n AS inad_n, v.valor AS inad_valor, v.dias AS inad_dias
        FROM conta c
        LEFT JOIN interacao i ON i.empresa_id = c.empresa_id
        LEFT JOIN vencidas v ON v.empresa_id = c.empresa_id
        LEFT JOIN health h ON h.empresa_id = c.empresa_id
       ORDER BY c.nome`),

    /* As 287 tarefas abertas do banco têm só lead_id (nenhuma tem empresa_id).
       Juntar só por empresa_id, como agendaCs() faz, mataria a tabela
       "Atividades de CS" inteira. Pelo lead da empresa entram as 42 reais. */
    db.execute<Row>(sql`
      WITH ${conta}
      SELECT t.id, t.titulo, t.tipo, t.status, t.concluida, t.prioridade, c.nome AS empresa, u.nome AS resp,
             CASE WHEN t.concluida THEN t.concluida_em ELSE COALESCE(t.vence_em, t.data_vencimento::timestamptz) END AS quando,
             (t.concluida OR t.vence_em IS NOT NULL) AS tem_hora
        FROM tarefas t
        LEFT JOIN leads l ON l.id = t.lead_id
        JOIN conta c ON c.empresa_id = COALESCE(t.empresa_id, l.empresa_id)
        LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.organizacao_id = ${organizacaoId}
         AND (t.concluida = false OR t.concluida_em > now() - interval '30 days')`),

    // As três últimas interações por conta: é o que "Atividades recentes" lê.
    db.execute<Row>(sql`
      WITH ${conta}
      SELECT x.empresa_id, x.created_at AS quando, x.tipo, x.titulo, x.autor FROM (
        SELECT c.empresa_id, a.created_at, a.tipo, a.titulo,
               COALESCE(u.nome, a.usuario_display_name) AS autor,
               ROW_NUMBER() OVER (PARTITION BY c.empresa_id ORDER BY a.created_at DESC) AS rn
          FROM atividades a
          LEFT JOIN leads l ON l.id = a.lead_id
          JOIN conta c ON c.empresa_id = COALESCE(a.empresa_id, l.empresa_id)
          LEFT JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.timeline_visible) x
       WHERE x.rn <= 3`),

    // Um lead por conta: origem real para o donut e o lead para "Falar com cliente".
    db.execute<Row>(sql`
      WITH ${conta}
      SELECT DISTINCT ON (c.empresa_id) c.nome AS empresa, l.id, l.origem
        FROM conta c LEFT JOIN leads l ON l.empresa_id = c.empresa_id
       ORDER BY c.empresa_id, (NULLIF(l.origem, '') IS NULL), l.created_at DESC`),

    db.execute<Row>(sql`
      WITH ${conta}
      -- etapa canonica (Bloco 02 §9): o campo vira o rotulo da expansao
      -- na tela, e status escreveria 'outra_data' / 'trava_negociacao'.
      -- QA pós-venda 06/10: expansão da carga tem etapa NULL (status 'ativo');
      -- sem COALESCE o filtro abaixo descartava todas e a tela mostrava zero.
      SELECT n.id, c.nome AS empresa, COALESCE(n.etapa, 'entrada') AS etapa, n.valor_total::float AS valor
        FROM negocios n JOIN conta c ON c.empresa_id = n.empresa_id
       WHERE n.organizacao_id = ${organizacaoId} AND n.commercial_motion = 'EXPANSION'
         AND n.status NOT IN ('ganho','perdido') AND COALESCE(n.etapa, '') NOT IN ('ganho','perdido')`),

    db.execute<Row>(sql`
      SELECT id, nome FROM usuarios
       WHERE organizacao_id = ${organizacaoId} AND ativo = true ORDER BY (tipo = 'agente' OR agente_id IS NOT NULL), nome`),
  ]);

  const cr = await carteiraEmRisco(organizacaoId);
  return {
    risco: {
      criticoEmRisco: cr.resumo.porSeveridade.CRITICO + cr.resumo.porSeveridade.EM_RISCO,
      mrrCriticoEmRisco: cr.resumo.mrrPorSeveridade.CRITICO + cr.resumo.mrrPorSeveridade.EM_RISCO,
      atencao: cr.resumo.porSeveridade.ATENCAO,
      semResponsavel: cr.resumo.semResponsavel,
    },
    faturamento: await faturamentoMensal(organizacaoId),
    clientes: clientes.map((r): ClienteDaTela => {
      const mrrFam: Record<string, number> = {};
      for (const f of FAMILIAS) mrrFam[f] = Number(r.mrr_fam?.[f] ?? 0);
      return {
        id: r.id, nome: r.nome, mrr: Number(r.mrr ?? 0), mrrFam,
        produto: (FAMILIAS as readonly string[]).includes(r.produto) ? r.produto : null,
        servicoId: r.servico_id ?? null,
        /* 90 contas têm `cs_sem_evidencia`: o cliente_desde delas é a data da
           reconciliação (ago/2026), não a de quando viraram cliente. Mandar
           isso faria o gráfico de 12 meses "crescer" R$ 100 mil em agosto.
           "0000-01" diz ao desenho "ativa desde sempre" (ativoEm compara
           string) e o adaptador tira essas contas do tempo médio de vida e do
           comparativo de 12 meses, que é onde a data importa. */
        inicio: r.cs_sem_evidencia ? INICIO_SEM_EVIDENCIA : r.inicio,
        semEvidencia: !!r.cs_sem_evidencia,
        /* Sem serviço ativo a conta saiu. A data de churn não existe de forma
           confiável (as datas dos serviços canônicos são da reconciliação),
           então fim = início: a conta conta como inativa e não entra em mês
           nenhum do histórico, em vez de ganhar uma data de saída inventada. */
        fim: r.tem_ativo ? null : (r.cs_sem_evidencia ? INICIO_SEM_EVIDENCIA : r.inicio),
        saude: Number(r.score ?? 0),
        ultima: ultimaDoDesenho(Number(r.dias_sem ?? 0)),
        nunca: !!r.nunca,
        resp: r.resp ?? null,
        segmento: r.setor ?? null,
        status: r.em_implantacao ? "Em implantação" : null,
        principal: r.principal ?? null,
        inad: r.inad_n ? { dias: Number(r.inad_dias), valor: Number(r.inad_valor), n: Number(r.inad_n) } : null,
      };
    }),
    tarefas: tarefas.map((r) => ({
      id: r.id, titulo: r.titulo, tipo: r.tipo, empresa: r.empresa, resp: r.resp ?? null,
      situacao: r.concluida ? "concluida" : r.status, prioridade: r.prioridade,
      quando: r.quando ? new Date(r.quando).toISOString() : null, temHora: !!r.tem_hora,
    })),
    eventos: eventos.map((r) => ({
      empresaId: r.empresa_id, quando: new Date(r.quando).toISOString(),
      t: r.titulo || r.tipo, autor: r.autor ?? null, cat: r.tipo,
    })),
    leads: leads.map((r) => ({ id: r.id ?? null, empresa: r.empresa, origem: r.origem || "" })),
    expansoes: expansoes.map((r) => ({
      id: r.id, empresa: r.empresa, etapa: ROTULO_ETAPA_PIPELINE[r.etapa as EtapaPipeline] ?? r.etapa, tipo: "expansao" as const,
      itens: r.valor ? [{ natureza: "MRR", valor: r.valor, qtd: 1 }] : [],
    })),
    equipe: equipe.map((r) => ({ id: r.id, nome: r.nome })),
  };
}
