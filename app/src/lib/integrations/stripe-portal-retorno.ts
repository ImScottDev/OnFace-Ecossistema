/**
 * O que o cliente faz no Portal do Stripe e VOLTA para o ONFACE — parte pura.
 *
 * O portal deixa o cliente: cancelar (no fim do período), trocar/adicionar forma
 * de pagamento e corrigir o cadastro de cobrança (nome, telefone, endereço,
 * documento fiscal). Cada ação vira um evento do Stripe:
 *
 *   cancelar / desfazer      → customer.subscription.updated  (cancel_at_period_end / cancel_at)
 *   cartão novo              → payment_method.attached  (+ customer.updated: invoice_settings)
 *   nome, telefone, endereço → customer.updated  (previous_attributes diz o que mudou)
 *   documento fiscal         → customer.tax_id.created | updated | deleted  (NÃO vem em customer.updated)
 *
 * Este módulo lê esses payloads. Quem grava (timeline, cadastro, aviso) está em
 * `stripe-financeiro-efeitos.ts`; quem decide a ordem está em
 * `stripe-webhook-processor.ts`.
 */

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const asStr = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/* ── Motivo de cancelamento ───────────────────────────────────────────── */

const FEEDBACK: Record<string, string> = {
  too_expensive: "preço alto", missing_features: "faltam recursos", switched_service: "trocou de serviço", unused: "não usa",
  customer_service: "atendimento", too_complex: "complexo demais", low_quality: "qualidade abaixo do esperado", other: "outro motivo",
};

/**
 * O motivo que o CLIENTE deu ao cancelar no portal (`cancellation_details`).
 * O Stripe grava `reason = cancellation_requested`, o `feedback` escolhido e, em
 * "outro", o `comment`. Cancelado à mão no Dashboard vem vazio → `null`.
 */
export function motivoDoPortal(detalhes: unknown): string | null {
  const d = asObj(detalhes);
  if (!d) return null;
  const chave = asStr(d.feedback) ?? asStr(d.feedback_option);
  const rotulo = chave ? (FEEDBACK[chave] ?? chave) : null;
  const comentario = asStr(d.comment);
  const partes = [rotulo, comentario].filter((x): x is string => !!x);
  return partes.length ? partes.join(" — ") : null;
}

/* ── Cadastro de cobrança ─────────────────────────────────────────────── */

export interface CadastroNovo {
  nome?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  /** CNPJ (14 dígitos). CPF não tem coluna própria na empresa e só vai para a timeline. */
  cnpj?: string | null;
}

export interface MudancaDoCliente {
  origem: "customer" | "tax_id";
  /** Rótulos em português do que mudou: "telefone", "endereço"… */
  rotulos: string[];
  novo: CadastroNovo;
  /** O e-mail é a identidade do Customer no webhook: se mudou, alguém precisa conferir o vínculo. */
  emailMudou: boolean;
  documento: { tipo: string; valor: string } | null;
  excluido: boolean;
}

const TIPO_DOCUMENTO: Record<string, string> = { br_cnpj: "CNPJ", br_cpf: "CPF" };

const digitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/**
 * `customer.updated` e `customer.tax_id.*` → o que o cliente mexeu no cadastro.
 * `null` quando o evento não é cadastro: `customer.updated` dispara também por
 * metadata, saldo e `invoice_settings` (inclusive pelas nossas próprias
 * escritas), e isso não é fato para a timeline.
 */
export function mudancasDoCliente(event: { type?: string; data?: { object?: Obj; previous_attributes?: Obj } }): MudancaDoCliente | null {
  const type = event.type ?? "";
  const o = event.data?.object ?? {};
  const prev = event.data?.previous_attributes ?? {};

  if (type.startsWith("customer.tax_id.")) {
    const tipo = asStr(o.type);
    const valor = asStr(o.value);
    if (!tipo || !valor) return null;
    const ds = digitos(valor);
    return {
      origem: "tax_id", rotulos: ["documento fiscal"], emailMudou: false,
      novo: tipo === "br_cnpj" && ds.length === 14 && type !== "customer.tax_id.deleted" ? { cnpj: ds } : {},
      documento: { tipo: TIPO_DOCUMENTO[tipo] ?? tipo, valor },
      excluido: type === "customer.tax_id.deleted",
    };
  }

  if (type !== "customer.updated") return null;
  const rotulos: string[] = [];
  const novo: CadastroNovo = {};
  if ("name" in prev) { rotulos.push("nome"); novo.nome = asStr(o.name); }
  if ("phone" in prev) { rotulos.push("telefone"); novo.telefone = asStr(o.phone); }
  if ("address" in prev) {
    rotulos.push("endereço");
    const a = asObj(o.address);
    novo.endereco = [asStr(a?.line1), asStr(a?.line2)].filter(Boolean).join(", ") || null;
    novo.cep = asStr(a?.postal_code);
    novo.cidade = asStr(a?.city);
    novo.estado = asStr(a?.state);
  }
  const emailMudou = "email" in prev;
  if (emailMudou) rotulos.push("e-mail");
  if (rotulos.length === 0) return null;
  return { origem: "customer", rotulos, novo, emailMudou, documento: null, excluido: false };
}

