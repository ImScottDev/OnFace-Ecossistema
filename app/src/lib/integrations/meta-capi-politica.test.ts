/**
 * Política de eventos e regra de outbound da Meta (SPEC §20).
 *
 * Estes testes travam decisões de NEGÓCIO, não formato. Cada uma delas muda o
 * que a Meta aprende e, por consequência, quem ela traz.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  POLITICA_EVENTOS, regraDoEvento, veioDaMeta, idDeterministicoDoEvento,
  montarEventoCapi, hashCapi, metaApiVersion, META_API_VERSION_PADRAO,
  credenciaisCapi, credenciaisAds, diagnosticoMeta,
} from "@onface/integrations-meta";

test("CompleteRegistration NÃO é usado como apelido de venda ganha", () => {
  // Ela é um evento padrão com significado próprio (cadastro concluído).
  // Usá-la como Won ensina a Meta a otimizar por uma coisa achando que é outra.
  const nomes = Object.values(POLITICA_EVENTOS).map((r) => r.nomeMeta);
  assert.ok(!nomes.includes("CompleteRegistration"), "CompleteRegistration voltou a ser usado");
  assert.equal(POLITICA_EVENTOS.OpportunityWon.nomeMeta, "OpportunityWon");
});

test("QualifiedLead existe e é distinto de Lead", () => {
  // É o evento que ensina a Meta a trazer quem QUALIFICA, não quem só preenche
  // formulário. Sem ele, otimiza-se por volume.
  assert.equal(POLITICA_EVENTOS.AcquisitionCreated.nomeMeta, "Lead");
  assert.equal(POLITICA_EVENTOS.AcquisitionQualified.nomeMeta, "QualifiedLead");
  assert.notEqual(
    POLITICA_EVENTOS.AcquisitionCreated.nomeMeta,
    POLITICA_EVENTOS.AcquisitionQualified.nomeMeta,
  );
});

test("só pagamento e venda ganha levam valor", () => {
  // Mandar valor em aceite de proposta inflaria a receita atribuída: a Meta
  // contaria duas vezes o mesmo dinheiro, no aceite e no pagamento.
  const comValor = Object.entries(POLITICA_EVENTOS).filter(([, r]) => r.comValor).map(([k]) => k);
  assert.deepEqual(comValor.sort(), ["OpportunityWon", "PaymentConfirmed"]);
  assert.equal(POLITICA_EVENTOS.PaymentConfirmed.nomeMeta, "Purchase");
});

test("toda regra diz POR QUE aquele nome", () => {
  // O mapeamento é decisão de negócio. Sem o motivo escrito, a próxima pessoa
  // troca o nome por um que "parece melhor" e muda a otimização sem saber.
  const semPorque = Object.entries(POLITICA_EVENTOS)
    .filter(([, r]) => !r.porque || r.porque.length < 30)
    .map(([k]) => k);
  assert.deepEqual(semPorque, [], "regra de evento sem justificativa");
});

test("outbound puro NÃO volta para a Meta como conversão", () => {
  // Devolver ciclo de vida de lead outbound ensina o algoritmo com dado que
  // não é dele: a Meta otimiza para um público que nunca trouxe, e o custo por
  // resultado mente para baixo.
  assert.equal(veioDaMeta(null), false);
  assert.equal(veioDaMeta({}), false);
  assert.equal(veioDaMeta({ metaLeadId: null, fbclid: null, campaignId: null }), false);

  // Qualquer sinal de touchpoint Meta libera.
  assert.equal(veioDaMeta({ metaLeadId: "123" }), true);
  assert.equal(veioDaMeta({ fbclid: "abc" }), true);
  assert.equal(veioDaMeta({ fbp: "fb.1.2.3" }), true);
  assert.equal(veioDaMeta({ campaignId: "c1" }), true);
  assert.equal(veioDaMeta({ ctwaClid: "ctwa" }), true);
});

test("o event_id é determinístico, senão a Meta conta duas vezes", () => {
  // A Meta deduplica por event_id. Retry, reprocessamento da fila e replay
  // manual precisam gerar a MESMA string.
  const a = idDeterministicoDoEvento("evt-1", "Purchase");
  const b = idDeterministicoDoEvento("evt-1", "Purchase");
  assert.equal(a, b);
  assert.notEqual(a, idDeterministicoDoEvento("evt-2", "Purchase"));
  assert.notEqual(a, idDeterministicoDoEvento("evt-1", "Lead"));
  // Nunca pode depender de tempo nem de aleatório.
  assert.ok(!/\d{10,}/.test(a.replace("evt-1", "")), "o id parece conter timestamp");
});

test("o event_time é o do fato, não o do envio", () => {
  // Um pagamento de ontem entregue hoje precisa contar como ontem, senão a
  // atribuição escorrega de dia.
  const ontem = Math.floor(Date.now() / 1000) - 86400;
  const corpo = montarEventoCapi({ eventName: "Purchase", eventTime: ontem, eventId: "x", valor: 10 });
  assert.equal(corpo.event_time, ontem);
});

test("dado pessoal vai hasheado e o resto não vai", () => {
  const corpo = montarEventoCapi({
    eventName: "QualifiedLead", eventTime: 1, eventId: "x",
    email: " Maria@Empresa.com.BR ", telefone: "(11) 98888-7777",
  });
  const serializado = JSON.stringify(corpo);
  assert.ok(!serializado.includes("maria@empresa"), "e-mail em claro");
  assert.ok(!serializado.includes("98888"), "telefone em claro");
  const ud = corpo.user_data as Record<string, string[]>;
  assert.equal(ud.em[0], hashCapi("maria@empresa.com.br"));

  // Nada de conversa, CPF ou contexto de IA: o corpo só tem o que a Meta pede.
  const chaves = Object.keys(corpo).concat(Object.keys(ud));
  const proibidas = chaves.filter((k) => /conteudo|mensagem|cpf|prompt|transcript|summary/i.test(k));
  assert.deepEqual(proibidas, [], "campo com PII desnecessária no corpo do evento");
});

test("a versão da Graph API é uma só, e é a validada", () => {
  // Versão espalhada é a garantia de que um dia metade do sistema fala com uma
  // e metade com outra. v26.0 foi medida contra a Meta em 21/09/2026.
  assert.equal(META_API_VERSION_PADRAO, "v26.0");
  assert.equal(metaApiVersion({} as NodeJS.ProcessEnv), "v26.0");
  assert.equal(metaApiVersion({ META_API_VERSION: "v25.0" } as never), "v25.0");
});

test("CAPI e Ads Insights usam credenciais SEPARADAS", () => {
  // Medido: o token da CAPI tem só `read_ads_dataset_quality` e a Meta recusa
  // insights com ele (erro 200). Reaproveitar faria a integração de insights
  // falhar em produção com um erro que parece de configuração de conta.
  const env = {
    META_PIXEL_ID: "123", META_CAPI_ACCESS_TOKEN: "tok-capi",
    META_AD_ACCOUNT_ID: "999", META_ADS_ACCESS_TOKEN: "tok-ads",
  } as never;
  assert.equal(credenciaisCapi(env).accessToken, "tok-capi");
  assert.equal(credenciaisAds(env).accessToken, "tok-ads");
  assert.notEqual(credenciaisCapi(env).accessToken, credenciaisAds(env).accessToken);

  // O id da conta é normalizado com o prefixo, para nenhum chamador ter que
  // lembrar.
  assert.equal(credenciaisAds(env).adAccountId, "act_999");
  assert.equal(credenciaisAds({ META_AD_ACCOUNT_ID: "act_999" } as never).adAccountId, "act_999");
});

test("o diagnóstico diz o que está pronto sem expor segredo", () => {
  const d = diagnosticoMeta({
    META_PIXEL_ID: "1", META_CAPI_ACCESS_TOKEN: "segredo-capi",
    META_APP_SECRET: "segredo-app", META_WEBHOOK_VERIFY_TOKEN: "segredo-verify",
  } as never);
  assert.equal(d.capiPronta, true);
  assert.equal(d.webhookPronto, true);
  assert.equal(d.leadRetrievalPronto, false, "sem página e token de leads, não está pronto");

  const serializado = JSON.stringify(d);
  for (const segredo of ["segredo-capi", "segredo-app", "segredo-verify"]) {
    assert.ok(!serializado.includes(segredo), `o diagnóstico vazou ${segredo}`);
  }
});

test("evento sem mapeamento não é inventado", () => {
  assert.equal(regraDoEvento("AlgoQueNaoExiste"), null);
  assert.equal(regraDoEvento("PaymentConfirmed")?.nomeMeta, "Purchase");
});

test("a CAPI tem caller REAL em runtime, não só adapter e teste", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const SRC = path.resolve(import.meta.dirname, "../../..");

  // Este teste existe por causa de um erro cometido aqui: o adapter da CAPI e
  // os testes dele foram escritos, tudo passou, e a fase foi dada como pronta —
  // com NADA em runtime chamando o adapter. Integração sem caller é biblioteca.
  //
  // O caller precisa estar no consumidor do outbox, porque é a fila que dá
  // retry, idempotência e ordem. Chamar direto do comando de domínio faria a
  // falha da Meta derrubar a transação.
  const consumidor = fs.readFileSync(path.join(SRC, "src/lib/events/consumer.ts"), "utf8");
  assert.match(
    consumidor, /entregarEventoNaMeta/,
    "o consumidor do outbox não entrega nada à Meta: o adapter existe e ninguém chama",
  );
  assert.match(
    consumidor, /registrarEntregaCapi/,
    "a entrega não é auditada: sem isso não há resposta para 'esse evento chegou na Meta?'",
  );

  // E a entrega tem que estar em try próprio: a Meta não pode derrubar o
  // processamento do evento de domínio, que já aconteceu.
  const trecho = consumidor.slice(consumidor.indexOf("entregarEventoNaMeta") - 600, consumidor.indexOf("entregarEventoNaMeta") + 400);
  assert.match(trecho, /try\s*\{/, "a entrega à Meta precisa estar isolada em try próprio");
});

test("a entrega distingue os motivos de não entregar", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const entrega = fs.readFileSync(
    path.resolve(import.meta.dirname, "meta/entrega-capi.ts"), "utf8",
  );
  // Tratar tudo como "erro" faria a fila tentar para sempre um evento que nunca
  // vai passar, e faria alerta disparar em ambiente nunca configurado.
  for (const motivo of ["sem_mapeamento", "sem_touchpoint_meta", "sem_credencial", "sem_identidade", "recusado", "transitorio"]) {
    assert.ok(entrega.includes(motivo), `a entrega deveria distinguir o motivo "${motivo}"`);
  }
});
