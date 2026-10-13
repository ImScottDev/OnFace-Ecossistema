/**
 * Regras puras do retrato do cliente na plataforma. Sem banco: recebe as linhas
 * do espelho local e devolve o retrato. Testável.
 *
 * As três decisões que a tela herda daqui:
 *   - TESTE NÃO É CLIENTE PAGANTE. Só licença ativa com motivo SUBSCRIPTION_PAID
 *     conta. PARTNER_WHITE_LABEL é cliente via parceiro (outra situação, não
 *     "pagante direto"); INTERNAL e TRIAL nunca contam.
 *   - USUÁRIO DESATIVADO NÃO É ATIVO. Ativo = vínculo sem desativação E usuário
 *     ativo na plataforma (a mesma conta de `lerTenants`).
 *   - SEM STRIPE_CUSTOMER_ID = STRIPE NÃO CONECTADO. Aparece assim, não some.
 */

export type TipoLicenca = "trial" | "pago" | "interno" | "white_label" | "outro";

export const tipoDaLicenca = (motivo: string): TipoLicenca => {
  switch (motivo.trim().toUpperCase()) {
    case "TRIAL": return "trial";
    case "SUBSCRIPTION_PAID": return "pago";
    case "INTERNAL": return "interno";
    case "PARTNER_WHITE_LABEL": return "white_label";
    default: return "outro";
  }
};

export interface LicencaLocal {
  licenseId: string; planId: string | null; motivo: string;
  revogadaEm: Date | null; expiraEm: Date | null; atribuida: boolean;
}

/** Mesmo predicado do SaaS: não revogada e não expirada (expira_em > agora, estrito). */
export const licencaVigente = (l: Pick<LicencaLocal, "revogadaEm" | "expiraEm">, agora: Date): boolean =>
  l.revogadaEm == null && (l.expiraEm == null || l.expiraEm.getTime() > agora.getTime());

export type SituacaoComercial = "pagante" | "via_parceiro" | "trial" | "interno" | "sem_licenca_ativa";

export function situacaoComercial(licencas: LicencaLocal[], agora: Date): SituacaoComercial {
  const tipos = new Set(licencas.filter((l) => licencaVigente(l, agora)).map((l) => tipoDaLicenca(l.motivo)));
  if (tipos.has("pago")) return "pagante";
  if (tipos.has("white_label")) return "via_parceiro";
  if (tipos.has("trial")) return "trial";
  if (tipos.has("interno")) return "interno";
  return "sem_licenca_ativa";
}

/** Pagante direto: só assinatura paga vigente. Teste, interno e parceiro não. */
export const clientePagante = (licencas: LicencaLocal[], agora: Date): boolean =>
  situacaoComercial(licencas, agora) === "pagante";

export interface UsuarioLocal {
  papel: string; aceite: string | null; convite: string | null;
  desativadoEm: Date | null; usuarioAtivo: boolean; crmUserId: string | null;
}

export const usuarioAtivo = (u: Pick<UsuarioLocal, "desativadoEm" | "usuarioAtivo">): boolean =>
  u.desativadoEm == null && u.usuarioAtivo;

export interface StripeLocal { stripeCustomerId: string | null; migrado: boolean | null }

export function stripeDaOrganizacao(s: StripeLocal | null) {
  const customer = s?.stripeCustomerId?.trim() || null;
  return {
    conectado: customer !== null,
    estado: customer !== null ? ("conectado" as const) : ("nao_conectado" as const),
    stripeCustomerId: customer,
    migrado: s?.migrado ?? null,
  };
}

export interface PlanoLocal {
  planId: string; nome: string | null; preco: number | null; stripePriceId: string | null; intervalo: string | null;
}

export interface ContagemUsuarios { total: number; ativos: number; desativados: number; pendentes: number }

const zero = (): ContagemUsuarios => ({ total: 0, ativos: 0, desativados: 0, pendentes: 0 });

