import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { GESTAO, PESSOAIS, barraPorPapel } from "./lib/auth/rotas-de-gestao";

/**
 * Regressão do gate de papel perdido na migração CRM 1 → CRM 2.
 *
 * Achado 14/09: o middleware ainda protegia `/configuracoes` e `/financeiro`,
 * que viraram REDIRECTS, enquanto os destinos reais (`/clientes/financeiro`,
 * `/ajustes`) não estavam nem na lista de rotas protegidas nem no matcher —
 * qualquer papel autenticado abria o Financeiro inteiro e a configuração da
 * organização. No backend era pior: nenhuma rota financeira checava papel.
 *
 * Dois erros fáceis de repetir e que este teste trava:
 *   a) proteger uma rota que virou redirect, achando que protegeu a tela;
 *   b) pôr a rota na lista de gestão e esquecer do matcher — a regra existe,
 *      mas o middleware nem roda pro caminho.
 */
function acharRaizApp(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "src/middleware.ts"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do app não encontrada a partir de " + process.cwd());
}
const APP = acharRaizApp();
const middleware = fs.readFileSync(path.join(APP, "src/middleware.ts"), "utf8");

/** Telas que só gestão pode abrir, e que existem de verdade no CRM2.
 *  `/financeiro` voltou a ser tela real (Financeiro canônico ONFACE, 01/10),
 *  não mais redirect — entra aqui para o gate não sair dela sem aviso. */
const ROTAS_DE_GESTAO = ["/financeiro", "/clientes/financeiro", "/ajustes"];

/** Rotas pessoais que qualquer papel autenticado precisa alcançar. */
const ROTAS_PESSOAIS = ["/ajustes/email", "/ajustes/whatsapp"];

function matcher(): string[] {
  const m = middleware.match(/matcher:\s*\[([\s\S]*?)\]/);
  assert.ok(m, "matcher não encontrado");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

test("as rotas de gestão do CRM2 estão no gate de papel", () => {
  const gestao = GESTAO;
  for (const rota of ROTAS_DE_GESTAO) {
    assert.ok(
      gestao.some((g) => rota === g || rota.startsWith(g + "/")),
      `${rota} não está coberta pela lista GESTAO — qualquer papel autenticado abriria a tela`
    );
  }
});

test("as rotas de gestão também estão no matcher (senão o middleware nem roda)", () => {
  const padroes = matcher().map((p) => p.replace("/:path*", ""));
  for (const rota of [...ROTAS_DE_GESTAO, ...ROTAS_PESSOAIS]) {
    assert.ok(
      padroes.some((p) => rota === p || rota.startsWith(p + "/")),
      `${rota} não casa com nenhum padrão do matcher — o gate de papel não é executado pra ela`
    );
  }
});

test("conexão pessoal de e-mail continua liberada pra qualquer papel", () => {
  const pessoais = PESSOAIS;
  for (const rota of ROTAS_PESSOAIS) {
    assert.ok(
      pessoais.some((p) => rota === p || rota.startsWith(p)),
      `${rota} precisa estar em PESSOAIS: é a conta do próprio usuário, não config da organização`
    );
  }
});

test("o gate usa isAdminView (inclui os papéis de gestão da RBAC v2)", () => {
  assert.ok(
    /barraPorPapel\(pathname, effectiveRole\)/.test(middleware),
    "o middleware precisa aplicar barraPorPapel — é lá que mora a regra que este teste executa"
  );
  for (const papel of ["director", "coordinator", "operations", "admin", "gerente", "super_admin"]) {
    assert.equal(barraPorPapel("/ajustes/membros", papel), false, `${papel} é gestão e deveria abrir /ajustes/membros`);
  }
});

/* O time não conseguia clicar em "Ajustes" (16/10/2026): o item do menu de
   perfil leva a `/ajustes`, que o gate devolvia ao Início para closer e SDR.
   A raiz abre; as seções da organização continuam fechadas. */
test("fora da gestão, o índice de Ajustes abre e as seções da organização não", () => {
  for (const papel of ["closer", "sdr", "leitor"]) {
    assert.equal(barraPorPapel("/ajustes", papel), false, `${papel} precisa alcançar o índice de Ajustes`);
    assert.equal(barraPorPapel("/ajustes/email", papel), false, `${papel} conecta o próprio e-mail`);
    assert.equal(barraPorPapel("/ajustes/whatsapp", papel), false, `${papel} conecta o próprio WhatsApp`);
    for (const fechada of ["/ajustes/membros", "/ajustes/permissoes", "/ajustes/integracoes", "/ajustes/api-tokens", "/financeiro", "/design"]) {
      assert.equal(barraPorPapel(fechada, papel), true, `${fechada} é de gestão e não pode abrir para ${papel}`);
    }
  }
});

test("as rotas financeiras do backend checam papel", () => {
  // O gate aceito é por PAPEL (legado) ou por PERMISSÃO (SPEC §31). A migração
  // é rota a rota, então as duas formas convivem — o que não pode conviver é
  // rota financeira SEM gate nenhum.
  const alvos = [
    "src/api-server/routes/clientes-financeiro.ts",
    "src/api-server/routes/clientes-crm2.ts",
    "src/app/api/financeiro/metricas/route.ts",
    "src/app/api/financeiro/churn/route.ts",
    "src/app/api/financeiro/cobranca/route.ts",
    "src/app/api/financeiro/inadimplencia/route.ts",
    "src/app/api/financeiro/vendas/route.ts",
    "src/app/api/financeiro/pabx-import/route.ts",
  ];
  const MARCAS = ["getGestaoCtx", "isAdminView", "exigirCtx", "temPermissao"];
  const semGate = alvos
    .filter((arquivo) => {
      const src = fs.readFileSync(path.join(APP, arquivo), "utf8");
      return !MARCAS.some((m) => src.includes(m));
    })
    .map((arquivo) => ({ arquivo }));
  assert.deepEqual(
    semGate.map((a) => a.arquivo), [],
    "rota financeira sem gate de papel — o middleware é navegação, o backend é a barreira real"
  );
});
