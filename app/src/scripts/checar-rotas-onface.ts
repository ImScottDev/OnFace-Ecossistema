/**
 * Passo 10 da virada: "subir o código novo e provar no navegador".
 *
 * O passo era uma frase. Sem roteiro, "provar" virava abrir a home, ver que
 * carregou e seguir — e foi assim que a Visão Geral passou semanas pintando de
 * verde uma queda de 78%, com um gráfico feito de imagens e quatro elogios
 * escritos na marcação (CP35 a CP37).
 *
 * Este script é a metade automatizável da prova: **cada rota do ONFACE responde
 * 200, renderiza a marcação que a identifica, e não está em branco**. O que ele
 * NÃO substitui é o olho: cor, alinhamento e leitura continuam sendo do
 * navegador. Ele existe para que o passo 10 comece de um estado conhecido, em
 * vez de começar de uma frase.
 *
 * Diferente dos `checar-onface-*`, este precisa do servidor DE PÉ, e dos dois
 * processos — o Next e o Hono na 3011. Em desenvolvimento o rewrite de `/api/*`
 * só existe com `NODE_ENV=development`; sem o Hono, 140 telas respondem 200 com
 * o corpo vazio de dado, que é o modo mais convincente de uma tela mentir.
 *
 *   npx tsx --env-file=.env src/scripts/checar-rotas-onface.ts
 *   BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/checar-rotas-onface.ts
 */
import { encode } from "@auth/core/jwt";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const BASE = process.env.BASE || "http://localhost:3000";
const API = process.env.API_BASE || "http://localhost:3011";

let falhas = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`  ${cond ? "\x1b[32mok\x1b[0m   " : "\x1b[31mFALHA\x1b[0m"} ${msg}`);
  if (!cond) falhas++;
};

interface Rota {
  caminho: string;
  /** Trechos que TÊM que aparecer no HTML. É o que separa "respondeu" de "renderizou". */
  exige: string[];
  /** Quando presente, a rota é de detalhe e o id vem desta consulta. */
  id?: () => Promise<string | null>;
}

async function umId(consulta: ReturnType<typeof sql>): Promise<string | null> {
  const [r] = await db.execute<{ id: string }>(consulta);
  return r?.id ?? null;
}

const ROTAS: Rota[] = [
  { caminho: "/onface-preview", exige: ["ONFACE"] },
  { caminho: "/onface-preview/inicio", exige: ["Evolução da operação", "Áreas em destaque", "of-tendencia"] },
  { caminho: "/onface-preview/visao-geral", exige: ["Operaç"] },
  { caminho: "/onface-preview/atividades", exige: ["Atividades"] },
  { caminho: "/onface-preview/pre-vendas", exige: ["vendas"] },
  { caminho: "/onface-preview/pipeline", exige: ["Pipeline"] },
  { caminho: "/onface-preview/propostas", exige: ["Proposta"] },
  { caminho: "/onface-preview/contatos", exige: ["Contatos"] },
  { caminho: "/onface-preview/prospeccao", exige: ["Prospec"] },
];

