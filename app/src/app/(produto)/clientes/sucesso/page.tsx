import { redirect } from "next/navigation";

/**
 * Alias de compatibilidade. O módulo se chama CS desde 08/09/2026 e mora em
 * `/clientes/cs`; esta rota existia desde 19/08 e está em link antigo,
 * favorito e histórico de navegador.
 */
export default function ClientesSucessoAlias() {
  redirect("/clientes/cs");
}
