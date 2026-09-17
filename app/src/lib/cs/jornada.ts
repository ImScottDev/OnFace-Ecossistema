/**
 * Jornada de CS — régua de relacionamento permanente.
 *
 * Três operações separadas de propósito:
 *   `iniciarJornadaCs`        — semeia os marcos de um ciclo.
 *   `processarMarcosVencidos` — sweep: marco vencido vira tarefa.
 *   `abrirProximoCiclo`       — ao concluir o M12, começa o ciclo seguinte.
 *
 * A régua 3/6/9/12 NÃO é do primeiro ano: é permanente. O 15º mês do cliente
 * é o "3M do ciclo 2" — mesmo marco, mesmo playbook, contexto novo. Só
 * D0/D7/D30 ficam no ciclo 1, porque a chegada do cliente não se repete.
 *
 * Checkpoint anual != renovação contratual. Este arquivo não sabe nada de
 * vigência; isso é `lib/cs/renovacao.ts`.
 */
import { db } from "@/lib/db";
import { csMarcos, clientes, empresas } from "@/lib/db/schema";
import { and, eq, lte, sql, isNull, inArray, desc } from "drizzle-orm";
import { marcosDoCiclo, definicaoMarco, CODIGO_FECHA_CICLO } from "./playbooks";
import { criarTarefaCs } from "./tarefas";

/**
 * Marco vencido há mais que isto nasce PULADO em vez de PENDENTE.
 * 7 dias: o suficiente pra não perder o marco que venceu nesta semana, sem
 * despejar na fila o passado inteiro de uma base que começa em 2020.
 * Medido: a 30 dias, a primeira passada gerava 288 tarefas de uma vez.
 */
const JANELA_RETROATIVA_DIAS = 7;

/** Marco vencido dá 3 dias de folga; marco futuro vence no próprio dia. */
function prazoDeAcao(dueDate: string): Date {
  const doMarco = new Date(`${dueDate}T12:00:00`);
  const minimo = new Date(Date.now() + 3 * 86_400_000);
  return doMarco > minimo ? doMarco : minimo;
}

