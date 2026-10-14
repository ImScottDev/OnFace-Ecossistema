/**
 * Backfill do histórico comercial vindo do CRM anterior: família e produto das propostas, proposta sem negócio,
 * família do negócio e evidência dos ganhos.
 *
 * Contexto medido em 13/10/2026: as 1.593 propostas, os 2.770 itens e os 623 ganhos do CRM anterior JÁ ESTÃO no
 * ONFACE com o mesmo id (carga Marco Zero). Falta o MODELO ATUALIZADO: `service_family` vazio de propósito na
 * carga ("sem evidência fica NULL, nunca PABX"), 455 propostas ligadas só a um lead, 623 ganhos sem nenhuma linha
 * em `comercial_evidencia`. Este script é a evidência. As regras moram em `lib/crm/historico-propostas.ts` (puras,
 * testadas); aqui só se lê, decide e grava.
 *
 * Etapas (`--etapas=a,b`; o padrão é as quatro primeiras):
 *   familia    família do item e da proposta (catálogo oficial > planilha oficial > regra por nome > contexto)
 *   vinculo    proposta ligada só ao lead -> negócio/oportunidade, SÓ quando lead, data e valor batem
 *   negocio    família do negócio e da oportunidade, vinda das propostas dele (aceita manda)
 *   evidencia  `comercial_evidencia` dos ganhos que têm documento (assinatura/fatura no Stripe, contrato)
 *   envio      (opt-in) `enviada_em` das aceitas/recusadas sem data de envio, a partir da data de emissão
 *
 * Garantias:
 *  - `--simular` é o padrão e NÃO escreve: imprime contagens e amostras. `--aplicar` grava numa ÚNICA transação.
 *  - NUNCA sobrescreve: todo UPDATE só preenche coluna vazia (nulo ou UNKNOWN); evidência é INSERT ... DO NOTHING.
 *  - Idempotente: rodar de novo dá 0 a gravar. A marca de origem de cada gravação fica em `backfill_provenance`
 *    (fase 'hist-propostas'), em `proposta_itens.provenance` e em `comercial_evidencia.metadata.origem`.
 *  - Preserva o relógio: todo UPDATE faz `updated_at = updated_at`. Nada vira "mexido hoje" (dias parado e SLA).
 *  - Multi-tenant: `organizacao_id` vem da própria linha lida e cada escrita confere id + organizacao_id.
 *  - O que não casa com confiança NÃO é chutado: vira linha em `reconciliacao_casos` (fase 'hist-propostas') e,
 *    com `--csv=<pasta>`, um CSV por tipo para a revisão humana.
 *  - Não toca Stripe, e-mail, WhatsApp nem outbox: é só SQL no banco do ONFACE.
 *
 * Desfazer (cada marca é consultável):
 *   itens      UPDATE proposta_itens SET service_family=NULL, semantic_confidence=NULL, semantic_evidence=NULL,
 *                provenance=NULL WHERE provenance='backfill-historico-propostas';
 *   propostas  pelas linhas de backfill_provenance com fase='hist-propostas' e entidade_canonica
 *                'proposta_familia' | 'proposta_vinculo' | 'proposta_envio' (id_origem = id da proposta)
 *   negócios   idem, entidade_canonica='negocio_familia'
 *   evidência  DELETE FROM comercial_evidencia WHERE metadata->>'origem'='backfill-historico-propostas';
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/backfill-historico-propostas.ts                       # simula
 *   npx tsx --env-file=.env src/scripts/backfill-historico-propostas.ts --csv=/tmp/revisao    # simula + CSVs
 *   npx tsx --env-file=.env src/scripts/backfill-historico-propostas.ts --aplicar             # ESCREVE
 *   ... --org=<uuid>   restringe a uma organização      ... --etapas=familia,negocio   só algumas etapas
 */
export {}; // módulo próprio: sem isto o `main` colide com o de outro script.

import fs from "node:fs";
import path from "node:path";
import {
  decidirFamiliaDaProposta, decidirVinculo, evidenciasDoGanho,
  type ConfiancaFamilia, type Familia, type FamiliaDaProposta, type NegocioCandidato,
} from "../lib/crm/historico-propostas";

