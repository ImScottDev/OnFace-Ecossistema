import { test } from "node:test";
import assert from "node:assert/strict";
import { comDestinatario, destinatarioDoLead, enviarConfirmando, resumoDoEnvio } from "./envio-da-proposta";

test("destinatário vem do lead_id do negócio, não do casamento de nome", () => {
  const pessoas = [
    // mesmo nome do lead ("Scott"), mas é OUTRA pessoa (outro lead): não pode ser usada
    { leadId: "lead-outro", nome: "Scott", email: "errado@x.com", telefone: "1100000000" },
    // o contato certo, com sobrenome (nome diferente do lead) e só whatsapp preenchido
    { leadId: "lead-1", nome: "Scott Fulano", email: "scott@joao.com.br", telefone: "", whatsapp: "11988887777" },
  ];
  const d = destinatarioDoLead("lead-1", pessoas, { email: "reserva@x.com", telefone: "11911112222" });
  assert.deepEqual(d, { email: "scott@joao.com.br", telefone: "11988887777" });
  // sem pessoa com o lead_id, vale o lead; nunca o homônimo
  assert.deepEqual(destinatarioDoLead("lead-2", pessoas, { email: "lead@x.com", telefone: "11955554444" }), { email: "lead@x.com", telefone: "11955554444" });
  assert.deepEqual(destinatarioDoLead(null, pessoas, null), { email: "", telefone: "" });
});

test("rascunho gravado vazio não esconde o contato; o que o vendedor digitou fica", () => {
  const dest = { email: "c@x.com", telefone: "11999990000" };
  const velho = comDestinatario({ para: "", wa: " ", sigs: [{ nome: "Scott", email: "" }] }, dest);
  assert.equal(velho.para, "c@x.com");
  assert.equal(velho.wa, "11999990000");
  assert.equal(velho.sigs![0].email, "c@x.com");
  const digitado = comDestinatario({ para: "outro@x.com", wa: "11911110000", sigs: [{ nome: "S", email: "s@x.com" }] }, dest);
  assert.equal(digitado.para, "outro@x.com");
  assert.equal(digitado.sigs![0].email, "s@x.com");
});

test("só diz enviada depois que o servidor confirmou; erro solta a trava; clique duplo não grava duas vezes", async () => {
  const eventos: string[] = [];
  const trava = { ocupado: false };
  const hooks = {
    inicio: () => eventos.push("inicio"),
    sucesso: () => eventos.push("SUCESSO"),
    erro: (m: string) => eventos.push("erro:" + m),
  };
  let chamadas = 0;
  let soltar!: (r: { ok: true }) => void;
  const lento = () => { chamadas++; return new Promise<{ ok: true }>((res) => { soltar = res; }); };

  const p1 = enviarConfirmando(trava, lento, hooks);
  assert.deepEqual(eventos, ["inicio"]);                 // antes da resposta: nada de "enviada"
  assert.equal(await enviarConfirmando(trava, lento, hooks), "ocupado"); // segundo clique
  assert.equal(chamadas, 1);
  soltar({ ok: true });
  assert.equal(await p1, "ok");
  assert.deepEqual(eventos, ["inicio", "SUCESSO"]);

  eventos.length = 0;
  assert.equal(await enviarConfirmando(trava, async () => ({ ok: false as const, erro: "dados jurídicos incompletos" }), hooks), "erro");
  assert.deepEqual(eventos, ["inicio", "erro:dados jurídicos incompletos"]); // servidor recusou: nunca SUCESSO
  assert.equal(trava.ocupado, false);
  assert.equal(await enviarConfirmando(trava, async () => { throw new Error("rede"); }, hooks), "erro");
});

test("o resumo diz o que saiu, não o que foi marcado", () => {
  const r = resumoDoEnvio({ email: "enviado", destinatario: "a@b.com", emailVia: "resend", whatsapp: "sem_sessao" });
  assert.equal(r.falhou, true);
  assert.match(r.linhas.join(" "), /pelo e-mail do sistema/);
  assert.match(r.linhas.join(" "), /WhatsApp NÃO enviado: você não tem um número de WhatsApp conectado/);
  assert.equal(resumoDoEnvio({ email: "enviado", destinatario: "a@b.com", emailVia: "conta", emailDe: "u@c.com", whatsapp: "enviado" }).falhou, false);
});
