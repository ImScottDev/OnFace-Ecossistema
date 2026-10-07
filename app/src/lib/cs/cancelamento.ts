/**
 * Churn como processo.
 *
 * Nada aqui apaga cliente, empresa, contrato, serviço ou receita histórica.
 * Um pedido de cancelamento abre um processo com checagens obrigatórias
 * (contrato, multa, financeiro, equipamento), tentativa de retenção e
 * decisão registrada. O serviço só é encerrado no EFETIVAR — e mesmo aí
 * vira `commercial_lifecycle = 'CHURNED'`, que é o estado canônico que o
 * resto do CRM já entende, nunca um DELETE.
 */
import { db } from "@/lib/db";
import { csCancelamentos, servicosCanonicos, contratos, faturas, clientes } from "@/lib/db/schema";
import { and, eq, sql, inArray } from "drizzle-orm";
import { criarTarefaCs, registrarInteracao } from "./tarefas";

export const MOTIVOS_CANCELAMENTO = [
  { key: "preco", label: "Preço" },
  { key: "baixo_uso", label: "Baixo uso" },
  { key: "sem_valor_percebido", label: "Não percebeu valor" },
  { key: "produto", label: "Produto (faltou funcionalidade / qualidade)" },
  { key: "suporte", label: "Suporte / atendimento" },
  { key: "concorrente", label: "Foi para concorrente" },
  { key: "encerramento_empresa", label: "Encerramento da empresa" },
  { key: "inadimplencia", label: "Inadimplência" },
  { key: "mudanca_estrategica", label: "Mudança estratégica do cliente" },
  { key: "outro", label: "Outro" },
] as const;

export type StatusCancelamento = "SOLICITADO" | "EM_RETENCAO" | "RETIDO" | "APROVADO" | "EFETIVADO";

/**
 * Levanta as checagens automaticamente no momento do pedido — multa e
 * pendência financeira são o que trava (ou dá alavanca para) a retenção, e
 * ninguém deveria ter que abrir 3 telas pra descobrir isso.
 * `null` significa "não deu pra verificar", diferente de `false`.
 */
async function levantarChecagens(empresaId: string, contratoId: string | null) {
  let contratoVigente: boolean | null = null;
  let multaAplicavel: boolean | null = null;
  let multaValor: string | null = null;

  if (contratoId) {
    const [ct] = await db.select({
      status: contratos.status, vencimento: contratos.vencimento,
      multaPercentual: contratos.multaPercentual, mrr: contratos.mrr,
    }).from(contratos).where(eq(contratos.id, contratoId)).limit(1);

    if (ct) {
      contratoVigente = ct.status === "ativo" && (!ct.vencimento || ct.vencimento >= new Date().toISOString().slice(0, 10));
      if (ct.multaPercentual && ct.mrr) {
        multaAplicavel = !!contratoVigente;
        multaValor = (Number(ct.mrr) * (Number(ct.multaPercentual) / 100)).toFixed(2);
      } else {
        multaAplicavel = false;
      }
    }
  }

  const [pend] = await db.select({
    valor: sql<string>`COALESCE(SUM(${faturas.valor}), 0)::text`,
  }).from(faturas).where(and(
    eq(faturas.empresaId, empresaId),
    eq(faturas.status, "aberta"),
  ));

  return { contratoVigente, multaAplicavel, multaValor, pendenciaFinanceira: pend?.valor ?? "0" };
}

/**
 * QA pós-venda 06/10: pedir cancelamento duas vezes para o mesmo serviço (duplo
 * clique, retry) abria dois processos e duas tarefas de retenção. Devolve o
 * processo ainda em andamento (não decidido) da empresa+serviço, se houver; o
 * serviço nulo só casa com pedido também sem serviço (conta inteira).
 */
export async function pedidoEmAberto(organizacaoId: string, empresaId: string, servicoCanonicoId: string | null) {
  const [aberto] = await db.select({ id: csCancelamentos.id, status: csCancelamentos.status }).from(csCancelamentos)
    .where(and(
      eq(csCancelamentos.organizacaoId, organizacaoId),
      eq(csCancelamentos.empresaId, empresaId),
      inArray(csCancelamentos.status, ["SOLICITADO", "EM_RETENCAO", "APROVADO"]),
      servicoCanonicoId
        ? eq(csCancelamentos.servicoCanonicoId, servicoCanonicoId)
        : sql`${csCancelamentos.servicoCanonicoId} IS NULL`,
    )).limit(1);
  return aberto ?? null;
}

export async function registrarPedidoCancelamento(input: {
  organizacaoId: string;
  empresaId: string;
  servicoCanonicoId?: string | null;
  contratoId?: string | null;
  motivo: string;
  motivoDetalhe?: string | null;
  canal?: string | null;
  dataDesejada?: string | null;
  solicitadoPor?: string | null;
}) {
  const contratoId = input.contratoId ?? null;
  const checagens = await levantarChecagens(input.empresaId, contratoId);

  const [processo] = await db.insert(csCancelamentos).values({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    servicoCanonicoId: input.servicoCanonicoId ?? null,
    contratoId,
    motivo: input.motivo,
    motivoDetalhe: input.motivoDetalhe ?? null,
    canal: input.canal ?? null,
    dataDesejada: input.dataDesejada ?? null,
    solicitadoPor: input.solicitadoPor ?? null,
    contratoVigente: checagens.contratoVigente,
    multaAplicavel: checagens.multaAplicavel,
    multaValor: checagens.multaValor,
    pendenciaFinanceira: checagens.pendenciaFinanceira,
  }).returning();

  await criarTarefaCs({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    servicoCanonicoId: input.servicoCanonicoId ?? null,
    titulo: `Retenção: pedido de cancelamento (${input.motivo})`,
    descricao: input.motivoDetalhe ?? null,
    motivo: "Pedido de cancelamento registrado",
    tipo: "cs_retencao",
    origem: "RISCO",
    prioridade: "alta",
    venceEm: new Date(Date.now() + 86_400_000),
    chaveIdempotencia: `CS_CANCEL:${processo.id}`,
  });

  await registrarInteracao({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    tipo: "cs_cancelamento",
    titulo: "Pedido de cancelamento registrado",
    descricao: `Motivo: ${input.motivo}${input.motivoDetalhe ? ` — ${input.motivoDetalhe}` : ""}`,
    usuarioId: input.solicitadoPor ?? null,
    dados: { cancelamentoId: processo.id, motivo: input.motivo },
  });

  return processo;
}

