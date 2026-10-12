import { Hono } from "hono";
import { getCtx } from "../compat.js";
import { entrada, podeVer } from "@/lib/relatorios/biblioteca";
import { lerPedido, responder } from "@/lib/metricas/consulta";
import { recorteCompleto } from "@/lib/metricas/explorar";
import { FiltroNaoSuportado } from "@/lib/metricas/catalogo";
import { ROTULO_COLUNA } from "@/lib/relatorios/biblioteca-metrica";
import { csv } from "@/lib/relatorios/csv";

/**
 * Exploração das métricas oficiais: o mesmo recorte para card, gráficos, tabela
 * e exportação. O gate é o da biblioteca (`podeVer`), o tenant é o da sessão.
 */
const app = new Hono();

async function pedido(c: import("hono").Context) {
  const ctx = await getCtx(c);
  const codigo = c.req.param("codigo") ?? "";
  const e = entrada(`metrica-${codigo}`);
  if (!e) return { erro: c.json({ error: "Métrica desconhecida" }, 404) } as const;
  if (!podeVer(e.acesso, ctx.userRole)) return { erro: c.json({ error: "Sem acesso a esta métrica" }, 403) } as const;
  const p = lerPedido(codigo, new URL(c.req.url).searchParams);
  if (!p) return { erro: c.json({ error: "Métrica desconhecida" }, 404) } as const;
  return { ctx, p } as const;
}

app.get("/:codigo", async (c) => {
  const r = await pedido(c);
  if ("erro" in r) return r.erro;
  try {
    const resp = await responder(r.ctx.organizacaoId, r.p);
    return resp ? c.json(resp) : c.json({ error: "Métrica desconhecida" }, 404);
  } catch (e) {
    if (e instanceof FiltroNaoSuportado) return c.json({ error: e.message, codigo: "filtro_nao_suportado" }, 422);
    throw e;
  }
});

/** CSV do recorte COMPLETO (mesmos filtros e seleção da tela), com aviso no cabeçalho quando o teto corta. */
app.get("/:codigo/exportar", async (c) => {
  const r = await pedido(c);
  if ("erro" in r) return r.erro;
  try {
    const out = await recorteCompleto(r.ctx.organizacaoId, r.p.codigo, r.p.p, r.p.selecao);
    if (!out) return c.json({ error: "Métrica desconhecida" }, 404);
    const colunas = out.linhas[0] ? Object.keys(out.linhas[0]) : [];
    const corpo = csv(
      colunas.map((k) => ROTULO_COLUNA[k] ?? k),
      out.linhas.map((l) => colunas.map((k) => {
        const v = l[k];
        return v instanceof Date ? v.toISOString() : (v as string | number | null);
      })),
    );
    return new Response(corpo, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${r.p.codigo}-${r.p.periodo}.csv"`,
        "X-Registros": String(out.linhas.length),
        "X-Cortado": out.cortado ? "1" : "0",
      },
    });
  } catch (e) {
    if (e instanceof FiltroNaoSuportado) return c.json({ error: e.message, codigo: "filtro_nao_suportado" }, 422);
    throw e;
  }
});

export const relatoriosMetricasRoutes = app;