const DETALHES: Rota[] = [
  {
    caminho: "/onface-preview/pipeline/:id", exige: ["Pipeline"],
    id: () => umId(sql`SELECT id::text FROM negocios WHERE status NOT IN ('ganho','perdido') ORDER BY updated_at DESC LIMIT 1`),
  },
  {
    caminho: "/onface-preview/propostas/:id", exige: ["Proposta"],
    id: () => umId(sql`SELECT id::text FROM propostas ORDER BY created_at DESC LIMIT 1`),
  },
  {
    caminho: "/onface-preview/contatos/empresas/:id", exige: ["Empresa"],
    id: () => umId(sql`SELECT id::text FROM empresas ORDER BY created_at DESC LIMIT 1`),
  },
  /* As três PONTES do protótipo: endereços que o handoff usava e que hoje só
     traduzem o parâmetro para a rota real. Entram aqui com o id de verdade
     porque é assim que elas chegam colada numa conversa — sem id, redirecionam
     para a lista e não provariam nada. O que se checa é o DESTINO ter aberto. */
  {
    caminho: "/onface-preview/empresa?lead=:id", exige: ["Empresa"],
    id: () => umId(sql`SELECT l.id::text FROM leads l JOIN empresas e ON e.id = l.empresa_id ORDER BY l.updated_at DESC NULLS LAST LIMIT 1`),
  },
  {
    caminho: "/onface-preview/pessoa?lead=:id", exige: ["Pessoa"],
    id: () => umId(sql`SELECT id::text FROM leads ORDER BY updated_at DESC NULLS LAST LIMIT 1`),
  },
  {
    caminho: "/onface-preview/oportunidade?opp=:id", exige: ["Pipeline"],
    id: () => umId(sql`SELECT id::text FROM negocios WHERE status NOT IN ('ganho','perdido') ORDER BY updated_at DESC LIMIT 1`),
  },
  {
    caminho: "/onface-preview/contatos/pessoas/:id", exige: ["Contato", "Pessoa"],
    // O id vem da MESMA consulta que alimenta a lista, e não de um
    // `SELECT … FROM leads LIMIT 1`. Não é detalhe de implementação: contato é
    // a única entidade da tela cujo id pode ser de `pessoas` ou de `leads`, e
    // um lead que já tem pessoa canônica espelhada é excluído dos dois lados
    // (`NOT EXISTS (SELECT 1 FROM pessoas WHERE lead_id_legado = l.id)`).
    //
    // Pegando o último lead cru, o teste acusou 404 numa rota que está certa —
    // aquele lead não aparece na lista, então ninguém consegue chegar nele pela
    // tela. Perseguir aquele 404 teria levado a "consertar" código correto.
    //
    // Assim o teste prova o que interessa de verdade: **o primeiro item que a
    // lista mostra abre no detalhe**.
    id: async () => {
      const { diretorioPessoas } = await import("@/lib/vendas/consultas");
      const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
      const [primeira] = await diretorioPessoas(org.id, { limite: 1 });
      return primeira?.id ?? null;
    },
  },
];

/**
 * Erro se identifica pelo `<title>`, NUNCA por procurar a frase no HTML inteiro.
 *
 * A primeira versão deste script procurava "This page could not be found" no
 * corpo da resposta e acusou **as 13 rotas** — inclusive a home que eu acabara
 * de abrir no navegador. A frase está no payload RSC que o Next embute em toda
 * página (o `not-found` vem junto, serializado), então ela aparece numa tela
 * perfeitamente saudável de 155 kB. O `<title>` real era "ONFACE — Atividades".
 *
 * Um verificador que acusa o que não existe queima a confiança tão rápido
 * quanto um que deixa passar o que existe.
 */
const TITULO_DE_ERRO = /^\s*(404|500|Error|Application error)/i;
const tituloDe = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";

/**
 * Falha de COMPILAÇÃO, que o `<title>` não denuncia.
 *
 * Em desenvolvimento o Next devolve a página de erro com o trecho do arquivo que
 * não compilou, e o título nem sempre muda. Foi assim que uma crase dentro de um
 * comentário SQL — dentro de um template literal, o que fecha o literal — ficou
 * invisível para este verificador enquanto o console do navegador gritava.
 *
 * Diferente da frase "This page could not be found", que o Next embute no payload
 * RSC de TODA página, estas três não aparecem em página saudável: medido em
 * 22/09, zero ocorrências em `/inicio` e `/pipeline` carregadas com sessão.
 */
const MARCAS_DE_COMPILACAO = [
  "Parsing ecmascript source code failed",
  "Module not found",
  "Failed to compile",
];

