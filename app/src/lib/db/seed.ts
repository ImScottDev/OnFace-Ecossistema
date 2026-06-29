import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  usuarios,
  leads,
  negocios,
  negocioLeads,
  campanhas,
  atividades,
  statusChanges,
  contratos,
  propostas,
  propostaItens,
  organizacoes,
} from "./schema";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

// Stages canônicos do pipeline Callface (alinhados ao mCRM do Murilo).
// Mantidos em sincronia com DEFAULT_STAGES em lib/crm/pipeline.ts.
//   novo → qualificacao → contato_feito → reuniao_realizada →
//   proposta_apresentada → negociacao_iniciada → em_fechamento → contrato
//   + fechamento: ganho | perdido

async function seed() {
  console.log("Seeding Callface CRM...");

  // ─── 1. Org Callface (upsert + garantir branding carmim) ──────────────
  let [org] = await db
    .select()
    .from(organizacoes)
    .where(eq(organizacoes.slug, "scott-studio"))
    .limit(1);

  if (!org) {
    [org] = await db
      .insert(organizacoes)
      .values({
        nome: "Callface",
        slug: "scott-studio", // slug mantido p/ não quebrar refs existentes
        dominio: "crm.callface.ai",
        corPrimaria: "#e23752", // carmim Callface
        whatsappEnabled: true,
      })
      .returning();
  } else {
    // Garante branding Callface mesmo em bancos já existentes (corrige laranja Scott Studio)
    [org] = await db
      .update(organizacoes)
      .set({ nome: "Callface", dominio: "crm.callface.ai", corPrimaria: "#e23752" })
      .where(eq(organizacoes.id, org.id))
      .returning();
  }
  const orgId = org.id;
  console.log(`Org: ${org.nome} (${org.corPrimaria})`);

  // ─── 2. Equipe (admin Scott + vendedores) ─────────────────────────────
  const seedPassword = process.env.SEED_PASSWORD || "scott2026";
  const senhaHash = await bcrypt.hash(seedPassword, 10);

  await db
    .insert(usuarios)
    .values([
      { nome: "Scott Ferraz", email: "scott@scottdev.com.br", senhaHash, role: "super_admin", organizacaoId: orgId },
      { nome: "Thaís Marques", email: "thais@callface.ai", senhaHash, role: "vendedor", organizacaoId: orgId },
      { nome: "Bruno Carvalho", email: "bruno@callface.ai", senhaHash, role: "vendedor", organizacaoId: orgId },
    ])
    .onConflictDoNothing({ target: usuarios.email });

  const team = await db.select().from(usuarios).where(eq(usuarios.organizacaoId, orgId));
  const admin = team.find((u) => u.email === "scott@scottdev.com.br")!;
  const thais = team.find((u) => u.email === "thais@callface.ai") ?? admin;
  const bruno = team.find((u) => u.email === "bruno@callface.ai") ?? admin;
  console.log(`Team: ${team.length} usuários`);

  // ─── 3. Limpeza de dados de teste antigos (re-seed idempotente) ───────
  if (process.env.SEED_SAMPLE_DATA !== "false") {
    await db.delete(statusChanges);
    await db.delete(negocioLeads);
    await db.delete(propostaItens);
    await db.delete(propostas);
    await db.delete(contratos);
    await db.delete(atividades);
    await db.delete(negocios);
    await db.delete(leads);
    console.log("Limpou dados de teste antigos");
    await seedSampleData(orgId, { admin: admin.id, thais: thais.id, bruno: bruno.id });
  } else {
    console.log("Skipping sample data (SEED_SAMPLE_DATA=false)");
  }

  await seedCampaigns(orgId);

  await sql.end();
  console.log("Seed complete!");
}

async function seedCampaigns(orgId: string) {
  await db
    .insert(campanhas)
    .values([
      { organizacaoId: orgId, plataforma: "google_ads", nome: "Discador IA — Search Vendas", utmCampaign: "discador-ia-search", investimentoMensal: "0.00", status: "ativa" },
      { organizacaoId: orgId, plataforma: "meta_ads", nome: "CRM + WhatsApp — PME", utmCampaign: "crm-whatsapp-pme", investimentoMensal: "0.00", status: "ativa" },
      { organizacaoId: orgId, plataforma: "linkedin", nome: "Liga Callface — Outbound", utmCampaign: "liga-callface", investimentoMensal: "0.00", status: "pausada" },
    ])
    .onConflictDoNothing();
  console.log("Created 3 campaigns");
}

