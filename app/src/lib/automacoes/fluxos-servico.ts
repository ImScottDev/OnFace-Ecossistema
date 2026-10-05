/**
 * Serviço do construtor de automações (docs/produto/automacoes-fluxos.md §5
 * e §6): CRUD, rascunho, publicação, versões, execuções, webhook e migração
 * das Regras antigas. A rota Hono e a rota Next do webhook usam este arquivo;
 * nenhuma das duas fala com o banco direto.
 *
 * Toda função recebe `organizacaoId` e o usa em TODA consulta. Devolve os DTOs
 * de `grafo.ts`, que é o contrato com a tela.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAgents, automacaoExecucoes, automacaoPassosExecucao, automacaoVersoes, automacoes, cadenceDefinitions, labels, usuarios, whatsappTemplates,
} from "@/lib/db/schema";
import { ETAPAS_PIPELINE, ETAPAS_PRE_VENDAS, ROTULO_ETAPA_PIPELINE, ROTULO_ETAPA_PRE_VENDAS } from "@/lib/vendas/dominio";
import {
  CONFIG_PADRAO, EVENTOS_PLATAFORMA, configFluxoSchema, eventoPorId, gatilhoTemEntidade, grafoFluxoSchema, grafoInicial, resolverExpressao, validarGrafo,
  type ConfigFluxo, type DetalheExecucao, type EstadoFluxo, type ExecucaoResumo, type FluxoDetalhe, type FluxoResumo, type GrafoFluxo,
  type ModoExecucao, type NoFluxo, type OpcoesInspetor, type PassoExecucao, type PedidoExecucao, type RegraAntiga, type ResultadoEnsaio,
  type StatusExecucaoFluxo, type TipoEntidade, type TipoNo, type VersaoResumo,
} from "./grafo";
import { configDaVersao, ensaiarFluxo, grafoDaVersao, iniciarExecucao, cancelarExecucao as cancelarNoExecutor } from "./executor";
import { proximaExecucao } from "./agenda";
import { appUrl } from "@/lib/app-url";

type Automacao = typeof automacoes.$inferSelect;
type Versao = typeof automacaoVersoes.$inferSelect;

export class ErroFluxo extends Error {
  constructor(public status: 400 | 404 | 409 | 422 | 429, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

const ehUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// ─── Helpers ───────────────────────────────────────────────────────────────

interface Rascunho { grafo: GrafoFluxo; config: ConfigFluxo }

function lerRascunho(a: Automacao): Rascunho {
  const r = (a.rascunho ?? {}) as Partial<Rascunho>;
  const grafo = grafoFluxoSchema.safeParse(r.grafo);
  return { grafo: grafo.success ? (grafo.data as GrafoFluxo) : grafoInicial(), config: configDaVersao(r.config) };
}

const gatilhoDe = (g: GrafoFluxo): NoFluxo | undefined => g.nos.find((n) => n.tipo === "gatilho");

/** JSON com chaves ordenadas: a comparação rascunho × versão não pode depender da ordem das chaves. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const difere = (r: Rascunho, v: Versao | undefined) => !v || canonico({ n: r.grafo.nos, a: r.grafo.arestas, c: r.config }) !== canonico({ n: v.nodes, a: v.edges, c: configDaVersao(v.settings) });

function urlWebhook(token: string | null): string | null {
  if (!token) return null;
  const base = appUrl();
  return `${base}/api/webhooks/automacoes/${token}`;
}

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ALVO_TEXTO: Record<string, string> = { lead: "lead", negocio: "negócio" };

/** "Quando: Novo lead", "Todo dia às 09:00 · para cada negócio", "Webhook", "Manual". */
export function resumirGatilho(g: NoFluxo | undefined): string {
  if (!g) return "Sem gatilho";
  const c = g.config;
  if (c.modo === "manual") return "Manual";
  if (c.modo === "webhook") return "Webhook";
  if (c.modo === "agendado") {
    const horas = (Array.isArray(c.horarios) ? (c.horarios as string[]) : ["09:00"]).join(", ");
    const quando = c.frequencia === "intervalo" ? `A cada ${Number(c.intervaloMinutos ?? 60)} min`
      : c.frequencia === "semanal" ? `${((c.diasSemana as number[] | undefined) ?? []).map((d) => DIAS_CURTOS[d]).join(", ") || "Nenhum dia"} às ${horas}`
      : c.frequencia === "mensal" ? `Todo dia ${Number(c.diaMes ?? 1)} às ${horas}`
      : `Todo dia às ${horas}`;
    return ALVO_TEXTO[String(c.alvo)] ? `${quando} · para cada ${ALVO_TEXTO[String(c.alvo)]}` : quando;
  }
  const ev = eventoPorId(String(c.evento ?? ""));
  return ev ? `Quando: ${ev.rotulo}` : "Quando: evento não escolhido";
}

const gatilhoColuna = (g: NoFluxo | undefined) => (g?.config.modo === "evento" && g.config.evento ? `fluxo:${g.config.evento}` : `fluxo:${String(g?.config.modo ?? "manual")}`);

const estadoDe = (a: Automacao): EstadoFluxo => (!a.currentVersionId ? "rascunho" : a.ativo ? "ativa" : "publicada");

async function carregar(organizacaoId: string, id: string): Promise<Automacao> {
  if (!ehUuid(id)) throw new ErroFluxo(404, "Automação não encontrada.");
  const [a] = await db.select().from(automacoes).where(and(eq(automacoes.id, id), eq(automacoes.organizacaoId, organizacaoId), eq(automacoes.tipo, "fluxo"))).limit(1);
  if (!a) throw new ErroFluxo(404, "Automação não encontrada.");
  return a;
}

async function versaoAtual(a: Automacao): Promise<Versao | undefined> {
  if (!a.currentVersionId) return undefined;
  const [v] = await db.select().from(automacaoVersoes).where(and(eq(automacaoVersoes.id, a.currentVersionId), eq(automacaoVersoes.organizacaoId, a.organizacaoId))).limit(1);
  return v;
}

