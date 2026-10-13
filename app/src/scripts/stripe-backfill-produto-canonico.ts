/**
 * Backfill de `servicos_canonicos.canonical_product`: troca nome de cliente / título de negócio / vazio
 * pelo NOME DO PRODUTO, pela regra única de `lib/integrations/stripe-produto-do-servico.ts`.
 *
 * Fonte do nome (nesta ordem): itens da assinatura no espelho do Stripe -> catálogo do ONFACE (oferta)
 * -> item da venda -> valor atual SE parecer produto -> nulo. Nunca inventa. Produto antigo, fora do
 * catálogo de hoje, aparece como o Stripe o chama.
 *
 * Garantias:
 *  - `--simular` é o padrão e não escreve nada.
 *  - `--aplicar` faz, numa ÚNICA transação: (1) cria a tabela de backup
 *    `servicos_canonicos_bkp_produto_<aaaammddhhmmss>` com as linhas que vai mexer, (2) atualiza só
 *    `canonical_product` e carimba `evidence.produto_canonico`. Se qualquer passo falha, nada fica.
 *  - Idempotente: depois de aplicado, rodar de novo dá 0 a alterar e NÃO cria backup.
 *  - Nunca sobrescreve valor bom por nulo, nem valor bom por outro valor bom.
 *  - Cada UPDATE confere `canonical_product IS NOT DISTINCT FROM <valor lido>` e `organizacao_id`:
 *    se a linha mudou entre a leitura e a escrita, ela é pulada e contada.
 *  - Só leitura no Stripe (GET /v1/products/{id}) para ids que o espelho guardou sem nome.
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/stripe-backfill-produto-canonico.ts              # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/stripe-backfill-produto-canonico.ts --aplicar    # ESCREVE no banco
 *   ... --json=/caminho/relatorio.json
 *
 * Modo offline (simulação sem banco): o SQL do dataset sai de `--imprimir-sql`; o resultado (uma linha
 * de JSON) alimenta `--de-json=arquivo`; `--stripe-nomes=arquivo` leva `{ "prod_x": "Nome" | null }` (null =
 * apagado) e `--nomes-de-fatura=arquivo` leva `{ "prod_x": "Nome" }` (já consolidado). O modo offline
 * nunca aplica.
 *
 * Produto apagado no Stripe: o nome vem das faturas (até 5 assinaturas por produto, a fatura mais recente
 * de cada) e só vale se pelo menos 2 assinaturas concordam e nenhuma discorda.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  consolidarNomesDeFatura,
  decidirProdutoDoServico,
  MARCA_AUTOMATICA,
  montarConhecimento,
  nomeDaDescricaoDeLinha,
  nomeDoItem,
  type Conhecimento,
  type Decisao,
  type ItemEspelho,
} from "../lib/integrations/stripe-produto-do-servico";

/* ── dataset ──────────────────────────────────────────────────────────── */

export interface ServicoLido {
  id: string;
  organizacaoId: string;
  familia: string;
  billingSource: string;
  canonicalKey: string;
  atual: string | null;
  subscriptionId: string | null;
  assinaturaNoEspelho: boolean;
  ofertaNome: string | null;
  itemDaVenda: string | null;
  empresaNomes: string[];
}

export interface Dataset {
  servicos: ServicoLido[];
  itens: Record<string, ItemEspelho[]>;
  catalogoProdutos: { organizacaoId: string; stripeProductId: string | null; nome: string }[];
  catalogoPrecos: { organizacaoId: string; stripePriceId: string | null; nome: string }[];
  nomesDoEspelho: { organizacaoId: string; nome: string }[];
}

