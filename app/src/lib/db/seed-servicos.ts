import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { servicosCatalogo, organizacoes } from "./schema";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

const SERVICOS = [
  { nome: "Site Institucional", tipo: "avulso", unidade: "projeto", valorSugerido: "2500.00", ordem: 1 },
  { nome: "Pagina de Vendas", tipo: "avulso", unidade: "projeto", valorSugerido: "1297.00", ordem: 2 },
  { nome: "Pagina de Obrigado", tipo: "avulso", unidade: "projeto", valorSugerido: "397.00", ordem: 3 },
  { nome: "Pagina de Upsell", tipo: "avulso", unidade: "projeto", valorSugerido: "897.00", ordem: 4 },
  { nome: "Pagina de Downsell", tipo: "avulso", unidade: "projeto", valorSugerido: "797.00", ordem: 5 },
  { nome: "Pagina de Captura", tipo: "avulso", unidade: "projeto", valorSugerido: "997.00", ordem: 6 },
  { nome: "Obrigado (Captura)", tipo: "avulso", unidade: "projeto", valorSugerido: "397.00", ordem: 7 },
  { nome: "Blog de Lancamento", tipo: "avulso", unidade: "projeto", valorSugerido: "497.00", ordem: 8 },
  { nome: "Pagina de Aquecimento", tipo: "avulso", unidade: "projeto", valorSugerido: "297.00", ordem: 9 },
  { nome: "Pagina de Remarketing", tipo: "avulso", unidade: "projeto", valorSugerido: "397.00", ordem: 10 },
  { nome: "Copy Paginas", tipo: "avulso", unidade: "projeto", valorSugerido: "397.00", ordem: 11 },
  { nome: "Automacao de Email Marketing", tipo: "avulso", unidade: "projeto", valorSugerido: "1197.00", ordem: 12 },
  { nome: "Automacao de Funil de Mensagens", tipo: "avulso", unidade: "projeto", valorSugerido: "1497.00", ordem: 13 },
  { nome: "Automacao de Grupos de Lancamento", tipo: "avulso", unidade: "projeto", valorSugerido: "797.00", ordem: 14 },
  { nome: "Desenvolvimento de Micro SaaS", tipo: "avulso", unidade: "projeto", valorSugerido: "5000.00", ordem: 15 },
  { nome: "Automacao e Integracoes", tipo: "avulso", unidade: "projeto", valorSugerido: "1497.00", ordem: 16 },
  { nome: "Gestao Web Mensal", descricao: "Desenvolvimento, ajuste e suporte a paginas. Ate 15 paginas/mes.", tipo: "recorrente", unidade: "mensal", valorSugerido: "4500.00", ordem: 17 },
] as const;

async function seedServicos() {
  console.log("Seeding servicos catalogo...");

  // Get Scott Studio org
  const [org] = await db.select().from(organizacoes).where(eq(organizacoes.slug, "scott-studio")).limit(1);
  if (!org) {
    console.error("Organizacao scott-studio nao encontrada. Rode o seed principal primeiro.");
    await sql.end();
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const s of SERVICOS) {
    // Check if already exists
    const existing = await db
      .select({ id: servicosCatalogo.id })
      .from(servicosCatalogo)
      .where(eq(servicosCatalogo.nome, s.nome))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  [skip] ${s.nome} (ja existe)`);
      skipped++;
      continue;
    }

    await db.insert(servicosCatalogo).values({
      organizacaoId: org.id,
      nome: s.nome,
      descricao: "descricao" in s ? s.descricao : undefined,
      tipo: s.tipo,
      unidade: s.unidade,
      valorSugerido: s.valorSugerido,
      ordem: s.ordem,
    });
    console.log(`  [ok] ${s.nome} — R$ ${s.valorSugerido}`);
    created++;
  }

  console.log(`\nServicos: ${created} criados, ${skipped} ja existiam.`);
  await sql.end();
}

seedServicos().catch(console.error);
