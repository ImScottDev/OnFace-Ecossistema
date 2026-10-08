/* ─────────────────────────────────────────────────────────────────────────
 * Mapeador ÚNICO da qualificação: `leads.qualificacao` (banco) → os campos que
 * o desenho consome (interesse/tamanho/dor/fit/cenario/urgencia/...).
 *
 * Fonte única de verdade. Toda tela que mostra a qualificação — drawer e modal
 * de Pré-vendas, ficha de Contato, ficha de Empresa, Oportunidade — lê daqui.
 * Antes cada tela tinha o próprio leitor e divergiam (uma mostrava, outra não).
 * ───────────────────────────────────────────────────────────────────────── */

export function qualDoDesenho(q: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!q || typeof q !== "object") return null;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const campos: Record<string, unknown> = {};
  for (const [desenho, dominio] of [
    ["icp", "icp"], ["dor", "dor"], ["necessidade", "necessidade"],
    ["cenario", "cenarioAtual"], ["urgencia", "urgencia"], ["budget", "budget"],
    ["decisor", "decisor"], ["timing", "timing"],
  ] as const) {
    const v = texto(q[dominio]);
    if (v !== undefined) campos[desenho] = v;
  }
  const servicos = q.servicosInteresse;
  if (Array.isArray(servicos) && servicos.length) {
    campos.interesse = servicos.filter((s): s is string => typeof s === "string").join("|");
  }
  // Tamanho da operação e Fit: `quantidade` vira `tamanho`; o Fit vive em
  // `observacoes` como "Fit Alto".
  if (typeof q.quantidade === "number" && q.quantidade > 0) campos.tamanho = String(q.quantidade);
  const obs = typeof q.observacoes === "string" ? q.observacoes : "";
  const mFit = obs.match(/Fit\s+(Alto|M[ée]dio|Baixo)/i);
  if (mFit) campos.fit = mFit[1].replace(/M[ée]dio/i, "Médio").replace(/alto/i, "Alto").replace(/baixo/i, "Baixo");
  return Object.keys(campos).length ? campos : null;
}
