/**
 * Papéis do CRM Callface.
 * - admin       : acesso total + configuração
 * - gerente     : vê o agregado da empresa (mesma visão do admin)
 * - director    : F0/RBAC v2 (blueprint bloco 55) — visão executiva, mesmo
 *                 agregado de admin/gerente; distinção de nível organizacional
 *                 fica pra RBAC granular (F1+), aqui é só visão.
 * - coordinator : F0/RBAC v2 — gestão de time (visão agregada do próprio time,
 *                 hoje tratado como visão de gestão até time-scoping existir).
 * - operations  : F0/RBAC v2 — administra config/pipeline/produtos/automações,
 *                 mesma superfície de admin por enquanto.
 * - closer      : vendedor que fecha; vê os números DELE (north-star: MRR fechado/mês)
 * - sdr         : pré-vendas; vê os números DELE (north-star: reuniões agendadas/mês)
 * - leitor      : acesso read-only de relatório (times externos)
 *
 * Legado: "vendedor" e "super_admin" ainda aparecem no banco/sessão.
 * "vendedor" é migrado pra "closer"; "super_admin" segue como admin global.
 *
 * Nota F0: director/coordinator/operations entram como papéis reconhecidos e
 * com visão de gestão (isAdminView), mas SEM diferenciação de escopo própria
 * ainda — isso é trabalho de RBAC granular (helper de ownership abaixo é o
 * primeiro passo, adoção rota a rota é incremental, não retrofit de uma vez).
 */
export type Role = "admin" | "gerente" | "director" | "coordinator" | "operations" | "closer" | "sdr" | "leitor";

export const ROLES: Role[] = ["admin", "gerente", "director", "coordinator", "operations", "closer", "sdr", "leitor"];

/** admin, gerente e os papéis de gestão novos veem o agregado da empresa. */
export function isAdminView(role: string | null | undefined): boolean {
  return role === "admin" || role === "gerente" || role === "super_admin" || role === "director" || role === "coordinator" || role === "operations";
}

/**
 * "Ver como" (cookie `mcrm-view-as`) assume a identidade de outra pessoa,
 * inclusive o papel dela — é acesso a dado alheio, exclusivo do super_admin.
 * Fonte única pro papel REAL que pode ativar o modo: o middleware (gate de tela),
 * o tenant.ts (server components) e o api-server/auth.ts (Hono) derivam daqui.
 */
export function podeVerComo(realRole: string | null | undefined): boolean {
  return realRole === "super_admin";
}

/** SDR e closer veem apenas os próprios dados (filtro por responsavelId). */
export function isPersonalView(role: string | null | undefined): boolean {
  return role === "sdr" || role === "closer" || role === "vendedor";
}

/** Leitor é read-only: só relatório curado, sem ações nem dado individual. */
export function isReader(role: string | null | undefined): boolean {
  return role === "leitor";
}

/** Normaliza papéis legados para os canônicos (5 originais + 3 novos de RBAC v2). */
export function normalizeRole(role: string | null | undefined): Role {
  if (role === "vendedor") return "closer";
  if (role === "super_admin") return "admin";
  if (ROLES.includes(role as Role)) {
    return role as Role;
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
  if (r === "admin" || r === "gerente" || r === "director" || r === "coordinator" || r === "operations") return true; // vê tudo
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
