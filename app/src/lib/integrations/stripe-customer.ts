/**
 * Customer canônico ÚNICO por empresa (stripe-onface-definicao §2, §13, §14).
 *
 * Toda criação de checkout, fatura e portal passa por aqui para obter o
 * Customer do Stripe. Antes cada caminho resolvia sozinho — o checkout achava
 * por e-mail (e podia pegar Customer do SaaS Callface, que divide esta conta
 * Stripe), a fatura e o portal liam `leads`/`empresas` sem conferir nada — e o
 * resultado foi empresa com 2, 3 Customers.
 *
 * Ordem de busca, parando no primeiro que existe e serve:
 *   1. `empresas.stripe_customer_id`
 *   2. `billing_identities` (provider 'stripe' em qualquer caixa)
 *   3. `leads.stripe_customer_id` do contato
 *   4. assinatura do espelho da empresa (viva primeiro)
 *   5. Stripe, por metadata de empresa (`empresaId`, `crm_company_id`, ...)
 *   6. Stripe, por CNPJ em metadata (`crm_cnpj`, `cnpj`)
 *   7. Stripe, por e-mail — SÓ se o Customer não for do SaaS (nem na metadata,
 *      nem em alguma assinatura) e não for de outra empresa
 *   8. cria
 * Os quatro primeiros são o ONFACE dizendo quem é o Customer; só se nenhum
 * existir o Stripe é consultado. Cada candidato é conferido no Stripe antes de
 * ser usado: apagado ou do SaaS é descartado, nunca cobrado.
 *
 * O que se acha ou cria é gravado de volta (`empresas`, `leads` se vazio e
 * `billing_identities`), e a metadata de identidade que faltar no Customer é
 * ADICIONADA (nunca sobrescrita, nunca removida).
 *
 * Clique duplo e reenvio: tudo acontece dentro de um advisory lock por empresa
 * (a 2ª chamada espera a 1ª e já enxerga o vínculo gravado) e a criação usa
 * Idempotency-Key estável por empresa — que cobre o caso de o processo cair
 * entre criar no Stripe e gravar no banco.
 *
 * Por que a busca por metadata é só o passo 5 e o e-mail usa `customers?email=`
 * em vez de search: o search do Stripe indexa com atraso (normalmente < 1 min,
 * em incidente até 1 h). Para o Customer recém-criado quem garante é o banco +
 * a chave de idempotência; o search serve ao Customer antigo.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { assinaturas, billingIdentities, empresas, leads } from "../db/schema";
import { CHAVES_DE_EMPRESA, idsDaMetadataStripe, metadataFaltante, metadataStripe } from "../crm/metadata-comercial";
import { normalizeCnpj, normalizeEmail } from "./billing-identity";
import { getStripeCheckoutMode, type StripeCheckoutMode } from "./stripe-checkout";
import { stripe } from "./stripe-assinatura";
import { ehDoSaas } from "./stripe-assinatura-acoes";

/* ── O que se sabe de um Customer ──────────────────────────────────────── */

export interface CustomerStripe {
  id: string;
  deleted?: boolean;
  email?: string | null;
  name?: string | null;
  created?: number;
  metadata?: Record<string, string> | null;
}

/**
 * Metadata que só o SaaS Callface grava no Customer (`user_name`/`user_cnpj`/
 * `user_cpf` nos 235 que existem; os ids são a mesma convenção das assinaturas
 * do SaaS). A conta Stripe é COMPARTILHADA: Customer com qualquer uma destas
 * chaves não é nosso e nunca é cobrado, atualizado ou vinculado.
 */
export const MARCAS_SAAS_CUSTOMER = ["user_name", "user_cnpj", "user_cpf", "user_id", "organization_id", "plan_id"] as const;

export function ehCustomerDoSaas(c: Pick<CustomerStripe, "metadata">): boolean {
  return MARCAS_SAAS_CUSTOMER.some((k) => !!c.metadata?.[k]?.trim());
}

export interface CandidatoCustomer {
  id: string;
  created?: number;
  /** Assinaturas vivas (ativa, em teste, em atraso) — quando se sabe. */
  assinaturasVivas?: number;
  /** O Customer é o que `empresas.stripe_customer_id` já aponta. */
  vinculadoNaEmpresa?: boolean;
}

