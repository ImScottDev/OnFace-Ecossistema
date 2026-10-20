/**
 * Adapters que os Fluxos precisam e o motor de ações ainda não tinha
 * (docs/produto/automacoes-fluxos.md §2 e §4.5).
 *
 * Entram no MESMO registro do cadence-engine (`registrarAdapter`): motor de
 * ações único (SPEC §18). Uma cadência pode usar qualquer um destes amanhã sem
 * cópia, e nenhum deles sabe que existe grafo — recebem config já resolvida e
 * a entidade, como todo adapter.
 *
 * Importado pelo executor só pelo efeito de registrar.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, cadenceEnrollments, notificacoes, usuarios } from "@/lib/db/schema";
import { registrarAdapter, iniciarCadencia, cancelarCadencia, executarIaSemFerramentas, type CadenceActionContext } from "@/lib/cadencia/cadence-engine";
import { alvoDaEntidade } from "@/lib/ai-platform/operacao/alvo";
import { CAMPOS_ATUALIZAVEIS } from "./grafo";

const cfg = (ctx: CadenceActionContext) => (ctx.step.config ?? {}) as Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v)).trim();
const erroDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function usuarioDaOrganizacao(organizacaoId: string, usuarioId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(usuarioId)) return false;
  const [u] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true))).limit(1);
  return Boolean(u);
}

// ─── Notificar usuário ─────────────────────────────────────────────────────
// `notificacoes` não tem organizacao_id: a pertença é conferida pelo usuário,
// senão uma automação mandaria aviso para alguém de outra organização.
registrarAdapter("fluxo_notificar", async (ctx) => {
  const c = cfg(ctx);
  const usuarioId = str(c.usuarioId);
  const mensagem = str(c.mensagem);
  if (!usuarioId) return { sucesso: false, erro: "ninguém para notificar: o registro não tem responsável e o bloco não escolheu um usuário" };
  if (!mensagem) return { sucesso: false, erro: "notificação sem mensagem" };
  if (!(await usuarioDaOrganizacao(ctx.organizacaoId, usuarioId))) return { sucesso: false, erro: "usuário não encontrado nesta organização" };
  const [n] = await db.insert(notificacoes).values({
    usuarioId, titulo: str(c.titulo) || "Automação", mensagem, tipo: "automacao", link: str(c.link) || null,
  }).returning({ id: notificacoes.id });
  return { sucesso: true, resultado: { notificacaoId: n.id } };
});

// ─── Atualizar campo ───────────────────────────────────────────────────────
// Allowlist fechada: a chave do catálogo vira nome de coluna por este mapa e
// por nada mais. É o único lugar onde texto de usuário escolhe coluna.
const COLUNAS: Record<"lead" | "negocio" | "contato", Record<string, string>> = {
  lead: { nome: "nome", sobrenome: "sobrenome", email: "email", telefone: "telefone", cargo: "cargo", origem: "origem", linkedin: "linkedin" },
  negocio: { titulo: "titulo", temperatura: "temperatura", proximaAcao: "proxima_acao", previsaoFechamento: "previsao_fechamento", campos_custom: "campos_custom" },
  contato: { nome: "nome", email: "email" },
};
const TABELA = { lead: "leads", negocio: "negocios", contato: "contatos" } as const;

registrarAdapter("fluxo_atualizar_campo", async (ctx) => {
  const c = cfg(ctx);
  const tipo = (ctx.entityType === "oportunidade" ? null : ctx.entityType) as keyof typeof COLUNAS | null;
  if (!tipo || !COLUNAS[tipo]) return { sucesso: false, erro: `este registro (${ctx.entityType || "nenhum"}) não tem campo atualizável` };
  const campo = str(c.campo);
  if (!CAMPOS_ATUALIZAVEIS[tipo].some((x) => x.chave === campo)) return { sucesso: false, erro: `campo "${campo}" não pode ser escrito por automação` };
  const coluna = COLUNAS[tipo][campo];
  const valor = c.valor === undefined || c.valor === null ? null : String(c.valor);
  const tabela = sql.raw(TABELA[tipo]);
  const where = sql`id = ${ctx.entityId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`;

  if (coluna === "previsao_fechamento" && valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return { sucesso: false, erro: `previsão de fechamento precisa ser AAAA-MM-DD, veio "${valor}"` };
  }

  let anterior: unknown;
  if (coluna === "campos_custom") {
    const nome = str(c.nomeCampoCustom);
    if (!nome) return { sucesso: false, erro: "nome do campo personalizado vazio" };
    const rows = (await db.execute(sql`SELECT campos_custom -> ${nome} AS v FROM ${tabela} WHERE ${where}`)) as unknown as { v: unknown }[];
    if (!rows[0]) return { sucesso: false, erro: "registro não encontrado nesta organização" };
    anterior = rows[0].v ?? null;
    await db.execute(sql`UPDATE ${tabela} SET campos_custom = COALESCE(campos_custom, '{}'::jsonb) || jsonb_build_object(${nome}::text, ${valor}::text), updated_at = now() WHERE ${where}`);
  } else {
    const col = sql.raw(coluna);
    const rows = (await db.execute(sql`SELECT ${col}::text AS v FROM ${tabela} WHERE ${where}`)) as unknown as { v: string | null }[];
    if (!rows[0]) return { sucesso: false, erro: "registro não encontrado nesta organização" };
    anterior = rows[0].v;
    if ((coluna === "nome" || coluna === "titulo") && !valor) return { sucesso: false, erro: `${campo} não pode ficar vazio` };
    await db.execute(coluna === "previsao_fechamento"
      ? sql`UPDATE ${tabela} SET ${col} = ${valor}::date, updated_at = now() WHERE ${where}`
      : sql`UPDATE ${tabela} SET ${col} = ${valor}, updated_at = now() WHERE ${where}`);
  }

  // `source: "automation"` separa, na auditoria, o que alguém fez do que uma regra fez.
  await db.insert(auditLog).values({
    organizacaoId: ctx.organizacaoId, actorId: null, action: `${tipo}.campo_atualizado`,
    entityType: tipo, entityId: ctx.entityId,
    before: { [campo]: anterior }, after: { [campo]: valor, chave: ctx.enrollmentId }, source: "automation",
  }).catch((e) => console.error("[fluxos] campo atualizado, mas a auditoria falhou:", e));

  return { sucesso: true, resultado: { anterior: anterior ?? null } };
});

// ─── Requisição HTTP ───────────────────────────────────────────────────────
// Quem monta a automação escolhe a URL, e o servidor faz a chamada: sem estas
// travas, "Requisição HTTP" vira SSRF (metadata da nuvem, Postgres, Redis).
function ipPrivado(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return ipPrivado(ip.slice(7));
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

export async function conferirDestinoHttp(url: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(url); } catch { return `URL inválida: "${url}"`; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "só http e https são permitidos";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  // ponytail: confere o DNS antes do fetch, que resolve de novo (rebinding
  // fica possível numa janela curta). Fixar o IP no socket exige agente HTTP próprio.
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) return `não foi possível resolver ${host}`;
  if (ips.some(ipPrivado)) return "endereço interno ou privado não é permitido";
  return null;
}

const LIMITE_RESPOSTA = 256 * 1024;

async function lerAte(res: Response, limite: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < limite) {
    const { done, value } = await reader.read();
    if (done) break;
    partes.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(partes).subarray(0, limite));
}

registrarAdapter("fluxo_http", async (ctx) => {
  const c = cfg(ctx);
  const metodo = (str(c.metodo) || "POST").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(metodo)) return { sucesso: false, erro: `método ${metodo} não suportado` };
  const cabecalhos: Record<string, string> = {};
  const pares = Array.isArray(c.cabecalhos) ? (c.cabecalhos as { chave?: string; valor?: unknown }[]) : [];
  for (const p of pares) if (str(p.chave)) cabecalhos[str(p.chave)] = str(p.valor);
  const corpo = metodo === "GET" ? undefined : (typeof c.corpo === "string" ? c.corpo : c.corpo === undefined ? undefined : JSON.stringify(c.corpo));
  if (corpo && !Object.keys(cabecalhos).some((k) => k.toLowerCase() === "content-type")) cabecalhos["Content-Type"] = "application/json";
  const timeoutMs = Math.min(300_000, Math.max(1000, Number(c._timeoutMs ?? 10_000)));
  const sinal = AbortSignal.timeout(timeoutMs);

  let url = str(c.url);
  try {
    // Redirect seguido à mão, até 3, conferindo o destino a cada salto: o
    // `redirect: "follow"` do fetch iria para um host privado sem perguntar.
    for (let salto = 0; salto <= 3; salto++) {
      const bloqueio = await conferirDestinoHttp(url);
      if (bloqueio) return { sucesso: false, erro: bloqueio };
      const res = await fetch(url, { method: metodo, headers: cabecalhos, body: corpo, redirect: "manual", signal: sinal });
      const destino = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && destino) { url = new URL(destino, url).toString(); continue; }
      const texto = await lerAte(res, LIMITE_RESPOSTA);
      let corpoResp: unknown = texto;
      if ((res.headers.get("content-type") ?? "").includes("json")) { try { corpoResp = JSON.parse(texto); } catch { /* fica texto */ } }
      if (!res.ok) return { sucesso: false, erro: `HTTP ${res.status}`, resultado: { status: res.status, corpo: corpoResp } };
      return { sucesso: true, resultado: { status: res.status, corpo: corpoResp } };
    }
    return { sucesso: false, erro: "redirecionamentos demais" };
  } catch (e) {
    return { sucesso: false, erro: sinal.aborted ? `sem resposta em ${Math.round(timeoutMs / 1000)}s` : erroDe(e) };
  }
});

