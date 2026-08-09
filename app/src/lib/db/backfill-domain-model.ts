/**
 * F1 (Domain Model) — backfill/reconciliação do legado pro schema novo.
 *
 * leads         -> pessoas (identidade persistente) + pontos_contato (Attribution)
 * leads (cliente) -> clientes (agregador, 1 por empresa quando possível)
 * negocios      -> oportunidades (Deal v2, referencia pessoa/empresa, não lead)
 *
 * Idempotente por design: TRUNCATE das 4 tabelas novas antes de reconstruir.
 * Seguro porque nada ainda lê/escreve nelas (dual-write real é o próximo
 * passo, depois deste backfill validado) — ver docs/reconstruction/.
 *
 * Uso: npm run db:backfill-domain-model
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { isNull, ne, sql } from "drizzle-orm";
import {
  leads,
  negocios,
  statusChanges,
  pessoas,
  pontosContato,
  oportunidades,
  clientes,
} from "./schema";

const connectionString = process.env.DATABASE_URL!;
const pgClient = postgres(connectionString);
const db = drizzle(pgClient);

type TipoOrigem = "manual" | "organica" | "indicacao" | "sdr" | "importacao" | "campanha";

/** Heurística de classificação — legado não tem esse campo explícito. */
function classificarOrigem(origem: string | null, utmSource: string | null): TipoOrigem {
  const o = (origem || "").toLowerCase();
  if (utmSource) return "campanha";
  if (o.includes("indica")) return "indicacao";
  if (o.includes("manual") || o.includes("cadastro")) return "manual";
  if (o.includes("import")) return "importacao";
  if (o.includes("sdr") || o.includes("outreach") || o.includes("apollo")) return "sdr";
  return "organica";
}