type TeamIds = { admin: string; thais: string; bruno: string };

// Cada item vira 1 lead + 1 negócio no stage indicado → povoa o Kanban.
function dealset(t: TeamIds) {
  return [
    // ── novo ──
    { nome: "Ricardo Almeida", cargo: "Diretor Comercial", empresa: "Imobiliária Horizonte", setor: "imobiliario", porte: "pequena", cidade: "Campinas", uf: "SP", origem: "google_ads", servicos: ["discador", "crm"], stage: "reuniao_agendada", temp: "morno", valor: "890.00", score: 70, resp: t.thais },
    { nome: "Camila Souza", cargo: "Sócia", empresa: "OdontoVida Clínicas", setor: "saude", porte: "pequena", cidade: "Curitiba", uf: "PR", origem: "meta_ads", servicos: ["voip", "whatsapp"], stage: "reuniao_agendada", temp: "frio", valor: "640.00", score: 55, resp: t.bruno, staleHours: 6 },
    // ── qualificacao ──
    { nome: "Fernando Lima", cargo: "Head de Vendas", empresa: "EduMais Cursos", setor: "educacao", porte: "media", cidade: "São Paulo", uf: "SP", origem: "organico", servicos: ["discador", "ai_sdr", "crm"], stage: "reuniao_agendada", temp: "morno", valor: "1450.00", score: 78, resp: t.thais },
    // ── contato_feito ──
    { nome: "Patrícia Gomes", cargo: "Gerente Comercial", empresa: "AutoEscola Pioneira", setor: "automotivo", porte: "pequena", cidade: "Goiânia", uf: "GO", origem: "indicacao", servicos: ["voip", "crm"], stage: "reuniao_realizada", temp: "morno", valor: "520.00", score: 65, resp: t.bruno },
    { nome: "Diego Martins", cargo: "CEO", empresa: "LogPrime Distribuidora", setor: "logistica", porte: "media", cidade: "Joinville", uf: "SC", origem: "linkedin", servicos: ["discador", "ai_sdr"], stage: "reuniao_realizada", temp: "quente", valor: "1980.00", score: 84, resp: t.thais },
    // ── reuniao_realizada ──
    { nome: "Aline Rocha", cargo: "Diretora", empresa: "Advocacia Rocha & Associados", setor: "juridico", porte: "pequena", cidade: "Belo Horizonte", uf: "MG", origem: "site_institucional", servicos: ["voip", "crm", "whatsapp"], stage: "reuniao_realizada", temp: "quente", valor: "1120.00", score: 80, resp: t.bruno },
    // ── proposta_apresentada ──
    { nome: "Marcelo Tavares", cargo: "Sócio-Diretor", empresa: "TopVendas Consultoria", setor: "consultoria", porte: "media", cidade: "São Paulo", uf: "SP", origem: "indicacao", servicos: ["discador", "ai_sdr", "crm"], stage: "proposta_apresentada", temp: "quente", valor: "2400.00", score: 88, resp: t.thais },
    { nome: "Renata Dias", cargo: "Gerente de Growth", empresa: "ShopExpress E-commerce", setor: "varejo", porte: "media", cidade: "Porto Alegre", uf: "RS", origem: "google_ads", servicos: ["whatsapp", "ai_sdr"], stage: "proposta_apresentada", temp: "morno", valor: "1680.00", score: 82, resp: t.bruno, staleDays: 5 },
    // ── negociacao_iniciada ──
    { nome: "Gustavo Pereira", cargo: "Diretor de Operações", empresa: "FinPronto Crédito", setor: "financeiro", porte: "media", cidade: "São Paulo", uf: "SP", origem: "linkedin", servicos: ["discador", "crm", "ai_sdr"], stage: "negociacao_iniciada", temp: "quente", valor: "3200.00", score: 90, resp: t.thais },
    // ── em_fechamento ──
    { nome: "Luana Castro", cargo: "Head Comercial", empresa: "TechParts Suprimentos", setor: "tecnologia", porte: "media", cidade: "Florianópolis", uf: "SC", origem: "evento", servicos: ["discador", "voip", "crm"], stage: "em_fechamento", temp: "quente", valor: "2750.00", score: 92, resp: t.bruno },
    // ── ganho (vira carteira) ──
    { nome: "Eduardo Nunes", cargo: "CEO", empresa: "MaxImóveis Negócios", setor: "imobiliario", porte: "media", cidade: "Ribeirão Preto", uf: "SP", origem: "indicacao", servicos: ["discador", "ai_sdr", "crm", "whatsapp"], stage: "ganho", temp: "quente", valor: "2980.00", score: 95, resp: t.thais },
    // ── perdido ──
    { nome: "Tatiane Ferreira", cargo: "Gerente", empresa: "Clínica BemEstar", setor: "saude", porte: "pequena", cidade: "Salvador", uf: "BA", origem: "meta_ads", servicos: ["voip"], stage: "perdido", temp: "frio", valor: "480.00", score: 48, resp: t.bruno, motivoPerda: "preco_alto", motivoPerdaDetalhe: "Achou o ticket alto pro momento, vai reavaliar no próximo trimestre." },
  ];
}

