/**
 * Leitura do board: agrupamento por urgência e agregados dos gráficos.
 *
 * Funções puras sobre `CartaoDoProjeto`. Nada aqui cria dado novo nem muda a
 * forma do contrato: só reagrupa o que o servidor já mediu para responder a
 * pergunta de quem abre a tela de manhã, "o que eu faço agora?".
 *
 * Duas regras que seguram a confiança na tela:
 *
 * 1. NÃO REDEFINIR MÉTRICA. "Atrasado" do indicador é prazo estourado
 *    (`diasDeAtraso > 0`). Aqui existe um grupo que mistura isso com tarefa
 *    vencida, e por isso ele se chama "Pedem ação agora", não "Atrasados":
 *    cada linha diz qual dos dois motivos é o dela.
 * 2. AUSÊNCIA É DADO. Projeto sem responsável, sem pessoa e sem prazo é o
 *    caso comum (9 de 56 sem dono em homologação, 425 de 430 em produção).
 *    Vira um sinal explícito, nunca uma linha em branco.
 */
import type { CartaoDoProjeto, EstadoDoProjeto, MotivoDaEspera } from "@/lib/pos-venda/contrato";
import { dia, diasDeCalendario, haQuanto, type Tom } from "../formatos";

export type GrupoId = "acao" | "aceite" | "aguardando" | "andamento" | "parados" | "encerrados";

export interface DefinicaoDeGrupo {
  id: GrupoId;
  titulo: string;
  /** Uma frase que diz o critério, para o grupo não parecer arbitrário. */
  criterio: string;
  tom: Tom;
}

export const GRUPOS: readonly DefinicaoDeGrupo[] = [
  { id: "acao", titulo: "Pedem ação agora", criterio: "Tarefa vencida ou prazo do projeto estourado", tom: "risco" },
  { id: "aceite", titulo: "Falta o aceite", criterio: "O time terminou, o cliente ainda não validou", tom: "validacao" },
  { id: "aguardando", titulo: "Esperando alguém", criterio: "Relógio do time pausado: cliente, operadora ou outra área", tom: "espera" },
  { id: "andamento", titulo: "Em andamento", criterio: "O time está executando", tom: "andamento" },
  { id: "parados", titulo: "Ainda não começaram", criterio: "Entraram e ninguém abriu a primeira tarefa", tom: "neutro" },
  { id: "encerrados", titulo: "Concluídos e cancelados", criterio: "Fora da fila de trabalho", tom: "ok" },
] as const;

export const COM_QUEM: Record<MotivoDaEspera, string> = {
  cliente: "Com o cliente",
  operadora: "Com a operadora",
  interno: "Com outra área da casa",
};

export const estaAberto = (c: Pick<CartaoDoProjeto, "estado">): boolean => c.estado !== "CONCLUIDO" && c.estado !== "CANCELADO";

export function projetoAtrasado(c: CartaoDoProjeto): boolean {
  return estaAberto(c) && (c.relogios.diasDeAtraso ?? -1) > 0;
}

export function grupoDe(c: CartaoDoProjeto): GrupoId {
  if (!estaAberto(c)) return "encerrados";
  if (projetoAtrasado(c) || c.proximaTarefa?.atrasada) return "acao";
  if (c.estado === "EM_VALIDACAO") return "aceite";
  if (c.relogios.esperando || c.estado === "AGUARDANDO") return "aguardando";
  if (c.estado === "EM_ANDAMENTO") return "andamento";
  return "parados";
}

/** O que está acontecendo com o projeto, em uma frase e com o tom que ela merece. */
export interface Sinal {
  tom: Tom;
  /** Frase curta: o que fazer ou o que se espera. */
  texto: string;
  /** Complemento (quando, desde quando). */
  quando: string | null;
}

export function sinalDo(c: CartaoDoProjeto, agora: Date): Sinal {
  const idade = diasDeCalendario(c.entrouEm, agora);
  const g = grupoDe(c);

  if (g === "acao") {
    if (projetoAtrasado(c)) {
      return { tom: "risco", texto: "Prazo do projeto estourado", quando: `há ${c.relogios.diasDeAtraso} ${c.relogios.diasDeAtraso === 1 ? "dia" : "dias"}` };
    }
    const dias = c.proximaTarefa?.venceEm ? diasDeCalendario(c.proximaTarefa.venceEm, agora) : null;
    return {
      tom: "risco",
      texto: c.proximaTarefa?.titulo ?? "Tarefa vencida",
      quando: dias !== null && dias > 0 ? `venceu há ${dias} ${dias === 1 ? "dia" : "dias"}` : "vencida",
    };
  }
  if (g === "aceite") return { tom: "validacao", texto: "Tarefas feitas, falta o aceite do cliente", quando: null };
  if (g === "aguardando") {
    const e = c.relogios.esperando;
    return { tom: "espera", texto: e ? COM_QUEM[e.motivo] : "Aguardando", quando: e ? haQuanto(e.desde, agora) : null };
  }
  if (g === "andamento") {
    if (c.proximaTarefa) {
      return { tom: "andamento", texto: c.proximaTarefa.titulo, quando: c.proximaTarefa.venceEm ? `vence ${dia(c.proximaTarefa.venceEm, agora)}` : null };
    }
    return { tom: "andamento", texto: "Sem próxima tarefa definida", quando: null };
  }
  if (g === "parados") {
    return { tom: "neutro", texto: "Ainda não começou", quando: idade > 0 ? `entrou há ${idade} ${idade === 1 ? "dia" : "dias"}` : "entrou hoje" };
  }
  return { tom: c.estado === "CANCELADO" ? "neutro" : "ok", texto: c.estado === "CANCELADO" ? "Cancelado" : "Concluído", quando: null };
}

