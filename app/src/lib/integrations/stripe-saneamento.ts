/**
 * Saneamento de Customers do Stripe (stripe-onface-definicao §2, §13, §14).
 *
 * Usado pelos dois scripts de manutenção:
 *   - `stripe-backfill-metadata.ts`  completa a metadata de identidade que falta;
 *   - `stripe-diagnostico-customers.ts`  lista empresas com mais de um Customer.
 *
 * Aqui ficam só as decisões, em funções PURAS (testadas sem rede nem banco), e
 * as leituras. Nada aqui ESCREVE no Stripe: quem escreve é o script, atrás de
 * `--aplicar`. A conta Stripe é COMPARTILHADA com o SaaS Callface: Customer ou
 * assinatura com marca do SaaS é sempre pulado.
 */
import { doCrm } from "@/lib/financeiro/espelho-crm";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { idsDaMetadataStripe, metadataFaltante, metadataStripe } from "../crm/metadata-comercial";
import { normalizeCnpj } from "./billing-identity";
import { stripe } from "./stripe-assinatura";
import { ehDoSaas } from "./stripe-assinatura-acoes";
import { ehCustomerDoSaas, escolherCanonico, type CandidatoCustomer, type CustomerStripe } from "./stripe-customer";

export const STATUS_VIVOS = new Set(["active", "trialing", "past_due", "unpaid"]);

export interface AssinaturaDoStripe {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string> | null;
}

export const customerDaAssinatura = (s: AssinaturaDoStripe): string => (typeof s.customer === "string" ? s.customer : s.customer.id);

/* ── Leitura ────────────────────────────────────────────────────────────── */

/** Lista TUDO de um recurso do Stripe (só GET), paginando por `starting_after`. */
export async function listarTudo<T extends { id: string }>(recurso: string, extra = ""): Promise<T[]> {
  const todos: T[] = [];
  let depois: string | undefined;
  for (;;) {
    const r = await stripe<{ data: T[]; has_more: boolean }>(
      `${recurso}?limit=100${extra}${depois ? `&starting_after=${encodeURIComponent(depois)}` : ""}`,
    );
    todos.push(...r.data);
    if (!r.has_more || r.data.length === 0) break;
    depois = r.data[r.data.length - 1].id;
  }
  return todos;
}

export interface EmpresaDb { id: string; organizacaoId: string; nome: string; cnpj: string | null; stripeCustomerId: string | null }
export type FonteVinculo = "empresa" | "espelho" | "lead" | "identidade" | "alias";
export interface VinculoDb { organizacaoId: string; empresaId: string; customerId: string; fonte: FonteVinculo }
export interface AssinaturaEspelho { stripeSubscriptionId: string; organizacaoId: string; empresaId: string; customerId: string | null; status: string; negocioId: string | null }
export interface BaseOnface { empresas: EmpresaDb[]; vinculos: VinculoDb[]; espelho: AssinaturaEspelho[] }

const linhas = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? [])) as T[];

