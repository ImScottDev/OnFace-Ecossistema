/**
 * O painel é só composição: cada número tem que ser o do catálogo, e nada some em silêncio nem vira zero.
 * Roda contra o banco local (cópia de produção).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { definicao, medir } from "./catalogo";
import { consultaDe, razao } from "./derivadas";
import { explorar } from "./explorar";
import { lerPedido } from "./consulta";
import { montarPainelGeral, type Cartao, type PainelGeral, type ParamsPainel } from "./painel-geral";

const centavos = (n: unknown) => Math.round(Number(n) * 100);
const AGORA = new Date("2026-10-21T15:00:00-03:00");
const base: ParamsPainel = { periodo: "12m", testes: false, serie: "12m" };

async function organizacao(): Promise<string> {
  const [o] = await db.execute<{ id: string }>(sql`SELECT organizacao_id::text AS id FROM cliente_receita_mensal LIMIT 1`);
  return o.id;
}

const cartoesDe = (p: PainelGeral): Cartao[] =>
  [p.blocos.receita, p.blocos.carteira, p.blocos.aquisicao, p.blocos.conversao, p.blocos.pipeline, p.blocos.metas].flatMap((b) => b.cartoes);

const VARIACOES: ParamsPainel[] = [
  base,
  { ...base, periodo: "mes_passado" },
  { ...base, periodo: "90d", familia: "PABX" },
  { ...base, periodo: "mes_atual", testes: true },
];

test("cada cartão de métrica é o medir() da própria métrica, no mesmo recorte", async () => {
  const org = await organizacao();
  let comparados = 0;
  for (const params of VARIACOES) {
    const painel = await montarPainelGeral(org, params, "admin", AGORA);
    for (const c of cartoesDe(painel)) {
      if (c.tipo !== "metrica" || c.valor === null) continue;
      const ped = lerPedido(c.codigo, consultaDe(params), AGORA)!;
      const esperado = (await medir(org, c.codigo, ped.p)).valor;
      assert.equal(centavos(c.valor), centavos(esperado), `${c.codigo} (${params.periodo}/${params.familia ?? "todas"}): o painel não mostra o número do catálogo`);
      comparados++;
    }
  }
  assert.ok(comparados > 40, `só ${comparados} cartões comparados: o teste não provaria nada`);
});

test("cartão que não está disponível nem parcial tem valor null: sem zero bonito", async () => {
  const org = await organizacao();
  let semValor = 0;
  for (const params of VARIACOES) {
    for (const c of cartoesDe(await montarPainelGeral(org, params, "admin", AGORA))) {
      if (c.estado === "disponivel" || c.estado === "parcial") {
        assert.notEqual(c.valor, null, `${c.codigo} está ${c.estado} mas sem valor`);
        continue;
      }
      semValor++;
      assert.equal(c.valor, null, `${c.codigo} (${c.estado}) carrega valor ${c.valor}`);
      assert.equal(c.registros, null, `${c.codigo} (${c.estado}) carrega registros`);
      assert.ok(c.motivo, `${c.codigo} (${c.estado}) não diz por quê`);
    }
  }
  assert.ok(semValor > 0, "nenhum cartão indisponível: o recorte de teste não exercitou o estado honesto");
});

test("os estados honestos que o banco real exige aparecem: ponderado sem probabilidade, previsto sem previsão, mês aberto, avulso inexistente", async () => {
  const org = await organizacao();
  const p = await montarPainelGeral(org, { ...base, periodo: "mes_atual" }, "admin", AGORA);
  const por = Object.fromEntries(cartoesDe(p).map((c) => [c.id, c]));
  assert.equal(por.pipeline_ponderado.estado, "indisponivel", "nenhuma oportunidade aberta tem probabilidade: ponderado não pode ser 0");
  assert.equal(por.pipeline_ponderado.motivo?.codigo, "sem_dado_na_fonte");
  assert.equal(por.pipeline_previsto.estado, "indisponivel");
  assert.equal(por.faturamento_competencia.estado, "indisponivel", "outubro ainda não fechou: ausente, nunca zero");
  assert.equal(por.receita_avulsa.estado, "indisponivel", "a fonte não tem nenhuma linha ONE_TIME");
  assert.notEqual(por.pipeline_aberto.estado, "disponivel", "pipeline_aberto soma só quem tem valor: tem que avisar o preenchimento");
  assert.ok(por.pipeline_aberto.cobertura?.preenchimento && por.pipeline_aberto.cobertura.preenchimento.preenchido < por.pipeline_aberto.cobertura.preenchimento.universo);
});

test("o drill de todo cartão é um recorte válido e abre o mesmo valor", async () => {
  const org = await organizacao();
  let abertos = 0, razoes = 0;
  for (const params of VARIACOES) {
    for (const c of cartoesDe(await montarPainelGeral(org, params, "admin", AGORA))) {
      if (c.valor === null && c.tipo === "metrica") continue;
      if (!c.drill) { assert.equal(c.estado === "nao_aplicavel" || c.valor === null, true, `${c.id} disponível e sem drill`); continue; }
      const [codigo, q = ""] = c.drill.split("?");
      const ped = lerPedido(codigo, new URLSearchParams(q), AGORA);
      assert.ok(ped, `${c.id}: drill ${c.drill} não é um recorte válido`);
      const x = await explorar(org, codigo, ped.p, ped.selecao, 1, 5);
      assert.ok(x, `${c.id}: drill não abriu`);
      if (c.tipo === "metrica") {
        assert.equal(centavos(x.selecionado.valor), centavos(c.valor), `${c.id}: o drill abre ${x.selecionado.valor}, o cartão mostra ${c.valor}`);
        assert.equal(x.selecionado.registros, c.registros, `${c.id}: o drill abre ${x.selecionado.registros} linhas, o cartão diz ${c.registros}`);
        abertos++;
      } else {
        // Razão: o clique abre o operando declarado, com a mesma janela alinhada.
        const def = razao(c.codigo)!;
        const operando = (def.drillDe === "numerador" ? def.numerador : def.denominador)[0];
        const esperado = def.drillDe === "numerador" ? c.razao!.numerador : c.razao!.denominador;
        const lido = operando.grandeza === "valor" ? x.selecionado.valor : x.selecionado.registros;
        assert.equal(centavos(lido), centavos(esperado), `${c.id}: o drill (${c.drill}) não abre o ${def.drillDe} da razão`);
        razoes++;
      }
    }
  }
  assert.ok(abertos > 40 && razoes > 0, `drills abertos: ${abertos}, razões: ${razoes}`);
});

test("filtro de família numa métrica que não o aplica vira nao_aplicavel, não zero", async () => {
  const org = await organizacao();
  const p = await montarPainelGeral(org, { ...base, familia: "PABX" }, "admin", AGORA);
  const recebido = p.blocos.receita.cartoes.find((c) => c.id === "recebido")!;
  assert.equal(recebido.estado, "nao_aplicavel");
  assert.equal(recebido.valor, null);
  assert.equal(recebido.motivo?.codigo, "filtro_nao_suportado");
  const aplicavel = p.blocos.receita.cartoes.find((c) => c.id === "faturamento_competencia")!;
  assert.notEqual(aplicavel.estado, "nao_aplicavel", "faturamento por competência aplica família");
  const conv = p.blocos.conversao.cartoes.find((c) => c.id === "conversao_lead_oportunidade")!;
  assert.equal(conv.estado, "nao_aplicavel", "uma razão cujo operando não aplica o filtro também não se aplica");
  assert.equal(conv.valor, null);
});

test("sem acesso: todo cartão indisponível, sem valor, e o painel não cai", async () => {
  const org = await organizacao();
  const p = await montarPainelGeral(org, base, "sdr", AGORA);
  const cartoes = cartoesDe(p);
  assert.ok(cartoes.length > 20);
  for (const c of cartoes) {
    assert.equal(c.estado, "indisponivel", c.id);
    assert.equal(c.motivo?.codigo, "sem_acesso", c.id);
    assert.equal(c.valor, null, c.id);
    assert.equal(c.drill, null, `${c.id} entrega o caminho de uma métrica que o papel não vê`);
  }
  assert.equal(p.blocos.evolucao.estado, "indisponivel");
  assert.equal(p.blocos.evolucao.pontos.length, 0);
  assert.equal(p.blocos.composicao.total, null);
  assert.equal(p.blocos.receita.avisos.length, 0, "o aviso carrega valor de MRR: sem acesso, sem aviso");
  assert.ok(p.blocos.alertas.alertas.every((a) => a.situacao === "indisponivel" && a.valor === null && a.frase === null));
});

test("avisos de White Label e lacunas vêm do servidor", async () => {
  const org = await organizacao();
  const p = await montarPainelGeral(org, base, "admin", AGORA);
  const [wl] = p.blocos.receita.avisos;
  assert.ok(wl, "White Label tem MRR sem recorrência confirmada: o aviso é obrigatório");
  assert.equal(wl.codigo, "white_label_sem_recorrencia");
  assert.equal(centavos(wl.valor), centavos((await medir(org, "mrr_atual", { familia: "WHITE_LABEL" })).valor), "o aviso usa o MRR do catálogo, não um número solto");
  assert.ok(wl.competenciasComMrr < wl.competenciasReferencia);
  assert.equal(wl.drill, "mrr_atual?familia=WHITE_LABEL");
  const soPabx = await montarPainelGeral(org, { ...base, familia: "PABX" }, "admin", AGORA);
  assert.equal(soPabx.blocos.receita.avisos.length, 0, "filtrado em PABX o aviso de White Label não se aplica");
  assert.ok(p.lacunas.length >= 4 && p.lacunas.every((l) => l.titulo && l.motivo));
});

test("alertas: métrica que prova, limiar versionado e frase com o número", async () => {
  const org = await organizacao();
  const { blocos } = await montarPainelGeral(org, base, "admin", AGORA);
  const a = blocos.alertas;
  assert.ok(a.versaoLimiares);
  const risco = a.alertas.find((x) => x.id === "mrr_em_risco")!;
  assert.equal(risco.situacao, "disparado");
  assert.equal(centavos(risco.valor), centavos((await medir(org, "mrr_em_risco")).valor));
  assert.ok(risco.frase!.includes("31") || /\d/.test(risco.frase!), "a frase cita o número");
  for (const x of a.alertas) {
    assert.ok(x.limiar.versao && x.limiar.descricao, x.id);
    if (x.situacao === "disparado") { assert.ok(x.frase && x.drill, `${x.id} dispara sem frase ou sem drill`); assert.ok(definicao(x.metrica), x.id); }
    if (x.situacao === "indisponivel") assert.equal(x.valor, null, x.id);
  }
});

test("isolamento: organização sem dados recebe painel vazio, nunca dado de outra", async () => {
  const [o] = await db.execute<{ id: string }>(sql`
    INSERT INTO organizacoes (nome, slug) VALUES (${"[QA] painel org"}, ${"qa-painel-" + Date.now().toString(36)}) RETURNING id::text`);
  try {
    for (const params of [base, { ...base, periodo: "tudo" }]) {
      const p = await montarPainelGeral(o.id, params, "admin", AGORA);
      for (const c of cartoesDe(p)) {
        assert.ok(c.valor === null || c.valor === 0, `${c.id} vazou ${c.valor} para uma organização vazia`);
        assert.ok(c.registros === null || c.registros === 0, `${c.id} vazou registros`);
        if (c.tipo === "razao") assert.equal(c.valor, null, `${c.id}: razão de organização vazia não pode ser número`);
      }
      assert.equal(p.blocos.evolucao.pontos.length, 0);
      assert.equal(p.blocos.composicao.total === null || p.blocos.composicao.total === 0, true);
      assert.deepEqual(p.blocos.composicao.dimensoes.flatMap((d) => d.itens), []);
      assert.equal(p.blocos.receita.avisos.length, 0);
      assert.equal(p.blocos.alertas.alertas.filter((a) => a.situacao === "disparado").length, 0);
    }
  } finally {
    await db.execute(sql`DELETE FROM organizacoes WHERE id = ${o.id}::uuid`);
  }
});

test("o painel monta em tempo razoável (alarme se alguém voltar a usar explorar() nos cartões)", async () => {
  const org = await organizacao();
  const t0 = Date.now();
  await montarPainelGeral(org, base, "admin", AGORA);
  assert.ok(Date.now() - t0 < 15_000, "o painel demorou mais de 15s: alguém voltou a usar explorar() nos cartões?");
});
