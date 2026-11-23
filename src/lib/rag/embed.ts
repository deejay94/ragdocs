import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "@/lib/documents/constants";
import { getOpenAIClient } from "@/lib/openai";

/**
 * Batch-embed texts with text-embedding-3-small (1536 dimensions).
 * Preserves input order in the returned vectors.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of ordered) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding size ${item.embedding.length}; expected ${EMBEDDING_DIMENSIONS}.`,
        );
      }
      vectors.push(item.embedding);
    }
  }

  if (vectors.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: got ${vectors.length}, expected ${texts.length}.`,
    );
  }

  return vectors;
}
