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
import { assinaturas, assinaturaItens } from "@/lib/db/schema";
import { assinaturaDoCrm } from "@/lib/financeiro/espelho-crm";
import {
  planejarAlteracao,
  aplicarAlteracao,
  ErroDeAlteracao,
  type AcaoDeAssinatura,
} from "@/lib/integrations/stripe-assinatura-acoes";
import { registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { registrarPagamentoDoGrupo, concluirGrupo } from "@/lib/crm/grupo-comercial";

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
  | { ok: true; subscriptionId: string; itensAplicados: number; faturaId: string | null }
  | { ok: false; error: string };

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
export async function assinaturaUnicaDaEmpresa(
  organizacaoId: string,
  empresaId: string,
): Promise<{ ok: true; id: string; subscriptionId: string } | { ok: false; error: string }> {
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
    return { ok: false, error: "Esta venda altera uma assinatura existente, mas a empresa não tem assinatura ativa no CRM. Confira o cadastro antes de cobrar." };
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
}): Promise<ResultadoExpansao> {
  if (opts.itens.length === 0) return { ok: false, error: "Grupo de expansão sem item recorrente." };

  const descontado = itemComDescontoQueNaoPodeIr(opts.itens);
  if (descontado) {
    return { ok: false, error: `O item '${descontado.nome}' foi negociado abaixo do preço de tabela, e a alteração de assinatura cobraria o valor cheio. Conclua em Cliente 360 › Assinaturas aplicando o desconto combinado.` };
  }

  const assinatura = await assinaturaUnicaDaEmpresa(opts.organizacaoId, opts.empresaId);
  if (!assinatura.ok) return { ok: false, error: assinatura.error };

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
      return { ok: false, error: aplicados > 0
        ? `${aplicados} item(ns) já foram adicionados à assinatura, mas o item do Price ${priceId} falhou: ${motivo}. Conclua o que falta em Cliente 360 › Assinaturas.`
        : `Não foi possível alterar a assinatura: ${motivo}` };
    }
  }

  /* Chegou aqui: o Stripe aceitou com `error_if_incomplete`, ou seja, o
     proporcional foi cobrado de verdade. Então o grupo fecha pelas portas de
     sempre — `concluirGrupo` é quem publica FulfillmentGroupCompleted, e é
     esse evento que faz o serviço canônico do cliente crescer. Sem isto a
     cobrança aconteceria e a entrega ficaria parada. */
  await registrarPagamentoDoGrupo(opts.grupoId, "confirmado");
  await concluirGrupo(opts.grupoId);

  /* Ganho: a assinatura alterada É a evidência. `stripe_subscription` já é um
     tipo aceito pela política — não é exceção criada para a expansão, é o
     mesmo que o webhook grava quando um checkout vira assinatura. Sem isto o
     ganho nunca sairia: o caminho da alteração não cria `checkouts`, e é por
     uma linha de `checkouts` que o webhook encontra o negócio. */
  if (opts.negocioId) {
    await registrarEvidencia({
      negocioId: opts.negocioId,
      organizacaoId: opts.organizacaoId,
      tipo: "stripe_subscription",
      sourceRef: `expansao:${opts.grupoId}`,
      metadata: { subscriptionId: assinatura.subscriptionId, faturaId, itens: aplicados, propostaId: opts.propostaId },
      grupoComercialId: opts.grupoId,
    }).catch((e) => console.error("[expansao] falha ao registrar evidência:", e));
    await marcarNegocioGanhoSeAindaNao(opts.negocioId, opts.organizacaoId)
      .catch((e) => console.error("[expansao] falha ao marcar ganho:", e));
  }

  return { ok: true, subscriptionId: assinatura.subscriptionId, itensAplicados: aplicados, faturaId };
}
