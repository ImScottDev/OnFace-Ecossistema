/**
 * Agenda externa só é tocada pelo CalendarProvider (Módulo 09 e Módulo 13).
 *
 * O gap que gerou esta camada: existia criar e cancelar, e NÃO existia
 * atualizar. Reagendar mudava a data no ONFACE e deixava o convite antigo de
 * pé na agenda do cliente, sem aviso.
 *
 * Estas travas impedem as duas regressões possíveis: alguém voltar a chamar o
 * Graph direto de uma rota nova, e alguém remover a ponte com o vínculo
 * legado — que é o que impede convite duplicado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FRASE_DA_FALHA } from "@/lib/calendario/provider";
import { microsoftCalendar } from "@/lib/calendario/microsoft";
import { googleCalendar } from "@/lib/calendario/google";

const SRC = path.join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

test("os dois provedores implementam create, update e cancel", () => {
  // O requisito é literal: "Create/Update/Cancel sincronizam provider".
  // Adapter com só duas das três reintroduz exatamente o gap original.
  for (const p of [microsoftCalendar, googleCalendar]) {
    for (const op of ["criar", "atualizar", "cancelar", "contaDoUsuario", "configurado"] as const) {
      assert.equal(typeof p[op], "function", `${p.nome} não implementa ${op}`);
    }
  }
});

test("toda falha tem frase em português, não código", () => {
  // "Nunca falhar silenciosamente": reunião salva sem convite precisa dizer
  // isso na tela, senão a pessoa fecha achando que o cliente foi convidado.
  for (const [motivo, frase] of Object.entries(FRASE_DA_FALHA)) {
    assert.ok(frase.length > 40, `frase curta demais para ${motivo}`);
    assert.doesNotMatch(frase, /undefined|null|Error/, `frase de ${motivo} vaza detalhe técnico`);
  }
});

test("nenhuma rota nova chama o Graph direto", () => {
  // QUATRO caminhos antigos ainda criam evento chamando o Graph direto. Eles
  // são conhecidos, funcionam, e a ponte em sincronizar.ts (COALESCE com
  // outlook_event_id) impede que o reagendamento os duplique. Convertê-los é
  // trabalho da substituição, não desta camada.
  //
  // O que esta trava impede é o QUINTO aparecer — e aparecer é fácil: o helper
  // que existia para deduplicar os três primeiros terminou sem nenhum chamador,
  // e cada rota nova reescreveu a chamada por conta própria.
  const conhecidas = [
    "api-server/routes/reunioes.ts",
    "api-server/routes/leads.ts",
    "api-server/routes/agenda.ts",
    "lib/integrations/callface.ts",
  ];
  const infratores: string[] = [];
  for (const f of arquivos(SRC)) {
    const rel = path.relative(SRC, f);
    if (rel.startsWith(path.join("lib", "calendario"))) continue;
    if (rel === path.join("lib", "email", "microsoft.ts")) continue;
    // Delega ao provider desde 21/09: não é mais caminho direto.
    if (rel === path.join("lib", "crm", "outlook-evento.ts")) continue;
    if (conhecidas.some((c) => rel === c.split("/").join(path.sep))) continue;
    const txt = fs.readFileSync(f, "utf8");
    if (/(createOutlookEvent|updateOutlookEvent|deleteOutlookEvent)\s*\(/.test(txt)) {
      infratores.push(rel);
    }
  }
  assert.deepEqual(infratores, [],
    `chamam o Graph fora do CalendarProvider: ${infratores.join(", ")}. ` +
    `Use lib/calendario/sincronizar.`);
});

test("a ponte com o vínculo legado continua de pé", () => {
  // Enquanto as rotas antigas gravarem só outlook_event_id, o provider precisa
  // reconhecê-lo. Sem isso, reagendar uma reunião criada por elas acha que
  // nunca houve evento externo e cria um SEGUNDO convite na agenda do cliente.
  const txt = fs.readFileSync(path.join(SRC, "lib", "calendario", "sincronizar.ts"), "utf8");
  assert.match(txt, /COALESCE\(r\.calendar_event_id,\s*r\.outlook_event_id\)/,
    "a ponte com outlook_event_id sumiu: reagendamento passaria a duplicar convite");
  assert.match(txt, /outlook_event_id = CASE WHEN/,
    "gravar só a coluna nova quebra o syncOutlookReunioes existente");
});

test("a falha de sync é reprocessável", () => {
  // "Falha de sync é visível e reprocessável." Visível sem reprocessável é
  // um erro que alguém lê e ninguém resolve.
  const txt = fs.readFileSync(path.join(SRC, "lib", "calendario", "sincronizar.ts"), "utf8");
  assert.match(txt, /export async function reprocessarSyncPendente/);
  const worker = fs.readFileSync(path.join(SRC, "worker", "index.ts"), "utf8");
  assert.match(worker, /calendar-sync-retry/, "o reprocessamento existe e ninguém o agenda");
});