function somarDias(base: Date, dias: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export interface ResultadoJornada {
  ciclo: number;
  criados: number;
  jaExistiam: number;
  motivo?: string;
}

/**
 * Semeia os marcos de um ciclo. Idempotente pela chave
 * `CS:<empresaId>:<codigo>:<ciclo>` — o ciclo faz parte da chave, que é o que
 * permite o M3 do ciclo 2 existir sem colidir com o M3 do ciclo 1.
 *
 * A âncora do ciclo 1 é `clientes.entrouCarteiraEm` (data real de entrada, não
 * a data de execução: reprocessar um cliente de março não joga o marco de 3
 * meses pra daqui a 90 dias). A dos ciclos seguintes é o fim do anterior.
 */
export async function iniciarJornadaCs(
  empresaId: string,
  ciclo = 1,
  ancoraExplicita?: Date,
): Promise<ResultadoJornada> {
  const [conta] = await db.select({
    id: clientes.id,
    organizacaoId: clientes.organizacaoId,
    entrouCarteiraEm: clientes.entrouCarteiraEm,
    clienteDesde: clientes.clienteDesde,
    createdAt: clientes.createdAt,
  }).from(clientes).where(eq(clientes.empresaId, empresaId)).limit(1);

  if (!conta) return { ciclo, criados: 0, jaExistiam: 0, motivo: "empresa não está na carteira de CS" };

  const ancora = ancoraExplicita ?? conta.entrouCarteiraEm ?? conta.clienteDesde ?? conta.createdAt;

  const corteRetroativo = somarDias(new Date(), -JANELA_RETROATIVA_DIAS);

  let criados = 0;
  let jaExistiam = 0;

  for (const def of marcosDoCiclo(ciclo)) {
    const chave = `CS:${empresaId}:${def.codigo}:${ciclo}`;
    const dueDate = somarDias(ancora, def.offsetDias);
    const retroativo = dueDate < corteRetroativo;

    const inserido = await db.insert(csMarcos).values({
      organizacaoId: conta.organizacaoId,
      empresaId,
      codigo: def.codigo,
      ciclo,
      titulo: def.titulo,
      objetivo: def.objetivo,
      dueDate,
      status: retroativo ? "PULADO" : "PENDENTE",
      resultado: retroativo
        ? { pulado: "Marco anterior à entrada do cliente no módulo de CS — não houve acompanhamento a registrar" }
        : null,
      chaveIdempotencia: chave,
    }).onConflictDoNothing({ target: [csMarcos.organizacaoId, csMarcos.chaveIdempotencia] })
      .returning({ id: csMarcos.id });

    if (inserido.length > 0) criados++; else jaExistiam++;
  }

  await db.update(clientes)
    .set({ jornadaIniciadaEm: conta.entrouCarteiraEm ?? new Date(), updatedAt: new Date() })
    .where(eq(clientes.id, conta.id));

  return { ciclo, criados, jaExistiam };
}

/**
 * Abre o ciclo seguinte. Chamado ao concluir o M12 — nunca por tempo, porque
 * ciclo que vira sozinho no calendário produz checkpoint de "ano 2" para um
 * cliente cujo ano 1 nunca foi acompanhado.
 *
 * A âncora do novo ciclo é a data do M12 que fechou, não a de hoje: se o CS
 * atrasou o checkpoint em 40 dias, a régua do ciclo seguinte não herda o
 * atraso.
 */
export async function abrirProximoCiclo(marcoM12Id: string): Promise<ResultadoJornada | null> {
  const [marco] = await db.select().from(csMarcos).where(eq(csMarcos.id, marcoM12Id)).limit(1);
  if (!marco || marco.codigo !== CODIGO_FECHA_CICLO) return null;

  const ancora = new Date(`${marco.dueDate}T12:00:00`);
  return iniciarJornadaCs(marco.empresaId, marco.ciclo + 1, ancora);
}

/** Ciclo mais avançado que a conta já tem. 0 = jornada não iniciada. */
export async function cicloAtual(empresaId: string): Promise<number> {
  const [row] = await db.select({ ciclo: csMarcos.ciclo })
    .from(csMarcos).where(eq(csMarcos.empresaId, empresaId))
    .orderBy(desc(csMarcos.ciclo)).limit(1);
  return row?.ciclo ?? 0;
}

/**
 * Sweep: todo marco PENDENTE com due_date <= hoje e sem tarefa gerada vira
 * uma tarefa pro CS owner. Dupla trava: `tarefa_gerada_em` no marco e a
 * chave de idempotência na tarefa.
 */
export async function processarMarcosVencidos(organizacaoId?: string): Promise<{ tarefasCriadas: number; marcos: number }> {
  const hoje = new Date().toISOString().slice(0, 10);
  const vencidos = await db.select({
    id: csMarcos.id,
    organizacaoId: csMarcos.organizacaoId,
    empresaId: csMarcos.empresaId,
    codigo: csMarcos.codigo,
    ciclo: csMarcos.ciclo,
    titulo: csMarcos.titulo,
    objetivo: csMarcos.objetivo,
    dueDate: csMarcos.dueDate,
    empresaNome: empresas.nome,
  })
    .from(csMarcos)
    .innerJoin(empresas, eq(empresas.id, csMarcos.empresaId))
    .where(and(
      eq(csMarcos.status, "PENDENTE"),
      isNull(csMarcos.tarefaGeradaEm),
      lte(csMarcos.dueDate, hoje),
      organizacaoId ? eq(csMarcos.organizacaoId, organizacaoId) : undefined,
    ))
    .limit(500);

  let tarefasCriadas = 0;

  for (const marco of vencidos) {
    const def = definicaoMarco(marco.codigo);
    const sufixoCiclo = marco.ciclo > 1 ? ` (ciclo ${marco.ciclo})` : "";
    const { id: tarefaId, criada } = await criarTarefaCs({
      organizacaoId: marco.organizacaoId,
      empresaId: marco.empresaId,
      titulo: `${marco.titulo}${sufixoCiclo} — ${marco.empresaNome}`,
      descricao: marco.objetivo,
      motivo: `Checkpoint ${marco.codigo} do ciclo ${marco.ciclo}`,
      tipo: "cs_marco",
      origem: "PLAYBOOK",
      prioridade: def?.prioridade ?? "media",
      // Prazo = quando o CS precisa agir, não a data em que o marco venceu.
      // Usar a data do marco fazia a tarefa nascer JÁ vencida, e o sweep
      // seguinte a interpretava como sinal de risco — laço que gerou 130
      // riscos fantasma na validação.
      venceEm: prazoDeAcao(marco.dueDate),
      chaveIdempotencia: `CS_MARCO:${marco.id}`,
    });
    if (criada) tarefasCriadas++;

    await db.update(csMarcos)
      .set({ tarefaId, tarefaGeradaEm: new Date(), updatedAt: new Date() })
      .where(eq(csMarcos.id, marco.id));
  }

  return { tarefasCriadas, marcos: vencidos.length };
}

/**
 * Backfill: semeia o ciclo 1 de quem já está na carteira e nunca teve marcos.
 * Marcos com data no passado além da janela retroativa nascem PULADOS (ver
 * `iniciarJornadaCs`), então isto não gera avalanche.
 */
export async function semearJornadaEmLote(
  organizacaoId: string,
  opts: { apenasDesde?: Date; limite?: number; incluirJaIniciadas?: boolean } = {},
): Promise<{ contas: number; marcosCriados: number }> {
  // `incluirJaIniciadas` é para quando o PLAYBOOK cresce — foi o caso do M12,
  // acrescentado em 08/09 depois que 302 contas já tinham a jornada semeada.
  // `iniciarJornadaCs` é idempotente por marco, então rodar de novo só
  // acrescenta o que falta. Não entra no sweep: é manutenção pontual.
  const alvos = await db.select({ empresaId: clientes.empresaId })
    .from(clientes)
    .where(and(
      eq(clientes.organizacaoId, organizacaoId),
      opts.incluirJaIniciadas ? undefined : isNull(clientes.jornadaIniciadaEm),
      sql`${clientes.empresaId} IS NOT NULL`,
      opts.apenasDesde ? sql`${clientes.entrouCarteiraEm} >= ${opts.apenasDesde.toISOString()}` : undefined,
    ))
    .limit(opts.limite ?? 1000);

  let marcosCriados = 0;
  for (const alvo of alvos) {
    if (!alvo.empresaId) continue;
    const r = await iniciarJornadaCs(alvo.empresaId);
    marcosCriados += r.criados;
  }
  return { contas: alvos.length, marcosCriados };
}

/** Próximo marco pendente de cada empresa — usado na Carteira e na agenda. */
export async function proximosMarcos(organizacaoId: string, empresaIds: string[]) {
  if (empresaIds.length === 0) return new Map<string, { codigo: string; titulo: string; dueDate: string; ciclo: number }>();
  const rows = await db.select({
    empresaId: csMarcos.empresaId, codigo: csMarcos.codigo,
    titulo: csMarcos.titulo, dueDate: csMarcos.dueDate, ciclo: csMarcos.ciclo,
  })
    .from(csMarcos)
    .where(and(
      eq(csMarcos.organizacaoId, organizacaoId),
      eq(csMarcos.status, "PENDENTE"),
      inArray(csMarcos.empresaId, empresaIds),
    ))
    .orderBy(csMarcos.dueDate);

  const mapa = new Map<string, { codigo: string; titulo: string; dueDate: string; ciclo: number }>();
  for (const r of rows) if (!mapa.has(r.empresaId)) mapa.set(r.empresaId, r);
  return mapa;
}
