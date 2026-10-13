/**
 * Sincroniza o catálogo comercial do Stripe para o CRM (SPEC §23).
 *
 * Substitui o import de snapshot. O motivo está medido: o snapshot commitado
 * veio de uma planilha de 02/09 e, em 21/09, **171 dos seus 213 preços já não
 * existiam no Stripe** e 13 novos tinham sido criados. Arquivo de catálogo
 * nasce velho; o Stripe é onde o preço é decidido e cobrado.
 *
 * ## A divisão de responsabilidade, que é o coração disto
 *
 * **O Stripe manda no que ele cobra:** nome, descrição, valor, moeda,
 * recorrência e situação. Sincronizar sobrescreve esses campos sempre, porque
 * divergir deles é cobrar diferente do que a tela promete.
 *
 * **O CRM manda no que ele decide:** ordem de exibição, comportamento de
 * quantidade e observação operacional. São escolhas de COMO VENDER, que o
 * Stripe não conhece. A sincronização nunca as sobrescreve — senão o ajuste
 * que alguém fez na tela some no próximo ciclo, que é o tipo de perda
 * silenciosa que este refactor passou o dia inteiro corrigindo.
 *
 * ## O que ela recusa fazer
 *
 * Não inventa classificação. A família vem da metadata do Stripe ou, na falta
 * dela, do prefixo do nome — que é regra explícita do produto, não palpite. A
 * categoria não tem regra equivalente: sem metadata, o produto entra como
 * PENDENTE e é nomeado no relatório, em vez de receber uma categoria parecida.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { CatalogoStripe, PrecoStripe, ProdutoStripe } from "@/lib/integrations/stripe-catalogo";

export interface Pendencia {
  produto: string;
  stripeProductId: string;
  oQueFalta: string;
}

export interface ResultadoSync {
  produtosCriados: number;
  produtosAtualizados: number;
  precosCriados: number;
  precosAtualizados: number;
  precosDesativados: number;
  pendencias: Pendencia[];
}

/**
 * Família pelo prefixo do nome.
 *
 * Regra dada pelo Kauã: no Stripe, tudo que começa com esses prefixos é o
 * catálogo novo. White Label é testado ANTES de Callface AI porque o nome dele
 * também começa com "Callface AI" — ordem trocada classificaria todo White
 * Label como CALLFACE_AI.
 */
export function familiaPeloNome(nome: string): string | null {
  if (nome.startsWith("Callface AI White Label - ")) return "WHITE_LABEL";
  if (nome.startsWith("Callface AI - ")) return "CALLFACE_AI";
  if (nome.startsWith("PABX - ")) return "PABX";
  return null;
}

const FAMILIA_DA_METADATA: Record<string, string> = {
  callface_ai: "CALLFACE_AI",
  white_label: "WHITE_LABEL",
  pabx: "PABX",
};

/** Natureza da receita, derivada do que o Stripe diz sobre o preço. */
export function naturezaDaReceita(preco: PrecoStripe, categoria: string | null): string {
  if (categoria === "hardware") return "HARDWARE";
  if (categoria === "setup") return "SETUP";
  if (categoria === "uso" || categoria === "minutos") return preco.recorrente ? "MRR" : "USAGE";
  return preco.recorrente ? "MRR" : "ONE_TIME";
}

/**
 * Período do price COM o `interval_count`: 3 meses é trimestral, não mensal (o MRR distorcia).
 * Contagem que não tem nome (a cada 2 meses) sai como `2_meses`/`2_anos`, nunca arredondada.
 */
export function periodoDoPreco(preco: PrecoStripe): string {
  if (!preco.recorrente) return "unico";
  const n = preco.intervaloContagem && preco.intervaloContagem > 0 ? preco.intervaloContagem : 1;
  if (preco.intervalo === "year") return n === 1 ? "anual" : `${n}_anos`;
  if (n === 1) return "mensal";
  return n === 3 ? "trimestral" : n === 6 ? "semestral" : `${n}_meses`;
}

const ROTULO_PERIODO: Record<string, string> = {
  unico: "Avulso", mensal: "Mensal", anual: "Anual", trimestral: "Trimestral", semestral: "Semestral",
};

/** Por que o price não pode entrar valendo um valor; null = tem valor unitário. Escalonado NUNCA vira 0,00. */
export function motivoSemValorUnitario(preco: PrecoStripe): string | null {
  if (preco.escalonado) return "escalonado (tiered)";
  if (preco.valorCentavos == null) return "sem unit_amount";
  return null;
}

