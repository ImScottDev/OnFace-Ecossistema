/**
 * Traz para o ONFACE quem assinou sozinho na plataforma Callface AI.
 *
 * Medido no Stripe em 21/10/2026: das 132 assinaturas ativas, **36 nasceram na
 * plataforma e NENHUMA tem marca do CRM no Customer** — R$ 8.004,10/mês de
 * gente que paga em dia e que o comercial nunca viu. Não é bug de sincronismo:
 * essas pessoas se cadastraram e pagaram sem passar por ninguém, então não
 * existe lead nem empresa para o sync ligar.
 *
 * O que este script faz, por assinatura ativa marcada como da plataforma:
 *  1. procura quem já existe — lead pelo e-mail, empresa pelo nome normalizado;
 *  2. cria só o que falta (empresa e/ou contato), marcando a origem;
 *  3. materializa o serviço canônico pela porta de `cliente-do-saas.ts`, que
 *     nasce FORA do portfólio: nenhum real entra em MRR, carteira ou relatório
 *     de receita comercial.
 *
 * **Não duplicar é a regra mais importante aqui.** A base já sofre com 118
 * e-mails repetidos e 96 grupos de empresas com o mesmo nome; trazer 36 contas
 * novas sem olhar o que existe tornaria o problema maior que o ganho. Por isso
 * o casamento é por e-mail (prova) e por nome normalizado da empresa, e o que
 * casa é REUSADO, nunca recriado.
 *
 * Simula por padrão. `--aplicar` grava.
 *
 *   npx tsx src/scripts/trazer-clientes-da-plataforma.ts
 *   npx tsx src/scripts/trazer-clientes-da-plataforma.ts --aplicar
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripe } from "@/lib/integrations/stripe-assinatura";
import { reconhecerClienteDoSaas } from "@/lib/integrations/cliente-do-saas";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";

const MARCAS_DA_PLATAFORMA = ["organization_id", "plan_id", "user_id"];

type Customer = { id: string; name?: string | null; email?: string | null; phone?: string | null; metadata?: Record<string, string> };
type Assinatura = {
  id: string; status: string; metadata?: Record<string, string>;
  customer: string | Customer;
  items: { data: Array<{ price: { product?: string | { id: string; name?: string }; recurring?: unknown } }> };
};

const daPlataforma = (s: Assinatura) => MARCAS_DA_PLATAFORMA.some((k) => (s.metadata ?? {})[k]);

/** Nome comparável: sem acento, sem pontuação, sem caixa — o mesmo critério do relatório de duplicadas. */
const chaveDoNome = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  console.log(aplicar ? "APLICANDO (grava no banco)\n" : "SIMULAÇÃO — nada é gravado (use --aplicar)\n");

  const [org] = (await db.execute(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`)) as unknown as Array<{ id: string }>;
  if (!org) throw new Error("sem organização");

  const assinaturas: Assinatura[] = [];
  let after: string | undefined;
  for (;;) {
    const p = new URLSearchParams({ status: "active", limit: "100", "expand[]": "data.customer" });
    if (after) p.set("starting_after", after);
    const pagina = await stripe<{ data: Assinatura[]; has_more: boolean }>(`subscriptions?${p}`);
    assinaturas.push(...pagina.data);
    if (!pagina.has_more) break;
    after = pagina.data[pagina.data.length - 1]!.id;
  }

  /* O casamento por nome é feito em memória: o banco não tem `unaccent`, e
     comparar 3 mil nomes uma vez é mais barato que uma consulta por assinatura. */
  const empresasPorNome = new Map<string, string>();
  for (const e of (await db.execute(sql`SELECT id::text, nome FROM empresas WHERE organizacao_id = ${org.id}::uuid`)) as unknown as Array<{ id: string; nome: string }>) {
    const k = chaveDoNome(e.nome);
    if (k && !empresasPorNome.has(k)) empresasPorNome.set(k, e.id);
  }

  /* O nome do produto não vem na listagem (o `product` é só o id), e sem ele a
     família sai UNKNOWN e a ficha volta a dizer "Não classificado". Um fetch do
     catálogo resolve para todas. */
  const nomeDoProduto = new Map<string, string>();
  {
    let depois: string | undefined;
    for (;;) {
      const p = new URLSearchParams({ limit: "100" });
      if (depois) p.set("starting_after", depois);
      const pg = await stripe<{ data: Array<{ id: string; name?: string }>; has_more: boolean }>(`products?${p}`);
      for (const pr of pg.data) if (pr.name) nomeDoProduto.set(pr.id, pr.name);
      if (!pg.has_more) break;
      depois = pg.data[pg.data.length - 1]!.id;
    }
  }

  const alvo = assinaturas.filter(daPlataforma);
  console.log(`${assinaturas.length} assinaturas ativas · ${alvo.length} nasceram na plataforma\n`);

  let empresasNovas = 0, contatosNovos = 0, reaproveitados = 0, servicos = 0
  // Falha da ponte não derruba a carga, mas não pode sumir do relatório.
  let semCanonico = 0;

  for (const s of alvo) {
    const c = typeof s.customer === "string" ? null : s.customer;
    if (!c) { console.log(`${s.id}  (customer não expandido, pulado)`); continue; }
    const email = (c.email ?? "").trim().toLowerCase();
    const nomePessoa = (c.name ?? c.metadata?.user_name ?? "").trim();
    const nomeEmpresa = (c.metadata?.company ?? "").trim() || nomePessoa || email;
    if (!nomeEmpresa) { console.log(`${s.id}  (sem nome nem e-mail, pulado)`); continue; }

    // Quem já existe? E-mail é prova; nome normalizado é o mesmo critério do relatório de duplicadas.
    const [leadExistente] = email
      ? ((await db.execute(sql`SELECT id::text, empresa_id::text FROM leads
            WHERE organizacao_id = ${org.id}::uuid AND lower(btrim(email)) = ${email} LIMIT 1`)) as unknown as Array<{ id: string; empresa_id: string | null }>)
      : [];
    let empresaId = leadExistente?.empresa_id ?? empresasPorNome.get(chaveDoNome(nomeEmpresa)) ?? null;
    const jaTinha = Boolean(empresaId || leadExistente);
    if (jaTinha) reaproveitados++;

    console.log(
      `${s.id}  ${nomeEmpresa.padEnd(32).slice(0, 32)} ${email.padEnd(34).slice(0, 34)} ` +
      `${empresaId ? "empresa existe" : "EMPRESA NOVA"}${leadExistente ? " · contato existe" : " · CONTATO NOVO"}`,
    );

    if (!aplicar) { if (!empresaId) empresasNovas++; if (!leadExistente) contatosNovos++; servicos++; continue; }

    if (!empresaId) {
      const [nova] = (await db.execute(sql`
        INSERT INTO empresas (organizacao_id, nome, stripe_customer_id)
        VALUES (${org.id}::uuid, ${nomeEmpresa}, ${c.id})
        RETURNING id::text`)) as unknown as Array<{ id: string }>;
      empresaId = nova!.id;
      empresasNovas++;
    }
    if (!leadExistente) {
      const [novoLead] = (await db.execute(sql`
        INSERT INTO leads (organizacao_id, nome, email, telefone, empresa_id, tipo, status, origem, stripe_customer_id)
        VALUES (${org.id}::uuid, ${nomePessoa || nomeEmpresa}, ${email || null}, ${c.phone ?? null},
                ${empresaId}::uuid, 'cliente', 'novo', 'plataforma', ${c.id})
        RETURNING id::text`)) as unknown as Array<{ id: string }>;
      contatosNovos++;

      /* O lead sozinho NÃO existe para o modelo canônico. Sem pessoa e sem
         aquisição, quem vende (que lê `pessoas`) não acha ninguém: foi assim
         que o upgrade do Danilo/SMOV travou. Medido em 21/10: 16 dos clientes
         que este script trouxe nasceram sem o par. A ponte cria pessoa +
         aquisição e liga pelo `leadLegadoId`, que é o que casa os dois modelos. */
      const canonico = await garantirEntradaCanonica({
        organizacaoId: org.id,
        // Quem assinou sozinho na plataforma chegou por conta própria: é entrada
        // inbound (self-checkout), não importação de base nem outbound.
        tipo: "INBOUND",
        origem: "plataforma",
        provider: "callface_ai",
        pessoa: { nome: nomePessoa || nomeEmpresa, email: email || null, telefone: c.phone ?? null },
        empresa: { nome: nomeEmpresa },
        idempotencyKey: `plataforma:${c.id}`,
      }, novoLead!.id);
      if (!canonico.ok) { semCanonico++; console.log(`  ! sem par canônico: ${canonico.codigo ?? canonico.erro}`); }
    }

    const primeiro = s.items?.data?.[0]?.price?.product;
    const idDoProduto = typeof primeiro === "string" ? primeiro : primeiro?.id ?? null;
    const produto = idDoProduto ? nomeDoProduto.get(idDoProduto) ?? null : null;
    await reconhecerClienteDoSaas(org.id, { id: s.id, status: s.status, empresaId, produto });
    servicos++;
  }

  console.log(
    `\n${aplicar ? "criados" : "seriam criados"}: ${empresasNovas} empresas · ${contatosNovos} contatos · ` +
    `${servicos} serviços (fora do MRR comercial) · ${reaproveitados} reaproveitaram cadastro existente` +
    (semCanonico ? ` · ATENÇÃO: ${semCanonico} sem par canônico (pessoa+aquisição)` : ""),
  );
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
