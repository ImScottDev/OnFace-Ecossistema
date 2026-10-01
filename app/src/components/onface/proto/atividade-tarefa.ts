/* ─────────────────────────────────────────────────────────────────────────
 * A tradução entre a atividade do desenho e a tabela `tarefas`.
 *
 * A peça de Atividade e a tela /tarefas gravam a MESMA tarefa pelos mesmos
 * campos; a tradução mora aqui uma vez só. Quem grava é a rota Hono
 * `/api/tarefas` (org + RBAC de dono/gerente) — nenhuma regra nova aqui.
 *
 * O desenho tem subtarefa, comentário, anexo, seguidor e fila: o domínio não
 * tem nenhum deles. Mudança só nesses campos NÃO é gravada, e quem chama avisa.
 * ───────────────────────────────────────────────────────────────────────── */

/** tipo do banco → rótulo do desenho. */
const TIPO_DO_BANCO: Record<string, string> = {
  ligar: "Ligação", ligacao: "Ligação",
  follow_up: "Follow up",
  enviar_proposta: "Proposta",
  confirmar_reuniao_outlook: "Reunião", onboarding_agendar_reuniao: "Reunião", reuniao: "Reunião",
  email: "E-mail", whatsapp: "Mensagem",
};

/** rótulo do desenho → tipo que a rota aceita. E-mail e Mensagem não têm tipo no domínio. */
export const TIPO_DO_DESENHO: Record<string, string> = {
  "Ligação": "ligar", "Follow up": "follow_up", "Proposta": "enviar_proposta", "Tarefa": "geral",
};

export const tipoDoBanco = (t: string | null | undefined) => TIPO_DO_BANCO[(t ?? "").toLowerCase()] ?? "Tarefa";

const PRIORIDADE_DO_BANCO: Record<string, string> = { alta: "Alta", urgente: "Alta", media: "Média", baixa: "Baixa" };
const PRIORIDADE_DO_DESENHO: Record<string, string> = { Alta: "alta", "Média": "media", Baixa: "baixa" };
export const prioridadeDoBanco = (p: string | null | undefined) => PRIORIDADE_DO_BANCO[(p ?? "").toLowerCase()] ?? "Média";

const SITUACAO_DO_BANCO: Record<string, string> = {
  a_fazer: "A fazer", em_andamento: "Em andamento", aguardando: "Aguardando", concluida: "Feita", declinada: "Declinada",
};
const STATUS_DO_DESENHO: Record<string, string> = Object.fromEntries(
  Object.entries(SITUACAO_DO_BANCO).map(([k, v]) => [v, k]),
);
export const situacaoDoBanco = (s: string | null | undefined) => SITUACAO_DO_BANCO[s ?? ""] ?? "A fazer";

const p2 = (n: number) => String(n).padStart(2, "0");

/** vence_em / data_vencimento → par fimD/fimH do desenho (hora local). */
export function prazoDoBanco(venceEm: string | null | undefined, dataVencimento: string | null | undefined) {
  if (venceEm) {
    const d = new Date(venceEm);
    if (!Number.isNaN(d.getTime())) {
      return { fimD: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, fimH: `${p2(d.getHours())}:${p2(d.getMinutes())}` };
    }
  }
  return { fimD: dataVencimento ? dataVencimento.slice(0, 10) : "", fimH: "" };
}

/** fimD/fimH → corpo da rota. Só data: vence no dia, sem hora inventada. */
export function prazoParaOBanco(fimD: string | null | undefined, fimH: string | null | undefined) {
  if (!fimD) return { dataVencimento: null, venceEm: null };
  if (!fimH) return { dataVencimento: fimD, venceEm: null };
  return { dataVencimento: fimD, venceEm: new Date(`${fimD}T${fimH}:00`).toISOString() };
}

export interface CorpoTarefa {
  titulo?: string;
  descricao?: string | null;
  tipo?: string;
  prioridade?: string;
  status?: string;
  dataVencimento?: string | null;
  venceEm?: string | null;
  responsavelId?: string | null;
}

/**
 * O que mudou entre duas versões da atividade, no corpo do PATCH.
 *
 * `naoGravado` lista o que mudou e não tem campo no domínio — quem chama avisa
 * em vez de fingir que gravou.
 */