/** `metadata.faixa_min/faixa_max` do price como inteiros. Presente e inválido = erro nomeado, nunca 0. */
export function faixaDoPreco(preco: PrecoStripe): { min: number | null; max: number | null; erro: string | null } {
  const ler = (v: string | undefined) => {
    if (v == null || v.trim() === "") return { n: null, ruim: false };
    const n = Number(v.trim());
    return Number.isInteger(n) && n >= 0 ? { n, ruim: false } : { n: null, ruim: true };
  };
  const a = ler(preco.metadata.faixa_min), b = ler(preco.metadata.faixa_max);
  if (a.ruim || b.ruim) return { min: null, max: null, erro: "metadata.faixa_min/faixa_max não é inteiro" };
  if ((a.n == null) !== (b.n == null)) return { min: null, max: null, erro: "metadata.faixa_min e faixa_max precisam vir juntas" };
  if (a.n != null && b.n != null && a.n > b.n) return { min: null, max: null, erro: "metadata.faixa_min maior que faixa_max" };
  return { min: a.n, max: b.n, erro: null };
}

export function tipoDoPreco(preco: PrecoStripe, categoria: string | null): string {
  if (categoria === "setup") return "setup";
  return preco.recorrente ? "recorrente" : "avulso";
}

/**
 * Como o preço aparece para quem monta a proposta.
 *
 * O apelido do Stripe é a primeira escolha porque foi escrito para humano. Sem
 * ele, o período (nunca o lookup_key cru, que é nome técnico) é melhor que campo
 * vazio numa lista de escolha.
 */
export function variacaoDoPreco(preco: PrecoStripe): string {
  if (preco.apelido?.trim()) return preco.apelido.trim();
  const p = periodoDoPreco(preco);
  return ROTULO_PERIODO[p] ?? p.replace("_", " ");
}

export function classificarProduto(p: ProdutoStripe): {
  familia: string | null; categoria: string | null; faltando: string[];
} {
  const faltando: string[] = [];
  const familia = FAMILIA_DA_METADATA[p.metadata.familia ?? ""] ?? familiaPeloNome(p.nome);
  if (!p.metadata.familia) {
    faltando.push(familia
      ? "metadata.familia (deduzida do prefixo do nome)"
      : "metadata.familia (sem prefixo conhecido: espelhado como UNKNOWN, fora do construtor de proposta)");
  }

  // A categoria não tem regra de nome. Sem metadata, fica pendente de verdade.
  const categoria = p.metadata.categoria_crm?.trim() || null;
  if (!categoria) faltando.push("metadata.categoria_crm");

  // Metadata deslocada: valor que claramente não pertence ao campo.
  if (categoria && ["Mensal", "Anual", "plano_mensal"].includes(categoria)) {
    faltando.push(`metadata.categoria_crm com valor de período ("${categoria}")`);
  }
  if (p.metadata.sku_interno === "nao" || p.metadata.exige_contrato === "plano") {
    faltando.push("metadata com campos trocados entre si");
  }
  return { familia, categoria, faltando };
}

