import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

export const runtime = "nodejs";

/**
 * Ingestão do faturamento externo mensal.
 * O arquivo real usa ISO-8859-1, ponto-e-vírgula e:
 * CardCode;CardName;CPFCNPJ;ValorBruto.
 *
 * A planilha é evidência do Service Ledger, não Stripe, fatura sintética ou
 * fonte de MRR. O fluxo é preview -> commit -> fechamento imutável.
 */

type LedgerRow = {
  rowNumber: number;
  cardCode: string;
  companyName: string;
  document: string | null;
  billedValue: number;
  sourceRowHash: string;
};

type Match = {
  companyId: string | null;
  companyName: string | null;
  serviceId: string | null;
  serviceFamily: "PABX" | "UNKNOWN";
  revenueNature: "MRR" | "SETUP" | "PROJECT" | "ONE_TIME" | "USAGE" | "HARDWARE" | "UNKNOWN";
  confidence: "CONFIRMED" | "AMBIGUOUS" | "UNRESOLVED";
  reason: string;
};

const normalizeHeader = (value: string) => value
  .replace(/^\uFEFF/, "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const normalizeDocument = (value: string | null | undefined) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
};

function splitDelimitedLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseMoney(value: string): number | null {
  const clean = value.replace(/[R$\s]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function parseSpreadsheet(buffer: ArrayBuffer, fileName: string): { rows: LedgerRow[]; errors: string[]; encoding: string } {
  // windows-1252 is the compatible Node decoder for ISO-8859-1 Portuguese exports.
  const text = new TextDecoder("windows-1252").decode(buffer).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], errors: ["Arquivo vazio ou sem linhas de dados"], encoding: "windows-1252" };

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = splitDelimitedLine(lines[0], separator).map(normalizeHeader);
  const find = (...names: string[]) => names.map(normalizeHeader).map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const cardCodeIndex = find("cardcode", "codigo", "code");
  const companyIndex = find("cardname", "empresa", "nome");
  const documentIndex = find("cpfcnpj", "cnpj", "cpf", "documento");
  const valueIndex = find("valorbruto", "valor", "total", "mensalidade");
  const missing = [
    cardCodeIndex < 0 ? "CardCode" : null,
    companyIndex < 0 ? "CardName" : null,
    documentIndex < 0 ? "CPFCNPJ" : null,
    valueIndex < 0 ? "ValorBruto" : null,
  ].filter((value): value is string => !!value);
  if (missing.length) return { rows: [], errors: [`Colunas obrigatórias ausentes: ${missing.join(", ")}`], encoding: "windows-1252" };

  const errors: string[] = [];
  const rows: LedgerRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitDelimitedLine(lines[index], separator);
    const rowNumber = index + 1;
    const cardCode = values[cardCodeIndex] || "";
    const companyName = values[companyIndex] || "";
    const rawDocument = values[documentIndex] || "";
    const document = normalizeDocument(rawDocument);
    const billedValue = parseMoney(values[valueIndex] || "");
    if (!cardCode && !companyName && !rawDocument && !values[valueIndex]) continue;
    if (billedValue === null) {
      errors.push(`Linha ${rowNumber}: ValorBruto inválido (${values[valueIndex] || "vazio"})`);
      continue;
    }
    // Identidade da linha é conteúdo + CardCode, não posição física: reordenar
    // o CSV não pode criar lançamentos novos na mesma competência.
    const sourceRowHash = createHash("sha256")
      .update(`${cardCode.trim().toUpperCase()}|${companyName.trim()}|${document || ""}|${billedValue.toFixed(2)}`)
      .digest("hex");
    if (rows.some((existing) => existing.sourceRowHash === sourceRowHash)) {
      errors.push(`Linha ${rowNumber}: duplicata da linha de faturamento (documento/linha)`);
      continue;
    }
    rows.push({ rowNumber, cardCode, companyName, document, billedValue, sourceRowHash });
  }
  if (!rows.length && !errors.length) errors.push(`Nenhuma linha válida em ${fileName}`);
  return { rows, errors, encoding: "windows-1252" };
}

