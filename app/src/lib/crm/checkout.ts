/**
 * Commercial Core v2 (ADR-EXEC-021) — Checkout como entidade própria.
 *
 * Correção do comportamento legado: criar/enviar proposta NÃO gera mais
 * checkout automaticamente (isso presumia que o cliente já tinha decidido
 * comprar). Checkout só nasce quando existe intenção comercial suficiente:
 *  - automático, logo após o cliente ACEITAR a proposta (grupo sem contrato
 *    exigido — ver aceitarPropostaPublica);
 *  - manual, quando o vendedor já tem o aceite verbal/em reunião e só
 *    precisa formalizar + entregar o link de pagamento (ação explícita,
 *    auditada, nunca marca Won sozinha).
 *
 * Tecnicamente: Stripe Checkout HOSTED (redirect) via API REST — mesma
 * integração já usada e comprovada (sem SDK, Bearer token). Decisão
 * consciente de NÃO migrar pra Embedded Checkout/Elements agora: não há
 * publishable key nem @stripe/stripe-js no projeto (verificado antes de
 * escrever este módulo) — trocar exigiria nova infra de chave pública +
 * dependência client-side, fora do escopo "não invente, use o que já existe
 * e está provado". Fica registrado como possível evolução futura.
 */
import { db } from "@/lib/db";
import { eq, asc, sql } from "drizzle-orm";
import {
  checkouts, propostas, propostaGrupoComercial, propostaGrupoComercialItens, propostaItens, servicosCatalogo, catalogoPrecos, leads, empresas, negocios,
} from "@/lib/db/schema";
import { boletoExpiresAfterDaysFromValidade, createFaturadaSubscription, createGroupCheckout, createStripeCustomer, expireCheckoutSession, getStripeCheckoutMode, validarValorDoItem, type CheckoutItem } from "@/lib/integrations/stripe-checkout";
import { diaDoVencimento, logradouroFiscal, proximoDiaDoMes, vendaEhFaturada } from "@/lib/crm/condicoes-comerciais";
import { publicarEvento } from "@/lib/events/outbox";
import { vincularCheckoutAoGrupo } from "@/lib/crm/grupo-comercial";
import { montarMetadataComercial } from "@/lib/crm/metadata-comercial";
import { aplicarExpansaoNaAssinatura } from "@/lib/crm/expansao-assinatura";
import { appUrl } from "@/lib/app-url";

export type CriarCheckoutResult =
  | { ok: true; checkoutId: string; url: string }
  /* Expansão não gera checkout: a cobrança foi feita na assinatura que o
     cliente já tem. Variante própria de propósito — quem espera um link de
     pagamento precisa ser obrigado pelo compilador a tratar este caso, em vez
     de mostrar "aguardando pagamento" para uma venda já cobrada. */
  | { ok: true; expansao: true; subscriptionId: string; itensAplicados: number; faturaId: string | null; faturaUrl: string | null }
  /* Venda por CONTRATO: pós-paga. A assinatura é ativada e a mensalidade é
     faturada por boleto no dia combinado — não há link de pagamento a enviar
     antes, porque a evidência de fechamento foi a assinatura do contrato.
     Variante própria pelo mesmo motivo da expansão: o compilador obriga quem
     espera `url` a tratar este caso em vez de mostrar "aguardando pagamento"
     numa venda já fechada e já faturada. */
  | { ok: true; faturada: true; subscriptionId: string; faturaId: string | null; faturaUrl: string | null }
  | { ok: false; error: string; /** Para onde ir resolver: a alteração da assinatura no Cliente 360. */ alterarAssinaturaUrl?: string };

/**
 * Checkout em modo subscription sempre cria uma assinatura nova no Stripe.
 * Portanto ele serve para aquisição; expansão recorrente precisa alterar a
 * assinatura existente de forma explícita, com a política de proration e
 * cobrança aprovada. Nunca usamos o checkout de aquisição como atalho.
 */
export function bloqueioNovoCheckoutDeAssinatura(
  commercialMotion: string | null | undefined,
  temItemRecorrente: boolean,
  /** Link da ação no Cliente 360; entra na mensagem para ela ter saída. */
  caminhoDaAlteracao?: string,
): string | null {
  if (!temItemRecorrente || !commercialMotion || commercialMotion === "NEW_BUSINESS") return null;
  return "Esta venda altera uma assinatura existente, então não gera checkout novo (cobraria em duplicidade). Conclua em Cliente 360 › Assinaturas › Adicionar produto / Trocar plano"
    + (caminhoDaAlteracao ? `: ${caminhoDaAlteracao}` : ".");
}