async function detalhe(a: Automacao, podeGerir: boolean): Promise<FluxoDetalhe> {
  const r = lerRascunho(a);
  const v = await versaoAtual(a);
  const webhook = gatilhoDe(r.grafo)?.config.modo === "webhook" ? urlWebhook(a.webhookToken) : null;
  return {
    id: a.id, nome: a.nome, pasta: a.pasta, ativo: a.ativo, estado: estadoDe(a),
    rascunho: { grafo: r.grafo, config: r.config, salvoEm: (a.rascunhoSalvoEm ?? a.updatedAt).toISOString() },
    publicada: v ? { versaoId: v.id, versao: v.version, publicadaEm: (v.publishedAt ?? v.createdAt).toISOString() } : null,
    alteracoesNaoPublicadas: Boolean(v) && difere(r, v),
    webhookUrl: webhook, pendencias: validarGrafo(r.grafo), podeGerir,
  };
}

const novoToken = () => randomBytes(24).toString("base64url");

// ─── Lista ─────────────────────────────────────────────────────────────────

/** Regra antiga → grafo de 2 nós, ou o motivo de não dar para migrar fielmente. */
interface Conversao { grafo: GrafoFluxo; tagNome?: string; erro?: undefined }
type ConversaoOuErro = Conversao | { erro: string };

const GATILHO_PARA_EVENTO: Record<string, string> = {
  novo_lead: "lead.criado", novo_negocio: "negocio.criado", mudanca_status: "negocio.etapa_mudou",
  tag_adicionada: "tag.adicionada", whatsapp_recebido: "whatsapp.recebido",
};
const OPERADOR: Record<string, string> = { igual: "igual", diferente: "diferente", contem: "contem", maior_que: "maior", menor_que: "menor" };

export function converterRegra(regra: Pick<Automacao, "gatilho" | "condicao" | "acao" | "acaoConfig">): ConversaoOuErro {
  const eventoId = GATILHO_PARA_EVENTO[regra.gatilho] ?? EVENTOS_PLATAFORMA.find((e) => e.fontes.legado === regra.gatilho)?.id;
  const evento = eventoId ? eventoPorId(eventoId) : undefined;
  if (!evento) return { erro: `O gatilho "${regra.gatilho}" não tem equivalente no construtor.` };

  const cond = (regra.condicao ?? null) as { campo?: string; operador?: string; valor?: string } | null;
  const filtros: unknown[] = [];
  if (cond?.campo) {
    // Os nomes do ctx.campos legado e do payload do evento novo nem sempre
    // batem. Só migra quando o campo existe no payload: filtro apontando para
    // campo que não chega nunca casaria, e a regra pararia em silêncio.
    if (!evento.campos.some((c) => c.chave === cond.campo)) return { erro: `A condição usa o campo "${cond.campo}", que não chega no evento "${evento.rotulo}". A regra segue no motor antigo.` };
    if (!cond.operador || !OPERADOR[cond.operador]) return { erro: `Operador "${cond.operador ?? ""}" desconhecido.` };
    filtros.push({ campo: `gatilho.${cond.campo}`, operador: OPERADOR[cond.operador], valor: cond.valor ?? "" });
  }

  const c = (regra.acaoConfig ?? {}) as Record<string, unknown>;
  let tipo: TipoNo;
  let config: Record<string, unknown>;
  let tagNome: string | undefined;
  switch (regra.acao) {
    case "criar_tarefa": tipo = "criar_tarefa"; config = { titulo: c.tituloTarefa || "Tarefa gerada por automação", prioridade: c.prioridade || "media", prazoMinutos: 1440, responsavelId: c.usuarioId ?? "" }; break;
    case "notificar_usuario":
      if (!c.usuarioId) return { erro: "A regra notifica sem usuário escolhido." };
      tipo = "notificar_usuario"; config = { usuarioId: c.usuarioId, titulo: "Automação", mensagem: c.mensagem || "Uma automação foi disparada." }; break;
    case "atribuir_responsavel":
      if (!c.usuarioId) return { erro: "A regra atribui responsável sem usuário escolhido." };
      tipo = "atribuir_responsavel"; config = { responsavelId: c.usuarioId }; break;
    case "mudar_status": {
      const etapa = String(c.novoStatus ?? "");
      const ok = evento.entidade === "lead" ? (ETAPAS_PRE_VENDAS as readonly string[]).includes(etapa) : (ETAPAS_PIPELINE as readonly string[]).includes(etapa);
      if (!ok) return { erro: `A etapa "${etapa}" é do status legado e não existe no board atual. A regra segue no motor antigo.` };
      tipo = "mover_etapa"; config = { etapa }; break;
    }
    case "enviar_email": tipo = "enviar_email"; config = { assunto: c.tituloTarefa || "Callface", mensagem: c.mensagem ?? "" }; break;
    case "enviar_whatsapp": tipo = "enviar_whatsapp"; config = c.templateId ? { modo: "template", templateId: c.templateId } : { modo: "texto", mensagem: c.mensagem ?? "" }; break;
    case "adicionar_tag_empresa": case "remover_tag_empresa":
      // A regra antiga põe a tag na EMPRESA; no fluxo, a tag vai no registro do
      // gatilho. Só é a mesma coisa quando o gatilho já é sobre a empresa.
      if (evento.entidade !== "empresa") return { erro: "A regra põe tag na empresa, mas o gatilho é sobre outro registro." };
      if (!c.tag) return { erro: "A regra de tag não tem tag escolhida." };
      tipo = regra.acao === "adicionar_tag_empresa" ? "adicionar_tag" : "remover_tag"; config = { tagId: "" }; tagNome = String(c.tag); break;
    case "iniciar_cadencia": tipo = "inscrever_cadencia"; config = { cadenciaId: c.cadenceDefinitionId ?? "" }; break;
    default: return { erro: `A ação "${regra.acao}" não tem equivalente no construtor.` };
  }
  return {
    tagNome,
    grafo: {
      versao: 1,
      nos: [
        { id: "n1", tipo: "gatilho", posicao: { x: 0, y: 0 }, config: { modo: "evento", evento: evento.id, filtros, permitirOrigemAutomacao: false } },
        { id: "n2", tipo, posicao: { x: 0, y: 160 }, config },
      ],
      arestas: [{ id: "e1", origem: "n1", saida: "ok", destino: "n2" }],
    },
  };
}

