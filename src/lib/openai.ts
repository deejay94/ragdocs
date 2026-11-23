import OpenAI from "openai";

/**
 * Shared OpenAI client for embeddings and chat.
 * Throws a clear error when the key is missing or still a placeholder.
 */
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set a real key in .env.local.",
    );
  }

  return new OpenAI({ apiKey });
}
