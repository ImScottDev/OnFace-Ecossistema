import { test } from "node:test";
import assert from "node:assert/strict";
import { clientePagante, montarRetrato, resumirUsuarios, situacaoComercial, stripeDaOrganizacao, usuarioAtivo, type LicencaLocal, type UsuarioLocal } from "./retrato-regras";

const AGORA = new Date("2026-10-13T12:00:00Z");
const lic = (o: Partial<LicencaLocal> = {}): LicencaLocal => ({
  licenseId: "l1", planId: "p1", motivo: "SUBSCRIPTION_PAID", revogadaEm: null, expiraEm: null, atribuida: true, ...o,
});
const usr = (o: Partial<UsuarioLocal> = {}): UsuarioLocal => ({
  papel: "EMPLOYEE", aceite: "ACCEPTED", convite: null, desativadoEm: null, usuarioAtivo: true, crmUserId: null, ...o,
});

test("trial não conta como cliente pagante", () => {
  const soTrial = [lic({ motivo: "TRIAL" }), lic({ licenseId: "l2", motivo: "TRIAL" })];
  assert.equal(clientePagante(soTrial, AGORA), false);
  assert.equal(situacaoComercial(soTrial, AGORA), "trial");
  assert.equal(clientePagante([...soTrial, lic({ licenseId: "l3" })], AGORA), true);
  assert.equal(clientePagante([lic({ motivo: "INTERNAL" })], AGORA), false, "interno não paga");
  assert.equal(situacaoComercial([lic({ motivo: "PARTNER_WHITE_LABEL" })], AGORA), "via_parceiro");
});

test("licença paga expirada ou revogada não faz pagante; teste vencido não vira nada", () => {
  assert.equal(clientePagante([lic({ expiraEm: new Date("2026-10-01T00:00:00Z") })], AGORA), false);
  assert.equal(clientePagante([lic({ expiraEm: AGORA })], AGORA), false, "expira_em > agora é estrito");
  assert.equal(clientePagante([lic({ revogadaEm: new Date("2026-10-02T00:00:00Z") })], AGORA), false);
  assert.equal(situacaoComercial([], AGORA), "sem_licenca_ativa");
});

test("usuário desativado não conta como ativo", () => {
  assert.equal(usuarioAtivo(usr()), true);
  assert.equal(usuarioAtivo(usr({ desativadoEm: new Date("2026-09-01T00:00:00Z") })), false);
  assert.equal(usuarioAtivo(usr({ usuarioAtivo: false })), false);
  const r = resumirUsuarios([
    usr({ papel: "CREATOR" }), usr({ papel: "ADMIN" }), usr({ desativadoEm: new Date("2026-09-01T00:00:00Z") }),
    usr({ aceite: "PENDING" }), usr({ crmUserId: "u-1" }),
  ]);
  assert.equal(r.total, 5);
  assert.equal(r.ativos, 3);
  assert.equal(r.desativados, 1);
  assert.equal(r.pendentes, 1);
  assert.equal(r.porPapel.EMPLOYEE.desativados, 1);
  assert.equal(r.porPapel.CREATOR.ativos, 1);
  assert.equal(r.comVinculoCrm, 1);
});

test("organização sem Stripe aparece como não conectada", () => {
  assert.deepEqual(stripeDaOrganizacao({ stripeCustomerId: null, migrado: false }), { conectado: false, estado: "nao_conectado", stripeCustomerId: null, migrado: false });
  assert.equal(stripeDaOrganizacao({ stripeCustomerId: "  ", migrado: true }).conectado, false, "string vazia não conecta");
  assert.equal(stripeDaOrganizacao(null).estado, "nao_conectado", "sem linha no espelho também");
  assert.equal(stripeDaOrganizacao({ stripeCustomerId: "cus_x", migrado: null }).conectado, true);
});

test("retrato: plano principal é o da licença paga, com o preço de tabela", () => {
  const r = montarRetrato({
    licencas: [lic(), lic({ licenseId: "l2" }), lic({ licenseId: "l3", planId: "p2", motivo: "TRIAL" })],
    planos: [{ planId: "p1", nome: "Professional", preco: 119.9, stripePriceId: "price_1", intervalo: "month" }, { planId: "p2", nome: "Full", preco: 179.9, stripePriceId: null, intervalo: null }],
    usuarios: [], stripe: null,
  }, AGORA);
  assert.equal(r.plano.principal?.nome, "Professional");
  assert.equal(r.plano.principal?.precoTabela, 119.9);
  assert.equal(r.plano.principal?.quantidade, 2);
  assert.equal(r.licencas.porTipo.trial.ativas, 1);
  assert.equal(r.pagante, true);
  assert.equal(r.stripe.estado, "nao_conectado");
});