export async function listarFluxos(organizacaoId: string, filtro: { busca?: string | null; pasta?: string | null }): Promise<{ fluxos: FluxoResumo[]; pastas: string[]; regrasAntigas: RegraAntiga[] }> {
  const todas = await db.select().from(automacoes).where(eq(automacoes.organizacaoId, organizacaoId)).orderBy(desc(automacoes.updatedAt));
  const fluxosRows = todas.filter((a) => a.tipo === "fluxo");
  const regras = todas.filter((a) => a.tipo === null || a.tipo === "regra");

  const versoesIds = fluxosRows.map((a) => a.currentVersionId).filter((x): x is string => Boolean(x));
  const versoes = versoesIds.length ? await db.select().from(automacaoVersoes).where(and(eq(automacaoVersoes.organizacaoId, organizacaoId), inArray(automacaoVersoes.id, versoesIds))) : [];
  const ids = fluxosRows.map((a) => a.id);
  const stats = ids.length ? (await db.execute<{ automacao_id: string; n7: number; e7: number; ultima_em: Date | null; ultima_status: string | null }>(sql`
    SELECT a.id AS automacao_id,
           (SELECT count(*)::int FROM automacao_execucoes e WHERE e.automacao_id = a.id AND e.executed_at > now() - interval '7 days') AS n7,
           (SELECT count(*)::int FROM automacao_execucoes e WHERE e.automacao_id = a.id AND e.executed_at > now() - interval '7 days' AND e.status = 'erro') AS e7,
           u.executed_at AS ultima_em, u.status AS ultima_status
      FROM automacoes a
      LEFT JOIN LATERAL (SELECT executed_at, status FROM automacao_execucoes e WHERE e.automacao_id = a.id ORDER BY executed_at DESC LIMIT 1) u ON true
     WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.id IN ${ids}`)) as unknown as { automacao_id: string; n7: number; e7: number; ultima_em: Date | string | null; ultima_status: string | null }[] : [];

  const busca = filtro.busca?.trim().toLowerCase();
  const fluxos: FluxoResumo[] = fluxosRows
    .filter((a) => !busca || a.nome.toLowerCase().includes(busca))
    .filter((a) => !filtro.pasta || (filtro.pasta === "__sem_pasta" ? !a.pasta : a.pasta === filtro.pasta))
    .map((a) => {
      const r = lerRascunho(a);
      const v = versoes.find((x) => x.id === a.currentVersionId);
      const st = stats.find((x) => x.automacao_id === a.id);
      const gat = v ? gatilhoDe(grafoDaVersao(v)) : gatilhoDe(r.grafo);
      return {
        id: a.id, nome: a.nome, pasta: a.pasta, ativo: a.ativo, estado: estadoDe(a),
        alteracoesNaoPublicadas: Boolean(v) && difere(r, v), gatilhoResumo: resumirGatilho(gat),
        versaoPublicada: v?.version ?? null, publicadaEm: iso(v?.publishedAt ?? null),
        ultimaExecucao: st?.ultima_em ? { em: new Date(st.ultima_em).toISOString(), status: st.ultima_status as StatusExecucaoFluxo } : null,
        execucoes7d: st?.n7 ?? 0, erros7d: st?.e7 ?? 0, atualizadoEm: a.updatedAt.toISOString(),
      };
    });
  const pastas = [...new Set(fluxosRows.map((a) => a.pasta).filter((p): p is string => Boolean(p)))].sort((x, y) => x.localeCompare(y, "pt-BR"));
  const regrasAntigas: RegraAntiga[] = regras.map((r) => {
    const conv = converterRegra(r);
    return { id: r.id, nome: r.nome, gatilho: r.gatilho, acao: r.acao, ativo: r.ativo, migravel: !conv.erro, motivoNaoMigravel: conv.erro ?? null };
  });
  return { fluxos, pastas, regrasAntigas };
}

// ─── Opções do inspetor e registros ────────────────────────────────────────

export async function opcoesInspetor(organizacaoId: string): Promise<OpcoesInspetor> {
  const [us, tags, cads, tpls, agentes] = await Promise.all([
    db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true))).orderBy(usuarios.nome),
    db.select({ id: labels.id, nome: labels.nome, cor: labels.cor }).from(labels).where(eq(labels.organizacaoId, organizacaoId)).orderBy(labels.nome),
    db.select({ id: cadenceDefinitions.id, nome: cadenceDefinitions.nome, status: cadenceDefinitions.status, ativo: cadenceDefinitions.ativo }).from(cadenceDefinitions).where(eq(cadenceDefinitions.organizacaoId, organizacaoId)).orderBy(cadenceDefinitions.nome),
    db.select({ id: whatsappTemplates.id, nome: whatsappTemplates.nome }).from(whatsappTemplates).where(and(eq(whatsappTemplates.organizacaoId, organizacaoId), eq(whatsappTemplates.ativo, true))).orderBy(whatsappTemplates.nome),
    db.select({ id: aiAgents.id, nome: aiAgents.nome }).from(aiAgents).where(and(eq(aiAgents.organizacaoId, organizacaoId), isNull(aiAgents.archivedAt))).orderBy(aiAgents.nome),
  ]);
  return {
    usuarios: us, tags,
    etapas: {
      lead: ETAPAS_PRE_VENDAS.map((e) => ({ valor: e, rotulo: ROTULO_ETAPA_PRE_VENDAS[e] })),
      negocio: ETAPAS_PIPELINE.map((e) => ({ valor: e, rotulo: ROTULO_ETAPA_PIPELINE[e] })),
    },
    cadencias: cads.map((c) => ({ id: c.id, nome: c.nome, publicada: c.status === "published" && c.ativo })),
    templatesWhatsapp: tpls, agentesIa: agentes,
  };
}

