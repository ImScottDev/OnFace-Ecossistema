/* ─────────────────────────────────────────────────────────────────────────
 * A tradução entre a atividade do desenho e a tabela `tarefas`.
 *
 * A peça de Atividade e a tela /tarefas gravam a MESMA tarefa pelos mesmos
 * campos; a tradução mora aqui uma vez só. Quem grava é a rota Hono
 * `/api/tarefas` (org + RBAC de dono/gerente) — nenhuma regra nova aqui.
 *
 * Subtarefa, comentário e anexo têm porta própria (`/api/tarefas/:id/...`,
 * migration 0111): `mudancasDoDetalhe` separa o que vai para cada uma. Seguidor,
 * fila, data de início e mais de um responsável não existem no domínio: mudança
 * só nesses campos NÃO é gravada, e quem chama avisa.
 * ───────────────────────────────────────────────────────────────────────── */

import { JORNADA_POR_ORIGEM } from "@/components/onface/atividades/types";

/** tipo do banco → rótulo do desenho. */
const TIPO_DO_BANCO: Record<string, string> = {
  ligar: "Ligação", ligacao: "Ligação",
  follow_up: "Follow up",
  enviar_proposta: "Proposta",
  // "Agendar/confirmar reunião" é tarefa a fazer, não a reunião: reunião de verdade mora em `reunioes` (Calendário).
  reuniao: "Reunião",
  email: "E-mail", whatsapp: "Mensagem",
};

