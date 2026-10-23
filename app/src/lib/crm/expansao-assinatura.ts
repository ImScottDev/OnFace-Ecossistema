/**
 * Expansão: a venda para quem JÁ é cliente cobra na assinatura que ele tem.
 *
 * Antes, o aceite de uma proposta de expansão recusava o checkout — e com
 * razão, porque checkout em modo subscription cria uma assinatura NOVA e o
 * cliente passaria a pagar duas vezes. Só que a recusa era o fim da linha: a
 * mensagem mandava o vendedor concluir à mão no Cliente 360, o cliente ficava
 * olhando "preparando o link de pagamento…" e a venda não acontecia. Foi o que
 * aconteceu com uma proposta aceita em 14/10/2026: cinco tentativas, nenhuma
 * cobrança, um dia parado.
 *
 * Decisão do Scott (15/10/2026): para quem já é cliente, o aceite cobra
 * automático. Esta porta é o gatilho que faltava — ela não inventa mecanismo
 * nenhum, só liga o aceite ao `stripe-assinatura-acoes`, que já sabe alterar
 * assinatura com pró-rata e já é o que a tela do Cliente 360 usa. O efeito sai
 * da regra que já existia lá: acrescentar item sobe o MRR, e subir MRR cobra
 * o proporcional AGORA (`always_invoice`); o ciclo seguinte já vem cheio.
 *
 * O que esta porta se recusa a fazer, por ser dinheiro de cliente ativo:
 *  - **Adivinhar a assinatura.** Sem vínculo negócio→assinatura no modelo, só
 *    age quando a empresa tem UMA assinatura viva no espelho do CRM. Com duas,
 *    para e devolve o motivo: cobrar na errada é pior que não cobrar.
 *  - **Cobrar acima do combinado.** O desconto negociado na proposta não é
 *    aplicado aqui (o cupom é coisa do checkout), então item com desconto não
 *    passa — iria para o Stripe a preço de tabela, cobrando a mais.
 */
