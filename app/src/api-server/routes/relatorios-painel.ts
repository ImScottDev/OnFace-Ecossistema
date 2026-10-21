import { Hono } from "hono";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { PERIODO_RE } from "@/lib/metricas/janela";
import { FAMILIAS } from "@/lib/metricas/recorte";
import { montarPainelGeral } from "@/lib/metricas/painel-geral";

/**
 * Visão Geral executiva: o painel inteiro numa chamada. O tenant e o papel vêm da sessão (`getCtx`), nunca da
 * querystring. Parâmetro inválido é 400 com os campos, nunca um padrão aplicado em silêncio. Acesso a métrica
 * é por cartão (cartão sem acesso vem `indisponivel`), então esta rota não devolve 403 pelo painel todo.
 */
const app = new Hono();

/** `custom:AAAA-MM-DD:AAAA-MM-DD` com datas de calendário reais e fim >= início (`janelaDoPeriodo` cairia em silêncio no mês atual). */
function periodoValido(v: string): boolean {
  if (!PERIODO_RE.test(v)) return false;
  const m = /^custom:(\d{4})-(\d{2})-(\d{2}):(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return true;
  const ts = (a: string, b: string, c: string) => {
    const d = new Date(Date.UTC(+a, +b - 1, +c));
    return d.getUTCFullYear() === +a && d.getUTCMonth() === +b - 1 && d.getUTCDate() === +c ? d.getTime() : NaN;
  };
  const de = ts(m[1], m[2], m[3]), ate = ts(m[4], m[5], m[6]);
  return Number.isFinite(de) && Number.isFinite(ate) && ate >= de;
}

const periodo = (padrao: string) => z.string().refine(periodoValido, "Período inválido. Use mes_atual, mes_passado, 30d, 90d, 12m, ano_atual, tudo ou custom:AAAA-MM-DD:AAAA-MM-DD (fim depois do início).").default(padrao);

export const paramsSchema = z.object({
  periodo: periodo("mes_atual"),
  familia: z.enum(FAMILIAS, { message: `Família inválida. Use ${FAMILIAS.join(", ")}.` }).optional(),
  testes: z.enum(["0", "1", "true", "false"], { message: "testes deve ser 0, 1, true ou false." }).optional().transform((v) => v === "1" || v === "true"),
  serie: periodo("12m"),
}).strict();

app.get("/", async (c) => {
  const ctx = await getCtx(c);
  const r = paramsSchema.safeParse(c.req.query());
  if (!r.success) {
    return c.json({
      error: "Parâmetros inválidos",
      codigo: "parametros_invalidos",
      campos: r.error.issues.map((i) => ({ campo: i.path.join(".") || "(raiz)", mensagem: i.message })),
    }, 400);
  }
  const painel = await montarPainelGeral(ctx.organizacaoId, r.data, ctx.userRole);
  return c.json(painel);
});

export const relatoriosPainelRoutes = app;