/**
 * O canônico entre candidatos já filtrados: quem tem assinatura viva, depois
 * quem a empresa já aponta, depois o MAIS ANTIGO (duas rodadas convergem para o
 * mesmo Customer em vez de alternarem), depois o id (desempate estável).
 */
export function escolherCanonico<T extends CandidatoCustomer>(candidatos: T[]): T | null {
  return [...candidatos].sort((a, b) =>
    (b.assinaturasVivas ?? 0) - (a.assinaturasVivas ?? 0)
    || Number(!!b.vinculadoNaEmpresa) - Number(!!a.vinculadoNaEmpresa)
    || (a.created ?? Infinity) - (b.created ?? Infinity)
    || a.id.localeCompare(b.id),
  )[0] ?? null;
}

/** Ids de teste/mock só valem no modo deles; em live, só id real. */
export function idCompativelComModo(id: string, modo: StripeCheckoutMode): boolean {
  if (modo === "mock") return id.startsWith("cus_mock_");
  if (modo === "test") return id.startsWith("cus_test_");
  return !id.startsWith("cus_test_") && !id.startsWith("cus_mock_");
}

/* ── As portas (banco e Stripe) — trocáveis nos testes ─────────────────── */

export type MetodoCustomer = "empresa" | "identidade" | "lead" | "espelho" | "metadata" | "cnpj" | "email" | "criado" | "mock";

export interface GravacaoCustomer {
  organizacaoId: string;
  empresaId?: string | null;
  leadId?: string | null;
  customerId: string;
  metodo: MetodoCustomer;
  email?: string | null;
  cnpj?: string | null;
}

export interface VinculosCustomer {
  daEmpresa(organizacaoId: string, empresaId: string): Promise<string | null>;
  daIdentidade(organizacaoId: string, empresaId: string | null, leadId: string | null): Promise<string | null>;
  doLead(organizacaoId: string, leadId: string): Promise<string | null>;
  doEspelho(organizacaoId: string, empresaId: string): Promise<string | null>;
  gravar(g: GravacaoCustomer): Promise<void>;
}

export interface PortaBanco {
  /** Roda `fn` com exclusão mútua por `chave` e os vínculos na mesma transação. */
  serializar<T>(chave: string, fn: (v: VinculosCustomer) => Promise<T>): Promise<T>;
}

export interface PortaStripe {
  /** `null` quando o Customer não existe mais (404 ou apagado). */
  ler(id: string): Promise<CustomerStripe | null>;
  /** `customers/search` com a query pronta. */
  buscar(query: string): Promise<CustomerStripe[]>;
  porEmail(email: string): Promise<CustomerStripe[]>;
  assinaturasDoCustomer(id: string): Promise<{ metadata?: Record<string, string> | null }[]>;
  criar(form: URLSearchParams, chaveIdempotencia: string): Promise<CustomerStripe>;
  completarMetadata(id: string, faltantes: Record<string, string>): Promise<void>;
}

export interface PortasCustomer {
  modo(): StripeCheckoutMode;
  banco: PortaBanco;
  stripe: PortaStripe;
}

/* ── Banco real ─────────────────────────────────────────────────────────── */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const VIVA = sql`('active','trialing','past_due','unpaid')`;

