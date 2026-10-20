/**
 * Executor dos Fluxos (docs/produto/automacoes-fluxos.md §4).
 *
 * Anda o grafo publicado direto, com UM cursor por execução (cada saída leva a
 * no máximo um bloco, sem laço — `validarGrafo` garante). Não reimplementa
 * ação nenhuma: cada bloco de ação chama o adapter já registrado no
 * cadence-engine por `executarAcaoAvulsa` (motor de ações único, SPEC §18).
 *
 * Garantias, na ordem em que custam caro quando faltam:
 *
 * - Efeito externo nunca repete às cegas. O passo é RESERVADO (insert com
 *   chave `<execução>:<bloco>:<tentativa>`) antes de chamar o adapter. Se a
 *   execução cair no meio e for retomada, um passo DONE é reaproveitado e um
 *   passo RUNNING de bloco com efeito encerra a execução pedindo revisão
 *   humana — mesma política do cadence-engine para envio incerto.
 * - Espera não segura processo: grava `retomar_em` e solta; o sweep retoma.
 * - A execução fica pinada na versão em que começou, nunca no rascunho.
 * - O contexto é relido do banco a cada retomada e depois de cada efeito.
 *
 * O Ensaio (`ensaiarFluxo`) percorre o MESMO `rodarNo`, com leitura real e
 * zero escrita: lógica avalia de verdade, ação vira prévia, espera é pulada.
 */
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { automacaoExecucoes, automacaoInscricoes, automacaoPassosExecucao, automacaoVersoes, cadenceDefinitions, labels, usuarios, whatsappTemplates } from "@/lib/db/schema";
import { executarAcaoAvulsa, type CadenceActionResult } from "@/lib/cadencia/cadence-engine";
import { ETAPAS_PIPELINE, ROTULO_ETAPA_PIPELINE, ROTULO_ETAPA_PRE_VENDAS, type Ator } from "@/lib/vendas/dominio";
import {
  CATALOGO_NOS, CONFIG_PADRAO, FALHA_PADRAO, avaliarRegras, minutosDeEspera, resolverConfig, validarGrafo,
  type ConfigFluxo, type GrafoFluxo, type ModoExecucao, type NoFluxo, type PassoEnsaio, type PedidoExecucao, type ResultadoEnsaio,
} from "./grafo";
import { estadoVazio, hidratarContexto, origemAutomacao, type EntidadeRef, type EstadoExecucao } from "./contexto";
import { dentroDoExpediente, formatarNoFuso, proximoHorarioDoNo } from "./agenda";
import { usuarioDaOrganizacao } from "./adapters-fluxo";
import "./adapters-agente";

type Regra = Parameters<typeof avaliarRegras>[0][number];
type Ctx = Record<string, unknown>;

/** Espaçamento das novas tentativas (minutos), na ordem. */
export const ATRASO_TENTATIVA_MIN = [1, 5, 15];
const MAX_NOS_POR_CHAMADA = 100;
const PROFUNDIDADE_MAXIMA = 3;

// ─── Resultado de um bloco ────────────────────────────────────────────────

export type ResultadoNo =
  | { tipo: "segue"; saida: string; campos: Record<string, unknown>; resultado?: Record<string, unknown>; vars?: Record<string, unknown>; previa?: string; simulado?: boolean }
  | { tipo: "espera"; ate: Date; previa: string }
  | { tipo: "fim"; status: "sucesso" | "erro"; motivo: string | null }
  | { tipo: "falha"; erro: string };

export interface OpcoesNo {
  organizacaoId: string;
  automacaoId: string;
  entidade: EntidadeRef | null;
  config: ConfigFluxo;
  agora: Date;
  /** Ensaio: ações viram prévia, IA não é chamada. */
  ensaio: boolean;
  escolhas?: Record<string, string>;
  /** `fluxo:<execução>:<bloco>:<tentativa>` — vira a chave de idempotência dos adapters. */
  chaveExecucao?: string;
}

const temEfeito = (no: NoFluxo) => CATALOGO_NOS[no.tipo].efeitoExterno || CATALOGO_NOS[no.tipo].categoria === "ia";
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v)).trim();

/** Config com {{ }} resolvidas. Regras ficam cruas: `avaliarRegra` resolve campo e valor ela mesma. */
export function resolverConfigNo(no: NoFluxo, ctx: Ctx): Record<string, unknown> {
  const { regras, rotas, filtros, ...resto } = no.config;
  return { ...resolverConfig(resto, ctx), ...(regras !== undefined && { regras }), ...(rotas !== undefined && { rotas }), ...(filtros !== undefined && { filtros }) };
}

/** Próximo bloco pela saída; `null` = fim do caminho. */
export function proximoNo(grafo: GrafoFluxo, origem: string, saida: string): { no: string; aresta: string } | null {
  const a = grafo.arestas.find((x) => x.origem === origem && x.saida === saida);
  return a ? { no: a.destino, aresta: a.id } : null;
}

function paresParaObjeto(v: unknown): Record<string, unknown> {
  if (Array.isArray(v)) return Object.fromEntries((v as { chave?: string; valor?: unknown }[]).filter((p) => s(p.chave)).map((p) => [s(p.chave), p.valor ?? null]));
  return v && typeof v === "object" ? { ...(v as Record<string, unknown>) } : {};
}

function duracaoTexto(min: number): string {
  if (min % 1440 === 0) return `${min / 1440} dia${min === 1440 ? "" : "s"}`;
  if (min % 60 === 0) return `${min / 60} hora${min === 60 ? "" : "s"}`;
  return `${min} minuto${min === 1 ? "" : "s"}`;
}

// ─── Lógica (pura: só lê o contexto) ───────────────────────────────────────

