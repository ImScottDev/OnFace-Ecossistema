/**
 * Leitura do board do pós-venda. Contrato: `Board` em contrato.ts.
 *
 * Carrega os projetos da organização em UMA passada (linhas-base, esperas, tarefas, pessoas, checklist
 * legado: cinco consultas, nenhuma por projeto) e filtra/agrega em memória, porque estado, atraso e
 * "aguardando cliente" são derivados (relógio + espera) e não existem como coluna.
 * Sem paginação: o contrato não tem cursor (74 projetos em produção hoje).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Board, CartaoDoProjeto, FiltrosDoBoard, Familia, IndicadoresDoBoard } from "./contrato";
import { linhasBase, pessoasDasEmpresas, type LinhaBase } from "./leitura-base";
import { aguardandoCliente, estadoDe, itensDeChecklist, ordenarTarefas, progressoDe, relogiosDe, seAplica } from "./montagem";
import { escopoDoSnapshot } from "./escopo";
import { esperasDosProjetos } from "./espera";
import { playbookAtivo, type PlaybookDoMotor } from "./playbook";
import { dataDe, type PeriodoDeEspera } from "./regras";
import { tarefasDosProjetos } from "./tarefas-do-projeto";

/** Amostra mínima para a mediana de tempo: abaixo disso é null, não um número que parece fato. */
export const AMOSTRA_MINIMA_MEDIANA = 5;
const FUSO = "America/Sao_Paulo";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mesDe = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit" }).format(d);

export function mediana(valores: number[]): number | null {
  if (valores.length < AMOSTRA_MINIMA_MEDIANA) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return Math.round((v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) * 10) / 10;
}

