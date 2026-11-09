/**
 * Quem está com a bola.
 *
 * O agrupamento anterior era por urgência, em seis grupos, e todos os seis
 * pesavam igual na tela. O problema não era a ordem: era não distinguir o que
 * a pessoa PODE FAZER do que ela só precisa SABER.
 *
 * Aqui existem três situações, e elas não são equivalentes:
 *
 *   COM VOCÊ      nada acontece se você não fizer. Merece a linha inteira.
 *   ANDANDO       está em curso e no prazo. Merece uma linha discreta.
 *   ESPERANDO     a bola é de outro. Merece uma ficha e um relógio, nada mais.
 *
 * É isso que encolhe a tela de quatorze linhas iguais para cinco linhas que
 * pedem ação e nove fichas que só informam — e é o que resolve o "ficou
 * grande", que não era densidade, era indiferenciação.
 *
 * Funções puras sobre `CartaoDoProjeto`. Nenhuma inventa dado nem redefine
 * métrica: "atrasado" continua sendo prazo estourado, como no indicador.
 */
import type { CartaoDoProjeto, MotivoDaEspera } from "@/lib/pos-venda/contrato";
import { diasDeCalendario } from "../formatos";
import { estaAberto, projetoAtrasado } from "../board/analise";

export type Posse = "voce" | "andando" | "cliente" | "operadora" | "interno" | "encerrado";

export const QUEM: Record<Exclude<Posse, "encerrado">, { titulo: string; criterio: string }> = {
  voce: {
    titulo: "Precisa de você",
    criterio: "Nada avança aqui sem alguém da casa",
  },
  andando: {
    titulo: "Andando",
    criterio: "Em curso, dentro do prazo",
  },
  cliente: {
    titulo: "Com o cliente",
    criterio: "Esperando material, resposta ou aceite",
  },
  operadora: {
    titulo: "Com a operadora",
    criterio: "Portabilidade, tronco ou prazo externo",
  },
  interno: {
    titulo: "Com outra área da casa",
    criterio: "Dependência de outro time nosso",
  },
};

/**
 * De quem é a bola.
 *
 * A ordem das perguntas importa. Espera registrada vence tudo: se alguém disse
 * "a bola está com a operadora", a tela não contradiz. Depois vem o aceite,
 * que é espera do cliente mesmo sem ninguém ter marcado — é o estado
 * `EM_VALIDACAO`, e tratá-lo como trabalho seu faria a pessoa cobrar a si
 * mesma por algo que depende do cliente.
 */
export function posseDe(c: CartaoDoProjeto): Posse {
  if (!estaAberto(c)) return "encerrado";

  const espera = c.relogios.esperando;
  if (espera) return espera.motivo;

  // Feito, falta o cliente validar: a bola é dele, ainda que ninguém tenha marcado espera.
  if (c.estado === "EM_VALIDACAO") return "cliente";

  // Prazo estourado, tarefa vencida, ou ninguém abriu a primeira tarefa.
  if (projetoAtrasado(c) || c.proximaTarefa?.atrasada || c.estado === "NAO_INICIADO") return "voce";

  // Em andamento sem próxima tarefa definida também é seu: ninguém sabe o que vem.
  if (!c.proximaTarefa) return "voce";

  return "andando";
}

/** Quanto tempo a bola está parada com quem está. Null quando não há espera registrada. */
export function esperandoHa(c: CartaoDoProjeto, agora: Date): number | null {
  const e = c.relogios.esperando;
  return e ? Math.max(0, diasDeCalendario(e.desde, agora)) : null;
}

/**
 * O verbo da linha: o que fazer agora, em imperativo.
 *
 * A tela antiga dizia o ESTADO ("Não iniciado", "Em andamento"), que a pessoa
 * já vê na pílula. Estado não é instrução. Aqui a linha diz a AÇÃO, porque é
 * isso que a pessoa veio buscar às nove da manhã.
 */
export function oQueFazer(c: CartaoDoProjeto): string {
  if (projetoAtrasado(c)) return c.proximaTarefa?.titulo ?? "Retomar a entrega";
  if (c.proximaTarefa?.atrasada) return c.proximaTarefa.titulo;
  if (c.estado === "NAO_INICIADO") return "Abrir a primeira tarefa";
  if (!c.proximaTarefa) return "Definir a próxima tarefa";
  return c.proximaTarefa.titulo;
}

/** Por que esta linha está pedindo ação. Uma frase curta, sem repetir o verbo. */
export function porQue(c: CartaoDoProjeto, agora: Date): string | null {
  const atraso = c.relogios.diasDeAtraso;
  if (projetoAtrasado(c) && atraso !== null) {
    return `prazo estourado há ${atraso} ${atraso === 1 ? "dia" : "dias"}`;
  }
  if (c.proximaTarefa?.atrasada && c.proximaTarefa.venceEm) {
    const d = diasDeCalendario(c.proximaTarefa.venceEm, agora);
    return d > 0 ? `venceu há ${d} ${d === 1 ? "dia" : "dias"}` : "venceu hoje";
  }
  if (c.estado === "NAO_INICIADO") {
    const d = diasDeCalendario(c.entrouEm, agora);
    return d > 0 ? `entrou há ${d} ${d === 1 ? "dia" : "dias"}` : "entrou hoje";
  }
  if (!c.proximaTarefa) return "sem próxima tarefa";
  return null;
}

export interface Mesa {
  voce: CartaoDoProjeto[];
  andando: CartaoDoProjeto[];
  esperando: Array<{ motivo: MotivoDaEspera; cartoes: CartaoDoProjeto[] }>;
  encerrados: number;
  abertos: number;
}

const ORDEM_DA_ESPERA: MotivoDaEspera[] = ["cliente", "operadora", "interno"];

/**
 * Monta a mesa.
 *
 * Dentro de "precisa de você", a ordem é por dano: prazo estourado primeiro,
 * depois tarefa vencida, depois quem está parado há mais tempo. Não é
 * alfabética nem por entrada, porque nenhuma das duas responde "por onde eu
 * começo".
 */
export function montarMesa(cartoes: CartaoDoProjeto[], agora: Date): Mesa {
  const voce: CartaoDoProjeto[] = [];
  const andando: CartaoDoProjeto[] = [];
  const porMotivo = new Map<MotivoDaEspera, CartaoDoProjeto[]>();
  let encerrados = 0;

  for (const c of cartoes) {
    const p = posseDe(c);
    if (p === "encerrado") { encerrados++; continue; }
    if (p === "voce") { voce.push(c); continue; }
    if (p === "andando") { andando.push(c); continue; }
    porMotivo.set(p, [...(porMotivo.get(p) ?? []), c]);
  }

  const dano = (c: CartaoDoProjeto): number => {
    if (projetoAtrasado(c)) return 1000 + (c.relogios.diasDeAtraso ?? 0);
    if (c.proximaTarefa?.atrasada) {
      return 500 + (c.proximaTarefa.venceEm ? diasDeCalendario(c.proximaTarefa.venceEm, agora) : 0);
    }
    return diasDeCalendario(c.entrouEm, agora);
  };
  voce.sort((a, b) => dano(b) - dano(a));
  andando.sort((a, b) => diasDeCalendario(b.entrouEm, agora) - diasDeCalendario(a.entrouEm, agora));

  return {
    voce,
    andando,
    esperando: ORDEM_DA_ESPERA.filter((m) => porMotivo.has(m)).map((m) => ({ motivo: m, cartoes: porMotivo.get(m)! })),
    encerrados,
    abertos: voce.length + andando.length + [...porMotivo.values()].reduce((n, l) => n + l.length, 0),
  };
}
