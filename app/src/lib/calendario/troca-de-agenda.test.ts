/**
 * Troca de responsável: o evento muda de calendário. Graph FALSO e banco em memória — nada sai
 * para a Microsoft e não precisa de DATABASE_URL.
 *
 *   cd app && npx tsx --test src/lib/calendario/troca-de-agenda.test.ts
 *
 * O que NÃO prova: o SQL de `portaTroca` (sincronizar.ts), o PATCH da rota nem o Graph real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { moverEventoDeCalendario, precisaMover, type PortaTroca, type RemocaoPendente, type ReuniaoParaTroca } from "./troca-de-agenda";
import type { CalendarProvider, EventoParaCriar, ResultadoProvider } from "./provider";

const ANA = "u-ana", BIA = "u-bia", CAIO = "u-caio";
const CONTA: Record<string, string> = { [ANA]: "conta-ana", [BIA]: "conta-bia" }; // Caio não conectou
const EMAIL: Record<string, string> = { "conta-ana": "ana@x.test", "conta-bia": "bia@x.test" };
const NOME: Record<string, string> = { [ANA]: "Ana", [BIA]: "Bia", [CAIO]: "Caio" };

/** Calendário falso: um Map de eventos por conta + registro de cada chamada + falhas programáveis. */
function calendarioFalso() {
  const eventos = new Map<string, Map<string, { id: string; titulo: string; inicio: string; fim: string; convidados: string[]; cancelado: boolean; comentario?: string | null }>>();
  const chamadas: string[] = [];
  const falhas = { criar: 0, cancelar: 0, contas: new Set<string>() };
  let seq = 0;
  const doConta = (c: string) => eventos.get(c) ?? eventos.set(c, new Map()).get(c)!;
  const provider: CalendarProvider = {
    nome: "microsoft",
    configurado: () => true,
    async contaDoUsuario(u) { return CONTA[u] && !falhas.contas.has(CONTA[u]) ? CONTA[u] : null; },
    async criar(conta, ev: EventoParaCriar): Promise<ResultadoProvider> {
      chamadas.push(`criar:${conta}`);
      if (falhas.criar > 0) { falhas.criar--; return { ok: false, motivo: "erro_provedor", detalhe: "Graph 503", tentarDeNovo: true }; }
      const id = `EV${++seq}`;
      doConta(conta).set(id, { id, titulo: ev.titulo, inicio: ev.inicioISO, fim: ev.fimISO, convidados: ev.convidados ?? [], cancelado: false });
      return { ok: true, eventId: id, joinUrl: `https://teams.test/${id}` };
    },
    async atualizar(): Promise<ResultadoProvider> { throw new Error("a troca nunca atualiza"); },
    async cancelar(conta, id, comentario): Promise<ResultadoProvider> {
      chamadas.push(`cancelar:${conta}:${id}`);
      if (falhas.cancelar > 0) { falhas.cancelar--; return { ok: false, motivo: "erro_provedor", detalhe: "Graph 503", tentarDeNovo: true }; }
      const e = doConta(conta).get(id);
      if (e) { e.cancelado = true; e.comentario = comentario; } // evento que já não existe: cancelar de novo não é erro
      return { ok: true, eventId: id };
    },
    async ocupados() { return { ok: true, faixas: [] }; },
  };
  const vivos = () => [...eventos.entries()].flatMap(([conta, m]) => [...m.values()].filter((e) => !e.cancelado).map((e) => ({ conta, ...e })));
  const nCriar = () => chamadas.filter((c) => c.startsWith("criar")).length;
  const nCancelar = () => chamadas.filter((c) => c.startsWith("cancelar")).length;
  return { provider, eventos, chamadas, falhas, vivos, nCriar, nCancelar, doConta };
}