export const SQL_DATASET = `
SELECT json_build_object(
  'servicos', (
    SELECT coalesce(json_agg(json_build_object(
      'id', s.id,
      'organizacaoId', s.organizacao_id,
      'familia', s.service_family,
      'billingSource', s.billing_source,
      'canonicalKey', s.canonical_key,
      'atual', s.canonical_product,
      'subscriptionId', s.current_subscription_id,
      'assinaturaNoEspelho', (s.current_subscription_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM assinaturas a WHERE a.stripe_subscription_id = s.current_subscription_id AND a.organizacao_id = s.organizacao_id)),
      'ofertaNome', (SELECT c.nome FROM ofertas_comerciais o JOIN servicos_catalogo c ON c.id = o.servico_catalogo_id
                      WHERE o.id = s.oferta_comercial_id AND o.organizacao_id = s.organizacao_id),
      'itemDaVenda', (SELECT oi.produto FROM oportunidade_itens oi
                       WHERE oi.servico_canonico_id = s.id AND oi.organizacao_id = s.organizacao_id AND coalesce(oi.produto, '') <> ''
                       ORDER BY oi.created_at LIMIT 1),
      'empresaNomes', (SELECT coalesce(json_agg(x.n), '[]'::json) FROM (
                         SELECT e.nome AS n FROM empresas e WHERE e.id = s.empresa_id AND e.organizacao_id = s.organizacao_id
                         UNION
                         SELECT trim(l.nome || ' ' || coalesce(l.sobrenome, '')) FROM leads l WHERE l.id = s.lead_id AND l.organizacao_id = s.organizacao_id
                       ) x WHERE x.n IS NOT NULL)
    ) ORDER BY s.created_at, s.id), '[]'::json)
    FROM servicos_canonicos s),
  'itens', (
    SELECT coalesce(json_object_agg(t.sub, t.arr), '{}'::json) FROM (
      SELECT a.stripe_subscription_id AS sub,
             json_agg(json_build_object(
               'produto', ai.produto, 'stripeProductId', ai.stripe_product_id, 'stripePriceId', ai.stripe_price_id,
               'quantidade', ai.quantidade, 'precoUnitario', ai.preco_unitario, 'status', ai.status
             ) ORDER BY ai.created_at, ai.id) AS arr
        FROM assinatura_itens ai JOIN assinaturas a ON a.id = ai.assinatura_id
       WHERE a.stripe_subscription_id IN (SELECT current_subscription_id FROM servicos_canonicos WHERE current_subscription_id IS NOT NULL)
       GROUP BY a.stripe_subscription_id) t),
  'catalogoProdutos', (SELECT coalesce(json_agg(json_build_object('organizacaoId', organizacao_id, 'stripeProductId', stripe_product_id, 'nome', nome)), '[]'::json) FROM servicos_catalogo),
  'catalogoPrecos', (SELECT coalesce(json_agg(json_build_object('organizacaoId', p.organizacao_id, 'stripePriceId', p.stripe_price_id, 'nome', c.nome)), '[]'::json)
                       FROM catalogo_precos p JOIN servicos_catalogo c ON c.id = p.servico_catalogo_id),
  'nomesDoEspelho', (SELECT coalesce(json_agg(json_build_object('organizacaoId', organizacao_id, 'nome', produto)), '[]'::json) FROM (
                       SELECT DISTINCT organizacao_id, produto FROM assinaturas WHERE produto IS NOT NULL
                       UNION
                       SELECT DISTINCT organizacao_id, produto FROM assinatura_itens WHERE produto IS NOT NULL) n)
)`;

/* ── plano (puro) ─────────────────────────────────────────────────────── */

export interface LinhaDoPlano extends Decisao {
  id: string;
  organizacaoId: string;
  familia: string;
  billingSource: string;
  canonicalKey: string;
}

export interface Plano {
  linhas: LinhaDoPlano[];
  produtosSemNome: string[];
}

function conhecimentoPorOrg(d: Dataset, stripeProdutos: Record<string, string | null>, nomesDeFatura: Record<string, string> = {}): Map<string, Conhecimento> {
  const orgs = new Set<string>([
    ...d.servicos.map((s) => s.organizacaoId),
    ...d.catalogoProdutos.map((c) => c.organizacaoId),
  ]);
  const mapa = new Map<string, Conhecimento>();
  for (const org of orgs) {
    mapa.set(org, montarConhecimento({
      catalogoProdutos: d.catalogoProdutos.filter((c) => c.organizacaoId === org).map((c) => ({ stripeProductId: c.stripeProductId, nome: c.nome })),
      catalogoPrecos: d.catalogoPrecos.filter((c) => c.organizacaoId === org).map((c) => ({ stripePriceId: c.stripePriceId, nome: c.nome })),
      nomesDoEspelho: d.nomesDoEspelho.filter((n) => n.organizacaoId === org).map((n) => n.nome),
      stripeProdutos,
      nomesDeFatura,
    }));
  }
  return mapa;
}

