/**
 * Testes de arquitetura — SPEC §35 (regra de fronteira) e §50.1.
 *
 * Estas regras existem para impedir que o refactor recrie o problema que ele
 * veio resolver. O levantamento AS-IS mediu 39 lugares escrevendo em `leads` e
 * só 3 passando pela regra de negócio; a causa foi não haver nenhuma barreira
 * entre entrada, domínio e banco.
 *
 * O teste roda sobre `packages/`. Enquanto os pacotes estiverem vazios ele passa
 * trivialmente, e é de propósito: a barreira precisa existir ANTES do código
 * chegar, não depois. Cada fase do refactor que migrar um domínio já encontra a
 * regra valendo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "../../../..");
const PACKAGES = path.join(RAIZ, "packages");

function arquivosTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : arquivosTs(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

function importsDe(arquivo: string): string[] {
  const src = fs.readFileSync(arquivo, "utf8");
  const alvos: string[] = [];
  for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) alvos.push(m[1]);
  for (const m of src.matchAll(/\bfrom\s+["']([^"']+)["']/g)) alvos.push(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) alvos.push(m[1]);
  return [...new Set(alvos)];
}

/** Relativo à raiz, para a mensagem de falha apontar o arquivo que o leitor abre. */
const rel = (p: string) => path.relative(RAIZ, p);

const SDKS_DE_PROVEDOR = [
  "stripe", "@stripe/", "googleapis", "@microsoft/", "@azure/", "openai",
  "@anthropic-ai/", "groq-sdk", "@google/generative-ai", "puppeteer", "nodemailer",
  "imapflow", "resend", "twilio",
];

test("domínio não importa SDK de provedor externo (SPEC §35)", () => {
  const violacoes: string[] = [];
  for (const arq of arquivosTs(path.join(PACKAGES, "domain"))) {
    for (const imp of importsDe(arq)) {
      if (SDKS_DE_PROVEDOR.some((sdk) => imp === sdk.replace(/\/$/, "") || imp.startsWith(sdk))) {
        violacoes.push(`${rel(arq)} importa ${imp}`);
      }
    }
  }
  assert.deepEqual(violacoes, [], `Domínio depende de provedor. Provedor é adapter, e adapter vive em packages/integrations.\n${violacoes.join("\n")}`);
});

test("domínio não importa framework de entrega: Next, Hono, React (SPEC §35)", () => {
  const proibidos = ["next", "next/", "hono", "hono/", "react", "react-dom", "@hono/"];
  const violacoes: string[] = [];
  for (const arq of arquivosTs(path.join(PACKAGES, "domain"))) {
    for (const imp of importsDe(arq)) {
      if (proibidos.some((p) => imp === p.replace(/\/$/, "") || imp.startsWith(p))) {
        violacoes.push(`${rel(arq)} importa ${imp}`);
      }
    }
  }
  assert.deepEqual(violacoes, [], `Domínio depende de camada de entrega. A regra de negócio tem que rodar igual vinda de rota, worker, webhook ou agente.\n${violacoes.join("\n")}`);
});

test("domínio não importa implementação de integração (SPEC §35)", () => {
  const violacoes: string[] = [];
  for (const arq of arquivosTs(path.join(PACKAGES, "domain"))) {
    for (const imp of importsDe(arq)) {
      if (imp.startsWith("@onface/integrations-") || imp.includes("packages/integrations/")) {
        violacoes.push(`${rel(arq)} importa ${imp}`);
      }
    }
  }
  assert.deepEqual(violacoes, [], `A dependência é ao contrário: integração conhece o contrato do domínio, nunca o domínio conhece a integração.\n${violacoes.join("\n")}`);
});

test("integração não importa código de aplicação (SPEC §50.1)", () => {
  const violacoes: string[] = [];
  for (const arq of arquivosTs(path.join(PACKAGES, "integrations"))) {
    for (const imp of importsDe(arq)) {
      if (imp.startsWith("@/") || imp.includes("/app/src/") || imp.startsWith("@onface/web") || imp.startsWith("@onface/api")) {
        violacoes.push(`${rel(arq)} importa ${imp}`);
      }
    }
  }
  assert.deepEqual(violacoes, [], `Integração importando aplicação inverte a dependência e impede testar o adapter isolado.\n${violacoes.join("\n")}`);
});

test("domínio só alcança o banco pela abstração de platform/database (SPEC §36)", () => {
  const violacoes: string[] = [];
  for (const arq of arquivosTs(path.join(PACKAGES, "domain"))) {
    for (const imp of importsDe(arq)) {
      const clienteDireto =
        imp === "postgres" || imp === "pg" ||
        imp.startsWith("drizzle-orm/postgres") || imp.startsWith("drizzle-orm/node-postgres") ||
        /(^|\/)lib\/db(\/|$)/.test(imp);
      if (clienteDireto) violacoes.push(`${rel(arq)} importa ${imp}`);
    }
  }
  assert.deepEqual(violacoes, [], `Domínio abrindo conexão própria é como o código fica hoje: cada caminho decide sozinho como escrever.\n${violacoes.join("\n")}`);
});

test("ferramenta de IA não importa cliente de banco (SPEC §50.1 e §3.5)", () => {
  const dirIA = path.join(PACKAGES, "domain", "intelligence");
  const violacoes: string[] = [];
  for (const arq of arquivosTs(dirIA)) {
    for (const imp of importsDe(arq)) {
      if (imp === "postgres" || imp === "pg" || imp.startsWith("drizzle-orm") || /(^|\/)lib\/db(\/|$)/.test(imp)) {
        violacoes.push(`${rel(arq)} importa ${imp}`);
      }
    }
  }
  assert.deepEqual(violacoes, [], `SPEC §3.5: a IA é ator, não dona do banco. Ela chama comando do domínio, nunca escreve SQL.\n${violacoes.join("\n")}`);
});

test("todo pacote publica um index.ts como única porta de entrada (SPEC §36)", () => {
  const faltando: string[] = [];
  for (const grupo of ["domain", "integrations", "platform", "shared"]) {
    const dir = path.join(PACKAGES, grupo);
    if (!fs.existsSync(dir)) continue;
    for (const nome of fs.readdirSync(dir)) {
      const pacote = path.join(dir, nome);
      if (!fs.statSync(pacote).isDirectory()) continue;
      if (!fs.existsSync(path.join(pacote, "index.ts"))) faltando.push(`${grupo}/${nome}`);
      if (!fs.existsSync(path.join(pacote, "package.json"))) faltando.push(`${grupo}/${nome} (sem package.json)`);
    }
  }
  assert.deepEqual(faltando, [], `Pacote sem porta de entrada explícita vira import por caminho interno, e a fronteira deixa de existir na prática.\n${faltando.join("\n")}`);
});
