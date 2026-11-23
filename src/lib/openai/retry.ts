import {
  OPENAI_RETRY_ATTEMPTS,
  OPENAI_RETRY_BASE_DELAY_MS,
} from "@/lib/security/constants";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableOpenAIError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;

  if (status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  if (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND"
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("fetch failed") ||
    message.includes("socket hang up") ||
    message.includes("network")
  );
}

function delayForAttempt(attempt: number): number {
  const exponential = OPENAI_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 100);
  return exponential + jitter;
}

/**
 * Retry an OpenAI call on transient 429/5xx and network failures.
 */
export async function withOpenAIRetry<T>(
  operation: () => Promise<T>,
  attempts: number = OPENAI_RETRY_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableOpenAIError(error) || attempt === attempts) {
        throw error;
      }
      await sleep(delayForAttempt(attempt));
    }
  }

  throw lastError;
}