/** Ids de produto que o espelho guardou sem nome e que nem o catálogo resolve: candidatos à consulta ao Stripe. */
export function idsParaConsultar(d: Dataset): string[] {
  const k = conhecimentoPorOrg(d, {});
  const ids = new Set<string>();
  for (const s of d.servicos) {
    if (!s.subscriptionId || !s.assinaturaNoEspelho) continue;
    const conhecimento = k.get(s.organizacaoId)!;
    for (const i of d.itens[s.subscriptionId] ?? []) {
      if (i.status === "inactive") continue;
      const r = nomeDoItem(i, conhecimento);
      const id = i.stripeProductId || i.produto;
      if (r.nome === null && id && /^prod_/.test(id)) ids.add(id);
    }
  }
  return [...ids].sort();
}

export function planejar(d: Dataset, stripeProdutos: Record<string, string | null>, nomesDeFatura: Record<string, string> = {}): Plano {
  const k = conhecimentoPorOrg(d, stripeProdutos, nomesDeFatura);
  const linhas: LinhaDoPlano[] = d.servicos.map((s) => {
    const decisao = decidirProdutoDoServico({
      atual: s.atual,
      temAssinatura: !!s.subscriptionId,
      assinaturaNoEspelho: s.assinaturaNoEspelho,
      itens: s.subscriptionId ? (d.itens[s.subscriptionId] ?? []) : [],
      ofertaCatalogoNome: s.ofertaNome,
      itemDaVenda: s.itemDaVenda,
      empresaNomes: s.empresaNomes,
    }, k.get(s.organizacaoId)!);
    return { ...decisao, id: s.id, organizacaoId: s.organizacaoId, familia: s.familia, billingSource: s.billingSource, canonicalKey: s.canonicalKey };
  });
  return { linhas, produtosSemNome: idsParaConsultar(d).filter((id) => !(id in stripeProdutos)) };
}

/* ── relatório ────────────────────────────────────────────────────────── */

const contar = <T>(xs: T[], chave: (x: T) => string): [string, number][] => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

export function relatorio(d: Dataset, plano: Plano) {
  const alterar = plano.linhas.filter((l) => l.acao === "PREENCHER" || l.acao === "CORRIGIR" || l.acao === "LIMPAR");
  const porFamilia: Record<string, Record<string, number>> = {};
  for (const l of plano.linhas) {
    porFamilia[l.familia] ??= {};
    porFamilia[l.familia][l.acao] = (porFamilia[l.familia][l.acao] ?? 0) + 1;
  }
  const semResolver = plano.linhas.filter((l) => l.acao === "SEM_RESOLVER" || l.acao === "LIMPAR");
  const nomeado = plano.linhas.filter((l) => l.depois);
  return {
    total: plano.linhas.length,
    comProdutoAntes: plano.linhas.filter((l) => l.antes).length,
    comProdutoDepois: nomeado.length,
    porAcao: Object.fromEntries(contar(plano.linhas, (l) => l.acao)),
    porFamilia,
    aAlterar: alterar.length,
    fontes: Object.fromEntries(contar(plano.linhas.filter((l) => l.acao === "PREENCHER" || l.acao === "CORRIGIR"), (l) => l.fonte ?? "?")),
    ficamSemProduto: {
      total: plano.linhas.filter((l) => !l.depois).length,
      porMotivo: Object.fromEntries(contar(plano.linhas.filter((l) => !l.depois), (l) => (l.motivo ?? "?").split("|").pop()!)),
      porOrigem: Object.fromEntries(contar(plano.linhas.filter((l) => !l.depois), (l) => `${l.familia} / ${l.billingSource}`)),
    },
    comAssinatura: {
      servicos: d.servicos.filter((s) => s.subscriptionId).length,
      noEspelho: d.servicos.filter((s) => s.assinaturaNoEspelho).length,
    },
    idsDeProdutoSemNomeNoStripe: plano.produtosSemNome,
    semResolverPorFamiliaEOrigem: semResolver.length,
  };
}

function amostra(plano: Plano, n: number): LinhaDoPlano[] {
  // Variedade: primeiro todos os CORRIGIR (até metade), depois PREENCHER com produtos distintos.
  const corrigir = plano.linhas.filter((l) => l.acao === "CORRIGIR");
  const preencher = plano.linhas.filter((l) => l.acao === "PREENCHER");
  const escolhidas: LinhaDoPlano[] = [];
  const vistos = new Set<string>();
  for (const l of corrigir) { if (escolhidas.length >= Math.ceil(n / 2)) break; escolhidas.push(l); vistos.add(`${l.depois}`); }
  for (const l of preencher) { if (escolhidas.length >= n) break; if (vistos.has(`${l.depois}`)) continue; vistos.add(`${l.depois}`); escolhidas.push(l); }
  for (const l of preencher) { if (escolhidas.length >= n) break; if (!escolhidas.includes(l)) escolhidas.push(l); }
  return escolhidas;
}

