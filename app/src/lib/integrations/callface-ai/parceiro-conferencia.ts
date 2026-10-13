/**
 * A conferência do White Label: o que a plataforma Callface AI FATUROU do
 * parceiro contra o que existe no CRM e contra a própria conta dela.
 *
 * Função pura. Quem lê o banco e grava as pendências é
 * `integrations/callface-ai/parceiros-sincronizar.ts`.
 *
 * Divergência NUNCA vira número solto: cada uma é uma `Pendencia` com tipo,
 * severidade, esperado e encontrado. O que não pôde ser conferido (a plataforma
 * não informa o ciclo, o parceiro não tem empresa no CRM) sai em `limites`, dito
 * em palavras — não-conferido não é o mesmo que conferido-e-certo.
 */
import { licencaAtivaEm } from "@onface/integrations-callface-ai";

export type SeveridadePendencia = "alta" | "media" | "info";

export type TipoPendencia =
  | "fatura_vencida"
  | "fatura_total_diverge"
  | "item_proporcional_diverge"
  | "item_dias_invalidos"
  | "preco_diverge_do_acordado"
  | "licenca_sem_item"
  | "parceiro_sem_empresa"
  | "fatura_ausente_no_crm"
  | "valor_diverge_no_crm"
  | "status_diverge_no_crm";

export interface Pendencia {
  chave: string;
  tipo: TipoPendencia;
  severidade: SeveridadePendencia;
  partnerId: string | null;
  invoiceId: string | null;
  mensagem: string;
  esperado: number | null;
  encontrado: number | null;
}

export interface ParceiroLocal { partnerId: string; nome: string | null; precoPorLicenca: number | null; empresaId: string | null }
export interface LicencaLocal { licenseId: string; partnerId: string | null; inicioEm: Date | null; revogadaEm: Date | null; expiraEm: Date | null }
export interface ItemLocal {
  itemId: string; licenseId: string | null; diasAtivos: number; diasNoCiclo: number;
  proporcional: boolean; precoUnitario: number; totalLinha: number;
}
export interface FaturaLocal {
  invoiceId: string; partnerId: string; status: string;
  competencia: string | null; cicloInicio: string | null; cicloFim: string | null;
  vencimento: Date | null; total: number | null; itens: ItemLocal[];
}
export interface FaturaCrm { partnerId: string; faturaId: string; valor: number; status: string; competencia: string | null }

const centavos = (v: number): number => Math.round(v * 100);
const moeda = (v: number): string => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const rotulo = (p: ParceiroLocal | undefined, id: string): string => p?.nome ?? `parceiro ${id}`;

/**
 * O valor que a plataforma deveria cobrar por um item. Proporcional: preço
 * unitário × dias ativos ÷ dias do ciclo. Não proporcional: o preço cheio.
 * Arredondado em centavos.
 */
export function totalEsperadoDoItem(i: Pick<ItemLocal, "proporcional" | "precoUnitario" | "diasAtivos" | "diasNoCiclo">): number {
  if (!i.proporcional) return Math.round(i.precoUnitario * 100) / 100;
  return Math.round((i.precoUnitario * i.diasAtivos * 100) / i.diasNoCiclo) / 100;
}

/** O item bate com o que o cálculo proporcional dá? Tolerância de 1 centavo: a plataforma pode arredondar de outro jeito. */
export function itemBate(i: ItemLocal): boolean {
  return Math.abs(centavos(i.totalLinha) - centavos(totalEsperadoDoItem(i))) <= 1;
}

export function somaDosItens(f: Pick<FaturaLocal, "itens">): number {
  return f.itens.reduce((a, i) => a + centavos(i.totalLinha), 0) / 100;
}

type Situacao = "paga" | "aberta" | "cancelada";
function situacaoDaPlataforma(status: string): Situacao {
  const s = status.trim().toUpperCase();
  if (s === "PAID") return "paga";
  if (["DRAFT", "VOID", "VOIDED", "CANCELED", "CANCELLED"].includes(s)) return "cancelada";
  return "aberta"; // OPEN, PENDING, ISSUED, OVERDUE...
}

const diaMs = 86_400_000;
const paraUtc = (d: string): number => Date.parse(`${d}T00:00:00Z`);

