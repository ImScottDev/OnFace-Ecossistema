import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const app = import.meta.dirname;

const DETALHES_DE_VENDAS = [
  { rota: ["pipeline", "[id]", "page.tsx"], componente: "DetalheOportunidadePagina", destino: "/pipeline" },
  { rota: ["contatos", "empresas", "[id]", "page.tsx"], componente: "DetalheEmpresaPagina", destino: "/contatos/empresas" },
  { rota: ["contatos", "pessoas", "[id]", "page.tsx"], componente: "DetalhePessoaPagina", destino: "/contatos/pessoas" },
];

const PREVIEW = path.join(app, "..", "(onface-preview)", "onface-preview");

test("no espelho de desenho, a rota de entidade renderiza o detalhe e não redireciona", () => {
  // O espelho `/onface-desenho` é congelado e autossuficiente: existe para
  // olhar a tela sem depender do produto, então renderiza de verdade.
  for (const { rota, componente } of DETALHES_DE_VENDAS) {
    const arquivo = path.join(app, ...rota);
    assert.equal(existsSync(arquivo), true, `desenho/${rota.join("/")}`);
    const fonte = readFileSync(arquivo, "utf8");
    assert.equal(fonte.includes("redirect("), false, `desenho/${rota.join("/")} não pode redirecionar`);
    assert.equal(fonte.includes(componente), true, `desenho/${rota.join("/")} deve renderizar ${componente}`);
  }
});