/** Banco em memória com o mesmo contrato do `portaTroca`: reserva e compare-and-swap. */
function bancoFalso(cal: ReturnType<typeof calendarioFalso>) {
  const linha = {
    id: "r1", responsavelId: ANA, provider: "microsoft" as string | null, eventId: "", contaId: "conta-ana" as string | null,
    link: "https://teams.test/antigo" as string | null, status: "ok", erro: null as string | null, pendente: null as RemocaoPendente | null,
    reservado: false, falhaGravar: 0,
  };
  const porta: PortaTroca = {
    providerPorNome: (n) => (n === "microsoft" ? cal.provider : null),
    candidatos: () => [cal.provider],
    nomeDoUsuario: async (u) => NOME[u] ?? "?",
    emailDaConta: async (c) => EMAIL[c] ?? null,
    async reservar() { if (linha.reservado) return false; linha.reservado = true; linha.status = "pendente"; return true; },
    async gravarTroca(_id, de, para, pendente) {
      if (linha.falhaGravar > 0) { linha.falhaGravar--; throw new Error("conexão com o banco caiu"); }
      if (linha.eventId !== de.eventId || linha.contaId !== de.contaId) return false; // compare-and-swap
      Object.assign(linha, { provider: para.provider, eventId: para.eventId, contaId: para.contaId, link: para.link, pendente, status: "ok", erro: null, reservado: false });
      return true;
    },
    async falhar(_id, erro) { linha.status = "falhou"; linha.erro = erro; linha.reservado = false; },
    async remocaoConcluida() { linha.pendente = null; linha.status = "ok"; linha.erro = null; },
    async remocaoFalhou(_id, erro) { linha.status = "falhou"; linha.erro = erro; },
    esperar: async () => undefined,
  };
  /** O que a rota/`atualizarNaAgenda` monta a cada chamada, lido do estado atual. */
  const ler = (anteriorId: string | null = null): ReuniaoParaTroca => ({
    id: linha.id, titulo: "Demo ONFACE", inicioISO: "2026-10-20T12:00:00.000Z", fimISO: "2026-10-20T13:00:00.000Z", notas: "pauta",
    convidados: ["cliente@x.test", "bia@x.test"], responsavelId: linha.responsavelId, anteriorId,
    provider: linha.provider, eventId: linha.eventId, contaId: linha.contaId,
    donoDaConta: linha.contaId === "conta-ana" ? ANA : linha.contaId === "conta-bia" ? BIA : null, remocaoPendente: linha.pendente,
  });
  return { linha, porta, ler };
}

/** Reunião da Ana com o evento já no Outlook dela, e a Bia (ou o Caio) como novo responsável. */
async function cenario(novo: string) {
  const cal = calendarioFalso();
  const db = bancoFalso(cal);
  const r = await cal.provider.criar("conta-ana", { titulo: "Demo ONFACE", inicioISO: "2026-10-20T12:00:00.000Z", fimISO: "2026-10-20T13:00:00.000Z", convidados: ["cliente@x.test", "bia@x.test"] });
  assert.ok(r.ok && r.eventId);
  db.linha.eventId = r.eventId!;
  cal.chamadas.length = 0;
  db.linha.responsavelId = novo; // o ONFACE já gravou o responsável novo
  return { cal, db };
}

test("troca normal: cria na agenda da Bia, retira da da Ana, preserva horário, título, convidados; um evento vivo só", async () => {
  const { cal, db } = await cenario(BIA);
  const r = await moverEventoDeCalendario(db.porta, db.ler());

  assert.equal(r.estado, "movido");
  assert.equal(r.aviso, null);
  const vivos = cal.vivos();
  assert.equal(vivos.length, 1, "nunca nos dois calendários, nunca em nenhum");
  const [ev] = vivos;
  assert.equal(ev.conta, "conta-bia", "pela conta Microsoft da Bia");
  assert.equal(ev.titulo, "Demo ONFACE");
  assert.equal(ev.inicio, "2026-10-20T12:00:00.000Z");
  assert.equal(ev.fim, "2026-10-20T13:00:00.000Z");
  assert.deepEqual(ev.convidados, ["cliente@x.test"], "o cliente segue convidado; a Bia, agora organizadora, não se convida");
  assert.match(cal.doConta("conta-ana").values().next().value!.comentario ?? "", /movida para o calendário de Bia/);
  assert.equal(db.linha.eventId, ev.id);
  assert.equal(db.linha.contaId, "conta-bia");
  assert.equal(db.linha.link, `https://teams.test/${ev.id}`, "link novo da reunião, não o do evento cancelado");
  assert.equal(db.linha.pendente, null);
  assert.equal(db.linha.status, "ok");
  assert.equal(cal.nCriar(), 1);
  assert.equal(cal.nCancelar(), 1);
});