function rodarLogica(no: NoFluxo, config: Record<string, unknown>, ctx: Ctx, op: OpcoesNo): ResultadoNo {
  switch (no.tipo) {
    case "gatilho": {
      const filtros = (config.filtros as Regra[] | undefined) ?? [];
      if (config.modo === "evento" && filtros.length && !avaliarRegras(filtros, "e", ctx)) return { tipo: "fim", status: "sucesso", motivo: "filtro do gatilho não casou" };
      return { tipo: "segue", saida: "ok", campos: {} };
    }
    case "condicao": {
      const r = avaliarRegras((config.regras as Regra[] | undefined) ?? [], config.combinador === "ou" ? "ou" : "e", ctx);
      return { tipo: "segue", saida: r ? "sim" : "nao", campos: { resultado: r }, previa: r ? "As regras casaram: segue por Sim." : "As regras não casaram: segue por Não." };
    }
    case "roteador": {
      const rotas = (config.rotas as { id: string; rotulo?: string; combinador?: "e" | "ou"; regras: Regra[] }[] | undefined) ?? [];
      const rota = rotas.find((r) => (r.regras?.length ?? 0) > 0 && avaliarRegras(r.regras, r.combinador === "ou" ? "ou" : "e", ctx));
      return { tipo: "segue", saida: rota?.id ?? "senao", campos: { rota: rota?.id ?? "senao" }, previa: rota ? `Seguiu pela rota "${rota.rotulo || rota.id}".` : "Nenhuma rota casou: Caso contrário." };
    }
    case "esperar": {
      const min = minutosDeEspera(config);
      if (!(min >= 1)) return { tipo: "falha", erro: "espera sem duração" };
      const ate = new Date(op.agora.getTime() + min * 60_000);
      return { tipo: "espera", ate, previa: `Esperaria ${duracaoTexto(min)} (retomaria em ${formatarNoFuso(ate, op.config.fuso)})` };
    }
    case "aguardar_horario": {
      const ate = proximoHorarioDoNo(s(config.horario) || "09:00", config.diasSemana as number[] | undefined, op.config.fuso, op.agora);
      if (!ate) return { tipo: "falha", erro: "horário inválido" };
      return { tipo: "espera", ate, previa: `Aguardaria até ${formatarNoFuso(ate, op.config.fuso)}` };
    }
    case "horario_comercial": {
      const exp = config.usarPadrao === false
        ? { dias: (config.dias as number[] | undefined) ?? [1, 2, 3, 4, 5], inicio: s(config.inicio) || "09:00", fim: s(config.fim) || "18:00" }
        : op.config.horarioComercial;
      const dentro = dentroDoExpediente(op.agora, op.config.fuso, exp);
      return { tipo: "segue", saida: dentro ? "dentro" : "fora", campos: {}, previa: dentro ? "Dentro do expediente." : "Fora do expediente." };
    }
    case "definir_variavel": {
      const vars = paresParaObjeto(config.pares);
      return { tipo: "segue", saida: "ok", campos: {}, vars, previa: `Guardou ${Object.keys(vars).map((k) => `vars.${k}`).join(", ") || "nada"}.` };
    }
    case "parar":
      return { tipo: "fim", status: config.resultado === "erro" ? "erro" : "sucesso", motivo: s(config.motivo) || null };
    default:
      return { tipo: "falha", erro: `bloco ${no.tipo} não é de lógica` };
  }
}

// ─── Ações (adapters do cadence-engine) ────────────────────────────────────

/** Bloco do catálogo → adapter do motor único. Exportado para a trava que confere se todos existem. */
export const ADAPTER: Partial<Record<NoFluxo["tipo"], string>> = {
  criar_tarefa: "crm_create_task", adicionar_tag: "crm_add_tag", remover_tag: "crm_remove_tag", atribuir_responsavel: "crm_assign_owner",
  enviar_email: "email", inscrever_cadencia: "fluxo_inscrever_cadencia", remover_cadencia: "fluxo_remover_cadencia",
  notificar_usuario: "fluxo_notificar", atualizar_campo: "fluxo_atualizar_campo", adicionar_nota: "crm_add_note",
  requisicao_http: "fluxo_http", discagem_callface: "crm_callface_call", ia_gerar_texto: "fluxo_ia_texto",
  ia_classificar: "fluxo_ia_classificar", ia_responder: "agente_acionar",
  agente_atribuir: "agente_atribuir", agente_acionar: "agente_acionar", agente_pausar: "agente_pausar",
  agente_transferir: "agente_transferir", agente_encerrar: "agente_encerrar",
};

/** Config do catálogo (pt-BR) → config que o adapter conhece. */
function configDoAdapter(no: NoFluxo, c: Record<string, unknown>, ctx: Ctx, timeoutMs: number): { adapter: string; config: Record<string, unknown>; vars: Record<string, unknown> } {
  const reg = (ctx.registro ?? {}) as Record<string, unknown>;
  const responsavel = (v: unknown) => s(v) || s(reg.responsavel_id);
  switch (no.tipo) {
    case "criar_tarefa":
      return { adapter: "crm_create_task", vars: {}, config: { title: s(c.titulo), description: s(c.descricao) || null, priority: s(c.prioridade) || "media", due_minutes: Number(c.prazoMinutos ?? 1440), owner_id: responsavel(c.responsavelId) || undefined } };
    case "adicionar_tag": case "remover_tag":
      return { adapter: ADAPTER[no.tipo]!, vars: {}, config: { label_id: s(c.tagId) } };
    case "atribuir_responsavel":
      return { adapter: "crm_assign_owner", vars: {}, config: { owner_id: s(c.responsavelId) } };
    case "enviar_whatsapp":
      return c.modo === "template"
        ? { adapter: "whatsapp_template", vars: {}, config: { template_id: s(c.templateId), sessao_id: s(c.sessaoId) || undefined } }
        : { adapter: "whatsapp", vars: { telefone: s(c.telefone) || null }, config: { mensagem: s(c.mensagem), sessao_id: s(c.sessaoId) || undefined } };
    case "enviar_email":
      return { adapter: "email", vars: { email: s(c.para) || null }, config: { assunto: s(c.assunto), mensagem: s(c.mensagem) } };
    case "notificar_usuario":
      return { adapter: "fluxo_notificar", vars: {}, config: { usuarioId: responsavel(c.usuarioId), titulo: s(c.titulo), mensagem: s(c.mensagem) } };
    case "adicionar_nota":
      return { adapter: "crm_add_note", vars: {}, config: { title: s(c.titulo), description: s(c.descricao) || null } };
    case "ia_responder":
      // O bloco "IA: responder" fala pelo ciclo próprio do agente (atribuição, contexto, memória), não pelo passo de cadência.
      return { adapter: "agente_acionar", vars: {}, config: { agenteId: s(c.agenteId), objetivo: s(c.instrucao) || "Responder ao contato e conduzir a conversa", modo: "conduzir", semTrava: true } };
    case "requisicao_http":
      return { adapter: "fluxo_http", vars: {}, config: { ...c, _timeoutMs: timeoutMs } };
    default:
      return { adapter: ADAPTER[no.tipo] ?? "", vars: {}, config: c };
  }
}