/* ── execução ─────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const flag = (nome: string) => args.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const aplicar = args.includes("--aplicar");

function carimbo(d = new Date()): string {
  return d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

const linhasDe = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? [])) as T[];

async function carregarDoBanco(): Promise<Dataset> {
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const r = linhasDe<{ json_build_object: Dataset }>(await db.execute(sql.raw(SQL_DATASET)));
  return r[0].json_build_object;
}

async function nomesNoStripe(ids: string[]): Promise<Record<string, string | null>> {
  const { stripe } = await import("../lib/integrations/stripe-assinatura");
  const out: Record<string, string | null> = {};
  for (const id of ids) {
    try {
      const p = await stripe<{ id: string; name?: string; deleted?: boolean }>(`products/${id}`);
      out[id] = p.deleted ? null : (p.name ?? null);
    } catch (e) {
      // 404 "No such product" = apagado/inexistente: sem nome recuperável. Outro erro: não afirma nada.
      if (/HTTP 404/.test(String(e))) out[id] = null;
      else console.warn(`  aviso: não consegui ler ${id} no Stripe (${String(e).slice(0, 120)}); fica sem nome.`);
    }
  }
  return out;
}

/** Assinaturas (ids Stripe) que usam um produto, no máximo `limite`, em ordem estável. */
export function assinaturasDoProduto(d: Dataset, productId: string, limite = 5): string[] {
  const subs = new Set<string>();
  for (const s of d.servicos) {
    if (!s.subscriptionId) continue;
    if ((d.itens[s.subscriptionId] ?? []).some((i) => i.stripeProductId === productId)) subs.add(s.subscriptionId);
  }
  return [...subs].sort().slice(0, limite);
}

interface LinhaDeFaturaStripe { description?: string | null; price?: { product?: string | { id?: string } | null } | null; pricing?: { price_details?: { product?: string | null } | null } | null }

/** Para produtos apagados: lê a fatura mais recente de até 5 assinaturas deles (somente GET) e consolida o nome. */
async function nomesPelasFaturas(d: Dataset, apagados: string[]): Promise<Record<string, string>> {
  const { stripe } = await import("../lib/integrations/stripe-assinatura");
  const observacoes: { productId: string; nome: string; assinatura: string }[] = [];
  for (const productId of apagados) {
    for (const sub of assinaturasDoProduto(d, productId)) {
      try {
        const r = await stripe<{ data: { lines?: { data?: LinhaDeFaturaStripe[] } }[] }>(`invoices?subscription=${encodeURIComponent(sub)}&limit=1`);
        for (const l of r.data?.[0]?.lines?.data ?? []) {
          const pid = l.pricing?.price_details?.product ?? (typeof l.price?.product === "string" ? l.price.product : l.price?.product?.id);
          const nome = nomeDaDescricaoDeLinha(l.description);
          if (pid === productId && nome) observacoes.push({ productId, nome, assinatura: sub });
        }
      } catch (e) {
        console.warn(`  aviso: não consegui ler a fatura de ${sub} (${String(e).slice(0, 100)}).`);
      }
    }
  }
  return consolidarNomesDeFatura(observacoes);
}

async function gravar(plano: Plano): Promise<{ aplicadas: number; puladas: number; backup: string | null }> {
  const alterar = plano.linhas.filter((l) => l.acao === "PREENCHER" || l.acao === "CORRIGIR" || l.acao === "LIMPAR");
  if (alterar.length === 0) return { aplicadas: 0, puladas: 0, backup: null };

  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const lote = carimbo();
  const tabela = `servicos_canonicos_bkp_produto_${lote}`; // só dígitos: seguro como identificador
  let aplicadas = 0;
  let puladas = 0;

  await db.transaction(async (tx) => {
    const ids = sql.join(alterar.map((l) => sql`${l.id}::uuid`), sql`, `);
    await tx.execute(sql.raw(`CREATE TABLE ${tabela} AS SELECT id, organizacao_id, canonical_product, evidence, updated_at, now() AS backup_em, '${lote}'::text AS lote FROM servicos_canonicos WHERE false`));
    await tx.execute(sql`INSERT INTO ${sql.raw(tabela)} SELECT id, organizacao_id, canonical_product, evidence, updated_at, now(), ${lote}::text FROM servicos_canonicos WHERE id IN (${ids})`);
    for (const l of alterar) {
      const marca = JSON.stringify({ [MARCA_AUTOMATICA]: true, acao: l.acao, fonte: l.fonte, antes: l.antes, lote, regra: "stripe-produto-do-servico" });
      const r = await tx.execute(sql`
        UPDATE servicos_canonicos
           SET canonical_product = ${l.depois},
               evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object('produto_canonico', ${marca}::jsonb)
         WHERE id = ${l.id}::uuid AND organizacao_id = ${l.organizacaoId}::uuid
           AND canonical_product IS NOT DISTINCT FROM ${l.antes}
        RETURNING id`);
      if (linhasDe(r).length === 1) aplicadas++; else puladas++;
    }
  });
  return { aplicadas, puladas, backup: tabela };
}

