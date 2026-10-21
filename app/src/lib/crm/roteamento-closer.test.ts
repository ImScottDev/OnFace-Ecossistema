import { strict as assert } from "node:assert";
import { test } from "node:test";
import { motivoIndisponivel, regraQueCasa, type Regra } from "./roteamento-closer";

/* As duas regras que estavam vigentes na Callface em 21/10/2026: as duas casam
   SÓ por campanha, nenhuma tem família nem curinga. Nessa configuração, 2.905
   dos 4.559 leads da organização não casavam com regra nenhuma — e o agente
   recebia "nenhuma regra de roteamento cobre esta família/campanha" em vez de
   horário. Daí o rodízio como destino padrão (resolverCloser). */
const BASE = {
  id: "r", organizacaoId: "o", nome: "regra", ativa: true, prioridade: 100, familia: null, campanha: null,
  destinoUsuarioId: null, fallback: "fila_humana", vigenteDe: null, vigenteAte: null,
  createdAt: new Date(), updatedAt: new Date(),
} as unknown as Regra;

const AGORA = new Date("2026-10-21T12:00:00Z");
const PROD: Regra[] = [
  { ...BASE, id: "mayra", nome: "Callface AI → Mayra", campanha: "TRT - CALL FACE [2026]" },
  { ...BASE, id: "mayara", nome: "White Label → Mayara", campanha: "TRT | Lead | Aquisição White Label — II" },
];

test("campanha exata casa a regra", () => {
  assert.equal(regraQueCasa(PROD, { campanha: "TRT - CALL FACE [2026]" }, AGORA)?.id, "mayra");
});

test("campanha com sufixo ainda casa (continência, sem acento)", () => {
  assert.equal(regraQueCasa(PROD, { campanha: "TRT | Lead | Aquisicao White Label — II- callface" }, AGORA)?.id, "mayara");
});

test("lead sem campanha de regra não casa nada — por isso o destino tem de ser o rodízio", () => {
  for (const campanha of ["unknown", "Site", "(direct)", null]) {
    assert.equal(regraQueCasa(PROD, { campanha }, AGORA), null, `campanha ${campanha}`);
  }
  // Família não salva: as regras vigentes não declaram família.
  assert.equal(regraQueCasa(PROD, { familia: "PABX" }, AGORA), null);
});

test("quem não é closer não recebe reunião, e o motivo diz isso", () => {
  const scott = { nome: "Scott Ferraz", ativo: true, tipo: "humano", role: "super_admin" };
  const disp = { ativo: true, pausado: false };
  assert.match(motivoIndisponivel(scott, disp) ?? "", /não está na fila de closers/);
});

test("closer ativa com agenda configurada está disponível", () => {
  assert.equal(motivoIndisponivel({ nome: "Mayra", ativo: true, tipo: "humano", role: "closer" }, { ativo: true, pausado: false }), null);
});

test("inativa, agente, sem agenda e pausada têm cada um seu motivo", () => {
  const closer = { nome: "X", ativo: true, tipo: "humano", role: "closer" };
  assert.match(motivoIndisponivel({ ...closer, ativo: false }, { ativo: true, pausado: false }) ?? "", /inativo/);
  assert.match(motivoIndisponivel({ ...closer, tipo: "agente" }, { ativo: true, pausado: false }) ?? "", /é um agente/);
  assert.match(motivoIndisponivel(closer, null) ?? "", /não configurou a agenda/);
  assert.match(motivoIndisponivel(closer, { ativo: true, pausado: true }) ?? "", /pausada/);
});