function vinculosDoBanco(tx: Tx): VinculosCustomer {
  return {
    async daEmpresa(organizacaoId, empresaId) {
      const [r] = await tx.select({ id: empresas.stripeCustomerId }).from(empresas)
        .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, organizacaoId))).limit(1);
      return r?.id ?? null;
    },

    async daIdentidade(organizacaoId, empresaId, leadId) {
      const dono: SQL[] = [];
      if (empresaId) dono.push(sql`coalesce(${billingIdentities.empresaId}, ${billingIdentities.canonicalEmpresaId}) = ${empresaId}`);
      if (leadId) dono.push(sql`coalesce(${billingIdentities.leadId}, ${billingIdentities.canonicalLeadId}) = ${leadId}`);
      if (!dono.length) return null;
      /* provider chegou 'STRIPE' da carga e o código antigo consultava 'stripe':
         compara sem caixa. A identidade da EMPRESA vence a do contato. */
      const [r] = await tx
        .select({ id: sql<string | null>`coalesce(${billingIdentities.canonicalStripeCustomerId}, ${billingIdentities.externalCustomerId})` })
        .from(billingIdentities)
        .where(and(
          eq(billingIdentities.organizacaoId, organizacaoId),
          sql`upper(${billingIdentities.provider}) = 'STRIPE'`,
          sql`(${billingIdentities.status} IS NULL OR ${billingIdentities.status} IN ('CONFIRMED', 'PROBABLE'))`,
          or(...dono),
        ))
        .orderBy(
          sql`(coalesce(${billingIdentities.empresaId}, ${billingIdentities.canonicalEmpresaId}) IS NOT DISTINCT FROM ${empresaId}) desc`,
          billingIdentities.createdAt,
        )
        .limit(1);
      return r?.id ?? null;
    },

    async doLead(organizacaoId, leadId) {
      const [r] = await tx.select({ id: leads.stripeCustomerId }).from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, organizacaoId))).limit(1);
      return r?.id ?? null;
    },

    async doEspelho(organizacaoId, empresaId) {
      const [r] = await tx.select({ id: assinaturas.stripeCustomerId }).from(assinaturas)
        .where(and(eq(assinaturas.organizacaoId, organizacaoId), eq(assinaturas.empresaId, empresaId), isNotNull(assinaturas.stripeCustomerId)))
        .orderBy(sql`(${assinaturas.status} IN ${VIVA}) desc`, desc(assinaturas.createdAt))
        .limit(1);
      return r?.id ?? null;
    },

    async gravar(g) {
      const agora = new Date();
      if (g.empresaId) {
        await tx.update(empresas).set({ stripeCustomerId: g.customerId, updatedAt: agora })
          .where(and(eq(empresas.id, g.empresaId), eq(empresas.organizacaoId, g.organizacaoId), sql`${empresas.stripeCustomerId} IS DISTINCT FROM ${g.customerId}`));
      }
      if (g.leadId) {
        await tx.update(leads).set({ stripeCustomerId: g.customerId, updatedAt: agora })
          .where(and(eq(leads.id, g.leadId), eq(leads.organizacaoId, g.organizacaoId), isNull(leads.stripeCustomerId)));
      }

      /* billing_identities: a MESMA linha por (org, provider sem caixa, customer).
         A constraint única inclui canonical_lead_id, que é NULL em boa parte das
         linhas e então não protege nada — por isso o select antes do insert,
         dentro do lock. */
      const confianca = g.metodo === "cnpj" || g.metodo === "email" ? "PROBABLE" : "CONFIRMED";
      const [existente] = await tx.select({ id: billingIdentities.id }).from(billingIdentities)
        .where(and(
          eq(billingIdentities.organizacaoId, g.organizacaoId),
          sql`upper(${billingIdentities.provider}) = 'STRIPE'`,
          eq(billingIdentities.externalCustomerId, g.customerId),
        )).limit(1);
      if (existente) {
        await tx.update(billingIdentities).set({
          empresaId: sql`coalesce(${billingIdentities.empresaId}, ${g.empresaId ?? null}::uuid)`,
          canonicalEmpresaId: sql`coalesce(${billingIdentities.canonicalEmpresaId}, ${g.empresaId ?? null}::uuid)`,
          leadId: sql`coalesce(${billingIdentities.leadId}, ${g.leadId ?? null}::uuid)`,
          canonicalStripeCustomerId: sql`coalesce(${billingIdentities.canonicalStripeCustomerId}, ${g.customerId})`,
          updatedAt: agora,
        }).where(eq(billingIdentities.id, existente.id));
        return;
      }
      const email = normalizeEmail(g.email);
      await tx.insert(billingIdentities).values({
        id: randomUUID(),
        organizacaoId: g.organizacaoId,
        provider: "STRIPE",
        externalCustomerId: g.customerId,
        canonicalStripeCustomerId: g.customerId,
        empresaId: g.empresaId ?? null,
        canonicalEmpresaId: g.empresaId ?? null,
        leadId: g.leadId ?? null,
        canonicalLeadId: g.leadId ?? null,
        emails: email ? [email] : [],
        primaryEmailNormalized: email,
        cnpjNormalized: normalizeCnpj(g.cnpj),
        confidence: confianca,
        status: confianca,
        evidence: { metodo: g.metodo, origem: "stripe-customer", em: agora.toISOString() },
      });
    },
  };
}

const bancoReal: PortaBanco = {
  serializar: (chave, fn) => db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${chave}, 0))`);
    return fn(vinculosDoBanco(tx));
  }),
};

/* ── Stripe real ────────────────────────────────────────────────────────── */

/** Aspas da search query do Stripe: o valor vem de fora, então escapa. */
const aspas = (v: string) => `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

