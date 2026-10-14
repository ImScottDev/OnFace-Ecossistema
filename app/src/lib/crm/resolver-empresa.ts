import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { dominioPublico, empresaUnicaDoDominio, normalizarDominio } from "./dominio-empresa";

type ResolverArgs = {
  organizacaoId: string;
  /** Se já vier resolvido (usuário escolheu a empresa na UI), usa direto. */
  empresaId?: string | null;
  nome?: string | null;
  cnpj?: string | null;
  setor?: string | null;
  porte?: string | null;
  cidade?: string | null;
  estado?: string | null;
  /** Domínio do e-mail do lead. Vira website quando a empresa é criada. */
  website?: string | null;
};

/**
 * Resolve a empresa como entidade real e devolve o empresa_id.
 *
 * Ordem: empresaId explícito > CNPJ (14 dígitos) > nome (ilike) > domínio
 * corporativo que aponta para UMA única empresa > cria nova.
 *
 * Existe porque todo ponto de entrada de lead precisa disso e a lógica estava
 * inline só no POST /api/leads — os webhooks (RD Station, site) e o modal de
 * contato gravavam apenas o texto `empresa`, deixando `empresa_id` nulo. Isso
 * gerou 691 leads sem vínculo em produção, que aparecem no drawer como
 * "Sem cadastro — clique pra criar e vincular".
 *
 * Devolve null quando não há nome, CNPJ nem domínio corporativo — nesse caso o chamador deve
 * gravar só o texto `empresa` (se tiver) e seguir.
 */
export async function resolverEmpresaId(args: ResolverArgs): Promise<string | null> {
  if (args.empresaId) return args.empresaId;

  const nome = args.nome?.trim() || null;
  const cnpj = args.cnpj?.replace(/\D/g, "") || null;
  const cnpjValido = cnpj && cnpj.length === 14 ? cnpj : null;

  const dominio = normalizarDominio(args.website);
  if (!nome && !cnpjValido && !dominio) return null;

  if (nome || cnpjValido) {
    const [existente] = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(
        and(
          eq(empresas.organizacaoId, args.organizacaoId),
          cnpjValido ? eq(empresas.cnpj, cnpjValido) : ilike(empresas.nome, nome!)
        )
      )
      .limit(1);
    if (existente) return existente.id;
  }

  const porDominio = await empresaUnicaPorDominio(args.organizacaoId, dominio);
  if (porDominio) return porDominio;

  // Sem nome não dá pra criar (nome é NOT NULL) — só tinha CNPJ e não bateu.
  if (!nome) return null;

  const [nova] = await db
    .insert(empresas)
    .values({
      organizacaoId: args.organizacaoId,
      nome,
      cnpj: cnpjValido,
      setor: args.setor || null,
      porte: args.porte || null,
      cidade: args.cidade || null,
      estado: args.estado || null,
      website: args.website?.trim() || null,
    })
    .returning({ id: empresas.id });

  return nova.id;
}

/**
 * Empresas ligadas ao domínio: o site cadastrado na empresa OU o e-mail de quem
 * já está nela. Só devolve quando é UMA; provedor público nunca casa.
 */
export async function empresaUnicaPorDominio(organizacaoId: string, dominio: string | null): Promise<string | null> {
  if (!dominio || dominioPublico(dominio)) return null;
  const linhas = await db.execute<{ id: string }>(sql`
    SELECT e.id::text AS id FROM empresas e
     WHERE e.organizacao_id = ${organizacaoId}::uuid
       AND regexp_replace(lower(coalesce(e.website, '')), '^(https?://)?(www\\.)?|/.*$', '', 'g') = ${dominio}
    UNION
    SELECT p.empresa_id::text FROM pessoas p
     WHERE p.organizacao_id = ${organizacaoId}::uuid AND p.empresa_id IS NOT NULL
       AND lower(split_part(p.email, '@', 2)) = ${dominio}
  `);
  return empresaUnicaDoDominio(dominio, [...linhas].map((l) => l.id));
}

export { dominioCorporativo } from "./dominio-empresa";

/**
 * Empresa nova adota quem já a esperava pelo NOME.
 *
 * O lead guarda o nome da empresa em texto (`leads.empresa`) e só ganha `empresa_id`
 * se a empresa JÁ existir na hora em que ele entra. Quando ela é cadastrada depois —
 * na mão, pelo time — nada voltava para religar.
 *
 * Caso real (14/10/2026): a Ariene entrou pelo formulário do Meta em 12/08 com
 * `Empresa: Maíra cred`; a empresa foi criada em 09/10. A tela casava pelo nome e
 * mostrava "empresa vinculada", mas clicar não abria nada — não havia id — e quem
 * tentava qualificar travava. Eram **477 leads** assim, **366** com a empresa já
 * existente.
 *
 * Só preenche o que está VAZIO: vínculo já declarado nunca é trocado.
 */
export async function adotarLeadsPeloNome(
  organizacaoId: string, empresaId: string, nome: string,
): Promise<{ leads: number }> {
  const limpo = (nome ?? "").trim();
  if (!limpo) return { leads: 0 };

  const r = await db.execute<{ id: string }>(sql`
    UPDATE leads SET empresa_id = ${empresaId}::uuid
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND empresa_id IS NULL
       AND lower(btrim(empresa)) = lower(btrim(${limpo}))
    RETURNING id::text`);

  if (r.length) {
    const ids = `{${r.map((x) => x.id).join(",")}}`;
    await db.execute(sql`
      UPDATE pessoas SET empresa_id = ${empresaId}::uuid
       WHERE organizacao_id = ${organizacaoId}::uuid
         AND empresa_id IS NULL
         AND lead_id_legado = ANY(${ids}::uuid[])`);
    /* A AQUISIÇÃO é quem leva a empresa para a ficha: responsável, origem e
       "Relações em andamento" saem de `aquisicoes.empresa_id` (empresa360).
       Religar só o lead deixava a empresa aberta e muda. */
    await db.execute(sql`
      UPDATE aquisicoes SET empresa_id = ${empresaId}::uuid, updated_at = now()
       WHERE organizacao_id = ${organizacaoId}::uuid
         AND empresa_id IS NULL
         AND lead_legado_id = ANY(${ids}::uuid[])`);
  }
  return { leads: r.length };
}