// ─── IA ────────────────────────────────────────────────────────────────────
// Gerar e classificar NÃO enviam nada nem agem: rodam sem ferramenta nenhuma
// (`executarIaSemFerramentas`). O texto volta para o grafo, e quem decide
// mandar ou mudar o CRM é um bloco seguinte, visível no canvas.

/** Contato e lead do registro, para o run da IA ficar ligado a quem ele leu. */
async function quemDoRegistro(ctx: CadenceActionContext): Promise<{ contatoId: string | null; leadId: string | null }> {
  if (!ctx.entityType || !ctx.entityId) return { contatoId: null, leadId: null };
  const a = await alvoDaEntidade(ctx.organizacaoId, ctx.entityType, ctx.entityId).catch(() => null);
  return { contatoId: a?.contatoId ?? null, leadId: a?.leadId ?? null };
}
registrarAdapter("fluxo_ia_texto", async (ctx) => {
  const c = cfg(ctx);
  const instrucao = str(c.instrucao);
  if (!instrucao) return { sucesso: false, erro: "instrução vazia" };
  try {
    const r = await executarIaSemFerramentas({
      organizacaoId: ctx.organizacaoId, agentId: str(c.agenteId) || undefined, eventType: "automacao.fluxo",
      message: instrucao, ...(await quemDoRegistro(ctx)),
    });
    return { sucesso: true, resultado: { texto: r.responseText ?? "", runId: r.runId } };
  } catch (e) {
    return { sucesso: false, erro: erroDe(e) };
  }
});