/** Idade desde a entrada, em palavras curtas. É o que o "prazo" mostra enquanto o prazo real não existe. */
export function idadeCurta(c: CartaoDoProjeto, agora: Date): string {
  const d = diasDeCalendario(c.entrouEm, agora);
  if (d <= 0) return "hoje";
  return `${d} d`;
}

// ─── Nome da empresa ───────────────────────────────────────────────────────

/**
 * Os nomes reais vêm sujos: "." , "Empresa não identificada", caixa alta de
 * cadastro de teste. Nome suspeito não é escondido (o time precisa achar e
 * corrigir o cadastro), mas é marcado para não parecer uma empresa de verdade.
 */
export function nomeParaExibir(nome: string): { texto: string; suspeito: boolean } {
  const t = nome.trim();
  if (t.length <= 2 || /^[.\-_\s]+$/.test(t)) return { texto: "Empresa sem nome", suspeito: true };
  if (/^empresa n[aã]o identificada$/i.test(t)) return { texto: t, suspeito: true };
  return { texto: t, suspeito: false };
}

// ─── Agregados dos gráficos ────────────────────────────────────────────────

export const ORDEM_DE_ESTADO: readonly EstadoDoProjeto[] = ["EM_ANDAMENTO", "AGUARDANDO", "EM_VALIDACAO", "NAO_INICIADO", "CONCLUIDO", "CANCELADO"];

export function contarPorEstado(cartoes: CartaoDoProjeto[]): Array<{ estado: EstadoDoProjeto; n: number }> {
  const m = new Map<EstadoDoProjeto, number>();
  for (const c of cartoes) m.set(c.estado, (m.get(c.estado) ?? 0) + 1);
  return ORDEM_DE_ESTADO.map((estado) => ({ estado, n: m.get(estado) ?? 0 })).filter((x) => x.n > 0);
}

export interface CargaDeResponsavel {
  /** `null` é a linha "Sem responsável". */
  id: string | null;
  nome: string;
  iniciais: string;
  total: number;
  porEstado: Partial<Record<EstadoDoProjeto, number>>;
}

/** Só projetos abertos: carga é o que a pessoa tem na mão, não o que já entregou. */
export function cargaPorResponsavel(cartoes: CartaoDoProjeto[]): CargaDeResponsavel[] {
  const m = new Map<string, CargaDeResponsavel>();
  for (const c of cartoes) {
    if (!estaAberto(c)) continue;
    const chave = c.responsavel?.id ?? "__sem__";
    let l = m.get(chave);
    if (!l) {
      l = { id: c.responsavel?.id ?? null, nome: c.responsavel?.nome ?? "Sem responsável", iniciais: c.responsavel?.iniciais ?? "", total: 0, porEstado: {} };
      m.set(chave, l);
    }
    l.total += 1;
    l.porEstado[c.estado] = (l.porEstado[c.estado] ?? 0) + 1;
  }
  // "Sem responsável" sempre por último: é o problema, não um colega.
  return [...m.values()].sort((a, b) => Number(a.id === null) - Number(b.id === null) || b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface SemanaDeEntrada {
  /** Início da janela de 7 dias, "20 out". */
  rotulo: string;
  /** Intervalo completo, para o tooltip. */
  intervalo: string;
  entradas: number;
  /** A janela que contém hoje. */
  atual: boolean;
}

/**
 * Entradas em janelas rolantes de 7 dias que terminam hoje. Rolante, e não
 * "semana ISO", porque a pergunta é "quanto entrou nos últimos 70 dias" e o
 * último balde nunca fica pela metade.
 */
export function entradasPorSemana(cartoes: CartaoDoProjeto[], agora: Date, janelas = 10): SemanaDeEntrada[] {
  const base = Array.from({ length: janelas }, () => 0);
  for (const c of cartoes) {
    const atras = diasDeCalendario(c.entrouEm, agora);
    if (atras < 0) continue;
    const k = Math.floor(atras / 7);
    if (k < janelas) base[k] += 1;
  }
  const DIA = 86_400_000;
  return base
    .map((entradas, k) => {
      const fim = new Date(agora.getTime() - k * 7 * DIA);
      const ini = new Date(agora.getTime() - (k * 7 + 6) * DIA);
      return { rotulo: dia(ini, agora), intervalo: `${dia(ini, agora)} a ${dia(fim, agora)}`, entradas, atual: k === 0 };
    })
    .reverse();
}

/** Ordenação dentro de um grupo. A urgência é a ordem que o servidor já entrega. */
export function ordenar(cartoes: CartaoDoProjeto[], ordem: "urgencia" | "antigos" | "nome" | "progresso"): CartaoDoProjeto[] {
  if (ordem === "urgencia") return cartoes;
  const c = [...cartoes];
  if (ordem === "antigos") c.sort((a, b) => a.entrouEm.getTime() - b.entrouEm.getTime());
  if (ordem === "nome") c.sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"));
  if (ordem === "progresso") c.sort((a, b) => b.progresso - a.progresso);
  return c;
}