test("troca repetida: aplicar de novo não cria nem cancela nada", async () => {
  const { cal, db } = await cenario(BIA);
  await moverEventoDeCalendario(db.porta, db.ler());
  const antes = cal.chamadas.length;
  const eventoDepois = db.linha.eventId;

  for (let i = 0; i < 3; i++) {
    const r = await moverEventoDeCalendario(db.porta, db.ler(ANA)); // mesmo com o "anterior" informado
    assert.equal(r.estado, "sem_troca");
  }
  assert.equal(cal.chamadas.length, antes, "nenhuma chamada nova ao Graph");
  assert.equal(db.linha.eventId, eventoDepois);
  assert.equal(cal.vivos().length, 1);
});

test("duas trocas ao mesmo tempo: uma só cria o evento", async () => {
  const { cal, db } = await cenario(BIA);
  const [a, b] = await Promise.all([moverEventoDeCalendario(db.porta, db.ler()), moverEventoDeCalendario(db.porta, db.ler())]);
  assert.deepEqual([a.estado, b.estado].sort(), ["em_andamento", "movido"]);
  assert.equal(cal.nCriar(), 1);
  assert.equal(cal.nCancelar(), 1);
  assert.equal(cal.vivos().length, 1);
});

test("responsável sem conta conectada: nada é criado nem cancelado, o erro fica visível e a troca conclui quando ele conectar", async () => {
  const { cal, db } = await cenario(CAIO);
  const antigo = db.linha.eventId;
  const r = await moverEventoDeCalendario(db.porta, db.ler());

  assert.equal(r.estado, "pendente");
  assert.match(r.aviso ?? "", /Caio não tem calendário conectado/);
  assert.match(r.aviso ?? "", /continua no calendário de Ana/);
  assert.equal(cal.chamadas.length, 0, "cancelar sem ter para onde mover deixaria o cliente sem convite");
  assert.equal(db.linha.eventId, antigo);
  assert.equal(db.linha.contaId, "conta-ana");
  assert.equal(db.linha.status, "falhou");
  assert.match(db.linha.erro ?? "", /Caio não tem calendário/);
  assert.equal(cal.vivos().length, 1);

  // Caio conecta o Outlook; o worker (ou a próxima edição) repete e conclui.
  CONTA[CAIO] = "conta-caio"; EMAIL["conta-caio"] = "caio@x.test";
  try {
    const depois = await moverEventoDeCalendario(db.porta, { ...db.ler(), donoDaConta: ANA });
    assert.equal(depois.estado, "movido");
    assert.deepEqual(cal.vivos().map((e) => e.conta), ["conta-caio"]);
  } finally { delete CONTA[CAIO]; delete EMAIL["conta-caio"]; }
});

test("Graph falha ao criar no calendário novo: o evento segue só no antigo, e a nova tentativa não duplica", async () => {
  const { cal, db } = await cenario(BIA);
  const antigo = db.linha.eventId;
  cal.falhas.criar = 1;

  const r1 = await moverEventoDeCalendario(db.porta, db.ler());
  assert.equal(r1.estado, "pendente");
  assert.match(r1.aviso ?? "", /Graph 503/);
  assert.equal(db.linha.status, "falhou");
  assert.equal(db.linha.eventId, antigo);
  assert.deepEqual(cal.vivos().map((e) => e.conta), ["conta-ana"], "exatamente um calendário");
  assert.equal(cal.nCancelar(), 0, "o antigo não foi tocado");

  const r2 = await moverEventoDeCalendario(db.porta, db.ler());
  assert.equal(r2.estado, "movido");
  assert.deepEqual(cal.vivos().map((e) => e.conta), ["conta-bia"]);
});