/** Só SELECT. O vínculo Customer↔empresa em todas as tabelas onde o ONFACE o guarda. */
export async function carregarBaseOnface(): Promise<BaseOnface> {
  const empresas = linhas<{ id: string; organizacao_id: string; nome: string; cnpj: string | null; stripe_customer_id: string | null }>(
    await db.execute(sql`select id, organizacao_id, nome, cnpj, stripe_customer_id from empresas`),
  ).map((e) => ({ id: e.id, organizacaoId: e.organizacao_id, nome: e.nome, cnpj: e.cnpj, stripeCustomerId: e.stripe_customer_id }));

  const vinculos = linhas<{ organizacao_id: string; empresa_id: string; customer_id: string; fonte: FonteVinculo }>(await db.execute(sql`
    select organizacao_id, id as empresa_id, stripe_customer_id as customer_id, 'empresa' as fonte
      from empresas where stripe_customer_id is not null and stripe_customer_id <> ''
    union
    select organizacao_id, empresa_id, stripe_customer_id, 'espelho'
      from assinaturas where ${doCrm("assinaturas")} and empresa_id is not null and stripe_customer_id is not null
    union
    select organizacao_id, empresa_id, stripe_customer_id, 'lead'
      from leads where empresa_id is not null and stripe_customer_id is not null and stripe_customer_id <> ''
    union
    select organizacao_id, coalesce(empresa_id, canonical_empresa_id), coalesce(canonical_stripe_customer_id, external_customer_id), 'identidade'
      from billing_identities
     where upper(provider) = 'STRIPE' and coalesce(empresa_id, canonical_empresa_id) is not null
       and (status is null or status in ('CONFIRMED', 'PROBABLE'))
    union
    select i.organizacao_id, coalesce(i.empresa_id, i.canonical_empresa_id), a.stripe_customer_id, 'alias'
      from billing_customer_aliases a join billing_identities i on i.id = a.billing_identity_id
     where coalesce(i.empresa_id, i.canonical_empresa_id) is not null
  `)).map((v) => ({ organizacaoId: v.organizacao_id, empresaId: v.empresa_id, customerId: v.customer_id, fonte: v.fonte }));

  const espelho = linhas<{ stripe_subscription_id: string; organizacao_id: string; empresa_id: string; stripe_customer_id: string | null; status: string; negocio_id: string | null }>(
    await db.execute(sql`
      select a.stripe_subscription_id, a.organizacao_id, a.empresa_id, a.stripe_customer_id, a.status, c.negocio_id
        from assinaturas a left join contratos c on c.id = a.contrato_id
       where ${doCrm("a")} and a.empresa_id is not null
    `),
  ).map((a) => ({
    stripeSubscriptionId: a.stripe_subscription_id, organizacaoId: a.organizacao_id, empresaId: a.empresa_id,
    customerId: a.stripe_customer_id, status: a.status, negocioId: a.negocio_id,
  }));

  return semEmpresasBalde({ empresas, vinculos, espelho });
}

/**
 * A carga de billing criou uma empresa-BALDE ("Unresolved billing identity") que
 * junta dezenas de Customers sem dono resolvido. Ela não é uma empresa: ligar
 * metadata ou canônico a ela carimbaria um `empresaId` falso em Customers reais.
 * Sai da base, junto com os vínculos que apontam para ela.
 */
export const ehEmpresaBalde = (e: Pick<EmpresaDb, "nome">): boolean => /^unresolved billing identity/i.test(e.nome.trim());

export function semEmpresasBalde(base: BaseOnface): BaseOnface {
  const baldes = new Set(base.empresas.filter(ehEmpresaBalde).map((e) => e.id));
  if (!baldes.size) return base;
  return {
    empresas: base.empresas.filter((e) => !baldes.has(e.id)),
    vinculos: base.vinculos.filter((v) => !baldes.has(v.empresaId)),
    espelho: base.espelho.filter((a) => !baldes.has(a.empresaId)),
  };
}

/* ── Backfill de metadata ───────────────────────────────────────────────── */

export interface AcaoBackfill {
  tipo: "customer" | "assinatura";
  id: string;
  empresaId: string;
  /** Só chaves que FALTAM: nada é sobrescrito, nada é removido. */
  adicionar: Record<string, string>;
}

export interface PlanoBackfill {
  acoes: AcaoBackfill[];
  /** Por motivo: quantos objetos foram pulados e por quê. */
  pulados: Record<string, number>;
}

