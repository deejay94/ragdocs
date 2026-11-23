import { getChatModel } from "@/lib/documents/constants";
import { getOpenAIClient } from "@/lib/openai";
import { buildGroundedMessages } from "@/lib/rag/prompt";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

/**
 * Stream a grounded chat completion token-by-token from retrieved context.
 */
export async function* streamGroundedAnswer(options: {
  query: string;
  chunks: RetrievedChunk[];
}): AsyncGenerator<string> {
  const client = getOpenAIClient();
  const messages = buildGroundedMessages(options);

  const stream = await client.chat.completions.create({
    model: getChatModel(),
    messages,
    stream: true,
    temperature: 0.2,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}
