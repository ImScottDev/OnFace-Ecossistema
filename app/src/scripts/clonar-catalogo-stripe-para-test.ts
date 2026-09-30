/**
 * Clona o catálogo oficial existente no banco DEV para o Stripe TESTE.
 *
 * A origem desta operacao e o banco DEV, nao o Stripe live. Depois de criar
 * todos os Products/Prices no Stripe test, atualiza somente os IDs do DEV.
 * Se qualquer criacao falhar, o banco fica intocado.
 *
 * Uso: pnpm --filter ./app exec tsx --env-file=.env \
 *   src/scripts/clonar-catalogo-stripe-para-test.ts
 */
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/lib/db";
import { catalogoPrecos, servicosCatalogo } from "@/lib/db/schema";

const API = "https://api.stripe.com/v1";

function stripeKey(): string {
  const key = process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key?.includes("_test_")) throw new Error("Recusado: a clonagem do catálogo exige exclusivamente uma chave Stripe test.");
  return key;
}

function sourceDatabaseUrl(): string {
  const url = process.env.CATALOGO_SOURCE_DATABASE_URL;
  if (!url) throw new Error("CATALOGO_SOURCE_DATABASE_URL não definida: informe a base DEV que contém o catálogo oficial.");
  return url;
}

function append(form: URLSearchParams, key: string, value: string | number | boolean | null | undefined): void {
  if (value !== null && value !== undefined && String(value).trim() !== "") form.append(key, String(value));
}

async function stripePost<T>(key: string, path: string, form: URLSearchParams, idempotencyKey: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey.slice(0, 255),
    },
    body: form.toString(),
  });
  if (!response.ok) throw new Error(`Stripe ${path}: HTTP ${response.status} ${(await response.text()).slice(0, 500)}`);
  return response.json() as Promise<T>;
}

function familyMetadata(value: string): string {
  if (value === "CALLFACE_AI") return "callface_ai";
  if (value === "WHITE_LABEL") return "white_label";
  if (value === "PABX") return "pabx";
  return "unknown";
}

