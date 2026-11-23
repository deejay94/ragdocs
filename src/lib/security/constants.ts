/** Max JSON body size for chat / retrieve (bytes). */
export const MAX_JSON_BODY_BYTES = 32 * 1024;

/** Rate-limit window. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Default per-IP request ceilings within the window. */
export const RATE_LIMIT_CHAT_PER_MIN = 10;
export const RATE_LIMIT_RETRIEVE_PER_MIN = 30;
export const RATE_LIMIT_DOCUMENTS_WRITE_PER_MIN = 10;

/** OpenAI retry policy for transient failures. */
export const OPENAI_RETRY_ATTEMPTS = 3;
export const OPENAI_RETRY_BASE_DELAY_MS = 400;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getRateLimitChatPerMin(): number {
  return envInt("RATE_LIMIT_CHAT_PER_MIN", RATE_LIMIT_CHAT_PER_MIN);
}

export function getRateLimitRetrievePerMin(): number {
  return envInt("RATE_LIMIT_RETRIEVE_PER_MIN", RATE_LIMIT_RETRIEVE_PER_MIN);
}

export function getRateLimitDocumentsWritePerMin(): number {
  return envInt(
    "RATE_LIMIT_DOCUMENTS_WRITE_PER_MIN",
    RATE_LIMIT_DOCUMENTS_WRITE_PER_MIN,
  );
}
