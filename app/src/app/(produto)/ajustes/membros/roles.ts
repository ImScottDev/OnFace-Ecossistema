import type { Role } from "@/lib/auth/roles";

/**
 * Rótulos de papel em português. Fonte única da UI de equipe — antes existiam
 * duas listas divergentes: `(crm)/admin/usuarios` tinha os 8 papéis reais e
 * `(produto)/ajustes/membros` tinha 4 rótulos inventados ("vendedor",
 * "super_admin") que não batiam com `ROLES`, então papel nenhum era exibido
 * corretamente na tela nova.
 */
export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  director: "Diretor",
  coordinator: "Coordenador",
  operations: "Operações",
  closer: "Closer",
  sdr: "SDR",
  leitor: "Leitor",
  // Legado ainda presente no banco.
  vendedor: "Closer (legado)",
  super_admin: "Super Admin",
};

/** Uma linha de ajuda por papel, no `title` do select — o legado tinha tudo espremido num tooltip só. */
export const ROLE_AJUDA: Record<Role, string> = {
  admin: "Gestão total, incluindo ajustes da organização",
  gerente: "Vê o agregado da empresa e a equipe",
  director: "Visão executiva do agregado da empresa",
  coordinator: "Gestão de time",
  operations: "Administra pipeline, catálogo e automações",
  closer: "Fecha negócios; vê os próprios números",
  sdr: "Pré-vendas; vê os próprios números",
  leitor: "Somente leitura",
};