const FASE = "hist-propostas";
const ORIGEM = "backfill-historico-propostas";
const ETAPAS_PADRAO = ["familia", "vinculo", "negocio", "evidencia"];
const ETAPAS_VALIDAS = [...ETAPAS_PADRAO, "envio"];

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const org = opt("org");
const csvDir = opt("csv");
const etapas = opt("etapas")?.split(",").map((s) => s.trim()).filter(Boolean) ?? ETAPAS_PADRAO;
const lote = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

const ehFamilia = (f: string | null): f is Familia => f === "PABX" || f === "CALLFACE_AI" || f === "WHITE_LABEL";
const vazio = (f: string | null) => f === null || f === "UNKNOWN";
const num = (v: string | number | null | undefined) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const data = (segundos: number | null) => (segundos === null ? null : new Date(num(segundos) * 1000));

/** Plano de escrita: decidido na leitura, executado só com `--aplicar`. */
interface Plano {
  itens: { org: string; id: string; familia: Familia; confianca: ConfiancaFamilia; fonte: string; motivo: string }[];
  propFamilia: { org: string; id: string; familia: Familia; metodo: string }[];
  vinculos: { org: string; propostaId: string; negocioId: string; oportunidadeId: string | null; empresaId: string | null }[];
  negFamilia: { org: string; negocioId: string; familia: Familia; metodo: string }[];
  evidencias: { org: string; negocioId: string; tipo: string; ref: string; em: Date | null; metadata: Record<string, unknown> }[];
  envios: { org: string; propostaId: string }[];
}
interface Revisao { org: string; tipo: string; alvo: string; origens: unknown[]; evidencia: Record<string, unknown>; sugestao: Record<string, unknown> }