const stripeReal: PortaStripe = {
  async ler(id) {
    try {
      const c = await stripe<CustomerStripe>(`customers/${encodeURIComponent(id)}`);
      return c.deleted ? null : c;
    } catch (err) {
      if (/HTTP 404/.test(String(err))) return null;
      throw err;
    }
  },
  async buscar(query) {
    const r = await stripe<{ data: CustomerStripe[] }>(`customers/search?limit=100&query=${encodeURIComponent(query)}`);
    return r.data ?? [];
  },
  async porEmail(email) {
    const r = await stripe<{ data: CustomerStripe[] }>(`customers?limit=100&email=${encodeURIComponent(email)}`);
    return r.data ?? [];
  },
  async assinaturasDoCustomer(id) {
    const r = await stripe<{ data: { metadata?: Record<string, string> | null }[] }>(
      `subscriptions?limit=100&status=all&customer=${encodeURIComponent(id)}`,
    );
    return r.data ?? [];
  },
  criar: (form, chave) => stripe<CustomerStripe>("customers", form, chave),
  async completarMetadata(id, faltantes) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(faltantes)) form.append(`metadata[${k}]`, v.slice(0, 500));
    const assinatura = Object.keys(faltantes).sort().join(",");
    await stripe(`customers/${encodeURIComponent(id)}`, form, `onface-customer-meta-${id}-${assinatura}`);
  },
};

export const PORTAS_REAIS: PortasCustomer = { modo: getStripeCheckoutMode, banco: bancoReal, stripe: stripeReal };

/* ── O resolver ─────────────────────────────────────────────────────────── */

export interface EntradaCustomer {
  organizacaoId: string;
  empresaId?: string | null;
  leadId?: string | null;
  nome: string;
  email?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: { line1?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null };
  /** Metadata comercial completa do momento; só entra se o Customer for CRIADO agora. */
  metadata?: Record<string, string>;
}

export interface ResultadoCustomer {
  id: string;
  mocked: boolean;
  metodo: MetodoCustomer;
  /** O que foi descartado ou não deu para completar — vai para o log de quem chamou. */
  avisos: string[];
}

const maskCnpj = (d: string) => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
const consulta = (chaves: readonly string[], valores: string[]) =>
  chaves.flatMap((k) => valores.map((v) => `metadata['${k}']:${aspas(v)}`)).join(" OR ");

