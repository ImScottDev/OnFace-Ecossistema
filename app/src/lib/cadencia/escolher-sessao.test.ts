/**
 * Número que a automação usa para falar com o lead (cadence-engine.escolherSessao).
 * O motor mandava pelo token global, sem `sessaoId`: saía por um número que
 * ninguém escolheu. Liga sessões de teste no banco local e apaga tudo no fim.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { leads, whatsappSessao } from "@/lib/db/schema";
import { escolherSessao } from "./cadence-engine";

const sessoes: string[] = [];
const leadsCriados: string[] = [];
after(async () => {
  if (leadsCriados.length) await db.delete(leads).where(inArray(leads.id, leadsCriados));
  if (sessoes.length) await db.delete(whatsappSessao).where(inArray(whatsappSessao.id, sessoes));
  await fecharConexao();
});

test("sessão escolhida vence; senão a do responsável; senão a padrão; desconectada nunca em silêncio", async () => {
  const [u] = await db.execute<{ id: string; org: string }>(sql`SELECT id, organizacao_id AS org FROM usuarios WHERE role = 'admin' AND ativo = true ORDER BY created_at LIMIT 1`);
  // Isola o teste das sessões reais da organização: marca a org inteira como o universo e restaura no fim.
  const reais = await db.select({ id: whatsappSessao.id, status: whatsappSessao.status }).from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, u.org));
  await db.update(whatsappSessao).set({ status: "disconnected" }).where(eq(whatsappSessao.organizacaoId, u.org));
  after(async () => { for (const r of reais) await db.update(whatsappSessao).set({ status: r.status }).where(eq(whatsappSessao.id, r.id)); });

  const nova = async (nome: string, p: { usuarioId?: string; isDefault?: boolean; status?: string }) => {
    const [s] = await db.insert(whatsappSessao).values({ organizacaoId: u.org, sessionName: `qa-${nome}-${randomUUID()}`, label: nome, usuarioId: p.usuarioId ?? null, isDefault: p.isDefault ?? false, status: p.status ?? "connected" }).returning({ id: whatsappSessao.id });
    sessoes.push(s.id);
    return s.id;
  };
  const padrao = await nova("padrao", { isDefault: true });
  const doResponsavel = await nova("do-responsavel", { usuarioId: u.id });
  const desconectada = await nova("fora", { status: "disconnected" });
  const [lead] = await db.insert(leads).values({ organizacaoId: u.org, nome: "[QA] escolher sessao", responsavelId: u.id }).returning({ id: leads.id });
  leadsCriados.push(lead.id);
  const entidade = { tipo: "lead", id: lead.id };

  assert.equal((await escolherSessao(u.org, { entidade })).id, doResponsavel, "sem escolha: número do responsável, não o padrão");
  assert.equal((await escolherSessao(u.org, { preferidaId: padrao, entidade })).id, padrao, "o escolhido no nó/agente vence");
  await assert.rejects(escolherSessao(u.org, { preferidaId: desconectada, entidade }), /desconectada/, "escolhida e desconectada: erro, nunca outro número");
  await db.update(leads).set({ responsavelId: null }).where(eq(leads.id, lead.id));
  assert.equal((await escolherSessao(u.org, { entidade })).id, padrao, "sem responsável: a padrão");
  await db.update(whatsappSessao).set({ status: "disconnected" }).where(inArray(whatsappSessao.id, [padrao, doResponsavel]));
  await assert.rejects(escolherSessao(u.org, { entidade }), /nenhuma sessão/, "nada conectado: erro claro");
});