async function main(): Promise<void> {
  const key = stripeKey();
  const source = postgres(sourceDatabaseUrl(), { max: 1 });
  const services = await source<Array<Record<string, unknown> & { prices: Array<Record<string, unknown>> }>>`
    SELECT row_to_json(sc) AS service,
           COALESCE(json_agg(row_to_json(cp) ORDER BY cp.ordem, cp.created_at)
             FILTER (WHERE cp.id IS NOT NULL), '[]'::json) AS prices
      FROM servicos_catalogo sc
      LEFT JOIN catalogo_precos cp ON cp.servico_catalogo_id = sc.id
       AND cp.organizacao_id = sc.organizacao_id
     WHERE sc.origem_catalogo = 'oficial_stripe'
     GROUP BY sc.id
     ORDER BY sc.organizacao_id, sc.ordem, sc.nome
  `;
  await source.end({ timeout: 5 });
  if (services.length === 0) throw new Error("Recusado: DEV não possui produtos oficiais para clonar.");

  const officialAlreadyInTarget = await db.select({ id: servicosCatalogo.id }).from(servicosCatalogo)
    .where(eq(servicosCatalogo.origemCatalogo, "oficial_stripe")).limit(1);
  if (officialAlreadyInTarget.length > 0) throw new Error("Recusado: a base runtime já possui catálogo oficial; não vou duplicar catálogo por automação.");

  const mappings: Array<{ service: Record<string, unknown>; productId: string; prices: Array<{ source: Record<string, unknown>; stripePriceId: string }> }> = [];
  for (const row of services) {
    const service = row.service as Record<string, unknown>;
    const productForm = new URLSearchParams();
    append(productForm, "name", service.nome as string);
    append(productForm, "description", service.descricao as string | null);
    append(productForm, "unit_label", service.etiqueta_unidade as string | null);
    append(productForm, "metadata[onface_environment]", "dev_test");
    append(productForm, "metadata[onface_crm_service_id]", service.id as string);
    append(productForm, "metadata[familia]", familyMetadata(service.service_family as string));
    append(productForm, "metadata[categoria_crm]", service.categoria as string | null);
    append(productForm, "metadata[sku_interno]", service.sku_produto as string | null);
    append(productForm, "metadata[destino_pos_venda]", service.destino_pos_venda as string | null);
    append(productForm, "metadata[exige_contrato]", service.requer_contrato ? "sim" : "nao");
    const product = await stripePost<{ id: string }>(key, "products", productForm, `onface-dev-product-${service.id as string}`);

    const priceMappings: Array<{ source: Record<string, unknown>; stripePriceId: string }> = [];

    for (const price of row.prices) {
      const cents = Math.round(Number(price.valor) * 100);
      if (!Number.isFinite(cents) || cents < 0) throw new Error(`Preço inválido em '${service.nome as string} / ${price.variacao as string}'.`);
      const priceForm = new URLSearchParams();
      append(priceForm, "product", product.id);
      append(priceForm, "currency", (price.moeda as string).toLowerCase());
      append(priceForm, "unit_amount", cents);
      append(priceForm, "nickname", price.variacao as string);
      if (price.recorrente) append(priceForm, "recurring[interval]", price.periodo === "anual" ? "year" : "month");
      append(priceForm, "metadata[onface_environment]", "dev_test");
      append(priceForm, "metadata[onface_crm_catalog_price_id]", price.id as string);
      append(priceForm, "metadata[categoria_crm]", service.categoria as string | null);
      append(priceForm, "metadata[sku_interno]", price.sku as string | null);
      append(priceForm, "metadata[modelo_cobranca]", price.modelo_cobranca as string | null);
      append(priceForm, "metadata[exige_contrato]", price.exige_contrato ? "sim" : "nao");
      const created = await stripePost<{ id: string }>(key, "prices", priceForm, `onface-dev-price-${price.id as string}`);
      priceMappings.push({ source: price, stripePriceId: created.id });
    }
    mappings.push({ service, productId: product.id, prices: priceMappings });
  }

  await db.transaction(async (tx) => {
    for (const mapping of mappings) {
      const service = mapping.service;
      const serviceValues = {
        id: service.id as string,
        organizacaoId: service.organizacao_id as string,
        nome: service.nome as string,
        descricao: service.descricao as string | null,
        tipo: service.tipo as string,
        moeda: service.moeda as string,
        valorSugerido: service.valor_sugerido as string | null,
        unidade: service.unidade as string,
        stripeProductId: mapping.productId,
        categoria: service.categoria as string | null,
        serviceFamily: service.service_family as string,
        revenueNature: service.revenue_nature as string,
        requerContrato: service.requer_contrato as boolean,
        quantityBehavior: service.quantity_behavior as string,
        requiresSignature: service.requires_signature as boolean,
        requiresPaymentBeforeWon: service.requires_payment_before_won as boolean,
        createsCanonicalService: service.creates_canonical_service as boolean,
        createsFulfillment: service.creates_fulfillment as boolean,
        supportsUpgrade: service.supports_upgrade as boolean,
        supportsDowngrade: service.supports_downgrade as boolean,
        supportsProration: service.supports_proration as boolean,
        commercialModelPadrao: service.commercial_model_padrao as string,
        origemCatalogo: "oficial_stripe",
        skuProduto: service.sku_produto as string | null,
        descricaoExtrato: service.descricao_extrato as string | null,
        etiquetaUnidade: service.etiqueta_unidade as string | null,
        destinoPosVenda: service.destino_pos_venda as string | null,
        observacaoOperacional: service.observacao_operacional as string | null,
        catalogoSincronizadoEm: new Date(),
        ativo: service.ativo as boolean,
        ordem: service.ordem as number,
        createdAt: new Date(service.created_at as string),
      };
      const { id, createdAt, ...serviceUpdate } = serviceValues;
      await tx.insert(servicosCatalogo).values(serviceValues).onConflictDoUpdate({
        target: servicosCatalogo.id,
        set: serviceUpdate,
      });
      for (const price of mapping.prices) {
        const sourcePrice = price.source;
        await tx.insert(catalogoPrecos).values({
          id: sourcePrice.id as string,
          organizacaoId: sourcePrice.organizacao_id as string,
          servicoCatalogoId: sourcePrice.servico_catalogo_id as string,
          stripePriceId: price.stripePriceId,
          sku: sourcePrice.sku as string | null,
          lookupKey: sourcePrice.lookup_key as string | null,
          variacao: sourcePrice.variacao as string,
          descricao: sourcePrice.descricao as string | null,
          valor: sourcePrice.valor as string,
          moeda: sourcePrice.moeda as string,
          tipo: sourcePrice.tipo as string,
          recorrente: sourcePrice.recorrente as boolean,
          periodo: sourcePrice.periodo as string | null,
          revenueNature: sourcePrice.revenue_nature as string,
          modeloCobranca: sourcePrice.modelo_cobranca as string | null,
          modeloPrecoStripe: sourcePrice.modelo_preco_stripe as string | null,
          exigeContrato: sourcePrice.exige_contrato as boolean,
          observacao: sourcePrice.observacao as string | null,
          ativo: sourcePrice.ativo as boolean,
          ordem: sourcePrice.ordem as number,
          createdAt: new Date(sourcePrice.created_at as string),
          updatedAt: new Date(),
          ofertaComercialId: sourcePrice.oferta_comercial_id as string | null,
        });
      }
    }
  });

  console.log(JSON.stringify({
    ok: true,
    environment: "stripe_test",
    products: mappings.length,
    prices: mappings.reduce((total, mapping) => total + mapping.prices.length, 0),
    updatedOnlyIn: "dev_database",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
