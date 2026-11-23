export type PublicErrorCode =
  | "bad_request"
  | "not_found"
  | "rate_limited"
  | "payload_too_large"
  | "misconfigured"
  | "upstream"
  | "internal";

export type PublicErrorBody = {
  error: string;
  code: PublicErrorCode;
};

export type MappedError = {
  status: number;
  body: PublicErrorBody;
};

/**
 * Convert an unknown failure into a stable public error.
 * Logs the original cause server-side; never returns stack traces to clients.
 */
export function mapErrorToPublic(error: unknown, fallbackMessage: string): MappedError {
  const message = error instanceof Error ? error.message : String(error);

  console.error("[ragdocs]", fallbackMessage, error);

  if (message.includes("OPENAI_API_KEY") || message.includes("not configured")) {
    return {
      status: 503,
      body: {
        error: "OpenAI is not configured on the server.",
        code: "misconfigured",
      },
    };
  }

  if (message.includes("Conversation not found")) {
    return {
      status: 404,
      body: { error: "Conversation not found.", code: "not_found" },
    };
  }

  if (
    message.includes("upload limit") ||
    message.includes("Only .md") ||
    message.includes("Unsupported") ||
    message.includes("must not be empty") ||
    message.includes("empty file") ||
    message.includes("Expected multipart")
  ) {
    return {
      status: 400,
      body: {
        error: sanitizeClientMessage(message, "Invalid request."),
        code: "bad_request",
      },
    };
  }

  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    /status\s*code\s*429/i.test(message)
  ) {
    return {
      status: 502,
      body: {
        error: "The AI provider is temporarily unavailable. Try again shortly.",
        code: "upstream",
      },
    };
  }

  if (
    /status\s*code\s*5\d\d/i.test(message) ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("fetch failed")
  ) {
    return {
      status: 502,
      body: {
        error: "The AI provider is temporarily unavailable. Try again shortly.",
        code: "upstream",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: fallbackMessage,
      code: "internal",
    },
  };
}

function sanitizeClientMessage(message: string, fallback: string): string {
  // Keep short, human-written validation messages; drop long SDK dumps.
  if (message.length > 200 || message.includes("\n")) {
    return fallback;
  }
  return message;
}

export function publicErrorMessage(error: unknown, fallbackMessage: string): string {
  return mapErrorToPublic(error, fallbackMessage).body.error;
}
