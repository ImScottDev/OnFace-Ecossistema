import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { parsePeriodo } from "@/lib/relatorios/periodo";

/**
 * Performance por pessoa — esforço E resultado na mesma linha.
 *
 * Já existiam duas leituras separadas no Hono: `/relatorios/equipe` (resultado,
 * só closers) e `/relatorios/atividade-time` (esforço dia a dia). A tela de
 * Performance precisa das duas lado a lado, porque olhar só resultado esconde
 * quem está trabalhando sem converter, e olhar só esforço esconde quem converte
 * com pouco volume. As regras abaixo copiam as daquelas rotas de propósito:
 *
 * - Esforço: ligações, WhatsApp enviado, notas, mudanças de etapa e tarefas
 *   concluídas, pelas mesmas colunas de `/atividade-time`. `whatsapp_mensagens`
 *   e `status_changes` não têm organizacao_id: o tenant entra pela lista de
 *   usuários da org (mesmo recorte do Hono).
 * - Reuniões agendadas: a régua da meta da SDR em `lib/metas.ts`
 *   (getRealizadoMeta "reunioes_agendadas") — status_change para
 *   reuniao_agendada feito pela pessoa no lead que é DELA.
 * - Faturamento fechado: mrr_fechado + valor_setup dos ganhos com ganho_at na
 *   janela — a mesma soma de VALOR_FECHADO em `lib/metas.ts`. Nunca valor_total
 *   (diverge da composição em 174 dos 309 ganhos e tem linha negativa).
 * - Perdidos: EVENTO de perda na janela (status_changes), como
 *   getPerdidosPorResponsavel — não coorte de criação.
 */

export const PERIODOS_PERFORMANCE = [
  { chave: "30d", rotulo: "30 dias" },
  { chave: "mes_atual", rotulo: "Mês atual" },
  { chave: "mes_passado", rotulo: "Mês passado" },
  { chave: "90d", rotulo: "90 dias" },
] as const;

export type PeriodoPerformance = (typeof PERIODOS_PERFORMANCE)[number]["chave"];

export function ehPeriodoPerformance(v: unknown): v is PeriodoPerformance {
  return PERIODOS_PERFORMANCE.some((p) => p.chave === v);
}

export interface LinhaPerformance {
  usuarioId: string;
  nome: string;
  papel: string;
  ligacoes: number;
  minutosLigacao: number;
  whatsapp: number;
  notas: number;
  etapas: number;
  tarefas: number;
  /** Soma das cinco formas de esforço: o "quanto trabalhou". */
  esforco: number;
  reunioesAgendadas: number;
  ganhos: number;
  perdidos: number;
  /** ganhos / (ganhos + perdidos). Null quando não houve desfecho — 0% mentiria. */
  conversao: number | null;
  faturamento: number;
}

