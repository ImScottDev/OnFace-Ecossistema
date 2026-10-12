/**
 * Ferramentas do NEXO: a inteligência do ecossistema, agindo COMO o usuário.
 *
 * Regras (as do Scott, 08/10):
 * - toda escrita passa por porta de domínio (lib/vendas, lib/tarefas, motor de
 *   ações); nada de SQL de escrita aqui;
 * - o teto de permissão é o do usuário logado (permissão delegada = versão ∩
 *   usuário, resolvida no executeAgent). A checagem por ferramenta está em
 *   PERMISSAO_POR_FERRAMENTA; a que depende do alvo (lead x oportunidade) é
 *   feita aqui, com a mesma lista, e recusa dizendo QUAL permissão falta;
 * - ator = o usuário, marcado "via NEXO" (`ref: nexo:<runId>`, source nexo);
 * - leitura respeita o escopo do papel (SDR/closer/vendedor: o que é deles);
 * - ação que envia mensagem externa, apaga dado ou é irreversível NÃO executa
 *   no turno: devolve `aguardandoConfirmacao` e o chat mostra o botão Confirmar
 *   (rota /nexo/acoes/confirmar). Todo o resto executa direto;
 * - Ganho não tem ferramenta: é regra do domínio (gate comercial).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { isAdminView, isPersonalView } from "@/lib/auth/roles";
import { RegraDeNegocio, ETAPAS_PRE_VENDAS, MOTIVOS_NUTRICAO, MOTIVOS_DESQUALIFICACAO, MOTIVOS_PERDA, ETAPAS_PIPELINE, FAMILIAS, type Ator, type EtapaPreVendas, type EtapaPipelineAberta } from "@/lib/vendas/dominio";
import * as preVendas from "@/lib/vendas/pre-vendas";
import * as pipeline from "@/lib/vendas/pipeline";
// Carregado sob demanda: cadence-engine importa o registro de ferramentas, e um import estático
// aqui fecha o ciclo registry -> ferramentas -> cadence-engine -> registry (NEXO_TOOLS ainda sem valor).
const motorDeCadencia = () => import("@/lib/cadencia/cadence-engine");
import { resolverEmpresa, resolverPessoa, garantirRegistroDeContato } from "@/lib/vendas/identidade";
import { criarTarefa, alterarTarefa, excluirTarefa, TIPOS_TAREFA, PRIORIDADES_TAREFA, STATUS_TAREFA } from "@/lib/tarefas/portas";
import { CATALOGO, medir } from "@/lib/metricas/catalogo";
import { condicaoMinhasConversas, veTodasAsConversas } from "@/lib/whatsapp/acesso";
import type { AgentToolContext, AgentToolRegistration } from "@/lib/ai-platform/tools/registry";

type R = { ok: boolean; data?: unknown; error?: string };
const objectSchema = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (description: string) => ({ type: "string", description });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quem fala com o NEXO. Sem usuário, nenhuma ferramenta do painel roda. */
async function eu(ctx: AgentToolContext) {
  if (!ctx.usuarioId) return null;
  const [u] = await db.execute<{ id: string; nome: string; role: string }>(sql`
    SELECT id::text, nome, role FROM usuarios WHERE id = ${ctx.usuarioId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid AND ativo`);
  if (!u) return null;
  return { userId: u.id, nome: u.nome, role: u.role, pessoal: isPersonalView(u.role), gestao: isAdminView(u.role) };
}
type Eu = NonNullable<Awaited<ReturnType<typeof eu>>>;

const ator = (ctx: AgentToolContext, u: Eu): Ator => ({ tipo: "AI_AGENT", usuarioId: u.userId, ref: `nexo:${ctx.runId}` });
const tarefaAtor = (ctx: AgentToolContext, u: Eu) => ({ organizacaoId: ctx.organizacaoId, userId: u.userId, userRole: u.role, via: "nexo", runId: ctx.runId });

/** Permissão que falta, dita com todas as letras. */
const falta = (ctx: AgentToolContext, codigo: string): R | null =>
  (ctx.permissoesDelegadas as Set<string> | undefined)?.has(codigo) ? null : { ok: false, error: `sem permissão: esta ação exige ${codigo} e o papel do usuário não a concede.` };

/** Só o que é do usuário, para papéis pessoais. `null` = sem dono (pode assumir). */
const meuAlvo = (u: Eu, responsavelId: string | null) => !u.pessoal || responsavelId === null || responsavelId === u.userId;
const alheio = (): R => ({ ok: false, error: "este registro é de outra pessoa e o papel do usuário só age sobre o que é dele." });

const resumo = (texto: string, href?: string, extra: Record<string, unknown> = {}): R => ({ ok: true, data: { mudou: true, resumo: texto, href: href ?? null, ...extra } });

