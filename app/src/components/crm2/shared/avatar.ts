/**
 * Avatar de iniciais (20/08, Carteira de Clientes — pedido do Kauã: trocar
 * o ícone genérico de prédio por um quadrado colorido com as iniciais da
 * empresa). Reusa o que já existe no produto, não inventa 2 padrões
 * visuais novos:
 *
 * - Iniciais: MESMO algoritmo já usado em ClienteDrawer.tsx (primeiras 2
 *   palavras do nome, 1ª letra de cada, maiúsculas).
 * - Paleta: MESMAS 5 cores já usadas pra avatar em Início/Vendas
 *   (--cf2-avatar-1..5, definidas em globals.css) — não a cor genérica do
 *   mockup, seguindo a regra da sessão de manter a marca real da Callface.
 *
 * A ÚNICA peça nova é a escolha DETERMINÍSTICA da cor por hash do id da
 * empresa. Em Início/Vendas a cor é escolhida por posição na lista
 * (avatarColors[i]) — lá não importa estabilidade porque é um ranking do
 * dia. Aqui a MESMA empresa aparece em páginas/paginações diferentes da
 * Carteira e precisa manter a cor sempre igual, senão pisca cor a cada
 * reload — daí o hash em vez do índice de posição.
 */

const PALETA_AVATAR = [
  "var(--cf2-avatar-1)",
  "var(--cf2-avatar-2)",
  "var(--cf2-avatar-3)",
  "var(--cf2-avatar-4)",
  "var(--cf2-avatar-5)",
];

export function iniciaisEmpresa(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palavra) => palavra[0])
    .join("")
    .toUpperCase();
}

export function corAvatarEmpresa(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETA_AVATAR[hash % PALETA_AVATAR.length];
}
