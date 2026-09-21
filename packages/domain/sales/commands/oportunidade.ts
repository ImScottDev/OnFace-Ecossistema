/**
 * Comandos de venda (SPEC §11, §15, §47).
 *
 * Toda mudança de estado comercial passa por aqui. Hoje são 30 caminhos
 * escrevendo em `negocios`, e é por isso que `service_family` está vazio em
 * 99,5% e `proxima_acao` em 99,1%: cada caminho preenche o que conhece.
 *
 * A regra mais importante deste arquivo é a do SPEC §15:
 *
 *   "No route, webhook or UI may independently mark an opportunity won by
 *    ad-hoc conditions. All paths call the same evaluateWinCondition."
 *
 * Era literalmente o contrário: `won_evidence_policies` liberava ganho para
 * PABX com contrato assinado sozinho, sem pagamento, enquanto o código
 * documentava que isso nunca poderia acontecer.
 *
 * Pacote de domínio: sem SDK, sem framework, sem ORM.
 */
import { avaliarGanho, podeCriarProposta, jornadasPosVenda, type OfertaComercial, type EstadoOportunidade } from "../../catalog/policies/politica-oferta";

export type StatusOportunidade = "OPEN" | "WON" | "LOST";

export interface Oportunidade {
  id: string;
  organizacaoId: string;
  empresaId: string | null;
  pessoaPrincipalId: string | null;
  servicoCatalogoId: string | null;
  ofertaComercialId: string | null;
  status: StatusOportunidade;
  etapaId: string | null;
}

export interface RepositorioVendas {
  buscarOportunidade(id: string): Promise<Oportunidade | null>;
  buscarOferta(id: string): Promise<OfertaComercial | null>;
  /** Estado factual da oportunidade: o que já aconteceu com ela. */
  estadoDaOportunidade(id: string): Promise<EstadoOportunidade>;
  marcarGanha(id: string, em: Date, motivo: string): Promise<void>;
  marcarPerdida(id: string, em: Date, motivo: string): Promise<void>;
  moverEtapa(id: string, etapaId: string): Promise<void>;
  /** Cria serviço do cliente e as jornadas de pós-venda da oferta (SPEC §18). */
  criarServicoEJornadas(oportunidadeId: string, jornadas: ("ONBOARDING" | "IMPLEMENTATION")[]): Promise<{ servicoId: string | null; jornadas: number }>;
}

export type Resultado<T = void> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; codigo: string; falta?: string[] };

/**
 * Avalia e, se a política permitir, marca a oportunidade como ganha.
 *
 * Este é o único caminho para ganho. Quem chama pode ser a rota, o webhook do
 * Stripe, o do Documenso, o worker ou o agente: a resposta é a mesma.
 */
export async function avaliarCondicaoDeGanho(
  repo: RepositorioVendas, oportunidadeId: string, agora: Date = new Date(),
): Promise<Resultado<{ ganhou: boolean; motivo: string; servicoId?: string | null; jornadas?: number }>> {
  const op = await repo.buscarOportunidade(oportunidadeId);
  if (!op) return { ok: false, erro: "oportunidade não encontrada", codigo: "NAO_ENCONTRADA" };
  if (op.status === "WON") return { ok: true, dados: { ganhou: true, motivo: "já estava ganha" } };
  if (op.status === "LOST") return { ok: false, erro: "oportunidade perdida não vira ganha sem reabrir", codigo: "PERDIDA" };

  if (!op.ofertaComercialId) {
    // Sem oferta não há política, e sem política não se decide ganho. É o caso
    // das 1.084 oportunidades sem família: elas não podem ser ganhas por
    // engano justamente porque a política está ausente, não porque é
    // permissiva. O AS-IS registrou o contrário: a segurança vinha do dado
    // estar vazio, e o backfill de família teria acordado o problema.
    return { ok: false, erro: "oportunidade sem oferta comercial: a política de ganho é indefinida", codigo: "SEM_OFERTA" };
  }

  const oferta = await repo.buscarOferta(op.ofertaComercialId);
  if (!oferta) return { ok: false, erro: "oferta comercial não encontrada", codigo: "OFERTA_INVALIDA" };

  const estado = await repo.estadoDaOportunidade(oportunidadeId);
  const decisao = avaliarGanho(oferta, estado);
  if (!decisao.ganha) {
    return { ok: false, erro: decisao.motivo, codigo: "CONDICAO_NAO_ATENDIDA", falta: decisao.falta };
  }

  await repo.marcarGanha(oportunidadeId, agora, decisao.motivo);
  // SPEC §18: todo serviço ganho passa por onboarding; PABX e White Label
  // levam implantação junto.
  const pos = await repo.criarServicoEJornadas(oportunidadeId, jornadasPosVenda(oferta));
  return { ok: true, dados: { ganhou: true, motivo: decisao.motivo, servicoId: pos.servicoId, jornadas: pos.jornadas } };
}

/** SPEC §11.1: proposta exige empresa, e a regra vive no domínio, não na tela. */
export async function verificarPodeCriarProposta(
  repo: RepositorioVendas, oportunidadeId: string,
): Promise<Resultado<{ empresaId: string }>> {
  const op = await repo.buscarOportunidade(oportunidadeId);
  if (!op) return { ok: false, erro: "oportunidade não encontrada", codigo: "NAO_ENCONTRADA" };
  const oferta = op.ofertaComercialId ? await repo.buscarOferta(op.ofertaComercialId) : null;
  const exigeEmpresa = oferta?.requiresCompanyBeforeProposal ?? true;

  if (!op.empresaId) {
    if (!exigeEmpresa) return { ok: false, erro: "oportunidade sem empresa", codigo: "SEM_EMPRESA" };
    const d = podeCriarProposta(
      oferta ?? { id: "", codigo: "", requiresCompanyBeforeProposal: true, requiresContract: false,
                  winCondition: "MANUAL_APPROVAL", paymentTrigger: "MANUAL",
                  onboardingRequired: true, implementationRequired: false },
      { temEmpresa: false },
    );
    return { ok: false, erro: d.ganha ? "empresa ausente" : d.motivo, codigo: "EMPRESA_OBRIGATORIA", falta: d.ganha ? undefined : d.falta };
  }
  return { ok: true, dados: { empresaId: op.empresaId } };
}

/** Perda é decisão humana e exige motivo: sem motivo não há o que aprender. */
export async function marcarPerdida(
  repo: RepositorioVendas, oportunidadeId: string, motivo: string, agora: Date = new Date(),
): Promise<Resultado> {
  if (!motivo || !motivo.trim()) {
    return { ok: false, erro: "informe o motivo da perda", codigo: "MOTIVO_OBRIGATORIO" };
  }
  const op = await repo.buscarOportunidade(oportunidadeId);
  if (!op) return { ok: false, erro: "oportunidade não encontrada", codigo: "NAO_ENCONTRADA" };
  if (op.status === "WON") return { ok: false, erro: "oportunidade ganha não vira perdida sem estorno", codigo: "JA_GANHA" };
  await repo.marcarPerdida(oportunidadeId, agora, motivo.trim());
  return { ok: true, dados: undefined };
}