test("Graph falha ao retirar o evento antigo: o novo já vale, a pendência fica gravada e só o cancelamento é repetido", async () => {
  const { cal, db } = await cenario(BIA);
  const antigo = db.linha.eventId;
  cal.falhas.cancelar = 1;

  const r1 = await moverEventoDeCalendario(db.porta, db.ler());
  assert.equal(r1.estado, "pendente");
  assert.ok(r1.eventId, "o evento novo existe e está vinculado");
  assert.equal(db.linha.contaId, "conta-bia");
  assert.equal(db.linha.status, "falhou");
  assert.match(db.linha.erro ?? "", /não consegui retirar o evento do calendário anterior/);
  assert.deepEqual(db.linha.pendente && { c: db.linha.pendente.contaId, e: db.linha.pendente.eventId }, { c: "conta-ana", e: antigo });
  assert.equal(cal.vivos().length, 2, "estado transitório e visível, nunca silencioso");

  const criadasAntes = cal.nCriar();
  const r2 = await moverEventoDeCalendario(db.porta, db.ler()); // o worker repete
  assert.equal(r2.estado, "sem_troca");
  assert.equal(r2.removidoDoAntigo, true);
  assert.equal(cal.nCriar(), criadasAntes, "não criou um terceiro evento");
  assert.deepEqual(cal.vivos().map((e) => e.conta), ["conta-bia"]);
  assert.equal(db.linha.pendente, null);
  assert.equal(db.linha.status, "ok");

  const nCancelar = cal.nCancelar();
  await moverEventoDeCalendario(db.porta, db.ler());
  assert.equal(cal.nCancelar(), nCancelar, "pendência cumprida não cancela de novo");
});

test("banco cai depois de criar o evento novo: o novo é desfeito, o antigo fica e nada vira órfão", async () => {
  const { cal, db } = await cenario(BIA);
  const antigo = db.linha.eventId;
  db.linha.falhaGravar = 99;

  const r = await moverEventoDeCalendario(db.porta, db.ler());
  assert.equal(r.estado, "pendente");
  assert.match(r.aviso ?? "", /não consegui registrar a troca/i);
  assert.equal(db.linha.eventId, antigo);
  assert.equal(db.linha.status, "falhou");
  assert.deepEqual(cal.vivos().map((e) => e.conta), ["conta-ana"], "o evento novo foi cancelado: um calendário só");
});

test("reunião anterior à 0110 (sem conta vinculada): usa o responsável anterior para achar o evento antigo", async () => {
  const { cal, db } = await cenario(BIA);
  db.linha.contaId = null; // calendar_conta_id nulo
  const r = await moverEventoDeCalendario(db.porta, db.ler(ANA));
  assert.equal(r.estado, "movido");
  assert.deepEqual(cal.vivos().map((e) => e.conta), ["conta-bia"]);
});

test("precisaMover: o gatilho é o estado, não o evento 'mudou'", () => {
  assert.equal(precisaMover({ donoDaConta: ANA, anteriorId: null, responsavelId: BIA }), true);
  assert.equal(precisaMover({ donoDaConta: BIA, anteriorId: ANA, responsavelId: BIA }), false);
  assert.equal(precisaMover({ donoDaConta: null, anteriorId: null, responsavelId: BIA }), false, "sem saber quem é o dono, não arrisca mover");
  assert.equal(precisaMover({ donoDaConta: null, anteriorId: ANA, responsavelId: BIA }), true);
});