async function main() {
  if (args.includes("--imprimir-sql")) { console.log(SQL_DATASET.trim()); return; }
  const deJson = flag("de-json");
  if (aplicar && args.includes("--simular")) { console.error("Use --simular OU --aplicar, não os dois."); process.exit(2); }
  if (aplicar && deJson) { console.error("--aplicar exige o banco; o modo --de-json é só simulação."); process.exit(2); }

  console.log(aplicar ? "MODO: APLICAR (escreve no banco, com backup)" : "MODO: SIMULAR (nada é escrito)");
  const dataset: Dataset = deJson ? JSON.parse(readFileSync(deJson, "utf8")) : await carregarDoBanco();
  console.log(`Serviços lidos: ${dataset.servicos.length}.`);

  let stripeProdutos: Record<string, string | null> = {};
  const arquivoNomes = flag("stripe-nomes");
  if (arquivoNomes) stripeProdutos = JSON.parse(readFileSync(arquivoNomes, "utf8"));
  else if (!deJson && !args.includes("--sem-stripe")) {
    const ids = idsParaConsultar(dataset);
    console.log(`Consultando ${ids.length} produto(s) no Stripe (somente leitura)...`);
    stripeProdutos = await nomesNoStripe(ids);
  }

  let nomesDeFatura: Record<string, string> = {};
  const arquivoFaturas = flag("nomes-de-fatura");
  if (arquivoFaturas) nomesDeFatura = JSON.parse(readFileSync(arquivoFaturas, "utf8"));
  else if (!deJson && !args.includes("--sem-stripe")) {
    const apagados = Object.entries(stripeProdutos).filter(([, v]) => v === null).map(([id]) => id);
    if (apagados.length) {
      console.log(`${apagados.length} produto(s) apagado(s) no Stripe: lendo o nome nas faturas (somente leitura)...`);
      nomesDeFatura = await nomesPelasFaturas(dataset, apagados);
    }
  }

  const plano = planejar(dataset, stripeProdutos, nomesDeFatura);
  const rel = relatorio(dataset, plano);
  console.log(JSON.stringify(rel, null, 2));

  const n = Number(flag("amostra") ?? 10);
  console.log(`\nAmostra ${n} antes -> depois:`);
  for (const l of amostra(plano, n)) console.log(`  [${l.acao}] ${l.familia} ${l.canonicalKey.slice(0, 28)}: ${JSON.stringify(l.antes)} -> ${JSON.stringify(l.depois)}  (${l.fonte}${l.motivo ? `; ${l.motivo}` : ""})`);
  console.log("\nVão virar nulo (nome de cliente/título sem substituto), até 12:");
  for (const l of plano.linhas.filter((x) => x.acao === "LIMPAR").slice(0, 12)) console.log(`  ${l.familia}: ${JSON.stringify(l.antes)} -> null  (${l.motivo})`);

  const saida = flag("json");
  if (saida) { writeFileSync(saida, JSON.stringify({ relatorio: rel, linhas: plano.linhas }, null, 2)); console.log("Relatório:", saida); }

  if (aplicar) {
    const r = await gravar(plano);
    console.log(`\nAPLICADO: ${r.aplicadas} linha(s) atualizada(s), ${r.puladas} pulada(s) por mudança concorrente.`);
    console.log(r.backup ? `Backup: tabela ${r.backup}` : "Nada a alterar: nenhum backup criado.");
  } else {
    console.log("\nSimulação concluída. Nada foi escrito.");
  }
}

// Só roda quando chamado como script (os testes importam `planejar`/`relatorio` sem executar).
if (process.argv[1] && /stripe-backfill-produto-canonico\.ts$/.test(process.argv[1])) {
  main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
