/**
 * Confere se as credenciais de e-mail persistidas ainda podem ser abertas com
 * EMAIL_ENCRYPTION_KEY do ambiente atual. Nunca imprime token, senha ou e-mail.
 *
 * Uso: npx tsx --env-file=.env src/scripts/verificar-cifragem-email.ts
 */
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { decrypt } from "@/lib/email/encryption";

type Resultado = { total: number; decryptable: number; unreadable: number };

function testarValor(value: string | null): boolean {
  if (!value) return true;
  try {
    decrypt(value);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const contas = await db.select({
    tipo: emailContas.tipo,
    accessToken: emailContas.accessToken,
    refreshToken: emailContas.refreshToken,
    imapUser: emailContas.imapUser,
    imapPass: emailContas.imapPass,
    smtpUser: emailContas.smtpUser,
    smtpPass: emailContas.smtpPass,
  }).from(emailContas);

  const porTipo = new Map<string, Resultado>();
  for (const conta of contas) {
    const tipo = conta.tipo || "desconhecido";
    const resultado = porTipo.get(tipo) ?? { total: 0, decryptable: 0, unreadable: 0 };
    resultado.total++;
    const integra = [conta.accessToken, conta.refreshToken, conta.imapUser, conta.imapPass, conta.smtpUser, conta.smtpPass]
      .every(testarValor);
    if (integra) resultado.decryptable++;
    else resultado.unreadable++;
    porTipo.set(tipo, resultado);
  }

  let failed = false;
  for (const [tipo, resultado] of porTipo) {
    console.log(`${tipo}: total=${resultado.total} decryptable=${resultado.decryptable} unreadable=${resultado.unreadable}`);
    failed ||= resultado.unreadable > 0;
  }
  if (!contas.length) console.log("Nenhuma conta de e-mail persistida.");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
