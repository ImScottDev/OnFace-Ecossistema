/**
 * Comandos de venda (SPEC §11, §15, §50.3).
 *
 * Cobre o risco financeiro central do sistema: o caminho único para ganho.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avaliarCondicaoDeGanho, verificarPodeCriarProposta, marcarPerdida,
  type RepositorioVendas, type Oportunidade,
} from "@onface/sales";
import type { OfertaComercial, EstadoOportunidade } from "@onface/catalog";

const OFERTA_CONTRATO: OfertaComercial = {
  id: "of-pabx", codigo: "PABX_CONTRACT", requiresCompanyBeforeProposal: true,
  requiresContract: true, winCondition: "CONTRACT_FULLY_SIGNED", paymentTrigger: "ON_CONTRACT_SIGNED",
  onboardingRequired: true, implementationRequired: true, permiteTrial: false,
};
const OFERTA_DIRETA: OfertaComercial = { ...OFERTA_CONTRATO, id: "of-ai", codigo: "CALLFACE_AI_DIRECT",
  requiresContract: false, winCondition: "PAYMENT_CONFIRMED", paymentTrigger: "ON_PROPOSAL_ACCEPTED", implementationRequired: false };

function repo(over: {
  op?: Partial<Oportunidade>; oferta?: OfertaComercial | null; estado?: Partial<EstadoOportunidade>;
} = {}) {
  const chamadas = { ganhou: 0, perdeu: 0, jornadas: 0 };
  const op: Oportunidade = {
    id: "op-1", organizacaoId: "org", empresaId: "emp-1", pessoaPrincipalId: null,
    servicoCatalogoId: "cat-1", ofertaComercialId: "of-pabx", status: "OPEN", etapaId: null, ...over.op,
  };
  const r: RepositorioVendas = {
    buscarOportunidade: async () => op,
    buscarOferta: async () => (over.oferta === undefined ? OFERTA_CONTRATO : over.oferta),
    estadoDaOportunidade: async () => ({
      temEmpresa: true, propostaAceita: false, contratoAssinadoPorCompleto: false,
      pagamentoConfirmado: false, aprovacaoManual: false, ...over.estado,
    }),
    marcarGanha: async () => { chamadas.ganhou++; },
    marcarPerdida: async () => { chamadas.perdeu++; },
    moverEtapa: async () => {},
    criarServicoEJornadas: async (_id, js) => { chamadas.jornadas = js.length; return { servicoId: "srv-1", jornadas: js.length }; },
  };
  return { r, chamadas };
}

test("contrato não assinado NÃO ganha, e diz o que falta", async () => {
  const { r, chamadas } = repo();
  const res = await avaliarCondicaoDeGanho(r, "op-1");
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.codigo, "CONDICAO_NAO_ATENDIDA");
  assert.deepEqual(!res.ok && res.falta, ["assinatura completa do contrato"]);
  assert.equal(chamadas.ganhou, 0, "nenhum caminho marca ganho por conta própria");
});

test("contrato assinado ganha e dispara onboarding E implantação", async () => {
  const { r, chamadas } = repo({ estado: { contratoAssinadoPorCompleto: true } });
  const res = await avaliarCondicaoDeGanho(r, "op-1");
  assert.equal(res.ok, true);
  assert.equal(chamadas.ganhou, 1);
  assert.equal(chamadas.jornadas, 2, "SPEC §18: PABX leva implantação além do onboarding");
});

test("oferta direta ignora contrato e exige pagamento", async () => {
  const { r, chamadas } = repo({ oferta: OFERTA_DIRETA, estado: { contratoAssinadoPorCompleto: true } });
  const res = await avaliarCondicaoDeGanho(r, "op-1");
  assert.equal(res.ok, false, "assinatura não compra nada numa venda direta");
  assert.equal(chamadas.ganhou, 0);
});

test("oportunidade SEM oferta não pode ser ganha", async () => {
  // As 1.084 sem família caem aqui. A segurança vem da política ser exigida,
  // não do dado estar vazio: o AS-IS mediu o contrário, e o backfill de
  // família teria acordado o problema.
  const { r, chamadas } = repo({ op: { ofertaComercialId: null } });
  const res = await avaliarCondicaoDeGanho(r, "op-1");
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.codigo, "SEM_OFERTA");
  assert.equal(chamadas.ganhou, 0);
});

test("oportunidade já ganha é idempotente, não ganha duas vezes", async () => {
  const { r, chamadas } = repo({ op: { status: "WON" } });
  const res = await avaliarCondicaoDeGanho(r, "op-1");
  assert.equal(res.ok, true);
  assert.equal(chamadas.ganhou, 0, "retry de webhook não pode duplicar serviço e onboarding");
});

test("oportunidade perdida não vira ganha sem reabrir", async () => {
  const { r } = repo({ op: { status: "LOST" }, estado: { contratoAssinadoPorCompleto: true } });
  const res = await avaliarCondicaoDeGanho(r, "op-1");
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.codigo, "PERDIDA");
});

test("proposta sem empresa é bloqueada no domínio", async () => {
  const { r } = repo({ op: { empresaId: null } });
  const res = await verificarPodeCriarProposta(r, "op-1");
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.codigo, "EMPRESA_OBRIGATORIA");
});

test("perda exige motivo", async () => {
  const { r, chamadas } = repo();
  assert.equal((await marcarPerdida(r, "op-1", "   ")).ok, false, "sem motivo não há o que aprender");
  assert.equal(chamadas.perdeu, 0);
  assert.equal((await marcarPerdida(r, "op-1", "preço acima do orçamento")).ok, true);
  assert.equal(chamadas.perdeu, 1);
});

test("ganha não vira perdida sem estorno", async () => {
  const { r, chamadas } = repo({ op: { status: "WON" } });
  const res = await marcarPerdida(r, "op-1", "desistiu");
  assert.equal(res.ok, false);
  assert.equal(chamadas.perdeu, 0, "reverter ganho mexe em MRR, serviço e CS: não é um UPDATE");
});