/** Resultado do adapter → campos que o bloco publica em {{ nos.<id>.* }}. */
function camposDoResultado(no: NoFluxo, r: CadenceActionResult, config: Record<string, unknown>): Record<string, unknown> {
  const res = r.resultado ?? {};
  if (no.tipo === "mover_etapa") return { etapa: config.etapa ?? null };
  if (no.tipo === "ia_responder") {
    // O que o agente de fato enfileirou (o adapter lê do run); nada enviado = null, nunca texto inventado.
    const mensagens = Array.isArray(res.mensagens) ? (res.mensagens as { id: string; texto: string }[]) : [];
    return { resposta: mensagens.length ? mensagens.map((m) => m.texto).join("\n") : null, mensagemIds: mensagens.map((m) => m.id), handoff: res.handoff === true };
  }
  return Object.fromEntries(CATALOGO_NOS[no.tipo].saidaCampos.map((c) => [c.chave, res[c.chave] ?? null]));
}

async function moverEtapa(no: NoFluxo, c: Record<string, unknown>, ctx: Ctx, op: OpcoesNo, ator: Ator): Promise<CadenceActionResult> {
  const etapa = s(c.etapa);
  if (!etapa) return { sucesso: false, erro: "etapa não escolhida" };
  if (etapa === "ganho") return { sucesso: false, erro: "Ganho exige o gate comercial de pagamento/assinatura e não pode ser feito por automação" };
  const ent = op.entidade!;
  if (ent.tipo === "negocio" || ent.tipo === "oportunidade") {
    // O board /pipeline lê negocios.etapa: a porta de domínio é a de pipeline
    // (valida gate de proposta, grava histórico e espelha no canônico). O
    // adapter crm_update_stage escreve o status legado, que o board não lê.
    const negocioId = ent.tipo === "negocio" ? ent.id : s((ctx.negocio as Record<string, unknown> | null)?.id);
    if (!negocioId) return { sucesso: false, erro: "oportunidade sem negócio vinculado" };
    if (!(ETAPAS_PIPELINE as readonly string[]).includes(etapa)) return { sucesso: false, erro: `etapa de pipeline desconhecida: ${etapa}` };
    try {
      const { moverEtapa: mover } = await import("@/lib/vendas/pipeline");
      await mover({ organizacaoId: op.organizacaoId, negocioId, para: etapa as (typeof ETAPAS_PIPELINE)[number], ator, motivo: "Automação" });
      return { sucesso: true, resultado: { stage: etapa } };
    } catch (e) {
      return { sucesso: false, erro: e instanceof Error ? e.message : String(e) };
    }
  }
  return executarAcaoAvulsa("crm_update_stage", { organizacaoId: op.organizacaoId, entityType: ent.tipo, entityId: ent.id, vars: {}, ator, config: { stage: etapa }, chaveExecucao: op.chaveExecucao });
}

async function rodarAcao(no: NoFluxo, config: Record<string, unknown>, ctx: Ctx, op: OpcoesNo, timeoutMs: number): Promise<ResultadoNo> {
  const meta = CATALOGO_NOS[no.tipo];
  if (meta.exigeEntidade && !op.entidade) return { tipo: "falha", erro: `"${meta.rotulo}" precisa de um registro, e esta execução não tem nenhum` };
  const ator: Ator = { tipo: "AUTOMATION", usuarioId: null, ref: `automacao:${op.automacaoId}` };

  // Usuário escolhido no bloco precisa ser desta organização: o adapter de
  // responsável não confere, e a tarefa iria para alguém de fora.
  const usuarioCampo = no.tipo === "atribuir_responsavel" || no.tipo === "criar_tarefa" ? s(config.responsavelId) : "";
  if (usuarioCampo && !(await usuarioDaOrganizacao(op.organizacaoId, usuarioCampo))) return { tipo: "falha", erro: "usuário escolhido não encontrado nesta organização" };

  let r: CadenceActionResult;
  if (no.tipo === "mover_etapa") {
    r = await moverEtapa(no, config, ctx, op, ator);
  } else {
    const { adapter, config: cfg, vars } = configDoAdapter(no, config, ctx, timeoutMs);
    r = await executarAcaoAvulsa(adapter, {
      organizacaoId: op.organizacaoId, entityType: op.entidade?.tipo ?? "", entityId: op.entidade?.id ?? "",
      vars, ator, config: cfg, chaveExecucao: op.chaveExecucao,
    });
  }
  if (!r.sucesso) return { tipo: "falha", erro: r.erro ?? "a ação falhou" };
  const campos = camposDoResultado(no, r, config);
  const saida = no.tipo === "ia_classificar" ? s(campos.classe) || "outra" : "ok";
  return { tipo: "segue", saida, campos, resultado: r.resultado ?? {} };
}

// ─── Prévia do ensaio ──────────────────────────────────────────────────────

async function nome(org: string, tabela: "usuario" | "tag" | "cadencia" | "template", id: string): Promise<string> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return id || "(não escolhido)";
  const [r] = tabela === "usuario" ? await db.select({ n: usuarios.nome }).from(usuarios).where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, org))).limit(1)
    : tabela === "tag" ? await db.select({ n: labels.nome }).from(labels).where(and(eq(labels.id, id), eq(labels.organizacaoId, org))).limit(1)
    : tabela === "cadencia" ? await db.select({ n: cadenceDefinitions.nome }).from(cadenceDefinitions).where(and(eq(cadenceDefinitions.id, id), eq(cadenceDefinitions.organizacaoId, org))).limit(1)
    : await db.select({ n: whatsappTemplates.nome }).from(whatsappTemplates).where(and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.organizacaoId, org))).limit(1);
  return r?.n ?? "(não encontrado)";
}

