import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { assinaturaDoCrm, doCrm, faturaDoCrm } from "../financeiro/espelho-crm";

/**
 * A conta Stripe é COMPARTILHADA com o SaaS Callface. A migration 0119 marca
 * (`fora_do_espelho_em`) as assinaturas e faturas que são do SaaS; "quem lê MRR,
 * carteira ou cobrança deve ignorar linha marcada". Sem esta trava a regra só
 * existia no comentário da migration e nenhuma leitura a executava.
 *
 * Toda LEITURA de `assinaturas`/`faturas` precisa passar por `doCrm(alias)`,
 * `assinaturaDoCrm` ou `faturaDoCrm` (lib/financeiro/espelho-crm.ts). Um bloco de
 * leitura sem o filtro falha aqui. Quem precisa ENXERGAR a linha marcada (sync,
 * webhook, identidade do SaaS, scripts) entra na lista abaixo, com o motivo.
 */

const SEM_FILTRO_DE_PROPOSITO: Record<string, string> = {
  "src/lib/integrations/stripe-sync.ts": "o sync decide o que espelhar; precisa achar a linha marcada para não recriá-la",
  "src/lib/integrations/stripe-webhook-inbox-db.ts": "resolve a organização dona do evento pelo id do Stripe, marcado ou não",
  "src/lib/integrations/stripe-financeiro-efeitos.ts": "efeito do webhook por id de fatura do Stripe; não soma nada",
  "src/lib/integrations/inventario.ts": "conta faturas sincronizadas (volume do sync), não receita",
  "src/lib/integrations/callface-ai/identidade.ts": "casa empresa com o SaaS: a linha marcada é justamente a evidência",
  "src/api-server/routes/admin.ts": "diagnóstico de dono de evento Stripe por id",
  "src/lib/crm/delete-negocio.ts": "conta o que impede apagar o negócio, marcado ou não",
  "src/lib/crm/pendencia-financeira.ts": "pendência do CRM (origem crm2_comercial), nunca vem do Stripe",
  "src/lib/cs/handoff.ts": "acha a empresa de UMA fatura por id",
  "src/app/api/financeiro/cobranca/[faturaId]/route.ts": "acha UMA fatura por id para marcar acionamento",
};

const LEITURA_SQL = /\b(?:from|join)\s+(?:public\.)?(?:assinaturas|faturas)\b/gi;
const LEITURA_DRIZZLE = /\.(?:from|innerJoin|leftJoin|rightJoin)\(\s*(?:assinaturas|faturas)\b/g;
const FILTRO = /doCrm\(|assinaturaDoCrm|faturaDoCrm/g;
const JANELA = 2500;

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "migrations" || e.name === "scripts" || e.name === "node_modules" ? [] : fontes(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Subconsulta LATERAL é do mesmo bloco da tabela pai: não conta como SELECT novo. */
const entre = (src: string, a: number, b: number) => { const t = src.slice(a, b); return /lateral/i.test(t) ? "" : t; };

/** Blocos de leitura: leituras coladas (FROM faturas f LEFT JOIN assinaturas a) formam UM bloco. */
function blocos(src: string): { pos: number; trecho: string }[] {
  const achados = [...src.matchAll(LEITURA_SQL), ...src.matchAll(LEITURA_DRIZZLE)].sort((a, b) => a.index! - b.index!);
  const out: { pos: number; trecho: string }[] = [];
  for (let i = 0; i < achados.length;) {
    let j = i + 1;
    while (j < achados.length && !/\bselect\b/i.test(entre(src, achados[j - 1].index!, achados[j].index!))) j++;
    const fim = j < achados.length ? achados[j].index! : Math.min(src.length, achados[i].index! + 2500);
    out.push({ pos: achados[i].index!, trecho: src.slice(achados[i].index!, Math.min(fim, achados[i].index! + JANELA)) });
    i = j;
  }
  return out;
}

test("toda leitura de assinaturas/faturas ignora o que está fora do espelho do CRM", () => {
  const furos: string[] = [];
  for (const arq of fontes("src")) {
    const rel = relative(".", arq).split(sep).join("/");
    if (rel in SEM_FILTRO_DE_PROPOSITO || rel.endsWith("espelho-crm.ts")) continue;
    const src = readFileSync(arq, "utf8");
    for (const b of blocos(src)) {
      if (!b.trecho.match(FILTRO)) {
        const linha = src.slice(0, b.pos).split("\n").length;
        furos.push(`${rel}:${linha}  ${b.trecho.split("\n")[0].trim().slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(furos, [], `leitura sem o filtro de fora_do_espelho_em (use doCrm/assinaturaDoCrm/faturaDoCrm):\n${furos.join("\n")}`);
});

test("a lista de exceções não esconde arquivo que nem existe mais", () => {
  for (const arq of Object.keys(SEM_FILTRO_DE_PROPOSITO)) {
    assert.doesNotThrow(() => readFileSync(arq, "utf8"), `exceção obsoleta: ${arq}`);
  }
});

test("os filtros geram o SQL da marca da migration 0119", () => {
  const d = new PgDialect();
  assert.equal(d.sqlToQuery(sql`${doCrm("f")}`).sql, "f.fora_do_espelho_em IS NULL");
  assert.match(d.sqlToQuery(assinaturaDoCrm).sql, /"assinaturas"\."fora_do_espelho_em" is null/);
  assert.match(d.sqlToQuery(faturaDoCrm).sql, /"faturas"\."fora_do_espelho_em" is null/);
  assert.throws(() => doCrm("f; DROP TABLE faturas"));
});
