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
  /* `meta_campanha_nome`, `meta_conjunto_nome` e `meta_ad_nome` NÃO entram
     aqui: eles são o nome das linhas Campanha/Conjunto/Anúncio em
     `rastreioDoLead`, que já os mostra com o link para o Gerenciador. Repetir
     daria a mesma informação duas vezes, que era o defeito original da ficha. */
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

/**
 * O que a pessoa preencheu no formulário inclui nome, e-mail, telefone, empresa
 * e cargo, que o sistema guarda em colunas do lead (não em `campos_custom`).
 * Quando o lead tem respostas de formulário, a lista mostra esses campos no
 * topo, seguidos das outras perguntas. Sem resposta nenhuma, devolve a lista
 * como está (lead que não veio de formulário não ganha "resposta" inventada).
 */
export function comIdentidadeDoFormulario(
  respostas: Array<{ pergunta: string; resposta: string }>,
  id: { nome?: string | null; sobrenome?: string | null; email?: string | null; telefone?: string | null; empresa?: string | null; cargo?: string | null },
): Array<{ pergunta: string; resposta: string }> {
  if (respostas.length === 0) return respostas;
  const juntar = (...p: Array<string | null | undefined>) => p.map((x) => x?.trim()).filter(Boolean).join(" ");
  const base: Array<[string, string]> = [
    ["Nome", juntar(id.nome, id.sobrenome && id.sobrenome.trim().toLowerCase() === id.nome?.trim().toLowerCase() ? "" : id.sobrenome)],
    ["E-mail", id.email?.trim() ?? ""],
    ["Telefone", id.telefone?.trim() ?? ""],
    ["Empresa", id.empresa?.trim() ?? ""],
    ["Cargo", id.cargo?.trim() ?? ""],
  ];
  const ja = new Set(respostas.map((r) => r.pergunta.trim().toLowerCase()));
  const topo = base
    .filter(([rot, val]) => val && !ja.has(rot.toLowerCase()))
    .map(([pergunta, resposta]) => ({ pergunta, resposta }));
  return [...topo, ...respostas];
}

/** Chaves do POST do formulário do site que NÃO são resposta: identidade que tem
 *  coluna própria no lead (a lista já a mostra pela coluna, em
 *  `comIdentidadeDoFormulario`), atribuição e o honeypot. */
const CHAVE_NAO_E_RESPOSTA_DO_SITE = new Set([
  "nome", "sobrenome", "email", "telefone", "phone", "whatsapp", "website",
  "landingpage", "utmsource", "utmmedium", "utmcampaign", "utmterm", "utmcontent",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid",
]);

/**
 * O que a pessoa respondeu no formulário do site, no MESMO formato das outras
 * portas (Meta e RD): chave → resposta, para gravar em `leads.campos_custom`.
 * Com isso a ficha exibe pelo mesmo `respostasDoFormulario` e o mesmo
 * componente, e o lead do site deixa de cair como "Sem formulário".
 *
 * A lista nasce das chaves enviadas, como no formulário da Meta: pergunta nova
 * no site aparece sozinha na ficha, sem ninguém mexer no código.
 */
export function respostasDoFormularioDoSite(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(body)) {
    if (CHAVE_NAO_E_RESPOSTA_DO_SITE.has(chave.toLowerCase())) continue;
    if (typeof valor !== "string") continue;
    const t = valor.trim().slice(0, 300);
    if (t) out[chave] = t;
  }
  return out;
}