export async function atualizarCancelamento(input: {
  id: string; organizacaoId: string; usuarioId?: string | null;
  status?: StatusCancelamento;
  tentativaRetencao?: string | null;
  ofertaRetencao?: string | null;
  equipamentosPendentes?: string | null;
  dataEfetiva?: string | null;
  motivoFinal?: string | null;
  motivoFinalDetalhe?: string | null;
}) {
  const decidiu = input.status === "RETIDO" || input.status === "APROVADO" || input.status === "EFETIVADO";
  // QA pós-venda 06/10: só a TRANSIÇÃO para EFETIVADO encerra serviço; repetir o
  // PATCH não pode regravar nada nem duplicar a interação de churn.
  const [antes] = await db.select({ status: csCancelamentos.status }).from(csCancelamentos)
    .where(and(eq(csCancelamentos.id, input.id), eq(csCancelamentos.organizacaoId, input.organizacaoId))).limit(1);
  if (!antes) return null;
  const efetivando = input.status === "EFETIVADO" && antes.status !== "EFETIVADO";
  const [row] = await db.update(csCancelamentos)
    .set({
      status: input.status ?? undefined,
      tentativaRetencao: input.tentativaRetencao ?? undefined,
      ofertaRetencao: input.ofertaRetencao ?? undefined,
      equipamentosPendentes: input.equipamentosPendentes ?? undefined,
      dataEfetiva: input.dataEfetiva ?? undefined,
      motivoFinal: input.motivoFinal ?? undefined,
      motivoFinalDetalhe: input.motivoFinalDetalhe ?? undefined,
      decisao: input.status === "RETIDO" ? "RETIDO" : (input.status === "APROVADO" || input.status === "EFETIVADO") ? "CANCELADO" : undefined,
      decididoEm: decidiu ? new Date() : undefined,
      decididoPor: decidiu ? input.usuarioId ?? null : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(csCancelamentos.id, input.id), eq(csCancelamentos.organizacaoId, input.organizacaoId)))
    .returning();

  if (!row) return null;

  // Encerramento do serviço acontece SÓ no EFETIVADO, e como transição de
  // lifecycle — o histórico de receita continua inteiro, o serviço apenas
  // sai do portfólio ativo.
  if (efetivando) {
    // QA pós-venda 06/10: pedido sem serviço (conta inteira) efetivava sem
    // encerrar NADA: o cliente seguia ativo e o MRR não caía. Sem serviço
    // informado, o churn vale para todo serviço ainda no portfólio da empresa.
    // QA 06/10 (segunda rodada): o alvo era `portfolio_included = true`, e
    // serviço ATIVO fora do portfólio não era encerrado — é o caso de todo
    // serviço recém-criado pelo pós-venda (nasce fora do portfólio com valor 0)
    // e de outros 50 na base. O cliente seguia ACTIVE depois do churn efetivado.
    // Estar no portfólio é sobre aparecer no MRR; estar ativo é o que o churn
    // encerra.
    await db.update(servicosCanonicos)
      .set({ commercialLifecycle: "CHURNED", portfolioIncluded: false, updatedAt: new Date() })
      .where(row.servicoCanonicoId
        ? eq(servicosCanonicos.id, row.servicoCanonicoId)
        : and(eq(servicosCanonicos.empresaId, row.empresaId), eq(servicosCanonicos.organizacaoId, input.organizacaoId), eq(servicosCanonicos.commercialLifecycle, "ACTIVE")));

    // A carteira (aba Cancelados) lê clientes.status_financeiro. Sem restar
    // serviço no portfólio, a empresa passa a 'churned'; com outro serviço
    // ativo, continua cliente (churn parcial).
    const [restante] = await db.select({ n: sql<number>`count(*)::int` }).from(servicosCanonicos)
      .where(and(eq(servicosCanonicos.empresaId, row.empresaId), eq(servicosCanonicos.commercialLifecycle, "ACTIVE")));
    if (!restante?.n) {
      await db.update(clientes).set({ statusFinanceiro: "churned", updatedAt: new Date() })
        .where(and(eq(clientes.empresaId, row.empresaId), eq(clientes.organizacaoId, input.organizacaoId)));
    }

    if (row.contratoId) {
      await db.update(contratos)
        .set({
          status: "churned",
          motivoChurn: row.motivoFinal ?? row.motivo,
          finalizadoAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contratos.id, row.contratoId));
    }
  }

  if (input.status && input.status === antes.status) return row; // sem mudança de estado, sem interação duplicada
  await registrarInteracao({
    organizacaoId: input.organizacaoId,
    empresaId: row.empresaId,
    tipo: "cs_cancelamento",
    titulo: `Cancelamento: ${row.status.toLowerCase()}`,
    descricao: input.tentativaRetencao ?? input.motivoFinalDetalhe ?? null,
    usuarioId: input.usuarioId ?? null,
    dados: { cancelamentoId: row.id, status: row.status },
  });

  return row;
}
