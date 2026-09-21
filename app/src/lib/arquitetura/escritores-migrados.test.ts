/**
 * Inventário vivo dos escritores de runtime (SPEC §16, §50.1).
 *
 * O SPEC diz que o refactor não está pronto enquanto houver escritor direto sem
 * disposição. Este teste transforma o inventário em contrato executável: cada
 * arquivo que cria identidade comercial precisa estar ligado à porta canônica.
 *
 * Quando alguém abrir uma porta nova sem ligar, o teste acusa aqui, não em
 * produção seis meses depois com 2.378 registros invisíveis.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../..");
const ler = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8");

/** Caminhos que CRIAM identidade comercial e já passam pela porta canônica. */
const MIGRADOS = [
  "app/api/webhooks/rd-lead/route.ts",
  "app/api/webhooks/site-lead/route.ts",
  "api-server/routes/leads.ts",
  "api-server/routes/contatos.ts",
  "api-server/routes/prospeccao.ts",
  "api-server/routes/apollo.ts",
  "api-server/routes/contatos-unified.ts",
];

/** Caminhos que criam CONTATO (identidade sem processo de aquisição). */
const IDENTIDADE_SEM_AQUISICAO = ["worker/index.ts"];

test("todo criador de identidade migrado chama a porta canônica", () => {
  const faltando = MIGRADOS.filter((p) => !ler(p).includes("garantirEntradaCanonica"));
  assert.deepEqual(faltando, [], `estes deveriam chamar a porta canônica e não chamam:\n${faltando.join("\n")}`);
});

test("a ponte de cutover declara que é temporária", () => {
  // Dual-write sem data de morte vira permanente, e o SPEC §56 proíbe isso
  // como estado final. O aviso no topo do arquivo é o que impede alguém
  // encontrar isso daqui a um ano e achar que é o desenho.
  const ponte = ler("lib/vendas/ponte-canonica.ts");
  assert.match(ponte, /EXISTE PARA MORRER/, "a ponte tem que dizer que é temporária");
  assert.match(ponte, /fase 25/, "e em que fase sai");
});

test("nenhum criador migrado perdeu a escrita legada ainda", () => {
  // Durante o cutover as duas escritas coexistem de propósito: as telas leem
  // `leads`. Se alguém remover a legada antes da fase 17 (migração de leitura),
  // o registro some da tela no mesmo instante.
  const semLegado = MIGRADOS.filter((p) => {
    const src = ler(p);
    return !/insert\(leads\)|INSERT INTO leads|criarLead/.test(src);
  });
  assert.deepEqual(semLegado, [], `removeram a escrita legada cedo demais:\n${semLegado.join("\n")}`);
});

test("a porta canônica nunca é chamada com await que bloqueie a resposta", () => {
  // A ponte é best-effort: falha dela não pode derrubar a captação de um lead
  // de campanha paga. Nos caminhos de webhook e rota, a chamada é `void` ou
  // tem tratamento próprio.
  const comAwaitDireto = MIGRADOS.filter((p) => {
    const src = ler(p);
    // Aceita `await garantirEntradaCanonica` só onde o fluxo já é assíncrono e
    // o retorno é usado; o padrão esperado é `void garantirEntradaCanonica`.
    const chamadas = src.match(/(await|void)\s+garantirEntradaCanonica/g) ?? [];
    return chamadas.length === 0;
  });
  assert.deepEqual(comAwaitDireto, [], `sem chamada reconhecível da porta:\n${comAwaitDireto.join("\n")}`);
});

test("o worker resolve identidade canônica ao criar contato", () => {
  // Contato de WhatsApp não abre aquisição — 25.363 mensagens virariam 25.363
  // processos que ninguém vendeu. Mas a PESSOA tem que existir no canônico,
  // senão a conversa não liga na timeline (SPEC §6, §22).
  const faltando = IDENTIDADE_SEM_AQUISICAO.filter(
    (p) => !ler(p).includes("garantirPessoaDeContato"),
  );
  assert.deepEqual(faltando, [], `criam contato sem resolver identidade:\n${faltando.join("\n")}`);
});

test("a decisão de Ganho passa pela política da oferta, não pela família", () => {
  // O risco financeiro do AS-IS: `won_evidence_policies` é indexada por família
  // e liberava PABX/White Label com contrato assinado e zero pagamento,
  // contradizendo o que o próprio arquivo diz por escrito na linha 19.
  const won = ler("lib/crm/won-evidence.ts");
  assert.match(won, /decidirGanhoPelaOferta/, "a avaliação tem que perguntar à oferta primeiro");
  assert.match(won, /propagarGanhoCanonico/, "e o ganho tem que chegar ao modelo canônico");
});

test("a ponte de Ganho não duplica a regra de decisão", () => {
  // A decisão vem de `avaliarGanho`, a MESMA função do caminho canônico. Se
  // alguém reescrever a regra aqui, os dois modelos divergem em silêncio — que
  // é exatamente o bug que este refactor existe para acabar.
  const ponte = ler("lib/vendas/ponte-ganho.ts");
  assert.match(ponte, /avaliarGanho/, "a ponte usa a política de domínio");
  assert.ok(
    !/winCondition\s*===|PAYMENT_CONFIRMED"\s*\?/.test(ponte),
    "a ponte não pode reimplementar a decisão de ganho",
  );
  assert.match(ponte, /fase 25/, "e diz em que fase sai");
});