async function resolver(e: EntradaCustomer, criar: boolean, p: PortasCustomer, leitura = false): Promise<ResultadoCustomer | null> {
  const alvo = e.empresaId ?? e.leadId;
  if (!alvo) throw new Error("Sem empresa nem contato: não há a quem vincular o Customer do Stripe.");
  const modo = p.modo();
  const avisos: string[] = [];
  const empresaId = e.empresaId?.toLowerCase() ?? null;
  const cnpj = normalizeCnpj(e.cnpj);
  /* Modo leitura (portal): Customer do SaaS Callface serve como ÚLTIMO recurso. Fica na reserva enquanto
     houver Customer do ONFACE; a reserva nunca grava no banco nem completa metadata no Stripe. */
  const reserva: { c: CustomerStripe; metodo: MetodoCustomer }[] = [];
  const identidade = metadataStripe({ organizacaoId: e.organizacaoId, empresaId, cnpj });

  return p.banco.serializar(`stripe-customer:${e.empresaId ?? `lead:${e.leadId}`}`, async (v) => {
    const adotar = async (c: CustomerStripe, metodo: MetodoCustomer): Promise<ResultadoCustomer> => {
      if (metodo !== "criado" && modo !== "mock") {
        // Só completa se o Customer não declara outra empresa: dois donos na mesma metadata é pior que nenhum.
        const dono = idsDaMetadataStripe(c.metadata).empresaId;
        const faltam = !dono || dono === empresaId ? metadataFaltante(c.metadata, identidade) : {};
        if (Object.keys(faltam).length) {
          await p.stripe.completarMetadata(c.id, faltam)
            .catch((err) => avisos.push(`metadata não completada em ${c.id}: ${String(err).slice(0, 160)}`));
        }
      }
      await v.gravar({ organizacaoId: e.organizacaoId, empresaId: e.empresaId, leadId: e.leadId, customerId: c.id, metodo, email: e.email, cnpj: e.cnpj });
      return { id: c.id, mocked: modo === "mock", metodo, avisos };
    };

    /* 1-4: o ONFACE já sabe qual é. Confere no Stripe antes de confiar. */
    const locais: [MetodoCustomer, () => Promise<string | null>][] = [
      ["empresa", async () => (e.empresaId ? v.daEmpresa(e.organizacaoId, e.empresaId) : null)],
      ["identidade", () => v.daIdentidade(e.organizacaoId, e.empresaId ?? null, e.leadId ?? null)],
      ["lead", async () => (e.leadId ? v.doLead(e.organizacaoId, e.leadId) : null)],
      ["espelho", async () => (e.empresaId ? v.doEspelho(e.organizacaoId, e.empresaId) : null)],
    ];
    const vistos = new Set<string>();
    for (const [metodo, ler] of locais) {
      const id = await ler();
      if (!id || vistos.has(id) || !idCompativelComModo(id, modo)) continue;
      vistos.add(id);
      if (modo === "mock") return adotar({ id }, metodo);
      const c = await p.stripe.ler(id);
      if (!c) { avisos.push(`${id} (${metodo}) não existe mais no Stripe: descartado`); continue; }
      if (ehCustomerDoSaas(c)) {
        if (leitura) { reserva.push({ c, metodo }); avisos.push(`${id} (${metodo}) é Customer do SaaS Callface: só entra se não houver outro`); }
        else avisos.push(`${id} (${metodo}) é Customer do SaaS Callface: descartado`);
        continue;
      }
      const dono = idsDaMetadataStripe(c.metadata).empresaId;
      if (dono && empresaId && dono !== empresaId) avisos.push(`${id} (${metodo}) está marcado como da empresa ${dono}`);
      return adotar(c, metodo);
    }

    if (modo === "mock") {
      if (!criar) return null;
      return adotar({ id: `cus_mock_${alvo}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80) }, "mock");
    }

    /* 5-7: o Stripe. Um candidato só serve se não é apagado, não é do SaaS e
       não declara outra empresa. */
    const servePara = (metodo: MetodoCustomer) => (c: CustomerStripe) => {
      if (c.deleted || !idCompativelComModo(c.id, modo)) return false;
      const dono = idsDaMetadataStripe(c.metadata).empresaId;
      if (dono && empresaId && dono !== empresaId) return false;
      if (!ehCustomerDoSaas(c)) return true;
      if (leitura) reserva.push({ c, metodo });
      return false;
    };
    const porMetadata = async () => {
      const q = e.empresaId ? consulta(CHAVES_DE_EMPRESA, [e.empresaId.toLowerCase(), e.empresaId]) : consulta(["crm_lead_id"], [e.leadId!]);
      return escolherCanonico((await p.stripe.buscar(q)).filter(servePara("metadata")));
    };

    const achadoMeta = await porMetadata();
    if (achadoMeta) return adotar(achadoMeta, "metadata");

    if (cnpj) {
      const q = consulta(["crm_cnpj", "cnpj"], [cnpj, maskCnpj(cnpj)]);
      const achado = escolherCanonico((await p.stripe.buscar(q)).filter(servePara("cnpj")));
      if (achado) return adotar(achado, "cnpj");
    }

    const email = normalizeEmail(e.email);
    if (email) {
      /* Cliente do SaaS usa o mesmo e-mail do contato do ONFACE com frequência;
         pegar o Customer dele seria cobrar (e ter o nome/endereço reescritos
         pelo Checkout) num objeto que não é nosso. Além da metadata, olha as
         assinaturas: Customer do SaaS sem metadata ainda tem assinatura do SaaS. */
      for (const c of (await p.stripe.porEmail(email)).filter(servePara("email")).sort((a, b) => (a.created ?? 0) - (b.created ?? 0))) {
        const subs = await p.stripe.assinaturasDoCustomer(c.id);
        if (subs.some((s) => ehDoSaas(s.metadata ?? undefined))) { avisos.push(`${c.id} (e-mail) tem assinatura do SaaS: descartado`); if (leitura) reserva.push({ c, metodo: "email" }); continue; }
        return adotar(c, "email");
      }
    }

    if (leitura && reserva.length) {
      const canonico = escolherCanonico(reserva.map((r) => r.c))!;
      return { id: canonico.id, mocked: false, metodo: reserva.find((r) => r.c.id === canonico.id)!.metodo, avisos };
    }
    if (!criar) return null;

    /* 8: cria. A chave é estável por empresa: se a gravação no banco falhar
       depois, a próxima tentativa recebe o MESMO Customer. */
    const form = new URLSearchParams();
    form.append("name", e.nome.slice(0, 250));
    if (e.email) form.append("email", e.email);
    if (e.telefone) form.append("phone", e.telefone);
    const end = e.endereco;
    if (end?.line1) form.append("address[line1]", end.line1);
    if (end?.city) form.append("address[city]", end.city);
    if (end?.state) form.append("address[state]", end.state);
    if (end?.postalCode) form.append("address[postal_code]", end.postalCode);
    if (end?.country) form.append("address[country]", end.country);
    for (const [k, val] of Object.entries({ ...identidade, ...(e.metadata ?? {}) })) {
      if (val) form.append(`metadata[${k}]`, val.slice(0, 500));
    }
    try {
      const c = await p.stripe.criar(form, `onface-customer-${alvo}`);
      return await adotar(c, "criado");
    } catch (err) {
      /* O Stripe recusa a MESMA chave com corpo diferente (nome editado nas
         últimas 24 h). O Customer da primeira tentativa existe: acha por metadata. */
      if (!/idempotency/i.test(String(err))) throw err;
      const ja = await porMetadata();
      if (!ja) throw err;
      return adotar(ja, "metadata");
    }
  });
}

/**
 * O Customer da empresa para cobrar: acha o existente ou cria. É o ÚNICO
 * caminho de checkout.
 */
export async function garantirCustomerDaEmpresa(e: EntradaCustomer, p: PortasCustomer = PORTAS_REAIS): Promise<ResultadoCustomer> {
  return (await resolver(e, true, p))!;
}

/**
 * O Customer que já existe (fatura, parcelamento, portal): mesma busca, sem
 * criar. `null` quando a empresa nunca foi cobrada no Stripe.
 */
export function localizarCustomerDaEmpresa(e: EntradaCustomer, p: PortasCustomer = PORTAS_REAIS): Promise<ResultadoCustomer | null> {
  return resolver(e, false, p);
}

/**
 * O id do Customer que o ONFACE já tem para a empresa, SEM consultar o Stripe: a mesma ordem do
 * resolver (empresa → identidade → espelho). É o que a tela de cobrança e o link "Abrir no Stripe"
 * (dashboard, uso interno) usam — ter o id basta, não depende de assinatura viva nem de portal.
 */
export async function customerIdLocalDaEmpresa(organizacaoId: string, empresaId: string): Promise<string | null> {
  const modo = getStripeCheckoutMode();
  return db.transaction(async (tx) => {
    const v = vinculosDoBanco(tx);
    for (const id of [await v.daEmpresa(organizacaoId, empresaId), await v.daIdentidade(organizacaoId, empresaId, null), await v.doEspelho(organizacaoId, empresaId)]) {
      if (id && idCompativelComModo(id, modo)) return id;
    }
    return null;
  });
}

/**
 * O Customer para ABRIR O PORTAL: qualquer Customer da empresa, inclusive o do SaaS Callface
 * (contratado pelo site). Decisão do Scott de 13/10/2026: se a empresa tem Customer no Stripe,
 * o portal abre. Ordem: Customer do ONFACE primeiro; do SaaS só se não houver outro, e entre
 * vários o mesmo critério canônico (`escolherCanonico`). Só lê: não grava vínculo no banco nem
 * toca na metadata do Customer — o do SaaS continua não sendo cobrável por checkout/fatura.
 */
export function localizarCustomerParaPortal(e: EntradaCustomer, p: PortasCustomer = PORTAS_REAIS): Promise<ResultadoCustomer | null> {
  return resolver(e, false, p, true);
}

/**
 * Grava o vínculo empresa↔Customer (`empresas`, `leads` se vazio e
 * `billing_identities`) sob o MESMO lock do resolver. É o que o script de
 * diagnóstico usa, atrás de `--aplicar`, quando a escolha é inequívoca.
 */
export function registrarVinculoCustomer(g: GravacaoCustomer, p: PortaBanco = PORTAS_REAIS.banco): Promise<void> {
  return p.serializar(`stripe-customer:${g.empresaId ?? `lead:${g.leadId}`}`, (v) => v.gravar(g));
}