/** Até 20 registros para escolher no Ensaiar/Rodar. */
export async function buscarEntidades(organizacaoId: string, tipo: string, busca: string): Promise<{ id: string; nome: string; detalhe: string | null }[]> {
  const q = `%${busca.trim().replace(/[%_]/g, "")}%`;
  const org = sql`${organizacaoId}::uuid`;
  const consulta = {
    lead: sql`SELECT id, trim(concat_ws(' ', nome, sobrenome)) AS nome, COALESCE(empresa, email) AS detalhe FROM leads WHERE organizacao_id = ${org} AND (nome ILIKE ${q} OR email ILIKE ${q} OR empresa ILIKE ${q}) ORDER BY updated_at DESC LIMIT 20`,
    negocio: sql`SELECT n.id, n.titulo AS nome, n.etapa AS detalhe FROM negocios n WHERE n.organizacao_id = ${org} AND n.titulo ILIKE ${q} ORDER BY n.updated_at DESC LIMIT 20`,
    oportunidade: sql`SELECT id, COALESCE(titulo, 'Oportunidade') AS nome, etapa AS detalhe FROM oportunidades WHERE organizacao_id = ${org} AND COALESCE(titulo, '') ILIKE ${q} ORDER BY updated_at DESC LIMIT 20`,
    contato: sql`SELECT id, nome, COALESCE(telefone, email) AS detalhe FROM contatos WHERE organizacao_id = ${org} AND (nome ILIKE ${q} OR telefone ILIKE ${q} OR email ILIKE ${q}) ORDER BY updated_at DESC LIMIT 20`,
    empresa: sql`SELECT id, nome, cnpj AS detalhe FROM empresas WHERE organizacao_id = ${org} AND (nome ILIKE ${q} OR cnpj ILIKE ${q}) ORDER BY updated_at DESC LIMIT 20`,
    cliente: sql`SELECT c.id, e.nome, c.lifecycle_status AS detalhe FROM clientes c JOIN empresas e ON e.id = c.empresa_id WHERE c.organizacao_id = ${org} AND e.nome ILIKE ${q} ORDER BY c.updated_at DESC LIMIT 20`,
    servico: sql`SELECT s.id, s.canonical_product AS nome, e.nome AS detalhe FROM servicos_canonicos s LEFT JOIN empresas e ON e.id = s.empresa_id WHERE s.organizacao_id = ${org} AND (s.canonical_product ILIKE ${q} OR e.nome ILIKE ${q}) ORDER BY s.updated_at DESC LIMIT 20`,
  }[tipo];
  if (!consulta) throw new ErroFluxo(400, "Tipo de registro desconhecido.");
  return (await db.execute(consulta)) as unknown as { id: string; nome: string; detalhe: string | null }[];
}

/** O registro pertence a esta organização? */
async function entidadeExiste(organizacaoId: string, e: { tipo: TipoEntidade; id: string }): Promise<boolean> {
  if (!ehUuid(e.id)) return false;
  const tabela = { lead: "leads", negocio: "negocios", oportunidade: "oportunidades", contato: "contatos", empresa: "empresas", cliente: "clientes", servico: "servicos_canonicos" }[e.tipo];
  if (!tabela) return false;
  const rows = (await db.execute(sql`SELECT 1 FROM ${sql.raw(tabela)} WHERE id = ${e.id}::uuid AND organizacao_id = ${organizacaoId}::uuid`)) as unknown as unknown[];
  return rows.length > 0;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

function validarForma(grafo: unknown, config: unknown): Rascunho {
  const g = grafoFluxoSchema.safeParse(grafo);
  if (!g.success) throw new ErroFluxo(400, "O desenho da automação veio num formato inválido.", { detalhes: g.error.issues.slice(0, 5) });
  const c = configFluxoSchema.safeParse(config ?? CONFIG_PADRAO);
  if (!c.success) throw new ErroFluxo(400, "As configurações da automação vieram num formato inválido.", { detalhes: c.error.issues.slice(0, 5) });
  return { grafo: g.data as GrafoFluxo, config: c.data };
}

const nomeValido = (n: unknown) => {
  const nome = typeof n === "string" ? n.trim() : "";
  if (!nome || nome.length > 120) throw new ErroFluxo(400, "Dê um nome de até 120 caracteres.");
  return nome;
};
const pastaValida = (p: unknown) => (typeof p === "string" && p.trim() ? p.trim().slice(0, 60) : null);

export async function criarFluxo(organizacaoId: string, usuarioId: string, corpo: { nome?: unknown; pasta?: unknown; grafo?: unknown; config?: unknown }): Promise<FluxoDetalhe> {
  const nome = nomeValido(corpo.nome);
  const r = validarForma(corpo.grafo ?? grafoInicial(), corpo.config ?? CONFIG_PADRAO);
  const gat = gatilhoDe(r.grafo);
  const [a] = await db.insert(automacoes).values({
    organizacaoId, nome, pasta: pastaValida(corpo.pasta), tipo: "fluxo", gatilho: gatilhoColuna(gat), acao: "fluxo", ativo: false,
    rascunho: r, rascunhoSalvoEm: new Date(), createdById: usuarioId, webhookToken: gat?.config.modo === "webhook" ? novoToken() : null,
  }).returning();
  return detalhe(a, true);
}

export async function lerFluxo(organizacaoId: string, id: string, podeGerir: boolean): Promise<FluxoDetalhe> {
  return detalhe(await carregar(organizacaoId, id), podeGerir);
}

export async function salvarRascunho(organizacaoId: string, id: string, corpo: { grafo?: unknown; config?: unknown; nome?: unknown; pasta?: unknown; salvoEmBase?: unknown }) {
  const a = await carregar(organizacaoId, id);
  const r = validarForma(corpo.grafo, corpo.config);
  const base = (a.rascunhoSalvoEm ?? a.updatedAt).toISOString();
  if (typeof corpo.salvoEmBase !== "string" || corpo.salvoEmBase !== base) {
    throw new ErroFluxo(409, "Esta automação mudou em outra aba. Recarregue para continuar.", { salvoEm: base });
  }
  const gat = gatilhoDe(r.grafo);
  const token = gat?.config.modo === "webhook" ? a.webhookToken ?? novoToken() : a.webhookToken;
  const agora = new Date();
  // O WHERE no salvo_em é o controle de concorrência: duas abas salvando ao
  // mesmo tempo, só a primeira passa.
  const [salvo] = await db.update(automacoes).set({
    rascunho: r, rascunhoSalvoEm: agora, updatedAt: agora, webhookToken: token,
    ...(corpo.nome !== undefined && { nome: nomeValido(corpo.nome) }),
    ...(corpo.pasta !== undefined && { pasta: pastaValida(corpo.pasta) }),
  }).where(and(eq(automacoes.id, a.id), eq(automacoes.organizacaoId, organizacaoId), sql`COALESCE(${automacoes.rascunhoSalvoEm}, ${automacoes.updatedAt}) = ${base}::timestamptz`)).returning({ id: automacoes.id });
  if (!salvo) throw new ErroFluxo(409, "Esta automação mudou em outra aba. Recarregue para continuar.");
  return { salvoEm: agora.toISOString(), pendencias: validarGrafo(r.grafo), webhookUrl: gat?.config.modo === "webhook" ? urlWebhook(token) : null };
}

function proximaDoAgendado(grafo: GrafoFluxo, config: ConfigFluxo, ativo: boolean): Date | null {
  const g = gatilhoDe(grafo);
  return ativo && g?.config.modo === "agendado" ? proximaExecucao(g.config, config.fuso, new Date()) : null;
}

async function resumoVersao(v: Versao, atualId: string | null): Promise<VersaoResumo> {
  const [u] = v.createdById ? await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, v.createdById)).limit(1) : [];
  return { id: v.id, versao: v.version, publicadaEm: (v.publishedAt ?? v.createdAt).toISOString(), publicadaPor: u?.nome ?? null, atual: v.id === atualId };
}