async function matchRows(organizacaoId: string, rows: LedgerRow[]): Promise<(LedgerRow & { match: Match })[]> {
  const companies = await db.execute<{ id: string; nome: string; cnpj: string | null; canonical_empresa_id: string | null }>(sql`
    SELECT id, nome, cnpj, canonical_empresa_id FROM empresas WHERE organizacao_id = ${organizacaoId}
  `);
  const services = await db.execute<{ id: string; empresa_id: string | null; service_family: string; revenue_nature: string }>(sql`
    SELECT id, empresa_id, service_family, revenue_nature FROM servicos_canonicos
    WHERE organizacao_id = ${organizacaoId} AND service_family = 'PABX'
  `);
  const canonicalByCompanyId = new Map<string, string>();
  for (const company of companies) canonicalByCompanyId.set(company.id, company.canonical_empresa_id || company.id);
  const companiesByDocument = new Map<string, { id: string; nome: string }[]>();
  for (const company of companies) {
    const document = normalizeDocument(company.cnpj);
    if (!document) continue;
    const canonicalId = company.canonical_empresa_id || company.id;
    const list = companiesByDocument.get(document) || [];
    if (!list.some((candidate) => candidate.id === canonicalId)) list.push({ id: canonicalId, nome: company.nome });
    companiesByDocument.set(document, list);
  }
  const servicesByCompany = new Map<string, { id: string; serviceFamily: "PABX" | "UNKNOWN"; revenueNature: Match["revenueNature"] }[]>();
  for (const service of services) {
    if (!service.empresa_id) continue;
    const serviceCompanyId = canonicalByCompanyId.get(service.empresa_id) || service.empresa_id;
    const list = servicesByCompany.get(serviceCompanyId) || [];
    list.push({
      id: service.id,
      serviceFamily: service.service_family === "PABX" ? "PABX" : "UNKNOWN",
      revenueNature: ["MRR", "SETUP", "PROJECT", "ONE_TIME", "USAGE", "HARDWARE"].includes(service.revenue_nature)
        ? service.revenue_nature as Match["revenueNature"]
        : "UNKNOWN",
    });
    servicesByCompany.set(serviceCompanyId, list);
  }

  return rows.map((row) => {
    if (!row.document) return { ...row, match: { companyId: null, companyName: null, serviceId: null, serviceFamily: "UNKNOWN", revenueNature: "UNKNOWN", confidence: "UNRESOLVED", reason: "CPF/CNPJ ausente" } };
    const candidates = companiesByDocument.get(row.document) || [];
    if (candidates.length !== 1) {
      return { ...row, match: { companyId: null, companyName: null, serviceId: null, serviceFamily: "UNKNOWN", revenueNature: "UNKNOWN", confidence: candidates.length > 1 ? "AMBIGUOUS" : "UNRESOLVED", reason: candidates.length > 1 ? "CPF/CNPJ vinculado a mais de uma empresa" : "CPF/CNPJ não encontrado" } };
    }
    const company = candidates[0];
    const serviceCandidates = servicesByCompany.get(company.id) || [];
    if (serviceCandidates.length === 1) {
      const service = serviceCandidates[0];
      if (service.serviceFamily !== "PABX") {
        return { ...row, match: { companyId: company.id, companyName: company.nome, serviceId: null, serviceFamily: "UNKNOWN", revenueNature: "UNKNOWN", confidence: "UNRESOLVED", reason: "Empresa encontrada, mas o Service não declara família PABX" } };
      }
      return { ...row, match: { companyId: company.id, companyName: company.nome, serviceId: service.id, serviceFamily: "PABX", revenueNature: service.revenueNature, confidence: "CONFIRMED", reason: "Empresa e Service PABX encontrados por CPF/CNPJ" } };
    }
    return { ...row, match: { companyId: company.id, companyName: company.nome, serviceId: null, serviceFamily: "UNKNOWN", revenueNature: "UNKNOWN", confidence: serviceCandidates.length > 1 ? "AMBIGUOUS" : "UNRESOLVED", reason: serviceCandidates.length > 1 ? "Empresa possui mais de um Service PABX" : "Empresa encontrada, mas sem Service PABX vinculado" } };
  });
}

