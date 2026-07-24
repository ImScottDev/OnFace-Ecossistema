import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

/**
 * Ingestão da receita PABX (planilha mensal da Wevy) — F10.
 *
 * POST /api/financeiro/pabx-import  (multipart: file=CSV)
 * Modelo do CSV (cabeçalho obrigatório, separador vírgula ou ponto-e-vírgula):
 *   empresa,email,mensalidade,competencia,valor,status,paga_em
 *   ACME Ltda,fin@acme.com,450.00,2026-07,450.00,paga,2026-07-05
 *
 *  - competencia: YYYY-MM (mês de referência da cobrança)
 *  - status: paga | aberta
 *  - paga_em: YYYY-MM-DD (vazio se aberta)
 *  - Chave estável da fatura = email|competencia → subir a mesma planilha 2x NÃO duplica.
 *  - Lead é casado por email; se não existir, é criado como cliente.
 *  - Contrato PABX: 1 por lead (produto='pabx'), mrr = mensalidade da última carga.
 *
 * GET /api/financeiro/pabx-import → estado da última carga (data, faturas, valor).
 */

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const [row] = (await db.execute(sql`
    SELECT max(f.synced_at) AS ultima_carga,
           count(*)::int AS faturas,
           count(DISTINCT f.lead_id)::int AS clientes,
           COALESCE(sum(f.valor) FILTER (WHERE f.status = 'aberta'), 0)::float AS em_aberto
    FROM faturas f WHERE f.origem = 'pabx'
  `)) as unknown as { ultima_carga: string | null; faturas: number; clientes: number; em_aberto: number }[];
  return NextResponse.json({
    ultimaCarga: row?.ultima_carga || null,
    faturas: row?.faturas || 0,
    clientes: row?.clientes || 0,
    emAberto: row?.em_aberto || 0,
  });
}

type LinhaCsv = {
  empresa: string;
  email: string;
  mensalidade: number;
  competencia: string; // YYYY-MM
  valor: number;
  status: "paga" | "aberta";
  pagaEm: string | null;
};

