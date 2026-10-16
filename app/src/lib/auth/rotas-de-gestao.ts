import { isAdminView } from "./roles";

/**
 * Quem alcança o quê, por papel — a decisão que o middleware aplica.
 *
 * Mora aqui, e não dentro de `middleware.ts`, porque lá ela só podia ser
 * conferida por regex em cima do texto do arquivo (ver middleware-rbac.test.ts):
 * o teste lia as listas, não a regra. Com a exceção do índice de Ajustes
 * (16/10/2026) isso deixou de bastar — a lista continua dizendo "/ajustes é de
 * gestão" enquanto a regra abre a raiz. Agora o teste executa a mesma função
 * que a requisição executa.
 */

/**
 * Telas de configuração e de dinheiro: só admin/gerente/super_admin e os
 * papéis de gestão da RBAC v2 (director/coordinator/operations), via
 * `isAdminView`. Closer e SDR veem os próprios números no Meu Dia e na
 * Carteira filtrada.
 *
 * Saneamento 14/09/2026: a lista cobria só as rotas do CRM 1, que hoje são
 * REDIRECTS. Os destinos reais do CRM2 (`/clientes/financeiro`, `/ajustes`)
 * ficaram abertos a qualquer papel autenticado — um closer ou SDR abria o
 * Financeiro inteiro e a configuração da organização.
 *
 * `/design` é o laboratório do Design System: fixtures com nome de cliente
 * ("TechCorp Telecom"), metas e realizados de pessoas do time e valores em
 * reais inventados, numa casca idêntica à do produto. Estava só atrás de
 * sessão — qualquer SDR, closer ou usuário de cliente abria a URL e lia
 * aquilo como se fosse a operação (auditoria de 14/10/2026).
 */
export const GESTAO = ["/configuracoes", "/financeiro", "/campanhas", "/clientes/financeiro", "/ajustes", "/design"];

/**
 * Conexão de e-mail/calendário e de número de WhatsApp é PESSOAL (cada um
 * conecta a própria conta e o próprio número), não configuração da
 * organização — closer e SDR precisam alcançar. O escopo do que aparece lá
 * dentro é do servidor (lib/whatsapp/acesso), não deste gate.
 */
export const PESSOAIS = ["/configuracoes/email", "/ajustes/email", "/ajustes/whatsapp"];

/**
 * O ÍNDICE de Ajustes abre para qualquer papel: é por ele que closer e SDR
 * chegam às seções pessoais. Antes caía no gate e o item "Ajustes" do menu de
 * perfil piscava de volta ao Início — o time relatou "não consigo clicar em
 * Ajustes" (16/10/2026). Só a raiz, exata: toda SEÇÃO de gestão segue barrada,
 * e o que a tela mostra lá dentro é escolhido por papel (ajustes/Nav.tsx e
 * ajustes/page.tsx).
 */
export const ABERTAS_EXATAS = ["/ajustes"];

export function ehRotaPessoal(pathname: string): boolean {
  return ABERTAS_EXATAS.includes(pathname) || PESSOAIS.some((p) => pathname.startsWith(p));
}

/** `true` quando o papel não pode abrir a rota e o middleware devolve ao Início. */
export function barraPorPapel(pathname: string, role: string | null | undefined): boolean {
  if (ehRotaPessoal(pathname)) return false;
  if (!GESTAO.some((p) => pathname.startsWith(p))) return false;
  return !isAdminView(role);
}