export async function publicarFluxo(organizacaoId: string, id: string, usuarioId: string): Promise<{ fluxo: FluxoDetalhe; versao: VersaoResumo }> {
  const a = await carregar(organizacaoId, id);
  const r = lerRascunho(a);
  const pendencias = validarGrafo(r.grafo);
  if (pendencias.length) throw new ErroFluxo(422, `Resolva ${pendencias.length} pendência${pendencias.length > 1 ? "s" : ""} antes de publicar.`, { pendencias });
  const gat = gatilhoDe(r.grafo)!;
  const versao = await db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`COALESCE(max(${automacaoVersoes.version}), 0)::int` }).from(automacaoVersoes).where(eq(automacaoVersoes.automacaoId, a.id));
    const [v] = await tx.insert(automacaoVersoes).values({
      organizacaoId, automacaoId: a.id, version: max + 1, nodes: r.grafo.nos, edges: r.grafo.arestas,
      triggerConfig: gat.config, settings: r.config, publishedAt: new Date(), createdById: usuarioId,
    }).returning();
    await tx.update(automacoes).set({
      currentVersionId: v.id, updatedAt: new Date(), gatilho: gatilhoColuna(gat),
      proximaExecucaoEm: proximaDoAgendado(r.grafo, r.config, a.ativo),
    }).where(eq(automacoes.id, a.id));
    return v;
  });
  const atual = await carregar(organizacaoId, id);
  return { fluxo: await detalhe(atual, true), versao: await resumoVersao(versao, versao.id) };
}

export async function atualizarFluxo(organizacaoId: string, id: string, corpo: { ativo?: unknown; nome?: unknown; pasta?: unknown }): Promise<FluxoDetalhe> {
  const a = await carregar(organizacaoId, id);
  const set: Partial<typeof automacoes.$inferInsert> = { updatedAt: new Date() };
  if (corpo.nome !== undefined) set.nome = nomeValido(corpo.nome);
  if (corpo.pasta !== undefined) set.pasta = pastaValida(corpo.pasta);
  if (corpo.ativo !== undefined) {
    if (typeof corpo.ativo !== "boolean") throw new ErroFluxo(400, "ativo precisa ser verdadeiro ou falso.");
    if (corpo.ativo && !a.currentVersionId) throw new ErroFluxo(409, "Publique antes de ativar.");
    set.ativo = corpo.ativo;
    const v = await versaoAtual(a);
    set.proximaExecucaoEm = v ? proximaDoAgendado(grafoDaVersao(v), configDaVersao(v.settings), corpo.ativo) : null;
  }
  await db.update(automacoes).set(set).where(and(eq(automacoes.id, a.id), eq(automacoes.organizacaoId, organizacaoId)));
  return detalhe(await carregar(organizacaoId, id), true);
}

export async function duplicarFluxo(organizacaoId: string, id: string, usuarioId: string): Promise<FluxoDetalhe> {
  const a = await carregar(organizacaoId, id);
  const r = lerRascunho(a);
  const [copia] = await db.insert(automacoes).values({
    organizacaoId, nome: `${a.nome} (cópia)`.slice(0, 120), pasta: a.pasta, tipo: "fluxo", gatilho: gatilhoColuna(gatilhoDe(r.grafo)), acao: "fluxo",
    ativo: false, rascunho: r, rascunhoSalvoEm: new Date(), createdById: usuarioId,
    webhookToken: gatilhoDe(r.grafo)?.config.modo === "webhook" ? novoToken() : null,
  }).returning();
  return detalhe(copia, true);
}

