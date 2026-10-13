import { Hono } from "hono";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { classificarEmpresas, classificarLeads, classificarPessoas } from "@/lib/vendas/classificacao";
import { comClasse } from "@/lib/vendas/classificacao-rotulos";

/**
 * Busca global (⌘K): pessoa, empresa, negócio e proposta numa chamada só.
 * Antes a paleta só achava telas do menu ("Registros ainda não entram na
 * busca"). Escopo = organização da sessão; 5 por tipo basta para uma paleta
 * e mantém as quatro consultas baratas (ILIKE sem índice, tabelas pequenas).
 * Cada item já devolve o `href` final do produto, sem passar pelo tradutor
 * do desenho.
 *
 * Pessoa e empresa saem com `classe`/`classeRotulo`/`estagio`/`motivo` da função
 * única (`lib/vendas/classificacao.ts`): a busca não decide classe por conta própria.
 */
const app = new Hono();
const POR_TIPO = 5;

app.get("/busca-global", async (c) => {
  const ctx = await getCtx(c);
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return c.json({ pessoas: [], empresas: [], negocios: [], propostas: [] });
  // `%` e `_` do termo não podem virar curinga: escapa antes do LIKE.
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const org = ctx.organizacaoId;
  // CNPJ vem salvo com e sem pontuação: compara só dígitos quando há dígitos.
  const digitos = q.replace(/\D/g, "");
  const cnpj = digitos.length >= 4 ? sql`OR regexp_replace(coalesce(e.cnpj,''), '[^0-9]', '', 'g') LIKE ${"%" + digitos + "%"}` : sql``;

  const [pessoas, pessoasSemLead, empresas, negocios, propostas] = await Promise.all([
    db.execute(sql`
      SELECT l.id, l.nome, COALESCE(e.nome, l.empresa) AS apoio
      FROM leads l LEFT JOIN empresas e ON e.id = l.empresa_id
      WHERE l.organizacao_id = ${org}
        AND (l.nome ILIKE ${like} OR l.email ILIKE ${like} OR l.telefone ILIKE ${like})
      ORDER BY l.updated_at DESC NULLS LAST LIMIT ${POR_TIPO}`),
    // Pessoa criada em Contatos não cria Lead (acaoCriarPessoa): ela vive só em
    // `pessoas` e a ficha dela é /contatos/pessoas/:id. Sem esta busca o Cmd+K
    // nunca a achava. Só as sem lead de origem, para não repetir a do lead acima.
    db.execute(sql`
      SELECT p.id, trim(p.nome || ' ' || coalesce(p.sobrenome, '')) AS nome, e.nome AS apoio
      FROM pessoas p LEFT JOIN empresas e ON e.id = p.empresa_id
      WHERE p.organizacao_id = ${org} AND p.lead_id_legado IS NULL
        AND (p.nome ILIKE ${like} OR p.email ILIKE ${like} OR p.telefone ILIKE ${like})
      ORDER BY p.updated_at DESC NULLS LAST LIMIT ${POR_TIPO}`),
    db.execute(sql`
      SELECT e.id, e.nome, e.cnpj AS apoio FROM empresas e
      WHERE e.organizacao_id = ${org} AND (e.nome ILIKE ${like} ${cnpj})
      ORDER BY e.nome LIMIT ${POR_TIPO}`),
    db.execute(sql`
      SELECT n.id, n.titulo AS nome, n.status AS apoio FROM negocios n
      LEFT JOIN leads l ON l.id = n.lead_id
      WHERE n.organizacao_id = ${org} AND (n.titulo ILIKE ${like} OR l.nome ILIKE ${like})
      ORDER BY n.updated_at DESC NULLS LAST LIMIT ${POR_TIPO}`),
    db.execute(sql`
      SELECT p.id, 'Proposta #' || p.numero AS nome, l.nome AS apoio FROM propostas p
      LEFT JOIN leads l ON l.id = p.lead_id
      WHERE p.organizacao_id = ${org}
        AND (l.nome ILIKE ${like} OR ('#' || p.numero::text) ILIKE ${like} OR p.numero::text = ${q.replace(/^#/, "")})
      ORDER BY p.created_at DESC LIMIT ${POR_TIPO}`),
  ]);
  const [classesLeads, classesPessoas, classesEmpresas] = await Promise.all([
    classificarLeads(org, (pessoas as any[]).map((r) => String(r.id))),
    classificarPessoas(org, (pessoasSemLead as any[]).map((r) => String(r.id))),
    classificarEmpresas(org, (empresas as any[]).map((r) => String(r.id))),
  ]);
  const com = (rows: any[], base: string) => rows.map((r) => ({ id: r.id, nome: r.nome, apoio: r.apoio ?? "", href: `${base}/${r.id}` }));
  const doRegistro = (rows: any[], base: string, classes: Parameters<typeof comClasse>[2]) =>
    comClasse(com(rows, base), (r) => r.id, classes);
  return c.json({
    pessoas: [
      ...doRegistro(pessoas as any[], "/pessoas", classesLeads),
      ...doRegistro(pessoasSemLead as any[], "/contatos/pessoas", classesPessoas),
    ],
    empresas: doRegistro(empresas as any[], "/empresas", classesEmpresas),
    negocios: com(negocios as any[], "/negocios"),
    propostas: com(propostas as any[], "/propostas"),
  });
});

export const buscaGlobalRoutes = app;
