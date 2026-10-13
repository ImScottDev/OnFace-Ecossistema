/**
 * De quem é um objeto do Stripe: do CRM (ONFACE) ou do SaaS Callface?
 *
 * A conta Stripe é COMPARTILHADA entre o CRM e o SaaS. `subscriptions` e
 * `invoices` listam tudo; sem este filtro o sync espelha as assinaturas e
 * faturas do SaaS em `assinaturas`/`faturas`, o que infla MRR e carteira e
 * pode levar o time a cobrar cliente do SaaS. É o ÚNICO ponto que decide isso:
 * o sync, o script de saneamento e qualquer consumidor novo importam daqui.
 *
 * A marca de cada lado:
 *  - SaaS: `organization_id`, `plan_id` ou `user_id` na metadata da assinatura
 *    (e da assinatura dentro da fatura). Os Customers do SaaS trazem
 *    `user_name`, `user_cnpj` ou `user_cpf`.
 *  - CRM: `crm_*` (ver `metadataStripe`), `organizacaoId`, `empresaId`,
 *    `negocioId` ou `propostaId`.
 *
 * Ordem de evidência: a marca na PRÓPRIA assinatura/fatura vale mais que a do
 * Customer. Um Customer criado pelo SaaS (tem `user_name`) pode depois comprar
 * pelo CRM, e a assinatura do CRM leva `negocioId` — essa é do CRM. Só quando
 * o objeto não tem marca nenhuma é que a marca do Customer desempata.
 *
 * Decisão para o que fica sem marca ou com marca dos dois lados: MANTER no
 * espelho e sinalizar (`sem_marca` / `conflito`). Descartar em silêncio some
 * com receita do CRM (assinaturas antigas, criadas no Dashboard antes da
 * metadata existir); mostrar a mais é corrigível, sumir não é.
 */

export type OrigemStripe = "saas" | "crm" | "sem_marca" | "conflito";

export interface OrigemDecidida {
  origem: OrigemStripe;
  /** De onde veio a evidência; "cliente" = inferida só pelo Customer. */
  evidencia: "objeto" | "cliente" | "nenhuma";
}

type Metadata = Record<string, string> | null | undefined;

const CHAVES_SAAS_OBJETO = ["organization_id", "plan_id", "user_id"];
const CHAVES_SAAS_CLIENTE = [...CHAVES_SAAS_OBJETO, "user_name", "user_cnpj", "user_cpf"];
const CHAVES_CRM_FIXAS = ["organizacaoId", "empresaId", "negocioId", "propostaId"];

const temChave = (m: Metadata, chaves: string[]) => !!m && chaves.some((k) => !!m[k]?.trim?.());
const ehCrm = (m: Metadata) =>
  !!m && (temChave(m, CHAVES_CRM_FIXAS) || Object.keys(m).some((k) => k.startsWith("crm_") && !!m[k]?.trim?.()));

/** `objeto`: metadata da assinatura/fatura. `cliente`: metadata do Customer (pode faltar). */
export function origemDoObjetoStripe(objeto: Metadata, cliente?: Metadata): OrigemDecidida {
  const saasObj = temChave(objeto, CHAVES_SAAS_OBJETO);
  const crmObj = ehCrm(objeto);
  if (saasObj && crmObj) return { origem: "conflito", evidencia: "objeto" };
  if (saasObj) return { origem: "saas", evidencia: "objeto" };
  if (crmObj) return { origem: "crm", evidencia: "objeto" };

  const saasCli = temChave(cliente, CHAVES_SAAS_CLIENTE);
  const crmCli = ehCrm(cliente);
  if (saasCli && crmCli) return { origem: "conflito", evidencia: "cliente" };
  if (saasCli) return { origem: "saas", evidencia: "cliente" };
  if (crmCli) return { origem: "crm", evidencia: "cliente" };
  return { origem: "sem_marca", evidencia: "nenhuma" };
}

/** O espelho do CRM descarta SÓ o que é, com certeza de marca, do SaaS. */
export const ehDoSaas = (d: OrigemDecidida) => d.origem === "saas";

interface ObjetoComCliente {
  metadata?: Metadata;
  customer?: string | { id: string; metadata?: Metadata } | null;
}

export const origemDaAssinatura = (s: ObjetoComCliente) =>
  origemDoObjetoStripe(s.metadata, typeof s.customer === "object" && s.customer ? s.customer.metadata : null);

interface FaturaStripe extends ObjetoComCliente {
  parent?: { subscription_details?: { metadata?: Metadata } | null } | null;
}

/**
 * Fatura herda a origem da assinatura quando a metadata dela veio junto
 * (`parent.subscription_details.metadata`); senão usa a própria e a do Customer.
 */
export function origemDaFatura(i: FaturaStripe): OrigemDecidida {
  const daAssinatura = i.parent?.subscription_details?.metadata;
  const cli = typeof i.customer === "object" && i.customer ? i.customer.metadata : null;
  return origemDoObjetoStripe({ ...(i.metadata || {}), ...(daAssinatura || {}) }, cli);
}
