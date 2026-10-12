/**
 * Resposta automática é opt-in por conversa. Pela rota real, com sessão válida:
 * conversa nova = "desligada" (agente publicado existe, ninguém ligou);
 * ligar = "ativa" com quem ligou; assumir = "pausada". Dados de QA apagados no fim.
 *
 * API_BASE=http://localhost:3012 npx tsx --env-file=.env src/scripts/provar-ia-opt-in.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const API = process.env.API_BASE ?? "http://localhost:3012";
const SESSAO = "qa-nexo-optin";
async function limpar() {
  await db.execute(sql`DELETE FROM ai_sdr_contato_state WHERE contato_id IN (SELECT id FROM contatos WHERE nome LIKE '[QA nexo]%')`);
  await db.execute(sql`DELETE FROM contatos WHERE nome LIKE '[QA nexo]%'`);
  await db.execute(sql`DELETE FROM whatsapp_sessao WHERE session_name = ${SESSAO}`);
}
async function main() {
  const s = await sessaoDeSmoke({ role: "admin" });
  await limpar();
  const [{ id: sessaoId }] = await db.execute<{ id: string }>(sql`INSERT INTO whatsapp_sessao (organizacao_id, session_name, status, usuario_id) VALUES (${s.organizacaoId}::uuid, ${SESSAO}, 'connected', ${s.usuarioId}::uuid) RETURNING id::text`);
  const [{ id }] = await db.execute<{ id: string }>(sql`INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, responsavel_id, status) VALUES (${s.organizacaoId}::uuid, 'whatsapp', '[QA nexo] Opt-in', '5511999990002', ${sessaoId}::uuid, ${s.usuarioId}::uuid, 'open') RETURNING id::text`);
  const h = { cookie: s.cookie, "content-type": "application/json" };
  const estado = async () => (await (await fetch(`${API}/api/atendimento/conversas/${id}/ia`, { headers: h })).json()) as { estado: string; motivo: string };
  const falhas: string[] = [];
  try {
    const e0 = await estado();
    console.log("novo:", e0.estado, "|", e0.motivo);
    if (e0.estado !== "desligada" && e0.estado !== "sem_agente") falhas.push(`conversa nova deveria estar desligada, veio ${e0.estado}`);
    const e1 = await (await fetch(`${API}/api/atendimento/conversas/${id}/ia`, { method: "POST", headers: h, body: JSON.stringify({ ativa: true }) })).json() as { estado: string; motivo: string };
    console.log("ligar:", e1.estado, "|", e1.motivo);
    if (e0.estado === "desligada" && e1.estado !== "ativa") falhas.push(`ligar deveria ativar, veio ${e1.estado}`);
    const [row] = await db.execute<{ por: string | null; em: string | null }>(sql`SELECT ia_ligada_por::text por, ia_ligada_em::text em FROM ai_sdr_contato_state WHERE contato_id=${id}::uuid`);
    if (row?.por !== s.usuarioId || !row?.em) falhas.push("ia_ligada_por/em não gravados");
    const e2 = await (await fetch(`${API}/api/atendimento/conversas/${id}/ia`, { method: "POST", headers: h, body: JSON.stringify({ ativa: false }) })).json() as { estado: string };
    console.log("assumir:", e2.estado);
    if (e2.estado !== "pausada") falhas.push(`assumir deveria pausar, veio ${e2.estado}`);
    const [row2] = await db.execute<{ por: string | null }>(sql`SELECT ia_ligada_por::text por FROM ai_sdr_contato_state WHERE contato_id=${id}::uuid`);
    if (row2?.por) falhas.push("assumir não limpou o opt-in");
  } finally { await limpar(); }
  if (falhas.length) { console.error("FALHAS:", falhas); process.exit(1); }
  console.log("OK"); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
