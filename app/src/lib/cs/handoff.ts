/**
 * Pontes entre o barramento de eventos e o CS.
 *
 * Fica separado de `consumer.ts` pra que o consumidor continue sendo só
 * registro de handler, e separado dos módulos de domínio porque isto aqui
 * é tradução de evento — sabe o formato do payload, que o domínio não
 * precisa conhecer.
 */
import { db } from "@/lib/db";
import { clientes, servicosCanonicos, faturas, empresas } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { iniciarJornadaCs } from "./jornada";
import { criarTarefaCs } from "./tarefas";
import { csRiscos } from "@/lib/db/schema";

/**
 * Garante a conta de CS da empresa dona do serviço recém-ativado e semeia a
 * jornada. Cliente entra na carteira do CS no Won — não quando a
 * implantação termina.
 */
export async function garantirContaCs(organizacaoId: string, servicoCanonicoId: string): Promise<void> {
  const [servico] = await db.select({
    empresaId: servicosCanonicos.empresaId,
    leadId: servicosCanonicos.leadId,
    createdAt: servicosCanonicos.createdAt,
  }).from(servicosCanonicos).where(eq(servicosCanonicos.id, servicoCanonicoId)).limit(1);

  if (!servico?.empresaId) {
    // Serviço sem empresa não vira conta de CS. Não é erro de execução —
    // é dado incompleto na origem, e falhar aqui só encheria o
    // dead-letter sem resolver nada.
    console.warn(`[cs/handoff] serviço ${servicoCanonicoId} sem empresa_id — conta de CS não criada`);
    return;
  }

  await db.insert(clientes).values({
    organizacaoId,
    empresaId: servico.empresaId,
    leadIdLegado: servico.leadId,
    clienteDesde: servico.createdAt,
    entrouCarteiraEm: servico.createdAt,
  }).onConflictDoNothing({ target: [clientes.organizacaoId, clientes.empresaId] });

  await iniciarJornadaCs(servico.empresaId);
}

/**
 * Abre (ou reforça) o sinal de falha de pagamento e cria a tarefa. O
 * payload do evento varia conforme quem publicou, então aqui só se confia
 * no que é sempre verdade: existe uma empresa envolvida, direta ou via
 * fatura/assinatura.
 */
export async function registrarFalhaPagamento(organizacaoId: string, payload: Record<string, unknown>): Promise<void> {
  const empresaId = await resolverEmpresaDoPayload(organizacaoId, payload);
  if (!empresaId) {
    console.warn("[cs/handoff] PaymentFailed sem empresa identificável no payload:", payload);
    return;
  }

  const [empresa] = await db.select({ nome: empresas.nome }).from(empresas).where(eq(empresas.id, empresaId)).limit(1);
  const motivo = typeof payload.motivo === "string" ? payload.motivo
    : typeof payload.reason === "string" ? payload.reason
    : "Cobrança recusada pelo provedor";

  const [risco] = await db.insert(csRiscos).values({
    organizacaoId,
    empresaId,
    tipo: "PAGAMENTO_FALHOU",
    severidade: "EM_RISCO",
    origem: "AUTOMATICO",
    motivo: `Falha de pagamento: ${motivo}`,
    fonte: "event_outbox:PaymentFailed",
    detalhe: payload,
  }).onConflictDoNothing().returning({ id: csRiscos.id });

  const { id: tarefaId } = await criarTarefaCs({
    organizacaoId,
    empresaId,
    titulo: `Falha de pagamento — ${empresa?.nome ?? "cliente"}`,
    descricao: motivo,
    motivo: "Cobrança recusada",
    tipo: "cs_billing",
    origem: "BILLING",
    prioridade: "alta",
    venceEm: new Date(Date.now() + 86_400_000),
    // A chave usa a referência da cobrança, quando existe: cada tentativa
    // recusada é um fato novo e merece sua tarefa; sem referência, cai numa
    // por dia, que é o compromisso razoável entre não perder e não spammar.
    chaveIdempotencia: `CS_PAGTO_FALHOU:${empresaId}:${
      (payload.invoiceId as string) || (payload.faturaId as string) || new Date().toISOString().slice(0, 10)
    }`,
  });

  if (risco?.id && tarefaId) {
    await db.update(csRiscos).set({ tarefaId }).where(eq(csRiscos.id, risco.id));
  }
}

async function resolverEmpresaDoPayload(organizacaoId: string, payload: Record<string, unknown>): Promise<string | null> {
  if (typeof payload.empresaId === "string") return payload.empresaId;

  const faturaId = (payload.faturaId as string) || (payload.invoiceId as string);
  if (faturaId) {
    const [f] = await db.select({ empresaId: faturas.empresaId })
      .from(faturas)
      .where(and(eq(faturas.organizacaoId, organizacaoId), eq(faturas.id, faturaId)))
      .limit(1);
    if (f?.empresaId) return f.empresaId;
  }

  const stripeCustomerId = (payload.stripeCustomerId as string) || (payload.customer as string);
  if (stripeCustomerId) {
    const [e] = await db.select({ id: empresas.id })
      .from(empresas)
      .where(and(eq(empresas.organizacaoId, organizacaoId), eq(empresas.stripeCustomerId, stripeCustomerId)))
      .limit(1);
    if (e?.id) return e.id;
  }

  const servicoId = payload.servicoCanonicoId as string;
  if (servicoId) {
    const [s] = await db.select({ empresaId: servicosCanonicos.empresaId })
      .from(servicosCanonicos).where(eq(servicosCanonicos.id, servicoId)).limit(1);
    if (s?.empresaId) return s.empresaId;
  }
  return null;
}
