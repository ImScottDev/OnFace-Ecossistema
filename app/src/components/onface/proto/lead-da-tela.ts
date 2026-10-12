/* ─────────────────────────────────────────────────────────────────────────
 * O lead de Pré-vendas na forma que a tela /pre-vendas/[id] consome.
 *
 * Puro: sem React, sem banco, sem relógio escondido (`agora` entra por
 * parâmetro). É onde moram as regras que a tela decide, para ficarem
 * testáveis: o que a faixa de SLA diz, qual banner o estado pede, como a
 * qualificação de tela vira `Qualificacao` do domínio e qual é a próxima ação.
 *
 * Nada aqui grava. Quem grava são os commands de `pre-vendas/actions.ts`.
 * ───────────────────────────────────────────────────────────────────────── */

import type { DetalheLead } from "@/lib/vendas/consultas";
import type { TarefaDoLead } from "@/lib/vendas/ficha-extras";
import { MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, ROTULO_ETAPA_PRE_VENDAS, type Qualificacao } from "@/lib/vendas/dominio";
import { acaoVencida, estadoSla, SLA_PRE_VENDAS } from "@/lib/vendas/sla";
import { qualDoDesenho } from "./qual-do-desenho";

const DIA = 86_400_000;

/**
 * Instante a partir do texto do Postgres ("2026-10-12 15:00:00.1+00", "… 00:00:00-03").
 * O espaço no lugar do "T" e o fuso sem minutos não são ISO: o Chrome aceita, o Safari não.
 */
const instante = (s: string) => new Date(s.includes(":") ? s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00") : s);

/* ── Datas ─────────────────────────────────────────────────────────────── */

/* Fuso fixo: o servidor e o navegador renderizam a MESMA string (sem aviso de
   hidratação) e o dia não muda conforme o fuso de quem abre. */
const FUSO = "America/Sao_Paulo";

/** Coluna `date` (retomar_em, data_vencimento): já é o dia, sem hora nem fuso. Converter como instante recuaria um dia. */
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dia = SO_DATA.exec(iso);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  const d = instante(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: FUSO });
}

/** "Hoje, 14:30", "Ontem, 09:00", "23/09, 11:41": o vocabulário curto das listas. */
export function quandoBR(iso: string | null | undefined, agora = new Date()): string {
  if (!iso) return "—";
  /* Só o dia (sem hora): "Hoje", "Amanhã" ou a data, sem inventar um horário. */
  if (SO_DATA.test(iso)) {
    const hoje = agora.toLocaleDateString("en-CA", { timeZone: FUSO });
    const dias = Math.round((new Date(iso).getTime() - new Date(hoje).getTime()) / DIA);
    return dias === 0 ? "Hoje" : dias === -1 ? "Ontem" : dias === 1 ? "Amanhã" : dataBR(iso).slice(0, 5);
  }
  const d = instante(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: FUSO });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
  const dias = Math.round((new Date(dia(d)).getTime() - new Date(dia(agora)).getTime()) / DIA);
  if (dias === 0) return `Hoje, ${hora}`;
  if (dias === -1) return `Ontem, ${hora}`;
  if (dias === 1) return `Amanhã, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO })}, ${hora}`;
}

