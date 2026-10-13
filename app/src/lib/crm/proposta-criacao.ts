/**
 * Núcleo de criação de proposta — extraído de POST /propostas pra ser
 * reutilizável tanto no caminho normal (1 negócio, 1 proposta) quanto no
 * caminho multi-linha (ADR-EXEC-022, lib/crm/oportunidade-bundle.ts), que
 * chama esta função N vezes (uma por negócio-irmão).
 */
import { db } from "@/lib/db";
import { eq, sql, inArray } from "drizzle-orm";
import { propostas, propostaItens, catalogoPrecos, servicosCatalogo } from "@/lib/db/schema";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { syncOportunidadeItensFromProposta, resolverServiceFamiliesPorCatalogoIds, mapTipoParaRevenueNature } from "@/lib/crm/composicao-comercial";
import { resolverCommercialModelPadraoPorCatalogoIds, resolverCommercialModelDoItem } from "@/lib/crm/commercial-model";
import { ehFamiliaValida, RegraDeNegocio } from "@/lib/vendas/dominio";
import { calcularItens } from "@/lib/crm/proposta-regras";

export interface ItemEntrada {
  servicoCatalogoId?: string | null;
  nome: string;
  /** Item nunca preenchido volta do banco como null — o PATCH manda esse null
   *  de volta e ele precisa atravessar (fix de produção 85102d8). */
  descricao?: string | null;
  tipo: "recorrente" | "avulso" | "setup";
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  descontoTipo: "percentual" | "valor";
  ordem?: number;
  commercialModel?: string;
  /**
   * Catálogo Oficial Stripe (02/09) — o PRICE oficial escolhido. O CRM lê o
   * price direto do banco (nunca confia no valor/família que o cliente
   * mandou): `valorUnitario` é o que foi NEGOCIADO, `valorTabela` vem do
   * catálogo. É isso que faz desconto não virar produto/price novo.
   */
  catalogoPrecoId?: string | null;
}

/**
 * Lê os prices oficiais escolhidos, com o produto pai. Fonte da verdade de
 * família, natureza de receita, SKU e preço de tabela — o front manda apenas
 * o id do price.
 */
async function carregarPrecosOficiais(ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((v): v is string => !!v))];
  if (unicos.length === 0) return new Map<string, {
    id: string; servicoCatalogoId: string; stripePriceId: string; stripeProductId: string | null; sku: string | null;
    variacao: string; valor: string; serviceFamily: string; revenueNature: string; exigeContrato: boolean;
  }>();
  const rows = await db
    .select({
      id: catalogoPrecos.id,
      servicoCatalogoId: catalogoPrecos.servicoCatalogoId,
      stripePriceId: catalogoPrecos.stripePriceId,
      sku: catalogoPrecos.sku,
      variacao: catalogoPrecos.variacao,
      valor: catalogoPrecos.valor,
      revenueNature: catalogoPrecos.revenueNature,
      exigeContrato: catalogoPrecos.exigeContrato,
      stripeProductId: servicosCatalogo.stripeProductId,
      serviceFamily: servicosCatalogo.serviceFamily,
    })
    .from(catalogoPrecos)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
    .where(inArray(catalogoPrecos.id, unicos));
  return new Map(rows.map((r) => [r.id, r]));
}

type ItemCalculado = ItemEntrada & { subtotal: number; ordem: number };
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Próximo número da organização: contador atômico (a linha fica travada até o
 * commit, então dois criadores simultâneos nunca recebem o mesmo número).
 * Sem linha ainda, parte do maior número existente. Chamar DENTRO da transação.
 */
export async function proximoNumeroDeProposta(tx: Tx, organizacaoId: string): Promise<number> {
  const [r] = await tx.execute<{ ultimo_numero: number }>(sql`
    INSERT INTO proposta_sequencias (organizacao_id, ultimo_numero)
    VALUES (${organizacaoId}::uuid, COALESCE((SELECT max(numero) FROM propostas WHERE organizacao_id = ${organizacaoId}::uuid), 0) + 1)
    ON CONFLICT (organizacao_id) DO UPDATE SET ultimo_numero = proposta_sequencias.ultimo_numero + 1
    RETURNING ultimo_numero`);
  return Number(r.ultimo_numero);
}