const STAGES_COM_PROPOSTA = ["proposta_apresentada", "negociacao_iniciada", "em_fechamento", "ganho"];

async function seedSampleData(orgId: string, t: TeamIds) {
  const items = dealset(t);
  let propostaNum = 0;

  for (const it of items) {
    const tipo = it.stage === "ganho" ? "cliente" : "lead";
    const [lead] = await db
      .insert(leads)
      .values({
        organizacaoId: orgId,
        nome: it.nome,
        cargo: it.cargo,
        email: `${it.nome.split(" ")[0].toLowerCase()}@${slug(it.empresa)}.com.br`,
        telefone: randomPhone(it.uf),
        empresa: it.empresa,
        empresaSetor: it.setor,
        empresaPorte: it.porte,
        empresaCidade: it.cidade,
        empresaEstado: it.uf,
        servicosInteresse: it.servicos,
        origem: it.origem,
        status: it.stage,
        leadScore: it.score,
        mrrEstimado: it.valor,
        valorTotal: it.valor,
        responsavelId: it.resp,
        ...(it.motivoPerda ? { motivoPerda: it.motivoPerda, motivoPerdaDetalhe: it.motivoPerdaDetalhe } : {}),
      })
      .returning();

    const isCarteira = it.stage === "ganho";
    // Datas antigas p/ demonstrar o bloco "Requer atenção" (negócio sem contato / proposta sem resposta)
    const staleDates: { createdAt?: Date; updatedAt?: Date } = {};
    if (it.staleHours) {
      const d = new Date(Date.now() - it.staleHours * 60 * 60 * 1000);
      staleDates.createdAt = d;
      staleDates.updatedAt = d;
    }
    if (it.staleDays) {
      staleDates.updatedAt = new Date(Date.now() - it.staleDays * 24 * 60 * 60 * 1000);
    }
    const [negocio] = await db
      .insert(negocios)
      .values({
        organizacaoId: orgId,
        leadId: lead.id,
        titulo: `${servicoLabel(it.servicos)} <> ${it.empresa}`,
        status: it.stage,
        temperatura: it.temp,
        valorTotal: it.valor,
        mrrEstimado: it.valor,
        moeda: "BRL",
        origemNegocio: isCarteira ? "carteira" : "novo",
        servicosInteresse: it.servicos,
        responsavelId: it.resp,
        ...(it.motivoPerda ? { motivoPerda: it.motivoPerda, motivoPerdaDetalhe: it.motivoPerdaDetalhe } : {}),
        ...(isCarteira ? { ganhoAt: new Date(), convertidoAt: new Date(), mrrFechado: it.valor } : {}),
        ...staleDates,
      })
      .returning();

    await db.insert(negocioLeads).values({ negocioId: negocio.id, leadId: lead.id, papel: "decisor" });

    // Negócio ganho gera contrato ativo → aparece na Carteira (CS)
    if (isCarteira) {
      const inicio = new Date();
      const vencimento = new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate());
      await db.insert(contratos).values({
        organizacaoId: orgId,
        leadId: lead.id,
        negocioId: negocio.id,
        tipo: "recorrente",
        descricao: `${servicoLabel(it.servicos)} <> ${it.empresa}`,
        moeda: "BRL",
        mrr: it.valor,
        valorSetup: "1500.00",
        servicos: it.servicos,
        inicio: inicio.toISOString().slice(0, 10),
        vencimento: vencimento.toISOString().slice(0, 10),
        renovacaoAuto: true,
        status: "ativo",
      });
    }

    // Proposta formal pros negócios que já chegaram em proposta (recorrente + setup avulso)
    if (STAGES_COM_PROPOSTA.includes(it.stage)) {
      propostaNum += 1;
      const setup = "1500.00";
      const totalGeral = (parseFloat(it.valor) + parseFloat(setup)).toFixed(2);
      const emissao = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const validade = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000);
      const [prop] = await db
        .insert(propostas)
        .values({
          organizacaoId: orgId,
          leadId: lead.id,
          negocioId: negocio.id,
          numero: propostaNum,
          versao: 1,
          moeda: "BRL",
          status: it.stage === "ganho" ? "aceita" : "enviada",
          dataEmissao: emissao.toISOString().slice(0, 10),
          dataValidade: validade.toISOString().slice(0, 10),
          condicoesPagamento: "Mensalidade no cartão ou boleto. Setup à vista na assinatura.",
          observacoes: "Inclui onboarding, número virtual e treinamento do time de vendas.",
          totalRecorrente: it.valor,
          totalAvulso: setup,
          totalGeral,
          criadoPorId: it.resp,
        })
        .returning();
      await db.insert(propostaItens).values([
        { propostaId: prop.id, nome: `${servicoLabel(it.servicos)} — plano mensal`, descricao: "Licença por usuário, ramais ilimitados internos.", tipo: "recorrente", moeda: "BRL", quantidade: "1", valorUnitario: it.valor, subtotal: it.valor, ordem: 0 },
        { propostaId: prop.id, nome: "Setup e onboarding", descricao: "Configuração, portabilidade e treinamento.", tipo: "setup", moeda: "BRL", quantidade: "1", valorUnitario: setup, subtotal: setup, ordem: 1 },
      ]);
    }

    // Histórico de transições até o stage atual
    const path = stagePath(it.stage);
    if (path.length > 1) {
      await db.insert(statusChanges).values(
        path.slice(1).map((para, i) => ({
          leadId: lead.id,
          negocioId: negocio.id,
          deStatus: path[i],
          paraStatus: para,
          usuarioId: it.resp,
        }))
      );
    }

    // Uma atividade de contato pros que já avançaram
    if (it.stage !== "reuniao_agendada") {
      await db.insert(atividades).values({
        organizacaoId: orgId,
        leadId: lead.id,
        usuarioId: it.resp,
        tipo: "ligacao",
        titulo: "Primeiro contato",
        descricao: `${it.nome} (${it.empresa}) — interesse em ${servicoLabel(it.servicos)}. Operação de vendas ativa, dor de organização de ligações e follow-up.`,
        duracaoSegundos: 420,
      });
    }
  }

  console.log(`Created ${items.length} leads + ${items.length} negócios distribuídos no pipeline`);
}