test("no preview, a rota de entidade é atalho para a rota real do produto", () => {
  // Semântica decidida em 19/09, depois de o QA achar estes deep links mortos.
  // Desde que o detalhe passou a morar só na rota oficial (F1, lote 2), o
  // preview não tem cópia — ele aponta para lá. Guardar uma segunda
  // implementação aqui recriaria a superfície paralela que a virada matou.
  // O que não pode é o link morrer, e é isso que este teste protege: a rota
  // existe, redireciona, e vai para o destino certo.
  for (const { rota, destino, componente } of DETALHES_DE_VENDAS) {
    const arquivo = path.join(PREVIEW, ...rota);
    assert.equal(existsSync(arquivo), true, `preview/${rota.join("/")} deve existir`);
    const fonte = readFileSync(arquivo, "utf8");
    assert.match(fonte, /redirect\(/, `preview/${rota.join("/")} deve redirecionar`);
    assert.ok(
      fonte.includes(`redirect(\`${destino}/\${`),
      `preview/${rota.join("/")} deve apontar para ${destino}/:id`,
    );
    assert.equal(
      fonte.includes(`<${componente}`), false,
      `preview/${rota.join("/")} não pode reimplementar ${componente}`,
    );
  }
});

test("quick views abrem a página completa e pessoa não abre o diálogo de vínculo ao clicar", () => {
  const vendas = path.join(app, "..", "..", "components", "onface", "vendas");
  const pipeline = readFileSync(path.join(vendas, "Pipeline.tsx"), "utf8");
  const contatos = readFileSync(path.join(vendas, "Contatos.tsx"), "utf8");

  assert.match(pipeline, /Abrir oportunidade/);
  assert.match(pipeline, /\/pipeline\/\$\{op\.id\}/);
  assert.match(contatos, /Abrir empresa/);
  assert.match(contatos, /\/contatos\/empresas\/\$\{empresa\.id\}/);
  assert.match(contatos, /\/contatos\/pessoas\/\$\{p\.id\}/);
  assert.equal(contatos.includes('onClick={() => { setPessoaAlvo(p); setModal("vincular"); }}'), false);
});

test("CTAs de gerenciamento carregam a entidade alvo e preservam a superfície ONFACE", () => {
  const vendas = path.join(app, "..", "..", "components", "onface", "vendas");
  const pipeline = readFileSync(path.join(vendas, "Pipeline.tsx"), "utf8");
  const contatos = readFileSync(path.join(vendas, "Contatos.tsx"), "utf8");
  const desenhoPipeline = readFileSync(path.join(app, "pipeline", "page.tsx"), "utf8");
  const previewPipeline = readFileSync(path.join(app, "..", "(onface-preview)", "onface-preview", "pipeline", "page.tsx"), "utf8");
  const desenhoContatos = readFileSync(path.join(app, "contatos", "page.tsx"), "utf8");
  // Quem monta Contatos para o produto E para o preview é a página OFICIAL: o
  // preview delega para ela desde 18/09. É nela que `pessoaInicial` tem de
  // estar — exigir o mesmo do espelho seria exigir que ele reimplementasse a
  // tela, exatamente o que se quis evitar.
  const oficialContatos = readFileSync(path.join(app, "..", "(crm2)", "contatos", "page.tsx"), "utf8");

  assert.match(pipeline, /useEffect/);
  assert.match(pipeline, /acoes\.detalhe\(selecaoInicial\)/);
  assert.match(contatos, /pessoaInicial/);
  assert.match(contatos, /setModal\("vincular"\)/);
  // A superfície precisa ser declarada, mas a FORMA é indiferente: o desenho
  // monta a tela e passa `rotaBase` como atributo JSX; o preview, desde 18/09,
  // é um espelho fino que chama a página oficial e passa a mesma informação
  // como propriedade. Casar só com a sintaxe JSX reprovava o espelho por
  // escrever a coisa certa de outro jeito.
  assert.match(desenhoPipeline, /rotaBase[=:]\s*"\/onface-desenho"/);
  assert.match(previewPipeline, /rotaBase[=:]\s*"\/onface-preview"/);
  assert.match(desenhoContatos, /pessoaInicial=\{params\.pessoa/);
  // A página OFICIAL de Contatos deixou de montar `vendas/Contatos` (a versão
  // feita à mão, que abria a pessoa por `?pessoa=`): desde 30/09 ela é o
  // desenho do handoff (`ContatosProto`), que abre a ficha em `/pessoas/:id`.
  // Nenhum link do produto usa `?pessoa=` — conferido por grep em 01/10.
  assert.match(oficialContatos, /ContatosProto/);
});

test("detalhes individuais não vazam timeline da empresa nem fazem busca truncada", () => {
  const consultas = readFileSync(path.join(app, "..", "..", "lib", "vendas", "consultas.ts"), "utf8");
  const eventos = readFileSync(path.join(app, "..", "..", "lib", "vendas", "eventos.ts"), "utf8");
  const pagina = readFileSync(path.join(app, "..", "..", "components", "onface", "vendas", "pagina.tsx"), "utf8");
  const pessoa = readFileSync(path.join(app, "contatos", "pessoas", "[id]", "page.tsx"), "utf8");

  assert.match(consultas, /export async function pessoaPorId/);
  assert.match(eventos, /pessoaId\?: string/);
  assert.match(eventos, /e\.pessoa_id/);
  assert.match(pessoa, /pessoaPorId/);
  assert.equal(pessoa.includes("limite: 1000"), false);
  assert.match(consultas, /contato:/);
  assert.match(pagina, /Contato associado/);
});

test("Pré-vendas não direciona comunicação para fora do ONFACE", () => {
  const fonte = readFileSync(path.join(app, "..", "..", "components", "onface", "vendas", "PreVendas.tsx"), "utf8");
  assert.equal(fonte.includes("https://wa.me"), false);
  assert.equal(fonte.includes("mailto:"), false);
  assert.equal(fonte.includes("tel:"), false);
});

test("a criação de proposta mantém rotas estáveis nas duas superfícies", () => {
  const superficies = [
    { nome: "desenho", raiz: app },
    { nome: "preview", raiz: path.join(app, "..", "(onface-preview)", "onface-preview") },
  ];

  for (const superficie of superficies) {
    const rota = path.join(superficie.raiz, "propostas", "nova", "page.tsx");
    assert.equal(existsSync(rota), true, `${superficie.nome}/propostas/nova deve existir`);
  }

  // O atalho do preview redireciona, e redirect que descarta a query descarta
  // a INTENÇÃO: `?proposta=X&acao=revisar` abriria o compositor em branco.
  // O contrato de cada intenção está em fluxoProposta.test.ts; aqui se trava o
  // elo que faltava — a rota precisa de fato delegar para ele, em vez de
  // redirecionar seco. Bloqueio achado pelo QA na revisão final da F1.
  const atalho = readFileSync(path.join(PREVIEW, "propostas", "nova", "page.tsx"), "utf8");
  assert.match(atalho, /destinoDoCompositor/, "o atalho deve preservar a query via destinoDoCompositor");
  assert.equal(
    /redirect\(\s*["'`]\/propostas\/nova["'`]\s*\)/.test(atalho), false,
    "o atalho não pode redirecionar para /propostas/nova sem levar a query",
  );
  assert.match(atalho, /searchParams/, "o atalho precisa ler searchParams para ter o que repassar");
});

test("a inicialização do fluxo de proposta preserva cada intenção e consome revisão na URL", async () => {
  // Esta importação dinâmica faz o RED expressar a ausência do contrato de
  // comportamento, em vez de aprovar uma busca textual no componente.
  const contrato = await import("../../components/onface/vendas/fluxoProposta").catch(() => null);
  assert.ok(contrato, "o contrato de inicialização do fluxo deve existir");

  for (const acao of ["enviar", "juridicos", "revisar"] as const) {
    assert.deepEqual(
      contrato.inicializarFluxoProposta({ propostaId: "proposta-original", acao, abrirComposer: true }),
      { propostaId: "proposta-original", modalInicial: null, acaoAposCarregamento: acao },
    );
    assert.equal(
      contrato.urlDoFluxoProposta("/onface-preview/propostas", "proposta-original", acao),
      `/onface-preview/propostas/nova?proposta=proposta-original&acao=${acao}`,
    );
  }

  assert.deepEqual(
    contrato.inicializarFluxoProposta({ propostaId: null, acao: null, abrirComposer: true }),
    { propostaId: null, modalInicial: "nova", acaoAposCarregamento: null },
  );
  assert.equal(
    contrato.urlAposRevisao("/onface-preview/propostas/nova?proposta=proposta-original&acao=revisar", "proposta-revisada"),
    "/onface-preview/propostas/nova?proposta=proposta-revisada",
  );

  let revisoesCriadas = 0;
  const revisao = await contrato.executarAcaoAposCarregamento({
    acao: "revisar",
    criarRevisao: async () => {
      revisoesCriadas += 1;
      return { propostaId: "proposta-revisada", versao: 2 };
    },
  });
  assert.equal(revisoesCriadas, 1);
  assert.deepEqual(revisao, { propostaId: "proposta-revisada", versao: 2 });
});
