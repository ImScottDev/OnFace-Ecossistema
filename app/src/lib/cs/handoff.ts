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
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { iniciarJornadaCs } from "./jornada";
import { criarTarefaCs } from "./tarefas";
import { resolveFollowupOwnerId } from "@/lib/crm/sdr-escalation";
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

  await garantirContaCsPorEmpresa({
    organizacaoId,
    empresaId: servico.empresaId,
    leadId: servico.leadId,
    entrouEm: servico.createdAt,
  });
}

/**
 * Cria (se não existir) a conta de CS da empresa e semeia a jornada.
 *
 * Existe separado de `garantirContaCs` porque o gatilho não é sempre um
 * serviço canônico: a venda fechada manualmente (Won pelo board, sem proposta
 * nem grupo comercial) nunca gera `CanonicalServiceActivated`, e antes desta
 * rodada esse cliente simplesmente não chegava ao CS. O gatilho comum aos dois
 * caminhos é o Won — que é onde o cliente entra na carteira, não quando a
 * implantação termina.
 *
 * Idempotente: `ON CONFLICT DO NOTHING` na conta e chave por marco na jornada.
 */
export async function garantirContaCsPorEmpresa(opts: {
  organizacaoId: string;
  empresaId: string;
  leadId?: string | null;
  entrouEm?: Date | null;
}): Promise<{ criada: boolean }> {
  const entrouEm = opts.entrouEm ?? new Date();

  // `idx_clientes_org_empresa` é um índice PARCIAL (WHERE empresa_id IS NOT NULL).
  // Postgres só casa ON CONFLICT com índice parcial quando o mesmo predicado
  // aparece na cláusula — sem ele a query morria com "there is no unique or
  // exclusion constraint matching the ON CONFLICT specification".
  //
  // Efeito real (achado 14/09, reproduzido no banco de DEV): TODO handoff de
  // Won pro CS falhava aqui. O evento CanonicalServiceActivated ia parar no
  // dead-letter depois de 5 tentativas e o cliente nunca entrava na carteira
  // do CS pelo caminho automático — só por backfill.
  //
  // `leadIdLegado` também é único (idx_clientes_lead_legado, este total): duas
  // empresas do mesmo lead colidiriam por ele, então o valor só vai quando
  // ainda não existe conta com aquele lead.
  const leadJaVinculado = opts.leadId
    ? await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.leadIdLegado, opts.leadId)).limit(1)
    : [];

  // COMPLETA em vez de ignorar quando a conta já existe.
  //
  // Achado 14/09: `syncPessoaFromLead` também cria linha em `clientes` (quando
  // o lead vira tipo='cliente'), mas sem `entrouCarteiraEm` nem
  // `statusFinanceiro` — e roda ANTES daqui no fluxo de Won. Com
  // `DO NOTHING`, essa conta "magra" ganhava a corrida e a data de entrada na
  // carteira ficava nula pra sempre. `entrouCarteiraEm` é a âncora do ciclo de
  // CS (lib/cs/jornada.ts), então isso desalinhava a jornada inteira.
  //
  // COALESCE: preenche só o que está faltando, nunca sobrescreve valor que já
  // existe — continua idempotente e não estraga conta antiga com data real.
  // E3: dono padrão da carteira = Jenifer (decisão do Scott, marco zero). Todo
  // mundo vê tudo e a reatribuição em massa troca depois; null se ela não existir.
  const donoPadraoId = await resolveFollowupOwnerId(db, opts.organizacaoId);
  const inseridos = await db.insert(clientes).values({
    organizacaoId: opts.organizacaoId,
    responsavelId: donoPadraoId,
    empresaId: opts.empresaId,
    leadIdLegado: leadJaVinculado.length > 0 ? null : (opts.leadId ?? null),
    clienteDesde: entrouEm,
    entrouCarteiraEm: entrouEm,
    // Cache de leitura da Carteira: conta nova nasce ativa. Inadimplência
    // continua sendo derivada de fatura vencida, nunca escrita aqui.
    statusFinanceiro: "ativo",
  }).onConflictDoUpdate({
    target: [clientes.organizacaoId, clientes.empresaId],
    targetWhere: isNotNull(clientes.empresaId),
    set: {
      entrouCarteiraEm: sql`coalesce(${clientes.entrouCarteiraEm}, excluded.entrou_carteira_em)`,
      clienteDesde: sql`coalesce(${clientes.clienteDesde}, excluded.cliente_desde)`,
      statusFinanceiro: sql`coalesce(${clientes.statusFinanceiro}, excluded.status_financeiro)`,
      responsavelId: sql`coalesce(${clientes.responsavelId}, excluded.responsavel_id)`,
      updatedAt: new Date(),
    },
  }).returning({ id: clientes.id, criadaAgora: sql<boolean>`(xmax = 0)` });

  await iniciarJornadaCs(opts.empresaId);
  return { criada: inseridos[0]?.criadaAgora === true };
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
