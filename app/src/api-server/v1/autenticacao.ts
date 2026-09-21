/**
 * Autenticação da API pública (SPEC §30.2).
 *
 * O pipeline que o SPEC exige, nesta ordem:
 *
 *     auth → resolução de tenant → escopo/permissão → comando de domínio
 *
 * A ordem não é decorativa. Resolver o tenant antes de autenticar deixaria o
 * pedido escolher a organização; checar permissão antes do tenant checaria
 * contra a organização errada.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { CodigoPermissao } from "@/lib/auth/permissoes";

export interface AtorApi {
  tokenId: string;
  organizacaoId: string;
  escopos: Set<CodigoPermissao>;
  nome: string;
}

export type ResultadoAuth =
  | { ok: true; ator: AtorApi }
  | { ok: false; status: 401 | 403; erro: string };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Compara em tempo constante: comparação normal vaza o prefixo correto. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Autentica pelo cabeçalho `Authorization: Bearer <token>`.
 *
 * Token expirado e token revogado devolvem a MESMA resposta que token
 * inexistente: distinguir os casos conta a quem tenta se o token existiu.
 */
export async function autenticarApi(c: Context): Promise<ResultadoAuth> {
  const cabecalho = c.req.header("authorization") ?? "";
  if (!cabecalho.startsWith("Bearer ")) {
    return { ok: false, status: 401, erro: "credencial ausente" };
  }
  const token = cabecalho.slice(7).trim();
  if (!token) return { ok: false, status: 401, erro: "credencial ausente" };

  const linhas = await db.execute<{
    id: string; organizacao_id: string; nome: string; escopos: string[] | null;
    token_sha256: string; expira_em: string | null; revogado_em: string | null;
  }>(sql`
    -- to_jsonb no array: o driver devolve array nativo do Postgres como a
    -- string "{a,b}", e construir um Set a partir dela itera CARACTERE por
    -- caractere. O escopo vira um punhado de letras e toda rota devolve 403.
    SELECT id::text, organizacao_id::text, nome, to_jsonb(escopos) AS escopos,
           token_sha256, expira_em::text, revogado_em::text
      FROM api_tokens WHERE token_sha256 = ${sha256(token)} LIMIT 1`);

  const linha = linhas[0];
  if (!linha || !iguais(linha.token_sha256, sha256(token))) {
    return { ok: false, status: 401, erro: "credencial inválida" };
  }
  if (linha.revogado_em) return { ok: false, status: 401, erro: "credencial inválida" };
  if (linha.expira_em && new Date(linha.expira_em) < new Date()) {
    return { ok: false, status: 401, erro: "credencial inválida" };
  }

  // Último uso é best-effort: não pode atrasar nem derrubar o pedido.
  void db.execute(sql`UPDATE api_tokens SET ultimo_uso_em = now() WHERE id = ${linha.id}::uuid`)
    .catch(() => undefined);

  return {
    ok: true,
    ator: {
      tokenId: linha.id,
      organizacaoId: linha.organizacao_id,
      escopos: new Set((linha.escopos ?? []) as CodigoPermissao[]),
      nome: linha.nome,
    },
  };
}

/**
 * O token nunca pode mais do que os escopos que recebeu.
 *
 * Mesma regra do agente de IA (SPEC §31): delegação é teto, nunca piso.
 */
export function temEscopo(ator: AtorApi, permissao: CodigoPermissao): boolean {
  return ator.escopos.has(permissao);
}

/** Registra o uso. Sem isto não há resposta para "quem puxou isso e quando". */
export async function registrarUso(
  ator: AtorApi, metodo: string, caminho: string, status: number, ip: string | null,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO api_token_usos (token_id, organizacao_id, metodo, caminho, status, ip)
      VALUES (${ator.tokenId}::uuid, ${ator.organizacaoId}::uuid, ${metodo},
              ${caminho}, ${status}, ${ip}::inet)`);
  } catch (e) {
    console.error("[api/v1] falha ao registrar uso do token:", e);
  }
}

/** Gera um token novo. O valor em claro só existe neste retorno. */
export function gerarToken(): { valor: string; prefixo: string; hash: string } {
  const aleatorio = createHash("sha256")
    .update(`${Date.now()}:${Math.random()}:${process.pid}`)
    .digest("base64url")
    .slice(0, 40);
  const valor = `onf_${aleatorio}`;
  return { valor, prefixo: valor.slice(0, 12), hash: sha256(valor) };
}
