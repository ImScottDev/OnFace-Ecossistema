import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DESTINOS, NAVEGACAO, destinoAtivo, trilhaAtual } from "./navegacao";
import { MENU_ONFACE, areaAtivaOnface, normalizarPathnameOnface } from "./navigation";

describe("navegação ONFACE", () => {
  it("acende o destino exato", () => {
    assert.equal(destinoAtivo("/pipeline"), "/pipeline");
    assert.equal(destinoAtivo("/pre-vendas"), "/pre-vendas");
  });

  it("acende o destino em subrota", () => {
    assert.equal(destinoAtivo("/pipeline/abc-123"), "/pipeline");
    assert.equal(destinoAtivo("/propostas/nova"), "/propostas");
  });

  // O bug que a ordenação por comprimento evita: sem ela `/clientes` casa
  // primeiro e Customer Success nunca acende.
  it("prefere o prefixo mais longo entre destinos irmãos", () => {
    assert.equal(destinoAtivo("/clientes/cs"), "/clientes/cs");
    assert.equal(destinoAtivo("/clientes/cs/empresa-1"), "/clientes/cs");
    assert.equal(destinoAtivo("/clientes"), "/clientes");
    assert.equal(destinoAtivo("/automacoes/fluxos/f1"), "/automacoes/fluxos");
    assert.equal(destinoAtivo("/automacoes"), "/automacoes");
  });

  // Prefixo de rota não é o mesmo que segmento: `/clientesX` não é `/clientes`.
  it("não casa prefixo parcial de segmento", () => {
    assert.equal(destinoAtivo("/pipelinex"), null);
  });

  it("herda destino para rotas fora da árvore", () => {
    assert.equal(destinoAtivo("/negocios/42"), "/pipeline");
    assert.equal(destinoAtivo("/empresas/9"), "/contatos");
    assert.equal(destinoAtivo("/clientes/sucesso"), "/clientes/cs");
    assert.equal(destinoAtivo("/whatsapp"), "/atendimento");
  });

  // O handoff de 22/09 tirou estes três da árvore visível. Sem herança, abrir
  // qualquer um deles apagaria a coluna inteira e a pessoa ficaria "em lugar
  // nenhum" dentro do produto.
  it("mantém posição para os destinos que saíram da árvore", () => {
    assert.equal(destinoAtivo("/clientes/onboarding/f-1"), "/pos-vendas");
    assert.equal(destinoAtivo("/clientes/implantacao/pabx"), "/pos-vendas");
    assert.equal(destinoAtivo("/financeiro/cobranca"), "/clientes");
    assert.equal(destinoAtivo("/clientes/financeiro"), "/clientes");
  });

  it("devolve null fora do produto", () => {
    assert.equal(destinoAtivo("/login"), null);
    assert.equal(destinoAtivo("/p/token-publico"), null);
  });

  it("monta a trilha com área, item e apoio", () => {
    assert.deepEqual(trilhaAtual("/pipeline/1"), {
      area: "Vendas",
      item: "Pipeline",
      apoio: "Oportunidades comerciais, uma família por oportunidade",
    });
    assert.deepEqual(trilhaAtual("/pre-vendas"), {
      area: "Vendas",
      item: "Pré-vendas",
      apoio: "Leads, qualificação e saídas",
    });
    // Área sem filhos é o próprio destino: não tem nível acima.
    assert.deepEqual(trilhaAtual("/inicio"), {
      area: null,
      item: "Início",
      apoio: "O dia da operação num lugar só",
    });
    assert.equal(trilhaAtual("/login"), null);
  });

  it("não tem href duplicado entre os destinos", () => {
    const hrefs = DESTINOS.map((i) => i.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });

  it("todo destino acende a si mesmo", () => {
    for (const item of DESTINOS) {
      assert.equal(destinoAtivo(item.href), item.href, `${item.href} não acende a si mesmo`);
    }
  });

  // Uma área com filhos nunca é destino: o clique nela abre o grupo. O href
  // dela existe só para apontar ao primeiro filho, e tem de ser um deles —
  // senão o pai leva para fora do próprio grupo.
  it("área com filhos aponta para o primeiro filho", () => {
    for (const area of NAVEGACAO) {
      if (!area.itens?.length) continue;
      assert.equal(area.href, area.itens[0].href, `${area.label} não aponta para o primeiro filho`);
    }
  });

  // Item de menu que não leva a lugar nenhum é UI cenográfica. Aqui a prova é
  // estrutural; a existência do arquivo de rota foi verificada à mão em 22/09.
  it("todo destino tem href absoluto de rota", () => {
    for (const item of DESTINOS) {
      assert.match(item.href, /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/, `${item.label} tem href estranho`);
    }
  });

  // Duas árvores convivem (`navigation.ts` alimenta a topbar do preview e o
  // estúdio). Em 01/10 elas mostravam produtos diferentes: uma apontava para
  // `/onface-preview/*` e ainda tinha Onboarding/Implantação. Esta trava
  // mantém o espelho: mesmas áreas, rótulos e rotas, na mesma ordem.
  it("a árvore de navigation.ts espelha a de navegacao.ts", () => {
    // `pendente` entra no espelho: divergir aí é uma árvore prometendo tela
    // que a outra admite não existir.
    const daqui = NAVEGACAO.map((a) => ({
      label: a.label, href: a.href,
      filhos: (a.itens ?? []).map((i) => `${i.label} ${i.href}${i.pendente ? " pendente" : ""}`),
    }));
    const dela = MENU_ONFACE.map((a) => ({
      label: a.label, href: a.href,
      filhos: (a.children ?? []).map((i) => `${i.label} ${i.href}${i.pendente ? " pendente" : ""}`),
    }));
    assert.deepEqual(dela, daqui);
  });

  it("a tela do preview acende a área que representa", () => {
    assert.equal(areaAtivaOnface(normalizarPathnameOnface("/onface-preview/pipeline")), "Vendas");
    assert.equal(areaAtivaOnface(normalizarPathnameOnface("/onface-preview/atividades")), "Operação");
    assert.equal(areaAtivaOnface(normalizarPathnameOnface("/onface-preview")), "Início");
    assert.equal(areaAtivaOnface(normalizarPathnameOnface("/onface-preview/empresa/x")), "Vendas");
  });
});
