import { connection, NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_RETRIEVE_MIN_SCORE,
  DEFAULT_RETRIEVE_TOP_K,
  MAX_RETRIEVE_TOP_K,
} from "@/lib/documents/constants";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";

const retrieveBodySchema = z.object({
  query: z.string().trim().min(1, "Query must not be empty.").max(2000),
  topK: z.number().int().min(1).max(MAX_RETRIEVE_TOP_K).optional(),
  minScore: z.number().min(0).max(1).optional(),
  documentId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  await connection();

  try {
    const json: unknown = await request.json();
    const parsed = retrieveBodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await retrieveRelevantChunks({
      query: parsed.data.query,
      topK: parsed.data.topK ?? DEFAULT_RETRIEVE_TOP_K,
      minScore: parsed.data.minScore ?? DEFAULT_RETRIEVE_MIN_SCORE,
      documentId: parsed.data.documentId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve chunks";
    const status = message.includes("OPENAI_API_KEY")
      ? 503
      : message.includes("empty")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
