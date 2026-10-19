/* ─────────────────────────────────────────────────────────────────────────
 * Cadência como LISTA DE PASSOS — e como essa lista vira o grafo que o
 * motor já lê.
 *
 * Por que lista e não canvas: as cadências reais de produção (4, 55 passos)
 * são todas lineares — zero nós de condição. Um editor de grafo para uma
 * sequência no tempo cobra o preço da ramificação em toda tela, inclusive
 * quando ninguém ramifica. Aqui a sequência é o modelo mental: "espera
 * tanto, manda isso, por aqui".
 *
 * O formato salvo continua sendo o MESMO grafo (`followupGraphSchema`), que
 * `compileFollowupGraph` transforma nos steps do motor. Nada de formato
 * novo: cada passo desta lista é um nó de ação (mais um nó de espera, quando
 * há espera) ligado em cadeia do gatilho até o fim.
 *
 * Ramificação continua representável, como passo especial:
 *  - `condicao`   → nó condition: "Sim" segue a lista, "Não" encerra.
 *  - `classificar`→ nó ai_classify: a classe escolhida segue, as outras
 *                   encerram.
 * Grafo que ramifica de outra forma (feito no canvas antigo) é detectado e
 * a tela avisa em vez de achatar o fluxo em silêncio.
 * ───────────────────────────────────────────────────────────────────────── */

import {
  branchesForNode, type FollowupEdge, type FollowupGraph, type FollowupNode,
} from "@/lib/ai-platform/followup/graph";
import type { CampoConfig } from "@/lib/automacoes/grafo";

// ─── Modelo da lista ──────────────────────────────────────────────────────

/** Por onde o passo fala. Escolha de primeira classe, não item perdido num
 *  select de "tipo de ação" com dez opções. */
export type Canal = "whatsapp" | "whatsapp_template" | "whatsapp_ia" | "email" | "ligacao";

export type Prioridade = "baixa" | "media" | "alta" | "urgente";
export type OperadorCondicao = "eq" | "neq" | "gte" | "lte" | "contains";
export type Regra = { campo: string; op: OperadorCondicao; valor: string };

type Base = {
  id: string;
  /** Espera desde o passo anterior, em minutos. 0 = assim que o anterior terminar. */
  esperaMin: number;
};

export type Passo =
  | (Base & {
      tipo: "mensagem"; canal: Canal;
      /** Texto livre (WhatsApp) ou corpo do e-mail. Aceita {{chave}}. */
      mensagem?: string;
      assunto?: string;
      templateId?: string;
      instrucao?: string;
      agenteId?: string;
      /** Número de WhatsApp que envia. Vazio = o do responsável do registro. */
      sessaoId?: string;
    })
  | (Base & { tipo: "tarefa"; titulo?: string; descricao?: string; prioridade?: Prioridade; prazoMin?: number; responsavelId?: string })
  | (Base & { tipo: "crm"; acao: AcaoCrm; tagId?: string; etapa?: string; responsavelId?: string; titulo?: string; descricao?: string })
  | (Base & { tipo: "condicao"; combinador?: "and" | "or"; regras: Regra[] })
  | (Base & { tipo: "classificar"; classes: { id: string; rotulo: string }[]; segueEm?: string; graceMin?: number; instrucao?: string; agenteId?: string });

export type AcaoCrm = "nota" | "tag_add" | "tag_remove" | "etapa" | "responsavel";
export type TipoPasso = Passo["tipo"];

/** O motor recusa espera menor que 5 min (`waitNodeSchema`). Abaixo disso o
 *  passo roda na sequência, sem nó de espera. */
export const ESPERA_MINIMA_MIN = 1 / 60;
/** `grace_timeout_ms` mínimo do nó de classificação. */
export const GRACE_MINIMA_MIN = 15;

export const ROTULO_CANAL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  whatsapp_template: "WhatsApp (modelo)",
  whatsapp_ia: "WhatsApp com IA",
  email: "E-mail",
  ligacao: "Ligação Callface",
};