export interface Performance {
  since: Date;
  until: Date;
  linhas: LinhaPerformance[];
  /** Pessoas ativas sem nenhum movimento no período. Saem da tabela mas são
   *  nomeadas no rodapé: sumir em silêncio esconderia justamente quem parou. */
  semMovimento: string[];
  /** Ligações da janela que não entram em nenhuma linha (usuario_id nulo ou de
   *  quem não é usuário ativo). Mesma regra do /atividade-time; o número vai no
   *  rodapé para o total da tela não parecer o total da operação. */
  ligacoesSemUsuario: number;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

export async function getPerformance(
  organizacaoId: string,
  periodo: PeriodoPerformance,
  /** Visão pessoal (closer/SDR): só a própria linha. Mesma blindagem do /equipe. */
  soUsuarioId: string | null,
): Promise<Performance> {
  const { since, until } = parsePeriodo(periodo);
  const de = since.toISOString();
  const ate = until.toISOString();

  const linhas = (await db.execute(sql`
    WITH u AS (
      SELECT id, nome, role FROM usuarios
       WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true
         ${soUsuarioId ? sql`AND id = ${soUsuarioId}::uuid` : sql``}
    ),
    lig AS (
      SELECT usuario_id AS id, count(*) AS qtd, COALESCE(sum(duracao_segundos), 0) AS seg
        FROM ligacoes
       WHERE organizacao_id = ${organizacaoId}::uuid AND usuario_id IN (SELECT id FROM u)
         AND created_at >= ${de}::timestamptz AND created_at < ${ate}::timestamptz
       GROUP BY usuario_id
    ),
    wa AS (
      SELECT enviado_por_id AS id, count(*) AS qtd FROM whatsapp_mensagens
       WHERE direcao = 'out' AND enviado_por_id IN (SELECT id FROM u)
         AND created_at >= ${de}::timestamptz AND created_at < ${ate}::timestamptz
       GROUP BY enviado_por_id
    ),
    nt AS (
      SELECT autor_id AS id, count(*) AS qtd FROM notas
       WHERE organizacao_id = ${organizacaoId}::uuid AND autor_id IN (SELECT id FROM u)
         AND created_at >= ${de}::timestamptz AND created_at < ${ate}::timestamptz
       GROUP BY autor_id
    ),
    et AS (
      SELECT usuario_id AS id, count(*) AS qtd FROM status_changes
       WHERE usuario_id IN (SELECT id FROM u)
         AND created_at >= ${de}::timestamptz AND created_at < ${ate}::timestamptz
       GROUP BY usuario_id
    ),
    tf AS (
      SELECT usuario_id AS id, count(*) AS qtd FROM tarefas
       WHERE organizacao_id = ${organizacaoId}::uuid AND concluida = true AND usuario_id IN (SELECT id FROM u)
         AND concluida_em >= ${de}::timestamptz AND concluida_em < ${ate}::timestamptz
       GROUP BY usuario_id
    ),
    re AS (
      SELECT sc.usuario_id AS id, count(DISTINCT sc.lead_id) AS qtd
        FROM status_changes sc
        JOIN leads l ON l.id = sc.lead_id AND l.responsavel_id = sc.usuario_id
       WHERE l.organizacao_id = ${organizacaoId}::uuid AND sc.usuario_id IN (SELECT id FROM u)
         AND sc.para_status = 'reuniao_agendada'
         AND sc.created_at >= ${de}::timestamptz AND sc.created_at < ${ate}::timestamptz
       GROUP BY sc.usuario_id
    ),
    gn AS (
      SELECT responsavel_id AS id, count(*) AS qtd,
             COALESCE(sum(COALESCE(mrr_fechado,0)::numeric + COALESCE(valor_setup,0)::numeric), 0) AS valor
        FROM negocios
       WHERE organizacao_id = ${organizacaoId}::uuid AND status = 'ganho' AND responsavel_id IN (SELECT id FROM u)
         AND ganho_at >= ${de}::timestamptz AND ganho_at < ${ate}::timestamptz
       GROUP BY responsavel_id
    ),
    pd AS (
      SELECT n.responsavel_id AS id, count(DISTINCT n.id) AS qtd
        FROM status_changes sc JOIN negocios n ON n.id = sc.negocio_id
       WHERE n.organizacao_id = ${organizacaoId}::uuid AND n.responsavel_id IN (SELECT id FROM u)
         AND sc.para_status = 'perdido'
         AND sc.created_at >= ${de}::timestamptz AND sc.created_at < ${ate}::timestamptz
       GROUP BY n.responsavel_id
    )
    SELECT u.id::text AS id, u.nome, u.role,
           lig.qtd AS ligacoes, lig.seg AS segundos, wa.qtd AS whatsapp, nt.qtd AS notas,
           et.qtd AS etapas, tf.qtd AS tarefas, re.qtd AS reunioes,
           gn.qtd AS ganhos, gn.valor AS faturamento, pd.qtd AS perdidos
      FROM u
      LEFT JOIN lig ON lig.id = u.id LEFT JOIN wa ON wa.id = u.id
      LEFT JOIN nt ON nt.id = u.id LEFT JOIN et ON et.id = u.id
      LEFT JOIN tf ON tf.id = u.id LEFT JOIN re ON re.id = u.id
      LEFT JOIN gn ON gn.id = u.id LEFT JOIN pd ON pd.id = u.id
  `)) as unknown as Record<string, unknown>[];

  // Só na visão de gestão: na pessoal a pergunta é "as minhas", não a operação.
  const [fora] = soUsuarioId
    ? [{ qtd: 0 }]
    : ((await db.execute(sql`
        SELECT count(*)::int AS qtd FROM ligacoes
         WHERE organizacao_id = ${organizacaoId}::uuid
           AND created_at >= ${de}::timestamptz AND created_at < ${ate}::timestamptz
           AND (usuario_id IS NULL OR usuario_id NOT IN (
             SELECT id FROM usuarios WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true))
      `)) as unknown as { qtd: number }[]);

  const todas: LinhaPerformance[] = linhas.map((r) => {
    const ganhos = n(r.ganhos);
    const perdidos = n(r.perdidos);
    const l = {
      usuarioId: String(r.id),
      nome: String(r.nome ?? "—"),
      papel: String(r.role ?? ""),
      ligacoes: n(r.ligacoes),
      minutosLigacao: Math.round(n(r.segundos) / 60),
      whatsapp: n(r.whatsapp),
      notas: n(r.notas),
      etapas: n(r.etapas),
      tarefas: n(r.tarefas),
      esforco: 0,
      reunioesAgendadas: n(r.reunioes),
      ganhos,
      perdidos,
      conversao: ganhos + perdidos > 0 ? ganhos / (ganhos + perdidos) : null,
      faturamento: n(r.faturamento),
    };
    l.esforco = l.ligacoes + l.whatsapp + l.notas + l.etapas + l.tarefas;
    return l;
  });

  const tem = (l: LinhaPerformance) => l.esforco > 0 || l.ganhos > 0 || l.perdidos > 0 || l.reunioesAgendadas > 0;
  return {
    since,
    until,
    linhas: todas.filter(tem),
    semMovimento: todas.filter((l) => !tem(l)).map((l) => l.nome).sort((a, b) => a.localeCompare(b, "pt-BR")),
    ligacoesSemUsuario: n(fora?.qtd),
  };
}

export const ORDENS_PERFORMANCE = ["faturamento", "ganhos", "conversao", "reunioesAgendadas", "esforco", "ligacoes", "nome"] as const;
export type OrdemPerformance = (typeof ORDENS_PERFORMANCE)[number];

export function ordenarPerformance(linhas: LinhaPerformance[], ordem: OrdemPerformance): LinhaPerformance[] {
  if (ordem === "nome") return [...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  // Conversão nula (sem desfecho) vai pro fim: não é pior que 0%, é ausência de dado.
  return [...linhas].sort((a, b) => (b[ordem] ?? -1) - (a[ordem] ?? -1) || b.esforco - a.esforco);
}