function validateCompetence(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const [latest] = await db.execute(sql`
    SELECT b.id, b.competence::text, b.version, b.source_file, b.source_sha256,
      b.expected_total, b.imported_total, b.row_count, b.status, b.imported_at, b.closed_at,
      COALESCE(SUM(e.billed_value) FILTER (WHERE e.confidence != 'CONFIRMED'), 0)::numeric AS unresolved_total,
      COUNT(e.id) FILTER (WHERE e.confidence != 'CONFIRMED')::int AS unresolved_rows
    FROM service_ledger_batches b
    LEFT JOIN service_ledger_entries e ON e.batch_id = b.id
    WHERE b.organizacao_id = ${ctx.organizacaoId}
    GROUP BY b.id
    ORDER BY b.competence DESC, b.imported_at DESC
    LIMIT 1
  `);
  return NextResponse.json({ latest: latest || null });
}

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const competencia = String(form?.get("competencia") || "");
  const acao = String(form?.get("acao") || "preview");
  const fechar = String(form?.get("fechar") || "false") === "true";
  if (!file || typeof file === "string") return NextResponse.json({ error: "Envie a planilha no campo file" }, { status: 400 });
  if (!validateCompetence(competencia)) return NextResponse.json({ error: "Informe competência no formato YYYY-MM" }, { status: 400 });
  if (acao !== "preview" && acao !== "commit") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  const uploaded = file as File;
  const buffer = await uploaded.arrayBuffer();
  const parsed = parseSpreadsheet(buffer, uploaded.name || "faturamento.csv");
  if (!parsed.rows.length) return NextResponse.json({ error: "Nenhuma linha importável", erros: parsed.errors }, { status: 400 });
  const matched = await matchRows(ctx.organizacaoId, parsed.rows);
  const summary = {
    rows: matched.length,
    total: matched.reduce((sum, row) => sum + row.billedValue, 0),
    confirmed: matched.filter((row) => row.match.confidence === "CONFIRMED").length,
    ambiguous: matched.filter((row) => row.match.confidence === "AMBIGUOUS").length,
    unresolved: matched.filter((row) => row.match.confidence === "UNRESOLVED").length,
    unresolvedTotal: matched.filter((row) => row.match.confidence !== "CONFIRMED").reduce((sum, row) => sum + row.billedValue, 0),
  };
  const responseRows = matched.map((row) => ({ rowNumber: row.rowNumber, cardCode: row.cardCode, sourceCompanyName: row.companyName, document: row.document, billedValue: row.billedValue, ...row.match }));
  if (acao === "preview") return NextResponse.json({ ok: true, mode: "preview", competencia, encoding: parsed.encoding, summary, erros: parsed.errors, rows: responseRows });

  const sourceSha256 = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const version = "pabx_monthly_v1";
  const importedTotal = summary.total.toFixed(2);
  const batch = await db.transaction(async (tx) => {
    // Serializa duas confirmações simultâneas da mesma competência. O lock é
    // deliberadamente por organização+competência, sem tocar em Stripe/MRR.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.organizacaoId}:${competencia}:pabx-ledger`}))`);
    const [existing] = await tx.execute<{ id: string; status: string; source_sha256: string }>(sql`
      SELECT id, status, source_sha256 FROM service_ledger_batches
      WHERE organizacao_id = ${ctx.organizacaoId} AND competence = ${`${competencia}-01`}::date
      ORDER BY imported_at DESC LIMIT 1
    `);
    if (existing?.status === "CLOSED") return { id: existing.id, alreadyPresent: true, closed: true, conflict: "CLOSED" as const };
    if (existing && existing.source_sha256 !== sourceSha256) return { id: existing.id, alreadyPresent: true, closed: false, conflict: "OPEN_DIFFERENT" as const };
    if (existing) {
      if (fechar) {
        const [closed] = await tx.execute<{ id: string }>(sql`
          UPDATE service_ledger_batches
          SET status = 'CLOSED', closed_at = now()
          WHERE id = ${existing.id} AND status = 'OPEN'
          RETURNING id
        `);
        return { id: closed.id, alreadyPresent: true, closed: true, conflict: null };
      }
      return { id: existing.id, alreadyPresent: true, closed: false, conflict: null };
    }
    const [created] = await tx.execute<{ id: string }>(sql`
      INSERT INTO service_ledger_batches
        (organizacao_id, competence, version, source_file, source_sha256, expected_total, imported_total, row_count, status, evidence)
      VALUES
        (${ctx.organizacaoId}, ${`${competencia}-01`}::date, ${version}, ${uploaded.name || "faturamento.csv"}, ${sourceSha256},
         ${importedTotal}::numeric, ${importedTotal}::numeric, ${matched.length}, ${fechar ? "CLOSED" : "OPEN"}::text,
         ${JSON.stringify({ encoding: parsed.encoding, source: "monthly_callface_billing", parser: version, summary, errors: parsed.errors })}::jsonb)
      RETURNING id
    `);
    for (const row of matched) {
      await tx.execute(sql`
        INSERT INTO service_ledger_entries
          (batch_id, organizacao_id, source_row_hash, source_row_number, document, company_name, billed_value, service_family, revenue_nature, service_id, confidence, evidence)
        VALUES
          (${created.id}, ${ctx.organizacaoId}, ${row.sourceRowHash}, ${row.rowNumber}, ${row.document}, ${row.companyName || "Não informado"},
           ${row.billedValue.toFixed(2)}::numeric, ${row.match.serviceFamily}, ${row.match.revenueNature}, ${row.match.serviceId}, ${row.match.confidence},
           ${JSON.stringify({ cardCode: row.cardCode, reason: row.match.reason, matchedCompanyId: row.match.companyId })}::jsonb)
      `);
    }
    return { id: created.id, alreadyPresent: false, closed: fechar, conflict: null };
  });
  if (batch.conflict === "CLOSED") {
    return NextResponse.json({ error: `A competência ${competencia} já está fechada e é imutável`, batchId: batch.id }, { status: 409 });
  }
  if (batch.conflict === "OPEN_DIFFERENT") {
    return NextResponse.json({ error: `Já existe um lote aberto diferente para ${competencia}`, batchId: batch.id }, { status: 409 });
  }
  return NextResponse.json({ ok: true, mode: "commit", idempotente: batch.alreadyPresent, batchId: batch.id, competencia, fechado: batch.closed, summary, erros: parsed.errors }, { status: batch.alreadyPresent ? 200 : 201 });
}
