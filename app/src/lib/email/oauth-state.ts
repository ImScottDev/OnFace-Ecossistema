import { decrypt, encrypt } from "./encryption";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_CLOCK_SKEW_MS = 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EmailOAuthState = {
  organizacaoId: string;
  userId: string;
  issuedAt: number;
};

export function createEmailOAuthState(
  state: Pick<EmailOAuthState, "organizacaoId" | "userId">,
  now = Date.now(),
): string {
  return encrypt(JSON.stringify({ ...state, issuedAt: now }));
}

export function readEmailOAuthState(value: string, now = Date.now()): EmailOAuthState {
  const parsed: unknown = JSON.parse(decrypt(value));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OAuth state invalid");
  }

  const { organizacaoId, userId, issuedAt } = parsed as Partial<EmailOAuthState>;
  if (
    typeof organizacaoId !== "string" || !UUID_PATTERN.test(organizacaoId) ||
    typeof userId !== "string" || !UUID_PATTERN.test(userId) ||
    typeof issuedAt !== "number" || !Number.isFinite(issuedAt) ||
    issuedAt > now + OAUTH_STATE_CLOCK_SKEW_MS || now - issuedAt > OAUTH_STATE_TTL_MS
  ) {
    throw new Error("OAuth state expired or invalid");
  }

  return { organizacaoId, userId, issuedAt };
}
