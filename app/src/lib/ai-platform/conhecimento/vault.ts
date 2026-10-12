/**
 * Ingestão governada do vault (Brain da Callface) para a base de conhecimento do ONFACE.
 *
 * O servidor NUNCA lê o vault: um humano roda `ingerir-conhecimento-vault.ts` na máquina onde o
 * vault existe; o script seleciona só o que está no MANIFESTO, classifica (histórico, rascunho,
 * aprovado), remove segredos e dados pessoais, e grava snapshots versionados em `base/`. Esses
 * arquivos entram no repositório (revisáveis em diff) e viram ai_knowledge_* pelo carregador.
 * Este arquivo é puro (sem banco, sem filesystem), por isso testável.
 */
export type Governanca = "aprovado" | "rascunho" | "historico";

export interface ItemManifesto {
  slug: string;
  origem: string; // caminho relativo ao vault
  nome: string;
  categoria: "playbook_sdr" | "icp" | "produto" | "objecoes" | "politica" | "faq" | "processo";
  governanca: Governanca;
  /** Por que esta classificação (aparece no frontmatter do snapshot). */
  nota: string;
}

/** O que é lido do vault, e como é tratado. Qualquer arquivo fora desta lista não entra. */
export const MANIFESTO_VAULT: ItemManifesto[] = [
  { slug: "playbook-sdr-inbound", origem: "02_PROJETOS/Callface/CRM/produto/playbook-sdr.md", nome: "Playbook SDR Inbound", categoria: "playbook_sdr", governanca: "aprovado", nota: "v1 de 07/07/2026, playbook de SDR inbound com matriz de qualificação" },
  { slug: "icp-publico-v2", origem: "02_PROJETOS/Callface/Growth/comercial-growth/icp-publico.md", nome: "ICP e personas (v2 acionável)", categoria: "icp", governanca: "aprovado", nota: "v2 de 26/06/2026, referência canônica de ICP; trechos marcados como hipótese continuam sendo hipótese" },
  { slug: "produto-callface", origem: "02_PROJETOS/Callface/ESTRATEGIA/produto.md", nome: "O produto Callface (capacidades reais)", categoria: "produto", governanca: "aprovado", nota: "mapa do produto navegado ao vivo em 11/06/2026; conferir capacidades novas com o time" },
  { slug: "icp-fundamentacao", origem: "02_PROJETOS/Callface/Growth/comercial-growth/icp-callface.md", nome: "ICP: fundamentação com dados", categoria: "icp", governanca: "historico", nota: "camada de fundamentação; a referência vigente é o ICP v2" },
  { slug: "spec-agente-sdr-natalia", origem: "02_PROJETOS/Callface/CRM/produto/ai-sdr-agente-spec.md", nome: "Spec do agente SDR legado (Natália)", categoria: "processo", governanca: "historico", nota: "arquitetura legada substituída; não é verdade comercial atual" },
  { slug: "campanha-white-label-analise", origem: "02_PROJETOS/Callface/Growth/comercial-growth/analise-campanha-white-label-2026-09-08.md", nome: "Análise da campanha White Label", categoria: "playbook_sdr", governanca: "rascunho", nota: "análise de campanha, não é playbook aprovado de White Label" },
];

export interface RelatorioSanitizacao { segredos: number; emails: number; telefones: number; documentos: number; linhasRemovidas: number }

const PADROES_SEGREDO: RegExp[] = [
  /\b(?:sk|gsk|pk|rk)[-_][A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:password|senha|token|secret|api[_ -]?key|chave)\s*[:=]\s*\S+/gi,
  /[?&](?:token|key|access_token|apikey)=[^\s&)]+/gi,
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TELEFONE = /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g;
const DOCUMENTO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
const LINHA_SENSIVEL = /^.*\b(?:login|usu[aá]rio e senha|credencial(?:is)?|acesso ssh|\.env)\b.*$/gim;

export function sanitizar(bruto: string): { texto: string; relatorio: RelatorioSanitizacao } {
  const r: RelatorioSanitizacao = { segredos: 0, emails: 0, telefones: 0, documentos: 0, linhasRemovidas: 0 };
  let t = bruto.replace(/^---\n[\s\S]*?\n---\n?/, ""); // frontmatter
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, (_m, a: string) => a.split("/").pop() ?? a);
  t = t.replace(LINHA_SENSIVEL, () => { r.linhasRemovidas++; return ""; });
  for (const p of PADROES_SEGREDO) t = t.replace(p, () => { r.segredos++; return "[removido]"; });
  t = t.replace(EMAIL, () => { r.emails++; return "[e-mail removido]"; });
  t = t.replace(DOCUMENTO, () => { r.documentos++; return "[documento removido]"; });
  t = t.replace(TELEFONE, (m) => (m.replace(/\D/g, "").length >= 10 ? (r.telefones++, "[telefone removido]") : m));
  return { texto: t.replace(/\n{3,}/g, "\n\n").trim(), relatorio: r };
}

/** Snapshot com cabeçalho legível por máquina e por gente. */
export function montarSnapshot(item: ItemManifesto, texto: string, geradoEm: string): string {
  return `---\nslug: ${item.slug}\nnome: ${item.nome}\ncategoria: ${item.categoria}\ngovernanca: ${item.governanca}\norigem: vault:${item.origem}\nnota: ${item.nota}\ngerado_em: ${geradoEm}\n---\n\n${texto}\n`;
}

export function lerSnapshot(arquivo: string): { meta: Record<string, string>; texto: string } {
  const m = arquivo.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) return { meta: {}, texto: arquivo };
  const meta: Record<string, string> = {};
  for (const linha of m[1].split("\n")) { const i = linha.indexOf(":"); if (i > 0) meta[linha.slice(0, i).trim()] = linha.slice(i + 1).trim(); }
  return { meta, texto: m[2] };
}