import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { assinaturas, assinaturaItens, checkouts } from "@/lib/db/schema";
import { assinaturaDoCrm } from "@/lib/financeiro/espelho-crm";
import { stripe } from "@/lib/integrations/stripe-assinatura";
import {
  planejarAlteracao,
  aplicarAlteracao,
  ErroDeAlteracao,
  type AcaoDeAssinatura,
} from "@/lib/integrations/stripe-assinatura-acoes";
import { registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { registrarPagamentoDoGrupo, concluirGrupo, vincularCheckoutAoGrupo } from "@/lib/crm/grupo-comercial";
import { mensagemDeEsperaDeTerceiro } from "@/lib/crm/retomada-aceite";

/** O item da proposta, já validado contra o catálogo oficial pelo checkout. */
export interface ItemDeExpansao {
  nome: string;
  quantidade: number;
  stripePriceId: string;
  /** Preço de tabela e preço negociado: se divergirem, a expansão não segue. */
  valorUnitario: number;
  valorTabela: number;
}

export type ResultadoExpansao =
  | { ok: true; subscriptionId: string; itensAplicados: number; faturaId: string | null;
      /** O link da fatura do pró-rata, para o cliente pagar (boleto, Pix ou cartão). */
      faturaUrl: string | null }
  /** Não há assinatura viva: não é falha, é uma venda nova. Quem chama gera checkout. */
  | { ok: false; semAssinaturaViva: true; error: string }
  | { ok: false; semAssinaturaViva?: false; error: string };

/**
 * O primeiro item cujo desconto a alteração de assinatura não sabe aplicar.
 *
 * O cupom é coisa do checkout; aqui o item entraria a preço de tabela e o
 * cliente pagaria mais do que aceitou. A margem de um centavo é a mesma que o
 * checkout usa para arredondamento.
 */
export function itemComDescontoQueNaoPodeIr(itens: ItemDeExpansao[]): ItemDeExpansao | null {
  return itens.find((i) => i.valorUnitario < i.valorTabela - 0.01) ?? null;
}

/** Soma as linhas do mesmo Price: a proposta pode trazer o item repetido. */
export function agruparPorPrice(itens: ItemDeExpansao[]): Map<string, number> {
  const porPrice = new Map<string, number>();
  for (const i of itens) porPrice.set(i.stripePriceId, (porPrice.get(i.stripePriceId) ?? 0) + i.quantidade);
  return porPrice;
}

/**
 * A assinatura viva da empresa, quando há exatamente uma.
 *
 * Só olha o espelho do CRM (`fora_do_espelho_em IS NULL`): a conta Stripe é
 * compartilhada com o SaaS, e assinatura do SaaS não é nossa para alterar.
 */
/**
 * A assinatura onde a expansão entra.
 *
 * Escolhida pelo vendedor na oportunidade quando existe mais de uma viva; a
 * única viva quando não há dúvida. Escolher é da pessoa, não do sistema — mas
 * perguntar é na tela da venda, não mandando ninguém procurar noutro lugar.
 */
export async function assinaturaParaExpandir(
  organizacaoId: string,
  empresaId: string,
  escolhidaId: string | null,
): Promise<{ ok: true; id: string; subscriptionId: string } | { ok: false; semAssinaturaViva?: boolean; error: string }> {
  if (!escolhidaId) return assinaturaUnicaDaEmpresa(organizacaoId, empresaId);
  const [a] = await db
    .select({ id: assinaturas.id, subId: assinaturas.stripeSubscriptionId, status: assinaturas.status })
    .from(assinaturas)
    .where(and(
      eq(assinaturas.id, escolhidaId),
      eq(assinaturas.organizacaoId, organizacaoId),
      eq(assinaturas.empresaId, empresaId),
      assinaturaDoCrm,
    ))
    .limit(1);
  if (!a) return { ok: false, error: "A assinatura escolhida não é desta empresa." };
  if (a.status !== "active" && a.status !== "trialing") {
    return { ok: false, error: `A assinatura escolhida está '${a.status}' — só assinatura ativa recebe o upgrade.` };
  }
  return { ok: true, id: a.id, subscriptionId: a.subId };
}

/** As assinaturas vivas da empresa, para o vendedor escolher na oportunidade. */
export async function assinaturasVivasDaEmpresa(organizacaoId: string, empresaId: string) {
  const linhas = await db
    .select({ id: assinaturas.id, subscriptionId: assinaturas.stripeSubscriptionId, produto: assinaturas.produto, quantidade: assinaturas.quantidade, mrr: assinaturas.mrr, status: assinaturas.status })
    .from(assinaturas)
    .where(and(eq(assinaturas.organizacaoId, organizacaoId), eq(assinaturas.empresaId, empresaId), assinaturaDoCrm));
  return linhas.filter((a) => a.status === "active" || a.status === "trialing");
}

export async function assinaturaUnicaDaEmpresa(
  organizacaoId: string,
  empresaId: string,
): Promise<{ ok: true; id: string; subscriptionId: string } | { ok: false; semAssinaturaViva?: boolean; error: string }> {
  const vivas = await db
    .select({ id: assinaturas.id, subId: assinaturas.stripeSubscriptionId, status: assinaturas.status })
    .from(assinaturas)
    .where(and(
      eq(assinaturas.organizacaoId, organizacaoId),
      eq(assinaturas.empresaId, empresaId),
      assinaturaDoCrm,
    ));
  const ativas = vivas.filter((a) => a.status === "active" || a.status === "trialing");
  if (ativas.length === 0) {
    /* Marcado como expansão, mas não há assinatura viva para expandir — o
       cliente cancelou, nunca completou o primeiro checkout, ou está inadimplente
       (`unpaid`, `incomplete_expired`). Caso real: um cliente com duas
       assinaturas, nenhuma ativa, cuja venda não gerava link "porque é
       expansão" e não cobrava "porque não há onde cobrar". Esta venda é uma
       venda nova como qualquer outra: quem chama cai no checkout normal. */
    return { ok: false, semAssinaturaViva: true, error: "Nenhuma assinatura ativa para expandir." };
  }
  if (ativas.length > 1) {
    return { ok: false, error: `A empresa tem ${ativas.length} assinaturas ativas e a venda não diz qual delas cresce. Escolha a assinatura em Cliente 360 › Assinaturas para não cobrar na errada.` };
  }
  return { ok: true, id: ativas[0].id, subscriptionId: ativas[0].subId };
}

/**
 * Aplica os itens recorrentes da proposta na assinatura que o cliente já tem.
 *
 * Idempotente pela chave `expansao:<grupo>:<price>`: o Stripe devolve o mesmo
 * resultado para a mesma chave, então reprocessar o aceite não cobra de novo.
 */
export async function aplicarExpansaoNaAssinatura(opts: {
  organizacaoId: string;
  empresaId: string;
  negocioId: string | null;
  propostaId: string;
  grupoId: string;
  itens: ItemDeExpansao[];
  usuarioId?: string | null;
  /** A assinatura que o vendedor escolheu, quando a empresa tem mais de uma viva. */
  assinaturaEscolhidaId?: string | null;
}): Promise<ResultadoExpansao> {
  if (opts.itens.length === 0) return { ok: false, error: "Grupo de expansão sem item recorrente." };

  const descontado = itemComDescontoQueNaoPodeIr(opts.itens);
  if (descontado) {
    return { ok: false, error: `O item '${descontado.nome}' foi negociado abaixo do preço de tabela, e a alteração de assinatura cobraria o valor cheio. Conclua em Cliente 360 › Assinaturas aplicando o desconto combinado.` };
  }

  const assinatura = await assinaturaParaExpandir(opts.organizacaoId, opts.empresaId, opts.assinaturaEscolhidaId ?? null);
  if (!assinatura.ok) {
    return assinatura.semAssinaturaViva
      ? { ok: false, semAssinaturaViva: true, error: assinatura.error }
      : { ok: false, error: assinatura.error };
  }

  // O espelho diz o que a assinatura já tem: Price repetido vira aumento de
  // quantidade, porque `adicionar_item` recusa Price que já está lá.
  const jaNaAssinatura = await db
    .select({ itemId: assinaturaItens.stripeSubscriptionItemId, priceId: assinaturaItens.stripePriceId, quantidade: assinaturaItens.quantidade })
    .from(assinaturaItens)
    .where(and(
      eq(assinaturaItens.organizacaoId, opts.organizacaoId),
      eq(assinaturaItens.assinaturaId, assinatura.id),
    ));

  const origem = {
    organizacaoId: opts.organizacaoId,
    usuarioId: opts.usuarioId ?? null,
    negocioId: opts.negocioId,
    propostaId: opts.propostaId,
  };

  let faturaId: string | null = null;
  let aplicados = 0;
  for (const [priceId, quantidade] of agruparPorPrice(opts.itens)) {
    const existente = jaNaAssinatura.find((i) => i.priceId === priceId && i.itemId);
    const acao: AcaoDeAssinatura = existente?.itemId
      ? { tipo: "alterar_quantidade", itemId: existente.itemId, quantidade: (existente.quantidade ?? 1) + quantidade }
      : { tipo: "adicionar_item", priceId, quantidade };

    try {
      const plano = await planejarAlteracao(assinatura.subscriptionId, acao);
      const r = await aplicarAlteracao(plano, acao, origem, `expansao:${opts.grupoId}:${priceId}`);
      faturaId = r.faturaId ?? faturaId;
      aplicados += 1;
    } catch (err) {
      const motivo = err instanceof ErroDeAlteracao ? err.message : String(err);
      /* Falha no meio: o que já entrou está cobrado e fica. Dizer quantos
         entraram é o que permite terminar à mão sem cobrar duas vezes. */
      // Boleto em aberto na assinatura não é falha: é espera, e o erro cru do
      // Stripe chegava à tela como JSON em inglês.
      const explicado = mensagemDeEsperaDeTerceiro(motivo);
      return { ok: false, error: aplicados > 0
        ? `${aplicados} item(ns) já foram adicionados à assinatura, mas o item do Price ${priceId} falhou: ${explicado}. Conclua o que falta em Cliente 360 › Assinaturas.`
        : explicado === motivo ? `Não foi possível alterar a assinatura: ${motivo}` : explicado };
    }
  }

  /* A fatura do pró-rata: o link para o cliente pagar e o estado dela.
     Com boleto — o meio da casa — a cobrança NÃO é instantânea: o Stripe
     emite e espera. Era aqui que eu errava: dava o grupo por pago assim que a
     fatura saía, e isso é ganho sem pagamento, contra a regra do projeto
     ("aceite não é ganho"). Agora quem decide é o estado da fatura. */
  let faturaUrl: string | null = null;
  let faturaPaga = false;
  if (faturaId) {
    const f = await stripe<{ hosted_invoice_url?: string | null; status?: string }>(`invoices/${faturaId}`)
      .catch((e) => { console.error("[expansao] não consegui ler a fatura do pró-rata:", e); return null; });
    faturaUrl = f?.hosted_invoice_url ?? null;
    faturaPaga = f?.status === "paid";
  }

  /* A fatura vira o pagamento DESTE grupo, registrada em `checkouts`.
     Não é burocracia: é por uma linha de `checkouts` que o webhook do Stripe
     encontra o negócio quando o cliente paga (`findCheckoutForBillingObject`
     procura por `stripe_invoice_id`). Sem ela, o pagamento do upgrade chegaria
     como órfão e o Ganho nunca sairia — e a tela não teria link nenhum para
     mostrar a quem comprou. */
  if (faturaUrl || faturaId) {
    const [linha] = await db.insert(checkouts).values({
      organizacaoId: opts.organizacaoId,
      propostaId: opts.propostaId,
      negocioId: opts.negocioId,
      grupoComercialId: opts.grupoId,
      origem: "automatico_pos_aceite",
      criadoPorId: opts.usuarioId ?? null,
      stripeSubscriptionId: assinatura.subscriptionId,
      stripeInvoiceId: faturaId,
      stripeCheckoutUrl: faturaUrl,
      status: faturaPaga ? "pago" : "aberto",
      paymentStatus: faturaPaga ? "confirmado" : "pendente",
      ...(faturaPaga ? { paidAt: new Date() } : {}),
    }).returning({ id: checkouts.id });
    if (linha) await vincularCheckoutAoGrupo(opts.grupoId, linha.id);
  }

  /* Pago de verdade (cartão, que debita na hora): fecha o grupo pelas portas
     de sempre, e `concluirGrupo` publica o evento que faz o serviço do cliente
     crescer. Em aberto (boleto): nada se conclui aqui — quem conclui é o
     webhook `invoice.paid`, pelo caminho que todo pagamento já percorre. */
  if (!faturaPaga) {
    await registrarPagamentoDoGrupo(opts.grupoId, "pendente");
    return { ok: true, subscriptionId: assinatura.subscriptionId, itensAplicados: aplicados, faturaId, faturaUrl };
  }
  await registrarPagamentoDoGrupo(opts.grupoId, "confirmado");
  await concluirGrupo(opts.grupoId);

  /* A evidência e o Ganho: aqui, não no webhook.
   *
   * O comentário acima conta a intenção — a linha de `checkouts` existe para o
   * webhook achar o negócio quando o pagamento chegar. Só que na fatura de
   * pró-rata paga NA HORA (cartão) ela já nasce `paid`, e o `invoice.paid`
   * dessa fatura não encontra a linha que ainda está sendo criada. Resultado
   * medido no Sicolos #1594 (23/10/2026): R$ 89,75 cobrados e confirmados no
   * cartão, grupo concluído, e a oportunidade sem evidência nenhuma, parada em
   * "proposta apresentada".
   *
   * O caminho do boleto continua com o webhook, que é quem sabe quando pagou. */
  if (opts.negocioId) {
    await registrarEvidencia({
      negocioId: opts.negocioId,
      organizacaoId: opts.organizacaoId,
      tipo: "stripe_subscription",
      sourceRef: faturaId ?? assinatura.subscriptionId,
      grupoComercialId: opts.grupoId,
      metadata: { origem: "expansao_assinatura", subscriptionId: assinatura.subscriptionId, faturaId },
    });
    await marcarNegocioGanhoSeAindaNao(opts.negocioId, opts.organizacaoId)
      .catch((e) => console.error(`[expansao] evidência registrada, mas o Ganho do negócio ${opts.negocioId} falhou (best-effort):`, e));
  }

  return { ok: true, subscriptionId: assinatura.subscriptionId, itensAplicados: aplicados, faturaId, faturaUrl };
}