export const ROTULO_TIPO: Record<TipoPasso, string> = {
  mensagem: "Mensagem", tarefa: "Tarefa", crm: "Atualizar o CRM",
  condicao: "Condição", classificar: "Classificar resposta com IA",
};

export const ROTULO_ACAO_CRM: Record<AcaoCrm, string> = {
  nota: "Registrar nota", tag_add: "Adicionar tag", tag_remove: "Remover tag",
  etapa: "Mover de etapa", responsavel: "Trocar o responsável",
};

export const OPERADORES_CONDICAO: { valor: OperadorCondicao; rotulo: string }[] = [
  { valor: "eq", rotulo: "é igual a" }, { valor: "neq", rotulo: "é diferente de" },
  { valor: "contains", rotulo: "contém" }, { valor: "gte", rotulo: "é maior ou igual a" },
  { valor: "lte", rotulo: "é menor ou igual a" },
];

/**
 * Variáveis que o motor resolve em QUALQUER passo de texto (`aplicarVariaveis`
 * em cadence-engine): o snapshot do enrollment já carrega nome, empresa,
 * e-mail, telefone, etapa, status, origem e tags.
 *
 * Sintaxe `{{chave}}` — e só ela. A tela de Atendimento insere `{chave}` e o
 * servidor substitui `{{chave}}`, e é por isso que 6 dos 16 modelos de
 * produção nunca têm variável trocada. Aqui o seletor escreve a chave com as
 * duas chaves, e o aviso na interface diz isso em voz alta.
 */
export const VARIAVEIS_CADENCIA: { chave: string; rotulo: string; exemplo: string }[] = [
  { chave: "nome", rotulo: "Nome do contato", exemplo: "Ana Vitória Souza" },
  { chave: "primeiro_nome", rotulo: "Primeiro nome", exemplo: "Ana" },
  { chave: "empresa", rotulo: "Empresa", exemplo: "Padaria do Bairro" },
  { chave: "email", rotulo: "E-mail", exemplo: "ana@exemplo.com.br" },
  { chave: "telefone", rotulo: "Telefone", exemplo: "11999990000" },
  { chave: "stage", rotulo: "Etapa atual", exemplo: "qualificacao" },
  { chave: "status", rotulo: "Status do lead", exemplo: "aberto" },
  { chave: "origin", rotulo: "Origem", exemplo: "site" },
];

/**
 * Prévia do texto com valores de exemplo — mesma sintaxe e mesma regra de
 * "chave desconhecida fica literal" de `aplicarVariaveis`.
 *
 * A função de verdade mora no motor (cadence-engine), que importa `db`: um
 * Client Component não pode puxá-la. Isto aqui é só o espelho visual dela,
 * sobre valores fictícios — nunca é o que sai na mensagem.
 */
export function previaTexto(texto: string): string {
  const exemplos = new Map(VARIAVEIS_CADENCIA.map((v) => [v.chave, v.exemplo]));
  return texto.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (bruto, chave: string) => exemplos.get(chave) ?? bruto);
}