/** Executa só em modo live; em teste devolve a prévia. Regra de negócio vira erro legível. */
async function agir(ctx: AgentToolContext, operacao: string, input: Record<string, unknown>, fn: () => Promise<R>): Promise<R> {
  if (ctx.mode !== "live") return { ok: true, data: { preview: true, operacao, input } };
  try { return await fn(); } catch (e) {
    if (e instanceof RegraDeNegocio) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Confirmação explícita no chat para o que envia, apaga ou não desfaz. */
async function comConfirmacao(ctx: AgentToolContext, operacao: string, rotulo: string, input: Record<string, unknown>, fn: () => Promise<R>): Promise<R> {
  if (ctx.mode === "live" && !ctx.confirmado) return { ok: true, data: { aguardandoConfirmacao: true, operacao, rotulo, input } };
  return agir(ctx, operacao, input, fn);
}

const when = (v: unknown) => (v ? String(v) : null);
const lim = (v: unknown, def = 15, max = 30) => Math.min(max, Math.max(1, Number(v ?? def) || def));
const dataCivil = (v: unknown): string | null => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const data = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === v ? v : null;
};
const hojeSP = sql`date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`;

/** Leitura é consulta direta (ler não tem efeito colateral a coordenar). */
const leitura = (id: string, descricao: string, parametros: Record<string, unknown>, obrigatorios: string[], exec: (ctx: AgentToolContext, u: Eu, i: Record<string, unknown>) => Promise<R>): AgentToolRegistration => ({
  id: `nexo.${id}`, name: `nexo_${id}`, description: descricao, category: "context", mutates: false, parameters: objectSchema(parametros, obrigatorios),
  execute: async (ctx, i) => { const u = await eu(ctx); return u ? exec(ctx, u, i) : { ok: false, error: "usuário não identificado" }; },
});
const escrita = (id: string, descricao: string, parametros: Record<string, unknown>, obrigatorios: string[], exec: (ctx: AgentToolContext, u: Eu, i: Record<string, unknown>) => Promise<R>): AgentToolRegistration => ({
  id: `nexo.${id}`, name: `nexo_${id}`, description: descricao, category: "operation", mutates: true, parameters: objectSchema(parametros, obrigatorios),
  execute: async (ctx, i) => { const u = await eu(ctx); return u ? exec(ctx, u, i) : { ok: false, error: "usuário não identificado" }; },
});

export const NEXO_TOOLS: AgentToolRegistration[] = [
  /* ── Leitura ─────────────────────────────────────────────────────────── */
  leitura("entradas", "Leads/aquisições que ENTRARAM num dia ou intervalo, inclusive os que já saíram de Pré-vendas. Informe de e ate como datas YYYY-MM-DD no fuso de São Paulo. Devolve campanha/origem e cobertura da atribuição; nunca adivinhe campanha ausente.",
    { de: str("YYYY-MM-DD, início inclusivo"), ate: str("YYYY-MM-DD, fim inclusivo; padrão de"), campanha: str("parte do nome da campanha"), limite: { type: "integer", minimum: 1, maximum: 50 } }, ["de"],
    async (ctx, u, i) => {
      if (u.role === "leitor") return { ok: false, error: "o papel leitor não consulta registros individuais" };
      const de = dataCivil(i.de); const ate = dataCivil(i.ate ?? i.de);
      if (!de || !ate || ate < de) return { ok: false, error: "Informe de/ate válidos no formato YYYY-MM-DD." };
      const campanha = i.campanha ? `%${String(i.campanha).replace(/[%_\\]/g, "\\$&")}%` : null;
      const base = sql`a.organizacao_id = ${ctx.organizacaoId}::uuid
        AND a.created_at >= (${de}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND a.created_at < ((${ate}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND (${u.pessoal}::boolean = false OR a.responsavel_id = ${u.userId}::uuid)
        AND (${campanha}::text IS NULL OR COALESCE(NULLIF(pc.campaign, ''), NULLIF(l.utm_campaign, ''), '') ILIKE ${campanha})`;
      const origem = sql`FROM aquisicoes a
        LEFT JOIN leads l ON l.id = a.lead_legado_id AND l.organizacao_id = a.organizacao_id
        LEFT JOIN pessoas p ON p.id = a.pessoa_id AND p.organizacao_id = a.organizacao_id
        LEFT JOIN empresas e ON e.id = a.empresa_id AND e.organizacao_id = a.organizacao_id
        LEFT JOIN LATERAL (SELECT campaign, campaign_id, source FROM pontos_contato pc0
          WHERE pc0.organizacao_id = a.organizacao_id AND (pc0.aquisicao_id = a.id OR pc0.lead_id_legado = a.lead_legado_id)
          ORDER BY (pc0.aquisicao_id = a.id) DESC, pc0.is_first_touch DESC, pc0.ocorrido_em ASC LIMIT 1) pc ON TRUE`;
      const [tot] = await db.execute<{ n: number; sem_campanha: number }>(sql`
        SELECT count(*)::int n, count(*) FILTER (WHERE COALESCE(NULLIF(pc.campaign, ''), NULLIF(l.utm_campaign, '')) IS NULL)::int sem_campanha
        ${origem} WHERE ${base}`);
      const rows = await db.execute(sql`
        SELECT a.id::text id, a.created_at AS entrada_em, COALESCE(p.nome, l.nome, e.nome, 'Sem nome') nome,
               COALESCE(e.nome, l.empresa) empresa, COALESCE(pc.source, l.utm_source, a.origem) origem,
               COALESCE(NULLIF(pc.campaign, ''), NULLIF(l.utm_campaign, '')) campanha, COALESCE(pc.campaign_id, l.meta_campaign_id) campanha_id,
               u2.nome responsavel, CASE WHEN a.lead_legado_id IS NOT NULL THEN '/pessoas/' || a.lead_legado_id::text ELSE '/pre-vendas' END href
          ${origem} LEFT JOIN usuarios u2 ON u2.id = a.responsavel_id
         WHERE ${base} ORDER BY a.created_at DESC LIMIT ${lim(i.limite, 20, 50)}`);
      return { ok: true, data: { fonte: "aquisicoes + pontos_contato (fallback leads)", filtros: { de, ate, campanha: i.campanha ?? null, escopo: u.pessoal ? "meus" : "organizacao" }, total: tot?.n ?? 0, semCampanha: tot?.sem_campanha ?? 0, leads: rows } };
    }),
  leitura("horarios_entrada", "Distribuição real da chegada de leads/aquisições por dia da semana e hora local. Para quinta-feira use dia_semana=4. Padrão: últimos 90 dias. Mostre período e volume da amostra.",
    { de: str("YYYY-MM-DD, opcional"), ate: str("YYYY-MM-DD, opcional"), dia_semana: { type: "integer", minimum: 1, maximum: 7 } }, [],
    async (ctx, u, i) => {
      const de = i.de == null ? null : dataCivil(i.de); const ate = i.ate == null ? null : dataCivil(i.ate);
      if ((i.de != null && !de) || (i.ate != null && !ate) || (de && ate && ate < de)) return { ok: false, error: "Período inválido: use YYYY-MM-DD." };
      const dia = i.dia_semana == null ? null : Number(i.dia_semana);
      if (dia != null && (!Number.isInteger(dia) || dia < 1 || dia > 7)) return { ok: false, error: "dia_semana deve ser 1 (segunda) a 7 (domingo)." };
      const rows = await db.execute<{ dia_semana: number; hora: number; total: number }>(sql`
        SELECT EXTRACT(isodow FROM a.created_at AT TIME ZONE 'America/Sao_Paulo')::int dia_semana,
               EXTRACT(hour FROM a.created_at AT TIME ZONE 'America/Sao_Paulo')::int hora, count(*)::int total
          FROM aquisicoes a WHERE a.organizacao_id = ${ctx.organizacaoId}::uuid
           AND a.created_at >= COALESCE((${de}::date::timestamp AT TIME ZONE 'America/Sao_Paulo'), now() - interval '90 days')
           AND a.created_at < COALESCE(((${ate}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'), now())
           AND (${u.pessoal}::boolean = false OR a.responsavel_id = ${u.userId}::uuid)
           AND (${dia}::int IS NULL OR EXTRACT(isodow FROM a.created_at AT TIME ZONE 'America/Sao_Paulo')::int = ${dia})
         GROUP BY 1, 2 ORDER BY total DESC, dia_semana, hora`);
      return { ok: true, data: { fonte: "aquisicoes.created_at", fuso: "America/Sao_Paulo", periodo: { de: de ?? "ultimos_90_dias", ate: ate ?? "agora" }, amostra: rows.reduce((n, x) => n + x.total, 0), horarios: rows } };
    }),
  leitura("atividades", "Lista atividades (tarefas) do CRM. filtro: abertas, atrasadas, hoje, semana (próximos 7 dias), concluidas_semana. escopo=equipe só vale para gestão.",
    { filtro: { type: "string", enum: ["abertas", "atrasadas", "hoje", "semana", "concluidas_semana"] }, escopo: { type: "string", enum: ["minhas", "equipe"] }, limite: { type: "integer", minimum: 1, maximum: 30 } }, ["filtro"],
    async (ctx, u, i) => {
      const filtro = String(i.filtro); const limite = lim(i.limite);
      const soDele = u.pessoal || i.escopo !== "equipe";
      const prazo = sql`COALESCE(t.vence_em, t.data_vencimento::timestamptz)`;
      const f = filtro === "atrasadas" ? sql`t.concluida = false AND ${prazo} < now()`
        : filtro === "hoje" ? sql`t.concluida = false AND (${prazo} AT TIME ZONE 'America/Sao_Paulo') >= ${hojeSP} AND (${prazo} AT TIME ZONE 'America/Sao_Paulo') < ${hojeSP} + interval '1 day'`
        : filtro === "semana" ? sql`t.concluida = false AND (${prazo} AT TIME ZONE 'America/Sao_Paulo') >= ${hojeSP} AND (${prazo} AT TIME ZONE 'America/Sao_Paulo') < ${hojeSP} + interval '7 days'`
        : filtro === "concluidas_semana" ? sql`t.concluida = true AND t.concluida_em >= now() - interval '7 days'`
        : sql`t.concluida = false`;
      const onde = sql`t.organizacao_id = ${ctx.organizacaoId}::uuid AND ${f} AND (${soDele}::boolean = false OR t.usuario_id = ${u.userId}::uuid)`;
      const rows = await db.execute(sql`
        SELECT t.id::text AS id, t.titulo, t.tipo, t.prioridade, t.status, ${prazo} AS prazo, usr.nome AS responsavel, COALESCE(e.nome, l.empresa, l.nome) AS vinculo,
               '/tarefas?atv=' || t.id::text AS href
          FROM tarefas t LEFT JOIN usuarios usr ON usr.id = t.usuario_id LEFT JOIN leads l ON l.id = t.lead_id LEFT JOIN empresas e ON e.id = t.empresa_id
         WHERE ${onde} ORDER BY ${prazo} ASC NULLS LAST LIMIT ${limite}`);
      const [tot] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM tarefas t WHERE ${onde}`);
      return { ok: true, data: { escopo: soDele ? "só as dele" : "organização inteira", total: tot?.n ?? 0, mostradas: rows.length, atividades: rows } };
    }),
  leitura("agenda", "Reuniões do calendário num intervalo (padrão: hoje até 7 dias). de/ate em ISO.", { de: str("ISO"), ate: str("ISO"), limite: { type: "integer" } }, [],
    async (ctx, u, i) => {
      const de = i.de ? new Date(String(i.de)) : null; const ate = i.ate ? new Date(String(i.ate)) : null;
      const rows = await db.execute(sql`
        SELECT r.id::text AS id, r.titulo, r.data, r.duracao, r.tipo, r.status, usr.nome AS responsavel, r.negocio_id::text AS negocio_id,
               CASE WHEN r.negocio_id IS NOT NULL THEN '/pipeline/' || r.negocio_id::text WHEN r.lead_id IS NOT NULL THEN '/pessoas/' || r.lead_id::text ELSE '/calendario' END AS href
          FROM reunioes r LEFT JOIN usuarios usr ON usr.id = r.responsavel_id
         WHERE r.organizacao_id = ${ctx.organizacaoId}::uuid
           AND r.data >= COALESCE(${de ? de.toISOString() : null}::timestamptz, ${hojeSP} AT TIME ZONE 'America/Sao_Paulo')
           AND r.data < COALESCE(${ate ? ate.toISOString() : null}::timestamptz, now() + interval '7 days')
           AND (${u.pessoal}::boolean = false OR r.responsavel_id = ${u.userId}::uuid)
         ORDER BY r.data LIMIT ${lim(i.limite, 20, 40)}`);
      return { ok: true, data: { reunioes: rows } };
    }),
  leitura("leads", "Leads de Pré-vendas (cards). etapa: novo, em_contato, qualificacao, qualificado, nutricao, desqualificado. sem_proxima_acao=true só os sem tarefa aberta.",
    { etapa: str("etapa de pré-vendas"), sem_proxima_acao: { type: "boolean" }, termo: str("parte do nome/empresa"), limite: { type: "integer" } }, [],
    async (ctx, u, i) => {
      const etapa = i.etapa ? String(i.etapa) : null; const termo = i.termo ? `%${String(i.termo).replace(/[%_\\]/g, "\\$&")}%` : null;
      const onde = sql`l.organizacao_id = ${ctx.organizacaoId}::uuid AND l.estagio_pre_vendas IS NOT NULL
        AND (${etapa}::text IS NULL OR l.estagio_pre_vendas = ${etapa})
        AND (${u.pessoal}::boolean = false OR l.responsavel_id = ${u.userId}::uuid)
        AND (${termo}::text IS NULL OR l.nome ILIKE ${termo} OR l.empresa ILIKE ${termo})
        AND (${i.sem_proxima_acao === true}::boolean = false OR NOT EXISTS (SELECT 1 FROM tarefas t WHERE t.lead_id = l.id AND t.status NOT IN ('concluida', 'declinada')))`;
      const rows = await db.execute(sql`
        SELECT l.id::text AS id, l.nome, l.empresa, l.estagio_pre_vendas AS etapa, usr.nome AS responsavel, l.created_at, '/pessoas/' || l.id::text AS href
          FROM leads l LEFT JOIN usuarios usr ON usr.id = l.responsavel_id WHERE ${onde} ORDER BY l.updated_at DESC LIMIT ${lim(i.limite)}`);
      const [tot] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM leads l WHERE ${onde}`);
      return { ok: true, data: { escopo: u.pessoal ? "só os dele" : "organização inteira", total: tot?.n ?? 0, leads: rows } };
    }),
  leitura("pipeline", "Oportunidades do Pipeline (cards). etapa: entrada, diagnostico, proposta, negociacao (abertas) ou ganho/perdido (só leitura).",
    { etapa: str("etapa"), termo: str("título/empresa"), limite: { type: "integer" } }, [],
    async (ctx, u, i) => {
      const etapa = i.etapa ? String(i.etapa) : null; const termo = i.termo ? `%${String(i.termo).replace(/[%_\\]/g, "\\$&")}%` : null;
      const onde = sql`n.organizacao_id = ${ctx.organizacaoId}::uuid
        AND (${etapa}::text IS NULL AND n.etapa IN ('entrada','diagnostico','proposta','negociacao') OR n.etapa = ${etapa})
        AND (${u.pessoal}::boolean = false OR n.responsavel_id = ${u.userId}::uuid)
        AND (${termo}::text IS NULL OR n.titulo ILIKE ${termo} OR e.nome ILIKE ${termo})`;
      const rows = await db.execute(sql`
        SELECT n.id::text AS id, n.titulo, e.nome AS empresa, n.etapa, n.valor_total AS valor, n.previsao_fechamento, usr.nome AS responsavel, '/pipeline/' || n.id::text AS href
          FROM negocios n LEFT JOIN empresas e ON e.id = n.empresa_id LEFT JOIN usuarios usr ON usr.id = n.responsavel_id
         WHERE ${onde} ORDER BY n.updated_at DESC LIMIT ${lim(i.limite)}`);
      const [tot] = await db.execute<{ n: number; v: string | null }>(sql`SELECT count(*)::int AS n, sum(n.valor_total)::text AS v FROM negocios n LEFT JOIN empresas e ON e.id = n.empresa_id WHERE ${onde}`);
      return { ok: true, data: { escopo: u.pessoal ? "só as dele" : "organização inteira", total: tot?.n ?? 0, valorTotal: tot?.v ?? null, oportunidades: rows } };
    }),
  leitura("propostas", "Propostas comerciais (número, versão, status, valor). status opcional.", { status: str("rascunho, enviada, visualizada, ajuste_solicitado, aceita, recusada, expirada"), limite: { type: "integer" } }, [],
    async (ctx, u, i) => {
      const rows = await db.execute(sql`
        SELECT p.id::text AS id, p.numero, p.versao, p.status, p.total_geral AS valor, p.enviada_em, e.nome AS empresa, '/propostas' AS href
          FROM propostas p LEFT JOIN negocios n ON n.id = p.negocio_id LEFT JOIN empresas e ON e.id = COALESCE(p.empresa_id, n.empresa_id)
         WHERE p.organizacao_id = ${ctx.organizacaoId}::uuid AND (${i.status ? String(i.status) : null}::text IS NULL OR p.status = ${i.status ? String(i.status) : null})
           AND (${u.pessoal}::boolean = false OR n.responsavel_id = ${u.userId}::uuid OR p.criado_por_id = ${u.userId}::uuid)
         ORDER BY p.created_at DESC LIMIT ${lim(i.limite)}`);
      return { ok: true, data: { propostas: rows } };
    }),
  leitura("clientes", "Clientes da carteira / Customer Success: ciclo de vida, último contato, próxima revisão e saúde (pode estar vazia: então diga que não há dado).", { termo: str("nome da empresa"), limite: { type: "integer" } }, [],
    async (ctx, u, i) => {
      const termo = i.termo ? `%${String(i.termo).replace(/[%_\\]/g, "\\$&")}%` : null;
      const rows = await db.execute(sql`
        SELECT c.id::text AS id, e.nome AS empresa, c.lifecycle_status AS ciclo, c.health_atual AS saude, c.ultimo_contato_em, c.proxima_revisao_em, c.status_financeiro, usr.nome AS responsavel, '/clientes/' || c.id::text AS href
          FROM clientes c LEFT JOIN empresas e ON e.id = c.empresa_id LEFT JOIN usuarios usr ON usr.id = COALESCE(c.responsavel_cs_id, c.responsavel_id)
         WHERE c.organizacao_id = ${ctx.organizacaoId}::uuid AND (${termo}::text IS NULL OR e.nome ILIKE ${termo})
           AND (${u.pessoal}::boolean = false OR c.responsavel_id = ${u.userId}::uuid OR c.responsavel_cs_id = ${u.userId}::uuid)
         ORDER BY c.ultimo_contato_em ASC NULLS FIRST LIMIT ${lim(i.limite)}`);
      return { ok: true, data: { clientes: rows } };
    }),
  leitura("conversas", "Conversas do Atendimento (WhatsApp): lista recente ou, com contato_id, as últimas mensagens daquela conversa.", { contato_id: str("uuid do contato"), somente_nao_lidas: { type: "boolean" }, limite: { type: "integer" } }, [],
    async (ctx, u, i) => {
      if (u.role === "leitor") return { ok: false, error: "o papel leitor não consulta conversas individuais" };
      const acesso = veTodasAsConversas(u.role) ? sql`TRUE` : condicaoMinhasConversas(u.userId, sql`c.responsavel_id`, sql`c.sessao_id`);
      if (i.contato_id) {
        const id = String(i.contato_id);
        if (!UUID.test(id)) return { ok: false, error: "contato_id inválido" };
        const [c] = await db.execute<{ nome: string; responsavel_id: string | null }>(sql`SELECT c.nome, c.responsavel_id::text FROM contatos c WHERE c.id = ${id}::uuid AND c.organizacao_id = ${ctx.organizacaoId}::uuid AND ${acesso}`);
        if (!c) return { ok: false, error: "conversa não encontrada" };
        const msgs = await db.execute(sql`SELECT direcao, left(coalesce(conteudo, '[' || tipo || ']'), 500) AS texto, created_at FROM (SELECT * FROM whatsapp_mensagens WHERE contato_id = ${id}::uuid ORDER BY created_at DESC LIMIT ${lim(i.limite, 20, 40)}) m ORDER BY created_at`);
        return { ok: true, data: { contato: c.nome, mensagens: msgs } };
      }
      const rows = await db.execute(sql`
        SELECT c.id::text AS id, c.nome, c.canal, left(c.ultima_msg, 120) AS ultima_msg, c.ultima_msg_at, c.nao_lidas, c.status, usr.nome AS responsavel, '/atendimento' AS href
          FROM contatos c LEFT JOIN usuarios usr ON usr.id = c.responsavel_id
         WHERE c.organizacao_id = ${ctx.organizacaoId}::uuid AND ${acesso}
           AND (${i.somente_nao_lidas === true}::boolean = false OR c.nao_lidas > 0)
         ORDER BY c.ultima_msg_at DESC NULLS LAST LIMIT ${lim(i.limite)}`);
      return { ok: true, data: { conversas: rows } };
    }),
  leitura("nao_respondidas", "Lista conversas WhatsApp em que a última mensagem recebida ainda não teve nenhuma resposta enviada. Inclui trecho e horário da mensagem. Não confundir 'não lida' com 'não respondida'.",
    { limite: { type: "integer", minimum: 1, maximum: 30 } }, [],
    async (ctx, u, i) => {
      if (u.role === "leitor") return { ok: false, error: "o papel leitor não consulta conversas individuais" };
      const acesso = veTodasAsConversas(u.role) ? sql`TRUE` : condicaoMinhasConversas(u.userId, sql`c.responsavel_id`, sql`c.sessao_id`);
      const base = sql`FROM contatos c
        JOIN LATERAL (SELECT m.id, m.created_at, m.conteudo, m.tipo FROM whatsapp_mensagens m
          WHERE m.contato_id = c.id AND m.direcao = 'in' ORDER BY m.created_at DESC LIMIT 1) recebida ON TRUE
        LEFT JOIN LATERAL (SELECT m.created_at FROM whatsapp_mensagens m
          WHERE m.contato_id = c.id AND m.direcao = 'out' ORDER BY m.created_at DESC LIMIT 1) enviada ON TRUE
        WHERE c.organizacao_id = ${ctx.organizacaoId}::uuid AND c.canal = 'whatsapp' AND c.status = 'open'
          AND ${acesso} AND (enviada.created_at IS NULL OR recebida.created_at > enviada.created_at)`;
      const [tot] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n ${base}`);
      const rows = await db.execute(sql`
        SELECT c.id::text id, c.nome, c.telefone, c.responsavel_id::text responsavel_id,
               recebida.created_at recebida_em, left(COALESCE(recebida.conteudo, '[' || recebida.tipo || ']'), 500) mensagem,
               EXTRACT(EPOCH FROM now() - recebida.created_at)::int / 3600 horas_sem_resposta,
               '/atendimento?contatoId=' || c.id::text href
          ${base} ORDER BY recebida.created_at ASC LIMIT ${lim(i.limite)}`);
      return { ok: true, data: { fonte: "whatsapp_mensagens", criterio: "ultima mensagem inbound posterior a ultima outbound, conversa aberta", escopo: veTodasAsConversas(u.role) ? "todas" : "minhas", total: tot?.n ?? 0, conversas: rows } };
    }),
  leitura("kpis", "Métrica do catálogo único (mrr_atual, booking_ganho, faturado, recebido, clientes_ativos, oportunidades_abertas). Sem codigo: lista as disponíveis. Números da organização inteira: não disponível para papéis pessoais.",
    { codigo: str("código da métrica"), de: str("ISO"), ate: str("ISO") }, [],
    async (ctx, u, i) => {
      if (u.pessoal) return { ok: false, error: "as métricas do catálogo são da organização inteira; o papel do usuário vê só o que é dele (use atividades, leads e pipeline)." };
      if (!i.codigo) return { ok: true, data: { metricas: CATALOGO.map((m) => ({ codigo: m.codigo, nome: m.nome, unidade: m.unidade, descricao: m.descricao })) } };
      const financeira = ["mrr_atual", "booking_ganho", "faturado", "recebido"].includes(String(i.codigo));
      const negado = falta(ctx, financeira ? "finance.read" : "sales.read");
      if (negado) return negado;
      try { return { ok: true, data: await medir(ctx.organizacaoId, String(i.codigo), { de: i.de ? new Date(String(i.de)) : null, ate: i.ate ? new Date(String(i.ate)) : null }) }; }
      catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
    }),
  leitura("buscar", "Procura empresas, leads, oportunidades e clientes pelo nome, dentro do que o usuário pode ver.", { termo: str("parte do nome (mínimo 2 letras)") }, ["termo"],
    async (ctx, u, i) => {
      if (u.role === "leitor") return { ok: false, error: "o papel leitor não consulta registros individuais" };
      const termo = String(i.termo).trim(); if (termo.length < 2) return { ok: false, error: "termo curto demais" };
      const like = `%${termo.replace(/[%_\\]/g, "\\$&")}%`;
      const [empresas, leads, negocios] = await Promise.all([
        db.execute(sql`SELECT id::text AS id, nome, '/empresas/' || id::text AS href FROM empresas WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND nome ILIKE ${like} ORDER BY nome LIMIT 8`),
        db.execute(sql`SELECT id::text AS id, nome, empresa, estagio_pre_vendas AS etapa, '/pessoas/' || id::text AS href FROM leads WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND (nome ILIKE ${like} OR empresa ILIKE ${like}) AND (${u.pessoal}::boolean = false OR responsavel_id = ${u.userId}::uuid) ORDER BY updated_at DESC LIMIT 8`),
        db.execute(sql`SELECT id::text AS id, titulo, etapa, valor_total AS valor, '/pipeline/' || id::text AS href FROM negocios WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND titulo ILIKE ${like} AND (${u.pessoal}::boolean = false OR responsavel_id = ${u.userId}::uuid) ORDER BY updated_at DESC LIMIT 8`),
      ]);
      return { ok: true, data: { empresas, leads, oportunidades: negocios } };
    }),

  /* ── Escrita (executa; confirma só o que envia, apaga ou não desfaz) ──── */
  escrita("criar_atividade", "CRIA uma atividade (tarefa) de verdade. vence_em em ISO COM fuso de São Paulo (-03:00). Responsável padrão: o usuário; outro responsável só informando responsavel_id. Vínculo opcional a lead, oportunidade (negocio_id) ou empresa.",
    { titulo: str("o que fazer"), descricao: str("detalhe"), tipo: { type: "string", enum: [...TIPOS_TAREFA] }, prioridade: { type: "string", enum: [...PRIORIDADES_TAREFA] }, vence_em: str("ISO 8601 com fuso"), responsavel_id: str("uuid de usuário"), lead_id: str("uuid"), negocio_id: str("uuid"), empresa_id: str("uuid") }, ["titulo"],
    async (ctx, u, i) => falta(ctx, "acquisition.manage") ?? agir(ctx, "criar_atividade", i, async () => {
      const r = await criarTarefa(tarefaAtor(ctx, u), { titulo: String(i.titulo), descricao: when(i.descricao), tipo: i.tipo as never, prioridade: i.prioridade as never, venceEm: when(i.vence_em), responsavelId: when(i.responsavel_id), leadId: when(i.lead_id), negocioId: when(i.negocio_id), empresaId: when(i.empresa_id) });
      return resumo(`Atividade criada: ${r.tarefa.titulo}`, `/tarefas?atv=${r.tarefa.id}`, { id: r.tarefa.id, prazo: r.tarefa.venceEm ?? r.tarefa.dataVencimento });
    })),
  escrita("editar_atividade", "EDITA uma atividade: concluir (status concluida), reagendar (vence_em), reatribuir (responsavel_id), mudar título/prioridade. Dono ou gestão.",
    { id: str("uuid da atividade"), titulo: str("novo título"), prioridade: { type: "string", enum: [...PRIORIDADES_TAREFA] }, status: { type: "string", enum: [...STATUS_TAREFA] }, vence_em: str("ISO com fuso"), responsavel_id: str("uuid") }, ["id"],
    async (ctx, u, i) => falta(ctx, "acquisition.manage") ?? agir(ctx, "editar_atividade", i, async () => {
      const r = await alterarTarefa(tarefaAtor(ctx, u), String(i.id), { titulo: i.titulo as string | undefined, prioridade: i.prioridade as never, status: i.status as never, venceEm: i.vence_em === undefined ? undefined : when(i.vence_em), responsavelId: i.responsavel_id as string | undefined });
      return resumo(`Atividade atualizada: ${r.tarefa.titulo}`, `/tarefas?atv=${r.tarefa.id}`, { id: r.tarefa.id, status: r.tarefa.status });
    })),
  escrita("excluir_atividade", "EXCLUI uma atividade. Irreversível: o chat pede confirmação antes.", { id: str("uuid") }, ["id"],
    async (ctx, u, i) => falta(ctx, "acquisition.manage") ?? comConfirmacao(ctx, "excluir_atividade", "Excluir atividade", i, async () => {
      const r = await excluirTarefa(tarefaAtor(ctx, u), String(i.id));
      return resumo(`Atividade excluída: ${r.titulo}`, "/tarefas");
    })),
  escrita("agendar_reuniao", "AGENDA uma reunião numa oportunidade do Pipeline.", { negocio_id: str("uuid da oportunidade"), data: str("ISO com fuso"), titulo: str("título"), duracao: { type: "integer" }, tipo: { type: "string", enum: ["call", "presencial", "video"] }, notas: str("pauta") }, ["negocio_id", "data"],
    async (ctx, u, i) => falta(ctx, "sales.manage") ?? agir(ctx, "agendar_reuniao", i, async () => {
      const [n] = await db.execute<{ responsavel_id: string | null; lead_id: string | null }>(sql`SELECT responsavel_id::text, lead_id::text FROM negocios WHERE id = ${String(i.negocio_id)}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
      if (!n) return { ok: false, error: "oportunidade não encontrada" };
      if (!meuAlvo(u, n.responsavel_id)) return alheio();
      const r = await pipeline.agendarReuniao({ organizacaoId: ctx.organizacaoId, negocioId: String(i.negocio_id), leadId: n.lead_id, data: String(i.data), titulo: i.titulo as string | undefined, duracao: i.duracao as number | undefined, tipo: i.tipo as never, notas: i.notas as string | undefined, responsavelId: n.responsavel_id ?? u.userId, ator: ator(ctx, u) });
      return resumo("Reunião agendada.", `/pipeline/${i.negocio_id}`, { reuniaoId: r.reuniaoId });
    })),
  escrita("criar_nota", "REGISTRA uma nota na timeline de um lead, oportunidade ou empresa.", { entidade: { type: "string", enum: ["lead", "negocio", "empresa"] }, id: str("uuid"), titulo: str("título"), texto: str("conteúdo") }, ["entidade", "id", "titulo"],
    async (ctx, u, i) => falta(ctx, "acquisition.manage") ?? agir(ctx, "criar_nota", i, async () => {
      const dono = await donoDe(ctx, String(i.entidade), String(i.id));
      if (dono === undefined) return { ok: false, error: "registro não encontrado" };
      if (!meuAlvo(u, dono)) return alheio();
      const r = await (await motorDeCadencia()).executarAcaoAvulsa("crm_add_note", { organizacaoId: ctx.organizacaoId, entityType: String(i.entidade) as never, entityId: String(i.id), vars: {}, ator: ator(ctx, u), chaveExecucao: `nexo:${ctx.runId}:nota`, config: { title: String(i.titulo), description: when(i.texto) ?? undefined } });
      return r.sucesso ? resumo(`Nota registrada: ${i.titulo}`, hrefDe(String(i.entidade), String(i.id))) : { ok: false, error: r.erro };
    })),
  escrita("tag", "APLICA ou REMOVE uma tag (pelo nome, que deve existir) em lead, oportunidade ou empresa.", { acao: { type: "string", enum: ["aplicar", "remover"] }, entidade: { type: "string", enum: ["lead", "negocio", "empresa"] }, id: str("uuid"), tag: str("nome da tag") }, ["acao", "entidade", "id", "tag"],
    async (ctx, u, i) => falta(ctx, "acquisition.manage") ?? agir(ctx, "tag", i, async () => {
      const [lb] = await db.execute<{ id: string }>(sql`SELECT id::text FROM labels WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND lower(nome) = lower(${String(i.tag)}) LIMIT 1`);
      if (!lb) return { ok: false, error: `a tag "${i.tag}" não existe; crie em Automações > Tags.` };
      const dono = await donoDe(ctx, String(i.entidade), String(i.id));
      if (dono === undefined) return { ok: false, error: "registro não encontrado" };
      if (!meuAlvo(u, dono)) return alheio();
      const r = await (await motorDeCadencia()).executarAcaoAvulsa(i.acao === "remover" ? "crm_remove_tag" : "crm_add_tag", { organizacaoId: ctx.organizacaoId, entityType: String(i.entidade) as never, entityId: String(i.id), vars: {}, ator: ator(ctx, u), chaveExecucao: `nexo:${ctx.runId}:tag`, config: { label_id: lb.id } });
      return r.sucesso ? resumo(`Tag "${i.tag}" ${i.acao === "remover" ? "removida" : "aplicada"}.`, hrefDe(String(i.entidade), String(i.id))) : { ok: false, error: r.erro };
    })),
  escrita("mover_etapa", "MOVE a etapa de um lead (novo, em_contato, qualificacao) ou de uma oportunidade (entrada, diagnostico, proposta, negociacao). Ganho NÃO existe aqui (gate comercial); qualificar/oportunidade têm ferramenta própria.",
    { entidade: { type: "string", enum: ["lead", "oportunidade"] }, id: str("uuid"), para: str("etapa destino"), motivo: str("motivo opcional") }, ["entidade", "id", "para"],
    async (ctx, u, i) => agir(ctx, "mover_etapa", i, async () => {
      const para = String(i.para);
      if (/ganh|won/i.test(para)) return { ok: false, error: "Ganho não tem botão nem ferramenta: exige o gate comercial de pagamento/assinatura." };
      if (i.entidade === "lead") {
        const negado = falta(ctx, "acquisition.manage"); if (negado) return negado;
        if (!ETAPAS_PRE_VENDAS.includes(para as EtapaPreVendas)) return { ok: false, error: `etapa de pré-vendas inválida: ${para}` };
        const dono = await donoDe(ctx, "lead", String(i.id)); if (dono === undefined) return { ok: false, error: "lead não encontrado" }; if (!meuAlvo(u, dono)) return alheio();
        await preVendas.moverEtapa({ organizacaoId: ctx.organizacaoId, leadId: String(i.id), para: para as EtapaPreVendas, ator: ator(ctx, u), motivo: when(i.motivo) });
        return resumo(`Lead movido para ${para}.`, `/pessoas/${i.id}`);
      }
      const negado = falta(ctx, "sales.manage"); if (negado) return negado;
      if (!ETAPAS_PIPELINE.includes(para as EtapaPipelineAberta)) return { ok: false, error: `etapa de pipeline inválida: ${para}` };
      const dono = await donoDe(ctx, "negocio", String(i.id)); if (dono === undefined) return { ok: false, error: "oportunidade não encontrada" }; if (!meuAlvo(u, dono)) return alheio();
      await pipeline.moverEtapa({ organizacaoId: ctx.organizacaoId, negocioId: String(i.id), para: para as EtapaPipelineAberta, ator: ator(ctx, u), motivo: when(i.motivo) });
      return resumo(`Oportunidade movida para ${para}.`, `/pipeline/${i.id}`);
    })),
  escrita("decidir_lead", "QUALIFICA, coloca em NUTRIÇÃO ou DESQUALIFICA um lead. nutrir exige motivo (" + MOTIVOS_NUTRICAO.map((m) => m.chave).join(", ") + "); desqualificar exige motivo (" + MOTIVOS_DESQUALIFICACAO.map((m) => m.chave).join(", ") + ").",
    { id: str("uuid do lead"), decisao: { type: "string", enum: ["qualificar", "nutrir", "desqualificar"] }, motivo: str("chave do motivo"), retomar_em: str("data ISO (nutrir)"), detalhe: str("observação") }, ["id", "decisao"],
    async (ctx, u, i) => falta(ctx, "acquisition.manage") ?? agir(ctx, "decidir_lead", i, async () => {
      const dono = await donoDe(ctx, "lead", String(i.id)); if (dono === undefined) return { ok: false, error: "lead não encontrado" }; if (!meuAlvo(u, dono)) return alheio();
      const base = { organizacaoId: ctx.organizacaoId, leadId: String(i.id), ator: ator(ctx, u) };
      if (i.decisao === "qualificar") await preVendas.qualificar(base);
      else if (i.decisao === "nutrir") await preVendas.nutrir({ ...base, motivo: String(i.motivo) as never, retomarEm: when(i.retomar_em), observacao: when(i.detalhe) });
      else await preVendas.desqualificar({ ...base, motivo: String(i.motivo) as never, detalhe: when(i.detalhe) });
      return resumo(`Lead ${i.decisao === "qualificar" ? "qualificado" : i.decisao === "nutrir" ? "enviado para nutrição" : "desqualificado"}.`, `/pessoas/${i.id}`);
    })),
  escrita("criar_lead", "CRIA um lead em Pré-vendas (empresa e pessoa são resolvidas sem duplicar). Responsável: o usuário.",
    { nome: str("nome da pessoa"), empresa: str("nome da empresa"), email: str("e-mail"), telefone: str("telefone"), cargo: str("cargo"), observacoes: str("contexto") }, ["nome"],
    async (ctx, u, i) => falta(ctx, "acquisition.manage") ?? agir(ctx, "criar_lead", i, async () => {
      const r = await preVendas.criarLead({ organizacaoId: ctx.organizacaoId, empresa: i.empresa ? { nome: String(i.empresa) } as never : null, pessoa: { nome: String(i.nome), email: when(i.email), telefone: when(i.telefone), cargo: when(i.cargo) }, touchpoint: { tipoOrigem: "manual", source: "nexo" }, origem: "NEXO", responsavelId: u.userId, observacoes: when(i.observacoes) }, ator(ctx, u));
      return resumo(`Lead criado: ${i.nome}.`, `/pessoas/${r.leadId}`, { leadId: r.leadId });
    })),
  escrita("atribuir_responsavel", "ATRIBUI o responsável de um lead ou oportunidade (usuário ativo da organização).", { entidade: { type: "string", enum: ["lead", "oportunidade"] }, id: str("uuid"), responsavel_id: str("uuid do usuário") }, ["entidade", "id", "responsavel_id"],
    async (ctx, u, i) => agir(ctx, "atribuir_responsavel", i, async () => {
      const negado = falta(ctx, i.entidade === "lead" ? "acquisition.manage" : "sales.manage"); if (negado) return negado;
      const dono = await donoDe(ctx, i.entidade === "lead" ? "lead" : "negocio", String(i.id)); if (dono === undefined) return { ok: false, error: "registro não encontrado" }; if (!meuAlvo(u, dono)) return alheio();
      if (i.entidade === "lead") await preVendas.atribuirResponsavel({ organizacaoId: ctx.organizacaoId, leadId: String(i.id), responsavelId: String(i.responsavel_id), origemAtribuicao: "agente", ator: ator(ctx, u) });
      else await pipeline.atribuirResponsavelDaOportunidade({ organizacaoId: ctx.organizacaoId, negocioId: String(i.id), responsavelId: String(i.responsavel_id), ator: ator(ctx, u) });
      return resumo("Responsável atribuído.", hrefDe(i.entidade === "lead" ? "lead" : "negocio", String(i.id)));
    })),
  escrita("criar_oportunidade", "CRIA uma oportunidade no Pipeline para uma empresa existente. familias: " + FAMILIAS.join(", ") + " (vazio = a definir).",
    { empresa_id: str("uuid da empresa"), titulo: str("título"), familias: { type: "array", items: { type: "string", enum: [...FAMILIAS] } }, lead_id: str("uuid do lead de origem"), valor_estimado: str("valor numérico") }, ["empresa_id"],
    async (ctx, u, i) => falta(ctx, "sales.manage") ?? agir(ctx, "criar_oportunidade", i, async () => {
      const r = await pipeline.criarOportunidade({ organizacaoId: ctx.organizacaoId, empresaId: String(i.empresa_id), familias: (i.familias as never) ?? [], responsavelId: u.userId, sourceProcess: "MANUAL", leadId: when(i.lead_id), titulo: when(i.titulo), valorEstimado: when(i.valor_estimado) }, ator(ctx, u));
      const o = r.oportunidades[0];
      return resumo(`Oportunidade criada: ${o?.titulo ?? ""}.`, o ? `/pipeline/${o.id}` : "/pipeline", { ids: r.oportunidades.map((x) => x.id) });
    })),
  escrita("perder_oportunidade", "MARCA uma oportunidade como perdida (motivo: " + MOTIVOS_PERDA.map((m) => m.chave).join(", ") + "). Não desfaz fácil: o chat pede confirmação.", { id: str("uuid da oportunidade"), motivo: str("chave do motivo"), detalhe: str("observação") }, ["id", "motivo"],
    async (ctx, u, i) => falta(ctx, "sales.manage") ?? comConfirmacao(ctx, "perder_oportunidade", "Marcar oportunidade como perdida", i, async () => {
      const dono = await donoDe(ctx, "negocio", String(i.id)); if (dono === undefined) return { ok: false, error: "oportunidade não encontrada" }; if (!meuAlvo(u, dono)) return alheio();
      await pipeline.perder({ organizacaoId: ctx.organizacaoId, negocioId: String(i.id), motivo: String(i.motivo) as never, detalhe: when(i.detalhe), ator: ator(ctx, u) });
      return resumo("Oportunidade marcada como perdida.", `/pipeline/${i.id}`);
    })),
  escrita("criar_empresa_contato", "CRIA uma empresa e/ou uma pessoa de contato (reaproveita a existente por CNPJ, domínio, nome ou e-mail; nunca duplica).",
    { empresa: str("nome da empresa"), cnpj: str("CNPJ"), site: str("site"), nome: str("nome da pessoa"), email: str("e-mail"), telefone: str("telefone"), cargo: str("cargo") }, [],
    async (ctx, u, i) => falta(ctx, "companies.write") ?? agir(ctx, "criar_empresa_contato", i, async () => {
      if (!i.empresa && !i.nome) return { ok: false, error: "informe a empresa e/ou o nome da pessoa" };
      const a = ator(ctx, u);
      const emp = i.empresa ? await resolverEmpresa(ctx.organizacaoId, { nome: String(i.empresa), cnpj: when(i.cnpj), website: when(i.site) }, a) : null;
      const pes = i.nome ? await resolverPessoa(ctx.organizacaoId, { nome: String(i.nome), email: when(i.email), telefone: when(i.telefone), cargo: when(i.cargo), empresaId: emp?.empresaId ?? null } as never, a) : null;
      if (pes) await garantirRegistroDeContato(ctx.organizacaoId, pes.pessoaId);
      return resumo([emp ? `Empresa ${emp.criada ? "criada" : "já existia"}: ${i.empresa}` : null, pes ? `Contato ${i.nome} registrado` : null].filter(Boolean).join(". ") + ".", emp ? `/empresas/${emp.empresaId}` : "/contatos", { empresaId: emp?.empresaId ?? null });
    })),
  escrita("incluir_em_cadencia", "INCLUI um lead num fluxo de follow-up publicado. O fluxo pode enviar mensagens ao cliente: o chat pede confirmação antes.",
    { lead_id: str("uuid do lead"), fluxo_id: str("uuid do fluxo publicado") }, ["lead_id", "fluxo_id"],
    async (ctx, u, i) => falta(ctx, "automation.manage") ?? comConfirmacao(ctx, "incluir_em_cadencia", "Incluir o lead na cadência (pode enviar mensagens)", i, async () => {
      const dono = await donoDe(ctx, "lead", String(i.lead_id)); if (dono === undefined) return { ok: false, error: "lead não encontrado" }; if (!meuAlvo(u, dono)) return alheio();
      const [d] = await db.execute<{ id: string }>(sql`SELECT id::text FROM cadence_definitions WHERE id = ${String(i.fluxo_id)}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid AND ativo`);
      if (!d) return { ok: false, error: "fluxo publicado não encontrado" };
      const id = await (await motorDeCadencia()).iniciarCadencia({ cadenceDefinitionId: d.id, organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: String(i.lead_id) });
      return id ? resumo("Lead incluído na cadência.", `/pessoas/${i.lead_id}`, { enrollmentId: id }) : { ok: false, error: "a cadência não iniciou (lead já inscrito ou fluxo sem passos)" };
    })),
  escrita("enviar_whatsapp", "PREPARA uma resposta de WhatsApp numa conversa do Atendimento (contato_id vem de nexo_conversas ou nexo_nao_respondidas). Escreva o texto completo em conteudo, no tom do usuário. NUNCA sai sozinha: a tela mostra o rascunho para a pessoa editar e confirmar; só então a mensagem é enviada pelo número da conversa.",
    { contato_id: str("uuid do contato da conversa"), conteudo: str("texto da mensagem, pronto para enviar") }, ["contato_id", "conteudo"],
    async (ctx, u, i) => {
      const id = String(i.contato_id ?? "");
      if (!UUID.test(id)) return { ok: false, error: "contato_id inválido" };
      const acesso = veTodasAsConversas(u.role) ? sql`TRUE` : condicaoMinhasConversas(u.userId, sql`c.responsavel_id`, sql`c.sessao_id`);
      const [c] = await db.execute<{ nome: string }>(sql`SELECT c.nome FROM contatos c WHERE c.id = ${id}::uuid AND c.organizacao_id = ${ctx.organizacaoId}::uuid AND ${acesso}`);
      if (!c) return { ok: false, error: "conversa não encontrada ou de outra pessoa" };
      const conteudo = String(i.conteudo ?? "").trim();
      if (!conteudo) return { ok: false, error: "conteudo vazio" };
      return comConfirmacao(ctx, "enviar_whatsapp", `Enviar WhatsApp para ${c.nome}`, { contato_id: id, conteudo }, async () => {
        const { enviarTextoNaConversa } = await import("@/lib/whatsapp/enviar-texto");
        const r = await enviarTextoNaConversa({ organizacaoId: ctx.organizacaoId, userId: u.userId, userRole: u.role, contatoId: id, conteudo, aiRunId: ctx.runId });
        return r.ok ? resumo(`Mensagem enviada para ${r.contatoNome || c.nome}.`, `/atendimento?contatoId=${id}`, { mensagemId: r.mensagemId }) : { ok: false, error: r.erro };
      });
    }),
  {
    id: "nexo.propor_acao", name: "nexo_propor_acao", description: "Mostra um botão de atalho (abrir_tela com href interno). Para criar/alterar algo use as ferramentas de ação, que executam; use esta só para levar a pessoa a uma tela.", category: "communication", mutates: false,
    parameters: objectSchema({ kind: { type: "string", enum: ["abrir_tela"] }, rotulo: str("texto do botão"), href: str("rota interna, ex.: /pipeline") }, ["kind", "rotulo", "href"]),
    execute: async (_c, i) => /^\/(?!\/)[\w\-/?=&%.]*$/.test(String(i.href ?? "")) ? { ok: true, data: { proposta: true } } : { ok: false, error: "href inválido: use uma rota interna começando com /" },
  },
];

/** Responsável do registro (para o escopo). `undefined` = não existe nesta organização. */
async function donoDe(ctx: AgentToolContext, entidade: string, id: string): Promise<string | null | undefined> {
  if (!UUID.test(id)) return undefined;
  const tabela = entidade === "lead" ? sql`leads` : entidade === "negocio" ? sql`negocios` : entidade === "empresa" ? sql`empresas` : null;
  if (!tabela) return undefined;
  if (entidade === "empresa") {
    const [e] = await db.execute<{ id: string }>(sql`SELECT id::text FROM empresas WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    return e ? null : undefined;
  }
  const [r] = await db.execute<{ r: string | null }>(sql`SELECT responsavel_id::text AS r FROM ${tabela} WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
  return r ? r.r : undefined;
}
const hrefDe = (entidade: string, id: string) => (entidade === "lead" ? `/pessoas/${id}` : entidade === "negocio" ? `/pipeline/${id}` : `/empresas/${id}`);

/** Os ids que o chat do NEXO oferece ao modelo. */
export const NEXO_TOOL_IDS = NEXO_TOOLS.map((t) => t.id);