// ─── Helpers ────────────────────────────────────────────────────────────
const STAGE_ORDER = [
  "reuniao_agendada",
  "reuniao_realizada",
  "proposta_apresentada",
  "negociacao_iniciada",
  "em_fechamento",
];

function stagePath(stage: string): string[] {
  if (stage === "perdido") return ["reuniao_agendada", "reuniao_realizada", "perdido"];
  if (stage === "ganho") return [...STAGE_ORDER, "ganho"];
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? STAGE_ORDER.slice(0, idx + 1) : [stage];
}

function servicoLabel(servicos: string[]): string {
  const map: Record<string, string> = {
    discador: "Discador IA",
    crm: "CRM",
    ai_sdr: "AI SDR",
    voip: "VoIP",
    whatsapp: "WhatsApp Business",
  };
  return map[servicos[0]] ?? "Callface";
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const DDD: Record<string, string> = { SP: "11", RJ: "21", MG: "31", PR: "41", SC: "47", RS: "51", GO: "62", BA: "71" };
function randomPhone(uf: string): string {
  const ddd = DDD[uf] ?? "11";
  // Determinístico-ish a partir do uf p/ evitar Math.random (não disponível em alguns runtimes)
  const base = 90000000 + (uf.charCodeAt(0) * 137 + uf.charCodeAt(1) * 31) % 9000000;
  return `${ddd}9${base}`;
}

seed().catch(console.error);