/**
 * Cria (ou re-gera, expirando o anterior) um checkout Stripe pro grupo
 * comercial informado. `origem` distingue o gatilho automático (pós-aceite)
 * do manual (vendedor) — nunca marca Won, nunca presume pagamento.
 */
export async function criarCheckoutParaGrupo(opts: {
  grupoId: string;
  origem: "automatico_pos_aceite" | "manual_vendedor";
  criadoPorId?: string | null;
  /** Expansão: a assinatura que o vendedor escolheu, quando a empresa tem mais de uma viva. */
  assinaturaEscolhidaId?: string | null;
}): Promise<CriarCheckoutResult> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, opts.grupoId)).limit(1);
  if (!grupo) return { ok: false, error: "Grupo comercial não encontrado" };
  if (!["aguardando_checkout", "checkout_gerado"].includes(grupo.status)) {
    return { ok: false, error: `Este grupo está em '${grupo.status}' — checkout só pode ser gerado quando o requisito anterior (ex: contrato assinado) já foi cumprido.` };
  }

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, grupo.propostaId)).limit(1);
  if (!proposta) return { ok: false, error: "Proposta não encontrada" };
  const [negocio] = proposta.negocioId
    ? await db.select({ commercialMotion: negocios.commercialMotion, empresaId: negocios.empresaId }).from(negocios).where(eq(negocios.id, proposta.negocioId)).limit(1)
    : [undefined];

  const itensDoGrupo = await db
    .select({
      nome: propostaItens.nome, tipo: propostaItens.tipo, quantidade: propostaItens.quantidade,
      subtotal: propostaItens.subtotal, servicoCatalogoId: propostaItens.servicoCatalogoId,
      // O Price e o valor de tabela do MOMENTO DA VENDA (copiados na linha); só a linha antiga lê o catálogo vivo.
      stripePriceId: sql<string | null>`COALESCE(${propostaItens.stripePriceId}, ${catalogoPrecos.stripePriceId})`,
      stripeProductId: sql<string | null>`COALESCE(${propostaItens.stripeProductId}, ${servicosCatalogo.stripeProductId})`,
      valorTabela: sql<string | null>`COALESCE(${propostaItens.valorTabela}, ${catalogoPrecos.valor})`,
      moeda: catalogoPrecos.moeda,
      valorPersonalizado: catalogoPrecos.valorPersonalizado,
      valorMinimoCentavos: catalogoPrecos.valorMinimoCentavos,
      valorMaximoCentavos: catalogoPrecos.valorMaximoCentavos,
      recorrente: catalogoPrecos.recorrente,
      precoAtivo: catalogoPrecos.ativo,
      produtoAtivo: servicosCatalogo.ativo,
      origemCatalogo: servicosCatalogo.origemCatalogo,
    })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
    .leftJoin(servicosCatalogo, eq(propostaItens.servicoCatalogoId, servicosCatalogo.id))
    .leftJoin(catalogoPrecos, eq(propostaItens.catalogoPrecoId, catalogoPrecos.id))
    .where(eq(propostaGrupoComercialItens.grupoId, opts.grupoId))
    .orderBy(asc(propostaItens.ordem));

  if (itensDoGrupo.length === 0) return { ok: false, error: "Grupo comercial sem itens" };
  const caminho = negocio?.empresaId && proposta.negocioId
    ? `${appUrl()}/clientes/${negocio.empresaId}?alterar-assinatura=1&negocio=${proposta.negocioId}&proposta=${proposta.id}`
    : undefined;
  /* Expansão recorrente não passa por aqui — ela cobra na assinatura que o
     cliente já tem. A checagem acontece depois da validação dos itens (mais
     abaixo), porque a alteração precisa dos mesmos Prices já conferidos contra
     o catálogo oficial: a regra do que pode ser cobrado é uma só. */
  const ehExpansaoRecorrente = !!bloqueioNovoCheckoutDeAssinatura(
    negocio?.commercialMotion,
    itensDoGrupo.some((item) => item.tipo === "recorrente"),
  );

  const [lead] = await db.select({
    id: leads.id, nome: leads.nome, sobrenome: leads.sobrenome, email: leads.email, telefone: leads.telefone,
    empresa: leads.empresa, empresaId: leads.empresaId, empresaCnpj: leads.empresaCnpj, stripeCustomerId: leads.stripeCustomerId,
  }).from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
  const [empresa] = lead?.empresaId
    ? await db.select({ id: empresas.id, nome: empresas.nome, cnpj: empresas.cnpj, telefone: empresas.telefone, endereco: empresas.endereco, logradouro: empresas.logradouro, numero: empresas.numero, cep: empresas.cep, cidade: empresas.cidade, estado: empresas.estado, pais: empresas.pais, stripeCustomerId: empresas.stripeCustomerId })
      .from(empresas).where(eq(empresas.id, lead.empresaId)).limit(1)
    : [undefined];

  try {
    getStripeCheckoutMode();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const metadata = await montarMetadataComercial(opts.grupoId);
  if (!metadata) return { ok: false, error: "Não foi possível montar a metadata comercial do grupo." };
  /* O Customer vem do resolver canônico (stripe-customer.ts): vínculo da empresa
     no banco → metadata/CNPJ/e-mail no Stripe (nunca Customer do SaaS) → cria sob
     trava. Ele também grava de volta em empresas, leads e billing_identities, e
     é por isso que não há mais "Empresa e contato possuem Customers diferentes"
     aqui: o da empresa vence e o resto vira aviso no log. */
  let customerId: string;
  try {
    const customer = await createStripeCustomer({
      organizacaoId: proposta.organizacaoId,
      empresaId: empresa?.id ?? lead?.empresaId ?? null,
      leadId: lead?.id ?? null,
      cnpj: empresa?.cnpj ?? lead?.empresaCnpj ?? null,
      name: empresa?.nome || [lead?.nome, lead?.sobrenome].filter(Boolean).join(" ") || lead?.empresa || "Cliente Callface",
      email: lead?.email,
      phone: empresa?.telefone || lead?.telefone,
      address: {
        line1: logradouroFiscal({ endereco: empresa?.endereco, logradouro: empresa?.logradouro, numero: empresa?.numero }),
        city: empresa?.cidade,
        state: empresa?.estado,
        postalCode: empresa?.cep,
        country: empresa?.pais || "BR",
      },
      metadata,
    });
    customerId = customer.id;
  } catch (err) {
    return { ok: false, error: `Falha ao preparar Stripe Customer: ${String(err)}` };
  }

  const mapItem = (i: (typeof itensDoGrupo)[number]): CheckoutItem => {
    const quantidade = Math.max(1, Math.round(parseFloat(i.quantidade || "1") || 1));
    const subtotal = parseFloat(i.subtotal || "0");
    if (!i.stripePriceId || !i.stripeProductId || !i.moeda || i.valorTabela == null || !i.precoAtivo || !i.produtoAtivo || i.origemCatalogo !== "oficial_stripe") {
      throw new Error(`O item '${i.nome}' não está vinculado a um Price oficial ativo do catálogo.`);
    }
    const valorUnitario = quantidade > 0 ? subtotal / quantidade : subtotal;
    const esperadoRecorrente = i.tipo === "recorrente";
    if (Boolean(i.recorrente) !== esperadoRecorrente) throw new Error(`O Price oficial do item '${i.nome}' não corresponde ao tipo ${i.tipo}.`);
    const item = { nome: i.nome, valorUnitario, valorTabela: parseFloat(i.valorTabela), quantidade, stripePriceId: i.stripePriceId, stripeProductId: i.stripeProductId, moeda: i.moeda, valorPersonalizado: i.valorPersonalizado, valorMinimoCentavos: i.valorMinimoCentavos, valorMaximoCentavos: i.valorMaximoCentavos };
    validarValorDoItem(item);
    return item;
  };
  let itensRecorrentes: CheckoutItem[];
  let itensAvulsos: CheckoutItem[];
  try {
    itensRecorrentes = itensDoGrupo.filter((i) => i.tipo === "recorrente").map(mapItem);
    itensAvulsos = itensDoGrupo.filter((i) => i.tipo !== "recorrente").map(mapItem);
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  /* Cliente que já paga: a venda cresce a assinatura dele, com pró-rata, em vez
     de abrir uma segunda cobrança. Os itens chegam aqui já conferidos contra o
     catálogo oficial, que é o mesmo crivo do checkout. Travou (mais de uma
     assinatura viva, desconto negociado): devolve o motivo e o caminho manual,
     exatamente como antes — nada é cobrado pela metade sem dizer. */
  if (ehExpansaoRecorrente) {
    if (!negocio?.empresaId) {
      return { ok: false, error: "Esta venda altera uma assinatura existente, mas a oportunidade não tem empresa vinculada — sem ela não dá para saber qual assinatura cresce.", alterarAssinaturaUrl: caminho };
    }
    const r = await aplicarExpansaoNaAssinatura({
      organizacaoId: proposta.organizacaoId,
      empresaId: negocio.empresaId,
      negocioId: proposta.negocioId,
      propostaId: proposta.id,
      grupoId: opts.grupoId,
      usuarioId: opts.criadoPorId ?? null,
      assinaturaEscolhidaId: opts.assinaturaEscolhidaId ?? null,
      itens: itensRecorrentes.map((i) => ({
        nome: i.nome, quantidade: i.quantidade, stripePriceId: i.stripePriceId,
        valorUnitario: i.valorUnitario, valorTabela: i.valorTabela,
      })),
    });
    /* Sem assinatura viva não há expansão nenhuma: o cliente cancelou, nunca
       completou o primeiro pagamento ou está inadimplente. Travar aqui era o
       pior dos mundos — nenhum link para o cliente pagar E nenhuma cobrança,
       com a venda morrendo em silêncio. Segue como venda nova: checkout normal,
       link gerado, e o ganho sai pelo caminho de sempre, com o pagamento. */
    if (!r.ok && !r.semAssinaturaViva) return { ok: false, error: r.error, alterarAssinaturaUrl: caminho };
    if (r.ok) return { ok: true, expansao: true, subscriptionId: r.subscriptionId, itensAplicados: r.itensAplicados, faturaId: r.faturaId, faturaUrl: r.faturaUrl };
    console.log(`[checkout] grupo ${opts.grupoId} marcado como expansão, mas a empresa não tem assinatura viva — seguindo como venda nova`);
  }

  // Re-geração: expira qualquer sessão ainda aberta desse grupo (valores podem ter mudado).
  if (grupo.checkoutId) {
    const [checkoutAnterior] = await db.select().from(checkouts).where(eq(checkouts.id, grupo.checkoutId)).limit(1);
    if (checkoutAnterior?.stripeSessionId && ["criado", "aberto"].includes(checkoutAnterior.status)) {
      await expireCheckoutSession(checkoutAnterior.stripeSessionId).catch((e) => console.error(`[checkout] falha ao expirar sessão anterior do grupo ${opts.grupoId}:`, e));
    }
  }

  /* Venda por contrato é pós-paga: ativa a assinatura e fatura no dia
     combinado, em vez de pedir pagamento antes. Os itens, o Customer (já com
     ID fiscal) e o desconto conferidos acima são os MESMOS — só muda o
     destino, e é por isso que esta ramificação mora aqui dentro e não num
     segundo caminho paralelo. */
  if (vendaEhFaturada({ modoFechamento: proposta.modoFechamento, diaVencimentoMes: proposta.diaVencimentoMes, temItemRecorrente: itensRecorrentes.length > 0 })) {
    try {
      const assinatura = await createFaturadaSubscription({
        propostaId: proposta.id, negocioId: proposta.negocioId, grupoComercialId: opts.grupoId, organizacaoId: proposta.organizacaoId,
        moeda: proposta.moeda || "BRL", itensRecorrentes, itensAvulsos: [], customerId, metadata,
        attemptKey: grupo.checkoutId || "initial",
        successUrl: "", cancelUrl: "",
        descontoRecorrenteMeses: proposta.descontoTemporarioAlvo === "mrr" ? proposta.descontoTemporarioMeses : null,
        diaVencimentoMes: diaDoVencimento(proposta.diaVencimentoMes, new Date()),
        inicioDoCiclo: proximoDiaDoMes(diaDoVencimento(proposta.diaVencimentoMes, new Date()), new Date()),
        diasParaPagar: proposta.vencimentoDias,
      });
      const [linha] = await db.insert(checkouts).values({
        organizacaoId: proposta.organizacaoId, propostaId: proposta.id, negocioId: proposta.negocioId,
        grupoComercialId: opts.grupoId, origem: opts.origem, criadoPorId: opts.criadoPorId ?? null,
        stripeSubscriptionId: assinatura.subscriptionId, stripeInvoiceId: assinatura.faturaId,
        stripeCheckoutUrl: assinatura.faturaUrl, stripeCustomerId: customerId,
        // Faturada: a assinatura está ativa e a cobrança segue o ciclo. Quem
        // confirma o pagamento é o webhook `invoice.paid`, como em todo boleto.
        status: "aberto", paymentStatus: "pendente", metadata,
      }).returning();
      if (linha) await vincularCheckoutAoGrupo(opts.grupoId, linha.id);
      await publicarEvento({
        organizacaoId: proposta.organizacaoId, eventType: "SubscriptionActivated", aggregateType: "grupo_comercial", aggregateId: opts.grupoId,
        payload: { propostaId: proposta.id, negocioId: proposta.negocioId, subscriptionId: assinatura.subscriptionId, faturaId: assinatura.faturaId, diaVencimento: diaDoVencimento(proposta.diaVencimentoMes, new Date()) },
        idempotencyKey: `subscription-activated:${opts.grupoId}`,
      });
      return { ok: true, faturada: true, subscriptionId: assinatura.subscriptionId, faturaId: assinatura.faturaId, faturaUrl: assinatura.faturaUrl };
    } catch (err) {
      return { ok: false, error: `Falha ao ativar a assinatura faturada no Stripe: ${String(err)}` };
    }
  }

  const base = appUrl();
  let sessionId: string, url: string;
  try {
    const session = await createGroupCheckout({
      propostaId: proposta.id, negocioId: proposta.negocioId, grupoComercialId: opts.grupoId, organizacaoId: proposta.organizacaoId,
      moeda: proposta.moeda || "BRL", itensRecorrentes, itensAvulsos, customerId, metadata,
      attemptKey: grupo.checkoutId || "initial",
      // Boleto vence junto com a Validade da proposta; sem isso a Stripe usa
      // o default da conta (3 dias). Fix de produção a4ef701.
      boletoExpiresAfterDays: boletoExpiresAfterDaysFromValidade(proposta.dataValidade),
      /* Período de teste, quando o vendedor marcou na proposta. Só faz sentido
         com item recorrente — o Stripe ignora `trial` em cobrança avulsa, e
         mandar assim mesmo só polui a sessão. */
      trialDias: itensRecorrentes.length > 0 ? proposta.trialDias : null,
      /* Desconto com prazo só vale como prazo quando o alvo é a mensalidade;
         com alvo "setup" ele não tem nada a ver com a duração do recorrente. */
      descontoRecorrenteMeses: proposta.descontoTemporarioAlvo === "mrr" ? proposta.descontoTemporarioMeses : null,
      successUrl: process.env.CHECKOUT_SUCCESS_URL || `${base}/p/${proposta.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: process.env.CHECKOUT_CANCEL_URL || `${base}/p/${proposta.id}?checkout=cancelled`,
    });
    sessionId = session.sessionId;
    url = session.url;
  } catch (err) {
    return { ok: false, error: `Falha ao gerar checkout no Stripe: ${String(err)}` };
  }

  const [checkout] = await db.insert(checkouts).values({
    organizacaoId: proposta.organizacaoId,
    propostaId: proposta.id,
    negocioId: proposta.negocioId,
    grupoComercialId: opts.grupoId,
    origem: opts.origem,
    criadoPorId: opts.criadoPorId ?? null,
    stripeSessionId: sessionId,
    stripeCheckoutUrl: url,
    stripeCustomerId: customerId,
    status: "criado",
    paymentStatus: "pendente",
    metadata,
    expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();

  await vincularCheckoutAoGrupo(opts.grupoId, checkout.id);

  // Compatibilidade de leitura: propostas antigas e telas que ainda olham o
  // campo raiz passam a apontar para a bridge desta tentativa. O valor real
  // do Stripe continua em checkouts.stripeCheckoutUrl.
  await db.update(propostas).set({
    checkoutUrl: `${base}/checkout/${checkout.id}`,
    stripeSessionId: sessionId,
    updatedAt: new Date(),
  }).where(eq(propostas.id, proposta.id));

  await publicarEvento({
    organizacaoId: proposta.organizacaoId,
    eventType: "CheckoutCreated",
    aggregateType: "checkout",
    aggregateId: checkout.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, grupoComercialId: opts.grupoId, origem: opts.origem, criadoPorId: opts.criadoPorId ?? null },
  });

  return { ok: true, checkoutId: checkout.id, url };
}

/** Chamado no GET da página pública /checkout/{id} — best-effort, não bloqueia a navegação. */
export async function registrarAberturaCheckout(checkoutId: string): Promise<void> {
  const [checkout] = await db.select().from(checkouts).where(eq(checkouts.id, checkoutId)).limit(1);
  if (!checkout) return;
  if (!checkout.aberturaEm) {
    await db.update(checkouts).set({ aberturaEm: new Date(), status: checkout.status === "criado" ? "aberto" : checkout.status }).where(eq(checkouts.id, checkoutId));
  }
  await publicarEvento({
    organizacaoId: checkout.organizacaoId,
    eventType: "CheckoutOpened",
    aggregateType: "checkout",
    aggregateId: checkoutId,
    payload: { propostaId: checkout.propostaId, grupoComercialId: checkout.grupoComercialId },
  });
}

export async function buscarCheckoutPorSessionId(stripeSessionId: string) {
  const [checkout] = await db.select().from(checkouts).where(eq(checkouts.stripeSessionId, stripeSessionId)).limit(1);
  return checkout ?? null;
}