export async function excluirFluxo(organizacaoId: string, id: string): Promise<void> {
  const a = await carregar(organizacaoId, id);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(automacaoExecucoes).where(and(eq(automacaoExecucoes.automacaoId, a.id), eq(automacaoExecucoes.status, "aguardando")));
  if (n > 0) throw new ErroFluxo(409, `Há ${n} execuç${n > 1 ? "ões" : "ão"} aguardando. Cancele antes de excluir.`, { aguardando: n });
  // Versões, execuções, passos e inscrições saem em cascata (FKs ON DELETE CASCADE).
  await db.delete(automacoes).where(and(eq(automacoes.id, a.id), eq(automacoes.organizacaoId, organizacaoId)));
}

// ─── Versões ───────────────────────────────────────────────────────────────

export async function listarVersoes(organizacaoId: string, id: string): Promise<VersaoResumo[]> {
  const a = await carregar(organizacaoId, id);
  const vs = await db.select().from(automacaoVersoes).where(and(eq(automacaoVersoes.automacaoId, a.id), eq(automacaoVersoes.organizacaoId, organizacaoId))).orderBy(desc(automacaoVersoes.version));
  return Promise.all(vs.map((v) => resumoVersao(v, a.currentVersionId)));
}

async function carregarVersao(organizacaoId: string, a: Automacao, versaoId: string): Promise<Versao> {
  if (!ehUuid(versaoId)) throw new ErroFluxo(404, "Versão não encontrada.");
  const [v] = await db.select().from(automacaoVersoes).where(and(eq(automacaoVersoes.id, versaoId), eq(automacaoVersoes.automacaoId, a.id), eq(automacaoVersoes.organizacaoId, organizacaoId))).limit(1);
  if (!v) throw new ErroFluxo(404, "Versão não encontrada.");
  return v;
}

export async function lerVersao(organizacaoId: string, id: string, versaoId: string) {
  const a = await carregar(organizacaoId, id);
  const v = await carregarVersao(organizacaoId, a, versaoId);
  return { grafo: grafoDaVersao(v), config: configDaVersao(v.settings), versao: await resumoVersao(v, a.currentVersionId) };
}

export async function restaurarVersao(organizacaoId: string, id: string, versaoId: string): Promise<FluxoDetalhe> {
  const a = await carregar(organizacaoId, id);
  const v = await carregarVersao(organizacaoId, a, versaoId);
  await db.update(automacoes).set({ rascunho: { grafo: grafoDaVersao(v), config: configDaVersao(v.settings) }, rascunhoSalvoEm: new Date(), updatedAt: new Date() }).where(eq(automacoes.id, a.id));
  return detalhe(await carregar(organizacaoId, id), true);
}

// ─── Ensaiar e rodar ───────────────────────────────────────────────────────

function lerPedido(corpo: Record<string, unknown>): PedidoExecucao {
  const e = corpo.entidade as { tipo?: unknown; id?: unknown } | undefined;
  return {
    entidade: e && typeof e.tipo === "string" && ehUuid(e.id) ? { tipo: e.tipo as TipoEntidade, id: e.id } : undefined,
    payload: corpo.payload && typeof corpo.payload === "object" && !Array.isArray(corpo.payload) ? (corpo.payload as Record<string, unknown>) : undefined,
    escolhas: corpo.escolhas && typeof corpo.escolhas === "object" ? (corpo.escolhas as Record<string, string>) : undefined,
  };
}

export async function ensaiar(organizacaoId: string, id: string, corpo: Record<string, unknown>): Promise<ResultadoEnsaio> {
  const a = await carregar(organizacaoId, id);
  const base = lerRascunho(a);
  const r = corpo.grafo !== undefined || corpo.config !== undefined ? validarForma(corpo.grafo ?? base.grafo, corpo.config ?? base.config) : base;
  const pedido = lerPedido(corpo);
  if (pedido.entidade && !(await entidadeExiste(organizacaoId, pedido.entidade))) throw new ErroFluxo(404, "Registro não encontrado nesta organização.");
  return ensaiarFluxo({ organizacaoId, automacaoId: a.id, grafo: r.grafo, config: r.config, pedido });
}

export async function rodar(organizacaoId: string, id: string, corpo: Record<string, unknown>): Promise<{ execucao: ExecucaoResumo; passos: PassoExecucao[] }> {
  const a = await carregar(organizacaoId, id);
  const v = await versaoAtual(a);
  if (!v) throw new ErroFluxo(409, "Publique para rodar de verdade. Para testar o rascunho, use Ensaiar.");
  const pedido = lerPedido(corpo);
  const gat = gatilhoDe(grafoDaVersao(v));
  if (gatilhoTemEntidade(gat) && !pedido.entidade) throw new ErroFluxo(422, "Escolha o registro sobre o qual a automação vai rodar.");
  if (pedido.entidade && !(await entidadeExiste(organizacaoId, pedido.entidade))) throw new ErroFluxo(404, "Registro não encontrado nesta organização.");
  const r = await iniciarExecucao({
    automacaoId: a.id, organizacaoId, versaoId: v.id, modo: "manual",
    entidade: pedido.entidade ?? null, payload: pedido.payload ?? {},
  });
  if ("barrada" in r) throw new ErroFluxo(409, r.barrada);
  return detalheExecucaoBase(organizacaoId, r.execucaoId);
}

// ─── Execuções ─────────────────────────────────────────────────────────────