async function main() {
  if (aplicar && args.includes("--simular")) { console.error("Use --simular OU --aplicar, não os dois."); process.exit(2); }
  if (org && !/^[0-9a-f-]{36}$/i.test(org)) { console.error("--org precisa ser um uuid."); process.exit(2); }
  const invalidas = etapas.filter((e) => !ETAPAS_VALIDAS.includes(e));
  if (invalidas.length) { console.error(`Etapa desconhecida: ${invalidas.join(", ")}. Válidas: ${ETAPAS_VALIDAS.join(", ")}.`); process.exit(2); }

  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  console.log(aplicar ? "MODO: APLICAR (escreve no banco, numa transação)" : "MODO: SIMULAR (nada é escrito)");
  console.log(`Etapas: ${etapas.join(", ")}${org ? `   Organização: ${org}` : ""}   Lote: ${lote}\n`);

  const plano: Plano = { itens: [], propFamilia: [], vinculos: [], negFamilia: [], evidencias: [], envios: [] };
  const revisao: Revisao[] = [];

  /* ───────────── leitura única das propostas e itens (a etapa de negócio também usa) ───────────── */
  const linhas = await db.execute<{
    proposta_id: string; org: string; status: string; fam_proposta: string | null; negocio_id: string | null; lead_id: string | null;
    item_id: string | null; nome: string | null; subtotal: string | null; fam_item: string | null; fam_cat: string | null;
  }>(sql`
    SELECT p.id::text AS proposta_id, p.organizacao_id::text AS org, p.status, p.service_family AS fam_proposta,
           p.negocio_id::text AS negocio_id, p.lead_id::text AS lead_id,
           i.id::text AS item_id, i.nome, i.subtotal::text AS subtotal, i.service_family AS fam_item, c.service_family AS fam_cat
      FROM propostas p
      LEFT JOIN proposta_itens i ON i.proposta_id = p.id
      LEFT JOIN servicos_catalogo c ON c.id = i.servico_catalogo_id AND c.organizacao_id = p.organizacao_id
     WHERE (${org}::uuid IS NULL OR p.organizacao_id = ${org}::uuid)
     ORDER BY p.created_at, p.id, i.ordem NULLS LAST, i.id`);

  interface PropostaLida { id: string; org: string; status: string; famDeclarada: string | null; negocioId: string | null; decisao: FamiliaDaProposta | null }
  const propostas = new Map<string, PropostaLida>();
  const itensPorProposta = new Map<string, { id: string; nome: string | null; subtotal: number; familiaDoItem: string | null; familiaDoCatalogo: string | null }[]>();
  for (const l of linhas) {
    if (!propostas.has(l.proposta_id)) {
      propostas.set(l.proposta_id, { id: l.proposta_id, org: l.org, status: l.status, famDeclarada: l.fam_proposta, negocioId: l.negocio_id, decisao: null });
      itensPorProposta.set(l.proposta_id, []);
    }
    if (l.item_id) itensPorProposta.get(l.proposta_id)!.push({ id: l.item_id, nome: l.nome, subtotal: num(l.subtotal), familiaDoItem: l.fam_item, familiaDoCatalogo: l.fam_cat });
  }
  for (const p of propostas.values()) p.decisao = decidirFamiliaDaProposta(itensPorProposta.get(p.id)!);

  /* ───────────── 1. FAMÍLIA do item e da proposta ───────────── */
  {
    const resultado: Record<string, number> = {};
    const fontes: Record<string, number> = {};
    const porFamilia: Record<string, number> = {};
    for (const p of propostas.values()) {
      const d = p.decisao!;
      const semItens = itensPorProposta.get(p.id)!.length === 0;
      resultado[semItens ? "sem_itens" : d.resultado] = (resultado[semItens ? "sem_itens" : d.resultado] ?? 0) + 1;
      for (const it of d.itens) {
        if (!it.gravar || !it.familia || !it.fonte || !it.confianca) continue;
        fontes[it.fonte] = (fontes[it.fonte] ?? 0) + 1;
        plano.itens.push({ org: p.org, id: it.id, familia: it.familia, confianca: it.confianca, fonte: it.fonte, motivo: it.motivo });
      }
      if (d.resultado === "unica" && d.familia) {
        if (vazio(p.famDeclarada)) {
          plano.propFamilia.push({ org: p.org, id: p.id, familia: d.familia, metodo: `FAMILIA_DOS_ITENS_${d.confianca}` });
          porFamilia[d.familia] = (porFamilia[d.familia] ?? 0) + 1;
        } else if (p.famDeclarada !== d.familia) {
          revisao.push({ org: p.org, tipo: "PROPOSTA_FAMILIA_DIVERGE", alvo: `proposta:${p.id}`, origens: [{ tabela: "propostas", id: p.id }],
            evidencia: { declarada: p.famDeclarada, dosItens: d.familia, status: p.status }, sugestao: { acao: "conferir qual está certa; o script nunca troca família declarada" } });
        }
      } else if (semItens || d.resultado !== "unica") {
        revisao.push({ org: p.org, tipo: "PROPOSTA_FAMILIA_NAO_RESOLVIDA", alvo: `proposta:${p.id}`, origens: [{ tabela: "propostas", id: p.id }],
          evidencia: { motivo: semItens ? "sem_itens" : d.resultado, status: p.status, porFamilia: d.porFamilia,
            itensSemFamilia: d.itens.filter((x) => !x.familia && !x.ajuste).map((x) => itensPorProposta.get(p.id)!.find((i) => i.id === x.id)?.nome) },
          sugestao: { acao: d.resultado === "mista" ? "proposta de mais de uma família: o item já leva a sua; decidir se divide em grupos" : "informar a família da proposta" } });
      }
    }
    console.log("── FAMÍLIA ──");
    console.log(`  propostas por resultado:`, resultado);
    console.log(`  itens a gravar: ${plano.itens.length}  por fonte:`, fontes);
    console.log(`  propostas a gravar: ${plano.propFamilia.length}  por família:`, porFamilia);
  }

  /* ───────────── 2. VÍNCULO: proposta ligada só ao lead ───────────── */
  const vinculoNovo = new Map<string, string>(); // proposta -> negócio, só os FORTE (a etapa de negócio enxerga em simulação também)
  {
    const cand = await db.execute<{
      proposta_id: string; org: string; status: string; p_criada: number; total_recorrente: string | null; total_geral: string | null;
      negocio_id: string | null; n_criado: number | null; mrr_fechado: string | null; mrr_estimado: string | null; valor_total: string | null;
      n_empresa: string | null; oportunidade_id: string | null;
    }>(sql`
      SELECT p.id::text AS proposta_id, p.organizacao_id::text AS org, p.status, extract(epoch FROM p.created_at)::float8 AS p_criada,
             p.total_recorrente::text, p.total_geral::text,
             n.id::text AS negocio_id, extract(epoch FROM n.created_at)::float8 AS n_criado,
             n.mrr_fechado::text, n.mrr_estimado::text, n.valor_total::text, n.empresa_id::text AS n_empresa, o.id::text AS oportunidade_id
        FROM propostas p
        LEFT JOIN negocios n ON n.organizacao_id = p.organizacao_id
             AND n.negocio_origem_id IS NULL  -- a cópia 'ativo' da carteira não é outra venda
             AND (n.lead_id = p.lead_id OR EXISTS (SELECT 1 FROM negocio_leads nl WHERE nl.negocio_id = n.id AND nl.lead_id = p.lead_id))
        LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id AND o.organizacao_id = p.organizacao_id
       WHERE p.negocio_id IS NULL AND p.lead_id IS NOT NULL
         AND (${org}::uuid IS NULL OR p.organizacao_id = ${org}::uuid)
       ORDER BY p.created_at, p.id`);

    type Cand = (typeof cand)[number];
    const porProposta = new Map<string, Cand[]>();
    for (const c of cand) (porProposta.get(c.proposta_id) ?? porProposta.set(c.proposta_id, []).get(c.proposta_id)!).push(c);

    const niveis: Record<string, Record<string, number>> = {};
    for (const [pid, rows] of porProposta) {
      const r0 = rows[0];
      const candidatos: NegocioCandidato[] = rows.filter((r) => r.negocio_id).map((r) => ({
        id: r.negocio_id!, criadoEm: data(r.n_criado)!, mrrFechado: num(r.mrr_fechado), mrrEstimado: num(r.mrr_estimado), valorTotal: num(r.valor_total),
      }));
      const d = decidirVinculo({ criadaEm: data(r0.p_criada)!, totalRecorrente: num(r0.total_recorrente), totalGeral: num(r0.total_geral) }, candidatos);
      niveis[r0.status] ??= {};
      niveis[r0.status][d.nivel] = (niveis[r0.status][d.nivel] ?? 0) + 1;
      if (d.nivel === "FORTE") {
        const escolhido = rows.find((r) => r.negocio_id === d.negocioId)!;
        vinculoNovo.set(pid, d.negocioId!);
        plano.vinculos.push({ org: r0.org, propostaId: pid, negocioId: d.negocioId!, oportunidadeId: escolhido.oportunidade_id, empresaId: escolhido.n_empresa });
      } else {
        revisao.push({ org: r0.org, tipo: "PROPOSTA_SEM_NEGOCIO", alvo: `proposta:${pid}`, origens: [{ tabela: "propostas", id: pid }],
          evidencia: { nivel: d.nivel, motivo: d.motivo, status: r0.status, candidatos: rows.filter((r) => r.negocio_id).map((r) => r.negocio_id) },
          sugestao: d.negocioId ? { negocioSugerido: d.negocioId, acao: "conferir e ligar" } : { acao: "identificar a venda de origem ou declarar proposta avulsa" } });
      }
    }
    console.log("\n── VÍNCULO (proposta só com lead) ──");
    console.log(`  propostas sem negócio: ${porProposta.size}   a ligar (FORTE): ${plano.vinculos.length}`);
    console.table(niveis);
  }

  /* ───────────── 3. FAMÍLIA DO NEGÓCIO, pelas propostas dele ───────────── */
  {
    const alvos = await db.execute<{ negocio_id: string; org: string; status: string }>(sql`
      SELECT id::text AS negocio_id, organizacao_id::text AS org, status FROM negocios
       WHERE (service_family IS NULL OR service_family = 'UNKNOWN')
         AND (${org}::uuid IS NULL OR organizacao_id = ${org}::uuid)`);
    const doNegocio = new Map<string, PropostaLida[]>();
    for (const p of propostas.values()) {
      const nid = p.negocioId ?? vinculoNovo.get(p.id) ?? null;
      if (nid) (doNegocio.get(nid) ?? doNegocio.set(nid, []).get(nid)!).push(p);
    }
    const resultado: Record<string, number> = {};
    for (const n of alvos) {
      const props = doNegocio.get(n.negocio_id) ?? [];
      // A aceita manda; sem aceita, vale qualquer proposta já enviada. Rascunho sozinho não diz o que foi vendido.
      const base = props.some((p) => p.status === "aceita") ? props.filter((p) => p.status === "aceita") : props.filter((p) => p.status !== "rascunho");
      if (base.length === 0) { resultado.sem_proposta_valida = (resultado.sem_proposta_valida ?? 0) + 1; continue; }
      const efetivas = base.map((p) => ({
        id: p.id,
        familia: ehFamilia(p.famDeclarada) ? p.famDeclarada : p.decisao!.resultado === "unica" ? p.decisao!.familia : null,
        confianca: ehFamilia(p.famDeclarada) ? ("CONFIRMED" as const) : p.decisao!.confianca,
      }));
      const familias = new Set(efetivas.map((e) => e.familia));
      const motivo = familias.has(null) ? "proposta_sem_familia" : familias.size > 1 ? "conflito" : "resolve";
      resultado[motivo] = (resultado[motivo] ?? 0) + 1;
      if (motivo === "resolve") {
        const confianca = efetivas.every((e) => e.confianca === "CONFIRMED") ? "CONFIRMED" : "PROBABLE";
        plano.negFamilia.push({ org: n.org, negocioId: n.negocio_id, familia: efetivas[0].familia!, metodo: `FAMILIA_DA_PROPOSTA_${confianca}` });
      } else {
        revisao.push({ org: n.org, tipo: "NEGOCIO_FAMILIA_NAO_RESOLVIDA", alvo: `negocio:${n.negocio_id}`, origens: [{ tabela: "negocios", id: n.negocio_id }],
          evidencia: { motivo, status: n.status, propostas: efetivas }, sugestao: { acao: "informar a família do negócio" } });
      }
    }
    console.log("\n── FAMÍLIA DO NEGÓCIO ──");
    console.log(`  negócios sem família: ${alvos.length}  a gravar: ${plano.negFamilia.length}`, resultado);
  }

  /* ───────────── 4. EVIDÊNCIA dos ganhos históricos ───────────── */
  {
    const ganhos = await db.execute<{ negocio_id: string; org: string; ganho: number | null; zoho: boolean; mrr_fechado: string | null }>(sql`
      SELECT id::text AS negocio_id, organizacao_id::text AS org, extract(epoch FROM ganho_at)::float8 AS ganho,
             (zoho_id IS NOT NULL) AS zoho, mrr_fechado::text
        FROM negocios WHERE status = 'ganho' AND (${org}::uuid IS NULL OR organizacao_id = ${org}::uuid)`);
    const contratos = await db.execute<{ negocio_id: string; contrato_id: string; sub: string | null; criado: number; no_espelho: boolean }>(sql`
      SELECT c.negocio_id::text, c.id::text AS contrato_id, c.stripe_subscription_id AS sub, extract(epoch FROM c.created_at)::float8 AS criado,
             EXISTS (SELECT 1 FROM assinaturas a WHERE a.organizacao_id = c.organizacao_id AND a.stripe_subscription_id = c.stripe_subscription_id) AS no_espelho
        FROM contratos c JOIN negocios n ON n.id = c.negocio_id AND n.organizacao_id = c.organizacao_id AND n.status = 'ganho'
       WHERE (${org}::uuid IS NULL OR c.organizacao_id = ${org}::uuid)`);
    // Só a PRIMEIRA fatura paga de cada negócio: é ela que prova a venda; as mensais seguintes são cobrança, não evidência.
    const faturas = await db.execute<{ negocio_id: string; id: string; external_id: string | null; paga: number | null }>(sql`
      SELECT DISTINCT ON (c.negocio_id) c.negocio_id::text, f.id::text, f.external_id, extract(epoch FROM f.paga_em)::float8 AS paga
        FROM contratos c
        JOIN negocios n ON n.id = c.negocio_id AND n.organizacao_id = c.organizacao_id AND n.status = 'ganho'
        JOIN assinaturas a ON a.organizacao_id = c.organizacao_id AND a.stripe_subscription_id = c.stripe_subscription_id
        JOIN faturas f ON f.assinatura_id = a.id AND f.organizacao_id = c.organizacao_id AND f.origem = 'stripe' AND f.status = 'paga'
       WHERE (${org}::uuid IS NULL OR c.organizacao_id = ${org}::uuid)
       ORDER BY c.negocio_id, f.paga_em NULLS LAST, f.id`);
    const trilhas = await db.execute<{ negocio_id: string; motivo: string | null; usuario: string | null; em: number }>(sql`
      SELECT DISTINCT ON (s.negocio_id) s.negocio_id::text, s.motivo, s.usuario_id::text AS usuario, extract(epoch FROM s.created_at)::float8 AS em
        FROM status_changes s JOIN negocios n ON n.id = s.negocio_id AND n.status = 'ganho'
       WHERE s.para_status = 'ganho' AND (${org}::uuid IS NULL OR n.organizacao_id = ${org}::uuid)
       ORDER BY s.negocio_id, s.created_at`);
    const jaTem = await db.execute<{ negocio_id: string; tipo: string; source_ref: string | null }>(sql`
      SELECT negocio_id::text, tipo, source_ref FROM comercial_evidencia WHERE (${org}::uuid IS NULL OR organizacao_id = ${org}::uuid)`);

    const idx = <T extends { negocio_id: string }>(l: T[]) => { const m = new Map<string, T[]>(); for (const x of l) (m.get(x.negocio_id) ?? m.set(x.negocio_id, []).get(x.negocio_id)!).push(x); return m; };
    const cPor = idx([...contratos]); const fPor = idx([...faturas]); const tPor = idx([...trilhas]);
    const existentes = new Set(jaTem.map((e) => `${e.negocio_id}|${e.tipo}|${e.source_ref}`));
    const comAceite = new Set([...propostas.values()].filter((p) => p.status === "aceita" && p.negocioId).map((p) => p.negocioId!));

    const porTipo: Record<string, number> = {};
    let ganhosComEvidencia = 0; let jaTinham = 0;
    for (const g of ganhos) {
      const trilha = tPor.get(g.negocio_id)?.[0];
      const ev = evidenciasDoGanho({
        ganhoEm: data(g.ganho),
        contratos: (cPor.get(g.negocio_id) ?? []).map((c) => ({ id: c.contrato_id, stripeSubscriptionId: c.sub, criadoEm: data(c.criado)! })),
        assinaturasNoEspelho: (cPor.get(g.negocio_id) ?? []).filter((c) => c.no_espelho && c.sub).map((c) => c.sub!),
        faturasPagasNoStripe: (fPor.get(g.negocio_id) ?? []).map((f) => ({ id: f.id, externalId: f.external_id, pagaEm: data(f.paga) })),
      });
      if (ev.length === 0) {
        revisao.push({ org: g.org, tipo: "GANHO_SEM_EVIDENCIA", alvo: `negocio:${g.negocio_id}`, origens: [{ tabela: "negocios", id: g.negocio_id }],
          evidencia: { aceitouProposta: comAceite.has(g.negocio_id), veioDoZoho: g.zoho, mrrFechado: num(g.mrr_fechado), ganhoEm: data(g.ganho)?.toISOString() ?? null,
            trilhaLegada: trilha ? { motivo: trilha.motivo, usuarioId: trilha.usuario, em: data(trilha.em)?.toISOString() } : null },
          sugestao: { acao: "conferir e atestar por pessoa autorizada (registrarEvidenciaManual, financial_attestation, com audit_log) ou reabrir o negócio" } });
        continue;
      }
      let novo = false;
      for (const e of ev) {
        if (existentes.has(`${g.negocio_id}|${e.tipo}|${e.sourceRef}`)) continue;
        novo = true; porTipo[e.tipo] = (porTipo[e.tipo] ?? 0) + 1;
        plano.evidencias.push({ org: g.org, negocioId: g.negocio_id, tipo: e.tipo, ref: e.sourceRef, em: e.verificadoEm, metadata: {
          origem: ORIGEM, lote, regra: e.origem, ganhoEm: data(g.ganho)?.toISOString() ?? null,
          trilhaLegada: trilha ? { motivo: trilha.motivo, usuarioId: trilha.usuario, em: data(trilha.em)?.toISOString() } : null,
          // contrato do CRM anterior não tem assinatura digital: é registro, e o metadado diz isso.
          ...(e.tipo === "manual_contract" ? { assinatura: "nao_aplicavel" } : {}),
        } });
      }
      if (novo) ganhosComEvidencia++; else jaTinham++;
    }
    console.log("\n── EVIDÊNCIA DOS GANHOS ──");
    console.log(`  ganhos: ${ganhos.length}  com evidência a gravar: ${ganhosComEvidencia}  já tinham: ${jaTinham}  linhas a gravar: ${plano.evidencias.length}`, porTipo);
    console.log(`  ganhos SEM documento (vão para revisão): ${revisao.filter((r) => r.tipo === "GANHO_SEM_EVIDENCIA").length}`);
  }

  /* ───────────── 5. ENVIO (opt-in) ───────────── */
  if (etapas.includes("envio")) {
    // Aceita e recusada só existem depois de enviadas; `expirada` NÃO entra (rascunho vencido também vira expirada).
    const alvos = await db.execute<{ id: string; org: string; ano: string }>(sql`
      SELECT id::text, organizacao_id::text AS org, to_char(data_emissao, 'YYYY') AS ano FROM propostas
       WHERE enviada_em IS NULL AND data_emissao IS NOT NULL AND status IN ('aceita', 'recusada')
         AND (${org}::uuid IS NULL OR organizacao_id = ${org}::uuid)`);
    const porAno: Record<string, number> = {};
    for (const a of alvos) { porAno[a.ano] = (porAno[a.ano] ?? 0) + 1; plano.envios.push({ org: a.org, propostaId: a.id }); }
    console.log("\n── ENVIO (opt-in; data aproximada = emissão ao meio-dia) ──");
    console.log(`  propostas aceitas/recusadas sem data de envio: ${alvos.length}`, porAno);
  }

  /* ───────────── revisão humana ───────────── */
  const porTipoRev: Record<string, number> = {};
  for (const r of revisao) porTipoRev[r.tipo] = (porTipoRev[r.tipo] ?? 0) + 1;
  console.log("\n── PARA REVISÃO HUMANA ──");
  console.table(porTipoRev);
  if (csvDir) {
    fs.mkdirSync(csvDir, { recursive: true });
    for (const tipo of Object.keys(porTipoRev)) {
      const rows = revisao.filter((r) => r.tipo === tipo);
      const esc = (v: unknown) => `"${String(typeof v === "object" ? JSON.stringify(v) : v ?? "").replace(/"/g, '""')}"`;
      const out = ["organizacao_id,alvo,evidencia,sugestao", ...rows.map((r) => [r.org, r.alvo, r.evidencia, r.sugestao].map(esc).join(","))].join("\n");
      fs.writeFileSync(path.join(csvDir, `revisao-${tipo.toLowerCase()}.csv`), out);
    }
    console.log(`CSVs em ${csvDir}`);
  }

  /* ───────────── escrita ───────────── */
  const sel = (e: string) => etapas.includes(e);
  const total = (sel("familia") ? plano.itens.length + plano.propFamilia.length : 0) + (sel("vinculo") ? plano.vinculos.length : 0) +
    (sel("negocio") ? plano.negFamilia.length : 0) + (sel("evidencia") ? plano.evidencias.length : 0) + (sel("envio") ? plano.envios.length : 0);
  if (!aplicar) { console.log(`\nNada foi escrito (${total} gravações planejadas). Use --aplicar para gravar.`); return; }

  // Marca de origem + escrita na MESMA instrução: só marca o que de fato gravou.
  const marca = (entidade: string, metodo: string) => sql`
    INSERT INTO backfill_provenance (organizacao_id, fase, entidade_canonica, id_canonico, tabela_origem, id_origem, chave_identidade, metodo)
    SELECT u.organizacao_id, ${FASE}::text, ${entidade}::text, u.id, ${entidade.startsWith("negocio") ? "negocios" : "propostas"}::text, u.id::text,
           ${entidade}::text || ':' || u.id::text, ${metodo}::text
      FROM u ON CONFLICT (entidade_canonica, tabela_origem, id_origem) DO NOTHING`;

  await db.transaction(async (tx) => {
    if (sel("familia")) {
      for (const i of plano.itens) {
        await tx.execute(sql`
          UPDATE proposta_itens i
             SET service_family = ${i.familia},
                 semantic_confidence = COALESCE(i.semantic_confidence, ${i.confianca}),
                 semantic_evidence = COALESCE(i.semantic_evidence, ${JSON.stringify({ origem: ORIGEM, fonte: i.fonte, motivo: i.motivo, lote })}::jsonb),
                 provenance = COALESCE(i.provenance, ${ORIGEM})
            FROM propostas p
           WHERE i.id = ${i.id}::uuid AND p.id = i.proposta_id AND p.organizacao_id = ${i.org}::uuid
             AND (i.service_family IS NULL OR i.service_family = 'UNKNOWN')`);
      }
      for (const p of plano.propFamilia) {
        await tx.execute(sql`
          WITH u AS (
            UPDATE propostas SET service_family = ${p.familia}, updated_at = updated_at
             WHERE id = ${p.id}::uuid AND organizacao_id = ${p.org}::uuid AND (service_family IS NULL OR service_family = 'UNKNOWN')
            RETURNING id, organizacao_id)
          ${marca("proposta_familia", p.metodo)}`);
      }
    }
    if (sel("vinculo")) {
      for (const v of plano.vinculos) {
        await tx.execute(sql`
          WITH u AS (
            UPDATE propostas p
               SET negocio_id = ${v.negocioId}::uuid,
                   oportunidade_id = COALESCE(p.oportunidade_id, ${v.oportunidadeId}::uuid),
                   empresa_id = COALESCE(p.empresa_id, ${v.empresaId}::uuid),
                   updated_at = p.updated_at
             WHERE p.id = ${v.propostaId}::uuid AND p.organizacao_id = ${v.org}::uuid AND p.negocio_id IS NULL
               AND EXISTS (SELECT 1 FROM negocios n WHERE n.id = ${v.negocioId}::uuid AND n.organizacao_id = ${v.org}::uuid)
            RETURNING p.id, p.organizacao_id)
          ${marca("proposta_vinculo", "UNICO_NEGOCIO_DO_LEAD_COM_MESMO_VALOR")}`);
      }
    }
    if (sel("negocio")) {
      for (const n of plano.negFamilia) {
        await tx.execute(sql`
          WITH u AS (
            UPDATE negocios SET service_family = ${n.familia}, updated_at = updated_at
             WHERE id = ${n.negocioId}::uuid AND organizacao_id = ${n.org}::uuid AND (service_family IS NULL OR service_family = 'UNKNOWN')
            RETURNING id, organizacao_id),
          o AS (
            UPDATE oportunidades SET service_family = ${n.familia}, updated_at = updated_at
             WHERE negocio_id_legado = ${n.negocioId}::uuid AND organizacao_id = ${n.org}::uuid AND (service_family IS NULL OR service_family = 'UNKNOWN')
            RETURNING id)
          ${marca("negocio_familia", n.metodo)}`);
      }
    }
    if (sel("evidencia")) {
      for (const e of plano.evidencias) {
        await tx.execute(sql`
          INSERT INTO comercial_evidencia (organizacao_id, negocio_id, tipo, source_ref, metadata, verificado_em)
          SELECT ${e.org}::uuid, n.id, ${e.tipo}::text, ${e.ref}::text, ${JSON.stringify(e.metadata)}::jsonb, COALESCE(${e.em?.toISOString() ?? null}::timestamptz, n.ganho_at, n.created_at)
            FROM negocios n WHERE n.id = ${e.negocioId}::uuid AND n.organizacao_id = ${e.org}::uuid AND n.status = 'ganho'
          ON CONFLICT (negocio_id, tipo, source_ref) DO NOTHING`);
      }
    }
    if (sel("envio")) {
      for (const e of plano.envios) {
        await tx.execute(sql`
          WITH u AS (
            UPDATE propostas
               SET enviada_em = ((data_emissao::timestamp + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo'), updated_at = updated_at
             WHERE id = ${e.propostaId}::uuid AND organizacao_id = ${e.org}::uuid AND enviada_em IS NULL AND data_emissao IS NOT NULL
               AND status IN ('aceita', 'recusada')
            RETURNING id, organizacao_id)
          ${marca("proposta_envio", "ENVIO_DERIVADO_DA_EMISSAO")}`);
      }
    }
    // A revisão sempre grava (é a lista de pendências); ON CONFLICT mantém a de ontem em vez de duplicar.
    for (const r of revisao) {
      await tx.execute(sql`
        INSERT INTO reconciliacao_casos (organizacao_id, fase, tipo, entidade_alvo, origens, evidencia, sugestao)
        VALUES (${r.org}::uuid, ${FASE}, ${r.tipo}, ${r.alvo}, ${JSON.stringify(r.origens)}::jsonb, ${JSON.stringify(r.evidencia)}::jsonb, ${JSON.stringify(r.sugestao)}::jsonb)
        ON CONFLICT DO NOTHING`);
    }
  });
  console.log(`\nAplicado: ${total} gravações e ${revisao.length} casos de revisão (já abertos são mantidos).`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