/** "há 3 dias", "há 5 h", "agora há pouco": o tempo corrido, na escala que importa. */
export function haQuanto(iso: string | null | undefined, agora = new Date()): string | null {
  if (!iso) return null;
  const t = instante(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Math.max(0, agora.getTime() - t);
  const dias = Math.floor(ms / DIA);
  if (dias >= 1) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const horas = Math.floor(ms / 3_600_000);
  return horas >= 1 ? `há ${horas} h` : "há poucos minutos";
}

function horasDesde(iso: string | null | undefined, agora: Date): number | null {
  if (!iso) return null;
  const t = instante(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((agora.getTime() - t) / 3_600_000));
}

/* ── Faixa de etapa / SLA ──────────────────────────────────────────────── */

export type TomDoTile = "ok" | "aviso" | "erro" | "neutro";
export interface TileDeSla { label: string; valor: string; sub: string; tom: TomDoTile }

/**
 * Quatro fatos do lead, medidos pela MESMA política do cartão do board
 * (`lib/vendas/sla`): o tile "Sem interação" fica vermelho quando o cartão fica.
 * Nutrição, desqualificado e oportunidade não têm SLA (a regra é de lá).
 */
export function tilesDeSla(l: DetalheLead, cadencia: { nome: string; pausada: boolean } | null, agora = new Date()): TileDeSla[] {
  const horasNaEtapa = horasDesde(l.etapaDesde, agora);
  const horasSemToque = horasDesde(l.ultimoToqueEm, agora);
  const estado = estadoSla(l.etapa, horasSemToque);
  const politica = SLA_PRE_VENDAS[l.etapa];

  const naEtapa: TileDeSla = {
    label: "Na etapa",
    valor: horasNaEtapa === null ? "—" : horasNaEtapa < 24 ? "Hoje" : `${Math.floor(horasNaEtapa / 24)} ${Math.floor(horasNaEtapa / 24) === 1 ? "dia" : "dias"}`,
    sub: l.etapaDesde ? `${l.etapaRotulo} desde ${dataBR(l.etapaDesde)}` : l.etapaRotulo,
    tom: "neutro",
  };
  const semInteracao: TileDeSla = {
    label: "Sem interação",
    valor: horasSemToque === null ? "Sem registro" : (haQuanto(l.ultimoToqueEm, agora) ?? "—").replace(/^há /, ""),
    sub: politica ? `Alerta com ${politica.vencendo} h, vence com ${politica.vencido} h` : "Sem SLA nesta etapa",
    tom: estado === "vencido" ? "erro" : estado === "vencendo" ? "aviso" : estado === "ok" ? "ok" : "neutro",
  };
  const primeiro: TileDeSla = {
    label: "1º contato",
    valor: l.primeiroContatoEm ? dataBR(l.primeiroContatoEm) : "Ainda não",
    sub: l.primeiroContatoEm ? `${haQuanto(l.primeiroContatoEm, agora)}` : "Ninguém falou com este lead",
    tom: l.primeiroContatoEm ? "neutro" : (l.etapa === "novo" && estado === "vencido" ? "erro" : "neutro"),
  };
  const cad: TileDeSla = {
    label: "Cadência",
    valor: cadencia ? cadencia.nome : "Fora de cadência",
    sub: cadencia ? (cadencia.pausada ? "Pausada" : "Ativa") : "Nenhuma inscrição viva",
    tom: "neutro",
  };
  return [naEtapa, semInteracao, primeiro, cad];
}

/* ── Banner de estado ──────────────────────────────────────────────────── */

export interface BannerDoLead {
  tom: "azul" | "cinza" | "verde";
  titulo: string;
  sub: string;
  /** O que o botão do banner faz; a tela decide o command. */
  acao: "reativar" | "abrir-oportunidade" | null;
  acaoLabel: string | null;
  /** Para "abrir-oportunidade". */
  oportunidadeId?: string;
}

const MOTIVO_NUTRICAO = new Map<string, string>(MOTIVOS_NUTRICAO.map((m) => [m.chave, m.rotulo]));
const MOTIVO_DESQ = new Map<string, string>(MOTIVOS_DESQUALIFICACAO.map((m) => [m.chave, m.rotulo]));

/** Motivo legível. `em_nutricao` é o marcador de estado das cargas antigas, não um motivo. */
export function rotuloDoMotivo(chave: string | null | undefined, mapa: Map<string, string>): string {
  if (!chave || chave === "em_nutricao") return "Motivo não registrado";
  return mapa.get(chave) ?? chave;
}

export function bannerDoLead(l: DetalheLead, agora = new Date()): BannerDoLead | null {
  if (l.etapa === "nutricao") {
    /* "Quando entrou": a coluna própria; as cargas antigas não a têm, então vale a
       última mudança de etapa para nutrição (a mesma que o cartão usa). */
    const desde = l.nutricao.desde ?? l.etapaDesde;
    const partes = [
      desde ? `Desde ${dataBR(desde)} (${haQuanto(desde, agora)})` : null,
      l.nutricao.retomarEm ? `retomar em ${dataBR(l.nutricao.retomarEm)}` : "sem data de retomada",
      l.nutricao.observacao?.trim() || null,
    ].filter(Boolean);
    return {
      tom: "azul", titulo: `Em nutrição · ${rotuloDoMotivo(l.nutricao.motivo, MOTIVO_NUTRICAO)}`,
      sub: partes.join(" · "), acao: "reativar", acaoLabel: "Reativar",
    };
  }
  if (l.etapa === "desqualificado") {
    const de = l.desqualificacao.deEtapa ? ROTULO_ETAPA_PRE_VENDAS[l.desqualificacao.deEtapa as keyof typeof ROTULO_ETAPA_PRE_VENDAS] : null;
    const partes = [
      l.desqualificacao.em ? `Em ${dataBR(l.desqualificacao.em)}` : null,
      de ? `estava em ${de}` : null,
      l.desqualificacao.detalhe?.trim() || null,
    ].filter(Boolean);
    return {
      tom: "cinza", titulo: `Desqualificado · ${rotuloDoMotivo(l.desqualificacao.motivo, MOTIVO_DESQ)}`,
      sub: partes.join(" · ") || "Saiu do funil de Pré-vendas", acao: "reativar", acaoLabel: "Reativar",
    };
  }
  if (l.etapa === "oportunidade") {
    const opp = l.oportunidades[0];
    return {
      tom: "verde", titulo: "Convertido em oportunidade",
      sub: opp ? `${opp.titulo} · ${opp.etapaRotulo}` : "Esta pessoa passou para o Pipeline",
      acao: opp ? "abrir-oportunidade" : null, acaoLabel: opp ? "Abrir oportunidade" : null, oportunidadeId: opp?.id,
    };
  }
  return null;
}

/* ── Qualificação ──────────────────────────────────────────────────────── */

export interface QualDaTela { interesse: string[]; tamanho: string; dor: string; fit: string; observacao: string }

export const OPCOES_INTERESSE = ["White Label", "Callface AI", "PABX", "Não identificado"] as const;
export const OPCOES_FIT = ["Alto", "Médio", "Baixo"] as const;

/** A qualificação gravada, na forma dos campos da tela. Mesma fonte do drawer (`qualDoDesenho`). */
export function qualDaTela(l: Pick<DetalheLead, "qualificacao" | "pessoa">): QualDaTela {
  const q = (qualDoDesenho(l.qualificacao) ?? {}) as Record<string, string | undefined>;
  return {
    interesse: q.interesse ? q.interesse.split("|").filter(Boolean) : [],
    tamanho: q.tamanho ?? "",
    dor: q.dor ?? "",
    fit: q.fit ?? "",
    observacao: l.pessoa.observacao ?? "",
  };
}

const TOKEN_FIT = /Fit\s+(?:Alto|M[ée]dio|Baixo)/i;

/**
 * Troca só o "Fit X" dentro de `observacoes` e preserva o resto do texto.
 * (O Fit vive ali desde sempre; o drawer sobrescreve a coluna inteira com
 * "Fit X", o que apagava qualquer outra observação ao mudar o Fit.)
 */
export function observacoesComFit(atual: unknown, fit: string): string {
  const texto = typeof atual === "string" ? atual : "";
  const novo = fit ? `Fit ${fit}` : "";
  if (TOKEN_FIT.test(texto)) return texto.replace(TOKEN_FIT, novo).replace(/\s*·\s*·\s*/g, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "").trim();
  return [texto.trim(), novo].filter(Boolean).join(" · ");
}

/** Só os campos que a tela edita; o resto de `leads.qualificacao` (ICP, orçamento, decisor…) não é tocado. */
export function qualParaDominio(d: QualDaTela, observacoesAtuais: unknown): Qualificacao {
  const n = parseInt(d.tamanho.replace(/[^0-9]/g, ""), 10);
  return {
    servicosInteresse: d.interesse,
    quantidade: Number.isNaN(n) || n <= 0 ? null : n,
    dor: d.dor.trim(),
    observacoes: observacoesComFit(observacoesAtuais, d.fit),
  };
}

export function qualMudou(a: QualDaTela, b: QualDaTela): { qualificacao: boolean; observacao: boolean } {
  const igualLista = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  return {
    qualificacao: !igualLista(a.interesse, b.interesse) || a.tamanho.trim() !== b.tamanho.trim() || a.dor.trim() !== b.dor.trim() || a.fit !== b.fit,
    observacao: a.observacao.trim() !== b.observacao.trim(),
  };
}

/** Faixa de porte do "tamanho da operação": a mesma escala do drawer. */
export function faixaDeTamanho(tamanho: string): { rotulo: string; tom: "neutro" | "azul" | "verde" | "coral" } | null {
  const n = parseInt(tamanho.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n) || n <= 0) return null;
  if (n <= 10) return { rotulo: "Micro", tom: "neutro" };
  if (n <= 50) return { rotulo: "Pequena", tom: "azul" };
  if (n <= 200) return { rotulo: "Média", tom: "verde" };
  return { rotulo: "Enterprise", tom: "coral" };
}