export function corpoDaMudanca(
  antes: Record<string, any>,
  depois: Record<string, any>,
  idDoResponsavel: (nome: string) => string | undefined,
): { corpo: CorpoTarefa; naoGravado: string[] } {
  const corpo: CorpoTarefa = {};
  const naoGravado: string[] = [];
  // Vazio é vazio: [] , "" e ausente não contam como mudança.
  const norm = (v: unknown) => JSON.stringify(v == null || v === "" || (Array.isArray(v) && !v.length) ? null : v);
  const mudou = (k: string) => k in depois && norm(depois[k]) !== norm(antes[k]);

  if (mudou("titulo") && String(depois.titulo ?? "").trim()) corpo.titulo = String(depois.titulo).trim();
  if (mudou("desc")) corpo.descricao = String(depois.desc ?? "").trim() || null;
  if (mudou("tipo")) {
    const t = TIPO_DO_DESENHO[depois.tipo];
    if (t) corpo.tipo = t; else naoGravado.push(`tipo "${depois.tipo}"`);
  }
  if (mudou("prioridade") && PRIORIDADE_DO_DESENHO[depois.prioridade]) corpo.prioridade = PRIORIDADE_DO_DESENHO[depois.prioridade];
  if (mudou("situacao") && STATUS_DO_DESENHO[depois.situacao]) corpo.status = STATUS_DO_DESENHO[depois.situacao];
  if (mudou("fimD") || mudou("fimH")) Object.assign(corpo, prazoParaOBanco(depois.fimD, depois.fimH));
  if (mudou("resp")) {
    const id = depois.resp ? idDoResponsavel(depois.resp) : undefined;
    if (id) corpo.responsavelId = id; else if (depois.resp) naoGravado.push(`responsável "${depois.resp}"`);
  }
  for (const [k, rot] of [["sub", "subtarefas"], ["comentarios", "comentários"], ["anexos", "anexos"], ["seguidores", "seguidores"], ["fila", "fila"]] as const) {
    if (mudou(k)) naoGravado.push(rot);
  }
  return { corpo, naoGravado };
}

/** Corpo do POST a partir da atividade nova do desenho. */
export function corpoDaNova(
  nova: Record<string, any>,
  idDoResponsavel: (nome: string) => string | undefined,
): CorpoTarefa {
  return {
    titulo: String(nova.titulo ?? "").trim(),
    descricao: String(nova.desc ?? "").trim() || null,
    tipo: TIPO_DO_DESENHO[nova.tipo] ?? "geral",
    prioridade: PRIORIDADE_DO_DESENHO[nova.prioridade] ?? "media",
    ...prazoParaOBanco(nova.fimD, nova.fimH),
    responsavelId: nova.resp ? idDoResponsavel(nova.resp) ?? null : null,
  };
}

/* ── A rota ─────────────────────────────────────────────────────────────── */

async function chamar<T>(url: string, init?: RequestInit): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try {
    const r = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...init });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const erro = r.status === 403 ? "Só o responsável ou um gestor pode alterar esta atividade."
        : r.status === 404 ? "Não encontrei esta atividade."
        : (j?.error as string) || "Não consegui gravar a atividade.";
      return { ok: false, erro };
    }
    return { ok: true, dados: j as T };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}

export const lerTarefa = (id: string) => chamar<Record<string, any>>(`/api/tarefas/${id}`);
export const criarTarefa = (corpo: CorpoTarefa & { leadId?: string | null; negocioId?: string | null; empresaId?: string | null }) =>
  chamar<{ id: string }>("/api/tarefas", { method: "POST", body: JSON.stringify(corpo) });
export const alterarTarefa = (id: string, corpo: CorpoTarefa) =>
  chamar<{ id: string }>(`/api/tarefas/${id}`, { method: "PATCH", body: JSON.stringify(corpo) });
/** A próxima ação do lead é a primeira tarefa aberta dele. */
export async function proximaDoLead(leadId: string) {
  const r = await chamar<{ tarefas: Array<{ id: string }> }>(`/api/tarefas?leadId=${leadId}&escopo=org&concluida=false`);
  return r.ok ? (r.dados.tarefas[0]?.id ?? null) : null;
}
