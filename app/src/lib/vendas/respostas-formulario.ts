/**
 * Texto legível para o que a Meta guarda em `leads.campos_custom`.
 *
 * Funções puras (sem banco), para a lista de "Respostas do formulário" e o
 * cartão "Origem do contato" mostrarem coisas diferentes: a resposta de quem
 * preencheu fica numa lista, e o rastreio (anúncio, formulário, plataforma)
 * fica na origem.
 */

/** Chaves que descrevem COMO o lead chegou, não o que ele respondeu. */
export const CHAVE_RASTREIO_META = /^meta_/i;

const SIGLAS: Array<[RegExp, string]> = [
  [/\bsaas\b/gi, "SaaS"], [/\bcrm\b/gi, "CRM"], [/\bpabx\b/gi, "PABX"], [/\bvoip\b/gi, "VoIP"],
  [/\bwhatsapp\b/gi, "WhatsApp"], [/\berp\b/gi, "ERP"], [/\bapi\b/gi, "API"], [/\bia\b/gi, "IA"],
  [/\bsip\b/gi, "SIP"], [/\bcnpj\b/gi, "CNPJ"], [/\bti\b/gi, "TI"],
];

export function ajustarSiglas(texto: string): string {
  return SIGLAS.reduce((t, [re, certo]) => t.replace(re, certo), texto);
}

/**
 * A Meta devolve o CÓDIGO da opção marcada (`revender_com_a_minha_marca`).
 * Só mexe em valor que é claramente código: uma palavra só, com `_`, sem
 * endereço de e-mail nem link. Qualquer outro texto (nome, telefone, frase
 * digitada, URL) passa intacto.
 */
export function valorLegivel(valor: string): string {
  const t = valor.trim();
  if (!t.includes("_") || /\s/.test(t) || /[@:]/.test(t) || /^https?/i.test(t)) return ajustarSiglas(t);
  const limpo = t.replace(/_+/g, " ").replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
  return ajustarSiglas(limpo.charAt(0).toUpperCase() + limpo.slice(1));
}

/** Rastreio da Meta gravado em `campos_custom` (chaves `meta_*`), só texto. */
export function rastreioMetaDeCampos(campos: unknown): Record<string, string> {
  const obj = campos && typeof campos === "object" && !Array.isArray(campos) ? (campos as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (CHAVE_RASTREIO_META.test(k) && typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

const PLATAFORMAS: Record<string, string> = { ig: "Instagram", fb: "Facebook", instagram: "Instagram", facebook: "Facebook", an: "Audience Network", msg: "Messenger" };

/** Linhas extras do cartão "Origem do contato" que só a Meta informa. */
export function linhasOrigemMeta(meta: Record<string, string> | undefined): Array<{ rotulo: string; valor: string }> {
  if (!meta) return [];
  const linhas: Array<{ rotulo: string; valor: string }> = [];
  const add = (rotulo: string, valor?: string) => { if (valor?.trim()) linhas.push({ rotulo, valor: valor.trim() }); };
  add("Formulário (Meta)", meta.meta_formulario_nome);
  if (meta.meta_plataforma) add("Plataforma", PLATAFORMAS[meta.meta_plataforma.toLowerCase()] ?? meta.meta_plataforma);
  if (meta.meta_organico) add("Lead orgânico", meta.meta_organico === "sim" ? "Sim" : "Não");
  if (meta.meta_criado_em) {
    const d = new Date(meta.meta_criado_em);
    if (!Number.isNaN(d.getTime())) add("Chegou pela Meta em", d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }));
  }
  add("ID do lead (Meta)", meta.meta_leadgen_id);
  return linhas;
}