export function resumirUsuarios(usuarios: UsuarioLocal[]) {
  const geral = zero();
  const porPapel: Record<string, ContagemUsuarios> = {};
  for (const u of usuarios) {
    const c = (porPapel[u.papel] ??= zero());
    const ativo = usuarioAtivo(u);
    // Convite ainda não aceito não é ativo nem desativado: é pendente.
    const pendente = u.aceite?.toUpperCase() === "PENDING" && u.desativadoEm == null;
    for (const alvo of [geral, c]) {
      alvo.total++;
      if (pendente) alvo.pendentes++;
      else if (ativo) alvo.ativos++;
      else alvo.desativados++;
    }
  }
  return { ...geral, porPapel, comVinculoCrm: usuarios.filter((u) => u.crmUserId).length };
}

export interface EntradaRetrato {
  licencas: LicencaLocal[];
  planos: PlanoLocal[];
  usuarios: UsuarioLocal[];
  stripe: StripeLocal | null;
}

const MS_DIA = 86_400_000;

export function montarRetrato(e: EntradaRetrato, agora: Date) {
  const plano = new Map(e.planos.map((p) => [p.planId, p]));
  const vigentes = e.licencas.filter((l) => licencaVigente(l, agora));

  const porTipo: Record<TipoLicenca, { ativas: number; atribuidas: number; venceEm: Date | null }> = {
    trial: { ativas: 0, atribuidas: 0, venceEm: null }, pago: { ativas: 0, atribuidas: 0, venceEm: null },
    interno: { ativas: 0, atribuidas: 0, venceEm: null }, white_label: { ativas: 0, atribuidas: 0, venceEm: null },
    outro: { ativas: 0, atribuidas: 0, venceEm: null },
  };
  let vencendo30d = 0;
  for (const l of vigentes) {
    const t = porTipo[tipoDaLicenca(l.motivo)];
    t.ativas++;
    if (l.atribuida) t.atribuidas++;
    if (l.expiraEm && (!t.venceEm || l.expiraEm < t.venceEm)) t.venceEm = l.expiraEm;
    if (l.expiraEm && tipoDaLicenca(l.motivo) !== "trial" && l.expiraEm.getTime() - agora.getTime() <= 30 * MS_DIA) vencendo30d++;
  }

  // Plano por plano, entre as licenças vigentes (licença sem plano_id fica sob "(sem plano)").
  const grupos = new Map<string, { planId: string | null; tipo: TipoLicenca; qtd: number; atribuidas: number }>();
  for (const l of vigentes) {
    const tipo = tipoDaLicenca(l.motivo);
    const k = `${l.planId ?? ""}|${tipo}`;
    const g = grupos.get(k) ?? { planId: l.planId, tipo, qtd: 0, atribuidas: 0 };
    g.qtd++;
    if (l.atribuida) g.atribuidas++;
    grupos.set(k, g);
  }
  const porPlano = [...grupos.values()].map((g) => {
    const p = g.planId ? plano.get(g.planId) ?? null : null;
    return {
      planId: g.planId, nome: p?.nome ?? null, tipoLicenca: g.tipo, quantidade: g.qtd, atribuidas: g.atribuidas,
      precoTabela: p?.preco ?? null, stripePriceId: p?.stripePriceId ?? null, intervalo: p?.intervalo ?? null,
    };
  }).sort((a, b) => b.quantidade - a.quantidade);

  // O plano principal: o mais numeroso entre as licenças pagas; sem paga, o mais numeroso de qualquer tipo.
  const principal = porPlano.filter((p) => p.tipoLicenca === "pago")[0] ?? porPlano[0] ?? null;

  return {
    situacao: situacaoComercial(e.licencas, agora),
    pagante: clientePagante(e.licencas, agora),
    stripe: stripeDaOrganizacao(e.stripe),
    plano: { principal, porPlano },
    licencas: { ativas: vigentes.length, vencendo30d, porTipo },
    usuarios: resumirUsuarios(e.usuarios),
  };
}