/** Efeitos derivados (valor do negócio, itens da oportunidade): recomputáveis, rodam só depois do commit e falha deles não desfaz a proposta já gravada. */
async function sincronizarDepoisDoCommit(negocioId: string | null, propostaId: string) {
  try {
    if (negocioId) await syncNegocioValoresFromPropostas(negocioId);
    await syncOportunidadeItensFromProposta(propostaId);
  } catch (e) {
    console.error(`[proposta-criacao] proposta ${propostaId} gravada, mas a sincronização derivada falhou (recomputável):`, e);
  }
}

/** Grava as linhas da proposta amarradas ao catálogo oficial. Uma porta só: criar e editar rascunho. */
export async function inserirItensDaProposta(tx: Tx, propostaId: string, moeda: string, itensWithCalc: ItemCalculado[]) {
  if (itensWithCalc.length === 0) return;
  // Catálogo Oficial Stripe (02/09) — carrega os prices escolhidos DO BANCO.
  // Nunca confia no que o cliente mandou pra família/natureza/preço de
  // tabela: o front manda só o `catalogoPrecoId`, o resto é lido aqui.
  const precoMap = await carregarPrecosOficiais(itensWithCalc.map((i) => i.catalogoPrecoId));
  // Um price oficial também é a fonte do produto pai. Sem isso a proposta
  // fica com o price, mas sem `servico_catalogo_id`; o checkout posterior
  // não consegue carregar o Stripe Product e falha no fim da venda.
  const servicosCatalogoIds = itensWithCalc.map((item) =>
    (item.catalogoPrecoId ? precoMap.get(item.catalogoPrecoId)?.servicoCatalogoId : undefined)
    ?? item.servicoCatalogoId,
  );
  const familyMap = await resolverServiceFamiliesPorCatalogoIds(servicosCatalogoIds);
  const commercialModelMap = await resolverCommercialModelPadraoPorCatalogoIds(servicosCatalogoIds);
  await tx.insert(propostaItens).values(
    itensWithCalc.map((item) => {
      const preco = item.catalogoPrecoId ? precoMap.get(item.catalogoPrecoId) : undefined;
      const servicoCatalogoId = preco?.servicoCatalogoId ?? item.servicoCatalogoId;
      return {
        propostaId,
        servicoCatalogoId: servicoCatalogoId || undefined,
        nome: item.nome,
        descricao: item.descricao,
        tipo: item.tipo,
        moeda,
        quantidade: item.quantidade.toString(),
        valorUnitario: item.valorUnitario.toFixed(2),
        desconto: item.desconto.toFixed(2),
        descontoTipo: item.descontoTipo,
        subtotal: item.subtotal.toFixed(2),
        ordem: item.ordem,
        // Família e natureza do PRICE oficial quando existe (é ele que
        // declara), com o catálogo do produto como fallback pro legado.
        serviceFamily: preco?.serviceFamily || (servicoCatalogoId ? familyMap.get(servicoCatalogoId) || "UNKNOWN" : "UNKNOWN"),
        revenueNature: preco?.revenueNature || mapTipoParaRevenueNature(item.tipo),
        commercialModel: resolverCommercialModelDoItem({ overrideExplicito: item.commercialModel, servicoCatalogoId, catalogoDefaultMap: commercialModelMap }),
        // Rastreabilidade oficial: imutável, não sofre desconto.
        catalogoPrecoId: preco?.id,
        stripeProductId: preco?.stripeProductId,
        stripePriceId: preco?.stripePriceId,
        skuPreco: preco?.sku,
        variacao: preco?.variacao,
        valorTabela: preco?.valor,
      };
    })
  );
}