export async function sincronizarCatalogoStripe(
  organizacaoId: string, catalogo: CatalogoStripe,
): Promise<ResultadoSync> {
  const r: ResultadoSync = {
    produtosCriados: 0, produtosAtualizados: 0,
    precosCriados: 0, precosAtualizados: 0, precosDesativados: 0, pendencias: [],
  };

  const idPorProduto = new Map<string, string>();

  for (const p of catalogo.produtos) {
    const { familia, categoria, faltando } = classificarProduto(p);
    if (faltando.length) {
      r.pendencias.push({ produto: p.nome, stripeProductId: p.id, oQueFalta: faltando.join("; ") });
    }

    const exigeContrato = p.metadata.exige_contrato === "sim";
    const [linha] = await db.execute<{ id: string; criado: boolean }>(sql`
      INSERT INTO servicos_catalogo (
        organizacao_id, stripe_product_id, nome, descricao, descricao_extrato,
        etiqueta_unidade, service_family, categoria, sku_produto, destino_pos_venda,
        requer_contrato, ativo, origem_catalogo, catalogo_sincronizado_em, tipo, moeda
      ) VALUES (
        ${organizacaoId}::uuid, ${p.id}, ${p.nome}, ${p.descricao}, ${p.descricaoExtrato},
        ${p.etiquetaUnidade}, ${familia ?? "UNKNOWN"}, ${categoria}, ${p.metadata.sku_interno ?? null},
        ${p.metadata.destino_pos_venda ?? null}, ${exigeContrato}, ${p.ativo},
        'oficial_stripe', now(), 'recorrente', 'BRL'
      )
      -- O predicado NAO e decoracao: idx_servicos_catalogo_stripe_product e
      -- indice PARCIAL (WHERE stripe_product_id IS NOT NULL), e sem repetir a
      -- condicao o Postgres nao o encontra e o INSERT falha em runtime. Ja
      -- aconteceu neste projeto; ha trava em db/on-conflict.test.ts.
      ON CONFLICT (organizacao_id, stripe_product_id) WHERE stripe_product_id IS NOT NULL
      DO UPDATE SET
        -- O Stripe manda nestes: divergir deles e cobrar diferente do que a tela diz.
        nome = EXCLUDED.nome,
        descricao = EXCLUDED.descricao,
        descricao_extrato = EXCLUDED.descricao_extrato,
        etiqueta_unidade = EXCLUDED.etiqueta_unidade,
        service_family = EXCLUDED.service_family,
        categoria = EXCLUDED.categoria,
        sku_produto = EXCLUDED.sku_produto,
        destino_pos_venda = EXCLUDED.destino_pos_venda,
        requer_contrato = EXCLUDED.requer_contrato,
        ativo = EXCLUDED.ativo,
        origem_catalogo = 'oficial_stripe',
        catalogo_sincronizado_em = now()
        -- ordem, quantity_behavior e observacao_operacional NAO entram aqui:
        -- sao decisao do CRM sobre como vender, e sobrescreve-las faria o
        -- ajuste de quem organizou a tela sumir no proximo ciclo.
      RETURNING id::text, (xmax = 0) AS criado`);

    idPorProduto.set(p.id, linha.id);
    if (linha.criado) r.produtosCriados++; else r.produtosAtualizados++;
  }

  for (const preco of catalogo.precos) {
    const servicoId = idPorProduto.get(preco.produtoId);
    if (!servicoId) continue;
    const produto = catalogo.produtos.find((x) => x.id === preco.produtoId)!;
    const { categoria } = classificarProduto(produto);
    const catPreco = preco.metadata.categoria_crm?.trim() || categoria;

    // Price escalonado (ou sem unit_amount) não tem valor unitário: gravar 0,00 o deixaria vendável
    // de graça. Vira pendência e fica FORA do construtor (inativo) até alguém resolver. Mesma regra
    // do portal de planos (ehPrecoEscalonado).
    const semValor = motivoSemValorUnitario(preco);
    if (semValor || preco.valorCentavos == null) {
      r.pendencias.push({
        produto: produto.nome, stripeProductId: produto.id,
        oQueFalta: `price ${preco.id} ${semValor}: sem valor unitário, fora do construtor de proposta até ser resolvido`,
      });
      await db.execute(sql`
        UPDATE catalogo_precos SET ativo = false, updated_at = now()
         WHERE organizacao_id = ${organizacaoId}::uuid AND stripe_price_id = ${preco.id} AND ativo = true`);
      continue;
    }
    const faixa = faixaDoPreco(preco);
    if (faixa.erro) {
      r.pendencias.push({ produto: produto.nome, stripeProductId: produto.id, oQueFalta: `price ${preco.id}: ${faixa.erro}` });
    }
    // A família é do produto; price que declara outra não é aplicado em silêncio.
    const famPreco = FAMILIA_DA_METADATA[preco.metadata.familia ?? ""];
    if (famPreco && classificarProduto(produto).familia !== famPreco) {
      r.pendencias.push({ produto: produto.nome, stripeProductId: produto.id, oQueFalta: `price ${preco.id}: metadata.familia (${famPreco}) diverge da família do produto` });
    }

    const [linha] = await db.execute<{ criado: boolean }>(sql`
      INSERT INTO catalogo_precos (
        organizacao_id, servico_catalogo_id, stripe_price_id, sku, lookup_key,
        variacao, descricao, valor, moeda, tipo, recorrente, periodo,
        revenue_nature, modelo_cobranca, exige_contrato, ativo,
        intervalo_contagem, faixa_min, faixa_max
      ) VALUES (
        ${organizacaoId}::uuid, ${servicoId}::uuid, ${preco.id},
        ${preco.metadata.sku_interno ?? preco.lookupKey ?? null}, ${preco.lookupKey},
        ${variacaoDoPreco(preco)}, ${preco.apelido},
        ${(preco.valorCentavos / 100).toFixed(2)}, ${preco.moeda},
        ${tipoDoPreco(preco, catPreco)}, ${preco.recorrente}, ${periodoDoPreco(preco)},
        ${naturezaDaReceita(preco, catPreco)},
        ${preco.metadata.modelo_cobranca ?? produto.metadata.modelo_cobranca ?? null},
        ${(preco.metadata.exige_contrato ?? produto.metadata.exige_contrato) === "sim"},
        ${preco.ativo},
        ${preco.recorrente ? (preco.intervaloContagem ?? 1) : null}, ${faixa.min}, ${faixa.max}
      )
      ON CONFLICT (organizacao_id, stripe_price_id) DO UPDATE SET
        servico_catalogo_id = EXCLUDED.servico_catalogo_id,
        sku = EXCLUDED.sku,
        lookup_key = EXCLUDED.lookup_key,
        variacao = EXCLUDED.variacao,
        descricao = EXCLUDED.descricao,
        valor = EXCLUDED.valor,
        moeda = EXCLUDED.moeda,
        tipo = EXCLUDED.tipo,
        recorrente = EXCLUDED.recorrente,
        periodo = EXCLUDED.periodo,
        revenue_nature = EXCLUDED.revenue_nature,
        modelo_cobranca = EXCLUDED.modelo_cobranca,
        exige_contrato = EXCLUDED.exige_contrato,
        ativo = EXCLUDED.ativo,
        intervalo_contagem = EXCLUDED.intervalo_contagem,
        faixa_min = EXCLUDED.faixa_min,
        faixa_max = EXCLUDED.faixa_max,
        updated_at = now()
        -- ordem e observacao ficam de fora pelo mesmo motivo do produto.
      RETURNING (xmax = 0) AS criado`);
    if (linha.criado) r.precosCriados++; else r.precosAtualizados++;
  }

  // GUARDA: catálogo vazio NUNCA desativa nada.
  //
  // O `NOT IN` abaixo, com a lista vazia, é verdadeiro para toda linha — medido
  // no banco de dev em 22/09: desativaria **55 de 55** preços, o catálogo
  // comercial inteiro. E `lerCatalogoDoStripe` devolve vazio sem lançar em pelo
  // menos três caminhos: a conta responde 200 com `data: []` (chave de outro
  // ambiente, produtos arquivados); `ehProdutoDeCatalogo` deixa de casar porque
  // alguém renomeou os produtos no Stripe; ou os preços não casam mais nenhum
  // produto que passou no filtro anterior. Nenhum deles é exceção.
  //
  // Com o `catalogo-stripe-sync` rodando de hora em hora no worker, o efeito é
  // o construtor de proposta abrir vazio e ninguém conseguir vender — e o
  // próprio procedimento de virada nomeia esse sintoma no passo 8.
  //
  // Catálogo vazio não é "o Stripe não tem mais nada para vender": é leitura
  // que falhou. Desativar tudo com base nela transforma uma falha de leitura em
  // perda de operação.
  if (catalogo.precos.length === 0) {
    r.pendencias.push({
      produto: "(catálogo inteiro)", stripeProductId: "-",
      oQueFalta: "o Stripe não devolveu nenhum preço; desativação em massa recusada",
    });
    return r;
  }

  // Preço que sumiu do Stripe por completo vira INATIVO, nunca apagado:
  // proposta histórica aponta para ele, e apagar quebraria o que já foi vendido.
  // O array vai como JSON e volta a ser lista dentro do Postgres.
  //
  // Interpolar um array direto no template do postgres.js produz um `record`, e
  // `record::text[]` nao existe: o UPDATE falha em runtime com 42846. Passar
  // JSON e expandir com `jsonb_array_elements_text` contorna sem depender de
  // como o driver serializa array naquela versao.
  const idsVivos = JSON.stringify(catalogo.precos.map((p) => p.id));

  // A guarda de catálogo vazio cobre o caso catastrófico; esta cobre o caso
  // ruidoso, que é o mesmo defeito em escala menor. Uma leitura parcial — página
  // que faltou, filtro de nome que passou a casar metade — some com metade do
  // que a equipe vende, e sem isto some em silêncio, uma linha de log no meio
  // de um job de hora em hora. Contar ANTES é o que permite recusar.
  const [{ n: alvos }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM catalogo_precos
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND ativo = true AND stripe_price_id IS NOT NULL
       AND stripe_price_id NOT IN (SELECT jsonb_array_elements_text(${idsVivos}::jsonb))`);
  const [{ n: ativos }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM catalogo_precos
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND ativo = true AND stripe_price_id IS NOT NULL`);

  // Metade do catálogo saindo de uma vez é evento de operação, não rotina de
  // sincronização. O sync recusa e nomeia o número; desativar em massa fica
  // para quem decidir isso de propósito.
  if (ativos > 0 && alvos > ativos / 2) {
    r.pendencias.push({
      produto: "(desativação em massa)", stripeProductId: "-",
      oQueFalta: `o Stripe deixaria ${alvos} de ${ativos} preços ativos de fora; recusado por suspeita de leitura parcial`,
    });
    return r;
  }

  const desativados = await db.execute<{ id: string }>(sql`
    UPDATE catalogo_precos SET ativo = false, updated_at = now()
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND ativo = true
       AND stripe_price_id IS NOT NULL
       AND stripe_price_id NOT IN (
         SELECT jsonb_array_elements_text(${idsVivos}::jsonb))
    RETURNING id::text`);
  r.precosDesativados = desativados.length;

  return r;
}
