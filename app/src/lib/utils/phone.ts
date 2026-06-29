/**
 * Detect if a phone number can receive WhatsApp messages.
 * BR mobile: 2-digit DDD + 9 + 8 digits = 11 digits, optionally with +55 prefix.
 * International: any number with country code (starts with + or has >11 digits).
 */
export function isCelular(tel: string | null | undefined): boolean {
  if (!tel) return false;
  const trimmed = tel.trim();
  const digits = trimmed.replace(/\D/g, "");

  // Brazilian mobile: (55)? + DDD(2) + 9 + 8 digits
  if (/^(?:55)?(\d{2})9\d{8}$/.test(digits)) return true;

  // International number (has + prefix and enough digits)
  if (trimmed.startsWith("+") && digits.length >= 10) return true;

  // Number with country code already (>11 digits, non-BR)
  if (digits.length > 11 && !digits.startsWith("55")) return true;

  return false;
}
