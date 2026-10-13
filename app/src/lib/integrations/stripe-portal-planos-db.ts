/**
 * Lê o catálogo do ONFACE (banco) e confere com o Stripe, para a troca de plano do Portal.
 * A regra de quem entra está em `stripe-portal-planos.ts` (pura, com teste); aqui só há I/O.
 *
 * Multi-tenant: o catálogo é filtrado por `organizacao_id`, que vem de quem chama (a sessão no
 * servidor, ou o `--organizacao` do script) — nunca do cliente.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { catalogoPrecos, servicosCatalogo } from "../db/schema";
import {
  CATEGORIA_TROCA_DE_PLANO, resolverPlanosDoPortal, type PlanosResolvidos, type PrecoDoStripe, type ProdutoDoCatalogo, type ProdutoDoStripe,
} from "./stripe-portal-planos";

/** Leitura (GET) no Stripe, injetada: o portal e o script já têm a sua; este módulo não cria outra. */
export type LerStripe = <T>(caminho: string) => Promise<T>;

export async function lerCatalogoDoOnface(organizacaoId: string): Promise<ProdutoDoCatalogo[]> {
  const produtos = await db.select({
    id: servicosCatalogo.id, nome: servicosCatalogo.nome, stripeProductId: servicosCatalogo.stripeProductId, ativo: servicosCatalogo.ativo,
    tipo: servicosCatalogo.tipo, categoria: servicosCatalogo.categoria, origemCatalogo: servicosCatalogo.origemCatalogo, ordem: servicosCatalogo.ordem,
  }).from(servicosCatalogo).where(eq(servicosCatalogo.organizacaoId, organizacaoId));

  const precos = await db.select({
    servicoCatalogoId: catalogoPrecos.servicoCatalogoId, stripePriceId: catalogoPrecos.stripePriceId, ativo: catalogoPrecos.ativo, recorrente: catalogoPrecos.recorrente,
  }).from(catalogoPrecos).where(and(eq(catalogoPrecos.organizacaoId, organizacaoId)));

  return produtos.map((p) => ({
    nome: p.nome, stripeProductId: p.stripeProductId, ativo: p.ativo, tipo: p.tipo, categoria: p.categoria,
    origemCatalogo: p.origemCatalogo, ordem: p.ordem,
    precos: precos.filter((x) => x.servicoCatalogoId === p.id).map((x) => ({ stripePriceId: x.stripePriceId, ativo: x.ativo, recorrente: x.recorrente })),
  }));
}

/** Só consulta no Stripe os produtos que o catálogo já apontou como candidatos (poucos). */
export async function conferirComOStripe(catalogo: ProdutoDoCatalogo[], ler: LerStripe): Promise<PlanosResolvidos> {
  const candidatos = new Set(
    catalogo.filter((c) => c.categoria === CATEGORIA_TROCA_DE_PLANO && c.stripeProductId).map((c) => c.stripeProductId as string),
  );
  const produtosStripe: ProdutoDoStripe[] = [];
  const precosStripe: PrecoDoStripe[] = [];
  for (const id of candidatos) {
    try { produtosStripe.push(await ler<ProdutoDoStripe>(`products/${id}`)); } catch { /* produto sumiu: o resolver exclui com motivo */ }
    const lista = await ler<{ data: PrecoDoStripe[] }>(`prices?product=${encodeURIComponent(id)}&limit=100`);
    precosStripe.push(...(lista.data ?? []));
  }
  return resolverPlanosDoPortal({ catalogo, produtosStripe, precosStripe });
}

export async function resolverPlanosParaOrganizacao(organizacaoId: string, ler: LerStripe): Promise<PlanosResolvidos> {
  return conferirComOStripe(await lerCatalogoDoOnface(organizacaoId), ler);
}