export function planejarBackfill(entrada: {
  customers: CustomerStripe[];
  assinaturas: AssinaturaDoStripe[];
  base: BaseOnface;
}): PlanoBackfill {
  const { base } = entrada;
  const empresaPorId = new Map(base.empresas.map((e) => [e.id, e]));
  const pulados: Record<string, number> = {};
  const pula = (motivo: string) => { pulados[motivo] = (pulados[motivo] ?? 0) + 1; };

  const empresasDoCustomer = new Map<string, Set<string>>();
  for (const v of base.vinculos) {
    if (!empresasDoCustomer.has(v.customerId)) empresasDoCustomer.set(v.customerId, new Set());
    empresasDoCustomer.get(v.customerId)!.add(v.empresaId);
  }
  const espelhoPorSub = new Map(base.espelho.map((a) => [a.stripeSubscriptionId, a]));

  const acoes: AcaoBackfill[] = [];

  for (const c of entrada.customers) {
    if (c.deleted) { pula("customer apagado"); continue; }
    if (ehCustomerDoSaas(c)) { pula("customer do SaaS"); continue; }
    const doBanco = empresasDoCustomer.get(c.id);
    if (!doBanco?.size) { pula("customer sem empresa do ONFACE"); continue; }
    if (doBanco.size > 1) { pula("customer ligado a mais de uma empresa"); continue; }
    const empresaId = [...doBanco][0];
    const empresa = empresaPorId.get(empresaId);
    if (!empresa) { pula("empresa inexistente"); continue; }
    const declarada = idsDaMetadataStripe(c.metadata).empresaId;
    if (declarada && declarada !== empresaId) { pula("metadata declara outra empresa"); continue; }
    const falta = metadataFaltante(c.metadata, metadataStripe({ organizacaoId: empresa.organizacaoId, empresaId, cnpj: empresa.cnpj }));
    if (!Object.keys(falta).length) { pula("customer já completo"); continue; }
    acoes.push({ tipo: "customer", id: c.id, empresaId, adicionar: falta });
  }

  for (const s of entrada.assinaturas) {
    const espelho = espelhoPorSub.get(s.id);
    if (!espelho) { pula("assinatura fora do espelho (provável SaaS)"); continue; }
    if (ehDoSaas(s.metadata ?? undefined)) { pula("assinatura do SaaS"); continue; }
    if (!STATUS_VIVOS.has(s.status)) { pula("assinatura não viva"); continue; }
    const empresa = empresaPorId.get(espelho.empresaId);
    if (!empresa) { pula("empresa inexistente"); continue; }
    const declarada = idsDaMetadataStripe(s.metadata).empresaId;
    if (declarada && declarada !== espelho.empresaId) { pula("metadata declara outra empresa"); continue; }
    const falta = metadataFaltante(s.metadata, metadataStripe({
      organizacaoId: empresa.organizacaoId, empresaId: espelho.empresaId, negocioId: espelho.negocioId, cnpj: empresa.cnpj,
    }));
    if (!Object.keys(falta).length) { pula("assinatura já completa"); continue; }
    acoes.push({ tipo: "assinatura", id: s.id, empresaId: espelho.empresaId, adicionar: falta });
  }

  return { acoes, pulados };
}

/* ── Diagnóstico de Customers duplicados ────────────────────────────────── */

export interface CandidatoDiagnostico extends CandidatoCustomer {
  nome: string | null;
  email: string | null;
  /** De onde veio a ligação com a empresa (vínculos do banco, metadata, CNPJ). */
  fontes: string[];
  assinaturasTotal: number;
  /** O Customer está no ONFACE mas o Stripe não o lista mais (apagado). */
  ausenteNoStripe: boolean;
  /** Tem assinatura do SaaS, mesmo sem marca no Customer: nunca é canônico. */
  contaminadoPeloSaas: boolean;
}

export interface DiagnosticoEmpresa {
  empresaId: string;
  organizacaoId: string;
  nome: string;
  apontaHoje: string | null;
  candidatos: CandidatoDiagnostico[];
  canonicoProposto: string | null;
  /** Só vira `true` quando a escolha não deixa dúvida (ver `motivo`). */
  inequivoco: boolean;
  motivo: string;
}

