/**
 * Espelha o White Label da plataforma Callface AI e confere o que ela faturou
 * contra o CRM.
 *
 *   1. Lê (SOMENTE SELECT, uma transação READ ONLY) parceiros, licenças
 *      `PARTNER_WHITE_LABEL` e faturas de parceiro com itens.
 *   2. Grava o espelho local numa transação só: ou o espelho inteiro troca, ou nada.
 *   3. Liga parceiro a empresa do CRM só por evidência determinística (a
 *      organização do SaaS já vinculada, ou CNPJ único). Nome nunca liga.
 *   4. Roda `conferirParceiros` e persiste as divergências como pendências.
 *      Pendência que deixou de existir é resolvida, não apagada.
 *
 * Multi-tenant: toda linha leva `organizacao_id`, que é o argumento (vindo do
 * loop do worker sobre `organizacoes`), nunca algo lido do SaaS.
 * Nenhum array JS vai ao Postgres: lotes seguem como JSON em `jsonb_to_recordset`.
 */
import { db } from "@/lib/db";
import { doCrm } from "@/lib/financeiro/espelho-crm";
import { sql } from "drizzle-orm";
import {
  lerComTransacao, lerFaturasDeParceiro, lerLicencasWhiteLabel, lerParceiros,
} from "@onface/integrations-callface-ai";
import { conferirParceiros, type FaturaCrm, type FaturaLocal, type LicencaLocal, type ParceiroLocal, type Pendencia } from "@/lib/integrations/callface-ai/parceiro-conferencia";
import { gravarEstado, PROVIDER } from "./sincronizar";

export const RECURSO_PARCEIROS = "parceiros";

const TABELAS_EXIGIDAS = [
  "callface_ai_parceiros", "callface_ai_parceiro_licencas", "callface_ai_parceiro_faturas",
  "callface_ai_parceiro_fatura_itens", "callface_ai_parceiro_pendencias",
];

export interface ResultadoParceiros {
  ok: boolean;
  status: "ok" | "falhou" | "indisponivel" | "desabilitado";
  parceiros: number;
  licencas: number;
  licencasAtivas: number;
  faturas: number;
  itens: number;
  vinculados: number;
  pendenciasAbertas: number;
  pendenciasAltas: number;
  faturasVencidas: number;
  limites: string[];
  erro?: string;
  duracaoMs: number;
}

