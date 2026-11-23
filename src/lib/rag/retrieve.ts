import { and, cosineDistance, desc, eq, sql } from "drizzle-orm";

import {
  DEFAULT_RETRIEVE_MIN_SCORE,
  DEFAULT_RETRIEVE_TOP_K,
  MAX_RETRIEVE_TOP_K,
} from "@/lib/documents/constants";
import { db } from "@/lib/db";
import { chunks, documents } from "@/lib/db/schema";
import { embedTexts } from "@/lib/rag/embed";

export type RetrieveOptions = {
  query: string;
  topK?: number;
  minScore?: number;
  documentId?: string;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  headingPath: string | null;
  content: string;
  tokenEstimate: number;
  /** Cosine similarity in [0, 1] (approximately): 1 - cosine_distance. */
  score: number;
};

export type RetrieveResult = {
  query: string;
  topK: number;
  minScore: number;
  grounded: boolean;
  bestScore: number | null;
  results: RetrievedChunk[];
};

function clampTopK(topK: number | undefined): number {
  const value = topK ?? DEFAULT_RETRIEVE_TOP_K;
  return Math.min(Math.max(1, Math.floor(value)), MAX_RETRIEVE_TOP_K);
}

/**
 * Embed a query and return the top-k most similar ready chunks.
 * Does not call a chat model — retrieve-only for Milestone 4.
 */
export async function retrieveRelevantChunks(
  options: RetrieveOptions,
): Promise<RetrieveResult> {
  const query = options.query.trim();
  if (!query) {
    throw new Error("Query must not be empty.");
  }

  const topK = clampTopK(options.topK);
  const minScore = options.minScore ?? DEFAULT_RETRIEVE_MIN_SCORE;

  const [queryEmbedding] = await embedTexts([query]);
  const distance = cosineDistance(chunks.embedding, queryEmbedding);
  const score = sql<number>`(1 - (${distance}))`;

  const filters = [eq(documents.status, "ready")];
  if (options.documentId) {
    filters.push(eq(documents.id, options.documentId));
  }

  const rows = await db
    .select({
      chunkId: chunks.id,
      documentId: documents.id,
      documentTitle: documents.title,
      chunkIndex: chunks.chunkIndex,
      headingPath: chunks.headingPath,
      content: chunks.content,
      tokenEstimate: chunks.tokenEstimate,
      score,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(and(...filters))
    .orderBy(desc(score))
    .limit(topK);

  const results: RetrievedChunk[] = rows.map((row) => ({
    chunkId: row.chunkId,
    documentId: row.documentId,
    documentTitle: row.documentTitle,
    chunkIndex: row.chunkIndex,
    headingPath: row.headingPath,
    content: row.content,
    tokenEstimate: row.tokenEstimate,
    score: Number(row.score),
  }));

  const bestScore = results.length > 0 ? results[0].score : null;
  const grounded = bestScore !== null && bestScore >= minScore;

  return {
    query,
    topK,
    minScore,
    grounded,
    bestScore,
    results,
  };
}
