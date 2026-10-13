/**
 * Prova ponta a ponta do contrato no Documenso LOCAL (Mailpit, sem destinatário real).
 *
 * Cria uma venda [QA] da família pedida (sem depender do catálogo), aceita a
 * proposta pelo motor real, gera o contrato a partir do modelo ativo, envia o
 * PDF ao Documenso e lê o envelope de volta: título, destinatários e a posição
 * de cada campo de assinatura (página e percentuais), para conferir que caiu
 * sobre o bloco de assinaturas da última página.
 *
 *   DOCUMENSO_E2E_CONFIRM=YES npx tsx --env-file=.env src/scripts/provar-contrato-documenso.ts [PABX|WHITE_LABEL|CALLFACE_AI]
 *
 * Os registros levam o prefixo "[QA]" e ficam no banco para o webhook provar a
 * assinatura; o PDF enviado é salvo em ./.qa-contrato-<familia>.pdf.
 */
import { writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { contratos, empresas, leads, negocios, organizacoes, pipelines, propostaGrupoComercial, propostas, usuarios } from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { daLinha, precoOficial } from "./_preco-oficial";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";

if (process.env.DOCUMENSO_E2E_CONFIRM !== "YES") throw new Error("Recusado: defina DOCUMENSO_E2E_CONFIRM=YES.");
const FAMILIA = process.argv[2] || "PABX";
const TAG = "[QA]";
const EMAIL = "qa-contrato@callface.local";
const ITENS: Record<string, { nome: string; descricao: string; tipo: string; valor: number; qtd: number }[]> = {
  PABX: [{ nome: "PABX Virtual Callface - Plano Pro", descricao: "Ramais, URA, filas e gravação", tipo: "recorrente", valor: 89.9, qtd: 12 }, { nome: "Implantação PABX", descricao: "Provisionamento e treinamento", tipo: "setup", valor: 1500, qtd: 1 }],
  WHITE_LABEL: [{ nome: "Licença White Label Callface", descricao: "Licença reservada para ativação e revenda", tipo: "recorrente", valor: 149.9, qtd: 20 }, { nome: "Setup White Label", descricao: "Implantação e reserva inicial", tipo: "setup", valor: 4000, qtd: 1 }],
  CALLFACE_AI: [{ nome: "Callface AI - Plano Business", descricao: "Transcrição e insights", tipo: "recorrente", valor: 179.9, qtd: 10 }, { nome: "Setup de implantação", descricao: "Configuração inicial", tipo: "setup", valor: 2500, qtd: 1 }],
};

const base = (process.env.DOCUMENSO_API_URL || "").replace(/\/$/, "");
const get = async (p: string) => (await fetch(`${base}${p}`, { headers: { Authorization: process.env.DOCUMENSO_API_TOKEN || "" } }));

let settingsOriginal: unknown = null;
let orgId: string | null = null;
async function main() {
  const [org] = await db.select({ id: organizacoes.id, settings: organizacoes.settings }).from(organizacoes).orderBy(organizacoes.createdAt).limit(1);
  orgId = org.id; settingsOriginal = org.settings;
  const cfg = (org.settings ?? {}) as Record<string, unknown>;
  await db.update(organizacoes).set({ settings: { ...cfg, contrato: { multaRescisoriaPct: 30, limiteGravacoes: "90 dias", ...((cfg.contrato ?? {}) as object) } } }).where(eq(organizacoes.id, org.id));

  const [user] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.organizacaoId, org.id)).limit(1);
  const [pipeline] = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.organizacaoId, org.id)).limit(1);
  const suf = Date.now().toString(36);
  const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${TAG} Empresa ${suf}`, razaoSocial: `${TAG} Empresa ${suf} LTDA`, cnpj: "00.000.000/0001-91", logradouro: "Rua das Palmeiras", numero: "120", bairro: "Centro", cidade: "Campinas", estado: "SP", cep: "13015-200" }).returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({ organizacaoId: org.id, nome: `${TAG} Signatário`, sobrenome: suf, email: EMAIL, cargo: "Diretor", empresaId: empresa.id, empresa: `${TAG} Empresa ${suf}`, status: "qualified", origem: "teste_local" }).returning({ id: leads.id });
  const [negocio] = await db.insert(negocios).values({ organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id, responsavelId: user.id, titulo: `${TAG} ${FAMILIA} ${suf}`, status: "proposta_enviada", serviceFamily: FAMILIA }).returning({ id: negocios.id });
  await syncOportunidadeFromNegocio(negocio.id);

  // Toda linha nova exige um Price oficial da família: recorrente para a mensalidade, setup (ou avulso) para a implantação.
  const precoRec = await precoOficial(org.id, FAMILIA, { tipos: ["recorrente"] });
  const precoSetup = await precoOficial(org.id, FAMILIA, { tipos: ["setup", "avulso"] });
  const proposta = await criarPropostaComItens({
    organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, moeda: "BRL",
    observacoes: `${TAG} prova de contrato`, condicoesPagamento: "Boleto mensal", condicaoPagamentoTipo: "boleto", vencimentoDias: 10, prazoContratoMeses: 12,
    signatarios: [{ nome: `${TAG} Signatário ${suf}`, email: EMAIL, papel: "signatario", ordem: 1, cpf: "123.456.789-00", cargo: "Diretor" } as never],
    itens: ITENS[FAMILIA].map((i) => ({ ...daLinha(i.tipo === "recorrente" ? precoRec : precoSetup), nome: i.nome, descricao: i.descricao, tipo: i.tipo, quantidade: i.qtd, valorUnitario: i.valor, desconto: 0, descontoTipo: "percentual" as const, commercialModel: "CONTRATO_OBRIGATORIO" })) as never,
    criadoPorId: user.id,
  });
  await db.execute(sql`UPDATE proposta_itens SET service_family = ${FAMILIA} WHERE proposta_id = ${proposta.id}::uuid`);
  await db.update(propostas).set({ status: "enviada", enviadaEm: new Date(), serviceFamily: FAMILIA, empresaId: empresa.id }).where(eq(propostas.id, proposta.id));

  const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "manual" });
  if (!aceite.ok) throw new Error(aceite.error);
  const g = aceite.grupos[0];
  console.log("grupo:", JSON.stringify(g));
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, g.grupoId)).limit(1);
  if (!grupo.contratoId) throw new Error(`Contrato não saiu: ${(g as { erro?: string }).erro ?? "sem erro informado"}`);
  const [c] = await db.select().from(contratos).where(eq(contratos.id, grupo.contratoId)).limit(1);
  console.log("contrato:", c.id, "|", c.descricao, "| status:", c.signatureStatus, "| ref:", c.signatureProviderRef);
  if (!c.signatureProviderRef) return;

  const env = await (await get(`/envelope/${c.signatureProviderRef}`)).json() as Record<string, any>;
  console.log("documenso título:", env.title, "| status:", env.status);
  for (const r of env.recipients ?? []) console.log(" destinatário:", r.name, r.email, r.role);
  const campos = env.fields ?? (env.recipients ?? []).flatMap((r: any) => r.fields ?? []);
  for (const f of campos) console.log(" campo:", f.type, "pág", f.page, `x=${Number(f.positionX).toFixed(1)} y=${Number(f.positionY).toFixed(1)} w=${Number(f.width).toFixed(1)} h=${Number(f.height).toFixed(1)}`);
  const item = (env.envelopeItems ?? [])[0];
  if (item?.id) {
    const pdf = await get(`/envelope/item/${item.id}/download`);
    if (pdf.ok) { const f = `.qa-contrato-${FAMILIA.toLowerCase()}.pdf`; writeFileSync(f, Buffer.from(await pdf.arrayBuffer())); console.log("PDF salvo em", f); }
  }
  console.log("signingUrl:", ((c.signatarios as any[]) ?? [])[0]?.signingUrl);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; })
  .finally(async () => {
    if (orgId && process.env.DOCUMENSO_E2E_MANTER_PARAMETROS !== "YES") await db.update(organizacoes).set({ settings: settingsOriginal as never }).where(eq(organizacoes.id, orgId)).catch(() => {});
    await fecharConexao().catch(() => {});
  });