/* ── Plano de gravação no cadastro da empresa ─────────────────────────── */

export interface CadastroAtual {
  nome?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cnpj?: string | null;
}

const texto = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
/** Telefone: compara pelos últimos 10-11 dígitos, ignorando +55, máscara e zero à esquerda. */
function mesmoTelefone(a: string, b: string): boolean {
  const x = digitos(a).replace(/^55(?=\d{10,11}$)/, "").replace(/^0+/, "");
  const y = digitos(b).replace(/^55(?=\d{10,11}$)/, "").replace(/^0+/, "");
  return x === y;
}

export interface PlanoDeCadastro {
  /** Colunas de `empresas` a PREENCHER (hoje vazias). */
  preencher: Partial<Record<"telefone" | "endereco" | "cep" | "cidade" | "estado" | "cnpj", string>>;
  /** Onde o CRM tem outro valor: não sobrescreve (pode ter sido editado à mão), mas a equipe é avisada. */
  divergencias: string[];
}

/**
 * Regra do ONFACE para o que volta do portal: SÓ PREENCHE campo vazio, nunca
 * sobrescreve dado que já existe (o mesmo critério do checkout em
 * `gravarDadosFiscaisNoCRM`). Onde o cliente informou algo diferente do que o CRM
 * tem, vira divergência para a equipe decidir — o dado do CRM pode ser o certo
 * (contrato, nota fiscal) e o do portal o errado.
 */
export function planoDeCadastro(atual: CadastroAtual, novo: CadastroNovo): PlanoDeCadastro {
  const preencher: PlanoDeCadastro["preencher"] = {};
  const divergencias: string[] = [];

  const campo = (
    col: keyof PlanoDeCadastro["preencher"], rotulo: string, atualV: string | null | undefined, novoV: string | null | undefined,
    igual: (a: string, b: string) => boolean,
  ) => {
    if (!novoV) return;
    if (!atualV || !atualV.trim()) { preencher[col] = novoV; return; }
    if (!igual(atualV, novoV)) divergencias.push(`${rotulo}: o CRM tem "${atualV}" e o cliente informou "${novoV}"`);
  };
  campo("telefone", "telefone", atual.telefone, novo.telefone, mesmoTelefone);
  campo("endereco", "endereço", atual.endereco, novo.endereco, (a, b) => texto(a) === texto(b));
  campo("cep", "CEP", atual.cep, novo.cep, (a, b) => digitos(a) === digitos(b));
  campo("cidade", "cidade", atual.cidade, novo.cidade, (a, b) => texto(a) === texto(b));
  campo("estado", "estado", atual.estado, novo.estado, (a, b) => texto(a) === texto(b));
  campo("cnpj", "CNPJ", atual.cnpj, novo.cnpj, (a, b) => digitos(a) === digitos(b));
  return { preencher, divergencias };
}

/* ── Espelho da assinatura ────────────────────────────────────────────── */

/**
 * O que o Cliente 360 e o CS leem de `assinaturas.raw`: cancelamento agendado.
 * Antes ninguém gravava `raw` na assinatura, então `cancelaNoFimDoPeriodo` era
 * sempre falso e o cancelamento que o cliente pede no portal ficava invisível no
 * espelho (só aparecia na timeline). `cancela_no_fim` junta os dois modos de
 * cobrança do Stripe (classic: `cancel_at_period_end`; flexible: `cancel_at`).
 */
export function resumoDeCancelamento(s: {
  status?: string; cancel_at_period_end?: boolean; cancel_at?: number | null;
  cancellation_details?: { reason?: string | null; feedback?: string | null; comment?: string | null } | null;
}) {
  const agendado = s.status !== "canceled" && (s.cancel_at_period_end === true || (s.cancel_at ?? null) !== null);
  return {
    cancel_at_period_end: s.cancel_at_period_end === true,
    cancel_at: s.cancel_at ?? null,
    cancela_no_fim: agendado,
    cancellation_details: s.cancellation_details ?? null,
  };
}

