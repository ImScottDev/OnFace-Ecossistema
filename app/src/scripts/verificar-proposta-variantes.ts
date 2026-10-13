/**
 * Verificação ponta a ponta: o MESMO produto entra várias vezes na proposta.
 *
 * Cria um catálogo de teste com produto de várias variantes (Hardware: dois
 * aparelhos avulsos e uma locação mensal) e monta propostas com o mesmo produto
 * em várias linhas, uma delas repetindo o MESMO preço. Depois confere, no banco
 * local, o ciclo inteiro pelas mesmas funções que a tela usa:
 *
 *   linhas do editor -> itensParaCriar -> criar/atualizar rascunho
 *   -> releitura pela consulta da tela (lerPropostasDoNegocio) -> totais
 *   -> enviar -> contrato (PABX) e checkout (Callface AI)
 *
 * O Stripe é SUBSTITUÍDO por um `fetch` falso que só reconhece api.stripe.com e
 * grava o corpo recebido: nenhuma chamada sai da máquina, e o que o checkout
 * mandaria ao Stripe fica conferido linha a linha. Qualquer outro host derruba.
 *
 * Tudo que cria leva o prefixo de `MARCA` e é removido no fim, mesmo com falha.
 *
 * Uso: npx tsx --env-file=.env src/scripts/verificar-proposta-variantes.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogoPrecos, servicosCatalogo } from "@/lib/db/schema";
import { atorHumano } from "@/lib/vendas/dominio";
import * as preVendas from "@/lib/vendas/pre-vendas";
import * as pipeline from "@/lib/vendas/pipeline";
import * as motor from "@/lib/vendas/propostas";
import { atualizarItensDoRascunho, criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { formarGruposComerciais } from "@/lib/crm/grupo-comercial";
import { gerarContratoDeTemplate } from "@/lib/crm/contrato-template";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { itensParaCriar } from "@/components/onface/proto/linhas-da-proposta";
import { catalogoDoDesenho } from "@/components/onface/proto/catalogo-do-desenho";
import { limparCenariosDeAceite } from "./_limpeza-aceite";

const MARCA = "[VERIF-VARIANTES]";

let falhou = 0;
function ok(titulo: string, condicao: boolean, detalhe?: string) {
  if (!condicao) falhou += 1;
  console.log(`  ${condicao ? "✔" : "✘"} ${titulo}${!condicao && detalhe ? ` — ${detalhe}` : ""}`);
}
const cent = (v: number) => Math.round(v * 100) / 100;

/* ── Stripe falso: grava o que o checkout mandaria ───────────────────── */
const chamadasStripe: Array<{ metodo: string; caminho: string; corpo: URLSearchParams }> = [];
function instalarStripeFalso() {
  process.env.STRIPE_API_KEY = "sk_test_verificacao_local";
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_CHECKOUT_MODE;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const alvo = String(url instanceof Request ? url.url : url);
    if (!alvo.startsWith("https://api.stripe.com/v1/")) throw new Error(`fetch bloqueado fora do Stripe falso: ${alvo}`);
    const caminho = alvo.slice("https://api.stripe.com/v1/".length);
    const metodo = init?.method ?? "GET";
    chamadasStripe.push({ metodo, caminho, corpo: new URLSearchParams(String(init?.body ?? "")) });
    const resposta = caminho.startsWith("customers?") ? { data: [] }
      : caminho === "customers" ? { id: "cus_test_verificacao" }
      : caminho === "coupons" ? { id: "coupon_test_verificacao" }
      : caminho === "checkout/sessions" ? { id: "cs_test_verificacao", url: "https://checkout.stripe.test/verificacao" }
      : null;
    if (!resposta) throw new Error(`rota do Stripe falso não prevista: ${metodo} ${caminho}`);
    return new Response(JSON.stringify(resposta), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

/* ── Catálogo de teste ───────────────────────────────────────────────── */
interface PrecoTeste { chave: string; variacao: string; valor: number; tipo: "recorrente" | "avulso"; natureza: string }
interface ProdutoTeste { chave: string; nome: string; familia: "PABX" | "CALLFACE_AI"; precos: PrecoTeste[] }

const PRODUTOS: ProdutoTeste[] = [
  { chave: "hw", nome: `${MARCA} PABX - Hardware`, familia: "PABX", precos: [
    { chave: "basico", variacao: "Telefone IP básico", valor: 389, tipo: "avulso", natureza: "HARDWARE" },
    { chave: "giga", variacao: "Telefone IP gigabit", valor: 649, tipo: "avulso", natureza: "HARDWARE" },
    { chave: "locacao", variacao: "Locação de telefone IP", valor: 29.9, tipo: "recorrente", natureza: "MRR" },
  ] },
  { chave: "full", nome: `${MARCA} Callface AI - Full`, familia: "CALLFACE_AI", precos: [
    { chave: "mensal", variacao: "Mensal", valor: 179.9, tipo: "recorrente", natureza: "MRR" },
  ] },
  { chave: "pacote", nome: `${MARCA} Callface AI - Pacote 500 Minutos`, familia: "CALLFACE_AI", precos: [
    { chave: "avulso", variacao: "Avulso", valor: 119.9, tipo: "avulso", natureza: "ONE_TIME" },
  ] },
];

async function criarCatalogo(organizacaoId: string, sufixo: string) {
  const ids: Record<string, { servico: string; precos: Record<string, { id: string; stripe: string }> }> = {};
  for (const p of PRODUTOS) {
    const [s] = await db.insert(servicosCatalogo).values({
      organizacaoId, nome: p.nome, tipo: p.precos[0].tipo, serviceFamily: p.familia,
      revenueNature: p.precos[0].natureza, origemCatalogo: "oficial_stripe", stripeProductId: `prod_verif_${p.chave}_${sufixo}`,
      commercialModelPadrao: "PAGAMENTO_DIRETO", ativo: true,
    }).returning({ id: servicosCatalogo.id });
    ids[p.chave] = { servico: s.id, precos: {} };
    for (const [ordem, pr] of p.precos.entries()) {
      const stripe = `price_verif_${p.chave}_${pr.chave}_${sufixo}`;
      const [c] = await db.insert(catalogoPrecos).values({
        organizacaoId, servicoCatalogoId: s.id, stripePriceId: stripe, variacao: pr.variacao,
        valor: pr.valor.toFixed(2), moeda: "BRL", tipo: pr.tipo, recorrente: pr.tipo === "recorrente",
        periodo: pr.tipo === "recorrente" ? "mensal" : "unico", revenueNature: pr.natureza, ativo: true, ordem,
      }).returning({ id: catalogoPrecos.id });
      ids[p.chave].precos[pr.chave] = { id: c.id, stripe };
    }
  }
  return ids;
}

async function limparTudo() {
  // A criação multi-família amarra as oportunidades num "bundle"; a limpeza compartilhada apaga o bundle antes delas.
  await db.execute(sql`UPDATE negocios SET bundle_id = NULL WHERE titulo LIKE ${MARCA + "%"}`);
  // A entrada do lead abre uma aquisição, que a limpeza compartilhada não conhece e que trava a exclusão da empresa.
  await db.execute(sql`DELETE FROM aquisicoes WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA + "%"})`);
  await db.execute(sql`UPDATE proposta_grupo_comercial SET checkout_id = NULL WHERE negocio_id IN (SELECT id FROM negocios WHERE titulo LIKE ${MARCA + "%"})`);
  await limparCenariosDeAceite(MARCA);
  await db.execute(sql`DELETE FROM catalogo_precos WHERE servico_catalogo_id IN (SELECT id FROM servicos_catalogo WHERE nome LIKE ${MARCA + "%"})`);
  await db.execute(sql`DELETE FROM servicos_catalogo WHERE nome LIKE ${MARCA + "%"}`);
}

/** Uma linha como `PropostaLiga.gravar` a entrega a `persistir`: valor e quantidade já numéricos, desconto como o vendedor digitou. */
function linhaDoEditor(prod: string, preco: string, nome: string, natureza: string, valor: number, qtd: number, descTipo: "pct" | "valor", descVal: string) {
  return { prod, preco, nome, desc: "", natureza, valor, qtd, descTipo, descVal };
}

/** O mesmo mapeamento de `nova/page.tsx` + `deProp`: o que a tela mostra ao reabrir a proposta. */
async function relerComoATela(organizacaoId: string, negocioId: string, propostaId: string) {
  const todas = await motor.lerPropostasDoNegocio(organizacaoId, negocioId);
  const p = todas.find((x) => x.id === propostaId);
  if (!p) throw new Error("a tela não achou a proposta que acabou de ser gravada");
  return {
    status: p.status,
    linhas: (p.itens ?? []).map((i) => ({
      prod: i.prod, preco: i.preco, nome: i.nome,
      natureza: i.natureza, valor: Number(i.valor_unitario), qtd: Number(i.quantidade),
      desconto: Number(i.desconto),
    })),
  };
}

async function totaisDoBanco(propostaId: string) {
  const [t] = await db.execute<{ rec: string; avu: string; ger: string; n: number; precos: number }>(sql`
    SELECT p.total_recorrente::text AS rec, p.total_avulso::text AS avu, p.total_geral::text AS ger,
           (SELECT count(*)::int FROM proposta_itens WHERE proposta_id = p.id) AS n,
           (SELECT count(DISTINCT catalogo_preco_id)::int FROM proposta_itens WHERE proposta_id = p.id) AS precos
      FROM propostas p WHERE p.id = ${propostaId}::uuid`);
  return { rec: Number(t.rec), avu: Number(t.avu), ger: Number(t.ger), n: t.n, precos: t.precos };
}

async function main() {
  instalarStripeFalso();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const [usuario] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE organizacao_id = ${org.id}::uuid AND ativo = true LIMIT 1`);
  const ator = atorHumano(usuario.id);
  const sufixo = Date.now().toString(36);

  await limparTudo(); // resíduo de rodada que morreu no meio
  try {
    const cat = await criarCatalogo(org.id, sufixo);

    // A tela monta o catálogo por família pela MESMA função da consulta da tela.
    const doBanco = await motor.catalogoDaFamilia(org.id, "PABX");
    const desenho = catalogoDoDesenho({ PABX: doBanco.filter((i) => i.nome.startsWith(MARCA)) });
    ok("O catálogo da tela traz o Hardware como UM produto com 3 variantes",
      desenho.PABX.length === 1 && desenho.PABX[0].precos.length === 3, JSON.stringify(desenho.PABX.map((p) => p.precos.length)));

    const lead = await preVendas.criarLead({
      organizacaoId: org.id,
      empresa: { nome: `${MARCA} Empresa ${sufixo}`, cnpj: `22${sufixo.padEnd(12, "0").slice(0, 12)}` },
      pessoa: { nome: `${MARCA} Contato`, sobrenome: "Teste", cargo: "Diretor", email: `contato.${sufixo}@verif-variantes.com.br`, telefone: `119${Date.now().toString().slice(-8)}` },
      touchpoint: { tipoOrigem: "campanha", source: "verificacao", medium: "teste", campaign: "Variantes", landingPage: "https://callface.io/lp" },
      origem: "Verificação",
    }, ator);
    if (!lead.empresaId) throw new Error("lead de verificação nasceu sem empresa");
    const criadas = await pipeline.criarOportunidadeDoLead({
      organizacaoId: org.id, leadId: lead.leadId, familias: ["PABX", "CALLFACE_AI"], responsavelId: usuario.id, ator,
    });
    const negPabx = criadas.oportunidades.find((o) => o.familia === "PABX")?.id;
    const negAi = criadas.oportunidades.find((o) => o.familia === "CALLFACE_AI")?.id;
    if (!negPabx || !negAi) throw new Error(`oportunidades por família não criadas: ${JSON.stringify(criadas.oportunidades)}`);

    /* ══ 1. PABX: o mesmo produto em 4 linhas, uma delas repetindo o preço ══ */
    console.log("\n── PABX: Hardware lançado 4 vezes (3 variantes + o mesmo preço de novo)");
    const hw = cat.hw.precos;
    const nome = (v: string) => `${MARCA} PABX - Hardware · ${v}`;
    // Valores esperados, escritos à mão (não derivados do código que está sendo conferido):
    //   L1 básico 2 x 389            = 778,00                       avulso
    //   L2 gigabit 5 x 649, 10%      = 3245 - 324,50 = 2920,50      avulso
    //   L3 locação 4 x 29,90, R$ 11,96 = 119,60 - 11,96 = 107,64    recorrente
    //   L4 básico 3 x 389 (repete L1) = 1167,00                     avulso
    const editor1 = [
      linhaDoEditor(cat.hw.servico, hw.basico.id, nome("Telefone IP básico"), "HARDWARE", 389, 2, "pct", ""),
      linhaDoEditor(cat.hw.servico, hw.giga.id, nome("Telefone IP gigabit"), "HARDWARE", 649, 5, "pct", "10"),
      linhaDoEditor(cat.hw.servico, hw.locacao.id, nome("Locação de telefone IP"), "MRR", 29.9, 4, "valor", "11,96"),
      linhaDoEditor(cat.hw.servico, hw.basico.id, nome("Telefone IP básico"), "HARDWARE", 389, 3, "pct", ""),
    ];
    const conv1 = itensParaCriar(editor1);
    ok("Nenhuma das 4 linhas é recusada na conversão", conv1.semPreco.length === 0 && conv1.itens.length === 4);

    const prop = await criarPropostaComItens({
      organizacaoId: org.id, leadId: lead.leadId, negocioId: negPabx, moeda: "BRL", criadoPorId: usuario.id,
      itens: conv1.itens.map((i, ordem) => ({ ...i, descontoTipo: "valor" as const, ordem })),
    });
    const propostaId = prop.id as string;

    let tela = await relerComoATela(org.id, negPabx, propostaId);
    ok("Reler pela consulta da tela devolve as 4 linhas, na ordem", tela.linhas.length === 4, String(tela.linhas.length));
    ok("As duas linhas do mesmo preço continuam duas, cada uma com a sua quantidade",
      tela.linhas[0].preco === tela.linhas[3].preco && tela.linhas[0].qtd === 2 && tela.linhas[3].qtd === 3);
    ok("Cada linha guarda o seu desconto em R$", [0, 324.5, 11.96, 0].every((d, i) => cent(tela.linhas[i].desconto) === d), JSON.stringify(tela.linhas.map((l) => l.desconto)));
    ok("O nome com a variante chega inteiro à tela", tela.linhas[1].nome === nome("Telefone IP gigabit"), tela.linhas[1].nome);
    let t = await totaisDoBanco(propostaId);
    ok("Avulso soma 778 + 2920,50 + 1167 = 4865,50", t.avu === 4865.5, String(t.avu));
    ok("Recorrente soma 107,64", t.rec === 107.64, String(t.rec));
    ok("Total geral 4973,14 e 3 preços distintos em 4 linhas", t.ger === 4973.14 && t.n === 4 && t.precos === 3, JSON.stringify(t));

    // Editar o rascunho como a tela: tira a linha 2, muda a quantidade da 1 e põe uma linha nova do mesmo preço.
    const editor2 = [
      { ...editor1[0], qtd: 4 },
      editor1[2],
      editor1[3],
      linhaDoEditor(cat.hw.servico, hw.giga.id, nome("Telefone IP gigabit"), "HARDWARE", 649, 1, "pct", ""),
    ];
    const conv2 = itensParaCriar(editor2);
    await atualizarItensDoRascunho({
      organizacaoId: org.id, propostaId, ator,
      itens: conv2.itens.map((i, ordem) => ({ ...i, catalogoPrecoId: i.catalogoPrecoId, descontoTipo: "valor" as const, ordem })),
    });
    tela = await relerComoATela(org.id, negPabx, propostaId);
    ok("Remover e trocar linhas deixa exatamente as 4 que ficaram, as outras intactas",
      tela.linhas.map((l) => `${l.qtd}`).join(",") === "4,4,3,1" && cent(tela.linhas[1].desconto) === 11.96, JSON.stringify(tela.linhas.map((l) => [l.qtd, l.desconto])));
    t = await totaisDoBanco(propostaId);
    //   4 x 389 = 1556  +  3 x 389 = 1167  +  1 x 649 = 649  => avulso 3372,00 ; recorrente 107,64
    ok("Totais recalculados depois da edição (3372,00 avulso, 107,64 recorrente)", t.avu === 3372 && t.rec === 107.64 && t.ger === 3479.64, JSON.stringify(t));

    // Enviar (contrato): dados jurídicos e quem assina, como a tela exige.
    await motor.salvarDadosJuridicos({
      organizacaoId: org.id, empresaId: lead.empresaId, ator,
      dados: { razaoSocial: "Verif Variantes LTDA", cnpj: "11222333000199", logradouro: "Rua A", numero: "100", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01000-000" },
    });
    await motor.salvarEditorDaProposta({
      organizacaoId: org.id, propostaId,
      signatarios: [
        { nome: "Contato Verif", email: `contato.${sufixo}@verif-variantes.com.br`, papel: "contratante" },
        { nome: "Representante", email: "representante@verif-variantes.com.br", papel: "representante_legal" },
      ],
    });
    await motor.enviarProposta({ organizacaoId: org.id, propostaId, modoFechamento: "CONTRACT", validadeDias: 14, tipoContratual: "NOVO_CONTRATO", ator });
    tela = await relerComoATela(org.id, negPabx, propostaId);
    ok("Proposta enviada reabre com as mesmas 4 linhas", tela.status === "enviada" && tela.linhas.length === 4);

    // Contrato: o mesmo caminho do aceite (grupos + documento), parando antes do provedor de assinatura.
    const grupos = await formarGruposComerciais(propostaId);
    const nItensNosGrupos = grupos.reduce((s, g) => s + g.itensIds.length, 0);
    ok("Os grupos comerciais recebem as 4 linhas, sem perder nem juntar nenhuma", nItensNosGrupos === 4, String(nItensNosGrupos));
    let corpo = "";
    let itensDescricao = "";
    for (const g of grupos) {
      const { contratoId } = await gerarContratoDeTemplate(g.id);
      const [c] = await db.execute<{ corpo: string; vars: Record<string, string> }>(sql`
        SELECT corpo_gerado AS corpo, variaveis_preenchidas AS vars FROM contratos WHERE id = ${contratoId}::uuid`);
      corpo += c.corpo; itensDescricao += c.vars.itens_descricao ?? "";
    }
    const quantas = (texto: string, trecho: string) => texto.split(trecho).length - 1;
    ok("O contrato lista as 4 linhas (o básico aparece duas vezes)",
      quantas(itensDescricao, nome("Telefone IP básico")) === 2 && quantas(itensDescricao, nome("Locação de telefone IP")) === 1 && quantas(itensDescricao, nome("Telefone IP gigabit")) === 1,
      itensDescricao);
    const linhasDoContrato = [...corpo.matchAll(/<tr><td>(\[VERIF-VARIANTES\][^<]*)<\/td><td>[^<]*<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)]
      .map((m) => [m[1], m[2], m[3], m[4]].join(" | "));
    const esperadas = [
      [nome("Telefone IP básico"), "4", "R$ 389,00", "R$ 1.556,00"], [nome("Locação de telefone IP"), "4", "R$ 29,90", "R$ 107,64"],
      [nome("Telefone IP básico"), "3", "R$ 389,00", "R$ 1.167,00"], [nome("Telefone IP gigabit"), "1", "R$ 649,00", "R$ 649,00"],
    ].map((l) => l.join(" | "));
    ok("O corpo do contrato tem uma linha de tabela por linha da proposta, na ordem, com quantidade, unitário e total de cada uma",
      JSON.stringify(linhasDoContrato.map((l) => l.replace(/\u00a0/g, " "))) === JSON.stringify(esperadas.map((l) => l.replace(/\u00a0/g, " "))),
      JSON.stringify(linhasDoContrato));

    /* ══ 2. Callface AI: mesmo Price em várias linhas vira UMA linha no Stripe ══ */
    console.log("\n── Callface AI: Full 2x e Pacote 2x no mesmo Price, checkout");
    const full = cat.full.precos.mensal, pac = cat.pacote.precos.avulso;
    //   F1 10 x 179,90 = 1799,00 | F2 3 x 179,90, R$ 30 = 509,70 | P1 1 x 119,90 | P2 2 x 119,90, R$ 10 = 229,80
    const editor3 = [
      linhaDoEditor(cat.full.servico, full.id, `${MARCA} Callface AI - Full`, "MRR", 179.9, 10, "pct", ""),
      linhaDoEditor(cat.full.servico, full.id, `${MARCA} Callface AI - Full`, "MRR", 179.9, 3, "valor", "30"),
      linhaDoEditor(cat.pacote.servico, pac.id, `${MARCA} Callface AI - Pacote 500 Minutos`, "ONE_TIME", 119.9, 1, "pct", ""),
      linhaDoEditor(cat.pacote.servico, pac.id, `${MARCA} Callface AI - Pacote 500 Minutos`, "ONE_TIME", 119.9, 2, "valor", "10"),
    ];
    const conv3 = itensParaCriar(editor3);
    const propAi = await criarPropostaComItens({
      organizacaoId: org.id, leadId: lead.leadId, negocioId: negAi, moeda: "BRL", criadoPorId: usuario.id,
      itens: conv3.itens.map((i, ordem) => ({ ...i, descontoTipo: "valor" as const, ordem })),
    });
    const propostaAiId = propAi.id as string;
    const tAi = await totaisDoBanco(propostaAiId);
    ok("Totais: recorrente 2308,70 (1799 + 509,70), avulso 349,70 (119,90 + 229,80)",
      tAi.rec === 2308.7 && tAi.avu === 349.7 && tAi.n === 4 && tAi.precos === 2, JSON.stringify(tAi));
    await motor.enviarProposta({ organizacaoId: org.id, propostaId: propostaAiId, modoFechamento: "PREPAID", validadeDias: 14, ator });

    chamadasStripe.length = 0;
    const aceite = await processarAceiteDaProposta({ propostaId: propostaAiId, organizacaoId: org.id, origem: "manual" });
    ok("Aceite processa o grupo e gera o checkout", aceite.ok === true && aceite.grupos.length === 1 && aceite.grupos[0].proximoPasso === "pagamento" && !aceite.grupos[0].erro,
      JSON.stringify(aceite.ok ? aceite.grupos : aceite));
    const sessao = chamadasStripe.find((c) => c.caminho === "checkout/sessions");
    const linhasStripe: Array<[string, string]> = [];
    for (let i = 0; sessao?.corpo.has(`line_items[${i}][price]`); i++) linhasStripe.push([sessao.corpo.get(`line_items[${i}][price]`)!, sessao.corpo.get(`line_items[${i}][quantity]`)!]);
    ok("O Stripe recebe 2 linhas (um Price cada), não 4", linhasStripe.length === 2, JSON.stringify(linhasStripe));
    ok("Full mensal: 10 + 3 = 13 licenças numa linha só", linhasStripe[0]?.[0] === full.stripe && linhasStripe[0]?.[1] === "13", JSON.stringify(linhasStripe[0]));
    ok("Pacote: 1 + 2 = 3 numa linha só", linhasStripe[1]?.[0] === pac.stripe && linhasStripe[1]?.[1] === "3", JSON.stringify(linhasStripe[1]));
    ok("Assinatura (há item recorrente), com o mesmo desconto das linhas: cupom de R$ 40,00",
      sessao?.corpo.get("mode") === "subscription" && chamadasStripe.find((c) => c.caminho === "coupons")?.corpo.get("amount_off") === "4000",
      `${sessao?.corpo.get("mode")} / ${chamadasStripe.find((c) => c.caminho === "coupons")?.corpo.get("amount_off")}`);
    const [chk] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM checkouts WHERE proposta_id = ${propostaAiId}::uuid`);
    ok("O checkout fica gravado", chk.n === 1);
  } finally {
    await limparTudo();
    const [resto] = await db.execute<{ n: number }>(sql`
      SELECT (SELECT count(*) FROM empresas WHERE nome LIKE ${MARCA + "%"})
           + (SELECT count(*) FROM leads WHERE nome LIKE ${MARCA + "%"})
           + (SELECT count(*) FROM negocios WHERE titulo LIKE ${MARCA + "%"})
           + (SELECT count(*) FROM servicos_catalogo WHERE nome LIKE ${MARCA + "%"})
           + (SELECT count(*) FROM proposta_itens WHERE nome LIKE ${MARCA + "%"}) AS n`);
    console.log(`\n  limpeza: ${Number(resto.n) === 0 ? "nada sobrou" : `SOBRARAM ${resto.n} registros de teste`}`);
    if (Number(resto.n) !== 0) falhou += 1;
  }

  console.log(falhou === 0 ? "\nTUDO CONFERIDO" : `\n${falhou} verificação(ões) FALHARAM`);
  process.exitCode = falhou === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 200));
