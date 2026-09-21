/**
 * Gestão de tokens da API pública (SPEC §30.2).
 *
 * A API pública tinha nove recursos, autenticação por token, escopo e registro
 * de uso — e **nenhuma forma de criar um token**. `api_tokens` só era escrita
 * pelo smoke. Na prática a API inteira era inacessível sem `INSERT` manual no
 * banco, o que é o mesmo que não existir para quem a usaria.
 *
 * ## As três regras que governam este arquivo
 *
 * **O token aparece uma vez.** Só o sha256 é guardado. Poder reler a credencial
 * depois transformaria a tela numa segunda cópia do segredo, e tela vaza por
 * print, sessão aberta e captura de tráfego.
 *
 * **Ninguém cria token acima de si.** O escopo pedido é interseccionado com a
 * permissão de quem cria. Sem isso, qualquer pessoa com acesso à tela fabricaria
 * uma credencial com poder que o próprio papel não tem — o mesmo furo que o teto
 * do agente de IA fecha, pelo mesmo motivo (SPEC §31).
 *
 * **Revogar não apaga.** `revogado_em` preserva quem criou, com que escopo e até
 * quando foi usado. Apagar a linha resolve o acesso e destrói a resposta para
 * "o que essa credencial andou puxando".
 */
import { Hono } from "hono";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { exigirCtx } from "../compat.js";
import { gerarToken } from "../v1/autenticacao.js";
import { permissoesEfetivas } from "@/lib/auth/permissoes";
import { aplicarTetoDeToken, ESCOPOS_DE_TOKEN } from "@/lib/auth/teto-de-token";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const criarSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  escopos: z.array(z.string()).min(1),
  /** Sem prazo é permitido, mas é escolha de quem cria, não default escondido. */
  expiraEm: z.string().datetime().optional().nullable(),
});

// GET /configuracoes/api-tokens — lista. Nunca devolve o segredo nem o hash.
app.get("/configuracoes/api-tokens", async (c) => {
  const ctx = await exigirCtx(c, "integrations.manage");
  const tokens = await db.execute<Record<string, unknown>>(sql`
    SELECT t.id::text, t.nome, t.prefixo, to_jsonb(t.escopos) AS escopos,
           t.expira_em::text AS "expiraEm", t.ultimo_uso_em::text AS "ultimoUsoEm",
           t.revogado_em::text AS "revogadoEm", t.created_at::text AS "criadoEm",
           u.nome AS "criadoPor"
      FROM api_tokens t
      LEFT JOIN usuarios u ON u.id = t.criado_por_id
     WHERE t.organizacao_id = ${ctx.organizacaoId}::uuid
     ORDER BY t.revogado_em IS NOT NULL, t.created_at DESC`);
  return c.json({ tokens, escoposDisponiveis: ESCOPOS_DE_TOKEN });
});

// POST /configuracoes/api-tokens — cria. O valor volta UMA vez.
app.post("/configuracoes/api-tokens", async (c) => {
  const ctx = await exigirCtx(c, "integrations.manage");
  const parsed = criarSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // O teto vive em `lib/auth/teto-de-token` e tem teste que o EXECUTA. Enquanto
  // era uma linha aqui dentro, o único teste possível procurava texto no
  // arquivo — e passava com a regra apagada.
  // `permissoesEfetivas`, não o RBAC cru: quem ainda não tem papel vinculado
  // responde pelo gate legado, e o teto precisa enxergar o mesmo que o gate.
  const minhas = await permissoesEfetivas({
    usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN",
  });
  const teto = aplicarTetoDeToken(parsed.data.escopos, minhas);
  if (!teto.ok) {
    return teto.codigo === "DESCONHECIDO"
      ? c.json({ error: `Escopo inexistente: ${teto.itens.join(", ")}` }, 400)
      : c.json(
          { error: `Você não tem estas permissões e por isso não pode delegá-las: ${teto.itens.join(", ")}` },
          403,
        );
  }

  // Data como texto: `Date` cru dentro do template do postgres.js quebra.
  const expira = parsed.data.expiraEm ? new Date(parsed.data.expiraEm).toISOString() : null;
  if (expira && new Date(expira) <= new Date()) {
    return c.json({ error: "A validade precisa ser no futuro" }, 400);
  }

  const token = gerarToken();
  const [linha] = await db.execute<{ id: string }>(sql`
    INSERT INTO api_tokens (organizacao_id, nome, prefixo, token_sha256, escopos,
                            criado_por_id, expira_em)
    VALUES (${ctx.organizacaoId}::uuid, ${parsed.data.nome}, ${token.prefixo},
            ${token.hash}, ${teto.escopos}::text[], ${ctx.userId}::uuid,
            ${expira}::timestamptz)
    RETURNING id::text`);

  return c.json({
    id: linha.id,
    nome: parsed.data.nome,
    prefixo: token.prefixo,
    escopos: teto.escopos,
    // Única vez que este valor existe fora do cliente.
    token: token.valor,
    aviso: "Guarde agora: este valor não é exibido de novo.",
  }, 201);
});

// DELETE /configuracoes/api-tokens/:id — revoga.
app.delete("/configuracoes/api-tokens/:id", async (c) => {
  const ctx = await exigirCtx(c, "integrations.manage");
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const linhas = await db.execute<{ id: string }>(sql`
    UPDATE api_tokens SET revogado_em = now()
     WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
       AND revogado_em IS NULL
    RETURNING id::text`);

  // Já revogado devolve sucesso: revogar é uma intenção sobre o estado final, e
  // quem clica duas vezes quer a mesma coisa das duas.
  if (!linhas.length) {
    const [existe] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM api_tokens
       WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!existe) return c.json({ error: "Token não encontrado" }, 404);
  }
  return c.json({ success: true });
});

export const apiTokensRoutes = app;
