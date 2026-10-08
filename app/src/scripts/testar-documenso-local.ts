/**
 * Teste real e isolado do Documenso self-hosted.
 *
 * Cria uma venda PABX marcada com [DOCUMENSO-E2E], aceita a proposta pelo
 * mesmo motor usado pelo CRM e envia o contrato ao Documenso/Mailpit. O
 * registro permanece no banco até a assinatura para que o webhook consiga
 * provar Won -> Service -> Implantação PABX.
 */
import { and, desc, eq, isNull, like } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
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
const FIXTURE_LOOKUP_KEY = "E2E-DOCUMENSO-FIXTURE";
let fixturePrecoId: string | null = null;

// Este ensaio cria registros controlados no banco DEV e envia apenas para o
// Mailpit interno. A confirmação explícita impede execução acidental pelo
// worker ou por uma sessão operacional comum.
if (process.env.DOCUMENSO_E2E_CONFIRM !== "YES") {
  throw new Error("Recusado: defina DOCUMENSO_E2E_CONFIRM=YES para executar o ensaio Documenso.");
}

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

// Parâmetros de organização que o contrato exige (multa, limite de gravações).
// O ensaio os define só durante a execução e devolve o que havia.
let settingsOriginal: unknown = undefined;
let orgDoEnsaio: string | null = null;
async function garantirParametros(orgId: string) {
  const [o] = await db.select({ settings: organizacoes.settings }).from(organizacoes).where(eq(organizacoes.id, orgId)).limit(1);
  settingsOriginal = o?.settings ?? null;
  orgDoEnsaio = orgId;
  const atual = (o?.settings ?? {}) as Record<string, unknown>;
  const c = (atual.contrato ?? {}) as Record<string, unknown>;
  await db.update(organizacoes).set({ settings: { ...atual, contrato: { multaRescisoriaPct: 30, limiteGravacoes: "90 dias", ...c } } }).where(eq(organizacoes.id, orgId));
}

async function criar() {
  // O banco de DEV pode ter organizações auxiliares. A jornada precisa usar
  // aquela que efetivamente possui um preço PABX contratável, não a primeira
  // linha retornada pelo banco.
  let [org] = await db.select({ id: organizacoes.id }).from(organizacoes)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.organizacaoId, organizacoes.id))
    .innerJoin(catalogoPrecos, eq(catalogoPrecos.servicoCatalogoId, servicosCatalogo.id))
    .where(and(
      eq(servicosCatalogo.serviceFamily, "PABX"),
      eq(servicosCatalogo.ativo, true),
      eq(catalogoPrecos.ativo, true),
      eq(catalogoPrecos.exigeContrato, true),
    ))
    .limit(1);
  // Sem preço PABX contratável no dev, a fixture abaixo cria um (e desativa no fim).
  if (!org) [org] = await db.select({ id: organizacoes.id }).from(organizacoes).orderBy(organizacoes.createdAt).limit(1);
  if (!org) throw new Error("Nenhuma organização encontrada");
  await garantirParametros(org.id);
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

  let [produto] = await db.select({
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
  if (!produto) {
    // O DEV pode estar com o catálogo migrado, mas sem os preços reconciliados.
    // A fixture existe só para o ensaio: nunca chama Stripe e é desativada no
    // fim, para não parecer uma oferta comercial disponível.
    const [fixtureExistente] = await db.select({
      servicoCatalogoId: servicosCatalogo.id,
      catalogoPrecoId: catalogoPrecos.id,
      nome: servicosCatalogo.nome,
      descricao: servicosCatalogo.descricao,
      tipo: servicosCatalogo.tipo,
      valor: catalogoPrecos.valor,
    }).from(catalogoPrecos)
      .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
      .where(and(
        eq(catalogoPrecos.organizacaoId, org.id),
        eq(catalogoPrecos.lookupKey, FIXTURE_LOOKUP_KEY),
      ))
      .limit(1);

    if (fixtureExistente) {
      fixturePrecoId = fixtureExistente.catalogoPrecoId;
      await db.update(catalogoPrecos).set({ ativo: true, updatedAt: new Date() })
        .where(eq(catalogoPrecos.id, fixturePrecoId));
      produto = fixtureExistente;
      console.log("Fixture de preço PABX reativada para o ensaio Documenso.");
    } else {
      const [servicoPabx] = await db.select({
        id: servicosCatalogo.id,
        nome: servicosCatalogo.nome,
        descricao: servicosCatalogo.descricao,
        tipo: servicosCatalogo.tipo,
      }).from(servicosCatalogo)
        .where(and(
          eq(servicosCatalogo.organizacaoId, org.id),
          eq(servicosCatalogo.serviceFamily, "PABX"),
          eq(servicosCatalogo.ativo, true),
        ))
        .limit(1);
      if (!servicoPabx) throw new Error("Serviço PABX ativo não encontrado para a fixture Documenso");

      const [precoFixture] = await db.insert(catalogoPrecos).values({
        organizacaoId: org.id,
        servicoCatalogoId: servicoPabx.id,
        stripePriceId: "price_e2e_documenso_fixture",
        sku: "E2E-DOCUMENSO",
        lookupKey: FIXTURE_LOOKUP_KEY,
        variacao: "Teste interno Documenso",
        descricao: "Fixture isolada para CRM -> Documenso; sem Stripe real.",
        valor: "1.00",
        moeda: "BRL",
        tipo: "recorrente",
        recorrente: true,
        periodo: "mensal",
        revenueNature: "MRR",
        modeloCobranca: "recorrencia_mensal",
        modeloPrecoStripe: "Tarifa fixa",
        exigeContrato: true,
        observacao: "Desativada automaticamente após o ensaio Documenso.",
        ativo: true,
        ordem: 9999,
      }).returning({ id: catalogoPrecos.id });
      fixturePrecoId = precoFixture.id;
      produto = {
        servicoCatalogoId: servicoPabx.id,
        catalogoPrecoId: precoFixture.id,
        nome: servicoPabx.nome,
        descricao: servicoPabx.descricao,
        tipo: servicoPabx.tipo,
        valor: "1.00",
      };
      console.log("Fixture de preço PABX criada para o ensaio Documenso.");
    }
  }
  if (!produto) throw new Error("Preço PABX indisponível para o ensaio Documenso");

  const sufixo = Date.now().toString(36);
  const [empresa] = await db.insert(empresas).values({
    organizacaoId: org.id,
    nome: `${TAG} Empresa Teste ${sufixo}`,
    // O contrato só sai com os dados jurídicos completos (ver conferirContratoDoGrupo).
    razaoSocial: `${TAG} Empresa Teste ${sufixo} LTDA`,
    cnpj: "00.000.000/0001-91",
    logradouro: "Avenida Teste",
    numero: "100",
    bairro: "Centro",
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
    serviceFamily: "PABX",
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

criar()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (orgDoEnsaio && process.env.DOCUMENSO_E2E_MANTER_PARAMETROS !== "YES") {
      await db.update(organizacoes).set({ settings: settingsOriginal as never }).where(eq(organizacoes.id, orgDoEnsaio)).catch(() => {});
    }
    if (fixturePrecoId) {
      await db.update(catalogoPrecos).set({ ativo: false, updatedAt: new Date() })
        .where(eq(catalogoPrecos.id, fixturePrecoId))
        .catch(() => {});
    }
    await fecharConexao().catch(() => {});
  });
