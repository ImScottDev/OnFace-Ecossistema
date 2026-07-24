/**
 * Papéis do CRM Callface.
 * - admin   : acesso total + configuração
 * - gerente : vê o agregado da empresa (mesma visão do admin)
 * - closer  : vendedor que fecha; vê os números DELE (north-star: MRR fechado/mês)
 * - sdr     : pré-vendas; vê os números DELE (north-star: reuniões agendadas/mês)
 * - leitor  : acesso read-only de relatório (times externos)
 *
 * Legado: "vendedor" e "super_admin" ainda aparecem no banco/sessão.
 * "vendedor" é migrado pra "closer"; "super_admin" segue como admin global.
 */
export type Role = "admin" | "gerente" | "closer" | "sdr" | "leitor";

export const ROLES: Role[] = ["admin", "gerente", "closer", "sdr", "leitor"];

/** admin e gerente veem o agregado da empresa (visão de gestão). */
export function isAdminView(role: string | null | undefined): boolean {
  return role === "admin" || role === "gerente" || role === "super_admin";
}

/** SDR e closer veem apenas os próprios dados (filtro por responsavelId). */
export function isPersonalView(role: string | null | undefined): boolean {
  return role === "sdr" || role === "closer" || role === "vendedor";
}

/** Leitor é read-only: só relatório curado, sem ações nem dado individual. */
export function isReader(role: string | null | undefined): boolean {
  return role === "leitor";
}

/** Normaliza papéis legados para os 5 canônicos. */
export function normalizeRole(role: string | null | undefined): Role {
  if (role === "vendedor") return "closer";
  if (role === "super_admin") return "admin";
  if (role === "admin" || role === "gerente" || role === "closer" || role === "sdr" || role === "leitor") {
    return role;
  }
  return "closer";
}

// ─── Gating de navegação por papel (somente UI — não substitui auth no backend) ───
//
// itemKey = href do item de nav (ex: "/pipeline", "/relatorios").
// Regra geral: ESCONDER, nunca habilitar algo que o papel não deveria ver.

/** Leitor é read-only de relatório: só enxerga o painel e os relatórios. */
const LEITOR_VISIBLE = new Set<string>(["/dashboard", "/relatorios"]);

/**
 * SDR e closer acumulam os dois papéis (decisão Scott 01/jul): a SDR também vê a
 * esteira do closer (Pipeline/Propostas) e a closer também vê a pré-vendas. Então
 * nenhum dos dois esconde nada além do que já é adminOnly na sidebar.
 */
const SDR_HIDDEN = new Set<string>([]);

/**
 * Closer é fechamento, MAS acumula o papel de SDR (decisão Scott 01/jul: as closers
 * às vezes fazem pré-vendas também). Então o closer enxerga TUDO que a SDR enxerga —
 * nada escondido além do que já é adminOnly na sidebar.
 */
const CLOSER_HIDDEN = new Set<string>([]);

/** Closer também tem as capacidades de SDR (vê pré-vendas + relatório SDR). */
export function canSeeSdr(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "sdr" || r === "closer" || r === "admin" || r === "gerente";
}

/**
 * Decide se um item de navegação (por href) deve aparecer para o papel.
 * Não trata itens `adminOnly` — esses continuam filtrados à parte na sidebar.
 * Itens não reconhecidos: visíveis por padrão (admin/gerente sempre veem tudo;
 * leitor nunca vê fora da allow-list).
 */
export function canSee(itemKey: string, role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (r === "admin" || r === "gerente") return true; // vê tudo
  if (r === "leitor") return LEITOR_VISIBLE.has(itemKey); // só relatórios + painel
  if (r === "sdr") return !SDR_HIDDEN.has(itemKey);
  if (r === "closer") return !CLOSER_HIDDEN.has(itemKey);
  return true;
}

/**
 * Botões de ação (criar/buscar) na topbar. Leitor é read-only: sem ações.
 * Demais papéis podem agir (o backend ainda valida cada operação).
 */
export function canUseActions(role: string | null | undefined): boolean {
  return !isReader(role);
}