export function diagnosticarCustomers(entrada: {
  customers: CustomerStripe[];
  assinaturas: AssinaturaDoStripe[];
  base: BaseOnface;
}): DiagnosticoEmpresa[] {
  const { base } = entrada;
  const doStripe = new Map(entrada.customers.map((c) => [c.id, c]));
  const subsPorCustomer = new Map<string, AssinaturaDoStripe[]>();
  for (const s of entrada.assinaturas) {
    const id = customerDaAssinatura(s);
    subsPorCustomer.set(id, [...(subsPorCustomer.get(id) ?? []), s]);
  }

  /* empresa → customer → fontes */
  const mapa = new Map<string, Map<string, Set<string>>>();
  const liga = (empresaId: string, customerId: string, fonte: string) => {
    if (!mapa.has(empresaId)) mapa.set(empresaId, new Map());
    const m = mapa.get(empresaId)!;
    if (!m.has(customerId)) m.set(customerId, new Set());
    m.get(customerId)!.add(fonte);
  };
  const empresaPorId = new Map(base.empresas.map((e) => [e.id, e]));
  const empresaPorCnpj = new Map<string, string[]>();
  for (const e of base.empresas) {
    const cnpj = normalizeCnpj(e.cnpj);
    if (cnpj) empresaPorCnpj.set(cnpj, [...(empresaPorCnpj.get(cnpj) ?? []), e.id]);
  }

  for (const v of base.vinculos) liga(v.empresaId, v.customerId, `banco:${v.fonte}`);
  for (const c of entrada.customers) {
    if (c.deleted || ehCustomerDoSaas(c)) continue;
    const empresaId = idsDaMetadataStripe(c.metadata).empresaId;
    if (empresaId && empresaPorId.has(empresaId)) liga(empresaId, c.id, "stripe:metadata");
    const cnpj = normalizeCnpj(c.metadata?.crm_cnpj ?? c.metadata?.cnpj);
    const donos = cnpj ? empresaPorCnpj.get(cnpj) : undefined;
    if (donos?.length === 1) liga(donos[0], c.id, "stripe:cnpj");
  }

  const resultado: DiagnosticoEmpresa[] = [];
  for (const [empresaId, customers] of mapa) {
    const empresa = empresaPorId.get(empresaId);
    if (!empresa) continue;
    const candidatos: CandidatoDiagnostico[] = [];
    for (const [customerId, fontes] of customers) {
      const c = doStripe.get(customerId);
      const subs = subsPorCustomer.get(customerId) ?? [];
      const saasSub = subs.some((s) => ehDoSaas(s.metadata ?? undefined));
      if (c && ehCustomerDoSaas(c)) continue; // do SaaS: nem aparece como candidato
      candidatos.push({
        id: customerId,
        created: c?.created,
        nome: c?.name ?? null,
        email: c?.email ?? null,
        fontes: [...fontes].sort(),
        assinaturasVivas: subs.filter((s) => STATUS_VIVOS.has(s.status) && !ehDoSaas(s.metadata ?? undefined)).length,
        assinaturasTotal: subs.length,
        vinculadoNaEmpresa: empresa.stripeCustomerId === customerId,
        ausenteNoStripe: !c,
        contaminadoPeloSaas: saasSub,
      });
    }
    if (candidatos.length < 2) continue;

    const validos = candidatos.filter((c) => !c.ausenteNoStripe && !c.contaminadoPeloSaas);
    const canonico = escolherCanonico(validos);
    const comVivas = validos.filter((c) => (c.assinaturasVivas ?? 0) > 0);
    const vinculados = validos.filter((c) => c.vinculadoNaEmpresa);
    let inequivoco = false;
    let motivo: string;
    if (!canonico) motivo = "nenhum candidato utilizável (apagados ou do SaaS)";
    else if (comVivas.length === 1) { inequivoco = true; motivo = "só um Customer tem assinatura viva"; }
    else if (comVivas.length > 1) motivo = `${comVivas.length} Customers com assinatura viva: decisão humana (merge ou escolha)`;
    else if (vinculados.length === 1) { inequivoco = true; motivo = "nenhuma assinatura viva; a empresa já aponta para este"; }
    else motivo = "nenhuma assinatura viva e a empresa não aponta para um só: decisão humana";

    resultado.push({
      empresaId, organizacaoId: empresa.organizacaoId, nome: empresa.nome, apontaHoje: empresa.stripeCustomerId,
      candidatos: candidatos.sort((a, b) => (a.created ?? Infinity) - (b.created ?? Infinity)),
      canonicoProposto: canonico?.id ?? null, inequivoco, motivo,
    });
  }
  return resultado.sort((a, b) => a.nome.localeCompare(b.nome));
}