const corta = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n)}…` : t);

async function previaAcao(no: NoFluxo, c: Record<string, unknown>, ctx: Ctx, op: OpcoesNo): Promise<string> {
  const org = op.organizacaoId;
  const reg = (ctx.registro ?? {}) as Record<string, unknown>;
  const alvo = s(reg.nome) || "o registro";
  const lead = (ctx.lead ?? {}) as Record<string, unknown>;
  const contato = (ctx.contato ?? {}) as Record<string, unknown>;
  const resp = async (v: unknown) => (s(v) ? nome(org, "usuario", s(v)) : s(reg.responsavel_nome) || "o responsável do registro");
  switch (no.tipo) {
    case "criar_tarefa": return `Criaria a tarefa "${s(c.titulo)}" para ${await resp(c.responsavelId)}, vence em ${duracaoTexto(Number(c.prazoMinutos ?? 1440))}`;
    case "mover_etapa": {
      const e = s(c.etapa);
      const rot = (ROTULO_ETAPA_PIPELINE as Record<string, string>)[e] ?? (ROTULO_ETAPA_PRE_VENDAS as Record<string, string>)[e] ?? e;
      return `Moveria ${alvo} para a etapa "${rot}"`;
    }
    case "adicionar_tag": return `Adicionaria a tag "${await nome(org, "tag", s(c.tagId))}" em ${alvo}`;
    case "remover_tag": return `Removeria a tag "${await nome(org, "tag", s(c.tagId))}" de ${alvo}`;
    case "atribuir_responsavel": return `Passaria ${alvo} para ${await nome(org, "usuario", s(c.responsavelId))}`;
    case "enviar_whatsapp": {
      const tel = s(c.telefone) || s(contato.telefone) || s(lead.telefone) || "(telefone do registro)";
      return c.modo === "template" ? `Enviaria o modelo "${await nome(org, "template", s(c.templateId))}" para ${tel}` : `Enviaria WhatsApp para ${tel}: ${corta(s(c.mensagem))}`;
    }
    case "enviar_email": return `Enviaria o e-mail "${s(c.assunto)}" para ${s(c.para) || s(lead.email) || s(contato.email) || "(e-mail do registro)"}`;
    case "inscrever_cadencia": return `Inscreveria ${alvo} na cadência "${await nome(org, "cadencia", s(c.cadenciaId))}"`;
    case "remover_cadencia": return `Removeria ${alvo} da cadência "${await nome(org, "cadencia", s(c.cadenciaId))}"`;
    case "notificar_usuario": return `Notificaria ${await resp(c.usuarioId)}: ${s(c.titulo) || "Automação"} — ${corta(s(c.mensagem))}`;
    case "atualizar_campo": return `Gravaria "${s(c.valor)}" em ${s(c.campo) === "campos_custom" ? `campo personalizado "${s(c.nomeCampoCustom)}"` : s(c.campo)} de ${alvo}`;
    case "adicionar_nota": return `Adicionaria a nota "${s(c.titulo)}" em ${alvo}`;
    case "requisicao_http": return `Chamaria ${s(c.metodo) || "POST"} ${s(c.url)}`;
    case "discagem_callface": return `Enviaria ${alvo} para a fila de discagem da Callface`;
    case "ia_gerar_texto": return `Pediria à IA: ${corta(s(c.instrucao))}`;
    case "ia_classificar": return "A IA classificaria o texto (no ensaio, segue pela classe escolhida)";
    case "ia_responder": return `O agente responderia a ${alvo} pelo WhatsApp`;
    case "agente_atribuir": return `Atribuiria o atendimento de ${alvo} ao agente (${corta(s(c.objetivo)) || "sem objetivo definido"})`;
    case "agente_acionar": return `Acionaria o agente para ${alvo}: ${corta(s(c.objetivo))}${s(c.modo) === "analisar" ? " (só análise)" : ""}`;
    case "agente_pausar": return `Pausaria o agente no atendimento de ${alvo}`;
    case "agente_transferir": return `Transferiria o atendimento de ${alvo} para ${await resp(c.usuarioId)}`;
    case "agente_encerrar": return `Encerraria a atuação do agente em ${alvo}`;
    default: return CATALOGO_NOS[no.tipo].rotulo;
  }
}

/**
 * Um bloco, em execução real ou em ensaio. Ensaio nunca chama adapter: a
 * divisão entre "avaliar" e "simular" é por `meta.efeitoExterno`/categoria IA,
 * a mesma marca que o editor usa.
 */
export async function rodarNo(no: NoFluxo, config: Record<string, unknown>, ctx: Ctx, op: OpcoesNo): Promise<ResultadoNo> {
  const meta = CATALOGO_NOS[no.tipo];
  if (meta.categoria === "gatilho" || meta.categoria === "logica") return rodarLogica(no, config, ctx, op);
  if (op.ensaio) {
    const previa = await previaAcao(no, config, ctx, op);
    const campos = Object.fromEntries(meta.saidaCampos.map((c) => [c.chave, "(ensaio)"]));
    const saida = no.tipo === "ia_classificar" ? op.escolhas?.[no.id] ?? "outra" : "ok";
    if (no.tipo === "ia_classificar") campos.classe = saida;
    return { tipo: "segue", saida, campos, previa, simulado: true };
  }
  const falha = no.falha ?? FALHA_PADRAO;
  return rodarAcao(no, config, ctx, op, falha.timeoutSeg * 1000);
}

function comTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error(`tempo limite de ${Math.round(ms / 1000)}s esgotado`)), ms); })])
    .finally(() => clearTimeout(t));
}

// ─── Execução real ─────────────────────────────────────────────────────────

export function grafoDaVersao(v: { nodes: unknown; edges: unknown }): GrafoFluxo {
  return { versao: 1, nos: (v.nodes as NoFluxo[]) ?? [], arestas: (v.edges as GrafoFluxo["arestas"]) ?? [] };
}
export function configDaVersao(settings: unknown): ConfigFluxo {
  const c = (settings ?? {}) as Partial<ConfigFluxo>;
  return { ...CONFIG_PADRAO, ...c, horarioComercial: { ...CONFIG_PADRAO.horarioComercial, ...(c.horarioComercial ?? {}) } };
}

export interface PedidoInicio {
  automacaoId: string;
  organizacaoId: string;
  versaoId: string;
  modo: ModoExecucao;
  entidade: EntidadeRef | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  profundidade?: number;
}

export type InicioExecucao = { execucaoId: string; replay: boolean } | { barrada: string };

/** Política de reentrada (§4.4). Devolve o id da inscrição criada, `null` sem inscrição, ou `false` = barrada. */
async function reservarInscricao(p: PedidoInicio, reentrada: ConfigFluxo["reentrada"]): Promise<string | null | false> {
  if (!p.entidade || reentrada === "sempre") return null;
  if (reentrada === "uma_vez") {
    const [ja] = await db.select({ id: automacaoInscricoes.id }).from(automacaoInscricoes).where(and(
      eq(automacaoInscricoes.automacaoId, p.automacaoId), eq(automacaoInscricoes.entityType, p.entidade.tipo), eq(automacaoInscricoes.entityId, p.entidade.id),
    )).limit(1);
    if (ja) return false;
  }
  // uq_automacao_inscricao_viva (ACTIVE/PAUSED) é quem decide "já tem execução viva".
  const [ins] = await db.insert(automacaoInscricoes).values({
    organizacaoId: p.organizacaoId, automacaoId: p.automacaoId, versionId: p.versaoId,
    entityType: p.entidade.tipo, entityId: p.entidade.id, status: "ACTIVE",
  }).onConflictDoNothing().returning({ id: automacaoInscricoes.id });
  return ins ? ins.id : false;
}

/**
 * Cria a execução e anda até a primeira espera (ou o fim). Replay com a mesma
 * `idempotencyKey` devolve a execução existente sem rodar nada de novo.
 */
export async function iniciarExecucao(p: PedidoInicio): Promise<InicioExecucao> {
  if (p.idempotencyKey) {
    const [ja] = await db.select({ id: automacaoExecucoes.id }).from(automacaoExecucoes).where(eq(automacaoExecucoes.idempotencyKey, p.idempotencyKey)).limit(1);
    if (ja) return { execucaoId: ja.id, replay: true };
  }
  const [versao] = await db.select().from(automacaoVersoes)
    .where(and(eq(automacaoVersoes.id, p.versaoId), eq(automacaoVersoes.organizacaoId, p.organizacaoId))).limit(1);
  if (!versao) throw new Error("versão da automação não encontrada");
  const grafo = grafoDaVersao(versao);
  const config = configDaVersao(versao.settings);
  const gatilho = grafo.nos.find((n) => n.tipo === "gatilho");
  const primeiro = gatilho ? proximoNo(grafo, gatilho.id, "ok")?.no ?? null : null;

  const inscricao = await reservarInscricao(p, config.reentrada);
  if (inscricao === false) {
    return { barrada: config.reentrada === "uma_vez" ? "Este registro já passou por esta automação uma vez." : "Este registro já está numa execução em andamento desta automação." };
  }

  // Falha ao gravar a execução não pode deixar a inscrição ACTIVE órfã: ela barraria o registro para sempre.
  const [exec] = await db.insert(automacaoExecucoes).values({
    automacaoId: p.automacaoId, organizacaoId: p.organizacaoId,
    entityType: p.entidade?.tipo ?? null, entityId: p.entidade?.id ?? null,
    status: "executando", versionId: p.versaoId, modo: p.modo,
    estado: estadoVazio(p.payload), noAtual: primeiro,
    profundidade: p.profundidade ?? 0, idempotencyKey: p.idempotencyKey ?? null, startedAt: new Date(),
  }).onConflictDoNothing().returning({ id: automacaoExecucoes.id }).catch(async (e) => {
    if (inscricao) await db.delete(automacaoInscricoes).where(eq(automacaoInscricoes.id, inscricao));
    throw e;
  });

  if (!exec) {
    // Corrida com outro disparo da mesma chave: a inscrição que reservei não tem dono.
    if (inscricao) await db.delete(automacaoInscricoes).where(eq(automacaoInscricoes.id, inscricao));
    const [ja] = await db.select({ id: automacaoExecucoes.id }).from(automacaoExecucoes).where(eq(automacaoExecucoes.idempotencyKey, p.idempotencyKey!)).limit(1);
    return { execucaoId: ja.id, replay: true };
  }
  if (inscricao) {
    await db.update(automacaoInscricoes).set({ metadata: { execucaoId: exec.id }, currentNodeId: primeiro, updatedAt: new Date() }).where(eq(automacaoInscricoes.id, inscricao));
  }
  if (!primeiro) await finalizar(exec.id, p.automacaoId, "sucesso", null, estadoVazio(p.payload));
  else await avancarExecucao(exec.id);
  return { execucaoId: exec.id, replay: false };
}

async function finalizar(execId: string, automacaoId: string, status: "sucesso" | "erro" | "cancelado", erro: string | null, estado: EstadoExecucao): Promise<void> {
  await db.update(automacaoExecucoes).set({
    status, erro, estado, finishedAt: new Date(), claimedUntil: null, retomarEm: null, noAtual: null,
    resultado: { final: status, ...(erro && { motivo: erro }) },
  }).where(eq(automacaoExecucoes.id, execId));
  await db.update(automacaoInscricoes).set({
    status: status === "sucesso" ? "COMPLETED" : status === "erro" ? "FAILED" : "CANCELLED",
    finishedAt: new Date(), motivoSaida: erro, updatedAt: new Date(),
  }).where(and(eq(automacaoInscricoes.automacaoId, automacaoId), inArray(automacaoInscricoes.status, ["ACTIVE", "PAUSED"]), sql`${automacaoInscricoes.metadata}->>'execucaoId' = ${execId}`));
}

export async function cancelarExecucao(execId: string, automacaoId: string, motivo: string): Promise<boolean> {
  const [row] = await db.select({ estado: automacaoExecucoes.estado }).from(automacaoExecucoes)
    .where(and(eq(automacaoExecucoes.id, execId), eq(automacaoExecucoes.status, "aguardando"))).limit(1);
  if (!row) return false;
  await finalizar(execId, automacaoId, "cancelado", motivo, row.estado as EstadoExecucao);
  return true;
}

export const MOTIVO_LEAD_RESPONDEU = "lead respondeu";

/**
 * O lead respondeu (chamado por `registrarRespostaEmCadencias`, que o canal
 * chama a cada mensagem recebida). Execuções ESPERANDO pelo mesmo registro —
 * contato, o lead dele, negócios/oportunidades abertos do lead — seguem a
 * `ConfigFluxo.aoResponder` da versão em que começaram:
 *  - `continuar` (padrão, e o de todo fluxo publicado antes desta opção):
 *    nada muda, a espera vence no horário;
 *  - `parar`: a execução é cancelada com motivo "lead respondeu", e o bloco
 *    onde ela retomaria aparece em Execuções como pulado, com o motivo.
 *
 * Só para execução que começou ANTES da resposta: a mesma mensagem reentregue
 * não derruba o fluxo que ela própria disparou. Execução no meio de um bloco
 * (claim vivo) não é tocada: ela termina o bloco e o próximo sweep decide.
 */
export async function registrarRespostaEmFluxos(input: { organizacaoId: string; contatoId: string; entidadeIds: string[]; recebidaEm?: Date }): Promise<number> {
  const ids = [...new Set(input.entidadeIds.filter(Boolean))];
  if (!ids.length) return 0;
  const recebidaEm = input.recebidaEm ?? new Date();
  const candidatas = await db.select({ id: automacaoExecucoes.id, nodes: automacaoVersoes.nodes })
    .from(automacaoExecucoes)
    .innerJoin(automacaoVersoes, eq(automacaoVersoes.id, automacaoExecucoes.versionId))
    .where(and(
      eq(automacaoExecucoes.organizacaoId, input.organizacaoId),
      eq(automacaoExecucoes.status, "aguardando"),
      inArray(automacaoExecucoes.entityId, ids),
      sql`coalesce(${automacaoExecucoes.startedAt}, ${automacaoExecucoes.executedAt}) < ${recebidaEm.toISOString()}::timestamptz`,
      sql`${automacaoVersoes.settings}->>'aoResponder' = 'parar'`,
    ));
  let paradas = 0;
  for (const c of candidatas) {
    // Claim curto: o sweep não retoma enquanto paramos, e quem já está andando a execução vence.
    const [exec] = await db.update(automacaoExecucoes).set({ claimedUntil: sql`now() + interval '1 minute'` }).where(and(
      eq(automacaoExecucoes.id, c.id), eq(automacaoExecucoes.status, "aguardando"),
      or(isNull(automacaoExecucoes.claimedUntil), lt(automacaoExecucoes.claimedUntil, sql`now()`)),
    )).returning();
    if (!exec) continue;
    const estado = { ...estadoVazio(), ...(exec.estado as EstadoExecucao) };
    const no = (c.nodes as NoFluxo[] | null)?.find((n) => n.id === exec.noAtual);
    if (no) {
      const [{ n: ordem }] = await db.select({ n: sql<number>`count(*)::int` }).from(automacaoPassosExecucao).where(eq(automacaoPassosExecucao.execucaoId, exec.id));
      await db.insert(automacaoPassosExecucao).values({
        organizacaoId: exec.organizacaoId, execucaoId: exec.id, nodeId: no.id, nodeType: no.tipo, ordem,
        status: "SKIPPED", saida: null, erro: MOTIVO_LEAD_RESPONDEU,
        output: { motivo: MOTIVO_LEAD_RESPONDEU, contatoId: input.contatoId, respondidoEm: recebidaEm.toISOString() },
        idempotencyKey: `${exec.id}:resposta`, startedAt: new Date(), finishedAt: new Date(),
      }).onConflictDoNothing();
    }
    await finalizar(exec.id, exec.automacaoId, "cancelado", MOTIVO_LEAD_RESPONDEU, estado);
    paradas++;
  }
  return paradas;
}

/**
 * Anda uma execução a partir de `no_atual`. Só uma chamada por vez anda a
 * mesma execução (claim por `claimed_until`); quem perde o claim sai calado.
 */
export async function avancarExecucao(execId: string): Promise<void> {
  const [exec] = await db.update(automacaoExecucoes)
    .set({ claimedUntil: sql`now() + interval '6 minutes'`, status: "executando", retomarEm: null })
    .where(and(
      eq(automacaoExecucoes.id, execId),
      inArray(automacaoExecucoes.status, ["executando", "aguardando"]),
      or(isNull(automacaoExecucoes.claimedUntil), lt(automacaoExecucoes.claimedUntil, sql`now()`)),
      or(isNull(automacaoExecucoes.retomarEm), lte(automacaoExecucoes.retomarEm, sql`now()`)),
    )).returning();
  if (!exec) return;

  const estado = { ...estadoVazio(), ...(exec.estado as EstadoExecucao) };
  const fim = (status: "sucesso" | "erro", erro: string | null) => finalizar(exec.id, exec.automacaoId, status, erro, estado);
  const [versao] = exec.versionId ? await db.select().from(automacaoVersoes).where(eq(automacaoVersoes.id, exec.versionId)).limit(1) : [];
  if (!versao) return fim("erro", "a versão desta execução não existe mais");

  const grafo = grafoDaVersao(versao);
  const config = configDaVersao(versao.settings);
  const entidade: EntidadeRef | null = exec.entityType && exec.entityId ? { tipo: exec.entityType as EntidadeRef["tipo"], id: exec.entityId } : null;
  const [{ n: jaFeitos }] = await db.select({ n: sql<number>`count(*)::int` }).from(automacaoPassosExecucao).where(eq(automacaoPassosExecucao.execucaoId, exec.id));
  let ordem = jaFeitos;
  let ctx = await hidratarContexto(exec.organizacaoId, entidade, estado);
  let noId = exec.noAtual;

  for (let i = 0; i < MAX_NOS_POR_CHAMADA && noId; i++) {
    const no = grafo.nos.find((n) => n.id === noId);
    if (!no) return fim("erro", `o bloco ${noId} não existe na versão publicada`);
    const tentativa = estado.tentativas[no.id] ?? 0;
    const chave = `${exec.id}:${no.id}:${tentativa}`;
    const agora = new Date();

    if (no.desativado) {
      await db.insert(automacaoPassosExecucao).values({
        organizacaoId: exec.organizacaoId, execucaoId: exec.id, nodeId: no.id, nodeType: no.tipo, ordem: ordem++,
        status: "SKIPPED", saida: "ok", idempotencyKey: chave, startedAt: agora, finishedAt: agora,
      }).onConflictDoNothing();
      noId = proximoNo(grafo, no.id, "ok")?.no ?? null;
      continue;
    }

    // Reserva ANTES do efeito.
    let [passo] = await db.insert(automacaoPassosExecucao).values({
      organizacaoId: exec.organizacaoId, execucaoId: exec.id, nodeId: no.id, nodeType: no.tipo, ordem: ordem++,
      status: "RUNNING", idempotencyKey: chave, startedAt: agora,
    }).onConflictDoNothing().returning({ id: automacaoPassosExecucao.id });
    if (!passo) {
      const [anterior] = await db.select().from(automacaoPassosExecucao).where(eq(automacaoPassosExecucao.idempotencyKey, chave)).limit(1);
      if (anterior && (anterior.status === "DONE" || anterior.status === "SKIPPED")) {
        // Retomada depois de queda: o bloco já rodou, reaproveita a saída.
        estado.nos[no.id] = ((anterior.output as Record<string, unknown>)?.campos as Record<string, unknown>) ?? {};
        noId = proximoNo(grafo, no.id, anterior.saida ?? "ok")?.no ?? null;
        continue;
      }
      if (anterior?.status === "RUNNING" && temEfeito(no)) {
        return fim("erro", `efeito externo incerto no bloco "${no.rotulo || CATALOGO_NOS[no.tipo].rotulo}": a execução caiu no meio dele. Revise à mão antes de rodar de novo.`);
      }
      passo = { id: anterior!.id };
      await db.update(automacaoPassosExecucao).set({ status: "RUNNING", startedAt: agora, erro: null }).where(eq(automacaoPassosExecucao.id, passo.id));
    }

    const cfg = resolverConfigNo(no, ctx);
    const falha = no.falha ?? FALHA_PADRAO;
    const op: OpcoesNo = { organizacaoId: exec.organizacaoId, automacaoId: exec.automacaoId, entidade, config, agora, ensaio: false, chaveExecucao: `fluxo:${chave}` };
    let r: ResultadoNo;
    try {
      const rodar = () => origemAutomacao.run({ automacaoId: exec.automacaoId, execucaoId: exec.id, profundidade: exec.profundidade }, () => rodarNo(no, cfg, ctx, op));
      r = temEfeito(no) ? await comTimeout(rodar(), falha.timeoutSeg * 1000) : await rodar();
    } catch (e) {
      r = { tipo: "falha", erro: e instanceof Error ? e.message : String(e) };
    }
    const fechar = (status: "DONE" | "FAILED", saida: string | null, output: Record<string, unknown>, erro: string | null = null) =>
      db.update(automacaoPassosExecucao).set({ status, saida, input: cfg, output, erro, finishedAt: new Date() }).where(eq(automacaoPassosExecucao.id, passo!.id));

    if (r.tipo === "segue") {
      await fechar("DONE", r.saida, { campos: r.campos, resultado: r.resultado ?? {} });
      estado.nos[no.id] = r.campos;
      if (r.vars) Object.assign(estado.vars, r.vars);
      delete estado.tentativas[no.id];
      noId = proximoNo(grafo, no.id, r.saida)?.no ?? null;
      if (temEfeito(no)) ctx = await hidratarContexto(exec.organizacaoId, entidade, estado);
    } else if (r.tipo === "espera") {
      estado.nos[no.id] = { retomadoEm: r.ate.toISOString() };
      await fechar("DONE", "ok", { campos: estado.nos[no.id], retomadoEm: r.ate.toISOString() });
      const prox = proximoNo(grafo, no.id, "ok")?.no ?? null;
      if (!prox) return fim("sucesso", null);
      await db.update(automacaoExecucoes).set({ status: "aguardando", noAtual: prox, retomarEm: r.ate, claimedUntil: null, estado }).where(eq(automacaoExecucoes.id, exec.id));
      return;
    } else if (r.tipo === "fim") {
      await fechar("DONE", null, { motivo: r.motivo });
      return fim(r.status, r.status === "erro" ? r.motivo ?? "parada com erro" : null);
    } else {
      await fechar("FAILED", null, {}, r.erro);
      if (temEfeito(no) && tentativa < falha.tentativas) {
        estado.tentativas[no.id] = tentativa + 1;
        const atraso = ATRASO_TENTATIVA_MIN[Math.min(tentativa, ATRASO_TENTATIVA_MIN.length - 1)];
        await db.update(automacaoExecucoes).set({
          status: "aguardando", noAtual: no.id, retomarEm: new Date(Date.now() + atraso * 60_000), claimedUntil: null, estado, erro: r.erro,
        }).where(eq(automacaoExecucoes.id, exec.id));
        return;
      }
      const politica = temEfeito(no) ? falha.politica : "parar";
      if (politica === "parar") return fim("erro", r.erro);
      delete estado.tentativas[no.id];
      estado.nos[no.id] = { erro: r.erro };
      if (politica === "saida_erro") {
        noId = proximoNo(grafo, no.id, "erro")?.no ?? null;
        if (!noId) return fim("erro", `${r.erro} (a saída de erro não está ligada a nenhum bloco)`);
      } else {
        noId = proximoNo(grafo, no.id, "ok")?.no ?? null;
      }
    }
    // Cursor salvo a cada bloco: uma queda retoma daqui, não do começo.
    await db.update(automacaoExecucoes).set({ noAtual: noId, estado }).where(eq(automacaoExecucoes.id, exec.id));
  }

  if (noId) {
    // Teto por chamada (100 blocos): o resto segue na próxima volta do sweep.
    await db.update(automacaoExecucoes).set({ status: "aguardando", retomarEm: new Date(), claimedUntil: null, estado }).where(eq(automacaoExecucoes.id, exec.id));
    return;
  }
  return fim("sucesso", null);
}

/** Execuções devidas: espera vencida, nova tentativa ou execução que caiu com o claim expirado. */
export async function retomarDevidas(limite = 100): Promise<number> {
  const devidas = await db.select({ id: automacaoExecucoes.id }).from(automacaoExecucoes).where(or(
    and(eq(automacaoExecucoes.status, "aguardando"), lte(automacaoExecucoes.retomarEm, sql`now()`)),
    and(eq(automacaoExecucoes.status, "executando"), lt(automacaoExecucoes.claimedUntil, sql`now()`)),
  )).orderBy(asc(automacaoExecucoes.retomarEm)).limit(limite);
  let n = 0;
  for (const d of devidas) {
    try { await avancarExecucao(d.id); n++; } catch (e) { console.error(`[fluxos] falha ao retomar execução ${d.id} (best-effort):`, e); }
  }
  return n;
}

// ─── Anti-loop ─────────────────────────────────────────────────────────────

/**
 * Evento carimbado por automação: dispara este fluxo? Devolve a profundidade
 * da execução nova, ou `null` para descartar.
 */
export function profundidadeParaEvento(payload: Record<string, unknown>, automacaoId: string, permitirOrigemAutomacao: boolean): number | null {
  const origem = payload._automacao as { automacaoId?: string; profundidade?: number } | undefined;
  if (!origem) return 0;
  const prof = Number(origem.profundidade ?? 0);
  if (prof + 1 >= PROFUNDIDADE_MAXIMA) return null;
  if (origem.automacaoId === automacaoId) return null;
  if (!permitirOrigemAutomacao) return null;
  return prof + 1;
}

// ─── Ensaio ────────────────────────────────────────────────────────────────

/**
 * Percorre o fluxo SEM gravar nada: nem execução, nem passo, nem efeito. A
 * leitura do contexto é real (o registro escolhido), para a prévia mostrar o
 * texto que iria de verdade.
 */
export async function ensaiarFluxo(args: { organizacaoId: string; automacaoId: string; grafo: GrafoFluxo; config: ConfigFluxo; pedido: PedidoExecucao }): Promise<ResultadoEnsaio> {
  const { organizacaoId, grafo, pedido } = args;
  const config = configDaVersao(args.config);
  const pendencias = validarGrafo(grafo);
  const estado = estadoVazio(pedido.payload ?? {});
  const entidade = pedido.entidade ?? null;
  const ctx = await hidratarContexto(organizacaoId, entidade, estado);
  const contexto = Object.fromEntries(["registro", "lead", "negocio", "contato", "empresa", "gatilho", "vars", "nos", "agora", "hoje"].map((k) => [k, ctx[k]]));
  const passos: PassoEnsaio[] = [];
  const arestas: string[] = [];
  const gatilho = grafo.nos.find((n) => n.tipo === "gatilho");
  if (!gatilho) return { passos, arestas, final: "pendencia", contexto };

  // Relógio simulado: "esperaria" avança o tempo, para o horário comercial
  // depois de uma espera decidir com a hora em que o fluxo estaria de fato.
  let agora = new Date();
  let no: NoFluxo | undefined = gatilho;
  let final: ResultadoEnsaio["final"] = "sucesso";
  for (let i = 0; no && i < 200; i++) {
    const atual: NoFluxo = no;
    const pend = pendencias.find((p) => p.noId === atual.id);
    if (pend) {
      passos.push({ noId: atual.id, tipo: atual.tipo, status: "pendencia", saida: null, previa: pend.mensagem, entrada: {}, resultado: {} });
      final = "pendencia";
      break;
    }
    const cfg = resolverConfigNo(atual, ctx);
    let r: ResultadoNo;
    if (atual.desativado) r = { tipo: "segue", saida: "ok", campos: {}, previa: "Bloco desligado: passaria direto." };
    else {
      try {
        r = await rodarNo(atual, cfg, ctx, { organizacaoId, automacaoId: args.automacaoId, entidade, config, agora, ensaio: true, escolhas: pedido.escolhas });
      } catch (e) {
        r = { tipo: "falha", erro: e instanceof Error ? e.message : String(e) };
      }
    }
    let saida: string | null = null;
    if (r.tipo === "segue") {
      saida = r.saida;
      estado.nos[atual.id] = r.campos;
      if (r.vars) Object.assign(estado.vars, r.vars);
      const previa = r.previa ?? (atual.tipo === "gatilho" ? "Começaria aqui." : CATALOGO_NOS[atual.tipo].rotulo);
      passos.push({ noId: atual.id, tipo: atual.tipo, status: r.simulado ? "simulado" : "ok", saida, previa, entrada: cfg, resultado: r.campos });
    } else if (r.tipo === "espera") {
      saida = "ok";
      estado.nos[atual.id] = { retomadoEm: r.ate.toISOString() };
      passos.push({ noId: atual.id, tipo: atual.tipo, status: "esperaria", saida, previa: r.previa, entrada: cfg, resultado: estado.nos[atual.id] });
      agora = r.ate;
    } else if (r.tipo === "fim") {
      const previa = atual.tipo === "gatilho" ? "O filtro do gatilho não casou: a automação não rodaria para este registro." : `Pararia aqui${r.motivo ? `: ${r.motivo}` : "."}`;
      passos.push({ noId: atual.id, tipo: atual.tipo, status: "ok", saida: null, previa, entrada: cfg, resultado: {} });
      final = atual.tipo === "gatilho" ? "parado" : r.status === "erro" ? "erro" : "parado";
      break;
    } else {
      passos.push({ noId: atual.id, tipo: atual.tipo, status: "erro", saida: null, previa: r.erro, entrada: cfg, resultado: {} });
      final = "erro";
      break;
    }
    const prox = proximoNo(grafo, atual.id, saida);
    if (prox) arestas.push(prox.aresta);
    no = prox ? grafo.nos.find((n) => n.id === prox.no) : undefined;
  }
  return { passos, arestas, final, contexto };
}
