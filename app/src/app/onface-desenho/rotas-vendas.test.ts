import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const app = import.meta.dirname;

test("rotas de entidade de Vendas renderizam detalhes, não redirects para a quick view", () => {
  const detalhes = [
    { rota: ["pipeline", "[id]", "page.tsx"], componente: "DetalheOportunidadePagina" },
    { rota: ["contatos", "empresas", "[id]", "page.tsx"], componente: "DetalheEmpresaPagina" },
    { rota: ["contatos", "pessoas", "[id]", "page.tsx"], componente: "DetalhePessoaPagina" },
  ];

  const superficies = [
    { nome: "desenho", raiz: app },
    { nome: "preview", raiz: path.join(app, "..", "(onface-preview)", "onface-preview") },
  ];

  for (const superficie of superficies) for (const { rota, componente } of detalhes) {
    const arquivo = path.join(superficie.raiz, ...rota);
    assert.equal(existsSync(arquivo), true, `${superficie.nome}/${rota.join("/")}`);
    const fonte = readFileSync(arquivo, "utf8");
    assert.equal(fonte.includes("redirect("), false, `${superficie.nome}/${rota.join("/")} não pode redirecionar`);
    assert.equal(fonte.includes(componente), true, `${superficie.nome}/${rota.join("/")} deve renderizar ${componente}`);
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
  const previewContatos = readFileSync(path.join(app, "..", "(onface-preview)", "onface-preview", "contatos", "page.tsx"), "utf8");

  assert.match(pipeline, /useEffect/);
  assert.match(pipeline, /acoes\.detalhe\(selecaoInicial\)/);
  assert.match(contatos, /pessoaInicial/);
  assert.match(contatos, /setModal\("vincular"\)/);
  assert.match(desenhoPipeline, /rotaBase="\/onface-desenho"/);
  assert.match(previewPipeline, /rotaBase="\/onface-preview"/);
  assert.match(desenhoContatos, /pessoaInicial=\{params\.pessoa/);
  assert.match(previewContatos, /pessoaInicial=\{params\.pessoa/);
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
