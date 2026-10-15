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
import { atorHumano, ehFamiliaValida, RegraDeNegocio, type Ator } from "@/lib/vendas/dominio";
import { lerFotoComercial, registrarAlteracaoComercial } from "@/lib/vendas/auditoria-comercial-registro";
import { FOTO_VAZIA } from "@/lib/vendas/auditoria-comercial";
import { calcularItens, validarDataValidade, validarMoeda } from "@/lib/crm/proposta-regras";
import { descricaoDoProduto, variacaoAmigavel } from "@/lib/catalogo/rotulos";

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
    periodo: string | null; descricaoProduto: string;
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
      periodo: catalogoPrecos.periodo,
      stripeProductId: servicosCatalogo.stripeProductId,
      serviceFamily: servicosCatalogo.serviceFamily,
      descricaoComercial: servicosCatalogo.descricaoComercial,
      descricaoStripe: servicosCatalogo.descricao,
    })
    .from(catalogoPrecos)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
    .where(inArray(catalogoPrecos.id, unicos));
  return new Map(rows.map(({ descricaoComercial, descricaoStripe, ...r }) => [r.id, {
    ...r, descricaoProduto: descricaoDoProduto({ comercial: descricaoComercial, stripe: descricaoStripe }),
  }]));
}

/**
 * UMA resolução de família comercial para toda a proposta: a do negócio, e na
 * falta dela a da oportunidade canônica (deduzida no backfill). A action de
 * criar, a de editar e este núcleo liam cada uma de um jeito (a action olhava só
 * `negocios.service_family`, e 128 oportunidades abertas só têm a da canônica).
 */
export async function resolverFamiliaDoNegocio(organizacaoId: string, negocioId: string): Promise<{ existe: boolean; familia: string | null }> {
  const [r] = await db.execute<{ service_family: string | null }>(sql`
    SELECT COALESCE(n.service_family, o.service_family) AS service_family
      FROM negocios n
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.id = ${negocioId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid
  `);
  return { existe: !!r, familia: r?.service_family ?? null };
}

/**
 * UMA resolução do contato que recebe a proposta, para criar e para editar.
 *
 * O contato é o da oportunidade ou o que o vendedor ESCOLHEU (`leadId`, da mesma
 * empresa). Nunca "o primeiro lead da empresa": isso mandava a proposta para a
 * pessoa errada. Sem contato na oportunidade, a empresa com um único contato não
 * é ambígua; com mais de um, a escolha é obrigatória.
 */
