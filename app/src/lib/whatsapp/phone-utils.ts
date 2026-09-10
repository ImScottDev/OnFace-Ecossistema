/**
 * Phone number normalization utilities.
 * Handles Brazilian (+55) and international numbers.
 */

/**
 * Placeholders que o WuzAPI/whatsmeow devolve em `Info.PushName` quando não
 * resolve o nome real do contato (ex: número nunca salvou nome no WhatsApp).
 * Não é traduzido pelo Callface — vem cru do binário Go. Sem esse filtro, o
 * CRM salva o placeholder como se fosse o nome do cliente.
 */
const PUSHNAME_PLACEHOLDERS = /^(utente sconosciuto|unknown|unknown user|desconhecido)$/i;

/** Nome de contato usável, ou `null` se `pushName` for placeholder de terceiro. */
export function sanitizePushName(pushName?: string | null): string | null {
  const trimmed = pushName?.trim();
  if (!trimmed || PUSHNAME_PLACEHOLDERS.test(trimmed)) return null;
  return trimmed;
}

/** Strip to digits only, add country code 55 only for Brazilian numbers */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");

  // If original input had a '+' prefix, it already includes country code
  const hadPlus = trimmed.startsWith("+");

  // Remove leading 0 (international dialing prefix like 00xx)
  if (digits.startsWith("00") && digits.length > 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length > 10 && !hadPlus) {
    digits = digits.slice(1);
  }

  // If had + prefix, country code is already there — don't touch
  if (hadPlus) return digits;

  // >11 digits means country code is already included (e.g. 5511999998888 = 13 digits)
  if (digits.length > 11) return digits;

  // 11 digits: could be BR mobile (DDD + 9 + 8) or US/Canada (1 + area + 7)
  // BR mobile pattern: 3rd digit is always 9 (e.g. 11987654321)
  // US pattern: starts with 1, 3rd digit is NOT 9 area code (e.g. 14077254988)
  if (digits.length === 11) {
    const isBrMobile = /^\d{2}9\d{8}$/.test(digits);
    return isBrMobile ? "55" + digits : digits;
  }

  // 10 digits: Brazilian landline (DDD + 8 digits)
  if (digits.length === 10) {
    return "55" + digits;
  }

  return digits;
}

/** Extract the last 9 digits for fuzzy matching (DDD + number) */
export function phoneLastDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-9);
}

/** Compare two phone numbers (fuzzy: last 9 digits match, includes DDD) */
export function phoneMatch(a: string, b: string): boolean {
  return phoneLastDigits(a) === phoneLastDigits(b);
}

/** Format for display: BR → (11) 99999-8888, international → +1 (407) 725-4988 */
export function formatPhoneDisplay(phone: string): string {
  const digits = normalizePhone(phone);

  // Brazilian numbers (starts with 55 + 10-11 digit local)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const local = digits.slice(2);
    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
  }

  // US/Canada numbers (starts with 1 + 10 digits)
  if (digits.startsWith("1") && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Generic international: +CC rest
  if (digits.length > 7) {
    return `+${digits}`;
  }

  return phone; // fallback
}

/** Build SQL LIKE pattern for matching by last 9 digits */
export function phoneLikePattern(phone: string): string {
  return `%${phoneLastDigits(phone)}`;
}