export async function boardDoPosVenda(organizacaoId: string, filtros: FiltrosDoBoard, agora: Date = new Date()): Promise<Board> {
  const linhas = await linhasBase(organizacaoId);
  const ids = linhas.map((l) => l.id);
  const [esperas, tarefas, pessoas, checklist] = await Promise.all([
    esperasDosProjetos(organizacaoId, ids),
    tarefasDosProjetos(organizacaoId, linhas.map((l) => ({ id: l.id, servicoId: l.servicoId }))),
    pessoasDasEmpresas(organizacaoId, linhas.map((l) => l.empresa.id)),
    itensDeChecklist(organizacaoId, ids),
  ]);
  const playbooks = new Map<string, PlaybookDoMotor | null>();
  for (const l of linhas) {
    const k = `${l.familia}|${l.tipo}`;
    if (!playbooks.has(k)) playbooks.set(k, await playbookAtivo(organizacaoId, l.familia, l.tipo));
  }

  const itens = linhas.map((l) => {
    const pb = playbooks.get(`${l.familia}|${l.tipo}`) ?? null;
    const es: PeriodoDeEspera[] = esperas.get(l.id) ?? [];
    const relogios = relogiosDe(l, pb, es, agora);
    const trs = ordenarTarefas(tarefas.get(l.id) ?? [], pb);
    const estado = estadoDe(l, es);
    const aplicam = trs.filter(seAplica);
    const proxima = trs.find((t) => t.estado !== "CONCLUIDA" && t.estado !== "NAO_SE_APLICA") ?? null;
    const escopo = escopoDoSnapshot(l.snapshot);
    const cartao: CartaoDoProjeto = {
      id: l.id, tipo: l.tipo, familia: l.familia, estado,
      empresa: { id: l.empresa.id, nome: l.empresa.nome }, responsavel: l.responsavel,
      pessoas: (pessoas.get(l.empresa.id) ?? []).slice(0, 3),
      escopoResumo: escopo ? [escopo.quantidade != null ? `${escopo.quantidade} ${escopo.unidade ?? ""}`.trim() : null, escopo.produto].filter(Boolean).join(" · ") || null : null,
      entrouEm: dataDe(l.entrouEm) ?? agora,
      relogios: { horasCorridas: relogios.horasCorridas, horasDoTime: relogios.horasDoTime, venceEm: relogios.venceEm, diasDeAtraso: relogios.diasDeAtraso, consumoDoPrazo: relogios.consumoDoPrazo, esperando: relogios.esperando },
      progresso: progressoDe(trs, checklist.get(l.id), estado === "CONCLUIDO"),
      // A contagem tem de descrever a MESMA coisa que a barra mede. Projeto
      // anterior ao motor não tem tarefa, e o progresso cai no checklist de
      // `fulfillment_itens` — contar tarefas ali mostrava "0 de 0" ao lado de
      // uma barra em 100%, que é o tipo de contradição que faz o time parar
      // de confiar na tela.
      ...(aplicam.length > 0
        ? { tarefasConcluidas: aplicam.filter((t) => t.estado === "CONCLUIDA").length, tarefasTotal: aplicam.length }
        : { tarefasConcluidas: checklist.get(l.id)?.feitos ?? 0, tarefasTotal: checklist.get(l.id)?.total ?? 0 }),
      proximaTarefa: proxima ? { titulo: proxima.titulo, venceEm: proxima.venceEm, atrasada: proxima.atrasada } : null,
    };
    const aberto = estado !== "CONCLUIDO" && estado !== "CANCELADO";
    return { l, cartao, aberto, atrasado: aberto && (relogios.diasDeAtraso ?? -1) > 0, aguardaCliente: aberto && aguardandoCliente(l, es) };
  });

  const busca = filtros.busca?.trim() ? semAcento(filtros.busca.trim()) : null;
  // Filtros que valem para TUDO (abas, indicadores e lista).
  const base = itens.filter(({ l, cartao }) =>
    (!filtros.tipo || l.tipo === filtros.tipo) &&
    (!filtros.responsavelId || l.responsavel?.id === filtros.responsavelId) &&
    (!busca || semAcento(cartao.empresa.nome).includes(busca)));

  const porFamilia: Record<Familia, number> = { CALLFACE_AI: 0, PABX: 0, WHITE_LABEL: 0 };
  for (const i of base) porFamilia[i.l.familia] += 1;

  const daFamilia = base.filter((i) => !filtros.familia || i.l.familia === filtros.familia);

  const emMes = mesDe(agora);
  const concluidos90 = daFamilia.filter((i) => {
    const c = dataDe(i.l.concluidoEm);
    return c && i.cartao.estado === "CONCLUIDO" && agora.getTime() - c.getTime() <= 90 * 86_400_000;
  });
  const indicadores: IndicadoresDoBoard = {
    emAndamento: daFamilia.filter((i) => i.cartao.estado === "EM_ANDAMENTO").length,
    aguardandoCliente: daFamilia.filter((i) => i.aguardaCliente).length,
    atrasados: daFamilia.filter((i) => i.atrasado).length,
    concluidosNoMes: daFamilia.filter((i) => { const c = dataDe(i.l.concluidoEm); return i.cartao.estado === "CONCLUIDO" && c != null && mesDe(c) === emMes; }).length,
    tempoMedianoDias: mediana(concluidos90.map((i) => (dataDe(i.l.concluidoEm)!.getTime() - i.cartao.entrouEm.getTime()) / 86_400_000)),
    npsMedio: await npsMedioDaJanela(organizacaoId, agora),
  };

  const lista = daFamilia.filter((i) =>
    (!filtros.estado || i.cartao.estado === filtros.estado) &&
    (!filtros.recorte ||
      (filtros.recorte === "atrasados" && i.atrasado) ||
      (filtros.recorte === "aguardando_cliente" && i.aguardaCliente) ||
      (filtros.recorte === "sem_responsavel" && i.aberto && !i.l.responsavel)));

  // Mais urgente primeiro: atrasados, depois abertos por vencimento, concluídos por último.
  lista.sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || Number(b.aberto) - Number(a.aberto)
    || (a.cartao.relogios.venceEm?.getTime() ?? Infinity) - (b.cartao.relogios.venceEm?.getTime() ?? Infinity));

  return { indicadores, cartoes: lista.map((i) => i.cartao), porFamilia, filtros, total: lista.length };
}

/** Média das notas de NPS de onboarding respondidas nos últimos 90 dias. Sem resposta = null (nunca 0). */
export async function npsMedioDaJanela(organizacaoId: string, agora: Date): Promise<number | null> {
  const [r] = await db.execute<{ media: string | null; n: number }>(sql`
    SELECT avg(score)::numeric(4,1)::text AS media, count(*)::int AS n FROM nps_respostas
     WHERE organizacao_id = ${organizacaoId}::uuid AND tipo = 'onboarding' AND score IS NOT NULL
       AND respondido_em IS NOT NULL AND respondido_em >= ${new Date(agora.getTime() - 90 * 86_400_000).toISOString()}::timestamptz`);
  return r && r.n > 0 && r.media != null ? Number(r.media) : null;
}