export async function criarPropostaComItens(opts: {
  organizacaoId: string;
  leadId: string;
  negocioId: string;
  moeda: string;
  observacoes?: string;
  condicoesPagamento?: string;
  condicaoPagamentoTipo?: string;
  parcelas?: number;
  vencimentoDias?: number;
  prazoContratoMeses?: number | null;
  /** Dias de teste antes da primeira cobrança. Ausente = sem teste. */
  trialDias?: number | null;
  dataValidade?: string;
  signatarios?: Array<{ nome: string; email: string; papel?: string; ordem?: number }>;
  itens: ItemEntrada[];
  criadoPorId: string;
}) {
  // Esta é a última fronteira antes de persistir uma proposta. A UI e o
  // pipeline já orientam o usuário, mas outros chamadores deste núcleo não
  // podem criar uma proposta para uma oportunidade ainda sem família.
  /* A MESMA cadeia de família que o resto do módulo usa.
   *
   * Lia só `negocios.service_family`, e 128 das 536 oportunidades abertas têm
   * a família apenas na oportunidade canônica, deduzida no backfill. O efeito
   * era cruel: o cartão mostrava "Callface AI", o Builder mostrava "Definido
   * pela oportunidade", e ao salvar o command dizia para definir a família que
   * já estava ali.
   *
   * `pipeline.carregarOportunidade` e `consultas.ts` já resolviam assim; esta
   * era a única porta que olhava um lado só. */
  const [negocio] = await db.execute<{ service_family: string | null }>(sql`
    SELECT COALESCE(n.service_family, o.service_family) AS service_family
      FROM negocios n
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.id = ${opts.negocioId}::uuid
       AND n.organizacao_id = ${opts.organizacaoId}::uuid
  `);
  if (!negocio) {
    throw new RegraDeNegocio("oportunidade_nao_encontrada", "Oportunidade não encontrada.");
  }
  if (!ehFamiliaValida(negocio.service_family)) {
    throw new RegraDeNegocio(
      "proposta_exige_familia",
      "Defina a família comercial antes de criar uma proposta.",
      { rotulo: "Definir família", tipo: "alterar_familia" },
    );
  }

  const { itens: itensWithCalc, totalRecorrente, totalAvulso } = calcularItens(opts.itens);
  const today = new Date().toISOString().split("T")[0];

  // Proposta, número e linhas na MESMA transação: ou grava tudo ou nada.
  const proposta = await db.transaction(async (tx) => {
    const numero = await proximoNumeroDeProposta(tx, opts.organizacaoId);
    const [criada] = await tx.insert(propostas).values({
      organizacaoId: opts.organizacaoId,
      leadId: opts.leadId,
      negocioId: opts.negocioId,
      numero,
      versao: 1,
      moeda: opts.moeda,
      status: "rascunho",
      dataEmissao: today,
      dataValidade: opts.dataValidade || undefined,
      observacoes: opts.observacoes,
      condicoesPagamento: opts.condicoesPagamento,
      condicaoPagamentoTipo: opts.condicaoPagamentoTipo,
      parcelas: opts.parcelas ?? 1,
      vencimentoDias: opts.vencimentoDias,
      prazoContratoMeses: opts.prazoContratoMeses ?? undefined,
      trialDias: opts.trialDias ?? null,
      signatarios: opts.signatarios,
      totalRecorrente: totalRecorrente.toFixed(2),
      totalAvulso: totalAvulso.toFixed(2),
      totalGeral: (totalRecorrente + totalAvulso).toFixed(2),
      criadoPorId: opts.criadoPorId,
    }).returning();
    await inserirItensDaProposta(tx, criada.id, opts.moeda, itensWithCalc);
    return criada;
  });

  await sincronizarDepoisDoCommit(opts.negocioId, proposta.id);

  return { ...proposta, numeroFormatado: `#P-${String(proposta.numero).padStart(3, "0")}-v1` };
}


/**
 * Edita as linhas de um RASCUNHO.
 *
 * Linha com `itemExistenteId` (proposta legada, sem preço no catálogo) é mantida
 * e só tem quantidade, valor e desconto atualizados; linha nova entra pelo
 * catálogo; o que ficou de fora sai. Os totais são recalculados do que ficou.
 */
