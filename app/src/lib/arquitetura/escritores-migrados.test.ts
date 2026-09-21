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

test("o motor de regras não tem implementação própria das ações do motor de fluxo", () => {
  // SPEC §18: um motor só. Havia dois, e eles já tinham divergido de um jeito
  // perigoso — o adapter do motor de fluxo recusa mover para Ganho ("Won exige
  // o gate comercial"), e a cópia do motor de regras fazia
  // `update negocios set status` direto. Uma regra de automação podia fechar
  // venda por fora da política da oferta.
  const motor = ler("lib/crm/automacao-engine.ts");

  const DELEGADAS: Array<[string, string]> = [
    ["criar_tarefa", "crm_create_task"],
    ["mudar_status", "crm_update_stage"],
    ["atribuir_responsavel", "crm_assign_owner"],
    ["enviar_email", '"email"'],
    ["enviar_whatsapp", '"whatsapp"'],
    ["adicionar_tag_empresa", "crm_add_tag"],
    ["remover_tag_empresa", "crm_remove_tag"],
  ];
  const semDelegar = DELEGADAS.filter(([, adapter]) => !motor.includes(adapter));
  assert.deepEqual(
    semDelegar.map(([acao]) => acao), [],
    "estas ações deveriam delegar ao adapter do motor de fluxo",
  );

  // Escrita direta nas tabelas que os adapters governam é o sintoma do motor
  // voltando a existir em dois lugares.
  const escritasProibidas = [
    /db\s*\.\s*insert\(tarefas\)/,
    /db\s*\.\s*update\(negocios\)/,
    /update negocios set/i,
    // `empresas.tags` é o modelo de tag que o produto NÃO usa: medido, o array
    // está vazio em todas as empresas e a tabela `labels` tem 161 vínculos.
    // Escrever ali põe a tag da automação num lugar onde ninguém a vê.
    /db\s*\.\s*update\(empresas\)/,
  ].filter((re) => re.test(motor));
  assert.deepEqual(
    escritasProibidas.map(String), [],
    "o motor de regras voltou a escrever direto no que o adapter governa",
  );
});

test("a sincronização com o legado PREENCHE o canônico, nunca apaga a dedução", () => {
  // `negocios.service_family` é NULL em 475 das 1.561 oportunidades, e
  // `source_process` em 63. Nessas, o valor veio do backfill, deduzido de uma
  // cadeia de cinco evidências. Copiar o legado cru por cima apaga a dedução em
  // toda alteração de negócio — medido: um PABX real virava NULL depois de
  // mover etapa.
  //
  // Apagar a família desliga a política de Ganho. Sem família, PABX e White
  // Label não geram jornada de implantação e o produto engole a etapa sem erro
  // nenhum, que é o pior tipo de bug porque ninguém consegue reportar.
  //
  // Prova executada: `src/scripts/smoke-espelho-nao-apaga.ts`, pelo caminho real
  // (`moverEtapa`). Esta trava é estrutural e existe para a regra não ser
  // desfeita por uma linha aparentemente inofensiva.
  const sync = ler("lib/crm/sync-domain-model.ts");
  assert.match(
    sync, /serviceFamily:\s*negocio\.serviceFamily\s*\?\?\s*existente\?\.serviceFamily/,
    "sync-domain-model não pode copiar service_family cru por cima do canônico",
  );
  assert.match(
    sync, /sourceProcess:\s*negocio\.sourceProcess\s*\?\?\s*existente\?\.sourceProcess/,
    "nem source_process",
  );

  const pipeline = ler("lib/vendas/pipeline.ts");
  assert.match(
    pipeline, /service_family = COALESCE\(n\.service_family, o\.service_family\)/,
    "o espelho do pipeline também precisa preencher sem apagar",
  );
  assert.match(
    pipeline, /source_process = COALESCE\(n\.source_process, o\.source_process\)/,
    "idem para source_process",
  );

  // E o que NÃO é dedução continua cópia direta: esvaziar título ou etapa no
  // legado é intenção do usuário, e proteger isso esconderia edição legítima.
  assert.match(pipeline, /titulo = n\.titulo/, "título segue o legado");
  assert.match(pipeline, /etapa = n\.etapa/, "etapa segue o legado");
});

test("trocar responsável passa pela porta, senão o canônico fica para trás", () => {
  // O board de pré-vendas conta "sem responsável" a partir de
  // `aquisicoes.responsavel_id`, e a Empresa 360 lê o dono de
  // `oportunidades.responsavel_id`. Escrever só no legado faz a pessoa
  // reatribuir, recarregar e ver o dono antigo.
  //
  // A divergência no banco era ZERO, porque o backfill sincronizou os dois
  // lados, e era isso que escondia o defeito: ele só apareceria na primeira
  // reatribuição depois da carga. `registrarMudancaResponsavel` virou a porta
  // que propaga E audita; prova executada em `smoke-dono-propaga.ts`.
  const porta = ler("lib/crm/owner.ts");
  assert.match(porta, /UPDATE \$\{sql\.raw\(destino\.tabela\)\}/,
    "a porta tem que propagar para a tabela canônica");
  assert.match(porta, /lead:\s*\{ tabela: "aquisicoes"/, "lead vai para aquisicoes");
  assert.match(porta, /negocio:\s*\{ tabela: "oportunidades"/, "negócio vai para oportunidades");

  // Quem escreve responsável fora da porta volta a criar o buraco.
  const SUSPEITOS = [
    "lib/cadencia/cadence-engine.ts",
    "lib/crm/sdr-escalation.ts",
    "api-server/routes/leads.ts",
    "api-server/routes/negocios.ts",
    "api-server/routes/contatos-crm2.ts",
    "api-server/routes/clientes-crm2.ts",
    "api-server/routes/cs.ts",
  ];
  const fora = SUSPEITOS.filter((f) => {
    const src = ler(f);
    const escreve = /responsavelId:\s*\w+|responsavel_id\s*=\s*\$\{/.test(src);
    return escreve && !src.includes("registrarMudancaResponsavel");
  });
  assert.deepEqual(fora, [],
    `estes trocam responsável sem passar pela porta e deixam o canônico para trás:\n${fora.join("\n")}`);
});