export function conferirParceiros(
  entrada: {
    parceiros: ParceiroLocal[]; licencas: LicencaLocal[];
    faturas: FaturaLocal[]; faturasCrm: FaturaCrm[];
  },
  agora: Date = new Date(),
): { pendencias: Pendencia[]; limites: string[] } {
  const pendencias: Pendencia[] = [];
  const limites = new Set<string>();
  const parceiros = new Map(entrada.parceiros.map((p) => [p.partnerId, p]));
  const add = (p: Omit<Pendencia, "chave"> & { chave: string }) => pendencias.push(p);

  for (const p of entrada.parceiros) {
    if (!p.empresaId) {
      add({
        chave: `parceiro_sem_empresa:${p.partnerId}`, tipo: "parceiro_sem_empresa", severidade: "media",
        partnerId: p.partnerId, invoiceId: null, esperado: null, encontrado: null,
        mensagem: `${rotulo(p, p.partnerId)} não está ligado a uma empresa do CRM: nada do que a plataforma fatura dele pode ser comparado com o CRM.`,
      });
    }
  }

  for (const f of entrada.faturas) {
    const parceiro = parceiros.get(f.partnerId);
    const nome = rotulo(parceiro, f.partnerId);
    const soma = somaDosItens(f);
    const total = f.total ?? soma;
    if (f.total === null) limites.add("A plataforma não informa o total da fatura: o total conferido é a soma dos itens.");

    // 1. Vencida: o dinheiro que a plataforma já cobrou e não recebeu.
    if (f.status.trim().toUpperCase() === "OVERDUE") {
      const atraso = f.vencimento ? Math.floor((agora.getTime() - f.vencimento.getTime()) / diaMs) : null;
      add({
        chave: `fatura_vencida:${f.invoiceId}`, tipo: "fatura_vencida", severidade: "alta",
        partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: total, encontrado: 0,
        mensagem: `Fatura de ${nome}${f.competencia ? ` (${f.competencia.slice(0, 7)})` : ""} vencida: ${moeda(total)} em aberto${atraso !== null && atraso >= 0 ? `, ${atraso} dia(s) de atraso` : ""}.`,
      });
    }

    // 2. A conta da própria fatura.
    if (f.total !== null && f.itens.length && centavos(f.total) !== centavos(soma)) {
      add({
        chave: `fatura_total_diverge:${f.invoiceId}`, tipo: "fatura_total_diverge", severidade: "alta",
        partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: soma, encontrado: f.total,
        mensagem: `Fatura de ${nome}: o total é ${moeda(f.total)} e os itens somam ${moeda(soma)}.`,
      });
    }

    // 3. Cada item: o proporcional bate com o dia a dia?
    for (const i of f.itens) {
      if (i.diasNoCiclo <= 0 || i.diasAtivos < 0 || i.diasAtivos > i.diasNoCiclo) {
        add({
          chave: `item_dias_invalidos:${i.itemId}`, tipo: "item_dias_invalidos", severidade: "media",
          partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: null, encontrado: i.diasAtivos,
          mensagem: `Item da fatura de ${nome} com ${i.diasAtivos} dia(s) ativos em um ciclo de ${i.diasNoCiclo}.`,
        });
        continue;
      }
      if (!itemBate(i)) {
        add({
          chave: `item_proporcional_diverge:${i.itemId}`, tipo: "item_proporcional_diverge", severidade: "media",
          partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: totalEsperadoDoItem(i), encontrado: i.totalLinha,
          mensagem: `Item da fatura de ${nome}: ${i.proporcional ? `${i.diasAtivos}/${i.diasNoCiclo} dias de ${moeda(i.precoUnitario)}` : `preço cheio de ${moeda(i.precoUnitario)}`} dá ${moeda(totalEsperadoDoItem(i))}, a plataforma cobrou ${moeda(i.totalLinha)}.`,
        });
      }
      if (parceiro?.precoPorLicenca != null && centavos(i.precoUnitario) !== centavos(parceiro.precoPorLicenca)) {
        add({
          chave: `preco_diverge_do_acordado:${i.itemId}`, tipo: "preco_diverge_do_acordado", severidade: "info",
          partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: parceiro.precoPorLicenca, encontrado: i.precoUnitario,
          mensagem: `Item da fatura de ${nome} a ${moeda(i.precoUnitario)}; o preço por licença do parceiro hoje é ${moeda(parceiro.precoPorLicenca)} (pode ser tabela antiga).`,
        });
      }
    }

    // 4. Licença que existia no ciclo e não foi cobrada.
    if (f.cicloInicio && f.cicloFim && f.itens.some((i) => i.licenseId)) {
      const ini = paraUtc(f.cicloInicio);
      const fim = paraUtc(f.cicloFim) + diaMs;
      const cobradas = new Set(f.itens.map((i) => i.licenseId).filter((x): x is string => !!x));
      const noCiclo = entrada.licencas.filter((l) =>
        l.partnerId === f.partnerId && l.inicioEm && l.inicioEm.getTime() < fim &&
        (!l.revogadaEm || l.revogadaEm.getTime() >= ini) && (!l.expiraEm || l.expiraEm.getTime() >= ini));
      const sem = noCiclo.filter((l) => !cobradas.has(l.licenseId));
      if (sem.length) {
        add({
          chave: `licenca_sem_item:${f.invoiceId}`, tipo: "licenca_sem_item", severidade: "media",
          partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: noCiclo.length, encontrado: noCiclo.length - sem.length,
          mensagem: `Fatura de ${nome}: ${sem.length} de ${noCiclo.length} licença(s) reservadas no ciclo não aparecem em nenhum item.`,
        });
      }
    } else if (f.itens.length) {
      limites.add("Sem ciclo da fatura ou sem licença nos itens: não dá para conferir quais licenças deixaram de ser cobradas.");
    }

    // 5. Contra o CRM.
    const situacao = situacaoDaPlataforma(f.status);
    if (situacao === "cancelada") continue;
    if (!parceiro?.empresaId) continue; // já é pendência `parceiro_sem_empresa`
    if (!f.competencia) {
      limites.add("Fatura sem competência: não dá para localizar a fatura correspondente no CRM.");
      continue;
    }
    const mes = f.competencia.slice(0, 7);
    const doMes = entrada.faturasCrm.filter((c) =>
      c.partnerId === f.partnerId && c.competencia?.slice(0, 7) === mes && c.status !== "void");
    if (!doMes.length) {
      add({
        chave: `fatura_ausente_no_crm:${f.invoiceId}`, tipo: "fatura_ausente_no_crm", severidade: "alta",
        partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: total, encontrado: 0,
        mensagem: `A plataforma faturou ${moeda(total)} de ${nome} em ${mes} e o CRM não tem fatura dele nesse mês.`,
      });
      continue;
    }
    const noCrm = doMes.reduce((a, c) => a + centavos(c.valor), 0) / 100;
    if (centavos(noCrm) !== centavos(total)) {
      add({
        chave: `valor_diverge_no_crm:${f.invoiceId}`, tipo: "valor_diverge_no_crm", severidade: "alta",
        partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: total, encontrado: noCrm,
        mensagem: `${nome}, ${mes}: a plataforma faturou ${moeda(total)} e o CRM tem ${moeda(noCrm)}.`,
      });
    } else if (situacao === "paga" && !doMes.some((c) => c.status === "paga")) {
      add({
        chave: `status_diverge_no_crm:${f.invoiceId}`, tipo: "status_diverge_no_crm", severidade: "media",
        partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: total, encontrado: 0,
        mensagem: `${nome}, ${mes}: a plataforma deu a fatura como paga e no CRM ela segue em aberto.`,
      });
    } else if (situacao === "aberta" && doMes.every((c) => c.status === "paga")) {
      add({
        chave: `status_diverge_no_crm:${f.invoiceId}`, tipo: "status_diverge_no_crm", severidade: "media",
        partnerId: f.partnerId, invoiceId: f.invoiceId, esperado: 0, encontrado: total,
        mensagem: `${nome}, ${mes}: o CRM deu a fatura como paga e a plataforma ainda a tem em aberto (${f.status}).`,
      });
    }
  }

  return { pendencias, limites: [...limites] };
}

/** Só para quem decide a licença local: o mesmo predicado do pacote. */
export const licencaLocalAtiva = (l: LicencaLocal, agora: Date = new Date()): boolean => licencaAtivaEm(l, agora);
