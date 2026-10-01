/**
 * Aplicador de migrations do Callface CRM.
 *
 * Por que existe: o journal do drizzle-kit registra UMA migration (`0000`).
 * As outras 45 foram escritas à mão e aplicadas com `psql` direto, ambiente por
 * ambiente — não havia passo de migração no `deploy.sh` nem no compose, e
 * nenhuma ferramenta conseguia dizer se DEV, HOMOLOG e PROD estavam no mesmo
 * ponto. Drift entre ambientes era indetectável (achado 14/09).
 *
 * O que este runner faz:
 *   - aplica os `.sql` de `migrations/` em ordem de nome, cada um numa
 *     transação própria;
 *   - registra o que aplicou em `_migracoes_aplicadas`, com hash do conteúdo;
 *   - recusa rodar se um arquivo JÁ APLICADO tiver mudado (isso significa que
 *     ambientes diferentes têm SQL diferente com o mesmo nome);
 *   - usa advisory lock, então dois deploys simultâneos não se atropelam.
 *
 * O que ele NÃO faz: gerar migration. Continua sendo SQL escrito à mão, como o
 * projeto já fazia — a mudança é o registro e a previsibilidade.
 *
 * Uso:
 *   npm run db:migrar            # aplica o que falta
 *   npm run db:migrar -- --check # só relata, não aplica (serve em CI/pré-deploy)
 *   npm run db:migrar -- --baseline  # marca tudo como aplicado, sem executar
 *   npm run db:migrar -- --ate=0012  # para a cadeia depois do número informado
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";

// A imagem de runtime leva o migrador já empacotado e os SQLs em `dist/`.
// No checkout de desenvolvimento, preserva o diretório-fonte habitual.
const DIR_MIGRATIONS = process.env.MIGRATIONS_DIR ?? path.join(import.meta.dirname ?? path.join(process.cwd(), "src/lib/db"), "migrations");

export interface Migration {
  nome: string;
  caminho: string;
  sql: string;
  hash: string;
}

export function listarMigrations(dir = DIR_MIGRATIONS): Migration[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const caminho = path.join(dir, f);
      const sql = fs.readFileSync(caminho, "utf8");
      return { nome: f, caminho, sql, hash: crypto.createHash("sha256").update(sql).digest("hex") };
    });
}

const LOCK_ID = 90014; // qualquer inteiro estável: serializa migrações concorrentes

export interface ResultadoMigracao {
  aplicadas: string[];
  pendentes: string[];
  alteradas: { nome: string; hashRegistrado: string; hashAtual: string }[];
}

export async function migrar(opts: { url: string; check?: boolean; baseline?: boolean; dir?: string; ate?: string }): Promise<ResultadoMigracao> {
  const sql = postgres(opts.url, { max: 1, fetch_types: false, onnotice: () => {} });
  // `ate` para a cadeia num ponto: usado pela carga da virada, que precisa
  // aplicar um patch de drift entre duas migrations sem inserir arquivo no meio
  // (o número de 4 dígitos tem que continuar único — ver migrar.test.ts).
  const migrations = listarMigrations(opts.dir).filter((m) => !opts.ate || m.nome.slice(0, 4) <= opts.ate);
  const resultado: ResultadoMigracao = { aplicadas: [], pendentes: [], alteradas: [] };

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migracoes_aplicadas (
        nome        text PRIMARY KEY,
        hash        text NOT NULL,
        aplicada_em timestamptz NOT NULL DEFAULT now(),
        baseline    boolean NOT NULL DEFAULT false
      )`;

    const registradas = new Map(
      (await sql<{ nome: string; hash: string }[]>`SELECT nome, hash FROM _migracoes_aplicadas`).map((r) => [r.nome, r.hash])
    );

    // Arquivo já aplicado que mudou de conteúdo: dois ambientes podem ter SQL
    // diferente sob o mesmo nome. Parar é mais seguro que reaplicar.
    for (const m of migrations) {
      const registrado = registradas.get(m.nome);
      if (registrado && registrado !== m.hash) {
        resultado.alteradas.push({ nome: m.nome, hashRegistrado: registrado, hashAtual: m.hash });
      }
    }
    if (resultado.alteradas.length > 0 && !opts.baseline) {
      resultado.pendentes = migrations.filter((m) => !registradas.has(m.nome)).map((m) => m.nome);
      return resultado;
    }

    const faltando = migrations.filter((m) => !registradas.has(m.nome));
    resultado.pendentes = faltando.map((m) => m.nome);

    if (opts.check) return resultado;

    if (opts.baseline) {
      for (const m of faltando) {
        await sql`INSERT INTO _migracoes_aplicadas (nome, hash, baseline) VALUES (${m.nome}, ${m.hash}, true)
                  ON CONFLICT (nome) DO UPDATE SET hash = EXCLUDED.hash`;
        resultado.aplicadas.push(m.nome);
      }
      return resultado;
    }

    await sql`SELECT pg_advisory_lock(${LOCK_ID})`;
    try {
      for (const m of faltando) {
        await sql.begin(async (tx) => {
          await tx.unsafe(m.sql);
          await tx.unsafe("INSERT INTO _migracoes_aplicadas (nome, hash) VALUES ($1, $2)", [m.nome, m.hash]);
        });
        resultado.aplicadas.push(m.nome);
      }
    } finally {
      await sql`SELECT pg_advisory_unlock(${LOCK_ID})`;
    }

    return resultado;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
// Só roda como CLI quando o arquivo executado é este mesmo — `includes("migrar")`
// pegava também `migrar.test.ts` e o teste tentava conectar no banco.
const ehCli = /(?:^|[\\/])migrar\.ts$/.test(process.argv[1] ?? "");
if (ehCli) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }
  const check = process.argv.includes("--check");
  const baseline = process.argv.includes("--baseline");
  const ate = process.argv.find((a) => a.startsWith("--ate="))?.slice("--ate=".length);

  migrar({ url, check, baseline, ate })
    .then((r) => {
      if (r.alteradas.length > 0) {
        console.error("✘ migration já aplicada foi ALTERADA desde então:");
        for (const a of r.alteradas) console.error(`    ${a.nome}  registrado=${a.hashRegistrado.slice(0, 12)} atual=${a.hashAtual.slice(0, 12)}`);
        console.error("  Mudar o conteúdo de uma migration já aplicada faz ambientes divergirem em silêncio.");
        console.error("  Escreva uma migration NOVA com a correção, ou rode --baseline se souber que os ambientes estão iguais.");
        process.exit(1);
      }
      if (check) {
        if (r.pendentes.length === 0) console.log("✔ banco em dia — nenhuma migration pendente");
        else {
          console.log(`✘ ${r.pendentes.length} migration(s) pendente(s):`);
          for (const n of r.pendentes) console.log(`    ${n}`);
        }
        process.exit(r.pendentes.length > 0 ? 1 : 0);
      }
      if (baseline) {
        console.log(`✔ ${r.aplicadas.length} migration(s) marcada(s) como baseline (nenhum SQL executado)`);
      } else if (r.aplicadas.length === 0) {
        console.log("✔ nada a aplicar — banco já estava em dia");
      } else {
        console.log(`✔ ${r.aplicadas.length} migration(s) aplicada(s):`);
        for (const n of r.aplicadas) console.log(`    ${n}`);
      }
      process.exit(0);
    })
    .catch((e) => {
      console.error("✘ falha ao migrar:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
