import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

/**
 * Regressão de uma CLASSE de bug, não de um caso.
 *
 * Achado 14/09: `lib/cs/handoff.ts` fazia
 * `onConflictDoNothing({ target: [clientes.organizacaoId, clientes.empresaId] })`
 * contra um índice PARCIAL (`WHERE empresa_id IS NOT NULL`). Postgres recusa
 * ON CONFLICT em índice parcial sem o predicado repetido, então a query morria
 * com "there is no unique or exclusion constraint matching the ON CONFLICT
 * specification" — e TODO handoff de Won pro CS ia pro dead-letter.
 *
 * O teste varre o código atrás de todo `onConflictDo*({ target: [...] })`,
 * resolve os nomes das colunas pelo schema e confere contra os índices únicos
 * reais do banco: o índice precisa existir, e se for parcial o call site
 * precisa passar `where`.
 *
 * Precisa de DATABASE_URL (é validação contra o banco real). Sem ela, pula.
 */
const DB_URL = process.env.DATABASE_URL;

function acharRaizApp(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "src/lib/db/schema.ts"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do app não encontrada a partir de " + process.cwd());
}
const APP = acharRaizApp();

/** Mapa `nomeDaConstante.campo` → nome da coluna no banco, lido do schema.ts. */
function mapaDeColunas(): Map<string, { tabela: string; coluna: string }> {
  const src = fs.readFileSync(path.join(APP, "src/lib/db/schema.ts"), "utf8");
  const mapa = new Map<string, { tabela: string; coluna: string }>();
  const reTabela = /export const (\w+) = pgTable\(\s*"([a-z_0-9]+)"/g;
  let m: RegExpExecArray | null;
  const tabelas: { constante: string; tabela: string; inicio: number }[] = [];
  while ((m = reTabela.exec(src))) tabelas.push({ constante: m[1], tabela: m[2], inicio: m.index });

  tabelas.forEach((t, i) => {
    const fim = i + 1 < tabelas.length ? tabelas[i + 1].inicio : src.length;
    const corpo = src.slice(t.inicio, fim);
    const reCampo = /(\w+):\s*(?:uuid|text|integer|boolean|timestamp|date|decimal|numeric|jsonb|serial|real|doublePrecision|bigint)\(\s*"([a-z_0-9]+)"/g;
    let c: RegExpExecArray | null;
    while ((c = reCampo.exec(corpo))) {
      mapa.set(`${t.constante}.${c[1]}`, { tabela: t.tabela, coluna: c[2] });
    }
  });
  return mapa;
}

/** Aliases de import (`contatos as contatosT`) para resolver o nome real da tabela. */
function resolverAlias(src: string, nome: string): string {
  const re = new RegExp(`(\\w+)\\s+as\\s+${nome}\\b`);
  const m = src.match(re);
  return m ? m[1] : nome;
}

interface CallSite {
  arquivo: string;
  linha: number;
  colunas: string[];
  temWhere: boolean;
}

function acharCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  const raiz = path.join(APP, "src");
  const pilha = [raiz];
  while (pilha.length) {
    const dir = pilha.pop()!;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entrada.name);
      if (entrada.isDirectory()) { pilha.push(p); continue; }
      if (!/\.tsx?$/.test(entrada.name) || entrada.name.endsWith(".test.ts")) continue;
      const src = fs.readFileSync(p, "utf8");
      if (!src.includes("onConflictDo")) continue;
      const re = /onConflictDo(?:Nothing|Update)\(\{([\s\S]{0,400}?)\}\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const cfg = m[1];
        const alvo = cfg.match(/target:\s*\[([^\]]+)\]|target:\s*([\w.]+)/);
        if (!alvo) continue;
        const bruto = (alvo[1] ?? alvo[2]).split(",").map((s) => s.trim()).filter(Boolean);
        sites.push({
          arquivo: path.relative(APP, p),
          linha: src.slice(0, m.index).split("\n").length,
          colunas: bruto.map((ref) => {
            const [tab, campo] = ref.split(".");
            return `${resolverAlias(src, tab)}.${campo}`;
          }),
          temWhere: /(?:^|[\s,{])where:/.test(cfg),
        });
      }
    }
  }
  return sites;
}

test("todo ON CONFLICT aponta pra um índice único que existe (e passa o predicado quando ele é parcial)", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida — validação contra o banco real pulada");

  const sql = postgres(DB_URL, { max: 1, fetch_types: false });
  try {
    const indices = await sql<{ tabela: string; indice: string; parcial: boolean; colunas: string }[]>`
      SELECT t.relname AS tabela, i.relname AS indice,
             pg_get_indexdef(ix.indexrelid) LIKE '%WHERE%' AS parcial,
             array_to_string(array_agg(a.attname ORDER BY k.ord), ',') AS colunas
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
      CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE ix.indisunique
      GROUP BY 1, 2, 3`;

    const mapa = mapaDeColunas();
    const sites = acharCallSites();
    assert.ok(sites.length > 5, `esperava achar vários ON CONFLICT no código, achei ${sites.length}`);

    const problemas: string[] = [];
    for (const site of sites) {
      const resolvidas = site.colunas.map((ref) => mapa.get(ref));
      if (resolvidas.some((r) => !r)) continue; // referência que o parser não resolve não vira falso positivo
      const tabela = resolvidas[0]!.tabela;
      const cols = resolvidas.map((r) => r!.coluna).join(",");
      const candidatos = indices.filter((ix) => ix.tabela === tabela && ix.colunas === cols);

      if (candidatos.length === 0) {
        problemas.push(`${site.arquivo}:${site.linha} — não existe índice único em ${tabela}(${cols})`);
        continue;
      }
      if (candidatos.every((ix) => ix.parcial) && !site.temWhere) {
        problemas.push(
          `${site.arquivo}:${site.linha} — ${tabela}(${cols}) só tem índice único PARCIAL (${candidatos[0].indice}); ` +
          `o ON CONFLICT precisa repetir o predicado em \`where\`, senão o Postgres recusa a query`
        );
      }
    }
    assert.deepEqual(problemas, [], "\n" + problemas.join("\n"));
  } finally {
    await sql.end({ timeout: 5 });
  }
});