const NOME_ENTIDADE = sql`CASE e.entity_type
  WHEN 'lead' THEN (SELECT trim(concat_ws(' ', x.nome, x.sobrenome)) FROM leads x WHERE x.id = e.entity_id AND x.organizacao_id = e.organizacao_id)
  WHEN 'negocio' THEN (SELECT x.titulo FROM negocios x WHERE x.id = e.entity_id AND x.organizacao_id = e.organizacao_id)
  WHEN 'oportunidade' THEN (SELECT x.titulo FROM oportunidades x WHERE x.id = e.entity_id AND x.organizacao_id = e.organizacao_id)
  WHEN 'contato' THEN (SELECT x.nome FROM contatos x WHERE x.id = e.entity_id AND x.organizacao_id = e.organizacao_id)
  WHEN 'empresa' THEN (SELECT x.nome FROM empresas x WHERE x.id = e.entity_id AND x.organizacao_id = e.organizacao_id)
  WHEN 'cliente' THEN (SELECT em.nome FROM clientes x JOIN empresas em ON em.id = x.empresa_id WHERE x.id = e.entity_id AND x.organizacao_id = e.organizacao_id)
  WHEN 'servico' THEN (SELECT x.canonical_product FROM servicos_canonicos x WHERE x.id = e.entity_id AND x.organizacao_id = e.organizacao_id)
END`;

interface LinhaExec {
  id: string; automacao_id: string; nome: string; versao: number | null; modo: string | null; status: string;
  entity_type: string | null; entity_id: string | null; entidade_nome: string | null;
  executed_at: Date | string; started_at: Date | string | null; finished_at: Date | string | null; retomar_em: Date | string | null; no_atual: string | null; erro: string | null;
  version_id: string | null;
}
const isoDe = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

function resumoExec(r: LinhaExec): ExecucaoResumo {
  return {
    id: r.id, automacaoId: r.automacao_id, automacaoNome: r.nome, versao: r.versao,
    modo: (r.modo ?? "evento") as ModoExecucao, status: r.status as StatusExecucaoFluxo,
    entidade: r.entity_type && r.entity_id ? { tipo: r.entity_type as TipoEntidade, id: r.entity_id, nome: r.entidade_nome } : null,
    iniciadaEm: isoDe(r.started_at ?? r.executed_at)!, terminadaEm: isoDe(r.finished_at), retomarEm: isoDe(r.retomar_em), noAtual: r.no_atual, erro: r.erro,
  };
}

async function consultarExecs(organizacaoId: string, filtro: ReturnType<typeof sql>, limite: number): Promise<LinhaExec[]> {
  return (await db.execute(sql`
    SELECT e.id, e.automacao_id, a.nome, v.version AS versao, e.modo, e.status, e.entity_type, e.entity_id, ${NOME_ENTIDADE} AS entidade_nome,
           e.executed_at, e.started_at, e.finished_at, e.retomar_em, e.no_atual, e.erro, e.version_id
      FROM automacao_execucoes e
      JOIN automacoes a ON a.id = e.automacao_id
      LEFT JOIN automacao_versoes v ON v.id = e.version_id
     WHERE e.organizacao_id = ${organizacaoId}::uuid AND a.tipo = 'fluxo' AND ${filtro}
     ORDER BY e.executed_at DESC LIMIT ${limite}`)) as unknown as LinhaExec[];
}

export async function listarExecucoesDoFluxo(organizacaoId: string, id: string, f: { status?: string | null; antes?: string | null }) {
  const a = await carregar(organizacaoId, id);
  const POR_PAGINA = 30;
  const conds = [sql`e.automacao_id = ${a.id}::uuid`];
  if (f.status) conds.push(sql`e.status = ${f.status}`);
  if (f.antes && !Number.isNaN(Date.parse(f.antes))) conds.push(sql`e.executed_at < ${new Date(f.antes).toISOString()}::timestamptz`);
  const rows = await consultarExecs(organizacaoId, sql.join(conds, sql` AND `), POR_PAGINA + 1);
  const itens = rows.slice(0, POR_PAGINA).map(resumoExec);
  return { itens, proximo: rows.length > POR_PAGINA ? isoDe(rows[POR_PAGINA - 1].executed_at) : null };
}

async function passosDe(organizacaoId: string, execId: string): Promise<PassoExecucao[]> {
  const ps = await db.select().from(automacaoPassosExecucao)
    .where(and(eq(automacaoPassosExecucao.execucaoId, execId), eq(automacaoPassosExecucao.organizacaoId, organizacaoId)))
    .orderBy(automacaoPassosExecucao.ordem, automacaoPassosExecucao.createdAt);
  return ps.map((p) => ({
    noId: p.nodeId, tipo: p.nodeType as TipoNo, ordem: p.ordem, status: p.status as PassoExecucao["status"], saida: p.saida,
    entrada: (p.input ?? {}) as Record<string, unknown>, resultado: (p.output ?? {}) as Record<string, unknown>, erro: p.erro,
    iniciadoEm: iso(p.startedAt), terminadoEm: iso(p.finishedAt),
  }));
}

async function linhaExec(organizacaoId: string, execId: string): Promise<LinhaExec> {
  if (!ehUuid(execId)) throw new ErroFluxo(404, "Execução não encontrada.");
  const [r] = await consultarExecs(organizacaoId, sql`e.id = ${execId}::uuid`, 1);
  if (!r) throw new ErroFluxo(404, "Execução não encontrada.");
  return r;
}

async function detalheExecucaoBase(organizacaoId: string, execId: string) {
  const r = await linhaExec(organizacaoId, execId);
  return { execucao: resumoExec(r), passos: await passosDe(organizacaoId, execId) };
}

export async function detalheExecucao(organizacaoId: string, execId: string): Promise<DetalheExecucao> {
  const r = await linhaExec(organizacaoId, execId);
  const [v] = r.version_id ? await db.select().from(automacaoVersoes).where(and(eq(automacaoVersoes.id, r.version_id), eq(automacaoVersoes.organizacaoId, organizacaoId))).limit(1) : [];
  return { execucao: resumoExec(r), passos: await passosDe(organizacaoId, execId), grafo: v ? grafoDaVersao(v) : { versao: 1, nos: [], arestas: [] } };
}