export async function resolverContatoDaProposta(opts: {
  organizacaoId: string; negocioId: string; leadId?: string | null;
}): Promise<string> {
  const [negocio] = await db.execute<{ lead_id: string | null; empresa_id: string | null }>(sql`
    SELECT lead_id::text, empresa_id::text FROM negocios
     WHERE id = ${opts.negocioId}::uuid AND organizacao_id = ${opts.organizacaoId}::uuid`);
  if (!negocio) throw new RegraDeNegocio("oportunidade_nao_encontrada", "Oportunidade não encontrada.");

  if (opts.leadId && opts.leadId !== negocio.lead_id) {
    // Oportunidade sem empresa: só vale o contato da própria oportunidade (sem empresa, "da mesma empresa" casaria com qualquer lead solto).
    const [ok] = negocio.empresa_id
      ? await db.execute<{ id: string }>(sql`
          SELECT id::text FROM leads
           WHERE id = ${opts.leadId}::uuid AND organizacao_id = ${opts.organizacaoId}::uuid
             AND empresa_id = ${negocio.empresa_id}::uuid`)
      : [];
    if (!ok) throw new RegraDeNegocio("contato_invalido", "O contato escolhido não pertence à empresa desta oportunidade.");
  }

  let leadId = opts.leadId ?? negocio.lead_id;
  if (!leadId && negocio.empresa_id) {
    const candidatos = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM leads
       WHERE empresa_id = ${negocio.empresa_id}::uuid AND organizacao_id = ${opts.organizacaoId}::uuid
       ORDER BY created_at LIMIT 2`);
    if (candidatos.length === 1) leadId = candidatos[0].id;
    else if (candidatos.length > 1) {
      throw new RegraDeNegocio(
        "proposta_exige_contato",
        "A oportunidade não tem contato definido e a empresa tem mais de um. Escolha o contato que recebe a proposta.",
        { rotulo: "Definir contato", tipo: "definir_contato" },
      );
    }
  }
  if (!leadId) {
    throw new RegraDeNegocio("proposta_exige_contato", "A oportunidade não tem contato vinculado para receber a proposta.", { rotulo: "Definir contato", tipo: "definir_contato" });
  }
  return leadId;
}

/**
 * Toda linha NOVA precisa de um Price oficial válido: existe, é da organização,
 * está ativo (e o produto pai também), tem a moeda da proposta e é da família
 * da oportunidade. O tipo (recorrente/avulso/setup) sai do Price, não do chamador.
 * Linha legada mantida (`itemExistenteId`) não passa por aqui.
 */
export async function padronizarItensPeloCatalogo<T extends ItemEntrada & { itemExistenteId?: string | null }>(
  opts: { organizacaoId: string; moeda: string; familia: string | null },
  itens: T[],
): Promise<T[]> {
  const novos = itens.filter((i) => !i.itemExistenteId);
  for (const i of novos) {
    if (!i.catalogoPrecoId) throw new RegraDeNegocio("item_sem_catalogo", `O item "${i.nome}" não veio do catálogo. Escolha o preço no catálogo.`);
  }
  const ids = [...new Set(novos.map((i) => i.catalogoPrecoId as string))];
  if (ids.length === 0) return itens;
  const rows = await db.execute<{
    id: string; organizacao_id: string; moeda: string; tipo: string; ativo: boolean; produto_ativo: boolean;
    service_family: string | null; produto: string; variacao: string;
  }>(sql`
    SELECT cp.id::text, cp.organizacao_id::text, cp.moeda, cp.tipo, COALESCE(cp.ativo, true) AS ativo,
           COALESCE(sc.ativo, true) AS produto_ativo, sc.service_family, sc.nome AS produto, cp.variacao
      FROM catalogo_precos cp JOIN servicos_catalogo sc ON sc.id = cp.servico_catalogo_id
     WHERE cp.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
  const porId = new Map(rows.map((r) => [r.id, r]));
  return itens.map((i) => {
    if (i.itemExistenteId) return i;
    const r = porId.get(i.catalogoPrecoId as string);
    if (!r || r.organizacao_id !== opts.organizacaoId) {
      throw new RegraDeNegocio("item_catalogo_inexistente", `O preço do item "${i.nome}" não existe no catálogo desta organização.`);
    }
    if (!r.ativo || !r.produto_ativo) {
      throw new RegraDeNegocio("item_catalogo_inativo", `"${r.produto} · ${r.variacao}" está inativo no catálogo. Escolha outro preço.`);
    }
    if (r.moeda !== opts.moeda) {
      throw new RegraDeNegocio("item_moeda_diferente", `"${r.produto} · ${r.variacao}" é em ${r.moeda}, e a proposta é em ${opts.moeda}.`);
    }
    if (ehFamiliaValida(opts.familia) && r.service_family !== opts.familia) {
      throw new RegraDeNegocio("item_de_outra_familia", "Há item de outra família. Use só o catálogo da família desta oportunidade.");
    }
    return { ...i, tipo: r.tipo as ItemEntrada["tipo"], nome: i.nome?.trim() ? i.nome : [r.produto, variacaoAmigavel(r.produto, r.variacao)].filter(Boolean).join(" · ") };
  });
}

/** Porta única antes de gravar linhas: catálogo, moeda, família e conta (subtotal/totais) validados juntos. */
export async function prepararItensDaProposta<T extends ItemEntrada & { itemExistenteId?: string | null }>(
  opts: { organizacaoId: string; moeda: string; negocioId: string | null },
  itens: T[],
) {
  const moeda = validarMoeda(opts.moeda);
  const familia = opts.negocioId ? (await resolverFamiliaDoNegocio(opts.organizacaoId, opts.negocioId)).familia : null;
  const padronizados = await padronizarItensPeloCatalogo({ organizacaoId: opts.organizacaoId, moeda, familia }, itens);
  return calcularItens(padronizados);
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
      // Última barreira: linha nova sem Price oficial não entra por nenhuma porta.
      if (!preco) throw new RegraDeNegocio("item_sem_catalogo", `O item "${item.nome}" não veio do catálogo. Escolha o preço no catálogo.`);
      const servicoCatalogoId = preco.servicoCatalogoId;
      return {
        propostaId,
        servicoCatalogoId: servicoCatalogoId || undefined,
        nome: item.nome,
        // A linha guarda a descrição do produto no momento da proposta (a comercial do ONFACE, senão a
        // do Stripe): é o que o cliente leu e aceitou, e não muda se o catálogo mudar depois.
        descricao: item.descricao?.trim() || preco.descricaoProduto || null,
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
        // Congelados com o resto: o aceite lê da linha, não do catálogo ao vivo.
        exigeContrato: preco?.exigeContrato,
        periodo: preco?.periodo,
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
  // A mesma cadeia de família do resto do módulo (negócio, depois oportunidade canônica).
  const { existe, familia } = await resolverFamiliaDoNegocio(opts.organizacaoId, opts.negocioId);
  if (!existe) {
    throw new RegraDeNegocio("oportunidade_nao_encontrada", "Oportunidade não encontrada.");
  }
  if (!ehFamiliaValida(familia)) {
    throw new RegraDeNegocio(
      "proposta_exige_familia",
      "Defina a família comercial antes de criar uma proposta.",
      { rotulo: "Definir família", tipo: "alterar_familia" },
    );
  }

  const moeda = validarMoeda(opts.moeda);
  const dataValidade = opts.dataValidade ? validarDataValidade(opts.dataValidade) : undefined;
  const { itens: itensWithCalc, totalRecorrente, totalAvulso } = await prepararItensDaProposta({ ...opts, moeda }, opts.itens);
  const today = new Date().toISOString().split("T")[0];

  // Proposta, número e linhas na MESMA transação: ou grava tudo ou nada.
  const proposta = await db.transaction(async (tx) => {
    const numero = await proximoNumeroDeProposta(tx, opts.organizacaoId);
    /* A empresa da proposta nasce resolvida, do negócio ou do lead.
       `propostas.empresa_id` nunca era gravado: a proposta saía órfã e a tela
       dizia "Empresa não vinculada" — e, pior, o gate de contrato lia a empresa
       pela proposta, não achava nada e listava TODOS os campos jurídicos como
       pendentes, inclusive os que a empresa já tinha preenchidos. Foi o caso da
       #1570 (LIVA HOTEIS, 15/10/2026): CNPJ e cidade estavam lá e a tela pedia
       os dois. 25 propostas abertas estavam assim. */
    const [vinculo] = await tx.execute(sql`
      SELECT COALESCE(n.empresa_id, l.empresa_id)::text AS empresa_id
        FROM (SELECT 1) z
        LEFT JOIN negocios n ON n.id = ${opts.negocioId ?? null}::uuid
        LEFT JOIN leads l ON l.id = ${opts.leadId ?? null}::uuid`) as unknown as Array<{ empresa_id: string | null }>;

    const [criada] = await tx.insert(propostas).values({
      organizacaoId: opts.organizacaoId,
      leadId: opts.leadId,
      negocioId: opts.negocioId,
      empresaId: vinculo?.empresa_id ?? null,
      numero,
      versao: 1,
      moeda,
      status: "rascunho",
      dataEmissao: today,
      dataValidade,
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
    await inserirItensDaProposta(tx, criada.id, moeda, itensWithCalc);
    // Auditoria: o que nasceu (itens, preços negociados, descontos) e quem criou, na mesma transação.
    await registrarAlteracaoComercial(tx, {
      organizacaoId: opts.organizacaoId, propostaId: criada.id, ator: atorHumano(opts.criadoPorId),
      antes: FOTO_VAZIA, depois: await lerFotoComercial(tx, opts.organizacaoId, criada.id),
      tipo: "ProposalCreated", contexto: { familia, itens: itensWithCalc.length },
    });
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
  /** `undefined` mantém o que está gravado; `null` limpa (parcelas volta a 1). */
  observacoes?: string | null;
  prazoContratoMeses?: number | null;
  parcelas?: number | null;
  /** Quem editou: a auditoria (de → para) sai em nome dele. Obrigatório, sem alteração sem autor. */
  ator: Ator;
  /** Motivo opcional da alteração; vai no registro. */
  motivo?: string | null;
  /** Contato que recebe a proposta. Ausente = mantém. */
  leadId?: string | null;
}) {
  if (opts.itens.length === 0) throw new RegraDeNegocio("proposta_sem_itens", "A proposta precisa de pelo menos um item.");
  const [previa] = await db.execute<{ negocio_id: string | null; moeda: string }>(sql`
    SELECT negocio_id::text, moeda FROM propostas
     WHERE id = ${opts.propostaId}::uuid AND organizacao_id = ${opts.organizacaoId}::uuid`);
  if (!previa) throw new RegraDeNegocio("proposta_nao_encontrada", "Proposta não encontrada.");
  // Valida tudo ANTES de abrir a transação ou apagar qualquer linha.
  const calc = (await prepararItensDaProposta(
    { organizacaoId: opts.organizacaoId, moeda: previa.moeda, negocioId: previa.negocio_id },
    opts.itens.map((item, idx) => ({ ...item, ordem: idx })),
  )).itens;
  const mantidos = calc.filter((i) => i.itemExistenteId);
  const novos = calc.filter((i) => !i.itemExistenteId);
  // Valida o contato escolhido antes de abrir a transação (mesma regra da criação).
  const novoContato = opts.leadId && previa.negocio_id
    ? await resolverContatoDaProposta({ organizacaoId: opts.organizacaoId, negocioId: previa.negocio_id, leadId: opts.leadId })
    : null;

  const negocioId = await db.transaction(async (tx) => {
    // FOR UPDATE: um envio simultâneo espera esta edição terminar (e vice-versa).
    const [p] = await tx.execute<{ status: string; negocio_id: string | null; moeda: string }>(sql`
      SELECT status, negocio_id::text, moeda FROM propostas
       WHERE id = ${opts.propostaId}::uuid AND organizacao_id = ${opts.organizacaoId}::uuid FOR UPDATE`);
    if (!p) throw new RegraDeNegocio("proposta_nao_encontrada", "Proposta não encontrada.");
    if (p.status !== "rascunho") {
      throw new RegraDeNegocio("proposta_nao_e_rascunho", "Só rascunho se edita. Para mudar uma proposta enviada, crie uma revisão.");
    }
    const antes = await lerFotoComercial(tx, opts.organizacaoId, opts.propostaId);

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
        observacoes = CASE WHEN ${opts.observacoes !== undefined} THEN ${opts.observacoes?.trim() || null} ELSE observacoes END,
        prazo_contrato_meses = CASE WHEN ${opts.prazoContratoMeses !== undefined} THEN ${opts.prazoContratoMeses ?? null}::int ELSE prazo_contrato_meses END,
        parcelas = CASE WHEN ${opts.parcelas !== undefined} THEN COALESCE(${opts.parcelas ?? null}::int, 1) ELSE parcelas END,
        lead_id = COALESCE(${novoContato}::uuid, lead_id),
        updated_at = now()
       WHERE id = ${opts.propostaId}::uuid`);
    // Auditoria na MESMA transação: a alteração e o registro dela existem juntos ou não existem.
    await registrarAlteracaoComercial(tx, {
      organizacaoId: opts.organizacaoId, propostaId: opts.propostaId, ator: opts.ator, motivo: opts.motivo,
      antes, depois: await lerFotoComercial(tx, opts.organizacaoId, opts.propostaId),
    });
    return p.negocio_id;
  });

  await sincronizarDepoisDoCommit(negocioId, opts.propostaId);
}
