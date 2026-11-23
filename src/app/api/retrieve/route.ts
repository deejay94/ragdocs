import { connection, NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_RETRIEVE_MIN_SCORE,
  DEFAULT_RETRIEVE_TOP_K,
  MAX_RETRIEVE_TOP_K,
} from "@/lib/documents/constants";
import { mapErrorToPublic } from "@/lib/http/errors";
import { readJsonBody, RequestTooLargeError } from "@/lib/http/request";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import { getRateLimitRetrievePerMin } from "@/lib/security/constants";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const retrieveBodySchema = z.object({
  query: z.string().trim().min(1, "Query must not be empty.").max(2000),
  topK: z.number().int().min(1).max(MAX_RETRIEVE_TOP_K).optional(),
  minScore: z.number().min(0).max(1).optional(),
  documentId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  await connection();

  const limit = getRateLimitRetrievePerMin();
  const ip = getClientIp(request);
  const rate = checkRateLimit(`retrieve:${ip}`, limit);

  if (!rate.ok) {
    return NextResponse.json(
      {
        error: "Too many retrieve requests. Try again shortly.",
        code: "rate_limited",
      },
      { status: 429, headers: rateLimitHeaders(rate, limit) },
    );
  }

  try {
    const json = await readJsonBody(request);
    const parsed = retrieveBodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
          code: "bad_request",
        },
        { status: 400, headers: rateLimitHeaders(rate, limit) },
      );
    }

    const result = await retrieveRelevantChunks({
      query: parsed.data.query,
      topK: parsed.data.topK ?? DEFAULT_RETRIEVE_TOP_K,
      minScore: parsed.data.minScore ?? DEFAULT_RETRIEVE_MIN_SCORE,
      documentId: parsed.data.documentId,
    });

    return NextResponse.json(result, {
      headers: rateLimitHeaders(rate, limit),
    });
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return NextResponse.json(
        {
          error: "Request body is too large.",
          code: "payload_too_large",
        },
        { status: 413, headers: rateLimitHeaders(rate, limit) },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Invalid JSON body.",
          code: "bad_request",
        },
        { status: 400, headers: rateLimitHeaders(rate, limit) },
      );
    }

    const mapped = mapErrorToPublic(error, "Failed to retrieve chunks.");
    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: rateLimitHeaders(rate, limit),
    });
  }
}