/** rótulo do desenho → tipo que a rota aceita. */
export const TIPO_DO_DESENHO: Record<string, string> = {
  "Ligação": "ligar", "Follow up": "follow_up", "Proposta": "enviar_proposta", "Tarefa": "geral",
  "E-mail": "email", "Mensagem": "whatsapp",
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
    // FormData leva o próprio Content-Type (multipart com boundary).
    const json = typeof init?.body === "string" ? { headers: { "Content-Type": "application/json" } } : {};
    const r = await fetch(url, { credentials: "same-origin", ...json, ...init });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      // As portas de subtarefa/comentário/anexo já mandam a frase certa (com `codigo`).
      const erro = j?.codigo && j?.error ? (j.error as string)
        : r.status === 403 ? "Só o responsável ou um gestor pode alterar esta atividade."
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
export const excluirTarefa = (id: string) => chamar<{ success: boolean }>(`/api/tarefas/${id}`, { method: "DELETE" });
/** A próxima ação do lead é a primeira tarefa aberta dele. */
export async function proximaDoLead(leadId: string) {
  const r = await chamar<{ tarefas: Array<{ id: string }> }>(`/api/tarefas?leadId=${leadId}&escopo=org&concluida=false`);
  return r.ok ? (r.dados.tarefas[0]?.id ?? null) : null;
}

/* ── Subtarefa, comentário e anexo ──────────────────────────────────────── */

const p2d = (n: number) => String(n).padStart(2, "0");

/** ISO → "Hoje, 14:05" / "Ontem, 09:12" / "08/10, 16:40" (o texto que o feed do desenho usa). */
export function quandoTxt(iso: string | null | undefined, agora = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hm = `${p2d(d.getHours())}:${p2d(d.getMinutes())}`;
  const dia = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (dia(d) === dia(agora)) return "Hoje, " + hm;
  if (dia(d) === dia(ontem)) return "Ontem, " + hm;
  return `${p2d(d.getDate())}/${p2d(d.getMonth() + 1)}, ${hm}`;
}

/**
 * A tarefa da rota (com o detalhe) na forma do item que a gaveta do desenho lê.
 * Imagem leva `url` (o feed mostra a prévia); o resto vai sem, e o feed mostra o chip.
 */
export function itemDaTarefa(t: Record<string, any>, doLead = false, agora = new Date()) {
  const { fimD, fimH } = prazoDoBanco(t.venceEm, t.dataVencimento);
  const pessoa = [t.leadNome, t.leadSobrenome].filter(Boolean).join(" ");
  const img = (a: { mime?: string; url: string }) => (/^image\//.test(a.mime ?? "") ? a.url : null);
  return {
    key: "p:" + t.id, src: "p", id: t.id,
    titulo: t.titulo ?? "", desc: t.descricao ?? "",
    tipo: tipoDoBanco(t.tipo), situacao: situacaoDoBanco(t.status), prioridade: prioridadeDoBanco(t.prioridade),
    resp: t.responsavelNome ?? null, assignees: t.responsavelNome ? [t.responsavelNome] : [],
    empresa: t.empresaNome ?? null, pessoa: pessoa || null,
    vincTipo: pessoa ? "pessoa" : t.empresaNome ? "empresa" : "nenhum",
    leadId: t.leadId ?? null, empresaId: t.empresaId ?? null,
    oppId: t.negocioId ?? null, oppRot: t.negocioTitulo ?? null,
    criadoPor: t.criadoPor ?? null, criadoPorEhAgente: !!t.criadoPorEhAgente,
    area: JORNADA_POR_ORIGEM[t.origem] ?? (t.origem === "NEXO" ? "NEXO" : "Manual"),
    origem: t.origem === "NEXO" ? "nexo" : null, nexoMotivo: t.motivo ?? "",
    fimD, fimH, iniD: "", iniH: "",
    sub: (t.subtarefas ?? []).map((s: any) => ({ id: s.id, t: s.titulo, desc: s.descricao ?? "", feita: !!s.concluida, resp: s.responsavelNome ?? null, fimD: s.venceEm ?? "" })),
    comentarios: (t.comentarios ?? []).map((c: any) => ({
      id: c.id, autor: c.autorNome ?? "Alguém", ehAgente: !!c.autorEhAgente, texto: c.corpo ?? "", quando: quandoTxt(c.criadoEm, agora) + (c.editadoEm ? " · editado" : ""),
      anexos: (c.anexos ?? []).map((a: any) => ({ id: a.id, nome: a.nome, url: img(a) })),
    })),
    anexos: (t.anexos ?? []).map((a: any) => ({ id: a.id, nome: a.nome, url: a.url, tipo: a.mime })),
    log: (t.log ?? []).map((l: any) => ({ autor: l.autor ?? "Sistema", ehAgente: !!l.autorEhAgente, texto: l.texto, quando: quandoTxt(l.em, agora) })),
    origemTxt: doLead ? "Próxima ação do lead" : t.negocioTitulo ? "Da oportunidade " + t.negocioTitulo : "Atividade",
  };
}

export type OpDetalhe =
  | { tipo: "criarSub"; temp: string; titulo: string; descricao: string | null; resp: string | null; venceEm: string | null; concluida: boolean }
  | { tipo: "alterarSub"; id: string; titulo?: string; descricao?: string | null; concluida?: boolean; resp?: string | null; venceEm?: string | null }
  | { tipo: "excluirSub"; id: string }
  | { tipo: "ordenarSubs"; ids: string[] }
  | { tipo: "comentar"; temp: string; corpo: string; anexos: Array<Record<string, any>> }
  | { tipo: "anexar"; anexo: Record<string, any> }
  | { tipo: "removerAnexo"; id: string };

const vazio = (v: unknown) => (v == null || v === "" ? null : v);

/**
 * O que mudou entre duas versões do item, separado por porta.
 *
 * Linha nova (subtarefa, comentário, anexo) é a que chega sem `id`: quem chama
 * dá a ela um id provisório (`novo:`) para as mudanças seguintes acharem a
 * mesma linha antes do servidor responder. `resto` é o item com esses campos
 * neutralizados, pronto para `corpoDaMudanca`; `naoGravado` é o que não tem
 * campo no domínio.
 */
export function mudancasDoDetalhe(antes: Record<string, any>, depois: Record<string, any>, novoId: () => string) {
  const ops: OpDetalhe[] = [];
  const naoGravado: string[] = [];

  const sa: any[] = antes.sub ?? [], sd: any[] = depois.sub ?? [];
  if ("sub" in depois) {
    const porId = new Map(sa.map((x) => [x.id, x]));
    for (const s of sd) {
      if (!s.id) s.id = novoId();
      const v = porId.get(s.id);
      if (!v) {
        if (String(s.t ?? "").trim()) ops.push({ tipo: "criarSub", temp: s.id, titulo: String(s.t).trim(), descricao: vazio(String(s.desc ?? "").trim()) as string | null, resp: s.resp ?? null, venceEm: vazio(s.fimD) as string | null, concluida: !!s.feita });
        continue;
      }
      const op: Extract<OpDetalhe, { tipo: "alterarSub" }> = { tipo: "alterarSub", id: s.id };
      if (String(s.t ?? "").trim() && String(s.t).trim() !== v.t) op.titulo = String(s.t).trim();
      if (vazio(String(s.desc ?? "").trim()) !== vazio(String(v.desc ?? "").trim())) op.descricao = vazio(String(s.desc ?? "").trim()) as string | null;
      if (!!s.feita !== !!v.feita) op.concluida = !!s.feita;
      if (vazio(s.resp) !== vazio(v.resp)) op.resp = (vazio(s.resp) as string | null);
      const fd = vazio(s.fimD), fa = vazio(v.fimD);
      if (fd !== fa) op.venceEm = fd as string | null;
      if (Object.keys(op).length > 2) ops.push(op);
    }
    const ficam = new Set(sd.map((x) => x.id));
    for (const v of sa) if (v.id && !ficam.has(v.id)) ops.push({ tipo: "excluirSub", id: v.id });
    const ordemAntes = sa.map((x) => x.id).filter((id) => ficam.has(id));
    const ordemDepois = sd.map((x) => x.id).filter((id) => porId.has(id));
    if (ordemAntes.join() !== ordemDepois.join()) ops.push({ tipo: "ordenarSubs", ids: sd.map((x) => x.id) });
  }

  let comentou = false;
  if ("comentarios" in depois) {
    const ids = new Set((antes.comentarios ?? []).map((c: any) => c.id).filter(Boolean));
    for (const c of depois.comentarios ?? []) {
      if (c.id && ids.has(c.id)) continue;
      if (!c.id) c.id = novoId();
      ops.push({ tipo: "comentar", temp: c.id, corpo: String(c.texto ?? ""), anexos: c.anexos ?? [] });
      comentou = true;
    }
  }

  if ("anexos" in depois) {
    const ficam = new Set<string>();
    for (const a of depois.anexos ?? []) {
      if (a.id) { ficam.add(a.id); continue; }
      a.id = novoId(); ficam.add(a.id);
      ops.push({ tipo: "anexar", anexo: a });
    }
    for (const a of antes.anexos ?? []) if (a.id && !ficam.has(a.id)) ops.push({ tipo: "removerAnexo", id: a.id });
  }

  // Comentar segue a atividade sozinho (o desenho põe o autor e os marcados em
  // `seguidores`); só o botão Seguir, sozinho, é pedido que o domínio não tem.
  const mudou = (k: string) => k in depois && JSON.stringify(vazio(depois[k]) ?? null) !== JSON.stringify(vazio(antes[k]) ?? null);
  if (mudou("seguidores") && !comentou) naoGravado.push("seguidores");
  if (mudou("fila")) naoGravado.push("fila");
  if (mudou("iniD")) naoGravado.push("data de início");
  if ((depois.assignees ?? []).length > 1 && mudou("assignees")) naoGravado.push("mais de um responsável");
  // O editor do desenho troca o vínculo por nome; o domínio liga por id, pela ficha.
  if (["empresa", "pessoa", "oppId"].some(mudou)) naoGravado.push("vínculo (mude pela ficha da empresa, pessoa ou oportunidade)");

  const resto: Record<string, any> = { ...depois };
  for (const k of ["sub", "comentarios", "anexos", "seguidores", "fila", "iniD", "log", "empresa", "pessoa", "oppId", "oppRot"]) resto[k] = antes[k];
  return { ops, naoGravado, resto };
}

const jsonDe = (corpo: unknown) => ({ body: JSON.stringify(corpo) });

/**
 * Executa as mudanças em ordem. `temps` liga o id provisório ao id do servidor:
 * a subtarefa criada agora e marcada logo depois é a mesma linha.
 * Devolve os erros (vazio = tudo gravou).
 */
export async function aplicarMudancas(
  tarefaId: string, ops: OpDetalhe[], idDoResponsavel: (nome: string) => string | undefined, temps: Map<string, string>,
): Promise<string[]> {
  const erros: string[] = [];
  const real = (id: string) => temps.get(id) ?? id;
  const resp = (nome: string | null | undefined) => (nome ? idDoResponsavel(nome) ?? null : null);
  const base = `/api/tarefas/${tarefaId}`;
  for (const op of ops) {
    if (/^novo:/.test(real("id" in op ? op.id : "")) && op.tipo !== "ordenarSubs") {
      erros.push("Uma subtarefa nova ainda não tinha sido gravada; reabra a atividade.");
      continue;
    }
    let r: { ok: true; dados: any } | { ok: false; erro: string };
    switch (op.tipo) {
      case "criarSub":
        r = await chamar<{ id: string }>(`${base}/subtarefas`, { method: "POST", ...jsonDe({ titulo: op.titulo, descricao: op.descricao, responsavelId: resp(op.resp), venceEm: op.venceEm, concluida: op.concluida }) });
        if (r.ok) temps.set(op.temp, r.dados.id);
        break;
      case "alterarSub": {
        const { tipo: _t, id, resp: nome, ...campos } = op;
        r = await chamar(`${base}/subtarefas/${real(id)}`, { method: "PATCH", ...jsonDe({ ...campos, ...(nome !== undefined ? { responsavelId: resp(nome) } : {}) }) });
        break;
      }
      case "excluirSub":
        r = await chamar(`${base}/subtarefas/${real(op.id)}`, { method: "DELETE" });
        break;
      case "ordenarSubs":
        r = await chamar(`${base}/subtarefas-ordem`, { method: "PUT", ...jsonDe({ ids: op.ids.map(real) }) });
        break;
      case "comentar": {
        const f = new FormData();
        f.set("corpo", op.corpo);
        for (const a of op.anexos) { const arq = await arquivoDe(a); if (arq) f.append("arquivo", arq); }
        r = await chamar<{ id: string }>(`${base}/comentarios`, { method: "POST", body: f });
        if (r.ok) temps.set(op.temp, r.dados.id);
        break;
      }
      case "anexar": {
        const arq = await arquivoDe(op.anexo);
        if (!arq) { erros.push(`Não consegui ler ${op.anexo.nome ?? "o arquivo"}.`); continue; }
        const f = new FormData();
        f.append("arquivo", arq);
        r = await chamar<{ id: string }>(`${base}/anexos`, { method: "POST", body: f });
        if (r.ok && op.anexo.id) temps.set(op.anexo.id, r.dados.id);
        break;
      }
      case "removerAnexo":
        r = await chamar(`${base}/anexos/${real(op.id)}`, { method: "DELETE" });
        break;
    }
    if (!r.ok) erros.push(r.erro);
  }
  return erros;
}

/** O anexo do desenho → File: o arquivo original quando a peça o guardou, senão o data: URL lido pelo FileReader. */
async function arquivoDe(a: Record<string, any>): Promise<File | null> {
  if (typeof File !== "undefined" && a.arquivo instanceof File) return a.arquivo;
  if (typeof a.url !== "string" || !a.url.startsWith("data:")) return null;
  const b = await (await fetch(a.url)).blob();
  return new File([b], a.nome || "arquivo", { type: a.tipo || b.type });
}
