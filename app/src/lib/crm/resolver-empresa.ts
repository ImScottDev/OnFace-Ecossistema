import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq, and, ilike } from "drizzle-orm";

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
 * Ordem: empresaId explícito > CNPJ (14 dígitos) > nome (ilike) > cria nova.
 *
 * Existe porque todo ponto de entrada de lead precisa disso e a lógica estava
 * inline só no POST /api/leads — os webhooks (RD Station, site) e o modal de
 * contato gravavam apenas o texto `empresa`, deixando `empresa_id` nulo. Isso
 * gerou 691 leads sem vínculo em produção, que aparecem no drawer como
 * "Sem cadastro — clique pra criar e vincular".
 *
 * Devolve null quando não há nome nem CNPJ — nesse caso o chamador deve
 * gravar só o texto `empresa` (se tiver) e seguir.
 */
export async function resolverEmpresaId(args: ResolverArgs): Promise<string | null> {
  if (args.empresaId) return args.empresaId;

  const nome = args.nome?.trim() || null;
  const cnpj = args.cnpj?.replace(/\D/g, "") || null;
  const cnpjValido = cnpj && cnpj.length === 14 ? cnpj : null;

  if (!nome && !cnpjValido) return null;

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
 * Domínio do e-mail, quando serve como identificador de empresa.
 *
 * Devolve null para provedores públicos: nesses casos o domínio não diz nada
 * sobre a empresa e usá-lo como website/chave agruparia leads sem relação.
 */
const DOMINIOS_PUBLICOS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "globo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
]);

export function dominioCorporativo(email?: string | null): string | null {
  const dom = email?.trim().toLowerCase().split("@")[1];
  if (!dom || !dom.includes(".")) return null;
  return DOMINIOS_PUBLICOS.has(dom) ? null : dom;
}