/** Quantos dos 4 campos de qualificação estão preenchidos. */
export function qualPreenchidos(q: QualDaTela): number {
  return [q.interesse.length > 0, q.tamanho.trim() !== "", q.dor.trim() !== "", q.fit !== ""].filter(Boolean).length;
}

/* ── Próxima ação ──────────────────────────────────────────────────────── */

export const TAREFA_FECHADA = new Set(["concluida", "declinada"]);

/**
 * A tarefa que abre quando se clica na próxima ação: a aberta de prazo mais
 * próximo (as tarefas já chegam nessa ordem; sem prazo vai para o fim).
 */
export function tarefaDaProximaAcao(tarefas: TarefaDoLead[]): TarefaDoLead | null {
  return tarefas.find((t) => !TAREFA_FECHADA.has(t.status)) ?? null;
}

export function proximaDaTela(l: Pick<DetalheLead, "proximaAcao">, tarefas: TarefaDoLead[], agora = new Date()) {
  if (!l.proximaAcao) return null;
  const venceEm = l.proximaAcao.venceEm;
  const atrasada = acaoVencida(venceEm, agora);
  return {
    titulo: l.proximaAcao.titulo,
    sub: venceEm ? `${atrasada ? "Atrasada: venceu" : "Vence"} em ${dataBR(venceEm)}` : "Sem prazo definido",
    atrasada,
    tarefaId: tarefaDaProximaAcao(tarefas)?.id ?? null,
  };
}

/* ── Módulo (Pré-vendas hoje; Prospecção depois) ───────────────────────── */

/**
 * A tela do lead não sabe de que módulo é: recebe isto. O equivalente em
 * Prospecção entra com um valor novo aqui e uma rota própria, sem mexer na tela.
 */
export interface ModuloDoLead { chave: "pre-vendas" | "prospeccao"; rotulo: string; lista: string }
export const MODULO_PRE_VENDAS: ModuloDoLead = { chave: "pre-vendas", rotulo: "Pré-vendas", lista: "/pre-vendas" };