function parseCsv(texto: string): { linhas: LinhaCsv[]; erros: string[] } {
  const erros: string[] = [];
  const linhas: LinhaCsv[] = [];
  const raw = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (raw.length < 2) return { linhas, erros: ["CSV vazio ou sem linhas de dados"] };

  const sep = raw[0].includes(";") ? ";" : ",";
  const header = raw[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = (nome: string) => header.indexOf(nome);
  const obrigatorias = ["empresa", "email", "mensalidade", "competencia", "valor", "status"];
  const faltando = obrigatorias.filter((c) => idx(c) === -1);
  if (faltando.length) return { linhas, erros: [`Colunas faltando no cabeçalho: ${faltando.join(", ")}`] };

  const num = (s: string) => parseFloat(s.replace(/\./g, (m, i, str) => (str.includes(",") ? "" : m)).replace(",", "."));

  for (let i = 1; i < raw.length; i++) {
    const cols = raw[i].split(sep).map((c) => c.trim());
    const email = (cols[idx("email")] || "").toLowerCase();
    const competencia = cols[idx("competencia")] || "";
    const status = (cols[idx("status")] || "").toLowerCase();
    const mensalidade = num(cols[idx("mensalidade")] || "0");
    const valor = num(cols[idx("valor")] || "0");
    if (!email || !email.includes("@")) { erros.push(`Linha ${i + 1}: email inválido "${email}"`); continue; }
    if (!/^\d{4}-\d{2}$/.test(competencia)) { erros.push(`Linha ${i + 1}: competência "${competencia}" não é YYYY-MM`); continue; }
    if (status !== "paga" && status !== "aberta") { erros.push(`Linha ${i + 1}: status "${status}" (use paga|aberta)`); continue; }
    if (!Number.isFinite(valor) || valor < 0) { erros.push(`Linha ${i + 1}: valor inválido`); continue; }
    const pagaEmRaw = idx("paga_em") >= 0 ? cols[idx("paga_em")] : "";
    linhas.push({
      empresa: cols[idx("empresa")] || email,
      email,
      mensalidade: Number.isFinite(mensalidade) ? mensalidade : 0,
      competencia,
      valor,
      status: status as "paga" | "aberta",
      pagaEm: /^\d{4}-\d{2}-\d{2}$/.test(pagaEmRaw) ? pagaEmRaw : null,
    });
  }
  return { linhas, erros };
}

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const orgId = ctx.organizacaoId;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Envie o CSV no campo 'file' (multipart)" }, { status: 400 });
  }
  const texto = await (file as File).text();
  const { linhas, erros } = parseCsv(texto);
  if (linhas.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha válida", erros }, { status: 400 });
  }

  let leadsCriados = 0;
  let contratosCriados = 0;
  let faturasUpsert = 0;

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('pabx-import'))`);
    // ISO string: o driver postgres-js não serializa Date cru em sql`` (gotcha do projeto)
    const agora = new Date().toISOString();

    for (const l of linhas) {
      // Lead por email (case-insensitive)
      let leadId: string;
      const leadRows = (await tx.execute(sql`
        SELECT id FROM leads WHERE lower(email) = ${l.email} AND (organizacao_id = ${orgId} OR organizacao_id IS NULL) LIMIT 1
      `)) as unknown as { id: string }[];
      if (leadRows[0]) {
        leadId = leadRows[0].id;
      } else {
        const novo = (await tx.execute(sql`
          INSERT INTO leads (organizacao_id, nome, email, empresa, tipo, origem, cliente_desde)
          VALUES (${orgId}, ${l.empresa}, ${l.email}, ${l.empresa}, 'cliente', 'pabx_import', now())
          RETURNING id
        `)) as unknown as { id: string }[];
        leadId = novo[0].id;
        leadsCriados++;
      }

      // Contrato PABX (1 por lead)
      const ctr = (await tx.execute(sql`
        SELECT id, mrr::float FROM contratos
        WHERE lead_id = ${leadId} AND produto = 'pabx' AND status = 'ativo' LIMIT 1
      `)) as unknown as { id: string; mrr: number }[];
      let contratoId: string;
      if (ctr[0]) {
        contratoId = ctr[0].id;
        if (Math.abs((ctr[0].mrr || 0) - l.mensalidade) >= 0.005 && l.mensalidade > 0) {
          await tx.execute(sql`UPDATE contratos SET mrr = ${l.mensalidade.toFixed(2)}, updated_at = now() WHERE id = ${contratoId}`);
        }
      } else {
        const novoCtr = (await tx.execute(sql`
          INSERT INTO contratos (organizacao_id, lead_id, tipo, descricao, mrr, status, produto, renovacao_auto, inicio)
          VALUES (${orgId}, ${leadId}, 'pabx', ${"Contrato PABX (planilha Wevy)"}, ${l.mensalidade.toFixed(2)}, 'ativo', 'pabx', true, ${l.competencia + "-01"})
          RETURNING id
        `)) as unknown as { id: string }[];
        contratoId = novoCtr[0].id;
        contratosCriados++;
      }

      // Fatura (chave estável email|competencia)
      const extId = `${l.email}|${l.competencia}`;
      const competenciaDate = `${l.competencia}-01`;
      await tx.execute(sql`
        INSERT INTO faturas (organizacao_id, lead_id, contrato_id, origem, external_id, valor, status, competencia, emitida_em, vencimento, paga_em, synced_at)
        VALUES (${orgId}, ${leadId}, ${contratoId}, 'pabx', ${extId}, ${l.valor.toFixed(2)}, ${l.status},
                ${competenciaDate}, ${competenciaDate}::timestamptz, ${competenciaDate}::timestamptz,
                ${l.pagaEm ? l.pagaEm : null}::timestamptz, ${agora})
        ON CONFLICT (origem, external_id) DO UPDATE SET
          valor = EXCLUDED.valor, status = EXCLUDED.status, paga_em = EXCLUDED.paga_em,
          contrato_id = EXCLUDED.contrato_id, synced_at = EXCLUDED.synced_at, updated_at = now()
      `);
      faturasUpsert++;
    }
  });

  return NextResponse.json({
    ok: true,
    processadas: faturasUpsert,
    leadsCriados,
    contratosCriados,
    errosDeLinha: erros,
  });
}