async function main() {
  console.log("=== Backfill Domain Model (F1) — leads/negocios -> pessoas/oportunidades/clientes/pontos_contato ===\n");

  // ─── 0. Contagens ANTES (baseline pra validar depois) ─────────────
  const [totalLeadsAntes] = await db.select({ n: sql<number>`count(*)` }).from(leads);
  const [totalNegociosAntes] = await db.select({ n: sql<number>`count(*)` }).from(negocios);
  console.log(`Legado: ${totalLeadsAntes.n} leads, ${totalNegociosAntes.n} negócios.\n`);

  // ─── 1. Idempotência: limpa as 4 tabelas novas (nada ainda depende delas) ──
  console.log("Limpando tabelas novas (idempotente, nada depende delas ainda)...");
  await db.delete(clientes);
  await db.delete(oportunidades);
  await db.delete(pontosContato);
  await db.delete(pessoas);

  // ─── 2. Carrega todos os leads em ordem cronológica (primeiro por e-mail = canônico) ──
  const todosLeads = await db
    .select()
    .from(leads)
    .orderBy(leads.createdAt);

  const emailToPessoaId = new Map<string, string>(); // chave: orgId|email normalizado
  const leadIdToPessoaId = new Map<string, string>();
  const empresaIdToClienteId = new Map<string, string>();
  const pessoaUltimoTouchpointId = new Map<string, string>();

  let pessoasCriadas = 0;
  let touchpointsCriados = 0;
  let clientesCriados = 0;

  for (const lead of todosLeads) {
    const emailNorm = lead.email?.trim().toLowerCase() || null;
    const dedupeKey = emailNorm ? `${lead.organizacaoId}|${emailNorm}` : null;

    let pessoaId: string;
    if (dedupeKey && emailToPessoaId.has(dedupeKey)) {
      // Mesma pessoa, lead de reengajamento — NÃO cria pessoa nova, só o touchpoint.
      pessoaId = emailToPessoaId.get(dedupeKey)!;
    } else {
      const [novaPessoa] = await db
        .insert(pessoas)
        .values({
          organizacaoId: lead.organizacaoId,
          empresaId: lead.empresaId,
          nome: lead.nome,
          email: lead.email,
          telefone: lead.telefone,
          whatsapp: lead.whatsapp,
          cargo: lead.cargo,
          leadIdLegado: lead.id,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        })
        .returning({ id: pessoas.id });
      pessoaId = novaPessoa.id;
      pessoasCriadas++;
      if (dedupeKey) emailToPessoaId.set(dedupeKey, pessoaId);
    }
    leadIdToPessoaId.set(lead.id, pessoaId);

    // ─── Touchpoint (Attribution) — um por lead, sempre, mesmo em reengajamento ──
    const isFirst = !pessoaUltimoTouchpointId.has(pessoaId);
    const [novoTouchpoint] = await db
      .insert(pontosContato)
      .values({
        organizacaoId: lead.organizacaoId,
        pessoaId,
        empresaId: lead.empresaId,
        source: lead.utmSource || lead.origem || null,
        medium: lead.utmMedium,
        campaign: lead.utmCampaign,
        term: lead.utmTerm,
        content: lead.utmContent,
        landingPage: lead.landingPage,
        campaignId: lead.metaCampaignId,
        tipoOrigem: classificarOrigem(lead.origem, lead.utmSource),
        isFirstTouch: isFirst,
        isLastTouch: true, // corrigido abaixo se vier touchpoint mais novo pra mesma pessoa
        ocorridoEm: lead.createdAt,
        raw: { leadIdLegado: lead.id, origemLegado: lead.origem },
        createdAt: lead.createdAt,
      })
      .returning({ id: pontosContato.id });
    touchpointsCriados++;

    // Desmarca o touchpoint anterior dessa pessoa como "last" (o que acabou de
    // entrar é sempre o mais recente, já que leads vêm em ordem cronológica).
    const anterior = pessoaUltimoTouchpointId.get(pessoaId);
    if (anterior) {
      await db.update(pontosContato).set({ isLastTouch: false }).where(sql`${pontosContato.id} = ${anterior}`);
    }
    pessoaUltimoTouchpointId.set(pessoaId, novoTouchpoint.id);

    // ─── Cliente (se lead.tipo = 'cliente') — 1 por empresa quando possível ──
    if (lead.tipo === "cliente") {
      const clienteKey = lead.empresaId || `sem-empresa:${pessoaId}`;
      if (!empresaIdToClienteId.has(clienteKey)) {
        const [novoCliente] = await db
          .insert(clientes)
          .values({
            organizacaoId: lead.organizacaoId,
            empresaId: lead.empresaId,
            pessoaPrincipalId: pessoaId,
            clienteDesde: lead.clienteDesde,
            leadIdLegado: lead.id,
          })
          .returning({ id: clientes.id });
        empresaIdToClienteId.set(clienteKey, novoCliente.id);
        clientesCriados++;
      }
    }
  }

  console.log(`Pessoas criadas: ${pessoasCriadas} (de ${todosLeads.length} leads — ${todosLeads.length - pessoasCriadas} eram reengajamento do mesmo e-mail).`);
  console.log(`Touchpoints criados: ${touchpointsCriados}.`);
  console.log(`Clientes criados: ${clientesCriados}.\n`);

  // ─── 3. Negócios -> Oportunidades ──────────────────────────────────
  const todosNegocios = await db.select().from(negocios);
  let oportunidadesCriadas = 0;
  let oportunidadesSemPessoa = 0;

  for (const negocio of todosNegocios) {
    const pessoaId = negocio.leadId ? leadIdToPessoaId.get(negocio.leadId) : undefined;
    if (!pessoaId) oportunidadesSemPessoa++;

    // perdidoAt não existe como coluna no legado — deriva do status_changes
    // mais recente pra "perdido", com fallback pro updatedAt do negócio.
    let perdidoAt: Date | null = null;
    if (negocio.status === "perdido") {
      const [ultimaMudancaPerdido] = await db
        .select({ createdAt: statusChanges.createdAt })
        .from(statusChanges)
        .where(sql`${statusChanges.negocioId} = ${negocio.id} AND ${statusChanges.paraStatus} = 'perdido'`)
        .orderBy(sql`${statusChanges.createdAt} DESC`)
        .limit(1);
      perdidoAt = ultimaMudancaPerdido?.createdAt || negocio.updatedAt;
    }

    await db.insert(oportunidades).values({
      organizacaoId: negocio.organizacaoId,
      pessoaId: pessoaId || null,
      empresaId: negocio.empresaId,
      pipelineId: negocio.pipelineId,
      stage: negocio.status,
      responsavelId: negocio.responsavelId,
      valor: negocio.valorTotal,
      mrr: negocio.mrrFechado || negocio.mrrEstimado,
      previsaoFechamento: null,
      ganhoAt: negocio.ganhoAt,
      perdidoAt,
      motivoPerda: negocio.motivoPerda,
      negocioIdLegado: negocio.id,
      createdAt: negocio.createdAt,
      updatedAt: negocio.updatedAt,
    });
    oportunidadesCriadas++;
  }

  console.log(`Oportunidades criadas: ${oportunidadesCriadas} (de ${todosNegocios.length} negócios).`);
  if (oportunidadesSemPessoa > 0) {
    console.log(`⚠ ${oportunidadesSemPessoa} oportunidades sem pessoa resolvida (negócio sem leadId, ou leadId não encontrado no mapeamento) — pessoaId ficou null, revisar manualmente.`);
  }

  // ─── 4. Validação de contagem (não avança silenciosamente se não bater) ──
  console.log("\n=== Validação ===");
  const [totalPessoas] = await db.select({ n: sql<number>`count(*)` }).from(pessoas);
  const [totalTouchpoints] = await db.select({ n: sql<number>`count(*)` }).from(pontosContato);
  const [totalOportunidades] = await db.select({ n: sql<number>`count(*)` }).from(oportunidades);
  const [totalClientes] = await db.select({ n: sql<number>`count(*)` }).from(clientes);
  const [leadsClientes] = await db.select({ n: sql<number>`count(*)` }).from(leads).where(sql`tipo = 'cliente'`);

  console.log(`pessoas: ${totalPessoas.n} | pontos_contato: ${totalTouchpoints.n} (esperado = ${todosLeads.length}) | oportunidades: ${totalOportunidades.n} (esperado = ${todosNegocios.length}) | clientes: ${totalClientes.n}`);

  const okTouchpoints = Number(totalTouchpoints.n) === todosLeads.length;
  const okOportunidades = Number(totalOportunidades.n) === todosNegocios.length;
  if (!okTouchpoints || !okOportunidades) {
    console.error("\n❌ VALIDAÇÃO FALHOU — contagem não bate. NÃO considerar backfill concluído.");
    process.exitCode = 1;
  } else {
    console.log(`\n✅ Contagens batem (1 touchpoint por lead, 1 oportunidade por negócio). leads tipo='cliente' no legado: ${leadsClientes.n} vs clientes criados: ${totalClientes.n} (esperado ser <= por dedup de empresa).`);
  }

  await pgClient.end();
}

main().catch((err) => {
  console.error("Erro no backfill:", err);
  process.exit(1);
});