export function novoId(prefixo: string): string {
  const aleatorio = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefixo}-${aleatorio.slice(0, 8)}`;
}

export function passoNovo(tipo: TipoPasso, esperaMin = 1440): Passo {
  const base = { id: novoId(tipo), esperaMin };
  switch (tipo) {
    case "mensagem": return { ...base, tipo, canal: "whatsapp", mensagem: "Oi {{primeiro_nome}}, " };
    case "tarefa": return { ...base, tipo, titulo: "", prioridade: "media", prazoMin: 1440 };
    case "crm": return { ...base, tipo, acao: "nota", titulo: "" };
    case "condicao": return { ...base, tipo, combinador: "and", regras: [{ campo: "status", op: "eq", valor: "" }] };
    case "classificar": return { ...base, tipo, classes: [{ id: "positivo", rotulo: "Quer conversar" }, { id: "negativo", rotulo: "Não quer" }], segueEm: "positivo", graceMin: 1440 };
  }
}

// ─── Espera: minutos ↔ texto ──────────────────────────────────────────────

export function textoEspera(min: number): string {
  if (min < ESPERA_MINIMA_MIN) return "Na sequência";
  if (min < 1) { const segundos = Math.round(min * 60); return segundos === 1 ? "1 segundo depois" : segundos + " segundos depois"; }
  if (min % 10080 === 0) { const semanas = min / 10080; return semanas + (semanas === 1 ? " semana depois" : " semanas depois"); }
  if (min % 1440 === 0) { const d = min / 1440; return `${d} ${d === 1 ? "dia" : "dias"} depois`; }
  if (min % 60 === 0) { const h = min / 60; return `${h} ${h === 1 ? "hora" : "horas"} depois`; }
  return `${min} min depois`;
}

// ─── Campos de cada passo (renderizados por fluxos/Campos.tsx) ────────────

const CAMPO_SESSAO: CampoConfig = {
  chave: "sessaoId", rotulo: "Enviar por qual número", tipo: "sessao_whatsapp",
  ajuda: "Vazio = o número do responsável do registro; sem ele, o padrão da organização. Número desconectado faz o passo falhar com o motivo, nunca sai por outro.",
};

/** Só os campos visíveis para a escolha atual — sem `mostrarSe`, porque aqui
 *  a escolha de canal/ação já decide a lista. */
export function camposDoPasso(passo: Passo): CampoConfig[] {
  if (passo.tipo === "mensagem") {
    if (passo.canal === "whatsapp") return [
      { chave: "mensagem", rotulo: "Mensagem", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true, placeholder: "Oi {{primeiro_nome}}, tudo bem?" },
      CAMPO_SESSAO,
    ];
    if (passo.canal === "whatsapp_template") return [CAMPO_SESSAO];
    if (passo.canal === "whatsapp_ia") return [
      { chave: "instrucao", rotulo: "O que a IA deve escrever", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true, placeholder: "Retome a proposta enviada e pergunte se ficou alguma dúvida." },
      // Sem agente escolhido quem escreve é o agente de maior prioridade que
      // escuta `cadence.step_due` — em produção o Organizador de Pipeline, não
      // o SDR. Por isso a publicação exige a escolha (`validate.ts`).
      { chave: "agenteId", rotulo: "Agente que escreve", tipo: "agente_ia", obrigatorio: true, ajuda: "Sem escolher, a cadência não publica: o motor não adivinha qual agente fala pela empresa." },
      CAMPO_SESSAO,
    ];
    if (passo.canal === "email") return [
      { chave: "assunto", rotulo: "Assunto", tipo: "texto", obrigatorio: true, aceitaExpressao: true },
      { chave: "mensagem", rotulo: "Mensagem", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true },
    ];
    return [];
  }
  if (passo.tipo === "tarefa") return [
    { chave: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, aceitaExpressao: true },
    { chave: "descricao", rotulo: "Descrição", tipo: "texto_longo", aceitaExpressao: true },
    { chave: "prioridade", rotulo: "Prioridade", tipo: "selecao", opcoes: [{ valor: "baixa", rotulo: "Baixa" }, { valor: "media", rotulo: "Média" }, { valor: "alta", rotulo: "Alta" }, { valor: "urgente", rotulo: "Urgente" }] },
    { chave: "prazoMin", rotulo: "Vence em", tipo: "duracao" },
    { chave: "responsavelId", rotulo: "Responsável", tipo: "usuario", ajuda: "Vazio = responsável do registro." },
  ];
  if (passo.tipo === "crm") {
    if (passo.acao === "nota") return [
      { chave: "titulo", rotulo: "Título da nota", tipo: "texto", obrigatorio: true, aceitaExpressao: true },
      { chave: "descricao", rotulo: "Conteúdo", tipo: "texto_longo", aceitaExpressao: true },
    ];
    if (passo.acao === "etapa") return [{ chave: "etapa", rotulo: "Mover para", tipo: "etapa", obrigatorio: true }];
    if (passo.acao === "responsavel") return [{ chave: "responsavelId", rotulo: "Novo responsável", tipo: "usuario", obrigatorio: true }];
    return [{ chave: "tagId", rotulo: "Tag", tipo: "tag", obrigatorio: true }];
  }
  if (passo.tipo === "classificar") return [
    { chave: "instrucao", rotulo: "Como classificar", tipo: "texto_longo", aceitaExpressao: true, placeholder: "Considere positiva qualquer resposta que aceite conversar." },
    { chave: "agenteId", rotulo: "Agente", tipo: "agente_ia", ajuda: "Vazio = agente padrão da organização." },
    { chave: "graceMin", rotulo: "Esperar a resposta por", tipo: "duracao", ajuda: `No mínimo ${GRACE_MINIMA_MIN} minutos. Sem resposta nesse prazo, a cadência encerra.` },
  ];
  return [];
}

// ─── Pendências (o que falta para publicar) ───────────────────────────────

/** Uma linha por passo incompleto, para a tela dizer o que falta antes de a
 *  rota recusar. Não substitui `validateFollowupForPublish`: é o mesmo tipo de
 *  conferência, só mais perto de quem está escrevendo. */
export function pendenciasDosPassos(passos: Passo[]): { passoId: string; mensagem: string }[] {
  const falhas: { passoId: string; mensagem: string }[] = [];
  const falta = (p: Passo, mensagem: string) => falhas.push({ passoId: p.id, mensagem });
  if (!passos.length) falhas.push({ passoId: "", mensagem: "A cadência não tem nenhum passo." });
  for (const p of passos) {
    if (p.tipo === "mensagem") {
      if (p.canal === "whatsapp" && !p.mensagem?.trim()) falta(p, "Escreva a mensagem.");
      if (p.canal === "whatsapp_template" && !p.templateId) falta(p, "Escolha o modelo aprovado.");
      if (p.canal === "whatsapp_ia" && !p.instrucao?.trim()) falta(p, "Diga à IA o que escrever.");
      if (p.canal === "whatsapp_ia" && !p.agenteId) falta(p, "Escolha o agente que escreve esta mensagem.");
      if (p.canal === "email" && (!p.assunto?.trim() || !p.mensagem?.trim())) falta(p, "O e-mail precisa de assunto e mensagem.");
    }
    if (p.tipo === "tarefa" && !p.titulo?.trim()) falta(p, "A tarefa precisa de um título.");
    if (p.tipo === "crm") {
      if (p.acao === "nota" && !p.titulo?.trim()) falta(p, "A nota precisa de um título.");
      if ((p.acao === "tag_add" || p.acao === "tag_remove") && !p.tagId) falta(p, "Escolha a tag.");
      if (p.acao === "etapa" && !p.etapa) falta(p, "Escolha a etapa.");
      if (p.acao === "responsavel" && !p.responsavelId) falta(p, "Escolha o responsável.");
    }
    if (p.tipo === "condicao" && !p.regras.some((r) => r.campo.trim())) falta(p, "A condição precisa de pelo menos uma regra com campo.");
    if (p.tipo === "classificar") {
      if (!p.classes.length) falta(p, "A classificação precisa de pelo menos uma classe.");
      else if (!p.classes.some((c) => c.id === p.segueEm)) falta(p, "Escolha qual classe segue a cadência.");
      if (p.classes.some((c) => !c.rotulo.trim())) falta(p, "Toda classe precisa de um nome.");
    }
  }
  return falhas;
}

// ─── Lista → grafo ────────────────────────────────────────────────────────

function rotulo(passo: Passo): string {
  const texto = passo.tipo === "mensagem" ? ROTULO_CANAL[passo.canal]
    : passo.tipo === "crm" ? ROTULO_ACAO_CRM[passo.acao]
    : ROTULO_TIPO[passo.tipo];
  return texto.slice(0, 60);
}

const UUID_VAZIO = "00000000-0000-0000-0000-000000000000";
const uuidOuUndefined = (v?: string) => (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : undefined);

function configDoPasso(passo: Passo): FollowupNode["config"] {
  if (passo.tipo === "mensagem") {
    if (passo.canal === "whatsapp") return { mode: "whatsapp", message: passo.mensagem?.trim() || "…", sessao_id: uuidOuUndefined(passo.sessaoId) };
    if (passo.canal === "whatsapp_template") return { mode: "template", template_id: uuidOuUndefined(passo.templateId) ?? UUID_VAZIO, sessao_id: uuidOuUndefined(passo.sessaoId) };
    if (passo.canal === "whatsapp_ia") return { mode: "ai_message", prompt_hint: passo.instrucao?.trim() || "Escreva a próxima mensagem do follow-up.", agent_id: uuidOuUndefined(passo.agenteId), sessao_id: uuidOuUndefined(passo.sessaoId) };
    if (passo.canal === "email") return { mode: "email", subject: passo.assunto?.trim() || "Callface", message: passo.mensagem?.trim() || "…" };
    return { mode: "callface_call" };
  }
  if (passo.tipo === "tarefa") return {
    mode: "create_task", title: passo.titulo?.trim() || "Tarefa da cadência",
    description: passo.descricao?.trim() || undefined, priority: passo.prioridade ?? "media",
    due_minutes: passo.prazoMin ?? 1440, owner_id: uuidOuUndefined(passo.responsavelId),
  };
  if (passo.tipo === "crm") {
    if (passo.acao === "nota") return { mode: "add_note", title: passo.titulo?.trim() || "Nota da cadência", description: passo.descricao?.trim() || undefined };
    if (passo.acao === "tag_add") return { mode: "add_tag", label_id: uuidOuUndefined(passo.tagId) ?? UUID_VAZIO };
    if (passo.acao === "tag_remove") return { mode: "remove_tag", label_id: uuidOuUndefined(passo.tagId) ?? UUID_VAZIO };
    if (passo.acao === "etapa") return { mode: "update_stage", stage: passo.etapa || "novo" };
    return { mode: "assign_owner", owner_id: uuidOuUndefined(passo.responsavelId) ?? UUID_VAZIO };
  }
  if (passo.tipo === "condicao") return {
    combinator: passo.combinador ?? "and", branching: "combined",
    checks: (passo.regras.length ? passo.regras : [{ campo: "status", op: "eq" as OperadorCondicao, valor: "" }])
      .map((r) => ({ field: r.campo.trim() || "status", op: r.op, value: r.valor })),
  };
  return {
    classes: passo.classes.map((c) => ({ id: c.id, label: c.rotulo.trim() || c.id })),
    grace_timeout_ms: Math.max(GRACE_MINIMA_MIN, passo.graceMin ?? 1440) * 60_000,
    target: "last_reply", hint: passo.instrucao?.trim() || undefined, agent_id: uuidOuUndefined(passo.agenteId),
  };
}

function tipoDoNo(passo: Passo): FollowupNode["type"] {
  if (passo.tipo === "condicao") return "condition";
  if (passo.tipo === "classificar") return "ai_classify";
  return "action";
}

const idEspera = (passoId: string) => `${passoId}__espera`;

/**
 * A lista vira a cadeia de nós. Cada passo com espera ganha um nó `wait`
 * antes dele; o último liga no `end`. É este grafo que a rota valida,
 * versiona e compila — a tela não inventa formato nenhum.
 */
export function passosParaGrafo(passos: Passo[], evento = "manual"): FollowupGraph {
  const nodes: FollowupNode[] = [
    { id: "trigger", type: "trigger", label: "Início da cadência", position: { x: 420, y: 40 }, config: { event: evento, filters: {} } },
  ];
  const edges: FollowupEdge[] = [];
  let y = 40;

  const comEspera = passos.map((p) => p.esperaMin >= ESPERA_MINIMA_MIN);
  /** Onde a seta entra: o nó de espera do passo, se houver; senão o próprio. */
  const entrada = (i: number) => (i >= passos.length ? "end" : comEspera[i] ? idEspera(passos[i].id) : passos[i].id);

  passos.forEach((passo, i) => {
    if (comEspera[i]) {
      y += 160;
      nodes.push({ id: idEspera(passo.id), type: "wait", label: textoEspera(passo.esperaMin).slice(0, 60), position: { x: 420, y }, config: { mode: "fixed", duration_ms: Math.round(passo.esperaMin * 60_000) } });
      edges.push({ id: `${passo.id}__e-espera`, source: idEspera(passo.id), target: passo.id, priority: 0, condition: { type: "always" } });
    }
    y += 160;
    nodes.push({ id: passo.id, type: tipoDoNo(passo), label: rotulo(passo), position: { x: 420, y }, config: configDoPasso(passo) } as FollowupNode);

    const proximo = entrada(i + 1);
    if (passo.tipo === "condicao") {
      edges.push({ id: `${passo.id}__sim`, source: passo.id, target: proximo, priority: 10, condition: { type: "cond_result", value: true } });
      edges.push({ id: `${passo.id}__nao`, source: passo.id, target: "end", priority: 0, condition: { type: "cond_result", value: false } });
    } else if (passo.tipo === "classificar") {
      const segue = passo.classes.some((c) => c.id === passo.segueEm) ? passo.segueEm! : passo.classes[0]?.id;
      for (const classe of passo.classes) {
        edges.push({ id: `${passo.id}__c-${classe.id}`, source: passo.id, target: classe.id === segue ? proximo : "end", priority: 10, condition: { type: "class_match", value: classe.id } });
      }
      edges.push({ id: `${passo.id}__sem-resposta`, source: passo.id, target: "end", priority: 10, condition: { type: "branch", branch_id: "no_reply" } });
      edges.push({ id: `${passo.id}__resto`, source: passo.id, target: "end", priority: 0, condition: { type: "always" } });
    } else {
      edges.push({ id: `${passo.id}__segue`, source: passo.id, target: proximo, priority: 0, condition: { type: "always" } });
    }
  });

  nodes.push({ id: "end", type: "end", label: "Fim da cadência", position: { x: 420, y: y + 160 }, config: { outcome: "exhausted" } });
  edges.unshift({ id: "trigger__segue", source: "trigger", target: entrada(0), priority: 0, condition: { type: "always" } });
  return { schema_version: 2, nodes, edges };
}

// ─── Grafo → lista ────────────────────────────────────────────────────────

function passoDoNo(no: FollowupNode, esperaMin: number, segueEm: string | undefined): Passo | null {
  const base = { id: no.id, esperaMin };
  if (no.type === "condition") {
    return {
      ...base, tipo: "condicao", combinador: no.config.combinator,
      regras: no.config.checks.map((c) => ({ campo: c.field, op: c.op, valor: String(c.value ?? "") })),
    };
  }
  if (no.type === "ai_classify") {
    return {
      ...base, tipo: "classificar",
      classes: no.config.classes.map((c) => ({ id: c.id, rotulo: c.label })),
      segueEm: segueEm ?? no.config.classes[0]?.id,
      graceMin: Math.round(no.config.grace_timeout_ms / 60_000),
      instrucao: no.config.hint, agenteId: no.config.agent_id,
    };
  }
  if (no.type !== "action") return null;
  const c = no.config;
  switch (c.mode) {
    case "whatsapp": return { ...base, tipo: "mensagem", canal: "whatsapp", mensagem: c.message, sessaoId: c.sessao_id };
    case "template": return { ...base, tipo: "mensagem", canal: "whatsapp_template", templateId: c.template_id === UUID_VAZIO ? undefined : c.template_id, sessaoId: c.sessao_id };
    case "ai_message": return { ...base, tipo: "mensagem", canal: "whatsapp_ia", instrucao: c.prompt_hint, agenteId: c.agent_id, sessaoId: c.sessao_id };
    case "email": return { ...base, tipo: "mensagem", canal: "email", assunto: c.subject, mensagem: c.message };
    case "callface_call": return { ...base, tipo: "mensagem", canal: "ligacao" };
    case "create_task": return { ...base, tipo: "tarefa", titulo: c.title, descricao: c.description, prioridade: c.priority, prazoMin: c.due_minutes, responsavelId: c.owner_id };
    case "add_note": return { ...base, tipo: "crm", acao: "nota", titulo: c.title, descricao: c.description };
    case "add_tag": return { ...base, tipo: "crm", acao: "tag_add", tagId: c.label_id === UUID_VAZIO ? undefined : c.label_id };
    case "remove_tag": return { ...base, tipo: "crm", acao: "tag_remove", tagId: c.label_id === UUID_VAZIO ? undefined : c.label_id };
    case "update_stage": return { ...base, tipo: "crm", acao: "etapa", etapa: c.stage };
    case "assign_owner": return { ...base, tipo: "crm", acao: "responsavel", responsavelId: c.owner_id };
  }
}

export type LeituraGrafo = { passos: Passo[]; evento: string; naoLinear: boolean };

/**
 * Lê o grafo salvo como lista. Grafo que ramifica para outro lugar além do
 * fim (possível no canvas antigo, inexistente nas cadências de produção) sai
 * com `naoLinear: true`: a tela avisa e não deixa salvar por cima, em vez de
 * achatar o fluxo de alguém sem dizer nada.
 */
export function grafoParaPassos(grafo: FollowupGraph): LeituraGrafo {
  const porId = new Map(grafo.nodes.map((n) => [n.id, n]));
  const saidas = (id: string) => grafo.edges.filter((e) => e.source === id);
  const gatilho = grafo.nodes.find((n) => n.type === "trigger");
  const evento = gatilho?.config.event ?? "manual";
  if (!gatilho) return { passos: [], evento, naoLinear: true };
  // O nó de fim não se chama sempre "end": as cadências de produção usam
  // "fim". Quem encerra é o tipo do nó, nunca o id.
  const fins = new Set(grafo.nodes.filter((n) => n.type === "end").map((n) => n.id));

  const passos: Passo[] = [];
  const vistos = new Set<string>([gatilho.id]);
  let naoLinear = false;
  let espera = 0;
  let atual = saidas(gatilho.id)[0]?.target ?? "";
  if (saidas(gatilho.id).length > 1) naoLinear = true;

  while (atual && !fins.has(atual)) {
    const no = porId.get(atual);
    if (!no || vistos.has(atual)) { naoLinear = true; break; }
    vistos.add(atual);
    const saindo = saidas(atual);

    if (no.type === "wait") {
      if (saindo.length !== 1) { naoLinear = true; break; }
      espera += Math.round((no.config.mode === "fixed" ? no.config.duration_ms : no.config.max_ms) / 1000) / 60;
      atual = saindo[0].target;
      continue;
    }

    // De um nó que ramifica, só uma saída pode seguir a lista; as outras têm
    // de ir para o fim, senão a sequência não representa o grafo.
    const seguem = saindo.filter((e) => !fins.has(e.target));
    if (seguem.length > 1 || new Set(seguem.map((e) => e.target)).size > 1) naoLinear = true;
    const segueAresta = seguem[0];
    const classeQueSegue = segueAresta?.condition.type === "class_match" ? segueAresta.condition.value : undefined;

    const passo = passoDoNo(no, espera, classeQueSegue);
    if (!passo) { naoLinear = true; break; }
    passos.push(passo);
    espera = 0;

    // Ramos declarados sem aresta (grafo inválido) param a leitura em vez de
    // virar passo mudo.
    if (branchesForNode(no).length && !saindo.length) { naoLinear = true; break; }
    atual = segueAresta?.target ?? "";
  }

  if (grafo.nodes.some((n) => !vistos.has(n.id) && n.type !== "end")) naoLinear = true;
  return { passos, evento, naoLinear };
}

/** O tipo do nó do grafo dito em português. O inspetor mostrava o nome
 *  interno ("ai_classify") no cabeçalho, que é vocabulário de banco. */
export const ROTULO_TIPO_NO: Record<FollowupNode["type"], string> = {
  trigger: "Gatilho",
  wait: "Espera",
  condition: "Condição",
  ai_classify: "Classificar resposta",
  action: "Ação",
  end: "Fim",
};

// ─── Posições do fluxo visual ─────────────────────────────────────────────

/** Largura de uma coluna do desenho e altura de uma linha, em unidades do
 *  canvas. O cartão tem 268px; a folga é o que deixa a seta respirar. */
export const LARGURA_COLUNA = 340;
export const ALTURA_LINHA = 210;

/** Redistribui os nós em camadas: profundidade no eixo X, ramos no eixo Y.
 *
 *  Por que existe: a cadência nasce e cresce numa coluna só — todo passo
 *  novo entrava embaixo do anterior, no mesmo X. Uma coluna alta e estreita
 *  faz o enquadramento automático afastar a câmera até o texto do cartão
 *  ficar ilegível no meio de uma área vazia. Com as camadas, o desenho ocupa
 *  a largura que tem e o zoom fica perto de 1.
 *
 *  Percurso em largura a partir do gatilho, visitando cada nó uma vez: grafo
 *  com volta não entra em laço. Nó que ninguém alcança vai para a coluna
 *  seguinte à mais profunda, em vez de ficar escondido sob outro. */
export function organizarGrafo(grafo: FollowupGraph): FollowupGraph {
  const saidas = new Map<string, string[]>();
  for (const no of grafo.nodes) saidas.set(no.id, []);
  for (const aresta of grafo.edges) saidas.get(aresta.source)?.push(aresta.target);

  const profundidade = new Map<string, number>();
  const inicio = grafo.nodes.find((n) => n.type === "trigger") ?? grafo.nodes[0];
  if (inicio) {
    profundidade.set(inicio.id, 0);
    const fila: string[] = [inicio.id];
    while (fila.length) {
      const id = fila.shift()!;
      const d = profundidade.get(id)!;
      for (const destino of saidas.get(id) ?? []) {
        if (profundidade.has(destino)) continue;
        profundidade.set(destino, d + 1);
        fila.push(destino);
      }
    }
  }
  const maior = profundidade.size ? Math.max(...profundidade.values()) : -1;
  for (const no of grafo.nodes) if (!profundidade.has(no.id)) profundidade.set(no.id, maior + 1);

  const colunas = new Map<number, FollowupNode[]>();
  for (const no of grafo.nodes) {
    const d = profundidade.get(no.id)!;
    colunas.set(d, [...(colunas.get(d) ?? []), no]);
  }
  const posicoes = new Map<string, { x: number; y: number }>();
  for (const [d, nos] of colunas) {
    // Mantém a ordem vertical que a pessoa já via, para o desenho não
    // embaralhar os ramos a cada clique em Organizar.
    const ordenados = [...nos].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    ordenados.forEach((no, i) => posicoes.set(no.id, {
      x: d * LARGURA_COLUNA,
      y: Math.round((i - (ordenados.length - 1) / 2) * ALTURA_LINHA),
    }));
  }
  return { ...grafo, nodes: grafo.nodes.map((no) => ({ ...no, position: posicoes.get(no.id) ?? no.position })) };
}