export async function atualizarItensDoRascunho(opts: {
  organizacaoId: string;
  propostaId: string;
  itens: Array<ItemEntrada & { itemExistenteId?: string | null }>;
  observacoes?: string | null;
  prazoContratoMeses?: number | null;
  parcelas?: number | null;
}) {
  if (opts.itens.length === 0) throw new RegraDeNegocio("proposta_sem_itens", "A proposta precisa de pelo menos um item.");
  // Valida tudo ANTES de abrir a transação ou apagar qualquer linha.
  const calc = calcularItens(opts.itens.map((item, idx) => ({ ...item, ordem: idx }))).itens;
  const mantidos = calc.filter((i) => i.itemExistenteId);
  const novos = calc.filter((i) => !i.itemExistenteId);

  const negocioId = await db.transaction(async (tx) => {
    // FOR UPDATE: um envio simultâneo espera esta edição terminar (e vice-versa).
    const [p] = await tx.execute<{ status: string; negocio_id: string | null; moeda: string }>(sql`
      SELECT status, negocio_id::text, moeda FROM propostas
       WHERE id = ${opts.propostaId}::uuid AND organizacao_id = ${opts.organizacaoId}::uuid FOR UPDATE`);
    if (!p) throw new RegraDeNegocio("proposta_nao_encontrada", "Proposta não encontrada.");
    if (p.status !== "rascunho") {
      throw new RegraDeNegocio("proposta_nao_e_rascunho", "Só rascunho se edita. Para mudar uma proposta enviada, crie uma revisão.");
    }

    // oportunidade_itens aponta para proposta_itens (FK RESTRICT): soltar antes de apagar.
    if (p.negocio_id) {
      const { limparOportunidadeItensDeOrigemProposta } = await import("@/lib/crm/composicao-comercial");
      await limparOportunidadeItensDeOrigemProposta(p.negocio_id, tx);
    }
    const ids = mantidos.map((i) => i.itemExistenteId as string);
    const fora = ids.length ? sql`AND id NOT IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})` : sql``;
    await tx.execute(sql`DELETE FROM proposta_itens WHERE proposta_id = ${opts.propostaId}::uuid ${fora}`);
    for (const i of mantidos) {
      await tx.execute(sql`
        UPDATE proposta_itens SET quantidade = ${i.quantidade}, valor_unitario = ${i.valorUnitario},
               desconto = ${i.desconto}, desconto_tipo = ${i.descontoTipo}, subtotal = ${i.subtotal}, ordem = ${i.ordem}
         WHERE id = ${i.itemExistenteId}::uuid AND proposta_id = ${opts.propostaId}::uuid`);
    }
    await inserirItensDaProposta(tx, opts.propostaId, p.moeda, novos);

    await tx.execute(sql`
      UPDATE propostas SET
        total_recorrente = COALESCE((SELECT sum(subtotal) FROM proposta_itens WHERE proposta_id = ${opts.propostaId}::uuid AND tipo = 'recorrente'), 0),
        total_avulso = COALESCE((SELECT sum(subtotal) FROM proposta_itens WHERE proposta_id = ${opts.propostaId}::uuid AND tipo <> 'recorrente'), 0),
        total_geral = COALESCE((SELECT sum(subtotal) FROM proposta_itens WHERE proposta_id = ${opts.propostaId}::uuid), 0),
        observacoes = COALESCE(${opts.observacoes ?? null}, observacoes),
        prazo_contrato_meses = COALESCE(${opts.prazoContratoMeses ?? null}::int, prazo_contrato_meses),
        parcelas = COALESCE(${opts.parcelas ?? null}::int, parcelas),
        updated_at = now()
       WHERE id = ${opts.propostaId}::uuid`);
    return p.negocio_id;
  });

  await sincronizarDepoisDoCommit(negocioId, opts.propostaId);
}