const digitos = (v: string | null): string => (v ?? "").replace(/\D/g, "");
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export async function sincronizarParceirosCallfaceAi(organizacaoId: string, agora: Date = new Date()): Promise<ResultadoParceiros> {
  const inicio = Date.now();
  const vazio: Omit<ResultadoParceiros, "ok" | "status" | "duracaoMs"> = {
    parceiros: 0, licencas: 0, licencasAtivas: 0, faturas: 0, itens: 0, vinculados: 0,
    pendenciasAbertas: 0, pendenciasAltas: 0, faturasVencidas: 0, limites: [],
  };
  const falha = async (status: ResultadoParceiros["status"], erro: string): Promise<ResultadoParceiros> => {
    await gravarEstado(organizacaoId, RECURSO_PARCEIROS, { status, erro, duracaoMs: Date.now() - inicio });
    return { ...vazio, ok: false, status, erro, duracaoMs: Date.now() - inicio };
  };

  // Falha ANTES de ler o SaaS, dizendo qual migration falta.
  const presentes = await db.execute<{ t: string }>(sql`
    SELECT table_name AS t FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = ANY(${`{${TABELAS_EXIGIDAS.join(",")}}`}::text[])`);
  const tem = new Set(presentes.map((r) => r.t));
  const faltam = TABELAS_EXIGIDAS.filter((t) => !tem.has(t));
  if (faltam.length) return falha("falhou", `esquema do ONFACE sem a migration 0122 (faltam: ${faltam.join(", ")})`);

  const leitura = await lerComTransacao(async (s) => ({
    parceiros: await lerParceiros(s),
    licencas: await lerLicencasWhiteLabel(s),
    faturas: await lerFaturasDeParceiro(s),
  }));
  if (!leitura.ok) {
    return falha("naoConfigurado" in leitura && leitura.naoConfigurado ? "desabilitado" : "indisponivel", leitura.erro);
  }
  const { parceiros, licencas, faturas } = leitura.dados;

  // Vínculo por evidência determinística.
  const porOrg = new Map((await db.execute<{ org: string; empresa: string }>(sql`
    SELECT i.external_id AS org, i.entity_id::text AS empresa
      FROM callface_ai_external_identities i JOIN empresas e ON e.id = i.entity_id
     WHERE i.entity_type = 'empresa' AND i.external_type = 'organization'
       AND i.provider = ${PROVIDER} AND e.organizacao_id = ${organizacaoId}::uuid`)).map((r) => [r.org, r.empresa] as const));
  const porCnpj = new Map((await db.execute<{ doc: string; n: number; id: string }>(sql`
    SELECT regexp_replace(e.cnpj, '\D', '', 'g') AS doc, count(*)::int AS n, min(e.id::text) AS id
      FROM empresas e WHERE e.organizacao_id = ${organizacaoId}::uuid AND e.cnpj IS NOT NULL
     GROUP BY 1`)).map((r) => [r.doc, r] as const));
  const lotePar = parceiros.map((p) => {
    const viaOrg = p.organizationId ? porOrg.get(p.organizationId) ?? null : null;
    const c = porCnpj.get(digitos(p.documento));
    const viaCnpj = !viaOrg && c && c.n === 1 && digitos(p.documento).length >= 11 ? c.id : null;
    return {
      id: p.partnerId, nome: p.nome, preco: p.precoPorLicenca, dia: p.diaFaturamento, prazo: p.prazoPagamentoDias,
      dominio: p.dominio, dns: p.dnsVerificado, ativo: p.ativo,
      empresa: viaOrg ?? viaCnpj, origem: viaOrg ? "organizacao" : viaCnpj ? "cnpj" : null,
    };
  });
  const loteLic = licencas.map((l) => ({
    id: l.licenseId, parceiro: l.partnerId, org: l.organizationId, nome: l.orgNome,
    ini: iso(l.inicioEm), rev: iso(l.revogadaEm), exp: iso(l.expiraEm),
  }));
  const loteFat = faturas.map((f) => ({
    id: f.invoiceId, parceiro: f.partnerId, status: f.status, comp: f.competencia, ini: f.cicloInicio, fim: f.cicloFim,
    venc: iso(f.vencimento), paga: iso(f.pagaEm), total: f.total, moeda: f.moeda,
  }));
  const loteItens = faturas.flatMap((f) => f.itens.map((i) => ({
    id: i.itemId, fatura: i.invoiceId, lic: i.licenseId, org: i.organizationId, ativos: i.diasAtivos,
    ciclo: i.diasNoCiclo, prop: i.proporcional, preco: i.precoUnitario, total: i.totalLinha,
    lini: iso(i.licencaInicioEm), lrev: iso(i.licencaRevogadaEm),
  })));

  try {
    await db.transaction(async (tx) => {
      const org = sql`${organizacaoId}::uuid`;
      // Cada tabela: upsert do que veio, depois remove o que o SaaS não tem mais.
      await tx.execute(sql`
        INSERT INTO callface_ai_parceiros (organizacao_id, partner_id, nome, preco_por_licenca, dia_faturamento,
          prazo_pagamento_dias, dominio, dns_verificado, ativo, empresa_id, vinculo_origem, coletado_em)
        SELECT ${org}, r.id, r.nome, r.preco, r.dia, r.prazo, r.dominio, r.dns, r.ativo, r.empresa, r.origem, now()
          FROM jsonb_to_recordset(${JSON.stringify(lotePar)}::jsonb)
               AS r(id text, nome text, preco numeric, dia int, prazo int, dominio text, dns boolean, ativo boolean, empresa uuid, origem text)
        ON CONFLICT (organizacao_id, partner_id) DO UPDATE SET
          nome = EXCLUDED.nome, preco_por_licenca = EXCLUDED.preco_por_licenca, dia_faturamento = EXCLUDED.dia_faturamento,
          prazo_pagamento_dias = EXCLUDED.prazo_pagamento_dias, dominio = EXCLUDED.dominio,
          dns_verificado = EXCLUDED.dns_verificado, ativo = EXCLUDED.ativo,
          -- vínculo manual é decisão de pessoa: o sync não desfaz.
          empresa_id = CASE WHEN callface_ai_parceiros.vinculo_origem = 'manual' THEN callface_ai_parceiros.empresa_id ELSE EXCLUDED.empresa_id END,
          vinculo_origem = CASE WHEN callface_ai_parceiros.vinculo_origem = 'manual' THEN 'manual' ELSE EXCLUDED.vinculo_origem END,
          coletado_em = EXCLUDED.coletado_em`);
      await tx.execute(sql`
        INSERT INTO callface_ai_parceiro_licencas (organizacao_id, license_id, partner_id, external_organization_id, org_nome, inicio_em, revogada_em, expira_em, coletado_em)
        SELECT ${org}, r.id, r.parceiro, r.org, r.nome, r.ini, r.rev, r.exp, now()
          FROM jsonb_to_recordset(${JSON.stringify(loteLic)}::jsonb)
               AS r(id text, parceiro text, org text, nome text, ini timestamptz, rev timestamptz, exp timestamptz)
        ON CONFLICT (organizacao_id, license_id) DO UPDATE SET
          partner_id = EXCLUDED.partner_id, external_organization_id = EXCLUDED.external_organization_id,
          org_nome = EXCLUDED.org_nome, inicio_em = EXCLUDED.inicio_em, revogada_em = EXCLUDED.revogada_em,
          expira_em = EXCLUDED.expira_em, coletado_em = EXCLUDED.coletado_em`);
      await tx.execute(sql`
        INSERT INTO callface_ai_parceiro_faturas (organizacao_id, invoice_id, partner_id, status, competencia, ciclo_inicio, ciclo_fim, vencimento, paga_em, total, moeda, coletado_em)
        SELECT ${org}, r.id, r.parceiro, r.status, r.comp, r.ini, r.fim, r.venc, r.paga, r.total, r.moeda, now()
          FROM jsonb_to_recordset(${JSON.stringify(loteFat)}::jsonb)
               AS r(id text, parceiro text, status text, comp date, ini date, fim date, venc timestamptz, paga timestamptz, total numeric, moeda text)
        ON CONFLICT (organizacao_id, invoice_id) DO UPDATE SET
          partner_id = EXCLUDED.partner_id, status = EXCLUDED.status, competencia = EXCLUDED.competencia,
          ciclo_inicio = EXCLUDED.ciclo_inicio, ciclo_fim = EXCLUDED.ciclo_fim, vencimento = EXCLUDED.vencimento,
          paga_em = EXCLUDED.paga_em, total = EXCLUDED.total, moeda = EXCLUDED.moeda, coletado_em = EXCLUDED.coletado_em`);
      await tx.execute(sql`
        INSERT INTO callface_ai_parceiro_fatura_itens (organizacao_id, item_id, invoice_id, license_id, external_organization_id,
          dias_ativos, dias_no_ciclo, proporcional, preco_unitario, total_linha, licenca_inicio_em, licenca_revogada_em, coletado_em)
        SELECT ${org}, r.id, r.fatura, r.lic, r.org, r.ativos, r.ciclo, r.prop, r.preco, r.total, r.lini, r.lrev, now()
          FROM jsonb_to_recordset(${JSON.stringify(loteItens)}::jsonb)
               AS r(id text, fatura text, lic text, org text, ativos int, ciclo int, prop boolean, preco numeric, total numeric, lini timestamptz, lrev timestamptz)
        ON CONFLICT (organizacao_id, item_id) DO UPDATE SET
          invoice_id = EXCLUDED.invoice_id, license_id = EXCLUDED.license_id, external_organization_id = EXCLUDED.external_organization_id,
          dias_ativos = EXCLUDED.dias_ativos, dias_no_ciclo = EXCLUDED.dias_no_ciclo, proporcional = EXCLUDED.proporcional,
          preco_unitario = EXCLUDED.preco_unitario, total_linha = EXCLUDED.total_linha,
          licenca_inicio_em = EXCLUDED.licenca_inicio_em, licenca_revogada_em = EXCLUDED.licenca_revogada_em,
          coletado_em = EXCLUDED.coletado_em`);
      // O que a rodada não tocou saiu do SaaS: todas as linhas desta rodada têm coletado_em = now() da transação.
      for (const t of ["callface_ai_parceiro_fatura_itens", "callface_ai_parceiro_faturas", "callface_ai_parceiro_licencas", "callface_ai_parceiros"] as const) {
        await tx.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE organizacao_id = ${org} AND coletado_em < now()`);
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CallfaceAI] espelho de parceiros falhou:", msg);
    return falha("falhou", `espelho de parceiros: ${msg.slice(0, 300)}`);
  }

  // Conferência a partir do espelho local + o que o CRM tem.
  const dados = await carregarParaConferencia(organizacaoId);
  const { pendencias, limites } = conferirParceiros(dados, agora);
  await persistirPendencias(organizacaoId, pendencias);

  const abertas = pendencias.length;
  const altas = pendencias.filter((p) => p.severidade === "alta").length;
  const vencidas = pendencias.filter((p) => p.tipo === "fatura_vencida").length;
  await gravarEstado(organizacaoId, RECURSO_PARCEIROS, {
    status: "ok", sucesso: true, itens: parceiros.length + licencas.length + faturas.length + loteItens.length,
    duracaoMs: Date.now() - inicio,
  });
  return {
    ok: true, status: "ok", parceiros: parceiros.length, licencas: licencas.length,
    licencasAtivas: licencas.filter((l) => l.ativaHoje).length, faturas: faturas.length, itens: loteItens.length,
    vinculados: lotePar.filter((p) => p.empresa).length,
    pendenciasAbertas: abertas, pendenciasAltas: altas, faturasVencidas: vencidas, limites,
    duracaoMs: Date.now() - inicio,
  };
}

async function carregarParaConferencia(organizacaoId: string) {
  const org = sql`${organizacaoId}::uuid`;
  const [pars, lics, fats, itens, crm] = await Promise.all([
    db.execute<{ id: string; nome: string | null; preco: string | null; empresa: string | null }>(sql`
      SELECT partner_id AS id, nome, preco_por_licenca::text AS preco, empresa_id::text AS empresa
        FROM callface_ai_parceiros WHERE organizacao_id = ${org}`),
    // `conexao.ts` usa fetch_types:false, então timestamptz volta como STRING, não Date:
    // anotar `Date` aqui era mentira e `inicioEm.getTime()` explodia na conferência.
    // Pede texto e converte uma vez, no limite.
    db.execute<{ id: string; parceiro: string | null; ini: string | null; rev: string | null; exp: string | null }>(sql`
      SELECT license_id AS id, partner_id AS parceiro,
             inicio_em::text AS ini, revogada_em::text AS rev, expira_em::text AS exp
        FROM callface_ai_parceiro_licencas WHERE organizacao_id = ${org}`),
    db.execute<{ id: string; parceiro: string; status: string; comp: string | null; ini: string | null; fim: string | null; venc: string | null; total: string | null }>(sql`
      SELECT invoice_id AS id, partner_id AS parceiro, status, competencia::text AS comp,
             ciclo_inicio::text AS ini, ciclo_fim::text AS fim, vencimento::text AS venc, total::text AS total
        FROM callface_ai_parceiro_faturas WHERE organizacao_id = ${org}`),
    db.execute<{ id: string; fatura: string; lic: string | null; ativos: number; ciclo: number; prop: boolean; preco: string; total: string }>(sql`
      SELECT item_id AS id, invoice_id AS fatura, license_id AS lic, dias_ativos AS ativos, dias_no_ciclo AS ciclo,
             coalesce(proporcional, false) AS prop, preco_unitario::text AS preco, total_linha::text AS total
        FROM callface_ai_parceiro_fatura_itens WHERE organizacao_id = ${org}`),
    // Só o que é do CRM: o que o sync do Stripe espelhou do SaaS por engano fica de fora.
    db.execute<{ parceiro: string; id: string; valor: string; status: string; comp: string | null }>(sql`
      SELECT p.partner_id AS parceiro, f.id::text AS id, f.valor::text AS valor, f.status, f.competencia::text AS comp
        FROM callface_ai_parceiros p
        JOIN faturas f ON f.empresa_id = p.empresa_id AND f.organizacao_id = p.organizacao_id
       WHERE p.organizacao_id = ${org} AND ${doCrm("f")}`),
  ]);
  const itensPor = new Map<string, FaturaLocal["itens"]>();
  for (const i of itens) {
    itensPor.set(i.fatura, [...(itensPor.get(i.fatura) ?? []), {
      itemId: i.id, licenseId: i.lic, diasAtivos: Number(i.ativos), diasNoCiclo: Number(i.ciclo),
      proporcional: Boolean(i.prop), precoUnitario: Number(i.preco), totalLinha: Number(i.total),
    }]);
  }
  const parceiros: ParceiroLocal[] = pars.map((p) => ({
    partnerId: p.id, nome: p.nome, precoPorLicenca: p.preco === null ? null : Number(p.preco), empresaId: p.empresa,
  }));
  const licencas: LicencaLocal[] = lics.map((l) => ({
    licenseId: l.id, partnerId: l.parceiro, inicioEm: data(l.ini), revogadaEm: data(l.rev), expiraEm: data(l.exp),
  }));
  const faturas: FaturaLocal[] = fats.map((f) => ({
    invoiceId: f.id, partnerId: f.parceiro, status: f.status, competencia: f.comp, cicloInicio: f.ini, cicloFim: f.fim,
    vencimento: data(f.venc), total: f.total === null ? null : Number(f.total), itens: itensPor.get(f.id) ?? [],
  }));
  const faturasCrm: FaturaCrm[] = crm.map((c) => ({
    partnerId: c.parceiro, faturaId: c.id, valor: Number(c.valor), status: c.status, competencia: c.comp,
  }));
  return { parceiros, licencas, faturas, faturasCrm };
}

/**
 * Texto do Postgres para Date. Data inválida vira null, para não virar `Invalid Date`
 * silencioso. Exportada só para o teste: era aqui que o espelho de White Label morria
 * com `inicioEm.getTime is not a function`, porque o tipo dizia Date e vinha string.
 */
export function data(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function persistirPendencias(organizacaoId: string, pendencias: Pendencia[]): Promise<void> {
  const lote = pendencias.map((p) => ({
    chave: p.chave, tipo: p.tipo, sev: p.severidade, parceiro: p.partnerId, fatura: p.invoiceId,
    msg: p.mensagem, esp: p.esperado, enc: p.encontrado,
  }));
  await db.transaction(async (tx) => {
    const org = sql`${organizacaoId}::uuid`;
    await tx.execute(sql`
      INSERT INTO callface_ai_parceiro_pendencias
        (organizacao_id, chave, tipo, severidade, partner_id, invoice_id, mensagem, esperado, encontrado, detectada_em, ultima_vista_em)
      SELECT ${org}, r.chave, r.tipo, r.sev, r.parceiro, r.fatura, r.msg, r.esp, r.enc, now(), now()
        FROM jsonb_to_recordset(${JSON.stringify(lote)}::jsonb)
             AS r(chave text, tipo text, sev text, parceiro text, fatura text, msg text, esp numeric, enc numeric)
      ON CONFLICT (organizacao_id, chave) DO UPDATE SET
        tipo = EXCLUDED.tipo, severidade = EXCLUDED.severidade, mensagem = EXCLUDED.mensagem,
        esperado = EXCLUDED.esperado, encontrado = EXCLUDED.encontrado, ultima_vista_em = now(),
        -- voltou a divergir depois de resolvida: é uma detecção nova.
        detectada_em = CASE WHEN callface_ai_parceiro_pendencias.resolvida_em IS NOT NULL THEN now() ELSE callface_ai_parceiro_pendencias.detectada_em END,
        resolvida_em = NULL`);
    // Não foi vista nesta rodada: o fato desapareceu.
    await tx.execute(sql`
      UPDATE callface_ai_parceiro_pendencias SET resolvida_em = now()
       WHERE organizacao_id = ${org} AND resolvida_em IS NULL AND ultima_vista_em < now()`);
  });
}

/** Leitura para quem for exibir: as pendências abertas, mais graves primeiro. */
export async function lerPendenciasDeParceiro(organizacaoId: string) {
  return db.execute<{
    chave: string; tipo: string; severidade: string; partner_id: string | null; invoice_id: string | null;
    mensagem: string; esperado: string | null; encontrado: string | null; detectada_em: Date;
  }>(sql`
    SELECT chave, tipo, severidade, partner_id, invoice_id, mensagem,
           esperado::text, encontrado::text, detectada_em
      FROM callface_ai_parceiro_pendencias
     WHERE organizacao_id = ${organizacaoId}::uuid AND resolvida_em IS NULL
     ORDER BY CASE severidade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, detectada_em`);
}