export async function cancelarExecucao(organizacaoId: string, execId: string): Promise<ExecucaoResumo> {
  const r = await linhaExec(organizacaoId, execId);
  if (r.status !== "aguardando" || !(await cancelarNoExecutor(r.id, r.automacao_id, "cancelada por um usuário"))) {
    throw new ErroFluxo(409, "Só dá para cancelar execução que está aguardando.");
  }
  return resumoExec(await linhaExec(organizacaoId, execId));
}

// ─── Webhook ───────────────────────────────────────────────────────────────

export async function regenerarWebhook(organizacaoId: string, id: string): Promise<{ webhookUrl: string }> {
  const a = await carregar(organizacaoId, id);
  const token = novoToken();
  await db.update(automacoes).set({ webhookToken: token, updatedAt: new Date() }).where(eq(automacoes.id, a.id));
  return { webhookUrl: urlWebhook(token)! };
}

/**
 * Chamada pública. Token desconhecido, automação desligada ou versão sem
 * gatilho webhook dão o MESMO 404: não confirmar a quem tenta adivinhar que o
 * token existe.
 */
export async function receberWebhook(token: string, corpo: Record<string, unknown>, idempotencia: string | null): Promise<{ execucaoId: string | null; ignorado?: string }> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new ErroFluxo(404, "Não encontrado.");
  const [a] = await db.select().from(automacoes).where(and(eq(automacoes.webhookToken, token), eq(automacoes.tipo, "fluxo"), eq(automacoes.ativo, true))).limit(1);
  const v = a ? await versaoAtual(a) : undefined;
  const trigger = (v?.triggerConfig ?? {}) as Record<string, unknown>;
  if (!a || !v || trigger.modo !== "webhook") throw new ErroFluxo(404, "Não encontrado.");

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(automacaoExecucoes)
    .where(and(eq(automacaoExecucoes.automacaoId, a.id), eq(automacaoExecucoes.modo, "webhook"), sql`${automacaoExecucoes.executedAt} > now() - interval '1 minute'`));
  if (n >= 60) throw new ErroFluxo(429, "Limite de 60 chamadas por minuto atingido. Tente de novo em instantes.");

  let entidade: { tipo: TipoEntidade; id: string } | null = null;
  const tipo = String(trigger.webhookEntidade ?? "nenhuma");
  if (tipo !== "nenhuma") {
    const id = String(resolverExpressao(trigger.webhookEntidadeId ?? "", { gatilho: { body: corpo } }) ?? "").trim();
    entidade = { tipo: tipo as TipoEntidade, id };
    if (!(await entidadeExiste(a.organizacaoId, entidade))) throw new ErroFluxo(422, `O corpo não aponta para um registro (${tipo}) desta organização.`);
  }
  const r = await iniciarExecucao({
    automacaoId: a.id, organizacaoId: a.organizacaoId, versaoId: v.id, modo: "webhook", entidade,
    payload: { body: corpo }, idempotencyKey: idempotencia ? `webhook:${a.id}:${idempotencia.slice(0, 200)}` : null,
  });
  return "barrada" in r ? { execucaoId: null, ignorado: r.barrada } : { execucaoId: r.execucaoId };
}

// ─── Migração de regra antiga ──────────────────────────────────────────────

/**
 * Converte NO LUGAR (mesma linha, mesmo id, histórico de execuções junto).
 * Colunas antigas ficam intocadas: desfazer é `tipo = NULL, current_version_id = NULL`.
 */
export async function migrarRegra(organizacaoId: string, regraId: string, usuarioId: string): Promise<FluxoDetalhe> {
  if (!ehUuid(regraId)) throw new ErroFluxo(404, "Regra não encontrada.");
  const [regra] = await db.select().from(automacoes)
    .where(and(eq(automacoes.id, regraId), eq(automacoes.organizacaoId, organizacaoId), or(isNull(automacoes.tipo), eq(automacoes.tipo, "regra")))).limit(1);
  if (!regra) throw new ErroFluxo(404, "Regra não encontrada.");
  const conv = converterRegra(regra);
  if (conv.erro !== undefined) throw new ErroFluxo(422, conv.erro);
  const grafo = conv.grafo;
  if (conv.tagNome) {
    // Mesma resolução do motor antigo: a regra guarda o NOME; cria a tag se faltar.
    const [existente] = await db.select({ id: labels.id }).from(labels).where(and(eq(labels.organizacaoId, organizacaoId), sql`lower(${labels.nome}) = lower(${conv.tagNome})`)).limit(1);
    const label = existente ?? (await db.insert(labels).values({ organizacaoId, nome: conv.tagNome }).returning({ id: labels.id }))[0];
    grafo.nos[1].config.tagId = label.id;
  }
  const pend = validarGrafo(grafo);
  if (pend.length) throw new ErroFluxo(422, `A regra não tem tudo que o fluxo exige: ${pend.map((p) => p.mensagem).join(" ")}`);
  const config = CONFIG_PADRAO;
  await db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`COALESCE(max(${automacaoVersoes.version}), 0)::int` }).from(automacaoVersoes).where(eq(automacaoVersoes.automacaoId, regra.id));
    const [v] = await tx.insert(automacaoVersoes).values({
      organizacaoId, automacaoId: regra.id, version: max + 1, nodes: grafo.nos, edges: grafo.arestas,
      triggerConfig: grafo.nos[0].config, settings: config, publishedAt: new Date(), createdById: usuarioId,
    }).returning({ id: automacaoVersoes.id });
    await tx.update(automacoes).set({ tipo: "fluxo", currentVersionId: v.id, rascunho: { grafo, config }, rascunhoSalvoEm: new Date(), updatedAt: new Date() })
      .where(eq(automacoes.id, regra.id));
  });
  return detalhe(await carregar(organizacaoId, regra.id), true);
}
