/**
 * URL base pública do app: links de e-mail, proposta, checkout, assinatura.
 *
 * Fonte única. Cada ponto que montava a própria base repetia o fallback de
 * produção, e um ambiente sem `NEXTAUTH_URL` mandava o cliente do dev para a
 * produção sem ninguém ver. Sem dependência de banco: pode ser importado de
 * qualquer módulo de servidor.
 */
export function appUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://crm.callface.io"
  ).replace(/\/$/, "");
}
