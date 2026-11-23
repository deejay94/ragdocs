import {
  DEFAULT_RETRIEVE_MIN_SCORE,
  DEFAULT_RETRIEVE_TOP_K,
  GROUNDED_REFUSAL_MESSAGE,
} from "@/lib/documents/constants";
import {
  addMessage,
  createConversation,
  getConversation,
} from "@/lib/chat/store";
import type { ChatStreamEvent, Citation } from "@/lib/chat/types";
import { streamGroundedAnswer } from "@/lib/rag/generate";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";

export type AnswerQuestionOptions = {
  query: string;
  conversationId?: string;
  documentId?: string;
};

function toCitations(
  chunks: {
    chunkId: string;
    documentId: string;
    documentTitle: string;
    headingPath: string | null;
    chunkIndex: number;
    score: number;
  }[],
): Citation[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    headingPath: chunk.headingPath,
    chunkIndex: chunk.chunkIndex,
    score: chunk.score,
  }));
}

/**
 * Retrieve, refuse or stream a grounded answer, and persist both turns.
 * Yields SSE-friendly chat events.
 */
export async function* answerQuestion(
  options: AnswerQuestionOptions,
): AsyncGenerator<ChatStreamEvent> {
  const query = options.query.trim();
  if (!query) {
    throw new Error("Query must not be empty.");
  }

  let conversationId = options.conversationId;
  if (conversationId) {
    const existing = await getConversation(conversationId);
    if (!existing) {
      throw new Error("Conversation not found.");
    }
  } else {
    const created = await createConversation();
    conversationId = created.id;
  }

  await addMessage({
    conversationId,
    role: "user",
    content: query,
  });

  const retrieval = await retrieveRelevantChunks({
    query,
    topK: DEFAULT_RETRIEVE_TOP_K,
    minScore: DEFAULT_RETRIEVE_MIN_SCORE,
    documentId: options.documentId,
  });

  const citations = retrieval.grounded
    ? toCitations(retrieval.results)
    : [];

  yield {
    type: "meta",
    conversationId,
    grounded: retrieval.grounded,
    bestScore: retrieval.bestScore,
    minScore: retrieval.minScore,
    citations,
  };

  if (!retrieval.grounded) {
    await addMessage({
      conversationId,
      role: "assistant",
      content: GROUNDED_REFUSAL_MESSAGE,
      citations: [],
    });

    yield {
      type: "refusal",
      content: GROUNDED_REFUSAL_MESSAGE,
    };
    yield { type: "done" };
    return;
  }

  let fullAnswer = "";

  try {
    for await (const token of streamGroundedAnswer({
      query,
      chunks: retrieval.results,
    })) {
      fullAnswer += token;
      yield { type: "token", content: token };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate answer";
    yield { type: "error", error: message };
    return;
  }

  const content =
    fullAnswer.trim() ||
    "I could not generate an answer from the retrieved documentation.";

  await addMessage({
    conversationId,
    role: "assistant",
    content,
    citations,
  });

  yield { type: "done" };
}