/** Mesmo prompt do adapter `ai_classify` das cadências, sem depender de `step.id`. */
registrarAdapter("fluxo_ia_classificar", async (ctx) => {
  const c = cfg(ctx);
  const classes = (Array.isArray(c.classes) ? c.classes : []) as { id: string; rotulo?: string }[];
  const ids = classes.map((x) => x.id).filter(Boolean);
  const texto = str(c.texto);
  if (!ids.length) return { sucesso: false, erro: "nenhuma classe configurada" };
  // Sem texto não há o que classificar: segue por "Nenhuma das classes" sem chamar modelo.
  if (!texto) return { sucesso: true, resultado: { classe: "outra", motivo: "texto vazio" } };
  try {
    const dica = str(c.dica);
    const r = await executarIaSemFerramentas({
      organizacaoId: ctx.organizacaoId, agentId: str(c.agenteId) || undefined, eventType: "automacao.fluxo",
      message: `Classifique a mensagem do contato em exatamente uma destas classes: ${ids.join(", ")}.${dica ? ` Contexto: ${dica}.` : ""} Responda apenas com o id da classe, sem mais nada.\n\nMensagem do contato: """${texto}"""`,
      ...(await quemDoRegistro(ctx)),
    });
    const bruto = (r.responseText ?? "").trim().toLowerCase();
    const classe = ids.find((id) => bruto === id.toLowerCase()) ?? ids.find((id) => bruto.includes(id.toLowerCase())) ?? "outra";
    return { sucesso: true, resultado: { classe, bruto: r.responseText } };
  } catch (e) {
    return { sucesso: false, erro: erroDe(e) };
  }
});

// ─── Cadências ─────────────────────────────────────────────────────────────
registrarAdapter("fluxo_inscrever_cadencia", async (ctx) => {
  const cadenciaId = str(cfg(ctx).cadenciaId);
  if (!cadenciaId) return { sucesso: false, erro: "cadência não escolhida" };
  if (!["lead", "negocio", "contato"].includes(ctx.entityType)) return { sucesso: false, erro: `cadência não aceita registro do tipo ${ctx.entityType || "nenhum"}` };
  // iniciarCadencia confere a organização da definição e não duplica inscrição viva.
  const id = await iniciarCadencia({
    cadenceDefinitionId: cadenciaId, organizacaoId: ctx.organizacaoId, entityType: ctx.entityType, entityId: ctx.entityId,
    varsIniciais: ctx.vars, idempotencyKey: `fluxo:${ctx.enrollmentId}`,
  });
  if (!id) return { sucesso: false, erro: "cadência inexistente, desligada ou sem etapas: nada foi inscrito" };
  return { sucesso: true, resultado: { inscricaoId: id } };
});

registrarAdapter("fluxo_remover_cadencia", async (ctx) => {
  const cadenciaId = str(cfg(ctx).cadenciaId);
  if (!cadenciaId) return { sucesso: false, erro: "cadência não escolhida" };
  const vivas = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId),
    eq(cadenceEnrollments.cadenceDefinitionId, cadenciaId),
    eq(cadenceEnrollments.entityType, ctx.entityType),
    eq(cadenceEnrollments.entityId, ctx.entityId),
    inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply", "paused"]),
  ));
  for (const v of vivas) await cancelarCadencia(v.id, "removido por automação");
  return { sucesso: true, resultado: { canceladas: vivas.length } };
});
