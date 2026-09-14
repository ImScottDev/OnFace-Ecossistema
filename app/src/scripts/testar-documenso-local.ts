/**
 * Teste real e isolado do Documenso self-hosted.
 *
 * Cria uma venda PABX marcada com [DOCUMENSO-E2E], aceita a proposta pelo
 * mesmo motor usado pelo CRM e envia o contrato ao Documenso/Mailpit. O
 * registro permanece no banco até a assinatura para que o webhook consiga
 * provar Won -> Service -> Implantação PABX.
 */
import { and, desc, eq, isNull, like } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  catalogoPrecos,
  contratos,
  empresas,
  leads,
  negocios,
  organizacoes,
  pipelines,
  propostaGrupoComercial,
  propostas,
  servicosCatalogo,
  usuarios,
} from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { enviarContratoParaAssinatura } from "@/lib/crm/contrato-template";
import { vincularContratoAoGrupo } from "@/lib/crm/grupo-comercial";

const TAG = "[DOCUMENSO-E2E]";
const EMAIL = "documenso-e2e@callface.local";

function resultadoContrato(contrato: typeof contratos.$inferSelect) {
  const signatarios = Array.isArray(contrato.signatarios) ? contrato.signatarios : [];
  const signingUrl = signatarios
    .map((item) => item && typeof item === "object" ? String((item as Record<string, unknown>).signingUrl || "") : "")
    .find(Boolean) || null;
  console.log(JSON.stringify({
    contratoId: contrato.id,
    grupoId: contrato.grupoComercialId,
    negocioId: contrato.negocioId,
    provider: contrato.signatureProvider,
    providerRef: contrato.signatureProviderRef,
    status: contrato.signatureStatus,
    signingUrl,
    email: EMAIL,
  }));
}

async function criar() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!org) throw new Error("Organização local não encontrada");
  const [user] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.ativo, true))).limit(1);
  const [pipeline] = await db.select({ id: pipelines.id }).from(pipelines)
    .where(eq(pipelines.organizacaoId, org.id)).limit(1);
  if (!user || !pipeline) throw new Error("Usuário ou pipeline local não encontrado");

  // Reaproveita o contrato criado numa tentativa cuja renderização/envio
  // falhou. Assim a correção de infraestrutura não duplica a venda de teste.
  const [contratoPendente] = await db.select({ contrato: contratos }).from(contratos)
    .innerJoin(leads, eq(leads.id, contratos.leadId))
    .where(and(
      eq(contratos.organizacaoId, org.id),
      like(leads.nome, `${TAG}%`),
      isNull(contratos.signatureProviderRef),
    ))
    .orderBy(desc(contratos.createdAt))
    .limit(1);
  if (contratoPendente) {
    await enviarContratoParaAssinatura(contratoPendente.contrato.id);
    if (contratoPendente.contrato.grupoComercialId) {
      await vincularContratoAoGrupo(contratoPendente.contrato.grupoComercialId, contratoPendente.contrato.id);
    }
    const [atualizado] = await db.select().from(contratos).where(eq(contratos.id, contratoPendente.contrato.id)).limit(1);
    resultadoContrato(atualizado);
    return;
  }

  const [produto] = await db.select({
    servicoCatalogoId: servicosCatalogo.id,
    catalogoPrecoId: catalogoPrecos.id,
    nome: servicosCatalogo.nome,
    descricao: servicosCatalogo.descricao,
    tipo: servicosCatalogo.tipo,
    valor: catalogoPrecos.valor,
  }).from(catalogoPrecos)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
    .where(and(
      eq(servicosCatalogo.organizacaoId, org.id),
      eq(servicosCatalogo.serviceFamily, "PABX"),
      eq(servicosCatalogo.ativo, true),
      eq(catalogoPrecos.ativo, true),
      eq(catalogoPrecos.exigeContrato, true),
    ))
    .orderBy(desc(catalogoPrecos.updatedAt))
    .limit(1);
  if (!produto) throw new Error("Preço oficial PABX com contrato obrigatório não encontrado");

  const sufixo = Date.now().toString(36);
  const [empresa] = await db.insert(empresas).values({
    organizacaoId: org.id,
    nome: `${TAG} Empresa Teste ${sufixo}`,
    cnpj: "00.000.000/0001-91",
    endereco: "Avenida Teste, 100",
    cidade: "Campinas",
    estado: "SP",
    cep: "13000-000",
  }).returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({
    organizacaoId: org.id,
    nome: `${TAG} Signatário`,
    sobrenome: sufixo,
    email: EMAIL,
    cargo: "Responsável pelo teste",
    empresaId: empresa.id,
    empresa: `${TAG} Empresa Teste ${sufixo}`,
    empresaCnpj: "00.000.000/0001-91",
    empresaCidade: "Campinas",
    empresaEstado: "SP",
    status: "qualified",
    origem: "teste_local",
  }).returning({ id: leads.id });
  const [negocio] = await db.insert(negocios).values({
    organizacaoId: org.id,
    leadId: lead.id,
    empresaId: empresa.id,
    pipelineId: pipeline.id,
    responsavelId: user.id,
    titulo: `${TAG} PABX ${sufixo}`,
    status: "proposta_enviada",
  }).returning({ id: negocios.id });
  await syncOportunidadeFromNegocio(negocio.id);

  const valor = Number(produto.valor);
  const proposta = await criarPropostaComItens({
    organizacaoId: org.id,
    leadId: lead.id,
    negocioId: negocio.id,
    moeda: "BRL",
    observacoes: `${TAG} teste real Documenso local`,
    condicoesPagamento: "Teste local, sem cobrança real",
    condicaoPagamentoTipo: "boleto",
    vencimentoDias: 15,
    prazoContratoMeses: 12,
    signatarios: [{ nome: `${TAG} Signatário ${sufixo}`, email: EMAIL, papel: "signatario", ordem: 1 }],
    itens: [{
      servicoCatalogoId: produto.servicoCatalogoId,
      catalogoPrecoId: produto.catalogoPrecoId,
      nome: produto.nome,
      descricao: produto.descricao || "Serviço PABX para teste local",
      tipo: produto.tipo === "setup" ? "setup" : produto.tipo === "avulso" ? "avulso" : "recorrente",
      quantidade: 1,
      valorUnitario: valor,
      desconto: 0,
      descontoTipo: "percentual",
    }],
    criadoPorId: user.id,
  });
  await db.update(propostas).set({ status: "enviada", enviadaEm: new Date() }).where(eq(propostas.id, proposta.id));

  const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "manual" });
  if (!aceite.ok) throw new Error(aceite.error);
  const grupo = aceite.grupos[0];
  const [grupoDb] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupo.grupoId)).limit(1);
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, grupoDb.contratoId!)).limit(1);
  resultadoContrato(contrato);
}

criar().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