async function main() {
  console.log(`Base: ${BASE}\n`);

  // Sem os dois processos, tudo responde 200 e a tela vem sem dado.
  console.log("── o ambiente está inteiro ──");
  const vivo = async (url: string) =>
    fetch(url, { redirect: "manual" }).then(() => true).catch(() => false);
  const nextVivo = await vivo(BASE);
  ok(nextVivo, `o Next responde em ${BASE}`);
  if (!nextVivo) {
    console.log("\n    suba com:  npm run dev  (na pasta app)");
    process.exit(1);
  }
  const honoVivo = await vivo(API);
  ok(honoVivo, `o Hono responde em ${API} — sem ele as telas carregam sem dado`);
  if (!honoVivo) console.log("    suba com:  npx tsx src/api-server/index.ts");

  const [org] = await db.execute<{ id: string; nome: string; slug: string }>(sql`
    SELECT id::text, nome, coalesce(slug,'') AS slug FROM organizacoes ORDER BY created_at LIMIT 1`);
  const [u] = await db.execute<{ id: string; nome: string; email: string; role: string }>(sql`
    SELECT id::text, nome, email, role FROM usuarios
     WHERE organizacao_id = ${org.id}::uuid AND role = 'admin' AND ativo = true LIMIT 1`);
  if (!u) { console.log("  \x1b[31mFALHA\x1b[0m nenhum admin ativo para abrir as telas"); process.exit(1); }

  const cookie = `authjs.session-token=${await encode({
    token: { id: u.id, name: u.nome, email: u.email, role: u.role, organizacaoId: org.id, organizacaoSlug: org.slug },
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
    salt: "authjs.session-token",
  })}`;

  const abrir = async (rota: Rota, caminho: string) => {
    let r: Response;
    try {
      // Segue o redirect de propósito: as telas de DETALHE do preview fazem
      // `redirect("/pipeline/<id>")` — o preview refez as listas e reaproveita
      // a tela de detalhe oficial. Tratar isso como falha seria acusar uma
      // decisão de arquitetura. O que não pode é parar em `/login`, e isso o
      // teste abaixo distingue pela URL final.
      r = await fetch(`${BASE}${caminho}`, { headers: { cookie }, redirect: "follow" });
    } catch (e) {
      ok(false, `${caminho} — não respondeu (${e instanceof Error ? e.message : e})`);
      return;
    }
    const destino = new URL(r.url).pathname;
    if (destino.startsWith("/login")) {
      ok(false, `${caminho} — caiu no login: a sessão não foi aceita (defeito de ambiente, não da tela)`);
      return;
    }
    // O corpo é lido ANTES de olhar o status, e não depois. Medido na
    // reintrodução de 22/09: a MESMA crase devolveu ora 200 com o overlay de
    // erro do dev, ora 500 limpo — a diferença entre as duas foi o instante da
    // recompilação, não a gravidade. Lendo só o corpo dos 200, metade das
    // execuções relatava "HTTP 500" sem dizer QUAL arquivo não compila.
    const html = await r.text();
    const compilacao = MARCAS_DE_COMPILACAO.find((m) => html.includes(m));
    if (compilacao) {
      // O trecho que o Next mostra costuma nomear o arquivo: vale mais que o
      // nome da rota, porque o erro quase sempre está num módulo importado.
      const arquivo = html.match(/\.\/(app\/src\/[\w./-]+)/)?.[1];
      ok(false, `${caminho} — NÃO COMPILA ("${compilacao}"${arquivo ? ` em ${arquivo}` : ""})`);
      return;
    }
    if (r.status !== 200) { ok(false, `${caminho} — HTTP ${r.status} em ${destino}`); return; }

    const titulo = tituloDe(html);
    if (TITULO_DE_ERRO.test(titulo)) {
      ok(false, `${caminho} — respondeu 200 com página de erro (título "${titulo}")`);
      return;
    }

    // `exige` é OU, não E: o título de uma tela de detalhe varia com o
    // registro, e exigir todos os marcadores daria falso-vermelho.
    const faltando = rota.exige.filter((t) => !html.includes(t));
    const achou = rota.exige.length - faltando.length;
    const redirecionou = destino !== caminho ? ` → ${destino}` : "";
    ok(achou > 0 && html.length > 5000,
       `${caminho}${redirecionou} — ${(html.length / 1024).toFixed(0)}kB, "${titulo}", ` +
       `${achou}/${rota.exige.length} marcadores` +
       (faltando.length && achou > 0 ? ` (sem: ${faltando.join(", ")})` : ""));
  };

  console.log("\n── telas de lista ──");
  for (const rota of ROTAS) await abrir(rota, rota.caminho);

  console.log("\n── telas de detalhe ──");
  for (const rota of DETALHES) {
    const id = await rota.id!();
    if (!id) { console.log(`  \x1b[33mpulou\x1b[0m ${rota.caminho} — não há registro para abrir`); continue; }
    await abrir(rota, rota.caminho.replace(":id", id));
  }

  console.log(falhas === 0
    ? `\n\x1b[32mtodas as rotas do ONFACE renderizam\x1b[0m`
    : `\n\x1b[31m${falhas} rota(s) com problema — o passo 10 não segue assim\x1b[0m`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
